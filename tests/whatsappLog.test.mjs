import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldApplyStatus,
  extractWaMessageId,
  aggregateWaRows,
  WA_UTILITY_COST_ES,
} from '../dist/modules/messaging/domain/whatsappLog.service.js';

// WA-0b: la máquina de estados queued→sent→delivered→read solo avanza
test('shouldApplyStatus: avanza pero nunca retrocede', () => {
  assert.equal(shouldApplyStatus('sent', 'delivered'), true);
  assert.equal(shouldApplyStatus('delivered', 'read'), true);
  assert.equal(shouldApplyStatus('queued', 'sent'), true);
  // fuera de orden / repetido → no aplica
  assert.equal(shouldApplyStatus('read', 'delivered'), false);
  assert.equal(shouldApplyStatus('delivered', 'sent'), false);
  assert.equal(shouldApplyStatus('read', 'read'), false);
  assert.equal(shouldApplyStatus('sent', 'sent'), false);
});

test('shouldApplyStatus: failed siempre se aplica (aunque ya esté read)', () => {
  assert.equal(shouldApplyStatus('read', 'failed'), true);
  assert.equal(shouldApplyStatus('queued', 'failed'), true);
});

test('shouldApplyStatus: estado desconocido no degrada uno conocido', () => {
  assert.equal(shouldApplyStatus('delivered', 'loquesea'), false);
});

test('extractWaMessageId: saca wamid.* de la respuesta de Meta', () => {
  assert.equal(
    extractWaMessageId({ messages: [{ id: 'wamid.ABC123' }] }),
    'wamid.ABC123',
  );
  assert.equal(extractWaMessageId({}), null);
  assert.equal(extractWaMessageId(null), null);
  assert.equal(extractWaMessageId({ messages: [] }), null);
});

test('coste utility ES coherente con el master (~0,023 €)', () => {
  assert.equal(WA_UTILITY_COST_ES, 0.023);
});

// J8: el funnel es derivado (read⊃delivered⊃sent) y el coste suma costEstimate
test('aggregateWaRows: funnel derivado + coste + fallidos', () => {
  const m = aggregateWaRows([
    { status: 'read', costEstimate: 0.023 },
    { status: 'delivered', costEstimate: 0.023 },
    { status: 'sent', costEstimate: 0.023 },
    { status: 'failed', costEstimate: 0.023 },
  ]);
  assert.equal(m.total, 4);
  assert.equal(m.read, 1);
  assert.equal(m.delivered, 2);  // read + delivered
  assert.equal(m.sent, 3);       // read + delivered + sent (failed no cuenta como enviado)
  assert.equal(m.failed, 1);
  assert.equal(m.costEur, 0.092); // 4 × 0,023
});

test('aggregateWaRows: vacío → todo a cero', () => {
  const m = aggregateWaRows([]);
  assert.deepEqual(m, { sent: 0, delivered: 0, read: 0, failed: 0, total: 0, costEur: 0 });
});
