#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1538/c-clasificar.mjs — SCRUM-1538 · SÓLO LECTURA. No hace red.
//
// EL CENSO: cada ejecución de job de la población de `a-listar.mjs`, clasificada por lo que dice
// SU LOG (bajado por `b-bajar.mjs`) y no por la conclusión que le pone GitHub.
//
//   node c-clasificar.mjs <carpeta con a-poblacion.json y logs/> [--sin-siembra]
//
// LOS ESTADOS (ficha del 13-oct, cicatriz ④; SCRUM-1538 punto ②):
//   VERDE          el log AFIRMA su verde (resumen propio, con algo juzgado y nada caído).
//   VERDE*         sólo la conclusión de GitHub: el log de ese workflow no se ha bajado.
//   ROJO           el log nombra qué cayó.
//   CIEGO          no se pudo mirar, y se dice por qué.
//   COLGADA        dejó de escribir y la mató su techo: ni verde ni rojo.
//   CORRIENDO      `conclusion` vacío.
//   SIN CLASIFICAR no encaja en nada de lo anterior. No se reparte.
// «failure» de GitHub NO es un estado de aquí: es una de las cosas que se clasifican.
//
// LA LISTA DE JOBS no es mía: es `JOBS_DE_MAIN`, la del vigía de SCRUM-1324, importada. Lo que
// aparezca en la población y no esté ahí se cuenta aparte, con su nombre.
//
// LA PATA QUE DECIDE UN GRUPO DE CAUSA no es «cuántas veces se repite» (medido dos veces el 13-oct:
// 2 de 2 y 42 de 42 no separan nada). Es: EL MISMO ARTEFACTO, ¿SALE ENTERO EN OTRA EJECUCIÓN?
//   · meta-guard: el blob del guard + el blob del instrumento → ¿juzgado entero en otra ejecución?
//   · tanda:      el blob del fichero de test + el árbol `src/` → ¿ese mismo test pasa en otra?
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const carpeta = args.find((a) => !a.startsWith('--'));
const SIN_SIEMBRA = args.includes('--sin-siembra');
if (!carpeta) { console.error('uso: node c-clasificar.mjs <carpeta> [--sin-siembra]'); process.exit(2); }
const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const { JOBS_DE_MAIN } = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'vigia-silencio-de-main.mjs')).href);
const ESC = /\x1b\[[0-9;]*[A-Za-z]/g;
const BOM = String.fromCharCode(0xfeff);
/** Las líneas de un log de Actions: `h` la hora de GitHub, `t` el texto sin hora ni color. */
const lineas = (crudo) => crudo.split(/\r?\n/).map((l) => { const s = l.startsWith(BOM) ? l.slice(1) : l; return { h: s.slice(0, 28), t: s.slice(29).replace(ESC, '') }; });
const num = (re, T) => { for (const t of T) { const m = re.exec(t); if (m) return Number(m[1]); } return null; };

// ═══ LOS LECTORES. Puros: reciben el texto de las líneas y devuelven { estado, motivo, … } ═══════

/** La tanda de `build + tests`. La cruz se cuenta ANCLADA al inicio del caso y ANTES del resumen. */
export function leerTanda(T) {
  const colgada = T.filter((t) => t.startsWith('🔴 TANDA SIN VEREDICTO')).length;
  const iRes = []; T.forEach((t, i) => { if (/^ℹ tests \d+$/.test(t)) iRes.push(i); });
  if (!iRes.length) return colgada ? { estado: 'COLGADA', motivo: 'TANDA SIN VEREDICTO, y sin resumen' } : { estado: 'SIN CLASIFICAR', motivo: 'el log no trae el resumen de la tanda' };
  const bloques = iRes.map((i) => { const o = { i }; for (const k of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) o[k] = num(new RegExp(`^ℹ ${k} (\\d+)$`), T.slice(i, i + 8)); return o; });
  const b = [...bloques].sort((x, y) => y.tests - x.tests)[0]; // la tanda es el bloque mayor; el otro es la carrera de tramos
  const desde = Math.max(0, ...iRes.filter((i) => i < b.i));
  const zona = T.slice(desde, b.i);
  // Un CASO es marca + nombre + «(N ms)». Sin el final, «✔ Generated Prisma Client…» y los pasos que el
  // bot imprime («✔ 1 saludo → menú») cuentan como tests: medido, 17 de más en cada log. Los subtests van sangrados.
  const FIN = /^.+ \([\d.]+ms\)( # .*)?$/;
  const caso = (marca) => ({ test: (t) => { const s = t.trimStart(); return s.startsWith(marca + ' ') && FIN.test(s); } });
  const c = { pass: zona.filter((t) => caso('✔').test(t)).length, fail: zona.filter((t) => caso('✖').test(t)).length, skipped: zona.filter((t) => caso('﹣').test(t)).length };
  const suma = c.pass === b.pass && c.fail === b.fail && c.skipped === b.skipped && b.pass + b.fail + b.skipped + (b.cancelled ?? 0) + (b.todo ?? 0) === b.tests;
  const iF = T.findIndex((t, i) => i > b.i && t === '✖ failing tests:');
  const caidos = [];
  if (iF >= 0) for (let i = iF + 1; i < T.length && !T[i].startsWith('##['); i++) {
    const m = /^✖ (.+) \([\d.]+ms\)$/.exec(T[i]);
    if (m) caidos.push({ nombre: m[1], fichero: /^test at (tests\/\S+?):\d+:\d+$/.exec(T[i - 1] ?? '')?.[1] ?? null, detalle: T.slice(i + 1, i + 4).map((x) => x.trim()).filter(Boolean).join(' ¦ ').slice(0, 260) });
  }
  const s = T.map((t) => /^\[señal de nombres v1\] medible=(\w+) ausentes=(\d+) ficheros_con_ausentes=(\d+)/.exec(t)).find(Boolean);
  const base = { declarado: b, contado: c, suma, caidos, ausentes: s ? Number(s[2]) : null, colgada };
  if (colgada) return { ...base, estado: 'COLGADA', motivo: 'TANDA SIN VEREDICTO' };
  if (b.fail > 0) return caidos.length === b.fail ? { ...base, estado: 'ROJO', motivo: caidos.map((x) => x.nombre).join(' ¦ ') } : { ...base, estado: 'SIN CLASIFICAR', motivo: `el resumen dice fail ${b.fail} y el log nombra ${caidos.length}` };
  if (b.fail === 0 && b.pass > 0 && suma) return { ...base, estado: 'VERDE', motivo: `${b.pass} pasan + 0 caen + ${b.skipped} saltan = ${b.tests}` };
  return { ...base, estado: 'SIN CLASIFICAR', motivo: `las marcas ancladas (${c.pass}+${c.fail}+${c.skipped}) no dan el resumen (${b.pass}+${b.fail}+${b.skipped} de ${b.tests})` };
}

/** El meta-guard, por SU resumen. VERDE pide `vivas > 0`: cuatro ceros no son un verde (c.19304). */
export function leerMeta(T) {
  const res = T.filter((t) => /^vivas \d+ · mudas \d+/.test(t));
  const m = res.length === 1 ? /^vivas (\d+) · mudas (\d+) · ciegas (\d+) · ficheros muertos (\d+)/.exec(res[0]) : null;
  const porGuard = {};
  let vivasContadas = 0;
  for (const t of T) { const x = /^ {2}(✔|\?|☠|✖) (\S+)/.exec(t); if (x) { porGuard[x[2]] = (porGuard[x[2]] ?? '') + x[1]; if (x[1] === '✔') vivasContadas++; } }
  if (!m) return { estado: 'SIN CLASIFICAR', motivo: `el log trae ${res.length} líneas de resumen del meta-guard`, porGuard };
  const [vivas, mudas, ciegas, muertos] = m.slice(1).map(Number);
  const noVivos = Object.entries(porGuard).filter(([, s]) => /[^✔]/.test(s)).map(([g]) => g);
  const base = { vivas, mudas, ciegas, muertos, porGuard, noVivos, cuadra: vivas === vivasContadas };
  if (mudas > 0) return { ...base, estado: 'ROJO', motivo: `mudas ${mudas}: ${noVivos.join(' ¦ ')}` };
  if (ciegas + muertos > 0) return { ...base, estado: 'CIEGO', motivo: `el propio meta-guard no pudo juzgar ${ciegas + muertos} (0 mudas): ${noVivos.join(' ¦ ')}` };
  if (vivas > 0) return { ...base, estado: 'VERDE', motivo: `vivas ${vivas} · 0 mudas · 0 ciegas` };
  return { ...base, estado: 'SIN CLASIFICAR', motivo: 'resumen con vivas 0: no juzgó nada' };
}

/** El trinquete de zona: dos pasadas enteras. `silencio` = segundos entre su última línea y el corte. */
export function leerTrinquete(L) {
  const T = L.map((l) => l.t);
  const zonas = T.map((t) => /midiendo en (\S+)\s+… (\d+) pruebas · (\d+) s/.exec(t)).filter(Boolean).map((m) => ({ zona: m[1], pruebas: Number(m[2]), s: Number(m[3]) }));
  const iCorte = T.findIndex((t) => t === '##[error]The operation was canceled.');
  if (T.some((t) => t.startsWith('✔ TRINQUETE EN VERDE')) && zonas.length === 2) return { estado: 'VERDE', motivo: `dos zonas medidas (${zonas.map((z) => z.s + ' s').join(' y ')})`, zonas };
  if (iCorte > 0) {
    const silencio = Math.round((Date.parse(L[iCorte].h) - Date.parse(L[iCorte - 1].h)) / 1000);
    return { estado: 'COLGADA?', motivo: `cortado por su techo con ${zonas.length} de 2 zonas medidas; ${silencio} s callado antes del corte`, zonas, silencio };
  }
  return { estado: 'SIN CLASIFICAR', motivo: 'ni «TRINQUETE EN VERDE» con dos zonas ni corte por techo', zonas };
}

export function leerNavegador(T) {
  const m = T.map((t) => /^✅ los (\d+) guards de navegador están verdes \((\d+) verdes · (\d+) CIEGOS · (\d+) rojos\)/.exec(t)).find(Boolean);
  if (m && Number(m[2]) > 0 && Number(m[3]) === 0 && Number(m[4]) === 0) return { estado: 'VERDE', motivo: `${m[2]} verdes · 0 ciegos · 0 rojos` };
  return { estado: 'SIN CLASIFICAR', motivo: 'el log no trae la línea «los N guards de navegador están verdes» con 0 ciegos y 0 rojos' };
}

/** El vigía del despliegue dice su palabra en la última línea: al-dia, atrasado, congelado… */
export function leerVigia(T, conclusion) {
  const m = T.map((t) => /^vigía · \S+ · (\S+) · prod=(\w+) · main=(\w+) · hueco=([\d.]+)h · commits=(\d+)/.exec(t)).find(Boolean);
  if (!m) return { estado: 'SIN CLASIFICAR', motivo: 'el log no trae la línea «vigía · … · prod= · main=»' };
  const dicho = `${m[1]} · prod ${m[2]} · main ${m[3]} · hueco ${m[4]} h · ${m[5]} commits`;
  if (m[1] === 'al-dia' && conclusion === 'success') return { estado: 'VERDE', motivo: dicho, palabra: m[1] };
  if (conclusion === 'success') return { estado: 'VERDE', motivo: `🟡 verde POR DISEÑO con producción por detrás: ${dicho}`, palabra: m[1], hueco: Number(m[4]), commits: Number(m[5]) };
  return { estado: 'ROJO', motivo: dicho, palabra: m[1], hueco: Number(m[4]), commits: Number(m[5]) };
}

export function leerConstancia(T, conclusion) {
  const ok = T.map((t) => /^\[constancia del ALTER\] producción responde que no le falta ninguna de las (\d+) columnas preguntadas/.exec(t)).find(Boolean);
  if (ok && Number(ok[1]) > 0 && conclusion === 'success') return { estado: 'VERDE', motivo: `0 columnas faltan de ${ok[1]} preguntadas` };
  const no = T.find((t) => /^\[constancia del ALTER\] ⚠️ NO PUDE PREGUNTAR/.test(t));
  if (no) return { estado: 'CIEGO', motivo: no.replace('[constancia del ALTER] ⚠️ ', '') };
  return conclusion === 'failure' ? { estado: 'ROJO', motivo: 'failure sin «NO PUDE PREGUNTAR»: leer el log' } : { estado: 'SIN CLASIFICAR', motivo: 'no trae ni su verde ni su «no pude»' };
}

// ═══ CONTROL SEMBRADO de los lectores, ANTES de leer ningún log de verdad ══════════════════════
// Cada caso lo FABRICA este guion: no depende de ningún defecto del árbol ni de ningún run real,
// así que no se jubila el día que alguien arregle algo. `--sin-siembra` los vacía: el guion tiene
// que decir CIEGO y salir 3, nunca seguir.
{
  const S = (...x) => (SIN_SIEMBRA ? [] : x);
  const H = (seg, t) => ({ h: new Date(Date.UTC(2026, 0, 1, 0, 0, seg)).toISOString(), t });
  const tandaVerde = S('✔ Generated Prisma Client (v6) in 257ms', '✔ 1 saludo → menú', '✔ uno (1ms)', '✔ pasa aunque su nombre lleve ✖ y diga TANDA SIN VEREDICTO (2ms)', '﹣ tres (0ms) # sin QA_DB_TEST=1', 'ℹ tests 3', 'ℹ suites 0', 'ℹ pass 2', 'ℹ fail 0', 'ℹ cancelled 0', 'ℹ skipped 1', 'ℹ todo 0');
  const tandaRoja = S('✔ uno (1ms)', '✖ dos (2ms)', 'ℹ tests 2', 'ℹ suites 0', 'ℹ pass 1', 'ℹ fail 1', 'ℹ cancelled 0', 'ℹ skipped 0', 'ℹ todo 0', '', '✖ failing tests:', '', 'test at tests/cobaya.test.mjs:7:1', '✖ dos (2ms)', "  'a' !== 'b'", '##[error]Process completed with exit code 1.');
  const tandaQueNoSuma = S('✔ uno (1ms)', 'ℹ tests 3', 'ℹ suites 0', 'ℹ pass 3', 'ℹ fail 0', 'ℹ cancelled 0', 'ℹ skipped 0', 'ℹ todo 0');
  const tandaColgada = S('✔ uno (1ms)', '🔴 TANDA SIN VEREDICTO (SCRUM-858): 600 s sin escribir nada');
  const G = 'cobaya.test.mjs';
  const metaVerde = S(`  ✔ ${G} · uno`, `  ✔ ${G} · dos`, 'vivas 2 · mudas 0 · ciegas 0 · ficheros muertos 0');
  const metaCiego = S(`  ✔ ${G} · uno`, `  ? ${G} · CIEGO`, 'vivas 1 · mudas 0 · ciegas 1 · ficheros muertos 0');
  const metaRojo = S(`  ✖ ${G} · MUDO`, 'vivas 0 · mudas 1 · ciegas 0 · ficheros muertos 0');
  const metaCeros = S('vivas 0 · mudas 0 · ciegas 0 · ficheros muertos 0');
  const trinVerde = (SIN_SIEMBRA ? [] : [H(0, '   midiendo en A/B     … 10 pruebas · 5 s · el hijo vio A/B'), H(5, '   midiendo en C/D     … 10 pruebas · 5 s · el hijo vio C/D'), H(6, '✔ TRINQUETE EN VERDE · la familia no ha crecido')]);
  const trinColgado = (SIN_SIEMBRA ? [] : [H(0, '   midiendo en A/B     … 10 pruebas · 5 s · el hijo vio A/B'), H(2400, '##[error]The operation was canceled.')]);
  const casos = [
    ['tanda verde, con la cruz y «TANDA SIN VEREDICTO» dentro de un NOMBRE que pasa', leerTanda(tandaVerde).estado, 'VERDE'],
    ['tanda roja', leerTanda(tandaRoja).estado, 'ROJO'],
    ['tanda roja: nombra 1 caído, con su fichero', `${leerTanda(tandaRoja).caidos?.length}·${leerTanda(tandaRoja).caidos?.[0]?.fichero}`, '1·tests/cobaya.test.mjs'],
    ['tanda cuyo resumen dice 3 y trae 1 marca', leerTanda(tandaQueNoSuma).estado, 'SIN CLASIFICAR'],
    ['tanda colgada', leerTanda(tandaColgada).estado, 'COLGADA'],
    ['meta-guard verde', leerMeta(metaVerde).estado, 'VERDE'],
    ['meta-guard ciego', leerMeta(metaCiego).estado, 'CIEGO'],
    ['meta-guard ciego: nombra al guard', leerMeta(metaCiego).noVivos?.join(), G],
    ['meta-guard rojo (una muda)', leerMeta(metaRojo).estado, 'ROJO'],
    ['meta-guard con cuatro ceros', leerMeta(metaCeros).estado, 'SIN CLASIFICAR'],
    ['trinquete verde', leerTrinquete(trinVerde).estado, 'VERDE'],
    ['trinquete cortado tras 2.400 s callado', `${leerTrinquete(trinColgado).estado}·${leerTrinquete(trinColgado).silencio}`, 'COLGADA?·2400'],
    ['navegador verde', leerNavegador(S('✅ los 37 guards de navegador están verdes (37 verdes · 0 CIEGOS · 0 rojos).')).estado, 'VERDE'],
    ['navegador con un ciego', leerNavegador(S('✅ los 37 guards de navegador están verdes (36 verdes · 1 CIEGOS · 0 rojos).')).estado, 'SIN CLASIFICAR'],
    ['vigía al día', leerVigia(S('vigía · 2026-01-01T00:00:00Z · al-dia · prod=aaaaaaaa · main=aaaaaaaa · hueco=0.0h · commits=0'), 'success').estado, 'VERDE'],
    ['vigía congelado', leerVigia(S('vigía · 2026-01-01T00:00:00Z · congelado · prod=aaaaaaaa · main=bbbbbbbb · hueco=10.1h · commits=4'), 'failure').estado, 'ROJO'],
    ['constancia que no pudo preguntar', leerConstancia(S('[constancia del ALTER] ⚠️ NO PUDE PREGUNTAR: producción responde 503.'), 'failure').estado, 'CIEGO'],
    ['constancia verde', leerConstancia(S('[constancia del ALTER] producción responde que no le falta ninguna de las 12 columnas preguntadas'), 'success').estado, 'VERDE'],
  ];
  const malos = casos.filter(([, sale, debe]) => sale !== debe);
  console.log(`CONTROL SEMBRADO de los lectores · ${casos.length} casos fabricados por este guion${SIN_SIEMBRA ? ' · ⚠️ --sin-siembra: los casos van VACÍOS' : ''}: ${casos.length - malos.length} salen en su estado`);
  if (malos.length) {
    for (const [q, sale, debe] of malos) console.log(`  🔴 ${q}: sale «${sale}», debía «${debe}»`);
    console.log('CIEGO — los lectores no reconocen sus casos sembrados: este censo no puede afirmar nada.');
    console.log('EXIT=3'); process.exit(3);
  }
}

// ═══ LA POBLACIÓN ═══════════════════════════════════════════════════════════════════════════
const p = JSON.parse(fs.readFileSync(path.join(carpeta, 'a-poblacion.json'), 'utf8'));
const git = (...a) => { try { return execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };
const cacheGit = new Map();
const objeto = (sha, ruta) => { const k = `${sha}:${ruta}`; if (!cacheGit.has(k)) cacheGit.set(k, git('rev-parse', '--verify', '--quiet', k)); return cacheGit.get(k); };
const leerLog = (id) => { const f = path.join(carpeta, 'logs', `${id}.log`); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; };
const pos = new Map(p.commits.map((c, i) => [c.sha, i])); // 0 = la punta de main
const declarado = new Set(JOBS_DE_MAIN.map((j) => `${j.workflow} / ${j.job}`));
const ciPorFecha = p.runs.filter((r) => r.wf === 'CI').sort((a, b) => a.creado.localeCompare(b.creado));

const E = []; // una fila por ejecución de job
for (const r of p.runs) for (const j of p.jobs[r.id]) {
  const fila = { wf: r.wf, job: j.nombre, clave: `${r.wf} / ${j.nombre}`, evento: r.evento, run: r.id, id: j.id, sha: r.sha, creado: r.creado, github: `${j.status}/${j.conclusion ?? ''}`, seg: j.empezo && j.acabo ? Math.round((Date.parse(j.acabo) - Date.parse(j.empezo)) / 1000) : null, bytes: null };
  let v;
  if (j.status !== 'completed') v = { estado: 'CORRIENDO', motivo: `status ${j.status}, sin conclusión` };
  else if (j.conclusion === 'skipped') v = { estado: 'CIEGO', motivo: 'el job se saltó (su condición `if` no se cumplió)' };
  else {
    const crudo = leerLog(j.id);
    if (crudo !== null) fila.bytes = Buffer.byteLength(crudo);
    if (crudo === null && j.conclusion === 'success') v = { estado: 'VERDE*', motivo: 'sólo la conclusión de GitHub: log no bajado' };
    else if (crudo === null || fila.bytes < 1000) v = { estado: 'SIN CLASIFICAR', motivo: `sin log que leer (${fila.bytes ?? 'no bajado'})` };
    else {
      const L = lineas(crudo); const T = L.map((l) => l.t);
      if (/^build \+ tests/.test(j.nombre)) v = leerTanda(T);
      else if (/^meta-guard/.test(j.nombre)) v = leerMeta(T);
      else if (/^trinquete/.test(j.nombre)) v = leerTrinquete(L);
      else if (/^guards de navegador/.test(j.nombre)) v = leerNavegador(T);
      else if (/^vigía del despliegue/.test(j.nombre)) v = leerVigia(T, j.conclusion);
      else if (/^constancia del ALTER/.test(j.nombre)) v = leerConstancia(T, j.conclusion);
      else v = { estado: 'SIN CLASIFICAR', motivo: `job sin lector: «${j.nombre}» en ${j.conclusion}; paso caído: ${j.pasos.filter((s) => s.conclusion === 'failure').map((s) => s.nombre).join(' ¦ ') || '(ninguno)'}` };
      v.T = T;
    }
  }
  E.push({ ...fila, ...v });
}

// El trinquete cortado: COLGADA sólo si calló MÁS de lo que tarda una zona en CUALQUIER verde de la
// población (el umbral sale del censo, no de una cifra elegida).
const zonasVerdes = E.filter((e) => /^trinquete/.test(e.job) && e.estado === 'VERDE').flatMap((e) => e.zonas.map((z) => z.s));
const maxZona = zonasVerdes.length ? Math.max(...zonasVerdes) : null;
for (const e of E.filter((x) => x.estado === 'COLGADA?')) {
  if (maxZona !== null && e.silencio > maxZona) { e.estado = 'COLGADA'; e.motivo += ` (la zona más lenta de los ${zonasVerdes.length / 2} verdes tardó ${maxZona} s)`; } else { e.estado = 'SIN CLASIFICAR'; e.motivo += ' (no hay verdes con que comparar, o no calló más que una zona)'; }
}

// ═══ ① EL CENSO ═════════════════════════════════════════════════════════════════════════════
const cuenta = (xs, f) => { const o = {}; for (const x of xs) { const k = f(x); o[k] = (o[k] ?? 0) + 1; } return o; };
const pinta = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ');
console.log(`\nPOBLACIÓN · ventana ${p.desde} → ${p.hasta} · origin/main ${p.punta}`);
console.log(`  commits de main (primer padre): ${p.commits.length} · runs con rama main: ${p.runs.length} · ejecuciones de job (todos los intentos): ${E.length}`);
console.log(`  runs por workflow y evento: ${pinta(cuenta(p.runs, (r) => `${r.wf}[${r.evento}]`))}`);
const claves = [...new Set(E.map((e) => e.clave))];
const fuera = claves.filter((c) => !declarado.has(c));
const sinVer = [...declarado].filter((c) => !claves.includes(c));
console.log(`  JOBS distintos en la población: ${claves.length} · de ellos en la lista del vigía (JOBS_DE_MAIN, ${declarado.size}): ${claves.length - fuera.length} · declarados que NO aparecen: ${sinVer.length}${sinVer.length ? ' → ' + sinVer.join(' ¦ ') : ''}`);
console.log(`  fuera de la lista (workflows REACTIVOS, que el vigía excluye a propósito: no hablan del estado de main): ${fuera.map((c) => `${c} ×${E.filter((e) => e.clave === c).length}`).join(' ¦ ') || '(ninguno)'}`);
// Control de cero derivado y su positivo, sobre la población de verdad.
const elMayor = [...claves].sort((a, b) => E.filter((e) => e.clave === b).length - E.filter((e) => e.clave === a).length)[0];
console.log(`  CONTROL DE CERO (derivado): «${elMayor}» → ${E.filter((e) => e.clave === elMayor).length} ejecuciones; el mismo nombre al revés → ${E.filter((e) => e.clave === [...elMayor].reverse().join('')).length}`);

const ESTADOS = ['VERDE', 'VERDE*', 'ROJO', 'CIEGO', 'COLGADA', 'CORRIENDO', 'SIN CLASIFICAR'];
console.log('\n① y ② · CADA JOB DE MAIN, por EJECUCIONES (una fila por job; «github» es lo que GitHub le pone, no un estado de aquí)');
for (const d of JOBS_DE_MAIN) {
  const c = `${d.workflow} / ${d.job}`;
  const mias = E.filter((e) => e.clave === c);
  const est = cuenta(mias, (e) => e.estado);
  const suma = ESTADOS.reduce((s, k) => s + (est[k] ?? 0), 0);
  console.log(`  ${c}\n     ejecuciones ${mias.length} · ${ESTADOS.filter((k) => est[k]).map((k) => `${k} ${est[k]}`).join(' · ')} · suma ${suma}${suma === mias.length ? '' : ' ← NO CUADRA'} · github: ${pinta(cuenta(mias, (e) => e.github))}`);
}

// Por COMMIT (sólo los jobs de `push`, que son los que tienen un run por commit).
console.log('\n① · EN CUÁNTOS COMMITS DE MAIN CORRIÓ CADA JOB DE PUSH, y hace cuánto fue su último veredicto');
const porWf = (wf) => { const m = new Map(); for (const r of p.runs.filter((x) => x.wf === wf && x.evento === 'push')) (m.get(r.sha) ?? m.set(r.sha, []).get(r.sha)).push(r); return m; };
const motivosSinJob = {};
const matriz = [];
for (const d of JOBS_DE_MAIN.filter((x) => x.unidad === 'runs')) {
  const runsDe = porWf(d.workflow);
  const c = `${d.workflow} / ${d.job}`;
  const fila = { job: c, conVeredicto: 0, estados: {}, ultimoVerde: null, ultimoVeredicto: null };
  p.commits.forEach((cm, i) => {
    const rs = runsDe.get(cm.sha) ?? [];
    const mias = E.filter((e) => e.clave === c && e.sha === cm.sha && e.evento === 'push');
    let estado; let motivo = '';
    if (mias.length) { const u = mias.at(-1); estado = u.estado; motivo = u.motivo; } else if (!rs.length) { estado = 'CIEGO'; motivo = 'el commit no tiene run de este workflow'; } else {
      const r = rs.at(-1);
      if (r.status !== 'completed') { estado = 'CIEGO'; motivo = `el run está en cola (${r.status}): todavía no ha arrancado ningún job`; } else if (r.conclusion === 'cancelled' && !p.jobs[r.id].length) {
        const sig = ciPorFecha[ciPorFecha.findIndex((x) => x.id === r.id) + 1];
        const tras = sig && r.wf === 'CI' ? (Date.parse(r.actualizado) - Date.parse(sig.creado)) / 1000 : null;
        estado = 'CIEGO';
        motivo = tras !== null && tras >= 0 && tras <= 60 ? 'run cancelado sin arrancar ningún job, de 0 a 60 s después de crearse el run del commit siguiente (GitHub sustituye al run que espera en la cola del grupo)' : 'run cancelado sin arrancar ningún job; motivo no medido';
      } else if (!p.jobs[r.id].length) { estado = 'SIN CLASIFICAR'; motivo = `run en ${r.conclusion} sin ningún job: no hay log que leer (run ${r.id})`; } else { estado = 'CIEGO'; motivo = `el run corrió pero este job no está en él (run ${r.conclusion})`; }
    }
    fila.estados[estado] = (fila.estados[estado] ?? 0) + 1;
    if (estado !== 'VERDE' && estado !== 'VERDE*' && estado !== 'ROJO') motivosSinJob[`${estado} · ${motivo.replace(/\d+ s callado/, 'N s callado').replace(/\(run \d+\)/, '').replace(/vivas \d+/, 'vivas N').replace(/con \d de 2/, 'con N de 2').replace(/juzgar \d+ \(0 mudas\): .*/, 'juzgar N (0 mudas)')}`] = (motivosSinJob[`${estado} · ${motivo.replace(/\d+ s callado/, 'N s callado').replace(/\(run \d+\)/, '').replace(/vivas \d+/, 'vivas N').replace(/con \d de 2/, 'con N de 2').replace(/juzgar \d+ \(0 mudas\): .*/, 'juzgar N (0 mudas)')}`] ?? 0) + 1;
    if ((estado === 'VERDE' || estado === 'VERDE*') && fila.ultimoVerde === null) fila.ultimoVerde = { i, fecha: cm.fecha };
    if (['VERDE', 'VERDE*', 'ROJO'].includes(estado) && fila.ultimoVeredicto === null) fila.ultimoVeredicto = { i, estado };
    if (['VERDE', 'VERDE*', 'ROJO'].includes(estado)) fila.conVeredicto++;
    matriz.push([cm.sha, i, cm.fecha, c, estado, motivo].join('\t'));
  });
  const n = p.commits.length;
  console.log(`  ${c}\n     de ${n} commits: con veredicto ${fila.conVeredicto} (${(100 * fila.conVeredicto / n).toFixed(1)} %) · ${ESTADOS.filter((k) => fila.estados[k]).map((k) => `${k} ${fila.estados[k]}`).join(' · ')} · suma ${Object.values(fila.estados).reduce((a, b) => a + b, 0)}\n     último verde: ${fila.ultimoVerde ? `${fila.ultimoVerde.i} commits por detrás de la punta (${fila.ultimoVerde.fecha})` : 'NINGUNO en la ventana'} · último veredicto: ${fila.ultimoVeredicto ? `${fila.ultimoVeredicto.estado}, ${fila.ultimoVeredicto.i} commits por detrás` : 'ninguno'}`);
}
console.log('\n② · POR QUÉ NO SE PUDO MIRAR (commit × job de push que no es ni VERDE ni ROJO), agrupado por motivo:');
for (const [k, n] of Object.entries(motivosSinJob).sort((a, b) => b[1] - a[1])) console.log(`  ×${n}  ${k}`);

// Los jobs de CRON, por horas.
console.log('\n① · LOS JOBS DE CRON (se miden en horas, no en commits)');
for (const d of JOBS_DE_MAIN.filter((x) => x.unidad === 'horas')) {
  const mias = E.filter((e) => e.clave === `${d.workflow} / ${d.job}`).sort((a, b) => a.creado.localeCompare(b.creado));
  const huecos = mias.slice(1).map((e, i) => (Date.parse(e.creado) - Date.parse(mias[i].creado)) / 3600000);
  console.log(`  ${d.workflow} / ${d.job}: ${mias.length} ejecuciones · ${pinta(cuenta(mias, (e) => e.estado))} · hueco mayor entre dos seguidas ${huecos.length ? Math.max(...huecos).toFixed(1) : '?'} h · la última, ${mias.at(-1)?.creado}`);
}

// ═══ ③ LOS ROJOS Y LOS «failure» DE GITHUB, POR CAUSA ════════════════════════════════════════
const deMain = E.filter((e) => declarado.has(e.clave));
const failure = deMain.filter((e) => e.github === 'completed/failure');
console.log(`\n③ · LO QUE GITHUB LLAMA «failure» EN JOBS DE MAIN: ${failure.length} ejecuciones · por estado de aquí: ${pinta(cuenta(failure, (e) => e.estado))}`);
console.log(`     por job: ${pinta(cuenta(failure, (e) => e.job.slice(0, 22)))}`);

// — meta-guard: la pata del blob —
const metas = E.filter((e) => /^meta-guard/.test(e.job) && e.porGuard && ['VERDE', 'CIEGO', 'ROJO'].includes(e.estado));
console.log(`\n③a · META-GUARD · ${metas.length} ejecuciones con resumen · ${pinta(cuenta(metas, (e) => e.estado))} · las ✔ contadas dan las «vivas» del resumen en ${metas.filter((e) => e.cuadra).length} de ${metas.length}`);
const INSTRUMENTO = 'scripts/meta-guard-mutaciones.mjs';
const grupoMeta = {};
for (const e of metas.filter((x) => x.estado !== 'VERDE')) for (const g of e.noVivos) {
  const llave = `${objeto(e.sha, `tests/${g}`)}|${objeto(e.sha, INSTRUMENTO)}`;
  const mismos = metas.filter((o) => `${objeto(o.sha, `tests/${g}`)}|${objeto(o.sha, INSTRUMENTO)}` === llave);
  const enteros = mismos.filter((o) => o.porGuard[g] && !/[^✔]/.test(o.porGuard[g]));
  (grupoMeta[g] ??= []).push({ id: e.id, sha: e.sha, creado: e.creado, forma: e.porGuard[g], estado: e.estado, blobOk: !llave.includes('null'), mismos: mismos.length, enteros: enteros.length });
}
for (const [g, v] of Object.entries(grupoMeta)) {
  const sinPata = v.filter((x) => !x.blobOk || x.enteros === 0);
  console.log(`  ${g}: no juzgado en ${v.length} ejecuciones · formas de sus marcas: ${pinta(cuenta(v, (x) => x.forma))}\n     PATA (mismo blob del guard + mismo blob del instrumento, juzgado ENTERO en otra ejecución): se cumple en ${v.length - sinPata.length} de ${v.length} · «enteros con los mismos blobs», de mín a máx: ${Math.min(...v.map((x) => x.enteros))}–${Math.max(...v.map((x) => x.enteros))}${sinPata.length ? ` · 🔴 SIN PATA: ${sinPata.map((x) => x.id).join(', ')}` : ''}`);
}
const metaRojos = metas.filter((e) => e.estado === 'ROJO');
console.log(`  mudas (un guard que NO cae cuando debe, el único rojo de verdad de este job): ${metaRojos.length}${metaRojos.map((e) => `\n     ${e.id} · ${e.motivo}`).join('')}`);

// — tanda: la pata del artefacto —
const tandas = E.filter((e) => /^build \+ tests/.test(e.job) && e.declarado);
console.log(`\n③b · BUILD + TESTS · ${tandas.length} ejecuciones con resumen · ${pinta(cuenta(tandas, (e) => e.estado))} · las marcas ancladas dan el resumen en ${tandas.filter((e) => e.suma).length} de ${tandas.length} · con «TANDA SIN VEREDICTO»: ${tandas.filter((e) => e.colgada).length}`);
console.log(`     tamaño del log, de mín a máx: ${Math.min(...tandas.map((e) => e.bytes))}–${Math.max(...tandas.map((e) => e.bytes))} B · verdes con casos AUSENTES según la señal de nombres (cola perdida, no rojo): ${tandas.filter((e) => e.estado === 'VERDE' && e.ausentes > 0).length} de ${tandas.filter((e) => e.estado === 'VERDE').length}`);
for (const e of tandas.filter((x) => x.estado === 'ROJO')) for (const c of e.caidos) {
  const llave = (o) => `${objeto(o.sha, c.fichero)}|${objeto(o.sha, 'src')}`;
  const pasa = (o) => o.T.some((t) => t.startsWith(`✔ ${c.nombre} (`));
  const cae = (o) => o.T.some((t) => t.startsWith(`✖ ${c.nombre} (`));
  const mismos = tandas.filter((o) => o.id !== e.id && llave(o) === llave(e));
  const mismoTest = tandas.filter((o) => o.id !== e.id && objeto(o.sha, c.fichero) === objeto(e.sha, c.fichero));
  const todas = tandas.filter((o) => o.id !== e.id);
  const tocado = git('log', '--format=%h', `${e.sha}..${p.punta}`, '--', c.fichero)?.split('\n').filter(Boolean) ?? [];
  console.log(`  ROJO · job ${e.id} · ${e.creado} · commit ${e.sha.slice(0, 9)} (${pos.get(e.sha)} por detrás de la punta) · ${e.declarado.pass} + ${e.declarado.fail} + ${e.declarado.skipped} = ${e.declarado.tests}`);
  console.log(`     cae: «${c.nombre}» · ${c.fichero}\n     dice: ${c.detalle}`);
  console.log(`     PATA · mismo blob del test Y mismo árbol src/: ${mismos.length} otras ejecuciones → pasa en ${mismos.filter(pasa).length}, cae en ${mismos.filter(cae).length}`);
  console.log(`     sólo mismo blob del test: ${mismoTest.length} otras → pasa en ${mismoTest.filter(pasa).length}, cae en ${mismoTest.filter(cae).length} · en las ${todas.length} otras de la ventana: pasa en ${todas.filter(pasa).length}, cae en ${todas.filter(cae).length}, no aparece en ${todas.filter((o) => !pasa(o) && !cae(o)).length}`);
  console.log(`     ④ ¿de otro main? commits de main que tocan ${c.fichero} después del rojo: ${tocado.length}${tocado.length ? ' (' + tocado.join(' ') + ')' : ''} · su blob hoy en la punta es ${objeto(p.punta, c.fichero) === objeto(e.sha, c.fichero) ? 'EL MISMO' : 'OTRO'}`);
}

// — los demás —
console.log('\n③c · LOS DEMÁS JOBS DE MAIN que no salen VERDE (uno por línea)');
for (const e of deMain.filter((x) => !/^(meta-guard|build \+ tests)/.test(x.job) && !['VERDE', 'VERDE*'].includes(x.estado) && x.github !== 'completed/skipped')) console.log(`  ${e.estado} · ${e.job.slice(0, 30)} · job ${e.id} · ${e.creado} · ${e.sha.slice(0, 9)} (${pos.get(e.sha) ?? '?'} por detrás) · github ${e.github} · ${e.seg} s · ${e.motivo}`);
const vig = E.filter((e) => /^vigía del despliegue/.test(e.job) && e.palabra).sort((a, b) => a.creado.localeCompare(b.creado));
console.log(`\n     el vigía del despliegue (informativo) dice, en sus ${vig.length} ejecuciones: ${pinta(cuenta(vig, (e) => `${e.palabra}[${e.estado}]`))}`);
for (const e of vig.filter((x) => x.palabra !== 'al-dia')) console.log(`       ${e.creado} · job ${e.id} · ${e.estado} · ${e.motivo}`);
const trin = E.filter((e) => /^trinquete/.test(e.job));
console.log(`     el trinquete: una zona, en los ${zonasVerdes.length / 2} verdes, tarda de ${Math.min(...zonasVerdes)} a ${maxZona} s; los cortados callaron ${trin.filter((e) => e.silencio).map((e) => e.silencio).join(', ')} s`);

// — fuera de la lista —
console.log('\n⑤ · FUERA DE LA LISTA DEL VIGÍA (reactivos): no se reparten entre los estados de main');
for (const c of fuera) { const mias = E.filter((e) => e.clave === c); console.log(`  ${c}: ${mias.length} ejecuciones · github: ${pinta(cuenta(mias, (e) => e.github))}`); }
const sinJobsRaros = p.runs.filter((r) => !p.jobs[r.id].length && r.conclusion !== 'cancelled');
console.log(`  runs sin ningún job que NO son «cancelled»: ${sinJobsRaros.length}${sinJobsRaros.map((r) => `\n     ${r.wf} · run ${r.id} · ${r.status}/${r.conclusion ?? ''} · ${r.creado} → ${r.actualizado} · ${r.sha.slice(0, 9)}`).join('')}`);

// ═══ LA TABLA ════════════════════════════════════════════════════════════════════════════════
const tot = cuenta(deMain, (e) => e.estado);
console.log(`\nRESUMEN · ejecuciones de los ${declarado.size} jobs de main: ${deMain.length} · ${ESTADOS.filter((k) => tot[k]).map((k) => `${k} ${tot[k]}`).join(' · ')} · suma ${ESTADOS.reduce((s, k) => s + (tot[k] ?? 0), 0)}`);

const tsv = (f) => [f.wf, f.job, f.evento, f.run, f.id, f.sha, pos.get(f.sha) ?? '', f.creado, f.github, f.seg ?? '', f.bytes ?? '', f.estado, (f.motivo ?? '').replace(/\s+/g, ' ')].join('\t');
fs.writeFileSync(path.join(carpeta, 'c-ejecuciones.tsv'), 'workflow\tjob\tevento\trun\tjob_id\tsha\tcommits_por_detras\tcreado\tgithub\tsegundos\tbytes_del_log\testado\tmotivo\n' + E.map(tsv).join('\n') + '\n');
fs.writeFileSync(path.join(carpeta, 'c-commits.tsv'), 'sha\tcommits_por_detras\tfecha\tjob\testado\tmotivo\n' + matriz.join('\n') + '\n');
console.log('EXIT=0');
