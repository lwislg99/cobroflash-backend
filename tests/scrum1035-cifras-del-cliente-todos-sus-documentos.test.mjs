// SCRUM-1035 · LAS CIFRAS DE LA FICHA DEL CLIENTE CUENTAN TODOS SUS DOCUMENTOS, NO LOS ÚLTIMOS 20.
//
// `GET /admin/customers/:id/detail` sumaba Facturado / Cobrado / Presupuestos sobre `take: 20`: un cliente
// fijo con 25 facturas veía una cifra que mentía. Ahora las cifras se agregan en la base; las listas
// (la pestaña de documentos) siguen en 20. Sin banco: el handler REAL contra un mini-Prisma en memoria
// que respeta `where` (incluido `merchantId`), `take` y `aggregate`. Con el código de antes, las cifras
// salen de las 20 filas de `findMany` y este test cae.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../dist/core/db/prisma.js';
import routerModulo from '../dist/modules/system/app/routes/customersAdmin.routes.js';

const router = routerModulo.default ?? routerModulo;
const CLIENTE = 5;
const MERCHANT = 1;
const OTRO = 2;

// 25 facturas del cliente: 10 pagadas de 100 €, 15 pendientes de 50 €; y otro merchant con las suyas.
const facturas = [];
for (let i = 1; i <= 25; i++) {
  facturas.push({ id: i, merchantId: MERCHANT, customerId: CLIENTE, number: `F-${i}`, status: i <= 10 ? 'paid' : 'pending',
    total: i <= 10 ? 100 : 50, currency: 'EUR', createdAt: new Date(2026, 0, i), paidAt: null, pdfUrl: null });
}
facturas.push({ id: 99, merchantId: OTRO, customerId: CLIENTE, number: 'X', status: 'pending', total: 7777, currency: 'EUR', createdAt: new Date(), paidAt: null, pdfUrl: null });
const presupuestos = [];
for (let i = 1; i <= 23; i++) {
  presupuestos.push({ id: i, merchantId: MERCHANT, customerId: CLIENTE, quoteNumber: i, status: i <= 9 ? 'accepted' : 'sent',
    total: 10, currency: 'EUR', createdAt: new Date(2026, 0, i), acceptedAt: null });
}

const casa = (fila, where = {}) => Object.entries(where).every(([k, v]) => fila[k] === v);
const suma = (filas) => filas.reduce((a, f) => a + f.total, 0);

function dobles() {
  return {
    customer: { findFirst: async ({ where }) => (where.merchantId === MERCHANT && where.id === CLIENTE
      ? { id: CLIENTE, name: 'Fijo', portalToken: null } : null) },
    quote: {
      findMany: async ({ where, take }) => presupuestos.filter((q) => casa(q, where)).slice(0, take),
      count: async ({ where }) => presupuestos.filter((q) => casa(q, where)).length,
    },
    invoice: {
      findMany: async ({ where, take }) => facturas.filter((f) => casa(f, where)).slice(0, take),
      aggregate: async ({ where }) => {
        const filas = facturas.filter((f) => casa(f, where));
        return { _sum: { total: filas.length ? suma(filas) : null }, _count: filas.length };
      },
    },
    expense: { aggregate: async () => ({ _sum: { amount: null } }) },
    customerEvent: { findMany: async () => [] },
  };
}

async function detalle(merchantId, id = CLIENTE) {
  const originales = {};
  const d = dobles();
  for (const k of Object.keys(d)) { originales[k] = prisma[k]; prisma[k] = d[k]; }
  let status = 200;
  let cuerpo = null;
  const res = { status(c) { status = c; return res; }, json(b) { cuerpo = b; return res; } };
  try {
    const capa = router.stack.find((l) => l.route?.path === '/:id/detail' && l.route.methods.get);
    assert.ok(capa, 'no encuentro GET /:id/detail');
    await capa.route.stack[capa.route.stack.length - 1].handle({ params: { id: String(id) }, merchantId, userRole: 'admin' }, res);
  } finally {
    for (const k of Object.keys(originales)) prisma[k] = originales[k];
  }
  return { status, cuerpo };
}

test('SCRUM-1035 · SUELO: la ficha responde y la lista sigue paginada en 20', async () => {
  const { status, cuerpo } = await detalle(MERCHANT);
  assert.equal(status, 200);
  assert.equal(cuerpo.invoices.length, 20, 'la pestaña de documentos sigue en 20');
  assert.equal(cuerpo.quotes.length, 20);
});

test('SCRUM-1035 · con 25 facturas y 23 presupuestos, las cifras suman TODOS', async () => {
  const { cuerpo } = await detalle(MERCHANT);
  assert.equal(cuerpo.stats.totalBilled, 10 * 100 + 15 * 50, 'facturado = las 25');
  assert.equal(cuerpo.stats.totalPaid, 10 * 100, 'cobrado = las pagadas');
  assert.equal(cuerpo.stats.totalPending, 15 * 50, 'pendiente = las 15 sin cobrar');
  assert.equal(cuerpo.stats.pendingCount, 15);
  assert.equal(cuerpo.stats.totalQuotes, 23);
  assert.equal(cuerpo.stats.acceptedQuotes, 9);
});

test('SCRUM-1035 · otro merchant no suma nada (multi-tenant): sus 7.777 € no entran, y no ve al cliente', async () => {
  const { cuerpo } = await detalle(MERCHANT);
  assert.equal(cuerpo.stats.totalBilled, 1750, 'los 7.777 € del otro merchant no entran');
  assert.equal(cuerpo.stats.totalPending, 750);
  const ajeno = await detalle(OTRO);
  assert.equal(ajeno.status, 404, 'el cliente no es del otro merchant');
});
