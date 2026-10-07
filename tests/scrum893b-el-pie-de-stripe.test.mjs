// tests/scrum893b-el-pie-de-stripe.test.mjs — SCRUM-893b
//
// EL PIE DE LA PÁGINA DE PAGO SÓLO NOMBRA A STRIPE SI ALGO DE LO QUE SE PINTA PASA POR STRIPE.
//
// SCRUM-893 dejó de ofrecer la tarjeta a quien no puede cobrarla, pero el pie de
// `GET /pay/invoice/:token` siguió diciendo «Procesado por Stripe · Nunca vemos los datos de tu
// tarjeta» en todas las páginas: también en la que sólo ofrece transferencia, y en la que no
// ofrece nada. Lo vio la Sesión 3 en su PASO 0 (comentario 15663 del ticket) y no lo recogió nadie.
//
// Se ejecuta la RUTA REAL contra dobles en `require.cache` (el patrón de `scrum893-solo-lo-que-
// puede-cobrar`): leer el fuente mediría el texto, y aquí lo que importa es qué página sale.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
const R_INVOICE = require_.resolve('./dist/modules/billing/app/routes/payInvoice.routes.js');

const PIE = 'Procesado por Stripe';
// El BOTÓN de la tarjeta, no su texto: «Pagar con tarjeta» a secas también está en dos comentarios
// del CSS que la página sirve, así que buscarlo suelto da «sí» en todas las páginas.
const BOTON_TARJETA = '<span class="method-title">Pagar con tarjeta</span>';

function merchant(extra = {}) {
  return {
    id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL',
    email: 'ruiz@ejemplo.test', country: 'ES', logoUrl: null,
    iban: null, clabe: null, bizumPhone: null, whatsappPhone: null,
    connectStatus: 'none', stripeAccountId: null, flags: null,
    ...extra,
  };
}

/** Pinta la página de pago de un cobro pendiente de `m` y devuelve el HTML. */
async function pagina(m, cobro = {}) {
  const ch = {
    id: 7, receiptToken: 'tok893b', status: 'pending', amount: 250, currency: 'EUR',
    concept: 'Reparación de bajante', payMethods: null, createdAt: new Date(),
    merchant: m, ...cobro,
  };
  delete require_.cache[R_INVOICE];
  require_.cache[R_PRISMA] = {
    id: R_PRISMA, filename: R_PRISMA, loaded: true,
    exports: { prisma: { charge: { findUnique: async () => ch }, invoice: { findFirst: async () => null } } },
  };
  const app = require_('express')();
  app.use('/pay', require_(R_INVOICE).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const res = await fetch(`http://127.0.0.1:${server.address().port}/pay/invoice/tok893b`, { redirect: 'manual' });
  const cuerpo = await res.text();
  await new Promise((r) => server.close(r));

  // SUELO: la página se pintó. Un 500 tampoco contiene el pie, y sería un verde sobre nada.
  assert.equal(res.status, 200, `🔴 CIEGO: la página devolvió HTTP ${res.status}.`);
  assert.ok(cuerpo.includes('Elige cómo pagar') && cuerpo.includes('250,00'),
    '🔴 CIEGO: la página no contiene ni el rótulo ni el importe, así que no se pintó.');
  return cuerpo;
}

const IBAN = 'ES9121000418450200051332';
const CON_CONNECT = { connectStatus: 'active', stripeAccountId: 'acct_TEST893B' };

test('SCRUM-893b · sólo transferencia: la página NO dice «Procesado por Stripe»', async () => {
  const html = await pagina(merchant({ iban: IBAN }));
  assert.ok(html.includes('/pay/bank/'), '🔴 CIEGO: este caso tenía que ofrecer la transferencia.');
  assert.equal(html.includes('/pay/card/'), false, '🔴 CIEGO: este caso no tenía que ofrecer nada de Stripe.');
  assert.equal(html.includes(PIE), false,
    '🔴 La página sólo ofrece transferencia y le dice a la clienta que el pago lo procesa Stripe\n'
    + '    y que «nunca vemos los datos de tu tarjeta». Aquí no hay tarjeta ni Stripe.');
});

test('SCRUM-893b · sólo Bizum manual: la página NO dice «Procesado por Stripe»', async () => {
  const html = await pagina(merchant({ bizumPhone: '600111222', flags: { BIZUM_MANUAL_ENABLED: true } }));
  assert.ok(html.includes('/pay/bizum/'), '🔴 CIEGO: este caso tenía que ofrecer el Bizum manual.');
  assert.equal(html.includes('/pay/card/'), false, '🔴 CIEGO: este caso no tenía que ofrecer nada de Stripe.');
  assert.equal(html.includes(PIE), false, '🔴 Sólo Bizum manual (de móvil a móvil) y el pie nombra a Stripe.');
});

test('SCRUM-893b · ninguna vía: la página NO dice «Procesado por Stripe»', async () => {
  const html = await pagina(merchant());
  assert.ok(/El profesional te indicar/.test(html), '🔴 CIEGO: este caso tenía que pintar el mensaje de «sin vías».');
  assert.equal(html.includes(PIE), false, '🔴 No se ofrece ninguna vía de pago y el pie nombra a Stripe.');
});

// La otra mitad: sin ella, borrar el pie de todas las páginas pasaría los tres casos de arriba.
test('SCRUM-893b · con tarjeta (Connect activo): el pie de Stripe SIGUE saliendo', async () => {
  const html = await pagina(merchant({ iban: IBAN, ...CON_CONNECT, flags: { PAYMENTS_CONNECT_ENABLED: true } }));
  assert.ok(html.includes(BOTON_TARJETA), '🔴 CIEGO: este caso tenía que ofrecer la tarjeta.');
  assert.ok(html.includes(PIE), '🔴 La página ofrece tarjeta y ha perdido el pie que dice quién la procesa.');
});

// El Bizum automático va por el Checkout de Stripe (`/pay/card`) aunque el PRO haya quitado la
// tarjeta de ESTE cobro: por eso el pie mira la lista pintada y no `hasCard`.
test('SCRUM-893b · sin tarjeta pero con Bizum automático: el pie de Stripe SIGUE saliendo', async () => {
  const html = await pagina(
    merchant({ ...CON_CONNECT, flags: { PAYMENTS_CONNECT_ENABLED: true, BIZUM_AUTO_ENABLED: true } }),
    { payMethods: ['bizum'] },
  );
  assert.ok(html.includes('Bizum al instante'), '🔴 CIEGO: este caso tenía que ofrecer el Bizum automático.');
  assert.equal(html.includes(BOTON_TARJETA), false, '🔴 CIEGO: en este cobro el PRO quitó la tarjeta.');
  assert.ok(html.includes(PIE), '🔴 El Bizum automático lo procesa Stripe y la página ya no lo dice.');
});
