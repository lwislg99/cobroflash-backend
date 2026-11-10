// docs/master/evidencias/SCRUM-1527/1527e/jobs-con-reintento.mjs — SCRUM-1527e · la lista de jobs de 1527d, sin morir por un 502
//
//     node docs/master/evidencias/SCRUM-1527/1527e/jobs-con-reintento.mjs <desdeISO> <carpeta>
//     node docs/master/evidencias/SCRUM-1527/s3-reproduce-hoy.mjs <desdeISO> <carpeta> <corteISO> --de-cache
//
// POR QUÉ EXISTE. `s3-reproduce-hoy.mjs` (1527d) hace una consulta a GitHub por ejecución y muere
// con la primera que conteste 5xx, sin escribir nada (medido el 20-oct: HTTP 502 en la ejecución
// 39071288778, tras cientos de consultas buenas). Esto escribe el MISMO `jobs.json`, con los mismos
// campos y el mismo filtro, reintentando cada consulta. El recuento lo sigue haciendo 1527d, sin
// tocarlo, con su `--de-cache`.
//
// LO QUE 1527d NO COMPRUEBA EN MODO CACHÉ, Y ESTO SÍ: que se leyeron TODAS las ejecuciones que
// GitHub declara (`total_count`). Si no, sale 2 y no escribe nada.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [desde, carpeta] = process.argv.slice(2);
if (!desde || !carpeta) { console.error('uso: jobs-con-reintento.mjs <desdeISO> <carpeta>'); process.exit(2); }
mkdirSync(carpeta, { recursive: true });
const GH = process.platform === 'win32' ? 'C:\\Program Files\\GitHub CLI\\gh.exe' : 'gh';
const REPO = 'repos/lwislg99/cobroflash-backend';

let reintentos = 0;
function api(ruta) {
  for (let i = 1; ; i++) {
    try {
      return JSON.parse(execFileSync(GH, ['api', ruta], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }));
    } catch (e) {
      if (i >= 5) throw e;
      reintentos++;
      console.error(`reintento ${i} de ${ruta}: ${String(e.stderr || e.message).trim().split('\n')[0]}`);
      execFileSync(process.execPath, ['-e', `setTimeout(() => {}, ${2000 * i})`]);
    }
  }
}

const runs = [];
let declarado = null;
for (let p = 1; p < 50; p++) {
  const r = api(`${REPO}/actions/workflows/ci.yml/runs?created=%3E%3D${encodeURIComponent(desde)}&per_page=100&page=${p}`);
  declarado = r.total_count;
  runs.push(...r.workflow_runs);
  if (r.workflow_runs.length < 100) break;
}
const unicos = new Set(runs.map((r) => r.id)).size;
if (runs.length !== declarado || unicos !== runs.length) {
  console.error(`CIEGO: leídas ${runs.length} ejecuciones (${unicos} distintas), GitHub declara ${declarado}. No escribo jobs.json.`);
  process.exit(2);
}

// Los mismos campos y el mismo filtro que `s3-reproduce-hoy.mjs` ②.
const jobs = [];
for (const run of runs) {
  const j = api(`${REPO}/actions/runs/${run.id}/jobs?filter=all&per_page=100`);
  for (const job of j.jobs) {
    if (!job.name.startsWith('build + tests')) continue;
    const paso = (job.steps ?? []).find((s) => s.name.startsWith('Tests'));
    const dur = paso?.started_at && paso?.completed_at ? (Date.parse(paso.completed_at) - Date.parse(paso.started_at)) / 1000 : null;
    jobs.push({ job: job.id, run: run.id, evento: run.event, rama: run.head_branch, sha: run.head_sha, creado: run.created_at,
      conclusion: job.conclusion, status: job.status, paso: paso?.conclusion ?? null, dur });
  }
}
writeFileSync(join(carpeta, 'jobs.json'), JSON.stringify(jobs, null, 1));
const sinJob = runs.length - new Set(jobs.map((x) => x.run)).size;
console.log(`ejecuciones: ${runs.length} (GitHub declara ${declarado}) · sin job obligatorio: ${sinJob} · jobs «build + tests» con reintentos: ${jobs.length} · consultas reintentadas: ${reintentos}`);
