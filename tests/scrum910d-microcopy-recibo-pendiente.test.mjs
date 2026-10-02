// tests/scrum910d-microcopy-recibo-pendiente.test.mjs — SCRUM-910 ②
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// `/recibo/:token` (ch.status === 'pending') decía SIEMPRE «usando los botones de pago por banco o
// pago con tarjeta», aunque con SCRUM-893 + SCRUM-910③ ya en `main` esos botones son CONDICIONALES
// (`puedeTransferencia` / `puedeTarjeta`, `receipt.routes.ts:123-124`). Un merchant con solo uno de
// los dos —o con NINGUNO, el caso más grave: sin Connect y sin IBAN/CLABE— veía un texto que nombra
// un botón que no está en la pantalla.
//
// Variante A (Jira SCRUM-910, comentario 16278 de Luis, firma del orquestador en el 16527): la
// frase nombra SOLO lo que se pinta. Cuatro literales, dos ya firmados (no se tocan) y dos NUEVOS
// firmados en el comentario 16527:
//
//   ambos ......... (ya firmado, SIN cambio) «...usando los botones de <b>pago por banco</b> o
//                    <b>pago con tarjeta</b> que aparecen más arriba.»
//   solo banco .... (NUEVO, firmado 16527)   «...usando el botón de <b>pago por banco</b> que
//                    aparece más arriba.»
//   solo tarjeta .. (NUEVO, firmado 16527)   «...usando el botón de <b>pago con tarjeta</b> que
//                    aparece más arriba.»
//   ninguno ....... reusa, SIN palabra nueva, el literal YA FIRMADO de `payInvoice.routes.ts:242`
//                    («El profesional te indicará cómo pagar.<br/>Contacta con él si tienes dudas.»)
//
// 🔴 Ni BD, ni red, ni staging. La ruta real con dobles en `require.cache` — mismo harness que
// `tests/scrum910-la-transferencia-que-no-mira.test.mjs`.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
const R_STRIPE = require_.resolve('./dist/integrations/stripe.js');
const R_RECIBO = require_.resolve('./dist/modules/billing/app/routes/receipt.routes.js');

const poner = (r, e) => { require_.cache[r] = { id: r, filename: r, loaded: true, exports: e }; };

const IBAN = 'ES9121000418450200051332';
const CONNECT = { connectStatus: 'active', stripeAccountId: 'acct_T', flags: { PAYMENTS_CONNECT_ENABLED: true } };

function merchant(extra = {}) {
  return {
    id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', email: 'ruiz@ejemplo.test',
    country: 'ES', logoUrl: null, iban: null, clabe: null, bizumPhone: null, whatsappPhone: null,
    connectStatus: 'none', stripeAccountId: null, flags: null, ...extra,
  };
}

async function pedirRecibo(m) {
  delete require_.cache[R_RECIBO];
  const ch = {
    id: 7, receiptToken: 'tok910d', status: 'pending', amount: 250, currency: 'EUR',
    concept: 'Reparación de bajante', payMethods: null, createdAt: new Date(), merchant: m,
    customer: { id: 3, name: 'Ana', email: null }, events: [], reconciliations: [],
  };
  poner(R_PRISMA, { prisma: {
    charge: { findUnique: async () => ch, update: async () => ch },
    invoice: { findFirst: async () => null, findUnique: async () => null },
    quote: { findFirst: async () => null },
    event: { create: async () => ({ id: 1 }) },
  } });
  poner(R_STRIPE, { stripe: { checkout: { sessions: { create: async () => ({ id: 'cs', url: 'https://x.test' }) } } }, stripeEnabled: true });
  const express = require_('express');
  const app = express();
  app.use('/recibo', require_(R_RECIBO).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  // SCRUM-1204 · `node:http` con `agent: false`, NUNCA `fetch`. `fetch` es undici, que interpreta HTTP
  // con `llhttp` en WebAssembly. Tras unas pocas peticiones V8 lo recompila en segundo plano, y si
  // `--test-force-exit` cierra el proceso en medio, libuv aborta al salir (`UV_HANDLE_CLOSING`,
  // `src\win\async.c:94`) con los 5 tests en verde: 20/20 medido el 28-sep-2026. Mismo remedio que SCRUM-100/556
  // (scrum1107b, scrum1108b, scrum923, scrum924). No sigue redirecciones, como el `redirect: 'manual'`.
  const { status, cuerpo } = await new Promise((ok, ko) => {
    const req = http.request(
      { host: '127.0.0.1', port: server.address().port, path: '/recibo/tok910d', method: 'GET', agent: false },
      (res) => {
        let b = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { b += c; });
        res.on('end', () => ok({ status: res.statusCode, cuerpo: b }));
      },
    );
    req.on('error', ko);
    req.end();
  });
  await new Promise((r) => server.close(r));
  return { status, cuerpo };
}

const AMBOS = 'usando los botones de <b>pago por banco</b> o <b>pago con tarjeta</b> que aparecen más arriba';
const SOLO_BANCO = 'usando el botón de <b>pago por banco</b> que aparece más arriba';
const SOLO_TARJETA = 'usando el botón de <b>pago con tarjeta</b> que aparece más arriba';
const NINGUNO = 'El profesional te indicará cómo pagar.<br/>Contacta con él si tienes dudas.';

const CASOS = [
  { nombre: 'ambos', merchant: merchant({ ...CONNECT, iban: IBAN }), esperado: AMBOS, prohibidos: [SOLO_BANCO, SOLO_TARJETA, NINGUNO] },
  { nombre: 'solo banco', merchant: merchant({ iban: IBAN }), esperado: SOLO_BANCO, prohibidos: [AMBOS, SOLO_TARJETA, NINGUNO] },
  { nombre: 'solo tarjeta', merchant: merchant({ ...CONNECT }), esperado: SOLO_TARJETA, prohibidos: [AMBOS, SOLO_BANCO, NINGUNO] },
  { nombre: 'ninguno', merchant: merchant({}), esperado: NINGUNO, prohibidos: [AMBOS, SOLO_BANCO, SOLO_TARJETA] },
];

const caso2 = casosEscritos(CASOS, (c) => `SCRUM-910 ②: /recibo pendiente, caso «${c.nombre}» → el texto nombra SOLO lo que se pinta`, async (c) => {
  const r = await pedirRecibo(c.merchant);
  assert.equal(r.status, 200, `🔴 CIEGO: /recibo devolvió HTTP ${r.status}.`);
  assert.ok(
    r.cuerpo.includes(c.esperado),
    `🔴 falta el literal de «${c.nombre}»: «${c.esperado}»`,
  );
  for (const otro of c.prohibidos) {
    assert.equal(
      r.cuerpo.includes(otro),
      false,
      `🔴 el caso «${c.nombre}» pinta un literal de OTRO caso: «${otro}» — nombra un botón que no está.`,
    );
  }
});
test('SCRUM-910 ②: /recibo pendiente, caso «ambos» → el texto nombra SOLO lo que se pinta', caso2(0));
test('SCRUM-910 ②: /recibo pendiente, caso «solo banco» → el texto nombra SOLO lo que se pinta', caso2(1));
test('SCRUM-910 ②: /recibo pendiente, caso «solo tarjeta» → el texto nombra SOLO lo que se pinta', caso2(2));
test('SCRUM-910 ②: /recibo pendiente, caso «ninguno» → el texto nombra SOLO lo que se pinta', caso2(3));
caso2.todos();

// Control positivo del propio detector (guarda del detector, SCRUM-113): si los cuatro literales
// fueran indistinguibles entre sí (p. ej. por un `includes` que casa con una subcadena de otro),
// el bucle de arriba pasaría en vacío. Se comprueba que NINGUNO es subcadena de otro.
test('SCRUM-910 ②: control positivo — los cuatro literales son mutuamente distinguibles', () => {
  const literales = [AMBOS, SOLO_BANCO, SOLO_TARJETA, NINGUNO];
  for (const a of literales) {
    for (const b of literales) {
      if (a === b) continue;
      assert.equal(b.includes(a), false, `🔴 «${a}» es subcadena de «${b}»: el detector no discrimina.`);
    }
  }
});
