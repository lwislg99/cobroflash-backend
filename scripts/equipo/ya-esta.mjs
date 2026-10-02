#!/usr/bin/env node
// SCRUM-1424 · ¿ESTO YA ESTÁ HECHO? — se corre ANTES de repartir un ticket.
//
//   npm run ya-esta -- <número>          (o: node scripts/equipo/ya-esta.mjs <número>)
//
// POR QUÉ EXISTE. El 2-oct-2026 se encargaron cinco veces cosas que ya estaban hechas; la última,
// una medición que vivía en un `.tsv` de `main`. Se repartía leyendo el ticket, que describe la
// intención, y no el árbol. El detalle, en `docs/master/SCRUM-1424.md`.
//
// ES UNA CAPA, NO UN MOTOR. Lo que ya sabía contestar la casa se llama, no se copia:
//   · `censarTicket` (`tests/_censo-tickets.mjs`, SCRUM-388): los commits de `main` que nombran el
//     ticket en su asunto, y la CAPACIDAD de medir (un clon superficial no ve nada y lo dice);
//   · el criterio de `scripts/_rastro-del-ticket.mjs` (SCRUM-804) para una rama: dentro de `main` si
//     su punta es alcanzable desde él, viva si no. El motor entero NO se llama (ver `mirar`): tarda;
//   · `reMencion`, `RE_CIERRE` y `ticketDeExpediente` (`scripts/abierto-con-trabajo-en-main.mjs`,
//     SCRUM-1259): qué es una mención y qué línea DICE cierre.
// Lo único que añade: preguntar por UN ticket sin foto de Jira, leer `docs/master/` de `origin/main`
// y no del disco (el checkout compartido va muy por detrás), las evidencias, y las fechas.
//
// TRES RESPUESTAS, y la tercera no se confunde con la segunda:
//   YA ESTÁ            hay trabajo con su número en `origin/main` (salida 0)
//   NO ESTÁ            no hay nada con su número en `origin/main` (salida 0)
//   NO HE PODIDO MIRAR no se pudo traer `main`, o un motor no pudo medir (salida 2)
//
// LO QUE NO MIRA, y lo dice siempre: Jira (los comentarios del ticket), y el trabajo hecho bajo OTRO
// número sin nombrar éste. NO cierra, no transiciona, no escribe en ningún sitio: informa.
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const SALIDA_MIRADO = 0;
export const SALIDA_CIEGO = 2;
export const YA_ESTA = 'YA ESTÁ';
export const NO_ESTA = 'NO ESTÁ';
export const NO_PUDE = 'NO HE PODIDO MIRAR';

/** La última ancla de un registro: `**Medido contra:** … `<sha de 40>` · <ISO>`. `null` si no tiene. */
export function ultimaAncla(texto) {
  const todas = [...String(texto || '').matchAll(/\*\*Medido contra:\*\*[^\n]*?`([0-9a-f]{40})`[^\n]*?(\d{4}-\d{2}-\d{2}T[\d:]+Z)/g)];
  const u = todas[todas.length - 1];
  return u ? { sha: u[1], cuando: u[2] } : null;
}

/**
 * Pura. Lo que se sabe del ticket → una de las tres respuestas.
 * @param {{
 *   ciegos: string[],                       motivos por los que NO se pudo mirar (vacío = se miró todo)
 *   registros: {fichero:string, primera:string|null, ultima:string|null, ancla:object|null}[],
 *   evidencias: {carpeta:string, ficheros:number, primera:string|null}[],
 *   commits: {sha:string, fecha:string, asunto:string}[],
 *   ramasEnMain: {nombre:string, fecha:string|null}[],
 *   ramasVivas: {nombre:string, fecha:string|null, adelanto:number}[],
 *   cierresAjenos: {fichero:string, linea:number, texto:string}[],
 *   citas: {fichero:string, lineas:number}[],
 * }} h
 */
export function veredictoDe(h) {
  if (h.ciegos.length > 0) return { respuesta: NO_PUDE, salida: SALIDA_CIEGO, desde: null, porQue: h.ciegos };
  const fechas = [
    ...h.registros.map((r) => r.primera), ...h.evidencias.map((e) => e.primera),
    ...h.commits.map((c) => c.fecha), ...h.ramasEnMain.map((r) => r.fecha),
  ].filter(Boolean).map((f) => String(f).slice(0, 10)).sort();
  const propio = h.registros.length + h.evidencias.length + h.commits.length + h.ramasEnMain.length;
  if (propio > 0) return { respuesta: YA_ESTA, salida: SALIDA_MIRADO, desde: fechas[0] || null, porQue: [] };
  return { respuesta: NO_ESTA, salida: SALIDA_MIRADO, desde: null, porQue: [] };
}

/** Pura. El informe, línea a línea. La respuesta va en la PRIMERA. */
export function informe(num, h, v, { main, ms } = {}) {
  const out = [];
  const cabeza = v.respuesta === YA_ESTA ? `🟢 SCRUM-${num} · ${YA_ESTA} en origin/main${v.desde ? ` · DESDE el ${v.desde}` : ' · (sin fecha legible)'}${h.ramasVivas.length ? ` · 🟡 y ${h.ramasVivas.length} rama(s) suya(s) VIVA(S) con más trabajo fuera` : ''}`
    : v.respuesta === NO_ESTA ? `⚪ SCRUM-${num} · ${NO_ESTA} en origin/main con ese número${h.ramasVivas.length ? ` · 🟡 PERO hay ${h.ramasVivas.length} rama(s) suya(s) VIVA(S): alguien lo tiene empezado` : ''}`
      : `🔴 SCRUM-${num} · ${NO_PUDE}`;
  out.push(cabeza);
  if (v.respuesta === NO_PUDE) {
    for (const c of v.porQue) out.push(`   · ${c}`);
    out.push('   Esto NO quiere decir que no esté hecho: no se ha podido comprobar.');
    return out;
  }
  out.push(`   medido contra origin/main = ${main || '?'}${Number.isFinite(ms) ? ` · ${(ms / 1000).toFixed(1)} s` : ''}`);
  if (v.respuesta === YA_ESTA) out.push('   «Ya está» = hay trabajo suyo dentro de main. NO dice que esté TERMINADO: un ticket con partes puede tener sólo la primera. Lee el registro.');
  for (const r of h.registros) out.push(`   registro   · ${r.fichero} · en main desde ${r.primera || '?'} · último cambio ${r.ultima || '?'} · ${r.ancla ? `última ancla ${r.ancla.sha.slice(0, 8)} · ${r.ancla.cuando}` : 'SIN ancla legible'}`);
  if (h.registros.length === 0) out.push(`   registro   · no hay docs/master/SCRUM-${num}.md en main`);
  for (const e of h.evidencias) out.push(`   evidencias · ${e.carpeta}/ · ${e.ficheros} fichero(s) · en main desde ${e.primera || '?'}`);
  if (h.evidencias.length === 0) out.push('   evidencias · no hay carpeta de evidencias suya en main');
  if (h.commits.length) {
    const orden = [...h.commits].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    out.push(`   commits    · ${h.commits.length} en main lo nombran en su asunto · del ${orden[0].fecha} al ${orden[orden.length - 1].fecha}`);
    for (const c of orden.slice(-3)) out.push(`                ${c.sha} ${c.fecha} ${String(c.asunto).slice(0, 100)}`);
  } else out.push('   commits    · ninguno de main lo nombra en su asunto');
  for (const r of h.ramasEnMain) out.push(`   rama       · ${r.nombre} · DENTRO de main${r.fecha ? ` · ${r.fecha}` : ''}`);
  for (const r of h.ramasVivas) out.push(`   rama       · ${r.nombre} · 🟡 VIVA, SIN MERGEAR · ${r.adelanto} commit(s) fuera de main${r.fecha ? ` · ${r.fecha}` : ''} — alguien lo tiene empezado`);
  if (h.ramasEnMain.length + h.ramasVivas.length === 0) out.push('   rama       · ninguna rama remota con su número (las mergeadas se borran: mira los commits)');
  if (h.cierresAjenos.length) {
    out.push(`   🟠 OTROS registros lo dan por hecho o cubierto (${h.cierresAjenos.length} línea(s) con palabra de cierre) — LÉELAS:`);
    for (const c of h.cierresAjenos.slice(0, 5)) out.push(`                ${c.fichero}:${c.linea} «${c.texto}»`);
    if (h.cierresAjenos.length > 5) out.push(`                … y ${h.cierresAjenos.length - 5} más`);
  }
  // Los REGISTROS ajenos (.md de primer nivel) son lo que hay que leer; lo demás son datos de evidencias,
  // donde el número suele ser sólo el nombre de una rama dentro de una fila.
  const esRegistro = (f) => /^docs\/master\/[^/]+\.md$/.test(f);
  const regs = h.citas.filter((c) => esRegistro(c.fichero)).sort((a, b) => b.lineas - a.lineas);
  const datos = h.citas.filter((c) => !esRegistro(c.fichero));
  if (regs.length) {
    out.push(`   citado en  · ${regs.length} registro(s) AJENO(S) lo nombran — puede estar hecho o medido ahí:`);
    for (const c of regs.slice(0, 8)) out.push(`                ${c.fichero} (${c.lineas} línea(s))`);
    if (regs.length > 8) out.push(`                … y ${regs.length - 8} más`);
  } else out.push('   citado en  · ningún otro registro de docs/master lo nombra');
  if (datos.length) out.push(`   y en datos · ${datos.length} fichero(s) de evidencias ajenas (${[...new Set(datos.map((c) => c.fichero.split('/').slice(0, 4).join('/')))].slice(0, 4).join(', ')})`);
  out.push('   NO MIRADO  · Jira: los COMENTARIOS del ticket pueden contestarlo ya; este comando no los lee. Ábrelo.');
  if (v.respuesta === NO_ESTA) out.push('   OJO        · «no está con ese número» NO es «sin hacer»: puede estar hecho bajo OTRO ticket que no lo nombra. Busca por CONTENIDO antes de repartir.');
  return out;
}

// ───────────────────────────── recogida (lo único que toca git) ─────────────────────────────

/** `undefined` = git falló · cadena (quizá vacía) = respondió. `git grep` sin coincidencias sale 1: eso es «nada», no un fallo. */
function gitDe(raiz) {
  return (args, { vacioSi1 = false } = {}) => {
    try { return execFileSync('git', ['-C', raiz, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { return vacioSi1 && e && e.status === 1 ? '' : undefined; }
  };
}

export async function mirar(num, { raiz, ref = 'origin/main', traer = true } = {}) {
  const git = gitDe(raiz);
  const ciegos = [];
  const h = { ciegos, registros: [], evidencias: [], commits: [], ramasEnMain: [], ramasVivas: [], cierresAjenos: [], citas: [] };
  if (traer && git(['fetch', '--quiet', '--prune', 'origin']) === undefined) ciegos.push('no se pudo traer `origin` (git fetch falló): lo que hay en disco puede ser viejo');
  const main = git(['rev-parse', '--verify', `${ref}^{commit}`]);
  if (main === undefined) { ciegos.push(`\`${ref}\` no se resuelve en ${raiz}`); return { h, main: null }; }

  const { censarTicket } = await import('../../tests/_censo-tickets.mjs');
  const { reMencion, RE_CIERRE, ticketDeExpediente } = await import('../abierto-con-trabajo-en-main.mjs');

  // 1 · commits. El motor mide su capacidad y lo dice; lo que NO pudo medir es un ciego, no un cero.
  let censo;
  try { censo = censarTicket(num, { raiz, ref }); } catch (e) { ciegos.push(`el censo de commits reventó: ${String(e.message).split('\n')[0]}`); }
  if (censo) {
    if (censo.veredicto === 'NO_MEDIBLE') ciegos.push(`el censo no puede atribuirle nada: ${censo.porque || 'sin motivo declarado'}`);
    for (const nm of censo.noMedibles || []) if (nm.fuente !== 'docs/master') ciegos.push(`el censo no pudo medir «${nm.fuente}»: ${nm.motivo}`);
    h.commits = censo.commits || [];
  }

  // 2 · ramas. Los NOMBRES son los del motor (`censo.ramas`: convención `scrum-<n>[letra]-…`, SCRUM-738).
  // La clase de cada una se pregunta aquí, a git, con el mismo criterio que SCRUM-804 —¿su punta es
  // alcanzable desde `main`?— y NO llamando a `rastroDeLosTickets`: ése clasifica TODAS las ramas del
  // remoto y tarda 6,7 s medidos el 2-oct-2026, y un comando de antes de repartir que tarda no se corre.
  for (const r of (censo && censo.ramas) || []) {
    const nombre = r.replace(/^origin\//, '');
    let dentro;
    try { execFileSync('git', ['-C', raiz, 'merge-base', '--is-ancestor', r, ref], { stdio: 'ignore', timeout: 30000 }); dentro = true; }
    catch (e) { dentro = e && e.status === 1 ? false : undefined; }
    const fecha = (git(['log', '-1', '--format=%cs', r]) || '').trim() || null;
    if (dentro === undefined) { ciegos.push(`la rama ${nombre} no se pudo clasificar (ni dentro de main ni viva)`); continue; }
    if (dentro) { h.ramasEnMain.push({ nombre, fecha }); continue; }
    const adelanto = Number((git(['rev-list', '--count', `${ref}..${r}`]) || '').trim());
    if (!Number.isFinite(adelanto)) { ciegos.push(`no se pudo contar cuánto tiene ${nombre} fuera de main`); continue; }
    h.ramasVivas.push({ nombre, fecha, adelanto });
  }

  // 3 · el registro y las evidencias, de `origin/main` y no del disco.
  const lista = git(['ls-tree', '-r', '--name-only', ref, '--', 'docs/master']);
  if (lista === undefined) { ciegos.push(`no se pudo listar docs/master de ${ref}`); return { h, main: main.trim() }; }
  const ficheros = lista.split('\n').filter(Boolean);
  if (ficheros.length === 0) ciegos.push(`docs/master de ${ref} está vacío: no es creíble`);
  const fechasDe = (ruta) => {
    const f = git(['log', ref, '--format=%cs', '--', ruta]);
    if (f === undefined) return undefined;
    const l = f.split('\n').filter(Boolean);
    return { primera: l[l.length - 1] || null, ultima: l[0] || null };
  };
  for (const f of ficheros.filter((x) => /^docs\/master\/[^/]+\.md$/.test(x) && ticketDeExpediente(x) === Number(num))) {
    const texto = git(['show', `${ref}:${f}`]); const fe = fechasDe(f);
    if (texto === undefined || fe === undefined) { ciegos.push(`no se pudo leer ${f} de ${ref}`); continue; }
    h.registros.push({ fichero: f, ...fe, ancla: ultimaAncla(texto) });
  }
  const reCarpeta = new RegExp(`^docs/master/evidencias/scrum-?${num}[a-z]?/`, 'i');
  const carpetas = new Map();
  for (const f of ficheros) if (reCarpeta.test(f)) { const c = f.split('/').slice(0, 4).join('/'); carpetas.set(c, (carpetas.get(c) || 0) + 1); }
  for (const [carpeta, n] of carpetas) {
    const fe = fechasDe(carpeta);
    if (fe === undefined) { ciegos.push(`no se pudo fechar ${carpeta}`); continue; }
    h.evidencias.push({ carpeta, ficheros: n, primera: fe.primera });
  }

  // 4 · quién más lo nombra. UNA llamada: `git grep` sobre docs/master entero, evidencias incluidas.
  const crudo = git(['grep', '-n', '-I', '-i', '-F', `SCRUM-${num}`, ref, '--', 'docs/master'], { vacioSi1: true });
  if (crudo === undefined) ciegos.push(`no se pudo buscar SCRUM-${num} en docs/master de ${ref}`);
  else {
    const re = reMencion(num); const porFichero = new Map();
    const propios = new Set(h.registros.map((r) => r.fichero));
    for (const l of crudo.split('\n')) {
      const m = l.match(/^[^:]+:([^:]+):(\d+):(.*)$/);
      if (!m || !re.test(m[3])) continue;
      const [, fichero, linea, texto] = m;
      if (propios.has(fichero) || reCarpeta.test(fichero)) continue;
      porFichero.set(fichero, (porFichero.get(fichero) || 0) + 1);
      if (RE_CIERRE.test(texto)) h.cierresAjenos.push({ fichero, linea: Number(linea), texto: texto.trim().slice(0, 140) });
    }
    h.citas = [...porFichero].map(([fichero, lineas]) => ({ fichero, lineas }));
  }
  return { h, main: main.trim() };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const valor = (n) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : null; };
  const ref = valor('--ref') || 'origin/main';
  const raizArg = valor('--raiz');
  const sinTraer = args.includes('--sin-traer');
  const num = (args.find((a) => !a.startsWith('--')) || '').replace(/^scrum-/i, '');
  if (!/^\d+$/.test(num)) {
    console.log(`🔴 ${NO_PUDE}: falta el número del ticket.\n   uso: npm run ya-esta -- <número> [--ref origin/main] [--sin-traer]`);
    process.exit(SALIDA_CIEGO);
  }
  const raiz = raizArg ? path.resolve(raizArg) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const t0 = Date.now();
  let res;
  try { res = await mirar(num, { raiz, ref, traer: !sinTraer }); }
  catch (e) { res = { h: { ciegos: [`el comando reventó: ${String(e && e.message).split('\n')[0]}`], registros: [], evidencias: [], commits: [], ramasEnMain: [], ramasVivas: [], cierresAjenos: [], citas: [] }, main: null }; }
  const v = veredictoDe(res.h);
  console.log(informe(num, res.h, v, { main: res.main, ms: Date.now() - t0 }).join('\n'));
  process.exit(v.salida);
}
