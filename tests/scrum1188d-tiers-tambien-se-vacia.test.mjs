// tests/scrum1188d-tiers-tambien-se-vacia.test.mjs — SCRUM-1188 (el cabo que dejó 1188c)
//
// 🔴 `tiers` ES LA OTRA COLUMNA ANULABLE DE UNA PLANTILLA, Y NO SE PODÍA VACIAR.
//
// SCRUM-1188c arregló `paymentTerms` y dejó `tiers` como estaba diciendo por qué: la sonda que
// intentó medir cómo se vacía un `Json?` corrió SIN base y salió ciega. Ésta corre contra Postgres.
// Lo medido (docs/master/evidencias/SCRUM-1188d/), con @prisma/client 6.18.0:
//
//   · el `PUT` ignoraba `tiers: null` (`!= null`): el mismo defecto que el del cobro, con otra clave;
//   · y un `null` de JS en una columna `Json?` NO la vacía: Prisma guarda el valor JSON `null`, y la
//     columna deja de ser NULL de SQL. El `POST` lo hacía en cada plantilla sin niveles.
//
// Por la API las dos cosas se leen `null`. Por eso este fichero RELEE POR SQL CRUDO, que es lo único
// que las distingue, y lleva un caso (el SUELO) que demuestra que su lectura las distingue.
//
// ── EL BANCO ────────────────────────────────────────────────────────────────────────────────
// `dist/app.js` por HTTP, con su `requireAuth`, su `requireRole` y su ruta, y la base es el banco
// DESECHABLE (`LIBRO_PG_URL`: loopback y nombre acabado en `_test`), el que levanta el job del CI.
// Sin `LIBRO_PG_URL` los casos con base SALTAN diciendo por qué; el de abajo del todo corre siempre.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-113

const require = createRequire(import.meta.url);

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

const LINEAS = [{ concept: 'Alicatado', qty: 1, price: 100 }];
const NIVELES = [{ id: 'good', lines: LINEAS }, { id: 'better', lines: LINEAS }, { id: 'best', lines: LINEAS }];

/** Lo que hay DE VERDAD en la columna: por Prisma un NULL de SQL y el JSON `null` se leen igual. */
async function enLaBase(prisma, id) {
  const [fila] = await prisma.$queryRaw`
    SELECT tiers IS NULL AS vacia, jsonb_typeof(tiers) AS tipo, payment_terms AS cobro
    FROM quote_templates WHERE id = ${id}`;
  assert.ok(fila, `🔴 CIEGO: la plantilla ${id} no está en la base`);
  return fila;
}

/** Un negocio con su administradora y la app escuchando. `fn` recibe cómo pedir y el cliente de Prisma. */
async function conPanel(marca, fn) {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');
  await withMerchant(prisma, { name: `QA SCRUM-1188d ${marca}`, email: `qa-1188d-${marca}-${Date.now()}@test.local` }, async (merchant) => {
    const jefa = await prisma.teamMember.create({
      data: { merchantId: merchant.id, name: 'Jefa', email: `qa-1188d-${marca}-jefa-${Date.now()}@test.local`, role: 'admin', status: 'active' },
    });
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.authSession.create({
      data: { merchantId: merchant.id, teamMemberId: jefa.id, token, type: 'session', expiresAt: new Date(Date.now() + 3600e3) },
    });
    const server = http.createServer(app).listen(0);
    await new Promise((r) => server.once('listening', r));
    const pedir = async (metodo, ruta, cuerpo) => {
      const r = await fetch(`http://127.0.0.1:${server.address().port}${ruta}`, {
        method: metodo,
        headers: { cookie: `pf_session=${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      return { status: r.status, cuerpo: await r.json().catch(() => null) };
    };
    try {
      await fn({ pedir, prisma, merchant });
    } finally {
      await new Promise((r) => server.close(r));
      await prisma.quoteTemplate.deleteMany({ where: { merchantId: merchant.id } });
    }
  });
}

/** Crea una plantilla por la ruta y devuelve su id; si la ruta no la crea, el caso es ciego y lo dice. */
async function alta(pedir, cuerpo) {
  const r = await pedir('POST', '/admin/templates', { name: 'Reforma de baño', lines: LINEAS, ...cuerpo });
  assert.equal(r.status, 201, `🔴 CIEGO: el POST responde ${r.status} (${JSON.stringify(r.cuerpo)}), no hay plantilla que medir`);
  return r.cuerpo.id;
}

test('SCRUM-1188d · SUELO: la relectura por SQL DISTINGUE el JSON `null` del NULL de SQL (si no, lo de abajo no mide nada)', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  const { Prisma } = require('@prisma/client');
  await conPanel('suelo', async ({ prisma, merchant }) => {
    const base = { merchantId: merchant.id, name: 'P', currency: 'EUR', lines: LINEAS };
    const conJsonNull = await prisma.quoteTemplate.create({ data: { ...base, tiers: Prisma.JsonNull } });
    const conNullDeJs = await prisma.quoteTemplate.create({ data: { ...base, tiers: null } });
    const conDbNull = await prisma.quoteTemplate.create({ data: { ...base, tiers: Prisma.DbNull } });

    assert.deepEqual(await enLaBase(prisma, conJsonNull.id), { vacia: false, tipo: 'null', cobro: null });
    assert.deepEqual(await enLaBase(prisma, conDbNull.id), { vacia: true, tipo: null, cobro: null });
    // La medición que sostiene el arreglo. Si un Prisma futuro hace que el `null` de JS vacíe la
    // columna, ESTE aserto cae y `jsonAnulable` sobra: se decide entonces, con el dato delante.
    assert.deepEqual(await enLaBase(prisma, conNullDeJs.id), { vacia: false, tipo: 'null', cobro: null },
      '🔴 el `null` de JS ya no guarda el JSON `null` en un `Json?`: la premisa de SCRUM-1188d ha cambiado.');
    // Y por Prisma los tres se leen igual: por eso no se veía.
    for (const p of [conJsonNull, conNullDeJs, conDbNull]) {
      const leida = await prisma.quoteTemplate.findUnique({ where: { id: p.id }, select: { tiers: true } });
      assert.equal(leida.tiers, null);
    }
  });
});

test('SCRUM-1188d · 🔴 el POST sin niveles deja la columna VACÍA (NULL de SQL), no el JSON `null`', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  await conPanel('post', async ({ pedir, prisma }) => {
    const sinClave = await alta(pedir, {});
    assert.deepEqual(await enLaBase(prisma, sinClave), { vacia: true, tipo: null, cobro: null },
      '🔴 una plantilla SIN niveles tiene algo guardado en `tiers`: un `IS NOT NULL` diría que los tiene.');

    const conNull = await alta(pedir, { tiers: null, paymentTerms: null });
    assert.deepEqual(await enLaBase(prisma, conNull), { vacia: true, tipo: null, cobro: null });

    // Y los niveles que SÍ viajan se siguen guardando.
    const conNiveles = await alta(pedir, { tiers: NIVELES, paymentTerms: 'FIFTY_FIFTY' });
    assert.deepEqual(await enLaBase(prisma, conNiveles), { vacia: false, tipo: 'array', cobro: 'FIFTY_FIFTY' });
  });
});

test('SCRUM-1188d · 🔴 el PUT con `tiers: null` VACÍA los niveles; sin la clave no los toca', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  await conPanel('put', async ({ pedir, prisma }) => {
    const id = await alta(pedir, { tiers: NIVELES, paymentTerms: 'FIFTY_FIFTY' });
    assert.deepEqual(await enLaBase(prisma, id), { vacia: false, tipo: 'array', cobro: 'FIFTY_FIFTY' });

    // Renombrar, el único cuerpo que el panel manda hoy: ni los niveles ni el cobro cambian.
    const renombrar = await pedir('PUT', `/admin/templates/${id}`, { name: 'Baño completo' });
    assert.equal(renombrar.status, 200);
    assert.deepEqual(await enLaBase(prisma, id), { vacia: false, tipo: 'array', cobro: 'FIFTY_FIFTY' },
      '🔴 un cuerpo SIN las claves ha tocado los niveles o el cobro: renombrar una plantilla los borraría.');

    // La clave nula vacía SU columna, y solo la suya.
    const vaciar = await pedir('PUT', `/admin/templates/${id}`, { tiers: null });
    assert.equal(vaciar.status, 200, `🔴 el PUT con \`tiers: null\` responde ${vaciar.status}`);
    assert.deepEqual(await enLaBase(prisma, id), { vacia: true, tipo: null, cobro: 'FIFTY_FIFTY' },
      '🔴 `tiers: null` no ha dejado la columna en NULL de SQL: o se ignoró, o se guardó el JSON `null`.');
    assert.equal(vaciar.cuerpo.tiers, null);

    // Y se pueden volver a poner.
    const reponer = await pedir('PUT', `/admin/templates/${id}`, { tiers: NIVELES });
    assert.equal(reponer.status, 200);
    assert.deepEqual(await enLaBase(prisma, id), { vacia: false, tipo: 'array', cobro: 'FIFTY_FIFTY' });
  });
});

// ── La mitad SIN base: corre en todo `npm test` ─────────────────────────────────────────────

test('SCRUM-1188d · `jsonAnulable` traduce SOLO el `null`: lo demás pasa tal cual, y `undefined` sigue siendo «no toques»', () => {
  const { Prisma } = require('@prisma/client');
  const { jsonAnulable } = require('../dist/core/db/jsonAnulable.js');
  assert.equal(jsonAnulable(null), Prisma.DbNull);
  assert.notEqual(Prisma.DbNull, Prisma.JsonNull, '🔴 CIEGO: los dos nulls de Prisma son el mismo objeto');
  assert.equal(jsonAnulable(undefined), undefined);
  assert.deepEqual(jsonAnulable(NIVELES), NIVELES);
  // Valores «falsos» que NO son vacío: un `[]` o un `0` guardados son un dato, no un NULL.
  assert.deepEqual(jsonAnulable([]), []);
  assert.equal(jsonAnulable(0), 0);
  assert.equal(jsonAnulable(''), '');
  assert.equal(jsonAnulable(false), false);
});
