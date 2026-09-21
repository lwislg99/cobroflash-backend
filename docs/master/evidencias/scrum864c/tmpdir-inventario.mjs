// ⛔ SÓLO LEE. No borra, no abre, no escribe nada dentro de TMPDIR.
// Inventario del directorio compartido por los ~26 worktrees: cuántas entradas, cuántas nuestras
// y de qué edad. El ticket trae la cifra del 16-sep y nadie la ha vuelto a contar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const TMP = os.tmpdir();
const NUESTROS = /^(yaqu-|scrum\d|cobaya-|recorre\d|impeccable-)/i;
const t0 = Date.now();
const e = fs.readdirSync(TMP, { withFileTypes: true });
const ahora = Date.now();
const dias = (ms) => (ahora - ms) / 86400000;
let nuestros = 0, ajenos = 0, dirs = 0, sinStat = 0;
const porPrefijo = new Map();
const edades = [];
for (const x of e) {
  if (!x.isDirectory()) { ajenos++; continue; }
  dirs++;
  if (!NUESTROS.test(x.name)) { ajenos++; continue; }
  nuestros++;
  const pre = (x.name.match(/^([a-zA-Z]+[0-9]*)/) || [, '?'])[1].toLowerCase();
  porPrefijo.set(pre, (porPrefijo.get(pre) || 0) + 1);
  try { edades.push(dias(fs.statSync(path.join(TMP, x.name)).mtimeMs)); } catch { sinStat++; }
}
edades.sort((a, b) => a - b);
const pct = (p) => (edades.length ? edades[Math.min(edades.length - 1, Math.floor(edades.length * p))].toFixed(2) : 'n/a');
console.log('TMPDIR              :', TMP);
console.log('entradas totales    :', e.length, ' (directorios:', dirs + ')');
console.log('NUESTROS (prefijo)  :', nuestros);
console.log('ajenos / no-dir     :', ajenos, ' sin stat:', sinStat);
console.log('edad mtime (dias)   : min', pct(0), '| mediana', pct(0.5), '| p90', pct(0.9), '| max', edades.length ? edades[edades.length-1].toFixed(2) : 'n/a');
console.log('menos de 1 dia      :', edades.filter((d) => d < 1).length);
console.log('menos de 1 HORA     :', edades.filter((d) => d < 1/24).length);
console.log('por prefijo (top 12):');
for (const [k, v] of [...porPrefijo].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log('   ' + String(v).padStart(6) + ' · ' + k);
console.log('coste del recorrido :', Date.now() - t0, 'ms');
