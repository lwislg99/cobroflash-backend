// SCRUM-304 (C3) · LOS ALBARANES DEL TRABAJO: TABLA, Y UNA SOLA ACCIÓN QUE OBEDECE A C2.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CENSO CORRIGE AL TICKET, y por eso va PRIMERO
//
// El ticket titula «El defecto, medido» y lo que sigue es una captura y un cálculo de altura de
// pantalla. Derivado del código, lo que había NO era eso:
//
//   · Los albaranes no eran «tarjetas apiladas»: eran filas `.job-doc-row`, y SCRUM-319 (G4) ya
//     les había dado sección propia.
//   · `PDF`, `Firmar` y el `⋯` YA NO ESTABAN en la fila: se los llevó SCRUM-302 (C2) al detalle.
//   · Y quedaba una contradicción que no se ve leyendo ninguno de los dos censos por separado:
//     **la fila pintaba «Editar líneas» SIEMPRE** mientras el registro de C2 declara
//     `borrador: secundaria · emitido: oculta · firmado: oculta`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE VIGILA ESTE FICHERO
//
//   (a) NINGUNA ACCIÓN DESAPARECE: censo derivado de las acciones de la fila, con su destino, y
//       suelo que falla si el censo deja de encontrarlas (0 huérfanas y «no miré» son el mismo 0).
//   (b) LA ACCIÓN VISIBLE ES LA PRIMARIA DE SU ESTADO, comprobado ESTADO POR ESTADO — y con el
//       contexto de tres valores, que es donde el parcial se aplana si nadie mira.
//   (c) UNA SOLA FUENTE DE VERDAD: si C2 cambia su primaria, la tabla la sigue. Se prueba MUTANDO
//       el registro, no leyendo el código de la fila.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const RUTA_FILA = path.join(RAIZ, 'public/dashboard/js/jobDetailView.js');
const FILA = fs.readFileSync(RUTA_FILA, 'utf8');
const INDEX = fs.readFileSync(path.join(RAIZ, 'public/dashboard/index.html'), 'utf8');

const registro = require('../public/dashboard/js/albaranActionsRegistry.js');
const ley = require('../public/dashboard/js/patronDetalleAcciones.js');

const sf = ts.createSourceFile('jobDetailView.js', FILA, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

/** El bloque `albaranes.forEach(...)`, que es la fila entera. */
function bloqueFila() {
  let r = null;
  (function b(n) {
    if (!r && ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && n.expression.name.text === 'forEach'
        && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === 'albaranes') {
      r = [n.getStart(sf), n.getEnd()];
      return;
    }
    if (!r) ts.forEachChild(n, b);
  })(sf);
  return r;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// (a) EL CENSO · ninguna acción desaparece
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Las acciones que la fila monta: `mkBtn(rótulo, …)` dentro del bloque. */
function censarAccionesDeLaFila() {
  const bloque = bloqueFila();
  if (!bloque) return null;
  const dentro = (n) => n.getStart(sf) >= bloque[0] && n.getEnd() <= bloque[1];
  const out = [];
  (function v(n) {
    if (dentro(n) && ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'mkBtn') {
      out.push({ rotulo: n.arguments[0].getText(sf), linea: linea(n) });
    }
    ts.forEachChild(n, v);
  })(sf);
  return out;
}

test('SCRUM-304 · SUELO del censo: el bloque de la fila existe y tiene acciones', () => {
  // Sin esto, «ninguna acción huérfana» y «no encontré ninguna acción» son el mismo verde.
  const bloque = bloqueFila();
  assert.ok(bloque, '🔴 ESCÁNER CIEGO: no encuentro `albaranes.forEach` — ¿se renombró la vista?');
  const acciones = censarAccionesDeLaFila();
  assert.ok(acciones.length > 0,
    '🔴 ESCÁNER CIEGO: el censo no ve NINGUNA acción en la fila. Todo lo de abajo pasaría en vacío.');
});

test('SCRUM-304 · NINGÚN MECANISMO DE LA FILA SE QUEDA SIN SITIO', () => {
  // Los dos PUENTES de C2 (`btnFacturar`, `btnEditarLineas`) no hacen el trabajo en la página:
  // navegan hasta aquí, porque `openFacturarParcialSheet` y `openAlbEditorSheet` están ANIDADAS en
  // esta vista. Si la tabla los borra, esos botones se vuelven callejones sin salida y el pro
  // descubre que no puede facturar lo que ha entregado. `scrum302-sin-callejones` lo vigila desde
  // el otro lado; esto lo ancla desde éste.
  const paginaDetalle = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/albaranDetailView.js'), 'utf8');
  const m = paginaDetalle.match(/const PUENTES_A_LA_FILA = \{([\s\S]*?)\}/);
  assert.ok(m, '🔴 ESCÁNER CIEGO: no encuentro `PUENTES_A_LA_FILA` en la página del albarán');
  const mecanismos = [...m[1].matchAll(/:\s*'([A-Za-z]+)'/g)].map((x) => x[1]);
  assert.ok(mecanismos.length >= 2, `🔴 ESCÁNER CIEGO: solo derivo ${mecanismos.length} puente(s)`);

  // ⚠️ NO BASTA CON QUE EL MECANISMO SE MENCIONE: tiene que ser ALCANZABLE. La primera versión de
  // este guard buscaba el nombre en el bloque y pasaba en verde con el botón construido y NUNCA
  // añadido — `const editBtn = () => mkBtn(…, () => openAlbEditorSheet(alb))` sigue nombrándolo
  // aunque nadie lo cuelgue. Escribir sin leer otra vez, esta vez dentro del propio guard.
  // Por eso se deriva de los `appendChild` y se resuelve UN nivel de indirección.
  const bloque = bloqueFila();
  const dentro = (n) => n.getStart(sf) >= bloque[0] && n.getEnd() <= bloque[1];

  // Ayudantes locales del bloque: `const X = () => …` — para expandir `acts.appendChild(X())`.
  const locales = new Map();
  (function v(n) {
    if (dentro(n) && ts.isVariableDeclaration(n) && n.name && n.initializer && ts.isIdentifier(n.name)) {
      locales.set(n.name.text, n.initializer.getText(sf));
    }
    ts.forEachChild(n, v);
  })(sf);

  // Lo que de verdad se cuelga de la fila.
  const colgados = [];
  (function v(n) {
    if (dentro(n) && ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && n.expression.name.text === 'appendChild' && n.arguments.length === 1) {
      let texto = n.arguments[0].getText(sf);
      for (const [nombre, cuerpo] of locales) {          // un nivel: `editBtn()` → su cuerpo
        if (new RegExp(`\\b${nombre}\\b`).test(texto)) texto += '\n' + cuerpo;
      }
      colgados.push(texto);
    }
    ts.forEachChild(n, v);
  })(sf);

  assert.ok(colgados.length > 0, '🔴 ESCÁNER CIEGO: la fila no cuelga NADA — el censo mediría el vacío');

  for (const fn of mecanismos) {
    assert.ok(
      colgados.some((t) => t.includes(fn)),
      `🔴 «${fn}» ya no es ALCANZABLE desde la fila. La página del albarán tiene un botón que NAVEGA ` +
      'hasta aquí para usarlo: sin nada que colgar, ese botón aterriza en un Trabajo donde no hay ' +
      'qué pulsar. Nada peta, ningún test se pone rojo, y el pro descubre que no puede facturar lo ' +
      'que ha entregado.',
    );
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// (b) LA ACCIÓN VISIBLE ES LA PRIMARIA DE SU ESTADO · estado por estado
// ═════════════════════════════════════════════════════════════════════════════════════════

/** La misma decisión que toma la fila, extraída del fichero y ejecutable aquí. */
function decisoresDeLaFila() {
  const corte = (desde, hasta) => {
    const i = FILA.indexOf(desde);
    assert.ok(i >= 0, `🔴 ESCÁNER CIEGO: no encuentro «${desde}»`);
    const j = FILA.indexOf(hasta, i + 1);
    assert.ok(j > i, `🔴 ESCÁNER CIEGO: no encuentro el FINAL «${hasta}» tras «${desde}»`);
    return FILA.slice(i, j);
  };
  const src = corte('function ctxAlbaranEnFila', '\n// ── SCRUM-303');
  assert.ok(src.length > 200 && src.length < 3000,
    `🔴 ESCÁNER CIEGO: el recorte mide ${src.length} caracteres — no son los decisores.`);
  return new Function('window', `${src}\nreturn { ctxAlbaranEnFila, primariaDeAlbaran, destinoEnFila };`)({
    ALBARAN_ACTION_REGISTRY: registro.ALBARAN_ACTION_REGISTRY,
    destinoEfectivo: ley.destinoEfectivo,
  });
}

const ALB = (extra) => ({ estado: 'borrador', modoValoracion: 'SIN_VALORAR', estadoCobro: 'sin_facturar', ...extra });

test('SCRUM-304 · la acción visible es la PRIMARIA de su estado — LOS TRES estados', () => {
  const { primariaDeAlbaran } = decisoresDeLaFila();

  // Se deriva del registro lo que se espera; escribir 'btnEmitir' a mano aquí sería la segunda
  // fuente de verdad dentro del propio guard.
  for (const estado of registro.ALBARAN_STATES) {
    const conPendiente = ALB({ estado, modoValoracion: 'VALORADO', estadoCobro: 'parcial' });
    const ctx = { 'valorado-con-pendiente': true };
    const esperada = registro.ALBARAN_ACTION_REGISTRY
      .find((a) => ley.destinoEfectivo(a, estado, ctx) === 'primaria');
    const obtenida = primariaDeAlbaran(conPendiente);
    assert.equal(
      obtenida?.id ?? null, esperada?.id ?? null,
      `🔴 en «${estado}» la fila pinta ${obtenida?.id ?? '(nada)'} y C2 dice ${esperada?.id ?? '(nada)'}. ` +
      'Como la tabla enseña UNA SOLA acción y el resto vive en el detalle, el profesional no verá ' +
      'la que necesita.',
    );
  }
});

test('SCRUM-304 · 🔴 EL PARCIAL NO SE APLANA: un albarán a medias SIGUE teniendo qué hacer', () => {
  const { primariaDeAlbaran } = decisoresDeLaFila();

  const aMedias = ALB({ estado: 'firmado', modoValoracion: 'VALORADO', estadoCobro: 'parcial' });
  assert.equal(
    primariaDeAlbaran(aMedias)?.id, 'btnFacturar',
    '🔴 un albarán FIRMADO y facturado A MEDIAS se queda sin acción. Tiene cantidad pendiente: ' +
    'sigue habiendo algo que hacer, y una tabla que lo pinte como terminado se lo esconde.',
  );

  const sinFacturar = ALB({ estado: 'firmado', modoValoracion: 'VALORADO', estadoCobro: 'sin_facturar' });
  assert.equal(primariaDeAlbaran(sinFacturar)?.id, 'btnFacturar', '🔴 el que no se ha facturado nada tampoco');

  // Y el otro lado: del todo facturado NO tiene siguiente paso, y la celda vacía es información.
  const cerrado = ALB({ estado: 'firmado', modoValoracion: 'VALORADO', estadoCobro: 'facturado' });
  assert.equal(
    primariaDeAlbaran(cerrado), null,
    '🔴 se ofrece «facturar» sobre un albarán YA FACTURADO DEL TODO: un botón que solo puede fallar.',
  );

  // Sin precios no se puede facturar por definición.
  assert.equal(primariaDeAlbaran(ALB({ estado: 'firmado' })), null, '🔴 ofrece facturar un albarán SIN precios');
});

test('SCRUM-304 · 🔴 EL CONTEXTO LEE EL CAMPO QUE ESTE ENDPOINT SIRVE, no el del detalle', () => {
  // EL DETALLE QUE ENVENENA EN SILENCIO: el mismo derivado de tres valores viaja con nombre
  // DISTINTO según el endpoint — `estadoFacturacion` en el del albarán, `estadoCobro` en el del
  // Trabajo. Copiar el ctx de C2 literalmente daría `undefined`, y `undefined !== 'facturado'` es
  // TRUE: la fila ofrecería facturar sobre albaranes ya cerrados, sin error y sin rojo.
  const { ctxAlbaranEnFila } = decisoresDeLaFila();

  assert.equal(
    ctxAlbaranEnFila({ modoValoracion: 'VALORADO', estadoCobro: 'facturado' })['valorado-con-pendiente'],
    false,
    '🔴 EL CONTEXTO NO VE EL CAMPO. Si lee `estadoFacturacion` (el nombre del OTRO endpoint), aquí ' +
    'llega `undefined` y el contexto dice «queda pendiente» SIEMPRE.',
  );
  assert.equal(
    ctxAlbaranEnFila({ modoValoracion: 'VALORADO', estadoCobro: 'parcial' })['valorado-con-pendiente'],
    true, '🔴 el parcial deja de contar como pendiente',
  );

  // Suelo: el nombre que se lee tiene que ser el que el backend manda en ESTE endpoint.
  const rutas = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/app/routes/jobs.routes.ts'), 'utf8');
  assert.match(rutas, /estadoCobro:\s*estadoCobroAlbaran\(/,
    '🔴 ESCÁNER CIEGO: el endpoint del Trabajo ya no sirve `estadoCobro` para sus albaranes. Si ' +
    'cambió de nombre, el contexto de la fila está leyendo un campo que no llega.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// (c) UNA SOLA FUENTE DE VERDAD · si C2 cambia, la tabla sigue
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-304 · 🔴 ROJO POR EL MECANISMO: si C2 mueve su primaria, la tabla la sigue', () => {
  // No se comprueba leyendo el código de la fila: se MUTA el registro de C2 y se exige que la
  // decisión cambie con él. Si la fila tuviera su propia jerarquía, esto seguiría dando lo de
  // antes — que es exactamente el defecto de SCRUM-240 que hay que impedir.
  const original = registro.ALBARAN_ACTION_REGISTRY.map((a) => ({ ...a, destinos: { ...a.destinos } }));
  try {
    const emitir = registro.ALBARAN_ACTION_REGISTRY.find((a) => a.id === 'btnEmitir');
    const pdf = registro.ALBARAN_ACTION_REGISTRY.find((a) => a.id === 'btnPdf');
    emitir.destinos.borrador = 'secundaria';
    pdf.destinos.borrador = 'primaria';

    const { primariaDeAlbaran } = decisoresDeLaFila();
    assert.equal(
      primariaDeAlbaran(ALB({ estado: 'borrador' }))?.id, 'btnPdf',
      '🔴 LA TABLA NO SIGUE A C2: se ha movido la primaria de `borrador` en el registro y la fila ' +
      'sigue pintando la de antes. Hay DOS fuentes de verdad para el mismo documento.',
    );
  } finally {
    registro.ALBARAN_ACTION_REGISTRY.forEach((a, i) => { a.destinos = original[i].destinos; });
  }
});

test('SCRUM-304 · CONTROL NEGATIVO: tocar un destino que NO es primaria no mueve la tabla', () => {
  // Sin este control, el test de arriba pasaría igual con una fila que cambiase de acción ante
  // CUALQUIER edición del registro — o que la releyera entera cada vez sin criterio.
  const original = registro.ALBARAN_ACTION_REGISTRY.map((a) => ({ ...a, destinos: { ...a.destinos } }));
  try {
    const foto = registro.ALBARAN_ACTION_REGISTRY.find((a) => a.id === 'btnFoto');
    foto.destinos.borrador = 'secundaria'; // era `overflow`: cambia, pero no es la primaria

    const { primariaDeAlbaran } = decisoresDeLaFila();
    assert.equal(
      primariaDeAlbaran(ALB({ estado: 'borrador' }))?.id, 'btnEmitir',
      '🔴 la acción de la fila ha cambiado al mover un destino que NO es la primaria: la tabla no ' +
      'está leyendo la primaria, está reaccionando a cualquier cosa.',
    );
  } finally {
    registro.ALBARAN_ACTION_REGISTRY.forEach((a, i) => { a.destinos = original[i].destinos; });
  }
});

test('SCRUM-304 · «Editar líneas» obedece a C2 y deja de pintarse SIEMPRE', () => {
  // 🔴 LA CONTRADICCIÓN QUE YA EXISTÍA, y que solo se ve contrastando los dos censos: la fila lo
  // pintaba en los tres estados mientras C2 lo declara `oculta` en `emitido` y `firmado`.
  const { destinoEnFila } = decisoresDeLaFila();
  for (const estado of registro.ALBARAN_STATES) {
    const esperado = registro.ALBARAN_ACTION_REGISTRY.find((a) => a.id === 'btnEditarLineas').destinos[estado];
    const obtenido = destinoEnFila('btnEditarLineas', ALB({ estado }));
    assert.equal(obtenido, esperado,
      `🔴 en «${estado}» la fila dice «${obtenido}» para editar líneas y C2 dice «${esperado}»`);
  }
  // Y sigue ALCANZABLE en borrador: es el puente que no se puede borrar.
  assert.notEqual(destinoEnFila('btnEditarLineas', ALB({ estado: 'borrador' })), 'oculta',
    '🔴 «Editar líneas» ya no se pinta en NINGÚN estado: el botón del detalle queda sin destino.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA TABLA · estructura, orden de carga y microcopy
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-304 · es una TABLA del inventario, y la cabecera no se pinta sin filas', () => {
  assert.match(FILA, /tabla\.className = 'table table--cards-mobile'/,
    '🔴 la tabla ya no adopta `.table--cards-mobile`. Sin ese patrón, en móvil vuelve a ser una ' +
    'tabla de cinco columnas y la columna Acción se sale de pantalla — que es lo que dos rondas de ' +
    'quitar columnas NO consiguieron arreglar.');
  assert.match(FILA, /wrap\.className = 'table-scroll'/, '🔴 falta el `.table-scroll` del patrón');
  assert.match(
    FILA, /if \(!reparto\.albaranes\.length\) \{[\s\S]{0,200}?vacioAlb/,
    '🔴 la tabla se monta sin comprobar que haya albaranes: un Trabajo sin ninguno enseñaría una ' +
    'cabecera con nada debajo, que es justo lo que el ticket pide evitar.',
  );
});

test('SCRUM-304 · el patrón móvil es EL MISMO que usa la lista global de albaranes', () => {
  // Dos formas móviles para el MISMO documento según la pantalla sería SCRUM-240 en la capa
  // visual. Se deriva del otro fichero, no se escribe el nombre del patrón a mano en los dos.
  const lista = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/albaranesView.js'), 'utf8');
  const m = lista.match(/className = 'table (table--[a-z-]+)'/);
  assert.ok(m, '🔴 ESCÁNER CIEGO: `albaranesView.js` ya no declara un patrón móvil de tabla');
  assert.ok(FILA.includes(`table ${m[1]}`),
    `🔴 la lista global usa «${m[1]}» y esta tabla usa otro. El mismo albarán se leería con dos ` +
    'formas distintas según la pantalla desde la que se mire.');

  // Y el patrón tiene que existir de verdad en la hoja de estilos, con su bump de 44 px.
  const css = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
  assert.ok(css.includes(`.${m[1]} thead { display: none; }`),
    `🔴 «${m[1]}» no está definido en styles.css: la clase no haría nada y la tabla seguiría siendo tabla`);
  assert.match(css, new RegExp(`\\.${m[1]} td\\.cell-actions button[\\s\\S]{0,80}min-height: 44px`),
    '🔴 el patrón ya no lleva el `min-height: 44px` de las acciones — era lo que subía los botones ' +
    'de 30 a 44 px sin tocar `.btn-sm`.');

  // Las celdas llevan sus ranuras: sin ellas la clase está puesta y la rejilla no se usa (es lo
  // que le pasa hoy a `albaranesView.js`, medido y reportado, pero no se arregla aquí: otro carril).
  for (const ranura of ['cell-client', 'cell-date', 'cell-status', 'cell-id', 'cell-actions']) {
    assert.ok(FILA.includes(ranura), `🔴 falta la ranura «${ranura}»: la card se recompondría a medias`);
  }
});

test('SCRUM-304 · el rótulo de la acción NO se reescribe aquí: sale de C2', () => {
  // Escribir «Emitir» otra vez en esta vista sería la segunda lista de rótulos, y divergirían el
  // día que alguien retoque uno.
  assert.match(FILA, /ROTULOS_ALBARAN\[primaria\.id\]/,
    '🔴 la fila ya no lee los rótulos de `ROTULOS_ALBARAN`: hay una segunda lista de textos.');

  // …y por eso el ORDEN DE CARGA importa: si `albaranDetailView.js` dejara de cargarse antes, el
  // rótulo saldría vacío y la columna quedaría muda sin que nada fallase.
  const iDetalle = INDEX.indexOf('js/albaranDetailView.js');
  const iFila = INDEX.indexOf('js/jobDetailView.js');
  assert.ok(iDetalle >= 0 && iFila >= 0, '🔴 ESCÁNER CIEGO: no encuentro los dos scripts en index.html');
  assert.ok(iDetalle < iFila,
    '🔴 `albaranDetailView.js` ha dejado de cargarse ANTES que `jobDetailView.js`: `ROTULOS_ALBARAN` ' +
    'no existiría al pintar la tabla y la columna Acción saldría con el id crudo del botón.');
});

test('SCRUM-304 · REGLA 30: los nombres de columna son EXACTAMENTE los aprobados', () => {
  // Antes este guard exigía el marcador de pendiente. Aprobados los cinco (5-ago-2026), su trabajo
  // es el contrario: que nadie los reescriba. Retocar copy aprobada es decisión del fundador.
  const APROBADOS = { colNumero: 'Nº', colFecha: 'Fecha', colEstado: 'Estado', colLineas: 'Líneas', colAccion: 'Acción' };
  const m = FILA.match(/const ALB_TABLA_COPY = \{([\s\S]*?)\n\};/);
  assert.ok(m, '🔴 ESCÁNER CIEGO: no encuentro `ALB_TABLA_COPY`');

  const leidos = Object.fromEntries([...m[1].matchAll(/(\w+):\s*'([^']*)'/g)].map((x) => [x[1], x[2]]));
  assert.deepEqual(Object.keys(leidos).sort(), Object.keys(APROBADOS).sort(),
    '🔴 las columnas ya no son las cinco aprobadas: hay texto nuevo (o falta uno).');
  for (const [k, v] of Object.entries(APROBADOS)) {
    assert.equal(leidos[k], v, `🔴 la columna «${k}» ya no dice lo aprobado: ${JSON.stringify(leidos[k])}`);
  }
  // Y ninguna arrastra el marcador: dejarlo puesto en algo YA decidido no es prudencia, es ruido —
  // y aquí además costaba tres columnas de ancho a 390 px.
  for (const v of Object.values(leidos)) {
    assert.ok(!v.includes('[PENDIENTE microcopy oficial]'),
      `🔴 queda el marcador en una columna ya aprobada: ${JSON.stringify(v)}`);
  }
});
