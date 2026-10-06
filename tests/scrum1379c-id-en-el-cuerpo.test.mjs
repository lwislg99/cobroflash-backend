// tests/scrum1379c-id-en-el-cuerpo.test.mjs — SCRUM-1379 (tercera tanda)
//
// 🔴 LOS IDS QUE LLEGAN EN EL CUERPO (y en la query), NO EN LA URL.
//
// Las dos primeras tandas cerraron el id de la URL. Quedó escrito lo que faltaba: el `quoteId` o el
// `providerId` de un gasto viajan en el cuerpo, van a la misma columna `Int` y nadie los miraba. Un
// valor que no cabe llegaba a la base y salía 500.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// El mismo que `scrum1379b`: las RUTAS de `dist/` con la base doblada, y el doble lanza si en una
// consulta viaja un número que no cabe en un int4. Cada caso lleva su SUELO: con un id que cabe, la
// ruta SÍ consulta la base — sin eso, un 400 por otro motivo se leería como un acierto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';
import { datosDeTrabajoDirecto } from '../dist/modules/jobs/domain/trabajoDirecto.js';
import { normalizarAsignados } from '../dist/modules/jobs/domain/asignacionDeTrabajo.js';

const consultas = [];
const cabe = (n) => Number.isInteger(n) && n >= -2147483648 && n <= 2147483647;
function numerosDe(v, acc = []) {
  if (typeof v === 'number') acc.push(v);
  else if (v && typeof v === 'object' && !(v instanceof Date)) for (const x of Object.values(v)) numerosDe(x, acc);
  return acc;
}
function vacio(metodo) {
  if (metodo === 'findMany') return [];
  if (metodo === 'count') return 0;
  if (metodo === 'aggregate') return { _max: {}, _count: 0 };
  if (metodo === 'findUnique' || metodo === 'findFirst') return null;
  if (metodo === 'updateMany' || metodo === 'deleteMany') return { count: 0 };
  return {};
}
inyectarBase(new Proxy({}, {
  get: (_t, clave) => (args) => {
    const nombre = String(clave);
    consultas.push(nombre);
    const malo = numerosDe(args).find((n) => !cabe(n));
    if (malo !== undefined) throw new Error(`Unable to fit value ${malo} into a 32-bit signed integer`);
    return vacio(nombre.split('.').pop());
  },
}));

const GASTOS = '../dist/modules/expenses/app/routes/expenses.routes.js';
const PRODUCTOS = '../dist/modules/products/app/routes/products.routes.js';
// Los que no caben: el medido en producción, el «seguro» para JavaScript, el primero que no cabe, un decimal.
const NO_CABEN = ['99999999999999999999', 10000000000, 2147483648, '1.5'];

async function pedir(modulo, verbo, ruta, { body = {}, query = {}, params = {} }) {
  const router = moduloDeDist(modulo).default;
  const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[verbo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${verbo.toUpperCase()} ${ruta} en ${modulo}`);
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  consultas.length = 0;
  const r = { status: 200, data: undefined };
  const res = new Proxy({}, {
    get: (_t, p) => {
      if (p === 'then') return undefined; // un `res` con `then` es una promesa que no acaba (SCRUM-1379b)
      if (p === 'status') return (s) => { r.status = s; return res; };
      if (p === 'json' || p === 'send') return (j) => { r.data = j; return res; };
      return () => res;
    },
  });
  const callar = console.error; console.error = () => {};
  try { await h(reqDeSesion({ rol: 'admin', merchantId: MERCHANT, params, body, query, teamMemberId: null }), res); }
  finally { console.error = callar; }
  return { ...r, consultas: consultas.length };
}

async function suelo(modulo, verbo, ruta, peticion) {
  const r = await pedir(modulo, verbo, ruta, peticion);
  assert.ok(r.consultas > 0, `🔴 CIEGO: con un id que cabe la ruta no ha consultado la base (status ${r.status})`);
  // No se exige «no 400»: con la base vacía el alta de un gasto contesta 400 porque el presupuesto no
  // existe. Lo que el suelo afirma es que el id NO se rechazó por su forma y que se llegó a preguntar.
  assert.notEqual(r.data?.error, 'invalid_id', 'un id que cabe en la columna se consulta, no se rechaza');
}
async function rechaza(modulo, verbo, ruta, conId) {
  for (const v of NO_CABEN) {
    const r = await pedir(modulo, verbo, ruta, conId(v));
    assert.equal(r.status, 400, `🔴 con ${v} responde ${r.status}: la ruta lo ha dejado pasar`);
    assert.equal(r.data?.error, 'invalid_id');
    assert.equal(r.consultas, 0, `🔴 con ${v} se lanzó una consulta`);
  }
}

const GASTO = { concept: 'Material', amount: 10 };
const PRODUCTO = { name: 'Tornillo', price: 2 };

test('SCRUM-1379c · POST gasto · SUELO: con `quoteId` y `providerId` que caben, llega a la base', () =>
  suelo(GASTOS, 'post', '/', { body: { ...GASTO, quoteId: 5, providerId: 2147483647 } }));
test('SCRUM-1379c · POST gasto · 🔴 un `quoteId` del cuerpo que no cabe → 400, sin tocar la base', () =>
  rechaza(GASTOS, 'post', '/', (v) => ({ body: { ...GASTO, quoteId: v } })));
test('SCRUM-1379c · POST gasto · 🔴 un `providerId` del cuerpo que no cabe → 400, sin tocar la base', () =>
  rechaza(GASTOS, 'post', '/', (v) => ({ body: { ...GASTO, providerId: v } })));

test('SCRUM-1379c · PUT gasto · SUELO: con ids que caben, llega a la base', () =>
  suelo(GASTOS, 'put', '/:id', { params: { id: '7' }, body: { quoteId: 5, providerId: 6 } }));
test('SCRUM-1379c · PUT gasto · 🔴 un `quoteId` del cuerpo que no cabe → 400, sin tocar la base', () =>
  rechaza(GASTOS, 'put', '/:id', (v) => ({ params: { id: '7' }, body: { quoteId: v } })));
test('SCRUM-1379c · PUT gasto · 🔴 un `providerId` del cuerpo que no cabe → 400, sin tocar la base', () =>
  rechaza(GASTOS, 'put', '/:id', (v) => ({ params: { id: '7' }, body: { providerId: v } })));
test('SCRUM-1379c · PUT gasto · quitar el presupuesto (`quoteId: null`) sigue pasando', () =>
  suelo(GASTOS, 'put', '/:id', { params: { id: '7' }, body: { quoteId: null, providerId: null } }));

test('SCRUM-1379c · GET gastos · SUELO: `?quoteId=5` llega a la base', () =>
  suelo(GASTOS, 'get', '/', { query: { quoteId: '5' } }));
test('SCRUM-1379c · GET gastos · 🔴 un `?quoteId=` que no cabe → 400, sin tocar la base', () =>
  rechaza(GASTOS, 'get', '/', (v) => ({ query: { quoteId: String(v) } })));

test('SCRUM-1379c · POST producto · SUELO: con `providerId` que cabe, llega a la base', () =>
  suelo(PRODUCTOS, 'post', '/', { body: { ...PRODUCTO, providerId: 5 } }));
test('SCRUM-1379c · POST producto · 🔴 un `providerId` del cuerpo que no cabe → 400, sin tocar la base', () =>
  rechaza(PRODUCTOS, 'post', '/', (v) => ({ body: { ...PRODUCTO, providerId: v } })));
test('SCRUM-1379c · PUT producto · SUELO: con `providerId` que cabe, llega a la base', () =>
  suelo(PRODUCTOS, 'put', '/:id', { params: { id: '7' }, body: { providerId: 5 } }));
test('SCRUM-1379c · PUT producto · 🔴 un `providerId` del cuerpo que no cabe → 400, sin tocar la base', () =>
  rechaza(PRODUCTOS, 'put', '/:id', (v) => ({ params: { id: '7' }, body: { providerId: v } })));

test('SCRUM-1379c · Trabajo directo · el cliente del cuerpo: cabe → pasa; no cabe → `customer_required`', () => {
  assert.equal(datosDeTrabajoDirecto({ customerId: 2147483647 }).ok, true, 'SUELO: el mayor id que cabe');
  for (const v of NO_CABEN) {
    assert.deepEqual(datosDeTrabajoDirecto({ customerId: v }), { ok: false, error: 'customer_required' }, `con ${v}`);
  }
});

test('SCRUM-1379c · Asignados · un id que no cabe se descarta como cualquier otro que no es un id', () => {
  assert.deepEqual(normalizarAsignados([3, 2147483647, '4']), [3, 2147483647, 4], 'SUELO');
  assert.deepEqual(normalizarAsignados([3, ...NO_CABEN, 4]), [3, 4]);
});
