// tests/scrum1456-ids-que-no-caben-en-la-columna.test.mjs — SCRUM-1455 y SCRUM-1456
//
// 🔴 UN ID QUE NO CABE EN LA COLUMNA DABA 500 DONDE TOCABA 400, en las fichas de cliente (SCRUM-1456)
// y de factura (SCRUM-1455). Medido en yaqu.app el 2-oct-2026 por S1 (SCRUM-1379 c.18208):
// `#customer-360/99999999999999999999` y `#invoice-detail/99999999999999999999` → 500.
//
// LA FORMA ES UNA Y NO ES NUEVA: `cabeEnColumnaInt` (`src/core/validation/enteroDeColumna.ts`,
// SCRUM-1379). Los dos tickets, y SCRUM-1457, la usan tal cual; aquí no se escribe otra.
//
// ── QUÉ CUBRE Y QUÉ NO ────────────────────────────────────────────────────────────────────
// Las lecturas de id que NO son dinero, emisión ni borrado: 19 de clientes y 7 de facturas. Las
// que esperan el GO de un jefe (cobro, anular, rectificar, borrar, fusionar, webhooks) NO están en
// este fichero: están nombradas, una a una, en `docs/master/SCRUM-1456.md`.
// Tampoco está `POST invoices /:id/send-email`: con un id que no cabe contesta HOY 200 con
// `sent: false` (su `catch` convierte cualquier fallo en «el correo no salió»), no 500. Pasarlo a
// 400 cambia lo que la pantalla hace con la respuesta, así que es una decisión y no este arreglo.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// El de `scrum1379b`: CUALQUIER consulta lanza si entre sus argumentos viaja un número que no cabe
// en un int4, que es lo que hacen Postgres y Prisma. No es la base: por eso cada lectura lleva su
// SUELO (un id que cabe LLEGA a la base y no revienta), y sin él un 400 a todo pasaría igual.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

const consultas = [];
/** Lo que la base «tiene» en el caso en curso: `{ 'customer.findFirst': fila }`. Vacío = no existe nada. */
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

const CLIENTES = '../dist/modules/system/app/routes/customersAdmin.routes.js';
const FACTURAS = '../dist/modules/system/app/routes/invoicesAdmin.routes.js';

/**
 * [módulo, verbo, ruta, dónde viaja el id, qué id, suelo] — UNA FILA POR LECTURA, no por ruta: las
 * rutas que leen dos ids llevan dos filas, y en cada una el otro id va con un valor bueno.
 *
 * `suelo`: qué hacía la ruta con `-1` y `0` ANTES del arreglo, que es lo que tiene que seguir haciendo.
 *   · 'llegan'   → los consulta (la base dice «no existe»).
 *   · 'rechaza'  → ya los rechazaba con 400 (`|| x <= 0`), sin consultar.
 */
const LECTURAS = [
  [CLIENTES, 'get', '/:id', 'params', 'id', 'llegan'],
  [CLIENTES, 'put', '/:id', 'params', 'id', 'llegan'],
  [CLIENTES, 'patch', '/:id', 'params', 'id', 'llegan'],
  [CLIENTES, 'get', '/:id/portal-url', 'params', 'id', 'llegan'],
  [CLIENTES, 'get', '/:id/historial', 'params', 'id', 'rechaza'],
  [CLIENTES, 'get', '/:id/historial', 'query', 'despuesDe', 'rechaza'],
  [CLIENTES, 'get', '/:id/whatsapp', 'params', 'id', 'rechaza'],
  [CLIENTES, 'get', '/:id/whatsapp', 'query', 'despuesDe', 'rechaza'],
  [CLIENTES, 'get', '/:id/notes', 'params', 'id', 'rechaza'],
  [CLIENTES, 'post', '/:id/notes', 'params', 'id', 'rechaza'],
  [CLIENTES, 'get', '/:id/sites', 'params', 'id', 'rechaza'],
  [CLIENTES, 'post', '/:id/sites', 'params', 'id', 'rechaza'],
  [CLIENTES, 'put', '/:id/sites/:siteId', 'params', 'id', 'rechaza'],
  [CLIENTES, 'put', '/:id/sites/:siteId', 'params', 'siteId', 'rechaza'],
  [CLIENTES, 'delete', '/:id/sites/:siteId', 'params', 'id', 'rechaza'],
  [CLIENTES, 'delete', '/:id/sites/:siteId', 'params', 'siteId', 'rechaza'],
  [CLIENTES, 'get', '/:id/detail', 'params', 'id', 'llegan'],
  [CLIENTES, 'get', '/:id/fusion-preview', 'params', 'id', 'rechaza'],
  [CLIENTES, 'get', '/:id/fusion-preview', 'query', 'con', 'rechaza'],
  [FACTURAS, 'get', '/:id', 'params', 'id', 'llegan'],
  [FACTURAS, 'get', '/:id/dispute-package', 'params', 'id', 'llegan'],
  [FACTURAS, 'put', '/:id/tags', 'params', 'id', 'llegan'],
  [FACTURAS, 'get', '/:id/pdf', 'params', 'id', 'llegan'],
  [FACTURAS, 'patch', '/:id/asignados', 'params', 'id', 'llegan'],
  [FACTURAS, 'post', '/:id/resend-whatsapp', 'params', 'id', 'llegan'],
  [FACTURAS, 'post', '/:id/send-reminder', 'params', 'id', 'llegan'],
];

// Un cuerpo que pasa las validaciones de forma de cada ruta, para que lo único que decida sea el id.
const CUERPO = { name: 'Nombre', texto: 'una nota', tags: [], assignedUserIds: [] };
// El otro id de las rutas que leen dos: uno que cabe, y distinto del que se prueba.
const BUENOS = { params: { id: '7', siteId: '8' }, query: { con: '9' } };

function pedidor([modulo, verbo, ruta, donde, cual]) {
  const router = moduloDeDist(modulo).default;
  const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[verbo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${verbo.toUpperCase()} ${ruta} en ${modulo}`);
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  return async (valor, base = {}) => {
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
    const params = { ...BUENOS.params };
    const query = ruta === '/:id/fusion-preview' ? { ...BUENOS.query } : {};
    (donde === 'params' ? params : query)[cual] = valor;
    const callar = console.error; console.error = () => {};
    try {
      await h(reqDeSesion({
        rol: 'admin', merchantId: MERCHANT, method: verbo.toUpperCase(), params, query, body: { ...CUERPO },
        teamMemberId: null,
      }), res);
    } finally { console.error = callar; filas = {}; }
    return { ...r, consultas: consultas.length };
  };
}

const nombreDe = ([modulo, verbo, ruta, donde, cual]) =>
  `${verbo.toUpperCase()} ${modulo.includes('customers') ? 'customers' : 'invoices'} ${ruta} · \`${cual}\` (${donde})`;

test('SCRUM-1456 · el censo de este fichero: 26 lecturas (19 de clientes, 7 de facturas), ninguna repetida', () => {
  assert.equal(LECTURAS.length, 26);
  assert.equal(new Set(LECTURAS.map((l) => l.slice(0, 5).join(' '))).size, 26);
  assert.equal(LECTURAS.filter((l) => l[0] === CLIENTES).length, 19);
  assert.equal(LECTURAS.filter((l) => l[0] === FACTURAS).length, 7);
});

const suelo = casosEscritos(LECTURAS, (l) => `SCRUM-1456 · ${nombreDe(l)} · SUELO: un id que cabe LLEGA a la base, y \`-1\` y \`0\` contestan lo de antes`, async (l) => {
  const pedir = pedidor(l);
  // El mayor id que cabe: se consulta, no se rechaza y el banco no revienta.
  for (const v of ['1', '2147483647']) {
    const r = await pedir(v);
    assert.ok(r.consultas > 0, `🔴 CIEGO: con ${v} la ruta no ha consultado la base (status ${r.status})`);
    assert.notEqual(r.status, 400, `\`${v}\` cabe en la columna: se consulta, no se rechaza`);
    assert.notEqual(r.status, 500, `🔴 CIEGO: con ${v} el banco revienta, y no es por el id`);
  }
  for (const v of ['-1', '0']) {
    const r = await pedir(v);
    if (l[5] === 'rechaza') {
      assert.equal(r.status, 400, `\`${v}\` ya daba 400 aquí (\`|| x <= 0\`) y lo sigue dando`);
      assert.equal(r.consultas, 0);
    } else {
      assert.ok(r.consultas > 0, `\`${v}\` cabe en la columna y aquí siempre llegó a la base (status ${r.status})`);
      assert.notEqual(r.status, 400, `\`${v}\` no era un 400 en esta ruta y no pasa a serlo`);
      assert.notEqual(r.status, 500);
    }
  }
});
const caso = casosEscritos(LECTURAS, (l) => `SCRUM-1456 · ${nombreDe(l)} · 🔴 un id que no cabe en la columna → 400, sin tocar la base`, async (l) => {
  const pedir = pedidor(l);
  // El medido en producción, el «seguro» para JavaScript, el primero que no cabe (por arriba y por
  // abajo) y un decimal.
  for (const v of ['99999999999999999999', '10000000000', '2147483648', '-2147483649', '1.5']) {
    const r = await pedir(v);
    assert.equal(r.status, 400, `🔴 con ${v} responde ${r.status}: la ruta lo ha dejado pasar`);
    assert.equal(r.consultas, 0, `🔴 con ${v} se lanzó una consulta`);
  }
  const abc = await pedir('abc');
  assert.equal(abc.status, 400, '`abc` daba 400 y lo sigue dando');
  assert.equal(abc.consultas, 0);
});

test('SCRUM-1456 · GET customers /:id · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(0));
test('SCRUM-1456 · GET customers /:id · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(0));
test('SCRUM-1456 · PUT customers /:id · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(1));
test('SCRUM-1456 · PUT customers /:id · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(1));
test('SCRUM-1456 · PATCH customers /:id · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(2));
test('SCRUM-1456 · PATCH customers /:id · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(2));
test('SCRUM-1456 · GET customers /:id/portal-url · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(3));
test('SCRUM-1456 · GET customers /:id/portal-url · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(3));
test('SCRUM-1456 · GET customers /:id/historial · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(4));
test('SCRUM-1456 · GET customers /:id/historial · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(4));
test('SCRUM-1456 · GET customers /:id/historial · `despuesDe` (query) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(5));
test('SCRUM-1456 · GET customers /:id/historial · `despuesDe` (query) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(5));
test('SCRUM-1456 · GET customers /:id/whatsapp · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(6));
test('SCRUM-1456 · GET customers /:id/whatsapp · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(6));
test('SCRUM-1456 · GET customers /:id/whatsapp · `despuesDe` (query) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(7));
test('SCRUM-1456 · GET customers /:id/whatsapp · `despuesDe` (query) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(7));
test('SCRUM-1456 · GET customers /:id/notes · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(8));
test('SCRUM-1456 · GET customers /:id/notes · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(8));
test('SCRUM-1456 · POST customers /:id/notes · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(9));
test('SCRUM-1456 · POST customers /:id/notes · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(9));
test('SCRUM-1456 · GET customers /:id/sites · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(10));
test('SCRUM-1456 · GET customers /:id/sites · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(10));
test('SCRUM-1456 · POST customers /:id/sites · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(11));
test('SCRUM-1456 · POST customers /:id/sites · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(11));
test('SCRUM-1456 · PUT customers /:id/sites/:siteId · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(12));
test('SCRUM-1456 · PUT customers /:id/sites/:siteId · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(12));
test('SCRUM-1456 · PUT customers /:id/sites/:siteId · `siteId` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(13));
test('SCRUM-1456 · PUT customers /:id/sites/:siteId · `siteId` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(13));
test('SCRUM-1456 · DELETE customers /:id/sites/:siteId · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(14));
test('SCRUM-1456 · DELETE customers /:id/sites/:siteId · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(14));
test('SCRUM-1456 · DELETE customers /:id/sites/:siteId · `siteId` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(15));
test('SCRUM-1456 · DELETE customers /:id/sites/:siteId · `siteId` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(15));
test('SCRUM-1456 · GET customers /:id/detail · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(16));
test('SCRUM-1456 · GET customers /:id/detail · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(16));
test('SCRUM-1456 · GET customers /:id/fusion-preview · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(17));
test('SCRUM-1456 · GET customers /:id/fusion-preview · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(17));
test('SCRUM-1456 · GET customers /:id/fusion-preview · `con` (query) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(18));
test('SCRUM-1456 · GET customers /:id/fusion-preview · `con` (query) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(18));
test('SCRUM-1456 · GET invoices /:id · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(19));
test('SCRUM-1456 · GET invoices /:id · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(19));
test('SCRUM-1456 · GET invoices /:id/dispute-package · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(20));
test('SCRUM-1456 · GET invoices /:id/dispute-package · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(20));
test('SCRUM-1456 · PUT invoices /:id/tags · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(21));
test('SCRUM-1456 · PUT invoices /:id/tags · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(21));
test('SCRUM-1456 · GET invoices /:id/pdf · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(22));
test('SCRUM-1456 · GET invoices /:id/pdf · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(22));
test('SCRUM-1456 · PATCH invoices /:id/asignados · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(23));
test('SCRUM-1456 · PATCH invoices /:id/asignados · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(23));
test('SCRUM-1456 · POST invoices /:id/resend-whatsapp · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(24));
test('SCRUM-1456 · POST invoices /:id/resend-whatsapp · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(24));
test('SCRUM-1456 · POST invoices /:id/send-reminder · `id` (params) · SUELO: un id que cabe LLEGA a la base, y `-1` y `0` contestan lo de antes', suelo(25));
test('SCRUM-1456 · POST invoices /:id/send-reminder · `id` (params) · 🔴 un id que no cabe en la columna → 400, sin tocar la base', caso(25));
suelo.todos();
caso.todos();

// ── «Un id que existe, 200» (aceptación 2 de los dos tickets) ────────────────────────────────
// Sin esto, todo lo de arriba pasaría igual si la ruta contestara «no existe» a cualquier id.
test('SCRUM-1456 · GET customers /:id · un cliente que EXISTE se sigue devolviendo: 200 con su fila', async () => {
  const pedir = pedidor(LECTURAS[0]);
  const r = await pedir('7', { 'customer.findFirst': { id: 7, name: 'Cliente de prueba' } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { id: 7, name: 'Cliente de prueba' });
});

test('SCRUM-1455 · PUT invoices /:id/tags · una factura que EXISTE se sigue etiquetando: 200', async () => {
  const pedir = pedidor(LECTURAS[21]);
  const r = await pedir('7', { 'invoice.updateMany': { count: 1 } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { ok: true });
});
