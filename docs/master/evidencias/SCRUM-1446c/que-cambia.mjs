// Para cada caso distinto entre dos volcados: qué TROZOS cambian, carácter a carácter.
// Uso: node que-cambia.mjs antes.jsonl despues.jsonl
import fs from 'node:fs';
const [a, b] = process.argv.slice(2).map((f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean));
if (a.length !== b.length) { console.log('CIEGO: distinto número de casos', a.length, b.length); process.exit(2); }

// Prefijo y sufijo comunes de dos cadenas; lo de en medio es el cambio.
function trozo(x, y) {
  let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++;
  let j = 0; while (j < x.length - i && j < y.length - i && x[x.length - 1 - j] === y[y.length - 1 - j]) j++;
  return [x.slice(i, x.length - j), y.slice(i, y.length - j)];
}
// Hojas de un JSON, con su ruta.
function hojas(o, ruta, out) {
  if (o !== null && typeof o === 'object') { for (const k of Object.keys(o)) hojas(o[k], ruta + '/' + k, out); }
  else out.push([ruta, String(o)]);
  return out;
}

let distintos = 0, hojasDistintas = 0, estructura = 0;
const pares = new Map();      // «antes → después» del trozo mínimo, con su recuento
const rutas = new Map();      // en qué campo cae (índices numéricos plegados)
const ejemplos = [];
for (let n = 0; n < a.length; n++) {
  if (a[n] === b[n]) continue;
  distintos++;
  const ha = hojas(JSON.parse(a[n]), '', []), hb = hojas(JSON.parse(b[n]), '', []);
  if (ha.length !== hb.length) { estructura++; continue; }
  for (let k = 0; k < ha.length; k++) {
    if (ha[k][0] !== hb[k][0]) { estructura++; break; }
    if (ha[k][1] === hb[k][1]) continue;
    hojasDistintas++;
    const [x, y] = trozo(ha[k][1], hb[k][1]);
    const clave = JSON.stringify(x) + ' -> ' + JSON.stringify(y);
    pares.set(clave, (pares.get(clave) || 0) + 1);
    const r = ha[k][0].replace(/\/\d+/g, '/#');
    rutas.set(r, (rutas.get(r) || 0) + 1);
    if (ejemplos.length < 6) ejemplos.push([ha[k][0], ha[k][1], hb[k][1]]);
  }
}
console.log('casos:', a.length, '· distintos:', distintos, '· con otra ESTRUCTURA (campos o líneas de más o de menos):', estructura);
console.log('hojas distintas:', hojasDistintas);
console.log('\nTROZO MÍNIMO QUE CAMBIA (antes -> después) · veces');
for (const [k, v] of [...pares].sort((p, q) => q[1] - p[1])) console.log('  ' + k + ' · ' + v);
console.log('\nEN QUÉ CAMPO');
for (const [k, v] of [...rutas].sort((p, q) => q[1] - p[1])) console.log('  ' + k + ' · ' + v);
console.log('\nEJEMPLOS (campo · antes · después)');
for (const e of ejemplos) console.log('  ' + e[0] + '\n    - ' + e[1] + '\n    + ' + e[2]);
if (distintos === 0) { console.log('\nCIEGO: no cambia nada.'); process.exit(2); }
