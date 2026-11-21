// tests/scrum624y-pdf-r1-total-del-desglose.test.mjs — SCRUM-624y
//
// LA VÍCTIMA: quien tiene en la mano una RECTIFICATIVA cuyo TOTAL no es la suma de la base y las
// cuotas que el mismo papel le imprime encima.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL ARREGLO A, TAMBIÉN EN LA R1 — GO del fundador, SCRUM-624 c.22137 («GO» a «A en la R1»)
//
// El caso es el de staging (SCRUM-1763 c.22119, SCRUM-624 c.22118): F1 `F260001` con 1 × 36,03 al
// 21 % + 3 × 12,35 al 10 %, total 84,36. Su R1 `2026-QA-R-001` guarda −84,35 (Σ `calcVatBreakdown`
// de las líneas negadas, desde SCRUM-1763), pero su PDF imprimía «IVA 10%: −3,71» y «TOTAL: −84,35»:
// un desglose que suma −84,36 bajo un total de −84,35.
//
// Lo que diverge, MEDIDO leyendo `pdf.service.ts` (no supuesto): la R1 iba por la rama que suma
// `base × tipo` SIN redondear por grupo (−3,705 → `fmt` → −3,71), y su total era esa suma
// (−84,3513 → −84,35). La F1 ya imprimía `calcVatBreakdown` (−3,705 → `Math.round` → −3,70) y el
// total GUARDADO. Con A en la R1, el total impreso NO cambia (−84,35): cambia la cuota (−3,70), y
// el papel cuadra consigo mismo y con su XML (Desglose = `calcVatBreakdown`, ImporteTotal = total).
//
// Se fabrica la F1, se rectifica con la RUTA REAL de `dist/` (base doblada, como SCRUM-1763), se
// pinta el PDF DE VERDAD de las dos y se lee su texto.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { reqDeSesion } from './_arnes-de-router.mjs';
import { lineasDePdf } from './_texto-del-pdf.mjs';

const require = createRequire(import.meta.url);
const DIST = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')).href + '/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const { calcVatBreakdown } = await import(DIST + 'modules/invoicing/domain/vat.service.js');
const { generateInvoicePdf } = require('../dist/lib/pdf.js');
const RUTA = 'modules/system/app/routes/invoicesAdmin.routes.js';

// La mutación que imita el defecto: la R1 vuelve a recalcular su bloque (total = suma sin redondear).
// `dist/` está en `.gitignore`: no puede llegar a un commit.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'dist/modules/invoicing/infra/pdf/pdf.service.js',
    de: "const leeElRegistro = tipoDoc === 'F1' || tipoDoc === 'R1';",
    a: "const leeElRegistro = tipoDoc === 'F1';",
    cae: 'la R1 del caso de staging imprime un TOTAL que es la suma de su desglose',
  },
];

const routerDe = (mod) => mod.default?.default ?? mod.default;
const totalDelDesglose = (lineas) => {
  const bd = calcVatBreakdown(lineas);
  return (bd.base + bd.cuota).toFixed(2);
};

// Merchant NO-ES a propósito (como SCRUM-308 y SCRUM-1763): la R1 emite sin depender de
// INVOICING_ES_ENABLED. Se mide el papel, no el modo de emisión.
const MERCHANT = {
  id: 1, name: 'QA', country: 'FR', taxId: null, flags: {},
  invoiceSeriesPrefix: 'CF', invoiceSeriesYear: 2026, nextInvoiceNumber: 5, nextRectInvoiceNumber: 3,
};

const ORIG = {};
function sustituirPrisma(orig) {
  for (const k of ['invoice', '$transaction', 'customerEvent', 'auditLog', 'merchant', 'customer']) ORIG[k] = moduloPrisma.prisma[k];
  const creado = { data: null };
  const tx = {
    $executeRaw: async () => [],
    $executeRawUnsafe: async () => [],
    merchant: { findUnique: async () => MERCHANT, update: async () => ({}) },
    // SCRUM-1787d · la emisión lee DENTRO de la tx la factura que se rectifica (hereda su dirección).
    invoice: { findFirst: async () => orig, create: async ({ data }) => { creado.data = data; return { id: 99, ...data }; } },
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

/** La R1 que guarda la ruta real de `dist/` para una F1 dada: su `data` de `invoice.create`. */
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
  assert.equal(salida?.code, 201, `🔴 CIEGO: la R1 no se emitió (${salida?.code}): ${JSON.stringify(salida?.body)}`);
  assert.ok(creado.data, '🔴 CIEGO: la ruta respondió 201 sin pasar por tx.invoice.create');
  return creado.data;
}

let serie = 0;
/** El bloque de totales del papel: de «Base imponible:» a «TOTAL:». */
async function bloque(type, total, lines) {
  serie += 1;
  const { outPath } = await generateInvoicePdf({
    number: `F-2026-QA624Y-${serie}`, invoiceId: 1, merchantId: 7,
    merchant: { name: 'QA 624y', legalName: 'QA 624y SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' }, currency: 'EUR', total: String(total), qrData: 'x', type, lines, zona: null,
    ...(type === 'R1' ? { rectifiesNumber: '2026-CF-0007' } : {}),
  });
  let r;
  try {
    r = lineasDePdf(fs.readFileSync(outPath));
  } finally {
    fs.rmSync(outPath, { force: true });
  }
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un papel sin leer no dice ningún importe.`);
  const t = r.lineas.map((l) => l.texto);
  const i = t.findIndex((x) => x.startsWith('Base imponible:'));
  const j = t.findIndex((x) => /^TOTAL:/.test(x));
  assert.ok(i >= 0 && j > i, '🔴 CIEGO: no encuentro el bloque de totales en el papel.');
  return t.slice(i, j + 1);
}

const num = (s) => Number(s.replace(/\./g, '').replace(',', '.'));
/** Las filas de desglose impresas (tipo, base, cuota) y el TOTAL impreso, leídos del texto. */
function leerBloque(b) {
  const filas = b
    .map((x) => x.match(/^(\d+(?:,\d+)?%)(-?[\d.]+,\d{2}) EURIVA \1:(-?[\d.]+,\d{2}) EUR$/))
    .filter(Boolean)
    .map((m) => ({ tipo: m[1], base: num(m[2]), cuota: num(m[3]) }));
  const total = num(b[b.length - 1].match(/^TOTAL:(-?[\d.]+,\d{2}) EUR$/)[1]);
  const suma = Math.round(filas.reduce((a, f) => a + f.base * 100 + f.cuota * 100, 0)) / 100;
  return { filas, total, suma };
}

const L = (price, tax, qty = 1) => ({ concept: 'L624y', qty, price, tax });
// El caso de staging (c.22118): 1 × 36,03 al 21 % + 3 × 12,35 al 10 %.
const LINEAS_STAGING = [L(36.03, 0.21), L(12.35, 0.10, 3)];
const F1_STAGING = {
  id: 11, merchantId: 7, customerId: 2, type: 'F1', number: '2026-CF-0007',
  total: totalDelDesglose(LINEAS_STAGING), currency: 'EUR', quoteId: null, vfHash: null, status: 'pending',
  lines: LINEAS_STAGING, merchant: MERCHANT,
};

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO: el lector saca dos filas de un desglose de dos tipos
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-624y · SUELO: la F1 de staging guarda 84,36 y su PDF imprime dos filas que suman su TOTAL', async () => {
  assert.equal(F1_STAGING.total, '84.36', '🔴 la F1 de partida ya no guarda 84,36: el caso de c.22118 ha cambiado');
  const b = leerBloque(await bloque('F1', F1_STAGING.total, F1_STAGING.lines));
  assert.equal(b.filas.length, 2, `🔴 CIEGO: el lector no saca las dos filas del desglose (${JSON.stringify(b.filas)})`);
  assert.deepEqual(b.filas, [
    { tipo: '21%', base: 36.03, cuota: 7.57 },
    { tipo: '10%', base: 37.05, cuota: 3.71 },
  ], 'ha cambiado el desglose impreso de la F1: el caso ya no mide lo que dice');
  assert.equal(b.total, 84.36);
  assert.equal(b.suma, b.total, '🔴 la F1 imprime un TOTAL que no es la suma de su desglose (SCRUM-624e)');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① LA R1 DEL CASO DE STAGING
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-624y · 🔴 la R1 del caso de staging imprime un TOTAL que es la suma de su desglose', async (t) => {
  t.after(restaurarPrisma);
  const r1 = await rectificar(F1_STAGING);
  assert.equal(String(r1.total), '-84.35',
    '🔴 la R1 ya no guarda −84,35 (SCRUM-1763 c.22119): el caso de staging ha cambiado');

  const b = leerBloque(await bloque('R1', r1.total, r1.lines));
  assert.equal(b.filas.length, 2, `🔴 CIEGO: el lector no saca las dos filas de la R1 (${JSON.stringify(b.filas)})`);
  assert.equal(b.suma, b.total,
    `🔴 EL PAPEL DE LA R1 NO CUADRA CONSIGO MISMO: imprime TOTAL ${b.total} y su desglose suma ${b.suma}.\n` +
    `  Filas impresas: ${JSON.stringify(b.filas)}. Es el PDF de staging de c.22119 (−84,35 con −84,36).`);
  // A, no otra convención: el TOTAL impreso es el GUARDADO, y las cuotas, las de `calcVatBreakdown`.
  assert.equal(b.total, Number(r1.total), '🔴 la R1 no imprime su total guardado');
  const bd = calcVatBreakdown(r1.lines);
  assert.deepEqual(b.filas.map((f) => [f.base, f.cuota]), bd.entries.map((e) => [e.base, e.cuota]),
    '🔴 las filas impresas de la R1 no son las de `calcVatBreakdown` (las que lleva su XML)');
});

test('SCRUM-624y · ① la R1 de un solo tipo (12,50 al 21 %) imprime base, cuota y total que cuadran', async (t) => {
  t.after(restaurarPrisma);
  const lines = [L(12.5, 0.21)];
  const r1 = await rectificar({ ...F1_STAGING, lines, total: totalDelDesglose(lines) });
  assert.equal(String(r1.total), '-15.12', '🔴 la R1 de 12,50 ya no guarda −15,12 (SCRUM-1763)');
  assert.deepEqual(await bloque('R1', r1.total, r1.lines),
    ['Base imponible:-12,50 EUR', 'IVA 21%:-2,62 EUR', 'TOTAL:-15,12 EUR'],
    '🔴 la R1 de 12,50 al 21 % no imprime el desglose de su registro (antes: −2,63 con TOTAL −15,13)');
});
