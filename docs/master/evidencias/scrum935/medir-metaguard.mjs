// Mide la DURACIÓN del job «meta-guard · los guards caen cuando deben» en varias pasadas reales
// de GitHub Actions. SCRUM-935. Declara POBLACIÓN y EXIT (A3/A21).
//
// Uso: node medir-metaguard.mjs <limite-de-runs> <fichero-salida.json>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const REPO = 'lwislg99/cobroflash-backend';
const JOB = 'meta-guard';

const limite = Number(process.argv[2] || 100);
const salida = process.argv[3] || 'metaguard.json';

function gh(args) {
  return execFileSync(GH, args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
}

let runs;
try {
  runs = JSON.parse(gh([
    'run', 'list', '--repo', REPO, '--workflow', 'ci.yml', '--limit', String(limite),
    '--json', 'databaseId,conclusion,status,headBranch,event,createdAt,updatedAt,displayTitle',
  ]));
} catch (e) {
  console.log('CIEGO · no pude listar los runs: ' + e.message);
  console.log('EXIT=2');
  process.exit(2);
}

console.log(`POBLACIÓN · runs pedidos=${limite} · recibidos=${runs.length}`);

const filas = [];
let ciegos = 0;
for (const r of runs) {
  let datos;
  try {
    datos = JSON.parse(gh(['api', '-H', 'Accept: application/vnd.github+json',
      `repos/${REPO}/actions/runs/${r.databaseId}/jobs?per_page=100`]));
  } catch (e) {
    ciegos++;
    filas.push({ run: r.databaseId, rama: r.headBranch, ciego: 'no pude mirar los jobs' });
    continue;
  }
  const job = (datos.jobs || []).find((j) => (j.name || '').includes(JOB));
  if (!job) {
    filas.push({ run: r.databaseId, rama: r.headBranch, ciego: 'sin job meta-guard' });
    continue;
  }
  const ini = job.started_at ? Date.parse(job.started_at) : null;
  const fin = job.completed_at ? Date.parse(job.completed_at) : null;
  const pasos = (job.steps || []).map((s) => ({
    n: s.name,
    seg: s.started_at && s.completed_at
      ? Math.round((Date.parse(s.completed_at) - Date.parse(s.started_at)) / 1000)
      : null,
    concl: s.conclusion,
  }));
  filas.push({
    run: r.databaseId,
    rama: r.headBranch,
    evento: r.event,
    creado: r.createdAt,
    runConcl: r.conclusion,
    jobId: job.id,
    jobConcl: job.conclusion,
    jobStatus: job.status,
    seg: ini != null && fin != null ? Math.round((fin - ini) / 1000) : null,
    pasos,
  });
}

fs.writeFileSync(salida, JSON.stringify({ medido: new Date().toISOString(), repo: REPO, limite, runs: runs.length, filas }, null, 1));

const conJob = filas.filter((f) => f.seg != null);
const ok = conJob.filter((f) => f.jobConcl === 'success');
const cancel = conJob.filter((f) => f.jobConcl === 'cancelled');
const fail = conJob.filter((f) => f.jobConcl === 'failure');
const otros = conJob.filter((f) => !['success', 'cancelled', 'failure'].includes(f.jobConcl));

const fmt = (s) => `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s (${s} s)`;
function resumen(nombre, arr) {
  if (!arr.length) { console.log(`  ${nombre}: 0`); return; }
  const v = arr.map((f) => f.seg).sort((a, b) => a - b);
  const med = v[Math.floor(v.length / 2)];
  const sum = v.reduce((a, b) => a + b, 0);
  console.log(`  ${nombre}: n=${v.length} · mín ${fmt(v[0])} · mediana ${fmt(med)} · media ${fmt(Math.round(sum / v.length))} · máx ${fmt(v[v.length - 1])}`);
}

console.log(`FILAS con job meta-guard y duración medible: ${conJob.length} de ${filas.length} · ciegos ${ciegos} · sin job ${filas.filter((f) => f.ciego === 'sin job meta-guard').length}`);
console.log('DURACIÓN DEL JOB por conclusión:');
resumen('success  (duración REAL, sin censurar)', ok);
resumen('cancelled(censurada: tocó el techo o la cancelación)', cancel);
resumen('failure', fail);
resumen('otros', otros);

if (ok.length) {
  console.log('\nTodas las pasadas EN VERDE, de más lenta a más rápida:');
  for (const f of [...ok].sort((a, b) => b.seg - a.seg)) {
    console.log(`  ${fmt(f.seg).padEnd(24)} run ${f.run} · ${f.evento} · ${f.rama} · ${f.creado}`);
  }
  const lento = [...ok].sort((a, b) => b.seg - a.seg)[0];
  console.log(`\nPasos de la pasada verde MÁS LENTA (run ${lento.run}):`);
  for (const p of lento.pasos) console.log(`  ${String(p.seg).padStart(5)} s  ${p.concl}  ${p.n}`);
}

if (cancel.length) {
  const v = cancel.map((f) => f.seg).sort((a, b) => a - b);
  const enElTecho = cancel.filter((f) => f.seg >= 600).length;
  console.log(`\nCancelados: ${cancel.length} · de ellos ${enElTecho} duraron ≥ 600 s (el techo de timeout-minutes: 10).`);
  console.log(`  rango: ${fmt(v[0])} … ${fmt(v[v.length - 1])}`);
}

console.log('EXIT=0');
