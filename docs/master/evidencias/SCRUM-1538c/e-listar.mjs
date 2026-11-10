#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1538c/e-listar.mjs — SCRUM-1538c · SÓLO LECTURA (gh api, GET).
//
// Población: TODOS los runs del workflow CI (main Y pull_request) creados en una ventana DECLARADA,
// troceada en tramos de 6 h (el listado filtrado se corta en 1.000 sin avisar: aquí se compara
// `total_count` con lo traído en cada tramo). De ellos se piden los jobs (`filter=all`, todos los
// intentos) de los que NO son un verde limpio: conclusión distinta de `success`, o más de un intento
// (un reintento verde tapa al intento rojo de debajo), o sin acabar.
//
//   node e-listar.mjs <carpeta FUERA del árbol> <desde ISO con Z> <hasta ISO con Z>
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const [carpeta, desde, hasta] = process.argv.slice(2);
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
if (!carpeta || !ISO.test(desde ?? '') || !ISO.test(hasta ?? '')) {
  console.error('uso: node e-listar.mjs <carpeta> <desde ISO con Z> <hasta ISO con Z>');
  process.exit(2);
}
const REPO = 'lwislg99/cobroflash-backend';
const WF_CI = 321298878; // .github/workflows/ci.yml
const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
let llamadas = 0;
const gh = (ruta) => new Promise((ok, mal) => {
  llamadas++;
  execFile('gh', ['api', ruta], { env, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 }, (e, out) => {
    if (e) return mal(new Error(`${ruta}: ${String(e.message).split('\n')[0]}`));
    try { ok(JSON.parse(out)); } catch { mal(new Error(`${ruta}: respuesta que no es JSON (${out.length} B)`)); }
  });
});
const iso = (t) => new Date(t).toISOString().replace('.000', '');

const tramos = [];
for (let t = Date.parse(desde); t < Date.parse(hasta); t += 6 * 3600e3) {
  tramos.push([iso(t), iso(Math.min(t + 6 * 3600e3 - 1000, Date.parse(hasta)))]);
}
const runs = new Map();
const cortos = [];
for (const [a, b] of tramos) {
  let total = null; let traidos = 0;
  for (let p = 1; p <= 10; p++) {
    const j = await gh(`repos/${REPO}/actions/workflows/${WF_CI}/runs?created=${a}..${b}&per_page=100&page=${p}`);
    total ??= j.total_count;
    for (const r of j.workflow_runs) { runs.set(r.id, r); traidos++; }
    if (j.workflow_runs.length < 100) break;
  }
  if (total !== traidos) cortos.push(`${a}..${b} declarados ${total} traídos ${traidos}`);
}
const todos = [...runs.values()];
const aPedir = todos.filter((r) => r.status !== 'completed' || r.conclusion !== 'success' || r.run_attempt > 1);
const jobs = [];
const fallos = [];
const cola = [...aPedir];
await Promise.all(Array.from({ length: 8 }, async () => {
  for (let r = cola.shift(); r !== undefined; r = cola.shift()) {
    try {
      for (let p = 1; p <= 5; p++) {
        const j = await gh(`repos/${REPO}/actions/runs/${r.id}/jobs?filter=all&per_page=100&page=${p}`);
        for (const x of j.jobs) jobs.push({ run: r.id, evento: r.event, rama: r.head_branch, sha: r.head_sha, intento: x.run_attempt, creado: r.created_at, job: x.id, nombre: x.name, status: x.status, conclusion: x.conclusion ?? '', empieza: x.started_at ?? '', acaba: x.completed_at ?? '' });
        if (j.jobs.length < 100) break;
      }
    } catch (e) { fallos.push(e.message); }
  }
}));
fs.mkdirSync(carpeta, { recursive: true });
fs.writeFileSync(path.join(carpeta, 'e-runs.json'), JSON.stringify(todos.map((r) => ({ id: r.id, evento: r.event, rama: r.head_branch, sha: r.head_sha, creado: r.created_at, status: r.status, conclusion: r.conclusion, intento: r.run_attempt })), null, 0));
const cab = ['run', 'evento', 'rama', 'sha', 'intento', 'creado', 'job', 'nombre', 'status', 'conclusion', 'empieza', 'acaba', 'segundos'];
const filas = jobs.sort((a, b) => a.job - b.job).map((x) => [...cab.slice(0, -1).map((k) => x[k]), x.empieza && x.acaba ? (Date.parse(x.acaba) - Date.parse(x.empieza)) / 1000 : -1].join('\t'));
fs.writeFileSync(path.join(carpeta, 'e-jobs.tsv'), [cab.join('\t'), ...filas].join('\n') + '\n');

const porConc = {};
for (const r of todos) { const k = `${r.event}/${r.status}/${r.conclusion}`; porConc[k] = (porConc[k] ?? 0) + 1; }
console.log(`VENTANA ${desde} → ${hasta} · tramos de 6 h: ${tramos.length}`);
console.log(`POBLACIÓN · runs de CI: ${todos.length} · tramos con declarados ≠ traídos: ${cortos.length}`);
for (const c of cortos) console.log(`  CORTO ${c}`);
for (const [k, n] of Object.entries(porConc).sort()) console.log(`  ${k}\t${n}`);
console.log(`runs con jobs pedidos (no verde limpio): ${aPedir.length} · ejecuciones de job traídas: ${jobs.length} · fallos de llamada: ${fallos.length} · llamadas: ${llamadas}`);
for (const f of fallos) console.log(`  FALLO ${f}`);
const ok = todos.length > 0 && cortos.length === 0 && fallos.length === 0;
console.log(`EXIT=${ok ? 0 : 3}`);
process.exit(ok ? 0 : 3);
