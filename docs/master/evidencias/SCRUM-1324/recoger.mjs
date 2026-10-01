// SCRUM-1324 · recogida del historial de runs en `main` (sólo LECTURA de la API de GitHub).
// Uso: node recoger.mjs <dir-salida> <desde AAAA-MM-DD> [--contar]
// Escribe runs.json = { tomada, desde, repo, workflows:[…], runs:[{…, jobs:[…]}], ciegos:[…] }.
import { execFile } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO = 'lwislg99/cobroflash-backend';
const [dir, desde, modo] = process.argv.slice(2);
if (!dir || !/^\d{4}-\d{2}-\d{2}$/.test(desde || '')) {
  console.error('uso: node recoger.mjs <dir-salida> <desde AAAA-MM-DD> [--contar]');
  process.exit(2);
}

const gh = (ruta) => new Promise((ok, ko) => {
  execFile('gh', ['api', ruta], { maxBuffer: 256 * 1024 * 1024 }, (e, out) => {
    if (e) return ko(new Error(`${ruta}: ${String(e.message).slice(0, 200)}`));
    try { ok(JSON.parse(out)); } catch (x) { ko(new Error(`${ruta}: JSON ilegible`)); }
  });
});

const enLotes = async (items, n, f) => {
  const res = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; res[k] = await f(items[k], k); }
  }));
  return res;
};

const fecha = await gh('rate_limit');
const tomada = new Date().toISOString();
const wfs = (await gh(`repos/${REPO}/actions/workflows?per_page=100`)).workflows
  .map((w) => ({ id: w.id, name: w.name, path: w.path, state: w.state }));

const ciegos = [];
const runs = [];
for (const w of wfs) {
  // La API de listado devuelve como mucho 1.000 resultados por consulta: se parte por DÍA.
  const dias = [];
  for (let d = new Date(`${desde}T00:00:00Z`); d <= new Date(); d = new Date(d.getTime() + 86400000)) {
    dias.push(d.toISOString().slice(0, 10));
  }
  let delWf = 0;
  for (const dia of dias) {
    let pagina = 1, total = null, leidos = 0;
    for (;;) {
      const r = await gh(`repos/${REPO}/actions/workflows/${w.id}/runs?branch=main&created=${dia}&per_page=100&page=${pagina}`);
      total = r.total_count;
      for (const x of r.workflow_runs) {
        runs.push({
          id: x.id, wf: w.name, wfPath: w.path, event: x.event, sha: x.head_sha,
          creado: x.created_at, empezado: x.run_started_at, actualizado: x.updated_at,
          status: x.status, conclusion: x.conclusion, intento: x.run_attempt, numero: x.run_number,
        });
      }
      leidos += r.workflow_runs.length;
      if (r.workflow_runs.length < 100 || leidos >= total) break;
      pagina++;
    }
    if (leidos !== total) ciegos.push({ wf: w.name, dia, motivo: `leidos ${leidos} de ${total}` });
    delWf += leidos;
  }
  console.log(`${w.name}\t${delWf} runs en main desde ${desde}`);
}
// Un run puede salir en dos días si la consulta por `created` solapa: se deduplica por id.
const porId = new Map(runs.map((r) => [r.id, r]));
const unicos = [...porId.values()].sort((a, b) => a.creado.localeCompare(b.creado));
console.log(`POBLACION runs=${unicos.length} (antes de deduplicar ${runs.length})`);
if (modo === '--contar') process.exit(0);

let hechos = 0;
await enLotes(unicos, 8, async (r) => {
  try {
    const j = await gh(`repos/${REPO}/actions/runs/${r.id}/jobs?per_page=100&filter=latest`);
    r.jobs = j.jobs.map((x) => ({
      name: x.name, status: x.status, conclusion: x.conclusion,
      empezado: x.started_at, acabado: x.completed_at,
      caidos: (x.steps || []).filter((s) => s.conclusion === 'failure').map((s) => s.name),
    }));
    if (j.total_count !== j.jobs.length) ciegos.push({ run: r.id, motivo: `jobs ${j.jobs.length} de ${j.total_count}` });
  } catch (e) {
    r.jobs = null;
    ciegos.push({ run: r.id, motivo: e.message });
  }
  if (++hechos % 200 === 0) console.log(`  jobs leídos: ${hechos}/${unicos.length}`);
});

mkdirSync(dir, { recursive: true });
const salida = { tomada, desde, repo: REPO, limiteAlEmpezar: fecha.resources.core, workflows: wfs, runs: unicos, ciegos };
writeFileSync(join(dir, 'runs.json'), JSON.stringify(salida));
const sinJobs = unicos.filter((r) => r.jobs === null).length;
console.log(`POBLACION runs=${unicos.length} con_jobs=${unicos.length - sinJobs} sin_leer=${sinJobs} ciegos=${ciegos.length}`);
console.log('EXIT=0');
