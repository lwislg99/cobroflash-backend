// SCRUM-131 — `POST /admin/team/:id/resend` dice la VERDAD sobre el email de invitación.
//
// Antes: el `catch` de `sendEmail` en `inviteTeamMember` se tragaba el error y la ruta
// respondía `{ok:true}` fijo → el admin leía "invitación reenviada" con Resend caído y el
// operario no recibía nada. Misma familia que 114/115/116/117/126/129.
//
// Este entorno (staging) NO tiene RESEND_API_KEY ni SMTP_URL, así que el camino que se
// ejercita es el REAL de un email que no se entrega — y ese es justo el caso que antes
// mentía. Ojo al matiz que descubrió el recon: sin ninguna de las dos credenciales el mailer
// cae a `streamTransport` y `sendMail` NO lanza; reportar `sent:true` ahí habría sido la
// misma mentira un nivel más abajo, por eso se distingue como `not_configured`.
//
// ⚠️ GATEADO (crea/BORRA merchant + teamMember efímeros; levanta la app):
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-131: reenviar invitación informa si el email NO salió (sent:false), sin perder la invitación', { skip: !ENABLED }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = Date.now();

  try {
    await withMerchant(
      prisma,
      { name: 'QA S131', email: `qa-s131-${stamp}@test.local` },
      async (merchant) => {
        const miembro = await prisma.teamMember.create({
          data: {
            merchantId: merchant.id, name: 'QA Operario S131',
            email: `qa-s131-op-${stamp}@test.local`, role: 'tecnico', status: 'invited',
          },
        });

        // Sesión del OWNER (teamMemberId null = admin implícito); la ruta es admin-only.
        const token = 'qa131-' + crypto.randomBytes(12).toString('hex');
        await prisma.authSession.create({
          data: { merchantId: merchant.id, teamMemberId: null, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
        });
        const cookie = ((await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' }))
          .headers.get('set-cookie') || '').split(';')[0];
        assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');

        const sesionesAntes = await prisma.authSession.count({ where: { teamMemberId: miembro.id } });

        const res = await fetch(`${base}/admin/team/${miembro.id}/resend`, {
          method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
        });
        const body = await res.json();

        // 200 a propósito: la invitación SÍ se regeneró; lo que falló es la ENTREGA.
        assert.equal(res.status, 200, `resend debe responder 200 y fue ${res.status}`);
        assert.equal(
          body.sent, false,
          `🔴 SIGUE MINTIENDO: sin Resend ni SMTP el email no se entrega y la respuesta dice sent=${body.sent} (body: ${JSON.stringify(body)})`,
        );
        assert.ok(body.error, 'un envío que no salió debe traer el motivo machine-readable');
        assert.ok(body.message, 'y un mensaje humano para el admin');

        // La invitación NO se pierde por el fallo de entrega: se creó su AuthSession.
        const sesionesDespues = await prisma.authSession.count({ where: { teamMemberId: miembro.id } });
        assert.equal(
          sesionesDespues, sesionesAntes + 1,
          'la invitación debe seguir generándose aunque el email no salga (el enlace vive 7 días)',
        );

        t.diagnostic(`SCRUM-131: resend → 200 con sent:false (${body.error}) y la invitación intacta ✓`);
      },
    );
  } finally {
    server.close();
    await prisma.$disconnect();
  }
});
