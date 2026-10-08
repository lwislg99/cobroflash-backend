// SCRUM-1446b · COMPARA POR BYTES dos volcados de `volcar.mjs` (el árbol de antes y el de después).
//
//   node docs/master/evidencias/SCRUM-1446b/comparar.mjs antes.jsonl despues.jsonl
//
// El control que manda (SCRUM-1446 c.18865): con los tipos enteros —los que un cliente usa— TODO
// sale exactamente igual. Así que parte la población en dos: casos SIN 7,5 % (tienen que salir
// idénticos, byte a byte) y casos CON 7,5 % (los únicos que pueden cambiar).
// Sale 0 si ningún caso sin 7,5 % cambia; 1 si cambia alguno; 2 si no puede juzgar.
import fs from 'node:fs';

const [, , fa, fd] = process.argv;
const leer = (f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean);
const A = leer(fa); const D = leer(fd);
if (A.length === 0 || A.length !== D.length) {
  console.log(`CIEGO: los volcados no tienen los mismos casos (antes ${A.length}, después ${D.length}).`);
  process.exit(2);
}

const DECIMAL = 0.075;
const clases = new Map();
const ejemplos = [];
let malos = 0;
for (let i = 0; i < A.length; i++) {
  const a = JSON.parse(A[i]); const d = JSON.parse(D[i]);
  if (a.id !== d.id || JSON.stringify(a.tipos) !== JSON.stringify(d.tipos)) {
    console.log(`CIEGO: el caso ${i + 1} no es el mismo en los dos volcados (${a.id} / ${d.id}).`);
    process.exit(2);
  }
  const conDecimal = a.tipos.includes(DECIMAL);
  const igual = A[i] === D[i];   // la línea entera, byte a byte
  const k = `${a.clase} · ${conDecimal ? 'CON 7,5 %' : 'sin 7,5 %'}`;
  const c = clases.get(k) ?? { n: 0, distintos: 0, conDecimal };
  c.n += 1; if (!igual) c.distintos += 1;
  clases.set(k, c);
  if (!igual && !conDecimal) { malos += 1; if (ejemplos.length < 5) ejemplos.push([A[i], D[i]]); }
}

console.log(`casos comparados: ${A.length} · bytes: antes ${fs.statSync(fa).size}, después ${fs.statSync(fd).size}`);
console.log('clase                                             | casos | distintos');
let sinDecimal = 0; let conDecimalDistintos = 0; let conDecimalTotal = 0;
for (const [k, c] of [...clases].sort()) {
  console.log(`${k.padEnd(49)} | ${String(c.n).padStart(5)} | ${c.distintos}`);
  if (c.conDecimal) { conDecimalTotal += c.n; conDecimalDistintos += c.distintos; } else sinDecimal += c.n;
}
console.log(`SIN 7,5 % (0, 2, 4, 5, 10 y 21 %): ${sinDecimal} casos · distintos: ${malos}`);
console.log(`CON 7,5 %: ${conDecimalTotal} casos · distintos: ${conDecimalDistintos}`);
// Control positivo: si tampoco cambia NADA con 7,5 %, el comparador no ha visto el arreglo y su
// «0 distintos» de arriba no dice nada.
if (conDecimalDistintos === 0) {
  console.log('CIEGO: tampoco cambia ningún caso con 7,5 %. O no hay arreglo, o se compara un árbol consigo mismo.');
  process.exit(2);
}
for (const [a, d] of ejemplos) { console.log('  ANTES   ' + a.slice(0, 400)); console.log('  DESPUÉS ' + d.slice(0, 400)); }
console.log(malos === 0 ? 'VEREDICTO: los tipos enteros salen IDÉNTICOS.' : 'VEREDICTO: SE HA MOVIDO un caso sin 7,5 %.');
process.exit(malos === 0 ? 0 : 1);
