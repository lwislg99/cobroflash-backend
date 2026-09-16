// tests/scrum767-cura-concurrencia.test.mjs — SCRUM-767
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA CURA DE `portalToken`, CONTRA POSTGRES DE DESARROLLO
//
// Vive APARTE de `scrum767-portal-token.test.mjs` —que lleva los censos por AST— y no es una
// preferencia de orden: está MEDIDO. Con los dos en el mismo fichero, `--test-force-exit` (que
// es como corre `npm test`) CANCELABA los cuatro gateados con «Promise resolution is still
// pending but the event loop has already resolved», y sin esa bandera pasaban los nueve.
// Separados, los dos ficheros pasan con la bandera puesta.
//
// Es el mismo reparto que ya tenía SCRUM-592 —`scrum592-numeracion-doc02` (sin base) y
// `scrum592-concurrencia-serie` (gateado)—, y ahora queda escrito POR QUÉ.
//
// ── ✅ LA CARRERA YA ESTÁ ARREGLADA — SCRUM-793 ─────────────────────────────────────────
//
// Cuando nació este fichero, `ensurePortalToken` era un read-then-write sin transacción ni
// cerrojo: dos llamadas simultáneas sobre un cliente sin token escribían las dos y **ganaba la
// última**. Medido entonces: 4 de 5 pasadas con DOS a la vez, y hasta 9 de 10 tokens muertos con
// DIEZ. Aquí NO se asertaba, y se dijo por qué: *«una de las cinco pasadas no llegó a
// entrelazarse, y un test intermitente no es un guard — el determinista nace el día que se
// arregle»*.
//
// **Ese día fue SCRUM-793.** La condición vive ahora dentro del `WHERE` de la escritura, así que
// la invariante dejó de ser intermitente: mismo experimento, 4/5 → 0/5 y 3/3 → 0/3. El guard
// determinista vive en `scrum793-la-carrera-del-token.test.mjs`.
//
// ⚠️ ESTE FICHERO SE QUEDA COMO ESTÁ, y no es inercia: lo que afirma —idempotencia secuencial, la
// base termina con un token, el token final es uno de los entregados, y editar no lo mueve— era
// cierto ANTES y sigue siéndolo AHORA. Son las invariantes que el arreglo no podía romper, y por
// eso siguen valiendo como red: si un refactor futuro las tumbara, el problema sería otro.
//
// ⛔ SÓLO `yaqu_dev_javier`: se niega a arrancar si la clave apunta a otro sitio. Este fichero
//    ESCRIBE — crea merchants y clientes de usar y tirar, y los borra.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url'; // NUNCA `.pathname`: no decodifica

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const GATE = process.env.QA_DB_TEST === '1';

let prismaDev = null;
let cliente = null;
if (GATE) {
  const { PrismaClient } = await import(pathToFileURL(RAIZ + '/node_modules/@prisma/client/default.js').href);
  const { parseBDSegura } = await import(pathToFileURL(RAIZ + '/scripts/_db-guard.mjs').href);
  const linea = fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL_DEV='));
  const url = linea?.slice('DATABASE_URL_DEV='.length).trim().replace(/^["']|["']$/g, '');
  const info = url ? parseBDSegura(url) : null;
  assert.ok(info && info.base === 'yaqu_dev_javier',
    '🔴 PARO: este test ESCRIBE y la clave de desarrollo no apunta a `yaqu_dev_javier`.');
  prismaDev = new PrismaClient({ datasources: { db: { url } } });
  // 🔴 El doble va por `global.prisma` ANTES de importar el módulo: `customerAdmin` usa el
  // singleton de `core/db/prisma`, que resuelve `DATABASE_URL` — una variable que en este árbol
  // NO existe (sólo `_DEV`/`_STAGING`/`_TESTS`). Sin esto el import revienta al primer `create`
  // con «Environment variable not found: DATABASE_URL». Medido, no supuesto.
  globalThis.prisma = prismaDev;
  cliente = await import(pathToFileURL(RAIZ + '/dist/modules/system/customerAdmin.js').href);
}

/** Un merchant QA y un cliente creado COMO LO HACÍA EL SEMBRADOR: a pelo, y por tanto sin token. */
async function conClienteSinToken(fn) {
  const m = await prismaDev.merchant.create({
    data: {
      name: `QA-767-${process.pid}-${Date.now()}`,
      email: `qa-767-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`,
      country: 'ES',
    },
    select: { id: true },
  });
  const c = await prismaDev.customer.create({
    data: { merchantId: m.id, name: 'QA-767' }, select: { id: true, portalToken: true },
  });
  try { return await fn(m, c); } finally {
    await prismaDev.customer.deleteMany({ where: { merchantId: m.id } }).catch(() => {});
    await prismaDev.merchant.delete({ where: { id: m.id } }).catch(() => {});
  }
}
const tokenEnBase = (id) => prismaDev.customer
  .findUnique({ where: { id }, select: { portalToken: true } }).then((x) => x?.portalToken ?? null);

test('SCRUM-767 · SUELO: un cliente creado a pelo NACE sin token', { skip: !GATE && 'sin QA_DB_TEST=1 · necesita Postgres real: escribe clientes y provoca concurrencia' }, async () => {
  await conClienteSinToken(async (m, c) => {
    assert.equal(c.portalToken, null,
      '🔴 el cliente a pelo ya trae token: entonces no hay hueco que curar y todo lo de abajo '
      + 'estaría midiendo el caso equivocado.');
  });
});

test('SCRUM-767 · ✅ CONTROL POSITIVO: dos llamadas SEGUIDAS dan el MISMO token', { skip: !GATE && 'sin QA_DB_TEST=1 · necesita Postgres real: escribe clientes y provoca concurrencia' }, async () => {
  await conClienteSinToken(async (m, c) => {
    const a = await cliente.ensurePortalToken(m.id, c.id);
    const b = await cliente.ensurePortalToken(m.id, c.id);
    assert.equal(a, b, `🔴 la cura NO es idempotente ni en secuencial: ${a} ≠ ${b}`);
    assert.equal(await tokenEnBase(c.id), a, '🔴 lo devuelto no es lo que quedó en la base');
    assert.match(a, /^[0-9a-f]{32}$/, `🔴 el token no tiene la forma esperada: ${a}`);
  });
});

test('SCRUM-767 · la base termina con UN token, pase lo que pase con la carrera', { skip: !GATE && 'sin QA_DB_TEST=1 · necesita Postgres real: escribe clientes y provoca concurrencia' }, async () => {
  await conClienteSinToken(async (m, c) => {
    const ts = await Promise.all(Array.from({ length: 10 }, () => cliente.ensurePortalToken(m.id, c.id)));
    const final = await tokenEnBase(c.id);

    assert.ok(final, '🔴 tras diez curaciones el cliente sigue SIN token en la base');
    assert.equal(ts.length, 10, 'las diez llamadas devuelven algo: ninguna revienta');
    for (const t of ts) assert.match(t, /^[0-9a-f]{32}$/, `🔴 token con forma inesperada: ${t}`);

    // Lo que la carrera NO puede hacer: que el token de la base no sea uno de los entregados.
    assert.ok(ts.includes(final),
      '🔴 el token que quedó en la base no lo devolvió NINGUNA de las diez llamadas');
  });
});

test('SCRUM-767 · ✅ CONTROL NEGATIVO: editar el cliente NO mueve su token', { skip: !GATE && 'sin QA_DB_TEST=1 · necesita Postgres real: escribe clientes y provoca concurrencia' }, async () => {
  // Sin esto, «un solo token» no distingue «la cura es estable» de «mi doble no escribe nada».
  await conClienteSinToken(async (m, c) => {
    const t0 = await cliente.ensurePortalToken(m.id, c.id);
    await cliente.updateCustomer(m.id, c.id, { name: 'QA-767 renombrado' });
    assert.equal(await tokenEnBase(c.id), t0,
      '🔴 una edición del cliente ha movido su `portalToken`. El enlace que el profesional ya '
      + 'compartió con su cliente dejaría de funcionar sin que nadie lo tocara.');
  });
});

test.after(async () => { if (prismaDev) await prismaDev.$disconnect(); });
