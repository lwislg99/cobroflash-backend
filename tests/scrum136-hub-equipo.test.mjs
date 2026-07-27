// SCRUM-136 — hub único de Equipo: el roster llega con su resumen, y solo lo ve un admin.
//
// DOS COSAS QUE SE PRUEBAN, por motivos distintos:
//
// 1. EL GATE (S3, gateado a BD): `GET /admin/team` es la ÚNICA puerta del hub, y ahora
//    devuelve además el dinero pendiente por miembro — o sea que se ha vuelto MÁS sensible
//    que antes, cuando solo listaba nombres y roles. Un operario no puede verla. El gate ya
//    existía (`router.use(requireRole('admin'))`), pero "ya existía" no es una prueba: esto
//    lo congela, para que enriquecer la respuesta no invite a nadie a relajarlo.
//
// 2. LAS DOS VENTANAS (sin gate, puro): el resumen mezcla presupuestos del MES con trabajos
//    del HISTÓRICO. Es deliberado —cada cifra responde a una pregunta distinta y ya se
//    agregaba así— pero es exactamente el tipo de detalle que alguien "arregla" homogeneizando
//    y rompe en silencio, porque los números seguirían saliendo. El test fija el contrato.
import './_staging-db.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { withMerchant } from './_merchant-fixture.mjs';

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-136: el hub de Equipo es admin-only — un operario no ve el pendiente de sus compañeros', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  const request = (await import('node:http')).default;
  const crypto = await import('node:crypto');

  await withMerchant(prisma, { name: 'QA SCRUM-136', email: `qa-136-${Date.now()}@test.local` }, async (merchant) => {
    const tecnico = await prisma.teamMember.create({
      data: { merchantId: merchant.id, name: 'Operario QA 136', email: `qa-136-tec-${Date.now()}@test.local`, role: 'tecnico', status: 'active' },
    });
    const admin = await prisma.teamMember.create({
      data: { merchantId: merchant.id, name: 'Admin QA 136', email: `qa-136-adm-${Date.now()}@test.local`, role: 'admin', status: 'active' },
    });

    const sesion = async (teamMemberId) => {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.authSession.create({
        data: { merchantId: merchant.id, teamMemberId, token, type: 'session', expiresAt: new Date(Date.now() + 3600e3) },
      });
      return token;
    };

    const server = request.createServer(app).listen(0);
    await new Promise((r) => server.once('listening', r));
    const port = server.address().port;
    const get = async (token) => {
      const res = await fetch(`http://127.0.0.1:${port}/admin/team`, { headers: { cookie: `pf_session=${token}` } });
      return { status: res.status, body: await res.json().catch(() => null) };
    };

    try {
      // GUARDA DE PRESENCIA: primero que el ADMIN sí lo ve. Sin esto, un 403 para todo el
      // mundo (ruta rota, servidor mal montado) haría pasar el assert de abajo sin probar nada.
      const comoAdmin = await get(await sesion(admin.id));
      assert.equal(comoAdmin.status, 200, 'el admin DEBE poder ver el equipo');
      assert.ok(Array.isArray(comoAdmin.body) && comoAdmin.body.length >= 3, 'debe traer propietario + 2 miembros');
      assert.ok(
        comoAdmin.body.every((m) => m.resumen && typeof m.resumen.pendiente === 'number'),
        'cada miembro debe traer su resumen: es lo que hace que esta respuesta sea sensible',
      );

      const comoTecnico = await get(await sesion(tecnico.id));
      assert.equal(comoTecnico.status, 403, '🔴 un operario NO puede leer el equipo con el pendiente de cada compañero');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});

test('SCRUM-136: el resumen NO homogeneiza las ventanas — presupuestos del mes, trabajos del histórico', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { getTeamOverview } = await import('../dist/modules/team/domain/teamOverview.service.js');

  await withMerchant(prisma, { name: 'QA SCRUM-136b', email: `qa-136b-${Date.now()}@test.local` }, async (merchant) => {
    const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente QA 136' } });
    const miembro = await prisma.teamMember.create({
      data: { merchantId: merchant.id, name: 'Operario ventanas', email: `qa-136v-${Date.now()}@test.local`, role: 'tecnico', status: 'active' },
    });

    const haceDosMeses = new Date();
    haceDosMeses.setMonth(haceDosMeses.getMonth() - 2);

    // Presupuesto ANTIGUO: fuera de la ventana del mes → NO debe contarse.
    await prisma.quote.create({
      data: {
        merchantId: merchant.id, customerId: cliente.id, teamMemberId: miembro.id,
        total: 100, currency: 'EUR', lines: [], status: 'sent', createdAt: haceDosMeses,
      },
    });
    // Presupuesto de ESTE mes → sí cuenta.
    await prisma.quote.create({
      data: {
        merchantId: merchant.id, customerId: cliente.id, teamMemberId: miembro.id,
        total: 200, currency: 'EUR', lines: [], status: 'accepted',
      },
    });
    // Trabajo ANTIGUO y abierto: el histórico NO se recorta por mes → sí cuenta.
    await prisma.job.create({
      data: {
        merchantId: merchant.id, customerId: cliente.id, operarioId: miembro.id,
        status: 'en_curso', titulo: 'Trabajo viejo abierto', totalAceptado: 500, totalCobrado: 200,
        createdAt: haceDosMeses,
      },
    });

    const { miembros } = await getTeamOverview(merchant.id);
    const fila = miembros.find((m) => m.id === miembro.id);
    assert.ok(fila, 'el miembro debe aparecer en el hub');

    assert.equal(fila.resumen.presupuestosEnviados, 1,
      'los presupuestos se recortan al MES: el de hace dos meses no cuenta');
    assert.equal(fila.resumen.presupuestosAceptados, 1);
    assert.equal(fila.resumen.trabajosAbiertos, 1,
      'los trabajos NO se recortan por mes: el abierto de hace dos meses sigue abierto hoy');
    assert.equal(fila.resumen.pendiente, 300, 'pendiente = aceptado - cobrado, del histórico');
  });
});

test('SCRUM-136: el propietario sale en el hub aunque no sea TeamMember, con sus propios números', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { getTeamOverview } = await import('../dist/modules/team/domain/teamOverview.service.js');

  await withMerchant(prisma, { name: 'QA SCRUM-136c', email: `qa-136c-${Date.now()}@test.local` }, async (merchant) => {
    const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente QA 136c' } });
    // Trabajo SIN operarioId = del propietario (mismo convenio que authMiddleware).
    await prisma.job.create({
      data: {
        merchantId: merchant.id, customerId: cliente.id, operarioId: null,
        status: 'en_curso', titulo: 'Trabajo del dueño', totalAceptado: 1000, totalCobrado: 250,
      },
    });

    const { miembros } = await getTeamOverview(merchant.id);
    const owner = miembros[0];

    assert.equal(owner.isOwner, true, 'el propietario va SIEMPRE el primero');
    assert.equal(owner.id, null, 'no tiene fila en team_members: su id es null, y ese null es su clave de agregación');
    assert.equal(owner.resumen.trabajosAbiertos, 1, 'sus trabajos se le atribuyen por operarioId null');
    assert.equal(owner.resumen.pendiente, 750);
  });
});
