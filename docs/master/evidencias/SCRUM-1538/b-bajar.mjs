#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1538/b-bajar.mjs — SCRUM-1538 · SÓLO LECTURA (gh api, GET).
//
// Baja el log de cada ejecución de job de la población de `a-listar.mjs` que haya EMPEZADO a
// correr en el workflow CI, más toda ejecución en `failure` de cualquier otro workflow. Un job
// `skipped`, o uno que aún no ha acabado, no tiene log que bajar: se cuenta aparte.
//
//   node b-bajar.mjs <carpeta de a-poblacion.json>
//
// 🔴 `gh api …/logs` SIN `--allow-escape-sequences` devuelve 0 bytes y sale 1 (medido en SCRUM-1339,
// c.19304): por eso aquí el TAMAÑO se escribe al lado de cada log y un log de menos de 1.000 B se
// cuenta como «sin log», no como un log sin fallos.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const [carpeta] = process.argv.slice(2);
if (!carpeta) { console.error('uso: node b-bajar.mjs <carpeta>'); process.exit(2); }
const REPO = 'lwislg99/cobroflash-backend';
const p = JSON.parse(fs.readFileSync(path.join(carpeta, 'a-poblacion.json'), 'utf8'));
const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
const dir = path.join(carpeta, 'logs');
fs.mkdirSync(dir, { recursive: true });

const pedir = [];
let sinLogQuePedir = 0;
for (const r of p.runs) for (const j of p.jobs[r.id]) {
  if (j.status !== 'completed' || j.conclusion === 'skipped') { sinLogQuePedir++; continue; }
  if (r.wf === 'CI' || j.conclusion === 'failure') pedir.push(j.id);
  else sinLogQuePedir++;
}
const bajar = (id) => new Promise((ok) => {
  const destino = path.join(dir, `${id}.log`);
  if (fs.existsSync(destino) && fs.statSync(destino).size >= 1000) return ok({ id, bytes: fs.statSync(destino).size, de: 'disco' });
  execFile('gh', ['api', '--allow-escape-sequences', `repos/${REPO}/actions/jobs/${id}/logs`], { env, encoding: 'buffer', maxBuffer: 1024 * 1024 * 64 }, (e, out) => {
    if (e) return ok({ id, bytes: 0, de: 'red', error: String(e.message).split('\n').slice(0, 2).join(' ').slice(0, 200) });
    fs.writeFileSync(destino, out);
    ok({ id, bytes: out.length, de: 'red' });
  });
});
const res = [];
const cola = [...pedir];
await Promise.all(Array.from({ length: 6 }, async () => { for (let id = cola.shift(); id !== undefined; id = cola.shift()) res.push(await bajar(id)); }));
res.sort((a, b) => a.id - b.id);
fs.writeFileSync(path.join(carpeta, 'b-bajados.tsv'), res.map((r) => [r.id, r.bytes, r.de, r.error ?? ''].join('\t')).join('\n') + '\n');
const cortos = res.filter((r) => r.bytes < 1000);
const tam = res.filter((r) => r.bytes >= 1000).map((r) => r.bytes).sort((a, b) => a - b);
console.log(`POBLACIÓN · ejecuciones de job: ${Object.values(p.jobs).flat().length} · con log que pedir: ${pedir.length} · sin log que pedir (saltadas, sin acabar, o verdes de otro workflow): ${sinLogQuePedir}`);
console.log(`bajados con 1.000 B o más: ${tam.length} · de ${tam[0]} a ${tam.at(-1)} B · suma ${tam.reduce((a, b) => a + b, 0)} B`);
console.log(`SIN LOG (menos de 1.000 B o error): ${cortos.length}`);
for (const c of cortos) console.log(`  ${c.id}\t${c.bytes} B\t${c.error ?? ''}`);
console.log(`EXIT=${tam.length ? 0 : 2}`);
process.exit(tam.length ? 0 : 2);
