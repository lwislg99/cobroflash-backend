// tests/scrum1180-detalle-con-clausulas-excluidas.test.mjs — SCRUM-1180 (trozo de servidor)
//
// El detalle del presupuesto (`GET /admin/quotes/:id` → `getQuoteDetailAdmin`) devuelve
// `clausulasExcluidas`: los `id` de las cláusulas del negocio que ESTE presupuesto no lleva.
//
// Misma familia que SCRUM-888d y SCRUM-1187: «⎘ Duplicar» (`quotesDetailView.js`) arma la copia con
// lo que devuelve este GET. Sin la clave, la copia salía con TODAS las cláusulas aunque el original
// hubiera quitado una — y el PDF de la copia imprimiría una condición que el profesional descartó.
//
// Mismo banco que SCRUM-1187: la función que sirve el GET, con `prisma` de doble, sin puerto.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const { getQuoteDetailAdmin } = await import(DIST + 'modules/system/quoteAdmin.js');

const MERCHANT = 7;

const presupuesto = (id, clausulasExcluidas) => ({
  id, merchantId: MERCHANT, customerId: 3, status: 'sent', total: '121.00',
  currency: 'EUR', lines: [{ concept: 'Revisión caldera', qty: 1, price: 100, tax: 0.21 }],
  quoteNumber: id, revision: 0, teamMemberId: null, discountGlobalAmount: null,
  docHeaderText: null, docFooterText: null, clausulasExcluidas,
  createdAt: new Date('2026-09-28T10:00:00Z'), updatedAt: new Date('2026-09-28T10:00:00Z'),
  internalNotes: null, tiers: null, selectedTierId: null, signatureUrl: null, pdfUrl: null,
  chargeId: null, decisionToken: 'tok' + id, paymentTerms: 'FULL_UPFRONT', customBillingPlan: null, tags: null,
  customer: { id: 3, name: 'Cliente', phone: '34000000001', email: null, notes: null },
  merchant: { id: MERCHANT, name: 'QA 1180', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null,
  Invoice: [],
});

async function detalleDe(quote) {
  const original = moduloPrisma.prisma.quote;
  moduloPrisma.prisma.quote = {
    findFirst: async ({ where }) => (where?.id === quote.id && where?.merchantId === MERCHANT ? quote : null),
    findMany: async () => [quote],
    findUnique: async () => ({ decisionToken: quote.decisionToken }),
    update: async () => { throw new Error('el detalle no debería escribir'); },
  };
  try {
    // Tal y como sale por el cable (`res.json`).
    return JSON.parse(JSON.stringify(await getQuoteDetailAdmin(quote.id, MERCHANT)));
  } finally {
    moduloPrisma.prisma.quote = original;
  }
}

test('🔴 SCRUM-1180 · el detalle devuelve las cláusulas que ESTE presupuesto quitó', async () => {
  const d = await detalleDe(presupuesto(701, ['garantia', 'desplazamiento']));
  assert.equal(d.id, 701, '🔴 CIEGO: el detalle no es el del presupuesto pedido');
  assert.equal(d.lines?.[0]?.concept, 'Revisión caldera', '🔴 CIEGO: el detalle ya no trae las líneas');
  assert.deepEqual(d.clausulasExcluidas, ['garantia', 'desplazamiento'],
    '🔴 el detalle no trae `clausulasExcluidas`: «Duplicar» copiaría el presupuesto con las cláusulas que el original quitó');
});

test('SCRUM-1180 · sin exclusiones (o columna vacía) es `[]`, nunca `null` ni ausente', async () => {
  for (const vacio of [null, undefined, []]) {
    const d = await detalleDe(presupuesto(702, vacio));
    assert.ok(Object.prototype.hasOwnProperty.call(d, 'clausulasExcluidas'),
      '🔴 sin exclusiones la clave desaparece: la pantalla no distingue «las lleva todas» de «no me lo han mandado»');
    assert.deepEqual(d.clausulasExcluidas, [], `🔴 con ${JSON.stringify(vacio)} debería ser []`);
  }
});
