// par.mjs <push.json> — el par de control: el ultimo run cancelado sin jobs y el run CON jobs que corria cuando nacio.
// Imprime lo que la API dice de cada uno, campo a campo. Solo lectura.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const { runs } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const t = (s) => Date.parse(s);
runs.sort((a, b) => t(a.creado) - t(b.creado));
const i = process.argv[3] ? runs.findIndex((r) => String(r.id) === process.argv[3]) : runs.findLastIndex((r) => r.fin === 'cancelled' && r.jobs === 0);
const X = runs[i];
const Z = runs.slice(0, i).reverse().find((z) => z.jobs > 0 && t(z.tocado) > t(X.creado));
const Y = runs[i + 1];
const gh = (a) => execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const R = 'repos/lwislg99/cobroflash-backend';
const campos = ['id', 'run_number', 'head_sha', 'event', 'status', 'conclusion', 'created_at', 'run_started_at', 'updated_at', 'run_attempt', 'actor.login', 'triggering_actor.login'];
const saca = (o, c) => c.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
const filas = {};
for (const [rol, r] of [['Z corria (con jobs)', Z], ['X cancelado sin jobs', X], ['Y el push siguiente', Y]]) {
  const run = JSON.parse(gh(['api', `${R}/actions/runs/${r.id}`]));
  const jobs = JSON.parse(gh(['api', `${R}/actions/runs/${r.id}/jobs?per_page=100`]));
  let anot = 'n/d';
  try {
    const cr = JSON.parse(gh(['api', `${R}/check-suites/${run.check_suite_id}/check-runs?per_page=100`]));
    anot = `check-runs=${cr.total_count} anotaciones=${cr.check_runs.reduce((s, c) => s + c.output.annotations_count, 0)}`;
  } catch (e) { anot = 'ERROR ' + String(e.message).slice(0, 80); }
  let tiempo = 'n/d';
  try { tiempo = JSON.stringify(JSON.parse(gh(['api', `${R}/actions/runs/${r.id}/timing`]))); } catch (e) { tiempo = 'ERROR'; }
  filas[rol] = { ...Object.fromEntries(campos.map((c) => [c, saca(run, c)])), 'jobs.total_count': jobs.total_count, 'jobs': jobs.jobs.map((j) => `${j.name}=${j.conclusion}`).join(' | ').slice(0, 300), 'check-suite': anot, timing: tiempo };
}
for (const c of [...campos, 'jobs.total_count', 'jobs', 'check-suite', 'timing']) {
  console.log(`\n${c}`);
  for (const rol of Object.keys(filas)) console.log(`   ${rol.padEnd(22)} ${filas[rol][c]}`);
}
