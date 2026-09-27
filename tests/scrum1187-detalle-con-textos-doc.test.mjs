// tests/scrum1187-detalle-con-textos-doc.test.mjs — SCRUM-1187 · mitad de servidor de SCRUM-1186
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL DETALLE DEL PRESUPUESTO DEVUELVE SU CABECERA Y SU PIE
//
// SCRUM-1174 añadió al presupuesto `docHeaderText` y `docFooterText`: el servidor los guarda
// (`quotes.routes.ts`) y el PDF los pinta (`presupuestoParaPdf.ts`). Pero `GET /admin/quotes/:id`
// sirve `getQuoteDetailAdmin`, una proyección EXPLÍCITA, y no los traía. «⎘ Duplicar» copia lo que
// devuelve ese GET, así que el duplicado salía SIN cabecera ni pie, en silencio.
//
// Mismo precedente y mismo banco que SCRUM-888d (`scrum888d-detalle-con-descuento-global`): se
// llama a la función que sirve el GET con `prisma` de doble, sin puerto (libuv en Windows).
// Y además se mira que la consulta sigue filtrando por el merchant (regla 2): el doble se niega a
// contestar a una consulta sin `merchantId`, que es cómo se vería un id ajeno servido.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const { getQuoteDetailAdmin } = await import(DIST + 'modules/system/quoteAdmin.js');

const MERCHANT = 7;
const OTRO_MERCHANT = 8;

const presupuesto = (id, docHeaderText, docFooterText) => ({
  id, merchantId: MERCHANT, customerId: 3, status: 'sent', total: '121.00',
  currency: 'EUR', lines: [{ concept: 'Revisión caldera', qty: 1, price: 100, tax: 0.21 }],
  quoteNumber: id, revision: 0, teamMemberId: null, discountGlobalAmount: null,
  docHeaderText, docFooterText,
  createdAt: new Date('2026-09-27T10:00:00Z'), updatedAt: new Date('2026-09-27T10:00:00Z'),
  internalNotes: null, tiers: null, selectedTierId: null, signatureUrl: null, pdfUrl: null,
  chargeId: null, decisionToken: 'tok' + id, paymentTerms: 'FULL_UPFRONT', customBillingPlan: null, tags: null,
  customer: { id: 3, name: 'Cliente', phone: '34000000001', email: null, notes: null },
  merchant: { id: MERCHANT, name: 'QA 1187', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null,
  Invoice: [],
});

/** Doble de prisma que sólo devuelve el presupuesto si la consulta lo pide para SU merchant. */
function instalarDoble(quote) {
  const consultas = [];
  moduloPrisma.prisma.quote = {
    findFirst: async (args) => {
      consultas.push(args);
      const w = args?.where ?? {};
      return w.id === quote.id && w.merchantId === quote.merchantId ? quote : null;
    },
    findMany: async () => [quote],
    findUnique: async () => ({ decisionToken: quote.decisionToken }),
    update: async () => { throw new Error('el detalle no debería escribir con token ya puesto'); },
  };
  return consultas;
}

/** El detalle tal y como sale por el cable: pasado por JSON, igual que `res.json`. */
async function detalleDe(quote, merchantId = MERCHANT) {
  instalarDoble(quote);
  return JSON.parse(JSON.stringify(await getQuoteDetailAdmin(quote.id, merchantId)));
}

test('SCRUM-1187 · 🔴 el detalle (GET /admin/quotes/:id) devuelve `docHeaderText` y `docFooterText`', async () => {
  const con = await detalleDe(presupuesto(601, 'Obra: C/ Mayor 3, 2ºB', 'Validez 30 días. Materiales incluidos.'));
  // SUELO: es el presupuesto pedido. Sin esto, un objeto de otra cosa pasaría.
  assert.equal(con.id, 601, '🔴 CIEGO: el detalle no es el del presupuesto pedido');
  assert.equal(con.lines?.[0]?.concept, 'Revisión caldera', '🔴 CIEGO: el detalle ya no trae las líneas');
  assert.equal(con.docHeaderText, 'Obra: C/ Mayor 3, 2ºB',
    `🔴 el detalle no trae la cabecera: «Duplicar» la perdería (${JSON.stringify(con.docHeaderText)})`);
  assert.equal(con.docFooterText, 'Validez 30 días. Materiales incluidos.',
    `🔴 el detalle no trae el pie: «Duplicar» lo perdería (${JSON.stringify(con.docFooterText)})`);

  const sin = await detalleDe(presupuesto(602, null, null));
  for (const k of ['docHeaderText', 'docFooterText']) {
    assert.equal(Object.prototype.hasOwnProperty.call(sin, k), true,
      `🔴 sin ${k} la clave desaparece: la pantalla no distingue «vacío» de «no me lo han mandado»`);
    assert.equal(sin[k], null, `🔴 un presupuesto sin ${k} tiene que devolver null`);
  }
});

test('SCRUM-1187 · regla 2: la consulta filtra por el merchant, y un id ajeno no devuelve sus textos', async () => {
  const quote = presupuesto(603, 'Cabecera privada', 'Pie privado');
  const consultas = instalarDoble(quote);
  await assert.rejects(getQuoteDetailAdmin(603, OTRO_MERCHANT), /quote_not_found/,
    '🔴 otro merchant ha recibido el detalle (y con él la cabecera y el pie) de un presupuesto ajeno');
  assert.equal(consultas.at(-1)?.where?.merchantId, OTRO_MERCHANT,
    '🔴 la consulta del detalle ya no filtra por merchantId');
});

test('SCRUM-1187 · SUELO: el GET /admin/quotes/:id sirve esta función con el merchant de la sesión', () => {
  const rutas = fs.readFileSync(path.join(RAIZ, 'src/modules/system/app/routes/quotesAdmin.routes.ts'), 'utf8');
  const inicio = rutas.indexOf("router.get('/:id',");
  assert.ok(inicio >= 0, '🔴 CIEGO: no encuentro GET /:id en quotesAdmin.routes.ts');
  assert.match(rutas.slice(inicio, inicio + 600), /getQuoteDetailAdmin\([^)]*merchantId/,
    '🔴 el GET del detalle ya no sirve getQuoteDetailAdmin con el merchant: este test mide otra cosa');
});
