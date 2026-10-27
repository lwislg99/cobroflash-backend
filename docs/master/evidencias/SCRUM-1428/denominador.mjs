// SCRUM-1428 (§26.1 de para-javier.md) · el DENOMINADOR de la tabla: veredicto del obligatorio
// («build + tests») en los mismos 150 últimos runs completados de ci.yml que mira `ci-rojos.mjs`,
// partido en push a `main` y pull request. Sin logs: sólo la conclusión del job.
// Uso: node denominador.mjs   → imprime un JSON {evento/rama: {success, failure, cancelled, otro}}.
// Población: los runs SIN ese job (los que sólo tocan docs, por ejemplo) no cuentan, y se dice.
import { execFileSync } from 'node:child_process';

const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const R = 'lwislg99/cobroflash-backend';
const gh = (a) => JSON.parse(execFileSync(GH, ['api', a], { encoding: 'utf8', maxBuffer: 1 << 28 }));
const runs = [
  ...gh(`repos/${R}/actions/workflows/ci.yml/runs?per_page=100&page=1&status=completed`).workflow_runs,
  ...gh(`repos/${R}/actions/workflows/ci.yml/runs?per_page=100&page=2&status=completed`).workflow_runs,
].slice(0, 150);
const t = {};
let sinJob = 0;
for (const r of runs) {
  const ob = gh(`repos/${R}/actions/runs/${r.id}/jobs?per_page=100`).jobs.find((j) => j.name.startsWith('build + tests'));
  if (!ob) { sinJob++; continue; }
  const k = r.event + '/' + (r.head_branch === 'main' ? 'main' : 'rama');
  t[k] ??= { success: 0, failure: 0, cancelled: 0, otro: 0 };
  t[k][ob.conclusion in t[k] ? ob.conclusion : 'otro']++;
}
console.log(JSON.stringify(t));
console.log(`runs mirados ${runs.length} · sin el job obligatorio ${sinJob} · ventana ${runs.at(-1)?.created_at} → ${runs[0]?.created_at}`);
