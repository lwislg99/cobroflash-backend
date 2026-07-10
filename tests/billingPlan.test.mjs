// tests/billingPlan.test.mjs — SCRUM-32: reparto EXACTO de tramos (el último absorbe el resto).
// Invariante: céntimos enteros + suma de tramos == total, EXACTA (par e impar). Puro, no toca BD.
import test from 'node:test';
import assert from 'node:assert/strict';

const { distributeStageAmounts, getStageAmount, getBillingPlan } = await import('../dist/modules/quotes/domain/billingPlan.js');

const toCents = (a) => a.map((x) => Math.round(x * 100));
const sumCents = (a) => toCents(a).reduce((s, x) => s + x, 0);

test('SCRUM-32: FIFTY_FIFTY impar 100,01 → [50,01 , 50,00] y suma EXACTA', () => {
  const a = distributeStageAmounts('100.01', getBillingPlan('FIFTY_FIFTY'));
  assert.deepEqual(toCents(a), [5001, 5000]);
  assert.equal(sumCents(a), 10001);
});

test('SCRUM-32: FIFTY_FIFTY impar 151,25 → [75,63 , 75,62] y suma EXACTA (el bug real)', () => {
  const a = distributeStageAmounts('151.25', getBillingPlan('FIFTY_FIFTY'));
  assert.deepEqual(toCents(a), [7563, 7562]);
  assert.equal(sumCents(a), 15125); // NO 15126
});

test('SCRUM-32: FIFTY_FIFTY par 100,00 → [50,00 , 50,00]', () => {
  assert.deepEqual(toCents(distributeStageAmounts('100.00', getBillingPlan('FIFTY_FIFTY'))), [5000, 5000]);
});

test('SCRUM-32: FULL_UPFRONT → un tramo == total (impar incluido)', () => {
  const a = distributeStageAmounts('100.01', getBillingPlan('FULL_UPFRONT'));
  assert.deepEqual(toCents(a), [10001]);
  assert.equal(sumCents(a), 10001);
});

test('SCRUM-32: MANUAL/[] → sin tramos', () => {
  assert.deepEqual(distributeStageAmounts('100.01', getBillingPlan('MANUAL')), []);
  assert.deepEqual(distributeStageAmounts('100.01', getBillingPlan('SIN_CONDICIONES')), []);
});

test('SCRUM-32: getStageAmount indexa el reparto — el 2º tramo es el RESTO', () => {
  assert.equal(getStageAmount('151.25', 'FIFTY_FIFTY', 0), 75.63);
  assert.equal(getStageAmount('151.25', 'FIFTY_FIFTY', 1), 75.62); // el resto, no 75,63
  assert.equal(getStageAmount('100.01', 'FIFTY_FIFTY', 0), 50.01);
  assert.equal(getStageAmount('100.01', 'FIFTY_FIFTY', 1), 50.00);
});

test('SCRUM-32: invariante general — suma == total en muchos impares', () => {
  for (const euros of [10.01, 33.33, 99.99, 151.25, 200.01, 1234.57]) {
    const a = distributeStageAmounts(String(euros), getBillingPlan('FIFTY_FIFTY'));
    assert.equal(sumCents(a), Math.round(euros * 100), `suma exacta para ${euros}`);
  }
});
