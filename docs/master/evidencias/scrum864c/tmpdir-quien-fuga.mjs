// ⛔ SÓLO LEE. ¿Quién sigue dejando restos DESPUÉS del arreglo de SCRUM-864 (16-sep-2026)?
// La pregunta que el registro de aquel ticket dejó sin responder: «si el arreglo reduce el montón
// en la práctica, eso sólo se ve dejando pasar unas cuantas tandas». Han pasado.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const TMP = os.tmpdir();
const NUESTROS = /^(yaqu-|scrum\d|cobaya-|recorre\d|impeccable-)/i;
const ahora = Date.now();
const H = 3600000, D = 86400000;
const tramos = [
  ['ultima HORA', 1 * H], ['ultimas 6 h', 6 * H], ['ultimas 24 h', 1 * D],
  ['ultimos 2 d', 2 * D], ['desde el 16-sep (SCRUM-864)', 1.7 * D],
];
const porPrefijo = new Map();
let total = 0;
for (const x of fs.readdirSync(TMP, { withFileTypes: true })) {
  if (!x.isDirectory() || !NUESTROS.test(x.name)) continue;
  let m; try { m = fs.statSync(path.join(TMP, x.name)).mtimeMs; } catch { continue; }
  total++;
  const pre = (x.name.match(/^([a-zA-Z]+[0-9]*)/) || [, '?'])[1].toLowerCase();
  if (!porPrefijo.has(pre)) porPrefijo.set(pre, { total: 0, edad: [] });
  const p = porPrefijo.get(pre);
  p.total++; p.edad.push(ahora - m);
}
console.log('restos nuestros con fecha legible:', total);
console.log('');
console.log('prefijo      total   ' + tramos.map(([n]) => n.padStart(12)).join(''));
const filas = [...porPrefijo].sort((a, b) => b[1].total - a[1].total);
for (const [pre, p] of filas) {
  const cols = tramos.map(([, ms]) => String(p.edad.filter((e) => e < ms).length).padStart(12));
  console.log(pre.padEnd(12) + String(p.total).padStart(6) + '   ' + cols.join(''));
}
console.log('');
const enTramo = (ms) => filas.reduce((n, [, p]) => n + p.edad.filter((e) => e < ms).length, 0);
for (const [n, ms] of tramos) console.log((n + ':').padEnd(32) + String(enTramo(ms)).padStart(7));
