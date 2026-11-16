// SCRUM-1737 · LA TARJETA DE OPCIÓN DEL PDF DEL PRESUPUESTO PINTA LOS IMPORTES DE LÍNEA SIN IVA.
//
// Visto en staging el 16-nov-2026 (SCRUM-1442 c.21874): en la tarjeta «Completa» del presupuesto 1917,
// «Desmontaje × 2» salía 90,00 € en la página pública y 108,90 EUR en el PDF. El total coincidía.
// Decisión de Javier (jefe J), literal: «sin IVA como está, solo al final» (SCRUM-1737). La tabla
// principal del PDF ya pintaba el importe de línea sin IVA; la tarjeta, no.
//
// Sin gate: el cuerpo es el de c.21825/c.21874 tal cual, pasa por `CreateQuoteSchema` y el PDF por
// `paramsDePresupuestoParaPdf` → `generateQuotePdf`, la cadena de las rutas. Lee su texto.
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
  { // M1 · la tarjeta vuelve a sumar el IVA de cada línea.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'const importe = l.qty * l.price;',
    a: 'const importe = l.qty * l.price * (1 + (l.tax ?? 0));',
    cae: 'SCRUM-1737 · ① el presupuesto de c.21874',
  },
  { // M2 · la tarjeta pinta el precio unitario en vez del importe de la línea.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'const importe = l.qty * l.price;',
    a: 'const importe = l.price;',
    cae: 'SCRUM-1737 · ① el presupuesto de c.21874',
  },
];

const BASE = { merchant_id: 2, customer_id: 3935, currency: 'EUR', created_via: 'text' };
// El cuerpo de SCRUM-1442 c.21825, el mismo con el que se creó el presupuesto 1917 de staging.
const DE_STAGING = { ...BASE, tiers: [
  { id: 'good', label: 'Básica', lines: [{ concept: 'Revisión de la instalación', qty: 1, price: 80, tax: 0.21 }] },
  { id: 'better', label: 'Completa', recommended: true, lines: [
    { concept: 'Fase 1', apartado: true },
    { concept: 'Desmontaje', qty: 2, price: 45, tax: 0.21 },
    { concept: 'Material', qty: 1, price: 120, tax: 0.21 }] },
  { id: 'best', label: 'Premium', lines: [
    { concept: 'Revisión de la instalación', qty: 1, price: 80, tax: 0.21 },
    { concept: 'Sustitución completa', qty: 1, price: 450, tax: 0.21 }] },
] };

async function textoDelPdf(cuerpo) {
  const v = CreateQuoteSchema.safeParse(cuerpo);
  assert.equal(v.success, true, `CIEGO: el esquema rechaza el cuerpo, y lo que sigue no mediría la ruta: ${JSON.stringify(v.error?.issues)}`);
  const tiers = v.data.tiers ? v.data.tiers.map((t) => ({ ...t, total: calcTotal(t.lines, null) })) : null;
  const lines = tiers ? tiers[1].lines : v.data.lines;
  const q = {
    id: 1917, merchantId: 2, customerId: 3935, status: 'draft', currency: 'EUR',
    total: (tiers ? tiers[1].total : calcTotal(lines, null)).toFixed(2), lines, ivaModo: 'sumar', tiers,
    discountGlobalAmount: null, quoteNumber: 7, revision: 0,
    docFields: null, docHeaderText: null, docFooterText: null, clausulasExcluidas: null,
    acceptedAt: null, signatureUrl: null, evidenciaFirma: null,
    createdAt: new Date(), updatedAt: new Date(),
    merchant: { id: 2, name: 'Oficio', legalName: null, logoUrl: null, address: null,
      country: 'ES', timezone: 'Europe/Madrid', clausulasPresupuesto: null },
    customer: { name: 'Cliente' },
  };
  const { outPath } = await generateQuotePdf(paramsDePresupuestoParaPdf({ quote: q, merchant: q.merchant, customer: q.customer }));
  let r;
  try { r = extraerTextoPdf(fs.readFileSync(outPath)); } finally { fs.rmSync(outPath, { force: true }); }
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un vacío se leería como «no lo dice».`);
  return r.texto;
}

test('SCRUM-1737 · ① el presupuesto de c.21874: «Desmontaje × 2» sale 90,00 EUR en la tarjeta, sin IVA', async () => {
  const pdf = await textoDelPdf(DE_STAGING);
  assert.ok(pdf.includes('Desmontaje × 2'), `CIEGO: la línea no está en el papel:\n  ${pdf}`);
  assert.ok(!pdf.includes('108,90'), `🔴 la línea sale CON IVA (108,90), y la página la pinta sin él:\n  ${pdf}`);
  assert.ok(pdf.includes('Desmontaje × 290,00 EUR'), `🔴 la línea no sale con su importe sin IVA (2 × 45,00):\n  ${pdf}`);
  assert.ok(pdf.includes('Material × 1120,00 EUR'), pdf);
});

test('SCRUM-1737 · ② el total de cada opción y el bloque de totales no cambian: el IVA, solo al final', async () => {
  const pdf = await textoDelPdf(DE_STAGING);
  for (const t of ['Total: 96,80 EUR', 'Total: 254,10 EUR', 'Total: 641,30 EUR']) assert.ok(pdf.includes(t), `falta «${t}»:\n  ${pdf}`);
  assert.ok(pdf.includes('Base imponible: 210,00 EURIVA 21%: 44,10 EURTotal presupuesto: 254,10 EUR'), `🔴 el bloque de totales ha cambiado:\n  ${pdf}`);
});

test('SCRUM-1737 · ③ controles: opción sin IVA, opción con varias líneas y cabecera de apartado', async () => {
  const pdf = await textoDelPdf({ ...DE_STAGING, tiers: [
    { id: 'good', label: 'Básica', lines: [{ concept: 'Revisión', qty: 1, price: 80, tax: 0 }] },
    ...DE_STAGING.tiers.slice(1),
  ] });
  // Sin IVA: antes y después, el mismo número.
  assert.ok(pdf.includes('Revisión × 180,00 EUR') && pdf.includes('Total: 80,00 EUR'), `🔴 la opción sin IVA:\n  ${pdf}`);
  // Varias líneas: cada una con lo suyo, y el total con el IVA de las dos.
  assert.ok(pdf.includes('Revisión de la instalación × 180,00 EURSustitución completa × 1450,00 EURTotal: 641,30 EUR'), `🔴 la opción con varias líneas:\n  ${pdf}`);
  // La cabecera de 1442c sigue sin cantidad ni importe.
  assert.ok(pdf.includes('CompletaFase 1Desmontaje × 2'), `🔴 la cabecera de apartado:\n  ${pdf}`);
  assert.ok(!pdf.includes('undefined') && !pdf.includes('NaN') && !pdf.includes('Fase 1 ×'), pdf);
});

test('SCRUM-1737 · ④ la tabla principal (sin opciones) no cambia: ya pintaba el importe sin IVA', async () => {
  const pdf = await textoDelPdf({ ...BASE, lines: DE_STAGING.tiers[1].lines.slice(1) });
  assert.ok(!pdf.includes('Opciones disponibles'), `CIEGO: este presupuesto no debería llevar tarjetas:\n  ${pdf}`);
  assert.ok(pdf.includes('ConceptoCant.PrecioIVA%IMPORTEDesmontaje245,0021%90,00Material1120,0021%120,00'), `🔴 la tabla principal ha cambiado:\n  ${pdf}`);
  assert.ok(pdf.includes('Base imponible: 210,00 EURIVA 21%: 44,10 EURTotal presupuesto: 254,10 EUR'), pdf);
});

test('SCRUM-1737 · ⑤ el cambio vive en el PRESUPUESTO, no en la factura', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/infra/pdf/pdf.service.ts'), 'utf8');
  const sf = ts.createSourceFile('pdf.ts', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const cuerpos = {};
  const visitar = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.body) cuerpos[n.name.text] = n.body.getText(sf);
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  assert.ok((cuerpos.generateInvoicePdf || '').length > 2000, 'CIEGO: no encuentro el cuerpo de `generateInvoicePdf`');
  const tarjeta = 'const importe = l.qty * l.price;';
  assert.ok((cuerpos.generateQuotePdf || '').includes(tarjeta), 'control: la tarjeta sin IVA está en el presupuesto');
  assert.ok(!cuerpos.generateInvoicePdf.includes(tarjeta), '🔴 el cambio de la tarjeta ha llegado a la factura');
});
