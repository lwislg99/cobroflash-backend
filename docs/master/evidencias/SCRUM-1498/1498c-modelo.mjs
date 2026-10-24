// Modelo de un grupo de concurrencia de GitHub: un hueco corriendo + un hueco pendiente;
// el que llega sustituye al pendiente. Horas de llegada = created_at REALES de los runs.
// Duración = remuestreo de las duraciones REALES (bootstrap, 2000 réplicas, semilla fija).
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const llegadas = d.filas.flatMap((f) => f.runs.map((r) => +new Date(r.created))).sort((a, b) => a - b);
const min = (s, e) => (new Date(e) - new Date(s)) / 60000;
const durObl = d.filas.filter((f) => f.jobA?.started && f.jobA?.completed).map((f) => min(f.jobA.started, f.jobA.completed));
// duración de pared del run = del primer started al último completed de sus jobs
const durRun = d.filas.filter((f) => f.nJobs > 0 && f.jobsLargos?.every((j) => j.completed)).map((f) => {
  const s = Math.min(...f.jobsLargos.map((j) => +new Date(j.started))); const e = Math.max(...f.jobsLargos.map((j) => +new Date(j.completed)));
  return (e - s) / 60000;
});
let semilla = 12345; const rnd = () => ((semilla = (semilla * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
function simula(durs, colchon = 0) {
  let finCorriendo = -Infinity, pendiente = null, corridos = 0;
  const arranca = (t) => { finCorriendo = t + (durs[Math.floor(rnd() * durs.length)] + colchon) * 60000; corridos++; };
  for (const t of llegadas) {
    while (pendiente !== null && finCorriendo <= t) { const ini = finCorriendo; pendiente = null; arranca(ini); }
    if (finCorriendo <= t) arranca(t); else pendiente = t;
  }
  if (pendiente !== null) corridos++;
  return corridos;
}
const rep = (durs, colchon) => { const xs = []; for (let i = 0; i < 2000; i++) xs.push(simula(durs, colchon)); xs.sort((a, b) => a - b); return [xs[50], xs[1000], xs[1950]]; };
const n = llegadas.length;
const fmt = ([lo, m, hi]) => `${m}/${n} = ${(100 * m / n).toFixed(1)} % (IC90 ${lo}-${hi})`;
console.log(`llegadas: ${n} runs · duraciones de run medidas n=${durRun.length} · del obligatorio n=${durObl.length}`);
console.log(`VALIDACIÓN · grupo retenido por el RUN entero (hoy): predice ${fmt(rep(durRun, 0))} · MEDIDO 81/280 (los 2 sin run no llegan)`);
console.log(`DECISIÓN   · grupo retenido sólo por el OBLIGATORIO:  predice ${fmt(rep(durObl, 0))}`);
console.log(`  idem, +1 min de cola de runner por arranque:          ${fmt(rep(durObl, 1))}`);
console.log(`META-GUARD en su grupo propio (cuántos commits lo corren): ${fmt(rep(d.filas.flatMap((f) => (f.jobsLargos || []).filter((j) => j.name.startsWith('meta-guard') && j.started && j.completed).map((j) => min(j.started, j.completed))), 0))}`);
