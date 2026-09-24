// Censo del job meta-guard en ci.yml desde una fecha. Población declarada en la primera línea.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const GH = process.env.GH || 'gh';
const REPO = 'repos/lwislg99/cobroflash-backend';
const desde = process.argv[2] || '2026-09-17T16:00:00Z';
const salida = process.argv[3];
const gh = (p) => JSON.parse(execFileSync(GH, ['api', p], { encoding: 'utf8', maxBuffer: 64 << 20 }));
const runs = [];
for (let page = 1; ; page++) {
  const r = gh(`${REPO}/actions/workflows/ci.yml/runs?created=>=${desde}&per_page=100&page=${page}`);
  runs.push(...r.workflow_runs);
  if (page === 1) console.log(`POBLACION total_count=${r.total_count} desde=${desde}`);
  if (r.workflow_runs.length < 100) break;
}
const filas = [];
for (const run of runs) {
  const j = gh(`${REPO}/actions/runs/${run.id}/jobs?per_page=100`);
  const mg = j.jobs.filter((x) => x.name.startsWith('meta-guard'));
  const m = mg[0];
  filas.push({
    run: run.id, creado: run.created_at, evento: run.event, rama: run.head_branch, head: run.head_sha,
    run_concl: run.conclusion, run_status: run.status,
    mg_n: mg.length, mg_concl: m ? m.conclusion : null, mg_status: m ? m.status : null,
    mg_job: m ? m.id : null, mg_ini: m ? m.started_at : null, mg_fin: m ? m.completed_at : null,
  });
}
console.log(`TRAIDOS runs=${runs.length}`);
const cuenta = {};
for (const f of filas) { const k = `${f.mg_concl ?? (f.mg_n ? f.mg_status : 'SIN_JOB')}`; cuenta[k] = (cuenta[k] || 0) + 1; }
console.log('meta-guard por conclusion:', JSON.stringify(cuenta));
for (const f of filas.filter((x) => x.mg_concl === 'failure')) console.log('MUDO?', f.run, f.mg_job, f.creado, f.rama, f.head.slice(0, 10));
if (salida) writeFileSync(salida, JSON.stringify(filas, null, 1));
console.log('EXIT=0');
