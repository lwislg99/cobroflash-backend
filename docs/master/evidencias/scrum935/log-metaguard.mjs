// Baja el log del job meta-guard de un run y lo guarda. SCRUM-935.
// Uso: node log-metaguard.mjs <runId> <ficheroSalida>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const REPO = 'lwislg99/cobroflash-backend';
const run = process.argv[2];
const salida = process.argv[3];

const jobs = JSON.parse(execFileSync(GH, ['api', `repos/${REPO}/actions/runs/${run}/jobs?per_page=100`],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
const job = jobs.jobs.find((j) => (j.name || '').includes('meta-guard'));
if (!job) { console.log('CIEGO · ese run no tiene job meta-guard'); console.log('EXIT=2'); process.exit(2); }

let texto;
try {
  texto = execFileSync(GH, ['api', '--allow-escape-sequences', `repos/${REPO}/actions/jobs/${job.id}/logs`],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
} catch (e) {
  console.log('CIEGO · no pude bajar el log: ' + (e.stderr || e.message));
  console.log('EXIT=2'); process.exit(2);
}
fs.writeFileSync(salida, texto);
const lineas = texto.split(/\r?\n/);
console.log(`run ${run} · job ${job.id} · ${job.conclusion} · líneas de log: ${lineas.length} · bytes ${texto.length}`);
console.log('EXIT=0');
