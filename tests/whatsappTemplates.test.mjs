import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuoteDecision,
  buildPaymentRequest,
  buildPaymentConfirmation,
  buildPaymentConfirmationInvoice,
  buildMerchantAlert,
  buildAlbaranFirmado,
  buildAlbaranParaFirmar,
  validateTemplateComponents,
  WA_TEMPLATES,
  WA_TEMPLATE_SPECS,
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

// --- Validación J7: expectedVarCount ANTES de llamar a Meta ---

test('validación J7: lo que sale de los builders pasa la validación', () => {
  const qd = buildQuoteDecision({ customerName: 'a', businessName: 'b', quoteNumber: 1, totalWithCurrency: 'c', quoteId: 1 });
  const pr = buildPaymentRequest({ customerName: 'a', businessName: 'b', invoiceNumber: 'c', amountWithCurrency: 'd', chargeId: 1 });
  const pc = buildPaymentConfirmation({ customerName: 'a', amountWithCurrency: 'b', invoiceNumber: 'c', businessName: 'd' });
  assert.equal(validateTemplateComponents(qd.templateName, qd.components), null);
  assert.equal(validateTemplateComponents(pr.templateName, pr.components), null);
  assert.equal(validateTemplateComponents(pc.templateName, pc.components), null);
});

test('validación J7: nº de vars incorrecto se detecta (evita #132000)', () => {
  const tresVars = [{ type: 'body', parameters: [
    { type: 'text', text: 'a' }, { type: 'text', text: 'b' }, { type: 'text', text: 'c' },
  ] }];
  const err = validateTemplateComponents(WA_TEMPLATES.paymentConfirmation, tresVars);
  assert.match(err, /3 variables.*espera 4/);
});

test('validación J7: variable vacía o "undefined" se detecta', () => {
  const msg = buildQuoteDecision({ customerName: '', businessName: 'b', quoteNumber: 1, totalWithCurrency: 'c', quoteId: 1 });
  assert.match(validateTemplateComponents(msg.templateName, msg.components), /variable 1.*vacía/);
  const msg2 = buildQuoteDecision({ customerName: String(undefined), businessName: 'b', quoteNumber: 1, totalWithCurrency: 'c', quoteId: 1 });
  assert.match(validateTemplateComponents(msg2.templateName, msg2.components), /variable 1/);
});

test('validación J7: botón obligatorio que falta / botón de más se detectan', () => {
  const sinBoton = buildPaymentConfirmation({ customerName: 'a', amountWithCurrency: 'b', invoiceNumber: 'c', businessName: 'd' }).components;
  assert.match(validateTemplateComponents(WA_TEMPLATES.quoteDecision, sinBoton), /botón/);
  const conBoton = buildQuoteDecision({ customerName: 'a', businessName: 'b', quoteNumber: 1, totalWithCurrency: 'c', quoteId: 1 }).components;
  assert.match(validateTemplateComponents(WA_TEMPLATES.paymentConfirmation, conBoton), /botón/);
});

test('validación J7: plantilla desconocida no se valida (futuras altas en Meta)', () => {
  assert.equal(validateTemplateComponents('plantilla_inexistente_xyz', [{ type: 'body', parameters: [] }]), null);
});

test('specs J7: todas las plantillas tienen spec registrada', () => {
  for (const name of Object.values(WA_TEMPLATES)) {
    assert.ok(WA_TEMPLATE_SPECS[name], `falta spec de ${name}`);
  }
});

// --- Nuevas plantillas (pendientes de alta en Meta) ---

test('payment_confirmation_invoice_es: 4 vars + botón = urlToken (→ /recibo/{{1}}, SCRUM-74: token opaco, no el id)', () => {
  const msg = buildPaymentConfirmationInvoice({
    customerName: 'María', amountWithCurrency: '350.00 EUR',
    documentNumber: '2026-CF-001', businessName: 'Fontanería García', urlToken: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
  });
  assert.equal(msg.templateName, 'payment_confirmation_invoice_es');
  assert.equal(msg.languageCode, 'es');
  assert.deepEqual(bodyTexts(msg), ['María', '350.00 EUR', '2026-CF-001', 'Fontanería García']);
  assert.equal(urlButtonSuffix(msg), 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');
  // pasa la validación J7
  assert.equal(validateTemplateComponents(msg.templateName, msg.components), null);
});

test('payment_confirmation_invoice_es: copy neutro — el builder no impone la palabra "factura"', () => {
  // el nº de documento puede ser un justificante J-… (no factura) y el builder lo acepta igual
  const msg = buildPaymentConfirmationInvoice({
    customerName: 'Ana', amountWithCurrency: '120,00 €',
    documentNumber: 'J-20260611-AB3C', businessName: 'Reformas Sur', urlToken: 'deadbeefdeadbeefdeadbeefdeadbeef',
  });
  assert.deepEqual(bodyTexts(msg), ['Ana', '120,00 €', 'J-20260611-AB3C', 'Reformas Sur']);
});

test('merchant_alert_es: 3 vars (cliente, acción, detalle), SIN botón', () => {
  const msg = buildMerchantAlert({
    customerName: 'María García', action: 'te ha pagado', detail: '450,00 € · Factura F-2026-014',
  });
  assert.equal(msg.templateName, 'merchant_alert_es');
  assert.equal(msg.languageCode, 'es');
  assert.deepEqual(bodyTexts(msg), ['María García', 'te ha pagado', '450,00 € · Factura F-2026-014']);
  assert.equal(urlButtonSuffix(msg), null, 'el aviso al PRO no lleva botón dinámico');
  assert.equal(validateTemplateComponents(msg.templateName, msg.components), null);
});

test('validación J7: merchant_alert con 2 vars (falta detalle) se detecta', () => {
  const malformed = [{ type: 'body', parameters: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }];
  assert.match(validateTemplateComponents(WA_TEMPLATES.merchantAlert, malformed), /2 variables.*espera 3/);
});

// ── SCRUM-47: albaran_firmado_es (cabecera de documento) ─────────────────────
function docHeaderMediaId(msg) {
  const h = msg.components.find((c) => c.type === 'header');
  assert.ok(h, 'falta el componente header');
  const p0 = h.parameters[0];
  assert.equal(p0.type, 'document');
  return p0.document?.id;
}

test('albaran_firmado_es: header de documento (media_id) + 3 vars en orden, sin botón', () => {
  const msg = buildAlbaranFirmado({
    customerName: 'María García', albaranNumber: 'ALB-2026-001', obra: 'C/ Mayor 12',
    mediaId: 'MEDIA123', filename: 'ALB-2026-001.pdf',
  });
  assert.equal(msg.templateName, 'albaran_firmado_es');
  assert.equal(msg.languageCode, 'es');
  assert.deepEqual(bodyTexts(msg), ['María García', 'ALB-2026-001', 'C/ Mayor 12']);
  assert.equal(docHeaderMediaId(msg), 'MEDIA123', 'el PDF viaja por media_id en la cabecera');
  assert.equal(msg.components[0].parameters[0].document.filename, 'ALB-2026-001.pdf');
  assert.equal(urlButtonSuffix(msg), null, 'el albarán firmado no lleva botón dinámico (quick-reply estático)');
  assert.equal(validateTemplateComponents(msg.templateName, msg.components), null, 'pasa J7');
});

test('validación J7 (SCRUM-59): albaran_firmado exige la cabecera de documento', () => {
  const soloBody = [{ type: 'body', parameters: [
    { type: 'text', text: 'María' }, { type: 'text', text: 'ALB-2026-001' }, { type: 'text', text: 'obra' },
  ] }];
  // sin header → error (un media_id vacío solo fallaría en Meta con #132012)
  assert.match(validateTemplateComponents(WA_TEMPLATES.albaranFirmado, soloBody), /cabecera de documento/);
  // media_id vacío también se detecta
  const headerVacio = [
    { type: 'header', parameters: [{ type: 'document', document: { id: '', filename: 'x.pdf' } }] },
    ...soloBody,
  ];
  assert.match(validateTemplateComponents(WA_TEMPLATES.albaranFirmado, headerVacio), /cabecera de documento/);
});

test('specs J7: albaran_firmado_es registrada con hasDocumentHeader', () => {
  const spec = WA_TEMPLATE_SPECS[WA_TEMPLATES.albaranFirmado];
  assert.ok(spec, 'la spec debe estar registrada para que J7 muerda');
  assert.equal(spec.expectedVarCount, 3);
  assert.equal(spec.hasUrlButton, false);
  assert.equal(spec.hasDocumentHeader, true);
});

// ── SCRUM-49: albaran_para_firmar_es (link para firmar a distancia) ──────────
test('albaran_para_firmar_es: 3 vars en orden + botón URL = token opaco', () => {
  const msg = buildAlbaranParaFirmar({
    customerName: 'María García', businessName: 'Fontanería López', albaranNumber: 'ALB-2026-001', token: 'a1b2c3d4e5f6',
  });
  assert.equal(msg.templateName, 'albaran_para_firmar_es');
  assert.equal(msg.languageCode, 'es');
  assert.deepEqual(bodyTexts(msg), ['María García', 'Fontanería López', 'ALB-2026-001']);
  assert.equal(urlButtonSuffix(msg), 'a1b2c3d4e5f6', 'el botón lleva el token opaco (→ /albaran/{{token}})');
  assert.equal(validateTemplateComponents(msg.templateName, msg.components), null, 'pasa J7');
});

test('specs J7: albaran_para_firmar_es registrada (3 vars + botón URL, sin header)', () => {
  const spec = WA_TEMPLATE_SPECS[WA_TEMPLATES.albaranParaFirmar];
  assert.ok(spec);
  assert.equal(spec.expectedVarCount, 3);
  assert.equal(spec.hasUrlButton, true);
  assert.ok(!spec.hasDocumentHeader);
});
