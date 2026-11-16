// SCRUM-1442c · REPRODUCIR la tarjeta de opción del PDF del PRESUPUESTO con una cabecera de apartado.
//
// Uso (desde la raíz del árbol, con `dist/` compilado):
//     node docs/master/evidencias/SCRUM-1442/reproducir-tarjeta-pdf.mjs <etiqueta>
// Escribe en docs/master/evidencias/SCRUM-1442/:
//     <etiqueta>-con-cabecera.pdf / .txt   — tres opciones; «better» lleva la cabecera «Fase 1»
//     <etiqueta>-sin-cabecera.txt          — CONTROL: las mismas opciones sin la cabecera
//
// Cadena: el cuerpo pasa por `CreateQuoteSchema` (lo que guarda `POST /quote/create`), el total de
// cada opción sale de `calcTotal` (lo que hace `calcTierTotal`, privado en quotes.routes.ts:21) y
// el PDF por `paramsDePresupuestoParaPdf` → `generateQuotePdf`, como las cuatro rutas que lo piden.
// Sólo LEE: ni base ni red.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extraerTextoPdf } from '../../../../tests/_texto-del-pdf.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const OUT = path.join(RAIZ, 'docs/master/evidencias/SCRUM-1442');
const d = (p) => import('file://' + path.join(RAIZ, 'dist', p).replace(/\\/g, '/'));
const { generateQuotePdf } = await d('modules/invoicing/infra/pdf/pdf.service.js');
const { paramsDePresupuestoParaPdf } = await d('modules/quotes/domain/presupuestoParaPdf.js');
const { calcTotal } = await d('core/utils/utils.js');
const { CreateQuoteSchema } = await d('core/validation/schemas.js');

const etiqueta = process.argv[2] || 'antes';

function cuerpo(conCabecera) {
  const linea = (concept, price) => ({ concept, qty: 1, price, tax: 0.21 });
  return {
    merchant_id: 71, customer_id: 71, currency: 'EUR',
    tiers: [
      { id: 'good', label: 'Básica', lines: [linea('Revisión', 100)] },
      { id: 'better', label: 'Completa', recommended: true,
        lines: [...(conCabecera ? [{ concept: 'Fase 1', apartado: true }] : []), linea('Revisión', 100), linea('Cambio de pieza', 80)] },
      { id: 'best', label: 'Integral', lines: [linea('Revisión', 100), linea('Cambio de pieza', 80), linea('Garantía', 50)] },
    ],
  };
}

async function generar(conCabecera) {
  const v = CreateQuoteSchema.safeParse(cuerpo(conCabecera));
  if (!v.success) throw new Error('el esquema RECHAZA el cuerpo: ' + JSON.stringify(v.error.issues));
  const tiers = v.data.tiers.map((t) => ({ ...t, total: calcTotal(t.lines, null) }));
  const better = tiers.find((t) => t.id === 'better');
  const q = {
    id: 1442, merchantId: 71, customerId: 71, status: 'sent', currency: 'EUR',
    total: better.total.toFixed(2), lines: better.lines, ivaModo: 'sumar', tiers,
    discountGlobalAmount: null, quoteNumber: 7, revision: 0,
    docFields: null, docHeaderText: null, docFooterText: null, clausulasExcluidas: null,
    acceptedAt: null, signatureUrl: null, evidenciaFirma: null,
    createdAt: new Date('2026-11-12T12:00:00Z'), updatedAt: new Date('2026-11-12T12:00:00Z'),
    merchant: { id: 71, name: 'Oficio', legalName: null, logoUrl: null, address: null,
      country: 'ES', timezone: 'Europe/Madrid', clausulasPresupuesto: null },
    customer: { name: 'Cliente' },
  };
  const { outPath } = await generateQuotePdf(paramsDePresupuestoParaPdf({ quote: q, merchant: q.merchant, customer: q.customer }));
  const bytes = fs.readFileSync(outPath);
  fs.rmSync(outPath, { force: true });
  const r = extraerTextoPdf(bytes);
  if (!r.ok) throw new Error('CIEGO: no supe leer el PDF: ' + r.motivo);
  return { bytes, texto: r.texto, guardada: JSON.stringify(v.data.tiers[1].lines[0]) };
}

// Un byte de control del PDF (la ★ salía como «&» + 0x05) se escribe como `\xNN` visible, nunca
// crudo: crudo no se ve en un diff y lo tumba scrum942 (A22).
const visible = (t) => t.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, (c) => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'));

const con = await generar(true);
const sin = await generar(false);
fs.writeFileSync(path.join(OUT, `${etiqueta}-con-cabecera.pdf`), con.bytes);
fs.writeFileSync(path.join(OUT, `${etiqueta}-con-cabecera.txt`), visible(con.texto));
fs.writeFileSync(path.join(OUT, `${etiqueta}-sin-cabecera.txt`), visible(sin.texto));

const cuenta = (s, x) => s.split(x).length - 1;
console.log(`cabecera tal como la guarda el esquema: ${con.guardada}`);
for (const [n, t] of [['con cabecera', con.texto], ['sin cabecera (control)', sin.texto]]) {
  console.log(`${n}: ${t.length} car. · «undefined» ×${cuenta(t, 'undefined')} · «NaN» ×${cuenta(t, 'NaN')} · «Fase 1» ×${cuenta(t, 'Fase 1')} · «Revisión × 1» ×${cuenta(t, 'Revisión × 1')}`);
}
