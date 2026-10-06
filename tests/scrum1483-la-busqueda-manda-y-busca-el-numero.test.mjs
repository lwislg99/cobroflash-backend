// tests/scrum1483-la-busqueda-manda-y-busca-el-numero.test.mjs — SCRUM-1483
//
// 🔴 EL BUSCADOR DE ARRIBA DEL PANEL TRATABA UN PRESUPUESTO POR EL `id` DE LA TABLA.
//
// `GET /admin/search` ni mandaba el número del presupuesto ni buscaba por él: un término numérico
// era `id: Number(q)`. Medido por S2 en yaqu.app el 6-oct-2026: el buscador pintaba «#205» para el
// presupuesto que la lista y la ficha llaman «#4», porque la respuesta no traía otra cosa. Y el
// `id` es de toda la plataforma: a la vista le dice a un profesional cuántos presupuestos hay en
// ella (la familia de SCRUM-95).
//
// ── LO QUE ESTE TEST NO DICE ──────────────────────────────────────────────────────────────
// No mira la pantalla: que el buscador PINTE `numeroVisible` es SCRUM-1482 (S2), su gemelo. Y no
// mide el recorte del Técnico (qué presupuestos puede ver quien no es admin): esta ruta no lo
// aplica hoy y eso es otro asunto, con su ticket.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// La ruta REAL de `dist/` con los tres `findMany` doblados. El doble de presupuestos tiene TABLA y
// EVALÚA el `where` que la ruta manda (por `id`, por `quoteNumber`, por `revision`, por nombre de
// cliente) — si no lo evaluara, «buscar por id» y «buscar por número» darían lo mismo y la
// aceptación 2 saldría verde sin medir nada. Lo que no sabe evaluar LANZA: no contesta vacío.
import test from 'node:test';
import assert from 'node:assert/strict';
import { reqDeSesion } from './_arnes-de-router.mjs';

const { prisma } = await import('../dist/core/db/prisma.js');
// `dist/` es CommonJS con `exports.default`: desde un `.mjs` el router llega un nivel más adentro.
const searchRouter = (await import('../dist/modules/search/app/routes/search.routes.js')).default.default;
const { numeroVisibleDelPresupuesto, numeroBuscado } = await import('../dist/modules/quotes/domain/revision.js');

const MIO = 77;   // no es el 1: el 1 es el demo
const OTRO = 78;

/** La tabla. Los ids y los números SE CRUZAN a propósito: el nº 12 tiene id 500, y el id 12 es el nº 3. */
const TABLA = [
  { id: 12,  merchantId: MIO,  quoteNumber: 3,    revision: 0, customer: { name: 'Ana Cruz' },    createdAt: new Date('2026-09-01T10:00:00Z') },
  { id: 500, merchantId: MIO,  quoteNumber: 12,   revision: 0, customer: { name: 'Benito Sanz' }, createdAt: new Date('2026-09-02T10:00:00Z') },
  { id: 501, merchantId: MIO,  quoteNumber: 12,   revision: 1, customer: { name: 'Benito Sanz' }, createdAt: new Date('2026-09-03T10:00:00Z') },
  { id: 502, merchantId: MIO,  quoteNumber: null, revision: 0, customer: { name: 'Carla Sin Numero' }, createdAt: new Date('2026-09-04T10:00:00Z') },
  // De OTRA cuenta: mismo número 12, y un id (3) que es un número de la mía.
  { id: 3,   merchantId: OTRO, quoteNumber: 12,   revision: 0, customer: { name: 'Benito Sanz' }, createdAt: new Date('2026-09-05T10:00:00Z') },
].map((f) => ({ status: 'draft', total: 121, currency: 'EUR', ...f }));

/** ¿Casa esta fila con este `where`? Lo que no se sabe evaluar LANZA. */
function casa(fila, where) {
  for (const [clave, valor] of Object.entries(where)) {
    // SCRUM-1489: la ruta lleva ahora `AND: <recorte de quien pregunta>`, que para el admin de
    // estos casos es `undefined`. Prisma ignora una clave `undefined`; el doble también. Un `AND`
    // CON recorte sigue lanzando aquí: quién ve qué lo mide `scrum1489-…`, no este fichero.
    if (valor === undefined) continue;
    if (clave === 'OR') {
      assert.ok(Array.isArray(valor) && valor.length > 0, '🔴 un OR vacío: en Prisma no casa nada');
      if (!valor.some((w) => casa(fila, w))) return false;
    } else if (clave === 'merchantId' || clave === 'id' || clave === 'quoteNumber' || clave === 'revision') {
      assert.equal(typeof valor, 'number', `🔴 DOBLE CIEGO: \`${clave}\` con un valor que no es un número`);
      if (fila[clave] !== valor) return false;
    } else if (clave === 'customer') {
      const pide = valor?.name;
      assert.ok(pide && typeof pide.contains === 'string' && pide.mode === 'insensitive',
        `🔴 DOBLE CIEGO: no sé evaluar customer: ${JSON.stringify(valor)}`);
      if (!fila.customer.name.toLowerCase().includes(pide.contains.toLowerCase())) return false;
    } else {
      throw new Error(`🔴 DOBLE CIEGO: no sé evaluar la clave \`${clave}\` del where — amplía el doble, no la ignores`);
    }
  }
  return true;
}

/** Sólo viaja lo que el `select` pide, como en Prisma. */
function proyecta(fila, select) {
  const sale = {};
  for (const [clave, pide] of Object.entries(select)) {
    if (!pide) continue;
    sale[clave] = pide === true ? fila[clave] : Object.fromEntries(Object.keys(pide.select).map((k) => [k, fila[clave][k]]));
  }
  return sale;
}

const consultas = [];
/** Lo que contesta `GET /admin/search?q=…` a ESA sesión, con la tabla de arriba en la base. */
async function buscar(q, merchantId = MIO) {
  const capa = searchRouter.stack.find((l) => l.route?.path === '/' && l.route.methods.get);
  assert.ok(capa, '🔴 CIEGO: no encuentro GET / en el router de la búsqueda');
  const originales = [prisma.quote.findMany, prisma.customer.findMany, prisma.invoice.findMany];
  prisma.customer.findMany = async () => [];
  prisma.invoice.findMany = async () => [];
  prisma.quote.findMany = async (args) => {
    consultas.push(args);
    return TABLA.filter((f) => casa(f, args.where)).slice(0, args.take).map((f) => proyecta(f, args.select));
  };
  let estado = 200;
  let cuerpo;
  const res = { status(c) { estado = c; return res; }, json(b) { cuerpo = b; return res; } };
  try {
    await capa.route.stack[capa.route.stack.length - 1].handle(reqDeSesion({ rol: 'admin', merchantId, query: { q } }), res);
  } finally {
    [prisma.quote.findMany, prisma.customer.findMany, prisma.invoice.findMany] = originales;
  }
  assert.equal(estado, 200, `🔴 la búsqueda de «${q}» contestó ${estado}: ${JSON.stringify(cuerpo)}`);
  assert.ok(Array.isArray(cuerpo?.quotes), '🔴 CIEGO: la respuesta no trae `quotes`');
  return cuerpo.quotes;
}
const ids = (filas) => filas.map((f) => f.id).sort((a, b) => a - b);

test('SCRUM-1483 · CONTROL del doble: evalúa el where (por id casa el id, por número el número) y lanza con lo que no conoce', () => {
  assert.deepEqual(ids(TABLA.filter((f) => casa(f, { merchantId: MIO, OR: [{ id: 12 }] }))), [12]);
  assert.deepEqual(ids(TABLA.filter((f) => casa(f, { merchantId: MIO, OR: [{ quoteNumber: 12 }] }))), [500, 501]);
  assert.throws(() => casa(TABLA[0], { status: 'draft' }), /DOBLE CIEGO/);
});

test('SCRUM-1483 · aceptación 1: cada presupuesto llega con su número HECHO, y la revisión con el suyo', async () => {
  const filas = await buscar('benito');
  assert.deepEqual(ids(filas), [500, 501], 'población: el original y su revisión, de MI cuenta');
  const porId = Object.fromEntries(filas.map((f) => [f.id, f]));
  assert.equal(porId[500].numeroVisible, '#12');
  assert.equal(porId[501].numeroVisible, '#12.1', '🔴 la revisión se llama como su original');
});

test('SCRUM-1483 · 🔴 la secuencia en crudo NO viaja: el navegador no tiene con qué componer un número', async () => {
  const [fila] = await buscar('ana cruz');
  assert.deepEqual(Object.keys(fila).sort(), ['createdAt', 'currency', 'customer', 'id', 'numeroVisible', 'status', 'total']);
});

test('SCRUM-1483 · un presupuesto SIN número llega con `null`: ni el id de la tabla ni una raya', async () => {
  const [fila] = await buscar('carla');
  assert.equal(fila.id, 502);
  assert.equal(fila.numeroVisible, null);
});

test('SCRUM-1483 · 🔴 aceptación 2: buscar «12» encuentra el presupuesto nº 12, NO el que tiene id 12', async () => {
  // El cruce: el id 12 es el presupuesto nº 3 (otro documento de la misma cuenta).
  assert.deepEqual(ids(await buscar('12')), [500, 501]);
});

test('SCRUM-1483 · se busca como se lee: «#12» el grupo, «12.1» y «#12.1» sólo la revisión', async () => {
  assert.deepEqual(ids(await buscar('#12')), [500, 501]);
  assert.deepEqual(ids(await buscar('12.1')), [501]);
  assert.deepEqual(ids(await buscar('#12.1')), [501]);
});

test('SCRUM-1483 · aceptación 3: el id de la tabla ya no encuentra nada («500» es un id, no un número)', async () => {
  assert.deepEqual(ids(await buscar('500')), []);
  assert.deepEqual(ids(await buscar('501')), []);
});

test('SCRUM-1483 · aceptación 4: un presupuesto de OTRA cuenta no sale ni por número, ni por id, ni por nombre', async () => {
  consultas.length = 0;
  for (const q of ['12', '#12', '03', 'benito', '500']) {
    const filas = await buscar(q);
    assert.ok(!ids(filas).includes(3), `🔴 «${q}» devuelve el presupuesto de la otra cuenta`);
  }
  // La otra cuenta, buscando lo mismo, ve SÓLO el suyo.
  assert.deepEqual(ids(await buscar('12', OTRO)), [3]);
  assert.equal(consultas.length, 6, 'población: una consulta de presupuestos por búsqueda');
  for (const c of consultas.slice(0, 5)) assert.equal(c.where.merchantId, MIO, '🔴 una consulta sin el merchant de la sesión (regla 2)');
  assert.equal(consultas[5].where.merchantId, OTRO);
});

test('SCRUM-1483 · el que escribe el número y el que lo lee son inversos', () => {
  for (const q of [{ quoteNumber: 12, revision: 0 }, { quoteNumber: 12, revision: 1 }, { quoteNumber: 7, revision: 14 }]) {
    const leido = numeroBuscado(numeroVisibleDelPresupuesto(q));
    assert.equal(leido.quoteNumber, q.quoteNumber);
    assert.equal(leido.revision ?? 0, q.revision);
  }
  assert.equal(numeroVisibleDelPresupuesto({ quoteNumber: null, revision: 0 }), null);
  // Lo que NO es un número de presupuesto no se busca por número.
  for (const no of ['', 'benito', '12a', '1.2.3', '-12', '12.', '#', '1e3', '12 ']) {
    const r = numeroBuscado(no);
    if (no === '12 ') assert.deepEqual(r, { quoteNumber: 12 }, 'los espacios de los lados no cuentan');
    else assert.equal(r, null, `«${no}» se ha leído como un número de presupuesto`);
  }
});
