// tests/scrum1188c-el-put-vacia-el-cobro.test.mjs — SCRUM-1188 (parte C, la línea del servidor)
//
// 🔴 `PUT /admin/templates/:id` NO PODÍA VACIAR EL COBRO DE UNA PLANTILLA.
//
// La ruta decidía con `req.body?.paymentTerms != null`, que junta DOS cuerpos distintos:
//
//   · `{ name: 'x' }`              la clave NO VIAJA   → «no me lo cambies»   (el renombrar de hoy)
//   · `{ paymentTerms: null }`     la clave viaja NULA → «déjala sin cobro»
//
// y a los dos les contestaba lo mismo: no tocar la columna. Sustituir una plantilla 50/50 desde un
// presupuesto en «Plan personalizado» (que guarda `null`: SCRUM-1188 parte A) habría dejado el 50/50
// viejo guardado bajo el aviso firmado «guardada sin el plan de cobro» (medido por S2, c.18609).
//
// JSON ya distingue los dos cuerpos, así que la ruta no necesita ningún centinela nuevo: la clave
// AUSENTE no toca la columna y la clave a `null` la vacía. Es lo que ya hace el `POST` con ese mismo
// `null` (`paymentTerms ?? null`).
//
// ── EL BANCO ────────────────────────────────────────────────────────────────────────────────
// El handler de `dist/` de verdad, con la base doblada por `_envio-doblado.mjs`. El doble NO tiene
// estado: lo que se mide es el `data` que la ruta le pasa a `quoteTemplate.update`, que es lo que
// decide qué columnas cambian. No mide la base, y por eso no afirma nada de `tiers` (ver abajo).
//
// ── LO QUE ESTE FICHERO NO CAMBIA, Y SE DICE ────────────────────────────────────────────────
// `tiers` es la otra columna anulable (`Json?`) y sigue con `!= null`: hoy no la manda nadie
// (`scripts/_sin-consumir-declarados.json`), y vaciar un `Json?` no se ha medido contra una base.
// El caso de abajo la FIJA como está para que cambiarla sea una decisión y no un descuido.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const GUARDADA = Object.freeze({
  id: 7,
  merchantId: MERCHANT,
  name: 'Reforma de baño',
  currency: 'EUR',
  lines: [{ concept: 'Alicatado', qty: 1, price: 100 }],
  tiers: null,
  paymentTerms: 'FIFTY_FIFTY',
});

const escrituras = [];
inyectarBase({
  'quoteTemplate.findFirst': () => ({ ...GUARDADA }),
  'quoteTemplate.update': (args) => { escrituras.push(args); return { ...GUARDADA, ...args.data }; },
});

const router = moduloDeDist('../dist/modules/templates/app/routes/templates.routes.js').default;

/** Hace el `PUT` con ese cuerpo, tal como llega de `express.json()`, y devuelve qué se escribió. */
async function put(cuerpo) {
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id' && l.route.methods.put);
  assert.ok(capa, '🔴 CIEGO: no encuentro PUT /:id en templates.routes');
  const handler = capa.route.stack[capa.route.stack.length - 1].handle;
  escrituras.length = 0;
  const r = { status: 200, data: undefined };
  const res = {
    status(s) { r.status = s; return res; },
    json(j) { r.data = j; return res; },
  };
  // Lo que viaja por el cable: un `undefined` no sobrevive a JSON, un `null` sí.
  const body = JSON.parse(JSON.stringify(cuerpo));
  const callar = console.error; console.error = () => {};
  try {
    await handler(reqDeSesion({ rol: 'admin', merchantId: MERCHANT, params: { id: '7' }, body }), res);
  } finally { console.error = callar; }
  assert.equal(r.status, 200, `🔴 CIEGO: el PUT responde ${r.status}, no llega a escribir`);
  assert.equal(escrituras.length, 1, `🔴 CIEGO: se esperaba UNA escritura y hubo ${escrituras.length}`);
  assert.deepEqual(escrituras[0].where, { id: 7 });
  return escrituras[0].data;
}

test('SCRUM-1188c · SUELO: un cobro con valor se escribe (el banco VE lo que la ruta manda a la base)', async () => {
  const data = await put({ paymentTerms: 'FULL_UPFRONT' });
  assert.deepEqual(data, { paymentTerms: 'FULL_UPFRONT' });
});

test('SCRUM-1188c · 🔴 `paymentTerms: null` VACÍA el cobro: la clave viaja a la base, y viaja nula', async () => {
  const lines = [{ concept: 'Alicatado', qty: 1, price: 120 }];
  const data = await put({ lines, currency: 'EUR', paymentTerms: null });
  assert.ok(Object.hasOwn(data, 'paymentTerms'),
    '🔴 la ruta ha IGNORADO `paymentTerms: null`: la plantilla se queda con el cobro viejo (50/50) '
    + 'mientras el panel dice «guardada sin el plan de cobro».');
  assert.equal(data.paymentTerms, null);
  assert.deepEqual(data, { lines, currency: 'EUR', paymentTerms: null });
});

test('SCRUM-1188c · renombrar (`{ name }`, el único cuerpo que el panel manda hoy) NO toca el cobro', async () => {
  const data = await put({ name: '  Baño completo  ' });
  assert.deepEqual(data, { name: 'Baño completo' });
  assert.equal(Object.hasOwn(data, 'paymentTerms'), false,
    '🔴 un cuerpo SIN la clave ha escrito el cobro: renombrar una plantilla le borraría la condición.');
});

test('SCRUM-1188c · un `undefined` en el cuerpo no sobrevive al cable: es «no viaja», y no toca el cobro', async () => {
  const data = await put({ name: 'Baño', paymentTerms: undefined });
  assert.deepEqual(data, { name: 'Baño' });
});

test('SCRUM-1188c · `null` en las columnas que NO admiten vacío (name, currency, lines) se sigue ignorando', async () => {
  const data = await put({ name: null, currency: null, lines: null, paymentTerms: 'MANUAL' });
  assert.deepEqual(data, { paymentTerms: 'MANUAL' },
    '🔴 un `null` ha llegado a una columna NOT NULL: eso es un 500 de la base, no un vaciado.');
});

test('SCRUM-1188c · `tiers: null` sigue como estaba (ignorado): esta entrega NO lo cambia, y se fija para que cambiarlo sea una decisión', async () => {
  const data = await put({ tiers: null, paymentTerms: null });
  assert.deepEqual(data, { paymentTerms: null });
});
