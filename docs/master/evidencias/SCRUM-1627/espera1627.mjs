// Espera POR RUNNER de cada job (started_at - created_at del JOB), separada de la espera por el GRUPO de
// concurrencia (created_at del job - created_at del run). Pasadas de ci.yml en main y en PR de hoy.
import { execFileSync } from 'node:child_process';
const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const R = 'lwislg99/cobroflash-backend';
const api = (p) => JSON.parse(execFileSync(GH, ['api', p], { encoding: 'utf8', maxBuffer: 64 << 20 }));
const min = (a, b) => ((Date.parse(b) - Date.parse(a)) / 60000);
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
console.log(execFileSync(GH, ['api', '-i', 'zen'], { encoding: 'utf8' }).split(/\r?\n/).find((l) => /^date:/i.test(l)));
const desde = process.argv[2] || '2026-10-27T00:00:00Z';
for (const [t, q] of [['MAIN', 'branch=main&event=push&per_page=60'], ['PR', 'event=pull_request&per_page=60']]) {
  const runs = api(`repos/${R}/actions/workflows/ci.yml/runs?${q}&created=>=${desde}`).workflow_runs;
  const porRunner = []; const porGrupo = []; let conJobs = 0;
  for (const r of runs) {
    const jobs = api(`repos/${R}/actions/runs/${r.id}/jobs?per_page=100&filter=latest`).jobs.filter((j) => j.status === 'completed' && j.started_at && j.created_at); // un job en cola trae started_at = created_at: no vale
    if (!jobs.length) continue;
    conJobs++;
    for (const j of jobs) { porRunner.push(min(j.created_at, j.started_at)); }
    porGrupo.push(min(r.created_at, jobs.map((j) => j.created_at).sort()[0]));
    if (t === 'MAIN') console.log(`${r.head_sha.slice(0, 8)} · run ${r.created_at} · espera de grupo ${porGrupo.at(-1).toFixed(1)} min · espera de runner por job: ${jobs.map((j) => `${j.name.split(' ')[0]} ${min(j.created_at, j.started_at).toFixed(1)}`).join(', ')}`);
  }
  const p = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))].toFixed(1) : '—'; };
  console.log(`${t}: ${runs.length} runs desde ${desde}, ${conJobs} con jobs · espera de RUNNER por job: n=${porRunner.length} p50 ${p(porRunner, 0.5)} p90 ${p(porRunner, 0.9)} máx ${p(porRunner, 1)} min · espera de GRUPO por run: p50 ${p(porGrupo, 0.5)} máx ${p(porGrupo, 1)} min`);
}
