// tests/scrum592-concurrencia-serie.test.mjs — SCRUM-592 (DOC-02)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 DOS PRESUPUESTOS CREADOS A LA VEZ NO PUEDEN COGER EL MISMO NÚMERO
//
// Es el único test de este ticket que NO se puede escribir sin base de datos, y por eso está
// aparte y gateado: el mecanismo que lo garantiza es `pg_advisory_xact_lock`, que es de Postgres.
// Un contador probado de uno en uno no ha probado nada — la carrera sólo existe en paralelo.
//
// ── POR QUÉ HACE FALTA, SI EL `increment` YA ERA ATÓMICO ────────────────────────────────
//
// Lo era, y bastaba mientras el contador sólo subía. La SERIE ANUAL lo rompe: con reinicio hay
// que LEER el año y DECIDIR si el siguiente es `nextQuoteNumber` o `1`. Eso es un read-then-write
// y en READ COMMITTED **no serializa**: dos creaciones simultáneas del primer presupuesto del año
// leen las dos «serie vacía» y escriben las dos el 1.
//
// `allocateAlbaranNumber` ya lo dejó escrito al cerrar SCRUM-234: «también tiene reinicio anual,
// así que también va con cerrojo y no con `{ increment: 1 }`».
//
// ── EL GATE, Y POR QUÉ DECLARA SU MOTIVO ────────────────────────────────────────────────
//
// Sin `QA_DB_TEST=1` esto SE SALTA, y el salto dice por qué (SCRUM-419/456): un `# SKIP` mudo es
// cobertura que nadie sabe que falta. Se corre con `npm run test:staging:gated`.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { withMerchant } from './_merchant-fixture.mjs';

const ENABLED = process.env.QA_DB_TEST === '1';

const RAIZ = process.cwd();
let prisma = null;
let Q = null;

if (ENABLED) {
  const { PrismaClient } = await import(pathToFileURL(RAIZ + '/node_modules/@prisma/client/default.js').href);
  const { parseBDSegura } = await import(pathToFileURL(RAIZ + '/scripts/_db-guard.mjs').href);
  Q = await import('../dist/modules/quotes/domain/quoteNumber.service.js');
  // 🔴 SÓLO DESARROLLO. Este test ESCRIBE (crea un merchant de prueba y mueve su contador), así
  // que se niega a arrancar contra cualquier otra base en vez de fiarse de quién lo lance.
  const linea = fs.readFileSync('.env', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL_DEV='));
  const url = linea?.slice('DATABASE_URL_DEV='.length).trim().replace(/^["']|["']$/g, '');
  const info = url ? parseBDSegura(url) : null;
  assert.ok(info && info.base === 'yaqu_dev_javier',
    '🔴 PARO: este test escribe y la clave de desarrollo no apunta a `yaqu_dev_javier`.');
  prisma = new PrismaClient({ datasources: { db: { url } } });
}

/**
 * Un merchant de usar y tirar, con `withMerchant` (SCRUM-113) y no a mano.
 *
 * No es formalismo: ese fixture registra el borrado ANTES de que corra nada, así que la fila se
 * limpia aunque el cuerpo reviente en su primera línea. Un `create` a mano con `finally` deja
 * basura en cuanto el fallo ocurre antes del `try` — y aquí se crean merchants en cada caso.
 */
async function conMerchant(fn) {
  return withMerchant(prisma, {
    name: `QA-592-${process.pid}-${Date.now()}`,
    email: `qa-592-${process.pid}-${Date.now()}@test.local`,
    nextQuoteNumber: 1,
    quoteSeriesYear: null,
  }, fn);
}

test('SCRUM-592 · 🔴 DOS reservas SIMULTÁNEAS no cogen el mismo número', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated (necesita Postgres real: el cerrojo que se prueba es pg_advisory_xact_lock)' }, async () => {
  await conMerchant(async (m) => {
    // El caso peor a propósito: serie SIN ESTRENAR. Ahí las dos transacciones leen «no hay año»
    // y, sin cerrojo, las dos concluyen que les toca el 1.
    const reservar = () => prisma.$transaction((tx) => Q.allocateQuoteNumber(tx, m.id, new Date('2026-06-01')));
    const [a, b] = await Promise.all([reservar(), reservar()]);

    assert.notEqual(a.numero, b.numero,
      `🔴 LAS DOS RESERVAS HAN COGIDO ${a.numero}. Dos presupuestos con el mismo número son dos `
      + 'documentos que el profesional no puede distinguir, y `Quote` no tiene `@@unique` que lo '
      + 'impida: el cerrojo ES la garantía.');
    assert.deepEqual([a.seq, b.seq].sort((x, y) => x - y), [1, 2],
      `🔴 la serie no es correlativa: han salido ${a.seq} y ${b.seq}. Ni duplicar ni SALTAR.`);
  });
});

test('SCRUM-592 · 🔴 y con DIEZ a la vez tampoco: ni un duplicado ni un salto', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated (necesita Postgres real: el cerrojo que se prueba es pg_advisory_xact_lock)' }, async () => {
  // Dos podrían pasar por suerte. Diez, no.
  //
  // 🔴 EL `timeout` NO ES PARA QUE PASE: ES PARA QUE MIDA LO QUE DICE. Con el de Prisma por
  // defecto (5.000 ms) esto fallaba, y **no por una carrera**: el cerrojo SERIALIZA, así que diez
  // transacciones esperan en fila y la décima acumula diez veces la latencia. Contra la base
  // remota de desarrollo eso son ~5.200 ms y Prisma cierra la transacción — medido.
  //
  // Dejarlo en 5.000 habría dado un rojo que dice «duplicado» cuando lo que hay es «lento»: un
  // test que acierta el veredicto y miente en el diagnóstico. Con el margen, lo que se mide es lo
  // que el título promete. **La lentitud queda REPORTADA como hallazgo, no escondida aquí.**
  await conMerchant(async (m) => {
    const reservas = await Promise.all(Array.from({ length: 10 }, () =>
      prisma.$transaction((tx) => Q.allocateQuoteNumber(tx, m.id, new Date('2026-06-01')),
        { timeout: 30_000 })));
    const seqs = reservas.map((r) => r.seq).sort((a, b) => a - b);
    assert.deepEqual(seqs, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      `🔴 diez reservas simultáneas han dado ${JSON.stringify(seqs)}. Un duplicado o un salto ahí `
      + 'es un documento que no se puede identificar.');
    assert.equal(new Set(reservas.map((r) => r.numero)).size, 10, '🔴 hay números repetidos');
  });
});

test('SCRUM-592 · el reinicio anual, CONTRA LA BASE y con la fecha fijada', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated (necesita Postgres real: el cerrojo que se prueba es pg_advisory_xact_lock)' }, async () => {
  await conMerchant(async (m) => {
    const a = await prisma.$transaction((tx) => Q.allocateQuoteNumber(tx, m.id, new Date('2026-12-31')));
    const b = await prisma.$transaction((tx) => Q.allocateQuoteNumber(tx, m.id, new Date('2027-01-01')));
    assert.equal(a.numero, 'P260001');
    assert.equal(b.numero, 'P270001',
      `🔴 el primero de 2027 ha salido ${b.numero}: la serie no se ha reiniciado en la base.`);
    const fin = await prisma.merchant.findUnique({
      where: { id: m.id }, select: { nextQuoteNumber: true, quoteSeriesYear: true },
    });
    assert.deepEqual(fin, { nextQuoteNumber: 2, quoteSeriesYear: 2027 },
      '🔴 el contador no ha quedado en la serie de 2027');
  });
});

test('SCRUM-592 · 🔴 CONTROL NEGATIVO: crear un CLIENTE no mueve ningún contador', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated (necesita Postgres real: el cerrojo que se prueba es pg_advisory_xact_lock)' }, async () => {
  await conMerchant(async (m) => {
    const antes = await prisma.merchant.findUnique({
      where: { id: m.id }, select: { nextQuoteNumber: true, quoteSeriesYear: true, nextAlbaranNumber: true },
    });
    const c = await prisma.customer.create({
      data: { merchantId: m.id, name: `QA-592-cliente-${Date.now()}` }, select: { id: true },
    });
    const despues = await prisma.merchant.findUnique({
      where: { id: m.id }, select: { nextQuoteNumber: true, quoteSeriesYear: true, nextAlbaranNumber: true },
    });
    await prisma.customer.delete({ where: { id: c.id } }).catch(() => {});
    assert.deepEqual(despues, antes,
      '🔴 dar de alta un cliente ha movido un contador de serie. Un número que se consume sin '
      + 'emitir documento es un HUECO en la serie, y un hueco no se puede explicar a nadie.');
  });
});

test.after(async () => { if (prisma) await prisma.$disconnect(); });
