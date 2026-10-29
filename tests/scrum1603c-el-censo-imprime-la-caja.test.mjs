// tests/scrum1603c-el-censo-imprime-la-caja.test.mjs — SCRUM-1603c
//
// `censo:tactil-panel` imprime la CAJA además del toque. La aceptación de SCRUM-1603 pide la caja de
// `.input` en Clientes y el censo sólo imprimía el área de toque: «39» se podía leer como la caja y
// no lo era. Aquí se ata la forma de imprimirlas y el camino de vuelta con el que el censo controla,
// sobre su sonda tapada, que las dos cifras salen distintas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cortosDistintos, cajaYToque, leerCajaYToque } from '../scripts/_censo-distintos.mjs';

test('la línea dice las DOS cifras, cada una con su palabra', () => {
  assert.equal(cajaYToque({ caja: 34, tocable: 39 }), 'caja 34 · toque 39');
});

test('CONTROL · ida y vuelta: lo leído de la línea es la caja y el toque, no el toque dos veces', () => {
  assert.deepEqual(leerCajaYToque(cajaYToque({ caja: 40, tocable: 29.4 })), { caja: 40, tocable: 29.4 });
});

test('CONTROL · el mutante que imprime el toque dos veces se lee DISTINTO de la sonda tapada', () => {
  const mutante = (m) => `caja ${m.tocable} · toque ${m.tocable}`;
  const leida = leerCajaYToque(mutante({ caja: 40, tocable: 30 }));
  assert.notEqual(leida.caja, 40, 'el censo no podría distinguir la caja del toque');
});

test('una línea sin las dos cifras no se lee como medida', () => {
  assert.equal(leerCajaYToque('toque 39'), null);
});

test('un distinto lleva la caja DE LA MISMA medida que dio el toque mínimo', () => {
  const d = cortosDistintos([
    { fn: 'renderCustomersView', ancho: 929, medidos: [{ i: 3, sel: 'INPUT.input', texto: '', caja: 38, tocable: 39, cumple: false }] },
    { fn: 'renderCustomersView', ancho: 390, medidos: [{ i: 3, sel: 'INPUT.input', texto: '', caja: 34, tocable: 34.6, cumple: false }] },
  ]);
  const v = [...d.values()][0];
  assert.equal(d.size, 1);
  assert.equal(v.tocable, 34.6);
  assert.equal(v.caja, 34);
});
