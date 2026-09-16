// scripts/censo-peso-prefijos.mjs — SCRUM-578 (CONT-05, punto a)
//
// ¿CABE EL SELECTOR DE PREFIJOS EN EL PRESUPUESTO DE PESO? (Parte AB · <1,5 s en 4G)
//
// Se mide el fichero REAL en disco y su tamaño COMPRIMIDO, que es lo que viaja por la red:
// medir el fichero sin comprimir daría un número que nadie descarga nunca.
//
// El presupuesto no es de este fichero solo, así que además se pone al lado el peso del
// dashboard entero — un número suelto no dice si algo «cabe».
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'public/dashboard/js');
const FICHERO = path.join(DIR, 'prefijosPais.js');

const kb = (n) => (n / 1024).toFixed(1) + ' KB';

const bytes = fs.readFileSync(FICHERO);
const gz = zlib.gzipSync(bytes, { level: 9 }).length;
const br = zlib.brotliCompressSync(bytes).length;

// SUELO: si el fichero no se lee o está vacío, no hay medición que dar.
if (bytes.length < 500) {
  console.log('⛔ NO SUPE MIRAR: prefijosPais.js pesa menos de 500 B. ¿Es el fichero correcto?');
  process.exit(2);
}

console.log('\nPESO DEL SELECTOR DE PREFIJOS (SCRUM-578 a)\n');
console.log(`  prefijosPais.js       ${String(bytes.length).padStart(7)} B   ${kb(bytes.length)}`);
console.log(`    gzip                ${String(gz).padStart(7)} B   ${kb(gz)}   <- lo que viaja`);
console.log(`    brotli              ${String(br).padStart(7)} B   ${kb(br)}`);

// Cuántos países lleva. DERIVADO DEL MÓDULO REAL, no de un regex sobre el fuente: la tabla son
// varias cadenas concatenadas con `+`, y mi primer contador por texto dio 5 de 200. Lo cazó el
// suelo de abajo, que por eso está antes de imprimir nada.
const { createRequire } = await import("node:module");
const mod = createRequire(import.meta.url)(FICHERO);
const paises = mod.listaDePrefijos().length;
console.log(`
  países en la lista (derivado del módulo, España incluida): ${paises}`);
if (paises < 150) { console.log("  ⛔ SUELO: la lista trae menos de 150 países. ¿Se ha recortado sin declararlo?"); process.exit(2); }
const dup = paises - new Set(mod.listaDePrefijos().map((x) => x.iso)).size;
if (dup > 0) { console.log(`  ⛔ SUELO: hay ${dup} ISO repetido(s) en la tabla`); process.exit(2); }
console.log("  suelo OK: la lista tiene tamaño y no repite ISO");

// El contexto: el dashboard entero.
let total = 0, totalGz = 0, n = 0;
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.js')) continue;
  const b = fs.readFileSync(path.join(DIR, f));
  total += b.length; totalGz += zlib.gzipSync(b, { level: 9 }).length; n += 1;
}
console.log(`\n  CONTEXTO — los ${n} scripts del dashboard: ${kb(total)} (gzip ${kb(totalGz)})`);
console.log(`  el selector es el ${((gz / totalGz) * 100).toFixed(1)} % del JS comprimido del panel`);

// 4G "lenta" del percentil que usan los guards del repo: 1,6 Mbps de bajada = 200 KB/s.
const KBPS = 200;
console.log(`\n  a 200 KB/s (4G lenta), ${kb(gz)} tardan ${((gz / 1024 / KBPS) * 1000).toFixed(0)} ms`);
console.log('  (presupuesto: <1.500 ms para la pantalla entera, no solo para esto)');
