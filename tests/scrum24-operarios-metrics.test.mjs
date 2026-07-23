// SCRUM-24 (OPERARIO-3): GET /admin/metrics/operarios — resumen de supervisión por operario.
// Verifica: (1) sumas correctas por operario + fila del propietario, (2) el técnico recibe 403
// (S1: la supervisión es solo del admin; gate en BACKEND, no ocultando el nav), (3) tenancy
// (regla 2): no se cuelan operarios ni importes de otro merchant.
//
// Datos EFÍMEROS propios con limpieza en el finally — NUNCA el seed demo (lección de SCRUM-63).
//
// ⚠️ GATEADO (crea y BORRA merchants efímeros; levanta la app in-process):
//   QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando QA_DB_TEST=1 (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withMerchant } from './_merchant-fixture.mjs';

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-24: /admin/metrics/operarios — sumas por operario, 403 del técnico y tenancy', { skip: !ENABLED }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();

  // SCRUM-113: los merchants y TODO su montaje viven dentro de withMerchant. Antes se
  // creaban aquí arriba, fuera del try: si el montaje reventaba a medias — un teamMember,
  // un job — el finally ni se planteaba y quedaban huérfanos en staging. Ahora el borrado
  // está garantizado desde que el merchant existe, y va aislado por operación.
  try {
    await withMerchant(prisma, { name: 'QA S24 A', email: `qa-s24-A-${stamp}@test.local` }, (merchantA) =>
      // vecino: su dinero NO puede aparecer en A
      withMerchant(prisma, { name: 'QA S24 B', email: `qa-s24-B-${stamp}@test.local` }, async (merchantB) => {
    const mkTecnico = (merchantId, tag) =>
      prisma.teamMember.create({
        data: {
          merchantId, name: `QA Tec ${tag}`,
          email: `qa-s24-tec-${tag}-${stamp}@test.local`, role: 'tecnico', status: 'active',
        },
      });
    const tecA1 = await mkTecnico(merchantA.id, 'A1');
    const tecA2 = await mkTecnico(merchantA.id, 'A2');
    const tecB1 = await mkTecnico(merchantB.id, 'B1');

    const custA = await prisma.customer.create({ data: { merchantId: merchantA.id, name: 'Cliente S24 A' } });
    const custB = await prisma.customer.create({ data: { merchantId: merchantB.id, name: 'Cliente S24 B' } });

    const mkJob = (merchantId, customerId, operarioId, aceptado, cobrado, status = 'en_curso') =>
      prisma.job.create({
        data: {
          merchantId, customerId, operarioId, status,
          titulo: `QA S24 ${aceptado}/${cobrado}`,
          totalAceptado: aceptado, totalCobrado: cobrado,
        },
      });

    // tecA1: 1000 aceptado / 250 cobrado (abierto) + 500/500 CERRADO → abiertos=1, trabajos=2
    await mkJob(merchantA.id, custA.id, tecA1.id, '1000.00', '250.00', 'en_curso');
    await mkJob(merchantA.id, custA.id, tecA1.id, '500.00', '500.00', 'cerrado');
    // tecA2: 200 aceptado / 0 cobrado (abierto)
    await mkJob(merchantA.id, custA.id, tecA2.id, '200.00', '0.00', 'en_curso');
    // propietario de A (operarioId null): 100 / 100
    await mkJob(merchantA.id, custA.id, null, '100.00', '100.00', 'en_curso');
    // ruido del merchant vecino — jamás debe aparecer en el resumen de A
    await mkJob(merchantB.id, custB.id, tecB1.id, '9999.00', '0.00', 'en_curso');

    const mkCookie = async (merchantId, teamMemberId = null) => {
      const token = 'qa24-' + crypto.randomBytes(12).toString('hex');
      await prisma.authSession.create({
        data: { merchantId, teamMemberId, token, type: 'magic_link', expiresAt: new Date(Date.now() + 600000) },
      });
      const res = await fetch(`${base}/auth/verify?token=${token}`, { redirect: 'manual' });
      const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
      assert.ok(cookie.startsWith('pf_session='), 'no se obtuvo cookie de sesión');
      return cookie;
    };

    const cookieAdminA = await mkCookie(merchantA.id, null);
    const cookieTecA1 = await mkCookie(merchantA.id, tecA1.id);
    const get = (path, cookie) => fetch(`${base}${path}`, { headers: { cookie } });

    // ── (2) S1/S3: el TÉCNICO no accede al resumen de supervisión → 403 ──────
    const forbidden = await get('/admin/metrics/operarios', cookieTecA1);
    assert.equal(forbidden.status, 403, 'el técnico NO debe ver la supervisión por operario (esperado 403)');

    // ── (1) sumas correctas por operario, con sesión de ADMIN ───────────────
    const res = await get('/admin/metrics/operarios', cookieAdminA);
    assert.equal(res.status, 200, 'el admin sí accede al resumen');
    const data = await res.json();
    assert.equal(data.hasOperarios, true, 'el merchant A tiene operarios');

    const byId = new Map(data.operarios.map((o) => [o.operarioId, o]));

    const a1 = byId.get(tecA1.id);
    assert.ok(a1, 'debe aparecer el técnico A1');
    assert.equal(a1.totalAceptado, 1500, 'A1: aceptado = 1000 + 500');
    assert.equal(a1.totalCobrado, 750, 'A1: cobrado = 250 + 500');
    assert.equal(a1.pendiente, 750, 'A1: pendiente = aceptado - cobrado');
    assert.equal(a1.trabajos, 2, 'A1: 2 trabajos en total');
    assert.equal(a1.abiertos, 1, 'A1: solo 1 abierto (el cerrado no cuenta)');
    assert.equal(a1.progreso, 50, 'A1: 750/1500 = 50%');
    assert.equal(a1.estadoCobro, 'Parcial', 'A1: cobro parcial');

    const a2 = byId.get(tecA2.id);
    assert.equal(a2.totalAceptado, 200);
    assert.equal(a2.totalCobrado, 0);
    assert.equal(a2.pendiente, 200);
    assert.equal(a2.progreso, 0);
    assert.equal(a2.estadoCobro, 'Pendiente', 'A2: nada cobrado');

    // fila del PROPIETARIO: operarioId null y nombre = el del negocio
    const owner = byId.get(null);
    assert.ok(owner, 'debe existir la fila del propietario (operarioId null)');
    assert.equal(owner.nombre, merchantA.name, 'el propietario se muestra con el nombre del negocio');
    assert.equal(owner.totalCobrado, 100);
    assert.equal(owner.estadoCobro, 'Pagado', 'propietario: 100/100 → Pagado');

    // ── (3) TENANCY (regla 2): ni el operario ni el dinero del vecino ────────
    assert.ok(!byId.has(tecB1.id), 'TENANCY ROTA: aparece un operario de otro merchant');
    const totalAceptadoA = data.operarios.reduce((s, o) => s + Number(o.totalAceptado), 0);
    assert.equal(totalAceptadoA, 1800, 'TENANCY: solo el dinero de A (1500+200+100), sin los 9999 de B');

    t.diagnostic('operarios: sumas + abiertos + propietario ✓ · técnico 403 ✓ · tenancy ✓');
      }));
  } finally {
    // Solo queda lo que NO es del merchant: el borrado de datos lo garantiza withMerchant.
    server.close();
    await prisma.$disconnect();
  }
});
