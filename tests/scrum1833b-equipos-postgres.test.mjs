// SCRUM-1833b · BORRAR UN EQUIPO ES ATÓMICO CONTRA POSTGRES DE VERDAD.
//
// El doble de la casa (`tests/_envio-doblado.mjs`) ejecuta `$transaction(cb)` como `cb(tx)` sobre los
// MISMOS modelos: no distingue si hay transacción o no. El caso sin gate de
// `scrum1833b-equipos-rutas.test.mjs` lo suple con una foto que se restaura si algo lanza; éste mide la
// transacción de Postgres: un disparador BEFORE DELETE en `equipments` hace fallar el borrado de UN
// equipo marcado, y los cuatro documentos que lo llevan (trabajo, plan de mantenimiento, albarán y
// parte) tienen que seguir ligados. Quitado el disparador, el mismo borrado los desliga y borra el
// equipo: ése es el control de que lo único que paraba era el disparador.
//
// GATEADO SOLO por `LIBRO_PG_URL`: un Postgres DESECHABLE (loopback, base terminada en `_test`). CI lo
// pone. NO se gatea por QA_DB_TEST: este caso crea un disparador, y eso no se hace contra staging.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const URL_BANCO = process.env.LIBRO_PG_URL || '';
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const CON_BASE = URL_BANCO !== '';

after(async () => {
  if (!CON_BASE) return;
  const { prisma } = await import('../dist/core/db/prisma.js');
  await prisma.$disconnect();
});

test('SCRUM-1833b · POSTGRES · borrar un equipo es atómico: si Postgres rechaza el borrado, los 4 documentos siguen ligados; sin el rechazo, se desligan',
  { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { borrarEquipo } = await import('../dist/modules/system/customerAdmin.js');
    const stamp = Date.now();
    const marca = `QA-1833b-no-borrar-${stamp}`;
    const fn = `qa_1833b_no_borrar_${stamp}`;
    await withMerchant(prisma, { name: 'QA 1833b equipos', email: `qa-1833b-${stamp}@test.local` }, async (a) => {
      const cliente = await prisma.customer.create({ data: { merchantId: a.id, name: 'Cliente 1833b' } });
      const equipo = await prisma.equipment.create({ data: { merchantId: a.id, customerId: cliente.id, type: 'Caldera', name: marca } });
      const ligado = { merchantId: a.id, customerId: cliente.id, equipmentId: equipo.id };
      const job = await prisma.job.create({ data: ligado });
      const plan = await prisma.maintenancePlan.create({ data: { ...ligado, title: 'Revisión anual', intervalMonths: 12, nextDueAt: new Date() } });
      const albaran = await prisma.albaran.create({ data: { merchantId: a.id, jobId: job.id, equipmentId: equipo.id, numero: `ALB-1833b-${stamp}`, lineas: [] } });
      const parte = await prisma.parteTrabajo.create({ data: { ...ligado, numero: `PT-1833b-${stamp}`, fecha: new Date(), tecnicos: [], lineas: [] } });

      const enlaces = async () => [
        (await prisma.job.findUnique({ where: { id: job.id } })).equipmentId,
        (await prisma.maintenancePlan.findUnique({ where: { id: plan.id } })).equipmentId,
        (await prisma.albaran.findUnique({ where: { id: albaran.id } })).equipmentId,
        (await prisma.parteTrabajo.findUnique({ where: { id: parte.id } })).equipmentId,
      ];
      assert.deepEqual(await enlaces(), [equipo.id, equipo.id, equipo.id, equipo.id], 'control del banco: los 4 documentos nacen ligados');

      await prisma.$executeRawUnsafe(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.name = '${marca}' THEN RAISE EXCEPTION 'qa-1833b: borrado rechazado'; END IF; RETURN OLD; END $$`);
      try {
        await prisma.$executeRawUnsafe(`CREATE TRIGGER ${fn} BEFORE DELETE ON equipments FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
        // Prisma lleva el texto de Postgres en el mensaje o en `meta`, según la versión: se mira en los dos.
        await assert.rejects(borrarEquipo(a.id, cliente.id, equipo.id),
          (e) => /qa-1833b: borrado rechazado/.test(`${e?.message} ${JSON.stringify(e?.meta ?? {})}`),
          'el que hace fallar el borrado tiene que ser el disparador, no otra cosa');
        assert.deepEqual(await enlaces(), [equipo.id, equipo.id, equipo.id, equipo.id],
          '🔴 el borrado falló y algún documento se quedó sin equipo: desligar y borrar no van en la misma transacción');
        assert.ok(await prisma.equipment.findUnique({ where: { id: equipo.id } }), 'el equipo sigue');
      } finally {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${fn} ON equipments`);
        await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fn}()`);
      }

      assert.equal(await borrarEquipo(a.id, cliente.id, equipo.id), true, 'sin el disparador, el borrado sale');
      assert.deepEqual(await enlaces(), [null, null, null, null], 'y desliga los 4 documentos');
      assert.equal(await prisma.equipment.findUnique({ where: { id: equipo.id } }), null, 'y el equipo ya no está');
    });
  });
