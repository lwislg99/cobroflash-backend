// tests/scrum1379b-id-fuera-de-rango-resto.test.mjs — SCRUM-1379 (segunda tanda)
//
// 🔴 LAS RUTAS QUE EL PRIMER CENSO NO VIO.
//
// SCRUM-1379 censó por `Number.isInteger` y dejó escrito lo que no veía: las rutas que validan el id
// con `Number.isNaN` o `Number.isFinite`. Tienen el mismo agujero (un id que no cabe en la columna
// `Int` llega a la base y sale 500) **y además dejaban pasar un decimal**. Aquí están las 24 del
// carril de S1 que no emiten, cada una por su handler de verdad.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// Las RUTAS de `dist/` con la base doblada por `_envio-doblado.mjs`. ⚠️ El doble MODELA la base en una
// cosa, y se dice: CUALQUIER consulta, de cualquier modelo, lanza si entre sus argumentos viaja un
// número que no es un entero de int4 — que es lo que hacen Postgres y Prisma. No es la base: por eso
// cada ruta lleva su SUELO (`-1` y `0` LLEGAN a la base y no dan 400) antes de creerse el 400.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

const consultas = [];

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
// Toda consulta se apunta, y revienta si lleva un número que no cabe. Responde lo vacío: «no existe».
const respuestas = new Proxy({}, {
  get: (_t, clave) => (args) => {
    const nombre = String(clave);
    consultas.push(nombre);
    const malo = numerosDe(args).find((n) => !cabe(n));
    if (malo !== undefined) throw new Error(`Unable to fit value ${malo} into a 32-bit signed integer`);
    return vacio(nombre.split('.').pop());
  },
});
inyectarBase(respuestas);

const M = '../dist/modules/';
/** [módulo, verbo, ruta, nombre del parámetro] — las 24, una por línea. */
const RUTAS = [
  ['expenses/app/routes/expenses.routes.js', 'get', '/margin/:quoteId', 'quoteId'],
  ['expenses/app/routes/expenses.routes.js', 'get', '/:id/foto', 'id'],
  ['expenses/app/routes/expenses.routes.js', 'put', '/:id', 'id'],
  ['expenses/app/routes/expenses.routes.js', 'delete', '/:id', 'id'],
  ['products/app/routes/products.routes.js', 'get', '/:id', 'id'],
  ['products/app/routes/products.routes.js', 'put', '/:id', 'id'],
  ['providers/app/routes/providers.routes.js', 'put', '/:id', 'id'],
  ['providers/app/routes/providers.routes.js', 'delete', '/:id', 'id'],
  ['quoteRequests/app/routes/attachments.routes.js', 'get', '/:id', 'id'],
  ['quoteRequests/app/routes/quoteRequests.routes.js', 'patch', '/:id', 'id'],
  ['team/app/routes/team.routes.js', 'put', '/:id', 'id'],
  ['team/app/routes/team.routes.js', 'post', '/:id/resend', 'id'],
  ['team/app/routes/team.routes.js', 'delete', '/:id', 'id'],
  ['templates/app/routes/templates.routes.js', 'put', '/:id', 'id'],
  ['templates/app/routes/templates.routes.js', 'delete', '/:id', 'id'],
  ['system/app/routes/quotesAdmin.routes.js', 'post', '/:id/accept', 'id'],
  ['system/app/routes/quotesAdmin.routes.js', 'post', '/:id/reject', 'id'],
  ['system/app/routes/quotesAdmin.routes.js', 'post', '/:id/send-whatsapp', 'id'],
  ['system/app/routes/quotesAdmin.routes.js', 'get', '/:id/pdf', 'id'],
  ['system/app/routes/quotesAdmin.routes.js', 'post', '/:id/send-email', 'id'],
  ['system/app/routes/quotesAdmin.routes.js', 'post', '/:id/approve', 'id'],
  ['system/app/routes/quotesAdmin.routes.js', 'put', '/:id/notes', 'id'],
  ['system/app/routes/quotesAdmin.routes.js', 'put', '/:id/tags', 'id'],
  ['system/app/routes/quotesAdmin.routes.js', 'get', '/:id', 'id'],
];

// Un cuerpo que pasa las validaciones de forma de cada ruta, para que lo único que decida sea el id.
const CUERPO = { status: 'read', tags: [], notes: 'nota', name: 'Nombre' };

function pedidor(modulo, verbo, ruta, param) {
  const router = moduloDeDist(M + modulo).default;
  const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[verbo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${verbo.toUpperCase()} ${ruta} en ${modulo}`);
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  return async (valor) => {
    consultas.length = 0;
    const r = { status: 200, data: undefined };
    const res = new Proxy({}, {
      get: (_t, p) => {
        // Los handlers hacen `return res.json(…)` dentro de un `async`: si `res` tuviera `then`, sería
        // un thenable que nunca resuelve y el test se quedaría colgado (medido: así cayó la 1.ª corrida).
        if (p === 'then') return undefined;
        if (p === 'status') return (s) => { r.status = s; return res; };
        if (p === 'json' || p === 'send') return (j) => { r.data = j; return res; };
        return () => res;
      },
    });
    const callar = console.error; console.error = () => {};
    try {
      await h(reqDeSesion({
        rol: 'admin', merchantId: MERCHANT, params: { [param]: valor }, body: { ...CUERPO }, query: {},
        teamMemberId: null,
      }), res);
    } finally { console.error = callar; }
    return { ...r, consultas: consultas.length };
  };
}

test('SCRUM-1379b · el censo de este fichero: 24 rutas, ninguna repetida', () => {
  assert.equal(RUTAS.length, 24);
  assert.equal(new Set(RUTAS.map((r) => r.slice(0, 3).join(' '))).size, 24);
});

const casoa = casosEscritos(RUTAS, ([modulo, verbo, ruta, param]) => `SCRUM-1379b · ${verbo.toUpperCase()} ${modulo.split('/')[0]} ${ruta} · SUELO: \`-1\` y \`0\` LLEGAN a la base y no son un 400`, async ([modulo, verbo, ruta, param]) => {
  const pedir = pedidor(modulo, verbo, ruta, param);
  for (const v of ['-1', '0', '2147483647']) {
    const r = await pedir(v);
    assert.ok(r.consultas > 0, `🔴 CIEGO: con ${v} la ruta no ha consultado la base (status ${r.status})`);
    assert.notEqual(r.status, 400, `\`${v}\` cabe en la columna: se consulta, no se rechaza`);
    assert.notEqual(r.status, 500, `🔴 CIEGO: con ${v} el banco revienta, y no es por el id`);
  }
});
const casob = casosEscritos(RUTAS, ([modulo, verbo, ruta, param]) => `SCRUM-1379b · ${verbo.toUpperCase()} ${modulo.split('/')[0]} ${ruta} · 🔴 un id que no cabe en la columna → 400, sin tocar la base`, async ([modulo, verbo, ruta, param]) => {
  const pedir = pedidor(modulo, verbo, ruta, param);
  // El medido en producción, el «seguro» para JavaScript, el primero que no cabe y un decimal.
  for (const v of ['99999999999999999999', '10000000000', '2147483648', '1.5']) {
    const r = await pedir(v);
    assert.equal(r.status, 400, `🔴 con ${v} responde ${r.status}: la ruta lo ha dejado pasar`);
    assert.equal(r.consultas, 0, `🔴 con ${v} se lanzó una consulta`);
  }
  const abc = await pedir('abc');
  assert.equal(abc.status, 400, '`abc` daba 400 y lo sigue dando');
  assert.equal(abc.consultas, 0);
});
test('SCRUM-1379b · GET expenses /margin/:quoteId · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(0));
test('SCRUM-1379b · GET expenses /margin/:quoteId · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(0));
test('SCRUM-1379b · GET expenses /:id/foto · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(1));
test('SCRUM-1379b · GET expenses /:id/foto · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(1));
test('SCRUM-1379b · PUT expenses /:id · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(2));
test('SCRUM-1379b · PUT expenses /:id · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(2));
test('SCRUM-1379b · DELETE expenses /:id · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(3));
test('SCRUM-1379b · DELETE expenses /:id · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(3));
test('SCRUM-1379b · GET products /:id · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(4));
test('SCRUM-1379b · GET products /:id · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(4));
test('SCRUM-1379b · PUT products /:id · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(5));
test('SCRUM-1379b · PUT products /:id · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(5));
test('SCRUM-1379b · PUT providers /:id · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(6));
test('SCRUM-1379b · PUT providers /:id · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(6));
test('SCRUM-1379b · DELETE providers /:id · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(7));
test('SCRUM-1379b · DELETE providers /:id · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(7));
test('SCRUM-1379b · GET quoteRequests /:id · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(8));
test('SCRUM-1379b · GET quoteRequests /:id · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(8));
test('SCRUM-1379b · PATCH quoteRequests /:id · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(9));
test('SCRUM-1379b · PATCH quoteRequests /:id · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(9));
test('SCRUM-1379b · PUT team /:id · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(10));
test('SCRUM-1379b · PUT team /:id · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(10));
test('SCRUM-1379b · POST team /:id/resend · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(11));
test('SCRUM-1379b · POST team /:id/resend · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(11));
test('SCRUM-1379b · DELETE team /:id · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(12));
test('SCRUM-1379b · DELETE team /:id · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(12));
test('SCRUM-1379b · PUT templates /:id · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(13));
test('SCRUM-1379b · PUT templates /:id · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(13));
test('SCRUM-1379b · DELETE templates /:id · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(14));
test('SCRUM-1379b · DELETE templates /:id · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(14));
test('SCRUM-1379b · POST system /:id/accept · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(15));
test('SCRUM-1379b · POST system /:id/accept · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(15));
test('SCRUM-1379b · POST system /:id/reject · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(16));
test('SCRUM-1379b · POST system /:id/reject · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(16));
test('SCRUM-1379b · POST system /:id/send-whatsapp · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(17));
test('SCRUM-1379b · POST system /:id/send-whatsapp · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(17));
test('SCRUM-1379b · GET system /:id/pdf · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(18));
test('SCRUM-1379b · GET system /:id/pdf · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(18));
test('SCRUM-1379b · POST system /:id/send-email · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(19));
test('SCRUM-1379b · POST system /:id/send-email · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(19));
test('SCRUM-1379b · POST system /:id/approve · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(20));
test('SCRUM-1379b · POST system /:id/approve · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(20));
test('SCRUM-1379b · PUT system /:id/notes · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(21));
test('SCRUM-1379b · PUT system /:id/notes · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(21));
test('SCRUM-1379b · PUT system /:id/tags · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(22));
test('SCRUM-1379b · PUT system /:id/tags · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(22));
test('SCRUM-1379b · GET system /:id · SUELO: `-1` y `0` LLEGAN a la base y no son un 400', casoa(23));
test('SCRUM-1379b · GET system /:id · 🔴 un id que no cabe en la columna → 400, sin tocar la base', casob(23));
casoa.todos();
casob.todos();
