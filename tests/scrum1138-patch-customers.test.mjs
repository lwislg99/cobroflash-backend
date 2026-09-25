// tests/scrum1138-patch-customers.test.mjs — SCRUM-1138 (caso B de SCRUM-1031)
//
// `jobDetailView.js` manda el NIF del cliente con `apiRequest(`/admin/customers/${clienteA1.id}`,
// { method: 'PATCH', body: JSON.stringify({ taxId: nif }) })` justo antes de emitir (la pregunta
// «Escribe el NIF del cliente…»). `customersAdmin.routes.ts` solo tenía `router.put('/:id', …)`:
// Express no tiene ninguna capa que responda a PATCH, así que la petición caía en un 404 silencioso
// y el NIF NUNCA se guardaba — el profesional lo veía escrito en pantalla y creía que estaba guardado.
//
// Mismo patrón de la casa que `scrum1057-duplicados-antes-de-id.test.mjs`: se despacha una
// petición de mentira A TRAVÉS del router real (`router.handle`), para que sea EXPRESS quien
// decida qué capa responde — no se invoca el handler a mano, que probaría el handler pero no el
// enrutado, que es justo donde estaba el defecto. `prisma.customer` se sustituye MUTANDO el
// objeto ya importado (mismo patrón): no hace falta Postgres para demostrar el enrutado.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIST = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')).href + '/';

function despachar(router, method, url, extra = {}) {
  return new Promise((resolve) => {
    let salida = null;
    const req = { method, url, headers: {}, query: {}, params: {}, merchantId: 7, body: {}, ...extra };
    const res = {
      status(c) { this._c = c; return this; },
      json(b) { salida = { code: this._c ?? 200, body: b }; resolve(salida); return this; },
      send(b) { salida = { code: this._c ?? 200, body: b }; resolve(salida); return this; },
    };
    router.handle(req, res, (err) => resolve({ notMatched: true, err: err && err.message }));
  });
}

test('SCRUM-1138 · 🔴 PATCH /admin/customers/:id — el mismo caso que manda jobDetailView.js (el NIF antes de emitir)', async () => {
  const mod = await import(DIST + 'modules/system/app/routes/customersAdmin.routes.js');
  const router = mod.default?.default ?? mod.default;
  const moduloPrisma = await import(DIST + 'core/db/prisma.js');
  const original = moduloPrisma.prisma.customer;

  let updateManyLlamado = null;
  moduloPrisma.prisma.customer = {
    findFirst: async ({ where }) => ({ id: where.id, merchantId: where.merchantId, name: 'Cliente de prueba', taxId: '12345678Z' }),
    updateMany: async ({ where, data }) => { updateManyLlamado = { where, data }; return { count: 1 }; },
  };
  try {
    const r = await despachar(router, 'PATCH', '/3927', { params: { id: '3927' }, body: { taxId: '12345678Z' } });

    assert.ok(!r.notMatched,
      '🔴 ninguna capa del router respondió a PATCH /3927 — exactamente el 404 silencioso que pierde el NIF');
    assert.equal(r.code, 200, `🔴 PATCH /admin/customers/:id devuelve ${r.code} (${JSON.stringify(r.body)}), no 200`);
    assert.ok(updateManyLlamado, '🔴 el handler respondió pero nunca llegó a `updateCustomer` (`prisma.customer.updateMany`)');
    assert.equal(updateManyLlamado.data.taxId, '12345678Z', 'el NIF mandado por el navegador tiene que llegar tal cual a la escritura');
    assert.equal(updateManyLlamado.where.merchantId, 7, '🔴 multi-tenant: el WHERE tiene que llevar el merchantId de la sesión');
  } finally {
    moduloPrisma.prisma.customer = original;
  }
});

test('SCRUM-1138 · CONTROL: PUT /admin/customers/:id sigue funcionando igual (no se ha roto lo que ya había)', async () => {
  const mod = await import(DIST + 'modules/system/app/routes/customersAdmin.routes.js');
  const router = mod.default?.default ?? mod.default;
  const moduloPrisma = await import(DIST + 'core/db/prisma.js');
  const original = moduloPrisma.prisma.customer;

  let updateManyLlamado = null;
  moduloPrisma.prisma.customer = {
    findFirst: async ({ where }) => ({ id: where.id, merchantId: where.merchantId, name: 'Cliente de prueba' }),
    updateMany: async ({ where, data }) => { updateManyLlamado = { where, data }; return { count: 1 }; },
  };
  try {
    const r = await despachar(router, 'PUT', '/3927', { params: { id: '3927' }, body: { taxId: '12345678Z' } });
    assert.ok(!r.notMatched, '🔴 PUT dejó de estar enrutado: el arreglo de PATCH rompió lo que ya había');
    assert.equal(r.code, 200);
    assert.ok(updateManyLlamado, 'PUT sigue llegando a `updateCustomer`');
  } finally {
    moduloPrisma.prisma.customer = original;
  }
});

test('SCRUM-1138 · un id inválido en PATCH responde 400, igual que ya hace PUT (mismo handler, mismo contrato)', async () => {
  const mod = await import(DIST + 'modules/system/app/routes/customersAdmin.routes.js');
  const router = mod.default?.default ?? mod.default;
  const r = await despachar(router, 'PATCH', '/no-es-un-id', { params: { id: 'no-es-un-id' }, body: {} });
  assert.ok(!r.notMatched);
  assert.equal(r.code, 400);
  assert.deepEqual(r.body, { error: 'invalid_id' });
});
