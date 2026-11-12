// tests/scrum1671-partes-en-el-detalle-del-trabajo.test.mjs — SCRUM-1671 (PILOTO-1)
//
// 🔴 EL PARTE FIRMADO TIENE QUE SALIR EN EL DETALLE DE SU TRABAJO.
//
// Medido en yaqu.app el 10-nov-2026 (cuenta QA, SCRUM-1658): el parte PT-2026-005 (#13) estaba
// firmado y `GET /admin/partes/13` decía `jobId: 79`, pero `GET /admin/jobs/79` no traía ningún
// campo `partes`. La ficha del trabajo decía «Aún no hay documentos» con el parte firmado.
// La ficha del CLIENTE sí los pintaba (`historialDelCliente.ts`): el dato existía, el detalle no
// lo pedía.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// La RUTA de verdad (`GET /:id` de `dist/…/jobs.routes.js`) con la base doblada por
// `_envio-doblado.mjs`, como `scrum1369`. El doble no evalúa el `where`: lo GUARDA, y el test
// mira que la consulta de partes va acotada por merchant Y por trabajo (regla 2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RUTAS = '../dist/modules/jobs/app/routes/jobs.routes.js';
const JOB_ID = 79;

const JOB = {
  id: JOB_ID, merchantId: MERCHANT, quoteId: null, customerId: null, operarioId: null,
  assignedUserId: null, title: 'Avería', status: 'agendado', scheduledAt: null, totalAceptado: null,
  createdAt: new Date('2026-11-10T08:00:00Z'), updatedAt: new Date('2026-11-10T08:00:00Z'),
};

const PARTE_13 = { id: 13, numero: 'PT-2026-005', fecha: new Date('2026-11-10T09:00:00Z'), estado: 'firmado' };

const Q = (id) => ({
  id, quoteNumber: id, status: 'accepted', total: '121.00', currency: 'EUR', paymentTerms: 'FULL',
  customBillingPlan: null, discountGlobalAmount: null, Invoice: [], jobId: JOB_ID,
  lines: [{ concept: 'L0', qty: 1, unitPrice: 100, vatRate: 21 }],
});

/** Llama al detalle y devuelve `{ data, consultasDePartes }`. */
async function detalle({ partes = [], quotes = [] } = {}) {
  const consultasDePartes = [];
  inyectarBase({
    'job.findFirst': () => ({ ...JOB }),
    'quote.findMany': ({ where }) =>
      where?.jobId !== undefined ? quotes.map((q) => ({ ...q })) : quotes.map((q) => ({ id: q.id, charge: null, Invoice: [] })),
    'parteTrabajo.findMany': (args) => { consultasDePartes.push(args); return partes.map((p) => ({ ...p })); },
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
  return { data: r.data, consultasDePartes };
}

test('SCRUM-1671 · 🔴 el caso medido: trabajo SIN presupuesto con el parte #13 firmado → el detalle lo trae con número y estado', async () => {
  const { data } = await detalle({ partes: [PARTE_13] });
  assert.ok(Array.isArray(data.partes), `🔴 el detalle del trabajo no trae \`partes\` (claves: ${Object.keys(data).join(', ')})`);
  assert.equal(data.partes.length, 1);
  assert.equal(data.partes[0].id, 13);
  assert.equal(data.partes[0].numero, 'PT-2026-005');
  assert.equal(data.partes[0].estado, 'firmado');
});

test('SCRUM-1671 · 🔴 con presupuesto (la otra salida del serializador) también los trae', async () => {
  const { data } = await detalle({ partes: [PARTE_13], quotes: [Q(203)] });
  assert.ok(Array.isArray(data.partes), '🔴 la salida CON presupuesto no trae `partes`: sólo se arregló la temprana');
  assert.deepEqual(data.partes.map((p) => [p.id, p.numero, p.estado]), [[13, 'PT-2026-005', 'firmado']]);
});

test('SCRUM-1671 · 🔴 regla 2: la consulta de partes va acotada por el merchant Y por el trabajo', async () => {
  const { consultasDePartes } = await detalle({ partes: [PARTE_13] });
  assert.equal(consultasDePartes.length, 1, `🔴 se esperaba UNA consulta de partes y hubo ${consultasDePartes.length}`);
  const where = consultasDePartes[0]?.where ?? {};
  assert.equal(where.merchantId, MERCHANT, `🔴 la consulta de partes no filtra por merchant: ${JSON.stringify(where)}`);
  assert.equal(where.jobId, JOB_ID, `🔴 la consulta de partes no filtra por ESTE trabajo: ${JSON.stringify(where)}`);
});

test('SCRUM-1671 · lo que viaja es lo mismo que la ficha del cliente (id, numero, fecha, estado): sin contenido del parte', async () => {
  const { consultasDePartes } = await detalle({ partes: [PARTE_13] });
  const select = consultasDePartes[0]?.select;
  assert.deepEqual(Object.keys(select ?? {}).sort(), ['estado', 'fecha', 'id', 'numero'],
    `🔴 el detalle pide del parte algo más (o algo distinto) que la ficha del cliente: ${JSON.stringify(select)}`);
});

test('SCRUM-1671 · CONTROL: sin partes viaja una lista VACÍA, no un campo ausente', async () => {
  for (const quotes of [[], [Q(203)]]) {
    const { data } = await detalle({ partes: [], quotes });
    assert.deepEqual(data.partes, [], `🔴 sin partes (${quotes.length} presupuestos) \`partes\` no es []: ${JSON.stringify(data.partes)}`);
  }
});
