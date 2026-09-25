// SCRUM-1108 · EL AVISO DE LA RETENCIÓN DE GARANTÍA. SCRUM-1107 guarda cuánto se retuvo y cuándo se
// libera; esto hace que el dato se VEA: la ficha 360 y la lista «quién me debe» cuentan la garantía
// retenida y marcan `aviso` cuando la fecha de liberación ya llegó y sigue sin cobrarse.
// Derivado: sin columna, sin candado, sin envío (regla 28 no aplica). Se apaga solo al cobrar.
// Sin banco: la función exportada y los handlers reales contra un mini-Prisma. El resumen de dentro
// (`resumirGarantias`) no se exporta (SCRUM-411): se prueba por `garantiasRetenidasPorCliente`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../dist/core/db/prisma.js';
import { garantiasRetenidasPorCliente } from '../dist/modules/billing/domain/garantiasRetenidas.js';
import routerModulo from '../dist/modules/system/app/routes/customersAdmin.routes.js';

const router = routerModulo.default ?? routerModulo;
const M = 1;
const OTRO = 2;

// Un cobro con retención. Por defecto: declarada, sin cobrar, pagado.
const cobro = (o) => ({
  merchantId: M, status: 'paid', customerId: 1,
  retencionGarantiaPorcentaje: 5, retencionGarantiaImporte: 500,
  retencionGarantiaLiberacion: new Date('2027-03-12T00:00:00Z'), retencionGarantiaCobrada: null, ...o,
});

// ── El resumen ─────────────────────────────────────────────────────────────────────────────────
// Este doble devuelve los cobros SIN filtrar por `where`: así lo que se mide es la guarda del código
// (`retencionPendiente`, fechas e importes ilegibles), no el filtro de la consulta, que tiene su
// propio caso más abajo. Dos sondas independientes del mismo «se apaga al cobrar».
async function resumirGarantias(cobros, hoy, zona) {
  const orig = { charge: prisma.charge, merchant: prisma.merchant };
  prisma.charge = { findMany: async () => cobros };
  prisma.merchant = { findUnique: async () => ({ timezone: zona }) };
  try { return await garantiasRetenidasPorCliente(M, undefined, new Date(`${hoy}T12:00:00Z`)); }
  finally { Object.assign(prisma, orig); }
}

test('SCRUM-1108 · el aviso se ENCIENDE el día de la liberación, no antes', async () => {
  const c = [cobro()];
  assert.equal((await resumirGarantias(c, '2027-03-11', 'UTC')).get(1).aviso, false, 'la víspera: retenida pero aún no liberable');
  const dia = (await resumirGarantias(c, '2027-03-12', 'UTC')).get(1);
  assert.equal(dia.aviso, true);
  assert.deepEqual([dia.total, dia.count, dia.liberable.total, dia.liberable.count], [500, 1, 500, 1]);
  assert.equal((await resumirGarantias(c, '2027-03-11', 'UTC')).get(1).liberable.count, 0);
});

test('SCRUM-1108 · 🔴 el aviso se APAGA al cobrar: con `retencionGarantiaCobrada` puesta, el cliente sale del mapa', async () => {
  const cobrada = [cobro({ retencionGarantiaCobrada: new Date('2027-03-20T10:00:00Z') })];
  assert.equal((await resumirGarantias(cobrada, '2027-06-01', 'UTC')).has(1), false,
    'UN AVISO QUE SIGUE SONANDO SOBRE DINERO YA INGRESADO: el profesional deja de creerse los avisos');
});

test('SCRUM-1108 · el día de liberación se lee en la zona del MERCHANT, no en la del proceso (SCRUM-735)', async () => {
  // 23:30Z del 11 es ya el 12 en Madrid: allí se puede reclamar el 12, no el 11.
  const c = [cobro({ retencionGarantiaLiberacion: new Date('2027-03-11T23:30:00Z') })];
  const madrid = (await resumirGarantias(c, '2027-03-11', 'Europe/Madrid')).get(1);
  assert.equal(madrid.aviso, false);
  assert.equal(madrid.retenciones[0].liberacionDia, '2027-03-12', 'la fecha que ve el profesional es la de SU día');
  assert.equal((await resumirGarantias(c, '2027-03-11', 'UTC')).get(1).aviso, true, 'control: en UTC sí es el 11');
});

test('SCRUM-1108 · sin retención declarada, sin cliente o con datos ilegibles no cuenta (ni como cero ni como hoy)', async () => {
  const c = [
    cobro({ retencionGarantiaPorcentaje: null }),
    cobro({ customerId: null }),
    cobro({ retencionGarantiaLiberacion: null }),
    cobro({ retencionGarantiaImporte: 'no-es-un-número' }),
  ];
  assert.equal((await resumirGarantias(c, '2030-01-01', 'UTC')).size, 0);
});

test('SCRUM-1108 · varias retenciones del mismo cliente: suma exacta al céntimo y la liberación más temprana', async () => {
  const c = [
    cobro({ retencionGarantiaImporte: 0.1, retencionGarantiaLiberacion: new Date('2027-05-01T00:00:00Z') }),
    cobro({ retencionGarantiaImporte: 0.2, retencionGarantiaLiberacion: new Date('2027-02-01T00:00:00Z') }),
  ];
  const g = (await resumirGarantias(c, '2027-03-01', 'UTC')).get(1);
  assert.equal(g.total, 0.3, '0.1 + 0.2 en coma flotante da 0.30000000000000004');
  assert.deepEqual([g.liberable.total, g.liberable.count, g.aviso], [0.2, 1, true]);
  assert.equal(g.proximaLiberacion.toISOString(), '2027-02-01T00:00:00.000Z');
  // Una por retención y por fecha: la pantalla pinta el literal firmado una vez por cada una.
  assert.deepEqual(g.retenciones, [
    { importe: 0.2, liberacionDia: '2027-02-01', aviso: true },
    { importe: 0.1, liberacionDia: '2027-05-01', aviso: false },
  ]);
});

// ── La consulta y los handlers ─────────────────────────────────────────────────────────────────

const cobros = [
  cobro({ id: 1, customerId: 1, retencionGarantiaLiberacion: new Date('2026-01-15T00:00:00Z') }), // cliente 1: 500 retenidos, ya liberables
  cobro({ id: 2, customerId: 2, retencionGarantiaImporte: 300, retencionGarantiaLiberacion: new Date('2099-01-01T00:00:00Z') }), // aún no
  cobro({ id: 3, customerId: 3, status: 'pending', retencionGarantiaImporte: 9999 }), // su factura ya lo cuenta
  cobro({ id: 4, customerId: 1, retencionGarantiaCobrada: new Date('2027-01-01T00:00:00Z'), retencionGarantiaImporte: 8888 }), // ya cobrada
  cobro({ id: 5, merchantId: OTRO, customerId: 1, retencionGarantiaImporte: 7777 }), // otro merchant, mismo id de cliente
];
const clientes = [
  { id: 1, merchantId: M, name: 'Garantía liberable', createdAt: new Date(2026, 0, 1) },
  { id: 2, merchantId: M, name: 'Garantía futura', createdAt: new Date(2026, 0, 2) },
  { id: 3, merchantId: M, name: 'Con factura pendiente', createdAt: new Date(2026, 0, 3) },
];
const facturas = [{ id: 1, merchantId: M, customerId: 3, status: 'pending', total: 700 }];

// Como Prisma: `undefined` no filtra; `{in}`, `{not}` y `null` literal.
const vale = (v, x) => v === undefined || (v && typeof v === 'object' && !(v instanceof Date)
  ? ('in' in v ? v.in.includes(x) : 'not' in v ? x !== v.not : true) : x === v);
const casa = (fila, where = {}) => Object.entries(where).every(([k, v]) => vale(v, fila[k]));
let whereDeCobros = null;

const dobles = {
  customer: {
    findMany: async ({ where }) => clientes.filter((c) => c.merchantId === where.merchantId),
    findFirst: async ({ where }) => clientes.find((c) => c.merchantId === where.merchantId && c.id === where.id) ?? null,
  },
  job: { groupBy: async () => [] },
  quote: { findMany: async () => [], count: async () => 0 },
  expense: { aggregate: async () => ({ _sum: { amount: null } }) },
  customerEvent: { findMany: async () => [] },
  invoice: {
    findMany: async () => [],
    aggregate: async () => ({ _sum: { total: null } }),
    groupBy: async ({ where }) => {
      const por = new Map();
      for (const x of facturas.filter((x) => casa(x, where))) por.set(x.customerId, [...(por.get(x.customerId) ?? []), x]);
      return [...por].map(([customerId, xs]) => ({ customerId, _sum: { total: xs.reduce((a, x) => a + x.total, 0) }, _count: { _all: xs.length } }));
    },
  },
  charge: { findMany: async ({ where }) => { whereDeCobros = where; return cobros.filter((c) => casa(c, where)); } },
  merchant: { findUnique: async () => ({ timezone: 'Europe/Madrid' }) },
};

async function conDobles(fn) {
  const orig = {};
  for (const k of Object.keys(dobles)) { orig[k] = prisma[k]; prisma[k] = dobles[k]; }
  try { return await fn(); } finally { for (const k of Object.keys(orig)) prisma[k] = orig[k]; }
}

async function llamar(path, req) {
  let cuerpo = null;
  let status = 200;
  const res = { status(c) { status = c; return res; }, json(b) { cuerpo = b; return res; } };
  await conDobles(async () => {
    const capa = router.stack.find((l) => l.route?.path === path && l.route.methods.get);
    assert.ok(capa, `no encuentro GET ${path}`);
    await capa.route.stack[capa.route.stack.length - 1].handle({ merchantId: M, userRole: 'admin', teamMemberId: 9, query: {}, ...req }, res);
  });
  assert.equal(status, 200);
  return cuerpo;
}

test('SCRUM-1108 · la consulta: solo cobros PAGADOS, del merchant, con retención y sin cobrar', async () => {
  const g = await conDobles(() => garantiasRetenidasPorCliente(M, undefined, new Date('2027-06-01T10:00:00Z')));
  assert.deepEqual(whereDeCobros.merchantId, M, 'regla 2');
  assert.equal(whereDeCobros.status, 'paid', 'un cobro pending lo cuenta ya su factura: sumarlo aquí sería contarlo dos veces');
  assert.equal(whereDeCobros.retencionGarantiaCobrada, null);
  assert.deepEqual([...g.keys()].sort(), [1, 2]);
  assert.equal(g.get(1).total, 500, 'ni la ya cobrada (8888) ni la del otro merchant (7777) entran');
  assert.equal(g.get(1).aviso, true);
  assert.equal(g.get(2).aviso, false);
});

test('SCRUM-1108 · la ficha 360 trae `garantiaRetenida` APARTE de `totalPending`, y el técnico no la recibe', async () => {
  const f = await llamar('/:id/detail', { params: { id: '1' } });
  assert.equal(f.stats.totalPending, 0, '`totalPending` sigue siendo solo facturas pending (SCRUM-1035)');
  assert.equal(f.stats.garantiaRetenida.total, 500);
  assert.equal(f.stats.garantiaRetenida.aviso, true);
  const sin = await llamar('/:id/detail', { params: { id: '3' } });
  assert.ok(!('garantiaRetenida' in sin.stats), 'ausente no es cero');
  const tecnico = await llamar('/:id/detail', { params: { id: '1' }, userRole: 'tecnico' });
  assert.ok(!('garantiaRetenida' in tecnico.stats), 'es dinero: mismo criterio que el saldo de SCRUM-1043');
});

test('SCRUM-1108 · «quién me debe»: quien SOLO debe garantía aparece, y el orden suma las dos deudas', async () => {
  const c = await llamar('/', { query: { conDeuda: '1', orden: 'saldo' } });
  // 3 debe 700 en facturas; 1 debe 500 de garantía; 2 debe 300 de garantía (aún no liberable, pero la debe).
  assert.deepEqual(c.map((x) => x.id), [3, 1, 2]);
  const uno = c.find((x) => x.id === 1);
  assert.ok(!('saldoPendiente' in uno), '`saldoPendiente` no se mezcla con la garantía');
  assert.equal(uno.garantiaRetenida.aviso, true);
  const tecnico = await llamar('/', { userRole: 'tecnico', query: { conDeuda: '1' } });
  assert.ok(tecnico.every((x) => !('garantiaRetenida' in x)));
});
