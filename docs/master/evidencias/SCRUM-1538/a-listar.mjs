#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1538/a-listar.mjs — SCRUM-1538 · SÓLO LECTURA (gh api, GET).
//
// Trae la POBLACIÓN del censo: los commits de `main` (primer padre) de una ventana DECLARADA, todos
// los runs de Actions cuya rama es `main` creados en esa ventana, y de cada run TODOS sus jobs en
// TODOS sus intentos (`filter=all`: un reintento no borra al intento anterior).
//
//   node a-listar.mjs <carpeta de salida, FUERA del árbol> <desde ISO con Z> <hasta ISO con Z>
//
// Dos caminos para los runs, a propósito (A3: dos sondas independientes):
//   ① el listado `actions/runs?branch=main&created=…`, troceado POR DÍA (el listado filtrado se corta
//      en 1.000 resultados sin avisar);
//   ② por IDENTIDAD: `actions/runs?head_sha=<sha>` de cada commit de `main` de la ventana.
// Lo que salga en ② con rama `main` y no en ① se añade Y SE CUENTA: si no es 0, el listado mintió.
import fs from 'node:fs';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';

const [carpeta, desde, hasta] = process.argv.slice(2);
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
if (!carpeta || !ISO.test(desde ?? '') || !ISO.test(hasta ?? '')) {
  console.error('uso: node a-listar.mjs <carpeta> <desde ISO con Z> <hasta ISO con Z>');
  process.exit(2);
}
const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const REPO = 'lwislg99/cobroflash-backend';
const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
let llamadas = 0;
const gh = (ruta) => new Promise((ok, mal) => {
  llamadas++;
  execFile('gh', ['api', ruta], { env, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 }, (e, out) => {
    if (e) return mal(new Error(`${ruta}: ${String(e.message).split('\n')[0]}`));
    try { ok(JSON.parse(out)); } catch (x) { mal(new Error(`${ruta}: respuesta que no es JSON (${out.length} B)`)); }
  });
});
const enParalelo = async (cosas, n, f) => {
  const cola = [...cosas];
  await Promise.all(Array.from({ length: n }, async () => { for (let c = cola.shift(); c !== undefined; c = cola.shift()) await f(c); }));
};

// ── commits de main, primer padre, por fecha de COMMITTER (la del merge) ──────────────────────
const commits = execFileSync('git', ['log', '--first-parent', '--format=%H\t%cI\t%s', 'origin/main', `--since=${desde}`, `--until=${hasta}`], { cwd: RAIZ, encoding: 'utf8' })
  .split('\n').filter(Boolean).map((l) => { const [sha, fecha, ...t] = l.split('\t'); return { sha, fecha: new Date(fecha).toISOString(), titulo: t.join('\t') }; });
const punta = execFileSync('git', ['rev-parse', 'origin/main'], { cwd: RAIZ, encoding: 'utf8' }).trim();

// ── ① el listado, por día ─────────────────────────────────────────────────────────────────────
const dias = [];
for (let t = Date.parse(desde); t < Date.parse(hasta);) {
  const fin = Math.min(Date.parse(new Date(t).toISOString().slice(0, 10) + 'T23:59:59Z'), Date.parse(hasta));
  dias.push([new Date(t).toISOString().replace('.000', ''), new Date(fin).toISOString().replace('.000', '')]);
  t = fin + 1000;
}
const runs = new Map();
const porDia = [];
for (const [a, b] of dias) {
  let total = null; let traidos = 0;
  for (let p = 1; p <= 10; p++) {
    const j = await gh(`repos/${REPO}/actions/runs?branch=main&created=${a}..${b}&per_page=100&page=${p}`);
    total ??= j.total_count;
    for (const r of j.workflow_runs) { runs.set(r.id, r); traidos++; }
    if (j.workflow_runs.length < 100) break;
  }
  porDia.push({ a, b, total, traidos });
}
const delListado = runs.size;

// ── ② por identidad ───────────────────────────────────────────────────────────────────────────
let soloPorSha = 0; const fallosSha = [];
const runsPorSha = {};
await enParalelo(commits, 8, async (c) => {
  try {
    const j = await gh(`repos/${REPO}/actions/runs?head_sha=${c.sha}&per_page=100`);
    runsPorSha[c.sha] = j.workflow_runs.map((r) => ({ id: r.id, wf: r.name, evento: r.event, rama: r.head_branch }));
    for (const r of j.workflow_runs) {
      if (r.head_branch !== 'main') continue;
      if (!runs.has(r.id)) { runs.set(r.id, r); soloPorSha++; }
    }
  } catch (e) { fallosSha.push(e.message); }
});

// ── los jobs de cada run, todos los intentos ──────────────────────────────────────────────────
const jobs = {}; const fallosJobs = [];
await enParalelo([...runs.keys()], 8, async (id) => {
  try {
    const todos = [];
    for (let p = 1; p <= 5; p++) {
      const j = await gh(`repos/${REPO}/actions/runs/${id}/jobs?per_page=100&filter=all&page=${p}`);
      todos.push(...j.jobs);
      if (j.jobs.length < 100) break;
    }
    jobs[id] = todos.map((x) => ({
      id: x.id, nombre: x.name, intento: x.run_attempt, status: x.status, conclusion: x.conclusion,
      empezo: x.started_at, acabo: x.completed_at, runner: x.runner_name,
      pasos: (x.steps ?? []).map((s) => ({ n: s.number, nombre: s.name, status: s.status, conclusion: s.conclusion })),
    }));
  } catch (e) { fallosJobs.push(`${id}: ${e.message}`); }
});

const reducidos = [...runs.values()].map((r) => ({
  id: r.id, wf: r.name, evento: r.event, rama: r.head_branch, sha: r.head_sha, creado: r.created_at, actualizado: r.updated_at,
  status: r.status, conclusion: r.conclusion, intento: r.run_attempt, titulo: r.display_title,
})).sort((x, y) => x.creado.localeCompare(y.creado));

fs.mkdirSync(carpeta, { recursive: true });
fs.writeFileSync(path.join(carpeta, 'a-poblacion.json'), JSON.stringify({ desde, hasta, punta, commits, runs: reducidos, jobs, runsPorSha }));

console.log(`POBLACIÓN · ventana ${desde} → ${hasta} · origin/main ${punta}`);
console.log(`commits de main (primer padre) en la ventana: ${commits.length}`);
for (const d of porDia) console.log(`  listado ${d.a} .. ${d.b}: declarados ${d.total} · traídos ${d.traidos}${d.total === d.traidos ? '' : '  ← NO CUADRA'}`);
console.log(`runs con rama main · del listado: ${delListado} · sólo por sha (el listado no los traía): ${soloPorSha} · total: ${runs.size}`);
console.log(`commits consultados por sha: ${Object.keys(runsPorSha).length} de ${commits.length} · fallos: ${fallosSha.length}`);
console.log(`runs con sus jobs leídos: ${Object.keys(jobs).length} de ${runs.size} · fallos: ${fallosJobs.length}`);
for (const f of [...fallosSha, ...fallosJobs].slice(0, 20)) console.log(`  SIN LEER: ${f}`);
console.log(`llamadas a gh: ${llamadas}`);
const mal = porDia.some((d) => d.total !== d.traidos) || fallosSha.length || fallosJobs.length || !commits.length || !runs.size;
console.log(`EXIT=${mal ? 2 : 0}`);
process.exit(mal ? 2 : 0);
