// recoge.mjs <evento> <desde YYYY-MM-DD> <hasta YYYY-MM-DD> <salida.json>
// Solo LECTURA. Runs de ci.yml (id 321298878) por dia de creacion, y el numero de jobs de cada uno
// por GraphQL (checkSuite.checkRuns.totalCount), en lotes de 100.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const [evento, desde, hasta, salida] = process.argv.slice(2);
const REPO = 'repos/lwislg99/cobroflash-backend';
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

const dias = [];
for (let d = new Date(desde + 'T00:00:00Z'); d <= new Date(hasta + 'T00:00:00Z'); d = new Date(d.getTime() + 86400000)) {
  dias.push(d.toISOString().slice(0, 10));
}

const runs = [];
const porDia = [];
for (const dia of dias) {
  let pagina = 1;
  let total = null;
  let vistos = 0;
  for (;;) {
    const q = `${REPO}/actions/workflows/321298878/runs?event=${evento}&created=${dia}&per_page=100&page=${pagina}` +
      (evento === 'push' ? '&branch=main' : '');
    const r = JSON.parse(gh(['api', q]));
    total = r.total_count;
    for (const w of r.workflow_runs) {
      runs.push({
        id: w.id, n: w.run_number, intento: w.run_attempt, sha: w.head_sha, rama: w.head_branch,
        evento: w.event, estado: w.status, fin: w.conclusion,
        creado: w.created_at, arrancado: w.run_started_at, tocado: w.updated_at,
        actor: w.actor?.login, disparador: w.triggering_actor?.login,
        suite: w.check_suite_node_id, pr: (w.pull_requests || []).map((p) => p.number).join(','),
      });
    }
    vistos += r.workflow_runs.length;
    if (r.workflow_runs.length < 100 || vistos >= total) break;
    pagina++;
    if (pagina > 10) break;
  }
  porDia.push({ dia, total, vistos });
  process.stderr.write(`${dia} total=${total} vistos=${vistos}\n`);
}

// Jobs por check suite, GraphQL en lotes de 100.
const ids = runs.map((r) => r.suite).filter(Boolean);
const jobs = new Map();
for (let i = 0; i < ids.length; i += 100) {
  const lote = ids.slice(i, i + 100);
  const consulta = `query($ids:[ID!]!){nodes(ids:$ids){... on CheckSuite{id status conclusion checkRuns(first:1){totalCount}}}}`;
  const args = ['api', 'graphql', '-f', `query=${consulta}`];
  for (const id of lote) args.push('-f', `ids[]=${id}`);
  const r = JSON.parse(gh(args));
  for (const nodo of r.data.nodes) if (nodo) jobs.set(nodo.id, nodo.checkRuns.totalCount);
}
let sinDato = 0;
for (const r of runs) {
  r.jobs = jobs.has(r.suite) ? jobs.get(r.suite) : null;
  if (r.jobs === null) sinDato++;
}
fs.writeFileSync(salida, JSON.stringify({ evento, desde, hasta, porDia, runs }, null, 1));
const truncados = porDia.filter((d) => d.vistos < d.total);
console.log(`POBLACION runs=${runs.length} dias=${dias.length} sin-dato-de-jobs=${sinDato} dias-truncados=${truncados.length}`);
