// tests/scrum1369-entrega-solo-de-lo-aceptado.test.mjs — SCRUM-1369
//
// 🔴 UN PRESUPUESTO QUE NADIE HA ACEPTADO NO DEJA LÍNEAS «SIN ENTREGAR».
//
// Medido en producción el 1-oct-2026 (cuenta QA, Trabajo #76, presupuesto #203 en borrador): la
// ficha decía «1 línea del presupuesto sin entregar». `entregaDelTrabajo` tomaba como eje el primer
// presupuesto del Trabajo sin mirar su estado. Misma raíz que SCRUM-1355 (dinero), otro dominio.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// La RUTA de verdad (`GET /:id` de `dist/…/jobs.routes.js`) con la base doblada por
// `_envio-doblado.mjs`. Lo que se mide es `entregaPendiente` tal como sale del detalle.
// ⚠️ El doble no tiene estado ni evalúa el `where`: devuelve los presupuestos que el caso declara.
// Que la consulta filtre por `merchantId` NO lo prueba este fichero.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';
import { presupuestosQueSeEntregan } from '../dist/modules/jobs/domain/entregaDelTrabajo.js';

const RUTAS = '../dist/modules/jobs/app/routes/jobs.routes.js';
const JOB_ID = 76;

const JOB = {
  id: JOB_ID, merchantId: MERCHANT, quoteId: null, customerId: null, operarioId: null,
  assignedUserId: null, title: 'Avería', status: 'pending', scheduledAt: null, totalAceptado: null,
  createdAt: new Date('2026-10-01T08:00:00Z'), updatedAt: new Date('2026-10-01T08:00:00Z'),
};

/** Un presupuesto del Trabajo con `n` líneas de cantidad 1, en la forma de `QUOTE_SELECT`. */
const Q = (id, status, n = 1) => ({
  id, quoteNumber: id, status, total: '121.00', currency: 'EUR', paymentTerms: 'FULL',
  customBillingPlan: null, discountGlobalAmount: null, Invoice: [], jobId: JOB_ID,
  lines: Array.from({ length: n }, (_, i) => ({ concept: `L${i}`, qty: 1, unitPrice: 100, vatRate: 21 })),
});

async function entregaDelDetalle(quotes) {
  inyectarBase({
    'job.findFirst': () => ({ ...JOB }),
    // Dos consultas a `quote`: la de `quotesDeJob` (por `jobId`) y la de los detalles (por `id in`).
    'quote.findMany': ({ where }) =>
      where?.jobId !== undefined ? quotes.map((q) => ({ ...q })) : quotes.map((q) => ({ id: q.id, charge: null, Invoice: [] })),
  }, [RUTAS]);
  const router = moduloDeDist(RUTAS).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id' && l.route.methods.get);
  assert.ok(capa, '🔴 CIEGO: no encuentro GET /:id en el router de trabajos');
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const r = { status: 200, data: undefined };
  const res = { status(s) { r.status = s; return res; }, json(j) { r.data = j; return res; } };
  const errores = [];
  const callar = console.error; console.error = (...a) => errores.push(a.join(' '));
  try { await h(reqDeSesion({ rol: 'admin', merchantId: MERCHANT, params: { id: String(JOB_ID) }, teamMemberId: null }), res); }
  finally { console.error = callar; }
  assert.equal(r.status, 200, `🔴 CIEGO: el detalle no responde 200 (${r.status}): ${errores.join(' | ')}`);
  assert.ok(r.data && 'entregaPendiente' in r.data, '🔴 CIEGO: el detalle no trae `entregaPendiente`');
  return r.data.entregaPendiente;
}

test('SCRUM-1369 · CONTROL: presupuesto ACEPTADO con líneas sin albarán → las cuenta, como siempre', async () => {
  const e = await entregaDelDetalle([Q(203, 'accepted', 2)]);
  assert.equal(e.estado, 'calculado');
  assert.equal(e.calculable, true);
  assert.equal(e.lineasPendientes, 2, '🔴 un presupuesto aceptado ha dejado de contar sus líneas por entregar');
});

test('SCRUM-1369 · 🔴 el caso medido: único presupuesto en BORRADOR → ninguna línea pendiente de entregar', async () => {
  const e = await entregaDelDetalle([Q(203, 'draft', 1)]);
  assert.equal(e.estado, 'sin_eje', `🔴 el borrador sigue siendo el eje de entrega: ${JSON.stringify(e)}`);
  assert.equal(e.calculable, false);
  assert.equal(e.lineasPendientes, undefined, '🔴 viaja un conteo de líneas de algo que nadie ha aceptado');
});

test('SCRUM-1369 · enviado, rechazado, caducado o sin estado legible: mismo trato que el borrador', async () => {
  for (const status of ['sent', 'rejected', 'expired', null, undefined, '', 'ACCEPTED']) {
    const e = await entregaDelDetalle([Q(203, status, 1)]);
    assert.equal(e.estado, 'sin_eje', `🔴 un presupuesto con estado ${JSON.stringify(status)} es eje de entrega`);
  }
});

test('SCRUM-1369 · original en borrador + adicional ACEPTADO: el eje NO se pasa al adicional', async () => {
  // PASO 0 del ticket. Antes: eje = el borrador, y «hay adicionales» → no calculable.
  // Ahora: sin eje. En ninguno de los dos casos se afirma un número de líneas.
  const e = await entregaDelDetalle([Q(203, 'draft', 1), Q(204, 'accepted', 3)]);
  assert.equal(e.estado, 'sin_eje');
});

test('SCRUM-1369 · original aceptado + adicional: sólo el ACEPTADO cuenta como «hay adicionales»', async () => {
  const conBorrador = await entregaDelDetalle([Q(203, 'accepted', 2), Q(204, 'draft', 1)]);
  assert.equal(conBorrador.calculable, true, '🔴 un adicional en borrador apaga el cálculo de entrega');
  assert.equal(conBorrador.lineasPendientes, 2);

  const conAceptado = await entregaDelDetalle([Q(203, 'accepted', 2), Q(204, 'accepted', 1)]);
  assert.equal(conAceptado.calculable, false, 'CONTROL: un adicional aceptado sigue dejándolo sin calcular (C6)');
  assert.equal(conAceptado.motivo, 'hay_adicionales');
});

test('SCRUM-1369 · la función: el original sólo si está aceptado, y detrás sólo los aceptados', () => {
  const a = { id: 1, status: 'accepted' }, b = { id: 2, status: 'draft' }, c = { id: 3, status: 'accepted' };
  assert.deepEqual(presupuestosQueSeEntregan([a, b, c]), [a, c]);
  assert.deepEqual(presupuestosQueSeEntregan([b, a]), []);
  assert.deepEqual(presupuestosQueSeEntregan([]), []);
  assert.deepEqual(presupuestosQueSeEntregan(null), []);
});
