// Barrido: ¿qué dijo la señal de nombres en los obligatorios recientes? (SCRUM-1339t)
// uso: node barrido.mjs <runs.json> <max> [soloRunId]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const GH = 'C:/Program Files/GitHub CLI/gh.exe';
const REPO = 'repos/lwislg99/cobroflash-backend';
const [, , rutaRuns, maxS, solo] = process.argv;
const runs = JSON.parse(fs.readFileSync(rutaRuns, 'utf8')).filter((r) => r.status === 'completed' && (!solo || String(r.databaseId) === solo));
const gh = (args, max = 64 << 20) => execFileSync(GH, args, { encoding: 'utf8', maxBuffer: max });
const filas = [];
for (const r of runs.slice(0, Number(maxS))) {
  let jobs;
  try { jobs = JSON.parse(gh(['api', `${REPO}/actions/runs/${r.databaseId}/jobs?per_page=100`])).jobs; } catch (e) { filas.push({ run: r.databaseId, estado: 'CIEGO-jobs' }); continue; }
  const j = jobs.find((x) => x.name.startsWith('build + tests'));
  if (!j) { filas.push({ run: r.databaseId, estado: 'sin-job' }); continue; }
  if (j.conclusion !== 'success' && j.conclusion !== 'failure') { filas.push({ run: r.databaseId, job: j.id, estado: `CIEGO-${j.conclusion}` }); continue; }
  let log;
  try { log = gh(['api', '--allow-escape-sequences', `${REPO}/actions/jobs/${j.id}/logs`]); } catch (e) { filas.push({ run: r.databaseId, job: j.id, estado: 'CIEGO-log' }); continue; }
  const lineas = log.split('\n').filter((l) => l.includes('[señal de nombres v1]') && !l.includes('::notice'));
  const notice = log.split('\n').filter((l) => l.includes('::notice title=señal de nombres'));
  const m = (lineas[0] || '').match(/medible=(\S+) ausentes=(\S+)/);
  filas.push({ run: r.databaseId, job: j.id, sha: r.headSha.slice(0, 9), ev: r.event, rama: r.headBranch, concl: j.conclusion, bytes: log.length,
    lineas: lineas.length, notices: notice.length, medible: m ? m[1] : null, ausentes: m ? m[2] : null,
    nopude: log.includes('NO PUDE MEDIR') });
}
for (const f of filas) console.log(JSON.stringify(f));
const medidos = filas.filter((f) => f.medible === 'si');
console.log(`POBLACION runs=${filas.length} medidos=${medidos.length} con_ausentes>0=${medidos.filter((f) => Number(f.ausentes) > 0).length} sin_linea=${filas.filter((f) => f.lineas === 0).length} ciegos=${filas.filter((f) => String(f.estado || '').startsWith('CIEGO')).length}`);
