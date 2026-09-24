// SCRUM-678 (2) — ¿el webhook de Connect es VIA UNICA para confirmar un cobro con tarjeta?
//
// Se ejecutan las DOS rutas reales con dobles y se OBSERVA que le piden a Stripe:
//   · payCard.routes.ts  crea la sesion   -> ¿con stripeAccount?
//   · receipt.routes.ts  el fallback      -> ¿con stripeAccount?
// Si la sesion se CREA en la cuenta conectada y el fallback la BUSCA en la de plataforma,
// el fallback no puede encontrarla y el webhook se queda como unica via.
//
// Ni BD, ni red, ni Stripe real, ni una credencial.
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = process.argv[2];
const require_ = createRequire(path.join(RAIZ, 'package.json'));
const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
const R_STRIPE = require_.resolve('./dist/integrations/stripe.js');
const R_CARD = require_.resolve('./dist/modules/billing/app/routes/payCard.routes.js');
const R_RECIBO = require_.resolve('./dist/modules/billing/app/routes/receipt.routes.js');

const poner = (r, e) => { require_.cache[r] = { id: r, filename: r, loaded: true, exports: e }; };

const CONNECT = {
  id: 42, name: 'N', legalName: 'N SL', email: 'r@e.test', country: 'ES', logoUrl: null,
  iban: null, clabe: null, bizumPhone: null, whatsappPhone: null,
  connectStatus: 'active', stripeAccountId: 'acct_CONECTADA',
  flags: { PAYMENTS_CONNECT_ENABLED: true },
};

function dobles(espia, chargeStatus = 'pending') {
  const ch = {
    id: 7, receiptToken: 'tok678', status: chargeStatus, amount: 250, currency: 'EUR',
    concept: 'Obra', payMethods: null, createdAt: new Date(), merchant: CONNECT,
    customer: { id: 3, name: 'Ana', email: null }, events: [], reconciliations: [],
  };
  poner(R_PRISMA, { prisma: {
    charge: { findUnique: async () => ch, update: async () => ch },
    invoice: { findFirst: async () => null, findUnique: async () => null },
    quote: { findFirst: async () => null },
    event: { create: async () => ({ id: 1 }) },
  } });
  poner(R_STRIPE, { stripeEnabled: true, stripe: {
    checkout: { sessions: {
      create: async (_p, opts) => {
        espia.creada = { stripeAccount: opts?.stripeAccount ?? null };
        return { id: 'cs_678', url: 'https://checkout.test/678' };
      },
      retrieve: async (_id, opts) => {
        espia.recuperada = { stripeAccount: opts?.stripeAccount ?? null };
        // Devolvemos algo "pagado": lo que se mide es CON QUE se preguntó, no la respuesta.
        return { id: 'cs_678', payment_status: 'paid', status: 'complete', payment_intent: 'pi_1' };
      },
    } },
  } });
}

async function pedir(modulo, montaje, url, espia, chargeStatus) {
  delete require_.cache[modulo];
  dobles(espia, chargeStatus);
  const express = require_('express');
  const app = express();
  app.use(montaje, require_(modulo).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const res = await fetch(`http://127.0.0.1:${server.address().port}${url}`, { redirect: 'manual' });
  await res.text();
  await new Promise((r) => server.close(r));
  return res.status;
}

console.log('POBLACION: 2 rutas reales, un merchant CON Stripe Connect activo.\n');

const e1 = {};
const s1 = await pedir(R_CARD, '/pay', '/pay/card/tok678', e1, 'pending');
console.log(`payCard  [HTTP ${s1}]  crea la sesion con stripeAccount = ${JSON.stringify(e1.creada?.stripeAccount)}`);

const e2 = {};
const s2 = await pedir(R_RECIBO, '/recibo', '/recibo/tok678?card=success&session_id=cs_678', e2, 'pending');
console.log(`receipt  [HTTP ${s2}]  el fallback recupera con stripeAccount = ${JSON.stringify(e2.recuperada?.stripeAccount)}`);
console.log(`         (¿llego a llamar a retrieve? ${!!e2.recuperada})`);

console.log('');
const creaEnConectada = e1.creada?.stripeAccount === 'acct_CONECTADA';
const buscaEnPlataforma = e2.recuperada && e2.recuperada.stripeAccount === null;
console.log('VEREDICTO:');
console.log(`  la sesion se CREA en la cuenta conectada .... ${creaEnConectada}`);
console.log(`  el fallback la BUSCA en la de plataforma .... ${buscaEnPlataforma}`);
console.log(creaEnConectada && buscaEnPlataforma
  ? '  🔴 EL FALLBACK NO PUEDE ENCONTRARLA -> para un cobro Connect, el webhook es VIA UNICA.'
  : '  — no se cumple el patron; revisar antes de concluir.');
