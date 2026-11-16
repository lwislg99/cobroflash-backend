// SCRUM-1716b · el descuento global se puede ESCRIBIR en %, y lo que se guarda sigue siendo el €.
// Enfoque E1-E5 en docs/master/SCRUM-1716.md §1716b. Rótulos R1-R5 firmados: SCRUM-1716 c.21704.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const D = require('../public/dashboard/js/quoteDescuentos.js');
const VISTA = readFileSync(new URL('../public/dashboard/js/quotesView.js', import.meta.url), 'utf8');

// Dos líneas al 21 %: 100 € con un 10 % de Dto. (90) y 3 × 9,99 (29,97). Base con Dto. = 119,97.
const LINEAS = [
  { qty: 1, price: 100, dto: 10, tax: 0.21 },
  { qty: 3, price: 9.99, dto: null, tax: 0.21 },
];

test('SCRUM-1716b · E1 · la base del % es la suma de líneas YA con su Dto., sin IVA, al céntimo', () => {
  // 10 % de 119,97 = 11,997 → 12,00. Sobre el precio de tarifa (129,97) serían 13,00; con IVA, 14,52.
  assert.deepEqual(D.descuentoGlobalDesdePorcentaje(LINEAS, '10'), { euros: 12, fueraDeRango: false });
  assert.deepEqual(D.descuentoGlobalDesdePorcentaje(LINEAS, '12,5'), { euros: 15, fueraDeRango: false },
    'la coma decimal se lee como en el resto de campos del dinero');
  // Y el € convertido es EXACTAMENTE lo que `totalesConDescuento` resta: la misma pieza de siempre.
  const T = D.totalesConDescuento(LINEAS, D.descuentoGlobalDesdePorcentaje(LINEAS, 10).euros);
  assert.equal(T.descuentoGlobalCents, 1200);
  assert.equal(T.baseImponibleCents, 11997 - 1200);
});

test('SCRUM-1716b · las cabeceras de apartado no cuentan en la base del %', () => {
  const conApartado = [{ apartado: true, qty: 1, price: 500, tax: 0.21 }, ...LINEAS];
  assert.equal(D.descuentoGlobalDesdePorcentaje(conApartado, 10).euros, 12);
});

test('SCRUM-1716b · E5 · por encima de 100 no se convierte; 100 sí', () => {
  assert.deepEqual(D.descuentoGlobalDesdePorcentaje(LINEAS, '100.01'), { euros: null, fueraDeRango: true });
  assert.deepEqual(D.descuentoGlobalDesdePorcentaje(LINEAS, 100), { euros: 119.97, fueraDeRango: false });
});

test('SCRUM-1716b · vacío, cero o sin líneas ⇒ sin descuento (no un 0 €)', () => {
  for (const v of ['', null, '0', '-5', 'abc']) {
    assert.deepEqual(D.descuentoGlobalDesdePorcentaje(LINEAS, v), { euros: null, fueraDeRango: false }, String(v));
  }
  assert.deepEqual(D.descuentoGlobalDesdePorcentaje([], 10), { euros: null, fueraDeRango: false });
});

test('SCRUM-1716b · los rótulos firmados (c.21704) están, y sólo ellos', () => {
  for (const literal of ['"€"', '"%"', '"En euros"', '"En porcentaje"', '"Equivale a "', '"El porcentaje no puede pasar de 100."']) {
    assert.ok(VISTA.includes(literal), `falta el literal firmado ${literal}`);
  }
});

test('SCRUM-1716b · E2/E4 · los totales y el envío leen el € CONVERTIDO, no lo tecleado', () => {
  // Si cualquiera de los dos volviera a leer `descuentoGlobalInput.value`, un «10» en % viajaría
  // como 10 € — el profesional vería una cifra y firmaría otra.
  assert.match(VISTA, /totalesConDescuento\(\s*lineasParaTotales,\s*descuentoGlobalInput \? descuentoGlobalEnEuros\(lineasParaTotales\) : null,?\s*\)/,
    'recalcTotals ya no pasa el € convertido a totalesConDescuento');
  assert.match(VISTA, /const descuentoGlobalElegido = descuentoGlobalEurosVigente;/,
    'el envío ya no lee el € convertido');
  assert.match(VISTA, /discountGlobalAmount: descuentoGlobalElegido,/, 'la clave del payload cambió (E4)');
  // Y antes de leerlo se recalcula (el € del momento de guardar) y se para un % > 100.
  const i = VISTA.indexOf('const descuentoGlobalElegido = descuentoGlobalEurosVigente;');
  const antes = VISTA.slice(i - 500, i);
  assert.match(antes, /recalcTotals\(\);/);
  assert.match(antes, /if \(descuentoGlobalFueraDeRango\)/);
});
