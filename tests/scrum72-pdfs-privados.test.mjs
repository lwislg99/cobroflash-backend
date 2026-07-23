// SCRUM-72 (🔴 SEGURIDAD/RGPD): los PDFs de FACTURA y PRESUPUESTO dejan de ser públicos.
// Vivían en public/invoices servidos por estático con nombres ENUMERABLES (2026-CF-001…):
// cualquiera descargaba documentos ajenos sin login. Ahora viven en storage/invoices y solo
// salen por GET /admin/invoices/:id/pdf y GET /admin/quotes/:id/pdf (auth + tenancy).
//
// ⚠️ OJO: GET /recibo/:chargeId/pdf es PÚBLICA POR DISEÑO (el cliente la abre desde WhatsApp
// sin login) y debe seguir respondiendo. Su enumerabilidad es SCRUM-74, no esta tarea.
//
// Datos EFÍMEROS propios con limpieza en el finally — nunca el seed demo (lección SCRUM-63).
//
// ⚠️ GATEADO (crea y BORRA merchants efímeros; levanta la app in-process):
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-72: PDFs de factura y presupuesto no son públicos (estático muerto + auth + tenancy)', { skip: !ENABLED }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const { invoicesDir } = await import('../dist/core/storage/dirs.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  // ── 🔒 ASSERT DE REGRESIÓN (el que blinda esto para siempre) ──────────────
  // Si alguien devuelve el dir a public/ o reintroduce el mount estático, esto falla.
  const normalized = invoicesDir.replace(/\\/g, '/');
  assert.ok(
    !/\/public\//.test(normalized) && !normalized.endsWith('/public'),
    `REGRESIÓN SCRUM-72: invoicesDir vuelve a estar bajo public/ (${invoicesDir}) → los PDFs se sirven como estático`,
  );
  assert.ok(normalized.includes('/storage/'), `invoicesDir debe vivir en storage/ (actual: ${invoicesDir})`);

  const stamp = Date.now();
  // SCRUM-113: `invoiceSeriesPrefix` se conserva — los asserts buscan números `…-CF-…`.
  const datosMerchant = (tag) => ({
    name: `QA S72 ${tag}`, email: `qa-s72-${tag}-${stamp}@test.local`, invoiceSeriesPrefix: 'CF',
  });

  // Los merchants y TODO su montaje dentro de withMerchant; antes nacían fuera del try.
  try {
    await withMerchant(prisma, datosMerchant('A'), (merchantA) =>
      withMerchant(prisma, datosMerchant('B'), async (merchantB) => {

  const custA = await prisma.customer.create({ data: { merchantId: merchantA.id, name: 'Cliente S72' } });

  // Factura de A con pdfUrl LEGACY (esquema viejo, estático público) → debe regenerarse (D4)
  const numero = `${new Date().getFullYear()}-CF-${String(900 + (stamp % 90)).padStart(3, '0')}`;
  const invoiceA = await prisma.invoice.create({
    data: {
      merchantId: merchantA.id, customerId: custA.id, number: numero,
      total: '100.00', currency: 'EUR', type: 'F1',
      pdfUrl: `/invoices/${numero}.pdf`,          // ← legacy a propósito
      qrData: `INV:${numero}|AMOUNT:100.00|CUR:EUR`,
      lines: [{ concept: 'QA SCRUM-72', qty: 1, price: 100, tax: 0 }],
    },
  });

  const quoteA = await prisma.quote.create({
    data: {
      merchantId: merchantA.id, customerId: custA.id, status: 'sent',
      total: '100.00', currency: 'EUR', lines: [{ concept: 'QA S72', qty: 1, price: 100, tax: 0 }],
    },
  });

  const mkCookie = async (merchantId) => {
    const token = 'qa72-' + crypto.randomBytes(12).toString('hex');
    await prisma.authSession.create({
      data: { merchantId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
    });
    const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
    return cookie;
  };

  const isPdf = (res) => (res.headers.get('content-type') || '').includes('application/pdf');

    const cookieA = await mkCookie(merchantA.id);
    const cookieB = await mkCookie(merchantB.id);

    // ── 1) ESTÁTICO MUERTO: nombre VIEJO, sin cookie ────────────────────────
    const oldName = await fetch(`${base}/invoices/${numero}.pdf`);
    assert.ok(oldName.status === 404, `el estático viejo debe estar muerto (fue ${oldName.status})`);
    assert.ok(!isPdf(oldName), 'el estático viejo no debe devolver un PDF');

    // ── 2) ESTÁTICO MUERTO: nombre NUEVO (con merchantId), sin cookie ───────
    const newName = await fetch(`${base}/invoices/${merchantA.id}-${numero}.pdf`);
    assert.ok(newName.status === 404, `el nombre nuevo tampoco debe servirse (fue ${newName.status})`);
    assert.ok(!isPdf(newName), 'el nombre nuevo no debe devolver un PDF');

    // ── 3) PRESUPUESTO: su PDF tampoco es accesible por estático ────────────
    const quotePub = await fetch(`${base}/invoices/QUOTE-${quoteA.id}.pdf`);
    assert.ok(quotePub.status === 404, `el PDF de presupuesto no debe ser público (fue ${quotePub.status})`);
    assert.ok(!isPdf(quotePub), 'el PDF de presupuesto no debe servirse sin auth');

    // ── 4) FELIZ + LEGACY (D4): el admin descarga y se REGENERA con nombre nuevo ──
    const own = await fetch(`${base}/admin/invoices/${invoiceA.id}/pdf`, { headers: { cookie: cookieA } });
    assert.equal(own.status, 200, 'el admin debe poder descargar su factura');
    assert.ok(isPdf(own), 'debe devolver un PDF');
    const expectedDisk = path.join(invoicesDir, `${merchantA.id}-${numero}.pdf`);
    assert.ok(fs.existsSync(expectedDisk), `debe regenerarse con el nombre nuevo en storage/ (${expectedDisk})`);
    const after = await prisma.invoice.findUnique({ where: { id: invoiceA.id }, select: { pdfUrl: true } });
    assert.equal(after.pdfUrl, `/admin/invoices/${invoiceA.id}/pdf`, 'pdfUrl legacy debe quedar resuelto al endpoint auth');

    // ── 5) TENANCY: el merchant B no accede a la factura de A ───────────────
    const cross = await fetch(`${base}/admin/invoices/${invoiceA.id}/pdf`, { headers: { cookie: cookieB } });
    assert.equal(cross.status, 404, 'otro merchant no debe acceder al PDF (esperado 404)');

    // ── 6) SIN COOKIE contra el endpoint auth ──────────────────────────────
    const anon = await fetch(`${base}/admin/invoices/${invoiceA.id}/pdf`);
    assert.ok(anon.status === 401 || anon.status === 403 || anon.status === 404,
      `sin sesión no se sirve el PDF (fue ${anon.status})`);

    // ── 7) 🔒 EL ESTÁTICO ESTÁ MUERTO *CON EL FICHERO EXISTIENDO* ──────────
    // Los asserts 1-3 corrían antes de que el PDF estuviera en disco: un 404 ahí
    // podía ser sólo "fichero inexistente", no "directorio no servido". Ahora el
    // fichero SÍ existe (lo regeneró el paso 4) → si sigue dando 404, la prueba es real.
    assert.ok(fs.existsSync(expectedDisk), 'precondición: el PDF debe existir en disco');
    const servedAnyway = await fetch(`${base}/invoices/${merchantA.id}-${numero}.pdf`);
    assert.equal(servedAnyway.status, 404,
      'FUGA: el PDF existe en disco y el estático lo sirve → el directorio sigue publicado');
    assert.ok(!isPdf(servedAnyway), 'FUGA: content-type de PDF en la ruta pública');

    // Canario para el PDF de PRESUPUESTO: lo dejamos en disco y comprobamos que
    // tampoco se alcanza (mismo directorio, misma prueba real).
    const quoteCanary = path.join(invoicesDir, `QUOTE-${quoteA.id}.pdf`);
    fs.writeFileSync(quoteCanary, '%PDF-1.4 canary SCRUM-72');
    const quoteServed = await fetch(`${base}/invoices/QUOTE-${quoteA.id}.pdf`);
    assert.equal(quoteServed.status, 404,
      'FUGA: el PDF de presupuesto existe en disco y se sirve por el estático');

    // ── 8) ⚠️ EL ADJUNTO DEL EMAIL (sostiene la decisión D3) ───────────────
    // Se quitó el botón "Ver documento" PORQUE el PDF viaja adjunto. Si el adjunto se
    // rompiera, el cliente se quedaría sin botón Y sin documento: peor que el problema
    // original. Aquí se construye el email de VERDAD y se comprueba el adjunto.
    // Nota de alcance: el outbox .eml y el adjunto del fallback los ARREGLÓ SCRUM-76 (con test
    // propio en tests/scrum76-email-adjunto.test.mjs). Este test conserva la verificación del
    // ADJUNTO por su FUENTE REAL: `ensureInvoicePdf`, que es exactamente lo que sendInvoiceEmail
    // lee y adjunta (email.service.ts:29-30). Si el movimiento de directorio hubiera roto el
    // adjunto, esto falla.
    const { ensureInvoicePdf } = await import('../dist/lib/invoicing.js');
    const attach = await ensureInvoicePdf(invoiceA.id, prisma);
    assert.ok(fs.existsSync(attach.diskPath), `ADJUNTO ROTO: no hay PDF en ${attach.diskPath}`);
    const bytes = fs.readFileSync(attach.diskPath);
    assert.ok(bytes.length > 1000, `ADJUNTO VACÍO: el PDF pesa ${bytes.length} bytes`);
    assert.equal(bytes.subarray(0, 4).toString('latin1'), '%PDF', 'ADJUNTO CORRUPTO: no empieza por %PDF');
    assert.equal(attach.diskPath, expectedDisk, 'el adjunto debe salir del fichero con el nombre nuevo');

    // Y el envío completo no revienta tras mover el directorio (flujo de D3 de punta a punta).
    const { sendInvoiceEmail } = await import('../dist/modules/messaging/domain/email.service.js');
    const sent = await sendInvoiceEmail({ invoiceId: invoiceA.id, toEmail: 'qa-s72@test.local', prisma });
    assert.ok(sent?.ok, 'el email de factura debe enviarse sin error tras el cambio de directorio');

    // ── 9) PRESUPUESTO: la ruta del adjunto que lee sendQuoteEmail es la canónica ──
    // (El fallback de sendQuoteEmail ya adjunta el PDF tras SCRUM-76.) Se verifica además el
    // contrato del que depende: el generador deja el fichero EXACTAMENTE donde sendQuoteEmail
    // lo busca (invoicesDir + QUOTE-<id>.pdf).
    const { generateQuotePdf } = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');
    const qpdf = await generateQuotePdf({
      quoteId: quoteA.id,
      quoteNumber: 1,
      merchant: { name: merchantA.name, legalName: null, taxId: null, address: null, whatsappPhone: null, logoUrl: null },
      customer: { name: custA.name, phone: null, email: null, legalName: null, taxId: null },
      docFields: null,
      currency: 'EUR',
      total: '100.00',
      lines: [{ concept: 'QA S72', qty: 1, price: 100, tax: 0 }],
      country: 'ES',
    });
    assert.equal(qpdf.outPath, path.join(invoicesDir, `QUOTE-${quoteA.id}.pdf`),
      'ADJUNTO EN RIESGO: el generador no escribe donde sendQuoteEmail lee');
    assert.ok(fs.existsSync(qpdf.outPath) && fs.statSync(qpdf.outPath).size > 500,
      'el PDF de presupuesto debe existir y no estar vacío');
    assert.equal(qpdf.publicUrlPath, `/admin/quotes/${quoteA.id}/pdf`,
      'Quote.pdfUrl debe apuntar al endpoint auth, no al estático');

    t.diagnostic('estático muerto con fichero en disco ✓ · adjunto de factura real ✓ · ruta de adjunto de presupuesto ✓ · legacy resuelto ✓ · tenancy ✓');

    // Los FICHEROS de disco no son del merchant y necesitan merchantA.id / quoteA.id, así
    // que se limpian aquí dentro. De la BD se encarga withMerchant (mismo caso que scrum76).
    const { outboxDir: ob } = await import('../dist/core/storage/dirs.js');
    for (const f of [
      path.join(invoicesDir, `${merchantA.id}-${numero}.pdf`),
      path.join(invoicesDir, `QUOTE-${quoteA.id}.pdf`),
      path.join(ob, `invoice-${numero}.eml`),
    ]) {
      try { fs.unlinkSync(f); } catch { /* ya no está */ }
    }
      }));
  } finally {
    // Solo lo que NO es del merchant: el borrado de datos lo garantiza withMerchant.
    server.close();
    await prisma.$disconnect();
  }
});
