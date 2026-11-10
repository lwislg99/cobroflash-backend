#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1538c/g-clasificar.mjs — SCRUM-1538c · SÓLO LECTURA de logs ya bajados.
//
// Para cada log de `f-bajados.tsv`:
//   · build-failure → qué casos caen (cruz ANCLADA al inicio del caso, sumas contra el resumen, igual que
//     `leerTanda` de SCRUM-1538/c-clasificar.mjs), o en qué PASO cae si no hay resumen de tanda;
//   · trinquete-colgada → qué zonas acabó, cuánto tardó cada una y en cuál estaba al cortarse;
//   · meta-colgada y meta-verde-control → último guard juzgado, cuántas líneas juzgó y en cuántos segundos.
//
//   node g-clasificar.mjs <carpeta con e-jobs.tsv, f-bajados.tsv y logs/> [--sin-siembra]
//
// SIEMBRA: antes de leer nada, los lectores pasan por casos FABRICADOS aquí (un rojo de A8.4, un verde cuyo
// NOMBRE lleva la cruz, una colgada, un log sin resumen). Si falta alguno, o con `--sin-siembra`, sale CIEGO.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const carpeta = args.find((a) => !a.startsWith('--'));
const SIN_SIEMBRA = args.includes('--sin-siembra');
if (!carpeta) { console.error('uso: node g-clasificar.mjs <carpeta> [--sin-siembra]'); process.exit(2); }
const ESC = /\x1b\[[0-9;]*[A-Za-z]/g;
const BOM = String.fromCharCode(0xfeff);
const lineas = (crudo) => crudo.split(/\r?\n/).map((l) => { const s = l.startsWith(BOM) ? l.slice(1) : l; return { h: s.slice(0, 28), t: s.slice(29).replace(ESC, '') }; });
const num = (re, T) => { for (const t of T) { const m = re.exec(t); if (m) return Number(m[1]); } return null; };

export function leerTanda(L) {
  const T = L.map((x) => x.t);
  const colgada = T.filter((t) => t.startsWith('🔴 TANDA SIN VEREDICTO')).length;
  const iRes = []; T.forEach((t, i) => { if (/^ℹ tests \d+$/.test(t)) iRes.push(i); });
  const errores = L.filter((x) => x.t.startsWith('##[error]')).map((x) => x.t.slice(9).slice(0, 160));
  let paso = null; let pasoRojo = null;
  for (const x of L) { const g = /^##\[group\]Run (.+)$/.exec(x.t); if (g) paso = g[1].slice(0, 80); if (x.t.startsWith('##[error]') && !pasoRojo) pasoRojo = paso; }
  if (!iRes.length) return { estado: colgada ? 'COLGADA' : 'SIN TANDA', motivo: colgada ? 'TANDA SIN VEREDICTO, y sin resumen' : `cae antes de la tanda · paso «${pasoRojo}» · ${errores[0] ?? 'sin ##[error]'}`, caidos: [], errores };
  const bloques = iRes.map((i) => { const o = { i }; for (const k of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) o[k] = num(new RegExp(`^ℹ ${k} (\\d+)$`), T.slice(i, i + 8)); return o; });
  const b = [...bloques].sort((x, y) => y.tests - x.tests)[0];
  const desde = Math.max(0, ...iRes.filter((i) => i < b.i));
  const zona = T.slice(desde, b.i);
  const FIN = /^.+ \([\d.]+ms\)( # .*)?$/;
  const caso = (marca) => (t) => { const s = t.trimStart(); return s.startsWith(marca + ' ') && FIN.test(s); };
  const c = { pass: zona.filter(caso('✔')).length, fail: zona.filter(caso('✖')).length, skipped: zona.filter(caso('﹣')).length };
  const suma = b.pass + b.fail + b.skipped + (b.cancelled ?? 0) + (b.todo ?? 0) === b.tests;
  const iF = T.findIndex((t, i) => i > b.i && t === '✖ failing tests:');
  const caidos = [];
  if (iF >= 0) for (let i = iF + 1; i < T.length && !T[i].startsWith('##['); i++) {
    const m = /^✖ (.+) \(([\d.]+)ms\)$/.exec(T[i]);
    if (m) caidos.push({ nombre: m[1], ms: Number(m[2]), fichero: /^test at (tests\/\S+?):\d+:\d+$/.exec(T[i - 1] ?? '')?.[1] ?? null, detalle: T.slice(i + 1, i + 8).map((x) => x.trim()).filter(Boolean).join(' ¦ ').slice(0, 600) });
  }
  const base = { declarado: b, contado: c, suma, caidos, colgada, errores, pasoRojo };
  if (colgada) return { ...base, estado: 'COLGADA', motivo: 'TANDA SIN VEREDICTO' };
  if (b.fail > 0) return caidos.length === b.fail ? { ...base, estado: 'ROJO', motivo: caidos.map((x) => x.nombre).join(' ¦ ') } : { ...base, estado: 'SIN CLASIFICAR', motivo: `el resumen dice fail ${b.fail} y el log nombra ${caidos.length}` };
  return { ...base, estado: 'TANDA VERDE, CAE OTRO PASO', motivo: `paso «${pasoRojo}» · ${errores[0] ?? ''}` };
}

export function leerZona(L) {
  const zonas = []; let cortada = null;
  for (const x of L) {
    const m = /^\s+midiendo en (\S+)\s+… (.*)$/.exec(x.t);
    if (m) zonas.push({ zona: m[1], resto: m[2].trim(), h: x.h });
    if (x.t.startsWith('##[error]The operation was canceled')) cortada = x.h;
  }
  const inicio = L.find((x) => /^##\[group\]Run npm run trinquete:zona/.test(x.t))?.h ?? null;
  const huerfanos = L.filter((x) => /^Terminate orphan process: pid \(\d+\) \((.+)\)$/.test(x.t)).map((x) => /\((.+)\)$/.exec(x.t)[1]);
  const acabadas = zonas.filter((z) => /pruebas · \d+ s/.test(z.resto));
  return { inicio, cortada, acabadas: acabadas.map((z) => `${z.zona} ${/(\d+) pruebas · (\d+) s/.exec(z.resto).slice(1).join(' pruebas · ')} s`), enCurso: acabadas.length < 2 ? (acabadas.length === 0 ? 'la 1.ª zona' : 'la 2.ª zona') : 'ninguna (las dos acabaron)', huerfanos };
}

export function leerMeta(L) {
  const inicio = L.find((x) => /^##\[group\]Run npm run meta:mutaciones/.test(x.t))?.h ?? null;
  const juz = L.filter((x) => /^ {2}(✔|\?|☠|✖) \S+\.test\.mjs · /.test(x.t));
  const res = L.find((x) => /^vivas \d+ · mudas \d+/.test(x.t))?.t ?? null;
  const ult = juz.at(-1);
  return { inicio, lineas: juz.length, ficheros: new Set(juz.map((x) => /^ {2}\S+ (\S+\.test\.mjs)/.exec(x.t)[1])).size, ultimo: ult ? /^ {2}\S+ (\S+\.test\.mjs)/.exec(ult.t)[1] : null, ultimaHora: ult?.h ?? null, resumen: res };
}

// ═══ SIEMBRA ════════════════════════════════════════════════════════════════════════════════════
const S = (...t) => t.map((x, i) => ({ h: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}.0000000Z`, t: x }));
const siembra = SIN_SIEMBRA ? [] : [
  ['rojo A8.4', () => leerTanda(S('##[group]Run npm test', '✔ uno (1ms)', '✖ A8.4: suite completa del bot (webhook + dry-run) (5ms)', 'ℹ tests 2', 'ℹ suites 0', 'ℹ pass 1', 'ℹ fail 1', 'ℹ cancelled 0', 'ℹ skipped 0', 'ℹ todo 0', '✖ failing tests:', 'test at tests/bot-suite.test.mjs:9:1', '✖ A8.4: suite completa del bot (webhook + dry-run) (5ms)', "  'menu' !== 'handoff'", '##[error]Process completed with exit code 1.')), (r) => r.estado === 'ROJO' && r.caidos[0]?.fichero === 'tests/bot-suite.test.mjs'],
  ['verde con la cruz en el NOMBRE', () => leerTanda(S('##[group]Run npm test', '✔ pasa aunque diga ✖ y TANDA (1ms)', 'ℹ tests 1', 'ℹ suites 0', 'ℹ pass 1', 'ℹ fail 0', 'ℹ cancelled 0', 'ℹ skipped 0', 'ℹ todo 0', '##[group]Run otro paso', '##[error]Process completed with exit code 1.')), (r) => r.estado === 'TANDA VERDE, CAE OTRO PASO' && r.caidos.length === 0],
  ['colgada', () => leerTanda(S('✔ uno (1ms)', '🔴 TANDA SIN VEREDICTO: dejó de escribir', '##[error]Process completed with exit code 1.')), (r) => r.estado === 'COLGADA'],
  ['sin resumen', () => leerTanda(S('##[group]Run npm run build', '##[error]Process completed with exit code 2.')), (r) => r.estado === 'SIN TANDA' && /npm run build/.test(r.motivo)],
  ['zona cortada en la 2.ª', () => leerZona(S('##[group]Run npm run trinquete:zona', '   midiendo en Pacific/Kiritimati     … 10561 pruebas · 310 s · el hijo vio Pacific/Kiritimati', '##[error]The operation was canceled.', 'Terminate orphan process: pid (1) (MainThread)')), (r) => r.enCurso === 'la 2.ª zona' && r.huerfanos.length === 1],
  ['meta cortado', () => leerMeta(S('##[group]Run npm run meta:mutaciones', '  ✔ a.test.mjs · uno', '  ☠ b.test.mjs · dos', '##[error]The operation was canceled.')), (r) => r.lineas === 2 && r.ultimo === 'b.test.mjs' && r.resumen === null],
];
let sembradosOk = 0;
for (const [n, f, ok] of siembra) { const r = f(); const bien = ok(r); if (bien) sembradosOk++; console.log(`SIEMBRA ${bien ? 'OK  ' : 'FALLA'} ${n}`); }
if (sembradosOk !== 6) { console.log(`CIEGO · siembra ${sembradosOk} de 6: el lector no ve lo que tiene que ver; no se clasifica nada`); console.log('EXIT=3'); process.exit(3); }

// ═══ LA POBLACIÓN ═══════════════════════════════════════════════════════════════════════════════
const tsv = (f) => { const L = fs.readFileSync(path.join(carpeta, f), 'utf8').trim().split('\n'); const c = L[0].split('\t'); return L.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [c[i], v]))); };
const jobs = new Map(tsv('e-jobs.tsv').map((j) => [j.job, j]));
const bajados = fs.readFileSync(path.join(carpeta, 'f-bajados.tsv'), 'utf8').trim().split('\n').map((l) => { const [id, g, bytes] = l.split('\t'); return { id, g, bytes: Number(bytes) }; });
const salida = [];
const p = (s) => { salida.push(s); console.log(s); };
const filas = [];
for (const b of bajados) {
  const j = jobs.get(b.id);
  const L = lineas(fs.readFileSync(path.join(carpeta, 'logs', `${b.id}.log`), 'utf8'));
  const base = { job: b.id, grupo: b.g, bytes: b.bytes, run: j.run, evento: j.evento, rama: j.rama, sha: j.sha.slice(0, 9), intento: j.intento, creado: j.creado, segundos: j.segundos };
  if (b.g === 'build-failure') filas.push({ ...base, ...leerTanda(L) });
  else if (b.g.startsWith('trinquete')) filas.push({ ...base, ...leerZona(L) });
  else filas.push({ ...base, ...leerMeta(L) });
}
fs.writeFileSync(path.join(carpeta, 'g-filas.json'), JSON.stringify(filas, null, 1));

// ① build + tests en rojo
const bf = filas.filter((f) => f.grupo === 'build-failure');
const porEstado = {}; for (const f of bf) porEstado[f.estado] = (porEstado[f.estado] ?? 0) + 1;
p(`\n① build + tests en failure: ${bf.length} logs · ${Object.entries(porEstado).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
const porCaso = {};
for (const f of bf) for (const c of f.caidos) { const k = `${c.fichero} · ${c.nombre}`; (porCaso[k] ??= []).push(f); }
p(`   casos distintos que caen: ${Object.keys(porCaso).length} · caídas: ${Object.values(porCaso).reduce((a, v) => a + v.length, 0)}`);
for (const [k, v] of Object.entries(porCaso).sort((a, b) => b[1].length - a[1].length)) p(`   ${String(v.length).padStart(3)}  ${k.slice(0, 170)}  [main ${v.filter((f) => f.evento === 'push').length}]`);
const sinTanda = {}; for (const f of bf.filter((f) => f.estado !== 'ROJO')) { const k = `${f.estado} · ${String(f.motivo).replace(/\d{4}-\d\d-\d\dT\S+/g, '').slice(0, 140)}`; sinTanda[k] = (sinTanda[k] ?? 0) + 1; }
p('   sin caso que caiga (el rojo es de otro paso, o no hay tanda):');
for (const [k, n] of Object.entries(sinTanda).sort((a, b) => b[1] - a[1])) p(`   ${String(n).padStart(3)}  ${k}`);
const sumasMal = bf.filter((f) => f.declarado && !f.suma).length;
p(`   control de la suma (pass+fail+skipped+cancelled+todo = tests): ${bf.filter((f) => f.declarado).length - sumasMal} de ${bf.filter((f) => f.declarado).length} cuadran`);

// ② A8.4
const a84 = bf.filter((f) => f.caidos.some((c) => c.fichero === 'tests/bot-suite.test.mjs'));
p(`\n② A8.4 (tests/bot-suite.test.mjs): ${a84.length} rojos`);
for (const f of a84) for (const c of f.caidos.filter((c) => c.fichero === 'tests/bot-suite.test.mjs')) p(`   ${f.creado} · ${f.evento} · ${f.rama} · ${f.sha} · run ${f.run} · job ${f.job} · intento ${f.intento} · ${f.caidos.length} caídos en esa tanda · saltos ${f.declarado.skipped} · ${c.ms} ms\n      ${c.nombre} ¦ ${c.detalle.slice(0, 300)}`);

// ③ trinquete colgado
const tz = filas.filter((f) => f.grupo === 'trinquete-colgada');
p(`\n③ trinquete de zona cortado a ≥ 40 min: ${tz.length}`);
for (const f of tz) p(`   ${f.creado} · ${f.evento} · ${f.rama.slice(0, 40)} · ${f.sha} · job ${f.job} · ${f.segundos} s · acabó: ${f.acabadas.join(' + ') || 'ninguna'} · colgada en ${f.enCurso} · huérfanos ${f.huerfanos.length} (${[...new Set(f.huerfanos)].join(', ')})`);
const enc = {}; for (const f of tz) enc[f.enCurso] = (enc[f.enCurso] ?? 0) + 1;
p(`   en qué zona estaba: ${Object.entries(enc).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
const verdesZ = filas.filter((f) => f.grupo === 'trinquete-verde-control');
p(`   control: ${verdesZ.length} verdes · ${verdesZ.map((f) => f.acabadas.join(' + ')).join(' | ')}`);

// ④ meta-guard
const mc = filas.filter((f) => f.grupo === 'meta-colgada');
const mv = filas.filter((f) => f.grupo === 'meta-verde-control');
const fin = {}; for (const f of mc) fin[f.ultimo] = (fin[f.ultimo] ?? 0) + 1;
p(`\n④ meta-guard cortado a ≥ 29 min: ${mc.length} · con resumen «vivas … mudas»: ${mc.filter((f) => f.resumen).length}`);
p(`   líneas juzgadas al cortarse: de ${Math.min(...mc.map((f) => f.lineas))} a ${Math.max(...mc.map((f) => f.lineas))} · ficheros: de ${Math.min(...mc.map((f) => f.ficheros))} a ${Math.max(...mc.map((f) => f.ficheros))}`);
p('   último fichero juzgado al cortarse (los 8 más frecuentes):');
for (const [k, n] of Object.entries(fin).sort((a, b) => b[1] - a[1]).slice(0, 8)) p(`   ${String(n).padStart(3)}  ${k}`);
p(`   control: ${mv.length} verdes · líneas juzgadas de ${Math.min(...mv.map((f) => f.lineas))} a ${Math.max(...mv.map((f) => f.lineas))} · ficheros de ${Math.min(...mv.map((f) => f.ficheros))} a ${Math.max(...mv.map((f) => f.ficheros))} · segundos de ${Math.min(...mv.map((f) => +f.segundos))} a ${Math.max(...mv.map((f) => +f.segundos))} · con resumen ${mv.filter((f) => f.resumen).length}`);
p(`\nPOBLACIÓN · logs leídos ${filas.length} de ${bajados.length} · siembra ${sembradosOk} de 6`);
fs.writeFileSync(path.join(carpeta, 'g-salida.txt'), salida.join('\n') + '\n');
console.log('EXIT=0');
