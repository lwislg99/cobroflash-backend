// docs/master/evidencias/scrum1302m/medicion.mjs — SCRUM-1302m
//
// QUÉ IMPRIME EL PDF DE UN PRESUPUESTO EN CADA MODO DE IVA. No razona: fabrica la fila, calcula su
// total con la función que usa `POST /quote/create` (`calcTotal`), genera el PDF con la cadena de
// las tres puertas (`paramsDePresupuestoParaPdf` → `generateQuotePdf`) y LEE el texto del fichero.
//
// Uso, desde la raíz del árbol y con `dist/` compilado:
//     node docs/master/evidencias/scrum1302m/medicion.mjs
//
// Sólo LEE el camino del documento. No toca base ni red.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const deDist = (r) => import(pathToFileURL(path.join(RAIZ, 'dist', r)).href);
const { generateQuotePdf } = await deDist('modules/invoicing/infra/pdf/pdf.service.js');
const { paramsDePresupuestoParaPdf } = await deDist('modules/quotes/domain/presupuestoParaPdf.js');
const { calcTotal } = await deDist('core/utils/utils.js');
const { calcVatBreakdown } = await deDist('modules/invoicing/domain/vat.service.js');
const { extraerTextoPdf } = await import(pathToFileURL(path.join(RAIZ, 'tests/_texto-del-pdf.mjs')).href);

function fila(lines, ivaModo) {
  return {
    id: 1302, merchantId: 1, customerId: 1, status: 'sent', currency: 'EUR',
    total: calcTotal(lines, null).toFixed(2),
    lines, ivaModo, quoteNumber: 1302, revision: 0, tiers: null, discountGlobalAmount: null,
    docFields: null, docHeaderText: null, docFooterText: null, clausulasExcluidas: null,
    acceptedAt: null, signatureUrl: null, evidenciaFirma: null,
    createdAt: new Date(), updatedAt: new Date(),
    merchant: { id: 1, name: 'Oficio de la medicion', legalName: null, logoUrl: null, address: null,
      country: 'ES', timezone: 'Europe/Madrid', clausulasPresupuesto: null },
    customer: { name: 'Cliente de la medicion' },
  };
}

async function textoDe(q) {
  const { outPath } = await generateQuotePdf(paramsDePresupuestoParaPdf({ quote: q, merchant: q.merchant, customer: q.customer }));
  try {
    const r = extraerTextoPdf(fs.readFileSync(outPath));
    if (!r.ok) throw new Error('CIEGO: no supe leer el PDF: ' + r.motivo);
    return r.texto;
  } finally { fs.rmSync(outPath, { force: true }); }
}

const CASOS = [
  { nombre: 'A · linea al 21 %, modo sumar', lines: [{ concept: 'Revision', qty: 1, price: 100, tax: 0.21 }], modo: 'sumar' },
  { nombre: 'B · linea al 21 %, modo no_incluido', lines: [{ concept: 'Revision', qty: 1, price: 100, tax: 0.21 }], modo: 'no_incluido' },
  { nombre: 'C · linea al 0 %, modo no_incluido', lines: [{ concept: 'Revision', qty: 1, price: 100, tax: 0 }], modo: 'no_incluido' },
  { nombre: 'D · linea al 21 %, sin modo (anterior a la casilla)', lines: [{ concept: 'Revision', qty: 1, price: 100, tax: 0.21 }], modo: null },
];

console.log('POBLACION casos=' + CASOS.length);
let leidos = 0;
for (const c of CASOS) {
  const q = fila(c.lines, c.modo);
  const bd = calcVatBreakdown(c.lines);
  const texto = await textoDe(q);
  const pie = texto.split(/\r?\n/).filter((l) => /Total|Base imponible|IVA/.test(l));
  if (pie.length === 0) throw new Error('CIEGO: el PDF de «' + c.nombre + '» no trae ninguna línea de totales');
  leidos += 1;
  console.log('\n== ' + c.nombre);
  console.log('   guardado (calcTotal): ' + q.total + ' · base (calcVatBreakdown): ' + bd.base.toFixed(2) + ' · cuota: ' + bd.cuota.toFixed(2));
  for (const l of pie) console.log('   PDF> ' + l.trim());
}
console.log('\nLEIDOS=' + leidos + ' de ' + CASOS.length);
