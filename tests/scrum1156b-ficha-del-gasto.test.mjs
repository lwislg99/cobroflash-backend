// tests/scrum1156b-ficha-del-gasto.test.mjs — SCRUM-1156b
//
// `GET /admin/expenses/:id` · LA FICHA DE LECTURA DE UN GASTO, mitad de servidor.
//
// Existe para que la ficha viva en el hash (`DETALLES` de `app.js`, SCRUM-832): sin una ruta que la
// devuelva sola, abrirla hacía `replaceState` y borraba la lista del historial. La pantalla es de
// S2 (SCRUM-1156); aquí sólo el servidor.
//
// Lo que se fija, por el camino REAL (ruta + servicio de `dist/`, base doblada):
//   · la ficha es LA MISMA FILA que la lista: mismo `select`, `tieneFoto` y `job`, sin la foto;
//   · regla 2: el gasto de otro negocio da 404, el mismo que un id que no existe, y el `where` que
//     llega a la base lleva el `merchantId`;
//   · un id que no cabe en la columna da 400 sin tocar la base (SCRUM-1379);
//   · el mismo permiso que la lista (`admin`), y la ruta va DETRÁS de `/summary`, `/categories` y
//     `/margin/:quoteId`: delante, `/:id` se los comería.
//
// El doble hace lo que hace una base —aplica el `where` y el `select` que se le piden—, como el de
// `scrum964`: un doble que devolviera la fila entera daría verde aunque la ficha trajera la foto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RUTAS = '../dist/modules/expenses/app/routes/expenses.routes.js';
const SERVICIO = '../dist/modules/expenses/domain/expenses.service.js';
const OTRO_NEGOCIO = MERCHANT + 1;

/** Una fila COMPLETA de `Expense`, foto incluida, como la devolvería la base. */
function fila(id, { merchantId = MERCHANT, foto = null } = {}) {
  return {
    id, merchantId, quoteId: null, providerId: null,
    concept: `Gasto ${id}`, amount: '12.10', currency: 'EUR', category: 'materiales',
    date: new Date('2026-10-10T08:00:00Z'), notes: null, receiptData: foto,
    baseAmount: '10.00', vatRate: '21', vatAmount: '2.10', vatDeducible: true,
    providerInvoiceNumber: null, providerInvoiceDate: null,
    retencionPracticadaTipo: null, retencionPracticadaCuota: null, retencionPracticadaDeclarada: null,
    teamMemberId: null,
    createdAt: new Date('2026-10-10T08:00:00Z'), updatedAt: new Date('2026-10-10T08:00:00Z'),
    quote: null, provider: null,
  };
}
const FOTO = 'data:image/jpeg;base64,' + 'A'.repeat(4096);
const FILAS = [fila(1, { foto: FOTO }), fila(2), fila(3, { merchantId: OTRO_NEGOCIO, foto: FOTO })];

/** Lo que hace una base: filtrar por el `where` y devolver EXACTAMENTE las claves del `select`. */
function casa(f, where = {}) {
  if (where.merchantId !== undefined && f.merchantId !== where.merchantId) return false;
  if (typeof where.id === 'number' && f.id !== where.id) return false;
  if (where.id?.in && !where.id.in.includes(f.id)) return false;
  if (where.receiptData?.not === null && f.receiptData == null) return false;
  return true;
}
function aplicarSelect(f, select) {
  if (!select) return { ...f };
  const salida = {};
  for (const [clave, valor] of Object.entries(select)) if (valor) salida[clave] = f[clave] ?? null;
  return salida;
}

function banco() {
  const llamadas = [];
  inyectarBase({
    'expense.findMany': (a) => FILAS.filter((f) => casa(f, a?.where)).map((f) => aplicarSelect(f, a?.select)),
    'expense.findFirst': (a) => {
      llamadas.push(a);
      const f = FILAS.find((x) => casa(x, a?.where));
      return f ? aplicarSelect(f, a?.select) : null;
    },
  }, [SERVICIO, RUTAS]);
  const router = moduloDeDist(RUTAS).default;
  const capaDe = (camino) => router.stack.find((l) => l.route && l.route.path === camino && l.route.methods.get);
  const pedir = async (camino, req) => {
    const capa = capaDe(camino);
    assert.ok(capa, `CIEGO: no encuentro GET ${camino} en el router de gastos.`);
    const h = capa.route.stack[capa.route.stack.length - 1].handle;
    const r = { estado: 200, cuerpo: null };
    const res = { status(c) { r.estado = c; return res; }, json(j) { r.cuerpo = j; return res; } };
    const error = console.error;
    console.error = () => {};
    try { await h(reqDeSesion({ rol: 'admin', merchantId: MERCHANT, query: {}, params: {}, ...req }), res); } finally { console.error = error; }
    return r;
  };
  return { router, capaDe, pedir, llamadas };
}

test('SCRUM-1156b · SUELO: la ruta existe y va DETRÁS de las GET con nombre fijo', () => {
  const { router } = banco();
  const pos = (camino) => router.stack.findIndex((l) => l.route && l.route.path === camino && l.route.methods.get);
  const ficha = pos('/:id');
  assert.ok(ficha >= 0, '🔴 no existe GET /admin/expenses/:id: la ficha no se puede pedir sola.');
  for (const fija of ['/summary', '/categories', '/margin/:quoteId']) {
    assert.ok(pos(fija) >= 0, `CIEGO: no encuentro GET ${fija}`);
    assert.ok(pos(fija) < ficha, `🔴 GET /:id va delante de GET ${fija}: se lo come y ${fija} deja de contestar.`);
  }
});

test('SCRUM-1156b · 🔴 la ficha es LA MISMA fila que la lista, sin la foto y con `tieneFoto`', async () => {
  const { pedir } = banco();
  const lista = await pedir('/', {});
  const enLaLista = lista.cuerpo.items.find((i) => i.id === 1);
  assert.ok(enLaLista, 'CIEGO: la lista no devuelve el gasto 1; no hay con qué comparar.');
  const ficha = await pedir('/:id', { params: { id: '1' } });
  assert.equal(ficha.estado, 200);
  assert.equal(ficha.cuerpo.ok, true);
  assert.deepEqual(ficha.cuerpo.item, enLaLista,
    '🔴 la ficha y la lista devuelven filas DISTINTAS del mismo gasto: la ficha enseñaría otra cosa que la tabla.');
  assert.equal('receiptData' in ficha.cuerpo.item, false, '🔴 la ficha trae la foto dentro: debe seguir saliendo por /:id/foto.');
  assert.equal(ficha.cuerpo.item.tieneFoto, true);
  const sinFoto = await pedir('/:id', { params: { id: '2' } });
  assert.equal(sinFoto.cuerpo.item.tieneFoto, false);
});

test('SCRUM-1156b · 🔴 regla 2: el gasto de OTRO negocio da 404, igual que uno que no existe', async () => {
  const { pedir, llamadas } = banco();
  const ajeno = await pedir('/:id', { params: { id: '3' } });
  const inexistente = await pedir('/:id', { params: { id: '999' } });
  assert.equal(ajeno.estado, 404, `🔴 el gasto de otro negocio contesta ${ajeno.estado}: se ve un gasto ajeno.`);
  assert.deepEqual(ajeno.cuerpo, inexistente.cuerpo, '🔴 «no es tuyo» y «no existe» contestan distinto: la ruta es un oráculo de ids ajenos.');
  assert.deepEqual(inexistente.cuerpo, { ok: false, error: 'not_found' });
  for (const a of llamadas) assert.equal(a.where.merchantId, MERCHANT, '🔴 la consulta de la ficha no filtra por merchantId.');
});

test('SCRUM-1156b · un id que no cabe en la columna da 400 sin tocar la base', async () => {
  const { pedir, llamadas } = banco();
  const r = await pedir('/:id', { params: { id: '99999999999' } });
  assert.equal(r.estado, 400);
  assert.deepEqual(r.cuerpo, { ok: false, error: 'invalid_id' });
  assert.equal(llamadas.length, 0, '🔴 un id fuera de rango ha llegado a la base.');
});

test('SCRUM-1156b · el MISMO permiso que la lista: sólo admin', async () => {
  const { capaDe } = banco();
  const permiso = (camino) => capaDe(camino).route.stack.map((s) => s.handle.__requiredRole).filter(Boolean);
  assert.deepEqual(permiso('/:id'), permiso('/'), '🔴 la ficha tiene un permiso distinto del de la lista de la que sale.');
  assert.deepEqual(permiso('/:id'), ['admin']);
});
