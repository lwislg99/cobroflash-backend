// tests/scrum308-caracterizacion-rectify.test.mjs — SCRUM-308
//
// ⚠️ TESTS DE CARACTERIZACIÓN: describen lo que POST /admin/invoices/:id/rectify hace HOY, NO lo que
// debería hacer. Ninguno es un juicio: fijan el presente para que un cambio futuro se vea. En
// particular, el caso `annulled` (una R1 sobre una factura ANULADA) HOY SE EMITE — está EN DISCUSIÓN
// (SCRUM-308: bloquearlo por asimetría de coste), NO bendecido. No se toca `/rectify` (regla 38).
//
// POR QUÉ HACÍA FALTA (medido en SCRUM-308): 0 tests demostraban que /rectify FUNCIONA sobre pending
// o paid, 0 rectificaban una anulada, y el único test de la ruta (scrum263) asserta un 409 sin líneas.
// Una ruta de emisión fiscal, con huella encadenada detrás, sin un solo test que diga qué hace.
//
// CÓMO SE EJERCITA (patrón de SCRUM-263): se importa el router REAL del `dist`, se localiza su capa
// por método+ruta y se invoca el handler real con un `res` de doble y `prisma` SUSTITUIDO (mutando el
// objeto exportado, que es al que apuntan los `const { prisma }` ya cargados). Sin BD, sin turno.
//   LÍMITE DEL DOBLE (reportado al fundador): esto PRESENTA una factura con `status:'annulled'`; NO la
//   CONDUCE a anulada por la ruta /annul contra una BD real. Esa segunda cosa —la secuencia real
//   anular→rectificar— necesita gateado (turno de staging), y es otra conversación.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIST = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')).href + '/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const RUTA = 'modules/system/app/routes/invoicesAdmin.routes.js';

const routerDe = (mod) => mod.default?.default ?? mod.default;

/** Invoca el handler de negocio (el último de la capa) de una ruta real y devuelve lo que respondió. */
async function invocar(rutaModulo, metodo, ruta, req) {
  const router = routerDe(await import(DIST + rutaModulo));
  assert.ok(Array.isArray(router?.stack),
    `🔴 no se pudo leer el router de ${rutaModulo}: sin su stack no se invoca nada (SUELO)`);
  const capa = router.stack.find((l) => l.route?.path === ruta && l.route?.methods?.[metodo]);
  assert.ok(capa,
    `🔴 no existe ${metodo.toUpperCase()} ${ruta} en ${rutaModulo}. Si se renombró, este test dejaría ` +
    'de comprobar nada y pasaría en verde: por eso FALLA aquí (SUELO).');
  let salida = null;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    send(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    setHeader() { return this; }, type() { return this; },
  };
  const handlers = capa.route.stack;
  await handlers[handlers.length - 1].handle(req, res, () => {});
  return salida;
}

// Merchant NO-ES a propósito: getEmissionMode(country≠ES)='fiscal' → la R1 EMITE sin depender del flag
// INVOICING_ES_ENABLED ni entrar en la cadena VeriFactu (sellarTrasEmision → NO_APLICA). Así el doble
// es mínimo y el test caracteriza el ESTADO de la factura, no el modo de emisión.
const MERCHANT = {
  id: 1, name: 'QA', country: 'FR', taxId: null, flags: {},
  invoiceSeriesPrefix: 'CF', invoiceSeriesYear: 2026, nextInvoiceNumber: 5, nextRectInvoiceNumber: 3,
};

/** Una factura ORIGINAL válida para rectificar, con el `status` que se quiera caracterizar. */
const original = (status, over = {}) => ({
  id: 11, merchantId: 7, customerId: 2, type: 'F1', number: '2026-CF-0007',
  total: '100.00', currency: 'EUR', quoteId: null, vfHash: null, status,
  lines: [{ concept: 'Reparación', qty: 1, price: 100, tax: 0.21 }],
  merchant: MERCHANT, ...over,
});

// Guarda de las propiedades reales de prisma para restaurarlas: no ensuciar a otros tests del proceso.
const ORIG = {};
function sustituirPrisma(orig) {
  for (const k of ['invoice', '$transaction', 'customerEvent', 'auditLog', 'merchant']) ORIG[k] = moduloPrisma.prisma[k];
  const tx = {
    $executeRaw: async () => [],
    $executeRawUnsafe: async () => [],
    merchant: { findUnique: async () => MERCHANT, update: async () => ({}) },
    invoice: { create: async ({ data }) => ({ id: 99, ...data }) },
    // allocateInvoiceNumber AUDITA la reserva del número dentro de la MISMA tx (SCRUM-207): sin esto,
    // el doble de la transacción no tiene `auditLog` y el handler cae a 500 — un doble incompleto
    // mentiría sobre lo que hace /rectify. Se completa para alcanzar el 201 REAL del handler.
    auditLog: { create: async () => ({}) },
    customerEvent: { create: async () => ({}) },
  };
  moduloPrisma.prisma.invoice = {
    // 1ª findFirst (where sin rectifiesId) = la original; 2ª (where.rectifiesId) = ¿ya rectificada? → null
    findFirst: async (args) => (args?.where?.rectifiesId !== undefined ? null : orig),
    update: async () => ({}), // sellarTrasEmision
  };
  moduloPrisma.prisma.$transaction = async (cb) => cb(tx);
  moduloPrisma.prisma.customerEvent = { create: async () => ({}) };
  moduloPrisma.prisma.auditLog = { create: async () => ({}) };
  moduloPrisma.prisma.merchant = { findUnique: async () => MERCHANT, update: async () => ({}) };
}
function restaurarPrisma() { for (const k of Object.keys(ORIG)) moduloPrisma.prisma[k] = ORIG[k]; }

const rectify = (id = '11') =>
  invocar(RUTA, 'post', '/:id/rectify', { params: { id }, body: {}, merchantId: 7, teamMemberId: null, query: {}, headers: {} });

// ─── 1. LOS DE ÉXITO (los que faltaban): R1 sobre pending y sobre paid FUNCIONA ──────────────────
test('SCRUM-308 · caracterización · R1 sobre una factura PENDING → HOY emite (201)', async (t) => {
  t.after(restaurarPrisma);
  sustituirPrisma(original('pending'));
  const r = await rectify();
  assert.equal(r.code, 201, `esperaba 201 (R1 emitida) y fue ${r.code}: ${JSON.stringify(r.body)}`);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.rectifies.id, 11, 'la R1 referencia a la original');
});

test('SCRUM-308 · caracterización · R1 sobre una factura PAID → HOY emite (201)', async (t) => {
  t.after(restaurarPrisma);
  sustituirPrisma(original('paid'));
  const r = await rectify();
  assert.equal(r.code, 201, `esperaba 201 (R1 emitida) y fue ${r.code}: ${JSON.stringify(r.body)}`);
  assert.equal(r.body.ok, true);
});

// ─── 2. EL CASO QUE NADIE ESCRIBIÓ: R1 sobre una factura ANULADA ─────────────────────────────────
test('SCRUM-308 · R1 sobre una factura ANNULLED → 409 (el bloqueo, ya decidido)', async (t) => {
  // ✅ LA EXPECTATIVA CAMBIÓ, Y ESO ES EL MECANISMO FUNCIONANDO.
  //
  // Este test nació diciendo «HOY se emite (201), y NO está bendecido», con el encargo escrito de
  // que cambiaría cuando se decidiera el bloqueo. Se decidió, se implementó, y aquí está el
  // cambio: rectificar una anulada responde 409 NOMBRADO y no emite nada.
  //
  // Se conserva el test —no se borra— porque su valor es justo éste: **que el día que alguien
  // reabra la puerta, el rojo salga aquí**, en el fichero que caracteriza la ruta, y no solo en el
  // del bloqueo. Un caso caracterizado que desaparece al arreglarse deja de vigilar el arreglo.
  t.after(restaurarPrisma);
  sustituirPrisma(original('annulled'));
  const r = await rectify();
  assert.equal(r.code, 409,
    `una rectificativa sobre una ANULADA no debe emitirse (SCRUM-308). Fue ${r.code}: ${JSON.stringify(r.body)}`);
  assert.equal(r.body.error, 'cannot_rectify_annulled',
    '🔴 el rechazo tiene que ir NOMBRADO: sin nombre, quien lo recibe no puede distinguirlo de los otros tres cortes de esta ruta');
});

// ─── 3. LOS TRES CORTES QUE SÍ EXISTEN (para que consten) ────────────────────────────────────────
test('SCRUM-308 · caracterización · corte type==="R1" → 409 cannot_rectify_rectification', async (t) => {
  t.after(restaurarPrisma);
  sustituirPrisma(original('paid', { type: 'R1' }));
  const r = await rectify();
  assert.equal(r.code, 409);
  assert.equal(r.body.error, 'cannot_rectify_rectification');
});

test('SCRUM-308 · caracterización · corte already_rectified → 409', async (t) => {
  t.after(restaurarPrisma);
  sustituirPrisma(original('paid'));
  // la 2ª findFirst (rectifiesId) devuelve una rectificativa existente → corta
  moduloPrisma.prisma.invoice.findFirst = async (args) =>
    (args?.where?.rectifiesId !== undefined ? { id: 77, number: '2026-CF-R-001' } : original('paid'));
  const r = await rectify();
  assert.equal(r.code, 409);
  assert.equal(r.body.error, 'already_rectified');
});

test('SCRUM-308 · caracterización · corte isReceiptNumber (J-) → 409 cannot_rectify_receipt', async (t) => {
  t.after(restaurarPrisma);
  sustituirPrisma(original('paid', { number: 'J-2026-0001' })); // justificante: no es factura
  const r = await rectify();
  assert.equal(r.code, 409);
  assert.equal(r.body.error, 'cannot_rectify_receipt');
});

// ─── SUELO / cortes de borde ─────────────────────────────────────────────────────────────────────
test('SCRUM-308 · caracterización · id no numérico → 400 · factura inexistente → 404', async (t) => {
  t.after(restaurarPrisma);
  sustituirPrisma(original('paid'));
  const rBad = await invocar(RUTA, 'post', '/:id/rectify', { params: { id: 'abc' }, body: {}, merchantId: 7, query: {}, headers: {} });
  assert.equal(rBad.code, 400, 'id no numérico');
  moduloPrisma.prisma.invoice.findFirst = async () => null; // no existe
  const rNo = await rectify();
  assert.equal(rNo.code, 404, 'factura inexistente');
});
