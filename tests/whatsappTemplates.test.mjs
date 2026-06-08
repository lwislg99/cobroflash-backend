import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuoteDecision,
  buildPaymentRequest,
  buildPaymentConfirmation,
  WA_TEMPLATES,
} from '../dist/integrations/whatsappTemplates.js';

// Helpers de aserción de estructura (lo que Meta valida → #132000/#132001).
function bodyTexts(msg) {
  const body = msg.components.find((c) => c.type === 'body');
  assert.ok(body, 'falta el componente body');
  assert.ok(body.parameters.every((p) => p.type === 'text'), 'todos los params del body son text');
  return body.parameters.map((p) => p.text);
}
function urlButtonSuffix(msg) {
  const btn = msg.components.find((c) => c.type === 'button');
  if (!btn) return null;
  assert.equal(btn.sub_type, 'url');
  assert.equal(btn.index, '0');
  assert.equal(btn.parameters.length, 1);
  return btn.parameters[0].text;
}

test('quote_decision_es: nombre, idioma, 4 vars en orden y botón = id presupuesto', () => {
  const msg = buildQuoteDecision({
    customerName: 'María', businessName: 'Fontanería García',
    quoteNumber: 128, totalWithCurrency: '350.00 EUR', quoteId: 128,
  });
  assert.equal(msg.templateName, WA_TEMPLATES.quoteDecision);
  assert.equal(msg.templateName, 'quote_decision_es');
  assert.equal(msg.languageCode, 'es');
  assert.deepEqual(bodyTexts(msg), ['María', 'Fontanería García', '128', '350.00 EUR']);
  assert.equal(urlButtonSuffix(msg), '128'); // sufijo → /pay/quote/{{1}}
});

test('payment_request_es: 4 vars en orden y botón = chargeId', () => {
  const msg = buildPaymentRequest({
    customerName: 'María', businessName: 'Fontanería García',
    invoiceNumber: 'F-2025-014', amountWithCurrency: '350.00 EUR', chargeId: 42,
  });
  assert.equal(msg.templateName, 'payment_request_es');
  assert.equal(msg.languageCode, 'es');
  assert.deepEqual(bodyTexts(msg), ['María', 'Fontanería García', 'F-2025-014', '350.00 EUR']);
  assert.equal(urlButtonSuffix(msg), '42'); // sufijo → /pay/invoice/{{1}}
});

test('payment_confirmation_es: 4 vars (orden distinto) y SIN botones', () => {
  const msg = buildPaymentConfirmation({
    customerName: 'María', amountWithCurrency: '350.00 EUR',
    invoiceNumber: 'F-2025-014', businessName: 'Fontanería García',
  });
  assert.equal(msg.templateName, 'payment_confirmation_es');
  assert.equal(msg.languageCode, 'es');
  // Orden distinto a las otras: nombre · importe · nº · negocio
  assert.deepEqual(bodyTexts(msg), ['María', '350.00 EUR', 'F-2025-014', 'Fontanería García']);
  assert.equal(urlButtonSuffix(msg), null, 'confirmación NO lleva botón');
});

test('todas: cuerpo de exactamente 4 variables (lo que exige Meta)', () => {
  const qd = buildQuoteDecision({ customerName: 'a', businessName: 'b', quoteNumber: 1, totalWithCurrency: 'c', quoteId: 1 });
  const pr = buildPaymentRequest({ customerName: 'a', businessName: 'b', invoiceNumber: 'c', amountWithCurrency: 'd', chargeId: 1 });
  const pc = buildPaymentConfirmation({ customerName: 'a', amountWithCurrency: 'b', invoiceNumber: 'c', businessName: 'd' });
  assert.equal(bodyTexts(qd).length, 4);
  assert.equal(bodyTexts(pr).length, 4);
  assert.equal(bodyTexts(pc).length, 4);
});
