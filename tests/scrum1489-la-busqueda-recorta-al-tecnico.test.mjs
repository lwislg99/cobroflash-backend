// tests/scrum1489-la-busqueda-recorta-al-tecnico.test.mjs — SCRUM-1489
//
// 🔴 EL BUSCADOR DE ARRIBA LE DABA A UN TÉCNICO LOS DOCUMENTOS DE TODO EL NEGOCIO.
//
// `GET /admin/search` filtraba por negocio y por nada más: devolvía de cada presupuesto y de cada
// factura el cliente, el TOTAL y el estado, fueran de quien fueran. La decisión estaba tomada desde
// el 1-oct-2026 (SCRUM-1346 c.17952, SCRUM-1390 c.17962: un Técnico ve un presupuesto o una factura
// si es su autor, si lo tiene asignado o si el Trabajo es suyo) y aplicada a las listas y a las
// fichas (SCRUM-1403, SCRUM-1397). Esta ruta era la fila 9 del censo de SCRUM-1390 y se quedó fuera.
//
// Como en SCRUM-1403, la mitad que manda es «sigue encontrando lo suyo»: cada camino por el que un
// documento es suyo tiene su caso CON SU NOMBRE. Un recorte que le quite lo suyo le rompe el día.
//
// ── LO QUE ESTE TEST NO DICE ──────────────────────────────────────────────────────────────
// · Los CLIENTES no se recortan y aquí sólo se comprueba que siguen llegando: el Técnico ve la
//   cartera entera por `GET /admin/customers` (SCRUM-979), con estos mismos tres datos.
// · No mira la pantalla (`globalSearch.js`, S2).
// · El criterio de «suyo» NO se prueba aquí: es de las dos puertas, y lo sujetan sus tests
//   (`scrum1403-…`, `scrum1397-…`) contra Postgres. Aquí se prueba que la búsqueda PASA por ellas.
//
// ── LAS DOS MITADES ───────────────────────────────────────────────────────────────────────
// SIN BASE (corre siempre): la ruta REAL de `dist/` y las puertas REALES, con Prisma doblado por
// una tabla en memoria que EVALÚA cada `where` que recibe. Lo que no sabe evaluar LANZA: no
// contesta vacío. ⚠️ Ese evaluador es mío, no es Postgres: dice que el filtro llega y con qué forma.
// CON BASE (`LIBRO_PG_URL`, banco desechable; corre en el check obligatorio): la app real por HTTP
// contra Prisma de verdad. Es la que dice qué contesta el motor.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { reqDeSesion } from './_arnes-de-router.mjs';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';

const URL_BANCO = process.env.LIBRO_PG_URL || '';
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const CON_BASE = URL_BANCO !== '';

const { prisma } = await import('../dist/core/db/prisma.js');
// `dist/` es CommonJS: desde un `.mjs`, `module.exports` llega en `.default`.
const searchRouter = (await import('../dist/modules/search/app/routes/search.routes.js')).default.default;
const puertaPresupuestos = (await import('../dist/core/documentos/accesoAlPresupuesto.js')).default;
const puertaFacturas = (await import('../dist/core/documentos/accesoALaFactura.js')).default;

after(async () => { if (CON_BASE) await prisma.$disconnect(); });

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA MITAD SIN BASE
// ═════════════════════════════════════════════════════════════════════════════════════════════

const NEGOCIO = 77;   // no es el 1: el 1 es el demo
const ANA = 5;        // la Técnica que busca
const BLAS = 6;       // su compañero

// El nombre del cliente DICE por qué camino es suyo el documento (o que no lo es).
const TRABAJOS = [
  { id: 900, merchantId: NEGOCIO, quoteId: 103,  operarioId: ANA,  assignedUserId: null, assignees: [] },
  { id: 901, merchantId: NEGOCIO, quoteId: 203,  operarioId: BLAS, assignedUserId: null, assignees: [] },
];
const PRESUPUESTOS = [
  { id: 101, quoteNumber: 1, revision: 0, teamMemberId: ANA,  jobId: null, asignados: [],                       customer: { name: 'Suyo Autora' } },
  { id: 102, quoteNumber: 2, revision: 0, teamMemberId: null, jobId: null, asignados: [{ teamMemberId: ANA }],  customer: { name: 'Suyo Asignado' } },
  { id: 103, quoteNumber: 3, revision: 0, teamMemberId: null, jobId: null, asignados: [],                       customer: { name: 'Suyo Trabajo' } },
  { id: 104, quoteNumber: 4, revision: 0, teamMemberId: BLAS, jobId: 900,  asignados: [],                       customer: { name: 'Suyo Adicional' } },
  // La revisión de uno suyo por asignación: al revisar NO se copian los asignados (SCRUM-1403).
  { id: 105, quoteNumber: 2, revision: 1, teamMemberId: null, jobId: null, asignados: [],                       customer: { name: 'Suyo Asignado' } },
  { id: 201, quoteNumber: 7, revision: 0, teamMemberId: BLAS, jobId: null, asignados: [],                       customer: { name: 'Ajeno Autor' } },
  { id: 202, quoteNumber: 8, revision: 0, teamMemberId: null, jobId: null, asignados: [{ teamMemberId: BLAS }], customer: { name: 'Ajeno Asignado' } },
  { id: 203, quoteNumber: 9, revision: 0, teamMemberId: null, jobId: null, asignados: [],                       customer: { name: 'Ajeno Trabajo' } },
// SCRUM-1490: el grupo de revisiones es {negocio, AÑO de la serie, número}; todos éstos son de 2026.
].map((f) => ({ merchantId: NEGOCIO, status: 'accepted', total: 900, currency: 'EUR', seriesYear: 2026, createdAt: new Date('2026-09-01T10:00:00Z'), ...f }));
const ALBARANES = [{ id: 700, merchantId: NEGOCIO, jobId: 900, invoiceId: 304 }];
const LIBRO = [{ merchantId: NEGOCIO, albaranId: 700, invoiceId: 306 }];
const FACTURAS = [
  { id: 301, number: 'SUYA-001', quoteId: 101,  asignados: [],                       rectifiesId: null, customer: { name: 'Suyo Autora' } },
  { id: 302, number: 'SUYA-002', quoteId: null, asignados: [{ teamMemberId: ANA }],  rectifiesId: null, customer: { name: 'Suyo Asignado' } },
  { id: 303, number: 'SUYA-003', quoteId: 103,  asignados: [],                       rectifiesId: null, customer: { name: 'Suyo Trabajo' } },
  { id: 304, number: 'SUYA-004', quoteId: null, asignados: [],                       rectifiesId: null, customer: { name: 'Suyo Albaran' } },
  { id: 305, number: 'RECT-001', quoteId: null, asignados: [],                       rectifiesId: 304,  customer: { name: 'Suyo Albaran' } },
  { id: 306, number: 'PARC-001', quoteId: null, asignados: [],                       rectifiesId: null, customer: { name: 'Suyo Albaran' } },
  { id: 401, number: 'AJENA-001', quoteId: 201,  asignados: [],                       rectifiesId: null, customer: { name: 'Ajeno Autor' } },
  { id: 402, number: 'AJENA-002', quoteId: null, asignados: [{ teamMemberId: BLAS }], rectifiesId: null, customer: { name: 'Ajeno Asignado' } },
].map((f) => ({ merchantId: NEGOCIO, status: 'paid', total: 900, currency: 'EUR', createdAt: new Date('2026-09-02T10:00:00Z'), ...f }));
// Las relaciones que Prisma seguiría: la factura conoce su presupuesto y la que rectifica.
for (const f of FACTURAS) {
  f.quote = PRESUPUESTOS.find((p) => p.id === f.quoteId) ?? null;
  f.rectifies = FACTURAS.find((o) => o.id === f.rectifiesId) ?? null;
}
const CLIENTES = [{ id: 1, merchantId: NEGOCIO, name: 'Ajeno Autor', phone: null, email: null, updatedAt: new Date() }];

const ESCALARES = new Set(['id', 'merchantId', 'quoteNumber', 'seriesYear', 'revision', 'teamMemberId', 'jobId', 'quoteId', 'albaranId',
  'number', 'name', 'phone', 'email', 'operarioId', 'assignedUserId']);
const UNO = new Set(['customer', 'quote', 'rectifies']);          // relación a UNA fila
const VARIOS = new Set(['asignados', 'assignees']);                // relación a varias (`some`)

/** ¿Casa esta fila con este `where`? Lo que no se sabe evaluar LANZA. */
function casa(fila, where) {
  for (const [clave, valor] of Object.entries(where)) {
    if (valor === undefined) continue;                              // Prisma ignora una clave `undefined`
    if (clave === 'OR') {
      assert.ok(Array.isArray(valor), '🔴 DOBLE CIEGO: un OR que no es una lista');
      if (!valor.some((w) => casa(fila, w))) return false;          // un OR vacío no casa nada, como en Prisma
    } else if (clave === 'AND') {
      assert.ok(Array.isArray(valor), '🔴 DOBLE CIEGO: un AND que no es una lista');
      if (!valor.every((w) => casa(fila, w))) return false;
    } else if (UNO.has(clave)) {
      if (fila[clave] == null || !casa(fila[clave], valor)) return false;
    } else if (VARIOS.has(clave)) {
      assert.deepEqual(Object.keys(valor), ['some'], `🔴 DOBLE CIEGO: no sé evaluar ${clave}: ${JSON.stringify(valor)}`);
      if (!fila[clave].some((x) => casa(x, valor.some))) return false;
    } else if (clave === 'createdAt') {                              // SCRUM-1490: el año de una fila sin `seriesYear`
      assert.deepEqual(Object.keys(valor).sort(), ['gte', 'lt'], `🔴 DOBLE CIEGO: no sé evaluar createdAt: ${JSON.stringify(valor)}`);
      if (!(fila.createdAt >= valor.gte && fila.createdAt < valor.lt)) return false;
    } else if (ESCALARES.has(clave)) {
      assert.ok(clave in fila, `🔴 DOBLE CIEGO: la fila no tiene \`${clave}\` — se está preguntando a otra tabla`);
      if (valor === null || typeof valor !== 'object') { if (fila[clave] !== valor) return false; continue; }
      const forma = Object.keys(valor).sort().join(',');
      if (forma === 'in') { if (!valor.in.includes(fila[clave])) return false; }
      else if (forma === 'not') { assert.equal(valor.not, null); if (fila[clave] == null) return false; }
      else if (forma === 'contains,mode') {
        assert.equal(valor.mode, 'insensitive');
        if (fila[clave] == null || !String(fila[clave]).toLowerCase().includes(valor.contains.toLowerCase())) return false;
      } else throw new Error(`🔴 DOBLE CIEGO: no sé evaluar ${clave}: ${JSON.stringify(valor)}`);
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

const DOBLADOS = [
  ['customer', CLIENTES], ['quote', PRESUPUESTOS], ['invoice', FACTURAS],
  ['job', TRABAJOS], ['albaran', ALBARANES], ['albaranLineaFacturada', LIBRO],
];
const consultas = [];   // { tabla, where }: cada `findMany` que llegó a la base doblada

/** Lo que contesta `GET /admin/search?q=…` a ESA sesión, con las tablas de arriba en la base. */
async function buscar(q, sesion) {
  const capa = searchRouter.stack.find((l) => l.route?.path === '/' && l.route.methods.get);
  assert.ok(capa, '🔴 CIEGO: no encuentro GET / en el router de la búsqueda');
  const originales = DOBLADOS.map(([tabla]) => prisma[tabla].findMany);
  // SCRUM-1490: la puerta de presupuestos lee la zona del negocio (decide el año de una fila vieja).
  const zonaOriginal = prisma.merchant.findUnique;
  prisma.merchant.findUnique = async () => ({ timezone: null });
  for (const [tabla, filas] of DOBLADOS) {
    prisma[tabla].findMany = async (args) => {
      consultas.push({ tabla, where: args.where });
      let sale = filas.filter((f) => casa(f, args.where));
      if (args.distinct) {
        assert.deepEqual(args.distinct, ['quoteNumber'], '🔴 DOBLE CIEGO: un `distinct` que no conozco');
        sale = [...new Map(sale.map((f) => [f.quoteNumber, f])).values()];
      }
      return sale.slice(0, args.take ?? sale.length).map((f) => proyecta(f, args.select));
    };
  }
  let estado = 200;
  let cuerpo;
  const res = { status(c) { estado = c; return res; }, json(b) { cuerpo = b; return res; } };
  try {
    await capa.route.stack[capa.route.stack.length - 1].handle(reqDeSesion({ merchantId: NEGOCIO, query: { q }, ...sesion }), res);
  } finally {
    DOBLADOS.forEach(([tabla], i) => { prisma[tabla].findMany = originales[i]; });
    prisma.merchant.findUnique = zonaOriginal;
  }
  assert.equal(estado, 200, `🔴 la búsqueda de «${q}» contestó ${estado}: ${JSON.stringify(cuerpo)}`);
  for (const k of ['customers', 'quotes', 'invoices']) assert.ok(Array.isArray(cuerpo?.[k]), `🔴 CIEGO: la respuesta no trae \`${k}\``);
  return cuerpo;
}
const TECNICA = { rol: 'tecnico', teamMemberId: ANA };
const ADMIN = { rol: 'admin', teamMemberId: null };
const ids = (filas) => filas.map((f) => f.id).sort((a, b) => a - b);

test('SCRUM-1489 · CONTROL del doble: evalúa relaciones, `in`, `some` y `AND`, y lanza con lo que no conoce', () => {
  const de = (tabla, where) => ids(tabla.filter((f) => casa(f, where)));
  assert.deepEqual(de(PRESUPUESTOS, { asignados: { some: { teamMemberId: ANA } } }), [102]);
  assert.deepEqual(de(PRESUPUESTOS, { OR: [{ id: { in: [103] } }, { jobId: { in: [900] } }] }), [103, 104]);
  assert.deepEqual(de(PRESUPUESTOS, { AND: [{ teamMemberId: BLAS }], customer: { name: { contains: 'AJENO', mode: 'insensitive' } } }), [201]);
  assert.deepEqual(de(FACTURAS, { quote: { teamMemberId: BLAS } }), [401]);
  assert.deepEqual(de(FACTURAS, { rectifies: { OR: [{ id: { in: [304] } }] } }), [305]);
  assert.deepEqual(de(PRESUPUESTOS, { OR: [] }), [], 'un OR vacío no casa nada');
  assert.throws(() => casa(PRESUPUESTOS[0], { status: 'draft' }), /DOBLE CIEGO/);
  assert.throws(() => casa(PRESUPUESTOS[0], { number: 'x' }), /DOBLE CIEGO/, 'una clave de otra tabla se nota');
});

test('SCRUM-1489 · 🔴 aceptación 1: la Técnica NO encuentra un presupuesto ajeno, ni por el nombre del cliente ni por su número', async () => {
  const porNombre = await buscar('ajeno', TECNICA);
  assert.deepEqual(ids(porNombre.quotes), [], '🔴 el buscador le devuelve a un Técnico presupuestos de sus compañeros (con su total)');
  for (const numero of ['#7', '#8', '#9']) {
    assert.deepEqual(ids((await buscar(numero, TECNICA)).quotes), [], `🔴 «${numero}» le devuelve un presupuesto ajeno`);
  }
  // El control: lo ajeno EXISTE y el admin lo encuentra con las mismas búsquedas.
  assert.deepEqual(ids((await buscar('ajeno', ADMIN)).quotes), [201, 202, 203], 'población: tres presupuestos ajenos en la tabla');
  assert.deepEqual(ids((await buscar('#7', ADMIN)).quotes), [201]);
});

test('SCRUM-1489 · 🔴 aceptación 2: tampoco una factura ajena, ni por su número ni por el nombre del cliente', async () => {
  assert.deepEqual(ids((await buscar('AJENA-', TECNICA)).invoices), [], '🔴 el buscador le devuelve a un Técnico facturas de sus compañeros (con su total)');
  assert.deepEqual(ids((await buscar('ajeno', TECNICA)).invoices), []);
  assert.deepEqual(ids((await buscar('AJENA-', ADMIN)).invoices), [401, 402], 'población: dos facturas ajenas en la tabla');
  assert.deepEqual(ids((await buscar('ajeno', ADMIN)).invoices), [401, 402]);
});

test('SCRUM-1489 · ✅ aceptación 3: la Técnica SIGUE encontrando cada presupuesto suyo, por cada camino', async () => {
  const caminos = [
    ['suyo autora', [101], 'AUTORA'],
    ['suyo asignado', [102, 105], 'ASIGNADA AL DOCUMENTO (y la revisión de ése, que no copia los asignados)'],
    ['suyo trabajo', [103], 'su TRABAJO (el presupuesto que lo abrió)'],
    ['suyo adicional', [104], 'su TRABAJO (un adicional de un compañero que cuelga de él)'],
    ['#2', [102, 105], 'por NÚMERO, el grupo'],
    ['#2.1', [105], 'por NÚMERO, la revisión'],
  ];
  for (const [q, esperado, camino] of caminos) {
    assert.deepEqual(ids((await buscar(q, TECNICA)).quotes), esperado, `🔴 la Técnica ha dejado de encontrar un presupuesto SUYO: ${camino}`);
    assert.deepEqual(ids((await buscar(q, ADMIN)).quotes), esperado, `el admin encuentra lo mismo con «${q}»`);
  }
});

test('SCRUM-1489 · ✅ aceptación 3: y cada factura suya — autora, asignada, Trabajo, albarán (entero y por líneas) y rectificativa', async () => {
  const caminos = [
    ['SUYA-001', [301], 'AUTORA del presupuesto del que nace'],
    ['SUYA-002', [302], 'ASIGNADA AL DOCUMENTO'],
    ['SUYA-003', [303], 'el presupuesto que abrió su TRABAJO'],
    ['SUYA-004', [304], 'un ALBARÁN de su Trabajo'],
    ['PARC-001', [306], 'las LÍNEAS de un albarán de su Trabajo'],
    ['RECT-001', [305], 'la RECTIFICATIVA de una suya'],
  ];
  for (const [q, esperado, camino] of caminos) {
    assert.deepEqual(ids((await buscar(q, TECNICA)).invoices), esperado, `🔴 la Técnica ha dejado de encontrar una factura SUYA: ${camino}`);
    assert.deepEqual(ids((await buscar(q, ADMIN)).invoices), esperado);
  }
});

test('SCRUM-1489 · 🔴 sin identidad no hay nada suyo: una sesión de Técnico sin `teamMemberId` no encuentra ningún documento', async () => {
  const r = await buscar('suyo', { rol: 'tecnico', teamMemberId: null });
  assert.deepEqual([ids(r.quotes), ids(r.invoices)], [[], []]);
  assert.ok((await buscar('suyo', ADMIN)).quotes.length > 0, 'población: con esa búsqueda hay documentos');
});

test('SCRUM-1489 · 🔴 aceptación 4: el recorte SALE de las dos puertas — lo que ellas contesten es lo que la consulta lleva', async () => {
  // Las puertas se sustituyen por dos testigos que contestan un recorte que NINGÚN criterio
  // escrito en la ruta podría producir. Si la ruta deja de llamarlas (o copia el criterio dentro),
  // el testigo no llega a la consulta y este caso cae.
  const [dePresupuestos, deFacturas] = [puertaPresupuestos.wherePresupuestosVisibles, puertaFacturas.whereFacturasVisibles];
  const preguntas = [];
  puertaPresupuestos.wherePresupuestosVisibles = async (quien) => { preguntas.push(['presupuestos', quien]); return { id: { in: [201] } }; };
  puertaFacturas.whereFacturasVisibles = async (quien) => { preguntas.push(['facturas', quien]); return { id: { in: [402] } }; };
  let r;
  consultas.length = 0;
  try { r = await buscar('ajeno', TECNICA); } finally {
    puertaPresupuestos.wherePresupuestosVisibles = dePresupuestos;
    puertaFacturas.whereFacturasVisibles = deFacturas;
  }
  assert.deepEqual(preguntas.map(([p]) => p).sort(), ['facturas', 'presupuestos'], '🔴 la ruta no ha preguntado a las dos puertas, una vez a cada una');
  for (const [, quien] of preguntas) {
    assert.deepEqual(quien, { merchantId: NEGOCIO, userRole: 'tecnico', teamMemberId: ANA }, '🔴 a la puerta no le llega quién pregunta');
  }
  assert.deepEqual(ids(r.quotes), [201], '🔴 la consulta de presupuestos no lleva lo que contestó su puerta');
  assert.deepEqual(ids(r.invoices), [402], '🔴 la consulta de facturas no lleva lo que contestó su puerta');
  const deLaRuta = Object.fromEntries(consultas.map((c) => [c.tabla, c.where]));
  assert.deepEqual(deLaRuta.quote.AND, [{ id: { in: [201] } }]);
  assert.deepEqual(deLaRuta.invoice.AND, [{ id: { in: [402] } }]);
});

test('SCRUM-1489 · el admin no añade NADA a sus consultas, y la del negocio sigue en las tres (regla 2)', async () => {
  consultas.length = 0;
  await buscar('ajeno', ADMIN);
  assert.deepEqual(consultas.map((c) => c.tabla).sort(), ['customer', 'invoice', 'quote'], '🔴 el admin hace consultas de más: la puerta le está recortando');
  for (const c of consultas) {
    assert.equal(c.where.merchantId, NEGOCIO, `🔴 la consulta de ${c.tabla} no lleva el negocio de la sesión`);
    assert.equal(c.where.AND, undefined, `🔴 la consulta de ${c.tabla} del admin lleva un recorte`);
  }
  consultas.length = 0;
  await buscar('ajeno', TECNICA);
  assert.ok(consultas.length > 3, 'población: la Técnica sí pasa por las puertas');
  for (const c of consultas) assert.equal(c.where.merchantId, NEGOCIO, `🔴 una consulta de ${c.tabla} sin el negocio de la sesión`);
});

test('SCRUM-1489 · los CLIENTES no se recortan: la Técnica encuentra la cartera entera, como en su lista (SCRUM-979)', async () => {
  consultas.length = 0;
  const r = await buscar('ajeno', TECNICA);
  assert.deepEqual(ids(r.customers), [1], '🔴 la Técnica ha dejado de encontrar a un cliente del negocio');
  assert.deepEqual(Object.keys(r.customers[0]).sort(), ['email', 'id', 'name', 'phone'], '🔴 con el cliente viaja algo más que su nombre, su teléfono y su email');
  assert.equal(consultas.find((c) => c.tabla === 'customer').where.AND, undefined);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA MITAD CON BASE: la app real por HTTP contra Prisma de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1489 · 🔴 CON BASE: por HTTP, el Técnico encuentra sus documentos y ninguno de su compañero; el admin, todos', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  const { app } = await import('../dist/app.js');
  const marca = `Qa1489x${Date.now()}`;   // va en el nombre de los clientes: es lo que se busca

  await withMerchant(prisma, { name: 'QA SCRUM-1489 buscador', email: `qa-1489-${Date.now()}@test.local` }, async (merchant) => {
    const miembro = (name, role) => prisma.teamMember.create({
      data: { merchantId: merchant.id, name, email: `qa1489-${name.toLowerCase()}-${Date.now()}@test.local`, role, status: 'active' },
    });
    const ana = await miembro('Ana', 'tecnico');
    const blas = await miembro('Blas', 'tecnico');
    const jefa = await miembro('Jefa', 'admin');
    const cliente = (nombre) => prisma.customer.create({ data: { merchantId: merchant.id, name: `${marca} ${nombre}` } });
    let n = 0;
    const presupuesto = (c, autorId, extra = {}) => prisma.quote.create({
      data: {
        merchantId: merchant.id, customerId: c.id, total: '900', currency: 'EUR', lines: [],
        quoteNumber: ++n, status: 'accepted', teamMemberId: autorId, ...extra,
      },
    });
    const factura = (c, numero, extra = {}) => prisma.invoice.create({
      data: {
        merchantId: merchant.id, customerId: c.id, number: numero, total: '900', currency: 'EUR',
        pdfUrl: 'PENDING_PDF', qrData: 'PENDING', status: 'pending', type: 'F1', quoteId: null,
        vfEstado: 'no_aplica', ...extra,
      },
    });

    const cAna = await cliente('de Ana');
    const cBlas = await cliente('de Blas');
    const suyoAutora = await presupuesto(cAna, ana.id);
    const suyoAsignado = await presupuesto(cAna, null, { status: 'sent' });
    await prisma.quoteAssignee.create({ data: { quoteId: suyoAsignado.id, teamMemberId: ana.id } });
    const suyoTrabajo = await presupuesto(cAna, null);
    await prisma.job.create({ data: { merchantId: merchant.id, customerId: cAna.id, quoteId: suyoTrabajo.id, operarioId: ana.id } });
    const ajeno = await presupuesto(cBlas, blas.id);
    const facturaSuya = await factura(cAna, `${marca}-S1`, { quoteId: suyoAutora.id });
    const facturaAjena = await factura(cBlas, `${marca}-B1`, { quoteId: ajeno.id });

    const sesionDe = async (teamMemberId) => {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.authSession.create({
        data: { merchantId: merchant.id, teamMemberId, token, type: 'session', expiresAt: new Date(Date.now() + 3600e3) },
      });
      return token;
    };
    const server = http.createServer(app).listen(0);
    await new Promise((r) => server.once('listening', r));
    const pedir = async (token, q) => {
      const r = await fetch(`http://127.0.0.1:${server.address().port}/admin/search?q=${encodeURIComponent(q)}`, { headers: { cookie: `pf_session=${token}` } });
      return { status: r.status, cuerpo: await r.json().catch(() => null) };
    };
    try {
      const [tAna, tJefa] = [await sesionDe(ana.id), await sesionDe(jefa.id)];

      // El patrón: la administradora lo encuentra TODO con la misma búsqueda.
      const todo = await pedir(tJefa, marca);
      assert.equal(todo.status, 200);
      assert.deepEqual(ids(todo.cuerpo.quotes), ids([suyoAutora, suyoAsignado, suyoTrabajo, ajeno]), 'población: los cuatro presupuestos sembrados');
      assert.deepEqual(ids(todo.cuerpo.invoices), ids([facturaSuya, facturaAjena]), 'población: las dos facturas sembradas');

      const suyo = await pedir(tAna, marca);
      assert.equal(suyo.status, 200);
      assert.deepEqual(ids(suyo.cuerpo.quotes), ids([suyoAutora, suyoAsignado, suyoTrabajo]),
        '🔴 la Técnica no encuentra exactamente SUS presupuestos (autora, asignada, Trabajo)');
      assert.deepEqual(ids(suyo.cuerpo.invoices), [facturaSuya.id], '🔴 la Técnica no encuentra exactamente SUS facturas');
      assert.equal(suyo.cuerpo.customers.length, 2, '🔴 la Técnica ha dejado de encontrar a los clientes del negocio');

      // Por el número del documento ajeno, que es el otro camino de la búsqueda.
      const porNumero = await pedir(tAna, `#${ajeno.quoteNumber}`);
      assert.deepEqual(ids(porNumero.cuerpo.quotes), [], '🔴 la Técnica encuentra el presupuesto de su compañero por su número');
      assert.deepEqual(ids((await pedir(tJefa, `#${ajeno.quoteNumber}`)).cuerpo.quotes), [ajeno.id], 'control: por ese número el presupuesto se encuentra');
      const porNumeroDeFactura = await pedir(tAna, `${marca}-B1`);
      assert.deepEqual(ids(porNumeroDeFactura.cuerpo.invoices), [], '🔴 la Técnica encuentra la factura de su compañero por su número');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});
