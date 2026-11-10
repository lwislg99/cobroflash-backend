// Simulación en seco (sólo lectura): el job meta-guard de los últimos runs del CI por push a main.
import { execFileSync } from 'node:child_process';
const R = 'lwislg99/cobroflash-backend';
const gh = (p) => JSON.parse(execFileSync('gh', ['api', p], { encoding: 'utf8', maxBuffer: 64 << 20 }));
const wf = gh(`repos/${R}/actions/workflows?per_page=100`).workflows.find((w) => w.name === 'CI');
const runs = gh(`repos/${R}/actions/workflows/${wf.id}/runs?branch=main&event=push&per_page=${process.argv[2] || 40}`).workflow_runs;
const MG = 'meta-guard · los guards caen cuando deben';
const filas = [];
for (const r of runs) {
  const f = { sha: r.head_sha.slice(0, 12), run: r.id, status: r.status, concl: r.conclusion };
  if (r.status !== 'completed') { f.mg = 'run-sin-acabar'; filas.push(f); continue; }
  const jobs = gh(`repos/${R}/actions/runs/${r.id}/jobs?per_page=100&filter=latest`).jobs;
  f.njobs = jobs.length;
  const j = jobs.find((x) => x.name === MG);
  if (!j) { f.mg = 'ausente'; filas.push(f); continue; }
  f.mg = j.conclusion;
  f.min = Math.round((Date.parse(j.completed_at) - Date.parse(j.started_at)) / 6000) / 10;
  f.pasoCaido = (j.steps || []).filter((s) => s.conclusion === 'failure' || s.conclusion === 'cancelled').map((s) => `${s.name}:${s.conclusion}`).join(' | ');
  if (j.conclusion !== 'success') {
    try {
      const an = gh(`repos/${R}/check-runs/${j.id}/annotations`);
      f.anot = an.filter((a) => a.annotation_level === 'failure').map((a) => a.message).join(' | ');
    } catch (e) { f.anot = 'NO-LEIDA ' + String(e.message).split('\n')[0]; }
  }
  f.otrosRojos = jobs.filter((x) => x.name !== MG && x.conclusion === 'failure').map((x) => x.name).join(', ');
  filas.push(f);
}
for (const f of filas) console.log(JSON.stringify(f));
const cuenta = {};
for (const f of filas) { const k = f.mg + (f.anot ? ' · ' + f.anot : ''); cuenta[k] = (cuenta[k] || 0) + 1; }
console.log('POBLACION runs=' + filas.length);
console.log(JSON.stringify(cuenta, null, 1));
