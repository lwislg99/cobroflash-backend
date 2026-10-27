// SCRUM-1527 · baja los jobs y los logs del job obligatorio de cada ejecucion de ci.yml.
// uso: node bajar.mjs <runs.json> <dirSalida>
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, statSync, createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const [runsPath, out] = process.argv.slice(2);
const REPO = 'lwislg99/cobroflash-backend';
const JOB = 'build + tests (con banco desechable)';
const runs = JSON.parse(readFileSync(runsPath, 'utf8')).filter((r) => r.status === 'completed');

const gh = (args) => new Promise((res) => {
  execFile('gh', args, { maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' }, (err, stdout, stderr) => res({ err, stdout, stderr }));
});
const bajarLog = (jobId, destino) => new Promise((res) => {
  const h = spawn('gh', ['api', '--allow-escape-sequences', `repos/${REPO}/actions/jobs/${jobId}/logs`], { stdio: ['ignore', 'pipe', 'pipe'] });
  const w = createWriteStream(destino);
  let errTxt = '';
  h.stdout.pipe(w);
  h.stderr.on('data', (d) => { errTxt += d; });
  h.on('close', (code) => w.end(() => res({ code, errTxt: errTxt.slice(0, 200) })));
});

const filas = [];
let i = 0;
async function obrero() {
  while (i < runs.length) {
    const r = runs[i++];
    const j = await gh(['api', `repos/${REPO}/actions/runs/${r.databaseId}/jobs?per_page=100&filter=all`]);
    if (j.err) { filas.push({ run: r.databaseId, error: 'jobs: ' + String(j.stderr).slice(0, 150) }); continue; }
    const jobs = JSON.parse(j.stdout).jobs.filter((x) => x.name === JOB);
    if (jobs.length === 0) { filas.push({ run: r.databaseId, sinJob: true, runConclusion: r.conclusion, event: r.event }); continue; }
    for (const job of jobs) {
      const fila = {
        run: r.databaseId, job: job.id, attempt: job.run_attempt, event: r.event, branch: r.headBranch, sha: r.headSha,
        runConclusion: r.conclusion, conclusion: job.conclusion, started: job.started_at, completed: job.completed_at,
        pasos: (job.steps || []).filter((s) => s.conclusion && s.conclusion !== 'success' && s.conclusion !== 'skipped').map((s) => `${s.number}:${s.name}=${s.conclusion}`),
      };
      if (job.conclusion === 'skipped') { filas.push(fila); continue; }
      const destino = path.join(out, `${job.id}.log`);
      if (!existsSync(destino) || statSync(destino).size === 0) {
        const b = await bajarLog(job.id, destino);
        fila.bajada = b.code; if (b.code !== 0) fila.bajadaErr = b.errTxt;
      }
      fila.bytes = existsSync(destino) ? statSync(destino).size : -1;
      filas.push(fila);
    }
  }
}
await Promise.all(Array.from({ length: 6 }, obrero));
writeFileSync(path.join(out, '..', 'jobs.json'), JSON.stringify(filas, null, 1));
const n = (f) => filas.filter(f).length;
console.log(`POBLACION runs completadas=${runs.length} filas=${filas.length} sinJob=${n((f) => f.sinJob)} error=${n((f) => f.error)} skipped=${n((f) => f.conclusion === 'skipped')} conLog=${n((f) => f.bytes > 0)} logVacio=${n((f) => f.bytes === 0)} bajadaMal=${n((f) => f.bajada)}`);
