// SCRUM-1043 (parte de SERVIDOR) · «QUIÉN ME DEBE»: la lista de clientes admite `?conDeuda=1` y
// `?orden=saldo`, y cada fila con deuda trae `saldoPendiente`, calculado por LA MISMA función que la
// cifra «Pendiente» de la ficha (`saldosPendientesPorCliente`, SCRUM-1035). Solo lectura.
// Reglas: cliente sin deuda = sin `saldoPendiente` (ausente no es cero); otro merchant no ve saldos
// ajenos; el técnico (rol que solo ve lo suyo) NO recibe saldos aunque los pida (es dinero).
// Sin banco: handler real de `GET /admin/customers` contra un mini-Prisma que respeta `where`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../dist/core/db/prisma.js';
import routerModulo from '../dist/modules/system/app/routes/customersAdmin.routes.js';

const router = routerModulo.default ?? routerModulo;
const M = 1;
const OTRO = 2;
const clientes = [
  { id: 1, merchantId: M, name: 'Con deuda', createdAt: new Date(2026, 0, 1) },
  { id: 2, merchantId: M, name: 'Sin deuda', createdAt: new Date(2026, 0, 2) },
  { id: 3, merchantId: M, name: 'Deuda parcial', createdAt: new Date(2026, 0, 3) },
  { id: 4, merchantId: OTRO, name: 'Ajeno', createdAt: new Date(2026, 0, 4) },
];
const f = (id, merchantId, customerId, status, total) => ({ id, merchantId, customerId, status, total });
const facturas = [
  f(1, M, 1, 'pending', 400), f(2, M, 1, 'pending', 100), // cliente 1 debe 500
  f(3, M, 2, 'paid', 900), // cliente 2 no debe nada
  f(4, M, 3, 'pending', 700), f(5, M, 3, 'paid', 300), // cliente 3 debe 700 (mayor que el 1: el orden por saldo NO es el de la lista)
  f(6, OTRO, 4, 'pending', 7777), f(7, OTRO, 1, 'pending', 5555), // el otro merchant, incluso sobre el id 1
];
// Como Prisma: un valor `undefined` no filtra.
const casa = (fila, where) => Object.entries(where).every(([k, v]) => v === undefined || (v && typeof v === 'object' && 'in' in v
  ? v.in.includes(fila[k]) : v && typeof v === 'object' && 'not' in v ? fila[k] !== v.not : fila[k] === v));

const dobles = {
  customer: { findMany: async ({ where }) => clientes.filter((c) => c.merchantId === where.merchantId) },
  job: { groupBy: async () => [] },
  // SCRUM-1108: la ficha y la lista consultan también las garantías retenidas (`Charge`); aquí no hay ninguna.
  charge: { findMany: async () => [] },
  merchant: { findUnique: async () => null },
  invoice: {
    groupBy: async ({ where }) => {
      const por = new Map();
      for (const x of facturas.filter((x) => casa(x, where))) por.set(x.customerId, [...(por.get(x.customerId) ?? []), x]);
      return [...por].map(([customerId, xs]) => ({ customerId, _sum: { total: xs.reduce((a, x) => a + x.total, 0) }, _count: { _all: xs.length } }));
    },
  },
};

async function lista({ merchantId = M, userRole = 'admin', query = {} } = {}) {
  const orig = {};
  for (const k of Object.keys(dobles)) { orig[k] = prisma[k]; prisma[k] = dobles[k]; }
  let cuerpo = null;
  let status = 200;
  const res = { status(c) { status = c; return res; }, json(b) { cuerpo = b; return res; } };
  try {
    const capa = router.stack.find((l) => l.route?.path === '/' && l.route.methods.get);
    assert.ok(capa, 'no encuentro GET /');
    await capa.route.stack[capa.route.stack.length - 1].handle({ merchantId, userRole, teamMemberId: 9, query }, res);
  } finally {
    for (const k of Object.keys(orig)) prisma[k] = orig[k];
  }
  assert.equal(status, 200);
  return cuerpo;
}

test('SCRUM-1043 · SUELO: sin filtros, la lista trae los 3 clientes del merchant y cada deudor su saldo', async () => {
  const c = await lista();
  assert.equal(c.length, 3);
  assert.equal(c.find((x) => x.id === 1).saldoPendiente, 500, 'las facturas del otro merchant sobre el mismo id no entran');
  assert.equal(c.find((x) => x.id === 3).saldoPendiente, 700, 'deuda parcial = solo lo pendiente');
});

test('SCRUM-1043 · cliente sin deuda: ni cifra ni clave (ausente no es cero)', async () => {
  const sin = (await lista()).find((x) => x.id === 2);
  assert.ok(!('saldoPendiente' in sin));
});

test('SCRUM-1043 · `conDeuda=1` deja solo a los deudores y `orden=saldo` los pone de mayor a menor', async () => {
  const c = await lista({ query: { conDeuda: '1', orden: 'saldo' } });
  assert.deepEqual(c.map((x) => x.id), [3, 1]);
  const otro = await lista({ merchantId: OTRO, query: { conDeuda: '1' } });
  assert.deepEqual(otro.map((x) => [x.id, x.saldoPendiente]), [[4, 7777]], 'otro merchant solo ve lo suyo');
});

test('SCRUM-1043 · el técnico no recibe saldos ni puede filtrar por deuda (dinero)', async () => {
  const c = await lista({ userRole: 'tecnico', query: { conDeuda: '1', orden: 'saldo' } });
  assert.equal(c.length, 3, 'el filtro se ignora para él');
  assert.ok(c.every((x) => !('saldoPendiente' in x)), 'ningún saldo');
});
