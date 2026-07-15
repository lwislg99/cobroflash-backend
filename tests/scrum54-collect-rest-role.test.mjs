// SCRUM-54 (carril A, seguridad dinero): POST /admin/jobs/:id/collect-rest emite la
// factura del 2º tramo + lanza el cobro → SOLO admin (S1: Técnico ❌ en emitir factura /
// marcar pagado). Prueba el par sobre el MISMO recurso real:
//   - Técnico → 403 (el guard corta ANTES de la lógica → no se emite nada)
//   - Admin   → 200 (emite la factura del 2º tramo del 50/50)
// El 403 de la lista canónica lo cubre además tenancy-permisos.test.mjs (ADMIN_ONLY_ROUTES).
//
// ⚠️ GATEADO (crea y BORRA un merchant efímero; levanta la app in-process). Recomendado con
//   WHATSAPP_DRY_RUN=1 para que el payment_request no salga de verdad:
//   QA_DB_TEST=1 WHATSAPP_DRY_RUN=1 npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-54: collect-rest gateado a admin — técnico 403 (sin emitir), admin 200', { skip: !ENABLED }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  const merchant = await prisma.merchant.create({
    data: { name: 'QA SCRUM-54', country: 'ES', email: `qa-s54-${stamp}@test.local`, onboardingCompleted: true },
  });
  const tecnico = await prisma.teamMember.create({
    data: { merchantId: merchant.id, name: 'QA Téc 54', email: `qa-tec54-${stamp}@test.local`, role: 'tecnico', status: 'active' },
  });
  const customer = await prisma.customer.create({
    data: { merchantId: merchant.id, name: 'Cliente 54', phone: `34600${stamp % 1000000}` },
  });
  // Presupuesto FIFTY_FIFTY aceptado + 1ª factura ya emitida (señal) → queda 1 tramo pendiente.
  const quote = await prisma.quote.create({
    data: {
      merchantId: merchant.id, customerId: customer.id, total: '100.00', currency: 'EUR',
      lines: [{ concepto: 'Trabajo', cantidad: 1, price: 100 }], status: 'accepted', paymentTerms: 'FIFTY_FIFTY',
    },
  });
  await prisma.invoice.create({
    data: {
      merchantId: merchant.id, customerId: customer.id, quoteId: quote.id,
      number: `J-QA54-${stamp}`, total: '50.00', currency: 'EUR',
      pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR', status: 'paid',
    },
  });
  const job = await prisma.job.create({
    data: { merchantId: merchant.id, customerId: customer.id, quoteId: quote.id, status: 'terminado', totalAceptado: '100.00' },
  });

  const mkCookie = async (teamMemberId) => {
    const token = 'qa54-' + crypto.randomBytes(12).toString('hex');
    await prisma.authSession.create({
      data: { merchantId: merchant.id, teamMemberId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
    });
    const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
    return cookie;
  };

  const collect = (cookie) =>
    fetch(`${base}/admin/jobs/${job.id}/collect-rest`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' } });

  try {
    const cookieTecnico = await mkCookie(tecnico.id);
    const cookieAdmin = await mkCookie(null); // owner (teamMemberId null) = admin

    // ── TÉCNICO → 403 (el guard corta antes de la lógica de dinero) ──
    const rTec = await collect(cookieTecnico);
    assert.equal(rTec.status, 403, `técnico debe ser 403 y fue ${rTec.status}`);
    assert.equal((await rTec.json()).error, 'forbidden', 'cuerpo del 403 = forbidden');
    assert.equal(
      await prisma.invoice.count({ where: { quoteId: quote.id } }), 1,
      'el 403 del técnico NO debe emitir factura del 2º tramo',
    );

    // ── ADMIN → 200 (emite la factura del 2º tramo) ──
    const rAdmin = await collect(cookieAdmin);
    assert.equal(rAdmin.status, 200, `admin debe ser 200 y fue ${rAdmin.status}`);
    const body = await rAdmin.json();
    assert.equal(body.ok, true, 'admin: ok=true');
    assert.equal(Number(body.amount), 50, '2º tramo del 50/50 sobre 100 = 50');
    assert.equal(
      await prisma.invoice.count({ where: { quoteId: quote.id } }), 2,
      'admin emitió la factura del 2º tramo (1 → 2)',
    );

    t.diagnostic('SCRUM-54: técnico 403 (sin emitir) · admin 200 (emite 2º tramo 50€) ✓');
  } finally {
    // hijos → padres
    await prisma.invoice.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.job.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.quote.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.customer.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.authSession.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.teamMember.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
    server.close();
    await prisma.$disconnect();
  }
});
