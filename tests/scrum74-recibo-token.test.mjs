// SCRUM-74 (🔴 SEGURIDAD/RGPD, la otra puerta de SCRUM-72) — GET /recibo/:chargeId/pdf era
// enumerable (Charge.id autoincremental, sin secreto): cualquiera podía recorrer /recibo/1/pdf,
// /recibo/2/pdf… y descargar facturas de OTROS merchants (NIF del emisor, nombre/email/teléfono
// del cliente final, importes). Mismo problema en GET /recibo/:id (la página HTML — el enlace
// que REALMENTE se manda por WhatsApp) y en POST /recibo/:id/feedback.
//
// Fix: los 3 endpoints ahora se identifican por Charge.receiptToken (token OPACO, patrón
// Albaran.firmaToken de SCRUM-49), generado perezosamente por ensureChargeReceiptToken.
// El id numérico ya NO resuelve nada — se prueba aquí con "zero leak": el numérico no solo
// da 404, el nombre del cliente NUNCA aparece en ese 404.
//
// ⚠️ GATEADO (crea/BORRA merchants efímeros; genera PDF real en disco; levanta la app):
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-74: /recibo/:token cierra el IDOR — numérico 404 sin fuga, token 200, PDF y feedback solo con token', { skip: !ENABLED }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const { ensureChargeReceiptToken } = await import('../dist/lib/invoicing.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  const mkFixture = async (tag) => {
    const merchant = await prisma.merchant.create({
      data: { name: `QA S74 ${tag}`, country: 'ES', email: `qa-s74-${tag}-${stamp}@test.local`, onboardingCompleted: true },
    });
    const customer = await prisma.customer.create({
      data: { merchantId: merchant.id, name: `Cliente Secreto QA-S74-${tag} ${stamp}`, email: `cliente-s74-${tag}-${stamp}@test.local`, phone: `3460${tag === 'A' ? 5 : 6}${stamp % 1000000}` },
    });
    const charge = await prisma.charge.create({
      data: { merchantId: merchant.id, customerId: customer.id, concept: 'QA S74', amount: '75.00', currency: 'EUR', method: 'card', status: 'paid' },
    });
    const invoice = await prisma.invoice.create({
      data: {
        merchantId: merchant.id, customerId: customer.id, number: `2026-QA-S74-${tag}-${stamp % 1000}`,
        total: '75.00', currency: 'EUR', type: 'F1', status: 'paid',
        lines: [{ concept: 'Servicio QA S74', qty: 1, price: 75 }],
        pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR',
      },
    });
    await prisma.event.create({
      data: { chargeId: charge.id, type: 'invoiced', payload: { invoice_id: invoice.id } },
    });
    return { merchant, customer, charge, invoice };
  };

  const A = await mkFixture('A');
  const B = await mkFixture('B');

  try {
    // ── ensureChargeReceiptToken: perezoso, estable, único por cobro ──
    const tokenA1 = await ensureChargeReceiptToken(A.charge.id, prisma);
    const tokenA2 = await ensureChargeReceiptToken(A.charge.id, prisma);
    assert.equal(tokenA1, tokenA2, 'el token debe ser ESTABLE entre llamadas (no rota el enlace ya enviado)');
    assert.ok(tokenA1.length >= 24, 'token opaco de longitud razonable (128 bits hex = 32)');

    const tokenB = await ensureChargeReceiptToken(B.charge.id, prisma);
    assert.notEqual(tokenA1, tokenB, 'cobros distintos deben tener tokens distintos');

    // ── IDOR cerrado: el id numérico YA NO resuelve — ni la página, ni el PDF, ni el feedback ──
    const rNumPage = await fetch(`${base}/recibo/${A.charge.id}`);
    assert.equal(rNumPage.status, 404, `GET /recibo/<id numérico> debe ser 404 y fue ${rNumPage.status}`);
    const numPageBody = await rNumPage.text();
    assert.ok(!numPageBody.includes(A.customer.name), 'FUGA: el 404 numérico expone el nombre del cliente');
    assert.ok(!numPageBody.includes(A.customer.email), 'FUGA: el 404 numérico expone el email del cliente');

    const rNumPdf = await fetch(`${base}/recibo/${A.charge.id}/pdf`);
    assert.equal(rNumPdf.status, 404, `GET /recibo/<id numérico>/pdf debe ser 404 y fue ${rNumPdf.status}`);
    assert.doesNotMatch((await rNumPdf.text()) || '', /%PDF-/, 'FUGA: el 404 numérico sirvió bytes de PDF');

    const rNumFb = await fetch(`${base}/recibo/${A.charge.id}/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stars: 5 }) });
    assert.equal(rNumFb.status, 404, `POST /recibo/<id numérico>/feedback debe ser 404 y fue ${rNumFb.status}`);

    // ── token ajeno tampoco vale para el cobro de otro (no es solo "cualquier string") ──
    const rWrongToken = await fetch(`${base}/recibo/${tokenB}/pdf`);
    // token B es VÁLIDO pero es el de OTRO cobro — debe servir el PDF de B, nunca el de A.
    assert.equal(rWrongToken.status, 200);
    const wrongBuf = Buffer.from(await rWrongToken.arrayBuffer());
    assert.ok(!wrongBuf.toString('latin1').includes(A.invoice.number), 'FUGA: el token de B sirvió el PDF/factura de A');

    // ── token correcto: página 200, con el contenido esperado ──
    const rPage = await fetch(`${base}/recibo/${tokenA1}`);
    assert.equal(rPage.status, 200, `GET /recibo/:token debe ser 200 y fue ${rPage.status}`);
    const pageBody = await rPage.text();
    assert.ok(pageBody.includes(A.customer.name), 'con el token correcto SÍ debe verse el propio nombre');
    assert.ok(pageBody.includes(tokenA1), 'el enlace interno al PDF debe llevar el TOKEN, no el id');
    assert.ok(!pageBody.includes(`/recibo/${A.charge.id}/pdf`), 'el HTML no debe filtrar un enlace por id numérico');

    // ── token correcto: PDF 200 con bytes reales de PDF ──
    const rPdf = await fetch(`${base}/recibo/${tokenA1}/pdf`);
    assert.equal(rPdf.status, 200, `GET /recibo/:token/pdf debe ser 200 y fue ${rPdf.status}`);
    assert.match(rPdf.headers.get('content-type') || '', /application\/pdf/);
    const buf = Buffer.from(await rPdf.arrayBuffer());
    assert.equal(buf.subarray(0, 5).toString(), '%PDF-', 'debe devolver un PDF real');

    // ── token correcto: feedback 303 + evento registrado ──
    const rFb = await fetch(`${base}/recibo/${tokenA1}/feedback`, {
      method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stars: 5, comment: 'QA S74' }),
    });
    assert.equal(rFb.status, 303);
    assert.ok((rFb.headers.get('location') || '').includes(tokenA1), 'el redirect tras feedback debe llevar el TOKEN, no el id');
    const fbEvent = await prisma.event.findFirst({ where: { chargeId: A.charge.id, type: 'customer_feedback' } });
    assert.ok(fbEvent, 'el feedback con token correcto debe registrarse');

    t.diagnostic('SCRUM-74: numérico 404 sin fuga (página/PDF/feedback), token ajeno no cruza cobros, token propio 200 ✓');
  } finally {
    for (const fx of [A, B]) {
      await prisma.event.deleteMany({ where: { chargeId: fx.charge.id } });
      await prisma.invoice.deleteMany({ where: { merchantId: fx.merchant.id } });
      await prisma.charge.deleteMany({ where: { merchantId: fx.merchant.id } });
      // SCRUM-105: recordCustomerEvent (receipt.routes.ts, POST /feedback) es
      // fire-and-forget — el 303 al test puede volver ANTES de que el INSERT en
      // customer_events aterrice. Borrar customerEvent una sola vez antes de customer
      // (orden correcto pero no basta: la escritura tardía puede colarse en el hueco de
      // los deletes anteriores). Reintenta el par customerEvent+customer hasta que la FK
      // deje de bloquear — mismo espíritu que SCRUM-78 (orden de borrado), un paso más
      // porque aquí la causa es una escritura ASÍNCRONA, no solo el orden.
      for (let attempt = 1; ; attempt++) {
        await prisma.customerEvent.deleteMany({ where: { merchantId: fx.merchant.id } });
        try {
          await prisma.customer.deleteMany({ where: { merchantId: fx.merchant.id } });
          break;
        } catch (err) {
          if (attempt >= 5) throw err;
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      await prisma.merchant.delete({ where: { id: fx.merchant.id } });
    }
    server.close();
    await prisma.$disconnect();
  }
});
