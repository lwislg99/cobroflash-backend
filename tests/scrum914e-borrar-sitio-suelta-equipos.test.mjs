// tests/scrum914e-borrar-sitio-suelta-equipos.test.mjs — SCRUM-914e (S1; SCRUM-1836 c.22799, S1-①)
//
// `borrarSitio` (`src/modules/system/domain/sitiosDelCliente.ts`) borraba la fila de `customer_sites`
// y dejaba a sus equipos apuntando a un sitio que ya no existe: `equipments.customer_site_id` va SIN
// clave ajena (el borrado lo hace el código, SCRUM-192), así que nadie lo ponía a NULL. Es el
// criterio 1 de SCRUM-914. Desde #3466 (SCRUM-1833b) la pestaña «Equipos» escribe `customerSiteId`:
// la víctima existe hoy.
//
// La regla: al borrar un sitio, sus equipos SE QUEDAN en el cliente, sin sitio, y sólo los de ESE
// cliente de ESE comercio. Y en la misma transacción que el borrado: si Postgres rechaza el
// borrado, ningún equipo pierde su sitio.
//
// Dos partes:
//   · POSTGRES (gateado SOLO por `LIBRO_PG_URL`, el banco desechable del CI; patrón de scrum1833b):
//     el motor real, con un disparador que rechaza el borrado para medir la transacción.
//   · SIN BANCO: el mismo código de `dist/` con `prisma` doblado, para que la tanda local no salga
//     verde por no haber mirado nada.
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

/** Siembra: un cliente con dos sitios y cuatro equipos, y OTRO cliente del mismo comercio. */
async function sembrar(prisma, m, stamp) {
  const cli = await prisma.customer.create({ data: { merchantId: m.id, name: `Cliente 914e ${stamp}` } });
  const otro = await prisma.customer.create({ data: { merchantId: m.id, name: `Otro 914e ${stamp}` } });
  const s1 = await prisma.customerSite.create({ data: { merchantId: m.id, customerId: cli.id, name: 'Piso 3ºB' } });
  const s2 = await prisma.customerSite.create({ data: { merchantId: m.id, customerId: cli.id, name: 'Nave' } });
  const eq = (customerId, customerSiteId, name) =>
    prisma.equipment.create({ data: { merchantId: m.id, customerId, customerSiteId, type: 'Caldera', name } });
  const e = {
    enS1a: await eq(cli.id, s1.id, `914e-a-${stamp}`),
    enS1b: await eq(cli.id, s1.id, `914e-b-${stamp}`),
    enS2: await eq(cli.id, s2.id, `914e-c-${stamp}`),
    sinSitio: await eq(cli.id, null, `914e-d-${stamp}`),
    // Otro cliente con el MISMO número de sitio (no hay FK que lo impida): no es suyo, no se toca.
    ajeno: await eq(otro.id, s1.id, `914e-e-${stamp}`),
  };
  return { cli, s1, s2, e };
}

async function sitiosDe(prisma, e) {
  const out = {};
  for (const [k, v] of Object.entries(e)) out[k] = (await prisma.equipment.findUnique({ where: { id: v.id } })).customerSiteId;
  return out;
}

test('SCRUM-914e · POSTGRES · 🔴 borrar un sitio deja a SUS equipos en el cliente, sin sitio; los demás, igual',
  { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { borrarSitio } = await import('../dist/modules/system/domain/sitiosDelCliente.js');
    const stamp = Date.now();
    await withMerchant(prisma, { name: 'QA 914e sitios', email: `qa-914e-${stamp}@test.local` }, async (m) => {
      const { cli, s1, s2, e } = await sembrar(prisma, m, stamp);
      assert.deepEqual(await sitiosDe(prisma, e),
        { enS1a: s1.id, enS1b: s1.id, enS2: s2.id, sinSitio: null, ajeno: s1.id }, 'control del banco: la siembra');

      assert.equal(await borrarSitio(m.id, cli.id, s1.id), true, 'el sitio se borra');
      assert.equal(await prisma.customerSite.findUnique({ where: { id: s1.id } }), null, 'y ya no está');
      assert.deepEqual(await sitiosDe(prisma, e),
        { enS1a: null, enS1b: null, enS2: s2.id, sinSitio: null, ajeno: s1.id },
        '🔴 los equipos del sitio borrado siguen apuntando a él (o se tocó uno que no era suyo)');
      for (const k of ['enS1a', 'enS1b']) {
        assert.ok(await prisma.equipment.findUnique({ where: { id: e[k].id } }), `el equipo ${k} sigue en el cliente: se suelta, no se borra`);
      }
    });
  });

test('SCRUM-914e · POSTGRES · CONTROL: un sitio de OTRO comercio no se borra y no suelta nada',
  { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { borrarSitio } = await import('../dist/modules/system/domain/sitiosDelCliente.js');
    const stamp = Date.now();
    await withMerchant(prisma, { name: 'QA 914e propio', email: `qa-914e-p-${stamp}@test.local` }, async (m) => {
      await withMerchant(prisma, { name: 'QA 914e intruso', email: `qa-914e-i-${stamp}@test.local` }, async (intruso) => {
        const { cli, s1, s2, e } = await sembrar(prisma, m, stamp);
        assert.equal(await borrarSitio(intruso.id, cli.id, s1.id), false, 'otro comercio no borra el sitio');
        assert.ok(await prisma.customerSite.findUnique({ where: { id: s1.id } }), 'el sitio sigue');
        assert.deepEqual(await sitiosDe(prisma, e),
          { enS1a: s1.id, enS1b: s1.id, enS2: s2.id, sinSitio: null, ajeno: s1.id }, '🔴 un intento ajeno soltó equipos');
      });
    });
  });

test('SCRUM-914e · POSTGRES · 🔴 es atómico: si Postgres rechaza el borrado del sitio, ningún equipo pierde su sitio',
  { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
    const { prisma } = await import('../dist/core/db/prisma.js');
    const { borrarSitio } = await import('../dist/modules/system/domain/sitiosDelCliente.js');
    const stamp = Date.now();
    const marca = `QA-914e-no-borrar-${stamp}`;
    const fn = `qa_914e_no_borrar_${stamp}`;
    await withMerchant(prisma, { name: 'QA 914e atómico', email: `qa-914e-t-${stamp}@test.local` }, async (m) => {
      const { cli, s1, s2, e } = await sembrar(prisma, m, stamp);
      await prisma.customerSite.update({ where: { id: s1.id }, data: { name: marca } });
      await prisma.$executeRawUnsafe(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.name = '${marca}' THEN RAISE EXCEPTION 'qa-914e: borrado rechazado'; END IF; RETURN OLD; END $$`);
      try {
        await prisma.$executeRawUnsafe(`CREATE TRIGGER ${fn} BEFORE DELETE ON customer_sites FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
        await assert.rejects(borrarSitio(m.id, cli.id, s1.id),
          (err) => /qa-914e: borrado rechazado/.test(`${err?.message} ${JSON.stringify(err?.meta ?? {})}`),
          'el que hace fallar el borrado tiene que ser el disparador, no otra cosa');
        assert.deepEqual(await sitiosDe(prisma, e),
          { enS1a: s1.id, enS1b: s1.id, enS2: s2.id, sinSitio: null, ajeno: s1.id },
          '🔴 el borrado falló y algún equipo se quedó sin sitio: soltar y borrar no van en la misma transacción');
      } finally {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${fn} ON customer_sites`);
        await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fn}()`);
      }
      // Control: sin el disparador, el MISMO borrado sale y suelta (lo único que paraba era él).
      assert.equal(await borrarSitio(m.id, cli.id, s1.id), true);
      assert.deepEqual(await sitiosDe(prisma, e),
        { enS1a: null, enS1b: null, enS2: s2.id, sinSitio: null, ajeno: s1.id });
    });
  });

// ─── SIN BANCO: lo que pide `borrarSitio` a prisma, con prisma doblado ───────────────────────────

async function conPrismaDoblado(borradas, fn) {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const nombres = ['customerSite', 'equipment', '$transaction'];
  const original = Object.fromEntries(nombres.map((n) => [n, prisma[n]]));
  const pedido = { dentro: false, borrar: [], soltar: [], fuera: [] };
  const tx = {
    customerSite: { deleteMany: async (a) => { pedido.borrar.push({ a, dentro: pedido.dentro }); return { count: borradas }; } },
    equipment: { updateMany: async (a) => { pedido.soltar.push({ a, dentro: pedido.dentro }); return { count: 2 }; } },
  };
  prisma.customerSite = { deleteMany: async (a) => { pedido.fuera.push(a); return { count: borradas }; } };
  prisma.equipment = { updateMany: async (a) => { pedido.fuera.push(a); return { count: 2 }; } };
  prisma.$transaction = async (cb) => {
    assert.equal(typeof cb, 'function', 'la transacción es interactiva (un callback), no un array');
    pedido.dentro = true;
    try { return await cb(tx); } finally { pedido.dentro = false; }
  };
  try { return { r: await fn(), pedido }; } finally {
    for (const n of nombres) prisma[n] = original[n];
  }
}

test('SCRUM-914e · 🔴 SIN BANCO: borrar un sitio suelta los equipos de ESE cliente y ESE comercio, dentro de la transacción', async () => {
  const { borrarSitio } = await import('../dist/modules/system/domain/sitiosDelCliente.js');
  const { r, pedido } = await conPrismaDoblado(1, () => borrarSitio(7, 55, 900));
  assert.equal(r, true);
  assert.deepEqual(pedido.fuera, [], '🔴 se tocó la base FUERA de la transacción');
  assert.equal(pedido.borrar.length, 1, 'CIEGO: no se pidió borrar el sitio');
  assert.deepEqual(pedido.borrar[0].a.where, { id: 900, customerId: 55, merchantId: 7 });
  assert.equal(pedido.soltar.length, 1, '🔴 los equipos del sitio no se sueltan');
  assert.deepEqual(pedido.soltar[0].a, { where: { merchantId: 7, customerId: 55, customerSiteId: 900 }, data: { customerSiteId: null } });
  assert.ok(pedido.soltar[0].dentro && pedido.borrar[0].dentro, '🔴 soltar y borrar no van en la misma transacción');
});

test('SCRUM-914e · SIN BANCO · CONTROL: si el sitio no es suyo (0 borrados), no se suelta ningún equipo', async () => {
  const { borrarSitio } = await import('../dist/modules/system/domain/sitiosDelCliente.js');
  const { r, pedido } = await conPrismaDoblado(0, () => borrarSitio(7, 55, 900));
  assert.equal(r, false);
  assert.equal(pedido.borrar.length, 1, 'CIEGO: no se pidió borrar el sitio');
  assert.deepEqual(pedido.soltar, [], '🔴 un sitio ajeno soltó equipos');
});
