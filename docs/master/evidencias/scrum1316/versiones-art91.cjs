// SCRUM-1316 ② · Qué dice HOY el BOE consolidado del art. 91.Uno.2.10.º LIVA, versión a versión.
//
// uso: node versiones-art91.cjs <LIVA.xml> [idBloque=a91] [cuantas=4]
//   <LIVA.xml> es la respuesta de
//   https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/BOE-A-1992-28740/texto
//
// Imprime, de las últimas versiones del bloque: la norma que la introduce, su fecha de publicación,
// su fecha_vigencia, la primera nota al pie (que es la que dice «con efectos de…») y el número 10.º
// del apartado Uno.2 entero.
//
// 🔴 NO corta por fecha_vigencia, a propósito. La versión del RDL 29/2026 trae
// fecha_vigencia="20261008" y sus efectos son del 1-dic-2026: quien corte por esa fecha lee, desde el
// 8-oct, una redacción que todavía no se aplica. Aquí se imprimen las dos fechas y la nota, y decide
// quien lee.
//
// Sale con 2 si no puede mirar (sin fichero, sin bloque, sin versiones o sin el 10.º): un cero de
// algo que no se pudo leer no es un resultado.
const fs = require('fs');
const [f, id = 'a91', cuantas = '4'] = process.argv.slice(2);
if (!f || !fs.existsSync(f)) { console.error('CIEGO: falta el XML'); process.exit(2); }
const x = fs.readFileSync(f, 'utf8');
const i = x.indexOf(`<bloque id="${id}"`);
if (i < 0) { console.error('CIEGO: no existe el bloque', id); process.exit(2); }
const b = x.slice(i, x.indexOf('</bloque>', i));
const attr = (s, n) => (s.match(new RegExp('\\b' + n + '="([^"]*)"')) || [])[1] || '';
const ents = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&apos;': "'" };
const plano = (s) => s.replace(/<[^>]+>/g, '').replace(/&\w+;/g, (e) => ents[e] || e).replace(/\s+/g, ' ').trim();
const vs = [...b.matchAll(/<version\b([^>]*)>([\s\S]*?)<\/version>/g)];
if (!vs.length) { console.error('CIEGO: el bloque no tiene versiones'); process.exit(2); }
console.log(`POBLACION: bloque ${id} · ${vs.length} versiones · fichero de ${Buffer.byteLength(x)} bytes`);
let sinDiez = 0;
for (const v of vs.slice(-Number(cuantas))) {
  const ps = [...v[2].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) => plano(m[1])).filter(Boolean);
  const nota = [...v[2].matchAll(/<blockquote>([\s\S]*?)<\/blockquote>/g)].map((m) => plano(m[1])).pop() || '';
  // el 10.º del apartado Uno.2: desde «10.º Las ejecuciones de obra de renovación…» hasta el 11.º
  const a = ps.findIndex((p) => /^10\.º\s+Las ejecuciones de obra de renovaci/.test(p));
  const z = a < 0 ? -1 : ps.findIndex((p, k) => k > a && /^11\.º\s/.test(p));
  console.log('\n=== VERSION ' + attr(v[1], 'id_norma') + ' · publicada ' + attr(v[1], 'fecha_publicacion') +
    ' · fecha_vigencia ' + attr(v[1], 'fecha_vigencia'));
  console.log('NOTA (primera frase): ' + nota.split(/(?<=Ref\. BOE-A-\d{4}-\d+(?:#[\w-]+)?)\s/)[0]);
  if (a < 0 || z < 0) { sinDiez++; console.log('10.º: NO ENCONTRADO'); continue; }
  for (const p of ps.slice(a, z)) console.log('  | ' + p);
  console.log('CONDICION DEL MEDIO DE PAGO: ' + (ps.slice(a, z).some((p) => p.includes('cheque nominativo')) ? 'SI' : 'no'));
}
if (sinDiez) { console.error(`CIEGO: ${sinDiez} version(es) sin el 10.º`); process.exit(2); }
