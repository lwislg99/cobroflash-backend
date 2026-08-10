// SCRUM-195 (rebanada 1) · LA PERTENENCIA Quote↔Job SE LEE POR `Quote.jobId`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS SEIS PUNTOS DE FALLO QUE SE MIDIERON, Y POR QUÉ IMPORTAN LOS DE ESTA REBANADA
//
// El censo de SCRUM-195 encontró 5 consumidores de `Job.quoteId` en `src/` y 6 puntos que con
// 1:N fallan **en SILENCIO**. Esta rebanada cierra los cuatro de backend (pertenencia y
// dinero); `serializeJob`, el detalle con `invoices[]`/`charge` y la ruta de cobrar-resto son
// las rebanadas 2 y 3.
//
// ⚠️ NADA DE ESTO SALTA HOY POR SÍ SOLO. El `@unique` de `Job.quoteId` **no protege**: impide
// que dos Jobs reclamen el MISMO Quote, no que un Quote ADICIONAL fabrique un segundo Job. Por
// eso cada punto necesita su test: no hay error ruidoso que los delate.
//
// SIN GATE Y CON DOBLES. Los cuatro sitios aceptan cliente inyectable, así que se prueban sin
// BD y sin turno: una red que solo se ejercita con staging levantada no es una red (SCRUM-250).
//
// LA CONVIVENCIA TAMBIÉN SE PRUEBA. El paso 1 del ticket deja los dos sentidos vivos a
// propósito, y entre mergear esto y correr el backfill en cada base hay una VENTANA REAL. Si
// solo se probara el sentido nuevo, esa ventana quedaría sin red — y lo que se pierde ahí es
// dinero (`totalCobrado` a 0 en un Job cobrado).

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ensureJobForQuote,
  quotesDelJob,
  recalcJobCobradoForQuote,
} from '../dist/modules/jobs/domain/job.service.js';

/**
 * Cliente de mentira con la forma mínima. Registra lo que se escribe para poder afirmar sobre
 * ello — que es la diferencia entre «no falló» y «hizo lo que debía».
 */
function prismaFalso({ quotes = [], jobs = [], invoices = [] } = {}) {
  const creados = [];
  const actualizacionesQuote = [];
  const actualizacionesJob = [];
  const cl = {
    creados, actualizacionesQuote, actualizacionesJob,
    quote: {
      async findUnique({ where, select }) {
        const q = quotes.find((x) => x.id === where.id) ?? null;
        return q ? { ...q } : null;
      },
      async findMany({ where, select }) {
        return quotes
          .filter((q) => (where.jobId === undefined || q.jobId === where.jobId))
          .filter((q) => (where.id?.in ? where.id.in.includes(q.id) : true))
          .filter((q) => (where.merchantId === undefined || q.merchantId === where.merchantId))
          .map((q) => ({ ...q }));
      },
      async update({ where, data }) {
        const q = quotes.find((x) => x.id === where.id);
        if (q) Object.assign(q, data);
        actualizacionesQuote.push({ where, data });
        return q;
      },
    },
    job: {
      async findUnique({ where, select }) {
        const j = where.id != null
          ? jobs.find((x) => x.id === where.id)
          : jobs.find((x) => x.quoteId === where.quoteId);
        return j ? { ...j } : null;
      },
      async findMany({ where }) {
        return jobs
          .filter((j) => (where.id?.in ? where.id.in.includes(j.id) : true))
          .filter((j) => (where.quoteId?.in ? where.quoteId.in.includes(j.quoteId) : true))
          .map((j) => ({ ...j }));
      },
      async create({ data }) {
        const j = { id: 900 + jobs.length + 1, ...data };
        jobs.push(j);
        creados.push(j);
        return j;
      },
      async update({ where, data }) {
        actualizacionesJob.push({ where, data });
        const j = jobs.find((x) => x.id === where.id);
        if (j) Object.assign(j, data);
        return j;
      },
    },
    invoice: {
      async aggregate({ where }) {
        const suma = invoices
          .filter((i) => where.quoteId.in.includes(i.quoteId) && i.status === where.status)
          .reduce((a, i) => a + Number(i.total), 0);
        return { _sum: { total: suma } };
      },
    },
  };
  return cl;
}

const QUOTE_BASE = {
  merchantId: 7, customerId: 3, status: 'accepted', total: '1000.00',
  quoteNumber: 1, teamMemberId: null, jobId: null, customer: { name: 'Cliente QA' },
};

// ═════════════════════════════════════════════════════════════════════════════
// ① ensureJobForQuote — EL QUE MÁS IMPORTA
//    Hoy un adicional crea un SEGUNDO Trabajo y el pro ve dos donde hay uno.
// ═════════════════════════════════════════════════════════════════════════════

test('① un presupuesto ADICIONAL no crea un segundo Trabajo', async () => {
  const cl = prismaFalso({
    // El original ya tiene su Job; el adicional apunta al MISMO Job por `jobId`.
    quotes: [
      { ...QUOTE_BASE, id: 1, jobId: 50 },
      { ...QUOTE_BASE, id: 2, jobId: 50, quoteNumber: 2 },
    ],
    jobs: [{ id: 50, quoteId: 1, merchantId: 7 }],
  });

  await ensureJobForQuote(2, cl);

  assert.equal(cl.creados.length, 0,
    '🔴 se creó un SEGUNDO Trabajo para el adicional: el pro vería dos donde hay uno');
});

test('① un quote SIN Job sigue creando su Trabajo, y ANOTA la pertenencia', async () => {
  const cl = prismaFalso({ quotes: [{ ...QUOTE_BASE, id: 1 }], jobs: [] });

  await ensureJobForQuote(1, cl);

  assert.equal(cl.creados.length, 1, 'el caso normal no puede haberse roto');
  const nuevo = cl.creados[0];
  // Sin esto la columna del paso 1 seguiría MUERTA: existe en el schema y no la escribe nadie.
  assert.deepEqual(
    cl.actualizacionesQuote.map((u) => ({ id: u.where.id, jobId: u.data.jobId })),
    [{ id: 1, jobId: nuevo.id }],
    '🔴 se creó el Trabajo pero no se anotó `Quote.jobId`',
  );
});

test('① CONVIVENCIA · par anterior al backfill: no re-crea, ADOPTA la pertenencia', async () => {
  // Job con `quoteId` (sentido viejo) y Quote todavía sin `jobId`: es el estado de toda fila
  // anterior al backfill. Antes esto devolvía sin más; ahora además anota, así que el backfill
  // se va haciendo solo por el camino caliente.
  const cl = prismaFalso({
    quotes: [{ ...QUOTE_BASE, id: 1, jobId: null }],
    jobs: [{ id: 50, quoteId: 1, merchantId: 7 }],
  });

  await ensureJobForQuote(1, cl);

  assert.equal(cl.creados.length, 0, '🔴 re-creó un Trabajo que ya existía');
  assert.deepEqual(
    cl.actualizacionesQuote.map((u) => ({ id: u.where.id, jobId: u.data.jobId })),
    [{ id: 1, jobId: 50 }],
    '🔴 no adoptó la pertenencia del par legado',
  );
});

test('① un quote NO aceptado sigue sin crear nada', async () => {
  const cl = prismaFalso({ quotes: [{ ...QUOTE_BASE, id: 1, status: 'sent' }], jobs: [] });
  await ensureJobForQuote(1, cl);
  assert.equal(cl.creados.length, 0);
  assert.equal(cl.actualizacionesQuote.length, 0);
});

// ═════════════════════════════════════════════════════════════════════════════
// ② quotesDelJob — la agregación de dinero
// ═════════════════════════════════════════════════════════════════════════════

test('② quotesDelJob devuelve TODOS los quotes del Job, no solo el original', async () => {
  const cl = prismaFalso({
    quotes: [
      { ...QUOTE_BASE, id: 1, jobId: 50 },
      { ...QUOTE_BASE, id: 2, jobId: 50 },
      { ...QUOTE_BASE, id: 3, jobId: 99 }, // otro Job: no debe colarse
    ],
    jobs: [{ id: 50, quoteId: 1 }],
  });
  const ids = (await quotesDelJob(50, cl)).sort((a, b) => a - b);
  assert.deepEqual(ids, [1, 2], '🔴 el adicional se queda fuera de la agregación de dinero');
});

test('② CONVIVENCIA · un par sin backfill NO devuelve [] — eso pondría totalCobrado a 0', async () => {
  // La ventana entre mergear y correr el backfill. Sin la mitad legada, esto devolvería `[]`.
  const cl = prismaFalso({
    quotes: [{ ...QUOTE_BASE, id: 1, jobId: null }],
    jobs: [{ id: 50, quoteId: 1 }],
  });
  assert.deepEqual(await quotesDelJob(50, cl), [1],
    '🔴 durante la ventana previa al backfill se perdería la pertenencia — y es dinero');
});

test('② no duplica cuando la pertenencia consta por los DOS sentidos', async () => {
  const cl = prismaFalso({
    quotes: [{ ...QUOTE_BASE, id: 1, jobId: 50 }],
    jobs: [{ id: 50, quoteId: 1 }],
  });
  assert.deepEqual(await quotesDelJob(50, cl), [1], '🔴 el mismo quote contado dos veces');
});

test('② un Job manual (SCRUM-51) sigue sin quotes', async () => {
  const cl = prismaFalso({ quotes: [], jobs: [{ id: 50, quoteId: null }] });
  assert.deepEqual(await quotesDelJob(50, cl), []);
});

// ═════════════════════════════════════════════════════════════════════════════
// ③ recalcJobCobradoForQuote — cobrar el extra tiene que mover el total
// ═════════════════════════════════════════════════════════════════════════════

test('③ cobrar un ADICIONAL recalcula el Trabajo (antes se iba mudo)', async () => {
  const cl = prismaFalso({
    quotes: [
      { ...QUOTE_BASE, id: 1, jobId: 50 },
      { ...QUOTE_BASE, id: 2, jobId: 50 },
    ],
    jobs: [{ id: 50, quoteId: 1 }],
    invoices: [
      { quoteId: 1, status: 'paid', total: 3000 },
      { quoteId: 2, status: 'paid', total: 200 },
    ],
  });

  await recalcJobCobradoForQuote(2, cl); // el ADICIONAL

  assert.equal(cl.actualizacionesJob.length, 1,
    '🔴 no se recalculó nada: cobrar el extra no movería el total');
  // Y el total es la SUMA, no el último cobro: el bug «el total BAJA después de cobrar».
  assert.equal(cl.actualizacionesJob[0].data.totalCobrado, 3200,
    '🔴 el total no suma los dos quotes del Trabajo');
});

test('③ CONVIVENCIA · un quote sin backfill sigue recalculando por el sentido viejo', async () => {
  const cl = prismaFalso({
    quotes: [{ ...QUOTE_BASE, id: 1, jobId: null }],
    jobs: [{ id: 50, quoteId: 1 }],
    invoices: [{ quoteId: 1, status: 'paid', total: 500 }],
  });
  await recalcJobCobradoForQuote(1, cl);
  assert.equal(cl.actualizacionesJob.length, 1, '🔴 se dejaría de recalcular durante la ventana');
  assert.equal(cl.actualizacionesJob[0].data.totalCobrado, 500);
});

test('③ un quote sin Trabajo por ningún sentido no toca nada', async () => {
  const cl = prismaFalso({ quotes: [{ ...QUOTE_BASE, id: 1, jobId: null }], jobs: [] });
  await recalcJobCobradoForQuote(1, cl);
  assert.equal(cl.actualizacionesJob.length, 0);
});

// ═════════════════════════════════════════════════════════════════════════════
// ④ trabajosPorQuote (gastos) — un gasto del adicional no puede quedarse suelto
// ═════════════════════════════════════════════════════════════════════════════

const { trabajosPorQuote } = await import('../dist/modules/expenses/domain/expenses.service.js');

test('④ un gasto imputado a un ADICIONAL encuentra su Trabajo', async () => {
  const cl = prismaFalso({
    quotes: [
      { ...QUOTE_BASE, id: 1, jobId: 50 },
      { ...QUOTE_BASE, id: 2, jobId: 50 },
    ],
    jobs: [{ id: 50, quoteId: 1, titulo: 'Reforma baño' }],
  });
  const mapa = await trabajosPorQuote(7, [1, 2], cl);
  assert.equal(mapa.get(2)?.id, 50, '🔴 el gasto del adicional saldría suelto, sin Trabajo');
  assert.equal(mapa.get(2)?.titulo, 'Reforma baño');
  assert.equal(mapa.get(1)?.id, 50, 'el del original tampoco puede haberse roto');
});

test('④ CONVIVENCIA · un par sin backfill sigue encontrando su Trabajo', async () => {
  const cl = prismaFalso({
    quotes: [{ ...QUOTE_BASE, id: 1, jobId: null }],
    jobs: [{ id: 50, quoteId: 1, titulo: 'Legado' }],
  });
  const mapa = await trabajosPorQuote(7, [1], cl);
  assert.equal(mapa.get(1)?.id, 50, '🔴 durante la ventana previa al backfill el gasto se quedaría suelto');
});

test('④ un quote sin Trabajo por ningún sentido no inventa uno', async () => {
  const cl = prismaFalso({ quotes: [{ ...QUOTE_BASE, id: 1, jobId: null }], jobs: [] });
  assert.equal((await trabajosPorQuote(7, [1], cl)).size, 0);
});
