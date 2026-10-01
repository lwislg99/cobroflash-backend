#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/bajar-logs.mjs
//
// Para cada run que tiene artefacto `tanda-tap` (artefactos.tsv), baja el LOG del job
// «build + tests (con banco desechable)», de TODOS sus intentos. SOLO LECTURA.
//
// Por qué el log además del TAP: el TAP del artefacto llega pisado (ver el registro), y el log
// lleva la salida `spec` entera —un `✔`/`✖`/`﹣` por caso— más la línea del checkout, que dice
// QUÉ commit se probó de verdad (en un PR, el de la fusión con `main`, no la cabeza de la rama).
//
//   node bajar-logs.mjs <carpeta con artefactos.tsv>   →  <carpeta>/logs/<job>.log.gz y jobs.tsv
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFile } from 'node:child_process';

const REPO = 'lwislg99/cobroflash-backend';
const carpeta = process.argv[2];
if (!carpeta) { console.error('uso: node bajar-logs.mjs <carpeta>'); process.exit(2); }
const dirLogs = path.join(carpeta, 'logs');
fs.mkdirSync(dirLogs, { recursive: true });

const gh = (args) => new Promise((ok, mal) => execFile('gh', args, { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 },
  (e, out) => (e ? mal(e) : ok(out))));

const runs = [...new Set(fs.readFileSync(path.join(carpeta, 'artefactos.tsv'), 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t')[1]))];
console.log(`POBLACION: ${runs.length} runs distintos con artefacto tanda-tap`);

const jobs = []; const sinJob = []; const fallidos = [];
async function unRun(run) {
  let lista;
  try {
    lista = JSON.parse((await gh(['api', `repos/${REPO}/actions/runs/${run}/jobs?filter=all&per_page=100`])).toString('utf8')).jobs;
  } catch (e) { fallidos.push(`run ${run}: ${String(e.message).split('\n')[0].slice(0, 100)}`); return; }
  const mios = lista.filter((j) => j.name.startsWith('build + tests'));
  if (!mios.length) { sinJob.push(run); return; }
  for (const j of mios) {
    const fila = { run, intento: j.run_attempt, job: j.id, conclusion: j.conclusion, empezo: j.started_at, acabo: j.completed_at, sha: j.head_sha, log_bytes: '' };
    jobs.push(fila);
    const ruta = path.join(dirLogs, `${j.id}.log.gz`);
    if (fs.existsSync(ruta) && fs.statSync(ruta).size > 0) { fila.log_bytes = 'ya'; continue; }
    try {
      const log = await gh(['api', `repos/${REPO}/actions/jobs/${j.id}/logs`]);
      if (!log.length) throw new Error('log vacío');
      fs.writeFileSync(ruta, zlib.gzipSync(log));
      fila.log_bytes = log.length;
    } catch (e) { fila.log_bytes = 'ERROR'; fallidos.push(`job ${j.id}: ${String(e.message).split('\n')[0].slice(0, 100)}`); }
  }
}
let i = 0;
await Promise.all(Array.from({ length: 6 }, async () => { while (i < runs.length) await unRun(runs[i++]); }));

jobs.sort((a, b) => String(a.empezo).localeCompare(String(b.empezo)));
const columnas = Object.keys(jobs[0]);
fs.writeFileSync(path.join(carpeta, 'jobs.tsv'), [columnas.join('\t'), ...jobs.map((r) => columnas.map((c) => r[c]).join('\t'))].join('\n') + '\n');
console.log(`JOBS «build + tests»: ${jobs.length} · runs sin ese job: ${sinJob.length} · fallidos: ${fallidos.length}`);
for (const f of fallidos.slice(0, 20)) console.log('  ✗ ' + f);
console.log(`EXIT=${fallidos.length ? 1 : 0}`);
process.exit(fallidos.length ? 1 : 0);
