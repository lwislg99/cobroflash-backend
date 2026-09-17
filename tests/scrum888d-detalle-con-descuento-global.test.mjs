// tests/scrum888d-detalle-con-descuento-global.test.mjs — SCRUM-888 · PR de servidor (puntos 1 y 3)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL DETALLE DEL PRESUPUESTO DEVUELVE SU DESCUENTO GLOBAL
//
// `GET /admin/quotes/:id` es una proyección EXPLÍCITA (`getQuoteDetailAdmin`), y no traía
// `discountGlobalAmount` (medido por la Sesión 2 en staging e437a51f; las líneas sí traen `dto`).
// Dos pantallas lo pagaban:
//   · «⎘ Duplicar» (punto 3) copia lo que devuelve ese GET, así que la copia nacía SIN el global y
//     a mayor precio (D6 de SCRUM-883: el editor abría con 568,18 € un presupuesto de 539,05 €).
//   · el detalle del presupuesto (punto 1, front de la Sesión 2) no puede cuadrar base e IVA con un
//     total que sí lleva el global si no sabe cuánto es.
//
// Por el camino REAL: la app de `dist/`, su auth y su handler, por HTTP (`_banco-camino-real.mjs`).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDePrisma, montarAppReal, sesionesDe } from './_banco-camino-real.mjs';

// La app se monta una vez por proceso y escucha: sin cerrarla, el proceso de test no termina.
after(async () => { const app = await montarAppReal(); await app.cerrar(); });

const MERCHANT = 7;
const TECNICO = { id: 42, name: 'Israel', role: 'tecnico', status: 'active' };

const LINEAS = [
  { concept: 'Punto de luz', qty: 8, price: 24.95, dto: 15, tax: 0.21 },
  { concept: 'Base de enchufe schuko', qty: 11, price: 19.99, dto: 10, tax: 0.21 },
  { concept: 'Boletín eléctrico (CIE)', qty: 1, price: 120, tax: 0.21 },
];

const presupuesto = (id, discountGlobalAmount) => ({
  id, merchantId: MERCHANT, customerId: 3, status: 'sent', total: '559.70',
  currency: 'EUR', lines: LINEAS, quoteNumber: id, revision: 0, teamMemberId: null,
  discountGlobalAmount,
  createdAt: new Date(), updatedAt: new Date(), internalNotes: null, tiers: null,
  selectedTierId: null, signatureUrl: null, pdfUrl: null, chargeId: null, decisionToken: 'tok' + id,
  customer: { id: 3, name: 'Cliente', phone: '34000000001', email: null },
  merchant: { id: MERCHANT, name: 'QA 888', country: 'ES', defaultCurrency: 'EUR' },
  charge: null,
  Invoice: [],
});

// Prisma devuelve un `Decimal`, que viaja por JSON como texto. El doble lo imita con `toJSON`.
const DECIMAL_25 = { toString: () => '25', valueOf: () => 25, toJSON: () => '25' };
const PRESUPUESTOS = { 501: presupuesto(501, DECIMAL_25), 502: presupuesto(502, null) };

async function banco() {
  const ses = sesionesDe(MERCHANT, TECNICO);
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: { findUnique: async () => ses.merchant },
    teamMember: { findFirst: async () => null },
    quote: {
      findFirst: async (a) => PRESUPUESTOS[a?.where?.id] ?? null,
      findUnique: async (a) => PRESUPUESTOS[a?.where?.id] ?? null,
      findMany: async (a) => Object.values(PRESUPUESTOS).filter((q) => a?.where?.quoteNumber == null || q.quoteNumber === a.where.quoteNumber),
    },
    quoteAssignee: { findMany: async () => [] },
  });
  return montarAppReal();
}

test('SCRUM-888d · 🔴 GET /admin/quotes/:id devuelve `discountGlobalAmount` (con global y sin él)', async () => {
  const app = await banco();
  const p = { token: 'TOKEN-PROPIETARIO' };

  const con = await app.pedir('/admin/quotes/501', p);
  assert.equal(con.status, 200, `🔴 CIEGO: el detalle devolvió ${con.status}`);
  // SUELO: es el presupuesto que se pidió, con sus líneas. Sin esto, un 200 de otra cosa pasaría.
  assert.equal(con.json.id, 501, '🔴 CIEGO: el detalle no es el del presupuesto pedido');
  assert.equal(con.json.lines?.[0]?.dto, 15, '🔴 CIEGO: el detalle ya no trae el dto de línea');
  assert.equal(con.json.discountGlobalAmount, '25',
    `🔴 el detalle no trae el descuento global: «Duplicar» copiaría el presupuesto sin él (${JSON.stringify(con.json.discountGlobalAmount)})`);

  const sin = await app.pedir('/admin/quotes/502', p);
  assert.equal(sin.status, 200);
  assert.equal(Object.prototype.hasOwnProperty.call(sin.json, 'discountGlobalAmount'), true,
    '🔴 sin global la clave desaparece: la pantalla no distingue «sin descuento» de «no me lo han mandado»');
  assert.equal(sin.json.discountGlobalAmount, null, '🔴 un presupuesto sin global tiene que devolver null');
});
