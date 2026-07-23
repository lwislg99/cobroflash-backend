// SCRUM-85 (🔴 SEGURIDAD/RGPD, la TERCERA puerta de la misma fuga — SCRUM-72 → SCRUM-74 → esta)
// /pay/card, /pay/bizum y /pay/invoice compartían el mismo patrón enumerable que /recibo
// (P0-SEC-7, SCRUM-74): Charge.id autoincremental como identificador de RUTA, sin token ni
// secreto. Cualquiera, sin login, podía recorrer /pay/invoice/1, /pay/invoice/2… y ver las
// páginas de pago (importe, concepto, nombre/logo del merchant) de OTROS merchants.
//
// Fix: reutiliza Charge.receiptToken (ya existía desde SCRUM-74, SIN schema nuevo). Los 3
// endpoints pasan a identificarse por token — el id numérico ya no resuelve nada, con
// verificación "zero leak" (el 404 numérico no debe filtrar nada del cobro real).
//
// ⚠️ GATEADO (crea/BORRA merchants efímeros; /pay/card golpea Stripe test-mode real):
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-85: /pay/card, /pay/bizum, /pay/invoice cierran el IDOR — numérico 404 sin fuga, token funciona', { skip: !ENABLED }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const { ensureChargeReceiptToken } = await import('../dist/lib/invoicing.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();

  // SCRUM-113: este fichero tenía la MISMA forma que scrum74 — un mkFixture que creaba el
  // merchant y sus hijos, invocado dos veces ANTES del try. Es el patrón que produjo los 4
  // huérfanos de SCRUM-79: si el segundo mkFixture reventaba, el primero ya estaba en la BD
  // y el finally no llegaba a plantearse. Ahora el merchant lo crea withMerchant y mkFixture
  // solo monta lo que cuelga de él, ya dentro de la red.
  const mkFixture = async (merchant, tag) => {
    const customer = await prisma.customer.create({
      data: { merchantId: merchant.id, name: `Cliente Secreto QA-S85-${tag} ${stamp}`, phone: `3461${tag === 'A' ? 0 : 1}${stamp % 1000000}` },
    });
    const charge = await prisma.charge.create({
      data: { merchantId: merchant.id, customerId: customer.id, concept: `QA S85 ${tag}`, amount: '55.00', currency: 'EUR', method: 'card', status: 'pending' },
    });
    return { merchant, customer, charge };
  };

  try {
    await withMerchant(prisma, { name: 'QA S85 A', email: `qa-s85-A-${stamp}@test.local` }, (mA) =>
      withMerchant(prisma, { name: 'QA S85 B', email: `qa-s85-B-${stamp}@test.local` }, async (mB) => {
    const A = await mkFixture(mA, 'A');
    const B = await mkFixture(mB, 'B');

    const tokenA = await ensureChargeReceiptToken(A.charge.id, prisma);
    const tokenB = await ensureChargeReceiptToken(B.charge.id, prisma);
    assert.notEqual(tokenA, tokenB, 'cobros distintos → tokens distintos');

    // ── /pay/invoice: numérico 404 sin fuga, token 200 con enlaces por token ──
    const rNumInvoice = await fetch(`${base}/pay/invoice/${A.charge.id}`);
    assert.equal(rNumInvoice.status, 404, `GET /pay/invoice/<id numérico> debe ser 404 y fue ${rNumInvoice.status}`);
    const numInvoiceBody = await rNumInvoice.text();
    assert.ok(!numInvoiceBody.includes(A.merchant.name), 'FUGA: el 404 numérico expone el nombre del merchant');

    const rInvoice = await fetch(`${base}/pay/invoice/${tokenA}`);
    assert.equal(rInvoice.status, 200, `GET /pay/invoice/:token debe ser 200 y fue ${rInvoice.status}`);
    const invoiceBody = await rInvoice.text();
    assert.ok(invoiceBody.includes(A.merchant.name), 'con el token correcto sí debe verse el propio merchant');
    assert.ok(invoiceBody.includes(`/pay/card/${tokenA}`), 'el link a /pay/card debe llevar el TOKEN');
    assert.ok(!invoiceBody.includes(`/pay/card/${A.charge.id}`), 'el link a /pay/card NO debe llevar el id numérico');

    // ── /pay/card: numérico 404, token resuelve el cobro (redirect a Stripe o 501 si no configurado) ──
    const rNumCard = await fetch(`${base}/pay/card/${A.charge.id}`, { redirect: 'manual' });
    assert.equal(rNumCard.status, 404, `GET /pay/card/<id numérico> debe ser 404 y fue ${rNumCard.status}`);

    const rCard = await fetch(`${base}/pay/card/${tokenA}`, { redirect: 'manual' });
    assert.ok([303, 501].includes(rCard.status), `GET /pay/card/:token debe resolver el cobro (303 a Stripe o 501 sin Stripe) y fue ${rCard.status}`);
    if (rCard.status === 303) {
      assert.match(rCard.headers.get('location') || '', /^https:\/\/checkout\.stripe\.com\//, 'debe redirigir a Stripe Checkout real');
    }

    // ── /pay/bizum: numérico 404; token resuelve (200 con el flag activo, o redirect a /pay/invoice/:token si no) ──
    const rNumBizum = await fetch(`${base}/pay/bizum/${A.charge.id}`, { redirect: 'manual' });
    assert.equal(rNumBizum.status, 404, `GET /pay/bizum/<id numérico> debe ser 404 y fue ${rNumBizum.status}`);

    const rBizum = await fetch(`${base}/pay/bizum/${tokenA}`, { redirect: 'manual' });
    assert.ok([200, 303].includes(rBizum.status), `GET /pay/bizum/:token debe resolver el cobro y fue ${rBizum.status}`);
    if (rBizum.status === 303) {
      const loc = rBizum.headers.get('location') || '';
      assert.ok(loc.includes(tokenA), `el redirect de bizum (no disponible) debe llevar el TOKEN y fue ${loc}`);
    }

    // token de OTRO cobro (B) en /pay/invoice: debe mostrar el negocio de B, NUNCA el de A
    const rInvoiceB = await fetch(`${base}/pay/invoice/${tokenB}`);
    assert.equal(rInvoiceB.status, 200);
    const invoiceBodyB = await rInvoiceB.text();
    assert.ok(invoiceBodyB.includes(B.merchant.name), 'token de B debe mostrar el merchant de B');
    assert.ok(!invoiceBodyB.includes(A.merchant.name), 'FUGA: el token de B no debe mostrar nada del merchant de A');

    t.diagnostic('SCRUM-85: /pay/invoice, /pay/card y /pay/bizum — numérico 404 sin fuga, token propio 200/redirect correcto, sin cruce entre cobros ✓');
      }));
  } finally {
    // Solo lo que NO es del merchant: el borrado de datos lo garantiza withMerchant, que
    // además borra los `event` (cuelgan de charge, no de merchant) antes que los charges.
    server.close();
    await prisma.$disconnect();
  }
});
