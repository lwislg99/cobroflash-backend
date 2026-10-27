// docs/master/evidencias/SCRUM-1503/por-que-no-entra.mjs — SCRUM-1503
//
// ¿Por qué `scrum622` no entra en la dirigida? Se pasa por el lector REAL de la herramienta
// (`leerFuente`) el fuente del test TAL CUAL, y tres variantes fabricadas EN MEMORIA (no se
// escribe nada en el árbol) que sólo cambian CÓMO se llama al caminante:
//
//   A · tal cual                        (function anda(dir) { … })(RAIZ);
//   B · declarada y llamada por nombre  function anda(dir) { … }  anda(RAIZ);
//   C · como A, pero con el directorio escrito: (function anda(dir) { … })(path.join(RAIZ, 'docs'));
//   D · como B, con el directorio escrito:      function anda(dir) { … }  anda(path.join(RAIZ, 'docs'));
//
// Si A y C no dejan rastro y B y D sí, la causa es la FORMA de la llamada (una función que se
// invoca en el sitio no es un identificador), no que el test barra el árbol.
//
// Sólo LEE. Primera línea: población. Última: EXIT.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFuente } from '../../../../scripts/_tests-que-cubren.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const REL = process.argv[2] || 'tests/scrum622-desconocido-no-es-verde.test.mjs';
const original = fs.readFileSync(path.join(RAIZ, REL), 'utf8');

const ABRE = '(function anda(dir) {';
const CIERRA = '})(RAIZ);';
const cuantas = (s, trozo) => s.split(trozo).length - 1;
console.log(`POBLACION: 1 fuente (${REL}, ${original.length} caracteres) · «${ABRE}» aparece ${cuantas(original, ABRE)} vez · «${CIERRA}» aparece ${cuantas(original, CIERRA)} vez`);
if (cuantas(original, ABRE) !== 1 || cuantas(original, CIERRA) !== 1) {
  console.log('CIEGO: el fuente ya no tiene la forma que este guion sabe variar.');
  console.log('EXIT=2');
  process.exit(2);
}

const variantes = {
  'A · tal cual (se invoca en el sitio, con RAIZ)': original,
  'B · declarada y llamada por nombre, con RAIZ': original.replace(ABRE, 'function anda(dir) {').replace(CIERRA, '}\n  anda(RAIZ);'),
  'C · se invoca en el sitio, con docs escrito': original.replace(CIERRA, "})(path.join(RAIZ, 'docs'));"),
  'D · declarada y llamada por nombre, con docs escrito': original.replace(ABRE, 'function anda(dir) {').replace(CIERRA, "}\n  anda(path.join(RAIZ, 'docs'));"),
};

let distintas = 0;
for (const [nombre, codigo] of Object.entries(variantes)) {
  const cambiada = codigo !== original;
  if (cambiada) distintas += 1;
  const d = leerFuente(REL, codigo, RAIZ);
  console.log(`\n${nombre}`);
  console.log(`   el texto cambia respecto al original: ${cambiada}`);
  console.log(`   directorios listados: ${[...d.listados].join(' | ') || '(ninguno)'}`);
  console.log(`   no-se: ${d.noSe.map((n) => `linea ${n.linea} ${n.que}`).join(' | ') || '(ninguno)'}`);
  console.log(`   caminantes que declara: ${[...d.caminantes.keys()].join(', ') || '(ninguno)'}`);
}
// B, C y D tienen que ser texto DISTINTO: una sustitución que no sustituye da el mismo resultado
// que una que no cambia nada.
const salida = distintas === 3 ? 0 : 2;
console.log(`\nvariantes cuyo texto cambia: ${distintas} de 3 esperadas`);
console.log(`EXIT=${salida}`);
process.exit(salida);
