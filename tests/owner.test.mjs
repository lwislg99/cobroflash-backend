import { test } from 'node:test';
import assert from 'node:assert/strict';

// Debe fijarse ANTES de importar el módulo: config.OWNER_EMAILS se parsea al cargar.
process.env.OWNER_EMAILS = 'luisdragonball@gmail.com, Demo@YaQu.app';
const { isOwnerEmail, config } = await import('../dist/core/config/env.js');

test('OWNER_EMAILS se parsea normalizado a minúsculas y sin vacíos', () => {
  assert.deepEqual(config.OWNER_EMAILS, ['luisdragonball@gmail.com', 'demo@yaqu.app']);
});

test('isOwnerEmail exime solo a las cuentas owner', () => {
  assert.ok(isOwnerEmail('luisdragonball@gmail.com'), 'match exacto');
  assert.ok(isOwnerEmail('LUISDRAGONBALL@GMAIL.COM'), 'case-insensitive');
  assert.ok(isOwnerEmail('  demo@yaqu.app '), 'recorta espacios');
  assert.ok(!isOwnerEmail('cliente@real.com'), 'cliente real NO exento');
  assert.ok(!isOwnerEmail(''), 'vacío NO');
  assert.ok(!isOwnerEmail(null), 'null NO');
  assert.ok(!isOwnerEmail(undefined), 'undefined NO');
});
