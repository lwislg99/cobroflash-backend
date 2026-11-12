// tests/scrum914-equipos-borrado-y-anonimizado.test.mjs — SCRUM-914, la mitad del equipo de Javier.
//
// Los EQUIPOS del cliente (`equipments`, docs/sql/scrum-914-equipos-del-cliente.sql) entran en las
// dos listas del derecho al olvido: el ORDEN del borrado y los CAMPOS del anonimizado.
//
// ⚠️ TODO CONTRA LA BASE DESECHABLE O SIN BASE. Nada contra producción ni staging, ni en lectura.
// Los tests con base exigen loopback y una base terminada en `_test`, y si no, FALLAN.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS DOS ROJOS QUE ESTE FICHERO CONVIERTE EN COMPROBACIÓN (medidos en el registro, docs/master/SCRUM-914.md)
//   · BORRADO: sin `equipment` en el orden, un comercio con equipos NO se puede borrar — la FK
//     RESTRICT de `equipments.customer_id` tumba el `deleteMany` de `customer`, y la de
//     `equipments.merchant_id` el del merchant.
//   · ANONIMIZADO: sin `equipment` en la lista, el nombre y el número de serie de cada aparato
//     sobreviven en claro a una supresión del art. 17. Y el control al revés: lo que NO se eligió
//     (tipo, marca, modelo, fechas) sigue INTACTO — es lo que impide anonimizar de más.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';

const { ORDEN_BORRADO_MERCHANT, borrarMerchant } =
  await import('../dist/modules/system/domain/borradoMerchant.js');
const { CAMPOS_PERSONALES, REDACTADO } = await import('../dist/modules/system/domain/anonimizarMerchant.js');
const { suprimirMerchant } = await import('../dist/modules/system/domain/supresionMerchant.service.js');

const URL_BANCO = process.env.LIBRO_PG_URL || '';
const ENABLED = URL_BANCO !== '';
const SELLO = `e${process.pid}`;


function exigirBancoDesechable(url) {
  const p = parseBDSegura(url);
  assert.ok(p, '🔴 LIBRO_PG_URL no es legible.');
  assert.ok(['127.0.0.1', 'localhost', '::1'].includes(p.host), `🔴 «${p.host}» no es loopback y esto BORRA datos.`);
  assert.ok(p.base.endsWith('_test'), `🔴 «${p.base}» no termina en «_test».`);
  return `${p.host}:${p.puerto}/${p.base}`;
}

// ── SIN BASE: las dos decisiones, escritas a mano a propósito ────────────────────────────────

test('SCRUM-914 · equipment va DESPUÉS de los documentos que le apuntan y ANTES de su sitio y su cliente', () => {
  const i = (m) => ORDEN_BORRADO_MERCHANT.indexOf(m);
  assert.ok(i('equipment') >= 0, '🔴 `equipment` no está en el orden de borrado.');
  // Le apuntan SIN FK por `equipment_id`: si el equipo cae antes y el bucle falla a mitad, quedan
  // documentos apuntando a un equipo que ya no existe, y nada protesta.
  for (const hijo of ['job', 'maintenancePlan', 'albaran', 'parteTrabajo']) {
    assert.ok(i(hijo) >= 0 && i(hijo) < i('equipment'),
      `🔴 \`${hijo}\` apunta a \`equipment\` por \`equipment_id\` SIN FK y tiene que caer ANTES que él.`);
  }
  // El equipo apunta a su sitio SIN FK, y a su cliente con FK RESTRICT.
  assert.ok(i('equipment') < i('customerSite'),
    '🔴 `equipment` apunta a `customerSite` por `customer_site_id` SIN FK: el sitio va DESPUÉS del equipo.');
  assert.ok(i('equipment') < i('customer') && i('customerSite') < i('customer'),
    '🔴 `equipment` y `customerSite` tienen FK RESTRICT a `customer`: los dos van ANTES que él.');
});

test('SCRUM-914 · del equipo se anonimizan el nombre y el número de serie, y NADA MÁS', () => {
  // Escrito a mano: si mañana cambia QUÉ se redacta, este aserto tiene que caer y obligar a
  // mirarlo. Derivarlo de la lista lo volvería tautológico.
  assert.deepEqual([...(CAMPOS_PERSONALES.equipment ?? [])].sort(), ['name', 'serialNumber'],
    '🔴 los campos personales de `equipment` han cambiado. `type`, `brand`, `modelName`, `installedOn` y ' +
    '`warrantyUntil` se quedaron FUERA a propósito (ver `anonimizarMerchant.ts`): moverlos es una ' +
    'decisión de protección de datos, no un arreglo.');
});

// ── CON BASE DESECHABLE: el código real contra las FK reales ─────────────────────────────────

const DATOS_COMERCIO = () => ({ name: `QA Equipos ${SELLO}`, email: `equipos.${SELLO}@qa.invalid` });

/** Cliente, sitio, equipo en ese sitio y un trabajo ligado al equipo. Sin teléfonos: no hacen falta. */
async function sembrar(prisma, merchantId) {
  const cli = await prisma.customer.create({ data: { merchantId, name: 'Ana Pérez' } });
  const sitio = await prisma.customerSite.create({ data: { merchantId, customerId: cli.id, name: 'Piso 3ºB' } });
  const equipo = await prisma.equipment.create({
    data: {
      merchantId, customerId: cli.id, customerSiteId: sitio.id,
      type: 'caldera', name: 'Caldera de la Sra. Pérez', brand: 'Vaillant', modelName: 'ecoTEC plus',
      serialNumber: `SN-${SELLO}`, installedOn: new Date('2024-03-15'), warrantyUntil: new Date('2027-03-15'),
    },
  });
  const trabajo = await prisma.job.create({ data: { merchantId, customerId: cli.id, equipmentId: equipo.id } });
  return { cli, sitio, equipo, trabajo };
}

test('SCRUM-914 · CONTRA POSTGRES: un comercio con equipos SE BORRA entero, sin errores',
  { skip: !ENABLED && 'sin LIBRO_PG_URL (banco desechable)' },
  async (t) => {
    t.diagnostic(`banco: ${exigirBancoDesechable(URL_BANCO)}`);
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasourceUrl: URL_BANCO });
    try {
      await withMerchant(prisma, DATOS_COMERCIO(), async (m, phones) => {
        await sembrar(prisma, m.id);

        const r = await borrarMerchant(prisma, m.id, { telefonosBot: Object.values(phones) });
        assert.deepEqual(r.errores, [],
          '🔴 el borrado de un comercio con equipos ha dado errores. Si nombra `customer` y `merchant`, ' +
          '`equipment` ha salido del orden y la FK RESTRICT de `equipments` los está bloqueando.');
        assert.equal(r.ok, true);
        assert.equal(r.borradas.equipment, 1, '🔴 el equipo no se ha borrado.');
        assert.equal(await prisma.equipment.count({ where: { merchantId: m.id } }), 0);
        assert.equal(await prisma.merchant.count({ where: { id: m.id } }), 0, '🔴 el merchant sigue vivo.');
        // ⚠️ Al salir, la limpieza de `withMerchant` intenta borrar un merchant que `borrarMerchant` ya
        // borró, y AVISA por consola de que no pudo. Ese aviso aquí es el éxito del test, no un huérfano.
        // No se le recrea el merchant para callarlo: crear merchants a mano lo prohíbe SCRUM-113.
      });
    } finally {
      await prisma.$disconnect();
    }
  });

test('SCRUM-914 · CONTRA POSTGRES: se anonimizan nombre y nº de serie, y lo demás del equipo sigue INTACTO',
  { skip: !ENABLED && 'sin LIBRO_PG_URL (banco desechable)' },
  async (t) => {
    t.diagnostic(`banco: ${exigirBancoDesechable(URL_BANCO)}`);
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasourceUrl: URL_BANCO });
    try {
      await withMerchant(prisma, DATOS_COMERCIO(), async (m) => {
        const { equipo } = await sembrar(prisma, m.id);

        const r = await suprimirMerchant({ merchantId: m.id, actor: { tipo: 'pro_propietario', teamMemberId: null }, db: prisma });
        assert.equal(r.ok, true, `🔴 la supresión no completó: ${r.motivo}`);

        const despues = await prisma.equipment.findUnique({ where: { id: equipo.id } });
        assert.ok(despues, '🔴 la fila del equipo ha desaparecido: anonimizar no es borrar.');
        // ① Lo elegido, fuera.
        assert.equal(despues.name, REDACTADO, '🔴 el nombre del equipo sigue en claro tras la supresión.');
        assert.equal(despues.serialNumber, REDACTADO, '🔴 el número de serie sigue en claro tras la supresión.');
        // ② 🔴 Lo NO elegido, intacto: es lo que impide anonimizar de más.
        assert.equal(despues.type, 'caldera', '🔴 se ha tocado el TIPO, que no es dato personal.');
        assert.equal(despues.brand, 'Vaillant', '🔴 se ha tocado la MARCA, que es de catálogo.');
        assert.equal(despues.modelName, 'ecoTEC plus', '🔴 se ha tocado el MODELO, que es de catálogo.');
        assert.equal(despues.installedOn.toISOString().slice(0, 10), '2024-03-15', '🔴 se ha tocado la fecha de instalación.');
        assert.equal(despues.warrantyUntil.toISOString().slice(0, 10), '2027-03-15', '🔴 se ha tocado la garantía.');
        assert.equal(despues.customerSiteId, equipo.customerSiteId, '🔴 se ha tocado el enlace al sitio.');

        // La fila del equipo sobrevive a la supresión y apunta a `customer` con RESTRICT: se quita
        // aquí, porque la lista de limpieza del fixture (`MODELOS_POR_MERCHANT`) es de quien añade el modelo.
        await prisma.equipment.deleteMany({ where: { merchantId: m.id } });
      });
    } finally {
      await prisma.$disconnect();
    }
  });
