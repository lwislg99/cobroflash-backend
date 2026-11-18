// tests/scrum1763-r1-total-del-desglose.test.mjs — SCRUM-1763 (GO del fundador, c.22062)
//
// EL DEFECTO (medido en SCRUM-624 c.20814): la R1 guardaba `total = −original.total`, pero su
// desglose —el que viaja en su XML de VeriFactu y en su huella como `CuotaTotal`— sale de
// `calcVatBreakdown` sobre sus líneas NEGADAS. Original 1 × 12,50 € al 21 % guarda 15,13
// (12,50 + 2,63); su R1 guardaba −15,13, y su desglose da −12,50 + −2,62 = −15,12, porque
// `Math.round(−262,5) = −262`. El registro de la R1 no cuadraba consigo mismo.
//
// EL INVARIANTE (el mismo que fija SCRUM-624c para la F1):
//
//     total guardado de la R1  ===  Σ(base + cuota)  del desglose de SUS líneas
//
// ⚠️ Lo que NO decide este test: el redondeo de las cuotas negativas (`Math.round` sube el medio
// céntimo hacia cero). Eso está en el asesor (SCRUM-1264, fila 11). Aquí se mide COHERENCIA
// INTERNA: si mañana cambia la convención, la vara (`calcVatBreakdown`) cambia con ella y este
// test sigue pidiendo lo mismo. Por eso los números esperados se DERIVAN de la vara y, aparte, se
// fija que hoy la vara da −15,12 (si deja de darlo, alguien ha tocado el redondeo y hay que saberlo).
//
// CÓMO SE EJERCITA: el patrón de SCRUM-263/308 — el router REAL del `dist`, el handler real, y
// `prisma` sustituido. Se captura el `data` que la ruta manda a `tx.invoice.create`: es lo que se
// guardaría, sin BD.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { reqDeSesion } from './_arnes-de-router.mjs';

const DIST = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')).href + '/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const { calcVatBreakdown } = await import(DIST + 'modules/invoicing/domain/vat.service.js');
const { calcAlbaranTotales } = await import(DIST + 'modules/jobs/domain/albaran.service.js');
const RUTA = 'modules/system/app/routes/invoicesAdmin.routes.js';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: 'const totalRect = (bdRect.base + bdRect.cuota).toFixed(2);',
    a: 'const totalRect = (-Number(original.total)).toFixed(2);',
    cae: 'la R1 de 12,50 al 21 % guarda la suma de su desglose',
  },
];

const routerDe = (mod) => mod.default?.default ?? mod.default;

/** Σ(base + cuota) del desglose de unas líneas: la vara de medir (la misma que SCRUM-624c). */
const totalDelDesglose = (lineas) => {
  const bd = calcVatBreakdown(lineas);
  return (bd.base + bd.cuota).toFixed(2);
};

// Merchant NO-ES a propósito (como SCRUM-308): la R1 emite sin depender de INVOICING_ES_ENABLED y
// `sellarTrasEmision` da NO_APLICA. Se mide el `total` que se guarda, no el modo de emisión.
const MERCHANT = {
  id: 1, name: 'QA', country: 'FR', taxId: null, flags: {},
  invoiceSeriesPrefix: 'CF', invoiceSeriesYear: 2026, nextInvoiceNumber: 5, nextRectInvoiceNumber: 3,
};

/** La F1 original, con el total que guarda la F1 desde SCRUM-624 (Σ de su propio desglose). */
function original(lines, over = {}) {
  return {
    id: 11, merchantId: 7, customerId: 2, type: 'F1', number: '2026-CF-0007',
    total: totalDelDesglose(lines), currency: 'EUR', quoteId: null, vfHash: null, status: 'pending',
    lines, merchant: MERCHANT, ...over,
  };
}

const ORIG = {};
/** Sustituye prisma y devuelve una caja donde cae el `data` que la ruta manda a crear. */
function sustituirPrisma(orig) {
  for (const k of ['invoice', '$transaction', 'customerEvent', 'auditLog', 'merchant', 'customer']) ORIG[k] = moduloPrisma.prisma[k];
  const creado = { data: null };
  const tx = {
    $executeRaw: async () => [],
    $executeRawUnsafe: async () => [],
    merchant: { findUnique: async () => MERCHANT, update: async () => ({}) },
    invoice: { create: async ({ data }) => { creado.data = data; return { id: 99, ...data }; } },
    auditLog: { create: async () => ({}) },
    customerEvent: { create: async () => ({}) },
  };
  moduloPrisma.prisma.invoice = {
    findFirst: async (args) => (args?.where?.rectifiesId !== undefined ? null : orig),
    update: async () => ({}),
  };
  moduloPrisma.prisma.$transaction = async (cb) => cb(tx);
  moduloPrisma.prisma.customerEvent = { create: async () => ({}) };
  moduloPrisma.prisma.customer = {
    findFirst: async () => ({ name: 'Cliente QA', legalName: null, taxId: null, email: null, phone: null }),
  };
  moduloPrisma.prisma.auditLog = { create: async () => ({}) };
  moduloPrisma.prisma.merchant = { findUnique: async () => MERCHANT, update: async () => ({}) };
  return creado;
}
function restaurarPrisma() { for (const k of Object.keys(ORIG)) moduloPrisma.prisma[k] = ORIG[k]; }

async function rectificar(orig) {
  const creado = sustituirPrisma(orig);
  const router = routerDe(await import(DIST + RUTA));
  assert.ok(Array.isArray(router?.stack), '🔴 CIEGO: no se pudo leer el router de facturas');
  const capa = router.stack.find((l) => l.route?.path === '/:id/rectify' && l.route?.methods?.post);
  assert.ok(capa, '🔴 CIEGO: no existe POST /:id/rectify. Si se renombró, este test no mediría nada.');
  let salida = null;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    send(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    setHeader() { return this; }, type() { return this; },
  };
  const req = reqDeSesion({ rol: 'admin', params: { id: '11' }, body: {}, merchantId: 7, teamMemberId: null, query: {}, headers: {} });
  const h = capa.route.stack;
  await h[h.length - 1].handle(req, res, () => {});
  // SUELO: sin 201 y sin `data` capturado no se ha medido lo que se guarda.
  assert.equal(salida?.code, 201, `🔴 CIEGO: la R1 no se emitió (${salida?.code}): ${JSON.stringify(salida?.body)}`);
  assert.ok(creado.data, '🔴 CIEGO: la ruta respondió 201 sin pasar por tx.invoice.create');
  return { data: creado.data, body: salida.body };
}

const L = (price, tax, qty = 1) => ({ concept: 'L1763', qty, price, tax });

test('SCRUM-1763 · 🔴 la R1 de 12,50 al 21 % guarda la suma de su desglose (−15,12), no −original.total (−15,13)', async (t) => {
  t.after(restaurarPrisma);
  const orig = original([L(12.5, 0.21)]);
  assert.equal(orig.total, '15.13', '🔴 la F1 de partida ya no guarda 15,13: el caso medido en c.20814 ha cambiado');

  const { data, body } = await rectificar(orig);
  const vara = totalDelDesglose(data.lines);
  assert.equal(vara, '-15.12',
    '🔴 la vara ha cambiado de resultado: alguien ha tocado el redondeo de las cuotas negativas (SCRUM-1264 fila 11)');
  assert.equal(String(data.total), vara,
    `🔴 la R1 guarda ${data.total} y su propio desglose suma ${vara}: el registro no cuadra consigo mismo.\n` +
    '  Su XML lleva ImporteTotal = el total guardado y Desglose/CuotaTotal = calcVatBreakdown de sus líneas.');
  assert.notEqual(String(data.total), (-Number(orig.total)).toFixed(2),
    '🔴 la R1 ha vuelto a guardar −original.total');
  assert.equal(body.total, vara, '🔴 la respuesta de la ruta no dice el total que guarda');
});

test('SCRUM-1763 · 🔴 con DOS tipos (21 % y 10 %) la R1 también guarda la suma de su desglose', async (t) => {
  t.after(restaurarPrisma);
  const orig = original([L(12.5, 0.21), L(4.95, 0.10)]);
  const { data } = await rectificar(orig);
  const vara = totalDelDesglose(data.lines);
  // El caso tiene que EJERCER el defecto: si las dos cifras coinciden, este test no mide nada.
  assert.notEqual(vara, (-Number(orig.total)).toFixed(2),
    '🔴 CIEGO: con estas líneas −original.total y el desglose coinciden; el caso no distingue el arreglo');
  assert.equal(String(data.total), vara,
    `🔴 la R1 de dos tipos guarda ${data.total} y su desglose suma ${vara}`);
});

test('SCRUM-1763 · control · donde ya cuadraba (100 al 21 %) la R1 sigue guardando −121,00', async (t) => {
  t.after(restaurarPrisma);
  const { data } = await rectificar(original([L(100, 0.21)]));
  assert.equal(String(data.total), '-121.00');
});

test('SCRUM-1763 · control · una original SIN líneas sigue rectificándose por su total', async (t) => {
  // La línea única de la ruta va al 0 %: su desglose es exactamente −original.total.
  t.after(restaurarPrisma);
  const { data } = await rectificar(original([], { total: '15.13' }));
  assert.equal(data.lines.length, 1);
  assert.equal(String(data.total), '-15.13');
});

test('SCRUM-1763 · control negativo · el ALBARÁN sigue redondeando POR LÍNEA (36,27)', () => {
  const t = calcAlbaranTotales([
    { concepto: 'a', cantidad: 1, precioUnitario: 9.99, tipoIva: 21 },
    { concepto: 'b', cantidad: 1, precioUnitario: 9.99, tipoIva: 21 },
    { concepto: 'c', cantidad: 1, precioUnitario: 9.99, tipoIva: 21 },
  ]);
  assert.equal((t.totalCents / 100).toFixed(2), '36.27',
    '🔴 el albarán ha cambiado de redondeo: su convención es por línea y este ticket no la toca');
});
