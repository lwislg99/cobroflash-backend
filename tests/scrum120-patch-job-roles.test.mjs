// SCRUM-120 — PATCH /admin/jobs/:id: gate POR CAMPO (no por ruta). Lo operativo del día a día
// (status agendar/empezar/terminar, scheduledAt, notes) es del TÉCNICO; lo que afecta a FACTURACIÓN
// es admin: `tipoOperacion` (bandera fiscal), `assignedUserId` (reparto de equipo) y cerrar el Trabajo
// (`status:'cerrado'`: irreversible + mata la vía de "Cobrar el resto"). FAIL-CLOSED: un técnico que
// mande CUALQUIER campo admin-only (aunque venga mezclado con campos legítimos) → 403, nada se aplica.
//
// A12.4 es a nivel de RUTA (ADMIN_ONLY_ROUTES); esto es a nivel de CAMPO, por eso su propio test.
//
// ⚠️ GATEADO (crea/BORRA merchant + teamMembers + job efímeros; levanta la app):
//   QA_DB_TEST=1 WHATSAPP_DRY_RUN=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113: fixture + limpieza garantizada

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-120: PATCH /admin/jobs/:id — gate por campo (técnico: operativo ✅, fiscal/dinero ❌ fail-closed)', { skip: !ENABLED }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = Date.now();

  try {
    // SCRUM-113: merchant + teamMember + customer + job se montan DENTRO de withMerchant, que
    // garantiza el borrado pase lo que pase (un teamMember.create puede lanzar) — nada de huérfanos.
    await withMerchant(
      prisma,
      { name: 'QA S120', email: `qa-s120-${stamp}@test.local` },
      async (merchant) => {
        const tecnico = await prisma.teamMember.create({
          data: { merchantId: merchant.id, name: 'QA Tec S120', email: `qa-s120-tec-${stamp}@test.local`, role: 'tecnico', status: 'active' },
        });
        const customer = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente S120' } });
        const job = await prisma.job.create({
          data: { merchantId: merchant.id, customerId: customer.id, status: 'en_curso', titulo: 'Trabajo S120', operarioId: tecnico.id, tipoOperacion: 'TRABAJO_UNICO', notes: 'nota-original' },
        });

        const mkCookie = async (teamMemberId = null) => {
          const token = 'qa120-' + crypto.randomBytes(12).toString('hex');
          await prisma.authSession.create({
            data: { merchantId: merchant.id, teamMemberId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
          });
          const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
          const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
          assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
          return cookie;
        };
        const patch = (cookie, body) => fetch(`${base}/admin/jobs/${job.id}`, {
          method: 'PATCH', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });

        const cookieTecnico = await mkCookie(tecnico.id);
        const cookieAdmin = await mkCookie(null); // owner = admin implícito

        // ── TÉCNICO: campos admin-only → 403, con el `field` correcto ──────────────
        const rTipo = await patch(cookieTecnico, { tipoOperacion: 'OPERACIONES_SUELTAS' });
        assert.equal(rTipo.status, 403, 'técnico cambiando tipoOperacion (bandera fiscal) debe dar 403');
        assert.equal((await rTipo.json()).field, 'tipoOperacion', 'el 403 debe indicar el campo');

        const rAssign = await patch(cookieTecnico, { assignedUserId: tecnico.id });
        assert.equal(rAssign.status, 403, 'técnico reasignando (assignedUserId) debe dar 403');

        const rCerrar = await patch(cookieTecnico, { status: 'cerrado' });
        assert.equal(rCerrar.status, 403, 'técnico cerrando el Trabajo (irreversible + mata el cobro) debe dar 403');
        assert.equal((await rCerrar.json()).field, 'status:cerrado');

        // ── FAIL-CLOSED: mezcla de campo fiscal + campo legítimo → 403 y NADA se aplica ──
        const rMix = await patch(cookieTecnico, { tipoOperacion: 'OPERACIONES_SUELTAS', notes: 'MEZCLA-NO-DEBE-GUARDARSE' });
        assert.equal(rMix.status, 403, 'mezcla con un campo admin-only debe rechazarse ENTERA');
        const tras = await prisma.job.findUnique({ where: { id: job.id } });
        assert.equal(tras.notes, 'nota-original', 'FAIL-CLOSED ROTO: se aplicó un campo legítimo pese al 403');
        assert.equal(tras.tipoOperacion, 'TRABAJO_UNICO', 'la bandera fiscal NO debe haber cambiado');

        // ── TÉCNICO: lo OPERATIVO del día a día → 200 ─────────────────────────────
        const rNotes = await patch(cookieTecnico, { notes: 'nota-del-operario' });
        assert.equal(rNotes.status, 200, 'técnico editando notes (operativo) debe ir bien');
        const rTerm = await patch(cookieTecnico, { status: 'terminado' });
        assert.equal(rTerm.status, 200, 'técnico marcando terminado (en_curso→terminado) debe ir bien');
        assert.equal((await prisma.job.findUnique({ where: { id: job.id } })).status, 'terminado');

        // ── ADMIN: los campos fiscales SÍ ─────────────────────────────────────────
        const rTipoAdmin = await patch(cookieAdmin, { tipoOperacion: 'OPERACIONES_SUELTAS' });
        assert.equal(rTipoAdmin.status, 200, 'el admin SÍ puede cambiar tipoOperacion');
        assert.equal((await prisma.job.findUnique({ where: { id: job.id } })).tipoOperacion, 'OPERACIONES_SUELTAS');
        assert.equal((await patch(cookieAdmin, { assignedUserId: tecnico.id })).status, 200, 'el admin SÍ puede reasignar');

        t.diagnostic('SCRUM-120: técnico operativo ✅ / fiscal+dinero ❌ (403 con field) · fail-closed · admin ✅');
      },
    );
  } finally {
    // La fixture (merchant + teamMember + customer + job + authSession) la borra withMerchant.
    server.close();
    await prisma.$disconnect();
  }
});
