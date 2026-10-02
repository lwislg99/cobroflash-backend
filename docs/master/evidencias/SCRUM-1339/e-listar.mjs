#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/e-listar.mjs — SCRUM-1339e · SÓLO LECTURA.
//
// Lista los artefactos `tanda-tap` creados desde una hora dada, en el formato que lee
// `b-bajar.mjs` (`arts-hoy.tsv`: id, creado, expirado, bytes, run, sha, rama; sin cabecera).
//
//   node e-listar.mjs <carpeta> <desde ISO, p. ej. 2026-10-01T00:00:00Z>
//
// La lista sale de la API de artefactos, que va por IDENTIDAD del artefacto y de más nuevo a
// más viejo. NO sale de `actions/runs?event=push`: medido el 2-oct-2026, ese listado con
// `branch=main&event=push` devuelve como «últimos» runs del 17 y 18 de septiembre.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [carpeta, desde] = process.argv.slice(2);
if (!carpeta || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(desde ?? '')) {
  console.error('uso: node e-listar.mjs <carpeta> <desde ISO con Z>');
  process.exit(2);
}
const REPO = 'lwislg99/cobroflash-backend';
const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
const gh = (ruta) => JSON.parse(execFileSync('gh', ['api', ruta], { env, maxBuffer: 1024 * 1024 * 64, encoding: 'utf8' }));

const filas = [];
let total = null;
let paginas = 0;
let masViejoVisto = null;
for (let pagina = 1; pagina <= 40; pagina++) {
  const j = gh(`repos/${REPO}/actions/artifacts?name=tanda-tap&per_page=100&page=${pagina}`);
  paginas++;
  total ??= j.total_count;
  if (!j.artifacts.length) break;
  for (const a of j.artifacts) {
    masViejoVisto = a.created_at;
    if (a.created_at >= desde) filas.push(a);
  }
  // la API va de más nuevo a más viejo: en cuanto una página entera queda por debajo, se para
  if (j.artifacts.every((a) => a.created_at < desde)) break;
}
filas.sort((a, b) => a.created_at.localeCompare(b.created_at));
fs.mkdirSync(carpeta, { recursive: true });
fs.writeFileSync(path.join(carpeta, 'arts-hoy.tsv'), filas.map((a) => [
  a.id, a.created_at, a.expired, a.size_in_bytes, a.workflow_run.id, a.workflow_run.head_sha, a.workflow_run.head_branch,
].join('\t')).join('\n') + '\n');

const ramas = {};
for (const a of filas) { const k = a.workflow_run.head_branch === 'main' ? 'main' : 'otra rama'; ramas[k] = (ramas[k] ?? 0) + 1; }
console.log(`POBLACIÓN: la API dice ${total} artefactos «tanda-tap» en total · páginas leídas ${paginas} · el más viejo que vi es de ${masViejoVisto}`);
console.log(`  desde ${desde}: ${filas.length} artefactos · caducados ${filas.filter((a) => a.expired).length} · runs distintos ${new Set(filas.map((a) => a.workflow_run.id)).size}`);
console.log(`  por rama: ${Object.entries(ramas).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
if (filas.length) console.log(`  rango: ${filas[0].created_at} → ${filas.at(-1).created_at}`);
// CONTROL: si lo más viejo que se vio NO queda por debajo de `desde`, la lista puede estar cortada.
const completa = masViejoVisto !== null && masViejoVisto < desde;
console.log(`  CONTROL de que la lista llega hasta «desde»: ${completa ? 'sí, se vio al menos un artefacto anterior' : 'NO — no se vio ninguno anterior: la lista puede estar CORTADA'}`);
console.log(`EXIT=${completa ? 0 : 4}`);
process.exitCode = completa ? 0 : 4;
