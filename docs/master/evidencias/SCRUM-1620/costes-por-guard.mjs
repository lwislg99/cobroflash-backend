// Coste por guard desde el log de un job del meta-guard: cada línea de veredicto lleva su hora;
// el tiempo entre una línea y la anterior se le apunta al guard de la línea (la primera de cada
// guard incluye su limpia). Uso: node costes.mjs <log> [top]
import fs from 'node:fs';
const [log, topArg] = process.argv.slice(2);
const top = Number(topArg || 25);
const lineas = fs.readFileSync(log, 'utf8').split(/\r?\n/);
const re = /(\d{4}-\d\d-\d\dT[\d:.]+Z)\s+\S+\s+([\w.-]+\.test\.mjs) · /u;
let prev = null; let inicio = null;
const por = new Map();
let n = 0;
for (const l of lineas) {
  const ts = /(\d{4}-\d\d-\d\dT[\d:.]+Z) presupuesto del paso/.exec(l);
  if (ts) { prev = Date.parse(ts[1]); inicio = prev; continue; }
  const m = re.exec(l);
  if (!m || prev === null) continue;
  const t = Date.parse(m[1]);
  const g = m[2];
  const e = por.get(g) || { s: 0, muts: 0 };
  e.s += (t - prev) / 1000; e.muts += 1; por.set(g, e);
  prev = t; n++;
}
const filas = [...por.entries()].map(([g, e]) => ({ g, ...e })).sort((a, b) => b.s - a.s);
const total = filas.reduce((x, f) => x + f.s, 0);
console.log(`veredictos ${n} · guards ${filas.length} · total ${total.toFixed(0)} s · desde la marca ${((prev - inicio) / 1000).toFixed(0)} s`);
let acum = 0;
for (const [i, f] of filas.entries()) {
  acum += f.s;
  if (i < top) console.log(`${String(i + 1).padStart(3)} ${f.s.toFixed(1).padStart(6)} s · ${String(f.muts).padStart(3)} mut · ${(f.s / f.muts).toFixed(1).padStart(5)} s/mut · acum ${(100 * acum / total).toFixed(0)}% · ${f.g}`);
}
const buckets = [[0, 5], [5, 10], [10, 20], [20, 40], [40, 1e9]];
for (const [a, b] of buckets) {
  const fs_ = filas.filter((f) => f.s >= a && f.s < b);
  console.log(`[${a},${b === 1e9 ? '∞' : b}) s: ${fs_.length} guards, ${fs_.reduce((x, f) => x + f.s, 0).toFixed(0)} s`);
}
if (process.env.JSON_OUT) fs.writeFileSync(process.env.JSON_OUT, JSON.stringify(filas));

