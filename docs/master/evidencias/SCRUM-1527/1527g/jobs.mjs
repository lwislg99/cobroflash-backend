// docs/master/evidencias/SCRUM-1527/1527g/jobs.mjs — SCRUM-1527g · la lista de jobs obligatorios
// Construye jobs.json con el MISMO esquema que s3-reproduce-hoy.mjs (§②), más la hora de inicio y
// fin del job, con 16 consultas a la vez (la de la casa va de una en una: 636 ejecuciones no caben
// en un comando). Luego se corre recuento.mjs, y s3-reproduce-hoy.mjs --de-cache para los logs.
//   node docs/master/evidencias/SCRUM-1527/1527g/jobs.mjs <desdeISO> <carpeta> [limiteRuns]
// Sale 2 si alguna consulta falla o la lista de ejecuciones no cuadra con la que declara GitHub.
import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
const ex = promisify(execFile);
const [desde, carpeta, lim] = process.argv.slice(2);
mkdirSync(carpeta, { recursive: true });
const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const REPO = 'repos/lwislg99/cobroflash-backend';
const api = async (r) => JSON.parse((await ex(GH, ['api', r], { maxBuffer: 256 * 1024 * 1024 })).stdout);
const runs = [];
let total = null;
for (let p = 1; p < 50; p++) {
  const r = await api(`${REPO}/actions/workflows/ci.yml/runs?created=%3E%3D${encodeURIComponent(desde)}&per_page=100&page=${p}`);
  total = r.total_count; runs.push(...r.workflow_runs);
  if (r.workflow_runs.length < 100) break;
}
const lista = lim ? runs.slice(0, Number(lim)) : runs;
const jobs = []; const fallos = [];
let i = 0;
async function trabajador() {
  while (i < lista.length) {
    const run = lista[i++];
    try {
      const j = await api(`${REPO}/actions/runs/${run.id}/jobs?filter=all&per_page=100`);
      for (const job of j.jobs) {
        if (!job.name.startsWith('build + tests')) continue;
        const paso = (job.steps ?? []).find((s) => s.name.startsWith('Tests'));
        const dur = paso?.started_at && paso?.completed_at ? (Date.parse(paso.completed_at) - Date.parse(paso.started_at)) / 1000 : null;
        jobs.push({ job: job.id, run: run.id, evento: run.event, rama: run.head_branch, sha: run.head_sha, creado: run.created_at,
          conclusion: job.conclusion, status: job.status, paso: paso?.conclusion ?? null, dur,
          jobInicio: job.started_at, jobFin: job.completed_at });
      }
    } catch (e) { fallos.push(`run ${run.id}: ${String(e).slice(0, 100)}`); }
  }
}
await Promise.all(Array.from({ length: 16 }, trabajador));
writeFileSync(join(carpeta, 'jobs.json'), JSON.stringify(jobs, null, 1));
console.log(`runs declarados ${total} · leídos ${runs.length} · consultados ${lista.length} · jobs obligatorios ${jobs.length} · fallos ${fallos.length}`);
for (const f of fallos) console.log('  ' + f);
process.exitCode = fallos.length || runs.length !== total ? 2 : 0;
