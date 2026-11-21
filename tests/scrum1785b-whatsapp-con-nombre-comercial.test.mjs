// SCRUM-1785b · En el PDF del PRESUPUESTO, el WhatsApp del comercio se rotula con su nombre COMERCIAL.
//
// Firma del fundador (SCRUM-1785 c.22281), respuesta literal: «El nombre comercial sí». Literal
// firmado: `WhatsApp de <nombre comercial>: <número>`, sólo en el PDF del presupuesto; la razón social
// sigue en «Emisor:». Medición de partida (c.22276, jv-j1gm): el rótulo era «WhatsApp <número>», sin
// nombre, y el nombre comercial no salía en el PDF si había razón social.
//
// El cambio vive en `generateQuotePdf` (`src/modules/invoicing/infra/pdf/pdf.service.ts`). Ese
// fichero aloja también `generateInvoicePdf` (camino de emisión): que su cuerpo no se mueva lo vigilan
// `scrum603b` y `scrum723`; aquí, el caso ④ comprueba que el literal nuevo NO cae fuera de la
// función del presupuesto.
//
// Tokens SIN espacios e improbables: si aparecen en el papel no es coincidencia.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extraerTextoPdf } from './_texto-del-pdf.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { paramsDePresupuestoParaPdf } = await import('../dist/modules/quotes/domain/presupuestoParaPdf.js');

/** Contrato de `scripts/meta-guard-mutaciones.mjs`: volver a pintar el rótulo sin nombre lo tumba. */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'doc.text(`WhatsApp de ${nombreComercial}: ${params.merchant.whatsappPhone}`);',
    a: 'doc.text(`WhatsApp ${params.merchant.whatsappPhone}`);',
    cae: 'SCRUM-1785b · 🔴 PDF del presupuesto: el WhatsApp del comercio sale como «WhatsApp de <nombre comercial>: <número>»',
  },
];

const COMERCIAL = 'QAComercial1785b';
const RAZON = 'QARazon1785bSL';
const TEL_COMERCIO = '34000178522';
const CONCEPTO = 'Bajante1785b';
const CLIENTE = { id: 5, name: 'QA1785bCLIENTE', phone: '34000178511', mobile: '34000178511', email: 'qa1785b@correo.es' };
const MERCHANT = { name: COMERCIAL, legalName: RAZON, taxId: 'B00000000', country: 'ES', whatsappPhone: TEL_COMERCIO };

async function textoDelPresupuesto(merchant) {
  const quote = {
    id: 17853, quoteNumber: 1785, currency: 'EUR', total: '121.00',
    lines: [{ concept: CONCEPTO, qty: 1, price: 100, tax: 0.21 }], docFields: null,
  };
  const { generateQuotePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateQuotePdf(paramsDePresupuestoParaPdf({ quote, merchant, customer: CLIENTE }));
  let leido;
  try { leido = extraerTextoPdf(fs.readFileSync(outPath)); } finally { fs.rmSync(outPath, { force: true }); }
  // `ok:false` es «NO SUPE LEERLO», no «no dice nada».
  assert.equal(leido.ok, true, `CIEGO: el lector no sabe leer este PDF (${leido.motivo})`);
  assert.ok(leido.texto.includes(CONCEPTO), `SUELO: el lector no ve ni el concepto (${leido.texto.length} car.)`);
  return leido.texto;
}

test('SCRUM-1785b · 🔴 PDF del presupuesto: el WhatsApp del comercio sale como «WhatsApp de <nombre comercial>: <número>»', async () => {
  const t = await textoDelPresupuesto(MERCHANT);
  const literal = `WhatsApp de ${COMERCIAL}: ${TEL_COMERCIO}`;
  assert.ok(t.includes(literal), `🔴 no sale el literal firmado «${literal}» (c.22281)`);
  assert.equal(t.includes(`WhatsApp ${TEL_COMERCIO}`), false, '🔴 sigue saliendo el rótulo viejo «WhatsApp <número>»');
});

test('SCRUM-1785b · PDF del presupuesto: la línea del WhatsApp NO lleva la razón social', async () => {
  const t = await textoDelPresupuesto(MERCHANT);
  assert.ok(t.includes(TEL_COMERCIO), 'SUELO: el número del comercio no sale: este caso no mediría nada');
  assert.equal(t.includes(`WhatsApp de ${RAZON}`), false, '🔴 la línea del WhatsApp lleva la razón social, y la firma dice nombre comercial');
});

test('SCRUM-1785b · PDF del presupuesto: «Emisor:» no cambia — sigue la razón social', async () => {
  const t = await textoDelPresupuesto(MERCHANT);
  assert.ok(t.includes(`Emisor: ${RAZON}`), '🔴 «Emisor:» ya no lleva la razón social');
  assert.equal(t.includes(`Emisor: ${COMERCIAL}`), false, '🔴 «Emisor:» ha pasado al nombre comercial');
});

// ④ CONTROL — el PDF de FACTURA no entra (c.22281: «Solo el presupuesto»). Se mide en el FUENTE: el
// literal nuevo aparece una sola vez y dentro de `generateQuotePdf`; el cuerpo de `generateInvoicePdf`
// no lo contiene. Que ese cuerpo no haya cambiado ni un byte lo vigilan `scrum603b` y `scrum723`.
test('SCRUM-1785b · CONTROL: el rótulo nuevo vive sólo en generateQuotePdf, no en el PDF de factura', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/infra/pdf/pdf.service.ts'), 'utf8');
  const iFac = src.indexOf('export async function generateInvoicePdf(');
  const iPre = src.indexOf('export async function generateQuotePdf(');
  assert.ok(iFac >= 0 && iPre > iFac, `CIEGO: no encuentro las dos funciones en su orden (factura ${iFac}, presupuesto ${iPre})`);
  const ocurrencias = src.split('WhatsApp de ${').length - 1;
  assert.equal(ocurrencias, 1, `🔴 el literal «WhatsApp de \${…}» sale ${ocurrencias} veces en pdf.service.ts`);
  const i = src.indexOf('WhatsApp de ${');
  assert.ok(i > iPre, '🔴 el rótulo nuevo cae fuera de generateQuotePdf (antes de su cabecera: zona de la factura)');
  assert.equal(src.slice(iFac, iPre).includes('WhatsApp de'), false, '🔴 el cuerpo de generateInvoicePdf contiene el rótulo');
});
