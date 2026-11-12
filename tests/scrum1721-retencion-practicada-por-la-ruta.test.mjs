// tests/scrum1721-retencion-practicada-por-la-ruta.test.mjs — SCRUM-1721 (mitad S1)
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA RETENCIÓN QUE EL PROFESIONAL PRACTICA LLEGA AL 111/115 POR LA RUTA REAL
//
// Medido por J1 (SCRUM-1066 c.21634) con `docs/master/evidencias/scrum1066/sonda-1066g-…mjs` y
// re-medido por S1 sobre main `9bf51c10e`: `POST /admin/expenses` con `retencionPracticadaTipo: 15`
// y su cuota guarda `null`/`null` (la ruta no los lee) y el borrador del 111 sale con la casilla 09
// a 0; el `PUT` que solo manda la retención contesta `400 empty_update`. El servicio sí los acepta.
//
// Piezas de S1 (SCRUM-1066 c.21634 §2, reparto en SCRUM-1721 c.21656):
//   ① el POST pasa los campos · ② el PUT también, con `undefined` ≠ `null` · ③ tipos 15/7/19 (la
//   lista congelada de J1) y cuota ≥ 0 · ⑦ `GET /admin/retenciones` montado en `src/app.ts` con
//   `requireRole('admin')` (c.21660).
//   ④ («No» = `retencionPracticadaDeclarada = false`) queda FUERA a propósito: `scrum1103:81` fija
//   que `declarada` no es parámetro de alta, y re-anclarlo es de su dueño (regla 41) → SCRUM-1721b.
//   Aquí se fija lo que sí vale hoy: la ruta NO escribe `declarada` (queda `null`).
//
// ── EL BANCO ────────────────────────────────────────────────────────────────────────────────────
// · Las RUTAS y el SERVICIO de verdad de `dist/`, con la base doblada por `_envio-doblado.mjs`
//   (el banco de `scrum937`). El doble guarda en memoria lo que `create`/`update` escriben y el
//   borrador de J1 (`leerBorradorRetenciones`, real) lee esas mismas filas.
// · Se llama al ÚLTIMO manejador de cada ruta: el permiso de PUT es `requireRole('admin')` desde
//   SCRUM-107 y no es de este ticket.
// · ⑦ se lee en el AST de `src/app.ts` (no por texto): la llamada `mountAdmin(app,
//   '/admin/retenciones', requireRole('admin'), <el router importado de 1066h>)`.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(path.join(RAIZ, 'package.json'));
const RUTAS = '../dist/modules/expenses/app/routes/expenses.routes.js';
const SERVICIO = '../dist/modules/expenses/domain/expenses.service.js';
const ENTRADA = '../dist/modules/expenses/domain/retencionPracticadaEntrada.js';
const repo = requiere('./dist/modules/fiscal/retenciones/retencionesPracticadas.repo.js');

/** Lo que este test tiene que tumbar (SCRUM-1387, `npm run meta:mutaciones`). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/expenses/app/routes/expenses.routes.ts',
    de: '...retencion.campos,\n    });', a: '});',
    cae: 'SCRUM-1721 · ① POST' },
  { fichero: 'src/modules/expenses/app/routes/expenses.routes.ts',
    de: 'Object.assign(patch, retencionPut.campos);', a: '',
    cae: 'SCRUM-1721 · ② PUT' },
  { fichero: 'src/modules/expenses/domain/retencionPracticadaEntrada.ts',
    de: 'if (!TIPOS_RETENCION_PRACTICADA_VALIDOS.includes(tipo))', a: 'if (!Number.isFinite(tipo))',
    cae: 'SCRUM-1721 · ③ validación' },
  { fichero: 'src/modules/expenses/domain/retencionPracticadaEntrada.ts',
    de: 'cuota < 0 ||', a: '',
    cae: 'SCRUM-1721 · ③ validación' },
  { fichero: 'src/modules/expenses/domain/retencionPracticadaEntrada.ts',
    de: 'campos.retencionPracticadaTipo = tipo;', a: 'campos.retencionPracticadaTipo = tipo + 1;',
    cae: 'SCRUM-1721 · ① POST' },
  { fichero: 'src/app.ts',
    de: "mountAdmin(app, '/admin/retenciones', requireRole('admin'), retencionesRouter);",
    a: "mountAdmin(app, '/admin/retenciones', retencionesRouter);",
    cae: 'SCRUM-1721 · ⑦ montaje' },
];

const PROV_SUB = 801;    // una subcontrata (111)
const PROV_LOCAL = 802;  // el arrendador del local (115)
const AÑO = 2026, TRIM = 4, FECHA = '2026-10-15';

const GASTO_111 = { concept: 'Subcontrata fontanería', amount: 1210, baseAmount: 1000, vatRate: 21, vatAmount: 210,
  providerId: PROV_SUB, providerInvoiceNumber: 'S-1', providerInvoiceDate: FECHA, date: FECHA, category: 'otros' };
const GASTO_115 = { concept: 'Alquiler nave octubre', amount: 726, baseAmount: 600, vatRate: 21, vatAmount: 126,
  providerId: PROV_LOCAL, providerInvoiceNumber: 'A-10', providerInvoiceDate: FECHA, date: FECHA, category: 'alquiler' };

function banco() {
  const filas = [];
  const escriturasUpdate = [];
  let siguiente = 1000;
  const enPeriodo = (where) => (f) => f.merchantId === where.merchantId
    && new Date(f.date) >= where.date.gte && new Date(f.date) <= where.date.lte;
  inyectarBase({
    'provider.findFirst': ({ where }) =>
      ([PROV_SUB, PROV_LOCAL].includes(where.id) && where.merchantId === MERCHANT
        ? { id: where.id, merchantId: MERCHANT, taxId: 'B00000000' } : null),
    'provider.updateMany': () => ({ count: 0 }),
    'quote.findFirst': () => null,
    'expense.create': ({ data }) => {
      const f = { id: siguiente++, vatDeducible: null, ...data };
      filas.push(f);
      return { ...f };
    },
    'expense.findFirst': ({ where }) => {
      const f = filas.find((x) => x.id === where.id && x.merchantId === where.merchantId);
      return f ? { ...f } : null;
    },
    'expense.update': ({ where, data }) => {
      escriturasUpdate.push({ ...data });
      const f = filas.find((x) => x.id === where.id);
      Object.assign(f, data);
      return { ...f };
    },
    'expense.findMany': ({ where }) => filas.filter(enPeriodo(where)).map((f) => ({ ...f })),
  }, [SERVICIO, RUTAS, ENTRADA]);
  const router = moduloDeDist(RUTAS).default;
  const llamar = async (metodo, ruta, { body, params = {} }) => {
    const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[metodo]);
    assert.ok(capa, `el banco no encuentra ${metodo} ${ruta}`);
    const pila = capa.route.stack;
    const r = { status: 200, data: undefined };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.data = JSON.parse(JSON.stringify(j)); return res; } };
    await pila[pila.length - 1].handle(reqDeSesion({ rol: 'admin', merchantId: MERCHANT, body, params, teamMemberId: null }), res);
    return r;
  };
  const db = { expense: { findMany: async (a) => filas.filter(enPeriodo(a.where)).map((f) => ({ ...f })) } };
  const borrador = () => repo.leerBorradorRetenciones(db, { merchantId: MERCHANT, año: AÑO, trimestre: TRIM });
  return { filas, escriturasUpdate, llamar, borrador };
}

const retencionDe = (f) => ({
  tipo: f.retencionPracticadaTipo ?? null,
  cuota: f.retencionPracticadaCuota == null ? null : Number(f.retencionPracticadaCuota),
  declarada: f.retencionPracticadaDeclarada ?? null,
});

// ── ① POST ──────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-1721 · ① POST · «Sí, 15 %» con su importe se guarda y sale en el 111 (casillas 07-09)', async () => {
  const b = banco();
  const r = await b.llamar('post', '/', { body: { ...GASTO_111, retencionPracticadaTipo: 15, retencionPracticadaCuota: 150 } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.deepEqual(retencionDe(b.filas[0]), { tipo: 15, cuota: 150, declarada: null });
  const d = (await b.borrador()).modelo111.actividadesEconomicasDinerarias;
  assert.deepEqual([d.perceptores.valor, d.importe.valor, d.retenciones.valor], [1, 1000, 150]);
});

test('SCRUM-1721 · ① POST · «Alquiler de local» con «Sí, 19 % (alquiler)» sale en el 115', async () => {
  const b = banco();
  const r = await b.llamar('post', '/', { body: { ...GASTO_115, retencionPracticadaTipo: 19, retencionPracticadaCuota: 114 } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const m115 = (await b.borrador()).modelo115;
  assert.deepEqual([m115.perceptores.valor, m115.base.valor, m115.retenciones.valor], [1, 600, 114]);
});

test('SCRUM-1721 · ① POST · los números llegan como texto de formulario («15», «150.5») y valen', async () => {
  const b = banco();
  const r = await b.llamar('post', '/', { body: { ...GASTO_111, retencionPracticadaTipo: '7', retencionPracticadaCuota: '70.5' } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.deepEqual(retencionDe(b.filas[0]), { tipo: 7, cuota: 70.5, declarada: null });
});

test('SCRUM-1721 · ① POST · sin campos de retención queda SIN CLASIFICAR (null), no «No»', async () => {
  const b = banco();
  const r = await b.llamar('post', '/', { body: { ...GASTO_111 } });
  assert.equal(r.status, 201);
  assert.deepEqual(retencionDe(b.filas[0]), { tipo: null, cuota: null, declarada: null });
});

// ── ④ fuera de este PR ──────────────────────────────────────────────────────────────────────────
test('SCRUM-1721 · ④ todavía NO: la ruta no escribe `retencionPracticadaDeclarada` (decisión de scrum1103:81, hasta 1721b)', async () => {
  const b = banco();
  await b.llamar('post', '/', { body: { ...GASTO_111, retencionPracticadaDeclarada: false } });
  await b.llamar('put', '/:id', { body: { concept: 'x', retencionPracticadaDeclarada: false }, params: { id: String(b.filas[0].id) } });
  assert.equal(b.filas[0].retencionPracticadaDeclarada ?? null, null);
  assert.ok(!('retencionPracticadaDeclarada' in b.escriturasUpdate[0]));
});

// ── ③ validación ────────────────────────────────────────────────────────────────────────────────
test('SCRUM-1721 · ③ un tipo fuera de 15/7/19 → 400 retencion_tipo_invalido, y no se guarda', async () => {
  for (const tipo of [21, 0, 2, 1, 15.5, -15, 'quince', true, [15], { v: 15 }]) {
    const b = banco();
    const r = await b.llamar('post', '/', { body: { ...GASTO_111, retencionPracticadaTipo: tipo, retencionPracticadaCuota: 1 } });
    assert.equal(r.status, 400, `tipo ${JSON.stringify(tipo)}`);
    assert.equal(r.data.error, 'retencion_tipo_invalido');
    assert.equal(b.filas.length, 0);
  }
});

test('SCRUM-1721 · ③ los tres tipos válidos son EXACTAMENTE la lista congelada de J1', async () => {
  const { TIPOS_RETENCION_PRACTICADA_VALIDOS } = requiere('./dist/modules/fiscal/retenciones/retencionesPracticadas.js');
  const { leerRetencionPracticada } = requiere('./dist/modules/expenses/domain/retencionPracticadaEntrada.js');
  assert.deepEqual([...TIPOS_RETENCION_PRACTICADA_VALIDOS], [15, 7, 19]);
  for (const t of TIPOS_RETENCION_PRACTICADA_VALIDOS) assert.equal(leerRetencionPracticada({ retencionPracticadaTipo: t }).ok, true, `tipo ${t}`);
});

test('SCRUM-1721 · ③ un importe negativo, ilegible, con más de 2 decimales o fuera de la columna → 400', async () => {
  for (const cuota of [-1, -0.01, 'abc', 1.005, 1e11, Infinity, true, {}]) {
    const b = banco();
    const r = await b.llamar('post', '/', { body: { ...GASTO_111, retencionPracticadaTipo: 15, retencionPracticadaCuota: cuota } });
    assert.equal(r.status, 400, `cuota ${String(cuota)}`);
    assert.equal(r.data.error, 'retencion_cuota_invalida');
    assert.equal(b.filas.length, 0);
  }
});

test('SCRUM-1721 · ③ un importe 0 es un dato (no «vacío»); un campo de formulario vacío («») es null', async () => {
  const b = banco();
  await b.llamar('post', '/', { body: { ...GASTO_111, retencionPracticadaTipo: 15, retencionPracticadaCuota: 0 } });
  await b.llamar('post', '/', { body: { ...GASTO_111, retencionPracticadaTipo: '', retencionPracticadaCuota: '' } });
  assert.deepEqual(b.filas.map(retencionDe), [
    { tipo: 15, cuota: 0, declarada: null },
    { tipo: null, cuota: null, declarada: null },
  ]);
});

// ── ② PUT ───────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-1721 · ② PUT que SOLO manda la retención la escribe (antes: 400 empty_update)', async () => {
  const b = banco();
  await b.llamar('post', '/', { body: { ...GASTO_111 } });
  const id = String(b.filas[0].id);
  const r = await b.llamar('put', '/:id', { body: { retencionPracticadaTipo: 15, retencionPracticadaCuota: 150 }, params: { id } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(retencionDe(b.filas[0]), { tipo: 15, cuota: 150, declarada: null });
  assert.equal((await b.borrador()).modelo111.actividadesEconomicasDinerarias.retenciones.valor, 150);
});

test('SCRUM-1721 · ② PUT · `undefined` no toca la retención; `null` la borra', async () => {
  const b = banco();
  await b.llamar('post', '/', { body: { ...GASTO_111, retencionPracticadaTipo: 15, retencionPracticadaCuota: 150 } });
  const id = String(b.filas[0].id);

  // Guardar el modal sin tocar la retención: el `update` no lleva sus claves.
  const r1 = await b.llamar('put', '/:id', { body: { concept: 'Subcontrata (corregido)' }, params: { id } });
  assert.equal(r1.status, 200);
  const sinRetencion = Object.keys(b.escriturasUpdate[0]).filter((k) => k.startsWith('retencionPracticada'));
  assert.deepEqual(sinRetencion, [], 'un PUT sin retención no puede escribir sus columnas');
  assert.deepEqual(retencionDe(b.filas[0]), { tipo: 15, cuota: 150, declarada: null });

  // `null` explícito en el importe: se borra ESE campo, y solo ése.
  const r2 = await b.llamar('put', '/:id', { body: { retencionPracticadaCuota: null }, params: { id } });
  assert.equal(r2.status, 200);
  assert.deepEqual(b.escriturasUpdate[1], { retencionPracticadaCuota: null });
  assert.deepEqual(retencionDe(b.filas[0]), { tipo: 15, cuota: null, declarada: null });
});

test('SCRUM-1721 · ② PUT · la misma validación que el alta (tipo 21 → 400, y no escribe)', async () => {
  const b = banco();
  await b.llamar('post', '/', { body: { ...GASTO_111 } });
  const id = String(b.filas[0].id);
  const r = await b.llamar('put', '/:id', { body: { concept: 'x', retencionPracticadaTipo: 21 }, params: { id } });
  assert.equal(r.status, 400);
  assert.equal(r.data.error, 'retencion_tipo_invalido');
  assert.equal(b.escriturasUpdate.length, 0);
});

// ── ⑦ montaje ───────────────────────────────────────────────────────────────────────────────────
test('SCRUM-1721 · ⑦ `GET /admin/retenciones` está montado en src/app.ts con requireRole(\'admin\'), como el 303', async () => {
  const ts = requiere('typescript');
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/app.ts'), 'utf8');
  const sf = ts.createSourceFile('app.ts', fuente, ts.ScriptTarget.Latest, true);
  let nombreDelRouter = null;
  const montajes = [];
  const visitar = (n) => {
    if (ts.isImportDeclaration(n) && n.moduleSpecifier.text === './modules/fiscal/retenciones/retenciones.routes') {
      nombreDelRouter = n.importClause?.name?.text ?? null;
    }
    if (ts.isCallExpression(n) && n.expression.getText(sf) === 'mountAdmin'
        && n.arguments[1] && ts.isStringLiteral(n.arguments[1])) {
      montajes.push({ ruta: n.arguments[1].text, args: n.arguments.slice(2).map((a) => a.getText(sf)) });
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  assert.ok(nombreDelRouter, 'app.ts no importa el router de SCRUM-1066h');
  const m = montajes.filter((x) => x.ruta === '/admin/retenciones');
  assert.equal(m.length, 1, `montajes de /admin/retenciones: ${JSON.stringify(m)}`);
  assert.deepEqual(m[0].args, ["requireRole('admin')", nombreDelRouter]);
  // Y con el mismo permiso que el 303, que es el contrato de c.21660.
  const m303 = montajes.find((x) => x.ruta === '/admin/modelo-303');
  assert.equal(m303?.args[0], "requireRole('admin')");
});
