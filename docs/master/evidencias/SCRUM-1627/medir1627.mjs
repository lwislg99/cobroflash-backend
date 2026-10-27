// Mide las pasadas de ci.yml en main (push) y en ramas (pull_request): conclusión, si arrancó, jobs, y quién las sustituyó.
import { execFileSync } from 'node:child_process';
const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const R = 'lwislg99/cobroflash-backend';
const api = (p) => JSON.parse(execFileSync(GH, ['api', p], { encoding: 'utf8', maxBuffer: 64 << 20 }));
const fecha = execFileSync(GH, ['api', '-i', 'zen'], { encoding: 'utf8' }).split(/\r?\n/).find((l) => /^date:/i.test(l));
console.log('HORA GitHub:', fecha);
for (const [titulo, q] of [['MAIN (push)', 'branch=main&event=push&per_page=25'], ['RAMAS (pull_request)', 'event=pull_request&per_page=40']]) {
  const runs = api(`repos/${R}/actions/workflows/ci.yml/runs?${q}`).workflow_runs;
  console.log(`\n== ${titulo}: ${runs.length} pasadas`);
  const cuenta = {};
  for (const r of runs) {
    let jobs = '?';
    try { const j = api(`repos/${R}/actions/runs/${r.id}/jobs?per_page=100&filter=latest`).jobs; jobs = `${j.length} jobs (${j.filter((x) => x.status === 'completed').map((x) => x.conclusion[0]).join('')})`; } catch { jobs = 'jobs SIN LEER'; }
    const clave = `${r.status}/${r.conclusion}`;
    cuenta[clave] = (cuenta[clave] || 0) + 1;
    if (titulo.startsWith('MAIN') || r.conclusion === 'cancelled') console.log(`${r.created_at} → ${r.updated_at} · ${r.id} · ${r.head_sha.slice(0, 8)} · ${clave} · arrancó ${r.run_started_at} · intento ${r.run_attempt} · ${jobs}${titulo.startsWith('RAMAS') ? ` · ${r.head_branch}` : ''}`);
  }
  console.log('recuento:', JSON.stringify(cuenta));
}
const cola = api(`repos/${R}/actions/runs?status=queued&per_page=100`);
const enCurso = api(`repos/${R}/actions/runs?status=in_progress&per_page=100`);
const por = (l) => Object.entries(l.workflow_runs.reduce((a, r) => ((a[r.name] = (a[r.name] || 0) + 1), a), {})).map(([k, v]) => `${v} ${k}`).join(' · ');
console.log(`\nEN COLA ${cola.total_count}: ${por(cola)}`);
console.log(`EN CURSO ${enCurso.total_count}: ${por(enCurso)}`);
