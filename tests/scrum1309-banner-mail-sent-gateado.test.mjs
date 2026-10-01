// tests/scrum1309-banner-mail-sent-gateado.test.mjs — SCRUM-1309
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// `GET /recibo/:token?mail=sent` pintaba «📧 Email enviado correctamente.» SIN mirar el entorno.
// La página la ve el CLIENTE FINAL, y el banner afirma un hecho: que se le mandó un correo.
//
// Su ÚNICO productor es `dev.routes.ts` (el redirect tras `POST /dev/email-invoice/:id`), y `/dev`
// sólo se monta con `NODE_ENV !== 'production'` (`app.ts`). En producción nadie puede producir
// ese `?mail=sent`… salvo escribiéndolo a mano en un enlace `/recibo/<token>`.
//
// SCRUM-807 gateó el hermano `saved` («(modo dev)») y dejó fuera éste. Esto termina aquella
// decisión con la MISMA condición (`config.NODE_ENV !== 'production'`), sin tocar el texto (regla 39).
//
// 🔴 Ni BD, ni red, ni staging. La ruta real con dobles en `require.cache` — mismo harness que
// `tests/scrum910d-microcopy-recibo-pendiente.test.mjs`. El entorno se cambia en el MISMO objeto
// `config` que lee la ruta en cada petición.
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

// Los dos literales, tal cual los pinta la ruta. No se reformulan: son lo que se vigila.
const ENVIADO = '📧 Email enviado correctamente.';
const GENERADO = '📧 Email generado en';

async function pedirRecibo(query, entorno) {
  delete require_.cache[R_RECIBO];
  const ch = {
    id: 7, receiptToken: 'tok1309', status: 'pending', amount: 250, currency: 'EUR',
    concept: 'Reparación de bajante', payMethods: null, createdAt: new Date(),
    merchant: {
      id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', email: 'ruiz@ejemplo.test',
      country: 'ES', logoUrl: null, iban: null, clabe: null, bizumPhone: null, whatsappPhone: null,
      connectStatus: 'none', stripeAccountId: null, flags: null,
    },
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
  const antes = config.NODE_ENV;
  config.NODE_ENV = entorno;
  try {
    // `node:http` con `agent: false`, NUNCA `fetch` (SCRUM-1204, ver scrum910d).
    return await new Promise((ok, ko) => {
      const req = http.request(
        { host: '127.0.0.1', port: server.address().port, path: `/recibo/tok1309?${query}`, method: 'GET', agent: false },
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

test('SCRUM-1309 · 🔴 EL QUE DECIDE: en producción, `?mail=sent` a mano NO pinta «enviado»', async () => {
  const r = await pedirRecibo('mail=sent', 'production');
  assert.equal(r.status, 200, `🔴 CIEGO: /recibo devolvió HTTP ${r.status}; el caso no llegó a medirse.`);
  assert.ok(r.cuerpo.includes('Reparación de bajante'), '🔴 CIEGO: la página no es el recibo del doble.');
  assert.ok(!r.cuerpo.includes(ENVIADO),
    'en producción la página del CLIENTE FINAL afirma «Email enviado correctamente» porque alguien\n' +
    '  añadió `?mail=sent` al enlace. Su único productor (`/dev`) no existe en producción.');
});

test('SCRUM-1309 · ✅ EL POSITIVO: fuera de producción, `?mail=sent` SÍ pinta el banner (lo produce `/dev`)', async () => {
  const r = await pedirRecibo('mail=sent', 'development');
  assert.equal(r.status, 200, `🔴 CIEGO: /recibo devolvió HTTP ${r.status}.`);
  assert.ok(r.cuerpo.includes(ENVIADO),
    'fuera de producción el banner ya no sale: `dev.routes` redirige con `?mail=sent` y nadie lo ve.\n' +
    '  Sin este control, «no sale nunca» pasaría por un arreglo.');
});

test('SCRUM-1309 · ⛔ el hermano `saved` sigue como lo dejó SCRUM-807', async () => {
  const eml = encodeURIComponent('/outbox/invoice-2026-CF-001.eml');
  const prod = await pedirRecibo(`mail=saved&eml=${eml}`, 'production');
  assert.equal(prod.status, 200, `🔴 CIEGO: /recibo devolvió HTTP ${prod.status}.`);
  assert.ok(!prod.cuerpo.includes(GENERADO), 'el banner `saved` «(modo dev)» ha vuelto a salir en producción');
  const dev = await pedirRecibo(`mail=saved&eml=${eml}`, 'development');
  assert.ok(dev.cuerpo.includes(GENERADO), 'el banner `saved` ya no sale fuera de producción');
  assert.ok(dev.cuerpo.includes('href="/outbox/invoice-2026-CF-001.eml" target="_blank" rel="noopener"'),
    'el ancla del banner `saved` ha cambiado respecto a SCRUM-807 (hrefSeguro + rel=noopener)');
  assert.ok(!dev.cuerpo.includes(ENVIADO), '`saved` pinta también el banner de `sent`');
});
