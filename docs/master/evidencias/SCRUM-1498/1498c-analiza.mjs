// Analiza la salida de mide-veredicto.mjs. Veredicto = el job obligatorio acabó en success|failure.
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const V = new Set(['success', 'failure']);
const cuenta = {};
const sum = (k) => { cuenta[k] = (cuenta[k] || 0) + 1; };
let vA = 0, vB = 0, discrep = [], porDia = {};
const sinVeredicto = [];
for (const f of d.filas) {
  const a = !!(f.jobA && V.has(f.jobA.conclusion));
  const b = f.checkB.some((x) => V.has(x.conclusion));
  if (a) vA++; if (b) vB++;
  if (a !== b) discrep.push(f.sha);
  const dia = f.fecha.slice(0, 10);
  porDia[dia] ??= { n: 0, v: 0 }; porDia[dia].n++; if (a) porDia[dia].v++;
  // clase
  let clase;
  if (f.runs.length === 0) clase = 'sin run';
  else if (a) clase = `veredicto ${f.jobA.conclusion}`;
  else if (f.runs.some((r) => r.status !== 'completed') || (f.jobA && f.jobA.status !== 'completed')) clase = 'sin acabar (en cola o corriendo)';
  else if (f.nJobs === 0 && f.runs.every((r) => r.conclusion === 'cancelled')) clase = 'run cancelado con 0 jobs (sustituido por un push posterior)';
  else if (f.jobA && f.jobA.conclusion === 'cancelled') clase = 'el job obligatorio arrancó y salió cancelled';
  else clase = `otro: run=${f.runs.map((r) => r.conclusion).join(',')} job=${f.jobA?.conclusion}`;
  sum(clase);
  if (!a) sinVeredicto.push(f);
}
const n = d.filas.length;
console.log(`población: ${n} commits de primer padre de origin/main, cI en [${d.desde}, ${d.hasta}) · ${d.nRuns} runs de ci.yml push/main en la ventana`);
console.log(`sonda A (Actions, job por nombre exacto): ${vA}/${n} = ${(100 * vA / n).toFixed(1)} %`);
console.log(`sonda B (check-runs por commit):          ${vB}/${n} = ${(100 * vB / n).toFixed(1)} %`);
console.log(`discrepancias A≠B: ${discrep.length} ${discrep.slice(0, 5).join(' ')}`);
console.log('por clase:'); for (const [k, v] of Object.entries(cuenta).sort((x, y) => y[1] - x[1])) console.log(`  ${String(v).padStart(4)} · ${(100 * v / n).toFixed(1).padStart(5)} % · ${k}`);
console.log('por día (cI del commit):'); for (const [k, v] of Object.entries(porDia).sort()) console.log(`  ${k}  ${v.v}/${v.n} = ${(100 * v.v / v.n).toFixed(0)} %`);
// Control positivo: el commit pedido por argumento tiene que salir con veredicto en las dos sondas.
for (const sha of process.argv.slice(3)) {
  const f = d.filas.find((x) => x.sha.startsWith(sha));
  console.log(`CONTROL ${sha}: ${f ? `en población · A=${f.jobA?.conclusion} · B=${f.checkB.map((x) => x.conclusion).join(',')}` : 'NO ESTÁ EN LA POBLACIÓN'}`);
}
// Duraciones del obligatorio y del último job (para el modelo).
const dur = (s, e) => (new Date(e) - new Date(s)) / 60000;
const obl = d.filas.filter((f) => f.jobA?.completed && f.jobA.started).map((f) => dur(f.jobA.started, f.jobA.completed)).sort((a, b) => a - b);
const q = (arr, p) => arr[Math.floor(p * (arr.length - 1))]?.toFixed(1);
console.log(`obligatorio (job arrancado y acabado, n=${obl.length}): p50 ${q(obl, .5)} · p90 ${q(obl, .9)} · máx ${q(obl, 1)} min`);
const ult = {};
for (const f of d.filas) {
  const js = (f.jobsLargos || []).filter((j) => j.completed && j.started && f.nJobs > 0);
  if (!js.length) continue;
  const u = js.reduce((m, j) => (j.completed > m.completed ? j : m));
  ult[u.name] = (ult[u.name] || 0) + 1;
}
console.log('último job en acabar, por run con jobs:', ult);
