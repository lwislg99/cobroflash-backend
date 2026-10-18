// tests/scrum1444c-numero-visible-en-las-respuestas.test.mjs — SCRUM-1444c
//
// EL NÚMERO DEL PRESUPUESTO VIAJA HECHO (`numeroVisible`: `#12`, `#12.1`) EN LAS RESPUESTAS DE S1.
//
// Decisión del orquestador (18-oct-2026, opción A): se AÑADE al lado del número crudo, que se queda
// mientras las pantallas migran. Cada caso comprueba las dos cosas: el nuevo, y que el crudo sigue.
//
// 🔴 LA TRAMPA QUE ESTE TEST EXISTE PARA CAZAR (SCRUM-1444 c.18501): varias consultas NO traían
// `revision`, y una revisión `.1` habría salido como `#12`. Por eso el presupuesto de todos los
// casos es la revisión 1 del 12, y el doble de Prisma HONRA EL `select`: si una consulta no pide
// `revision`, no la recibe — igual que la base.
//
// La app REAL (`_banco-camino-real.mjs`): las rutas por HTTP, y las funciones de dominio
// directamente con el mismo Prisma doblado.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { montarAppReal, bancoDePrisma, sesionesDe } from './_banco-camino-real.mjs';

const require = createRequire(import.meta.url);
const app = await montarAppReal();
after(() => app.cerrar());
const M = 1444;
const ses = sesionesDe(M, { id: 9, role: 'tecnico', name: 'T', status: 'active', merchantId: M });
const ESPERADO = '#12.1';

/** Lo que devolvería la base: sólo lo que el `select` pide (y lo anidado, igual). */
function proyectar(fila, select) {
  if (!fila || !select) return fila;
  const out = {};
  for (const [k, v] of Object.entries(select)) {
    if (!v) continue;
    if (v === true) out[k] = fila[k] ?? null;
    else if (typeof v === 'object' && 'select' in v) {
      const sub = fila[k];
      out[k] = Array.isArray(sub) ? sub.map((s) => proyectar(s, v.select)) : proyectar(sub, v.select);
    } else out[k] = fila[k] ?? null;
  }
  return out;
}

const CLIENTE = { id: 30, merchantId: M, name: 'Cliente 1444', phone: null, mobile: null };
const PRESUPUESTO = {
  id: 501, merchantId: M, customerId: 30, quoteNumber: 12, revision: 1, seriesYear: 2026,
  status: 'sent', total: 121, currency: 'EUR', lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
  tiers: null, paymentTerms: null, customBillingPlan: null, discountGlobalAmount: null, signatureUrl: null,
  createdAt: new Date('2026-10-10T10:00:00Z'), updatedAt: new Date('2026-10-11T10:00:00Z'),
  archivedAt: null, decisionToken: 'd'.repeat(32), jobId: null, teamMemberId: null,
  customer: CLIENTE, charge: null, Invoice: [],
};
const MERCHANT = { ...ses.merchant, id: M, country: 'ES', email: 'qa1444@test.local', flags: null, timezone: 'Europe/Madrid', name: 'QA 1444' };

const quoteTabla = (filas = [PRESUPUESTO]) => ({
  findMany: async (a) => filas.map((f) => proyectar(f, a?.select)),
  findFirst: async (a) => proyectar(filas.find((f) => !a?.where?.id || f.id === a.where.id) ?? null, a?.select),
  findUnique: async (a) => proyectar(filas.find((f) => f.id === a?.where?.id) ?? null, a?.select),
  count: async () => filas.length,
  aggregate: async () => ({ _sum: { total: 0 }, _count: { id: 0 } }),
  update: async (a) => ({ ...filas[0], ...a.data }),
});
const SUMAS = { aggregate: async () => ({ _sum: { total: 0, amount: 0 }, _count: { id: 0 } }), groupBy: async () => [] };

// ── Fila 1 · GET /admin/quotes (`listQuotesAdmin`) ──────────────────────────────────────────
test('SCRUM-1444c · fila 1 · la lista de presupuestos lleva `numeroVisible` y conserva `number`', async () => {
  bancoDePrisma().programar({ authSession: ses.tabla, merchant: { findUnique: async () => MERCHANT }, quote: quoteTabla() });
  const { listQuotesAdmin } = require('../dist/modules/system/quoteAdmin.js');
  const [fila] = await listQuotesAdmin(M);
  assert.equal(fila.numeroVisible, ESPERADO);
  assert.equal(fila.number, 12, 'transición (A): el número crudo sigue');
});

// ── Fila 2 · GET /admin/albaranes/presupuestos ─────────────────────────────────────────────
test('SCRUM-1444c · fila 2 · el buscador de presupuestos de «Nuevo albarán» lleva `numeroVisible` y conserva `numero`', async () => {
  bancoDePrisma().programar({ authSession: ses.tabla, merchant: { findUnique: async () => MERCHANT }, quote: quoteTabla() });
  const r = await app.pedir('/admin/albaranes/presupuestos', { token: ses.PROPIETARIO });
  assert.equal(r.status, 200, `suelo: ${r.status} ${r.texto?.slice(0, 200)}`);
  const [fila] = r.json.presupuestos;
  assert.equal(fila.numeroVisible, ESPERADO);
  assert.equal(fila.numero, 12);
});

// ── Fila 3 · GET /admin/quotes/:id (`getQuoteDetailAdmin`) ─────────────────────────────────
test('SCRUM-1444c · fila 3 · la ficha lleva `numeroVisible`, y cada revisión el suyo', async () => {
  const original = { ...PRESUPUESTO, id: 500, revision: 0, status: 'rejected' };
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: { findUnique: async () => MERCHANT },
    quote: {
      ...quoteTabla([PRESUPUESTO, original]),
      findFirst: async (a) => ({ ...PRESUPUESTO, merchant: MERCHANT }),
      findMany: async (a) => [original, PRESUPUESTO].map((f) => proyectar(f, a?.select)),
    },
  });
  const { getQuoteDetailAdmin } = require('../dist/modules/system/quoteAdmin.js');
  const d = await getQuoteDetailAdmin(PRESUPUESTO.id, M);
  assert.equal(d.numeroVisible, ESPERADO);
  assert.equal(d.number, 12);
  assert.deepEqual(d.revisiones.map((x) => x.numeroVisible), ['#12', '#12.1']);
});

// ── Fila 5 · Inicio del admin y del operario (`getHomeMetrics`, `getInicioOperario`) ──────
test('SCRUM-1444c · fila 5 · la actividad reciente de Inicio lleva `numeroVisible` y conserva `quoteNumber`', async () => {
  bancoDePrisma().programar({
    authSession: ses.tabla, merchant: { findUnique: async () => MERCHANT },
    quote: quoteTabla(), invoice: SUMAS, charge: SUMAS, expense: SUMAS, product: SUMAS, quoteRequest: SUMAS,
  });
  const { getHomeMetrics, getInicioOperario } = require('../dist/modules/metrics/domain/metrics.service.js');
  const home = await getHomeMetrics(M);
  assert.equal(home.recentActivity[0].numeroVisible, ESPERADO);
  assert.equal(home.recentActivity[0].quoteNumber, 12);
  const inicio = await getInicioOperario(M, null);
  assert.equal(inicio.recentActivity[0].numeroVisible, ESPERADO);
  assert.equal(inicio.recentActivity[0].quoteNumber, 12);
});

// ── Filas 6 y 7 · GET /admin/jobs/:id y GET /admin/jobs (`serializeJob`, `QUOTE_SELECT`) ────
const TRABAJO = {
  id: 70, merchantId: M, customerId: 30, quoteId: PRESUPUESTO.id, titulo: 'Caldera', status: 'pendiente_agendar',
  operarioId: null, assignedUserId: null, totalAceptado: 121, totalCobrado: 0, tipoOperacion: 'TRABAJO_UNICO',
  scheduledAt: null, direccion: null, createdAt: new Date('2026-10-12T10:00:00Z'), updatedAt: new Date('2026-10-12T10:00:00Z'),
};
const programarTrabajos = () => bancoDePrisma().programar({
  authSession: ses.tabla, merchant: { findUnique: async () => MERCHANT },
  quote: quoteTabla(), customer: { findMany: async () => [CLIENTE], findFirst: async () => CLIENTE, findUnique: async () => CLIENTE },
  job: { findFirst: async () => TRABAJO, findUnique: async () => TRABAJO, findMany: async () => [TRABAJO], count: async () => 1 },
});

test('SCRUM-1444c · fila 6 · 🔴 la ficha del Trabajo: `quote.numeroVisible` con la revisión PEDIDA, no supuesta', async () => {
  programarTrabajos();
  const r = await app.pedir(`/admin/jobs/${TRABAJO.id}`, { token: ses.PROPIETARIO });
  assert.equal(r.status, 200, `suelo: ${r.status} ${r.texto?.slice(0, 300)}`);
  assert.equal(r.json.quote?.numeroVisible, ESPERADO, `🔴 la ficha del Trabajo: ${JSON.stringify(r.json.quote)}`);
  assert.equal(r.json.quote.number, 12);
});

test('SCRUM-1444c · fila 7 · 🔴 la lista de Trabajos: lo mismo, por el camino del lote', async () => {
  programarTrabajos();
  const r = await app.pedir('/admin/jobs', { token: ses.PROPIETARIO });
  assert.equal(r.status, 200, `suelo: ${r.status} ${r.texto?.slice(0, 300)}`);
  const lista = Array.isArray(r.json) ? r.json : (r.json.jobs ?? r.json.items ?? r.json.trabajos);
  assert.ok(Array.isArray(lista) && lista.length === 1, `suelo: forma de la lista ${JSON.stringify(r.json).slice(0, 200)}`);
  assert.equal(lista[0].quote?.numeroVisible, ESPERADO, `🔴 la lista de Trabajos: ${JSON.stringify(lista[0].quote)}`);
});

// ── Fila 8 · GET /admin/albaranes/:id ──────────────────────────────────────────────────────
test('SCRUM-1444c · fila 8 · 🔴 la ficha del albarán: `quote.numeroVisible` con la revisión pedida', async () => {
  bancoDePrisma().programar({
    authSession: ses.tabla, merchant: { findUnique: async () => MERCHANT }, quote: quoteTabla(),
    albaran: { findFirst: async () => ({ id: 8, merchantId: M, jobId: 70, numero: 'A-0008', fecha: new Date(), modoValoracion: 'SIN_VALORAR', lineas: [], estado: 'emitido', version: 1, firmadoAt: null, notas: null, invoiceId: null, enviadoParaFirmaAt: null }) },
    job: { findFirst: async () => ({ ...TRABAJO, assignees: [] }) },
  });
  const r = await app.pedir('/admin/albaranes/8', { token: ses.PROPIETARIO });
  assert.equal(r.status, 200, `suelo: ${r.status} ${r.texto?.slice(0, 200)}`);
  assert.equal(r.json.quote?.numeroVisible, ESPERADO, `🔴 ${JSON.stringify(r.json.quote)}`);
  assert.equal(r.json.quote.number, 12);
});

// ── Fila 10 · POST /admin/quotes/:id/revisiones (`crearRevisionDeQuote`) ───────────────────
test('SCRUM-1444c · fila 10 · la revisión recién creada vuelve con su `numeroVisible`', async () => {
  const vigente = { ...PRESUPUESTO, revision: 0, id: 500 };
  bancoDePrisma().programar({
    authSession: ses.tabla, merchant: { findUnique: async () => MERCHANT },
    quote: {
      findFirst: async (a) => proyectar(vigente, a?.select),
      findMany: async (a) => [proyectar(vigente, a?.select)],
      create: async (a) => proyectar({ ...a.data, id: 502 }, a?.select),
    },
  });
  const { crearRevisionDeQuote } = require('../dist/modules/system/quoteAdmin.js');
  const creada = await crearRevisionDeQuote(M, vigente.id);
  assert.equal(creada.revision, 1, `suelo: ${JSON.stringify(creada)}`);
  assert.equal(creada.numeroVisible, '#12.1');
  assert.equal(creada.numero, '12.1', 'transición (A): el `numero` de siempre sigue');
});
