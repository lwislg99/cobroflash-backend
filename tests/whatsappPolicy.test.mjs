import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoSendBlocked } from '../dist/integrations/whatsappPolicy.js';

const SAFE = ['34629965893', '+34 600 11 22 33'];

test('V0-2: merchants reales NUNCA se bloquean por esta política', () => {
  assert.equal(demoSendBlocked(5, '34000000000', SAFE), false);
  assert.equal(demoSendBlocked(5, '34000000000', []), false);
  assert.equal(demoSendBlocked(undefined, '34000000000', []), false);
});

test('V0-2: demo + destino en la lista → permitido (con y sin formato sucio)', () => {
  assert.equal(demoSendBlocked(1, '34629965893', SAFE), false);
  assert.equal(demoSendBlocked(1, '+34 629 96 58 93', SAFE), false);
  assert.equal(demoSendBlocked(1, '34600112233', SAFE), false); // entrada de la lista con +34 y espacios
});

test('V0-2: demo + destino fuera de la lista → BLOQUEADO', () => {
  assert.equal(demoSendBlocked(1, '34000000000', SAFE), true);
  assert.equal(demoSendBlocked(1, '34999888777', SAFE), true);
});

test('V0-2: demo + lista vacía → BLOQUEADO todo (imposible spamear)', () => {
  assert.equal(demoSendBlocked(1, '34629965893', []), true);
});

test('V0-2: demo + destino ilegible → BLOQUEADO', () => {
  assert.equal(demoSendBlocked(1, '', SAFE), true);
});
