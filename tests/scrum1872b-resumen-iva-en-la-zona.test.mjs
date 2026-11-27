// tests/scrum1872b-resumen-iva-en-la-zona.test.mjs — SCRUM-1872b (S1; cita SCRUM-1836 c.22871)
//
// `GET /admin/reports/vat` y `GET /admin/reports/resumen-trimestre` eran los dos últimos llamadores
// de `rangoTrimestre(year, quarter)` SIN la zona del comercio: los lectores fiscales de J1 ya la
// pasan desde SCRUM-1445f. Sin zona, el borde es el de la zona del PROCESO (Railway va en UTC), así
// que un cobro del 1-abr a las 00:30 de Madrid salía en el T1 del panel y en el T2 del 303.
//
// Handler REAL de `dist/`, `prisma` SUSTITUIDO (el patrón de `scrum1151`): se apunta el `where` con
// el que la ruta pide facturas y gastos, y se compara con `rangoTrimestre(…, zona)`, la misma
// función que usan el 303 y los libros. Las fechas `from`/`to` que pinta Informes («Facturas
// emitidas del … al …») se miran también: con zona, `toISOString()` pintaría el 31 de marzo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { reqDeSesion } from './_arnes-de-router.mjs';

const DIST = '../dist/';
const { rangoTrimestre } = await import(DIST + 'modules/fiscal/modelo303/modelo303.js');

async function routerDeInformes() {
  const mod = await import(DIST + 'modules/reports/app/routes/reports.routes.js');
  const r = mod.default?.stack ? mod.default : mod.default?.default;
  assert.ok(r?.stack, '🔴 no he podido cargar el router de Informes.');
  return r;
}

function llamar(router, ruta, merchantId, year, quarter) {
  const capa = router.stack.find((l) => l.route?.path === ruta);
  assert.ok(capa, `🔴 la ruta ${ruta} ya no existe en el router de Informes.`);
  return new Promise((resolve, reject) => {
    capa.route.stack[0].handle(
      reqDeSesion({ rol: 'admin', merchantId, query: { year, quarter } }),
      { json: resolve, status: (c) => ({ json: (b) => reject(new Error(`HTTP ${c}: ${JSON.stringify(b)}`)) }) },
      reject,
    );
  });
}

/** Sustituye prisma; devuelve lo que la ruta pidió (`where` de facturas y gastos). */
async function conPrisma(timezone, fn) {
  const { prisma } = await import(DIST + 'core/db/prisma.js');
  const nombres = ['merchant', 'invoice', 'expense', 'quote', 'albaran'];
  const original = Object.fromEntries(nombres.map((n) => [n, prisma[n]]));
  const pedido = { merchant: [], invoice: [], expense: [] };
  prisma.merchant = { findUnique: async (a) => { pedido.merchant.push(a); return { timezone }; } };
  prisma.invoice = { findMany: async (a) => { pedido.invoice.push(a); return []; } };
  prisma.expense = { findMany: async (a) => { pedido.expense.push(a); return []; } };
  prisma.quote = { findMany: async () => [] };
  prisma.albaran = { findMany: async () => [] };
  try { return { r: await fn(), pedido }; } finally {
    for (const n of nombres) prisma[n] = original[n];
  }
}

/** Todas las fechas `gte`/`lte` que aparezcan en un `where`, en profundidad. */
function bordes(where) {
  const out = [];
  const ver = (o) => {
    if (!o || typeof o !== 'object' || o instanceof Date) return;
    for (const [k, v] of Object.entries(o)) {
      if ((k === 'gte' || k === 'lte') && v instanceof Date) out.push(`${k}=${v.toISOString()}`);
      else ver(v);
    }
  };
  ver(where);
  return out;
}

const M = 4242;
const CASOS = [
  { zona: 'Europe/Madrid', desdeDia: '2026-04-01', hastaDia: '2026-06-30' },
  { zona: 'Atlantic/Canary', desdeDia: '2026-04-01', hastaDia: '2026-06-30' },
];

async function pideElTrimestreEnLaZona(ruta, { zona, desdeDia, hastaDia }) {
  const router = await routerDeInformes();
  const { r, pedido } = await conPrisma(zona, () => llamar(router, ruta, M, 2026, 2));
  const { desde, hasta } = rangoTrimestre(2026, 2, zona);
  const esperado = [`gte=${desde.toISOString()}`, `lte=${hasta.toISOString()}`];
  // SUELO: la ruta pidió facturas. Sin esto, «no hay bordes malos» sería ciego.
  assert.ok(pedido.invoice.length > 0, `CIEGO: ${ruta} no pidió facturas al doble`);
  assert.deepEqual(pedido.merchant.map((a) => a?.where?.id), [M], `🔴 ${ruta} no leyó la zona de SU comercio`);
  const vistos = [...pedido.invoice, ...pedido.expense].flatMap((a) => bordes(a?.where));
  assert.ok(vistos.length > 0, `CIEGO: ${ruta} pidió sin bordes de fecha`);
  const malos = vistos.filter((b) => !esperado.includes(b));
  assert.deepEqual(malos, [], `🔴 ${ruta}, comercio en ${zona}: esperaba [${esperado.join(' .. ')}]`);
  assert.equal(r.from, desdeDia, `🔴 ${ruta} pinta el primer día del trimestre fuera de la zona del comercio`);
  assert.equal(r.to, hastaDia, `🔴 ${ruta} pinta el último día del trimestre fuera de la zona del comercio`);
}

test('SCRUM-1872b · 🔴 /vat pide el trimestre en la zona del comercio (Madrid)', () => pideElTrimestreEnLaZona('/vat', CASOS[0]));
test('SCRUM-1872b · 🔴 /vat pide el trimestre en la zona del comercio (Canarias)', () => pideElTrimestreEnLaZona('/vat', CASOS[1]));
test('SCRUM-1872b · 🔴 /resumen-trimestre pide el trimestre en la zona del comercio (Madrid)', () => pideElTrimestreEnLaZona('/resumen-trimestre', CASOS[0]));
test('SCRUM-1872b · 🔴 /resumen-trimestre pide el trimestre en la zona del comercio (Canarias)', () => pideElTrimestreEnLaZona('/resumen-trimestre', CASOS[1]));

test('SCRUM-1872b · CONTROL: un comercio SIN zona declarada sigue en UTC (ZONA_POR_DEFECTO), lo de producción hoy', async () => {
  const router = await routerDeInformes();
  const { r, pedido } = await conPrisma(null, () => llamar(router, '/vat', M, 2026, 2));
  const vistos = pedido.invoice.flatMap((a) => bordes(a?.where));
  assert.deepEqual([...new Set(vistos)].sort(), ['gte=2026-04-01T00:00:00.000Z', 'lte=2026-06-30T23:59:59.999Z']);
  assert.equal(r.from, '2026-04-01');
  assert.equal(r.to, '2026-06-30');
});

test('SCRUM-1872b · CONTROL: si el comercio no se puede leer, la ruta NO sigue en UTC (falla cerrado)', async () => {
  const router = await routerDeInformes();
  const { prisma } = await import(DIST + 'core/db/prisma.js');
  // El doble ENTERO (facturas vacías y sin error), y SOLO el comercio sin fila: así el 500 no puede
  // venir de otra lectura. Su control: el mismo doble con fila da 200 (los casos de arriba).
  const { pedido } = await conPrisma(null, async () => {
    prisma.merchant = { findUnique: async () => null };
    await assert.rejects(() => llamar(router, '/vat', M, 2026, 2), /HTTP 500/);
  });
  assert.equal(pedido.invoice.length, 0, '🔴 sin comercio la ruta siguió y pidió facturas en UTC');
});
