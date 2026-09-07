// tests/scrum814-recuento-dentro.test.mjs — SCRUM-814
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL RECUENTO TIENE QUE SEGUIR DENTRO DE LA TRANSACCIÓN. SIN GATE, POR AST.
//
// El test que de verdad demuestra la carrera (`scrum814-carrera-de-tramos-postgres.test.mjs`)
// necesita un Postgres de verdad y por eso vive detrás de `TRAMOS_PG_URL`. **Un ticket cuyo
// único guard está detrás de un gate es un ticket cuyo guard el CI no ejecuta nunca**
// (SCRUM-296). Éste corre siempre y vigila la forma del código.
//
// Lo que vigila es exactamente cómo llegó aquí el defecto: alguien contó las facturas ANTES de
// abrir la transacción y decidió el tramo con ese número. Dentro de un año, alguien
// «simplifica» el bloque, saca la cuenta fuera otra vez, y nada lo diría — el test con banco no
// corre en CI, y el positivo y el negativo seguirían verdes porque sólo falla bajo carrera.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR AST Y POR IDENTIDAD, NUNCA POR SUBCADENA
//
// Un `grep` de «invoice.count» casaría con este mismo comentario y con cualquier recuento de
// otra ruta del fichero (SCRUM-203, y la trampa de auto-referencia que ya mordió cuatro veces).
// Aquí se navega el árbol: se localiza el handler de `POST /:id/invoice`, dentro de él la
// llamada a `prisma.$transaction`, y se pregunta por lo que hay DENTRO de su callback.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHERO = 'src/modules/system/app/routes/quotesAdmin.routes.ts';
const RUTA = path.join(RAIZ, FICHERO);

const fuente = fs.readFileSync(RUTA, 'utf8');
const sf = ts.createSourceFile(FICHERO, fuente, ts.ScriptTarget.Latest, true);
const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;

/**
 * Todos los nodos que cumplen un predicado, en orden de aparición.
 *
 * 🔴 EL CALLBACK NO DEVUELVE NADA, Y NO ES ESTILO: `ts.forEachChild` **corta el recorrido en
 * cuanto su callback devuelve algo truthy** —así implementa `find`—. La primera versión hacía
 * `(h) => buscar(h, ok, salida)`, que devuelve el array acumulador, y un array siempre es
 * truthy: sólo visitaba el primer hijo de cada nodo. Encontraba CERO rutas. Lo cazó el suelo,
 * no yo: por eso el suelo va primero.
 */
function buscar(nodo, ok, salida = []) {
  if (ok(nodo)) salida.push(nodo);
  ts.forEachChild(nodo, (h) => { buscar(h, ok, salida); });
  return salida;
}
const texto = (n) => n.getText(sf);

/** El handler de `router.post('/:id/invoice', …)` — el ÚLTIMO argumento de esa llamada. */
function handlerDeLaRuta() {
  const llamadas = buscar(sf, (n) => ts.isCallExpression(n)
    && ts.isPropertyAccessExpression(n.expression)
    && texto(n.expression) === 'router.post'
    && n.arguments.length > 0
    && ts.isStringLiteral(n.arguments[0])
    && n.arguments[0].text === '/:id/invoice');
  assert.equal(llamadas.length, 1,
    `🔴 SUELO: he encontrado ${llamadas.length} rutas \`router.post('/:id/invoice', …)\` en `
    + `${FICHERO} y esperaba exactamente 1. Sin localizar la ruta, todo lo de abajo mediría el `
    + 'vacío — y un cero aquí NO es «está bien», es «no he mirado».');
  return llamadas[0].arguments[llamadas[0].arguments.length - 1];
}

/** La llamada a `prisma.$transaction(...)` dentro de un nodo. */
function transaccionDe(nodo) {
  const txs = buscar(nodo, (n) => ts.isCallExpression(n)
    && ts.isPropertyAccessExpression(n.expression)
    && texto(n.expression) === 'prisma.$transaction');
  assert.equal(txs.length, 1,
    `🔴 SUELO: ${txs.length} llamadas a \`prisma.$transaction\` en el handler, esperaba 1.`);
  return txs[0];
}

test('SCRUM-814 · 🔴 SUELO: el analizador encuentra la ruta y su transacción', () => {
  const handler = handlerDeLaRuta();
  const tx = transaccionDe(handler);
  assert.ok(tx.arguments.length >= 1, '🔴 `prisma.$transaction` sin callback');
  const cb = tx.arguments[0];
  assert.ok(ts.isArrowFunction(cb) || ts.isFunctionExpression(cb),
    '🔴 el primer argumento de `$transaction` no es una función: el análisis de abajo no aplica.');
  assert.ok(texto(cb).length > 200,
    '🔴 el cuerpo de la transacción está casi vacío: probablemente se ha movido a otro sitio y '
    + 'este guard estaría vigilando una cáscara.');
});

test('SCRUM-814 · 🔴 el recuento de facturas del presupuesto está DENTRO de la transacción', () => {
  const cb = transaccionDe(handlerDeLaRuta()).arguments[0];

  // `tx.invoice.count(...)` — por identidad del acceso, no por subcadena del fichero.
  const cuentas = buscar(cb, (n) => ts.isCallExpression(n)
    && ts.isPropertyAccessExpression(n.expression)
    && texto(n.expression) === 'tx.invoice.count');
  assert.equal(cuentas.length, 1,
    '🔴 NO HAY un `tx.invoice.count(...)` dentro de la transacción de `POST /:id/invoice`.\n\n'
    + '  Así es exactamente como llegó aquí SCRUM-814: el tramo se decidía con\n'
    + '  `plan[existingInvoices.length]`, y ese recuento venía de un `findFirst` hecho ANTES de\n'
    + '  abrir la transacción. Envolver la creación en una transacción NO protege una decisión\n'
    + '  tomada antes de abrirla.\n\n'
    + '  Medido corriendo, plan 30/70: dos facturas SELLADAS del tramo «Anticipo», y el\n'
    + '  presupuesto se quedaba en 726 € de 1210 — 484 € que ya no se podían facturar, porque\n'
    + '  la regla 29 no deja borrar una factura emitida.\n\n'
    + '  Si has movido el recuento a un helper, este guard no puede verlo: tráelo de vuelta o\n'
    + '  reescribe el guard para que siga al helper. Lo que no vale es quitarlo.');

  // Y filtrando POR ESTE presupuesto, no por cualquier cosa: un `count` sin `quoteId` contaría
  // otra población y decidiría igual de mal.
  const arg = texto(cuentas[0]);
  assert.match(arg, /quoteId/,
    `🔴 el \`tx.invoice.count\` no filtra por \`quoteId\`: ${arg}. Cuenta otra población.`);
});

test('SCRUM-814 · 🔴 el cerrojo se toma DENTRO de la transacción y ANTES de pedir número', () => {
  const cb = transaccionDe(handlerDeLaRuta()).arguments[0];

  // 🔴 LAS POSICIONES SALEN DEL ÁRBOL, NO DEL TEXTO. La primera versión hacía
  // `cuerpo.indexOf('allocateInvoiceNumber')` y casaba con **el comentario que explica el
  // cerrojo**, que va antes del recuento: el guard se puso rojo acusando a un código correcto.
  // Es la trampa de auto-referencia de SCRUM-203, que ya ha mordido cinco veces en esta casa.
  const primero = (ok) => {
    const n = buscar(cb, ok);
    return n.length ? n[0].getStart() : -1;
  };
  const posCerrojo = primero((n) => ts.isTaggedTemplateExpression(n)
    && texto(n).includes('pg_advisory_xact_lock'));
  const posCuenta = primero((n) => ts.isCallExpression(n)
    && ts.isPropertyAccessExpression(n.expression) && texto(n.expression) === 'tx.invoice.count');
  const posNumero = primero((n) => ts.isCallExpression(n)
    && ts.isIdentifier(n.expression) && n.expression.text === 'allocateInvoiceNumber');

  assert.ok(posCerrojo !== -1,
    '🔴 la transacción ya no toma `pg_advisory_xact_lock`. Sin el cerrojo, el recuento de dentro '
    + 'no ve lo que hizo la otra petición y vuelve a decidir mal.');
  assert.ok(posNumero !== -1, '🔴 SUELO: no se pide número dentro de la transacción.');

  assert.ok(posCerrojo < posCuenta,
    '🔴 el recuento se hace ANTES de tomar el cerrojo. Ahí todavía puede colarse la otra '
    + 'petición: el cerrojo es lo que garantiza que quien cuenta ya ve el commit del otro.');
  assert.ok(posCuenta < posNumero,
    '🔴 el recuento se hace DESPUÉS de pedir número. Las comprobaciones van antes de consumir un '
    + 'número de la serie (SCRUM-246 y SCRUM-771): que el rollback lo devuelva es un detalle del '
    + 'motor, y el orden se lee.');
});

test('SCRUM-814 · 🔴 el cerrojo se IMPORTA de SCRUM-728, no se copia el número', () => {
  // Dos sitios que sepan el número del cerrojo acaban sabiendo números distintos.
  const imports = buscar(sf, (n) => ts.isImportDeclaration(n))
    .filter((n) => texto(n).includes('SERIE_LOCK_NS'));
  assert.equal(imports.length, 1,
    '🔴 `SERIE_LOCK_NS` no se importa. Si el número del cerrojo se ha escrito a mano aquí, hay '
    + 'dos fuentes para la misma clave y el día que una cambie dejarán de excluirse entre sí — '
    + 'sin que nada falle, que es lo peor.');
  assert.match(texto(imports[0]), /invoiceNumber\.service/,
    '🔴 `SERIE_LOCK_NS` viene de otro sitio que no es `invoiceNumber.service` (SCRUM-728).');
});

test('SCRUM-814 · 🔴 el tramo tomado tiene código PROPIO, distinto del de plan agotado', () => {
  // Los dos son 409 y significan cosas opuestas: éste dice «vuelve a pedirlo», el otro dice «no
  // queda nada». Un solo código obligaría a leer el texto para saber si hay que reintentar, y el
  // texto es lo único que no se debe parsear (SCRUM-151).
  const decl = buscar(sf, (n) => ts.isVariableDeclaration(n)
    && ts.isIdentifier(n.name) && n.name.text === 'TRAMO_TOMADO');
  assert.equal(decl.length, 1, '🔴 no existe la constante `TRAMO_TOMADO`.');
  const valor = decl[0].initializer && ts.isStringLiteral(decl[0].initializer)
    ? decl[0].initializer.text : null;
  assert.ok(valor, '🔴 `TRAMO_TOMADO` no es un literal de cadena.');
  assert.notEqual(valor, 'no_more_invoices_for_payment_terms',
    '🔴 el tramo tomado usa el MISMO código que «plan agotado». Son estados opuestos: uno se '
    + 'reintenta y el otro no.');
  assert.ok(fuente.includes(`error: TRAMO_TOMADO`),
    '🔴 la respuesta 409 no usa la constante: si el código se escribe a mano en la respuesta, '
    + 'puede separarse del que lanza el error sin que nada lo diga.');
});

test('SCRUM-814 · 📌 el test con banco existe y apunta al mismo sitio', () => {
  // La condición que puse yo misma al recomendar el camino B: el recuento queda ATADO al test de
  // carrera. Si el fichero desaparece, esto lo dice — un arreglo cuyo único vigilante es un guard
  // de forma se puede satisfacer sin que la carrera esté cerrada.
  const conBanco = path.join(RAIZ, 'tests', 'scrum814-carrera-de-tramos-postgres.test.mjs');
  assert.ok(fs.existsSync(conBanco),
    '🔴 falta `tests/scrum814-carrera-de-tramos-postgres.test.mjs`. Este guard vigila la FORMA '
    + 'del código; el que demuestra que la carrera está cerrada es aquél.');
  const t = fs.readFileSync(conBanco, 'utf8');
  assert.match(t, /una-peticion\.mjs/,
    '🔴 el test con banco ya no usa `docs/master/evidencias/scrum814/una-peticion.mjs`. La '
    + 'carrera se PROVOCA con dos procesos y hora de salida común: `Promise.all` en un solo node '
    + 'comparte bucle de eventos y da un falso «no se reproduce» — me pasó, y cerró la pregunta.');
  assert.match(t, /arranque < 120/,
    '🔴 el test con banco ha perdido su suelo de carrera. Sin él, un «no se reproduce» puede '
    + 'ser sólo que las dos peticiones no llegaron a solaparse.');
});
