// tests/scrum1047-beneficio-sobre-la-base.test.mjs — SCRUM-1047 (CON-06)
//
// EL BENEFICIO SOBRE LA BASE, sin gate: función pura, ni BD ni red.
//
// El caso del ticket, calculado A MANO: factura base 1.000 con IVA 210 (total 1.210) y gasto
// base 300 con IVA 63 (amount 363, el TOTAL con IVA desde SCRUM-324) → beneficio sobre la base =
// 700, «con IVA» = 1.210 y 363 por separado.
//
// Y los dos huecos que NO se inventan (misma decisión que sus precedentes en la casa):
//   · factura sin líneas desglosables → excluida de la base, declarada en `revenueSinDesglose`
//     (el mismo criterio que `GET /admin/reports/vat` usa para `excluded`).
//   · gasto sin `baseAmount` → excluido de la base, declarado en `expensesSinClasificar` (la
//     misma decisión que `libroRecibidas.ts`, confirmada en staging por SCRUM-1037 letra d).
import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularBeneficioSobreLaBase } from '../dist/modules/reports/domain/beneficioBaseImponible.js';

test('el caso del ticket, calculado a mano: 1.000/210 de ingreso y 300/63 de gasto → beneficio base 700', () => {
  const r = calcularBeneficioSobreLaBase({
    invoices: [{ total: '1210.00', lines: [{ qty: 1, price: 1000, tax: 0.21 }] }],
    expenses: [{ amount: '363.00', baseAmount: '300.00' }],
  });
  assert.equal(r.revenueBase, 1000);
  assert.equal(r.revenueWithVat, 1210);
  assert.equal(r.expensesBase, 300);
  assert.equal(r.expensesWithVat, 363);
  assert.equal(r.profitBase, 700, '🔴 el beneficio tiene que salir sobre la BASE, no sobre el total con IVA');
  assert.deepEqual(r.revenueSinDesglose, { count: 0, importe: 0 });
  assert.deepEqual(r.expensesSinClasificar, { count: 0, importe: 0 });
});

test('«con IVA» sigue siendo la MISMA cifra que ya se enseñaba (no cambia sola)', () => {
  // Dos facturas, una con líneas y otra sin ellas: el total con IVA suma las DOS — es lo que ya
  // veía el profesional en `totals.revenue` y no puede reducirse porque una no tenga desglose.
  const r = calcularBeneficioSobreLaBase({
    invoices: [
      { total: '1210.00', lines: [{ qty: 1, price: 1000, tax: 0.21 }] },
      { total: '500.00', lines: null },
    ],
    expenses: [],
  });
  assert.equal(r.revenueWithVat, 1710, '🔴 excluir de la base no puede excluir también del con-IVA');
  assert.equal(r.revenueBase, 1000, 'solo la que sí tiene desglose entra en la base');
});

test('una factura SIN líneas no se sustituye por el total con IVA: se excluye y se declara', () => {
  const r = calcularBeneficioSobreLaBase({
    invoices: [{ total: '500.00', lines: null }],
    expenses: [],
  });
  assert.equal(r.revenueBase, 0, '🔴 sin líneas no hay base — inventar el total como base sería el defecto de SCRUM-403 al revés');
  assert.deepEqual(r.revenueSinDesglose, { count: 1, importe: 500 });
});

test('unas líneas vacías cuentan igual que ninguna línea (sin desglose)', () => {
  const r = calcularBeneficioSobreLaBase({
    invoices: [{ total: '500.00', lines: [] }],
    expenses: [],
  });
  assert.deepEqual(r.revenueSinDesglose, { count: 1, importe: 500 });
});

test('un gasto SIN baseAmount no se sustituye por `amount` ni por cero: se excluye y se declara', () => {
  const r = calcularBeneficioSobreLaBase({
    invoices: [],
    expenses: [{ amount: '100.00', baseAmount: null }],
  });
  assert.equal(r.expensesBase, 0, '🔴 sin base no hay base — ni el total ni un cero son un dato que conste');
  assert.equal(r.expensesWithVat, 100, 'el con-IVA SÍ se sabe siempre: amount es el total con IVA (SCRUM-324)');
  assert.deepEqual(r.expensesSinClasificar, { count: 1, importe: 100 });
});

test('un gasto con `baseAmount: 0` (declarado expresamente) SÍ entra en la base — 0 no es "sin clasificar"', () => {
  const r = calcularBeneficioSobreLaBase({
    invoices: [],
    expenses: [{ amount: '0.00', baseAmount: '0.00' }],
  });
  assert.equal(r.expensesBase, 0);
  assert.deepEqual(r.expensesSinClasificar, { count: 0, importe: 0 }, '🔴 un 0 declarado no es lo mismo que null');
});

test('sin facturas ni gastos: todo a cero, sin lanzar', () => {
  const r = calcularBeneficioSobreLaBase({ invoices: [], expenses: [] });
  assert.equal(r.revenueBase, 0);
  assert.equal(r.expensesBase, 0);
  assert.equal(r.profitBase, 0);
});

test('varios tipos de IVA en la misma factura: la base es la suma de TODOS los tipos', () => {
  const r = calcularBeneficioSobreLaBase({
    invoices: [{ total: '1331.00', lines: [
      { qty: 1, price: 1000, tax: 0.21 }, // 1000 + 210
      { qty: 1, price: 100, tax: 0.21 },  // 100 + 21 → mismo tipo, mismo cubo
    ] }],
    expenses: [],
  });
  assert.equal(r.revenueBase, 1100);
});

test('céntimos: no se rompe por coma flotante (0.10 + 0.20 clásico)', () => {
  const r = calcularBeneficioSobreLaBase({
    invoices: [
      { total: '0.10', lines: [{ qty: 1, price: 0.10, tax: 0 }] },
      { total: '0.20', lines: [{ qty: 1, price: 0.20, tax: 0 }] },
    ],
    expenses: [],
  });
  assert.equal(r.revenueBase, 0.3, '🔴 en coma flotante 0.1+0.2 no da 0.3');
});
