// SCRUM-1498c · ¿en qué % de los commits de primer padre de main hay veredicto de `build + tests`?
// Dos sondas independientes:
//   A · Actions: runs de ci.yml (event=push, branch=main) por head_sha → jobs → el job obligatorio.
//   B · Checks: commits/{sha}/check-runs?check_name=<nombre exacto>.
// Uso: node mide-veredicto.mjs <desdeISO> <hastaISO> <salida.json>   (cwd = un árbol con origin/main)
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const REPO = 'lwislg99/cobroflash-backend';
const OBLIG = 'build + tests (con banco desechable)';
const [desde, hasta, salida] = process.argv.slice(2);
if (!desde || !hasta || !salida) { console.error('uso: desde hasta salida'); process.exit(2); }

const gh = (ruta) => JSON.parse(execFileSync(GH, ['api', ruta], { encoding: 'utf8', maxBuffer: 1 << 28 }));

const commits = execFileSync('git', ['log', 'origin/main', '--first-parent', `--since=${desde}`, `--until=${hasta}`, '--format=%H %cI'], { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean).map((l) => { const [sha, fecha] = l.split(' '); return { sha, fecha }; });

// A · runs de push a main en la ventana (más un margen hacia atrás por si el run nace antes del cI).
const runs = [];
for (let page = 1; ; page++) {
  const r = gh(`/repos/${REPO}/actions/workflows/ci.yml/runs?event=push&branch=main&per_page=100&page=${page}&created=${desde.slice(0, 10)}..${hasta.slice(0, 10)}T23:59:59Z`);
  runs.push(...r.workflow_runs);
  if (r.workflow_runs.length < 100) break;
}
const porSha = new Map();
for (const r of runs) { if (!porSha.has(r.head_sha)) porSha.set(r.head_sha, []); porSha.get(r.head_sha).push(r); }

const filas = [];
for (const c of commits) {
  const rs = porSha.get(c.sha) || [];
  const fila = { ...c, runs: rs.map((r) => ({ id: r.id, status: r.status, conclusion: r.conclusion, created: r.created_at, updated: r.updated_at, attempt: r.run_attempt })), jobA: null, nJobs: null, checkB: null };
  for (const r of rs) {
    const j = gh(`/repos/${REPO}/actions/runs/${r.id}/jobs?per_page=100&filter=all`);
    fila.nJobs = (fila.nJobs || 0) + j.total_count;
    const o = j.jobs.find((x) => x.name === OBLIG);
    if (o) fila.jobA = { status: o.status, conclusion: o.conclusion, started: o.started_at, completed: o.completed_at };
    fila.jobsLargos = j.jobs.map((x) => ({ name: x.name, conclusion: x.conclusion, started: x.started_at, completed: x.completed_at }));
  }
  const cr = gh(`/repos/${REPO}/commits/${c.sha}/check-runs?check_name=${encodeURIComponent(OBLIG)}&filter=all&per_page=100`);
  fila.checkB = cr.check_runs.map((x) => ({ conclusion: x.conclusion, status: x.status, event: x.app?.slug, completed: x.completed_at }));
  filas.push(fila);
  process.stderr.write('.');
}
writeFileSync(salida, JSON.stringify({ desde, hasta, nCommits: commits.length, nRuns: runs.length, filas }, null, 1));
console.error(`\n${commits.length} commits · ${runs.length} runs → ${salida}`);
