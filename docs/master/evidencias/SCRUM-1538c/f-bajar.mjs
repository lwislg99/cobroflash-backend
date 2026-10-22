#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1538c/f-bajar.mjs — SCRUM-1538c · SÓLO LECTURA (gh api, GET).
//
// Baja el log de las ejecuciones de `e-jobs.tsv` que este tramo clasifica:
//   · build + tests en `failure` (donde puede caer A8.4);
//   · trinquete de zona en `cancelled` con 40 min o más (su techo es 45: colgada);
//   · meta-guard en `cancelled` con 29 min o más (su techo es 30: colgada);
//   · y, de control, los 10 últimos VERDES de trinquete y de meta-guard (lo que tarda uno que acaba).
//
//   node f-bajar.mjs <carpeta de e-jobs.tsv>
//
// 🔴 `gh api …/logs` SIN `--allow-escape-sequences` devuelve 0 bytes (SCRUM-1339 c.19304): el TAMAÑO
// se escribe al lado de cada log y uno de menos de 1.000 B cuenta como «sin log», no como limpio.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const [carpeta] = process.argv.slice(2);
if (!carpeta) { console.error('uso: node f-bajar.mjs <carpeta>'); process.exit(2); }
const REPO = 'lwislg99/cobroflash-backend';
const L = fs.readFileSync(path.join(carpeta, 'e-jobs.tsv'), 'utf8').trim().split('\n');
const cab = L[0].split('\t');
const filas = L.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cab[i], v])));
const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
const dir = path.join(carpeta, 'logs');
fs.mkdirSync(dir, { recursive: true });

const grupo = (f) => {
  const s = Number(f.segundos);
  if (f.nombre.startsWith('build + tests') && f.conclusion === 'failure') return 'build-failure';
  if (f.nombre.startsWith('trinquete') && f.conclusion === 'cancelled' && s >= 2400) return 'trinquete-colgada';
  if (f.nombre.startsWith('meta-guard') && f.conclusion === 'cancelled' && s >= 1740) return 'meta-colgada';
  return null;
};
const pedir = filas.map((f) => ({ id: f.job, g: grupo(f) })).filter((x) => x.g);
for (const pre of ['trinquete', 'meta-guard']) {
  const verdes = filas.filter((f) => f.nombre.startsWith(pre) && f.conclusion === 'success').sort((a, b) => Number(a.job) - Number(b.job)).slice(-10);
  for (const f of verdes) pedir.push({ id: f.job, g: `${pre.split('-')[0]}-verde-control` });
}
const bajar = ({ id, g }) => new Promise((ok) => {
  const destino = path.join(dir, `${id}.log`);
  if (fs.existsSync(destino) && fs.statSync(destino).size >= 1000) return ok({ id, g, bytes: fs.statSync(destino).size, de: 'disco' });
  execFile('gh', ['api', '--allow-escape-sequences', `repos/${REPO}/actions/jobs/${id}/logs`], { env, encoding: 'buffer', maxBuffer: 1024 * 1024 * 64 }, (e, out) => {
    if (e) return ok({ id, g, bytes: 0, de: 'red', error: String(e.message).split('\n').slice(0, 2).join(' ').slice(0, 200) });
    fs.writeFileSync(destino, out);
    ok({ id, g, bytes: out.length, de: 'red' });
  });
});
const res = [];
const cola = [...pedir];
await Promise.all(Array.from({ length: 6 }, async () => { for (let x = cola.shift(); x !== undefined; x = cola.shift()) res.push(await bajar(x)); }));
res.sort((a, b) => Number(a.id) - Number(b.id));
fs.writeFileSync(path.join(carpeta, 'f-bajados.tsv'), res.map((r) => [r.id, r.g, r.bytes, r.de, r.error ?? ''].join('\t')).join('\n') + '\n');
const porG = {};
for (const r of res) { porG[r.g] ??= { n: 0, cortos: 0, min: Infinity, max: 0 }; const p = porG[r.g]; p.n++; if (r.bytes < 1000) p.cortos++; else { p.min = Math.min(p.min, r.bytes); p.max = Math.max(p.max, r.bytes); } }
console.log(`POBLACIÓN · filas de e-jobs.tsv: ${filas.length} · logs pedidos: ${pedir.length}`);
for (const [g, p] of Object.entries(porG)) console.log(`  ${g}\tpedidos ${p.n}\tSIN LOG (<1.000 B o error) ${p.cortos}\tde ${p.min} a ${p.max} B`);
for (const r of res.filter((r) => r.bytes < 1000)) console.log(`  SIN LOG ${r.id}\t${r.g}\t${r.bytes} B\t${r.error ?? ''}`);
const ok = res.some((r) => r.bytes >= 1000);
console.log(`EXIT=${ok ? 0 : 2}`);
process.exit(ok ? 0 : 2);
