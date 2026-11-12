// tests/scrum1588-alquiler-en-las-categorias.test.mjs — SCRUM-1588 (mitad de servidor, S1)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA RUTA DE GASTOS RECHAZABA `alquiler`
//
// El fundador decidió añadir la categoría de alquiler (SCRUM-1066 c.20479) y J1 ya enseñó al
// borrador del modelo 115 a leerla (SCRUM-1066e). Pero `EXPENSE_CATEGORIES` seguía con cinco, así
// que `POST /admin/expenses` con `category: 'alquiler'` daba 400 `category_invalid` y el 115 salía a
// cero en la práctica. Sin ALTER: `Expense.category` es `String` libre (SCRUM-1066 c.20485).
//
// ── ACEPTACIÓN QUE CUBRE ESTE FICHERO ───────────────────────────────────────────────────────
//  1. `GET /admin/expenses/categories` incluye `alquiler`.
//  2. Crear un gasto con `category: 'alquiler'` da 2xx, no `category_invalid`.
//  (La 3, el rótulo «Alquiler de local» y su píldora, es de S2: `scrum-1588b-…`.)
//
// ── EL BANCO ─────────────────────────────────────────────────────────────────────────────────
// El mismo que `scrum943`: las RUTAS y el SERVICIO de verdad (`dist/`), con la base doblada por
// `_envio-doblado.mjs`, llamando al ÚLTIMO manejador de cada ruta. Sin base y sin red.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RUTAS = '../dist/modules/expenses/app/routes/expenses.routes.js';
const SERVICIO = '../dist/modules/expenses/domain/expenses.service.js';
const GASTO_ID = 15880;

function banco() {
  const estado = { creaciones: [], ediciones: [] };
  inyectarBase({
    'quote.findFirst': () => null,
    'provider.findFirst': () => null,
    'expense.create': ({ data }) => { estado.creaciones.push(data); return { id: GASTO_ID, vatDeducible: null, ...data }; },
    'expense.findFirst': ({ where }) => (where.id === GASTO_ID
      ? { id: GASTO_ID, merchantId: MERCHANT, providerId: null, quoteId: null, category: 'otros' }
      : null),
    'expense.update': ({ data }) => {
      estado.ediciones.push(data);
      return { id: GASTO_ID, merchantId: MERCHANT, providerId: null, ...data };
    },
  }, [SERVICIO, RUTAS]);

  const router = moduloDeDist(RUTAS).default;
  const manejador = (metodo, ruta) => {
    const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[metodo]);
    assert.ok(capa, `🔴 CIEGO: no encuentro ${metodo.toUpperCase()} ${ruta} en el router de gastos`);
    const pila = capa.route.stack;
    return pila[pila.length - 1].handle;
  };
  const llamar = (metodo, ruta) => async ({ body, params = {}, query = {} } = {}) => {
    const r = { status: 200, data: undefined };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.data = JSON.parse(JSON.stringify(j)); return res; } };
    await manejador(metodo, ruta)(reqDeSesion({ rol: 'admin', merchantId: MERCHANT, body, params, query, teamMemberId: null }), res);
    return r;
  };
  return {
    estado,
    categorias: () => llamar('get', '/categories')({}),
    alta: (body) => llamar('post', '/')({ body }),
    edicion: (body) => llamar('put', '/:id')({ body, params: { id: String(GASTO_ID) } }),
  };
}

const BASE = { concept: 'Alquiler del local, octubre', amount: 600 };

test('SCRUM-1588 · SUELO: la ruta de categorías responde y trae las de siempre', async () => {
  const r = await banco().categorias();
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.data?.categories) && r.data.categories.includes('materiales'),
    `🔴 SUELO: la ruta no devuelve la lista conocida (${JSON.stringify(r.data)}); un «no está alquiler» sería ciego.`);
});

test('SCRUM-1588 · aceptación 1: GET /admin/expenses/categories incluye `alquiler`', async () => {
  const r = await banco().categorias();
  assert.ok(r.data.categories.includes('alquiler'),
    `🔴 la ruta de categorías no ofrece «alquiler»: ${JSON.stringify(r.data.categories)}`);
});

test('SCRUM-1588 · aceptación 2: crear un gasto con `category: \'alquiler\'` da 2xx y lo escribe tal cual', async () => {
  const b = banco();
  const r = await b.alta({ ...BASE, category: 'alquiler' });
  assert.ok(r.status >= 200 && r.status < 300,
    `🔴 el alta con «alquiler» respondió ${r.status}: ${JSON.stringify(r.data)}`);
  assert.notEqual(r.data?.error, 'category_invalid');
  assert.equal(b.estado.creaciones.length, 1, '🔴 SUELO: el banco no ve la escritura');
  assert.equal(b.estado.creaciones[0].category, 'alquiler');
});

test('SCRUM-1588 · la edición a `alquiler` también entra (misma validación en el dominio)', async () => {
  const b = banco();
  const r = await b.edicion({ category: 'alquiler' });
  assert.equal(r.status, 200, `🔴 la edición a «alquiler» respondió ${r.status}: ${JSON.stringify(r.data)}`);
  assert.equal(b.estado.ediciones[0].category, 'alquiler');
});

test('SCRUM-1588 · NEGATIVO: sólo entra la clave exacta, sin traducir ni normalizar', async () => {
  for (const ajena of ['Alquiler', 'ALQUILER', ' alquiler', 'alquiler de local', 'rent']) {
    const b = banco();
    const r = await b.alta({ ...BASE, category: ajena });
    assert.equal(r.status, 400, `🔴 «${ajena}» respondió ${r.status} y se coló`);
    assert.equal(r.data.error, 'category_invalid');
    assert.equal(b.estado.creaciones.length, 0);
  }
});
