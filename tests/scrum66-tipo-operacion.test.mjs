// SCRUM-66 (TRABAJO-4): selector tipoOperacion en el Trabajo.
//   Parte PURA (siempre): el enum cerrado JOB_TIPOS_OPERACION.
//   Parte GATEADA (QA_DB_TEST=1): default TRABAJO_UNICO en el serializer, PATCH valida el enum,
//   audita SOLO el cambio real (tipo_operacion_elegido), es idempotente y respeta tenancy.
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113
import { JOB_TIPOS_OPERACION } from '../dist/modules/jobs/domain/job.service.js';

test('JOB_TIPOS_OPERACION: enum cerrado de 2 valores', () => {
  assert.deepEqual([...JOB_TIPOS_OPERACION].sort(), ['OPERACIONES_SUELTAS', 'TRABAJO_UNICO']);
});

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-66: tipoOperacion — default, edición, validación, audit del cambio y tenancy', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  // SCRUM-123: este test solo llama a GET/PATCH /admin/jobs/:id, que NO lleva
  // requireActivePlan — planExpiresAt no hace falta aquí (lo llevaba de un test hermano,
  // con un comentario que justificaba mal por qué; ver el docstring de withMerchant).
  const datosMerchant = (tag) => ({
    name: `QA S66 ${tag}`, email: `qa-s66-${tag}-${stamp}@test.local`,
  });

  // Los merchants y TODO su montaje dentro de withMerchant; antes nacían fuera del try.
  try {
    await withMerchant(prisma, datosMerchant('A'), (merchantA) =>
      withMerchant(prisma, datosMerchant('B'), async (merchantB) => {
  const customer = await prisma.customer.create({ data: { merchantId: merchantA.id, name: 'Cliente 66', phone: `34603${stamp % 1000000}` } });
  const job = await prisma.job.create({ data: { merchantId: merchantA.id, customerId: customer.id, status: 'pendiente_agendar', titulo: 'Trabajo QA 66' } });

  const mkCookie = async (merchantId) => {
    const token = 'qa66-' + crypto.randomBytes(12).toString('hex');
    await prisma.authSession.create({ data: { merchantId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) } });
    const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
    return (res.headers.get('set-cookie') || '').split(';')[0];
  };

  const countAudit = () =>
    prisma.auditLog.count({ where: { merchantId: merchantA.id, action: 'tipo_operacion_elegido', entityType: 'job', entityId: job.id } });

    const cookieA = await mkCookie(merchantA.id);
    const cookieB = await mkCookie(merchantB.id);
    const jsonReq = (url, cookie, method = 'GET', body) =>
      fetch(`${base}${url}`, { method, headers: { cookie, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

    // (a) default TRABAJO_UNICO en el serializer (Job creado sin el campo)
    const rGet = await jsonReq(`/admin/jobs/${job.id}`, cookieA);
    assert.equal(rGet.status, 200, `GET job → 200 (fue ${rGet.status})`);
    assert.equal((await rGet.json()).tipoOperacion, 'TRABAJO_UNICO', 'default TRABAJO_UNICO');

    // (b) PATCH a OPERACIONES_SUELTAS → 200 + persistido en BD
    const rPatch = await jsonReq(`/admin/jobs/${job.id}`, cookieA, 'PATCH', { tipoOperacion: 'OPERACIONES_SUELTAS' });
    assert.equal(rPatch.status, 200, `PATCH → 200 (fue ${rPatch.status})`);
    assert.equal((await rPatch.json()).tipoOperacion, 'OPERACIONES_SUELTAS');
    assert.equal(
      (await prisma.job.findUnique({ where: { id: job.id }, select: { tipoOperacion: true } })).tipoOperacion,
      'OPERACIONES_SUELTAS',
      'persistido en BD',
    );

    // (c) audit tipo_operacion_elegido (fire-and-forget → esperar) con meta del valor elegido
    let audit = null;
    for (const deadline = Date.now() + 3000; Date.now() < deadline; ) {
      audit = await prisma.auditLog.findFirst({
        where: { merchantId: merchantA.id, action: 'tipo_operacion_elegido', entityType: 'job', entityId: job.id },
      });
      if (audit) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(audit, 'se registró tipo_operacion_elegido');
    assert.equal(audit.meta?.tipoOperacion, 'OPERACIONES_SUELTAS', 'meta con el valor elegido');

    // (d) valor inválido → 400 invalid_tipo_operacion (enum cerrado)
    const rBad = await jsonReq(`/admin/jobs/${job.id}`, cookieA, 'PATCH', { tipoOperacion: 'LO_QUE_SEA' });
    assert.equal(rBad.status, 400);
    assert.equal((await rBad.json()).error, 'invalid_tipo_operacion');

    // (e) PATCH con el MISMO valor → 200 pero NO genera un segundo audit (solo el cambio real)
    const before = await countAudit();
    const rSame = await jsonReq(`/admin/jobs/${job.id}`, cookieA, 'PATCH', { tipoOperacion: 'OPERACIONES_SUELTAS' });
    assert.equal(rSame.status, 200);
    await new Promise((r) => setTimeout(r, 400)); // margen para un (no) audit async
    assert.equal(await countAudit(), before, 'reenviar el mismo valor NO audita de nuevo');

    // (f) tenancy: B no ve/toca el Job de A → 404
    assert.equal(
      (await jsonReq(`/admin/jobs/${job.id}`, cookieB, 'PATCH', { tipoOperacion: 'TRABAJO_UNICO' })).status,
      404,
      'merchant B no accede al Job de A',
    );

    console.log('✔ SCRUM-66: default TRABAJO_UNICO · PATCH valida enum · audit del cambio real · idempotente · tenancy 404.');
      }));
  } finally {
    // Solo lo que NO es del merchant: el borrado de datos lo garantiza withMerchant.
    server.close();
    await prisma.$disconnect();
  }
});
