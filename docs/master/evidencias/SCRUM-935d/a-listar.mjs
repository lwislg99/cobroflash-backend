#!/usr/bin/env node
// SCRUM-935d · a-listar.mjs — SÓLO LECTURA (gh api, GET).
//
// Todos los runs de `ci.yml` creados desde <desde> (todos los eventos), y de cada uno el job del
// meta-guard: conclusión, arranque, fin y duración. Población declarada al final: runs listados,
// runs SIN job de meta-guard (saltado o no creado) y runs cuyo listado de jobs falló (CIEGOS).
//
//   node a-listar.mjs <desde AAAA-MM-DD> <carpeta de salida>
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const [desde, carpeta] = process.argv.slice(2);
if (!desde || !carpeta) { console.error('uso: node a-listar.mjs <desde> <carpeta>'); process.exit(2); }
const REPO = 'lwislg99/cobroflash-backend';
const GH = process.env.GH || 'gh';
fs.mkdirSync(carpeta, { recursive: true });

const gh = (ruta) => new Promise((ok) => {
  execFile(GH, ['api', ruta], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 }, (e, out) => {
    if (e) return ok({ error: String(e.message).split('\n')[0] });
    try { ok({ datos: JSON.parse(out) }); } catch (x) { ok({ error: 'JSON ilegible' }); }
  });
});

// La API de runs corta en 1.000 resultados por consulta: se trocea por DÍA para no perder ninguno.
const dias = [];
for (let d = new Date(`${desde}T00:00:00Z`); d <= new Date(); d = new Date(d.getTime() + 86400000)) dias.push(d.toISOString().slice(0, 10));
const runs = [];
const ciegosLista = [];
for (const dia of dias) {
  for (let pag = 1; ; pag++) {
    const r = await gh(`repos/${REPO}/actions/workflows/ci.yml/runs?created=${dia}&per_page=100&page=${pag}`);
    if (r.error) { ciegosLista.push(`${dia} p${pag}: ${r.error}`); break; }
    const lote = r.datos.workflow_runs || [];
    if (pag === 1 && r.datos.total_count > 1000) ciegosLista.push(`${dia}: ${r.datos.total_count} runs > 1000, la API no los da todos`);
    runs.push(...lote);
    if (lote.length < 100) break;
  }
}
console.log(`runs listados: ${runs.length} (${dias[0]} → ${dias.at(-1)})`);

const filas = [];
const ciegosJobs = [];
let sinJob = 0;
const CONC = 8;
for (let i = 0; i < runs.length; i += CONC) {
  await Promise.all(runs.slice(i, i + CONC).map(async (run) => {
    const r = await gh(`repos/${REPO}/actions/runs/${run.id}/jobs?per_page=100`);
    if (r.error) { ciegosJobs.push(`${run.id}: ${r.error}`); return; }
    const job = (r.datos.jobs || []).find((j) => j.name.startsWith('meta-guard'));
    if (!job) { sinJob += 1; return; }
    const ini = job.started_at ? Date.parse(job.started_at) : null;
    const fin = job.completed_at ? Date.parse(job.completed_at) : null;
    const paso = (job.steps || []).find((s) => s.name.startsWith('Cada guard cae'));
    filas.push({
      run: run.id, job: job.id, evento: run.event, rama: run.head_branch, sha: run.head_sha,
      creado: run.created_at, estado: job.status, conclusion: job.conclusion || '',
      duracion_s: ini && fin ? Math.round((fin - ini) / 1000) : '',
      paso_conclusion: paso?.conclusion || '',
      paso_s: paso?.started_at && paso?.completed_at ? Math.round((Date.parse(paso.completed_at) - Date.parse(paso.started_at)) / 1000) : '',
    });
  }));
}
filas.sort((a, b) => a.run - b.run);
const cab = Object.keys(filas[0] || { run: 0 });
fs.writeFileSync(path.join(carpeta, 'a-jobs.tsv'), [cab.join('\t'), ...filas.map((f) => cab.map((k) => f[k]).join('\t'))].join('\n') + '\n');
const cuenta = (p) => filas.filter(p).length;
console.log(`POBLACIÓN · runs ${runs.length} · con job meta-guard ${filas.length} · sin job ${sinJob} · CIEGOS (listado de jobs falló) ${ciegosJobs.length} · CIEGOS (listado de runs) ${ciegosLista.length}`);
console.log(`  success ${cuenta((f) => f.conclusion === 'success')} · failure ${cuenta((f) => f.conclusion === 'failure')} · cancelled ${cuenta((f) => f.conclusion === 'cancelled')} · otros ${cuenta((f) => !['success', 'failure', 'cancelled'].includes(f.conclusion))}`);
console.log(`  cancelled con job ≥ 1.770 s (el techo de 30 min): ${cuenta((f) => f.conclusion === 'cancelled' && f.duracion_s >= 1770)}`);
console.log(`  cancelled con paso de mutación cancelado y ≥ 1.700 s: ${cuenta((f) => f.conclusion === 'cancelled' && f.paso_s >= 1700)}`);
for (const c of [...ciegosLista, ...ciegosJobs]) console.log(`  CIEGO · ${c}`);
process.exit(ciegosLista.length || ciegosJobs.length ? 2 : 0);
