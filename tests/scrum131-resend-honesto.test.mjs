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
import { URL_BANCO } from './_banco-libro.mjs'; // SCRUM-1599h: segundo destino (LIBRO_PG_URL), inerte con el gate de staging
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113
import http from 'node:http';

// `node:http` sin agente y no `fetch` (SCRUM-1218i): `fetch` contra un servidor propio puede
// abortar el proceso al salir (SCRUM-560). Devuelve lo que este fichero lee de la respuesta de `fetch`
// (status, ok, headers.get, text, json, arrayBuffer) y, como el `redirect: 'manual'` de antes, no sigue
// redirecciones. El cuerpo se guarda en bytes: `text()` lo decodifica como `fetch` (TextDecoder).
const pedirSinAgente = (url, { method = 'GET', headers = {}, body } = {}) => new Promise((ok, mal) => {
  const u = new URL(url);
  const cabeceras = { ...headers };
  if (body !== undefined) cabeceras['content-length'] = Buffer.byteLength(body);
  const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: cabeceras, agent: false }, (r) => {
    const trozos = [];
    r.on('data', (t) => { trozos.push(t); });
    r.on('end', () => {
      const buf = Buffer.concat(trozos);
      ok({
        status: r.statusCode,
        ok: r.statusCode >= 200 && r.statusCode < 300,
        headers: { get: (n) => { const v = r.headers[n.toLowerCase()]; return v === undefined ? null : [].concat(v).join(', '); } },
        text: async () => new TextDecoder().decode(buf),
        json: async () => JSON.parse(new TextDecoder().decode(buf)),
        arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      });
    });
  });
  req.on('error', mal);
  req.end(body);
});

const ENABLED = process.env.QA_DB_TEST === '1' || URL_BANCO !== '';

test('SCRUM-131: reenviar invitación informa si el email NO salió (sent:false), sin perder la invitación', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async (t) => {
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
        const cookie = ((await pedirSinAgente(`${base}/auth/verify?token=${token}`, { redirect: 'manual' }))
          .headers.get('set-cookie') || '').split(';')[0];
        assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');

        const sesionesAntes = await prisma.authSession.count({ where: { teamMemberId: miembro.id } });

        const res = await pedirSinAgente(`${base}/admin/team/${miembro.id}/resend`, {
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

// SCRUM-1599h (diseño B de SCRUM-1599) · la mutación que tumba el caso de base, CATALOGADA en SCRUM-1599i.
// Va aparte de `MUTACIONES_QUE_ME_TUMBAN` a propósito: el job del meta-guard corre SIN base, el caso sale
// SALTADO en su pasada limpia y eso es CIEGO (PUERTA 1a), no un veredicto. La ejecuta, con el banco PGlite,
// `docs/master/evidencias/SCRUM-1599/mutar-1599i.mjs` (forma de SCRUM-1390e). Cada campo, LITERAL.
export const MUTACIONES_CON_BASE = [
  { fichero: "src/modules/team/app/routes/team.routes.ts", de: "return res.json(sent ? sendSuccessBody() : sendFailureBody(reason ?? 'email_send_failed'));", a: "return res.json(sendSuccessBody());", cae: "SCRUM-131: reenviar invitación informa si el email NO salió" },
];
