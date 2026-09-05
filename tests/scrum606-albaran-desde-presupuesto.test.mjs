// tests/scrum606-albaran-desde-presupuesto.test.mjs — SCRUM-606 (ALB-01)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// NUEVO ALBARÁN DESDE PRESUPUESTO — LO QUE HAY QUE PODER DEMOSTRAR
//
// El ticket pide un «Nuevo albarán» en la pestaña Albaranes con un buscador de presupuesto
// detrás. Lo que puede salir mal no es que el botón no exista: es que el camino nuevo se salte
// las reglas que el camino viejo ya sostenía. Así que esto mide CUATRO cosas, y ninguna es «se
// pinta un botón»:
//
//   (a) LA REGLA DE ELEGIBILIDAD, pura. Un presupuesto solo puede estrenar albarán si ES el
//       `Job.quoteId` de un Trabajo. Un ADICIONAL no, y ése es el caso que hay que ver caer.
//   (b) EL ENDPOINT, con el handler REAL y prisma de doble (patrón de SCRUM-263/257).
//   (c) EL ORDEN DE LAS RUTAS. `/presupuestos` va antes que `/:id` o Express se lo come.
//   (d) 🔴 EL AGUJERO QUE SCRUM-303 NO PODÍA VER, y que este ticket abría de par en par.
//
// ── SOBRE (d), QUE ES LO QUE MÁS IMPORTA ────────────────────────────────────────────────────
//
// SCRUM-303 dejó un guard por AST: el alta del albarán vive en UN solo sitio (`openAlbCrearSheet`)
// y hay exactamente UN `POST` a `…/albaranes` en el front. **Ese censo lee un único fichero,
// `jobDetailView.js`.** Medido, no supuesto: su `censarPostAlbaranes()` hace
// `ts.createSourceFile('jobDetailView.js', FRONT, …)` sobre esa sola fuente.
//
// O sea que una segunda alta escrita en CUALQUIER otro fichero del dashboard —por ejemplo, en el
// modal que estrena este ticket— habría sido invisible para el guard que existe justo para
// impedirla. Un guard ciego ante el caso que viene es una decoración.
//
// Aquí el censo se hace sobre LOS 70-Y-PICO FICHEROS del dashboard, y sigue exigiendo UNO. No
// sustituye al de SCRUM-303 —aquél vigila DÓNDE está dentro de su fichero, que es otra
// propiedad—: le tapa el punto ciego.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 MUTACIONES_QUE_ME_TUMBAN — declaradas, CORRIDAS y ANOTADAS el 5-sep-2026
//
// Se inyectó cada una, se exigió el rojo, se restauró y se comprobó que los BYTES del fichero
// volvían a su sha256. Lo que sigue es lo que SALIÓ, no lo que se esperaba — dos predicciones no
// se cumplieron como estaban escritas y se corrigen aquí en vez de redondearlas:
//
//   M1 · `presupuestosParaAlbaran.ts`: indexar por `t.id` en vez de `t.quoteId`.
//        → ROJO, 5 tests. ⚠️ **NO cayó por el adicional**, que era la predicción: el adicional
//        sigue saliendo NO elegible porque su id tampoco está en el mapa mal construido. Cayó por
//        el CONTROL POSITIVO —el original deja de ser elegible— y por los cuatro que lo usan. Es
//        justo el motivo por el que el control positivo existe: sin él, esta mutación habría
//        pasado en verde con el buscador ofreciendo a nadie.
//   M2 · `presupuestosParaAlbaran.ts`: tratar `[]` como «ve todos»
//        (`jobIdsVisibles == null || !jobIdsVisibles.length ? null : …`). → ROJO, 2 tests.
//   M3 · `albaranes.routes.ts`: **mover el bloque entero** de `router.get('/presupuestos')` detrás
//        del handler de `router.get('/:id')` — no una sustitución de una línea, la mudanza de
//        verdad, porque lo que se vigila es el ORDEN de registro. → ROJO, y **sólo** el test (c):
//        una mutación que cae en un único sitio es la señal de que ese test mide una sola cosa.
//   M4 · `albaranes.routes.ts`: `truncado: false` fijo. → ROJO, 1 test.
//   M5 · `albaranDesdePresupuestoModal.js`: escribir un alta propia
//        (`apiRequest('/admin/jobs/1/albaranes', { method: 'POST' })`).
//        → ROJO en (d), 2 tests. Y con la MISMA mutación puesta,
//        `tests/scrum303-albaran-una-pantalla.test.mjs` se quedó **VERDE**: el punto ciego que
//        motiva (d) no es una hipótesis, está comprobado.
//   M6 · `albaranesView.js`: quitar el `header.appendChild(nuevoBtn)`. → ROJO en (e), 1 test.
//
// ⚠️ En las tandas de M5 y M6 salió además rojo el test 8 (`truncado`), y **no es cosa de la
// mutación**: el script restauraba el `.ts` de M4 pero no recompilaba `dist` para las mutaciones
// de front, así que `dist` seguía llevando el `truncado: false` de M4. Se anota porque un rojo
// atribuido a la mutación equivocada es peor que ninguno.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { cargarDashboard, pintarVista, todos, SCRIPTS_DEL_DASHBOARD } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');

const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const { filasParaElegirPresupuesto } = await import(DIST + 'modules/jobs/domain/presupuestosParaAlbaran.js');

// ═════════════════════════════════════════════════════════════════════════════════════════
// (a) LA REGLA · pura, sin base de datos, y por eso se puede ejercitar de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Tres presupuestos del mismo merchant: el original de un Trabajo, un adicional y uno suelto. */
const P_ORIGINAL = { id: 11, number: 260011, customerName: 'Talleres Ruiz', totalAmount: '1200.00', currency: 'EUR', status: 'accepted' };
const P_ADICIONAL = { id: 12, number: 260012, customerName: 'Talleres Ruiz', totalAmount: '300.00', currency: 'EUR', status: 'draft' };
const P_SUELTO = { id: 13, number: 260013, customerName: 'Bar Pepe', totalAmount: '80.00', currency: 'EUR', status: 'sent' };

// El Trabajo 5 nació del presupuesto 11. El 12 es un ADICIONAL suyo: cuelga del Trabajo por
// `Quote.jobId`, que este lado no mira — y no puede mirarlo, ver el porqué en el módulo.
const TRABAJOS = [{ id: 5, quoteId: 11 }];

test('SCRUM-606 · (a) SUELO · el original SÍ es elegible y trae SU Trabajo', () => {
  // 🔴 CONTROL POSITIVO. Sin esto, los asserts de abajo («el adicional no es elegible») pasarían
  // en verde sobre una función que no considera elegible a NADIE — que es el mismo verde con el
  // significado contrario.
  const filas = filasParaElegirPresupuesto([P_ORIGINAL], TRABAJOS, null);
  assert.equal(filas.length, 1);
  assert.equal(filas[0].elegible, true, '🔴 el presupuesto ORIGINAL de un Trabajo no sale elegible: el buscador no serviría para nada');
  assert.equal(filas[0].jobId, 5, '🔴 sale elegible pero sin Trabajo al que ir: el front no sabría dónde aterrizar');
  assert.equal(filas[0].motivo, null);
});

test('SCRUM-606 · (a) 🔴 UN ADICIONAL NO PUEDE ESTRENAR ALBARÁN, y ése es el corazón de la regla', () => {
  const filas = filasParaElegirPresupuesto([P_ADICIONAL], TRABAJOS, null);

  assert.equal(
    filas[0].elegible, false,
    '🔴 SE OFRECE UN PRESUPUESTO ADICIONAL COMO ORIGEN DE UN ALBARÁN.\n\n' +
    '  El prellenado escribe `quoteLineIndex`, y ese índice significa «posición en las líneas de\n' +
    '  `Job.quoteId`» — lo validan así `contarLineasDePresupuesto`, la decisión ① de\n' +
    '  `entregaPendiente.ts` y el pie del PDF de ALB-02. Un albarán prellenado desde el adicional\n' +
    '  llevaría índices que apuntan a las líneas de OTRO presupuesto: el «enlace roto» que\n' +
    '  SCRUM-367 declaró peor que ningún enlace y que SCRUM-684 acaba de cerrar por las dos puertas.',
  );
  assert.equal(filas[0].jobId, null, '🔴 no es elegible pero viaja un `jobId`: el front podría usarlo igual');
  assert.equal(filas[0].motivo, 'sin_trabajo');
});

test('SCRUM-606 · (a) un presupuesto sin ningún Trabajo dice POR QUÉ, no desaparece', () => {
  const filas = filasParaElegirPresupuesto([P_SUELTO], [], null);
  assert.equal(filas.length, 1, '🔴 el presupuesto se ha filtrado de la respuesta: quien lo busca por su número lee que no existe');
  assert.equal(filas[0].elegible, false);
  assert.equal(filas[0].motivo, 'sin_trabajo');
});

test('SCRUM-606 · (a) un Trabajo DIRECTO (sin presupuesto) no hace elegible a nadie', () => {
  // SCRUM-651: una avería se abre sin presupuesto y su `quoteId` es `null`. Indexar por él sin
  // comprobarlo metería un `null` en el mapa y cualquier presupuesto sin `id` casaría con él.
  const filas = filasParaElegirPresupuesto([P_ORIGINAL, P_SUELTO], [{ id: 9, quoteId: null }], null);
  assert.deepEqual(filas.map((f) => f.elegible), [false, false]);
});

test('SCRUM-606 · (a) 🔴 `[]` NO es «ve todos»: un técnico sin Trabajos visibles no ve ninguno', () => {
  // Admin (`null`) ve el original; el técnico con lista VACÍA no ve nada. Si los dos casos se
  // colapsaran con un `if (!lista)`, ese técnico pasaría a ver todo el negocio — el mismo defecto
  // que `listQuotesAdmin` documenta para su `teamMemberId`.
  const comoAdmin = filasParaElegirPresupuesto([P_ORIGINAL], TRABAJOS, null);
  const comoTecnicoSinNada = filasParaElegirPresupuesto([P_ORIGINAL], TRABAJOS, []);
  assert.equal(comoAdmin[0].elegible, true);
  assert.equal(comoTecnicoSinNada[0].elegible, false, '🔴 un técnico sin Trabajos visibles puede crear albaranes sobre los de otro');
  assert.equal(comoTecnicoSinNada[0].motivo, 'trabajo_no_visible');
  assert.equal(comoTecnicoSinNada[0].jobId, null, '🔴 se le da el id de un Trabajo que no puede ver');
});

test('SCRUM-606 · (a) el técnico que SÍ tiene el Trabajo lo ve elegible', () => {
  const filas = filasParaElegirPresupuesto([P_ORIGINAL], TRABAJOS, [5]);
  assert.equal(filas[0].elegible, true, '🔴 el técnico dueño del Trabajo tampoco puede: el filtro rechaza todo');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// (b) EL ENDPOINT · handler REAL, prisma de doble
// ═════════════════════════════════════════════════════════════════════════════════════════

const routerDe = (mod) => mod.default?.default ?? mod.default;

async function capaDeAlbaranes(ruta, metodo = 'get') {
  const router = routerDe(await import(DIST + 'modules/jobs/app/routes/albaranes.routes.js'));
  return { router, capa: router.stack.find((l) => l.route?.path === ruta && l.route?.methods?.[metodo]) };
}

async function invocarPresupuestos(req) {
  const { capa } = await capaDeAlbaranes('/presupuestos');
  assert.ok(capa, '🔴 ESCÁNER CIEGO: no existe GET /admin/albaranes/presupuestos. Si se renombró, este test no comprueba nada');
  let salida = null;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
  };
  const handlers = capa.route.stack;
  await handlers[handlers.length - 1].handle(req, res, () => {});
  return salida;
}

/**
 * Prisma con lo justo: los presupuestos que devuelve la búsqueda y los Trabajos que los tienen.
 *
 * 🔴 `job.findMany` SE PREGUNTA DOS VECES por este endpoint y son DOS PREGUNTAS DISTINTAS: la del
 * origen (`where.quoteId in […]`) y la de la VISIBILIDAD del técnico (`where.OR`, SCRUM-467). El
 * primer intento de este fichero devolvía lo mismo a las dos, y entonces el doble contestaba «sí,
 * lo ve» sin que nadie lo hubiera decidido: el test de abajo pasó en verde por el doble, no por el
 * código. Se separan por la forma del `where`, que es lo que de verdad las distingue.
 *
 * @param visibles Trabajos que el llamante PUEDE ver. Por defecto, los mismos (caso admin).
 */
function sustituirPrisma(quotes, jobs, visibles = jobs) {
  moduloPrisma.prisma.quote = {
    findMany: async () => quotes.map((q) => ({
      id: q.id, quoteNumber: q.number, total: q.totalAmount, currency: q.currency,
      status: q.status, createdAt: new Date(), internalNotes: null,
      customer: { name: q.customerName, phone: null }, charge: null,
    })),
  };
  moduloPrisma.prisma.job = {
    findMany: async (args) => (args?.where?.OR ? visibles : jobs),
  };
}

const REQ = (query = {}) => ({ query, merchantId: 7, teamMemberId: null, userRole: 'admin', params: {}, body: {}, headers: {} });

test('SCRUM-606 · (b) el endpoint separa el original del adicional, con su motivo', async () => {
  sustituirPrisma([P_ORIGINAL, P_ADICIONAL, P_SUELTO], TRABAJOS);
  const r = await invocarPresupuestos(REQ({ q: 'Ruiz' }));

  assert.equal(r?.code ?? 200, 200, `🔴 el endpoint no responde 200: ${JSON.stringify(r)}`);
  const filas = r.body.presupuestos;
  assert.equal(filas.length, 3, '🔴 alguna fila se ha caído por el camino: nada desaparece sin decirlo');
  assert.deepEqual(
    filas.map((f) => [f.quoteId, f.elegible, f.motivo]),
    [[11, true, null], [12, false, 'sin_trabajo'], [13, false, 'sin_trabajo']],
  );
  assert.equal(filas[0].jobId, 5);
  // El número VISIBLE y el cliente llegan: sin ellos el buscador no se puede usar.
  assert.equal(filas[0].numero, 260011);
  assert.equal(filas[0].cliente, 'Talleres Ruiz');
});

test('SCRUM-606 · (b) 🔴 `truncado` distingue «no hay» de «no caben»', async () => {
  // Un cero de elegibles significa dos cosas opuestas si la lista viene cortada. Este campo es lo
  // único que las separa, y por eso se mide en los DOS sentidos.
  sustituirPrisma([P_SUELTO], []);
  const corto = await invocarPresupuestos(REQ({}));
  assert.equal(corto.body.truncado, false, '🔴 dice que puede haber más con una lista que cabe entera');

  const { TOPE_LISTADO_QUOTES } = await import(DIST + 'modules/system/quoteAdmin.js');
  assert.ok(TOPE_LISTADO_QUOTES > 0, '🔴 ESCÁNER CIEGO: el tope no se publica y no se puede contrastar');
  const muchos = Array.from({ length: TOPE_LISTADO_QUOTES }, (_, i) => ({ ...P_SUELTO, id: 1000 + i }));
  sustituirPrisma(muchos, []);
  const largo = await invocarPresupuestos(REQ({}));
  assert.equal(
    largo.body.truncado, true,
    '🔴 LA LISTA VIENE CORTADA Y NO SE DICE. El profesional busca su presupuesto, no lo ve, y lee\n' +
    '  un cero que no es un cero: los suyos pueden estar por debajo del corte de la consulta.',
  );
});

test('SCRUM-606 · (b) un técnico no recibe como elegible el Trabajo de otro', async () => {
  // 🔴 SUELO: si `'tecnico'` dejara de ser el rol acotado, este test seguiría verde midiendo el
  // camino de admin — y diría que la tenencia por fila funciona sin haberla ejercitado.
  const { seesOnlyOwnJobs } = await import(DIST + 'core/http/roleCapabilities.js');
  assert.equal(seesOnlyOwnJobs('tecnico'), true, '🔴 ESCÁNER CIEGO: `tecnico` ya no es el rol acotado');
  assert.equal(seesOnlyOwnJobs('admin'), false, '🔴 ESCÁNER CIEGO: `admin` también estaría acotado');

  // El Trabajo 5 existe y es el origen del presupuesto, pero NO está entre los que este técnico ve.
  sustituirPrisma([P_ORIGINAL], TRABAJOS, []);
  const r = await invocarPresupuestos({ ...REQ({}), userRole: 'tecnico', teamMemberId: 99 });
  const f = r.body.presupuestos[0];
  assert.equal(f.elegible, false, '🔴 un técnico puede arrancar un albarán sobre el Trabajo de otro');
  assert.equal(f.motivo, 'trabajo_no_visible');
  assert.equal(f.jobId, null, '🔴 le llega el id de un Trabajo que no puede ver');

  // Y el CONTRASTE, en la misma prueba: el mismo técnico con ese Trabajo asignado SÍ puede. Sin
  // esta mitad, un filtro que rechazara todo también pasaría.
  sustituirPrisma([P_ORIGINAL], TRABAJOS, TRABAJOS);
  const r2 = await invocarPresupuestos({ ...REQ({}), userRole: 'tecnico', teamMemberId: 99 });
  assert.equal(r2.body.presupuestos[0].elegible, true, '🔴 el filtro rechaza también al técnico dueño del Trabajo');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// (c) EL ORDEN DE LAS RUTAS · lo que Express se come en silencio
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-606 · (c) 🔴 `/presupuestos` se registra ANTES que `/:id`', async () => {
  const { router } = await capaDeAlbaranes('/presupuestos');
  const posicion = (p) => router.stack.findIndex((l) => l.route?.path === p && l.route?.methods?.get);
  const iLista = posicion('/presupuestos');
  const iSuelto = posicion('/:id');

  // Suelo: si el escáner no encuentra las dos capas, la comparación de abajo sería un verde vacío.
  assert.ok(iLista >= 0, '🔴 ESCÁNER CIEGO: no encuentro GET /presupuestos en la pila del router');
  assert.ok(iSuelto >= 0, '🔴 ESCÁNER CIEGO: no encuentro GET /:id en la pila del router');

  assert.ok(
    iLista < iSuelto,
    `🔴 EL BUSCADOR ESTÁ DETRÁS DE \`/:id\` (posiciones ${iLista} y ${iSuelto}).\n\n` +
    '  Express casa por orden de registro: `/:id` acepta un solo segmento, así que se tragaría\n' +
    '  «presupuestos», haría `Number(\'presupuestos\')` y devolvería `400 invalid_id`. El botón\n' +
    '  «Nuevo albarán» enseñaría un fallo de carga y nadie sabría por qué.',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// (d) 🔴 EL PUNTO CIEGO DE SCRUM-303: el alta, censada en TODO el dashboard
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Los POST a `…/albaranes` (el ALTA) en TODOS los ficheros del dashboard, por AST. */
function censarAltasEnTodoElFront() {
  const altas = [];
  let ficherosLeidos = 0;
  for (const nombre of SCRIPTS_DEL_DASHBOARD) {
    const f = path.join(DIR_JS, nombre);
    if (!fs.existsSync(f)) continue;
    ficherosLeidos++;
    const src = fs.readFileSync(f, 'utf8');
    const sf = ts.createSourceFile(nombre, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    (function visitar(n) {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'apiRequest') {
        const destino = n.arguments[0] ? n.arguments[0].getText(sf) : '';
        const opciones = n.arguments[1] ? n.arguments[1].getText(sf) : '';
        // MISMO criterio que `censarPostAlbaranes` de SCRUM-303: la barra antes de `albaranes`
        // separa el alta de `consolidar-albaranes` y de `/albaranes/<id>/emitir`.
        if (/[/]albaranes`$/.test(destino.trim()) && /'POST'/.test(opciones)) {
          altas.push({ fichero: nombre, linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
        }
      }
      ts.forEachChild(n, visitar);
    })(sf);
  }
  return { altas, ficherosLeidos };
}

test('SCRUM-606 · (d) SUELO del censo: se leen los ficheros y se encuentra el alta que existe', () => {
  const { altas, ficherosLeidos } = censarAltasEnTodoElFront();
  assert.ok(ficherosLeidos > 50, `🔴 ESCÁNER CIEGO: solo he leído ${ficherosLeidos} ficheros del dashboard`);
  assert.ok(altas.length > 0, '🔴 ESCÁNER CIEGO: no encuentro NINGÚN alta de albarán en todo el front');
});

test('SCRUM-606 · (d) 🔴 EL ALTA SIGUE SIENDO UNA, MIRANDO TODOS LOS FICHEROS', () => {
  const { altas } = censarAltasEnTodoElFront();
  assert.deepEqual(
    altas.map((a) => `${a.fichero}:${a.linea}`).slice(1), [],
    '🔴 HAY MÁS DE UN ALTA DE ALBARÁN EN EL DASHBOARD:\n' +
    altas.map((a) => `      ${a.fichero}:${a.linea}`).join('\n') + '\n\n' +
    '  El guard de SCRUM-303 no puede ver esto: su censo lee SOLO `jobDetailView.js`. Una segunda\n' +
    '  alta escrita en otro fichero le sale invisible, y «no existe hasta que se guarda» deja de\n' +
    '  ser cierto por ese camino — con el número ALB de la serie ya quemado si alguien sale sin\n' +
    '  guardar. Si de verdad hace falta otra puerta, se abre en `openAlbCrearSheet` y se llama.',
  );
  assert.equal(altas[0].fichero, 'jobDetailView.js',
    `🔴 el alta se ha mudado a \`${altas[0].fichero}\`. El guard de SCRUM-303 seguiría leyendo ` +
    '`jobDetailView.js` y pasaría en verde sin mirar nada.');
});

test('SCRUM-606 · (d) el modal del buscador NO crea nada: elige y se aparta', () => {
  // ⚠️ SE AFIRMA LA LISTA ENTERA, no se prohíbe un token. La primera versión hacía
  // `assert.doesNotMatch(opciones, /POST|PATCH|DELETE|PUT/)` y el guard de SCRUM-237 la marcó
  // NINGUNO — una negación sin respaldo: ese token no aparece en positivo en ninguna parte, así
  // que habría seguido verde aunque el escáner dejara de mirar. Enumerar lo que SÍ hay es más
  // fuerte y no necesita respaldo: un método nuevo, sea cual sea, rompe la igualdad.
  const src = fs.readFileSync(path.join(DIR_JS, 'albaranDesdePresupuestoModal.js'), 'utf8');
  const sf = ts.createSourceFile('m.js', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const llamadas = [];
  (function visitar(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'apiRequest') {
      llamadas.push({
        destino: n.arguments[0] ? n.arguments[0].getText(sf) : '',
        opciones: n.arguments[1] ? n.arguments[1].getText(sf) : null,
      });
    }
    ts.forEachChild(n, visitar);
  })(sf);

  assert.equal(llamadas.length, 1,
    `🔴 el modal hace ${llamadas.length} llamadas a la API y debe hacer UNA: la del buscador.`);
  assert.match(llamadas[0].destino, /admin\/albaranes\/presupuestos/,
    `🔴 la única llamada del buscador no va a su endpoint, va a ${llamadas[0].destino}.`);
  assert.equal(llamadas[0].opciones, null,
    `🔴 EL BUSCADOR ESCRIBE: lleva opciones (${llamadas[0].opciones}). Sin segundo argumento, ` +
    '`apiRequest` hace GET; en cuanto lleva uno, puede llevar método. Es un selector de origen: ' +
    'lee y devuelve la elección, y el alta la hace `openAlbCrearSheet`.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// (e) LA PANTALLA · el botón existe, y existe TAMBIÉN cuando el listado falla
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-606 · (e) 🔴 el botón sigue estando cuando la lista de albaranes NO se puede leer', async () => {
  // El banco sirve `{}` a `/admin/albaranes`, que es una respuesta con forma inesperada: la vista
  // la trata como FALLO (su propia regla: un fallo no se pinta como un cero). Es el escenario
  // exacto que este assert quiere — un fallo al LEER los albaranes que existen no puede impedir
  // crear el que falta.
  const banco = cargarDashboard(RAIZ);
  const r = await pintarVista(banco, 'renderAlbaranesView');
  assert.equal(r.error, null, `🔴 la vista no se monta: ${r.error}`);

  const botones = todos(r.contenedor).filter((n) => n.tagName === 'BUTTON');
  const conAtajo = botones.filter((b) => b.hijos.some((h) => h.tagName === 'KBD'));
  assert.equal(conAtajo.length, 1,
    `🔴 hay ${conAtajo.length} botones con tecla en Albaranes y debía haber UNO (el de «Nuevo albarán»).`);
  assert.equal(conAtajo[0].hijos.find((h) => h.tagName === 'KBD').textContent, 'N',
    '🔴 la tecla pintada no es la «N»: el atajo de las otras tres listas es esa.');
  assert.match(conAtajo[0].textContent, /PENDIENTE/,
    '🔴 el rótulo ya no lleva el marcador. O el fundador lo ha firmado —y entonces hay que bajar ' +
    '`SIN_APROBAR` y sacar la entrada del censo de SCRUM-402—, o alguien se ha inventado un texto.');
});

test('SCRUM-606 · (e) la vista de Albaranes registra su atajo «N»', async () => {
  const banco = cargarDashboard(RAIZ);
  await pintarVista(banco, 'renderAlbaranesView');
  assert.ok(banco.ctx.atajoNuevo.vistasConAtajo().includes('albaranes'),
    '🔴 la pestaña Albaranes tiene botón de alta y no registra destino para la «N»: el atajo ' +
    'existiría en tres listas y en la cuarta no, que es enseñar que a veces no va.');
});
