// tests/scrum1379d-id-en-rutas-que-emiten.test.mjs — SCRUM-1379 (cuarta tanda)
//
// 🔴 LAS OCHO LÍNEAS QUE ESPERABAN AL FUNDADOR: el id que llega de fuera a un handler que EMITE.
//
// Las tres primeras tandas las dejaron sin tocar (reglas 38/40). El cambio es UNO y es el mismo en las
// ocho: `Number.isInteger(x)` → `cabeEnColumnaInt(x)`, en su misma línea. Nada se mueve, nada se
// exporta, ninguna firma cambia. Este fichero sólo LEE el camino: llama a los handlers de `dist/`.
//
// ⚠️ NINGUNO DE ESTOS CASOS EMITE NADA, y es a propósito: la base doblada contesta «no existe», así
// que cada ruta se corta en su 404 mucho antes de la emisión. Lo que se mide es la PUERTA del id.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// El de `scrum1379b`: CUALQUIER consulta lanza si entre sus argumentos viaja un número que no cabe en
// un int4, que es lo que hacen Postgres y Prisma. No es la base: por eso cada ruta lleva su SUELO.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const consultas = [];
/** Lo que la base «tiene» en el caso en curso: `{ 'job.findFirst': fila }`. Vacío = no existe nada. */
let filas = {};

function cabe(n) {
  return Number.isInteger(n) && n >= -2147483648 && n <= 2147483647;
}
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
const respuestas = new Proxy({}, {
  get: (_t, clave) => (args) => {
    const nombre = String(clave);
    consultas.push(nombre);
    const malo = numerosDe(args).find((n) => !cabe(n));
    if (malo !== undefined) throw new Error(`Unable to fit value ${malo} into a 32-bit signed integer`);
    return nombre in filas ? filas[nombre] : vacio(nombre.split('.').pop());
  },
});
inyectarBase(respuestas);

const JOBS = '../dist/modules/jobs/app/routes/jobs.routes.js';
const ALBARANES = '../dist/modules/jobs/app/routes/albaranes.routes.js';
const QUOTES = '../dist/modules/system/app/routes/quotesAdmin.routes.js';

/** [módulo, verbo, ruta] — las rutas cuyo id de la URL pasa por una de las líneas tocadas. */
const RUTAS = [
  [JOBS, 'post', '/:id/collect-rest'],
  [JOBS, 'post', '/:id/consolidar-albaranes'],
  [QUOTES, 'post', '/:id/invoice'],
  [QUOTES, 'post', '/:id/invoice-manual'],
  // `findAlbaran`: una línea, y por ella pasan las rutas `/:id` del albarán salvo el `GET`.
  [ALBARANES, 'post', '/:id/facturar-parcial'],
  [ALBARANES, 'post', '/:id/convertir-en-factura'],
  [ALBARANES, 'patch', '/:id'],
];

function pedidor(modulo, verbo, ruta) {
  const router = moduloDeDist(modulo).default;
  const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[verbo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${verbo.toUpperCase()} ${ruta} en ${modulo}`);
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  return async ({ id, body = {}, base = {} }) => {
    consultas.length = 0;
    filas = base;
    const r = { status: 200, data: undefined };
    const res = new Proxy({}, {
      get: (_t, p) => {
        if (p === 'then') return undefined; // un `res` que contesta a `then` cuelga el `async` (SCRUM-1379b)
        if (p === 'status') return (s) => { r.status = s; return res; };
        if (p === 'json' || p === 'send') return (j) => { r.data = j; return res; };
        return () => res;
      },
    });
    const callar = console.error; console.error = () => {};
    try {
      await h(reqDeSesion({
        rol: 'admin', merchantId: MERCHANT, params: id === undefined ? {} : { id }, body, query: {},
        teamMemberId: null,
      }), res);
    } finally { console.error = callar; filas = {}; }
    return { ...r, consultas: [...consultas] };
  };
}

const suelo = (i) => async () => {
  const pedir = pedidor(...RUTAS[i]);
  for (const v of ['-1', '0', '2147483647']) {
    const r = await pedir({ id: v });
    assert.ok(r.consultas.length > 0, `🔴 CIEGO: con ${v} la ruta no ha consultado la base (status ${r.status})`);
    assert.equal(r.status, 404, `\`${v}\` cabe en la columna: se consulta y «no existe» (responde ${r.status})`);
  }
};
const caso = (i) => async () => {
  const pedir = pedidor(...RUTAS[i]);
  // El medido en producción, el «seguro» para JavaScript y el primero que no cabe.
  for (const v of ['99999999999999999999', '10000000000', '2147483648']) {
    const r = await pedir({ id: v });
    assert.equal(r.status, 400, `🔴 con ${v} responde ${r.status}: la ruta lo ha dejado pasar`);
    assert.deepEqual(r.consultas, [], `🔴 con ${v} se lanzó una consulta`);
  }
  // Controles: lo que ya era 400 lo sigue siendo.
  for (const v of ['1.5', 'abc']) {
    const r = await pedir({ id: v });
    assert.equal(r.status, 400, `\`${v}\` daba 400 y lo sigue dando`);
    assert.deepEqual(r.consultas, []);
  }
};

test('SCRUM-1379d · el censo de este fichero: 7 rutas por la URL, ninguna repetida', () => {
  assert.equal(RUTAS.length, 7);
  assert.equal(new Set(RUTAS.map((r) => r.join(' '))).size, 7);
});

test('SCRUM-1379d · POST jobs /:id/collect-rest · SUELO: `-1`, `0` y el mayor id LLEGAN a la base → 404', suelo(0));
test('SCRUM-1379d · POST jobs /:id/collect-rest · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(0));
test('SCRUM-1379d · POST jobs /:id/consolidar-albaranes · SUELO: `-1`, `0` y el mayor id LLEGAN a la base → 404', suelo(1));
test('SCRUM-1379d · POST jobs /:id/consolidar-albaranes · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(1));
test('SCRUM-1379d · POST quotes /:id/invoice · SUELO: `-1`, `0` y el mayor id LLEGAN a la base → 404', suelo(2));
test('SCRUM-1379d · POST quotes /:id/invoice · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(2));
test('SCRUM-1379d · POST quotes /:id/invoice-manual · SUELO: `-1`, `0` y el mayor id LLEGAN a la base → 404', suelo(3));
test('SCRUM-1379d · POST quotes /:id/invoice-manual · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(3));
test('SCRUM-1379d · POST albaranes /:id/facturar-parcial · SUELO: `-1`, `0` y el mayor id LLEGAN a la base → 404', suelo(4));
test('SCRUM-1379d · POST albaranes /:id/facturar-parcial · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(4));
test('SCRUM-1379d · POST albaranes /:id/convertir-en-factura · SUELO: `-1`, `0` y el mayor id LLEGAN a la base → 404', suelo(5));
test('SCRUM-1379d · POST albaranes /:id/convertir-en-factura · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(5));
test('SCRUM-1379d · PATCH albaranes /:id · SUELO: `-1`, `0` y el mayor id LLEGAN a la base → 404', suelo(6));
test('SCRUM-1379d · PATCH albaranes /:id · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(6));

// ── Los ids que llegan en el CUERPO de las dos consolidaciones ────────────────────────────────
// Un merchant de fuera de España: `getEmissionMode` da «fiscal» sin mirar ningún flag, y la ruta del
// Trabajo llega hasta la selección (allí la puerta de modo va ANTES que los ids).
const MERCHANT_FILA = { id: MERCHANT, email: 'qa-1379d@example.test', country: 'PT', flags: {}, defaultCurrency: 'EUR', taxId: null };
const NO_CABEN = [99999999999999999999, 10000000000, 2147483648];

test('SCRUM-1379d · POST albaranes /consolidar · `customerId` que no cabe → 400 `customer_requerido`, sin tocar la base', async () => {
  const pedir = pedidor(ALBARANES, 'post', '/consolidar');
  const suelo7 = await pedir({ body: { customerId: 7, albaranIds: [5] } });
  assert.deepEqual(suelo7.consultas, ['customer.findFirst'], '🔴 CIEGO: con un cliente que cabe no se ha consultado la base');
  assert.equal(suelo7.status, 404, 'un cliente que cabe y no existe es un 404');
  for (const customerId of NO_CABEN) {
    const r = await pedir({ body: { customerId, albaranIds: [5] } });
    assert.equal(r.status, 400, `🔴 con ${customerId} responde ${r.status}`);
    assert.equal(r.data.error, 'customer_requerido', 'el 400 es el que ya existía, sin texto nuevo');
    assert.deepEqual(r.consultas, []);
  }
});

test('SCRUM-1379d · POST albaranes /consolidar · `albaranIds` que no caben se descartan como ya se descartaba `abc` → `seleccion_vacia`', async () => {
  const pedir = pedidor(ALBARANES, 'post', '/consolidar');
  const base = { 'customer.findFirst': { id: 7, name: 'Cliente de prueba' }, 'merchant.findUnique': MERCHANT_FILA };
  const suelo5 = await pedir({ body: { customerId: 7, albaranIds: [5] }, base });
  assert.ok(suelo5.consultas.includes('albaran.findMany'), `🔴 CIEGO: con un parte que cabe no se llega a buscarlo (${suelo5.consultas})`);
  assert.equal(suelo5.status, 404);
  assert.equal(suelo5.data.error, 'albaran_no_encontrado');
  const viejo = await pedir({ body: { customerId: 7, albaranIds: ['abc'] }, base });
  assert.equal(viejo.data.error, 'seleccion_vacia', 'SUELO: lo que no es un id ya se descartaba así');
  const r = await pedir({ body: { customerId: 7, albaranIds: NO_CABEN }, base });
  assert.equal(r.status, 400, `🔴 responde ${r.status}: un id de parte que no cabe ha llegado a la base`);
  assert.equal(r.data.error, 'seleccion_vacia');
  assert.ok(!r.consultas.includes('albaran.findMany'), '🔴 se buscó el parte con un id que no cabe');
});

test('SCRUM-1379d · POST jobs /:id/consolidar-albaranes · `albaranIds` que no caben se descartan → `seleccion_vacia`', async () => {
  const pedir = pedidor(JOBS, 'post', '/:id/consolidar-albaranes');
  const base = { 'job.findFirst': { id: 31, merchantId: MERCHANT, customerId: 7 }, 'merchant.findUnique': MERCHANT_FILA };
  const suelo5 = await pedir({ id: '31', body: { albaranIds: [5] }, base });
  assert.ok(suelo5.consultas.includes('albaran.findMany'), `🔴 CIEGO: con un parte que cabe no se llega a buscarlo (${suelo5.consultas})`);
  assert.equal(suelo5.status, 404);
  assert.equal(suelo5.data.error, 'albaran_no_encontrado');
  const r = await pedir({ id: '31', body: { albaranIds: NO_CABEN }, base });
  assert.equal(r.status, 400, `🔴 responde ${r.status}: un id de parte que no cabe ha llegado a la base`);
  assert.equal(r.data.error, 'seleccion_vacia');
  assert.ok(!r.consultas.includes('albaran.findMany'), '🔴 se buscó el parte con un id que no cabe');
});

test('SCRUM-1379d · 🔴 LO QUE CAMBIA Y SE DICE: un id que no cabe MEZCLADO con uno bueno se descarta, y la selección sigue con el bueno', async () => {
  // Es la conducta que `abc` ya tenía en estas dos rutas (el filtro tira lo que no es un id y sigue).
  // Antes un id fuera de rango reventaba la consulta (500); ahora corre la suerte de `abc`.
  const pedir = pedidor(JOBS, 'post', '/:id/consolidar-albaranes');
  const base = { 'job.findFirst': { id: 31, merchantId: MERCHANT, customerId: 7 }, 'merchant.findUnique': MERCHANT_FILA };
  const conAbc = await pedir({ id: '31', body: { albaranIds: [5, 'abc'] }, base });
  const conEnorme = await pedir({ id: '31', body: { albaranIds: [5, 99999999999999999999] }, base });
  assert.equal(conAbc.status, 404);
  assert.deepEqual([conEnorme.status, conEnorme.data.error], [conAbc.status, conAbc.data.error], 'un id enorme y `abc` reciben la MISMA respuesta');
  assert.deepEqual(conEnorme.consultas, conAbc.consultas);
});
