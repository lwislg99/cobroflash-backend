// SCRUM-1490 · EL AÑO DE LA SERIE VIVE EN LA FILA, Y EL GRUPO DE REVISIONES ES {NEGOCIO, AÑO, NÚMERO}
//
// La serie de presupuestos es ANUAL (SCRUM-592). Hasta este ticket la fila guardaba sólo la
// secuencia y el año se deducía de `createdAt`: una revisión creada en enero de un original de
// diciembre salía con el nombre de OTRO documento, y con el 12 de 2026 y el 12 de 2027 en la tabla
// la ficha lanzaba `RevisionesAmbiguas` (500). 🔴 Con fecha: 1-ene-2027.
//
// QUÉ SE MIDE AQUÍ, por aceptación del ticket:
//   3 · un presupuesto nuevo guarda el año de su serie (censo por AST de los `quote.create` de
//       `src/`) y una revisión creada en OTRO año guarda el de su original (`crearRevisionDeQuote`,
//       con el reloj puesto en enero).
//   4 · con los dos «12» en la tabla, `GET /admin/quotes/:id` contesta 200 para los dos y cada uno
//       ve sólo su grupo. Por la ruta real.
//   5 · el recorte del Técnico (`wherePresupuestosVisibles`) no le da el 12 de otro año.
// Y el relleno de lo viejo (`scripts/rellenar-anio-de-la-serie.mjs`), como función pura.
//
// La base es un DOBLE que evalúa el `where` contra una tabla en memoria. Lo que no sabe evaluar
// LANZA: un doble que ignora una clave que no conoce deja pasar justo el filtro que se quería medir.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { reqDeSesion } from './_arnes-de-router.mjs';
import { inyectarBase, moduloDeDist } from './_envio-doblado.mjs';
import { planDelRelleno, ZONA_DEL_RELLENO } from '../scripts/rellenar-anio-de-la-serie.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const NEGOCIO = 77;   // no es el 1: el 1 es el demo
const OTRO_NEGOCIO = 78;
const ANA = 5;        // la Técnica
const BLAS = 6;       // su compañero

const fila = (f) => ({
  merchantId: NEGOCIO, status: 'draft', total: '900.00', currency: 'EUR', lines: [], signatureUrl: null,
  teamMemberId: null, jobId: null, asignados: [], customerId: 55, paymentTerms: null, customBillingPlan: null,
  discountGlobalAmount: null,
  merchant: { id: f.merchantId ?? NEGOCIO, timezone: null }, customer: { id: 55, name: 'Cliente', phone: null, email: null },
  charge: null, Invoice: [],
  ...f,
});
/** La tabla. Los nombres dicen qué es cada fila. */
const TABLA = () => [
  // El 12 de 2026: original de diciembre y su revisión, creada YA EN ENERO de 2027.
  fila({ id: 1, quoteNumber: 12, revision: 0, seriesYear: 2026, createdAt: new Date('2026-12-10T10:00:00Z'), teamMemberId: ANA }),
  fila({ id: 2, quoteNumber: 12, revision: 1, seriesYear: 2026, createdAt: new Date('2027-01-08T10:00:00Z') }),
  // El 12 de 2027: OTRO documento, de otra persona.
  fila({ id: 3, quoteNumber: 12, revision: 0, seriesYear: 2027, createdAt: new Date('2027-01-09T10:00:00Z'), teamMemberId: BLAS }),
  // Filas ANTERIORES a la columna (año a NULL): el 7 de 2026 y el 7 de 2025.
  fila({ id: 4, quoteNumber: 7, revision: 0, seriesYear: null, createdAt: new Date('2026-03-01T10:00:00Z'), teamMemberId: ANA }),
  fila({ id: 5, quoteNumber: 7, revision: 0, seriesYear: null, createdAt: new Date('2025-06-01T10:00:00Z'), teamMemberId: BLAS }),
  // El 12 de 2026 de OTRO negocio.
  fila({ id: 9, merchantId: OTRO_NEGOCIO, quoteNumber: 12, revision: 0, seriesYear: 2026, createdAt: new Date('2026-12-11T10:00:00Z') }),
];

const ESCALARES = new Set(['id', 'merchantId', 'quoteNumber', 'seriesYear', 'revision', 'teamMemberId', 'jobId']);

/** ¿Casa esta fila con este `where`? Lo que no se sabe evaluar LANZA. */
function casa(f, where) {
  for (const [clave, valor] of Object.entries(where)) {
    if (valor === undefined) continue;                               // Prisma ignora una clave `undefined`
    if (clave === 'OR') {
      assert.ok(Array.isArray(valor), '🔴 DOBLE CIEGO: un OR que no es una lista');
      if (!valor.some((w) => casa(f, w))) return false;
    } else if (clave === 'AND') {
      assert.ok(Array.isArray(valor), '🔴 DOBLE CIEGO: un AND que no es una lista');
      if (!valor.every((w) => casa(f, w))) return false;
    } else if (clave === 'asignados') {
      assert.deepEqual(Object.keys(valor), ['some'], `🔴 DOBLE CIEGO: no sé evaluar asignados: ${JSON.stringify(valor)}`);
      if (!f.asignados.some((x) => casa(x, valor.some))) return false;
    } else if (clave === 'createdAt') {
      assert.deepEqual(Object.keys(valor).sort(), ['gte', 'lt'], `🔴 DOBLE CIEGO: no sé evaluar createdAt: ${JSON.stringify(valor)}`);
      assert.ok(valor.gte instanceof Date && valor.lt instanceof Date && valor.gte < valor.lt, '🔴 DOBLE CIEGO: un tramo de fechas que no es un tramo');
      if (!(f.createdAt >= valor.gte && f.createdAt < valor.lt)) return false;
    } else if (ESCALARES.has(clave)) {
      assert.ok(clave in f, `🔴 DOBLE CIEGO: la fila no tiene \`${clave}\``);
      if (valor === null || typeof valor !== 'object') { if (f[clave] !== valor) return false; continue; }
      const forma = Object.keys(valor).sort().join(',');
      if (forma === 'in') { if (!valor.in.includes(f[clave])) return false; }
      else if (forma === 'not') { assert.equal(valor.not, null); if (f[clave] == null) return false; }
      else throw new Error(`🔴 DOBLE CIEGO: no sé evaluar ${clave}: ${JSON.stringify(valor)}`);
    } else {
      throw new Error(`🔴 DOBLE CIEGO: no sé evaluar la clave \`${clave}\` del where — amplía el doble, no la ignores`);
    }
  }
  return true;
}

let tabla = TABLA();
const creadas = [];   // el `data` de cada `quote.create`
const porRevision = (a, b) => a.revision - b.revision;

inyectarBase({
  'quote.findFirst': (args) => tabla.find((f) => casa(f, args.where)) ?? null,
  'quote.findMany': (args) => tabla.filter((f) => casa(f, args.where)).sort(porRevision),
  // El enlace público del detalle (`ensureQuoteDecisionToken`): no decide nada de lo que se mide.
  'quote.findUnique': (args) => (tabla.some((f) => f.id === args.where.id) ? { id: args.where.id, decisionToken: 'tok-de-prueba' } : null),
  'quote.create': (args) => { creadas.push(args.data); return { id: 999, ...args.data }; },
  'merchant.findUnique': (args) => ({ id: args.where.id, timezone: null, country: 'ES', flags: {}, trade: null }),
}, [
  '../dist/core/documentos/accesoALaFactura.js',
  '../dist/core/documentos/accesoAlPresupuesto.js',
  '../dist/modules/system/quoteAdmin.js',
  '../dist/modules/system/app/routes/quotesAdmin.routes.js',
]);
const { crearRevisionDeQuote } = moduloDeDist('../dist/modules/system/quoteAdmin.js');
const { wherePresupuestosVisibles } = moduloDeDist('../dist/core/documentos/accesoAlPresupuesto.js');
const { anioDeLaSerie } = moduloDeDist('../dist/core/documentos/grupoDelPresupuesto.js');
const { displayQuoteNumber, allocateQuoteNumber } = moduloDeDist('../dist/modules/quotes/domain/quoteNumber.service.js');
const { vistaDeRevisiones } = moduloDeDist('../dist/modules/quotes/domain/revision.js');
const routerDePresupuestos = moduloDeDist('../dist/modules/system/app/routes/quotesAdmin.routes.js').default;

/** `GET /admin/quotes/:id`, por el manejador real del router, con sesión de administrador. */
async function ficha(id) {
  const capa = routerDePresupuestos.stack.find((l) => l.route?.path === '/:id' && l.route.methods.get);
  assert.ok(capa, '🔴 CIEGO: no encuentro GET /:id en el router de presupuestos');
  let estado = 200;
  let cuerpo;
  const res = { status(c) { estado = c; return res; }, json(b) { cuerpo = b; return res; } };
  await capa.route.stack[capa.route.stack.length - 1].handle(
    reqDeSesion({ rol: 'admin', merchantId: NEGOCIO, teamMemberId: null, params: { id: String(id) }, query: {} }), res);
  return { estado, cuerpo };
}
const ids = (filas) => filas.map((f) => f.id).sort((a, b) => a - b);

test('SCRUM-1490 · CONTROL del doble: evalúa años, NULL y tramos de fecha, y lanza con lo que no conoce', () => {
  const t = TABLA();
  assert.deepEqual(ids(t.filter((f) => casa(f, { merchantId: NEGOCIO, quoteNumber: 12 }))), [1, 2, 3], 'por número a secas salen los dos «12» del negocio');
  assert.deepEqual(ids(t.filter((f) => casa(f, { seriesYear: null }))), [4, 5]);
  assert.deepEqual(ids(t.filter((f) => casa(f, { createdAt: { gte: new Date('2026-01-01T00:00:00Z'), lt: new Date('2027-01-01T00:00:00Z') } }))), [1, 4, 9]);
  assert.throws(() => casa(t[0], { inventada: 1 }), /DOBLE CIEGO/);
  assert.throws(() => casa(t[0], { quoteNumber: { gt: 3 } }), /DOBLE CIEGO/);
});

test('SCRUM-1490 · CONTROL del defecto: agrupando por {negocio, número}, la tabla de este banco LANZA «dos vigentes»', () => {
  // Los dos ORIGINALES solos, sin la revisión: es el caso que el 1-ene-2027 da 500.
  const grupoViejo = TABLA().filter((f) => f.id !== 2 && casa(f, { merchantId: NEGOCIO, quoteNumber: 12 }));
  assert.deepEqual(ids(grupoViejo), [1, 3]);
  const comoFila = (q) => ({ id: q.id, numero: '12', revision: q.revision, firmado: false });
  assert.throws(() => vistaDeRevisiones(comoFila(grupoViejo[0]), grupoViejo.map(comoFila)), { name: 'RevisionesAmbiguas' },
    '🔴 el banco no reproduce el defecto: si agrupar por número no lanza aquí, los verdes de abajo no dicen nada');
});

test('SCRUM-1490 · 🔴 aceptación 4: con el 12 de 2026 y el 12 de 2027, GET /admin/quotes/:id da 200 para los dos y cada uno ve SÓLO su grupo', async () => {
  // Primero los dos originales SOLOS, que es el caso que lanzaba; después, con la revisión de enero
  // (ahí no lanzaba: el 12 de 2027 enseñaba como vigente la `.1` del 12 de 2026).
  tabla = TABLA().filter((f) => f.id !== 2);
  for (const [id, grupo] of [[1, [1]], [3, [3]]]) {
    const { estado, cuerpo } = await ficha(id);
    assert.equal(estado, 200, `🔴 con los dos originales solos, la ficha del presupuesto ${id} contestó ${estado}: ${JSON.stringify(cuerpo)}`);
    assert.deepEqual(ids((cuerpo.quote ?? cuerpo).revisiones), grupo);
  }
  tabla = TABLA();
  const esperado = [[1, [1, 2]], [2, [1, 2]], [3, [3]]];
  for (const [id, grupo] of esperado) {
    const { estado, cuerpo } = await ficha(id);
    assert.equal(estado, 200, `🔴 la ficha del presupuesto ${id} contestó ${estado}: ${JSON.stringify(cuerpo)}`);
    const detalle = cuerpo.quote ?? cuerpo;
    assert.ok(Array.isArray(detalle.revisiones), `🔴 CIEGO: la ficha de ${id} no trae \`revisiones\`: ${Object.keys(detalle).join(',')}`);
    assert.deepEqual(ids(detalle.revisiones), grupo, `🔴 el presupuesto ${id} ve un grupo que no es el suyo`);
  }
});

test('SCRUM-1490 · una fila ANTERIOR a la columna se agrupa por el año de su `createdAt`: el 7 de 2026 no ve el 7 de 2025', async () => {
  tabla = TABLA();
  for (const [id, grupo] of [[4, [4]], [5, [5]]]) {
    const { estado, cuerpo } = await ficha(id);
    assert.equal(estado, 200, `🔴 la ficha del presupuesto ${id} contestó ${estado}: ${JSON.stringify(cuerpo)}`);
    assert.deepEqual(ids((cuerpo.quote ?? cuerpo).revisiones), grupo);
  }
});

test('SCRUM-1490 · 🔴 aceptación 3: la revisión creada en ENERO de un original de DICIEMBRE guarda el año de su original', async (t) => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2027-01-15T10:00:00Z') });
  t.after(() => mock.timers.reset());
  assert.equal(new Date().getUTCFullYear(), 2027, '🔴 CIEGO: el reloj del test no está en enero de 2027');

  tabla = TABLA();
  creadas.length = 0;
  const deLaDe2026 = await crearRevisionDeQuote(NEGOCIO, 1);
  assert.equal(creadas.length, 1, '🔴 CIEGO: no se ha creado ninguna fila');
  assert.equal(creadas[0].seriesYear, 2026, '🔴 la revisión guarda el año del reloj (o ninguno), no el de su original');
  assert.equal(creadas[0].quoteNumber, 12);
  assert.equal(creadas[0].revision, 2, '🔴 la siguiente revisión del 12 de 2026 es la .2: su grupo son la 0 y la 1, sin el 12 de 2027');
  assert.equal(deLaDe2026.origenId, 2, 'se revisa la VIGENTE de su grupo');
  assert.ok(!('createdAt' in creadas[0]), 'la fecha de la fila nueva la pone la base: no se arrastra la del original');

  creadas.length = 0;
  await crearRevisionDeQuote(NEGOCIO, 3);
  assert.deepEqual([creadas[0].seriesYear, creadas[0].quoteNumber, creadas[0].revision], [2027, 12, 1], 'el 12 de 2027 tiene su propia cuenta de revisiones');

  // Una fila vieja, sin año guardado: su revisión nace YA con el año del grupo.
  creadas.length = 0;
  await crearRevisionDeQuote(NEGOCIO, 4);
  assert.deepEqual([creadas[0].seriesYear, creadas[0].quoteNumber, creadas[0].revision], [2026, 7, 1]);
});

test('SCRUM-1490 · aceptación 3: quien reserva el número devuelve el AÑO de la serie, en la zona del negocio', async () => {
  const tx = {
    $executeRaw: async () => 1,
    merchant: {
      findUnique: async () => ({ id: NEGOCIO, nextQuoteNumber: 13, quoteSeriesYear: 2026, timezone: 'Europe/Madrid' }),
      update: async () => ({}),
    },
  };
  // 31-dic-2026 23:30Z ya es 1-ene-2027 en Madrid: serie nueva, número 1.
  const r = await allocateQuoteNumber(tx, NEGOCIO, new Date('2026-12-31T23:30:00Z'));
  assert.deepEqual([r.year, r.seq], [2027, 1]);
});

/** Todas las llamadas `….quote.create(…)` de `src/`, por AST (sin comentarios ni cadenas). */
function creacionesDePresupuesto() {
  const salida = [];
  let ficheros = 0;
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const ruta = path.join(dir, e.name);
      if (e.isDirectory()) { recorrer(ruta); continue; }
      if (!e.name.endsWith('.ts')) continue;
      ficheros += 1;
      const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true);
      const visitar = (nodo, funcion) => {
        const esFuncion = ts.isFunctionLike(nodo);
        if (ts.isCallExpression(nodo) && ts.isPropertyAccessExpression(nodo.expression)
            && nodo.expression.name.text === 'create'
            && ts.isPropertyAccessExpression(nodo.expression.expression)
            && nodo.expression.expression.name.text === 'quote') {
          const arg = nodo.arguments[0];
          const data = arg && ts.isObjectLiteralExpression(arg)
            ? arg.properties.find((p) => p.name && p.name.getText(sf) === 'data') : null;
          const literal = data && ts.isPropertyAssignment(data) && ts.isObjectLiteralExpression(data.initializer) ? data.initializer : null;
          // ¿La función que lo envuelve saca `year: seriesYear` de `allocateQuoteNumber`?
          let reservaConAnio = false;
          const buscar = (n) => {
            if (ts.isVariableDeclaration(n) && ts.isObjectBindingPattern(n.name) && n.initializer
                && /\ballocateQuoteNumber\s*\(/.test(n.initializer.getText(sf))) {
              reservaConAnio = reservaConAnio || n.name.elements.some((el) => el.propertyName?.getText(sf) === 'year' && el.name.getText(sf) === 'seriesYear');
            }
            ts.forEachChild(n, buscar);
          };
          if (funcion) buscar(funcion);
          salida.push({
            fichero: path.relative(RAIZ, ruta).replace(/\\/g, '/'),
            literal: literal != null,
            llevaAnio: literal != null && literal.properties.some((p) => p.name && p.name.getText(sf) === 'seriesYear'),
            reservaConAnio,
          });
        }
        ts.forEachChild(nodo, (h) => visitar(h, esFuncion ? nodo : funcion));
      };
      visitar(sf, null);
    }
  };
  recorrer(path.join(RAIZ, 'src'));
  return { salida, ficheros };
}

// El ÚNICO `quote.create` que no escribe un literal: la revisión, cuyo `data` sale de
// `nuevaRevisionDe`. Que ése guarda el año lo mide el test de la aceptación 3, ejecutándolo.
const CREA_SIN_LITERAL = ['src/modules/system/quoteAdmin.ts'];

test('SCRUM-1490 · 🔴 aceptación 3 (censo): TODO `quote.create` de src/ que numera guarda el año que le dio la reserva', () => {
  const { salida, ficheros } = creacionesDePresupuesto();
  assert.ok(ficheros > 100, `🔴 CIEGO: sólo he leído ${ficheros} ficheros de src/`);
  assert.ok(salida.length >= 4, `🔴 CIEGO: el censo ve ${salida.length} \`quote.create\` y el 7-oct-2026 había 4`);
  const sinLiteral = salida.filter((c) => !c.literal).map((c) => c.fichero);
  assert.deepEqual(sinLiteral, CREA_SIN_LITERAL, '🔴 hay un `quote.create` cuyo `data` no es un literal y no está declarado: no sé si guarda el año');
  const malos = salida.filter((c) => c.literal && !(c.llevaAnio && c.reservaConAnio)).map((c) => c.fichero);
  assert.deepEqual(malos, [], `🔴 de ${salida.length} \`quote.create\` (en ${ficheros} ficheros), éstos crean un presupuesto sin guardar el año de la reserva (\`const { seq: quoteNumber, year: seriesYear } = await allocateQuoteNumber(…)\`)`);
});

test('SCRUM-1490 · 🔴 aceptación 5: el recorte del Técnico le da el grupo de lo suyo y NO el mismo número de otro año', async () => {
  tabla = TABLA();
  const recorte = await wherePresupuestosVisibles({ merchantId: NEGOCIO, userRole: 'tecnico', teamMemberId: ANA });
  assert.ok(recorte && Array.isArray(recorte.OR), '🔴 CIEGO: la Técnica no lleva recorte');
  const ve = ids(tabla.filter((f) => casa(f, { merchantId: NEGOCIO, AND: [recorte] })));
  // Suyos: el 1 (autora) y el 4 (autora, fila vieja). El 2 es la revisión del 1, que no firma ella.
  assert.deepEqual(ve, [1, 2, 4], '🔴 ve el 3 (el 12 de 2027, de su compañero) o el 5 (el 7 de 2025), o ha dejado de ver la revisión de lo suyo');
  // Control: por número a secas, el recorte de antes SÍ le daba el 3 y el 5.
  const antes = { OR: [{ teamMemberId: ANA }, { quoteNumber: { in: [12, 7] } }] };
  assert.deepEqual(ids(tabla.filter((f) => casa(f, { merchantId: NEGOCIO, AND: [antes] }))), [1, 2, 3, 4, 5]);

  const deBlas = await wherePresupuestosVisibles({ merchantId: NEGOCIO, userRole: 'tecnico', teamMemberId: BLAS });
  assert.deepEqual(ids(tabla.filter((f) => casa(f, { merchantId: NEGOCIO, AND: [deBlas] }))), [3, 5]);
});

test('SCRUM-1490 · el año guardado manda al escribir la serie; sin él, el de `createdAt`; sin ninguno, LANZA', () => {
  const revisionDeEnero = { quoteNumber: 12, seriesYear: 2026, createdAt: new Date('2027-01-08T10:00:00Z') };
  assert.equal(displayQuoteNumber(revisionDeEnero), 'P260012', '🔴 la revisión de enero sale con la serie del año en que se creó');
  assert.equal(displayQuoteNumber({ quoteNumber: 12, createdAt: new Date('2026-12-10T10:00:00Z') }), 'P260012');
  assert.equal(anioDeLaSerie(revisionDeEnero), 2026);
  assert.equal(anioDeLaSerie({ seriesYear: null, createdAt: '2026-12-31T23:30:00Z' }, { timezone: 'Europe/Madrid' }), 2027, 'la fila vieja se lee en la zona del negocio, como se numeró');
  assert.equal(anioDeLaSerie({ seriesYear: null, createdAt: '2026-12-31T23:30:00Z' }, null), 2026);
  assert.throws(() => anioDeLaSerie({ seriesYear: null, createdAt: null }), /anio_de_la_serie_ilegible/);
});

test('SCRUM-1490 · el RELLENO: original por su fecha en Madrid, revisión por su único original, y lo dudoso se queda a NULL y se cuenta', () => {
  assert.equal(ZONA_DEL_RELLENO, 'Europe/Madrid');
  const f = (id, quoteNumber, revision, createdAt, extra = {}) => ({ id, merchantId: NEGOCIO, quoteNumber, revision, seriesYear: null, createdAt: new Date(createdAt), ...extra });
  const filas = [
    f(1, 12, 0, '2026-12-10T10:00:00Z'),
    f(2, 12, 1, '2027-01-08T10:00:00Z'),                       // revisión de enero: el año de su original
    f(3, null, 0, '2026-05-01T10:00:00Z'),                     // sin número: no tiene serie
    f(4, 20, 0, '2026-12-31T23:30:00Z'),                       // la hora en que Madrid y UTC discrepan
    f(5, 20, 1, '2027-01-02T10:00:00Z'),                       // su original no tiene año: no se adivina
    f(6, 30, 0, '2025-03-01T10:00:00Z'),
    f(7, 30, 0, '2026-03-01T10:00:00Z'),
    f(8, 30, 1, '2026-04-01T10:00:00Z'),                       // dos originales con ese número
    f(9, 40, 0, '2026-02-01T10:00:00Z', { seriesYear: 2026 }), // ya lo tenía
    f(10, 12, 1, '2026-12-12T10:00:00Z', { merchantId: OTRO_NEGOCIO }), // revisión sin original en SU negocio
  ];
  const plan = planDelRelleno(filas);
  assert.deepEqual(plan.rellenar, [
    { id: 1, seriesYear: 2026 }, { id: 6, seriesYear: 2025 }, { id: 7, seriesYear: 2026 }, { id: 2, seriesYear: 2026 },
  ]);
  assert.deepEqual(plan.sinAnio, [
    { id: 4, motivo: 'frontera_de_anio' },
    { id: 5, motivo: 'revision_sin_original' },
    { id: 8, motivo: 'revision_con_varios_originales' },
    { id: 10, motivo: 'revision_sin_original' },
  ]);
  assert.deepEqual(plan.poblacion, { filas: 10, sinNumero: 1, yaTenian: 1, rellenar: 4, sinAnio: 4 });
  assert.throws(() => planDelRelleno(undefined), /no he podido mirar/);
});
