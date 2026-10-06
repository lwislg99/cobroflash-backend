// docs/master/evidencias/SCRUM-1405/sembrar-rojos.mjs — SCRUM-1405
//
// SIEMBRA ROJOS EN UNA COPIA DESECHABLE DEL ÁRBOL (la del runner del experimento), para que el
// contraste con/sin `--test-force-exit` se haga sobre una tanda que tiene rojos además de verdes.
// El experimento del 1-oct no tenía ninguno, y lo que importa es el VEREDICTO, no el recuento.
//
// ⛔ No se lanza en un árbol de trabajo: exige `--runner <ruta>` y que esa ruta sea un checkout
// con `tests/`. Los ficheros que crea NO se comitean nunca (empiezan por `zz1405-`).
//
// Qué siembra, en <ruta>/tests/:
//   zz1405-rojo-suelto          3 casos, cae 1. Pequeño: su informe cabe entero en la tubería.
//   zz1405-rojo-en-la-cola      80 casos síncronos con relleno, cae el ÚLTIMO, y cada caso deja
//                               testigo (COBAYA_TESTIGO). Es la cobaya grande dentro de la tanda.
//   zz1405-copia-de-<x>         copia literal de tres de los ficheros que más pierden, con UN caso
//                               rojo añadido al final. El original no se toca (c.17951): la copia
//                               es otro fichero, y el rojo está donde se pierde, en la cola.
import fs from 'node:fs';
import path from 'node:path';

const i = process.argv.indexOf('--runner');
const raiz = i === -1 ? null : path.resolve(process.argv[i + 1] || '');
if (!raiz || !fs.existsSync(path.join(raiz, 'tests')) || !fs.existsSync(path.join(raiz, 'package.json'))) {
  console.error('uso: node sembrar-rojos.mjs --runner <raíz de un checkout DESECHABLE>');
  process.exit(2);
}
const tests = path.join(raiz, 'tests');

const SUELTO = `import test from 'node:test';
import assert from 'node:assert/strict';
test('zz1405 · suelto · verde uno', () => { assert.equal(1, 1); });
test('zz1405 · suelto · ROJO SEMBRADO', () => { assert.equal(1, 2, 'rojo sembrado (suelto)'); });
test('zz1405 · suelto · verde dos', () => { assert.equal(2, 2); });
`;

const COLA = `import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const TESTIGO = process.env.COBAYA_TESTIGO;
const RELLENO = 'x'.repeat(600);
for (let i = 1; i <= 80; i++) {
  const n = String(i).padStart(3, '0');
  test(\`zz1405 · cola · caso \${n} \${RELLENO}\`, () => {
    if (TESTIGO) fs.appendFileSync(TESTIGO, \`cola \${n}\\n\`);
    assert.notEqual(i, 80, 'rojo sembrado (el último de la cola)');
  });
}
`;

const COPIAS = ['scrum834-puerta-avisador-rojo', 'vigia-atascados', 'scrum524b-trinquete-de-la-tabla'];
const ROJO_FINAL = (de) => `

// ── añadido por sembrar-rojos.mjs (SCRUM-1405): el rojo en la cola de la COPIA ──
{
  const { default: testDe1405 } = await import('node:test');
  const { default: assertDe1405 } = await import('node:assert/strict');
  testDe1405('zz1405 · copia de ${de} · ROJO SEMBRADO AL FINAL', () => { assertDe1405.equal(1, 2, 'rojo sembrado (cola de la copia)'); });
}
`;

const escritos = [];
const escribir = (nombre, texto) => { fs.writeFileSync(path.join(tests, nombre), texto); escritos.push(nombre); };
escribir('zz1405-rojo-suelto.test.mjs', SUELTO);
escribir('zz1405-rojo-en-la-cola.test.mjs', COLA);
for (const de of COPIAS) {
  const origen = path.join(tests, `${de}.test.mjs`);
  if (!fs.existsSync(origen)) { console.error(`🔴 no existe ${origen}: no siembro a medias`); process.exit(1); }
  escribir(`zz1405-copia-de-${de}.test.mjs`, fs.readFileSync(origen, 'utf8') + ROJO_FINAL(de));
}
console.log(`sembrados ${escritos.length} ficheros en ${tests}:`);
for (const n of escritos) console.log(`  ${n} · ${fs.statSync(path.join(tests, n)).size} bytes`);
console.log('rojos sembrados, como mínimo: 5 (suelto 1 · cola 1 · copias 3). Las copias pueden traer más: son copias de guards.');
