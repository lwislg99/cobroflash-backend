#!/usr/bin/env node
// SCRUM-1427 · EL TRASPASO DERIVADO — lo que una sesión dejó, sacado de su rastro
//
//   node scripts/traspaso-derivado.mjs <nombre-de-la-sesión> [--jobs <carpeta>] [--sin-arboles]
//
// POR QUÉ EXISTE. El traspaso se escribe al FINAL, y una sesión a la que le cortan la cuota o que muere
// a mitad de turno no llega al final. Medido en SCRUM-1418: 32 sesiones sin traspaso en dos semanas, y
// 10 de 16 en dos paradas colectivas en el mismo minuto. No fue descuido: el mecanismo exige llegar viva.
// Esto NO le pide nada a la sesión: lo saca de lo que ya quedó escrito mientras trabajaba.
//
// 🔴 NO ES UN TRASPASO ESCRITO, Y NO LO SUSTITUYE. Dice QUÉ tocó; no dice por qué, ni qué descartó, ni
// qué iba a hacer. Eso solo lo lleva el traspaso que escribe la sesión. Esto es la red para cuando no
// llega. Por eso la salida empieza con su marca, y quien lo guarde en `memory/` la conserva: una lista de
// ficheros leída como si llevara intención es atribuirle a la sesión lo que no dijo.
//
// DE DÓNDE SALE CADA COSA — todo estructurado, nada por palabras salvo donde se dice:
//   el encargo                 `intent` de su `state.json`
//   el último mensaje recibido la última entrada de usuario con `origin` (peer / human) de su transcripción
//   tickets de Jira            llamadas a las herramientas de Jira que ESCRIBEN (comentar, transicionar, editar)
//   PR                         las entradas `pr-link` de la transcripción
//   lo que empujó              sus órdenes `git … push` (⚠️ aquí sí se lee una orden de consola: se imprime
//                              la orden, no una rama deducida)
//   ficheros tras el último commit   sus `Write`/`Edit` posteriores a su última orden `git … commit`
//   cómo se cortó              `isApiErrorMessage` / `error` de la entrada: el motivo lo da el arnés
//   sus últimas palabras       el último texto SUYO. Un mensaje del arnés (`isApiErrorMessage`, modelo
//                              `<synthetic>`) NO es suyo y se salta: el de «límite semanal» es lo último
//                              que hay en la transcripción de justo las sesiones que más importan
//
// LOS TRES CUBOS, y no se confunden:
//   CON RASTRO                  escribió, comiteó, empujó o tocó Jira
//   NO HIZO NADA QUE MUTE       transcripción leída ENTERA y sin nada de eso
//   NO SUPE                     sin transcripción (¿se limpió la carpeta?), vacía, o con líneas ilegibles.
//                               Una carpeta borrada NO es «no hizo nada»
//
// LO QUE NO VE: cambios hechos por consola (un `sed`, un script) · lo que haya en otra máquina · nada, si
// la carpeta del trabajo ya no está en disco.
//
// SALIDA: 0 = derivado (CON RASTRO o NO HIZO NADA) · 2 = NO SUPE, o no existe esa sesión, o hay varias.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arbolDe, arbolesDeVerdad, RUIDO_DEL_ARNES } from './sesiones-que-no-volvieron.mjs';

export const MARCA = 'TRASPASO DERIVADO — NO LO ESCRIBIÓ LA SESIÓN. Sale de su rastro: dice QUÉ tocó, no por qué ni qué iba a hacer.';

const ESCRIBE = new Set(['Write', 'Edit', 'NotebookEdit']);
const ES_MEMORIA = /[\\/]memory[\\/][^\\/]+\.md$/i;
const COMITEA = /\bgit\b[^\n|;&]*\bcommit\b/;
const EMPUJA = /\bgit\b[^\n|;&]*\bpush\b[^\n|;&]*/;
const JIRA_ESCRIBE = /jira/i;
const VERBO_JIRA = /(addComment|transition|editJira|addWorklog)/i;
const recorte = (s, n) => { const t = String(s).replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
const textoDe = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n') : '');

/** ¿Esta entrada la escribió el ARNÉS y no la sesión? Dato estructurado, no su texto. */
export const esDelArnes = (o) => Boolean(o && (o.isApiErrorMessage || (o.message && o.message.model === '<synthetic>')));

/**
 * @param {{nombre:string, estado?:string, intent?:string, transcripcion:string|null}} s
 * @returns {{cubo:'CON RASTRO'|'NO HIZO NADA QUE MUTE'|'NO SUPE', motivo?:string, [k:string]:any}}
 */
export function derivar(s) {
  const base = { nombre: s.nombre, estado: s.estado ?? null, encargo: s.intent ? recorte(s.intent, 400) : null };
  if (s.transcripcion == null) return { ...base, cubo: 'NO SUPE', motivo: 'no hay transcripción (¿se limpió la carpeta del trabajo?). Esto NO dice que no hiciera nada' };
  const r = { ...base, jira: new Set(), prs: new Set(), empujes: [], trasElUltimoCommit: [], commits: 0, ediciones: 0, ultimoRecibido: null, ultimasPalabras: null, corte: null };
  let leidas = 0, rotas = 0;
  for (const l of s.transcripcion.split('\n')) {
    if (!l.trim()) continue;
    let o; try { o = JSON.parse(l); } catch { rotas++; continue; }
    leidas++;
    if (o.type === 'pr-link' && o.prNumber != null) { r.prs.add(Number(o.prNumber)); continue; }
    if (o.type === 'user' && o.origin && o.toolUseResult === undefined) {
      const texto = textoDe(o.message && o.message.content);
      const de = /from-name="([^"]+)"/.exec(texto);
      r.ultimoRecibido = { cuando: o.timestamp || null, de: o.origin.kind === 'peer' ? `otra sesión${de ? ` (${de[1]})` : ''}` : o.origin.kind === 'human' ? 'una persona' : String(o.origin.kind), texto: recorte(texto.replace(/^[\s\S]*?<cross-session-message[^>]*>/, ''), 500) };
      continue;
    }
    if (o.type !== 'assistant') continue;
    if (esDelArnes(o)) { r.corte = { motivo: String(o.error || 'error del arnés'), cuando: o.timestamp || null }; continue; }
    const c = o.message && o.message.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (!b) continue;
      if (b.type === 'text' && b.text && b.text.trim()) { r.ultimasPalabras = { cuando: o.timestamp || null, texto: recorte(b.text, 700) }; r.corte = null; }
      if (b.type !== 'tool_use' || !b.input) continue;
      const ruta = b.input.file_path || b.input.notebook_path || '';
      const orden = typeof b.input.command === 'string' ? b.input.command : '';
      if (JIRA_ESCRIBE.test(b.name) && VERBO_JIRA.test(b.name) && b.input.issueIdOrKey) r.jira.add(String(b.input.issueIdOrKey));
      const e = EMPUJA.exec(orden); if (e) r.empujes.push(recorte(e[0], 160));
      if (COMITEA.test(orden)) { r.commits++; r.trasElUltimoCommit = []; }
      if (ESCRIBE.has(b.name) && ruta && !ES_MEMORIA.test(ruta)) { r.ediciones++; if (!r.trasElUltimoCommit.includes(ruta)) r.trasElUltimoCommit.push(ruta); }
    }
  }
  if (leidas === 0) return { ...base, cubo: 'NO SUPE', motivo: 'la transcripción está vacía' };
  r.jira = [...r.jira].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })); r.prs = [...r.prs].sort((a, b) => a - b);
  if (rotas > 0) return { ...r, cubo: 'NO SUPE', motivo: `${rotas} línea(s) de la transcripción no se dejan leer: puede estar cortada. Lo de abajo es SOLO lo que se pudo leer` };
  const muto = r.ediciones > 0 || r.commits > 0 || r.empujes.length > 0 || r.jira.length > 0 || r.prs.length > 0;
  return { ...r, cubo: muto ? 'CON RASTRO' : 'NO HIZO NADA QUE MUTE' };
}

/**
 * @param {ReturnType<typeof derivar>} d
 * @param {{ruta:string, rama:string, sucios:string[]|undefined}[]|null} arboles  `null` = no se miraron
 */
export function informe(d, arboles) {
  const out = [MARCA, 'No sustituye al traspaso que escribe la sesión: es la red para cuando no llegó a escribirlo.', '', `sesión: ${d.nombre} · estado en su state.json: ${d.estado ?? 'desconocido'} · ${d.cubo}`];
  if (d.motivo) out.push(`🔴 ${d.motivo}.`);
  out.push('', `EL ENCARGO con el que arrancó: ${d.encargo ?? 'no consta en su state.json'}`);
  if (d.cubo === 'NO SUPE' && d.ediciones === undefined) return { codigo: 2, lineas: out };
  const normal = (p) => String(p).replace(/\\/g, '/');
  out.push(
    '', `EL ÚLTIMO MENSAJE QUE RECIBIÓ${d.ultimoRecibido ? ` (de ${d.ultimoRecibido.de}${d.ultimoRecibido.cuando ? `, ${d.ultimoRecibido.cuando}` : ''})` : ''}: ${d.ultimoRecibido ? d.ultimoRecibido.texto : 'ninguno'}`,
    '', `TICKETS DONDE ESCRIBIÓ EN JIRA (${d.jira.length}): ${d.jira.join(', ') || 'ninguno'}`,
    `PR (${d.prs.length}): ${d.prs.map((n) => `#${n}`).join(', ') || 'ninguno'}`,
    `ÓRDENES DE EMPUJAR (${d.empujes.length})${d.empujes.length ? ' — la orden tal cual, no una rama deducida:' : ': ninguna'}`,
    ...d.empujes.slice(-6).map((e) => `   · ${e}`),
    ...(d.empujes.length > 6 ? [`   (y ${d.empujes.length - 6} anteriores)`] : []),
    '', `FICHEROS QUE ESCRIBIÓ DESPUÉS DE SU ÚLTIMO COMMIT (${d.trasElUltimoCommit.length})${d.commits === 0 ? ' — no comiteó nunca: son todos los que escribió' : ''}:`,
  );
  for (const p of d.trasElUltimoCommit) {
    let hoy = 'árboles no mirados';
    if (arboles) {
      const a = arbolDe(p, arboles);
      if (!a) hoy = 'fuera de todo árbol de trabajo que git conozca';
      else if (a.sucios === undefined) hoy = 'su árbol no se pudo mirar';
      else {
        const rel = normal(p).toLowerCase().slice(normal(a.ruta).length + 1);
        const sucio = a.sucios.find((f) => !RUIDO_DEL_ARNES.some((re) => re.test(f)) && (normal(f).toLowerCase() === rel || (f.endsWith('/') && rel.startsWith(normal(f).toLowerCase()))));
        hoy = sucio ? `🔴 HOY SIGUE SIN COMITEAR en ${a.ruta} [${a.rama}]` : `hoy no figura como cambio sin comitear en ${a.ruta} [${a.rama}]`;
      }
    }
    out.push(`   · ${normal(p)} — ${hoy}`);
  }
  if (d.trasElUltimoCommit.length === 0) out.push('   ninguno');
  out.push(
    '', `CÓMO SE CORTÓ: ${d.corte ? `el arnés la paró — ${d.corte.motivo}${d.corte.cuando ? ` (${d.corte.cuando})` : ''}` : 'no consta un corte del arnés al final de su transcripción'}`,
    '', `SUS ÚLTIMAS PALABRAS${d.ultimasPalabras && d.ultimasPalabras.cuando ? ` (${d.ultimasPalabras.cuando})` : ''}: ${d.ultimasPalabras ? d.ultimasPalabras.texto : 'murió sin decir nada'}`,
    '', 'LO QUE ESTO NO VE: cambios hechos por consola · por qué decidió nada · qué iba a hacer después.',
  );
  return { codigo: d.cubo === 'NO SUPE' ? 2 : 0, lineas: out };
}

/** Las sesiones con ese nombre, con lo que haga falta leído. Lo que no se puede leer llega como `null`. */
export function buscar(carpeta, nombre) {
  const out = [];
  for (const id of fs.readdirSync(carpeta)) {
    let st; try { st = JSON.parse(fs.readFileSync(path.join(carpeta, id, 'state.json'), 'utf8')); } catch { continue; }
    const flags = st.respawnFlags || []; const i = flags.indexOf('-n');
    if ((i >= 0 ? flags[i + 1] : '') !== nombre) continue;
    let transcripcion = null; try { transcripcion = st.linkScanPath ? fs.readFileSync(st.linkScanPath, 'utf8') : null; } catch { transcripcion = null; }
    out.push({ id, nombre, estado: st.state, intent: st.intent, transcripcion });
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const arg = (n, def) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : def; };
  const nombre = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--jobs');
  const no = (m) => { console.log(`${MARCA}\n\n🔴 NO VALE (salida 2): ${m}`); process.exit(2); };
  if (!nombre) no('falta el nombre de la sesión. Uso: node scripts/traspaso-derivado.mjs <nombre>');
  const carpeta = arg('--jobs', path.join(os.homedir(), '.claude', 'jobs'));
  let halladas; try { halladas = buscar(carpeta, nombre); } catch (e) { no(`no se puede leer ${carpeta} (${e.code || e.message})`); }
  if (halladas.length === 0) no(`no hay ninguna sesión llamada «${nombre}» en ${carpeta}. Si su carpeta se limpió, su rastro ya no existe: eso NO dice que no hiciera nada`);
  if (halladas.length > 1) no(`hay ${halladas.length} sesiones llamadas «${nombre}» (${halladas.map((h) => h.id).join(', ')}). No elijo una por ti`);
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const r = informe(derivar(halladas[0]), args.includes('--sin-arboles') ? null : arbolesDeVerdad(raiz));
  console.log(r.lineas.join('\n'));
  process.exit(r.codigo);
}
