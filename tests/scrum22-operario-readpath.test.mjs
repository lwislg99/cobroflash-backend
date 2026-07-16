// SCRUM-22 (carril B, read-path): serializeJob expone la autoría del operario resuelta
// (operario:{id,name}) + operarioId crudo, en la LISTA y el DETALLE del Trabajo. Resuelve
// el TeamMember (Parte S1) por operarioId SCOPEADO al merchant (regla 2). null = propietario.
// La UI (jobDetailView) la consume aparte (carril de Javier); aquí solo el read-path backend.
//
// ⚠️ GATEADO (crea y BORRA merchants efímeros; levanta la app in-process):
//   QA_DB_TEST=1 npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-22: serializer expone operario:{id,name} en lista+detalle (null propietario) + tenancy', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  const mkMerchant = (tag) =>
    prisma.merchant.create({
      data: { name: `QA S22 ${tag}`, country: 'ES', email: `qa-s22-${tag}-${stamp}@test.local`, onboardingCompleted: true },
    });
  const merchantA = await mkMerchant('A');
  const merchantB = await mkMerchant('B');
  const operario = await prisma.teamMember.create({
    data: { merchantId: merchantA.id, name: 'María García', email: `qa-s22-op-${stamp}@test.local`, role: 'tecnico', status: 'active' },
  });
  const customerA = await prisma.customer.create({
    data: { merchantId: merchantA.id, name: 'Cliente S22', phone: `34600${stamp % 1000000}` },
  });
  // Job CON operario (autoría) y Job SIN operario (propietario → null).
  const jobWith = await prisma.job.create({
    data: { merchantId: merchantA.id, customerId: customerA.id, status: 'pendiente_agendar', titulo: 'Con operario', operarioId: operario.id },
  });
  const jobOwner = await prisma.job.create({
    data: { merchantId: merchantA.id, customerId: customerA.id, status: 'pendiente_agendar', titulo: 'Sin operario', operarioId: null },
  });

  const mkCookie = async (merchantId) => {
    const token = 'qa22-' + crypto.randomBytes(12).toString('hex');
    await prisma.authSession.create({
      data: { merchantId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
    });
    const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
    return cookie;
  };
  const getJson = (url, cookie) => fetch(`${base}${url}`, { headers: { cookie } });

  try {
    const cookieA = await mkCookie(merchantA.id);
    const cookieB = await mkCookie(merchantB.id);

    // ── LISTA: operario resuelto en el job con autoría; null en el del propietario ──
    const list = await (await getJson('/admin/jobs', cookieA)).json();
    const rowWith = list.find((j) => j.id === jobWith.id);
    const rowOwner = list.find((j) => j.id === jobOwner.id);
    assert.ok(rowWith && rowOwner, 'la lista debe traer ambos jobs de A');
    assert.deepEqual(rowWith.operario, { id: operario.id, name: 'María García' }, 'operario resuelto {id,name}');
    assert.equal(rowWith.operarioId, operario.id, 'operarioId crudo expuesto (paridad con assignedUserId)');
    assert.equal(rowOwner.operario, null, 'sin operarioId → operario null (propietario)');
    assert.equal(rowOwner.operarioId, null);

    // ── DETALLE: hereda operario de serializeJob ──
    const detail = await (await getJson(`/admin/jobs/${jobWith.id}`, cookieA)).json();
    assert.deepEqual(detail.operario, { id: operario.id, name: 'María García' }, 'el detalle hereda operario');

    // ── TENANCY (regla 2): B no ve el job de A (404) ni su lista lo incluye ──
    const bDetail = await getJson(`/admin/jobs/${jobWith.id}`, cookieB);
    assert.equal(bDetail.status, 404, 'B no accede al job de A');
    const bList = await (await getJson('/admin/jobs', cookieB)).json();
    assert.ok(!bList.some((j) => j.id === jobWith.id), 'la lista de B no incluye el job de A');

    console.log('✔ SCRUM-22: operario:{id,name} en lista y detalle, null para propietario, tenancy OK.');
  } finally {
    await prisma.job.deleteMany({ where: { merchantId: merchantA.id } });
    await prisma.customer.deleteMany({ where: { merchantId: merchantA.id } });
    await prisma.teamMember.deleteMany({ where: { merchantId: merchantA.id } });
    await prisma.authSession.deleteMany({ where: { merchantId: { in: [merchantA.id, merchantB.id] } } });
    await prisma.merchant.deleteMany({ where: { id: { in: [merchantA.id, merchantB.id] } } });
    server.close();
    await prisma.$disconnect();
  }
});
