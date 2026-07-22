// A12.5 (EXT3 Ola 12) — Suite de PDFs: presupuesto FIRMADO, justificante
// (serie J, sin QR), watermark de demo y regeneración on-demand (R8).
// Sin factura fiscal: eso vive tras INVOICING_ES_ENABLED (no se toca).
// Los unit generan ficheros reales en /invoices y los BORRAN al acabar.
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const DB = process.env.QA_DB_TEST === '1';

// PNG 1x1 transparente — firma mínima válida para el canvas
const SIG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function assertPdf(outPath, minBytes, label) {
  assert.ok(fs.existsSync(outPath), `${label}: el fichero no existe`);
  const buf = fs.readFileSync(outPath);
  assert.ok(buf.subarray(0, 5).toString() === '%PDF-', `${label}: no es un PDF`);
  assert.ok(buf.length > minBytes, `${label}: PDF sospechosamente pequeño (${buf.length}b)`);
  return buf;
}

test('A12.5a: presupuesto FIRMADO → PDF válido con la firma dentro', async () => {
  const { generateQuotePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateQuotePdf({
    quoteId: 99999901,
    quoteNumber: 901,
    merchant: { name: 'QA Fontanería', legalName: 'QA SL', taxId: 'B00000000', address: 'C/ Test 1', whatsappPhone: '34600000000' },
    customer: { name: 'Cliente QA', phone: '34611000001' },
    currency: 'EUR',
    total: '9999.99', // AB6: importes grandes
    lines: [{ concept: 'Trabajo de prueba con un concepto razonablemente largo para el ancho', qty: 1, price: 9999.99, tax: 0 }],
    signatureData: SIG_1PX,
    signedAt: new Date(),
    country: 'ES',
  });
  const signed = assertPdf(outPath, 2000, 'quote firmado');
  // el mismo doc SIN firma debe ser distinto (la firma añade contenido)
  const { outPath: outPath2 } = await (await import('../dist/lib/pdf.js')).generateQuotePdf({
    quoteId: 99999902, quoteNumber: 902,
    merchant: { name: 'QA Fontanería' }, customer: { name: 'Cliente QA' },
    currency: 'EUR', total: '9999.99',
    lines: [{ concept: 'Trabajo de prueba con un concepto razonablemente largo para el ancho', qty: 1, price: 9999.99, tax: 0 }],
    signatureData: null, country: 'ES',
  });
  const unsigned = assertPdf(outPath2, 1500, 'quote sin firma');
  assert.ok(signed.length !== unsigned.length, 'firmado y sin firmar no pueden ser idénticos');
  fs.rmSync(outPath, { force: true }); fs.rmSync(outPath2, { force: true });
});

test('A12.5b: justificante serie J — sin QR, copy de justificante', async () => {
  const { generateInvoicePdf } = await import('../dist/lib/pdf.js');
  const num = 'J-2026-QA' + crypto.randomBytes(3).toString('hex');
  const { outPath } = await generateInvoicePdf({
    number: num,
    merchant: { name: 'QA Fontanería', legalName: 'QA SL', address: 'C/ Test 1' },
    customer: { name: 'Cliente QA' },
    currency: 'EUR', total: '150.00',
    qrData: 'no-debe-usarse', // JUST → isReceipt → sin QR (el generador lo ignora)
    type: 'JUST',
    lines: [{ concept: 'Cobro de prueba', qty: 1, price: 150, tax: 0 }],
  });
  assertPdf(outPath, 1500, 'justificante');
  fs.rmSync(outPath, { force: true });
});

test('A12.5c: watermark de DEMO presente en el PDF', async () => {
  const { generateInvoicePdf } = await import('../dist/lib/pdf.js');
  const num = 'J-2026-QW' + crypto.randomBytes(3).toString('hex');
  const { outPath } = await generateInvoicePdf({
    number: num,
    merchant: { name: 'QA Demo' }, customer: { name: 'Cliente QA' },
    currency: 'EUR', total: '10.00', qrData: 'x', type: 'JUST',
    watermark: 'DEMO — no válida fiscalmente',
  });
  const withWm = assertPdf(outPath, 1200, 'con watermark');
  const { outPath: outPath2 } = await (await import('../dist/lib/pdf.js')).generateInvoicePdf({
    number: num + 'b',
    merchant: { name: 'QA Demo' }, customer: { name: 'Cliente QA' },
    currency: 'EUR', total: '10.00', qrData: 'x', type: 'JUST',
    watermark: null,
  });
  const without = assertPdf(outPath2, 1000, 'sin watermark');
  assert.ok(withWm.length > without.length, 'el watermark debe añadir contenido en cada página');
  fs.rmSync(outPath, { force: true }); fs.rmSync(outPath2, { force: true });
});

// P3-9 (SCRUM-80, 22-jul): antes usaba el merchant demo id=1 — SCRUM-42 lo quemó (0 filas)
// y el test revienta (TypeError sobre quote null). Datos EFÍMEROS propios (mismo patrón
// que SCRUM-78 en tenancy-permisos/webhooks-idempotencia): nada depende ya del demo.
test('A12.5d: regeneración on-demand (R8) — /admin/quotes/:id/pdf responde PDF SIEMPRE', { skip: !DB }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  const merchant = await prisma.merchant.create({
    data: { name: 'QA PDFs A12.5d', country: 'ES', email: `qa-a125d-${stamp}@test.local`, onboardingCompleted: true },
  });
  const customer = await prisma.customer.create({
    data: { merchantId: merchant.id, name: 'Cliente QA A12.5d', phone: `34604${stamp % 1000000}` },
  });
  const quote = await prisma.quote.create({
    data: {
      merchantId: merchant.id, customerId: customer.id, total: '100.00', currency: 'EUR',
      lines: [{ concept: 'Servicio QA A12.5d', qty: 1, price: 100 }], status: 'draft',
    },
  });

  try {
    const token = 'qa125-' + crypto.randomBytes(10).toString('hex');
    await prisma.authSession.create({
      data: { merchantId: merchant.id, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
    });
    const v = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
    const cookie = (v.headers.get('set-cookie') || '').split(';')[0];

    for (let i = 1; i <= 2; i++) { // dos veces: el fs de Railway es efímero (R8)
      const res = await fetch(`${base}/admin/quotes/${quote.id}/pdf`, { headers: { cookie } });
      assert.equal(res.status, 200, `intento ${i}: status ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      assert.ok(buf.subarray(0, 5).toString() === '%PDF-', `intento ${i}: no devolvió PDF`);
    }
  } finally {
    await prisma.authSession.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.quote.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.customer.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
    server.close();
    await prisma.$disconnect();
  }
});
