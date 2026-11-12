// SCRUM-1442c · LA TARJETA DE OPCIÓN DEL PDF DEL PRESUPUESTO NO PINTA «× undefined» NI «NaN».
//
// El defecto, reproducido con el PDF de verdad antes de tocar nada (docs/master/evidencias/SCRUM-1442,
// `antes-*`): una opción con una cabecera de apartado —el esquema la guarda como
// `{"concept":"Fase 1","tax":0,"apartado":true}`, sin `qty` ni `price` (SCRUM-655)— salía
//
//     Fase 1 × undefined
//                 NaN EUR
//
// La vía es la decidida el 18-oct-2026 para la página pública (1442b): la cabecera pinta su
// concepto y el importe vacío. GO del fundador para tocar SOLO esta tarjeta: SCRUM-1442 c.21648.
//
// Sin gate: el cuerpo pasa por `CreateQuoteSchema`, y el PDF por `paramsDePresupuestoParaPdf` →
// `generateQuotePdf`, la cadena de las rutas. Lee su texto. Ni base ni red.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { extraerTextoPdf } from './_texto-del-pdf.mjs';

const { generateQuotePdf } = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');
const { paramsDePresupuestoParaPdf } = await import('../dist/modules/quotes/domain/presupuestoParaPdf.js');
const { calcTotal } = await import('../dist/core/utils/utils.js');
const { CreateQuoteSchema } = await import('../dist/core/validation/schemas.js');

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Las corre el meta-guard (SCRUM-1387). Cada campo, LITERAL: el lector no resuelve constantes.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { // M1 · la cabecera vuelve a pintar «× undefined».
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: "const text = conImporte ? `${l.concept} × ${l.qty}` : String(l.concept ?? '');",
    a: 'const text = `${l.concept} × ${l.qty}`;',
    cae: 'SCRUM-1442c · ① una cabecera de apartado dentro de una opción',
  },
  { // M2 · la cabecera vuelve a pintar «NaN EUR».
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'if (conImporte) doc.text(`${fmtImporte(importe)} ${params.currency}`',
    a: 'doc.text(`${fmtImporte(importe)} ${params.currency}`',
    cae: 'SCRUM-1442c · ① una cabecera de apartado dentro de una opción',
  },
  { // M3 · las líneas normales pierden su importe (el control tiene que verlo).
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'const conImporte = Number.isFinite(importe);',
    a: 'const conImporte = false;',
    cae: 'SCRUM-1442c · ② control',
  },
];

const linea = (concept, price) => ({ concept, qty: 1, price, tax: 0.21 });

async function textoDelPdf(conCabecera) {
  const v = CreateQuoteSchema.safeParse({
    merchant_id: 71, customer_id: 71, currency: 'EUR',
    tiers: [
      { id: 'good', label: 'Básica', lines: [linea('Revisión', 100)] },
      { id: 'better', label: 'Completa', recommended: true,
        lines: [...(conCabecera ? [{ concept: 'Fase 1', apartado: true }] : []), linea('Revisión', 100), linea('Cambio de pieza', 80)] },
      { id: 'best', label: 'Integral', lines: [linea('Revisión', 100), linea('Cambio de pieza', 80), linea('Garantía', 50)] },
    ],
  });
  assert.equal(v.success, true, 'CIEGO: el esquema rechaza el cuerpo, y lo que sigue no mediría la ruta');
  const tiers = v.data.tiers.map((t) => ({ ...t, total: calcTotal(t.lines, null) }));
  const q = {
    id: 1442, merchantId: 71, customerId: 71, status: 'sent', currency: 'EUR',
    total: tiers[1].total.toFixed(2), lines: tiers[1].lines, ivaModo: 'sumar', tiers,
    discountGlobalAmount: null, quoteNumber: 7, revision: 0,
    docFields: null, docHeaderText: null, docFooterText: null, clausulasExcluidas: null,
    acceptedAt: null, signatureUrl: null, evidenciaFirma: null,
    createdAt: new Date(), updatedAt: new Date(),
    merchant: { id: 71, name: 'Oficio', legalName: null, logoUrl: null, address: null,
      country: 'ES', timezone: 'Europe/Madrid', clausulasPresupuesto: null },
    customer: { name: 'Cliente' },
  };
  const { outPath } = await generateQuotePdf(paramsDePresupuestoParaPdf({ quote: q, merchant: q.merchant, customer: q.customer }));
  try {
    const r = extraerTextoPdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un vacío se leería como «no lo dice».`);
    return r.texto;
  } finally { fs.rmSync(outPath, { force: true }); }
}

test('SCRUM-1442c · ① una cabecera de apartado dentro de una opción pinta su concepto, sin «undefined» ni «NaN»', async () => {
  const pdf = await textoDelPdf(true);
  assert.ok(pdf.includes('Fase 1'), `CIEGO: la cabecera no está en el papel, y su ausencia no probaría nada:\n  ${pdf}`);
  assert.ok(!pdf.includes('undefined'), `🔴 «undefined» en el PDF que recibe el cliente:\n  ${pdf}`);
  assert.ok(!pdf.includes('NaN'), `🔴 «NaN» en el PDF que recibe el cliente:\n  ${pdf}`);
  assert.ok(!pdf.includes('Fase 1 ×'), `🔴 la cabecera lleva cantidad: no la tiene\n  ${pdf}`);
  // El total de la opción no cambia por llevar la cabecera: 121,00 + 96,80.
  assert.ok(pdf.includes('Total: 217,80 EUR'), pdf);
});

test('SCRUM-1442c · ② control: sin cabecera, las tres tarjetas pintan cantidad e importe como siempre', async () => {
  const pdf = await textoDelPdf(false);
  // El positivo de las negaciones de ①, con las MISMAS líneas: «× 1» y su importe siguen saliendo.
  assert.equal(pdf.split('Revisión × 1121,00 EUR').length - 1, 3, `🔴 faltan líneas normales con su importe:\n  ${pdf}`);
  assert.equal(pdf.split('Cambio de pieza × 196,80 EUR').length - 1, 2, pdf);
  assert.ok(pdf.includes('Garantía × 160,50 EUR'), pdf);
  for (const t of ['Total: 121,00 EUR', 'Total: 217,80 EUR', 'Total: 278,30 EUR']) assert.ok(pdf.includes(t), `falta «${t}»:\n  ${pdf}`);
  assert.ok(!pdf.includes('undefined') && !pdf.includes('NaN'), pdf);
});

test('SCRUM-1442c · ③ el arreglo vive en el PRESUPUESTO, no en la factura', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/infra/pdf/pdf.service.ts'), 'utf8');
  const sf = ts.createSourceFile('pdf.ts', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const cuerpos = {};
  const visitar = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.body) cuerpos[n.name.text] = n.body.getText(sf);
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  assert.ok((cuerpos.generateInvoicePdf || '').length > 2000, 'CIEGO: no encuentro el cuerpo de `generateInvoicePdf`');
  assert.ok((cuerpos.generateQuotePdf || '').includes('conImporte'), 'control: `conImporte` está en el presupuesto');
  assert.ok(!cuerpos.generateInvoicePdf.includes('conImporte'), '🔴 el arreglo de la tarjeta ha llegado a la factura');
});
