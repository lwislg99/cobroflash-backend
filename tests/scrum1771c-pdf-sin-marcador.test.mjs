// tests/scrum1771c-pdf-sin-marcador.test.mjs — SCRUM-1771c
//
// NINGÚN PAPEL QUE SALE DE LOS GENERADORES LLEVA `[PENDIENTE`, Y EL DESGLOSE DICE SU RÓTULO FIRMADO.
//
// SCRUM-1771: la F1 de dos tipos de staging (F260001, 21 % + 10 %) imprimía, a la vista del cliente
// final, `[PENDIENTE microcopy oficial]` como rótulo de la columna de bases del desglose
// (`MARCADOR_MICROCOPY_DESGLOSE`, `pdf.service.ts`, pintado sólo con MÁS DE UN tipo). El fundador
// firmó el literal en SCRUM-1771 c.22164: «Base imponible por tipo». La decisión de cómo retirar el
// último marcador declarado del papel sin relajar ningún guard es c.22171 (P1–P3).
//
// Qué mide: los papeles de los tres generadores (factura/R1/justificante, presupuesto, albarán),
// fabricados con el `dist/` y leídos con el lector de la casa (`_texto-del-pdf.mjs`). Ninguno trae
// `[PENDIENTE`; los de dos tipos traen el literal firmado UNA vez.
//
// 🔴 EL POSITIVO SE SIEMBRA, NO SE TOMA PRESTADO DEL ÁRBOL. Con la lista de `papel` vacía, el recuento
// de scrum667 («el papel trae tantos como hay declarados») pasa a ser 0 === 0, cierto sobre el vacío.
// Lo que sostiene el suelo aquí es un PDF fabricado por este mismo test con el marcador dentro: el
// detector TIENE que verlo. Si no lo ve, cada caso de papel sale en ROJO diciendo CIEGO — nunca verde.
//
// NO medido aquí: el albarán con dos tipos de IVA. Sus líneas no llevan tipo (`albaranPdf.service.ts`
// pinta precio e importe, y sólo base + total en los totales), así que «dos tipos» no se puede
// fabricar en ese papel; se mide el VALORADO con unos totales de 21 % + 10 %.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { extraerTextoPdf, vecesEnPdf } from './_texto-del-pdf.mjs';

const require = createRequire(import.meta.url);
const MARCA = '[PENDIENTE';
const LITERAL_FIRMADO = 'Base imponible por tipo'; // SCRUM-1771 c.22164, byte a byte

// ── EL DETECTOR, Y SU POSITIVO SEMBRADO ─────────────────────────────────────────────────────
async function pdfSembrado(texto) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'A4' });
  const trozos = [];
  doc.on('data', (c) => trozos.push(c));
  const fin = new Promise((ok) => doc.on('end', ok));
  doc.font('Helvetica').fontSize(10).text('Base imponible');
  if (texto) doc.text(texto);
  doc.end();
  await fin;
  return Buffer.concat(trozos);
}

/** Cuántas veces sale `aguja` en el papel, o un error que nombra por qué no se pudo leer. */
function veces(buf, aguja) {
  const r = extraerTextoPdf(buf);
  if (!r.ok) throw new Error(`🔴 CIEGO: el lector no supo leer el papel (${r.motivo})`);
  return vecesEnPdf(r.texto, aguja);
}

let detector = null;
async function detectorVivo() {
  if (detector) return detector;
  const con = veces(await pdfSembrado('[PENDIENTE microcopy oficial]'), MARCA);
  const sin = veces(await pdfSembrado(null), MARCA);
  const lit = veces(await pdfSembrado(LITERAL_FIRMADO), LITERAL_FIRMADO);
  detector = { ok: con === 1 && sin === 0 && lit === 1, con, sin, lit };
  return detector;
}
async function exigirDetector() {
  const d = await detectorVivo();
  if (!d.ok) {
    assert.fail(`🔴 CIEGO, NO VERDE: el detector no ve lo sembrado (marcador sembrado → ${d.con}, `
      + `esperado 1 · sin marcador → ${d.sin}, esperado 0 · literal sembrado → ${d.lit}, esperado 1). `
      + 'Un 0 de este detector no diría «limpio»: diría «no he mirado».');
  }
}

test('SCRUM-1771c · CONTROL POSITIVO SEMBRADO: el detector ve el marcador y el literal en un PDF fabricado aquí', async () => {
  const d = await detectorVivo();
  assert.equal(d.con, 1, '🔴 CIEGO: el marcador sembrado no se ve');
  assert.equal(d.sin, 0, '🔴 el detector ve un marcador donde no se sembró ninguno');
  assert.equal(d.lit, 1, '🔴 CIEGO: el literal firmado sembrado no se ve');
});

// ── LOS PAPELES DE VERDAD ───────────────────────────────────────────────────────────────────
const UN_TIPO = [
  { description: 'Mano de obra', qty: 1, price: 100, tax: 0.21 },
  { description: 'Desplazamiento', qty: 1, price: 50, tax: 0.21 },
];
// La forma de staging (SCRUM-624 c.22118: F260001, 21 % + 10 %).
const DOS_TIPOS = [
  { description: 'Mano de obra', qty: 1, price: 50, tax: 0.21 },
  { description: 'Material reducido', qty: 1, price: 18, tax: 0.10 },
];
const factura = (n, type, lines, total, extra = {}) => ({
  number: n, invoiceId: 1, merchantId: 917710,
  merchant: { name: 'QA 1771c', legalName: 'QA 1771c SL', taxId: 'B00000000' },
  customer: { name: 'Cliente QA' }, currency: 'EUR', total, qrData: 'x', type, lines, ...extra,
});
function deRuta(outPath) { try { return fs.readFileSync(outPath); } finally { fs.rmSync(outPath, { force: true }); } }

async function pdfDeFactura(p) {
  const { generateInvoicePdf } = require('../dist/lib/pdf.js');
  return deRuta((await generateInvoicePdf(p)).outPath);
}
async function pdfDePresupuesto() {
  const { generateQuotePdf } = require('../dist/lib/pdf.js');
  return deRuta((await generateQuotePdf({
    quoteId: 917710001, quoteNumber: 1, merchant: { name: 'QA 1771c' }, customer: { name: 'Cliente QA' },
    currency: 'EUR', total: 80.3, lines: DOS_TIPOS, country: 'ES',
  })).outPath);
}
async function pdfDeAlbaran(extra = {}) {
  const { generateAlbaranPdf } = require('../dist/modules/jobs/infra/albaranPdf.service.js');
  return deRuta((await generateAlbaranPdf({
    merchantId: 917710, numero: 'ALB-QA1771C', version: 1,
    fecha: new Date(2026, 10, 19), emisionAt: new Date(2026, 10, 19), modoValoracion: 'SIN_VALORAR',
    merchant: { address: 'C/ Mayor 1' }, customer: { taxId: null },
    emisor: 'QA SL', emisorNif: 'B00000000', cliente: 'Cliente QA', obra: 'Obra QA', referenciaTrabajo: 'Trabajo QA',
    lineas: [{ concepto: 'Material', cantidad: 1, unidad: 'ud' }],
    totales: null, notas: null, signatureData: null, evidencia: null,
    firmadoAt: null, firmadoPorNombre: null, firmadoPorCalidad: null,
    ...extra,
  })).outPath);
}

// [nombre, fabrica, ¿lleva el desglose de dos tipos?, una cadena que el papel TIENE que traer]
const PAPELES = [
  ['F1 dos tipos (21 % + 10 %)', () => pdfDeFactura(factura('F-QA1771C-2', 'F1', DOS_TIPOS, '80.30')), true, 'F-QA1771C-2'],
  ['R1 dos tipos', () => pdfDeFactura(factura('R-QA1771C-3', 'R1', DOS_TIPOS, '80.30', { rectifiesNumber: 'F-QA1771C-2' })), true, 'R-QA1771C-3'],
  ['JUST dos tipos', () => pdfDeFactura(factura('J-QA1771C-4', 'JUST', DOS_TIPOS, '80.30')), true, 'J-QA1771C-4'],
  ['F1 un tipo', () => pdfDeFactura(factura('F-QA1771C-1', 'F1', UN_TIPO, '181.50')), false, 'F-QA1771C-1'],
  ['F1 sin líneas', () => pdfDeFactura(factura('F-QA1771C-5', 'F1', [], '80.30')), false, 'F-QA1771C-5'],
  ['presupuesto dos tipos', () => pdfDePresupuesto(), false, 'Cliente QA'],
  ['albarán sin valorar ni firmar', () => pdfDeAlbaran(), false, 'ALB-QA1771C'],
  ['albarán valorado (totales de 21 % + 10 %)', () => pdfDeAlbaran({
    modoValoracion: 'VALORADO',
    lineas: [
      { concepto: 'Mano de obra', cantidad: 1, unidad: 'ud', precioUnitario: 50 },
      { concepto: 'Material reducido', cantidad: 1, unidad: 'ud', precioUnitario: 18 },
    ],
    totales: { base: 68, cuota: 12.3, total: 80.3 },
  }), false, 'ALB-QA1771C'],
  // El bloque del firmante sólo se pinta CON `signatureData` (`albaranPdf.service.ts`, `if
  // (params.signatureData)`): sin imagen, «firmado» no recorre la rama de «En calidad de». Por eso
  // el suelo de este papel es el nombre del firmante, que sólo sale dentro de ese bloque.
  ['albarán firmado', () => pdfDeAlbaran({
    signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    firmadoAt: new Date(2026, 10, 19), firmadoPorNombre: 'Ana Pérez', firmadoPorCalidad: 'el_propio_cliente',
  }), false, 'Ana P'],
];

async function medir([nombre, fabrica, dosTipos, suelo]) {
  await exigirDetector();
  const buf = await fabrica();
  assert.ok(veces(buf, suelo) >= 1, `🔴 CIEGO: el papel «${nombre}» no trae «${suelo}»: no se ha leído lo que se fabricó`);
  assert.equal(veces(buf, MARCA), 0, `🔴 el papel «${nombre}» imprime \`${MARCA}\`: un texto sin firma llega al cliente`);
  assert.equal(veces(buf, LITERAL_FIRMADO), dosTipos ? 1 : 0, dosTipos
    ? `🔴 el papel «${nombre}» no rotula el desglose con el literal firmado «${LITERAL_FIRMADO}» (SCRUM-1771 c.22164)`
    : `🔴 el papel «${nombre}» no tiene desglose por tipos y aun así imprime «${LITERAL_FIRMADO}»`);
}

test('SCRUM-1771c · F1 dos tipos (21 % + 10 %): sin marcador y con el rótulo firmado', () => medir(PAPELES[0]));
test('SCRUM-1771c · R1 dos tipos: sin marcador y con el rótulo firmado', () => medir(PAPELES[1]));
test('SCRUM-1771c · JUST dos tipos: sin marcador y con el rótulo firmado', () => medir(PAPELES[2]));
test('SCRUM-1771c · F1 un tipo: sin marcador y sin rótulo de desglose', () => medir(PAPELES[3]));
test('SCRUM-1771c · F1 sin líneas: sin marcador y sin rótulo de desglose', () => medir(PAPELES[4]));
test('SCRUM-1771c · presupuesto dos tipos: sin marcador', () => medir(PAPELES[5]));
test('SCRUM-1771c · albarán sin valorar ni firmar: sin marcador', () => medir(PAPELES[6]));
test('SCRUM-1771c · albarán valorado: sin marcador', () => medir(PAPELES[7]));
test('SCRUM-1771c · albarán firmado: sin marcador', () => medir(PAPELES[8]));

test('SCRUM-1771c · la población: nueve papeles, tres con desglose de dos tipos', () => {
  assert.equal(PAPELES.length, 9, '🔴 la matriz de papeles ha cambiado de tamaño sin cambiar sus casos');
  assert.equal(PAPELES.filter((p) => p[2]).length, 3, '🔴 los papeles con desglose ya no son F1, R1 y JUST');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS MUTACIONES QUE ME TUMBAN (SCRUM-745) · las ejecuta `npm run meta:mutaciones`
// ═════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Vuelve el marcador al rótulo del desglose: F1, R1 y JUST de dos tipos lo imprimen.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'doc.text(MARCADOR_MICROCOPY_DESGLOSE, totalsX, doc.y, { width: totalsW });',
    a: "doc.text('[PENDIENTE microcopy oficial]', totalsX, doc.y, { width: totalsW });",
    cae: 'SCRUM-1771c · F1 dos tipos (21 % + 10 %): sin marcador y con el rótulo firmado',
  },
  {
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'doc.text(MARCADOR_MICROCOPY_DESGLOSE, totalsX, doc.y, { width: totalsW });',
    a: "doc.text('[PENDIENTE microcopy oficial]', totalsX, doc.y, { width: totalsW });",
    cae: 'SCRUM-1771c · R1 dos tipos: sin marcador y con el rótulo firmado',
  },
  {
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'doc.text(MARCADOR_MICROCOPY_DESGLOSE, totalsX, doc.y, { width: totalsW });',
    a: "doc.text('[PENDIENTE microcopy oficial]', totalsX, doc.y, { width: totalsW });",
    cae: 'SCRUM-1771c · JUST dos tipos: sin marcador y con el rótulo firmado',
  },
  {
    // El detector se queda ciego (no ve nada): el positivo sembrado tiene que tumbar el test.
    fichero: 'tests/scrum1771c-pdf-sin-marcador.test.mjs',
    de: '  return vecesEnPdf(r.texto, aguja);\n',
    a: '  return 0;\n',
    cae: 'SCRUM-1771c · CONTROL POSITIVO SEMBRADO: el detector ve el marcador y el literal en un PDF fabricado aquí',
  },
];
