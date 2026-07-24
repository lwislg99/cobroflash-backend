// SCRUM-126 — vocabulario único de "¿salió el envío?" (sent/error/message). Puro, sin BD.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sendFailureBody, sendSuccessBody, SEND_FAILURE_MESSAGES } from '../dist/lib/sendOutcome.js';

test('sendFailureBody: siempre ok:true + sent:false + el mensaje canónico del motivo', () => {
  const body = sendFailureBody('wa_opt_out');
  assert.equal(body.ok, true);
  assert.equal(body.sent, false);
  assert.equal(body.error, 'wa_opt_out');
  assert.equal(body.message, SEND_FAILURE_MESSAGES.wa_opt_out);
});

test('sendFailureBody: message explícito sustituye al canónico sin perder el motivo', () => {
  const body = sendFailureBody('whatsapp_send_failed', { message: 'Meta dijo: número inválido' });
  assert.equal(body.error, 'whatsapp_send_failed');
  assert.equal(body.message, 'Meta dijo: número inválido');
});

test('sendFailureBody: campos extra (chargeId, payToken…) se propagan', () => {
  const body = sendFailureBody('daily_cap', { chargeId: 42, payToken: 'abc' });
  assert.equal(body.chargeId, 42);
  assert.equal(body.payToken, 'abc');
});

test('sendSuccessBody: siempre ok:true + sent:true', () => {
  assert.deepEqual(sendSuccessBody(), { ok: true, sent: true });
  assert.deepEqual(sendSuccessBody({ to: '34600000000' }), { ok: true, sent: true, to: '34600000000' });
});

test('SEND_FAILURE_MESSAGES: cubre los 8 motivos usados hoy en los 9 endpoints', () => {
  const motivos = [
    'not_configured', 'demo_safe_numbers', 'wa_opt_out', 'daily_cap',
    'customer_daily_cap', 'whatsapp_send_failed', 'email_send_failed', 'media_upload_failed',
  ];
  for (const m of motivos) {
    assert.equal(typeof SEND_FAILURE_MESSAGES[m], 'string', `falta mensaje para "${m}"`);
    assert.ok(SEND_FAILURE_MESSAGES[m].length > 0, `mensaje vacío para "${m}"`);
  }
});
