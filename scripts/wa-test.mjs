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
};

function fail(msg) {
  console.error('\n❌ ' + msg + '\n');
  console.error('Uso: node scripts/wa-test.mjs <quote_decision|payment_request|payment_confirmation> <telefono> [--name= --biz= --num= --amount= --id= --lang=es --dry]');
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
const lang = opts.lang || 'es';
const dry = !!opts.dry;

const templateName = TEMPLATES[templateKey];

// --- componentes (idénticos a los que envía la app) ---
let components;
if (templateKey === 'quote_decision' || templateKey === 'payment_request') {
  components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: name }, // {{1}} nombre cliente
        { type: 'text', text: biz },  // {{2}} nombre negocio
        { type: 'text', text: num },  // {{3}} nº presupuesto/factura
        { type: 'text', text: amount }, // {{4}} total/importe con moneda
      ],
    },
    {
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: id }], // sufijo URL → /pay/quote/{{1}} o /pay/invoice/{{1}}
    },
  ];
} else {
  // payment_confirmation_es: SIN botones, orden {{1}} nombre, {{2}} importe, {{3}} nº factura, {{4}} negocio
  components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: name },
        { type: 'text', text: amount },
        { type: 'text', text: num },
        { type: 'text', text: biz },
      ],
    },
  ];
}

const payload = {
  messaging_product: 'whatsapp',
  to,
  type: 'template',
  template: { name: templateName, language: { code: lang }, components },
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
