// docs/master/evidencias/SCRUM-1771/medir-marcador-en-papel.mjs — SCRUM-1771a
//
// MIDE en qué papeles sale `[PENDIENTE microcopy oficial]`. Solo LEE el camino de emisión
// (regla 38): llama a los generadores del `dist/` y lee el texto con el lector de la casa
// (`tests/_texto-del-pdf.mjs`). No toca ninguna base: los generadores de PDF no consultan Prisma.
//
// Uso (desde la raíz, con `dist/` compilado de main):  node docs/master/evidencias/SCRUM-1771/medir-marcador-en-papel.mjs
// Salida: 0 si midió todo (sean cuantas sean las apariciones) · 2 CIEGO (un control falló o un papel no se leyó).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(import.meta.url);
const { extraerTextoPdf, vecesEnPdf } = await import(path.join(RAIZ, 'tests/_texto-del-pdf.mjs').replace(/\\/g, '/').replace(/^([A-Za-z]):/, 'file:///$1:'));
const { generateInvoicePdf, generateQuotePdf } = require(path.join(RAIZ, 'dist/lib/pdf.js'));
const { generateAlbaranPdf } = require(path.join(RAIZ, 'dist/modules/jobs/infra/albaranPdf.service.js'));
const PDFDocument = require('pdfkit');

const MARCADOR = '[PENDIENTE microcopy oficial]';
const MARCA = '[PENDIENTE';
let ciego = false;

function leer(buf, que) {
  const r = extraerTextoPdf(buf);
  if (!r.ok) { ciego = true; return { que, error: `NO SUPE LEER: ${r.motivo}` }; }
  return { que, bytes: buf.length, marcador: vecesEnPdf(r.texto, MARCADOR), marca: vecesEnPdf(r.texto, MARCA), suelo: r.texto.length };
}
function deRuta(outPath) { try { return fs.readFileSync(outPath); } finally { fs.rmSync(outPath, { force: true }); } }

// ── CONTROLES SEMBRADOS (no prestados del árbol: cicatriz ②) ────────────────────────────
async function pdfSembrado(texto) {
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
const positivo = leer(await pdfSembrado(MARCADOR), 'CONTROL + sembrado (pdfkit, con marcador)');
const negativo = leer(await pdfSembrado(null), 'CONTROL 0 sembrado (pdfkit, sin marcador)');
if (positivo.marcador !== 1) ciego = true;
if (negativo.marca !== 0) ciego = true;

// ── LOS PAPELES DE VERDAD ──────────────────────────────────────────────────────────────
const UN_TIPO = [
  { description: 'Mano de obra', qty: 1, price: 100, tax: 0.21 },
  { description: 'Desplazamiento', qty: 1, price: 50, tax: 0.21 },
];
// La forma de staging (SCRUM-624 c.22118: F260001, 21 % + 10 %).
const DOS_TIPOS = [
  { description: 'Mano de obra', qty: 1, price: 50, tax: 0.21 },
  { description: 'Material reducido', qty: 1, price: 18, tax: 0.10 },
];
const base = (n, type, lines, total) => ({
  number: n, invoiceId: 1, merchantId: 91771,
  merchant: { name: 'QA 1771', legalName: 'QA 1771 SL', taxId: 'B00000000' },
  customer: { name: 'Cliente QA' }, currency: 'EUR', total, qrData: 'x', type, lines,
});
const filas = [positivo, negativo];
const facturas = [
  ['F1 · un tipo (21 %)', base('F-QA1771-1', 'F1', UN_TIPO, '181.50')],
  ['F1 · dos tipos (21 % + 10 %)', base('F-QA1771-2', 'F1', DOS_TIPOS, '80.30')],
  ['R1 · dos tipos', { ...base('R-QA1771-3', 'R1', DOS_TIPOS, '80.30'), rectifiesNumber: 'F-QA1771-2' }],
  ['JUST (justificante) · dos tipos', base('J-QA1771-4', 'JUST', DOS_TIPOS, '80.30')],
  ['F1 · dos tipos SIN líneas (total a secas)', base('F-QA1771-5', 'F1', [], '80.30')],
];
for (const [que, p] of facturas) {
  try { filas.push(leer(deRuta((await generateInvoicePdf(p)).outPath), `generateInvoicePdf · ${que}`)); }
  catch (e) { ciego = true; filas.push({ que, error: String(e && e.message || e).slice(0, 160) }); }
}
try {
  const { outPath } = await generateQuotePdf({
    quoteId: 917710001, quoteNumber: 1, merchant: { name: 'QA 1771' }, customer: { name: 'Cliente QA' },
    currency: 'EUR', total: 80.3, lines: DOS_TIPOS, country: 'ES',
  });
  filas.push(leer(deRuta(outPath), 'generateQuotePdf · presupuesto, dos tipos'));
} catch (e) { ciego = true; filas.push({ que: 'presupuesto', error: String(e && e.message || e).slice(0, 160) }); }
try {
  const { outPath } = await generateAlbaranPdf({
    merchantId: 91771, numero: 'ALB-QA1771', version: 1,
    fecha: new Date(2026, 10, 19), emisionAt: new Date(2026, 10, 19), modoValoracion: 'SIN_VALORAR',
    merchant: { address: 'C/ Mayor 1' }, customer: { taxId: null },
    emisor: 'QA SL', emisorNif: 'B00000000', cliente: 'Cliente QA', obra: 'Obra QA', referenciaTrabajo: 'Trabajo QA',
    lineas: [{ concepto: 'Material', cantidad: 1, unidad: 'ud' }],
    totales: null, notas: null, signatureData: null, evidencia: null,
  });
  filas.push(leer(deRuta(outPath), 'generateAlbaranPdf · albarán sin valorar, sin firmar'));
} catch (e) { ciego = true; filas.push({ que: 'albarán', error: String(e && e.message || e).slice(0, 160) }); }

console.log(`medir-marcador-en-papel · tmp=${os.tmpdir()} · población: ${filas.length} papeles (2 controles sembrados + ${filas.length - 2} del dist/)`);
for (const f of filas) console.log(f.error ? `  CIEGO · ${f.que} · ${f.error}` : `  ${String(f.marcador).padStart(2)} marcador · ${String(f.marca).padStart(2)} «[PENDIENTE» · ${f.que} · ${f.bytes} B · texto ${f.suelo} car.`);
console.log(ciego ? 'VEREDICTO: CIEGO (un control o un papel no se pudo medir)' : 'VEREDICTO: MEDIDO');
process.exit(ciego ? 2 : 0);
