// tests/scrum609-margen-catalogo.test.mjs — SCRUM-609 (CAT-01)
//
// EL MARGEN DEL CATÁLOGO, y sobre todo LA CONVENCIÓN: se calcula sobre PRECIO DE VENTA.
//
// 🔴 POR QUÉ SE PRUEBA AQUÍ Y NO EN NAVEGADOR: los nueve guards no cubren el dashboard
// (SCRUM-628). Por eso la aritmética vive en `margenCatalogo.js` sin DOM: para que esta pantalla
// tenga red en `npm test`, que es donde la hay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const M = require(path.join(RAIZ, 'public/dashboard/js/margenCatalogo.js'));

test('SCRUM-609 · 🔴 EL CASO DEL TICKET: 300/1000 son 70 %, NO 233,3 %', () => {
  // Es la decisión del fundador (24-ago-2026) y el número que distingue las dos convenciones.
  // Si alguien cambia el divisor, este assert lo dice con los DOS números delante.
  const m = M.margenDesde(300, 1000);
  assert.equal(m, 70,
    `🔴 el margen de coste 300 y precio 1000 ha salido ${m}, y tiene que ser 70.\n`
    + '  Si ha salido 233.33, se está dividiendo entre el COSTE en vez de entre el PRECIO DE\n'
    + '  VENTA. Es la convención que decidió el fundador: margen = (precio − coste) / precio × 100.\n'
    + '  El mismo artículo da 70 % sobre precio y 233,3 % sobre coste — no es un redondeo, es\n'
    + '  otra magnitud.');
  assert.notEqual(m, 233.33, '🔴 se está calculando sobre el coste.');
});

test('SCRUM-609 · 🔴 coste 0 con precio > 0 → margen 100 %', () => {
  // No es un caso escrito a mano: sale solo de (P−0)/P = 1. Y es el que confirma la convención,
  // porque sobre COSTE habría que dividir entre 0.
  assert.equal(M.margenDesde(0, 500), 100,
    '🔴 con coste 0 y precio 500 el margen tiene que ser 100 %. Si sale infinito o NaN, se está\n'
    + '  dividiendo entre el coste.');
});

test('SCRUM-609 · 🔴 CONTROL NEGATIVO: sólo precio NO autocompleta NADA, y es VÁLIDO', () => {
  // Medido en este mismo ticket: 8 de 8 productos de hoy NO tienen coste. Si el margen se
  // volviera obligatorio o el formulario rellenara algo por su cuenta, el catálogo que ya existe
  // dejaría de poder guardarse igual que antes.
  assert.equal(M.margenDesde(null, 500), null, '🔴 sin coste se ha inventado un margen.');
  assert.equal(M.margenDesde('', 500), null, '🔴 con coste vacío se ha inventado un margen.');

  const r = M.autocompletar({ coste: '', precio: '500', margen: '' }, 'precio');
  assert.deepEqual(r, { precio: null, margen: null },
    `🔴 con SÓLO precio el autocompletado ha escrito algo: ${JSON.stringify(r)}.\n`
    + '  «Sólo precio» es un caso válido, no un formulario a medias. Un 0 ahí sería DECLARAR que\n'
    + '  no hay margen, y eso no lo ha dicho nadie.');
});

test('SCRUM-609 · el autocompletado va en las dos direcciones', () => {
  // coste + margen → precio
  assert.equal(M.precioDesde(300, 70), 1000, '🔴 coste 300 y margen 70 % tienen que dar precio 1000.');
  assert.deepEqual(M.autocompletar({ coste: '300', precio: '', margen: '70' }, 'margen'),
    { precio: 1000, margen: null }, '🔴 al teclear el margen no se ha derivado el precio.');

  // coste + precio → margen
  assert.deepEqual(M.autocompletar({ coste: '300', precio: '1000', margen: '' }, 'precio'),
    { precio: null, margen: 70 }, '🔴 al teclear el precio no se ha derivado el margen.');
});

test('SCRUM-609 · nunca se pisa el campo que el usuario acaba de teclear', () => {
  // Pisar lo que alguien está escribiendo es como se pierde un número a medio teclear.
  const r1 = M.autocompletar({ coste: '300', precio: '1000', margen: '' }, 'precio');
  assert.equal(r1.precio, null, '🔴 se ha reescrito el PRECIO justo cuando el usuario lo tecleaba.');
  const r2 = M.autocompletar({ coste: '300', precio: '', margen: '70' }, 'margen');
  assert.equal(r2.margen, null, '🔴 se ha reescrito el MARGEN justo cuando el usuario lo tecleaba.');
});

test('SCRUM-609 · un margen imposible no devuelve un infinito disfrazado', () => {
  // m = 100 % exige coste 0; por encima, ningún precio lo cumple. `null` es «no se sabe».
  assert.equal(M.precioDesde(300, 100), null, '🔴 con margen 100 % y coste 300 se ha inventado un precio.');
  assert.equal(M.precioDesde(300, 150), null, '🔴 con margen 150 % se ha inventado un precio.');
  assert.equal(M.margenDesde(300, 0), null, '🔴 con precio 0 se ha dividido entre cero.');
});
