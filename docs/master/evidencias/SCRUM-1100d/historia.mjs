// Medición S3 6-oct · ¿por qué cae el job «meta-guard», y en qué ficheros?
// Uso: node historia.mjs <dir de salida> <N runs>
// Lee los últimos N runs de ci.yml; de cada uno, el job «meta-guard»; y de los que NO salen
// `success`, baja el log con `gh run view --job --log` (NO con `gh api …/logs`: da cero bytes).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const REPO = 'lwislg99/cobroflash-backend';
const [, , DIR, NTXT] = process.argv;
const N = Number(NTXT || 300);
fs.mkdirSync(path.join(DIR, 'logs'), { recursive: true });
const env = { ...process.env }; delete env.FORCE_COLOR;
const gh = (args, max = 64) => execFileSync(GH, args, { encoding: 'utf8', maxBuffer: max * 1024 * 1024, env });

const runs = JSON.parse(gh(['run', 'list', '--repo', REPO, '--workflow', 'ci.yml', '--limit', String(N),
  '--json', 'databaseId,headSha,createdAt,headBranch,event,conclusion,status']));
console.error(`runs listados: ${runs.length}`);
const filas = [];
let i = 0;
for (const r of runs) {
  i += 1;
  const fila = { id: r.databaseId, creado: r.createdAt, evento: r.event, rama: r.headBranch, sha: r.headSha, run: r.conclusion || r.status };
  let jobs;
  try {
    jobs = JSON.parse(gh(['api', `repos/${REPO}/actions/runs/${r.databaseId}/jobs?per_page=100`])).jobs;
  } catch (e) { fila.meta = 'NO-PUDE-LISTAR-JOBS'; fila.error = String(e.message).slice(0, 200); filas.push(fila); continue; }
  const j = jobs.find((x) => x.name.startsWith('meta-guard'));
  if (!j) { fila.meta = 'SIN-JOB'; filas.push(fila); continue; }
  fila.job = j.id; fila.meta = j.conclusion || j.status;
  fila.paso = (j.steps || []).find((s) => s.conclusion === 'failure')?.name || null;
  fila.inicio = j.started_at; fila.fin = j.completed_at;
  if (fila.meta === 'failure') {
    const f = path.join(DIR, 'logs', `${r.databaseId}.txt`);
    if (!fs.existsSync(f) || fs.statSync(f).size === 0) {
      try { fs.writeFileSync(f, gh(['run', 'view', '--repo', REPO, '--job', String(j.id), '--log'], 256)); }
      catch (e) { fila.log = 'NO-PUDE-BAJAR'; fila.error = String(e.message).slice(0, 200); }
    }
    if (fs.existsSync(f)) fila.bytes = fs.statSync(f).size;
  }
  filas.push(fila);
  if (i % 25 === 0) console.error(`  ${i}/${runs.length}`);
}
fs.writeFileSync(path.join(DIR, 'filas.json'), JSON.stringify(filas, null, 1));
console.log(`POBLACION=${runs.length} FILAS=${filas.length}`);
