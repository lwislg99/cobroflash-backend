// SCRUM-1001 · LA PÁGINA DEL CLIENTE NO PROMETE UN PAGO QUE NO ESTÁ.
//
// Con `INVOICING_ES_ENABLED` OFF (modo `receipt`: ES real) la página de firma muestra las condiciones
// de pago y, tras aceptar, no hay botón de pagar. Se añade —solo en ese estado y tras aceptar— la línea
// FIRMADA por Javier el 21-sep-2026: «El profesional te enviará la factura y las instrucciones de pago
// por su cuenta.» Con el botón (fiscal/demo/no-ES) no se toca nada.
//
// Sin banco: la ruta REAL (`quoteDecisionLandingRouter`) sobre express, con `prisma.quote.findUnique`
// sustituido, y el HTML que sale de verdad.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../dist/core/db/prisma.js';
import { quoteDecisionLandingRouter } from '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';

const LITERAL = 'El profesional te enviará la factura y las instrucciones de pago por su cuenta.';
const TOKEN = 'abcdef0123456789abcdef0123456789';

const merchant = (o = {}) => ({
  id: 77, email: 'obra@ejemplo.es', flags: null, name: 'Electricidad', legalName: null, logoUrl: null,
  address: null, country: 'ES', brandColor: null, brandAccentColor: null, whatsappPhone: null,
  timezone: 'Europe/Madrid', ...o,
});
const presupuesto = (m) => ({
  id: 9, quoteNumber: 1, currency: 'EUR', total: 121, status: 'sent',
  createdAt: new Date('2026-09-20T10:00:00Z'), validUntil: null, paymentTerms: 'FIFTY_FIFTY',
  customBillingPlan: null, discountGlobalAmount: null, acceptedAt: null, rejectedAt: null,
  merchant: m, customer: { name: 'Cliente' },
  lines: [{ concept: 'Cuadro', qty: 1, price: 100, tax: 0.21 }],
});

async function pagina(m) {
  const original = prisma.quote.findUnique;
  prisma.quote.findUnique = async () => presupuesto(m);
  // El handler REAL de `GET /quote/:token`, con req/res mínimos (sin abrir sockets).
  const capa = quoteDecisionLandingRouter.stack.find((l) => l.route?.path?.includes?.('/quote/:token'));
  assert.ok(capa, 'no encuentro la ruta GET /quote/:token');
  let status = 200;
  let html = '';
  const res = {
    setHeader() { return res; },
    status(c) { status = c; return res; },
    send(b) { html = String(b); return res; },
    redirect() { return res; },
  };
  try {
    await capa.route.stack[0].handle({ params: { token: TOKEN }, query: {}, headers: {} }, res);
  } finally {
    prisma.quote.findUnique = original;
  }
  return { status, html };
}

test('SCRUM-1001 · SUELO: la página se monta y trae el script de aceptar', async () => {
  const { status, html } = await pagina(merchant());
  assert.equal(status, 200);
  assert.ok(html.includes("fetch('/quote/"), 'sin el script de decisión no se ha renderizado la página de firma');
  assert.ok(html.includes('ya tiene tu confirmación'), 'sin la pantalla de «aceptado» no hay dónde poner la línea');
});

test('SCRUM-1001 · ES real con INVOICING_ES_ENABLED OFF: tras aceptar, la línea firmada (una vez)', async () => {
  const { html } = await pagina(merchant());
  assert.equal(html.split(LITERAL).length - 1, 1, 'el literal firmado debe salir exactamente una vez');
});

test('SCRUM-1001 · donde el pago existe NO se toca nada: demo y no-ES sin la línea', async () => {
  for (const m of [merchant({ id: 1, email: 'demo@yaqu.app' }), merchant({ country: 'MX' })]) {
    const { html } = await pagina(m);
    assert.ok(html.includes('ya tiene tu confirmación'), 'control: la página se monta');
    assert.ok(!html.includes(LITERAL), `no debe salir para ${m.country}/${m.email}`);
  }
});
