// Sonda: texto del PDF del presupuesto de c.21874 y de uno sin opciones, con el dist del árbol.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const R = process.argv[2];
const imp = (p) => import(pathToFileURL(R + '/' + p).href);
const { generateQuotePdf } = await imp('dist/modules/invoicing/infra/pdf/pdf.service.js');
const { paramsDePresupuestoParaPdf } = await imp('dist/modules/quotes/domain/presupuestoParaPdf.js');
const { calcTotal } = await imp('dist/core/utils/utils.js');
const { CreateQuoteSchema } = await imp('dist/core/validation/schemas.js');
const { extraerTextoPdf } = await imp('tests/_texto-del-pdf.mjs');

async function texto(cuerpo, conTiers) {
  const v = CreateQuoteSchema.safeParse(cuerpo);
  if (!v.success) throw new Error('esquema: ' + JSON.stringify(v.error.issues));
  const tiers = conTiers ? v.data.tiers.map((t) => ({ ...t, total: calcTotal(t.lines, null) })) : null;
  const lines = conTiers ? tiers[1].lines : v.data.lines;
  const q = {
    id: 1917, merchantId: 2, customerId: 3935, status: 'draft', currency: 'EUR',
    total: (conTiers ? tiers[1].total : calcTotal(lines, null)).toFixed(2), lines, ivaModo: 'sumar', tiers,
    discountGlobalAmount: null, quoteNumber: 7, revision: 0,
    docFields: null, docHeaderText: null, docFooterText: null, clausulasExcluidas: null,
    acceptedAt: null, signatureUrl: null, evidenciaFirma: null,
    createdAt: new Date('2026-11-16T15:03:23Z'), updatedAt: new Date('2026-11-16T15:03:23Z'),
    merchant: { id: 2, name: 'Oficio', legalName: null, logoUrl: null, address: null,
      country: 'ES', timezone: 'Europe/Madrid', clausulasPresupuesto: null },
    customer: { name: 'Prueba SCRUM-1442 (sin contacto)' },
  };
  const { outPath } = await generateQuotePdf(paramsDePresupuestoParaPdf({ quote: q, merchant: q.merchant, customer: q.customer }));
  try { const r = extraerTextoPdf(fs.readFileSync(outPath)); if (!r.ok) throw new Error(r.motivo); return r.texto; } finally { fs.rmSync(outPath, { force: true }); }
}
const base = { merchant_id: 2, customer_id: 3935, currency: 'EUR', created_via: 'text' };
const conOpciones = { ...base, tiers: [
  { id: 'good', label: 'Básica', lines: [{ concept: 'Revisión de la instalación', qty: 1, price: 80, tax: 0.21 }] },
  { id: 'better', label: 'Completa', recommended: true, lines: [
    { concept: 'Fase 1', apartado: true },
    { concept: 'Desmontaje', qty: 2, price: 45, tax: 0.21 },
    { concept: 'Material', qty: 1, price: 120, tax: 0.21 }] },
  { id: 'best', label: 'Premium', lines: [
    { concept: 'Revisión de la instalación', qty: 1, price: 80, tax: 0.21 },
    { concept: 'Sustitución completa', qty: 1, price: 450, tax: 0.21 }] },
] };
const sinOpciones = { ...base, lines: [
  { concept: 'Desmontaje', qty: 2, price: 45, tax: 0.21 },
  { concept: 'Material', qty: 1, price: 120, tax: 0.21 }] };
console.log('=== CON OPCIONES ===\n' + await texto(conOpciones, true));
console.log('=== SIN OPCIONES ===\n' + await texto(sinOpciones, false));
