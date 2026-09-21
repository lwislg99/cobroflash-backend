// tests/scrum944b-el-trabajo-se-llama-igual.test.mjs — SCRUM-944, punto 2 (servidor)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL MISMO TRABAJO SE LLAMABA DISTINTO EN DOS PANTALLAS
//
// Gastos devolvía `job.titulo` CRUDO (`Job.titulo`), y la pantalla cae a la palabra «Trabajo» cuando
// es `null`. Trabajos usa `tituloDeTrabajo()` y dice «Presupuesto #5 · María López» para ese mismo
// Trabajo. En staging, 10 de los 13 Trabajos del merchant no tienen título: casi todas las filas de
// Gastos decían «Trabajo», y el profesional no podía cruzar sus gastos con sus trabajos.
//
// ES EL CANON DE LA CASA —«una decisión de producto no vive en una vista»—: la función que decide
// cómo se llama un Trabajo YA EXISTE. El arreglo no inventa un nombre en Gastos: llama a la que decide.
// Y no se cambia `tituloDeTrabajo` para que encaje (su fichero no está en este diff): si no encajara,
// se pararía y se diría.
//
// (El punto 1 de SCRUM-944 —el KPI que pinta la clave cruda de la categoría— es de front y de la
// Sesión 2; no se toca aquí.)
//
// ── EL BANCO ─────────────────────────────────────────────────────────────────────────────────
// `listExpenses` de verdad (dist/), con la base doblada por `_envio-doblado.mjs`. Ese doble devuelve
// respuestas FIJAS sin mirar el `where`; aquí cada respuesta es una función que discrimina por el
// `select`/`where` que recibe y que EVALÚA lo que evaluaría Postgres, porque es lo que se mide. Cada
// consulta queda anotada con sus argumentos tal cual.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';

const SERVICIO = '../dist/modules/expenses/domain/expenses.service.js';
const TRABAJOS = '../dist/modules/jobs/domain/trabajoDirecto.js';

/**
 * `trabajos`: { id, titulo, customerId, quoteId }; `quotes`: { id, jobId, quoteNumber };
 * `clientes`: { id, name }; `gastos`: los gastos que devuelve la lista, con su `quoteId`.
 */
function banco({ trabajos = [], quotes = [], clientes = [], gastos = [] } = {}) {
  const consultas = { jobsCompletos: [], quotesCompletos: [], clientes: [] };
  const enLista = (x, arr) => arr?.includes(x);
  inyectarBase({
    // SCRUM-964 · la lista hace DOS consultas de gastos: la página y «cuáles llevan foto» (solo `id`,
    // con `receiptData: { not: null }`). La segunda discrimina por `conFoto`, como Postgres: un doble
    // que devolviera todo diría `tieneFoto: true` a cualquier gasto y el test sería ciego a la foto.
    'expense.findMany': (args) => args.where?.receiptData
      ? gastos.filter((g) => g.conFoto).map((g) => ({ id: g.id }))
      : gastos.map(({ conFoto, ...g }) => ({ date: new Date(), category: 'otros', provider: null, quote: g.quoteId ? { id: g.quoteId } : null, ...g })),
    'quote.findMany': (args) => {
      if (args.select && 'quoteNumber' in args.select) {          // la consulta de `nombresDeTrabajos`
        consultas.quotesCompletos.push(args);
        const ids = args.where.OR?.find((c) => c.id)?.id?.in;
        const jobIds = args.where.OR?.find((c) => c.jobId)?.jobId?.in;
        return quotes.filter((q) => enLista(q.id, ids) || enLista(q.jobId, jobIds)).sort((a, b) => a.id - b.id);
      }
      return quotes.filter((q) => enLista(q.id, args.where.id?.in)).map((q) => ({ id: q.id, jobId: q.jobId ?? null }));   // `trabajosPorQuote`
    },
    'job.findMany': (args) => {
      if (args.select && 'customerId' in args.select) {           // la consulta de `nombresDeTrabajos`
        consultas.jobsCompletos.push(args);
        return trabajos.filter((j) => enLista(j.id, args.where.id.in)).map((j) => ({ id: j.id, customerId: j.customerId, quoteId: j.quoteId ?? null }));
      }
      if (args.select && 'titulo' in args.select) {               // `trabajosPorQuote`: títulos por id
        return trabajos.filter((j) => enLista(j.id, args.where.id.in)).map((j) => ({ id: j.id, titulo: j.titulo ?? null }));
      }
      return [];                                                  // `trabajosPorQuote`: el sentido viejo, sin pares
    },
    'customer.findMany': (args) => {
      consultas.clientes.push(args);
      return clientes.filter((c) => enLista(c.id, args.where.id.in));
    },
  }, [SERVICIO]);
  const { listExpenses } = moduloDeDist(SERVICIO);
  return { consultas, lista: () => listExpenses(MERCHANT) };
}

const MARIA = { id: 7, name: 'María López' };
const Q_ORIGINAL = { id: 1, jobId: 500, quoteNumber: 5 };
const Q_ADICIONAL = { id: 2, jobId: 500, quoteNumber: 8 };
const SIN_TITULO = { id: 500, titulo: null, customerId: MARIA.id, quoteId: 1 };
const GASTO = { id: 1, merchantId: MERCHANT, concept: 'Tubo', amount: 10, quoteId: 1 };

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SUELO — el banco ve lo que tiene que ver
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-944b · 🔴 SUELO: la lista de verdad devuelve el gasto con su trabajo (id 500), y el banco lo ve', async () => {
  const b = banco({ trabajos: [{ ...SIN_TITULO, titulo: 'Reforma baño' }], quotes: [Q_ORIGINAL], clientes: [MARIA], gastos: [GASTO] });
  const items = await b.lista();
  assert.equal(items.length, 1, '🔴 SUELO: la lista no devolvió el gasto sembrado; todo lo de abajo sería un verde vacío');
  assert.equal(items[0].job?.id, 500, '🔴 SUELO: el gasto no encontró su trabajo por el doble; el resto no mediría nada');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// POSITIVO — lo que ya funcionaba
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-944b · POSITIVO: un Trabajo CON título sigue enseñando ese título, y no se consulta nada más', async () => {
  const b = banco({ trabajos: [{ ...SIN_TITULO, titulo: 'Reforma baño' }], quotes: [Q_ORIGINAL], clientes: [MARIA], gastos: [GASTO] });
  const [item] = await b.lista();
  assert.equal(item.job.titulo, 'Reforma baño');
  assert.equal(b.consultas.jobsCompletos.length + b.consultas.quotesCompletos.length + b.consultas.clientes.length, 0,
    'con título no hay nada que componer: no debe haber consultas de más');
});

test('SCRUM-944b · POSITIVO: un gasto SIN trabajo sigue con `job: null`', async () => {
  const b = banco({ gastos: [{ ...GASTO, quoteId: null }] });
  const [item] = await b.lista();
  assert.equal(item.job, null);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL ROJO — el nombre que hoy se pierde
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-944b · 🔴 EL DEFECTO: un Trabajo SIN título se llama «Presupuesto #5 · María López», no `null`', async () => {
  const b = banco({ trabajos: [SIN_TITULO], quotes: [Q_ORIGINAL], clientes: [MARIA], gastos: [GASTO] });
  const [item] = await b.lista();
  assert.equal(item.job.titulo, 'Presupuesto #5 · María López',
    `🔴 Gastos llama a este Trabajo ${JSON.stringify(item.job.titulo)} y Trabajos «Presupuesto #5 · María López»`);
});

test('SCRUM-944b · 🔴 el nombre es el de Trabajos: MISMA función, mismas entradas → mismo texto', async () => {
  const { tituloDeTrabajo } = moduloDeDist(TRABAJOS);
  const enTrabajos = tituloDeTrabajo({ titulo: null, quote: { id: 1, quoteNumber: 5 }, customer: { name: MARIA.name }, jobId: 500 });
  const b = banco({ trabajos: [SIN_TITULO], quotes: [Q_ORIGINAL], clientes: [MARIA], gastos: [GASTO] });
  const [item] = await b.lista();
  assert.equal(item.job.titulo, enTrabajos);
  assert.equal(enTrabajos, 'Presupuesto #5 · María López', 'la función de Trabajos no se ha tocado: éste es su literal de siempre');
});

test('SCRUM-944b · 🔴 un gasto imputado a un ADICIONAL lleva el nombre del TRABAJO (el presupuesto original), no el del adicional', async () => {
  const b = banco({
    trabajos: [SIN_TITULO], quotes: [Q_ORIGINAL, Q_ADICIONAL], clientes: [MARIA],
    gastos: [{ ...GASTO, quoteId: 2 }],
  });
  const [item] = await b.lista();
  assert.equal(item.job.id, 500, 'el gasto del adicional encuentra su Trabajo');
  assert.equal(item.job.titulo, 'Presupuesto #5 · María López',
    `🔴 serializeJob titula con el ORIGINAL (#5); esto dice ${JSON.stringify(item.job.titulo)}`);
});

test('SCRUM-944b · sin `Job.quoteId` (sólo un adicional con jobId) toma el primero por id, como el original de serializeJob', async () => {
  const b = banco({
    trabajos: [{ ...SIN_TITULO, quoteId: null }], quotes: [Q_ADICIONAL], clientes: [MARIA],
    gastos: [{ ...GASTO, quoteId: 2 }],
  });
  const [item] = await b.lista();
  assert.equal(item.job.titulo, 'Presupuesto #8 · María López');
});

test('SCRUM-944b · sin número de presupuesto ni cliente, el respaldo es el de tituloDeTrabajo («Presupuesto #<id>»), sin inventar nada', async () => {
  const b = banco({ trabajos: [{ ...SIN_TITULO, quoteId: null }], quotes: [{ id: 1, jobId: 500, quoteNumber: null }], clientes: [], gastos: [GASTO] });
  const [item] = await b.lista();
  assert.equal(item.job.titulo, 'Presupuesto #1');
});

test('SCRUM-944b · un gasto cuyo presupuesto no pertenece a ningún Trabajo sigue suelto (job: null)', async () => {
  const b = banco({ trabajos: [SIN_TITULO], quotes: [{ id: 1, jobId: null, quoteNumber: 5 }], clientes: [MARIA], gastos: [GASTO] });
  const [item] = await b.lista();
  assert.equal(item.job, null);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS DOS COSAS A LA VEZ — el nombre del Trabajo (944) y `tieneFoto` (964) en la MISMA fila
// ═════════════════════════════════════════════════════════════════════════════════════════════
// Las dos ramas tocaron el mismo `return` de `listExpenses` y el merge las juntó a mano: ningún
// test miraba las dos cosas en una fila que tuviera Trabajo, así que quitar `tieneFoto` de esa rama
// dejaba todo en verde (medido al fusionar: 964 15/15 y 944b 10/10 con la clave fuera).

test('SCRUM-944b · 🔴 un gasto CON foto y CON Trabajo lleva las dos cosas: `tieneFoto: true` y el nombre de Trabajos', async () => {
  const b = banco({ trabajos: [SIN_TITULO], quotes: [Q_ORIGINAL], clientes: [MARIA], gastos: [{ ...GASTO, conFoto: true }] });
  const [item] = await b.lista();
  assert.equal(item.job.titulo, 'Presupuesto #5 · María López');
  assert.equal(item.tieneFoto, true, '🔴 el gasto tiene foto y su fila, con Trabajo, no lo dice');
});

test('SCRUM-944b · SUELO de `tieneFoto`: el mismo Trabajo, un gasto SIN foto → `false`; y un gasto suelto CON foto → `true`', async () => {
  const b = banco({
    trabajos: [SIN_TITULO], quotes: [Q_ORIGINAL], clientes: [MARIA],
    gastos: [{ ...GASTO, id: 1 }, { ...GASTO, id: 2, quoteId: null, conFoto: true }],
  });
  const [conTrabajoSinFoto, sueltoConFoto] = await b.lista();
  assert.equal(conTrabajoSinFoto.tieneFoto, false, 'el doble discrimina: sin foto es false, no true por defecto');
  assert.equal(sueltoConFoto.tieneFoto, true);
  assert.equal(sueltoConFoto.job, null);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// NEGATIVO — coste constante y tenencia
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-944b · NEGATIVO: coste CONSTANTE (una consulta de cada por página, no una por gasto) y con merchantId', async () => {
  const trabajos = [500, 501, 502].map((id) => ({ id, titulo: null, customerId: MARIA.id, quoteId: id - 499 }));
  const quotes = [500, 501, 502].map((id) => ({ id: id - 499, jobId: id, quoteNumber: id - 495 }));
  const gastos = [1, 2, 3].map((n) => ({ ...GASTO, id: n, quoteId: n }));
  const b = banco({ trabajos, quotes, clientes: [MARIA], gastos });
  const items = await b.lista();
  assert.deepEqual(items.map((i) => i.job.titulo), ['Presupuesto #5 · María López', 'Presupuesto #6 · María López', 'Presupuesto #7 · María López']);
  assert.equal(b.consultas.jobsCompletos.length, 1, 'una sola consulta de Trabajos para toda la página');
  assert.equal(b.consultas.quotesCompletos.length, 1, 'una sola consulta de presupuestos para toda la página');
  assert.equal(b.consultas.clientes.length, 1, 'una sola consulta de clientes para toda la página');
  for (const q of [...b.consultas.jobsCompletos, ...b.consultas.quotesCompletos, ...b.consultas.clientes]) {
    assert.equal(q.where.merchantId, MERCHANT, 'regla 2: toda consulta va acotada al merchant');
  }
});
