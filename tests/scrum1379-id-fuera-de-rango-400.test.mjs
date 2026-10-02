// tests/scrum1379-id-fuera-de-rango-400.test.mjs — SCRUM-1379
//
// 🔴 UN ID QUE NO CABE EN LA COLUMNA ES UN 400, NO UN 500.
//
// Medido en producción el 1-oct-2026 (S4, cuenta QA, sólo GET): `GET /admin/partes/99999999999999999999`
// → 500 `internal_error`. `Number(…)` da `1e20`, `Number.isInteger(1e20)` es `true`, y la consulta
// revienta porque el valor no cabe en un `Int`.
//
// EL CASO QUE DISTINGUE EL CRITERIO: `10000000000`. Es un entero «seguro» para JavaScript
// (`Number.isSafeInteger`) y NO cabe en la columna. Con `isSafeInteger` este fichero sale rojo.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// La RUTA de verdad (`dist/…/partes.routes.js`) con la base doblada por `_envio-doblado.mjs`, como
// SCRUM-1226. ⚠️ El doble MODELA la base en una cosa, y se dice: lanza si le llega un `id` fuera del
// rango de un int4, que es lo que hace Postgres/Prisma. No es la base: es la razón por la que el
// control de abajo («sin el arreglo sale 500») tiene que verse antes de creerse el 400.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { cabeEnColumnaInt, INT_COLUMNA_MAX, INT_COLUMNA_MIN } from '../dist/core/validation/enteroDeColumna.js';

const RUTAS = '../dist/modules/jobs/app/routes/partes.routes.js';
const PARTE_ID = 1379;

const PARTE = {
  id: PARTE_ID, merchantId: MERCHANT, jobId: null, customerId: null,
  numero: 'PT-2026-1379', fecha: '2026-10-01T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: null,
  entrada: '09:00', salida: '11:00', desplazamientos: null, kilometros: null, tecnicos: [],
  tipo: 'reparacion_asistencia', lineas: [], notas: null, estado: 'borrador',
  firmadoAt: null, firmadoPorNombre: null, firmadoPorCalidad: null, signatureUrl: null,
  firmadoTecnicoAt: null, firmadoTecnicoNombre: null, signatureTecnicoUrl: null,
  contenidoHash: null, contenidoVersion: null,
};

function banco() {
  const consultas = [];
  inyectarBase({
    'parteTrabajo.findFirst': ({ where }) => {
      consultas.push(where.id);
      // Lo que hace la base de verdad con un valor que no cabe en la columna.
      if (!(Number.isInteger(where.id) && where.id >= -2147483648 && where.id <= 2147483647)) {
        throw new Error(`Unable to fit value ${where.id} into a 32-bit signed integer`);
      }
      return where.id === PARTE_ID && where.merchantId === MERCHANT ? { ...PARTE } : null;
    },
  }, [RUTAS]);
  const router = moduloDeDist(RUTAS).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id' && l.route.methods.get);
  assert.ok(capa, '🔴 CIEGO: no encuentro GET /:id en el router de partes');
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const pedir = async (id) => {
    const r = { status: 200, data: undefined };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.data = j; return res; } };
    const callar = console.error; console.error = () => {};
    try { await h({ params: { id }, merchantId: MERCHANT, userRole: 'admin', teamMemberId: null }, res); }
    finally { console.error = callar; }
    return r;
  };
  return { pedir, consultas };
}

test('SCRUM-1379 · SUELO: el banco responde 200 a un parte que existe, y su base REVIENTA con un id que no cabe', async () => {
  const b = banco();
  const r = await b.pedir(String(PARTE_ID));
  assert.equal(r.status, 200, `🔴 CIEGO: el GET de un parte que existe no da 200 (${r.status})`);
  assert.deepEqual(b.consultas, [PARTE_ID], '🔴 CIEGO: la ruta no ha consultado la base');
});

test('SCRUM-1379 · 🔴 un id enorme (el medido en producción) → 400, y NO llega a la base', async () => {
  const b = banco();
  const r = await b.pedir('99999999999999999999');
  assert.equal(r.status, 400, `🔴 responde ${r.status}: el id no cabe en la columna y la ruta lo ha dejado pasar`);
  assert.equal(r.data.error, 'invalid_id', 'el 400 es el que ya existía, sin texto nuevo');
  assert.deepEqual(b.consultas, [], '🔴 la consulta se lanzó con un id que no cabe');
});

test('SCRUM-1379 · 🔴 10.000.000.000 —«seguro» para JavaScript, fuera de un `Int`— → 400', async () => {
  assert.equal(Number.isSafeInteger(10000000000), true, 'SUELO: este es el caso que `isSafeInteger` deja pasar');
  const b = banco();
  const r = await b.pedir('10000000000');
  assert.equal(r.status, 400, `🔴 responde ${r.status}: el criterio es el rango de la columna, no \`isSafeInteger\``);
  assert.deepEqual(b.consultas, []);
});

test('SCRUM-1379 · CONTROLES: lo que ya respondía bien sigue igual', async () => {
  const b = banco();
  assert.equal((await b.pedir('abc')).status, 400, '`abc` daba 400');
  assert.equal((await b.pedir('1.5')).status, 400, 'un decimal daba 400');
  assert.equal((await b.pedir('-1')).status, 404, '`-1` daba 404 (cabe en la columna: se consulta y no existe)');
  assert.equal((await b.pedir('0')).status, 404, '`0` daba 404');
  assert.equal((await b.pedir('2147483647')).status, 404, 'el mayor id posible se CONSULTA: no es un 400');
  assert.equal((await b.pedir('2147483648')).status, 400, 'el primero que no cabe');
  assert.deepEqual(b.consultas, [-1, 0, 2147483647]);
});

test('SCRUM-1379 · el helper: entero Y dentro del rango de la columna', () => {
  assert.equal(INT_COLUMNA_MAX, 2147483647);
  assert.equal(INT_COLUMNA_MIN, -2147483648);
  for (const n of [1, 0, -1, INT_COLUMNA_MAX, INT_COLUMNA_MIN]) assert.equal(cabeEnColumnaInt(n), true, `${n} cabe`);
  for (const n of [1e20, 10000000000, INT_COLUMNA_MAX + 1, INT_COLUMNA_MIN - 1, 1.5, NaN, Infinity, '7', null, undefined]) {
    assert.equal(cabeEnColumnaInt(n), false, `${String(n)} no es un entero de columna`);
  }
});
