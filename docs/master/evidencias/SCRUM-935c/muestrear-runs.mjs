// SCRUM-935c · muestrea runs de ci.yml día a día y, de cada uno, el job meta-guard: conclusión,
// duración del paso de mutación (de la API de pasos, sin bajar el log) y, para una parte de la
// muestra, el log entero (que va FUERA del árbol: lleva secuencias de escape, A22).
// Uso: node muestrear-runs.mjs <desde AAAA-MM-DD> <hasta AAAA-MM-DD> <runsPorDia> <logsPorDia> <dirLogs> <salida.json>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const REPO = 'lwislg99/cobroflash-backend';
const [desde, hasta, porDiaS, logsS, dirLogs, salida] = process.argv.slice(2);
const porDia = Number(porDiaS);
const logsPorDia = Number(logsS);
const PASO = 'Cada guard cae con la mutación que declara';

const api = (ruta, extra = []) => execFileSync(GH, ['api', ...extra, ruta],
  { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

fs.mkdirSync(dirLogs, { recursive: true });
const filas = [];
let ciegosApi = 0;
for (let d = new Date(desde + 'T00:00:00Z'); d <= new Date(hasta + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
  const dia = d.toISOString().slice(0, 10);
  let runs;
  try {
    runs = JSON.parse(api(`repos/${REPO}/actions/workflows/ci.yml/runs?created=${dia}&status=completed&per_page=100`)).workflow_runs;
  } catch (e) { console.log(`${dia} · CIEGO listando runs: ${e.message.slice(0, 120)}`); ciegosApi++; continue; }
  // repartidos a lo largo del día, no los primeros
  const paso = Math.max(1, Math.floor(runs.length / porDia));
  const elegidos = runs.filter((_, i) => i % paso === 0).slice(0, porDia);
  let logsBajados = 0;
  for (const r of elegidos) {
    let job;
    try {
      job = JSON.parse(api(`repos/${REPO}/actions/runs/${r.id}/jobs?per_page=100`)).jobs
        .find((j) => (j.name || '').includes('meta-guard'));
    } catch (e) { ciegosApi++; continue; }
    const fila = { dia, run: r.id, evento: r.event, rama: r.head_branch, sha: r.head_sha,
      creado: r.created_at, job: job?.id ?? null, conclusion: job?.conclusion ?? 'SIN-JOB' };
    const st = job?.steps?.find((s) => s.name === PASO);
    if (st && st.started_at && st.completed_at) {
      fila.pasoConclusion = st.conclusion;
      fila.pasoSeg = (Date.parse(st.completed_at) - Date.parse(st.started_at)) / 1000;
    }
    if (job && logsBajados < logsPorDia && ['success', 'failure'].includes(job.conclusion)) {
      try {
        const texto = api(`repos/${REPO}/actions/jobs/${job.id}/logs`, ['--allow-escape-sequences']);
        const f = path.join(dirLogs, `${r.id}.txt`);
        fs.writeFileSync(f, texto);
        fila.log = f; fila.logBytes = Buffer.byteLength(texto);
        logsBajados++;
      } catch (e) { fila.log = 'CIEGO'; }
    }
    filas.push(fila);
  }
  console.log(`${dia} · runs del día ${runs.length} · muestreados ${elegidos.length} · logs ${logsBajados}`);
}
fs.writeFileSync(salida, JSON.stringify(filas, null, 1));
console.log(`POBLACIÓN · ${filas.length} runs muestreados · ${filas.filter((f) => f.log && f.log !== 'CIEGO').length} logs · llamadas CIEGAS ${ciegosApi} → ${salida}`);
