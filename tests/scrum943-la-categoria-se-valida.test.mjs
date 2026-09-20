// tests/scrum943-la-categoria-se-valida.test.mjs — SCRUM-943
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA API ACEPTABA CUALQUIER CATEGORÍA DE GASTO
//
// `POST` y `PUT /admin/expenses` hacían `String(category)` y lo escribían tal cual: «materials»,
// «travel» o «subcontractor» entraban con 201/200. La pantalla cae a «Otros» para lo que no conoce,
// así que las filas PARECEN correctas; el dato malo se cuela en la base y cuenta en los totales sin
// que nadie lo vea. Las válidas son las cinco de `EXPENSE_CATEGORIES`.
//
// NOTA HONESTA DE ORIGEN (para quien lea esto dentro de un mes): NO hubo incidente. Hoy hay 0
// merchants reales y las cuatro filas sucias de staging las sembró nuestra propia sesión. Se arregla
// porque el defecto es de la ruta —cualquier cliente de la API podía repetirlo—, no porque nadie
// lo sufriera.
//
// ── QUÉ SE MIDE ──────────────────────────────────────────────────────────────────────────────
//  · ROJO: una categoría que no es de las cinco → 400 `category_invalid` y NINGUNA escritura.
//  · POSITIVO: las cinco válidas siguen entrando igual, y «sin categoría» sigue siendo «otros».
//  · NEGATIVO: no se normaliza ni se traduce nada (ni «Materiales» ni «materials»), ni al escribir
//    ni al leer; y no se tocan las filas ya escritas (el saneo de datos es una decisión aparte).
//  · DOMINIO: el rechazo vive en `createExpense`/`updateExpense`, no sólo en la ruta: un tercer
//    llamador no se lo salta (misma razón que SCRUM-135).
//
// ── EL BANCO ─────────────────────────────────────────────────────────────────────────────────
// Las RUTAS de verdad (`dist/…/expenses.routes.js`) y el SERVICIO de verdad, con la base doblada por
// `_envio-doblado.mjs`; se llama al ÚLTIMO manejador de cada ruta, el del trabajo (`requireRole` no
// es de este ticket). Sin base y sin red.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';

const RUTAS = '../dist/modules/expenses/app/routes/expenses.routes.js';
const SERVICIO = '../dist/modules/expenses/domain/expenses.service.js';
const GASTO_ID = 9430;
const VALIDAS = ['materiales', 'desplazamiento', 'herramientas', 'subcontrata', 'otros'];
const AJENAS = ['materials', 'travel', 'subcontractor', 'Materiales', 'MATERIALES', ' materiales', 'gasolina', 'null'];

/** La base doblada. Anota cada escritura TAL CUAL llega, y sirve `lista` a `expense.findMany`. */
function banco({ lista = [] } = {}) {
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
    'expense.findMany': () => lista,
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
    await manejador(metodo, ruta)({ body, params, query, merchantId: MERCHANT, userRole: 'admin', teamMemberId: null }, res);
    return r;
  };
  return {
    estado,
    alta: (body) => llamar('post', '/')({ body }),
    edicion: (body) => llamar('put', '/:id')({ body, params: { id: String(GASTO_ID) } }),
    lectura: () => llamar('get', '/')({ query: {} }),
  };
}

const BASE = { concept: 'Tubo de cobre', amount: 12.5 };

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SUELO — el banco ve lo que tiene que ver
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-943 · 🔴 SUELO: un alta con categoría válida responde 201 y el banco VE la escritura', async () => {
  const b = banco();
  const r = await b.alta({ ...BASE, category: 'materiales' });
  assert.equal(r.status, 201, `🔴 SUELO: el alta respondió ${r.status}: ${JSON.stringify(r.data)}`);
  assert.equal(b.estado.creaciones.length, 1,
    '🔴 SUELO: el banco no ve ninguna escritura; todo lo de abajo («0 escrituras») sería un verde vacío.');
  assert.equal(b.estado.creaciones[0].category, 'materiales');
});

test('SCRUM-943 · 🔴 SUELO: una edición con categoría válida responde 200 y el banco VE la escritura', async () => {
  const b = banco();
  const r = await b.edicion({ category: 'herramientas' });
  assert.equal(r.status, 200, `🔴 SUELO: la edición respondió ${r.status}: ${JSON.stringify(r.data)}`);
  assert.equal(b.estado.ediciones.length, 1, '🔴 SUELO: el banco no ve ninguna escritura en la edición.');
  assert.equal(b.estado.ediciones[0].category, 'herramientas');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// POSITIVO — lo que ya funcionaba sigue igual
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-943 · POSITIVO: las cinco categorías válidas entran igual, en el alta y en la edición', async () => {
  for (const categoria of VALIDAS) {
    const a = banco();
    const alta = await a.alta({ ...BASE, category: categoria });
    assert.equal(alta.status, 201, `el alta con «${categoria}» debe seguir entrando`);
    assert.equal(a.estado.creaciones[0].category, categoria);

    const e = banco();
    const edicion = await e.edicion({ category: categoria });
    assert.equal(edicion.status, 200, `la edición con «${categoria}» debe seguir entrando`);
    assert.equal(e.estado.ediciones[0].category, categoria);
  }
});

test('SCRUM-943 · POSITIVO: un gasto SIN categoría sigue siendo «otros» (ausente, vacía o null)', async () => {
  for (const cuerpo of [BASE, { ...BASE, category: '' }, { ...BASE, category: null }]) {
    const b = banco();
    const r = await b.alta(cuerpo);
    assert.equal(r.status, 201, `sin categoría (${JSON.stringify(cuerpo.category)}) debe seguir entrando`);
    assert.equal(b.estado.creaciones[0].category, 'otros');
  }
});

test('SCRUM-943 · POSITIVO: una edición que NO manda categoría no la toca y sigue entrando', async () => {
  const b = banco();
  const r = await b.edicion({ concept: 'Solo cambio el concepto' });
  assert.equal(r.status, 200);
  assert.equal(b.estado.ediciones.length, 1);
  assert.ok(!('category' in b.estado.ediciones[0]), 'la edición no debía escribir `category` si no se mandó');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL ROJO — lo que hoy se cuela
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-943 · 🔴 EL DEFECTO: el alta con una categoría que no es de las cinco → 400 y NADA escrito', async () => {
  for (const categoria of AJENAS) {
    const b = banco();
    const r = await b.alta({ ...BASE, category: categoria });
    assert.equal(r.status, 400, `🔴 el alta con «${categoria}» respondió ${r.status} y la guardó tal cual`);
    assert.equal(r.data.error, 'category_invalid');
    assert.deepEqual(r.data.categories, VALIDAS, 'la respuesta dice cuáles son las válidas, sin texto nuevo para el usuario');
    assert.ok(!('message' in r.data), 'sin `message`: un texto nuevo para el usuario tendría que estar firmado');
    assert.equal(b.estado.creaciones.length, 0, `🔴 «${categoria}» se escribió en la base`);
  }
});

test('SCRUM-943 · 🔴 EL DEFECTO: la edición con una categoría que no es de las cinco → 400 y NADA escrito', async () => {
  for (const categoria of [...AJENAS, '']) {
    const b = banco();
    const r = await b.edicion({ category: categoria });
    assert.equal(r.status, 400, `🔴 la edición con «${categoria}» respondió ${r.status} y la guardó tal cual`);
    assert.equal(r.data.error, 'category_invalid');
    assert.equal(b.estado.ediciones.length, 0, `🔴 «${categoria}» se escribió en la base`);
  }
});

test('SCRUM-943 · el rechazo vive en el DOMINIO: un llamador que no pasa por la ruta tampoco lo salta', async () => {
  const b = banco();
  const { createExpense, updateExpense, ExpenseCategoryError } = moduloDeDist(SERVICIO);
  await assert.rejects(() => createExpense(MERCHANT, { ...BASE, category: 'materials' }), ExpenseCategoryError);
  await assert.rejects(() => updateExpense(MERCHANT, GASTO_ID, { category: 'travel' }), ExpenseCategoryError);
  assert.equal(b.estado.creaciones.length + b.estado.ediciones.length, 0, 'ninguna escritura llegó a la base');
  // Control positivo: el mismo camino, con una válida, SÍ escribe (si esto fallara, lo de arriba no probaría nada).
  await createExpense(MERCHANT, { ...BASE, category: 'otros' });
  assert.equal(b.estado.creaciones.length, 1);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// NEGATIVO — lo que NO se hace
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-943 · NEGATIVO: no se normaliza ni se traduce nada, ni al escribir ni al leer', async () => {
  // Escribir: «Materiales» no se convierte en «materiales» (el 400 de arriba lo cubre: no se guardó nada).
  // Leer: una fila YA sucia sale como está. Taparla en la lectura escondería el defecto en vez de
  // arreglarlo, y el saneo de las filas ya escritas es una decisión aparte.
  const sucia = { id: 1, merchantId: MERCHANT, quoteId: null, providerId: null, concept: 'x', amount: 1, category: 'materials', date: new Date(), quote: null, provider: null };
  const b = banco({ lista: [sucia] });
  const r = await b.lectura();
  assert.equal(r.status, 200);
  assert.equal(r.data.items.length, 1, '🔴 SUELO: la lectura no devolvió la fila sembrada');
  assert.equal(r.data.items[0].category, 'materials', 'la lectura no debe traducir la categoría');
});
