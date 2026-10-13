// a-bajar.mjs <desde ISO> <dir> — SOLO LECTURA. Baja: runs de ci.yml (push a main) y de
// vigia-despliegue.yml desde <desde>, sus jobs del vigia, y el log de cada job del vigia.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [desde, dir] = process.argv.slice(2);
const R = 'lwislg99/cobroflash-backend';
fs.mkdirSync(path.join(dir, 'logs'), { recursive: true });
const gh = (args, enc = 'utf8') => execFileSync('gh', args, { encoding: enc, maxBuffer: 512 * 1024 * 1024 });
const api = (ruta) => JSON.parse(gh(['api', ruta]));

function runsDe(workflow, extra) {
  const todos = [];
  for (let p = 1; p < 30; p++) {
    const r = api(`repos/${R}/actions/workflows/${workflow}/runs?per_page=100&page=${p}&created=%3E%3D${desde}${extra}`);
    todos.push(...r.workflow_runs);
    if (p === 1) console.log(`  ${workflow}: declarados=${r.total_count}`);
    if (r.workflow_runs.length < 100) break;
  }
  console.log(`  ${workflow}: traidos=${todos.length}`);
  return todos;
}

const salida = [];
for (const [wf, extra, clase] of [['ci.yml', '&event=push&branch=main', 'ci'], ['vigia-despliegue.yml', '', 'programado']]) {
  const runs = runsDe(wf, extra);
  for (const run of runs) {
    let jobs;
    try { jobs = api(`repos/${R}/actions/runs/${run.id}/jobs?per_page=100&filter=all`).jobs; }
    catch (e) { salida.push({ clase, run: run.id, creado: run.created_at, error: 'jobs' }); continue; }
    const vig = jobs.filter((j) => /vig[ií]a/i.test(j.name) && /despliegue|^vigia$/i.test(j.name));
    if (!vig.length) {
      salida.push({ clase, run: run.id, creado: run.created_at, evento: run.event, sha: run.head_sha, runConcl: run.conclusion, runStatus: run.status, nJobs: jobs.length, job: null });
      continue;
    }
    for (const j of vig) {
      const f = path.join(dir, 'logs', `${j.id}.log`);
      let bytes = -1;
      if (j.status === 'completed' && j.conclusion !== 'cancelled' && j.conclusion !== 'skipped') {
        if (!fs.existsSync(f)) {
          try { fs.writeFileSync(f, gh(['api', `repos/${R}/actions/jobs/${j.id}/logs`, '--allow-escape-sequences'], 'buffer')); }
          catch (e) { /* sin log */ }
        }
        if (fs.existsSync(f)) bytes = fs.statSync(f).size;
      }
      salida.push({
        clase, run: run.id, intento: j.run_attempt, creado: run.created_at, evento: run.event, sha: run.head_sha,
        runConcl: run.conclusion, runStatus: run.status, nJobs: jobs.length,
        job: j.id, nombre: j.name, estado: j.status, concl: j.conclusion, inicio: j.started_at, fin: j.completed_at,
        pasos: (j.steps || []).map((s) => ({ n: s.number, nombre: s.name, concl: s.conclusion, t0: s.started_at })),
        bytes,
      });
    }
  }
}
fs.writeFileSync(path.join(dir, 'jobs.json'), JSON.stringify(salida, null, 1));
const con = salida.filter((x) => x.job);
console.log(`POBLACION filas=${salida.length} con-job-vigia=${con.length} sin-job=${salida.length - con.length} con-log=${con.filter((x) => x.bytes > 0).length} log<1000B=${con.filter((x) => x.bytes >= 0 && x.bytes < 1000).length}`);
