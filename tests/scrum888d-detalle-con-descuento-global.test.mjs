// tests/scrum888d-detalle-con-descuento-global.test.mjs — SCRUM-888 · PR de servidor (puntos 1 y 3)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL DETALLE DEL PRESUPUESTO DEVUELVE SU DESCUENTO GLOBAL
//
// `GET /admin/quotes/:id` sirve `getQuoteDetailAdmin`, una proyección EXPLÍCITA que no traía
// `discountGlobalAmount` (medido por la Sesión 2 en staging e437a51f; las líneas sí traen `dto`).
// Dos pantallas lo pagaban:
//   · «⎘ Duplicar» (punto 3) copia lo que devuelve ese GET, así que la copia nacía SIN el global y
//     a mayor precio (D6 de SCRUM-883: el editor abría con 568,18 € un presupuesto de 539,05 €).
//   · el detalle del presupuesto (punto 1, front de la Sesión 2) no puede cuadrar base e IVA con un
//     total que sí lleva el global si no sabe cuánto es.
//
// ── POR QUÉ SIN SERVIDOR HTTP ─────────────────────────────────────────────────────────────────
// La primera versión iba por la app real (`_banco-camino-real.mjs`) y en la suite completa el
// proceso reventaba AL SALIR en Windows (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`,
// libuv) con el test en verde. Lo que se vigila es la PROYECCIÓN, así que se llama a la función que
// sirve el GET con `prisma` de doble (patrón de scrum263): sin puerto, sin handles que cerrar.
// Que el GET sirve esta función lo fija la ruta (`quotesAdmin.routes.ts`, `getQuoteDetailAdmin`).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const { getQuoteDetailAdmin } = await import(DIST + 'modules/system/quoteAdmin.js');

const LINEAS = [
  { concept: 'Punto de luz', qty: 8, price: 24.95, dto: 15, tax: 0.21 },
  { concept: 'Base de enchufe schuko', qty: 11, price: 19.99, dto: 10, tax: 0.21 },
  { concept: 'Boletín eléctrico (CIE)', qty: 1, price: 120, tax: 0.21 },
];

const presupuesto = (id, discountGlobalAmount) => ({
  id, merchantId: 7, customerId: 3, status: 'sent', total: '559.70',
  currency: 'EUR', lines: LINEAS, quoteNumber: id, revision: 0, teamMemberId: null,
  discountGlobalAmount,
  createdAt: new Date('2026-09-17T10:00:00Z'), updatedAt: new Date('2026-09-17T10:00:00Z'),
  internalNotes: null, tiers: null, selectedTierId: null, signatureUrl: null, pdfUrl: null,
  chargeId: null, decisionToken: 'tok' + id, paymentTerms: 'FULL_UPFRONT', customBillingPlan: null, tags: null,
  customer: { id: 3, name: 'Cliente', phone: '34000000001', email: null, notes: null },
  merchant: { id: 7, name: 'QA 888', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null,
  Invoice: [],
});

// Prisma devuelve un `Decimal`, que viaja por JSON como texto: el doble lo imita con `toJSON`.
const DECIMAL_25 = { toString: () => '25', valueOf: () => 25, toJSON: () => '25' };

/** El detalle tal y como sale por el cable: pasado por JSON, igual que `res.json`. */
async function detalleDe(quote) {
  moduloPrisma.prisma.quote = {
    findFirst: async () => quote,
    findMany: async () => [quote],
    findUnique: async () => ({ decisionToken: quote.decisionToken }),
    update: async () => { throw new Error('el detalle no debería escribir con token ya puesto'); },
  };
  return JSON.parse(JSON.stringify(await getQuoteDetailAdmin(quote.id, 7)));
}

test('SCRUM-888d · 🔴 el detalle del presupuesto (GET /admin/quotes/:id) devuelve `discountGlobalAmount`', async () => {
  const con = await detalleDe(presupuesto(501, DECIMAL_25));
  // SUELO: es el presupuesto pedido, con sus líneas y su dto. Sin esto, un objeto de otra cosa pasaría.
  assert.equal(con.id, 501, '🔴 CIEGO: el detalle no es el del presupuesto pedido');
  assert.equal(con.lines?.[0]?.dto, 15, '🔴 CIEGO: el detalle ya no trae el dto de línea');
  assert.equal(con.discountGlobalAmount, '25',
    `🔴 el detalle no trae el descuento global: «Duplicar» copiaría el presupuesto sin él (${JSON.stringify(con.discountGlobalAmount)})`);

  const sin = await detalleDe(presupuesto(502, null));
  assert.equal(Object.prototype.hasOwnProperty.call(sin, 'discountGlobalAmount'), true,
    '🔴 sin global la clave desaparece: la pantalla no distingue «sin descuento» de «no me lo han mandado»');
  assert.equal(sin.discountGlobalAmount, null, '🔴 un presupuesto sin global tiene que devolver null');
});

test('SCRUM-888d · SUELO: el GET /admin/quotes/:id sirve esta función', () => {
  const rutas = fs.readFileSync(path.join(RAIZ, 'src/modules/system/app/routes/quotesAdmin.routes.ts'), 'utf8');
  const inicio = rutas.indexOf("router.get('/:id',");
  assert.ok(inicio >= 0, '🔴 CIEGO: no encuentro GET /:id en quotesAdmin.routes.ts');
  assert.match(rutas.slice(inicio, inicio + 600), /getQuoteDetailAdmin\(/,
    '🔴 el GET del detalle ya no sirve getQuoteDetailAdmin: este test mide otra cosa');
});
