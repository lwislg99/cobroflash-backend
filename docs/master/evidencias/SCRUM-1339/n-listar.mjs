// docs/master/evidencias/SCRUM-1339/n-listar.mjs — SCRUM-1339n · SÓLO LECTURA (API de GitHub).
//
// TODAS las ejecuciones del job del meta-guard desde una hora dada: cada run del workflow CI
// (pull_request y push), y dentro de cada run CADA intento. No sólo la punta de cada PR, que es lo
// que leyó el tramo 1339j.
//
//   node n-listar.mjs <desde, ISO> <salida.json, FUERA del árbol>
//
// La salida tiene la forma de `datos-pr.json` (SCRUM-1393b) para que `j-logs.mjs` la lea SIN
// tocarlo: una entrada de `prs` por (run, intento). `n` es el número del PR; `run`, `evento`, `sha`
// y `base` van al lado para `n-patas.mjs`.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const [desde, salida] = process.argv.slice(2);
if (!desde || !salida) { console.error('uso: node n-listar.mjs <desde ISO> <salida.json>'); process.exit(2); }
const REPO = 'repos/lwislg99/cobroflash-backend';
let llamadas = 0;
const api = (ruta) => { llamadas += 1; return JSON.parse(execFileSync('gh', ['api', ruta], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })); };

// La hora, de GitHub y no del reloj de la máquina (A14).
const cab = execFileSync('gh', ['api', '-i', 'zen'], { encoding: 'utf8' });
const recogido = new Date(/^date: (.*)$/im.exec(cab)[1]).toISOString();

const runs = [];
let declarados = null;
for (let pag = 1; pag < 60; pag += 1) {
  const r = api(`${REPO}/actions/workflows/ci.yml/runs?per_page=100&page=${pag}&created=${encodeURIComponent('>=' + desde)}`);
  declarados ??= r.total_count;
  runs.push(...r.workflow_runs);
  if (r.workflow_runs.length < 100) break;
}
const unicos = new Map(runs.map((r) => [r.id, r]));
console.log(`POBLACIÓN: runs de CI creados desde ${desde}: GitHub declara ${declarados} · traídos ${runs.length} · distintos ${unicos.size} · recogido ${recogido}`);
if (!unicos.size || unicos.size !== declarados) console.log(`⚠️ traídos y declarados NO coinciden (${unicos.size} contra ${declarados}): la lista se movió mientras se paginaba, o falta una página`);

// El número del PR. `pull_requests` del run viene VACÍO en la mayoría (184 de 247 en la primera
// pasada): se cruza por la punta (sha) y, si no, por la rama, contra la lista de PR.
const porSha = new Map(); const porRama = new Map();
for (let pag = 1; pag <= 8; pag += 1) {
  const x = api(`${REPO}/pulls?state=all&sort=created&direction=desc&per_page=100&page=${pag}`);
  for (const p of x) { porSha.set(p.head.sha, p.number); if (!porRama.has(p.head.ref)) porRama.set(p.head.ref, p.number); }
  if (x.length < 100 || x.at(-1).created_at < '2026-09-20') break;
}
const prs = [];
const sinJob = [];
for (const r of [...unicos.values()].sort((a, b) => a.id - b.id)) {
  const n = r.pull_requests?.[0]?.number ?? (r.event === 'push'
    ? Number(/Merge pull request #(\d+)/.exec(r.head_commit?.message || '')?.[1] ?? 0)
    : porSha.get(r.head_sha) ?? porRama.get(r.head_branch) ?? 0);
  const js = [];
  for (let pag = 1; pag < 10; pag += 1) {
    const x = api(`${REPO}/actions/runs/${r.id}/jobs?filter=all&per_page=100&page=${pag}`);
    js.push(...x.jobs);
    if (x.jobs.length < 100) break;
  }
  const meta = js.filter((j) => /^meta-guard/.test(j.name));
  if (!meta.length) sinJob.push(`${r.id} (${r.event}, ${r.status}/${r.conclusion})`);
  for (const j of meta) {
    prs.push({
      n, run: r.id, evento: r.event, rama: r.head_branch, sha: r.head_sha, mergeado: null,
      runs: [{
        id: r.id, intento: j.run_attempt, creado: r.created_at, estado: r.status, fin: r.conclusion,
        jobs: [{ id: j.id, nombre: j.name, intento: j.run_attempt, estado: j.status, fin: j.conclusion ?? `(${j.status})`, empezo: j.started_at, acabo: j.completed_at }],
      }],
    });
  }
}
const por = (a, k) => a.reduce((o, x) => { const v = k(x); o[v] = (o[v] || 0) + 1; return o; }, {});
console.log(`JOBS «meta-guard»: ${prs.length} ejecuciones en ${new Set(prs.map((p) => p.run)).size} runs · runs sin ese job: ${sinJob.length}${sinJob.length ? ' → ' + sinJob.join(' · ') : ''}`);
console.log(`  por evento: ${JSON.stringify(por(prs, (p) => p.evento))} · por conclusión de GitHub: ${JSON.stringify(por(prs, (p) => p.runs[0].jobs[0].fin))} · por intento: ${JSON.stringify(por(prs, (p) => p.runs[0].intento))} · sin número de PR: ${prs.filter((p) => !p.n).length}`);
fs.writeFileSync(salida, JSON.stringify({ recogido, desde, hasta: recogido, runsDeclarados: declarados, llamadas, prs }, null, 1));
console.log(`escrito ${salida} · ${llamadas} llamadas a la API`);
console.log('EXIT=0');
