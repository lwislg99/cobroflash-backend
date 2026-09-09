// SCRUM-831 · LA LISTA DE ALBARANES OFRECE EL SIGUIENTE PASO DE CADA FILA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, MEDIDO EN EL CENSO DE LAS CINCO LISTAS (8-sep-2026)
//
// De las cinco listas del panel, Albaranes era **la única con CERO acciones en la fila**, la
// única cuya fila no se anunciaba pulsable, y la única cuya `.cell-actions` estaba ocupada por un
// enlace a otra pantalla.
//
// Y lo caro es que la pantalla YA SABÍA qué tocaba: pinta el estado en su columna y lo cuenta en
// sus filtros (`Borradores · Emitidos · Firmados`), y no ofrecía el siguiente paso de ninguno.
//
// 🔒 Una pantalla se ordena por lo que se hace en ella. Ésta estaba ordenada por lo que se consulta.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA CAUSA: LA TERCERA VEZ DEL MISMO DEFECTO
//
// La escalera del albarán ya existía —`ALBARAN_ACTION_REGISTRY` (SCRUM-302), por estado— y su
// resolutor, `primariaDeAlbaran`, vivía DENTRO de `jobDetailView.js`. Así que **la lista no podía
// preguntarle cuál es el siguiente paso**. Es SCRUM-366 (la escalera del Trabajo) y SCRUM-823
// (agendar), otra vez, con otro documento.
//
// ⚠️ Y NO SE COPIA LA FORMA DE TRABAJOS. La de Trabajos es una FUNCIÓN que mira otros documentos,
// el dinero y el estado; la de un albarán es una TABLA POR ESTADO, porque su siguiente paso lo
// decide él mismo. Se comparte la lección —una sola fuente, alcanzable—, no la forma.
//
// Este fichero es la red que corre SIEMPRE. La que pulsa en navegador es
// `npm run guard:albaranes-con-acciones`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const ACCION = leer('public/dashboard/js/albaranAccion.js');
const LISTA = leer('public/dashboard/js/albaranesView.js');
const DETALLE_TRABAJO = leer('public/dashboard/js/jobDetailView.js');
const REGISTRO = leer('public/dashboard/js/albaranActionsRegistry.js');
const PATRON = leer('public/dashboard/js/patronDetalleAcciones.js');
const HOJA = leer('public/dashboard/css/styles.css');

/** El resolutor, EJECUTADO con su registro y su patrón de verdad. */
function cargarResolutor() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(PATRON, ctx);
  vm.runInContext(REGISTRO, ctx);
  vm.runInContext(ACCION, ctx);
  return ctx.window;
}

const alb = (extra) => ({ estado: 'borrador', estadoFacturacion: 'sin_facturar', modoValoracion: 'SIN_VALORAR', quote: null, ...extra });

// ═══ ① EL RESOLUTOR DECIDE, Y DECIDE DISTINTO POR ESTADO ════════════════════════════════════

test('SCRUM-831 · SUELO: el resolutor se carga y DISCRIMINA por estado', () => {
  const { primariaDeAlbaran } = cargarResolutor();
  assert.equal(typeof primariaDeAlbaran, 'function', '🔴 ESCÁNER CIEGO: el resolutor no se pudo cargar.');

  const respuestas = new Set([
    primariaDeAlbaran(alb({ estado: 'borrador' })),
    primariaDeAlbaran(alb({ estado: 'emitido' })),
    primariaDeAlbaran(alb({ estado: 'firmado', modoValoracion: 'VALORADO' })),
  ].map((r) => (r ? r.id : '(null)')));
  assert.ok(
    respuestas.size >= 3,
    '🔴 ESCÁNER CIEGO: los tres estados dan ' + respuestas.size + ' respuesta(s). Si dieran una,\n' +
    '  los tests de abajo pasarían sobre un resolutor que no mira el estado — que es justo la\n' +
    '  situación de la que sale este ticket: cero acciones para los tres.',
  );
});

test('SCRUM-831 · cada estado tiene su siguiente paso, y sale del REGISTRO', () => {
  const { primariaDeAlbaran } = cargarResolutor();
  assert.equal(primariaDeAlbaran(alb({ estado: 'borrador' })).id, 'btnEmitir');
  assert.equal(primariaDeAlbaran(alb({ estado: 'emitido' })).id, 'btnEnviarFirmar');
  assert.equal(
    primariaDeAlbaran(alb({ estado: 'firmado', modoValoracion: 'VALORADO', estadoFacturacion: 'parcial' })).id,
    'btnFacturar',
  );
  assert.equal(
    primariaDeAlbaran(alb({ estado: 'firmado', modoValoracion: 'SIN_VALORAR', quote: { id: 7 } })).id,
    'btnConvertirFactura',
    '🔴 la segunda primaria contextual de `firmado` no sale. Es la del parte SIN precios, que es\n' +
    '  el modo POR DEFECTO: perderla es perder el caso normal.',
  );
  // Y el que se pierde con más facilidad: firmado y ya facturado del todo → NO hay siguiente paso.
  assert.equal(
    primariaDeAlbaran(alb({ estado: 'firmado', modoValoracion: 'VALORADO', estadoFacturacion: 'facturado' })),
    null,
    '🔴 un albarán ya facturado del todo propone algo. `null` es información: «nada que hacer».',
  );
});

test('SCRUM-831 · 🔴 SIN LOS DOS DATOS NUEVOS, `firmado` se queda mudo POR FALTA DE DATO', () => {
  const { primariaDeAlbaran } = cargarResolutor();
  // Ésta es la avería escrita como test: así llegaba la fila ANTES de que el servidor mandara
  // `modoValoracion` y `quote`. Sin ellos, `undefined === 'VALORADO'` es `false` y las dos
  // condiciones caen — y la celda vacía se lee igual que «no hay nada que hacer».
  const comoLlegabaAntes = { estado: 'firmado', estadoFacturacion: 'sin_facturar' };
  assert.equal(
    primariaDeAlbaran(comoLlegabaAntes), null,
    '🔴 ESCÁNER CIEGO: si con los campos ausentes ya saliera una acción, el test de arriba no\n' +
    '  estaría probando que los datos hacen falta.',
  );
  // Y con ellos, sí decide. Los dos casos se pintaban igual y significan lo contrario.
  assert.ok(
    primariaDeAlbaran({ ...comoLlegabaAntes, modoValoracion: 'SIN_VALORAR', quote: { id: 1 } }),
    '🔴 con los datos puestos el resolutor sigue mudo: entonces no era falta de dato.',
  );
});

// ═══ ② EL RESOLUTOR ES ALCANZABLE POR LAS TRES SUPERFICIES ══════════════════════════════════

test('SCRUM-831 · el resolutor ya NO vive dentro de una vista', () => {
  assert.ok(
    /window\.primariaDeAlbaran = primariaDeAlbaran/.test(ACCION),
    '🔴 `albaranAccion.js` no lo expone en el global: volvemos al punto de partida.',
  );
  assert.ok(
    !/function primariaDeAlbaran\s*\(/.test(soloEjecutable(DETALLE_TRABAJO, { almohadillaEsComentario: false })),
    '🔴 `jobDetailView.js` vuelve a DEFINIR el resolutor. Ése es el defecto entero: mientras viva\n' +
    '  dentro de una vista, las demás no pueden nombrarlo — y la lista de Albaranes se quedó tres\n' +
    '  tickets sin una sola acción por eso.',
  );
  assert.ok(
    /primariaDeAlbaran\(/.test(soloEjecutable(LISTA, { almohadillaEsComentario: false })),
    '🔴 la LISTA no consulta el resolutor: entonces no sabe qué toca en cada fila.',
  );
});

test('SCRUM-831 · la lista NO reescribe la tabla de acciones', () => {
  const codigo = soloEjecutable(LISTA, { almohadillaEsComentario: false });
  // Si la lista escribiera sus propios `btnEmitir`/`btnEnviarFirmar`, sería la TERCERA fuente de
  // la misma tabla — el defecto que el registro de SCRUM-302 existe para impedir.
  for (const id of ['btnEmitir', 'btnEnviarFirmar', 'btnFacturar']) {
    assert.ok(
      !new RegExp("'" + id + "'").test(codigo),
      `🔴 la lista nombra \`${id}\` a mano. Quien decide qué acción toca es el registro; aquí sólo\n` +
      '  se pregunta. Copiar un id «para consultarlo rápido» es cómo nacen las dos fuentes.',
    );
  }
});

// ═══ ③ LA RANURA DE ACCIONES, DEVUELTA ══════════════════════════════════════════════════════

test('SCRUM-831 · `.cell-actions` es de las acciones; el Trabajo tiene su propia celda', () => {
  const codigo = soloEjecutable(LISTA, { almohadillaEsComentario: false });
  assert.ok(
    /tdTrabajo\.className = 'cell-trabajo'/.test(codigo),
    '🔴 el enlace al Trabajo vuelve a ocupar la ranura de acciones. Su propio comentario ya decía\n' +
    '  que estaba PRESTADA: «el día que esta fila reciba acciones de verdad, chocan».',
  );
  assert.ok(
    /tdAcciones\.className = 'cell-actions'/.test(codigo),
    '🔴 la columna de acciones no usa `cell-actions`, que es la ranura que la rejilla reconoce.',
  );
  assert.ok(
    /'Nº', 'Emisión', 'Entrega', 'Cliente', 'Trabajo', 'Estado', 'Acciones'/.test(codigo),
    '🔴 la cabecera no declara las siete columnas. «Acciones» no es rótulo nuevo: es el que ya\n' +
    '  usan `jobsView.js` y `quotesListView.js` para esta misma columna.',
  );
  // La rejilla de móvil le da su área, y SOLO a esta tabla: tocar la compartida movería a las
  // cuatro listas hermanas de golpe (la lección de `.table--trabajos`, SCRUM-727b).
  assert.ok(/\.table--albaranes/.test(HOJA), '🔴 falta el modificador `.table--albaranes` en la hoja.');
  const sinComentarios = HOJA.replace(/\/\*[\s\S]*?\*\//g, '');
  const bloque = sinComentarios.slice(sinComentarios.indexOf('.table--albaranes tbody tr'));
  const rejilla = bloque.slice(0, bloque.indexOf('}'));
  assert.ok(/trabajo/.test(rejilla), '🔴 la tarjeta de móvil no reserva área para el Trabajo.');
  assert.ok(/actions/.test(rejilla), '🔴 la tarjeta de móvil no reserva área para las acciones.');
});

// ═══ ④ REGLA 30 Y REGLA 4 ═══════════════════════════════════════════════════════════════════

test('SCRUM-831 · sin rótulo FIRMADO no se pinta botón: ni el id ni el marcador', () => {
  const codigo = soloEjecutable(LISTA, { almohadillaEsComentario: false });
  assert.ok(
    /if \(primaria && rotulo\)/.test(codigo),
    '🔴 la lista pinta el botón sin comprobar que haya rótulo. `btnConvertirFactura` no tiene uno\n' +
    '  aprobado, así que saldría su IDENTIFICADOR en pantalla — una tubería interna asomando— o el\n' +
    '  marcador `[PENDIENTE microcopy oficial]`, que caza `guard:marcadores-en-pantalla`.\n' +
    '  Sin firma no se pinta, y el hueco lo NOMBRA el guard en cada pasada (regla 30).',
  );
  assert.ok(
    !/\|\| primaria\.id/.test(codigo),
    '🔴 el rótulo cae hacia el identificador de la acción. Un id en pantalla no es un texto a\n' +
    '  medias: es un dato interno que el usuario no puede entender.',
  );
});

test('SCRUM-831 · regla 4: la vista pierde estilos en línea, no los gana', () => {
  // El trinquete de estilos en línea SÓLO BAJA. Este ticket se lleva tres de esta vista.
  const asignaciones = LISTA.split('\n')
    .filter((l) => /\.style\.cssText\s*=/.test(l.replace(/^\s*\/\/.*/, '')))
    .length;
  assert.ok(
    asignaciones <= 6,
    `🔴 \`albaranesView.js\` tiene ${asignaciones} asignaciones de \`style.cssText\` y el techo de este\n` +
    '  fichero quedó en 6 con SCRUM-831 (eran 9). Un trinquete sólo baja.',
  );
  for (const clase of ['alb-enlace', 'alb-numero', 'alb-chip-cobro']) {
    assert.ok(
      new RegExp('\\.' + clase + '[\\s,{:]').test(HOJA),
      `🔴 la clase \`.${clase}\` la escribe la vista y la hoja no la conoce (lección de SCRUM-666).`,
    );
  }
});

// ═══ ⑤ EL SERVIDOR MANDA LO QUE EL RESOLUTOR LEE ════════════════════════════════════════════

test('SCRUM-831 · la fila del listado trae `modoValoracion` y `quote`', () => {
  const dominio = soloEjecutable(leer('src/modules/jobs/domain/albaranesListado.ts'));
  for (const campo of ['modoValoracion', 'quote']) {
    assert.ok(
      new RegExp('\\n\\s*' + campo + ':').test(dominio),
      `🔴 la fila del listado no manda \`${campo}\`.\n\n` +
      '  Sin él las dos condiciones de `firmado` dan `false` y la fila se queda sin acción POR\n' +
      '  FALTA DE DATO — que se pinta igual que «no hay nada que hacer» y significa lo contrario.\n' +
      '  Es el defecto de SCRUM-816 con otro documento.',
    );
  }
  const rutas = soloEjecutable(leer('src/modules/jobs/app/routes/albaranes.routes.ts'));
  assert.ok(/modoValoracion: true/.test(rutas), '🔴 la consulta de albaranes no selecciona `modoValoracion`.');
  assert.ok(/quoteId: true/.test(rutas), '🔴 la consulta de Trabajos no selecciona `quoteId`.');
});
