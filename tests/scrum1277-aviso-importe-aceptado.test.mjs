// tests/scrum1277-aviso-importe-aceptado.test.mjs — SCRUM-1277
//
// 🔴 EL AVISO «X aceptó tu presupuesto por N» DICE EL IMPORTE QUE EL CLIENTE ACEPTÓ.
//
// Medido por la ruta real: con tramos, la fila partía de 121 €, el cliente elegía el de 363 €, la
// fila y la respuesta decían 363… y el WhatsApp al profesional decía «121.00 EUR». La línea del
// aviso leía `quote` (la fila de ANTES del `update`) y escribía el número a mano, en inglés.
//
// Por la PUERTA: `POST /quote/:token/decision` de verdad (`dist`), base doblada por
// `_envio-doblado.mjs` y WhatsApp en dry-run: se LEE el mensaje que sale (`__waDryRunOutbox`), no
// se construye en el test (el error que dejó vivo SCRUM-1229). ⛔ Sin red ni base.
process.env.WHATSAPP_DRY_RUN = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';

const RUTAS = '../dist/modules/quotes/app/routes/quotes.routes.js';
const copia = (x) => JSON.parse(JSON.stringify(x));
const TOKEN = 'c'.repeat(32);
const TEL_PRO = '34000001278'; // rango imposible (SCRUM-262)

// Dos tramos: 100 € + 21 % = 121,00 € y 300 € + 21 % = 363,00 €.
const TRAMOS = [
  { id: 'basico', name: 'Básico', lines: [{ concept: 'Revisión', qty: 1, price: 100, tax: 0.21 }] },
  { id: 'completo', name: 'Completo', lines: [{ concept: 'Revisión y cambio', qty: 1, price: 300, tax: 0.21 }] },
];

function presupuesto(extra = {}) {
  return {
    id: 1277, merchantId: MERCHANT, customerId: CLIENTE, status: 'sent', total: '121.00', currency: 'EUR',
    lines: TRAMOS[0].lines, quoteNumber: 1277, revision: 0,
    decisionToken: TOKEN, validUntil: new Date(Date.now() + 10 * 86400000), paymentTerms: 'FULL_UPFRONT',
    tiers: null, discountGlobalAmount: null, acceptedAt: null, rejectedAt: null, rejectionReason: null, jobId: null,
    createdAt: new Date(), updatedAt: new Date(),
    // Modo `receipt` (ES sin facturación): el viaje no entra en la emisión, que no es de este ticket.
    merchant: { id: MERCHANT, name: 'Fontanería 1277', legalName: null, taxId: null, country: 'ES',
      whatsappPhone: TEL_PRO, defaultCurrency: 'EUR', flags: null, timezone: 'Europe/Madrid' },
    customer: { id: CLIENTE, name: 'Cliente 1277', phone: '34000001279' },
    Invoice: [],
    ...extra,
  };
}

/** Acepta por la ruta real y devuelve la fila guardada y el aviso que ha salido hacia el profesional. */
async function aceptar(inicial, body) {
  const fila = presupuesto(inicial);
  inyectarBase({
    'quote.findUnique': ({ where }) => {
      if (where.decisionToken === TOKEN) return copia(fila);
      if (where.id === fila.id) return { status: fila.status };
      return null;
    },
    'quote.update': ({ data }) => { Object.assign(fila, copia(data)); return copia(fila); },
    'customerEvent.create': () => ({}),
  }, [RUTAS, '../dist/modules/system/customerEvents.service.js']);
  globalThis.__waDryRunOutbox = [];
  const router = moduloDeDist(RUTAS).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/:token/decision');
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const r = { status: 200, data: undefined };
  const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; }, setHeader() {} };
  await h({ params: { token: TOKEN }, body: { decision: 'accept', ...body }, headers: {}, ip: '127.0.0.1', socket: {} }, res);
  await new Promise((ok) => setTimeout(ok, 50)); // el aviso es fire-and-forget
  const avisos = globalThis.__waDryRunOutbox.filter((m) => m.to === TEL_PRO);
  assert.equal(r.status, 200, `la aceptación no ha entrado: ${JSON.stringify(r.data)}`);
  assert.equal(avisos.length, 1, 'el profesional recibe UN aviso de aceptación');
  return { fila, texto: avisos[0].text };
}

// El «N» del aviso, sacado del mensaje que salió. Un NBSP de Intl entre número y € se normaliza.
const importeDelAviso = (texto) => (texto.match(/ por (.+)$/) || [])[1]?.replace(/ /g, ' ');

test('🔴 SCRUM-1277 · 1 · tramo MAYOR (121 → 363): el aviso dice 363,00 €, lo mismo que la fila', async () => {
  const { fila, texto } = await aceptar({ tiers: TRAMOS }, { tierId: 'completo' });
  assert.equal(Number(fila.total), 363, 'control del banco: la fila guardada es la del tramo');
  assert.equal(importeDelAviso(texto), '363,00 €', `🔴 el aviso no dice lo que el cliente aceptó: «${texto}»`);
});

test('🔴 SCRUM-1277 · 2 · tramo MENOR (363 → 121): el aviso dice 121,00 €', async () => {
  const { fila, texto } = await aceptar({ tiers: TRAMOS, total: '363.00', lines: TRAMOS[1].lines }, { tierId: 'basico' });
  assert.equal(Number(fila.total), 121);
  assert.equal(importeDelAviso(texto), '121,00 €', `🔴 el aviso no dice lo que el cliente aceptó: «${texto}»`);
});

// Control positivo: sin esto, 1 y 2 pasarían igual si el aviso dijera siempre el tramo o siempre 0.
test('SCRUM-1277 · 3 · control: SIN tramos el aviso dice el total del presupuesto, como siempre', async () => {
  const { texto } = await aceptar({ total: '1234.50' }, {});
  assert.equal(importeDelAviso(texto), '1.234,50 €', `el total sin tramos ha cambiado: «${texto}»`);
});

test('SCRUM-1277 · 4 · formato es-ES: ni punto decimal ni «EUR» detrás', async () => {
  const { texto } = await aceptar({ tiers: TRAMOS }, { tierId: 'completo' });
  assert.ok(!/\d\.\d{2}\b/.test(texto), `🔴 punto decimal inglés en «${texto}»`);
  assert.ok(!/\bEUR\b/.test(texto), `🔴 código de moneda en vez de símbolo en «${texto}»`);
  assert.match(texto, /\d,\d{2}\s€$/, 'el importe termina en coma decimal y símbolo €');
});
