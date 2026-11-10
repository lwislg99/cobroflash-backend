// 1498e-recoge.mjs <n runs> <salida.json> — Solo LECTURA. Los últimos <n> runs de ci.yml (id 321298878),
// push y pull_request, y de cada uno el job «meta-guard · los guards caen cuando deben» con sus pasos.
// Cuenta por el NOMBRE EXACTO del job (cicatriz J3 del 7-oct); el control de un nombre inventado da 0.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const [nRuns, salida] = [Number(process.argv[2]), process.argv[3]];
const REPO = 'repos/lwislg99/cobroflash-backend';
const JOB = 'meta-guard · los guards caen cuando deben';
const INVENTADO = 'meta-guard · los guards caen cuando deben (inventado)';
const gh = (q) => JSON.parse(execFileSync('gh', ['api', q], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }));

const runs = [];
for (let p = 1; runs.length < nRuns; p++) {
  const r = gh(`${REPO}/actions/workflows/321298878/runs?per_page=100&page=${p}`);
  if (!r.workflow_runs.length) break;
  runs.push(...r.workflow_runs);
}
const sel = runs.slice(0, nRuns);
const filas = [];
let inventado = 0;
for (const w of sel) {
  const j = gh(`${REPO}/actions/runs/${w.id}/attempts/${w.run_attempt}/jobs?per_page=100`);
  const m = j.jobs.filter((x) => x.name === JOB);
  inventado += j.jobs.filter((x) => x.name === INVENTADO).length;
  const job = m[0];
  filas.push({
    run: w.id, intento: w.run_attempt, evento: w.event, rama: w.head_branch, sha: w.head_sha,
    creado: w.created_at, estadoRun: w.status, finRun: w.conclusion, jobsTotal: j.total_count, metaJobs: m.length,
    job: job ? {
      id: job.id, estado: job.status, fin: job.conclusion, inicio: job.started_at, finHora: job.completed_at,
      pasos: (job.steps || []).map((s) => ({ n: s.number, nombre: s.name, estado: s.status, fin: s.conclusion, inicio: s.started_at, finHora: s.completed_at })),
    } : null,
  });
}
fs.writeFileSync(salida, JSON.stringify({ leido: new Date().toISOString(), nRuns: sel.length, filas }, null, 1));
const conJob = filas.filter((f) => f.job);
const por = {};
for (const f of conJob) { const k = `${f.evento}/${f.job.estado}/${f.job.fin}`; por[k] = (por[k] || 0) + 1; }
console.log(`POBLACION runs=${sel.length} con-job-meta=${conJob.length} sin-job-meta=${filas.length - conJob.length} · control nombre inventado=${inventado} (tiene que ser 0)`);
console.log(`control positivo: runs con exactamente 1 job meta = ${filas.filter((f) => f.metaJobs === 1).length} (tiene que ser > 0)`);
for (const [k, v] of Object.entries(por).sort()) console.log(`  ${k}: ${v}`);
