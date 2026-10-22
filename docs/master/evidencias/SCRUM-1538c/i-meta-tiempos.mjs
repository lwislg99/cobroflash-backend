#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1538c/i-meta-tiempos.mjs — SCRUM-1538c · SÓLO LECTURA (gh api, GET).
//
// ¿Dónde ha crecido el meta-guard? Toma los 10 PRIMEROS verdes del meta-guard de la ventana (6-9 oct) y
// los 10 ÚLTIMOS, y reparte el tiempo del paso `meta:mutaciones` entre los ficheros de test que juzga:
// a cada línea de veredicto («  ✔ fichero.test.mjs · …») se le apunta el tiempo desde la línea anterior.
// Imprime el total de cada grupo, los ficheros que ENTRAN (sólo en los últimos) y los que más crecen.
//
//   node i-meta-tiempos.mjs <carpeta de e-listar>
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const [carpeta] = process.argv.slice(2);
if (!carpeta) { console.error('uso: node i-meta-tiempos.mjs <carpeta>'); process.exit(2); }
const REPO = 'lwislg99/cobroflash-backend';
const L = fs.readFileSync(path.join(carpeta, 'e-jobs.tsv'), 'utf8').trim().split('\n');
const cab = L[0].split('\t');
const metaV = L.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cab[i], v]))).filter((j) => j.nombre.startsWith('meta-guard') && j.conclusion === 'success').sort((a, b) => Number(a.job) - Number(b.job));
const grupos = { primeros: metaV.slice(0, 10), ultimos: metaV.slice(-10) };
const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
const dir = path.join(carpeta, 'logs');
fs.mkdirSync(dir, { recursive: true });
const bajar = (id) => new Promise((ok) => {
  const destino = path.join(dir, `${id}.log`);
  if (fs.existsSync(destino) && fs.statSync(destino).size >= 1000) return ok(fs.readFileSync(destino, 'utf8'));
  execFile('gh', ['api', '--allow-escape-sequences', `repos/${REPO}/actions/jobs/${id}/logs`], { env, encoding: 'buffer', maxBuffer: 1024 * 1024 * 64 }, (e, out) => {
    if (e) return ok('');
    fs.writeFileSync(destino, out); ok(out.toString('utf8'));
  });
});
const ESC = /\x1b\[[0-9;]*[A-Za-z]/g;
/** { fichero: segundos } de un log: el tiempo desde la línea de veredicto anterior (o el arranque del paso). */
export function reparto(texto) {
  const filas = texto.split(/\r?\n/).map((l) => ({ h: Date.parse(l.slice(0, 28)), t: l.slice(29).replace(ESC, '') }));
  const ini = filas.find((x) => /^##\[group\]Run npm run meta:mutaciones/.test(x.t));
  if (!ini) return null;
  const out = {}; let prev = ini.h; let n = 0;
  for (const x of filas) {
    const m = /^ {2}(?:✔|\?|☠|✖) (\S+\.test\.mjs) · /.exec(x.t);
    if (!m || !(x.h >= ini.h)) continue;
    out[m[1]] = (out[m[1]] ?? 0) + (x.h - prev) / 1000; prev = x.h; n++;
  }
  return n ? out : null;
}
// SIEMBRA
const S = ['2026-01-01T00:00:00.0000000Z ##[group]Run npm run meta:mutaciones', '2026-01-01T00:00:10.0000000Z   ✔ a.test.mjs · uno', '2026-01-01T00:00:40.0000000Z   ☠ b.test.mjs · dos', '2026-01-01T00:00:45.0000000Z   ✔ b.test.mjs · tres'].join('\n');
const r0 = reparto(S);
const semOk = r0 && r0['a.test.mjs'] === 10 && r0['b.test.mjs'] === 35;
console.log(`SIEMBRA ${semOk ? 'OK' : 'FALLA'} · reparto de 3 líneas fabricadas`);
if (!semOk) { console.log('CIEGO'); process.exit(3); }

const salida = [];
const p = (s) => { salida.push(s); console.log(s); };
const medias = {};
for (const [g, js] of Object.entries(grupos)) {
  const rs = [];
  for (const j of js) { const r = reparto(await bajar(j.job)); if (r) rs.push(r); }
  const tot = rs.map((r) => Object.values(r).reduce((a, b) => a + b, 0));
  medias[g] = {};
  for (const r of rs) for (const [f, s] of Object.entries(r)) medias[g][f] = (medias[g][f] ?? 0) + s / rs.length;
  p(`${g}: ${js.length} verdes (${js[0].creado} → ${js.at(-1).creado}) · leídos ${rs.length} · ficheros juzgados ${Object.keys(medias[g]).length} · paso meta:mutaciones de ${Math.min(...tot).toFixed(0)} a ${Math.max(...tot).toFixed(0)} s, media ${(tot.reduce((a, b) => a + b, 0) / tot.length).toFixed(0)} s`);
}
const A = medias.primeros, B = medias.ultimos;
const nuevos = Object.keys(B).filter((f) => !(f in A));
const idos = Object.keys(A).filter((f) => !(f in B));
const sumN = nuevos.reduce((a, f) => a + B[f], 0);
p(`ficheros que ENTRAN en el meta-guard: ${nuevos.length} · suman ${sumN.toFixed(0)} s de media`);
for (const f of nuevos.sort((a, b) => B[b] - B[a]).slice(0, 12)) p(`   +${B[f].toFixed(0).padStart(4)} s  ${f}`);
p(`ficheros que SALEN: ${idos.length} · suman ${idos.reduce((a, f) => a + A[f], 0).toFixed(0)} s`);
const comunes = Object.keys(B).filter((f) => f in A);
const dif = comunes.map((f) => [f, B[f] - A[f]]).sort((a, b) => b[1] - a[1]);
p(`ficheros en los dos: ${comunes.length} · su diferencia suma ${dif.reduce((a, [, d]) => a + d, 0).toFixed(0)} s · los 8 que más crecen:`);
for (const [f, d] of dif.slice(0, 8)) p(`   ${d >= 0 ? '+' : ''}${d.toFixed(0).padStart(4)} s  ${f}  (${A[f].toFixed(0)} → ${B[f].toFixed(0)})`);
fs.writeFileSync(path.join(carpeta, 'i-salida.txt'), salida.join('\n') + '\n');
console.log('EXIT=0');
