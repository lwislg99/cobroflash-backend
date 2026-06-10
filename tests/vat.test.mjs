// Tests del desglose de IVA repercutido (modelo 303 / VeriFactu). Sprint SPAIN.
import test from 'node:test';
import assert from 'node:assert/strict';
import { calcVatBreakdown, calcVatCuotaTotal } from '../dist/modules/invoicing/domain/vat.service.js';

test('calcVatBreakdown: agrupa por tipo y calcula base + cuota', () => {
  const r = calcVatBreakdown([
    { concept: 'mano de obra', qty: 4, price: 45, tax: 0.21 },   // base 180, cuota 37.80
    { concept: 'materiales',   qty: 1, price: 100, tax: 0.21 },  // base 100, cuota 21
    { concept: 'libro',        qty: 1, price: 50, tax: 0.04 },   // base 50, cuota 2
    { concept: 'exento',       qty: 1, price: 30 },              // base 30, 0%
  ]);
  assert.deepEqual(r.entries, [
    { rate: 21, base: 280, cuota: 58.8 },
    { rate: 4,  base: 50,  cuota: 2 },
    { rate: 0,  base: 30,  cuota: 0 },
  ]);
  assert.equal(r.base, 360);
  assert.equal(r.cuota, 60.8);
});

test('calcVatBreakdown: líneas en negativo (rectificativa) restan', () => {
  const r = calcVatBreakdown([{ qty: 1, price: -100, tax: 0.21 }]);
  assert.deepEqual(r.entries, [{ rate: 21, base: -100, cuota: -21 }]);
  assert.equal(r.cuota, -21);
});

test('calcVatBreakdown: vacío / null → todo a 0', () => {
  assert.deepEqual(calcVatBreakdown([]), { entries: [], base: 0, cuota: 0 });
  assert.deepEqual(calcVatBreakdown(null), { entries: [], base: 0, cuota: 0 });
});

test('calcVatCuotaTotal: suma de cuotas con redondeo a 2 decimales', () => {
  assert.equal(calcVatCuotaTotal([{ qty: 3, price: 9.99, tax: 0.21 }]), 6.29); // 29.97*0.21=6.2937
  assert.equal(calcVatCuotaTotal([]), 0);
});
