import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getEmissionMode,
  isDemoMerchant,
  DEMO_WATERMARK,
} from '../dist/modules/invoicing/domain/emission.service.js';
import {
  allocateInvoiceNumber,
  isReceiptNumber,
  makeReceiptNumber,
} from '../dist/modules/invoicing/domain/invoiceNumber.service.js';

// ── V0-0: modo de emisión ────────────────────────────────────────────────────

test('demo merchant: por id (regla 8) y por email, da igual mayúsculas', () => {
  assert.equal(isDemoMerchant({ id: 1 }), true);
  assert.equal(isDemoMerchant({ id: 7, email: 'demo@yaqu.app' }), true);
  assert.equal(isDemoMerchant({ id: 7, email: ' DEMO@yaqu.app ' }), true);
  assert.equal(isDemoMerchant({ id: 7, email: 'real@negocio.es' }), false);
});

test('V0-0: merchant ES real sin flag → receipt (imposible factura fiscal)', () => {
  delete process.env.INVOICING_ES_ENABLED;
  assert.equal(getEmissionMode({ id: 5, country: 'ES', email: 'real@negocio.es' }), 'receipt');
});

test('V0-0: demo ES → demo (factura con watermark)', () => {
  delete process.env.INVOICING_ES_ENABLED;
  assert.equal(getEmissionMode({ id: 1, country: 'ES', email: 'demo@yaqu.app' }), 'demo');
  assert.equal(DEMO_WATERMARK, 'DEMO — no válida fiscalmente');
});

test('V0-0: ES real con flag ON (post SIF-1) → fiscal', () => {
  process.env.INVOICING_ES_ENABLED = 'true';
  assert.equal(getEmissionMode({ id: 5, country: 'ES', email: 'real@negocio.es' }), 'fiscal');
  delete process.env.INVOICING_ES_ENABLED;
});

test('V0-0: fuera de ES no cambia nada → fiscal (su flujo actual)', () => {
  assert.equal(getEmissionMode({ id: 9, country: 'MX', email: 'real@negocio.mx' }), 'fiscal');
});

// ── Números de justificante ──────────────────────────────────────────────────

test('makeReceiptNumber: formato J-YYYYMMDD-XXXX, reconocido por isReceiptNumber', () => {
  const n = makeReceiptNumber(new Date(2026, 5, 11));
  assert.match(n, /^J-20260611-[A-Z0-9]{4}$/);
  assert.equal(isReceiptNumber(n), true);
  assert.equal(isReceiptNumber('2026-CF-001'), false);
  assert.equal(isReceiptNumber(null), false);
});

// ── allocateInvoiceNumber con el gate V0-0 (tx falsa) ────────────────────────

// SCRUM-207: `allocateInvoiceNumber` escribe `factura_emitida` DENTRO de la misma tx, así
// que la tx falsa necesita `auditLog`, y `camino`/`actor` pasan a ser obligatorios. Lo que
// estos tests AFIRMAN no cambia ni una coma: siguen midiendo la numeración de V0-0.
const AUDIT_FALSO = { create: async () => ({}) };
const CTX = { camino: 'C3', actor: { tipo: 'pro_propietario', teamMemberId: null } };

function fakeTx(merchant) {
  const calls = { updates: [] };
  return {
    calls,
    // SCRUM-234: la reserva toma un advisory lock antes de leer. Se REGISTRA en `calls` en vez
    // de ser un no-op, para que este fichero tambien note si el cerrojo desaparece.
    $executeRaw: async () => { calls.cerrojos = (calls.cerrojos ?? 0) + 1; return 0; },
    merchant: {
      findUnique: async () => merchant,
      update: async (args) => { calls.updates.push(args); },
    },
    auditLog: AUDIT_FALSO,
    _calls: {
    },
  };
}

test('allocate: ES real sin flag → J-number y NO toca los contadores de la serie fiscal', async () => {
  delete process.env.INVOICING_ES_ENABLED;
  const tx = fakeTx({
    id: 5, email: 'real@negocio.es', country: 'ES',
    invoiceSeriesPrefix: 'CF', nextInvoiceNumber: 4, nextRectInvoiceNumber: 1, invoiceSeriesYear: 2026,
  });
  const n = await allocateInvoiceNumber(tx, 5, CTX);
  assert.equal(isReceiptNumber(n), true);
  assert.equal(tx.calls.updates.length, 0, 'la serie fiscal no debe avanzar');
});

test('allocate: ES real sin flag + rectificativa → invoicing_es_disabled', async () => {
  delete process.env.INVOICING_ES_ENABLED;
  const tx = fakeTx({
    id: 5, email: 'real@negocio.es', country: 'ES',
    invoiceSeriesPrefix: 'CF', nextInvoiceNumber: 4, nextRectInvoiceNumber: 1, invoiceSeriesYear: 2026,
  });
  await assert.rejects(() => allocateInvoiceNumber(tx, 5, { ...CTX, rectifying: true }), /invoicing_es_disabled/);
});

test('allocate: demo sigue emitiendo de la serie fiscal anual', async () => {
  const tx = fakeTx({
    id: 1, email: 'demo@yaqu.app', country: 'ES',
    invoiceSeriesPrefix: 'CF', nextInvoiceNumber: 4, nextRectInvoiceNumber: 1, invoiceSeriesYear: 2026,
  });
  const n = await allocateInvoiceNumber(tx, 1, CTX, new Date(2026, 5, 11));
  assert.equal(n, '2026-CF-004');
  assert.equal(tx.calls.updates.length, 1);
});

test('allocate: merchant no-ES intacto (serie fiscal de siempre)', async () => {
  const tx = fakeTx({
    id: 9, email: 'real@negocio.mx', country: 'MX',
    invoiceSeriesPrefix: 'MX', nextInvoiceNumber: 10, nextRectInvoiceNumber: 1, invoiceSeriesYear: 2026,
  });
  const n = await allocateInvoiceNumber(tx, 9, CTX, new Date(2026, 5, 11));
  assert.equal(n, '2026-MX-010');
});
