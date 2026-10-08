// recoge-pr.mjs <desde ISO> <hasta ISO> <salida.json>
// Solo LECTURA. Los PR con base `main` cuyo `merged_at` cae en [desde, hasta), y de la punta de cada uno:
//   · sus corridas de Actions (cualquier workflow, cualquier evento) por `head_sha`,
//   · los jobs de cada corrida (`filter=all`: todos los intentos), con sus pasos,
//   · sus check-runs por la otra puerta (`commits/<sha>/check-runs`): es la segunda sonda,
//   · los comentarios del PR (autor, hora y arranque del texto).
// La hora de la recogida se copia de la cabecera `Date:` de GitHub, no del reloj de la maquina.
import { execFile } from 'node:child_process';
import fs from 'node:fs';

const [desde, hasta, salida] = process.argv.slice(2);
if (!desde || !hasta || !salida) { console.error('uso: recoge-pr.mjs <desde ISO> <hasta ISO> <salida.json>'); process.exit(2); }
const REPO = 'repos/lwislg99/cobroflash-backend';
let llamadas = 0;
const gh = (args) => new Promise((ok, mal) => {
  llamadas++;
  execFile('gh', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 }, (e, out, err) => (e ? mal(new Error(`${args.join(' ')} :: ${err}`)) : ok(out)));
});
const api = async (ruta) => JSON.parse(await gh(['api', ruta]));
// Pagina hasta agotar; `campo` es la lista dentro de la respuesta (o null si la respuesta ES la lista).
const todo = async (ruta, campo) => {
  const sal = [];
  let total = null;
  for (let p = 1; p <= 20; p++) {
    const r = await api(`${ruta}${ruta.includes('?') ? '&' : '?'}per_page=100&page=${p}`);
    const lista = campo ? r[campo] : r;
    if (campo) total = r.total_count;
    sal.push(...lista);
    if (lista.length < 100) break;
  }
  return { lista: sal, total: total ?? sal.length };
};
const enTandas = async (cosas, n, f) => {
  const sal = new Array(cosas.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < cosas.length) { const k = i++; sal[k] = await f(cosas[k], k); } }));
  return sal;
};

const cab = await gh(['api', '-i', `${REPO}`, '--jq', '.id']);
const fecha = new Date(/^date:\s*(.+)$/im.exec(cab)[1]).toISOString();

// 1 · Los PR cerrados con base main, del mas recientemente tocado hacia atras, hasta pasar `desde`.
const prs = [];
let cerradosVistos = 0;
for (let p = 1; p <= 30; p++) {
  const r = await api(`${REPO}/pulls?state=closed&base=main&sort=updated&direction=desc&per_page=100&page=${p}`);
  cerradosVistos += r.length;
  for (const x of r) {
    if (x.merged_at && x.merged_at >= desde && x.merged_at < hasta) {
      prs.push({ n: x.number, titulo: x.title, rama: x.head.ref, sha: x.head.sha, merge: x.merge_commit_sha, mergeado: x.merged_at, creado: x.created_at, autor: x.user?.login });
    }
  }
  if (r.length < 100 || r[r.length - 1].updated_at < desde) break;
}
prs.sort((a, b) => a.n - b.n);
process.stderr.write(`PR en la ventana: ${prs.length} (cerrados recorridos: ${cerradosVistos})\n`);

// 2 · Por PR: corridas de su punta, jobs de cada corrida, check-runs de su punta, comentarios.
await enTandas(prs, 6, async (pr, k) => {
  const runs = await todo(`${REPO}/actions/runs?head_sha=${pr.sha}`, 'workflow_runs');
  pr.runsTotal = runs.total;
  pr.runs = await enTandas(runs.lista, 3, async (w) => {
    const j = await todo(`${REPO}/actions/runs/${w.id}/jobs?filter=all`, 'jobs');
    return {
      id: w.id, workflow: w.name, fichero: w.path, evento: w.event, rama: w.head_branch, intento: w.run_attempt,
      estado: w.status, fin: w.conclusion, creado: w.created_at, tocado: w.updated_at,
      prs: (w.pull_requests || []).map((x) => x.number),
      jobsTotal: j.total,
      jobs: j.lista.map((x) => ({
        id: x.id, nombre: x.name, intento: x.run_attempt, estado: x.status, fin: x.conclusion,
        empezo: x.started_at, acabo: x.completed_at,
        pasos: (x.steps || []).map((s) => ({ nombre: s.name, fin: s.conclusion, estado: s.status })),
      })),
    };
  });
  const cr = await todo(`${REPO}/commits/${pr.sha}/check-runs?filter=all`, 'check_runs');
  pr.checkRunsTotal = cr.total;
  pr.checkRuns = cr.lista.map((c) => ({ id: c.id, nombre: c.name, estado: c.status, fin: c.conclusion, empezo: c.started_at, acabo: c.completed_at, app: c.app?.slug }));
  const com = await todo(`${REPO}/issues/${pr.n}/comments`, null);
  pr.comentarios = com.lista.map((c) => ({ autor: c.user?.login, creado: c.created_at, texto: (c.body || '').slice(0, 400) }));
  if ((k + 1) % 20 === 0) process.stderr.write(`  ${k + 1}/${prs.length}\n`);
});

fs.writeFileSync(salida, JSON.stringify({ recogido: fecha, desde, hasta, cerradosVistos, llamadas, prs }, null, 1));
const truncados = prs.filter((p) => p.runs.length < p.runsTotal || p.checkRuns.length < p.checkRunsTotal || p.runs.some((r) => r.jobs.length < r.jobsTotal)).length;
console.log(`POBLACION recogido=${fecha} PR=${prs.length} corridas=${prs.reduce((a, p) => a + p.runs.length, 0)} jobs=${prs.reduce((a, p) => a + p.runs.reduce((b, r) => b + r.jobs.length, 0), 0)} check-runs=${prs.reduce((a, p) => a + p.checkRuns.length, 0)} truncados=${truncados} llamadas=${llamadas}`);
