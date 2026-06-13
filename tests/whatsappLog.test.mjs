import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldApplyStatus,
  extractWaMessageId,
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
