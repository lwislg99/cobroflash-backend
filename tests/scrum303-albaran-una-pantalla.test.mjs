// SCRUM-303 (C4) · CREAR UN ALBARÁN EN UNA PANTALLA, Y QUE NO EXISTA HASTA QUE SE GUARDA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA MITAD DEL TICKET QUE YA ESTABA HECHA, medida antes de construir nada
//
// El ticket decía que hoy «se crea un albarán VACÍO y luego se rellena». **Falso desde
// SCRUM-257**: el front ya mandaba las líneas EN EL PROPIO POST de creación, así que el albarán
// nacía prellenado. Lo que seguía roto es lo otro, y es lo que se cierra aquí: **el documento
// existía en el instante del clic**, con su número ya reservado, sin que nadie lo hubiera mirado.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ CADA COSA SE PRUEBA COMO SE PRUEBA
//
//   (a) LA DECISIÓN (qué se abre y con qué aviso) es una función PURA del front: se extrae y se
//       EJECUTA sobre los cuatro casos. Un guard de texto pasaría en verde con la lógica escrita
//       al revés — mismo criterio que SCRUM-257(a), SCRUM-264 y SCRUM-271.
//   (b) «NO SE CREA NADA AL ABRIR» no es ejecutable sin banco de DOM (y montarlo sería dependencia
//       nueva, regla 36), así que se vigila por **AST**: dónde vive el POST. No `grep` — un `grep`
//       casaría el propio comentario que explica la prohibición (SCRUM-203 y `_guard-texto.mjs`).
//   (c) EL 409 del backend se comprueba invocando el handler REAL con un `prisma` de doble, igual
//       que SCRUM-263 y SCRUM-257(b).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const RUTA_FRONT = path.join(RAIZ, 'public', 'dashboard', 'js', 'jobDetailView.js');
const FRONT = fs.readFileSync(RUTA_FRONT, 'utf8');

/** El texto oficial del rechazo del backend (regla 30, aprobado en SCRUM-257). */
const COPY_SIN_PRESUPUESTO = 'Este trabajo no tiene presupuesto; no se puede crear un albarán.';

// ═════════════════════════════════════════════════════════════════════════════════════════
// (a) LA DECISIÓN · se ejecuta la lógica real del front
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Recorta un trozo del front comprobando LOS DOS EXTREMOS.
 *
 * ⚠️ Con un solo extremo, un `indexOf` que falla devuelve -1 y `slice(i, -1)` se traga el fichero
 * entero: el test mediría código que no es el buscado y daría verde (o rojo) sobre otra cosa.
 */
function trozo(desde, hasta) {
  const i = FRONT.indexOf(desde);
  assert.ok(i >= 0, `🔴 ESCÁNER CIEGO: no encuentro «${desde}» en jobDetailView.js. ¿Se renombró?`);
  const j = FRONT.indexOf(hasta, i + 1);
  assert.ok(j > i, `🔴 ESCÁNER CIEGO: no encuentro el FINAL «${hasta}» tras «${desde}». Sin los dos ` +
    'extremos, el recorte mediría un trozo de fichero que no es el vigilado.');
  return FRONT.slice(i, j);
}

/** Saca del front la decisión, el mapeo de SCRUM-257 y los textos, y los vuelve ejecutables aquí. */
function frontEjecutable() {
  // ⚠️ EL BLOQUE DE 303 VA ANTES QUE EL DE 257, y no es capricho: el guard de SCRUM-367 recorta
  // desde `function lineasDeQuoteParaAlbaran` hasta `renderJobDetailView` y exige que ese trozo
  // mida menos de 3000 caracteres. Con este código en medio, su escáner ciego salta —
  // correctamente. Se movió el código nuevo en vez de tocar el guard ajeno.
  const textos = trozo('const ALB_MOTIVO = {', 'function decidirAperturaAlbaran');
  const decidir = trozo('function decidirAperturaAlbaran', '\n// ── SCRUM-257');
  const mapa = trozo('function lineasDeQuoteParaAlbaran', '\nasync function renderJobDetailView');
  for (const [nombre, t] of [['mapeo', mapa], ['textos', textos], ['decisión', decidir]]) {
    assert.ok(t.length > 120 && t.length < 4000,
      `🔴 ESCÁNER CIEGO: el recorte «${nombre}» mide ${t.length} caracteres — no es lo que se cree.`);
  }
  return new Function(
    `${mapa}\n${textos}\n${decidir}\n` +
    'return { lineasDeQuoteParaAlbaran, decidirAperturaAlbaran, ALB_MOTIVO, ALB_CREAR_COPY };',
  )();
}

/** Lo que trae un presupuesto de verdad. */
const LINEAS_QUOTE = [
  { concept: 'Sustituir grifo monomando', qty: 1, price: 85, tax: 21 },
  { concept: 'Tubo cobre 15 mm', qty: 3.5, price: 12.4, tax: 21 },
];

const ABRIR = (extra) => ({
  modoValoracion: 'SIN_VALORAR', tieneQuote: true, quoteLeido: true, lineasQuote: LINEAS_QUOTE, ...extra,
});

test('SCRUM-303 · SUELO: la cara buena abre YA RELLENA y sin aviso', () => {
  const { decidirAperturaAlbaran } = frontEjecutable();
  const d = decidirAperturaAlbaran(ABRIR());

  assert.equal(d.lineas.length, 2,
    '🔴 la pantalla se abre VACÍA teniendo un presupuesto con líneas aprovechables: el prellenado ' +
    'de SCRUM-257 ha dejado de llegar a la hoja de creación.');
  assert.equal(d.motivo, null, '🔴 avisa de algo cuando no hay nada que avisar');
  assert.equal(d.descartadas, 0);
  // Y sigue sin colarse el dinero: el albarán es comprobante de ENTREGA (criterio cerrado de 257).
  for (const l of d.lineas) {
    assert.ok(!('precioUnitario' in l) && !('tipoIva' in l), '🔴 se ha colado precio o IVA');
    assert.equal(l.unidad, 'ud');
  }
});

test('SCRUM-303 · 🔴 EL SUELO: «no se pudo leer» NO es «no tenía líneas»', () => {
  const { decidirAperturaAlbaran, ALB_CREAR_COPY } = frontEjecutable();

  const ilegible = decidirAperturaAlbaran(ABRIR({ quoteLeido: false, lineasQuote: null }));
  const sinLineas = decidirAperturaAlbaran(ABRIR({ lineasQuote: [] }));

  // Las dos abren la pantalla —se crea igualmente, decisión del fundador: un pro con mala cobertura
  // NO puede quedarse sin poder crear el documento (bloque H)— pero NO dicen lo mismo.
  assert.equal(ilegible.lineas.length, 0);
  assert.equal(sinLineas.lineas.length, 0);

  assert.notEqual(
    ilegible.motivo, sinLineas.motivo,
    '🔴 LOS DOS CASOS SE CONFUNDEN EN UNO.\n\n' +
    '  «No se pudo leer el presupuesto» y «el presupuesto no tenía líneas» son la misma pantalla\n' +
    '  vacía y significan cosas OPUESTAS. Con el mismo motivo, el producto le dice al profesional\n' +
    '  que no hay nada que entregar cuando lo que pasó es que no se pudo mirar.',
  );
  assert.notEqual(
    ALB_CREAR_COPY[ilegible.motivo], ALB_CREAR_COPY[sinLineas.motivo],
    '🔴 los motivos son distintos pero el TEXTO que ve el profesional es el mismo: para él, los ' +
    'dos casos siguen siendo indistinguibles. El suelo se cumple en la pantalla, no en el código.',
  );
  for (const m of [ilegible.motivo, sinLineas.motivo]) {
    assert.ok(ALB_CREAR_COPY[m], `🔴 el motivo «${m}» no tiene texto: la pantalla se abriría vacía y MUDA`);
  }
});

test('SCRUM-303 · los otros dos casos también dicen por qué están vacíos', () => {
  const { decidirAperturaAlbaran, ALB_MOTIVO, ALB_CREAR_COPY } = frontEjecutable();

  // VALORADO: el backend exige precio en todas las líneas y el presupuesto no lo trae.
  const valorado = decidirAperturaAlbaran(ABRIR({ modoValoracion: 'VALORADO' }));
  assert.equal(valorado.lineas.length, 0);
  assert.equal(valorado.motivo, ALB_MOTIVO.VALORADO);

  const sinQuote = decidirAperturaAlbaran(ABRIR({ tieneQuote: false }));
  assert.equal(sinQuote.motivo, ALB_MOTIVO.SIN_PRESUPUESTO);

  // NINGUNA pantalla vacía sin explicación: es la propiedad, no cuatro casos sueltos.
  for (const d of [valorado, sinQuote]) {
    assert.ok(d.motivo && ALB_CREAR_COPY[d.motivo],
      '🔴 hay un camino que abre la pantalla vacía sin decir por qué');
  }

  // ⚠️ Y el que NO ha pedido nada no puede decir «ilegible»: no ha fallado ninguna lectura.
  assert.notEqual(valorado.motivo, ALB_MOTIVO.ILEGIBLE,
    '🔴 dice que no se pudo leer el presupuesto cuando ni siquiera se ha pedido');
});

test('SCRUM-303 · las descartadas se siguen contando (SCRUM-271 sigue vigente)', () => {
  const { decidirAperturaAlbaran, ALB_CREAR_COPY } = frontEjecutable();
  const d = decidirAperturaAlbaran(ABRIR({
    lineasQuote: [
      { concept: 'Válida', qty: 2 },
      { concept: 'Sin cantidad', qty: 0 },
      { concept: '', qty: 1 },
    ],
  }));
  assert.equal(d.lineas.length, 1);
  assert.equal(d.descartadas, 2,
    '🔴 se descartan líneas del presupuesto SIN CONTARLAS. Omitir en silencio en un documento que ' +
    'alguien firma es exactamente el defecto de SCRUM-271.');
  assert.match(ALB_CREAR_COPY.descartadas(2), /2/, '🔴 el aviso no dice CUÁNTAS se han quedado fuera');
});

// Los SIETE textos, tal como los aprobó el fundador el 5-ago-2026 (regla 30). El marcador
// `[PENDIENTE microcopy oficial]` ya NO está: dejó de ser copy sin decidir.
const COPY_APROBADA = {
  titulo: 'Nuevo albarán',
  guardar: 'Crear albarán',
  valorado: 'Con precios, las líneas se escriben a mano: el presupuesto no los trae.',
  sin_presupuesto: 'Este trabajo no tiene presupuesto, así que empiezas de cero.',
  presupuesto_ilegible: 'No se ha podido leer el presupuesto, así que no se ha rellenado nada. Puedes escribir las líneas a mano.',
  presupuesto_sin_lineas: 'El presupuesto no tiene ninguna línea que se pueda entregar.',
};

test('SCRUM-303 · REGLA 30: la copy aprobada es EXACTAMENTE la aprobada', () => {
  // Antes este guard exigía el marcador de pendiente. Ahora que el fundador aprobó los siete
  // textos, su trabajo es el contrario: que nadie los reescriba «para que suenen mejor». Un
  // retoque de copy aprobada es una decisión del fundador, no un detalle de implementación.
  const { ALB_CREAR_COPY } = frontEjecutable();

  assert.deepEqual(
    Object.keys(ALB_CREAR_COPY).sort(),
    [...Object.keys(COPY_APROBADA), 'descartadas'].sort(),
    '🔴 las ranuras de aviso ya no son las siete aprobadas: hay texto nuevo (o falta uno). Todo ' +
    'texto que lee el profesional pasa por el fundador (regla 30).',
  );

  for (const [ranura, esperado] of Object.entries(COPY_APROBADA)) {
    assert.equal(
      ALB_CREAR_COPY[ranura], esperado,
      `🔴 la ranura «${ranura}» ya no dice lo aprobado.\n     aprobado: ${JSON.stringify(esperado)}\n` +
      `        ahora: ${JSON.stringify(ALB_CREAR_COPY[ranura])}`,
    );
  }

  // Y ninguna arrastra el marcador: si sigue ahí, se entregó como pendiente algo ya decidido.
  for (const v of Object.values(ALB_CREAR_COPY)) {
    const texto = typeof v === 'function' ? v(1) : v;
    assert.ok(!texto.includes('[PENDIENTE microcopy oficial]'),
      `🔴 queda el marcador de pendiente en un texto YA APROBADO: ${JSON.stringify(texto)}`);
  }
});

test('SCRUM-303 · el aviso de descartadas resuelve singular y plural de verdad', () => {
  const { ALB_CREAR_COPY } = frontEjecutable();

  assert.equal(ALB_CREAR_COPY.descartadas(1), '1 línea sin cantidad no se ha copiado.',
    '🔴 el singular no concuerda. «1 líneas … no se han copiado» es de programador, y esto lo lee ' +
    'un profesional en obra.');
  assert.equal(ALB_CREAR_COPY.descartadas(3), '3 líneas sin cantidad no se han copiado.',
    '🔴 el plural no concuerda');

  // El defecto concreto que se retiró: la abreviatura que servía para los dos a la vez.
  for (const n of [1, 2, 5]) {
    assert.ok(!ALB_CREAR_COPY.descartadas(n).includes('(s)'),
      `🔴 vuelve la abreviatura «línea(s)» con n=${n}: resuelve el plural de mentira`);
  }
});

test('SCRUM-303 · 🔴 EL AVISO SE VE: `styles.css` esconde `.alert` sin tono', () => {
  // LO CAZÓ LA CAPTURA AB6, NO LA SUITE, y por eso está aquí: los tests de arriba comprueban que
  // el motivo y su texto EXISTEN, no que lleguen a la pantalla. La primera versión ponía
  // `className = 'alert'` a secas y `styles.css` la esconde con `display:none` — el suelo entero
  // del ticket habría quedado verde y MUDO. Mismo fallo que `validarLineas` comiéndose el campo
  // en SCRUM-367: el mecanismo en su sitio, y vacío.
  //
  // Se DERIVA de la hoja de estilos: si mañana cambian los modificadores válidos, este guard se
  // entera. Comparar contra una lista escrita a mano solo comprobaría lo que yo creí que había.
  const css = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'css', 'styles.css'), 'utf8');
  const regla = css.match(/\.alert((?::not\(\.[a-z]+\))+)\s*\{[^}]*display:\s*none/);
  assert.ok(regla,
    '🔴 ESCÁNER CIEGO: ya no encuentro en styles.css la regla que esconde `.alert` sin modificador. ' +
    'Si desapareció, este guard sobra; si cambió de forma, deja de vigilar nada.');
  const TONOS_VISIBLES = [...regla[1].matchAll(/:not\(\.([a-z]+)\)/g)].map((m) => m[1]);
  assert.ok(TONOS_VISIBLES.length >= 3,
    `🔴 ESCÁNER CIEGO: solo he derivado ${TONOS_VISIBLES.length} tono(s) de la hoja de estilos`);

  // Los tonos que usa la hoja de creación, leídos del front.
  const bloque = trozo('const ALB_AVISO_TONO = {', 'const ALB_CREAR_COPY');
  const usados = [...bloque.matchAll(/:\s*'([a-z]+)'/g)].map((m) => m[1]);
  assert.ok(usados.length >= 5,
    `🔴 ESCÁNER CIEGO: he leído ${usados.length} tonos del front y hay 5 ranuras de aviso`);

  for (const tono of usados) {
    assert.ok(
      TONOS_VISIBLES.includes(tono),
      `🔴 EL AVISO NO SE VERÍA: el tono «${tono}» no está entre los que styles.css deja visibles ` +
      `(${TONOS_VISIBLES.join(', ')}).\n\n` +
      '  Un aviso escondido es peor que no tenerlo: el profesional ve una pantalla vacía sin saber\n' +
      '  por qué, o firma un albarán al que le faltan líneas sin que nadie se lo haya dicho.',
    );
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// (b) 🔴 EL CORAZÓN · ¿DÓNDE VIVE EL POST? · por AST, nunca por grep
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Censa los POST a `…/albaranes` del front y dice DENTRO DE QUÉ está cada uno.
 *
 * Es la única forma de vigilar «abrir no crea nada» sin banco de DOM: si el POST está en el
 * manejador del botón, el albarán existe al pulsar; si está en el guardado del sheet, no.
 */
function censarPostAlbaranes() {
  const sf = ts.createSourceFile('jobDetailView.js', FRONT, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  // Rango del manejador del clic de «+ Nuevo albarán».
  let rangoClic = null;
  let rangoCrearSheet = null;
  (function buscar(n) {
    if (!rangoClic && ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && n.expression.name.text === 'addEventListener'
        && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === 'newAlbBtn'
        && n.arguments.length >= 2 && ts.isStringLiteralLike(n.arguments[0])
        && n.arguments[0].text === 'click') {
      rangoClic = [n.getStart(sf), n.getEnd()];
    }
    if (!rangoCrearSheet && ts.isFunctionDeclaration(n) && n.name?.text === 'openAlbCrearSheet') {
      rangoCrearSheet = [n.getStart(sf), n.getEnd()];
    }
    ts.forEachChild(n, buscar);
  })(sf);

  const posts = [];
  (function visitar(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'apiRequest') {
      const destino = n.arguments[0] ? n.arguments[0].getText(sf) : '';
      const opciones = n.arguments[1] ? n.arguments[1].getText(sf) : '';
      // ⚠️ SOLO EL ALTA. La barra antes de `albaranes` es lo que distingue el alta de sus vecinos:
      // `consolidar-albaranes` termina igual pero lleva guion, y `/albaranes/<id>/emitir` o
      // `/enviar-para-firmar` terminan en otra cosa. Sin ese detalle el censo casaba CINCO POST
      // que no son altas y el guard salía rojo por lo que no vigila.
      if (/\/albaranes`$/.test(destino.trim()) && /'POST'/.test(opciones)) {
        const ini = n.getStart(sf);
        posts.push({
          linea: linea(n),
          destino,
          enClic: !!rangoClic && ini >= rangoClic[0] && n.getEnd() <= rangoClic[1],
          enCrearSheet: !!rangoCrearSheet && ini >= rangoCrearSheet[0] && n.getEnd() <= rangoCrearSheet[1],
        });
      }
    }
    ts.forEachChild(n, visitar);
  })(sf);

  return { rangoClic, rangoCrearSheet, posts };
}

test('SCRUM-303 · SUELO del censo: se encuentran el manejador, la hoja y el POST', () => {
  // Sin esto, los asserts de abajo pasarían en verde sobre un fichero donde el AST no encontró
  // NADA: «ningún POST en el clic» y «no se miró» son el mismo verde con significados opuestos.
  const { rangoClic, rangoCrearSheet, posts } = censarPostAlbaranes();
  assert.ok(rangoClic, '🔴 ESCÁNER CIEGO: no encuentro el manejador del clic de `newAlbBtn`');
  assert.ok(rangoCrearSheet, '🔴 ESCÁNER CIEGO: no encuentro `openAlbCrearSheet`');
  assert.ok(posts.length > 0, '🔴 ESCÁNER CIEGO: no encuentro NINGÚN POST a /albaranes en el front');
});

test('SCRUM-303 · 🔴 ABRIR NO CREA NADA NI QUEMA NÚMERO: el POST no está en el clic', () => {
  const { posts } = censarPostAlbaranes();
  const enElClic = posts.filter((p) => p.enClic);

  assert.deepEqual(
    enElClic.map((p) => p.linea), [],
    '🔴 EL ALBARÁN VUELVE A CREARSE AL PULSAR EL BOTÓN.\n\n' +
    `  Hay un POST a /albaranes dentro del manejador del clic (línea ${enElClic[0]?.linea}).\n\n` +
    '  Ése es el defecto que este ticket existe para matar: el documento pasa a existir antes de\n' +
    '  que nadie lo haya mirado, y con el número ALB-YYYY-NNN ya reservado dentro de la\n' +
    '  transacción. Si el profesional sale sin guardar, queda un albarán vacío Y UN HUECO EN LA\n' +
    '  SERIE que no se ve en ninguna pantalla: solo aparece cuando alguien audita la numeración.',
  );

  const fuera = posts.filter((p) => !p.enCrearSheet);
  assert.deepEqual(
    fuera.map((p) => p.linea), [],
    '🔴 hay un ALTA de albarán fuera de `openAlbCrearSheet` (líneas ' +
    `${fuera.map((p) => p.linea).join(', ')}). El alta tiene UN SOLO sitio a propósito: si se crea ` +
    'desde otro punto, «no existe hasta que se guarda» deja de ser cierto por ese camino.',
  );

  assert.equal(posts.length, 1,
    `🔴 hay ${posts.length} altas de albarán en el front. Debe haber exactamente UNA: dos altas ` +
    'divergen en cuanto alguien toca una — que es justo lo que pasó y lo que este ticket encontró.');
});

test('SCRUM-303 · LOS DOS BOTONES QUE DAN DE ALTA usan la misma puerta', () => {
  // 🔴 HALLAZGO DE ESTE TICKET (regla 37, arreglado dentro porque es la misma zona y tumbaba el
  // criterio «no queda ningún albarán vacío por el camino»):
  //
  // La siguiente acción `nuevo` de la cabecera NO pasaba por el prellenado de SCRUM-257 — hacía su
  // propio POST y creaba un albarán VACÍO con el número ya quemado. Era el camino MÁS CORTO y el
  // PEOR, y nadie lo había enumerado: el ticket hablaba solo del botón de la sección.
  //
  // Es el defecto que SCRUM-366 documentó en este mismo fichero: lo que no se puede nombrar se
  // reescribe distinto. Ahora el alta se nombra una vez y los dos botones la llaman.
  const sf = ts.createSourceFile('jobDetailView.js', FRONT, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const llamadas = [];
  (function visitar(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'abrirAltaAlbaran') {
      llamadas.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
    }
    ts.forEachChild(n, visitar);
  })(sf);

  assert.equal(llamadas.length, 2,
    `🔴 el alta se llama desde ${llamadas.length} sitio(s) y deberían ser DOS: el botón «+ Nuevo ` +
    'albarán» de la sección y la siguiente acción `nuevo` de la cabecera. Si baja a uno, hay un ' +
    'camino que volvió a crear por su cuenta; si sube, hay un alta nueva sin medir.');
});

test('SCRUM-303 · 🔴 EL ORIGEN (SCRUM-367) SOBREVIVE A LA HOJA, ida y vuelta', () => {
  // POR QUÉ ESTO ESTÁ EN ESTE TICKET: al meter la creación por el editor, las líneas prellenadas
  // pasan a reconstruirse **desde los inputs**, y `quoteLineIndex` no tiene input. Sin esto, mi
  // propio cambio dejaba a SCRUM-367 sin dato el día que se mergeó.
  //
  // Y de paso destapa que la EDICIÓN ya lo perdía en `main`: SCRUM-367 demostró que el backend lo
  // CONSERVA (`validarLineas`), pero nadie comprobó que el front lo MANDE — y no lo hacía.
  //
  // Se emparejan los dos extremos DERIVANDO el nombre del que escribe: si alguien renombra uno
  // solo, esto cae. Comparar dos literales tecleados aquí no probaría que hablan entre ellos.
  const sf = ts.createSourceFile('jobDetailView.js', FRONT, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  const rango = (pred) => {
    let out = null;
    (function b(n) { if (!out && pred(n)) { out = [n.getStart(sf), n.getEnd()]; return; } if (!out) ts.forEachChild(n, b); })(sf);
    return out;
  };
  // `mkRow` es una arrow asignada a const: se localiza por su declarador.
  const enMkRow = rango((n) => ts.isVariableDeclaration(n) && n.name.getText(sf) === 'mkRow');
  assert.ok(enMkRow, '🔴 ESCÁNER CIEGO: no encuentro `mkRow`');

  // ESCRITURA: `r.dataset.<algo> = …` dentro de mkRow.
  const escritos = [];
  (function visitar(n) {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(n.left)
        && ts.isPropertyAccessExpression(n.left.expression)
        && n.left.expression.name.text === 'dataset'
        && n.getStart(sf) >= enMkRow[0] && n.getEnd() <= enMkRow[1]) {
      escritos.push(n.left.name.text);
    }
    ts.forEachChild(n, visitar);
  })(sf);

  assert.ok(escritos.length > 0,
    '🔴 LA FILA NO GUARDA EL ORIGEN.\n\n' +
    '  `mkRow` pinta un input por campo y `quoteLineIndex` no tiene input: si no queda en la fila,\n' +
    '  el guardado —que reconstruye la línea desde los inputs— lo pierde. El albarán deja de saber\n' +
    '  de qué partida del presupuesto salió, y C6 responde sobre una correspondencia que ya no\n' +
    '  existe. Es el mismo fallo que SCRUM-367 cerró en `validarLineas`, una capa más arriba.');

  // LECTURA: el MISMO nombre, leído fuera de mkRow (en el guardado) y puesto en la línea.
  for (const prop of escritos) {
    const lecturas = [];
    (function visitar(n) {
      if (ts.isPropertyAccessExpression(n) && n.name.text === prop
          && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'dataset'
          && !(n.getStart(sf) >= enMkRow[0] && n.getEnd() <= enMkRow[1])) {
        lecturas.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
      }
      ts.forEachChild(n, visitar);
    })(sf);
    assert.ok(lecturas.length > 0,
      `🔴 la fila guarda «${prop}» y NADIE lo lee al guardar: el dato viaja hasta la pantalla y ` +
      'se muere ahí. Escribir sin leer es exactamente un mecanismo verde y vacío.');
    // Y tiene que acabar EN LA LÍNEA que se manda, no en una variable suelta.
    assert.match(FRONT, new RegExp(`linea\\.${prop}\\s*=`),
      `🔴 «${prop}» se lee pero no se pone en la línea que se envía: no llega al backend.`);
  }
});

test('SCRUM-303 · RETROCOMPATIBILIDAD: sin `onGuardar` el editor sigue haciendo PATCH', () => {
  // Los albaranes que hoy están en BORRADOR vacíos siguen abriéndose y editándose: no se migran ni
  // se borran. Si el PATCH desapareciera, dejarían de poder editarse y nadie lo notaría hasta que
  // un pro intentara corregir uno en obra.
  const sf = ts.createSourceFile('jobDetailView.js', FRONT, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let patch = 0;
  (function visitar(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'apiRequest') {
      const destino = n.arguments[0]?.getText(sf) ?? '';
      const opciones = n.arguments[1]?.getText(sf) ?? '';
      if (/albaranes\/\$\{alb\.id\}/.test(destino) && /'PATCH'/.test(opciones)) patch++;
    }
    ts.forEachChild(n, visitar);
  })(sf);
  assert.equal(patch, 1,
    '🔴 el PATCH del editor de siempre ha desaparecido (o se ha duplicado). La edición de los ' +
    'albaranes que ya existen NO la toca este ticket.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// (c) LA OTRA CARA · el 409 del backend, intacto
// ═════════════════════════════════════════════════════════════════════════════════════════

const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const routerDe = (mod) => mod.default?.default ?? mod.default;

async function invocarAlta(job) {
  moduloPrisma.prisma.job = { findFirst: async () => job, findUnique: async () => job };
  moduloPrisma.prisma.$transaction = async () => ({
    id: 9, jobId: job?.id ?? 1, numero: 'A-2026-0001', fecha: new Date(),
    modoValoracion: 'SIN_VALORAR', lineas: [], estado: 'borrador', version: 1,
    merchantId: 7, createdAt: new Date(),
  });
  const router = routerDe(await import(DIST + 'modules/jobs/app/routes/jobs.routes.js'));
  const capa = router.stack.find((l) => l.route?.path === '/:id/albaranes' && l.route?.methods?.post);
  assert.ok(capa, '🔴 no existe POST /:id/albaranes: la ruta se renombró y este test no mira nada');

  let salida = null;
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b }; return this; },
    setHeader() { return this; },
  };
  const handlers = capa.route.stack;
  await handlers[handlers.length - 1].handle(
    { params: { id: String(job?.id ?? 1) }, body: {}, merchantId: 7, query: {}, headers: {} },
    res, () => {},
  );
  return salida;
}

test('SCRUM-303 · LAS DOS CARAS: sin presupuesto sigue dando 409 con su mensaje humano', async () => {
  const r = await invocarAlta({ id: 3, merchantId: 7, quoteId: null });
  assert.equal(r?.code, 409,
    `🔴 el guard de SCRUM-257 se ha debilitado: respondió ${r?.code} con ${JSON.stringify(r?.body)}`);
  assert.equal(r.body?.error, 'job_without_quote');
  assert.equal(r.body?.message, COPY_SIN_PRESUPUESTO,
    '🔴 sin `message`, el dashboard enseñaría el código crudo — el defecto que cerró SCRUM-275.');
});

test('SCRUM-303 · LAS DOS CARAS: con presupuesto sigue creando (201)', async () => {
  // El control que impide «arreglarlo» bloqueando todo: sin él, un guard que rechace SIEMPRE
  // dejaría el test de arriba en verde.
  const r = await invocarAlta({ id: 4, merchantId: 7, quoteId: 77 });
  assert.equal(r?.code, 201, `🔴 se bloquea también a los trabajos que SÍ tienen presupuesto: ${JSON.stringify(r?.body)}`);
});
