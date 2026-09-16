// SCRUM-76: el ADJUNTO del PDF es la ÚNICA vía de entrega tras SCRUM-72 (D3, se quitó el botón).
// Verifica los tres arreglos:
//   (1) sendInvoiceEmail: el .eml de outbox AHORA se materializa (antes: streamTransport+buffer
//       devolvía un Buffer y el createReadStream nunca corría → rama muerta) y CONTIENE el adjunto.
//   (2) sendQuoteEmail: el fallback SIN Resend AHORA adjunta el PDF (antes salía sin él, defecto 2).
//   (3) (por inspección) sendInvoiceEmail lanza si no hay PDF — no manda factura mutilada en silencio.
//
// ⚠️ GATEADO (crea/BORRA merchant efímero; genera PDFs y .eml de outbox). Ejerce el fallback
// SMTP/outbox, que es donde vivían los defectos; si hubiera RESEND_API_KEY, se salta a Resend y
// el test se omite (no aplica). Datos efímeros propios con limpieza en el finally (lección SCRUM-63).
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113
import { crearFactura } from './_factura-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-76: el email adjunta el PDF en TODAS las ramas (outbox .eml materializado + fallback de presupuesto)', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { config } = await import('../dist/core/config/env.js');
  // El fallback (donde vivían los defectos) solo se ejerce sin Resend. Con clave → path Resend, no aplica.
  if (config.RESEND_API_KEY) { t.skip('RESEND_API_KEY presente: el fallback SMTP/outbox no se ejerce en este entorno'); return; }

  const { sendInvoiceEmail, sendQuoteEmail } = await import('../dist/modules/messaging/domain/email.service.js');
  const { generateQuotePdf } = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');
  const { outboxDir, invoicesDir } = await import('../dist/core/storage/dirs.js');

  const stamp = Date.now();

  // SCRUM-113: el merchant y su montaje dentro de withMerchant; antes nacían fuera del try.
  try {
    await withMerchant(prisma, {
      name: 'QA S76', email: `qa-s76-${stamp}@test.local`, invoiceSeriesPrefix: 'CF',
    }, async (merchant) => {
  const customer = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente 76', email: `cli-s76-${stamp}@test.local` } });
  const numero = `${new Date().getFullYear()}-CF-${String(800 + (stamp % 90)).padStart(3, '0')}`;
  const invoice = await crearFactura(prisma, {
    merchantId: merchant.id, customerId: customer.id, number: numero,
    total: '121.00', currency: 'EUR', type: 'F1',
    pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR',
    lines: [{ concept: 'QA S76', qty: 1, price: 100, tax: 0.21 }],
    // SCRUM-205: `no_aplica` — merchant ES SIN NIF: fuera de la cadena. Este test prueba que
    // el ADJUNTO del email es la única vía de entrega del documento fiscal, no el sellado.
    vfEstado: 'no_aplica',
  });
  const quote = await prisma.quote.create({
    data: { merchantId: merchant.id, customerId: customer.id, status: 'sent', total: '121.00', currency: 'EUR', lines: [{ concept: 'QA S76', qty: 1, price: 100, tax: 0.21 }] },
  });

  const invEml = path.join(outboxDir, `invoice-${numero}.eml`);
  const quoteEml = path.join(outboxDir, `quote-${quote.id}.eml`);
    // ── (1) FACTURA: el .eml se materializa (fix rama muerta) y CONTIENE el adjunto ──
    const rInv = await sendInvoiceEmail({ invoiceId: invoice.id, toEmail: customer.email, prisma });
    assert.ok(rInv?.ok, 'el envío de factura devuelve ok');
    assert.equal(rInv.eml, `/outbox/invoice-${numero}.eml`, 'el outbox .eml AHORA se materializa (antes: rama muerta con createReadStream)');
    assert.ok(fs.existsSync(invEml), 'el .eml de la factura existe en disco');
    const invContent = fs.readFileSync(invEml, 'latin1');
    assert.match(invContent, /Content-Type: application\/pdf/i, 'el .eml de FACTURA CONTIENE el PDF adjunto (única vía tras SCRUM-72)');
    assert.ok(invContent.includes(`${numero}.pdf`), 'el adjunto lleva el nombre de la factura');

    // ── (2) PRESUPUESTO: el fallback adjunta el PDF (defecto 2 arreglado) ──
    // Se deja el PDF donde sendQuoteEmail lo lee (invoicesDir + QUOTE-<id>.pdf).
    await generateQuotePdf({
      quoteId: quote.id, quoteNumber: 1,
      merchant: { name: merchant.name, legalName: null, taxId: null, address: null, whatsappPhone: null, logoUrl: null },
      customer: { name: customer.name, phone: null, email: null, legalName: null, taxId: null },
      docFields: null, currency: 'EUR', total: '121.00',
      lines: [{ concept: 'QA S76', qty: 1, price: 100, tax: 0.21 }], country: 'ES',
    });
    const rQuote = await sendQuoteEmail({ quoteId: quote.id, prisma });
    assert.ok(rQuote?.ok, 'el envío de presupuesto devuelve ok');
    assert.ok(fs.existsSync(quoteEml), 'el .eml del presupuesto se materializa');
    const quoteContent = fs.readFileSync(quoteEml, 'latin1');
    assert.match(quoteContent, /Content-Type: application\/pdf/i, 'el .eml de PRESUPUESTO CONTIENE el PDF adjunto en el fallback (defecto 2 arreglado)');

    t.diagnostic('factura: outbox materializado + adjunto ✓ · presupuesto: adjunto en el fallback ✓');
    // Los ficheros de disco NO son del merchant: se limpian aquí, dentro del callback,
    // porque necesitan merchant.id y quote.id. Lo de BD lo garantiza withMerchant.
    for (const f of [invEml, quoteEml, path.join(invoicesDir, `${merchant.id}-${numero}.pdf`), path.join(invoicesDir, `QUOTE-${quote.id}.pdf`)]) {
      try { fs.unlinkSync(f); } catch { /* ya no está */ }
    }
    });
  } finally {
    await prisma.$disconnect();
  }
});
