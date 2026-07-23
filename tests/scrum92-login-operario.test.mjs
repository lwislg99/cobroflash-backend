// SCRUM-92 — /auth/login (requestMagicLink) solo buscaba en Merchant. Un TeamMember
// (operario) salía por un return silencioso: sin token, sin email, pantalla diciendo
// "recibirás el enlace en breve" que nunca llega. El PRIMER acceso funciona (va por
// inviteTeamMember, otro camino); el fallo aparece al VOLVER — cierra sesión, cambia
// de móvil, le caduca la cookie — y se queda fuera para siempre. Afecta a TODOS los
// operarios a partir del segundo acceso.
//
// Fix: requestMagicLink también busca en TeamMember (active/invited; suspended =
// mismo trato que "no existe"). Reutiliza el AuthSession {merchantId, teamMemberId,
// type:'magic_link'} que YA crea inviteTeamMember — verifyMagicLink/getSession/
// requireAuth quedan intactos, así que el rol/tenancy de la sesión resultante no es
// lógica nueva: se prueba aquí end-to-end (verify real → sesión real → 403 en una
// ruta admin-only) para blindar justo lo que más importa en un cambio de auth.
//
// ⚠️ GATEADO (crea/BORRA merchants+teamMembers efímeros; levanta la app):
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-92: operario puede volver a entrar — token+sesión con rol/tenancy correctos; merchant y email inexistente sin cambios', { skip: !ENABLED }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const { requestMagicLink, getSession } = await import('../dist/modules/auth/domain/auth.service.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  const merchant = await prisma.merchant.create({
    data: { name: `QA S92 Merchant`, country: 'ES', email: `qa-s92-merchant-${stamp}@test.local`, onboardingCompleted: true },
  });
  const tecnico = await prisma.teamMember.create({
    data: { merchantId: merchant.id, name: 'QA Operario S92', email: `qa-s92-tecnico-${stamp}@test.local`, role: 'tecnico', status: 'active' },
  });
  const invitedMember = await prisma.teamMember.create({
    data: { merchantId: merchant.id, name: 'QA Invitado S92', email: `qa-s92-invited-${stamp}@test.local`, role: 'tecnico', status: 'invited' },
  });
  const suspendedMember = await prisma.teamMember.create({
    data: { merchantId: merchant.id, name: 'QA Suspendido S92', email: `qa-s92-suspended-${stamp}@test.local`, role: 'tecnico', status: 'suspended' },
  });

  try {
    // ── Caso 1 (el bug): operario ACTIVO pide magic link → token creado, rol/tenancy correctos ──
    const beforeCount = await prisma.authSession.count({ where: { teamMemberId: tecnico.id, type: 'magic_link' } });
    await requestMagicLink(tecnico.email);
    const afterCount = await prisma.authSession.count({ where: { teamMemberId: tecnico.id, type: 'magic_link' } });
    assert.equal(afterCount, beforeCount + 1, 'un operario ACTIVO debe generar un AuthSession magic_link nuevo (el bug: hoy no se crea ninguno)');

    const magicSession = await prisma.authSession.findFirst({
      where: { teamMemberId: tecnico.id, type: 'magic_link' },
      orderBy: { id: 'desc' },
    });
    assert.equal(magicSession.merchantId, merchant.id, 'el AuthSession debe llevar el merchantId CORRECTO del operario (tenancy)');

    // Verificación end-to-end REAL: canjear el token → cookie de sesión → getSession → rol/tenancy.
    const rVerify = await fetch(`${base}/auth/verify?token=${magicSession.token}`, { redirect: 'manual' });
    assert.equal(rVerify.status, 302, `GET /auth/verify con el token del operario debe redirigir (302) y fue ${rVerify.status}`);
    const cookie = (rVerify.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(cookie.startsWith('pf_session='), 'debe fijar la cookie pf_session');
    const sessionToken = decodeURIComponent(cookie.replace('pf_session=', ''));

    const session = await getSession(sessionToken);
    assert.ok(session, 'la sesión resultante debe ser válida');
    assert.equal(session.merchantId, merchant.id, 'req.merchantId debe ser el del operario, NO otro');
    assert.equal(session.teamMemberId, tecnico.id, 'req.teamMemberId debe ser el correcto');
    assert.equal(session.teamMember?.role, 'tecnico', 'el rol de la sesión debe ser tecnico, NUNCA admin (esto sería mucho peor que el bug)');

    // Prueba HTTP real: con esa cookie, una ruta admin-only debe dar 403 — el operario
    // NO puede colarse como admin por este camino nuevo.
    const rAdminOnly = await fetch(`${base}/admin/exports/verifactu.xml`, { headers: { cookie } });
    assert.equal(rAdminOnly.status, 403, `un operario con sesión vía SCRUM-92 debe seguir dando 403 en rutas admin-only y fue ${rAdminOnly.status}`);

    // ── Caso 1b: TeamMember 'invited' también puede pedir login (se activa al canjear, igual que la invitación) ──
    const beforeInvited = await prisma.authSession.count({ where: { teamMemberId: invitedMember.id, type: 'magic_link' } });
    await requestMagicLink(invitedMember.email);
    const afterInvited = await prisma.authSession.count({ where: { teamMemberId: invitedMember.id, type: 'magic_link' } });
    assert.equal(afterInvited, beforeInvited + 1, 'un TeamMember invited también debe poder pedir su enlace de acceso');

    // ── Caso 1c: TeamMember 'suspended' → mismo trato que "no existe" (NO se crea token) ──
    const beforeSuspended = await prisma.authSession.count({ where: { teamMemberId: suspendedMember.id, type: 'magic_link' } });
    await requestMagicLink(suspendedMember.email);
    const afterSuspended = await prisma.authSession.count({ where: { teamMemberId: suspendedMember.id, type: 'magic_link' } });
    assert.equal(afterSuspended, beforeSuspended, 'un TeamMember suspendido NO debe generar token (mismo trato que email inexistente)');

    // ── Caso 2: Merchant (owner) sigue funcionando exactamente igual ──
    const beforeMerchant = await prisma.authSession.count({ where: { merchantId: merchant.id, teamMemberId: null, type: 'magic_link' } });
    await requestMagicLink(merchant.email);
    const afterMerchant = await prisma.authSession.count({ where: { merchantId: merchant.id, teamMemberId: null, type: 'magic_link' } });
    assert.equal(afterMerchant, beforeMerchant + 1, 'el login del Merchant owner no debe cambiar de comportamiento');

    // ── Caso 3: email inexistente (ni Merchant ni TeamMember) → nada se crea, sin fuga ──
    const ghostEmail = `qa-s92-fantasma-${stamp}@test.local`;
    const beforeGhost = await prisma.authSession.count();
    await requestMagicLink(ghostEmail); // no debe lanzar, ni crear nada
    const afterGhost = await prisma.authSession.count();
    assert.equal(afterGhost, beforeGhost, 'un email que no existe en NINGUNA tabla no debe crear ningún AuthSession');

    // La respuesta HTTP de /auth/login es SIEMPRE la misma genérica, exista o no el email
    // (regla anti-enumeración, no tocada por este fix) — probado a nivel de ruta:
    const rLoginGhost = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: ghostEmail }) });
    const rLoginReal = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: tecnico.email }) });
    assert.equal(rLoginGhost.status, rLoginReal.status, 'el status HTTP de /auth/login debe ser igual exista o no el email');
    const [bodyGhost, bodyReal] = await Promise.all([rLoginGhost.json(), rLoginReal.json()]);
    assert.deepEqual(bodyGhost, bodyReal, 'el body de /auth/login debe ser IDÉNTICO exista o no el email (sin enumeración)');

    t.diagnostic('SCRUM-92: operario activo → token+sesión con rol/tenancy correctos y 403 en admin-only; invited → también; suspended/inexistente → sin token; merchant sin cambios; /auth/login sin enumeración ✓');
  } finally {
    await prisma.authSession.deleteMany({ where: { OR: [{ merchantId: merchant.id }, { teamMemberId: { in: [tecnico.id, invitedMember.id, suspendedMember.id] } }] } });
    await prisma.teamMember.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
    server.close();
    await prisma.$disconnect();
  }
});
