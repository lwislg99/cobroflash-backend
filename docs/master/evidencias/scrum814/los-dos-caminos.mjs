// SCRUM-814 · LAS DOS PREGUNTAS QUE DECIDEN EL ARREGLO, medidas CORRIENDO.
//
//   DATABASE_URL=<banco desechable en loopback, base *_test>  \
//     node docs/master/evidencias/scrum814/los-dos-caminos.mjs
//
//   A) ¿Aguanta una restricción única en la base sobre (quoteId, tramo)?
//   B) ¿Un recuento DENTRO de la transacción, bajo el `pg_advisory_xact_lock` que ya existe,
//      vería las facturas de la otra petición?
//
// ⛔ Ninguna cadena de conexión aquí: la URL se lee del entorno y se valida con `parseBDSegura`.
// ⛔ No toca `prisma/schema.prisma`. El índice de la parte A se crea y se TIRA en un banco
//    desechable — es una medición, no una migración.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = process.argv[2] ?? path.resolve(AQUI, '..', '..', '..', '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';

const { parseBDSegura } = await import(pathToFileURL(path.join(RAIZ, 'scripts', '_db-guard.mjs')).href);
const destino = parseBDSegura(process.env.DATABASE_URL);
if (!destino || !['127.0.0.1', 'localhost', '::1'].includes(destino.host) || !/_test$/.test(destino.base)) {
  console.error('🔴 DESTINO NO PERMITIDO. Sólo loopback y sólo una base terminada en `_test`.');
  process.exit(3);
}
console.log('banco → host=' + destino.host + ' puerto=' + destino.puerto + ' base=' + destino.base);
console.log('');

const { prisma } = await import(DIST + 'core/db/prisma.js');
const { SERIE_LOCK_NS } = await import(DIST + 'modules/invoicing/domain/invoiceNumber.service.js');
console.log('cerrojo real del proyecto · SERIE_LOCK_NS = ' + SERIE_LOCK_NS + ' (SCRUM-728)');
console.log('');

const SUF = String(Date.now()).slice(-6);
const merchant = await prisma.merchant.create({
  data: { name: 'Tecnosel', taxId: 'B12345678', country: 'ES', email: 'm+' + SUF + '@t.test' },
});
const cliente = await prisma.customer.create({ data: { merchantId: merchant.id, name: 'Pepe' } });
const quote = await prisma.quote.create({
  data: { merchantId: merchant.id, customerId: cliente.id, status: 'accepted',
    total: '1210.00', currency: 'EUR', lines: [] },
});

let n = 0;
const meterFactura = (stageLabel, tx = prisma) => tx.invoice.create({
  data: {
    merchantId: merchant.id, customerId: cliente.id, quoteId: quote.id,
    number: 'T-' + SUF + '-' + (n += 1), total: '363.00', currency: 'EUR',
    pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR', stageLabel,
  },
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// A · LA RESTRICCIÓN ÚNICA SOBRE ("quoteId", stage_label)
//
// Ojo al nombre de las columnas: `quoteId` NO lleva `@map`, así que en la base se llama `quoteId`
// con mayúscula y hay que entrecomillarla; `stageLabel` sí lleva `@map("stage_label")`.
//
// 🔴 La pregunta no es «¿se puede crear?», es «¿PROTEGE?». Y hay dos casos, porque los tres
// caminos de emisión escriben `stageLabel` SÓLO en planes custom:
//     `stageLabel: isCustomPlan ? stage.label : null`
// En un plan preset la columna se queda a NULL — y en Postgres dos NULL NO chocan en un índice
// único. Eso decide si el camino A vale tal cual o necesita columna nueva.
// ═══════════════════════════════════════════════════════════════════════════════════════════
console.log('═══ A · restricción única ("quoteId", stage_label) ═══');

// ── A.0 · CUÁNTAS FILAS LA VIOLARÍAN HOY — **contado ANTES de proponer crearla** ──────────────
// Es el orden que usó Javier con el índice del parte: crear primero y ver si falla no es medir,
// es apostar. Y ésta es EXACTAMENTE la consulta que hay que correr en las tres bases.
const SQL_VIOLACIONES =
  'SELECT "quoteId", stage_label, count(*) AS filas '
  + 'FROM invoices WHERE "quoteId" IS NOT NULL '
  + 'GROUP BY "quoteId", stage_label HAVING count(*) > 1 ORDER BY filas DESC';
const violaciones = await prisma.$queryRawUnsafe(SQL_VIOLACIONES);
console.log('   A.0 · grupos que YA violarían la restricción en esta base: ' + violaciones.length);
for (const v of violaciones.slice(0, 5)) {
  console.log('        quoteId=' + v.quoteId + ' stage_label=' + JSON.stringify(v.stage_label)
    + ' → ' + Number(v.filas) + ' facturas');
}
if (violaciones.length) {
  console.log('        🔴 con estas filas dentro, `CREATE UNIQUE INDEX` FALLA. No es un detalle de');
  console.log('        este banco: son las facturas que dejó la carrera, y en producción serían');
  console.log('        facturas EMITIDAS que la regla 29 no deja borrar.');
}
console.log('');

// ── A.1 · ¿PROTEGE? Índice PARCIAL, sólo sobre el presupuesto recién creado ───────────────────
// Parcial a propósito: así se mide la semántica sin depender de que el resto de la tabla esté
// limpia, y sin tocar ni una fila ajena. La pregunta no es «¿se puede crear?»: es «¿protege?».
await prisma.$executeRawUnsafe(
  'CREATE UNIQUE INDEX medicion_814 ON invoices ("quoteId", stage_label) WHERE "quoteId" = ' + quote.id);
console.log('   A.1 · índice único creado (parcial, sólo sobre el presupuesto ' + quote.id + ').');

console.log('        caso 1 · plan CUSTOM — dos facturas con la MISMA etiqueta «Anticipo»:');
await meterFactura('Anticipo');
let caso1;
try { await meterFactura('Anticipo'); caso1 = '🔴 ENTRA — el índice NO la para'; }
catch (e) { caso1 = 'RECHAZADA (' + (e.code ?? e.name) + ') ✔ el índice la para'; }
console.log('            → ' + caso1);

console.log('        caso 2 · plan PRESET — dos facturas con stage_label NULL:');
await meterFactura(null);
let caso2;
try { await meterFactura(null); caso2 = '🔴 ENTRA — el índice NO la para: en Postgres dos NULL no chocan'; }
catch (e) { caso2 = 'RECHAZADA (' + (e.code ?? e.name) + ')'; }
console.log('            → ' + caso2);

await prisma.$executeRawUnsafe('DROP INDEX medicion_814');
console.log('   índice retirado (era una medición, no una migración).');
console.log('');

// ═══════════════════════════════════════════════════════════════════════════════════════════
// B · ¿EL RECUENTO DENTRO DE LA TRANSACCIÓN, BAJO EL CERROJO, VE LO DE LA OTRA?
//
// Dos transacciones interactivas de verdad, cada una en su conexión. Las dos toman el MISMO
// `pg_advisory_xact_lock` que toma `allocateInvoiceNumber`, con el merchant real.
// ═══════════════════════════════════════════════════════════════════════════════════════════
console.log('═══ B · recuento dentro de la transacción, con el cerrojo tomado ═══');
const quote2 = await prisma.quote.create({
  data: { merchantId: merchant.id, customerId: cliente.id, status: 'accepted',
    total: '1210.00', currency: 'EUR', lines: [] },
});
const meterEn = (tx, etiqueta) => tx.invoice.create({
  data: {
    merchantId: merchant.id, customerId: cliente.id, quoteId: quote2.id,
    number: 'B-' + SUF + '-' + (n += 1), total: '363.00', currency: 'EUR',
    pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR', stageLabel: etiqueta,
  },
});
const traza = [];
const A = prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SERIE_LOCK_NS}::int, ${merchant.id}::int)`;
  traza.push('A · cerrojo tomado');
  await meterEn(tx, 'Anticipo');
  traza.push('A · factura insertada (aún SIN commit)');
  await new Promise((r) => setTimeout(r, 700));   // B está esperando el cerrojo aquí
  traza.push('A · commit');
}, { timeout: 15_000 });

const B = (async () => {
  await new Promise((r) => setTimeout(r, 150));   // que A tome el cerrojo primero
  return prisma.$transaction(async (tx) => {
    traza.push('B · pide el cerrojo…');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SERIE_LOCK_NS}::int, ${merchant.id}::int)`;
    traza.push('B · cerrojo tomado (A ya ha hecho commit)');
    const cuantas = await tx.invoice.count({ where: { quoteId: quote2.id } });
    traza.push('B · cuenta DENTRO de la transacción: ' + cuantas);
    return cuantas;
  }, { timeout: 15_000 });
})();

const [, vistas] = await Promise.all([A, B]);
for (const t of traza) console.log('   ' + t);
console.log('');
console.log('   VEREDICTO B: ' + (vistas >= 1
  ? '✔ SÍ la ve (' + vistas + '). El nivel es READ COMMITTED —cada sentencia toma su propia '
    + 'instantánea— y el `count` se ejecuta DESPUÉS de esperar el cerrojo, o sea después del '
    + 'commit de A. Recontar ahí dentro SÍ decide bien.'
  : '🔴 NO la ve (' + vistas + '). El recuento dentro de la transacción no serviría.'));

await prisma.$disconnect();
