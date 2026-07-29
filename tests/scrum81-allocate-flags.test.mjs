// SCRUM-81 (FISCAL · PURO, corre en `npm test` sin gate): allocateInvoiceNumber resuelve el modo de
// emisión LEYENDO merchant.flags → un merchant con INVOICING_ES_ENABLED por OVERRIDE (Parte P) emite
// serie FISCAL (no J-), coherente con el gate del endpoint. ANTES resolvía sin flags → emitía J- en
// modo fiscal (factura con numeración de justificante, fuera de serie). Mock tx: sin BD.
import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateInvoiceNumber, isReceiptNumber } from '../dist/modules/invoicing/domain/invoiceNumber.service.js';

// SCRUM-207: `allocateInvoiceNumber` escribe `factura_emitida` DENTRO de la misma tx, así
// que la tx falsa necesita `auditLog`, y `camino`/`actor` pasan a ser obligatorios. Lo que
// estos tests AFIRMAN no cambia ni una coma: siguen midiendo la numeración de V0-0.
const AUDIT_FALSO = { create: async () => ({}) };
const CTX = { camino: 'C3', actor: { tipo: 'pro_propietario', teamMemberId: null } };

// tx mínima: findUnique devuelve el merchant (allocateInvoiceNumber solo lee de merchant); update no-op.
const mkTx = (merchant) => {
  const state = { ...merchant };
  return {
    merchant: {
      findUnique: async () => state,
      update: async ({ data }) => { Object.assign(state, data); return state; },
    },
    auditLog: AUDIT_FALSO,
  };
};
const merchant = (over) => ({
  id: 7, email: 'qa-s81@test.local', country: 'ES', flags: null,
  invoiceSeriesPrefix: 'CF', nextInvoiceNumber: 1, nextRectInvoiceNumber: 1, invoiceSeriesYear: null,
  ...over,
});
const now = new Date('2026-07-13T10:00:00Z');

test('SCRUM-81: ES sin override → modo receipt → número J- de justificante', async () => {
  const n = await allocateInvoiceNumber(mkTx(merchant()), 7, CTX, now);
  assert.ok(isReceiptNumber(n), `esperaba J-, salió ${n}`);
});

test('SCRUM-81: ES con INVOICING_ES_ENABLED por override de merchant → serie FISCAL (no J-)', async () => {
  const n = await allocateInvoiceNumber(mkTx(merchant({ flags: { INVOICING_ES_ENABLED: true } })), 7, CTX, now);
  assert.ok(!isReceiptNumber(n), `con el override debe ser fiscal, salió ${n}`);
  assert.match(n, /^2026-CF-001$/, 'serie fiscal 2026-CF-001');
});

test('SCRUM-81: rectificativa exige modo fiscal — con override emite serie R; sin override lanza', async () => {
  const nR = await allocateInvoiceNumber(mkTx(merchant({ flags: { INVOICING_ES_ENABLED: true } })), 7, { ...CTX, rectifying: true }, now);
  assert.match(nR, /^2026-CF-R-001$/, 'serie de rectificativas');
  await assert.rejects(
    () => allocateInvoiceNumber(mkTx(merchant()), 7, { ...CTX, rectifying: true }, now),
    /invoicing_es_disabled/,
    'sin modo fiscal no hay rectificativa (regla 29)',
  );
});

test('SCRUM-81: país no-ES → fiscal (V0-0 solo gobierna España)', async () => {
  const n = await allocateInvoiceNumber(mkTx(merchant({ country: 'PT' })), 7, CTX, now);
  assert.match(n, /^2026-CF-001$/);
});

test('SCRUM-81: merchant demo (id=1) → fiscal (watermark aguas abajo), no J-', async () => {
  const n = await allocateInvoiceNumber(mkTx(merchant({ id: 1 })), 1, CTX, now);
  assert.ok(!isReceiptNumber(n), `demo debe ser fiscal, salió ${n}`);
});
