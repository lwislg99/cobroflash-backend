// tests/billingPlanView.test.mjs — SCRUM-34: vista del plan para los serializers.
// Invariante: nextStage == el tramo que emitiría el endpoint (mismo conteo, mismos importes
// exactos de distributeStageAmounts). Puro, no toca BD.
import test from 'node:test';
import assert from 'node:assert/strict';

const { buildBillingPlanView } = await import('../dist/modules/quotes/domain/billingPlanView.js');

const CUSTOM_303030 = [
  { percentage: 0.3, label: 'Anticipo' },
  { percentage: 0.4, label: 'Hito 1' },
  { percentage: 0.3, label: 'Hito 2' },
];
const q = (over = {}) => ({ paymentTerms: null, total: '100.00', currency: 'EUR', ...over });

test('SCRUM-34: custom 30/40/30 — plan completo, importes exactos, hasCustomPlan', () => {
  const v = buildBillingPlanView(q({ customBillingPlan: CUSTOM_303030, total: '100.01' }), 0);
  assert.equal(v.hasCustomPlan, true);
  assert.equal(v.billingPlan.length, 3);
  assert.deepEqual(v.billingPlan.map((s) => s.label), ['Anticipo', 'Hito 1', 'Hito 2']);
  const cents = v.billingPlan.map((s) => Math.round(s.amount * 100));
  assert.deepEqual(cents, [3000, 4000, 3001]); // el último absorbe el resto (SCRUM-32)
  assert.equal(cents.reduce((a, b) => a + b, 0), 10001); // suma EXACTA
});

test('SCRUM-34: nextStage por CONTEO — emitted 0/1/2/3 de un plan de 3', () => {
  const base = q({ customBillingPlan: CUSTOM_303030 });
  assert.equal(buildBillingPlanView(base, 0).nextStage.label, 'Anticipo');
  assert.equal(buildBillingPlanView(base, 1).nextStage.label, 'Hito 1');
  assert.equal(buildBillingPlanView(base, 2).nextStage.label, 'Hito 2');
  assert.equal(buildBillingPlanView(base, 3).nextStage, null); // todos emitidos
  assert.equal(buildBillingPlanView(base, 0).pendingStagesCount, 3);
  assert.equal(buildBillingPlanView(base, 1).pendingStagesCount, 2);
  assert.equal(buildBillingPlanView(base, 2).pendingStagesCount, 1);
  assert.equal(buildBillingPlanView(base, 3).pendingStagesCount, 0);
});

test('SCRUM-34 (corrección B): céntimo impar — el ÚLTIMO tramo es exacto, no el float de remaining', () => {
  // 30/40/30 de 100,01 con 2 emitidos: el label debe decir 30,01 (100,01 − 30,00 − 40,00),
  // que es EXACTAMENTE lo que emitiría collect-rest (distributeStageAmounts[2]).
  const v = buildBillingPlanView(q({ customBillingPlan: CUSTOM_303030, total: '100.01' }), 2);
  assert.equal(v.pendingStagesCount, 1);
  assert.equal(Math.round(v.nextStage.amount * 100), 3001);
  // el remaining float del serializer viejo diría round(100.01*0.3)=30.00 → mentiría 1 cént.
  assert.notEqual(Math.round(v.nextStage.amount * 100), Math.round(100.01 * 0.3 * 100));
});

test('SCRUM-34 (decisión 1): paymentTerms=null SIN custom → default FULL_UPFRONT, NO []', () => {
  // Congela el comportamiento real de resolveBillingPlan/normalizePaymentTerms (billingPlan.ts:35-40):
  // null → FULL_UPFRONT [100%]. hasCustomPlan=false permite al front distinguirlo de un plan custom.
  const v = buildBillingPlanView(q(), 0);
  assert.equal(v.hasCustomPlan, false);
  assert.equal(v.billingPlan.length, 1);
  assert.equal(v.billingPlan[0].percent, 1);
  assert.equal(Math.round(v.billingPlan[0].amount * 100), 10000);
  assert.equal(v.nextStage.index, 0);
});

test('SCRUM-34: preset FIFTY_FIFTY — 2 tramos por conteo, hasCustomPlan=false', () => {
  const base = q({ paymentTerms: 'FIFTY_FIFTY' });
  const v0 = buildBillingPlanView(base, 0);
  assert.equal(v0.hasCustomPlan, false);
  assert.equal(v0.billingPlan.length, 2);
  assert.equal(v0.nextStage.index, 0);
  assert.equal(buildBillingPlanView(base, 1).nextStage.index, 1);
  assert.equal(buildBillingPlanView(base, 2).nextStage, null);
});

test('SCRUM-34: preset MANUAL → plan vacío, sin nextStage, 0 pendientes', () => {
  const v = buildBillingPlanView(q({ paymentTerms: 'MANUAL' }), 0);
  assert.deepEqual(v.billingPlan, []);
  assert.equal(v.nextStage, null);
  assert.equal(v.pendingStagesCount, 0);
});
