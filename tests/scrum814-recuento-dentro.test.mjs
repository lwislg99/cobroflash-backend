// tests/scrum814-recuento-dentro.test.mjs — SCRUM-814
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS TRES CAMINOS QUE EMITEN POR TRAMOS EXIGEN EL TRAMO DENTRO DE SU TRANSACCIÓN. SIN GATE.
//
// El test que demuestra la carrera (`scrum814-carrera-de-tramos-postgres.test.mjs`) necesita un
// Postgres de verdad y vive detrás de `TRAMOS_PG_URL`. **Un ticket cuyo único guard está detrás
// de un gate es un ticket cuyo guard el CI no ejecuta nunca** (SCRUM-296). Éste corre siempre.
//
// Vigila exactamente cómo llegó aquí el defecto: se contaban las facturas ANTES de abrir la
// transacción y se decidía el tramo con ese número. Dentro de un año alguien «simplifica» un
// bloque, saca la cuenta fuera otra vez, y nada lo diría — el test con banco no corre en CI, y el
// positivo y el negativo seguirían verdes porque esto sólo falla bajo carrera.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR AST Y POR IDENTIDAD, NUNCA POR SUBCADENA
//
// Un `grep` de «exigirTramoLibre» casaría con este mismo comentario y con la prosa que lo explica
// (SCRUM-203, y la trampa de auto-referencia que ya ha mordido cinco veces). Aquí se navega el
// árbol: se localiza cada handler, dentro de él su `prisma.$transaction`, y se pregunta por lo que
// hay DENTRO del callback y EN QUÉ ORDEN.
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
 * Se elige por lo que hace, no por su posición — `quotes.routes.ts` tiene otra transacción antes
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
    `🔴 SUELO: ${txs.length} transacciones que piden número en ${fichero}, esperaba 1.`);
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

test('SCRUM-814 · 🔴 los tres exigen el tramo DENTRO de la transacción y ANTES de pedir número', () => {
  for (const c of CAMINOS) {
    const { sf } = arbolDe(c.fichero);
    const cb = transaccionQueEmite(handlerDeLaRuta(sf, c.ruta, c.fichero), sf, c.fichero);

    // 🔴 LAS POSICIONES SALEN DEL ÁRBOL, NO DEL TEXTO. La primera versión hacía
    // `cuerpo.indexOf('allocateInvoiceNumber')` y casaba con **el comentario que lo explica**,
    // que iba antes: el guard se puso rojo acusando a un código correcto. Es la trampa de
    // auto-referencia de SCRUM-203, que ya ha mordido cinco veces en esta casa.
    const primero = (ok) => { const n = buscar(cb, ok); return n.length ? n[0].getStart() : -1; };
    const posExige = primero((n) => ts.isCallExpression(n) && ts.isIdentifier(n.expression)
      && n.expression.text === 'exigirTramoLibre');
    const posNumero = primero((n) => ts.isCallExpression(n) && ts.isIdentifier(n.expression)
      && n.expression.text === 'allocateInvoiceNumber');

    assert.notEqual(posExige, -1,
      `🔴 ${c.fichero} (${c.ruta}) NO llama a \`exigirTramoLibre\` dentro de su transacción.\n\n`
      + `  Lo dispara: ${c.quien}.\n\n`
      + '  Así llegó aquí SCRUM-814: el tramo se decidía con `plan[<facturas ya emitidas>]`, y ese\n'
      + '  recuento venía de una lectura hecha ANTES de abrir la transacción. Envolver la creación\n'
      + '  en una transacción NO protege una decisión tomada antes de abrirla.\n\n'
      + '  Medido corriendo, plan 30/70: dos facturas SELLADAS del tramo «Anticipo», y el\n'
      + '  presupuesto se quedaba en 726 € de 1210 — 484 € que ya no se podían facturar, porque la\n'
      + '  regla 29 no deja borrar una factura emitida.');
    assert.notEqual(posNumero, -1, `🔴 SUELO: ${c.fichero} no pide número dentro de la transacción.`);
    assert.ok(posExige < posNumero,
      `🔴 ${c.fichero}: se pide número ANTES de exigir el tramo. Las comprobaciones van antes de `
      + 'consumir un número de la serie (SCRUM-246 y SCRUM-771): que el rollback lo devuelva es un '
      + 'detalle del motor, y el orden se lee.');
  }
});

test('SCRUM-814 · 🔴 la invariante vive en UN solo sitio: nadie se copia el recuento', () => {
  // Tres copias del mismo recuento son tres sitios que pueden separarse, y basta que alguien
  // «simplifique» uno para reabrir el agujero justo donde más muerde.
  for (const c of CAMINOS) {
    const { sf, fuente } = arbolDe(c.fichero);
    const cuentas = buscar(sf, (n) => ts.isCallExpression(n)
      && ts.isPropertyAccessExpression(n.expression)
      && /^tx\.invoice\.count$/.test(n.expression.getText(sf)));
    assert.equal(cuentas.length, 0,
      `🔴 ${c.fichero} cuenta facturas por su cuenta dentro de una transacción en vez de llamar a `
      + '`exigirTramoLibre`. La invariante tiene que estar escrita una vez.');
    assert.match(fuente, /from '.*invoicing\/domain\/tramoSinCarrera'/,
      `🔴 ${c.fichero} no importa \`tramoSinCarrera\`.`);
  }
});

test('SCRUM-814 · 🔴 el módulo toma el cerrojo de SCRUM-728, importado y no copiado', () => {
  const { sf, fuente } = arbolDe('src/modules/invoicing/domain/tramoSinCarrera.ts');
  const imports = buscar(sf, (n) => ts.isImportDeclaration(n))
    .filter((n) => n.getText(sf).includes('SERIE_LOCK_NS'));
  assert.equal(imports.length, 1,
    '🔴 `SERIE_LOCK_NS` no se importa. Si el número del cerrojo se escribe a mano aquí hay dos '
    + 'fuentes para la misma clave, y el día que una cambie dejarán de excluirse entre sí — sin '
    + 'que nada falle, que es lo peor.');
  assert.match(imports[0].getText(sf), /invoiceNumber\.service/,
    '🔴 `SERIE_LOCK_NS` viene de otro sitio que no es `invoiceNumber.service` (SCRUM-728).');

  const cerrojo = buscar(sf, (n) => ts.isTaggedTemplateExpression(n)
    && n.getText(sf).includes('pg_advisory_xact_lock'));
  assert.equal(cerrojo.length, 1,
    '🔴 el módulo ya no toma `pg_advisory_xact_lock`. Sin el cerrojo, el recuento de dentro no ve '
    + 'lo que hizo la otra petición y vuelve a decidir mal.');
  const cuenta = buscar(sf, (n) => ts.isCallExpression(n)
    && ts.isPropertyAccessExpression(n.expression) && /invoice\.count$/.test(n.expression.getText(sf)));
  assert.equal(cuenta.length, 1, '🔴 el módulo no cuenta las facturas del presupuesto.');
  assert.ok(cerrojo[0].getStart() < cuenta[0].getStart(),
    '🔴 se cuenta ANTES de tomar el cerrojo. Ahí todavía puede colarse la otra petición: el '
    + 'cerrojo es lo que garantiza que quien cuenta ya ve el commit del otro.');
  assert.match(cuenta[0].getText(sf), /merchantId/,
    '🔴 el `count` ya no filtra por `merchantId` (regla 2). La alternativa era apoyarse en la '
    + 'procedencia del id, y el censo de SCRUM-348 llama a eso «correcto hoy y frágil siempre».');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 2 · EL CÓDIGO Y EL TEXTO — uno solo, y distinto del de «plan agotado»
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-814 · 🔴 el tramo tomado tiene código PROPIO, distinto del de plan agotado', () => {
  // Los dos son 409 y significan cosas opuestas: éste dice «vuelve a pedirlo», el otro dice «no
  // queda nada». Un solo código obligaría a leer el texto para saber si hay que reintentar, y el
  // texto es lo único que no se debe parsear (SCRUM-151).
  const { sf } = arbolDe('src/modules/invoicing/domain/tramoSinCarrera.ts');
  const literal = (nombre) => {
    const d = buscar(sf, (n) => ts.isVariableDeclaration(n)
      && ts.isIdentifier(n.name) && n.name.text === nombre);
    assert.equal(d.length, 1, `🔴 no existe la constante \`${nombre}\`.`);
    assert.ok(d[0].initializer && ts.isStringLiteral(d[0].initializer),
      `🔴 \`${nombre}\` no es un literal de cadena.`);
    return d[0].initializer.text;
  };
  assert.notEqual(literal('TRAMO_TOMADO'), 'no_more_invoices_for_payment_terms',
    '🔴 el tramo tomado usa el MISMO código que «plan agotado». Son estados opuestos: uno se '
    + 'reintenta y el otro no.');

  // 🔴 EL TEXTO, PALABRA POR PALABRA. Está FIRMADO (7-sep-2026, SCRUM-814) y su registro es
  // `docs/microcopy/2026-09-07-SCRUM-814-tramo-tomado.md`. Un texto aprobado que se edita sin
  // volver a firmarlo deja de estar aprobado, y nadie se entera.
  assert.equal(literal('COPY_TRAMO_TOMADO'),
    'Se acaba de emitir otra factura de este presupuesto. Vuelve a intentarlo y saldrá el tramo siguiente.',
    '🔴 el texto aprobado ha cambiado. Si hace falta otro, se firma otro: esto es microcopy '
    + 'oficial (regla 30) y su registro está en docs/microcopy/.');

  const registro = path.join(RAIZ, 'docs', 'microcopy', '2026-09-07-SCRUM-814-tramo-tomado.md');
  assert.ok(fs.existsSync(registro),
    '🔴 falta el registro de la aprobación en `docs/microcopy/`. Un texto oficial sin registro es '
    + 'un texto que nadie puede comprobar que se firmara.');
  assert.match(fs.readFileSync(registro, 'utf8'), /\*\*Aprobado por el fundador\*\*/,
    '🔴 el registro no lleva la firma del fundador.');
});

test('SCRUM-814 · 📌 los dos endpoints del PROFESIONAL contestan 409 con ese cuerpo', () => {
  // El del cliente final NO: ahí la aceptación salió bien y su factura existe (la emitió la
  // gemela). Enseñarle un aviso sería una llamada de soporte por algo que no ha pasado.
  for (const f of [
    'src/modules/system/app/routes/quotesAdmin.routes.ts',
    'src/modules/jobs/app/routes/jobs.routes.ts',
  ]) {
    const { fuente } = arbolDe(f);
    assert.match(fuente, /esTramoTomado\(err\)\)\s*return res\.status\(409\)\.json\(cuerpoTramoTomado\(\)\)/,
      `🔴 ${f} ya no contesta 409 con el cuerpo común ante un tramo tomado.`);
  }
  const { fuente: cliente } = arbolDe('src/modules/quotes/app/routes/quotes.routes.ts');
  assert.match(cliente, /if \(esTramoTomado\(e\)\)/,
    '🔴 el camino del cliente final ya no distingue el tramo tomado, así que volvería a marcar '
    + '«factura pendiente» por una factura que SÍ existe.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 3 · EL TEST CON BANCO SIGUE AHÍ — era mi condición al recomendar este camino
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-814 · 📌 el test de carrera existe, cubre los tres y conserva su suelo', () => {
  const conBanco = path.join(RAIZ, 'tests', 'scrum814-carrera-de-tramos-postgres.test.mjs');
  assert.ok(fs.existsSync(conBanco),
    '🔴 falta `tests/scrum814-carrera-de-tramos-postgres.test.mjs`. Este guard vigila la FORMA del '
    + 'código; el que demuestra que la carrera está cerrada es aquél.');
  const t = fs.readFileSync(conBanco, 'utf8');
  assert.match(t, /una-peticion\.mjs/,
    '🔴 el test con banco ya no usa `docs/master/evidencias/scrum814/una-peticion.mjs`. La carrera '
    + 'se PROVOCA con dos procesos y hora de salida común: `Promise.all` en un solo node comparte '
    + 'bucle de eventos y da un falso «no se reproduce» — me pasó, y cerró la pregunta.');
  assert.match(t, /arranque < 120/,
    '🔴 el test con banco ha perdido su suelo de carrera. Sin él, un «no se reproduce» puede ser '
    + 'sólo que las dos peticiones no llegaron a solaparse.');
  for (const c of CAMINOS) {
    assert.ok(t.includes(c.ruta),
      `🔴 el test con banco no cubre \`${c.ruta}\` (${c.fichero}). Lo dispara: ${c.quien}.`);
  }
});
