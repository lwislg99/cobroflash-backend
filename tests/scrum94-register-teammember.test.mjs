// SCRUM-94 — registerMerchant (POST /auth/register) solo comprobaba Merchant.email, nunca
// TeamMember.email. Un operario podía registrarse con SU email y crear un merchant nuevo; a
// partir de ahí su magic link daba precedencia a ese merchant (ver requestMagicLink) y perdía
// el acceso como operario, sin que el admin pudiera arreglarlo.
//
// Fix (opción 1): rechazar el alta (409 email_belongs_to_team) si el email es un TeamMember
// activo/invitado (suspended = ya no entra, se permite). Mensaje claro pero GENÉRICO (sin
// revelar la empresa). NO se crea ningún merchant fantasma.
//
// ⚠️ GATEADO (crea/BORRA merchants + teamMembers efímeros; levanta la app):
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-94: /auth/register rechaza el email de un operario (sin merchant fantasma ni fuga de empresa)', { skip: !ENABLED }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = Date.now();

  const merchant = await prisma.merchant.create({
    data: { name: 'QA S94 Empresa SECRETA', country: 'ES', email: `qa-s94-owner-${stamp}@test.local`, onboardingCompleted: true },
  });
  const activo = await prisma.teamMember.create({ data: { merchantId: merchant.id, name: 'QA S94 Activo', email: `qa-s94-activo-${stamp}@test.local`, role: 'tecnico', status: 'active' } });
  const invitado = await prisma.teamMember.create({ data: { merchantId: merchant.id, name: 'QA S94 Invitado', email: `qa-s94-invitado-${stamp}@test.local`, role: 'tecnico', status: 'invited' } });
  const suspendido = await prisma.teamMember.create({ data: { merchantId: merchant.id, name: 'QA S94 Suspendido', email: `qa-s94-suspendido-${stamp}@test.local`, role: 'tecnico', status: 'suspended' } });

  const reg = (email) => fetch(`${base}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Negocio Nuevo', email, country: 'ES' }) });
  const merchantsToClean = []; // emails de merchants creados por los registros PERMITIDOS

  try {
    // 1 · operario ACTIVO → 409 y NO se crea merchant con su email (el bug creaba uno fantasma).
    const rA = await reg(activo.email);
    assert.equal(rA.status, 409, `registrar el email de un operario ACTIVO debe dar 409 y fue ${rA.status}`);
    const bA = await rA.json();
    assert.equal(bA.error, 'email_belongs_to_team', 'código de error esperado');
    assert.ok(bA.message && bA.message.length > 0, 'debe traer un mensaje claro');
    assert.equal(await prisma.merchant.findUnique({ where: { email: activo.email } }), null, 'NO debe crearse un Merchant con el email del operario');

    // 2 · operario INVITADO → también 409 (también quedaría ensombrecido al volver).
    const rI = await reg(invitado.email);
    assert.equal(rI.status, 409, 'un operario INVITED también debe rechazarse');
    assert.equal(await prisma.merchant.findUnique({ where: { email: invitado.email } }), null, 'sin merchant fantasma para el invited');

    // 3 · ANTI-FUGA: el mensaje NO revela la empresa del operario.
    assert.ok(!bA.message.includes('SECRETA') && !bA.message.includes(merchant.name), 'el mensaje NO debe revelar el nombre de la empresa (anti-enumeración de datos)');

    // 4 · operario SUSPENDIDO → NO se rechaza (ya no puede entrar; registrar su propio negocio es legítimo).
    const rS = await reg(suspendido.email);
    assert.equal(rS.status, 200, `un TeamMember suspendido SÍ puede registrarse y fue ${rS.status}`);
    merchantsToClean.push(suspendido.email);

    // 5 · SANITY: un email nuevo (ni merchant ni teammember) se registra con normalidad.
    const nuevoEmail = `qa-s94-nuevo-${stamp}@test.local`;
    const rN = await reg(nuevoEmail);
    assert.equal(rN.status, 200, 'un email nuevo debe registrarse con normalidad (no rompimos el alta)');
    merchantsToClean.push(nuevoEmail);

    t.diagnostic('SCRUM-94: operario active/invited → 409 sin merchant fantasma; suspended/nuevo → alta OK; mensaje sin fuga de empresa ✓');
  } finally {
    for (const email of merchantsToClean) {
      const m = await prisma.merchant.findUnique({ where: { email } });
      if (m) {
        await prisma.authSession.deleteMany({ where: { merchantId: m.id } });
        await prisma.teamMember.deleteMany({ where: { merchantId: m.id } });
        await prisma.merchant.delete({ where: { id: m.id } });
      }
    }
    await prisma.authSession.deleteMany({ where: { OR: [{ merchantId: merchant.id }, { teamMemberId: { in: [activo.id, invitado.id, suspendido.id] } }] } });
    await prisma.teamMember.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
    server.close();
    await prisma.$disconnect();
  }
});
