// tests/scrum1057-duplicados-antes-de-id.test.mjs — SCRUM-1031 (caso A), arreglado dentro de SCRUM-1057
//
// `GET /admin/customers/duplicados` — SCRUM-1057 lo necesita para poder avisar de duplicados
// antes de fusionar, y S0 midió en staging (22-sep-2026) que estaba ROTO: el comentario del
// código AFIRMABA que `/duplicados` se registraba antes que `/:id`, pero el registro real era al
// revés. Express empareja por ORDEN DE REGISTRO, no por especificidad, así que `/:id` capturaba
// `duplicados` como un id (`Number('duplicados')` → `NaN` → `400 invalid_id`) y la ruta de
// duplicados nunca llegaba a ejecutarse.
//
// 🔴 EL PORQUÉ DE INVOCAR `router.handle`, NO EL LAYER DIRECTO: el patrón de la casa
// (`scrum263-sin-lineas-409.test.mjs`) busca la capa POR RUTA (`l.route.path === '/duplicados'`)
// e invoca su handler directo — eso prueba que el HANDLER hace lo correcto, pero no puede ver
// CUÁL capa gana el enrutado real para una URL entrante. Ese es justo el bug: hay que dejar que
// Express decida, como lo haría con una petición HTTP de verdad.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIST = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')).href + '/';

/** Despacha una petición de mentira a través del router REAL, dejando que Express elija la capa. */
function despachar(router, method, url, extra = {}) {
  return new Promise((resolve) => {
    let salida = null;
    const req = { method, url, headers: {}, query: {}, params: {}, merchantId: 7, ...extra };
    const res = {
      status(c) { this._c = c; return this; },
      json(b) { salida = { code: this._c ?? 200, body: b }; resolve(salida); return this; },
      send(b) { salida = { code: this._c ?? 200, body: b }; resolve(salida); return this; },
    };
    router.handle(req, res, (err) => resolve({ notMatched: true, err: err && err.message }));
  });
}

test('SCRUM-1057/1031 · 🔴 GET /admin/customers/duplicados ya NO lo captura /:id', async () => {
  const mod = await import(DIST + 'modules/system/app/routes/customersAdmin.routes.js');
  const router = mod.default?.default ?? mod.default;

  // Sin ningún identificador en la query: la ruta responde `{coincidencias: []}` SIN tocar la
  // base (el propio handler corta antes del `findMany` si `or.length === 0`) — así el test no
  // necesita ni Postgres ni un doble de Prisma para demostrar CUÁL capa respondió.
  const r = await despachar(router, 'GET', '/duplicados');

  assert.ok(!r.notMatched, '🔴 ninguna capa del router respondió a /duplicados');
  assert.equal(r.code, 200,
    `🔴 /duplicados sigue devolviendo ${r.code} (${JSON.stringify(r.body)}) en vez de 200: ` +
    '/:id la está capturando otra vez. El aviso de duplicados de SCRUM-1057 depende de esta ruta.');
  assert.deepEqual(r.body, { coincidencias: [] },
    '🔴 la respuesta no es la de /duplicados — la capturó otra ruta con otra forma de contestar.');
});

test('SCRUM-1057/1031 · CONTROL: un id de verdad SIGUE yendo a /:id, no se ha roto lo otro', async () => {
  // Control negativo: el arreglo no puede convertir /:id en inalcanzable. `prisma` se sustituye
  // MUTANDO las propiedades del objeto exportado (patrón de `scrum263-sin-lineas-409.test.mjs`):
  // la ruta ya hizo `const { prisma } = require(...)` al cargarse, y esa desestructuración apunta
  // al MISMO objeto, así que mutarlo llega al código ya importado sin tocar una base real.
  const mod = await import(DIST + 'modules/system/app/routes/customersAdmin.routes.js');
  const router = mod.default?.default ?? mod.default;
  const moduloPrisma = await import(DIST + 'core/db/prisma.js');
  const original = moduloPrisma.prisma.customer;
  moduloPrisma.prisma.customer = { findFirst: async ({ where }) => ({ id: where.id, merchantId: where.merchantId, name: 'Cliente 42' }) };
  try {
    const r = await despachar(router, 'GET', '/42');
    assert.ok(!r.notMatched, '🔴 ninguna capa respondió a /42: el arreglo del orden rompió /:id');
    assert.equal(r.code, 200, `🔴 /42 ya no llega a /:id (${JSON.stringify(r.body)}) — el arreglo del orden lo rompió`);
    assert.equal(r.body?.id, 42, '🔴 la capa que respondió no es la de /:id (params.id no llegó)');
  } finally {
    moduloPrisma.prisma.customer = original;
  }
});
