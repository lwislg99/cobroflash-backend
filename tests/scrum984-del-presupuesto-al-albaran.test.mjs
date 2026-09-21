// tests/scrum984-del-presupuesto-al-albaran.test.mjs — SCRUM-984
//
// LA VÍCTIMA: un profesional con un presupuesto ACEPTADO delante que quiere el albarán de esa obra y
// no tiene camino desde esa pantalla (tenía que salir a Trabajos → ficha → «+ Nuevo albarán», o a
// Albaranes → «Nuevo albarán» → buscador). Ahora: un toque, y aterriza en la ficha del Trabajo con
// la hoja de alta ya abierta.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE FICHERO VIGILA, Y POR QUÉ CADA COSA
//
// ① EL SERVIDOR CONTESTA CON LA REGLA DEL BUSCADOR, NO CON `Quote.jobId` (el ticket lo proponía).
//    Un presupuesto es elegible ⇔ hay un Trabajo con `Job.quoteId` = él (ALB-01). Un ADICIONAL
//    cuelga por `Quote.jobId` pero su `quoteLineIndex` se valida contra las líneas del original:
//    ofrecerle el albarán prellenaría un enlace roto. El caso del adicional es el que decide.
// ② LA PANTALLA PINTA EL BOTÓN SOLO EN `accepted` Y SOLO SI HAY A DÓNDE IR. Sin a dónde ir NO se
//    pinta y NO se dice nada: no hay texto firmado que explique «este presupuesto no tiene
//    Trabajo» (los del buscador siguen con marcador), y un control que no puede explicarse se quita.
// ③ EL CLIC NO CREA NADA: navega con la MISMA llamada que ALB-01 y el alta sigue en su única puerta.
// ④ TABLA Y PANTALLA DICEN LO MISMO EN `accepted` (comentario 16063 del ticket: «la tabla dice una
//    cosa y la pantalla otra, y ningún guard las compara»): cada botón de la pantalla que declara
//    su fila (`data-accion`) existe en la tabla, en ese destino y con ese rótulo.
// ⑤ LA OPCIÓN R (firmada, comentario 16105): sale `btnCrearTrabajo`, entran `btnCobrar` y
//    `btnNuevoAlbaran`, `btnWhatsApp` pasa a «⋮», y la ley (una primaria, dos secundarias) sigue.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { soloCodigo } from './_solo-codigo.mjs';

const require = createRequire(import.meta.url);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const RUTA_DETALLE = path.join(RAIZ, 'src/modules/system/app/routes/quotesAdmin.routes.ts');
const VISTA = path.join(RAIZ, 'public/dashboard/js/quotesDetailView.js');
const REGISTRO = path.join(RAIZ, 'public/dashboard/js/quoteActionsRegistry.js');
const MICROCOPY = path.join(RAIZ, 'docs/microcopy/2026-09-21-SCRUM-984-del-presupuesto-al-albaran.md');

const { albaranOrigenDelPresupuesto } = await import(DIST + 'modules/jobs/domain/albaranOrigenDelPresupuesto.js');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① EL SERVIDOR
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Un cliente de doble que RESPETA el `where`: si la función no filtra por merchant o por
 * presupuesto, devuelve trabajos de otro y el test lo ve. Un doble que devolviera siempre lo mismo
 * dejaría pasar un `where` vacío.
 */
function clienteConTrabajos(tabla) {
  const consultas = [];
  return {
    consultas,
    job: {
      findMany: async (args) => {
        consultas.push(args);
        const w = args.where || {};
        return tabla.filter((j) => (w.merchantId === undefined || j.merchantId === w.merchantId)
          && (w.quoteId === undefined || j.quoteId === w.quoteId));
      },
    },
  };
}

const TRABAJOS = [
  { id: 70, merchantId: 7, quoteId: 501, operarioId: 11, assignedUserId: null, assignees: [] },
  { id: 71, merchantId: 7, quoteId: 502, operarioId: 12, assignedUserId: 13, assignees: [] },
  { id: 72, merchantId: 7, quoteId: 503, operarioId: null, assignedUserId: null, assignees: [{ teamMemberId: 14 }] },
  // Otro merchant con el MISMO quoteId que uno nuestro: solo un `where` sin merchant lo vería.
  { id: 90, merchantId: 8, quoteId: 504, operarioId: 11, assignedUserId: null, assignees: [] },
  // Un Trabajo sin presupuesto de origen (avería abierta directa): no es origen de nadie.
  { id: 73, merchantId: 7, quoteId: null, operarioId: null, assignedUserId: null, assignees: [] },
];

const pregunta = (o) => albaranOrigenDelPresupuesto(
  { merchantId: 7, quoteId: 501, number: 501, userRole: 'admin', teamMemberId: null, ...o },
  clienteConTrabajos(TRABAJOS),
);

test('SCRUM-984 · SUELO: el doble ve trabajos y filtra (sin esto los negativos no dicen nada)', async () => {
  const c = clienteConTrabajos(TRABAJOS);
  assert.equal((await c.job.findMany({ where: { merchantId: 7, quoteId: 501 } })).length, 1,
    '🔴 CIEGO: el doble no encuentra el Trabajo del presupuesto 501');
  assert.equal((await c.job.findMany({ where: { merchantId: 7 } })).length, 4, '🔴 CIEGO: el doble no filtra por merchant');
});

test('SCRUM-984 · un admin con Trabajo de origen: elegible y a QUÉ Trabajo', async () => {
  assert.deepEqual(await pregunta({ quoteId: 501 }), { elegible: true, jobId: 70, motivo: null });
});

test('SCRUM-984 · 🔴 el ADICIONAL no es elegible: `Quote.jobId` no es el ancla, `Job.quoteId` sí', async () => {
  // Un adicional (SCRUM-195) cuelga del Trabajo del original por `Quote.jobId`, pero ningún Trabajo
  // lo tiene por `quoteId`. Con la lectura del ticket (`Quote.jobId`) saldría elegible y su albarán
  // prellenaría índices contra las líneas del ORIGINAL. Con la regla del buscador, no hay origen.
  const r = await pregunta({ quoteId: 999, number: 999 });
  assert.deepEqual(r, { elegible: false, jobId: null, motivo: 'sin_trabajo' },
    '🔴 un presupuesto sin Trabajo que lo tenga por origen salió elegible: el albarán se enlazaría a otro presupuesto');
});

test('SCRUM-984 · 🔴 multi-tenant: el Trabajo de OTRO merchant no cuenta (regla 2)', async () => {
  const c = clienteConTrabajos(TRABAJOS);
  const r = await albaranOrigenDelPresupuesto(
    { merchantId: 7, quoteId: 504, number: 504, userRole: 'admin', teamMemberId: null }, c);
  assert.deepEqual(r, { elegible: false, jobId: null, motivo: 'sin_trabajo' },
    '🔴 el detalle de un presupuesto de un merchant ofreció el Trabajo de otro');
  assert.equal(c.consultas.length, 1, '🔴 CIEGO: no consultó exactamente una vez');
  assert.equal(c.consultas[0].where.merchantId, 7, '🔴 la lectura no filtra por merchant');
  assert.equal(c.consultas[0].where.quoteId, 504, '🔴 la lectura no filtra por presupuesto');
});

test('SCRUM-984 · el técnico solo aterriza en SUS Trabajos (los tres ejes de SCRUM-467/650)', async () => {
  const tecnico = (quoteId, teamMemberId) => pregunta({ quoteId, number: quoteId, userRole: 'tecnico', teamMemberId });
  // dueño por autoría (`operarioId`), por asignación (`assignedUserId`) y por la tabla de asignados
  assert.equal((await tecnico(501, 11)).elegible, true, '🔴 el técnico que creó el Trabajo no puede abrir su albarán');
  assert.equal((await tecnico(502, 13)).elegible, true, '🔴 el técnico asignado (assignedUserId) no puede');
  assert.equal((await tecnico(503, 14)).elegible, true, '🔴 el técnico asignado por la tabla no puede');
  // ajeno: existe el Trabajo, no es suyo → NO se enseña ni su id
  assert.deepEqual(await tecnico(501, 99), { elegible: false, jobId: null, motivo: 'trabajo_no_visible' },
    '🔴 un técnico ajeno recibió el Trabajo de otro (o su id)');
  // sin identidad: NO se compara null === null (un Trabajo sin operario haría dueño a cualquiera)
  assert.equal((await tecnico(503, null)).elegible, false, '🔴 un técnico sin identidad salió dueño');
  assert.equal((await pregunta({ quoteId: 502, number: 502, userRole: undefined, teamMemberId: null })).elegible, false,
    '🔴 un rol desconocido se trató como admin');
});

test('SCRUM-984 · la ruta del detalle CABLEA la función y viaja `albaranOrigen` en el cuerpo (por AST)', () => {
  const src = fs.readFileSync(RUTA_DETALLE, 'utf8');
  const sf = ts.createSourceFile('quotesAdmin.routes.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  let get = null;
  (function visitar(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'get' && n.expression.expression.getText(sf) === 'router'
      && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0]) && n.arguments[0].text === '/:id') get = n;
    ts.forEachChild(n, visitar);
  })(sf);
  assert.ok(get, '🔴 CIEGO: no encuentro router.get(\'/:id\') en quotesAdmin.routes.ts');

  let llamada = null;
  let cuerpo = null;
  (function visitar(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'albaranOrigenDelPresupuesto') llamada = n;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'cuerpo'
      && n.initializer && ts.isObjectLiteralExpression(n.initializer)) cuerpo = n.initializer;
    ts.forEachChild(n, visitar);
  })(get);

  assert.ok(llamada, '🔴 el GET del detalle ya no llama a albaranOrigenDelPresupuesto: la pantalla no sabe a dónde ir');
  const arg = llamada.arguments[0];
  assert.ok(arg && ts.isObjectLiteralExpression(arg), '🔴 CIEGO: la llamada no recibe un objeto de datos');
  const props = new Map(arg.properties.filter(ts.isPropertyAssignment).map((p) => [p.name.getText(sf), p.initializer.getText(sf)]));
  assert.match(props.get('merchantId') || '', /req\.merchantId/, '🔴 no pasa el merchant de la petición (regla 2)');
  assert.equal(props.get('quoteId'), 'id', '🔴 no pasa el id del presupuesto pedido');
  assert.match(props.get('userRole') || '', /req\.userRole/, '🔴 no pasa el rol: un técnico se vería como admin, o al revés');
  assert.match(props.get('teamMemberId') || '', /req\.teamMemberId/, '🔴 no pasa la identidad del técnico');
  assert.ok(props.has('number'), '🔴 no pasa el número visible del presupuesto');

  assert.ok(cuerpo, '🔴 CIEGO: no encuentro el `cuerpo` de la respuesta del detalle');
  const miembros = cuerpo.properties.map((p) => p.getText(sf));
  assert.ok(miembros.some((t) => t.includes('albaranOrigen')),
    `🔴 el cuerpo del detalle no lleva \`albaranOrigen\` (lleva: ${miembros.join(', ')})`);

  // La lectura es una AYUDA de la pantalla y va en SU PROPIO try: el más cercano a la llamada no puede
  // ser el del handler entero (que responde 500), o un fallo de esta lectura se llevaría el detalle.
  let t = llamada.parent;
  while (t && !ts.isTryStatement(t)) t = t.parent;
  assert.ok(t && t.catchClause, '🔴 la lectura de `albaranOrigen` no está dentro de ningún try/catch');
  const captura = t.catchClause.getText(sf);
  assert.match(captura, /albaranOrigen/, '🔴 el try más cercano no es el propio de `albaranOrigen`: es el del handler entero');
  assert.doesNotMatch(captura, /res\s*\.\s*(status|json)|\breturn\b/,
    '🔴 el catch de `albaranOrigen` responde o devuelve: un fallo de esta lectura tumbaría el detalle entero');

  assert.match(src, /import \{ albaranOrigenDelPresupuesto(, type AlbaranOrigen)? \} from '\.\.\/\.\.\/\.\.\/jobs\/domain\/albaranOrigenDelPresupuesto'/,
    '🔴 la ruta ya no importa la función del dominio');
});

// ── LA RUTA DE VERDAD, con doble de `prisma` (patrón de scrum892): el handler entero se ejecuta ──

const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const ID_RUTA = 99984001;

async function invocarDetalle(req) {
  const modulo = await import(DIST + 'modules/system/app/routes/quotesAdmin.routes.js');
  const router = modulo.default?.default ?? modulo.default;
  assert.ok(Array.isArray(router?.stack), '🔴 CIEGO: no se pudo leer el router de quotesAdmin.routes');
  const capa = router.stack.find((l) => l.route?.path === '/:id' && l.route?.methods?.get);
  assert.ok(capa, '🔴 CIEGO: no existe GET /:id en quotesAdmin.routes: el test no estaría invocando nada');
  let salida = null;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    send(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    setHeader() { return this; },
    type() { return this; },
  };
  const handlers = capa.route.stack;
  await handlers[handlers.length - 1].handle(req, res, () => {});
  return salida;
}

/** El detalle por la ruta real. `trabajos` es lo que hay en la tabla de Trabajos; el doble respeta el `where`. */
// `userRole` por defecto 'admin': es el que emite `requireAuth` para el propietario (`owner` es un
// pseudo-rol de las métricas y `seesAllJobs` lo trata, con razón, como desconocido → fail-closed).
async function detalleRealDe({ trabajos = [], userRole = 'admin', teamMemberId = null, fallaLaLecturaDeTrabajos = false } = {}) {
  const quote = {
    id: ID_RUTA, quoteNumber: 7, merchantId: 7, customerId: 2, status: 'accepted', currency: 'EUR', total: 590,
    lines: [{ concept: 'Cuadro eléctrico', qty: 1, price: 590, tax: 0 }], tiers: null,
    paymentTerms: 'MANUAL', decisionToken: 'a'.repeat(32), Invoice: [], validUntil: null,
    merchant: { id: 7, name: 'QA', country: 'ES' }, customer: { id: 2, name: 'Cliente QA' },
    signatureUrl: null, charge: null, billingPlan: null, customBillingPlan: null, discountGlobalAmount: null, revision: 0,
  };
  // Lo que no es el presupuesto ni el Trabajo responde VACÍO (null / [] / 0): aquí solo se mira el origen.
  const modelo = (propio = {}) => new Proxy(propio, {
    get: (o, k) => (k in o ? o[k] : async () => (String(k) === 'findMany' ? [] : String(k) === 'count' ? 0 : null)),
  });
  moduloPrisma.prisma.quote = modelo({ findFirst: async () => quote, findUnique: async () => quote, findMany: async () => [quote] });
  for (const m of ['whatsAppMessage', 'merchant', 'maintenancePlan', 'quoteAssignee']) moduloPrisma.prisma[m] = modelo();
  const consultas = [];
  moduloPrisma.prisma.job = {
    findMany: async (args) => {
      consultas.push(args);
      if (fallaLaLecturaDeTrabajos) throw new Error('bd caida (simulada)');
      const w = args.where || {};
      return trabajos.filter((j) => (w.merchantId === undefined || j.merchantId === w.merchantId)
        && (w.quoteId === undefined || j.quoteId === w.quoteId));
    },
  };
  const respuesta = await invocarDetalle({
    params: { id: String(ID_RUTA) }, merchantId: 7, userRole, teamMemberId, query: {}, headers: {},
  });
  return { respuesta, consultas };
}

const TRABAJO_DE_LA_RUTA = { id: 70, merchantId: 7, quoteId: ID_RUTA, operarioId: 11, assignedUserId: null, assignees: [] };

test('SCRUM-984 · 🔴 LA RUTA: el detalle de un aceptado con Trabajo de origen trae `albaranOrigen` con su Trabajo', async () => {
  const { respuesta, consultas } = await detalleRealDe({ trabajos: [TRABAJO_DE_LA_RUTA] });
  assert.equal(respuesta?.code, 200, `🔴 el detalle no respondió 200: ${JSON.stringify(respuesta?.body).slice(0, 200)}`);
  assert.equal(respuesta.body.id, ID_RUTA, '🔴 CIEGO: no es el presupuesto pedido');
  assert.deepEqual(respuesta.body.albaranOrigen, { elegible: true, jobId: 70, motivo: null });
  // Regla 2, ejecutada y no leída: la lectura sale con el merchant de la petición y el presupuesto pedido.
  assert.equal(consultas.length, 1, '🔴 la ruta debe leer los Trabajos exactamente una vez');
  assert.equal(consultas[0].where.merchantId, 7, '🔴 la lectura de Trabajos no filtra por el merchant de la petición');
  assert.equal(consultas[0].where.quoteId, ID_RUTA, '🔴 la lectura de Trabajos no filtra por el presupuesto pedido');
});

test('SCRUM-984 · LA RUTA: sin Trabajo de origen → `elegible: false` y el motivo, no un campo ausente', async () => {
  const { respuesta } = await detalleRealDe({ trabajos: [] });
  assert.equal(respuesta?.code, 200);
  assert.deepEqual(respuesta.body.albaranOrigen, { elegible: false, jobId: null, motivo: 'sin_trabajo' });
});

test('SCRUM-984 · LA RUTA: un técnico recibe SU Trabajo, y el de otro llega sin id', async () => {
  const suyo = await detalleRealDe({ trabajos: [TRABAJO_DE_LA_RUTA], userRole: 'tecnico', teamMemberId: 11 });
  assert.deepEqual(suyo.respuesta.body.albaranOrigen, { elegible: true, jobId: 70, motivo: null });
  const ajeno = await detalleRealDe({ trabajos: [TRABAJO_DE_LA_RUTA], userRole: 'tecnico', teamMemberId: 99 });
  assert.equal(ajeno.respuesta?.code, 200);
  assert.deepEqual(ajeno.respuesta.body.albaranOrigen, { elegible: false, jobId: null, motivo: 'trabajo_no_visible' },
    '🔴 la ruta no pasa el rol o la identidad: un técnico ajeno recibió el Trabajo de otro');
});

test('SCRUM-984 · 🔴 LA RUTA: si la lectura de Trabajos FALLA, el detalle SIGUE saliendo (sin el campo)', async () => {
  const errores = [];
  const consolaOriginal = console.error;
  console.error = (...a) => { errores.push(a.map(String).join(' ')); };
  let salida;
  try { salida = await detalleRealDe({ fallaLaLecturaDeTrabajos: true }); } finally { console.error = consolaOriginal; }
  assert.equal(salida.respuesta?.code, 200,
    `🔴 una lectura opcional caída tumbó el detalle entero: ${JSON.stringify(salida.respuesta?.body).slice(0, 160)}`);
  assert.equal(salida.respuesta.body.id, ID_RUTA, '🔴 CIEGO: el detalle que salió no es el pedido');
  assert.equal(Object.prototype.hasOwnProperty.call(salida.respuesta.body, 'albaranOrigen'), false,
    '🔴 el detalle dice algo del origen habiendo fallado la lectura');
  assert.equal(salida.consultas.length, 1, '🔴 CIEGO: la lectura que se hizo fallar no llegó a intentarse');
  assert.ok(errores.some((e) => /albaranOrigen/.test(e)), '🔴 el fallo no se registró: quedaría mudo');
});

test('SCRUM-984 · el dominio contesta con la función del buscador y NO lee `Quote.jobId`', () => {
  const dominio = soloCodigo(fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/domain/albaranOrigenDelPresupuesto.ts'), 'utf8'), 'x.ts');
  assert.match(dominio, /filasParaElegirPresupuesto\(/, '🔴 el detalle ya no usa la regla del buscador: pueden discrepar');
  assert.match(dominio, /esSuyoElTrabajo\(/, '🔴 la tenencia del técnico ya no sale de la fuente de SCRUM-849');
  assert.match(dominio, /\.job\s*\.\s*findMany\(/, '🔴 CIEGO: el dominio ya no pregunta a los Trabajos');
  assert.equal(/\.quote\b/.test(dominio), false,
    '🔴 el dominio lee de `Quote` (`Quote.jobId`): el ancla es `Job.quoteId`, la misma que el buscador');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ②③④ LA PANTALLA
// ═════════════════════════════════════════════════════════════════════════════════════════════

const presupuesto = (extra = {}) => ({
  id: 1, number: 1, quoteNumber: 1, revision: 0, numeroConRevision: 'P1', revisiones: [], vigenteId: 1,
  status: 'accepted', total: '100.00', currency: 'EUR', payToken: 'tok1',
  lines: [{ concept: 'Punto de luz', qty: 2, price: 50, tax: 0.21 }],
  createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z',
  customer: { id: 3, name: 'Ana Ruiz', phone: '34600000000', email: null, notes: null },
  merchant: { id: 7, name: 'QA 984', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: '2026-09-20T10:00:00.000Z', rejectedAt: null, decisionChannel: 'backoffice', decisionComment: null, rejectionReason: null, paymentTerms: 'FULL_UPFRONT', evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
  ...extra,
});

const ORIGEN_OK = { elegible: true, jobId: 77, motivo: null };
const ORIGEN_SIN = { elegible: false, jobId: null, motivo: 'sin_trabajo' };

/** Monta la ficha del presupuesto como la monta el navegador y devuelve lo medido. */
async function montar(quote) {
  const llamadas = [];
  const navegaciones = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url, opts) => {
      llamadas.push({ url: String(url), method: (opts && opts.method) || 'GET' });
      if (/\/admin\/quotes\/1$/.test(String(url))) return quote;
      return [];
    },
  });
  banco.ctx.renderAppView = (vista, args) => { navegaciones.push({ vista, args }); };
  const r = await pintarVista(banco, 'renderQuoteDetailView', 1);
  const nodos = r.contenedor ? todos(r.contenedor) : [];
  const accion = (id) => nodos.filter((n) => n.getAttribute && n.getAttribute('data-accion') === id);
  const textoTodo = nodos.map((n) => String(n.textContent || '')).join(' | ');
  return { banco, r, nodos, llamadas, navegaciones, accion, textoTodo };
}

const sinEmoji = (t) => String(t).replace(/^[^\p{L}]+/u, '').trim();

test('SCRUM-984 · SUELO: la ficha monta, y en `accepted` sin cobrar pinta «Cobrar ahora» (el control positivo)', async () => {
  const m = await montar(presupuesto({ albaranOrigen: ORIGEN_OK }));
  assert.equal(m.r.error, null, `🔴 la ficha revienta: ${m.r.error && m.r.error.message}`);
  assert.ok(m.nodos.length > 60, `🔴 CIEGO: la ficha montó ${m.nodos.length} nodos; no es la pantalla entera`);
  assert.equal(m.accion('btnCobrar').length, 1,
    '🔴 CIEGO: no veo «Cobrar ahora»; sin verlo, «el botón nuevo no se pinta» podría ser «la sección no se pinta»');
  assert.match(m.textoTodo, /Siguiente paso/, '🔴 CIEGO: no veo el bloque «Siguiente paso»');
});

test('SCRUM-984 · 🔴 con Trabajo de origen: UN botón «Nuevo albarán», secundario, con el rótulo firmado', async () => {
  const m = await montar(presupuesto({ albaranOrigen: ORIGEN_OK }));
  const botones = m.accion('btnNuevoAlbaran');
  assert.equal(botones.length, 1, `🔴 debe haber UN botón «Nuevo albarán» en el presupuesto aceptado; hay ${botones.length}`);
  assert.equal(botones[0].textContent, 'Nuevo albarán',
    '🔴 el rótulo no es el firmado en SCRUM-722 (`atajoNuevo`, «Nuevo albarán»)');
  assert.equal(botones[0].textContent, m.banco.ctx.atajoNuevo.textoDe('albaranes'),
    '🔴 el rótulo no sale de su fuente única: un renombre allí no llegaría aquí');
  assert.match(String(botones[0].className), /btn-secondary/, '🔴 el albarán debe ser SECUNDARIA: la primaria es cobrar');
  assert.doesNotMatch(String(botones[0].className), /btn-primary/, '🔴 dos primarias compiten por el mismo hueco');
});

test('SCRUM-984 · 🔴 el toque navega con LA MISMA llamada que ALB-01 y no crea ni pide nada', async () => {
  const m = await montar(presupuesto({ albaranOrigen: ORIGEN_OK }));
  const [boton] = m.accion('btnNuevoAlbaran');
  assert.ok(boton, '🔴 CIEGO: no hay botón que pulsar');
  const antes = m.llamadas.length;
  boton.click();
  // Por JSON: los objetos nacen dentro del `vm` del banco y `deepEqual` estricto compara prototipos
  // de OTRO contexto (mismo contenido, distinto `Object.prototype`).
  assert.deepEqual(JSON.parse(JSON.stringify(m.navegaciones)),
    [{ vista: 'jobs-detail', args: { jobId: 77, altaAlbaran: { quoteId: 1 } } }],
    '🔴 el clic no llama a renderAppView(\'jobs-detail\', { jobId, altaAlbaran: { quoteId } }) — la llamada de albaranesView.js:150');
  assert.equal(m.llamadas.length, antes, '🔴 el clic hizo una petición: aquí no se crea ni se lee nada, se navega');
  assert.equal(m.llamadas.filter((c) => c.method !== 'GET').length, 0, '🔴 hubo una escritura al montar o pulsar');
});

test('SCRUM-984 · 🔴 sin Trabajo de origen el botón NO SE PINTA y no se dice nada (canon SCRUM-823)', async () => {
  const m = await montar(presupuesto({ albaranOrigen: ORIGEN_SIN }));
  assert.equal(m.r.error, null, `🔴 la ficha revienta: ${m.r.error && m.r.error.message}`);
  assert.equal(m.accion('btnNuevoAlbaran').length, 0, '🔴 el botón se pinta sin Trabajo al que ir');
  // Y la sección SIGUE pintándose: «no se ve» no puede ser «no se pinta nada».
  assert.equal(m.accion('btnCobrar').length, 1, '🔴 la ficha dejó de pintar el siguiente paso');
  // Ningún texto inventado ni con marcador para tapar el hueco (regla 30).
  assert.doesNotMatch(m.textoTodo, /PENDIENTE microcopy oficial/, '🔴 se coló un texto sin firmar');
  assert.doesNotMatch(m.textoTodo, /albar[aá]n/i, '🔴 la ficha habla de albaranes sin tener a dónde ir');
});

test('SCRUM-984 · sin `albaranOrigen` (respuesta de un servidor viejo) no hay botón y no revienta', async () => {
  const m = await montar(presupuesto());
  assert.equal(m.r.error, null, `🔴 la ficha revienta sin el campo nuevo: ${m.r.error && m.r.error.message}`);
  assert.equal(m.accion('btnNuevoAlbaran').length, 0, '🔴 el botón se pinta sin que el servidor lo haya dicho');
  assert.equal(m.accion('btnCobrar').length, 1, '🔴 CIEGO: la ficha no pintó el siguiente paso');
});

test('SCRUM-984 · un elegible con `jobId` nulo no pinta el botón (no se navega a ninguna parte)', async () => {
  const m = await montar(presupuesto({ albaranOrigen: { elegible: true, jobId: null, motivo: null } }));
  assert.equal(m.accion('btnNuevoAlbaran').length, 0, '🔴 el botón se pinta sin Trabajo al que ir');
});

test('SCRUM-984 · 🔴 una respuesta que se contradice (`elegible: false` CON `jobId`) falla CERRADA: sin botón', async () => {
  // El servidor no la produce (`jobId` nulo ⇔ no elegible: `filasParaElegirPresupuesto`), y por eso
  // no la cubre ningún otro caso: `jobId != null` enmascararía que la pantalla dejara de mirar
  // `elegible`. Un técnico ajeno recibe `trabajo_no_visible` SIN id; si algún día el id viajara, la
  // pantalla no puede ofrecerle el Trabajo de otro.
  const m = await montar(presupuesto({ albaranOrigen: { elegible: false, jobId: 77, motivo: 'trabajo_no_visible' } }));
  assert.equal(m.r.error, null, `🔴 la ficha revienta: ${m.r.error && m.r.error.message}`);
  assert.equal(m.accion('btnNuevoAlbaran').length, 0, '🔴 la pantalla ofrece el Trabajo de una respuesta que dice «no elegible»');
  assert.equal(m.accion('btnCobrar').length, 1, '🔴 CIEGO: la ficha no pintó el siguiente paso');
});

test('SCRUM-984 · 🔴 SOLO en `accepted`: en los demás estados no aparece aunque el servidor diga que sí', async () => {
  const estados = ['draft', 'pending_approval', 'sent', 'rejected', 'expired'];
  for (const status of estados) {
    const m = await montar(presupuesto({ status, albaranOrigen: ORIGEN_OK }));
    assert.equal(m.r.error, null, `🔴 la ficha en «${status}» revienta: ${m.r.error && m.r.error.message}`);
    assert.ok(m.nodos.length > 40, `🔴 CIEGO: la ficha en «${status}» montó ${m.nodos.length} nodos`);
    assert.equal(m.accion('btnNuevoAlbaran').length, 0, `🔴 «Nuevo albarán» aparece en «${status}»`);
  }
  // El positivo del bucle: en `accepted` SÍ. Sin él, el bucle de arriba pasa también con el botón borrado.
  assert.equal((await montar(presupuesto({ albaranOrigen: ORIGEN_OK }))).accion('btnNuevoAlbaran').length, 1,
    '🔴 CIEGO: en `accepted` tampoco aparece; los cinco negativos no prueban nada');
});

test('SCRUM-984 · con cobro pendiente o cobrado el albarán SIGUE ahí (es de la obra, no del cobro)', async () => {
  for (const estadoFactura of ['pending', 'paid']) {
    const m = await montar(presupuesto({
      albaranOrigen: ORIGEN_OK,
      invoices: [{ id: 5, number: 'F-1', total: '100.00', currency: 'EUR', status: estadoFactura, pdfUrl: null, createdAt: '2026-09-20T10:00:00.000Z' }],
    }));
    assert.equal(m.r.error, null, `🔴 la ficha con factura «${estadoFactura}» revienta: ${m.r.error && m.r.error.message}`);
    assert.equal(m.accion('btnNuevoAlbaran').length, 1,
      `🔴 con una factura «${estadoFactura}» el botón del albarán desaparece: el albarán no depende del cobro`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ TABLA Y PANTALLA
// ═════════════════════════════════════════════════════════════════════════════════════════════

const { QUOTE_ACTION_REGISTRY, QUOTE_STATES, QUOTE_ACTION_ROTULOS } = require(REGISTRO);
const { incumplimientosDeLaLey } = require(path.join(RAIZ, 'public/dashboard/js/patronDetalleAcciones.js'));

test('SCRUM-984 · 🔴 TABLA = PANTALLA en `accepted`: cada botón que declara su fila está en la tabla, en su destino y con su rótulo', async () => {
  const m = await montar(presupuesto({ albaranOrigen: ORIGEN_OK }));
  const declarados = m.nodos.filter((n) => n.getAttribute && n.getAttribute('data-accion'));
  // SUELO: la pantalla declara AL MENOS los dos botones de este ticket; con cero, el bucle no compara nada.
  assert.ok(declarados.length >= 2, `🔴 CIEGO: la pantalla declara ${declarados.length} botones con su fila`);

  const destino = (id) => (QUOTE_ACTION_REGISTRY.find((a) => a.id === id) || { destinos: {} }).destinos.accepted;
  const claseDe = { primaria: /btn-primary/, secundaria: /btn-secondary/ };
  for (const n of declarados) {
    const id = n.getAttribute('data-accion');
    const d = destino(id);
    assert.ok(d && d !== 'oculta', `🔴 la pantalla pinta \`${id}\` en accepted y la tabla lo tiene «${d}»`);
    assert.ok(Object.prototype.hasOwnProperty.call(claseDe, d),
      `🔴 \`${id}\` está en «${d}» en la tabla y la pantalla lo pinta como botón visible`);
    assert.match(String(n.className), claseDe[d], `🔴 \`${id}\` es «${d}» en la tabla y su clase en pantalla es «${n.className}»`);
    assert.equal(sinEmoji(n.textContent), QUOTE_ACTION_ROTULOS[id],
      `🔴 el rótulo de \`${id}\` en pantalla («${n.textContent}») no es el de la tabla («${QUOTE_ACTION_ROTULOS[id]}»)`);
  }
  // Y lo que la tabla declara PRIMARIA en accepted es lo que la pantalla ofrece como primaria.
  const primariasTabla = QUOTE_ACTION_REGISTRY.filter((a) => a.destinos.accepted === 'primaria').map((a) => a.id);
  assert.deepEqual(primariasTabla, ['btnCobrar'], '🔴 la primaria de `accepted` en la tabla no es «Cobrar ahora»');
  assert.equal(m.accion('btnCobrar').length, 1, '🔴 la primaria de la tabla no está en la pantalla');
  assert.match(String(m.accion('btnCobrar')[0].className), /btn-primary/, '🔴 «Cobrar ahora» no es la primaria en pantalla');
});

test('SCRUM-984 · la columna `accepted` de la tabla es EXACTAMENTE la firmada (y lo que la pantalla no ofrece, declarado)', () => {
  // Lo que la pantalla NO ofrece hoy en `accepted` y la tabla sí declara (Descargar PDF con otro
  // rótulo, Duplicar en la cabecera…) es divergencia PREVIA que este ticket no resuelve: se DECLARA
  // aquí para que crezca a la vista y no en silencio. Cada una necesita una decisión de producto.
  const enTabla = QUOTE_ACTION_REGISTRY.filter((a) => a.destinos.accepted !== 'oculta').map((a) => `${a.id}:${a.destinos.accepted}`);
  assert.deepEqual(enTabla, [
    'btnCobrar:primaria',
    'btnDuplicar:overflow',
    'btnPdf:secundaria',
    'btnWhatsApp:overflow',
    'btnNuevoAlbaran:secundaria',
    'btnVerCliente:overflow',
  ], '🔴 cambió lo que la tabla declara para `accepted`: si es a propósito, actualiza esta lista y el expediente');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ LA OPCIÓN R
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-984 · 🔴 `btnCrearTrabajo` YA NO existe: ni en la tabla ni en los rótulos', () => {
  assert.equal(QUOTE_ACTION_REGISTRY.some((a) => a.id === 'btnCrearTrabajo'), false,
    '🔴 `btnCrearTrabajo` sigue en la tabla: «Crear trabajo» no describe nada que la pantalla haga (el Trabajo nace al aceptar)');
  assert.equal(Object.prototype.hasOwnProperty.call(QUOTE_ACTION_ROTULOS, 'btnCrearTrabajo'), false,
    '🔴 `btnCrearTrabajo` sigue en los rótulos');
  assert.doesNotMatch(fs.readFileSync(REGISTRO, 'utf8'), /Es el único sitio donde nace el Trabajo/,
    '🔴 sigue el comentario caducado «el único sitio donde nace el Trabajo» (nace en `ensureJobForQuote` desde el 5-jul)');
});

test('SCRUM-984 · 🔴 la opción R, tal cual la firmó el orquestador (comentario 16105)', () => {
  const de = (id) => QUOTE_ACTION_REGISTRY.find((a) => a.id === id);
  assert.ok(de('btnCobrar') && de('btnNuevoAlbaran') && de('btnWhatsApp'), '🔴 CIEGO: faltan filas en la tabla');
  assert.equal(de('btnCobrar').destinos.accepted, 'primaria', '🔴 `btnCobrar` no es la primaria de `accepted`');
  assert.equal(de('btnNuevoAlbaran').destinos.accepted, 'secundaria', '🔴 `btnNuevoAlbaran` no es secundaria en `accepted`');
  assert.equal(de('btnWhatsApp').destinos.accepted, 'overflow', '🔴 `btnWhatsApp` de `accepted` no pasó al «⋮»');
  for (const e of QUOTE_STATES.filter((s) => s !== 'accepted')) {
    assert.equal(de('btnCobrar').destinos[e], 'oculta', `🔴 «Cobrar ahora» aparece en «${e}»`);
    assert.equal(de('btnNuevoAlbaran').destinos[e], 'oculta', `🔴 «Nuevo albarán» aparece en «${e}»`);
  }
  assert.equal(QUOTE_ACTION_ROTULOS.btnCobrar, 'Cobrar ahora');
  assert.equal(QUOTE_ACTION_ROTULOS.btnNuevoAlbaran, 'Nuevo albarán');
});

test('SCRUM-984 · la tabla y sus rótulos son el MISMO conjunto, y la ley (1 primaria, 2 secundarias) se cumple', () => {
  const ids = QUOTE_ACTION_REGISTRY.map((a) => a.id).sort();
  assert.equal(ids.length, 13, `🔴 CIEGO: la tabla tiene ${ids.length} filas, no las 13 aprobadas`);
  assert.deepEqual(Object.keys(QUOTE_ACTION_ROTULOS).sort(), ids,
    '🔴 hay filas sin rótulo o rótulos sin fila: el conjunto de la tabla y el de los rótulos difieren');
  assert.deepEqual(incumplimientosDeLaLey(QUOTE_ACTION_REGISTRY, QUOTE_STATES, {}), [],
    '🔴 la tabla incumple la ley del patrón (más de una primaria o de dos secundarias por estado)');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL TEXTO: firmado, en un solo sitio, y sin literal nuevo en la pantalla
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-984 · la pantalla no escribe el rótulo: lo lee de `atajoNuevo` (una acción, un texto)', () => {
  const codigo = soloCodigo(fs.readFileSync(VISTA, 'utf8'));
  assert.match(codigo, /atajoNuevo\.textoDe\('albaranes'\)/, '🔴 la pantalla ya no lee el rótulo de su fuente única');
  assert.equal(/Nuevo albar[aá]n/.test(codigo), false,
    '🔴 la pantalla escribe «Nuevo albarán» a mano: el día que se renombre en atajoNuevo, aquí quedaría el viejo');
  assert.equal(/PENDIENTE microcopy oficial/.test(codigo), false, '🔴 se coló un marcador de texto sin firmar en la pantalla');
});

test('SCRUM-984 · el registro de microcopy lleva la línea de la firma delegada, con su comentario de Jira', () => {
  const md = fs.readFileSync(MICROCOPY, 'utf8');
  assert.match(md, /\*\*Aprobado por el orquestador por delegación del fundador\*\* el 2026-09-21 — SCRUM-984 comentario 16105\./,
    '🔴 falta la línea de aprobación que fija el README de docs/microcopy/ (con fecha, ticket y comentario)');
  for (const literal of ['Cobrar ahora', 'Nuevo albarán']) {
    assert.ok(md.includes(literal), `🔴 el registro no recoge el literal «${literal}»`);
  }
});
