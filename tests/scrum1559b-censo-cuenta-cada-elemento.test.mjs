// tests/scrum1559b-censo-cuenta-cada-elemento.test.mjs — SCRUM-1559b
//
// `censo:tactil-panel` cuenta como DISTINTOS los elementos, no las combinaciones selector+texto.
// Antes los tres «💬» de Clientes —tres botones, tres sitios donde el dedo falla— contaban uno.
// Los dos controles: el mismo elemento a dos anchos sigue siendo UNO, y un medido sin posición
// revienta en vez de colarse con una clave inventada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cortosDistintos } from '../scripts/_censo-distintos.mjs';

const corto = (i, texto, tocable = 37) => ({ i, sel: 'A.contacto-link', texto, tocable, cumple: false });

test('tres elementos iguales (selector y texto) en la misma pantalla son TRES distintos', () => {
  const d = cortosDistintos([{ fn: 'renderCustomersView', ancho: 929, medidos: [corto(4, '💬'), corto(9, '💬'), corto(14, '💬')] }]);
  assert.equal(d.size, 3);
});

test('CONTROL · el mismo elemento corto a dos anchuras es UNO, con su área mínima', () => {
  const d = cortosDistintos([
    { fn: 'renderCustomersView', ancho: 929, medidos: [corto(4, '💬', 37)] },
    { fn: 'renderCustomersView', ancho: 390, medidos: [corto(4, '💬', 31)] },
  ]);
  assert.equal(d.size, 1);
  assert.equal([...d.values()][0].tocable, 31);
});

test('CONTROL · la misma posición en DOS pantallas son dos elementos', () => {
  const d = cortosDistintos([
    { fn: 'renderInvoicesView', ancho: 929, medidos: [corto(0, '⬇ CSV')] },
    { fn: 'renderQuotesListView', ancho: 929, medidos: [corto(0, '⬇ CSV')] },
  ]);
  assert.equal(d.size, 2);
});

test('CONTROL · lo que cumple no se cuenta', () => {
  const d = cortosDistintos([{ fn: 'v', ancho: 929, medidos: [{ i: 0, sel: 'A', texto: 'x', tocable: 45, cumple: true }] }]);
  assert.equal(d.size, 0);
});

test('un medido SIN posición revienta: no se adivina la identidad', () => {
  assert.throws(() => cortosDistintos([{ fn: 'v', ancho: 929, medidos: [{ sel: 'A', texto: 'x', tocable: 30, cumple: false }] }]), /sin posición/);
});
