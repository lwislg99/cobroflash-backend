#!/usr/bin/env node
// SCRUM-1418 · LAS SESIONES QUE SE PARARON Y NUNCA VOLVIERON: ¿ENTREGARON, O SE LO LLEVARON?
//
//   node scripts/sesiones-que-no-volvieron.mjs [--jobs <carpeta>] [--control-si <sesión>] [--control-no <sesión>] [--sin-arboles]
//
// POR QUÉ EXISTE. SCRUM-1414 midió que 174 sesiones de puesto se pararon y no volvieron. Su espera no
// tiene final; lo que sí se puede saber es si dejaron el trabajo ENTREGADO o se lo llevaron consigo.
//
// LAS DOS MITADES, y por qué son dos:
//
//   1 · LA SESIÓN: ¿escribió su traspaso?  Se mira en SU transcripción: una llamada `Write`/`Edit` a un
//       fichero `*traspaso*.md`. NO se mira la fecha del fichero de traspaso: es uno por puesto y se
//       reutiliza, así que toda sesión anterior a la última escritura daría «entregó» la escribiera ella
//       o la siguiente. (El latido sí la usa, y bien: solo juzga las sesiones de las últimas horas.)
//   2 · EL REPOSITORIO: ¿qué hay sin empujar?  Se mira en git, no en lo que la sesión dijo: ramas locales
//       que no están en `origin` y cuyo CONTENIDO cambiaría `main`, y árboles de trabajo con cambios sin
//       comitear. Es comprobable por cualquiera. Una rama solo se atribuye a una sesión si esa sesión la
//       NOMBRA en una de sus llamadas de herramienta; si no, «sin sesión conocida».
//
// LOS CUBOS DE LA MITAD 1 (y NO SUPE no es ninguno de los otros):
//   ENTREGÓ AL CERRAR      escribió su traspaso y después no tocó ningún fichero ni comiteó
//   ENTREGÓ Y SIGUIÓ       escribió su traspaso y después siguió editando o comiteando: lo de después
//                          no está en el traspaso. Se dice cuántas ediciones
//   NO ENTREGÓ             transcripción leída entera, sin ninguna escritura a un traspaso
//   NO SUPE                sin transcripción, vacía, o con líneas que no se dejan leer (cortada)
//
// ESTE SCRIPT NO BORRA, NO EMPUJA Y NO RESCATA NADA. Mide. Qué se hace lo decide el orquestador.
//
// SALIDA: 0 = medido · 2 = NO VALE (sin líneas de tiempo, un control que no sale, o git que no se deja leer).
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { leerTrabajos, leerLinea, tramosDe, puestoDe } from './espera-del-equipo.mjs';

/** Dos sesiones REALES de las que se sabe la respuesta (medido el 2-oct-2026). Prueban al lector en cada pasada. */
export const CONTROL_SI = 's0-1oct';   // escribió `project_s0_traspaso.md` a las 12:38Z del 1-oct
export const CONTROL_NO = 's0-1octb';  // la paró en seco el límite semanal el 1-oct a las 16:10: no escribió nada

const ES_TRASPASO = /traspaso[^\\/]*\.md$/i;
/** Lo que el arnés deja sin comitear en cada árbol y no es trabajo de nadie. Lista DECLARADA: lo que no esté aquí cuenta como trabajo. */
export const RUIDO_DEL_ARNES = [/^\.claude\/settings\.local\.json$/, /^\.playwright-mcp\//];
const ES_MEMORIA =/[\\/]memory[\\/][^\\/]+\.md$/i;
const ESCRIBE = new Set(['Write', 'Edit', 'NotebookEdit']);
const COMITEA = /\bgit\b[^\n|;&]*\bcommit\b/;

/**
 * @param {string|null} transcripcion
 * @returns {{cubo:'ENTREGÓ AL CERRAR'|'ENTREGÓ Y SIGUIÓ'|'NO ENTREGÓ'|'NO SUPE', motivo?:string, despues:number, llamadas:string[]}}
 */
export function entregaDe(transcripcion) {
  if (transcripcion == null) return { cubo: 'NO SUPE', motivo: 'sin transcripción', despues: 0, llamadas: [] };
  let leidas = 0, rotas = 0, traspasos = 0, despues = 0; const llamadas = [];
  for (const l of transcripcion.split('\n')) {
    if (!l.trim()) continue;
    let o; try { o = JSON.parse(l); } catch { rotas++; continue; }
    leidas++;
    const c = o && o.type === 'assistant' && o.message && o.message.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (!b || b.type !== 'tool_use' || !b.input) continue;
      const ruta = b.input.file_path || b.input.notebook_path || '';
      const orden = typeof b.input.command === 'string' ? b.input.command : '';
      if (orden) llamadas.push(orden);
      if (ESCRIBE.has(b.name) && ES_TRASPASO.test(ruta)) { traspasos++; despues = 0; }
      // Lo que se escribe en la memoria después (el índice, otra nota) es parte de entregar, no trabajo nuevo.
      else if ((ESCRIBE.has(b.name) && !ES_MEMORIA.test(ruta)) || COMITEA.test(orden)) despues++;
    }
  }
  if (rotas > 0) return { cubo: 'NO SUPE', motivo: `${rotas} línea(s) de la transcripción no se dejan leer: puede estar cortada`, despues: 0, llamadas };
  if (leidas === 0) return { cubo: 'NO SUPE', motivo: 'transcripción vacía', despues: 0, llamadas };
  if (traspasos === 0) return { cubo: 'NO ENTREGÓ', despues: 0, llamadas };
  return { cubo: despues === 0 ? 'ENTREGÓ AL CERRAR' : 'ENTREGÓ Y SIGUIÓ', despues, llamadas };
}

/**
 * El censo de ramas locales. `repo` se inyecta para poder fabricarlo en el test.
 * @param {{locales:{nombre:string,sha:string,fecha:string}[], remota:(n:string)=>string|null,
 *          esAncestro:(a:string,b:string)=>boolean|undefined, fusion:(sha:string)=>'igual'|'cambia'|'choca'|undefined,
 *          commits:(sha:string)=>number|undefined, ficheros:(sha:string)=>string[]|undefined, main:string}} repo
 */
export function censoDeRamas(repo) {
  const cuenta = { 'en main': 0, 'en origin': 0, 'solo local, sin contenido nuevo': 0 };
  const fuera = []; const ciegas = [];
  for (const r of repo.locales) {
    const enMain = repo.esAncestro(r.sha, repo.main);
    if (enMain === undefined) { ciegas.push(r.nombre); continue; }
    if (enMain) { cuenta['en main']++; continue; }
    const rem = repo.remota(r.nombre);
    const empujada = rem ? repo.esAncestro(r.sha, rem) : false;
    if (empujada === undefined) { ciegas.push(r.nombre); continue; }
    if (empujada) { cuenta['en origin']++; continue; }
    const f = repo.fusion(r.sha);
    if (f === undefined) { ciegas.push(r.nombre); continue; }
    if (f === 'igual') { cuenta['solo local, sin contenido nuevo']++; continue; }
    fuera.push({ nombre: r.nombre, fecha: r.fecha, commits: repo.commits(r.sha), ficheros: repo.ficheros(r.sha), detras: Boolean(rem), choca: f === 'choca' });
  }
  fuera.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  return { total: repo.locales.length, cuenta, fuera, ciegas };
}

/**
 * @param {{trabajos:object[], repo:object|null, arboles:{ruta:string,rama:string,sucios:string[]|undefined}[]|null, controlSi?:string, controlNo?:string}} e
 * @returns {{codigo:0|2, lineas:string[], datos?:object}}
 */
export function medir({ trabajos, repo, arboles, controlSi = CONTROL_SI, controlNo = CONTROL_NO }) {
  const out = ['SESIONES QUE SE PARARON Y NUNCA VOLVIERON · ¿entregaron, o se lo llevaron?'];
  const no = (motivo) => { out.push('', `🔴 NO VALE (salida 2): ${motivo}`, '   Esto NO quiere decir que no se haya perdido trabajo.'); return { codigo: 2, lineas: out }; };
  let fueraDeLaMedida = 0; const sesiones = []; let primero = Infinity, ultimo = -Infinity;
  for (const t of trabajos) {
    if (!puestoDe(t.nombre) || t.linea == null) { fueraDeLaMedida++; continue; }
    const { eventos } = leerLinea(t.linea);
    if (eventos.length === 0) { fueraDeLaMedida++; continue; }
    primero = Math.min(primero, eventos[0].at); ultimo = Math.max(ultimo, eventos[eventos.length - 1].at);
    const cola = tramosDe(eventos).find((x) => x.tipo === 'cola');
    sesiones.push({ nombre: t.nombre, puesto: puestoDe(t.nombre), cola, entrega: entregaDe(t.transcripcion) });
  }
  out.push('', `trabajos mirados: ${trabajos.length} · sesiones de puesto con línea de tiempo: ${sesiones.length} · fuera (no es un puesto, o sin línea de tiempo): ${fueraDeLaMedida}`);
  if (sesiones.length === 0) return no('no se pudo leer la línea de tiempo de ningún puesto');
  out.push(`ventana: ${new Date(primero).toISOString()} → ${new Date(ultimo).toISOString()}`);

  // Los controles prueban AL LECTOR con dos sesiones reales de respuesta conocida.
  const control = (nombre, quiere) => {
    const s = sesiones.find((x) => x.nombre === nombre);
    if (!s) return `la sesión de control «${nombre}» no está entre los trabajos (¿se limpió la carpeta?). Pasa otra con --control-${quiere ? 'si' : 'no'}`;
    const entrego = s.entrega.cubo.startsWith('ENTREGÓ');
    if (s.entrega.cubo === 'NO SUPE' || entrego !== quiere) return `el control «${nombre}» tenía que salir ${quiere ? 'ENTREGÓ' : 'NO ENTREGÓ'} y sale ${s.entrega.cubo}: el lector no ve`;
    return null;
  };
  const fallo = control(controlSi, true) || control(controlNo, false);
  if (fallo) return no(fallo);
  out.push(`controles: «${controlSi}» sale ENTREGÓ y «${controlNo}» sale NO ENTREGÓ, como se sabe que fue`);

  const colas = sesiones.filter((s) => s.cola);
  const cubos = { 'ENTREGÓ AL CERRAR': [], 'ENTREGÓ Y SIGUIÓ': [], 'NO ENTREGÓ': [], 'NO SUPE': [] };
  for (const s of colas) cubos[s.entrega.cubo].push(s);
  const fecha = (s) => new Date(s.cola.desde).toISOString().slice(0, 16).replace('T', ' ');
  out.push(
    '',
    `MITAD 1 · LA SESIÓN — de ${sesiones.length}, se pararon y no volvieron: ${colas.length}. Las otras ${sesiones.length - colas.length} acabaron su línea de tiempo en «working»: siguen vivas, o murieron trabajando — NO están miradas aquí`,
    '| | sesiones |', '|---|---|',
    ...Object.entries(cubos).map(([k, v]) => `| ${k} | ${v.length} |`),
  );
  const siguio = cubos['ENTREGÓ Y SIGUIÓ'];
  if (siguio.length) {
    const o = siguio.map((s) => s.entrega.despues).sort((a, b) => a - b);
    out.push(`«ENTREGÓ Y SIGUIÓ»: después de su último traspaso hicieron entre ${o[0]} y ${o[o.length - 1]} ediciones o commits (mediana ${o[Math.floor(o.length / 2)]}). Eso NO dice que se perdiera: dice que el traspaso no lo cuenta.`);
  }
  out.push('', `NO ENTREGÓ (${cubos['NO ENTREGÓ'].length}) — con nombre, cómo se paró y cuándo (UTC):`);
  for (const s of cubos['NO ENTREGÓ'].sort((a, b) => a.cola.desde - b.cola.desde)) out.push(`   · ${s.nombre} · ${s.cola.estado} · ${fecha(s)}`);
  out.push('', `NO SUPE (${cubos['NO SUPE'].length}) — no están en ninguno de los cubos de arriba:`);
  for (const s of cubos['NO SUPE']) out.push(`   · ${s.nombre} · ${s.entrega.motivo}`);

  // ───────── mitad 2: el repositorio ─────────
  out.push('', 'MITAD 2 · EL REPOSITORIO — lo que hay sin empujar, mirado en git');
  if (!repo || repo.incapaz) return { ...no(`git no se deja leer${repo && repo.incapaz ? `: ${repo.incapaz}` : ''}. La mitad 1 de arriba sí vale; la 2 no está medida`), datos: { cubos } };
  const censo = censoDeRamas(repo);
  out.push(
    `medido contra la punta congelada = ${repo.main}`,
    `ramas locales miradas: ${censo.total} · ${Object.entries(censo.cuenta).map(([k, v]) => `${v} ${k}`).join(' · ')} · no se pudieron mirar: ${censo.ciegas.length}`,
    `🔴 ramas con commits que NO están en origin y cuyo contenido cambiaría main: ${censo.fuera.length}`,
  );
  // Una rama se atribuye a una sesión SOLO si esa sesión la nombra en una orden suya. Si no, no se reparte a ojo.
  const mencion = (rama) => sesiones.filter((s) => s.entrega.llamadas.some((c) => new RegExp(`(^|[^\\w-])${rama.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\w-])`).test(c)));
  const noEntrego = new Set(cubos['NO ENTREGÓ'].map((s) => s.nombre));
  const completos = [];
  const fila = (r) => {
    const quien = mencion(r.nombre);
    for (const s of quien) if (noEntrego.has(s.nombre)) completos.push(`${s.nombre} → ${r.nombre}`);
    const fs_ = r.ficheros === undefined ? 'no medido' : `${r.ficheros.length}: ${r.ficheros.slice(0, 3).join(', ')}${r.ficheros.length > 3 ? '…' : ''}`;
    const ticket = (/^scrum-(\d+)/i.exec(r.nombre) || [])[1];
    return `| ${r.nombre} | ${ticket ? `SCRUM-${ticket}` : 'ninguno en el nombre'} | ${String(r.fecha).slice(0, 10)} | ${r.commits ?? 'no medido'} | ${fs_} | ${r.choca ? 'CHOCA: hay que leerla' : 'entra limpia y cambia main'} | ${quien.length ? quien.slice(0, 4).map((s) => s.nombre).join(', ') + (quien.length > 4 ? ` y ${quien.length - 4} más` : '') : 'sin sesión conocida'} |`;
  };
  const cabecera = ['| rama | ticket (por el nombre) | último commit | commits fuera de main | ficheros que cambia | fusionarla | sesiones que la nombran |', '|---|---|---|---|---|---|---|'];
  const detras = censo.fuera.filter((r) => r.detras); const soloLocal = censo.fuera.filter((r) => !r.detras);
  out.push('', `A · EN ORIGIN HAY UNA RAMA CON ESE NOMBRE, Y VA POR DETRÁS DE LA LOCAL (${detras.length}) — quien mire lo de origin lo verá completo y no lo está`);
  if (detras.length) out.push(...cabecera, ...detras.map(fila));
  out.push('', `B · NO ESTÁN EN ORIGIN (${soloLocal.length})`);
  if (soloLocal.length) out.push(...cabecera, ...soloLocal.map(fila));
  out.push(
    '',
    '«CHOCA» no dice que haya trabajo perdido: dice que fusionarla hoy da conflicto, y eso pasa también cuando su trabajo entró por otra rama y main siguió cambiando. Solo leyéndola se sabe.',
    `EL CASO COMPLETO — una sesión que NO ENTREGÓ y que nombra una rama que no está en origin: ${completos.length ? completos.join(' · ') : 'ninguno'}`,
  );
  if (censo.ciegas.length) out.push(`⚠️ sin mirar (NO cuentan como limpias): ${censo.ciegas.slice(0, 10).join(', ')}`);
  if (arboles == null) out.push('árboles de trabajo: NO MEDIDOS en esta pasada (--sin-arboles, o git no los listó). No cuentan como limpios.');
  else {
    const ciegos = arboles.filter((a) => a.sucios === undefined);
    const deTrabajo = (a) => a.sucios.filter((f) => !RUIDO_DEL_ARNES.some((re) => re.test(f)));
    const conTrabajo = arboles.filter((a) => a.sucios && deTrabajo(a).length > 0).sort((a, b) => deTrabajo(b).length - deTrabajo(a).length);
    const soloRuido = arboles.filter((a) => a.sucios && a.sucios.length > 0 && deTrabajo(a).length === 0);
    out.push(
      '', `árboles de trabajo mirados: ${arboles.length} · con cambios SIN COMITEAR que son trabajo: ${conTrabajo.length} · solo con ficheros del arnés (${RUIDO_DEL_ARNES.map((re) => re.source.replace(/\\|\^|\$/g, '')).join(', ')}): ${soloRuido.length} · no se pudieron mirar: ${ciegos.length}`,
    );
    for (const a of conTrabajo) { const f = deTrabajo(a); out.push(`   · ${a.ruta} [${a.rama}] · ${f.length}: ${f.slice(0, 3).join(', ')}${f.length > 3 ? '…' : ''}`); }
    for (const a of ciegos) out.push(`   · ⚠️ ${a.ruta}: no se pudo mirar (NO cuenta como limpio)`);
  }
  out.push('', 'Este script no borra, no empuja y no rescata nada.');
  return { codigo: 0, lineas: out, datos: { cubos, censo, arboles, completos } };
}

/** El repositorio de verdad. Lo que git no contesta llega como `undefined`, nunca como «no». */
export function repoDeVerdad(cwd, punta) {
  const g = (...a) => execFileSync('git', a, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
  const sale = (...a) => { try { g(...a); return 0; } catch (e) { return typeof e.status === 'number' ? e.status : undefined; } };
  // La punta se resuelve UNA vez, con `instantanea()` de SCRUM-753, y todo va contra ESE sha congelado
  // (se imprime en la salida). Si otra sesión trae algo mientras corre, la medida sigue siendo de un árbol.
  if (punta.incapaz || !punta.sha) return { incapaz: punta.incapaz || 'no se pudo resolver la punta' };
  const congelado = punta.sha;
  let arbolDeLaPunta, remotas, locales;
  try {
    arbolDeLaPunta = g('rev-parse', `${congelado}^{tree}`).trim();
    remotas = new Map(g('for-each-ref', 'refs/remotes/origin', '--format=%(refname:lstrip=3)\t%(objectname)').split('\n').filter(Boolean).map((l) => l.split('\t')));
    locales = g('for-each-ref', 'refs/heads', '--format=%(refname:short)\t%(objectname)\t%(committerdate:iso-strict)').split('\n').filter(Boolean).map((l) => { const [nombre, sha, fecha] = l.split('\t'); return { nombre, sha, fecha }; });
  } catch (e) { return { incapaz: String(e.message || e).split('\n')[0] }; }
  return {
    main: congelado, locales, remota: (n) => remotas.get(n) || null,
    esAncestro: (a, b) => { const s = sale('merge-base', '--is-ancestor', a, b); return s === 0 ? true : s === 1 ? false : undefined; },
    fusion: (sha) => {
      try { return g('merge-tree', '--write-tree', congelado, sha).split('\n')[0].trim() === arbolDeLaPunta ? 'igual' : 'cambia'; } catch (e) { return e.status === 1 ? 'choca' : undefined; }
    },
    commits: (sha) => { try { return Number(g('rev-list', '--count', `${congelado}..${sha}`).trim()); } catch { return undefined; } },
    // Lo que la rama cambió desde que se separó de la punta (tres puntos): sus ficheros, no los que se movieron después.
    ficheros: (sha) => { try { return g('diff', '--name-only', `${congelado}...${sha}`).split('\n').filter(Boolean); } catch { return undefined; } },
  };
}

export function arbolesDeVerdad(cwd) {
  let lista; try { lista = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd, encoding: 'utf8' }); } catch { return null; }
  const out = [];
  for (const bloque of lista.split('\n\n')) {
    const ruta = (/^worktree (.+)$/m.exec(bloque) || [])[1]; if (!ruta) continue;
    const rama = (/^branch refs\/heads\/(.+)$/m.exec(bloque) || [])[1] || '(sin rama)';
    // Cada línea de `status --porcelain` es «XY ruta»: se guarda la ruta. Si git no contesta, `undefined`, no `[]`.
    let sucios; try { sucios = execFileSync('git', ['-C', ruta, 'status', '--porcelain'], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] }).split('\n').filter(Boolean).map((l) => l.slice(3).replace(/^"|"$/g, '')); } catch { sucios = undefined; }
    out.push({ ruta, rama, sucios });
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n, def) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : def; };
  const carpeta = arg('--jobs', path.join(os.homedir(), '.claude', 'jobs'));
  let trabajos;
  try { trabajos = leerTrabajos(carpeta); } catch (e) { console.log(`🔴 NO VALE (salida 2): no se puede leer ${carpeta} (${e.code || e.message}).`); process.exit(2); }
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { instantanea } = await import('./_censo-alcanzabilidad.mjs');
  const r = medir({
    trabajos, repo: repoDeVerdad(raiz, instantanea({ raiz, traer: false })), arboles: process.argv.includes('--sin-arboles') ? null : arbolesDeVerdad(raiz),
    controlSi: arg('--control-si', CONTROL_SI), controlNo: arg('--control-no', CONTROL_NO),
  });
  console.log(r.lineas.join('\n'));
  process.exit(r.codigo);
}
