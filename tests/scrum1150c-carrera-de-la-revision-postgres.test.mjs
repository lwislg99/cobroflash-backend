// SCRUM-1150c · DOS «CREAR REVISIÓN» A LA VEZ NO DEJAN DOS `.1` — la mitad con POSTGRES DE VERDAD.
//
// `tests/scrum1150c-dos-crear-revision-a-la-vez.test.mjs` corre en cada `npm test` con Prisma
// doblado, y un doble no es Postgres: no prueba que `pg_advisory_xact_lock` haga esperar de verdad
// a la segunda creación, ni que su lectura del grupo —lanzada después de conseguir el cerrojo, en
// READ COMMITTED— vea la revisión que acaba de confirmar la primera. Las dos cosas son del motor.
//
// GATEADO por `LIBRO_PG_URL`: un Postgres DESECHABLE (loopback, base terminada en `_test`). CI lo
// levanta solo. Crea un comercio de usar y tirar con `withMerchant`, que lo barre al terminar.
//
// Medido el 13-oct-2026 contra Postgres 16.4, con `main` (`9358f02b1`) y con el arreglo: el
// registro, en `docs/master/SCRUM-1150.md`.
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

// La primera clave del cerrojo, la de `src/modules/system/quoteAdmin.ts`. Va escrita aquí y no
// importada: allí no se exporta. Si allí cambia, el segundo caso cae diciendo que la creación no
// espera a ESTE cerrojo.
const REVISION_LOCK_NS = 1752;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

after(async () => {
  if (!CON_BASE) return;
  const { prisma } = await import('../dist/core/db/prisma.js');
  await prisma.$disconnect();
});

async function cargar() {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { crearRevisionDeQuote } = await import('../dist/modules/system/quoteAdmin.js');
  return { prisma, crearRevisionDeQuote };
}

const revisionesDe = async (prisma, merchantId, numero) => (await prisma.quote.findMany({
  where: { merchantId, quoteNumber: numero }, select: { revision: true }, orderBy: { revision: 'asc' },
})).map((q) => q.revision);

test('SCRUM-1150c · POSTGRES · 🔴 diez pares de «Crear revisión» A LA VEZ: ninguno deja dos filas con la misma revisión',
  { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
    const { prisma, crearRevisionDeQuote } = await cargar();
    await withMerchant(prisma, { name: 'QA SCRUM-1150c carrera', email: `qa-1150c-a-${Date.now()}@test.local` }, async (m) => {
      const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente QA 1150c' } });
      const sano = (n) => prisma.quote.create({
        data: { merchantId: m.id, customerId: cliente.id, total: '100', currency: 'EUR', status: 'sent', quoteNumber: n, revision: 0, lines: [{ concept: 'x', qty: 1, price: 100 }] },
      });
      try {
        const PARES = 10;
        const empates = [];
        for (let i = 0; i < PARES; i += 1) {
          const q = await sano(100 + i);
          const [a, b] = await Promise.all([crearRevisionDeQuote(m.id, q.id), crearRevisionDeQuote(m.id, q.id)]);
          const revs = await revisionesDe(prisma, m.id, 100 + i);
          assert.equal(revs.length, 3, `🔴 CIEGO: el par ${i + 1} no dejó dos revisiones (en la base: ${revs.join(',')})`);
          if (new Set(revs).size !== revs.length) empates.push(`par ${i + 1}: ${revs.join(',')} (contestaron .${a.revision} y .${b.revision})`);
        }
        assert.deepEqual(empates, [],
          `🔴 ${empates.length} DE ${PARES} PARES HAN DEJADO DOS FILAS CON LA MISMA REVISIÓN. Con eso la ficha de ese presupuesto contesta 500.`);
      } finally {
        await prisma.quote.deleteMany({ where: { merchantId: m.id } });
        await prisma.customer.deleteMany({ where: { merchantId: m.id } });
      }
    });
  });

test('SCRUM-1150c · POSTGRES · 🔴 «Crear revisión» ESPERA al cerrojo de su negocio, y lee el grupo DESPUÉS de conseguirlo',
  { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
    // Sin carrera y sin ventanas (el molde de SCRUM-1333): otro tiene el cerrojo, y se mira en
    // `pg_locks` que la creación lo está ESPERANDO. Mientras espera no ha escrito. Entonces el
    // titular deja su `.1` y suelta; la creación entra, relee, la ve, y escribe la `.2`.
    const { prisma, crearRevisionDeQuote } = await cargar();
    await withMerchant(prisma, { name: 'QA SCRUM-1150c espera', email: `qa-1150c-b-${Date.now()}@test.local` }, async (m) => {
      const cliente = await prisma.customer.create({ data: { merchantId: m.id, name: 'Cliente QA 1150c' } });
      const fila = { merchantId: m.id, customerId: cliente.id, total: '100', currency: 'EUR', status: 'sent', quoteNumber: 7, lines: [{ concept: 'x', qty: 1, price: 100 }] };
      try {
        const q = await prisma.quote.create({ data: { ...fila, revision: 0 } });

        let soltar; const puerta = new Promise((r) => { soltar = r; });
        let avisar; const cerrojoTomado = new Promise((r) => { avisar = r; });
        const titular = prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${REVISION_LOCK_NS}::int, ${m.id}::int)`;
          avisar();
          await puerta;
          await tx.quote.create({ data: { ...fila, revision: 1, total: '250' } });
        }, { timeout: 30_000, maxWait: 10_000 });
        titular.catch(() => {}); // su error, si lo hay, se lee abajo con `await`
        let creacion;
        try {
          await cerrojoTomado;
          creacion = crearRevisionDeQuote(m.id, q.id);
          creacion.catch(() => {}); // idem

          let esperando = 0;
          for (let i = 0; i < 60 && esperando === 0; i += 1) {
            const filas = await prisma.$queryRaw`
              SELECT count(*)::int AS n FROM pg_locks
              WHERE locktype = 'advisory' AND classid::bigint = ${REVISION_LOCK_NS}::bigint
                AND objid::bigint = ${m.id}::bigint AND NOT granted`;
            esperando = Number(filas[0].n);
            if (esperando === 0) await esperar(50);
          }
          assert.equal(esperando, 1,
            '🔴 «CREAR REVISIÓN» NO ESPERA AL CERROJO DE SU NEGOCIO: en 3 s no ha aparecido en `pg_locks` como pendiente de '
            + `(${REVISION_LOCK_NS}, ${m.id}). Leer el máximo y escribir no van bajo ese cerrojo.`);
          assert.deepEqual(await revisionesDe(prisma, m.id, 7), [0], '🔴 la creación ha escrito SIN tener el cerrojo');
        } finally {
          soltar();
          await titular.catch(() => {});
        }
        await titular; // si el titular falló, que se vea

        const creada = await creacion;
        assert.equal(creada.revision, 2,
          `🔴 la creación que esperó ha escrito la .${creada.revision}: no ha visto la .1 que dejó el titular. Su lectura es anterior al cerrojo.`);
        assert.deepEqual(await revisionesDe(prisma, m.id, 7), [0, 1, 2]);
        const heredada = await prisma.quote.findUnique({ where: { id: creada.id }, select: { total: true } });
        assert.equal(Number(heredada.total), 250, '🔴 la .2 no hereda de la .1 que dejó el titular, que ya era la vigente');
      } finally {
        await prisma.quote.deleteMany({ where: { merchantId: m.id } });
        await prisma.customer.deleteMany({ where: { merchantId: m.id } });
      }
    });
  });
