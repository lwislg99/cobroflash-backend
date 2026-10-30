// ¿Cuántos JOBS corren a la vez en la cuenta y cuántos esperan runner? Si los que corren se quedan en un techo fijo
// con otros esperando, la espera es el tope de concurrencia de la cuenta, no los grupos de concurrencia.
import { execFileSync } from 'node:child_process';
const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const R = 'lwislg99/cobroflash-backend';
const api = (p) => JSON.parse(execFileSync(GH, ['api', p], { encoding: 'utf8', maxBuffer: 64 << 20 }));
console.log(execFileSync(GH, ['api', '-i', 'zen'], { encoding: 'utf8' }).split(/\r?\n/).find((l) => /^date:/i.test(l)));
const runs = [...api(`repos/${R}/actions/runs?status=in_progress&per_page=100`).workflow_runs, ...api(`repos/${R}/actions/runs?status=queued&per_page=100`).workflow_runs];
let corriendo = 0; let esperando = 0; const det = [];
for (const r of runs) {
  let j; try { j = api(`repos/${R}/actions/runs/${r.id}/jobs?per_page=100&filter=latest`).jobs; } catch { det.push(`${r.name} ${r.id}: jobs SIN LEER`); continue; }
  const c = j.filter((x) => x.status === 'in_progress').length; const q = j.filter((x) => x.status === 'queued' || x.status === 'waiting' || x.status === 'pending').length;
  corriendo += c; esperando += q;
  det.push(`${r.name} · ${r.event} · ${r.head_branch} · run ${r.status} · jobs: ${c} corriendo, ${q} esperando, ${j.length} en total`);
}
console.log(det.join('\n'));
console.log(`\nJOBS CORRIENDO A LA VEZ: ${corriendo} · JOBS ESPERANDO RUNNER: ${esperando} · runs vivos: ${runs.length}`);
