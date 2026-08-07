// SCRUM-148 — filtro por miembro en Trabajos y Presupuestos (detalle del hub de Equipo).
//
// LO QUE DE VERDAD HAY QUE PROBAR: `?operarioId=` es un parámetro que SELECCIONA por autor,
// y SCRUM-23 es un filtro que RESTRINGE por autor. Los dos escriben en el mismo sitio
// (`where.operarioId`), así que un orden mal puesto convierte el parámetro nuevo en la llave
// que abre justo lo que SCRUM-23 cerró: un técnico pidiendo los Trabajos de un compañero.
//
// Por eso el test no se conforma con "el filtro filtra": comprueba que un TÉCNICO que manda
// el parámetro apuntando a OTRO sigue viendo SOLO los suyos.
//
// ⚠️ Toca BD real (staging), gateado:
//   QA_DB_TEST=1 DATABASE_URL_TESTS="..." npm run test:staging
import './_staging-db.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { withMerchant } from './_merchant-fixture.mjs';
import http from 'node:http';
import crypto from 'node:crypto';

const ENABLED = process.env.QA_DB_TEST === '1';

async function montar(app) {
  const server = http.createServer(app).listen(0);
  await new Promise((r) => server.once('listening', r));
  return {
    port: server.address().port,
    cerrar: () => new Promise((r) => server.close(r)),
  };
}

async function sesionDe(prisma, merchantId, teamMemberId) {
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.authSession.create({
    data: { merchantId, teamMemberId, token, type: 'session', expiresAt: new Date(Date.now() + 3600e3) },
  });
  return token;
}

test('SCRUM-148: el filtro por operario NO le da a un técnico la llave de los trabajos ajenos', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  await withMerchant(prisma, { name: 'QA SCRUM-148', email: `qa-148-${Date.now()}@test.local` }, async (merchant) => {
    const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente QA 148' } });
    const ana = await prisma.teamMember.create({
      data: { merchantId: merchant.id, name: 'Ana QA148', email: `qa148-ana-${Date.now()}@test.local`, role: 'tecnico', status: 'active' },
    });
    const bruno = await prisma.teamMember.create({
      data: { merchantId: merchant.id, name: 'Bruno QA148', email: `qa148-bruno-${Date.now()}@test.local`, role: 'tecnico', status: 'active' },
    });
    const jefe = await prisma.teamMember.create({
      data: { merchantId: merchant.id, name: 'Jefe QA148', email: `qa148-jefe-${Date.now()}@test.local`, role: 'admin', status: 'active' },
    });

    const crearJob = (operarioId, titulo) => prisma.job.create({
      data: { merchantId: merchant.id, customerId: cliente.id, operarioId, status: 'en_curso', titulo, totalAceptado: 100, totalCobrado: 0 },
    });
    await crearJob(ana.id, 'Trabajo de ANA');
    await crearJob(bruno.id, 'Trabajo de BRUNO');
    await crearJob(null, 'Trabajo del DUENO');

    const { port, cerrar } = await montar(app);
    const jobs = async (token, qs) => {
      const r = await fetch(`http://127.0.0.1:${port}/admin/jobs${qs}`, { headers: { cookie: `pf_session=${token}` } });
      const body = await r.json().catch(() => []);
      return { status: r.status, titulos: Array.isArray(body) ? body.map((j) => j.titulo).sort() : body };
    };

    try {
      const tokenAna = await sesionDe(prisma, merchant.id, ana.id);
      const tokenJefe = await sesionDe(prisma, merchant.id, jefe.id);

      // GUARDA DE PRESENCIA: Ana SÍ ve el suyo. Sin esto, un backend roto que devuelva
      // siempre [] haría pasar todos los asserts de "no ve lo ajeno" sin probar nada.
      const anaSinFiltro = await jobs(tokenAna, '');
      assert.deepEqual(anaSinFiltro.titulos, ['Trabajo de ANA'],
        'Ana debe ver SU trabajo (si esto falla, lo de abajo no prueba nada)');

      // EL ATAQUE: Ana pide explícitamente los de Bruno.
      const anaPidiendoBruno = await jobs(tokenAna, `?operarioId=${bruno.id}`);
      assert.deepEqual(anaPidiendoBruno.titulos, ['Trabajo de ANA'],
        '🔴 SCRUM-23 ROTO: el parámetro operarioId le ha dado a un técnico los trabajos de otro');

      // Y los del dueño, que es el otro camino (operarioId null).
      const anaPidiendoDueno = await jobs(tokenAna, '?operarioId=owner');
      assert.deepEqual(anaPidiendoDueno.titulos, ['Trabajo de ANA'],
        '🔴 SCRUM-23 ROTO: "owner" tampoco puede ser una puerta trasera');

      // El admin SÍ debe poder seleccionar — si no, el filtro no sirve para nada.
      assert.deepEqual((await jobs(tokenJefe, `?operarioId=${bruno.id}`)).titulos, ['Trabajo de BRUNO']);
      assert.deepEqual((await jobs(tokenJefe, '?operarioId=owner')).titulos, ['Trabajo del DUENO']);
      assert.deepEqual((await jobs(tokenJefe, '')).titulos,
        ['Trabajo de ANA', 'Trabajo de BRUNO', 'Trabajo del DUENO'], 'sin filtro, el admin los ve todos');
    } finally {
      await cerrar();
    }
  });
});

test('SCRUM-148: el filtro de presupuestos distingue "del propietario" de "sin filtrar"', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { listQuotesAdmin } = await import('../dist/modules/system/quoteAdmin.js');

  await withMerchant(prisma, { name: 'QA SCRUM-148b', email: `qa-148b-${Date.now()}@test.local` }, async (merchant) => {
    const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Cliente QA 148b' } });
    const ana = await prisma.teamMember.create({
      data: { merchantId: merchant.id, name: 'Ana QA148b', email: `qa148b-ana-${Date.now()}@test.local`, role: 'tecnico', status: 'active' },
    });

    const crearQuote = (teamMemberId) => prisma.quote.create({
      data: { merchantId: merchant.id, customerId: cliente.id, teamMemberId, total: 50, currency: 'EUR', lines: [], status: 'sent' },
    });
    await crearQuote(ana.id);
    await crearQuote(null); // del propietario

    // Sin filtrar: los dos.
    assert.equal((await listQuotesAdmin(merchant.id)).length, 2, 'sin filtro salen todos');
    // Del miembro: solo el suyo.
    assert.equal((await listQuotesAdmin(merchant.id, undefined, undefined, null, null, ana.id)).length, 1);
    // Del PROPIETARIO (null): solo el suyo — y este es el caso que un `if (teamMemberId)`
    // se comería en silencio, devolviendo los 2 bajo el nombre del dueño.
    const delDueno = await listQuotesAdmin(merchant.id, undefined, undefined, null, null, null);
    assert.equal(delDueno.length, 1, 'null debe filtrar por "del propietario", no significar "sin filtro"');
  });
});
