#!/usr/bin/env node
/**
 * Prueba manual de plantillas de WhatsApp (Meta Cloud API).
 * Envía UNA plantilla a UN número de test con la MISMA estructura que usa la app
 * (ver docs/WHATSAPP_TEMPLATES.md). Útil para validar en cuanto Meta las apruebe.
 *
 * NO toca la base de datos. Solo envía al número que le pases.
 *
 * Requiere (en .env o como variables inline):
 *   WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN
 *
 * Uso:
 *   node scripts/wa-test.mjs <plantilla> <telefono> [opciones]
 *
 *   plantilla:  quote_decision | payment_request | payment_confirmation
 *   telefono:   E.164 sin '+', p.ej. 34600111222
 *
 * Opciones (con valores de ejemplo por defecto):
 *   --name="María"                 nombre del cliente
 *   --biz="Fontanería García S.L." nombre del negocio
 *   --num=128                      nº de presupuesto/factura
 *   --amount="350,00 EUR"          importe con moneda
 *   --id=128                       sufijo del botón (id de presupuesto o cobro)
 *   --lang=es                      código de idioma de la plantilla
 *   --dry                          imprime el payload SIN enviar
 *
 * Ejemplos:
 *   node scripts/wa-test.mjs quote_decision 34600111222
 *   WHATSAPP_ACCESS_TOKEN=xxx WHATSAPP_PHONE_NUMBER_ID=yyy \
 *     node scripts/wa-test.mjs payment_request 34600111222 --num=F-2025-014 --id=42
 *   node scripts/wa-test.mjs payment_confirmation 34600111222 --dry
 */
import dotenv from 'dotenv';
dotenv.config(); // .env (no carga .env.local, que deja las credenciales WA en blanco)

const GRAPH = 'https://graph.facebook.com/v21.0';

// --- args ---
const [, , templateKey, phoneRaw, ...rest] = process.argv;
const opts = Object.fromEntries(
  rest
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...v] = a.slice(2).split('=');
      return [k, v.length ? v.join('=') : true];
    }),
);

const TEMPLATES = {
  quote_decision: 'quote_decision_es',
  payment_request: 'payment_request_es',
  payment_confirmation: 'payment_confirmation_es',
  payment_confirmation_invoice: 'payment_confirmation_invoice_es',
  merchant_alert: 'merchant_alert_es',
};

function fail(msg) {
  console.error('\n❌ ' + msg + '\n');
  console.error('Uso: node scripts/wa-test.mjs <quote_decision|payment_request|payment_confirmation|payment_confirmation_invoice|merchant_alert> <telefono> [--name= --biz= --num= --amount= --id= --action= --detail= --lang=es --dry]');
  process.exit(1);
}

if (!templateKey || !TEMPLATES[templateKey]) fail(`Plantilla inválida: "${templateKey || ''}".`);
if (!phoneRaw) fail('Falta el teléfono de destino (E.164 sin +).');

const to = String(phoneRaw).replace(/[^\d]/g, '');
if (to.length < 8) fail(`Teléfono no válido: "${phoneRaw}".`);

const name = opts.name || 'María';
const biz = opts.biz || 'Fontanería García S.L.';
const num = String(opts.num || '128');
const amount = opts.amount || '350,00 EUR';
const id = String(opts.id || opts.num || '128');
const action = opts.action || 'te ha pagado';
const detail = opts.detail || '350,00 € · Factura F-2026-014';
const lang = opts.lang || 'es';
const dry = !!opts.dry;

// --- componentes: MISMOS builders que usa la app (una sola fuente de verdad) ---
let builders;
try {
  builders = await import('../dist/integrations/whatsappTemplates.js');
} catch {
  fail('No se encontró dist/. Ejecuta primero: npm run build');
}

let msg;
if (templateKey === 'quote_decision') {
  msg = builders.buildQuoteDecision({ customerName: name, businessName: biz, quoteNumber: num, totalWithCurrency: amount, quoteId: id });
} else if (templateKey === 'payment_request') {
  msg = builders.buildPaymentRequest({ customerName: name, businessName: biz, invoiceNumber: num, amountWithCurrency: amount, chargeId: id });
} else if (templateKey === 'payment_confirmation') {
  msg = builders.buildPaymentConfirmation({ customerName: name, amountWithCurrency: amount, invoiceNumber: num, businessName: biz });
} else if (templateKey === 'payment_confirmation_invoice') {
  msg = builders.buildPaymentConfirmationInvoice({ customerName: name, amountWithCurrency: amount, documentNumber: num, businessName: biz, chargeId: id });
} else {
  msg = builders.buildMerchantAlert({ customerName: name, action, detail });
}

const templateName = msg.templateName;
const payload = {
  messaging_product: 'whatsapp',
  to,
  type: 'template',
  template: { name: templateName, language: { code: lang }, components: msg.components },
};

console.log(`\n📨 Plantilla: ${templateName} (${lang})  →  ${to}`);
console.log(JSON.stringify(payload, null, 2));

if (dry) {
  console.log('\n(--dry) No se ha enviado nada.\n');
  process.exit(0);
}

const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const token = process.env.WHATSAPP_ACCESS_TOKEN;
if (!phoneNumberId || !token) {
  fail('Faltan credenciales. Define WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_ACCESS_TOKEN (en .env o inline).');
}

try {
  const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    console.log('\n✅ Enviado. message id:', data?.messages?.[0]?.id || '(sin id)');
    console.log('Revisa el WhatsApp del número de destino.\n');
  } else {
    console.error('\n❌ Meta rechazó el envío (HTTP ' + res.status + '):');
    console.error(JSON.stringify(data, null, 2));
    console.error('\nPistas: #132000 = nº de variables/botones no coincide con la plantilla aprobada;');
    console.error('        #132001 = plantilla/idioma no encontrado; revisa nombre exacto e idioma "es".\n');
    process.exit(1);
  }
} catch (e) {
  console.error('\n❌ Error de red:', e?.message || e, '\n');
  process.exit(1);
}
