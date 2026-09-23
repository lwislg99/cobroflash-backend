// tests/scrum923-fallback-cuenta-conectada.test.mjs — SCRUM-923
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL FALLBACK "STRIPE SIN WEBHOOKS" NUNCA ENCONTRABA LA SESIÓN DE UN MERCHANT CON CONNECT.
//
// `payCard.routes.ts:103-105` crea la Checkout Session con `{ stripeAccount: merchant.stripeAccountId }`
// cuando el merchant tiene Connect activo (direct charge, regla 23: el merchant es merchant-of-record).
// `receipt.routes.ts` la recuperaba con `stripe.checkout.sessions.retrieve(sessId)`, SIN `stripeAccount`
// — y en Stripe una sesión creada en una cuenta conectada no existe para quien la pide sin decir de
// qué cuenta. El SDK responde `No such checkout.session` (resource_missing), el `catch` de fuera lo
// traga y calla, y el cliente vuelve de pagar con tarjeta a un recibo que sigue diciendo "pendiente".
//
// Remedio: recomputar el MISMO criterio que ya usa la creación — `cardChargeMode(charge.merchant)`,
// que YA estaba importado en `receipt.routes.ts` (de SCRUM-893) — y si da `'connect'`, pasarle la
// cuenta conectada al `retrieve`. Mismo patrón que SCRUM-893/910: atar contra lo que la puerta de
// cobro HACE, no contra una copia del criterio.
//
// ── QUÉ VIGILA ESTE FICHERO ───────────────────────────────────────────────────────────────────
//
//   ① 🔴 EL CASO DEL TICKET  merchant con Connect: el fallback SÍ encuentra la sesión y el recibo
//                            pasa a "pagado" — el doble de Stripe sólo responde si `stripeAccount`
//                            coincide con la cuenta conectada del merchant, igual que Stripe de verdad.
//   ② CONTROL              merchant SIN Connect (cuenta de plataforma): seguía funcionando ANTES y
//                            tiene que seguir funcionando IGUAL después — el `retrieve` no debe
//                            empezar a mandar una cuenta que no existe.
//
// 🔴 Ni BD, ni red. Ruta real con dobles en `require.cache` — prisma, stripe Y axios (el fallback
//    hace un POST interno a `/webhooks/psp`) — mismo patrón que
//    `tests/scrum910-la-transferencia-que-no-mira.test.mjs`. `node:http` con `agent:false`, nunca
//    `fetch` (SCRUM-556/SCRUM-100: crash de libuv en Windows con 3+ peticiones sobre el mismo
//    `app.listen(0)`).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
const R_STRIPE = require_.resolve('./dist/integrations/stripe.js');
const R_AXIOS = require_.resolve('axios');
const R_RECIBO = require_.resolve('./dist/modules/billing/app/routes/receipt.routes.js');

const poner = (r, e) => { require_.cache[r] = { id: r, filename: r, loaded: true, exports: e }; };

const CUENTA_CONECTADA = 'acct_923conectada';

function merchant(extra = {}) {
  return {
    id: 55, name: 'Electricidad Soto', legalName: 'Electricidad Soto SL',
    country: 'ES', iban: null, clabe: null, bizumPhone: null,
    connectStatus: 'none', stripeAccountId: null, flags: null,
    googleReviewUrl: null, ...extra,
  };
}

const CONNECT = {
  connectStatus: 'active', stripeAccountId: CUENTA_CONECTADA,
  flags: { PAYMENTS_CONNECT_ENABLED: true },
};

/** El doble de Stripe SÓLO encuentra la sesión si `stripeAccount` coincide con `cuentaEsperada`
 *  (`undefined` para una sesión de la cuenta de PLATAFORMA) — exactamente como Stripe de verdad:
 *  una sesión es de UNA cuenta, y pedirla desde otra (o sin decir cuál) da `resource_missing`. */
function dobleStripe(cuentaEsperada) {
  return {
    stripe: {
      checkout: {
        sessions: {
          retrieve: async (sessId, options) => {
            const cuenta = options?.stripeAccount;
            if (cuenta !== cuentaEsperada) {
              const err = new Error(`No such checkout.session: '${sessId}'`);
              err.code = 'resource_missing';
              throw err;
            }
            return {
              id: sessId, payment_status: 'paid', status: 'complete',
              payment_intent: 'pi_923', amount_total: 12000, currency: 'eur',
            };
          },
        },
      },
    },
  };
}

function getSinAgente(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'GET', agent: false },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, cuerpo: data }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function pedir(m, cuentaEsperadaEnStripe) {
  delete require_.cache[R_RECIBO];

  let llamadasCharge = 0;
  let llamadasAxios = 0;
  const cargoBase = {
    id: 12, receiptToken: 'tok923', amount: 120, currency: 'EUR',
    concept: 'Instalación de cuadro eléctrico', method: null, createdAt: new Date(),
    merchant: m, customer: { id: 4, name: 'Marta', email: null }, events: [], reconciliations: [],
  };

  poner(R_PRISMA, { prisma: {
    charge: {
      findUnique: async () => {
        llamadasCharge += 1;
        // 1ª lectura (antes del fallback): pendiente, como llega el cliente al volver de Stripe.
        // 2ª lectura (sólo si el fallback confirmó el pago): pagado — es el propio código quien
        // decide si hay 2ª lectura, este doble sólo responde lo que tocaría en cada una.
        return { ...cargoBase, status: llamadasCharge === 1 ? 'pending' : 'paid' };
      },
    },
    quote: { findFirst: async () => null },
    invoice: { findFirst: async () => null, findUnique: async () => null },
  } });
  poner(R_STRIPE, dobleStripe(cuentaEsperadaEnStripe));
  poner(R_AXIOS, { post: async () => { llamadasAxios += 1; return { status: 200, data: {} }; } });

  const express = require_('express');
  const app = express();
  app.use('/recibo', require_(R_RECIBO).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { status, cuerpo } = await getSinAgente(
    server.address().port,
    '/recibo/tok923?card=success&session_id=cs_923',
  );
  await new Promise((r) => server.close(r));
  return { status, cuerpo, llamadasCharge, llamadasAxios };
}

test('SCRUM-923 · 🔴 ① merchant con Connect: el fallback SÍ encuentra la sesión y confirma el pago', async () => {
  const r = await pedir(merchant(CONNECT), CUENTA_CONECTADA);

  assert.equal(r.status, 200, `🔴 CIEGO: devolvió HTTP ${r.status}.`);
  assert.ok(r.cuerpo.includes('Recibo') || r.cuerpo.includes('Electricidad Soto'),
    '🔴 CIEGO: la página no se pintó — el test no está midiendo nada.');
  assert.equal(r.llamadasAxios, 1,
    '🔴 el fallback no llegó a confirmar el pago (el `retrieve` de Stripe fue el que cortó el paso):\n'
    + `    axios.post se llamó ${r.llamadasAxios} veces, se esperaba 1.`);
  assert.ok(r.cuerpo.includes('Pago recibido correctamente'),
    '🔴 SIGUE SIN ENCONTRAR LA SESIÓN: un merchant con Connect vuelve de pagar con tarjeta y el\n'
    + '    recibo sigue diciendo "pendiente" — `stripe.checkout.sessions.retrieve` no lleva\n'
    + '    `{ stripeAccount }`, así que Stripe no encuentra una sesión que vive en la cuenta\n'
    + '    conectada del merchant, no en la de plataforma.');
});

test('SCRUM-923 · ② CONTROL: merchant SIN Connect (cuenta de plataforma) sigue funcionando igual', async () => {
  const r = await pedir(merchant(), undefined);

  assert.equal(r.status, 200, `🔴 CIEGO: devolvió HTTP ${r.status}.`);
  assert.equal(r.llamadasAxios, 1,
    `🔴 CIEGO: el fallback de un merchant SIN Connect dejó de confirmar el pago (regresión) —\n`
    + `    axios.post se llamó ${r.llamadasAxios} veces, se esperaba 1.`);
  assert.ok(r.cuerpo.includes('Pago recibido correctamente'),
    '🔴 REGRESIÓN: un merchant SIN Connect (cuenta de plataforma, el caso que YA funcionaba) dejó\n'
    + '    de confirmar el pago — el arreglo no debe mandar `stripeAccount` cuando no hace falta.');
});
