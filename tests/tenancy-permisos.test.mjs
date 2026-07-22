// A12.1 + A12.4 (EXT3 Ola 12) — Tenancy y permisos del rol técnico ("Operario").
//
// A12.1: una sesión ADMIN del merchant B contra rutas con IDs del merchant A
//        (efímero propio, ver P3-9) → SIEMPRE 403/404, jamás datos de A.
// A12.4: una sesión TÉCNICO recorre ADMIN_ONLY_ROUTES (lista única exportada,
//        S1) → 403 SIEMPRE. Ruta sensible nueva = añadirla a esa lista.
//
// P3-9 (SCRUM-78, 22-jul): antes "A" era el merchant demo id=1 — SCRUM-42 lo
// quemó como placeholder inerte (0 filas) y rompió este test. Datos EFÍMEROS
// propios (mismo patrón que SCRUM-23 más abajo en este archivo): nada depende
// ya del estado del demo.
//
// ⚠️ Toca la BD del .env (crea y BORRA sus merchants A+B efímeros + técnico) y
// levanta la app in-process en un puerto efímero. Gateado:
//   QA_DB_TEST=1 WHATSAPP_DRY_RUN=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
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

  // ── merchants A (víctima) y B (atacante), ambos EFÍMEROS ────────────────
  // P3-9 (SCRUM-78) + SCRUM-79, mismo arreglo desde dos lados: antes "A" era el
  // merchant DEMO (id=1), que SCRUM-42 dejó como placeholder inerte (0 filas) → el
  // test abortaba en "faltan datos seed del demo". Y ese assert iba ANTES del bucle
  // de A12.4, así que la red de seguridad de S1 dejaba de comprobarse ENTERA sin que
  // nadie se enterara. Datos efímeros propios (misma lección que SCRUM-63): nada
  // depende ya del estado del demo.
  const stamp = Date.now();
  const mkMerchant = (tag, name) =>
    prisma.merchant.create({
      data: { name, country: 'ES', email: `qa-${tag}-${stamp}@test.local`, onboardingCompleted: true },
    });
  const merchantA = await mkMerchant('a', 'QA Tenancy A (víctima)');
  const merchantB = await mkMerchant('b', 'QA Tenancy B');
  const tecnico = await prisma.teamMember.create({
    data: { merchantId: merchantB.id, name: 'QA Técnico', email: `qa-tec-${stamp}@test.local`, role: 'tecnico', status: 'active' },
  });

  // Datos de A que B intentará tocar. El nombre del cliente es un CANARIO: si
  // asomara en CUALQUIER respuesta a B, es fuga de datos entre merchants.
  const CANARIO_A = `FUGA-A-${stamp}`;
  const customerA = await prisma.customer.create({
    data: { merchantId: merchantA.id, name: CANARIO_A, phone: `34601${stamp % 1000000}`, email: `qa-cli-${stamp}@test.local` },
  });
  // status 'accepted' + lines (vienen de SCRUM-78). Verificado: NO son obligatorios —
  // ni por schema (Quote.status tiene default 'draft') ni por comportamiento actual, ya
  // que POST /admin/quotes/:id/invoice hace findFirst({id, merchantId}) ANTES de mirar
  // el estado, así que la tenancy corta primero igualmente. Se mantienen como fixture
  // REALISTA: si algún día se reordenan las comprobaciones y la regla de negocio pasa
  // delante, un 400/409 enmascararía el assert de tenancy sin que nadie lo note.
  const quoteA = await prisma.quote.create({
    data: {
      merchantId: merchantA.id, customerId: customerA.id, status: 'accepted',
      total: '100.00', currency: 'EUR', lines: [{ concept: 'Servicio QA tenancy', qty: 1, price: 100 }],
    },
  });
  const invoiceA = await prisma.invoice.create({
    data: {
      merchantId: merchantA.id, customerId: customerA.id, quoteId: quoteA.id,
      number: `QA-TEN-${stamp}`, total: '100.00', currency: 'EUR', type: 'F1',
      // status 'paid' + lines (de SCRUM-78): mismo caso que el quote. Ni schema
      // (Invoice.status default 'pending', lines opcional) ni comportamiento actual los
      // exigen — dispute-package también filtra por merchantId primero. Fixture realista
      // por la misma razón defensiva.
      status: 'paid',
      lines: [{ concept: 'Servicio QA tenancy', qty: 1, price: 100 }],
      pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR',
    },
  });
  const jobA = await prisma.job.create({
    data: { merchantId: merchantA.id, customerId: customerA.id, status: 'pendiente_agendar', titulo: 'Trabajo QA tenancy A' },
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
      ['PATCH', `/admin/jobs/${jobA.id}`, { status: 'en_curso' }],
      ['GET', `/admin/jobs/${jobA.id}`],
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
      // jamás datos de A en el cuerpo (canario)
      const text = await res.text();
      assert.ok(!text.includes(CANARIO_A), `TENANCY ROTA: ${method} ${path} filtra datos de A`);
    }
    t.diagnostic(`tenancy: ${tenancyTargets.length} rutas con id ajeno → 403/404 ✓`);

    // A12.4 — el técnico SIEMPRE 403 en la lista admin-only
    for (const r of ADMIN_ONLY_ROUTES) {
      const path = r.path.replace(':invoiceId', '999999').replace(':planId', '999999');
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
    // Limpieza de AMBOS merchants efímeros, hijos antes que padres. Cada borrado con
    // su .catch(): si uno falla (tabla ausente, FK inesperada) no debe abortar el resto
    // ni enmascarar el resultado del test — dejar huérfanos es justo lo que ensucia
    // staging (SCRUM-79).
    for (const m of [merchantA, merchantB]) {
      await prisma.authSession.deleteMany({ where: { merchantId: m.id } }).catch(() => {});
      await prisma.invoice.deleteMany({ where: { merchantId: m.id } }).catch(() => {});
      await prisma.job.deleteMany({ where: { merchantId: m.id } }).catch(() => {});
      await prisma.quote.deleteMany({ where: { merchantId: m.id } }).catch(() => {});
      await prisma.customer.deleteMany({ where: { merchantId: m.id } }).catch(() => {});
      await prisma.teamMember.deleteMany({ where: { merchantId: m.id } }).catch(() => {});
    }
    await prisma.merchant.deleteMany({ where: { id: { in: [merchantA.id, merchantB.id] } } }).catch(() => {});
    server.close();
    await prisma.$disconnect();
  }
});

// SCRUM-23 (OPERARIO-2): visibilidad ROW-LEVEL dentro del MISMO merchant — el técnico solo
// ve/accede los Trabajos que originó (operarioId), el admin/owner ve todos. Dimensión que
// A12.1 (cross-merchant) y A12.4 (rutas admin-only) NO cubren.
// Datos EFÍMEROS propios (nada del seed demo — lección de SCRUM-63) y limpieza en el finally.
test('SCRUM-23: el técnico solo ve/accede SUS Trabajos (row-level, mismo merchant)', { skip: !ENABLED }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  const merchant = await prisma.merchant.create({
    data: { name: 'QA S23', country: 'ES', email: `qa-s23-${stamp}@test.local`, onboardingCompleted: true },
  });
  const mkTecnico = (tag) =>
    prisma.teamMember.create({
      data: {
        merchantId: merchant.id, name: `QA Tec ${tag}`,
        email: `qa-s23-${tag}-${stamp}@test.local`, role: 'tecnico', status: 'active',
      },
    });
  const tecA = await mkTecnico('A');
  const tecB = await mkTecnico('B');
  const customer = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente S23' } });
  const mkJob = (operarioId, titulo) =>
    prisma.job.create({
      data: { merchantId: merchant.id, customerId: customer.id, status: 'pendiente_agendar', titulo, operarioId },
    });
  const jobA = await mkJob(tecA.id, 'Trabajo de A');
  const jobB = await mkJob(tecB.id, 'Trabajo de B');

  const mkCookie = async (teamMemberId = null) => {
    const token = 'qa23-' + crypto.randomBytes(12).toString('hex');
    await prisma.authSession.create({
      data: { merchantId: merchant.id, teamMemberId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
    });
    const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
    return cookie;
  };

  try {
    const cookieTecA = await mkCookie(tecA.id);
    const cookieAdmin = await mkCookie(null); // owner = admin implícito
    const get = (path, cookie) => fetch(`${base}${path}`, { headers: { cookie } });

    // (a) la LISTA del técnico A solo trae los suyos
    const listA = await (await get('/admin/jobs', cookieTecA)).json();
    const idsA = listA.map((j) => j.id);
    assert.ok(idsA.includes(jobA.id), 'el técnico debe ver SU Trabajo en la lista');
    assert.ok(!idsA.includes(jobB.id), 'FUGA: el técnico ve en la lista el Trabajo de otro técnico');

    // (b) DETALLE por URL directa de un Trabajo ajeno (mismo merchant) → 404
    const cross = await get(`/admin/jobs/${jobB.id}`, cookieTecA);
    assert.equal(cross.status, 404, 'el técnico no debe acceder al Trabajo de otro (esperado 404)');

    // (c) el ADMIN/owner ve ambos y accede al detalle de cualquiera
    const listAdmin = await (await get('/admin/jobs', cookieAdmin)).json();
    const idsAdmin = listAdmin.map((j) => j.id);
    assert.ok(idsAdmin.includes(jobA.id) && idsAdmin.includes(jobB.id), 'el admin debe ver TODOS los Trabajos');
    assert.equal((await get(`/admin/jobs/${jobB.id}`, cookieAdmin)).status, 200, 'el admin accede al detalle de cualquier Trabajo');

    t.diagnostic('row-level: técnico solo sus Trabajos · 404 en el ajeno · admin ve todos ✓');
  } finally {
    await prisma.authSession.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.job.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.customer.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.teamMember.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
    server.close();
    await prisma.$disconnect();
  }
});
