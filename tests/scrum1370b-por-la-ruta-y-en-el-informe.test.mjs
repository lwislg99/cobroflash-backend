// tests/scrum1370b-por-la-ruta-y-en-el-informe.test.mjs — SCRUM-1370 (aceptaciones 1 y 4)
//
// 🔴 LO QUE EL PRIMER FICHERO DEJÓ DICHO QUE NO MIRABA.
//
// `scrum1370-total-aceptado-es-la-suma` entra por la FUNCIÓN (`ensureJobForQuote`) y comprueba
// LEYENDO el código que la ruta la llama. Aquí se entra por la PUERTA —`POST /quote/:token/decision`
// de `dist/`, la que pulsa el cliente— y se lee la fila del Trabajo DESPUÉS (aceptación 1). Y sobre
// esa misma base se pide el informe por operario, `getOperariosMetrics` (aceptación 4).
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// Una base en memoria CON ESTADO, doblada por `_envio-doblado.mjs`: lo que la ruta escribe lo leen
// después `ensureJobForQuote` y el informe. Sin red y sin base real.
// ⚠️ El `groupBy` es del DOBLE: evalúa el `where` (merchant y estado), agrupa por `operarioId` y suma
// las columnas pedidas. Esto mide que el informe ENSEÑA lo que la aceptación ESCRIBIÓ; no mide el
// `groupBy` de Postgres.
// ⚠️ El merchant es español sin facturación (`receipt`): la ruta NO entra en la emisión. Este
// fichero sólo LEE el camino (regla 38): no se exporta ni se toca nada de `src/`.
process.env.WHATSAPP_DRY_RUN = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';

const RUTAS = '../dist/modules/quotes/app/routes/quotes.routes.js';
const METRICAS = '../dist/modules/metrics/domain/metrics.service.js';
const copia = (x) => JSON.parse(JSON.stringify(x));
const TOKEN = 'd'.repeat(32);
const OTRO_MERCHANT = MERCHANT + 1;

const MERCHANT_FILA = { id: MERCHANT, name: 'Fontanería 1370', legalName: null, taxId: null, country: 'ES',
  whatsappPhone: null, defaultCurrency: 'EUR', flags: null, timezone: 'Europe/Madrid' };
const CLIENTE_FILA = { id: CLIENTE, name: 'Cliente 1370', phone: null };

/** El estado de la base en el caso en curso. */
let bd = { quotes: [], jobs: [], members: [] };

const P = (id, extra = {}) => ({
  id, merchantId: MERCHANT, customerId: CLIENTE, status: 'sent', total: '100.00', currency: 'EUR',
  lines: [{ concept: 'Trabajo', qty: 1, price: 100, tax: 0 }], quoteNumber: id, revision: 0,
  decisionToken: null, validUntil: new Date(Date.now() + 10 * 86400000).toISOString(), paymentTerms: 'FULL_UPFRONT',
  tiers: null, discountGlobalAmount: null, acceptedAt: null, rejectedAt: null, rejectionReason: null,
  jobId: null, teamMemberId: null, ...extra,
});
const T = (id, extra = {}) => ({
  id, merchantId: MERCHANT, customerId: CLIENTE, quoteId: null, status: 'pendiente_agendar',
  totalAceptado: null, totalCobrado: '0.00', operarioId: null, ...extra,
});

const conRelaciones = (q) => ({ ...copia(q), merchant: copia(MERCHANT_FILA), customer: copia(CLIENTE_FILA), Invoice: [] });
const casaEstado = (fila, cond) => {
  if (cond === undefined) return true;
  if (typeof cond === 'string') return fila.status === cond;
  if (Array.isArray(cond.in)) return cond.in.includes(fila.status);
  if (cond.not !== undefined) return fila.status !== cond.not;
  return true;
};

inyectarBase({
  'quote.findUnique': ({ where }) => {
    const q = where.decisionToken != null
      ? bd.quotes.find((x) => x.decisionToken === where.decisionToken)
      : bd.quotes.find((x) => x.id === where.id);
    return q ? conRelaciones(q) : null;
  },
  'quote.findMany': ({ where = {} }) => bd.quotes
    .filter((q) => where.jobId === undefined || q.jobId === where.jobId)
    .filter((q) => where.merchantId === undefined || q.merchantId === where.merchantId)
    .map(copia),
  'quote.update': ({ where, data }) => {
    const q = bd.quotes.find((x) => x.id === where.id && casaEstado(x, where.status));
    if (!q) { const e = new Error('no casa'); e.code = 'P2025'; throw e; }
    Object.assign(q, copia(data));
    return conRelaciones(q);
  },
  'quote.aggregate': ({ where }) => {
    const filas = bd.quotes.filter((q) => where.id.in.includes(q.id) && q.merchantId === where.merchantId && q.status === where.status);
    const centimos = filas.reduce((a, q) => a + Math.round(Number(q.total) * 100), 0);
    return { _sum: { total: filas.length ? (centimos / 100).toFixed(2) : null }, _count: { _all: filas.length } };
  },
  'job.findUnique': ({ where }) => {
    const j = where.id != null ? bd.jobs.find((x) => x.id === where.id) : bd.jobs.find((x) => x.quoteId === where.quoteId);
    return j ? copia(j) : null;
  },
  'job.create': ({ data }) => { const j = { id: 900 + bd.jobs.length, totalCobrado: '0.00', ...copia(data) }; bd.jobs.push(j); return copia(j); },
  'job.update': ({ where, data }) => { const j = bd.jobs.find((x) => x.id === where.id); Object.assign(j, copia(data)); return copia(j); },
  'job.groupBy': ({ where, _sum, _count }) => {
    const grupos = new Map();
    for (const j of bd.jobs.filter((x) => x.merchantId === where.merchantId && casaEstado(x, where.status))) {
      const g = grupos.get(j.operarioId) ?? { operarioId: j.operarioId, _sum: {}, _count: { id: 0 } };
      for (const col of Object.keys(_sum ?? {})) {
        // Como Postgres: la suma de una columna toda a NULL es NULL, no 0.
        if (j[col] != null) g._sum[col] = Number(((g._sum[col] ?? 0) + Number(j[col])).toFixed(2));
        else if (!(col in g._sum)) g._sum[col] = null;
      }
      if (_count) g._count.id += 1;
      grupos.set(j.operarioId, g);
    }
    return [...grupos.values()];
  },
  'teamMember.findMany': ({ where }) => bd.members.filter((m) => m.merchantId === where.merchantId).map(copia),
  'merchant.findUnique': () => copia(MERCHANT_FILA),
  'customerEvent.create': () => ({}),
}, [RUTAS, METRICAS, '../dist/modules/system/customerEvents.service.js', '../dist/modules/jobs/domain/job.service.js']);

/** El cliente decide por la ruta real. Devuelve el estado HTTP. */
async function decidir(decision) {
  const router = moduloDeDist(RUTAS).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/:token/decision');
  assert.ok(capa, '🔴 CIEGO: no encuentro POST /:token/decision');
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const r = { status: 200, data: undefined };
  const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; }, setHeader() {} };
  const callar = console.error; console.error = () => {};
  try {
    await h({ params: { token: TOKEN }, body: { decision }, headers: {}, ip: '127.0.0.1', socket: {} }, res);
    await new Promise((ok) => setTimeout(ok, 60)); // `ensureJobForQuote` es fire-and-forget
  } finally { console.error = callar; }
  return r;
}
const informe = async () => (await moduloDeDist(METRICAS).getOperariosMetrics(MERCHANT));
const filaDe = (lista, operarioId) => {
  const filas = (Array.isArray(lista) ? lista : (lista.operarios ?? lista.list ?? lista.rows ?? [])).filter((f) => f.operarioId === operarioId);
  assert.equal(filas.length, 1, `🔴 CIEGO: el informe no trae UNA fila del operario ${operarioId}: ${JSON.stringify(lista).slice(0, 300)}`);
  return filas[0];
};
const trabajo = (id) => bd.jobs.find((j) => j.id === id);
const num = (v) => (v == null ? v : Number(v));

test('SCRUM-1370b · 🔴 ACEPTACIÓN 1 · Trabajo directo + adicional que el cliente ACEPTA por la ruta → la fila del Trabajo deja de ser NULL', async () => {
  bd = { quotes: [P(5, { jobId: 50, total: '121.00', decisionToken: TOKEN })], jobs: [T(50)], members: [] };
  const r = await decidir('accept');
  assert.equal(r.status, 200, `la aceptación no ha entrado: ${JSON.stringify(r.data)}`);
  assert.equal(bd.quotes[0].status, 'accepted', 'SUELO: la ruta ha escrito la aceptación');
  assert.equal(r.data.invoice, null, 'SUELO: en modo `receipt` la ruta no emite nada');
  assert.equal(num(trabajo(50).totalAceptado), 121, '🔴 el cliente aceptó 121 € por la ruta y el Trabajo sigue sin importe aceptado');
  assert.equal(bd.jobs.length, 1, 'no nace un segundo Trabajo');
});

test('SCRUM-1370b · ACEPTACIÓN 2 (control) · presupuesto sin Trabajo aceptado por la ruta → nace el Trabajo con su total, como siempre', async () => {
  bd = { quotes: [P(1, { total: '200.00', decisionToken: TOKEN })], jobs: [], members: [] };
  const r = await decidir('accept');
  assert.equal(r.status, 200);
  assert.equal(bd.jobs.length, 1, 'SUELO: la aceptación crea el Trabajo');
  assert.equal(num(bd.jobs[0].totalAceptado), 200);
});

test('SCRUM-1370b · ACEPTACIÓN 3 · Trabajo directo + adicional que el cliente RECHAZA por la ruta → la columna sigue NULL', async () => {
  bd = { quotes: [P(5, { jobId: 50, total: '121.00', decisionToken: TOKEN })], jobs: [T(50)], members: [] };
  const r = await decidir('reject');
  assert.equal(r.status, 200);
  assert.equal(bd.quotes[0].status, 'rejected', 'SUELO: la ruta ha escrito el rechazo');
  assert.equal(trabajo(50).totalAceptado, null);
});

test('SCRUM-1370b · 🔴 un ADICIONAL aceptado por la ruta se SUMA al original ya aceptado', async () => {
  bd = {
    quotes: [P(1, { jobId: 50, status: 'accepted', total: '1000.00' }), P(2, { jobId: 50, total: '250.50', decisionToken: TOKEN })],
    jobs: [T(50, { quoteId: 1, totalAceptado: '1000.00' })], members: [],
  };
  await decidir('accept');
  assert.equal(num(trabajo(50).totalAceptado), 1250.5);
});

// ── ACEPTACIÓN 4 · el informe por operario ────────────────────────────────────────────────────

test('SCRUM-1370b · CONTROL del informe: suma por operario, separa operarios y no cruza merchants', async () => {
  bd = {
    quotes: [],
    jobs: [
      T(1, { operarioId: 9, totalAceptado: '100.00', totalCobrado: '40.00' }),
      T(2, { operarioId: 9, totalAceptado: '50.00' }),
      T(3, { operarioId: null, totalAceptado: '7.00' }),
      T(4, { operarioId: 9, totalAceptado: '9999.00', merchantId: OTRO_MERCHANT }),
    ],
    members: [{ id: 9, merchantId: MERCHANT, name: 'Operaria Nueve', role: 'tecnico', status: 'active' }],
  };
  const lista = await informe();
  const nueve = filaDe(lista, 9);
  assert.deepEqual([nueve.trabajos, nueve.totalAceptado, nueve.totalCobrado, nueve.pendiente], [2, 150, 40, 110]);
  assert.equal(filaDe(lista, null).totalAceptado, 7, 'la fila del propietario es la de `operarioId` null');
});

test('SCRUM-1370b · 🔴 ACEPTACIÓN 4 · el informe deja de contar 0 para el Trabajo directo con adicional aceptado', async () => {
  // Lo que el ticket describe: el Trabajo ya tiene dinero cobrado y la columna vacía → «pendiente» negativo.
  bd = {
    quotes: [P(5, { jobId: 50, total: '121.00', decisionToken: TOKEN, teamMemberId: 9 })],
    jobs: [T(50, { operarioId: 9, totalCobrado: '21.00' })],
    members: [{ id: 9, merchantId: MERCHANT, name: 'Operaria Nueve', role: 'tecnico', status: 'active' }],
  };
  const antes = filaDe(await informe(), 9);
  assert.deepEqual([antes.totalAceptado, antes.pendiente], [0, -21], 'SUELO: antes de aceptar, el informe cuenta 0 aceptado y un pendiente NEGATIVO');
  await decidir('accept');
  const despues = filaDe(await informe(), 9);
  assert.equal(despues.totalAceptado, 121, '🔴 el cliente aceptó 121 € y el informe del operario sigue contando 0');
  assert.equal(despues.pendiente, 100, '🔴 el pendiente del operario no es aceptado − cobrado');
  assert.equal(despues.trabajos, 1);
});

test('SCRUM-1370b · 🔴 ACEPTACIÓN 4 · con original y adicional, el informe enseña la SUMA y el pendiente deja de salir «de menos»', async () => {
  bd = {
    quotes: [P(1, { jobId: 50, status: 'accepted', total: '1000.00' }), P(2, { jobId: 50, total: '250.50', decisionToken: TOKEN })],
    jobs: [T(50, { quoteId: 1, operarioId: 9, totalAceptado: '1000.00', totalCobrado: '1100.00' })],
    members: [{ id: 9, merchantId: MERCHANT, name: 'Operaria Nueve', role: 'tecnico', status: 'active' }],
  };
  assert.equal(filaDe(await informe(), 9).pendiente, -100, 'SUELO: cobrado el original y parte del adicional, el pendiente sale negativo');
  await decidir('accept');
  const f = filaDe(await informe(), 9);
  assert.deepEqual([f.totalAceptado, f.totalCobrado, f.pendiente], [1250.5, 1100, 150.5]);
});
