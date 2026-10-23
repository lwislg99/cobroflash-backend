#!/usr/bin/env node
// SCRUM-935d · c-analizar.mjs — sin red: cruza a-jobs.tsv (duración) con b-jobs-leidos.tsv (veredictos)
// y los logs ya bajados. Separa el CORTE POR TECHO (job ≥ 1.770 s) de la cancelación por concurrencia
// (un push nuevo a la misma rama mata el run viejo: eso no tapa nada, lo sustituye) y contesta:
//   ① cuántas mutaciones y cuántos guards se quedaron sin juzgar en los cortes por techo;
//   ② qué veredictos NO verdes (MUDA, CIEGA, MUERTO) se quedaron enterrados bajo un `cancelled`;
//   ③ qué PR / commits de main NUNCA tuvieron un meta-guard completo (ningún run llegó al resumen).
//   node c-analizar.mjs <carpeta>
import fs from 'node:fs';
import path from 'node:path';

const [carpeta] = process.argv.slice(2);
const tsv = (f) => {
  const L = fs.readFileSync(path.join(carpeta, f), 'utf8').trim().split('\n');
  const cab = L[0].split('\t');
  return L.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cab[i], v])));
};
const jobs = new Map(tsv('a-jobs.tsv').map((j) => [j.job, j]));
const leidos = tsv('b-jobs-leidos.tsv').map((x) => ({ ...x, dur: Number(jobs.get(x.job)?.duracion_s || 0), sha: jobs.get(x.job)?.sha }));
const TECHO = 1770;
const techo = leidos.filter((x) => x.estado === 'CORTADO' && x.dur >= TECHO);
const concurrencia = leidos.filter((x) => x.estado === 'CORTADO' && x.dur < TECHO);
const completos = leidos.filter((x) => x.estado === 'COMPLETO');
const suma = (a, k) => a.reduce((n, x) => n + Number(x[k] || 0), 0);
const fecha = (a) => a.map((x) => x.creado).sort();

console.log(`POBLACIÓN · ${leidos.length} jobs del meta-guard con log leído (desde ${fecha(leidos)[0]} hasta ${fecha(leidos).at(-1)})`);
console.log(`  COMPLETOS ${completos.length} · CORTADOS POR TECHO (≥ ${TECHO} s, sin resumen) ${techo.length} · cortados ANTES del techo (concurrencia u otro) ${concurrencia.length}`);
console.log(`  de los cortados por techo: cancelled ${techo.filter((x) => x.conclusion === 'cancelled').length} · otro ${techo.filter((x) => x.conclusion !== 'cancelled').length}`);
console.log('');
console.log('① LO QUE NO SE LLEGÓ A JUZGAR en los cortes por techo');
console.log(`  mutaciones juzgadas ${suma(techo, 'juzgadas')} de ~${suma(techo, 'total_aprox')} · SIN JUZGAR ~${suma(techo, 'sin_juzgar')} (${(100 * suma(techo, 'sin_juzgar') / suma(techo, 'total_aprox')).toFixed(1)} %)`);
const sj = techo.map((x) => Number(x.sin_juzgar)).sort((a, b) => a - b);
const gj = techo.map((x) => Number(x.guards_sin_juzgar)).sort((a, b) => a - b);
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
console.log(`  por corte: mutaciones sin juzgar p50 ${q(sj, 0.5)} · p90 ${q(sj, 0.9)} · máx ${sj.at(-1)} · guards sin juzgar p50 ${q(gj, 0.5)} · p90 ${q(gj, 0.9)} · máx ${gj.at(-1)}`);
// Qué guards se quedan fuera: el instrumento recorre el censo en orden fijo, así que el corte se come la COLA.
const fuera = new Map();
for (const x of techo) {
  const ref = leidos.find((r) => r.job === x.ref_job);
  if (!ref) continue;
  const texto = fs.readFileSync(path.join(carpeta, 'logs', `${ref.job}.log`), 'utf8');
  const orden = [...new Set([...texto.matchAll(/ {2}(?:✔|✖|\?|☠) (\S+\.test\.mjs) · /g)].map((m) => m[1]))];
  const vt = fs.readFileSync(path.join(carpeta, 'logs', `${x.job}.log`), 'utf8');
  const vistos = new Set([...vt.matchAll(/ {2}(?:✔|✖|\?|☠) (\S+\.test\.mjs) · /g)].map((m) => m[1]));
  for (const g of orden) if (!vistos.has(g)) fuera.set(g, (fuera.get(g) || 0) + 1);
}
const ord = [...fuera.entries()].sort((a, b) => b[1] - a[1]);
console.log(`  guards DISTINTOS que algún corte dejó sin juzgar: ${ord.length} · en TODOS los ${techo.length} cortes: ${ord.filter(([, n]) => n === techo.length).length} · en ≥ 90 %: ${ord.filter(([, n]) => n >= 0.9 * techo.length).length}`);
fs.writeFileSync(path.join(carpeta, 'c-guards-fuera.tsv'), 'guard\tcortes_que_lo_dejan_fuera\n' + ord.map(([g, n]) => `${g}\t${n}`).join('\n') + '\n');
console.log('');
console.log('② LO QUE SÍ SE JUZGÓ Y SE QUEDÓ ENTERRADO bajo el corte (veredictos no verdes en un job sin resumen ni código de salida)');
for (const [rotulo, a] of [['cortados por techo', techo], ['cortados antes del techo', concurrencia]]) {
  console.log(`  ${rotulo}: MUDAS ${suma(a, 'mudas')} (en ${a.filter((x) => +x.mudas > 0).length} jobs) · CIEGAS ${suma(a, 'ciegas')} (en ${a.filter((x) => +x.ciegas > 0).length} jobs) · MUERTOS ${suma(a, 'muertos')} (en ${a.filter((x) => +x.muertos > 0).length} jobs)`);
  for (const x of a.filter((y) => +y.mudas > 0 || +y.muertos > 0)) console.log(`    · job ${x.job} (${x.evento} ${x.rama}, ${x.creado}) · MUDOS: ${x.mudos_nombres || '-'} · muertos ${x.muertos}`);
  const ciegosPorGuard = new Map();
  for (const x of a) for (const g of (x.ciegos_nombres || '').split(',').filter(Boolean)) ciegosPorGuard.set(g, (ciegosPorGuard.get(g) || 0) + 1);
  if (ciegosPorGuard.size) console.log(`    ciegas por guard: ${[...ciegosPorGuard.entries()].sort((p, r) => r[1] - p[1]).map(([g, n]) => `${g}×${n}`).join(' · ')}`);
}
console.log(`  (comparación) en los COMPLETOS: MUDAS ${suma(completos, 'mudas')} · CIEGAS ${suma(completos, 'ciegas')} · MUERTOS ${suma(completos, 'muertos')} — ésas SÍ salieron con código ≠ 0`);
console.log('');
console.log('③ ¿QUIÉN SE QUEDÓ SIN NINGÚN META-GUARD COMPLETO?');
const porRama = new Map();
for (const x of leidos) {
  const k = x.evento === 'push' ? `main@${x.sha?.slice(0, 9)}` : `PR:${x.rama}`;
  const v = porRama.get(k) || { completos: 0, techo: 0, otros: 0 };
  if (x.estado === 'COMPLETO') v.completos += 1; else if (x.dur >= TECHO) v.techo += 1; else v.otros += 1;
  porRama.set(k, v);
}
const ramasPR = [...porRama.entries()].filter(([k]) => k.startsWith('PR:'));
const commitsMain = [...porRama.entries()].filter(([k]) => k.startsWith('main@'));
const sinNinguno = (a) => a.filter(([, v]) => v.completos === 0 && v.techo > 0);
console.log(`  ramas de PR con meta-guard: ${ramasPR.length} · SIN NINGÚN completo y con ≥ 1 corte por techo: ${sinNinguno(ramasPR).length}`);
console.log(`  commits de main con meta-guard: ${commitsMain.length} · SIN completo y con corte por techo: ${sinNinguno(commitsMain).length}`);
fs.writeFileSync(path.join(carpeta, 'c-sin-ninguno-completo.tsv'), 'quien\tcompletos\ttecho\totros\n'
  + [...sinNinguno(ramasPR), ...sinNinguno(commitsMain)].map(([k, v]) => `${k}\t${v.completos}\t${v.techo}\t${v.otros}`).join('\n') + '\n');
