// tests/scrum814-recuento-dentro.test.mjs — SCRUM-814
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS TRES CAMINOS RECUENTAN DENTRO DE SU TRANSACCIÓN Y BAJO EL CERROJO. SIN GATE.
//
// Los dos tests que demuestran la carrera necesitan una base y viven detrás de un gate:
// `scrum814-carrera-del-tramo.gated.test.mjs` (staging, `QA_DB_TEST`) y
// `scrum814-carrera-de-tramos-postgres.test.mjs` (banco desechable, `TRAMOS_PG_URL`).
// **Un ticket cuyo único guard está detrás de un gate es un ticket cuyo guard el CI no ejecuta
// nunca** (SCRUM-296). Éste corre siempre y vigila la forma del código.
//
// Vigila exactamente cómo llegó aquí el defecto: se contaban las facturas ANTES de abrir la
// transacción y se decidía el tramo con ese número. Dentro de un año alguien «simplifica» un
// bloque, saca la cuenta fuera otra vez, y nada lo diría — los tests con base no corren en CI, y
// los controles positivos seguirían verdes porque esto sólo falla bajo carrera.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR AST Y POR IDENTIDAD, NUNCA POR SUBCADENA
//
// Un `grep` de «tomarCerrojoDeSerie» casaría con este mismo comentario y con la prosa que lo
// explica (SCRUM-203, y la trampa de auto-referencia que ya ha mordido cinco veces). Aquí se
// navega el árbol: se localiza cada handler, dentro de él la transacción QUE EMITE, y se pregunta
// por lo que hay DENTRO del callback y EN QUÉ ORDEN.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * LOS TRES CAMINOS QUE EMITEN UN TRAMO. Enumerados, no contados — y con quién los dispara,
 * porque es lo que decide cuánto muerde la carrera en cada uno.
 */
const CAMINOS = [
  {
    fichero: 'src/modules/system/app/routes/quotesAdmin.routes.ts',
    ruta: '/:id/invoice',
    quien: 'el profesional, facturando un presupuesto por tramos',
  },
  {
    fichero: 'src/modules/quotes/app/routes/quotes.routes.ts',
    ruta: '/:token/decision',
    quien: 'EL CLIENTE FINAL desde WhatsApp — pulsar dos veces con mala cobertura es el caso NORMAL',
  },
  {
    fichero: 'src/modules/jobs/app/routes/jobs.routes.ts',
    ruta: '/:id/collect-rest',
    quien: 'el profesional, «cobrar el resto» de un trabajo',
  },
];

/**
 * Todos los nodos que cumplen un predicado, en orden de aparición.
 *
 * 🔴 EL CALLBACK NO DEVUELVE NADA, Y NO ES ESTILO: `ts.forEachChild` **corta el recorrido en
 * cuanto su callback devuelve algo truthy** —así implementa `find`—. La primera versión hacía
 * `(h) => buscar(h, ok, salida)`, que devuelve el array acumulador, y un array siempre es truthy:
 * sólo visitaba el primer hijo de cada nodo. Encontraba CERO rutas. Lo cazó el suelo, no yo.
 */
function buscar(nodo, ok, salida = []) {
  if (ok(nodo)) salida.push(nodo);
  ts.forEachChild(nodo, (h) => { buscar(h, ok, salida); });
  return salida;
}

function arbolDe(fichero) {
  const fuente = fs.readFileSync(path.join(RAIZ, fichero), 'utf8');
  return { fuente, sf: ts.createSourceFile(fichero, fuente, ts.ScriptTarget.Latest, true) };
}

/** El handler de `router.post('<ruta>', …)`: el ÚLTIMO argumento de esa llamada. */
function handlerDeLaRuta(sf, ruta, fichero) {
  const texto = (n) => n.getText(sf);
  const llamadas = buscar(sf, (n) => ts.isCallExpression(n)
    && ts.isPropertyAccessExpression(n.expression)
    && texto(n.expression) === 'router.post'
    && n.arguments.length > 0
    && ts.isStringLiteral(n.arguments[0])
    && n.arguments[0].text === ruta);
  assert.equal(llamadas.length, 1,
    `🔴 SUELO: ${llamadas.length} rutas \`router.post('${ruta}', …)\` en ${fichero}, esperaba 1. `
    + 'Sin localizar la ruta, todo lo de abajo mediría el vacío — y un cero aquí NO es «está bien», '
    + 'es «no he mirado».');
  return llamadas[0].arguments[llamadas[0].arguments.length - 1];
}

/**
 * La transacción que EMITE, dentro de un handler: la que llama a `allocateInvoiceNumber`.
 * Se elige por lo que HACE, no por su posición — `quotes.routes.ts` tiene otra transacción antes
 * (la que acepta el presupuesto) y quedarse con la primera mediría el bloque equivocado.
 */
function transaccionQueEmite(handler, sf, fichero) {
  const texto = (n) => n.getText(sf);
  const txs = buscar(handler, (n) => ts.isCallExpression(n)
    && ts.isPropertyAccessExpression(n.expression)
    && texto(n.expression) === 'prisma.$transaction'
    && buscar(n, (m) => ts.isCallExpression(m) && ts.isIdentifier(m.expression)
      && m.expression.text === 'allocateInvoiceNumber').length > 0);
  assert.equal(txs.length, 1,
    `🔴 SUELO: ${txs.length} transacciones que piden número en ${fichero} (${handler.getStart()}), esperaba 1.`);
  return txs[0].arguments[0];
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 0 · SUELO — si el analizador no encuentra los tres, lo de abajo mide el vacío
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-814 · 🔴 SUELO: los TRES caminos existen y tienen su transacción de emisión', () => {
  for (const c of CAMINOS) {
    const { sf } = arbolDe(c.fichero);
    const cb = transaccionQueEmite(handlerDeLaRuta(sf, c.ruta, c.fichero), sf, c.fichero);
    assert.ok(ts.isArrowFunction(cb) || ts.isFunctionExpression(cb),
      `🔴 ${c.fichero}: el primer argumento de \`$transaction\` no es una función.`);
    assert.ok(cb.getText(sf).length > 150,
      `🔴 ${c.fichero}: el cuerpo de la transacción está casi vacío — se habrá movido, y este `
      + 'guard estaría vigilando una cáscara.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 1 · 🔴 LO QUE CIERRA LA CARRERA, EN LOS TRES
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-814 · 🔴 los tres: cerrojo, recuento y AMBOS antes de pedir número', () => {
  for (const c of CAMINOS) {
    const { sf } = arbolDe(c.fichero);
    const cb = transaccionQueEmite(handlerDeLaRuta(sf, c.ruta, c.fichero), sf, c.fichero);

    // 🔴 LAS POSICIONES SALEN DEL ÁRBOL, NO DEL TEXTO. Una versión anterior hacía
    // `cuerpo.indexOf('allocateInvoiceNumber')` y casaba con **el comentario que lo explica**,
    // que iba antes: el guard se puso rojo acusando a un código correcto. Es la trampa de
    // auto-referencia de SCRUM-203.
    const primero = (ok) => { const n = buscar(cb, ok); return n.length ? n[0].getStart() : -1; };
    const posCerrojo = primero((n) => ts.isCallExpression(n) && ts.isIdentifier(n.expression)
      && n.expression.text === 'tomarCerrojoDeSerie');
    const posCuenta = primero((n) => ts.isCallExpression(n)
      && ts.isPropertyAccessExpression(n.expression)
      && /^tx\.invoice\.count$/.test(n.expression.getText(sf)));
    const posNumero = primero((n) => ts.isCallExpression(n) && ts.isIdentifier(n.expression)
      && n.expression.text === 'allocateInvoiceNumber');

    assert.notEqual(posCerrojo, -1,
      `🔴 ${c.fichero} (${c.ruta}) NO toma el cerrojo de serie dentro de su transacción.\n\n`
      + `  Lo dispara: ${c.quien}.\n\n`
      + '  `tomarCerrojoDeSerie` es el MISMO `pg_advisory_xact_lock(SERIE_LOCK_NS, merchantId)` de\n'
      + '  SCRUM-234/728, expuesto por `albaranIdempotencia.ts` (SCRUM-358). No es un cerrojo\n'
      + '  nuevo: sin él, el recuento de abajo no ve lo que acaba de escribir la otra petición.');
    assert.notEqual(posCuenta, -1,
      `🔴 ${c.fichero} (${c.ruta}) NO recuenta las facturas DENTRO de su transacción.\n\n`
      + `  Lo dispara: ${c.quien}.\n\n`
      + '  Así llegó aquí SCRUM-814: el tramo se decidía con `plan[<facturas ya emitidas>]`, y ese\n'
      + '  recuento venía de una lectura hecha ANTES de abrir la transacción. Envolver la creación\n'
      + '  en una transacción NO protege una decisión tomada antes de abrirla.\n\n'
      + '  Medido corriendo, plan 30/70: dos facturas SELLADAS del tramo «Anticipo», y el\n'
      + '  presupuesto se quedaba en 726 € de 1210 — 484 € que ya no se podían facturar, porque la\n'
      + '  regla 29 no deja borrar una factura emitida.');
    assert.notEqual(posNumero, -1, `🔴 SUELO: ${c.fichero} no pide número dentro de la transacción.`);

    assert.ok(posCerrojo < posCuenta,
      `🔴 ${c.fichero}: se recuenta ANTES de tomar el cerrojo. Ahí todavía puede colarse la otra `
      + 'petición: el cerrojo es lo que garantiza que quien cuenta ya ve el commit del otro.');
    assert.ok(posCuenta < posNumero,
      `🔴 ${c.fichero}: se pide número ANTES de recontar. Rechazar después obligaría a deshacer un `
      + 'número ya reservado, y deshacer es lo que crea el HUECO en la serie que hay que '
      + 'justificar ante Hacienda (SCRUM-246, SCRUM-771, y la lección de SCRUM-358).');
  }
});

test('SCRUM-814 · 🔴 el recuento filtra por `merchantId`, no sólo por el presupuesto', () => {
  // Regla 2. La alternativa era apoyarse en la procedencia del id, y el censo de SCRUM-348 llama
  // a eso «correcto hoy y frágil siempre»: nada comprueba que mañana el id siga viniendo de una
  // fila acotada. Aquí el merchant está a mano y no cuesta nada.
  for (const c of CAMINOS) {
    const { sf } = arbolDe(c.fichero);
    const cb = transaccionQueEmite(handlerDeLaRuta(sf, c.ruta, c.fichero), sf, c.fichero);
    const cuentas = buscar(cb, (n) => ts.isCallExpression(n)
      && ts.isPropertyAccessExpression(n.expression)
      && /^tx\.invoice\.count$/.test(n.expression.getText(sf)));
    assert.equal(cuentas.length, 1, `🔴 ${c.fichero}: ${cuentas.length} recuentos, esperaba 1.`);
    assert.match(cuentas[0].getText(sf), /merchantId/,
      `🔴 ${c.fichero}: el recuento no filtra por \`merchantId\` (regla 2).`);
    assert.match(cuentas[0].getText(sf), /quoteId/,
      `🔴 ${c.fichero}: el recuento no filtra por \`quoteId\`: estaría contando otra población.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 2 · 🔴 LA DIFERENCIA DELIBERADA DEL CAMINO DEL CLIENTE
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-814 · 🔴 el camino del CLIENTE no recalcula el tramo: sale sin escribir', () => {
  // En `quotesAdmin` y en «cobrar el resto», quien pierde la carrera emite el tramo SIGUIENTE:
  // quien pulsó pedía «emite lo que toque». En `/:token/decision` NO, y es la diferencia que hay
  // que proteger: lo que el cliente hizo fue ACEPTAR una vez, aunque el dedo tocara dos.
  // Recalcular emitiría el «Final» de golpe junto al «Anticipo» — cobrarle antes de tiempo.
  // 🔴 NO ES UNA NEGACIÓN SUELTA, Y ESO IMPORTA (SCRUM-237): «aquí no aparece `tramoTrasEmitidas`»
  // sería verde para siempre el día que ese nombre cambie en toda la casa. Se comparan DOS
  // CONJUNTOS: los dos caminos del profesional SÍ lo tienen y el del cliente NO. Si el nombre
  // cambia, el hermano positivo cae primero y dice que hay que volver a mirar.
  const recalculan = new Set();
  for (const c of CAMINOS) {
    const { sf } = arbolDe(c.fichero);
    const cb = transaccionQueEmite(handlerDeLaRuta(sf, c.ruta, c.fichero), sf, c.fichero);
    const usos = buscar(cb, (n) => ts.isCallExpression(n) && ts.isIdentifier(n.expression)
      && n.expression.text === 'tramoTrasEmitidas');
    if (usos.length) recalculan.add(c.ruta);
  }
  assert.deepEqual([...recalculan].sort(), ['/:id/collect-rest', '/:id/invoice'],
    `🔴 el reparto de quién recalcula el tramo ha cambiado: ${JSON.stringify([...recalculan])}. `
    + 'Los DOS caminos del profesional recalculan, porque quien pulsa pide «emite lo que toque»: '
    + 'quien llega segundo emite el tramo SIGUIENTE. El del CLIENTE FINAL no, y es la diferencia '
    + 'que hay que proteger — lo que hizo fue ACEPTAR una vez, aunque el dedo tocara dos, y '
    + 'recalcular le emitiría el «Final» de golpe junto al «Anticipo»: cobrarle antes de tiempo.');

  const c = CAMINOS.find((x) => x.ruta === '/:token/decision');
  const { sf } = arbolDe(c.fichero);
  const cb = transaccionQueEmite(handlerDeLaRuta(sf, c.ruta, c.fichero), sf, c.fichero);
  const retornosNulos = buscar(cb, (n) => ts.isReturnStatement(n)
    && n.expression && n.expression.kind === ts.SyntaxKind.NullKeyword);
  assert.ok(retornosNulos.length >= 1,
    '🔴 el camino del cliente ya no sale con `return null` cuando el recuento se ha movido. Sin esa '
    + 'salida, o emite dos veces el mismo tramo o emite el siguiente: las dos están mal aquí.');

  // Y el resultado nulo NO puede acabar en «factura pendiente»: eso le diría al cliente que
  // llame al profesional por una factura que SÍ existe.
  assert.match(sf.getFullText(), /invoice === null/,
    '🔴 nadie distingue el `null` de la carrera perdida, así que caería en el camino de error y '
    + 'marcaría `facturaPendiente` por una factura que existe.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 3 · LOS TESTS CON BASE SIGUEN AHÍ, Y SE REPARTEN LOS TRES CAMINOS SIN SOLAPARSE
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-814 · 📌 entre los dos tests con base, los TRES caminos quedan cubiertos', () => {
  const gated = path.join(RAIZ, 'tests', 'scrum814-carrera-del-tramo.gated.test.mjs');
  const banco = path.join(RAIZ, 'tests', 'scrum814-carrera-de-tramos-postgres.test.mjs');
  assert.ok(fs.existsSync(gated), '🔴 falta el test de carrera contra staging.');
  assert.ok(fs.existsSync(banco), '🔴 falta el test de carrera contra el banco desechable.');

  const juntos = fs.readFileSync(gated, 'utf8') + fs.readFileSync(banco, 'utf8');
  for (const c of CAMINOS) {
    assert.ok(juntos.includes(c.ruta),
      `🔴 ningún test con base ejercita \`${c.ruta}\` (${c.fichero}). Lo dispara: ${c.quien}.`);
  }

  const t = fs.readFileSync(banco, 'utf8');
  assert.match(t, /una-peticion\.mjs/,
    '🔴 el test del banco ya no usa `docs/master/evidencias/scrum814/una-peticion.mjs`. La carrera '
    + 'se PROVOCA con dos procesos y hora de salida común: `Promise.all` en un solo node comparte '
    + 'bucle de eventos y da un falso «no se reproduce» — pasó, y cerró la pregunta.');
  assert.match(t, /arranque < 120/,
    '🔴 el test del banco ha perdido su suelo de carrera. Sin él, un «no se reproduce» puede ser '
    + 'sólo que las dos peticiones no llegaron a solaparse.');
});
