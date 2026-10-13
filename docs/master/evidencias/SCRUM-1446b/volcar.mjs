// SCRUM-1446b · VUELCA lo que un árbol imprime y construye, para compararlo POR BYTES con otro árbol.
//
//   node docs/master/evidencias/SCRUM-1446b/volcar.mjs <árbol con dist/> > volcado.jsonl
//
// No mide nada: escribe una línea JSON por caso, con los tipos de IVA que lleva. Quien compara es
// `comparar.mjs`. La población es fija (semilla fija), así que dos árboles vuelcan los MISMOS casos.
// Sólo LEE el camino de emisión: carga `dist/` y lo ejecuta. No toca ninguna base.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { temporal } from '../../../../tests/_temporal.mjs';

const R = path.resolve(process.argv[2] || '.');
if (!fs.existsSync(path.join(R, 'dist/lib/pdf.js'))) {
  console.error(`CIEGO: no hay dist/ en ${R}. Compila antes.`);
  process.exit(2);
}
// Igual que la sonda de SCRUM-1446: se sale de la carpeta antes de que `temporal` la borre.
process.on('exit', () => { try { process.chdir(os.tmpdir()); } catch { /* ya no hay a donde volver */ } });
const TMP = temporal('scrum1446b-');
process.chdir(TMP);

const require = createRequire(path.join(R, 'x.js'));
const { lineasDePdf } = await import(pathToFileURL(path.join(R, 'tests/_texto-del-pdf.mjs')).href);
const { generateInvoicePdf, generateQuotePdf } = require(path.join(R, 'dist/lib/pdf.js'));
const u = require(path.join(R, 'dist/core/utils/utils.js'));
const vat = require(path.join(R, 'dist/modules/invoicing/domain/vat.service.js'));
const il = require(path.join(R, 'dist/modules/invoicing/domain/invoiceLines.service.js'));
const fi = require(path.join(R, 'dist/core/validation/fiscalInput.js'));
const te = require(path.join(R, 'dist/core/validation/tiposIvaEmitibles.js'));
const rb = require(path.join(R, 'dist/modules/fiscal/verifactu/registro.builder.js'));
const pie = require(path.join(R, 'dist/modules/quotes/domain/presentacionIva.js'));

const ADMITIDOS = [...fi.TIPOS_IVA_ES_BP].map((b) => b / 10000).sort((a, b) => a - b);
const L = (price, tax, qty = 1) => ({ qty, price, tax });
const conNombre = (lines) => lines.map((l, i) => ({ concept: `L${i + 1}Z`, ...l }));
const tiposDe = (lines) => [...new Set(lines.map((l) => Number(l.tax) || 0))].sort((a, b) => a - b);
const intenta = (f) => { try { return f(); } catch (e) { return `LANZA: ${String(e && e.message).slice(0, 160)}`; } };

let n = 0;
const emite = (clase, lines, salida, extra = {}) => {
  n += 1;
  process.stdout.write(JSON.stringify({ id: `${clase}#${n}`, clase, tipos: tiposDe(lines), ...extra, salida }) + '\n');
};

let nPdf = 0;
async function texto(outPath) {
  const r = lineasDePdf(fs.readFileSync(outPath));
  fs.rmSync(outPath, { force: true });
  if (!r.ok) throw new Error(`CIEGO: no supe leer el PDF: ${r.motivo}`);
  nPdf += 1;
  return r.lineas.map((l) => l.texto);
}
async function papelFactura(lines, total) {
  const { outPath } = await generateInvoicePdf({
    number: 'F-QA1446B', invoiceId: 1, merchantId: 7,
    merchant: { name: 'QA', legalName: 'QA SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' }, currency: 'EUR', total: String(total), qrData: 'x', type: 'F1',
    lines: conNombre(lines),
  });
  return texto(outPath);
}
async function papelPresupuesto(lines, total, extra = {}) {
  const { outPath } = await generateQuotePdf({
    quoteId: 990000, quoteNumber: 1, merchant: { name: 'QA' }, customer: { name: 'Cliente QA' },
    currency: 'EUR', total: String(total), lines: conNombre(lines), country: 'ES', ...extra,
  });
  return texto(outPath);
}

/** Todo lo que el DOMINIO construye para unas líneas: lo que se guarda, se firma y se remite. */
function dominio(lines, global) {
  const bd = vat.calcVatBreakdown(lines);
  return {
    desglose: bd,
    guardado: il.grossOfLines(lines),
    firmado: u.calcTotal(lines),
    firmadoConGlobal: u.calcTotal(lines, global),
    reparto: u.descuentoGlobalEnCentimos(lines, global),
    paraFacturar: il.lineasParaFacturar({ lines, discountGlobalAmount: global }),
    porton: te.tipoIvaNoEmitible(il.lineasParaFacturar({ lines, discountGlobalAmount: global })),
    pie: pie.pieDePresupuesto({ lineas: lines, modo: 'sumar', nombreImpuesto: 'IVA', descuentoGlobal: null }).filas,
    pieConGlobal: pie.pieDePresupuesto({ lineas: lines, modo: 'sumar', nombreImpuesto: 'IVA', descuentoGlobal: global }).filas,
    registro: intenta(() => rb.buildDetallesDesgloseXml(bd.entries.map((e) => rb.clasificarDetalleDesglose(e, 'QA')))),
  };
}

let s = 1446; const azar = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
const precio = () => Math.round(1 + azar() * 49999) / 100;

// ── A · DOMINIO, una línea: cada tipo admitido × precios de 0,01 a 30,00 € ───────────────────
for (const t of ADMITIDOS) {
  for (let c = 1; c <= 3000; c++) { const ls = [L(c / 100, t)]; emite('dominio-1-linea', ls, dominio(ls, 10)); }
}
// ── B · DOMINIO, de 1 a 5 líneas al azar con cualquier tipo admitido ─────────────────────────
for (let i = 0; i < 6000; i++) {
  const k = 1 + Math.floor(azar() * 5);
  const ls = Array.from({ length: k }, () => L(precio(), ADMITIDOS[Math.floor(azar() * ADMITIDOS.length)], 1 + Math.floor(azar() * 3)));
  emite('dominio-mezcla', ls, dominio(ls, 10));
}
// ── C · PAPEL: factura y presupuesto de 100,00 € con cada tipo (los casos con nombre) ────────
for (const t of ADMITIDOS) {
  const ls = [L(100, t)];
  emite('papel-factura-100', ls, await papelFactura(ls, il.grossOfLines(ls).toFixed(2)));
  emite('papel-presupuesto-100', ls, await papelPresupuesto(ls, u.calcTotal(ls).toFixed(2)));
  emite('papel-presupuesto-100-global-10', ls,
    await papelPresupuesto(ls, u.calcTotal(ls, 10).toFixed(2), { discountGlobalAmount: 10 }));
}
// ── D · PAPEL al azar: 150 documentos de 1 a 5 líneas, la mitad sólo con 10 % y 21 % ─────────
for (let i = 0; i < 150; i++) {
  const k = 1 + Math.floor(azar() * 5);
  const tipos = i % 2 === 0 ? [0.1, 0.21] : ADMITIDOS;
  const ls = Array.from({ length: k }, () => L(precio(), tipos[Math.floor(azar() * tipos.length)], 1 + Math.floor(azar() * 3)));
  emite('papel-factura-azar', ls, await papelFactura(ls, il.grossOfLines(ls).toFixed(2)));
  emite('papel-presupuesto-azar', ls, await papelPresupuesto(ls, u.calcTotal(ls).toFixed(2)));
}
console.error(`casos volcados: ${n} · PDF generados y leídos: ${nPdf}`);
