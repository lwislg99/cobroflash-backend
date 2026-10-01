// tests/scrum1312-boton-email-recibo-gateado.test.mjs — SCRUM-1312
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// El recibo PAGADO, con PDF real y cliente con email, le pintaba al CLIENTE FINAL un botón
// «Enviar … por email» cuyo formulario hace POST a `/dev/email-invoice/…`. `/dev` no se monta en
// producción (`app.ts`), así que en producción el botón daba 404.
//
// Decisión del fundador (Jira SCRUM-1312, comentario 17667, «1-Ok ve a por la A»): el botón NO se
// pinta en producción, con la MISMA condición que SCRUM-807 puso al banner `saved` y SCRUM-1309 al
// `sent`. El texto no cambia (regla 39). La (b) —construir el envío real— queda descartada (regla 28).
//
// 🔴 Ni BD, ni red, ni staging. La ruta real con dobles en `require.cache` — mismo harness que
// `tests/scrum1309-banner-mail-sent-gateado.test.mjs`.
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
const R_RECIBO = require_.resolve('./dist/modules/billing/app/routes/receipt.routes.js');
const { config } = require_('./dist/core/config/env.js');

const poner = (r, e) => { require_.cache[r] = { id: r, filename: r, loaded: true, exports: e }; };

// Lo que se vigila, tal cual lo pinta la ruta. No se reformula.
const FORM = '/dev/email-invoice/7';
const BOTON = '<button class="btn-email">Enviar factura por email</button>';
const DESTINO = 'Se enviará a: ana@ejemplo.test';
const PDF = 'Descargar factura en PDF (2026-CF-001)';

async function pedirRecibo(query, entorno) {
  delete require_.cache[R_RECIBO];
  const ch = {
    id: 7, receiptToken: 'tok1312', status: 'paid', amount: 250, currency: 'EUR',
    concept: 'Reparación de bajante', payMethods: null, createdAt: new Date(), paidAt: new Date(),
    merchant: {
      id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', email: 'ruiz@ejemplo.test',
      country: 'ES', logoUrl: null, iban: null, clabe: null, bizumPhone: null, whatsappPhone: null,
      connectStatus: 'none', stripeAccountId: null, flags: null,
    },
    customer: { id: 3, name: 'Ana', email: 'ana@ejemplo.test' }, events: [], reconciliations: [],
  };
  const factura = { id: 5, number: '2026-CF-001', type: 'F1', pdfUrl: '/files/2026-CF-001.pdf' };
  poner(R_PRISMA, { prisma: {
    charge: { findUnique: async () => ch, update: async () => ch },
    invoice: { findFirst: async () => factura, findUnique: async () => factura },
    quote: { findFirst: async () => ({ id: 11, chargeId: 7 }) },
    event: { create: async () => ({ id: 1 }) },
  } });
  poner(R_STRIPE, { stripe: { checkout: { sessions: { create: async () => ({ id: 'cs', url: 'https://x.test' }) } } }, stripeEnabled: true });
  const express = require_('express');
  const app = express();
  app.use('/recibo', require_(R_RECIBO).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const antes = config.NODE_ENV;
  config.NODE_ENV = entorno;
  try {
    // `node:http` con `agent: false`, NUNCA `fetch` (SCRUM-1204, ver scrum910d).
    return await new Promise((ok, ko) => {
      const req = http.request(
        { host: '127.0.0.1', port: server.address().port, path: `/recibo/tok1312${query}`, method: 'GET', agent: false },
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
  } finally {
    config.NODE_ENV = antes;
    await new Promise((r) => server.close(r));
  }
}

// Sin el enlace al PDF, el caso no es «recibo pagado con factura real» y el botón faltaría por
// OTRO motivo: el verde sería CIEGO.
function sujeto(r) {
  assert.equal(r.status, 200, `🔴 CIEGO: /recibo devolvió HTTP ${r.status}; el caso no llegó a medirse.`);
  assert.ok(r.cuerpo.includes(PDF), '🔴 CIEGO: la página no pinta el PDF de la factura; el doble no llegó al caso pagado.');
}

test('SCRUM-1312 · 🔴 EL QUE DECIDE: en producción el recibo pagado NO pinta el botón a `/dev`', async () => {
  const r = await pedirRecibo('', 'production');
  sujeto(r);
  assert.ok(!r.cuerpo.includes(FORM) && !r.cuerpo.includes(BOTON) && !r.cuerpo.includes(DESTINO),
    'en producción la página del CLIENTE FINAL le pinta «Enviar factura por email», y su formulario\n' +
    '  hace POST a `/dev/email-invoice`, que en producción no existe: el botón da 404.');
});

test('SCRUM-1312 · ✅ EL POSITIVO: fuera de producción el botón SÍ está (ahí `/dev` existe)', async () => {
  const r = await pedirRecibo('', 'development');
  sujeto(r);
  assert.ok(r.cuerpo.includes(FORM) && r.cuerpo.includes(BOTON) && r.cuerpo.includes(DESTINO),
    'fuera de producción el botón ya no sale, y ahí `/dev/email-invoice` funciona.\n' +
    '  Sin este control, «no se pinta nunca» pasaría por un arreglo.');
});

test('SCRUM-1312 · ⛔ `sent` y `saved` siguen como los dejaron SCRUM-1309 y SCRUM-807', async () => {
  const ENVIADO = '📧 Email enviado correctamente.';
  const GENERADO = '📧 Email generado en';
  const eml = encodeURIComponent('/outbox/invoice-2026-CF-001.eml');
  const sentProd = await pedirRecibo('?mail=sent', 'production');
  sujeto(sentProd);
  assert.ok(!sentProd.cuerpo.includes(ENVIADO), '`sent` ha vuelto a salir en producción (SCRUM-1309)');
  const sentDev = await pedirRecibo('?mail=sent', 'development');
  assert.ok(sentDev.cuerpo.includes(ENVIADO), '`sent` ya no sale fuera de producción (SCRUM-1309)');
  const savedProd = await pedirRecibo(`?mail=saved&eml=${eml}`, 'production');
  assert.ok(!savedProd.cuerpo.includes(GENERADO), '`saved` ha vuelto a salir en producción (SCRUM-807)');
  const savedDev = await pedirRecibo(`?mail=saved&eml=${eml}`, 'development');
  assert.ok(savedDev.cuerpo.includes(GENERADO), '`saved` ya no sale fuera de producción (SCRUM-807)');
});
