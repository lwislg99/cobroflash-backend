// A12.1 + A12.4 (EXT3 Ola 12) — Tenancy y permisos del rol técnico ("Operario").
//
// A12.1: una sesión ADMIN del merchant B contra rutas con IDs del merchant A
//        (demo) → SIEMPRE 403/404, jamás datos de A.
// A12.4: una sesión TÉCNICO recorre ADMIN_ONLY_ROUTES (lista única exportada,
//        S1) → 403 SIEMPRE. Ruta sensible nueva = añadirla a esa lista.
//
// ⚠️ Toca la BD del .env (crea y BORRA su merchant B efímero + técnico) y
// levanta la app in-process en un puerto efímero. Gateado:
//   QA_DB_TEST=1 WHATSAPP_DRY_RUN=1 npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const ENABLED = process.env.QA_DB_TEST === '1';

test('A12.1+A12.4: tenancy (B vs datos de A) y 403 del técnico en admin-only', { skip: !ENABLED }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const { ADMIN_ONLY_ROUTES } = await import('../dist/core/http/adminOnlyRoutes.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  // ── merchant B efímero + técnico ────────────────────────────────────────
  const stamp = Date.now();
  const merchantB = await prisma.merchant.create({
    data: { name: 'QA Tenancy B', country: 'ES', email: `qa-b-${stamp}@test.local`, onboardingCompleted: true },
  });
  const tecnico = await prisma.teamMember.create({
    data: { merchantId: merchantB.id, name: 'QA Técnico', email: `qa-tec-${stamp}@test.local`, role: 'tecnico', status: 'active' },
  });

  const mkCookie = async (teamMemberId = null) => {
    const token = 'qa12-' + crypto.randomBytes(12).toString('hex');
    await prisma.authSession.create({
      data: { merchantId: merchantB.id, teamMemberId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
    });
    const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
    return cookie;
  };

  try {
    const cookieAdminB = await mkCookie(null);
    const cookieTecnicoB = await mkCookie(tecnico.id);

    // ── IDs REALES del merchant A (demo id=1) ─────────────────────────────
    const A = 1;
    const [quoteA, invoiceA, customerA, jobA] = await Promise.all([
      prisma.quote.findFirst({ where: { merchantId: A }, select: { id: true } }),
      prisma.invoice.findFirst({ where: { merchantId: A }, select: { id: true } }),
      prisma.customer.findFirst({ where: { merchantId: A }, select: { id: true, name: true } }),
      prisma.job.findFirst({ where: { merchantId: A }, select: { id: true } }),
    ]);
    assert.ok(quoteA && invoiceA && customerA, 'faltan datos seed del demo');

    // A12.1 — cada ruta con un id de A y sesión de B debe negar (403/404)
    const tenancyTargets = [
      ['GET', `/admin/quotes/${quoteA.id}`],
      ['GET', `/admin/quotes/${quoteA.id}/pdf`],
      ['POST', `/admin/quotes/${quoteA.id}/send-whatsapp`],
      ['POST', `/admin/quotes/${quoteA.id}/accept`],
      ['POST', `/admin/quotes/${quoteA.id}/reject`],
      ['POST', `/admin/quotes/${quoteA.id}/invoice`],
      ['GET', `/admin/invoices/${invoiceA.id}`],
      ['PUT', `/admin/invoices/${invoiceA.id}/status`, { status: 'paid' }],
      ['GET', `/admin/invoices/${invoiceA.id}/dispute-package`],
      ['POST', `/admin/invoices/${invoiceA.id}/payment-anomaly`, { amount: 1 }],
      ['GET', `/admin/customers/${customerA.id}`],
      ['GET', `/admin/customers/${customerA.id}/detail`],
      ...(jobA ? [['PATCH', `/admin/jobs/${jobA.id}`, { status: 'en_curso' }]] : []),
      ['DELETE', `/admin/maintenance/999999`],
    ];

    for (const [method, path, body] of tenancyTargets) {
      const res = await fetch(base + path, {
        method,
        headers: { cookie: cookieAdminB, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      assert.ok(
        res.status === 403 || res.status === 404,
        `TENANCY ROTA: ${method} ${path} devolvió ${res.status} a un merchant ajeno`,
      );
      // jamás datos de A en el cuerpo
      const text = await res.text();
      assert.ok(!text.includes(customerA.name), `TENANCY ROTA: ${method} ${path} filtra datos de A`);
    }
    t.diagnostic(`tenancy: ${tenancyTargets.length} rutas con id ajeno → 403/404 ✓`);

    // A12.4 — el técnico SIEMPRE 403 en la lista admin-only
    for (const r of ADMIN_ONLY_ROUTES) {
      const path = r.path.replace(':invoiceId', '999999').replace(':planId', '999999').replace(':id', '999999');
      const res = await fetch(base + path, {
        method: r.method,
        headers: { cookie: cookieTecnicoB, 'Content-Type': 'application/json' },
        body: r.body ? JSON.stringify(r.body) : undefined,
      });
      assert.equal(
        res.status, 403,
        `PERMISOS ROTOS: técnico obtuvo ${res.status} en ${r.method} ${path} (esperado 403)`,
      );
    }
    t.diagnostic(`permisos: ${ADMIN_ONLY_ROUTES.length} rutas admin-only → 403 para técnico ✓`);
  } finally {
    await prisma.authSession.deleteMany({ where: { merchantId: merchantB.id } });
    await prisma.teamMember.deleteMany({ where: { merchantId: merchantB.id } });
    await prisma.merchant.delete({ where: { id: merchantB.id } });
    server.close();
    await prisma.$disconnect();
  }
});
