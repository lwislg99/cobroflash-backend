// tests/scrum777-el-modal-escondido-no-mata-la-n.test.mjs — SCRUM-777
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ABRIR Y CERRAR UNA FICHA DE CLIENTE MATABA LA TECLA «N» EN TODA LA APLICACIÓN.
//
// `sePuedeDisparar` miraba la PRESENCIA de un `.modal-overlay`, no su VISIBILIDAD. Y
// `customersView` cerraba su modal con `style.display = "none"` dejándolo colgado del `body` para
// reutilizarlo. Resultado, medido con teclas REALES en Edge: después de un gesto que el
// profesional hace veinte veces al día, el atajo dejaba de funcionar en TODAS las pantallas hasta
// recargar. Sin error, sin síntoma.
//
// 🔴 Y NO LO VIERON NI SCRUM-599 NI SCRUM-768 porque los dos probaban la condición con un OBJETO
// de mentira (`{key:'n', …}`) y un documento de mentira. Apareció la primera vez que se pulsaron
// teclas de verdad. Ésa es la lección, y por eso este fichero prueba sobre la VISTA REAL montada,
// no sobre un doble.
//
// ── SE ARREGLARON LAS DOS COSAS, Y HACÍAN FALTA LAS DOS ─────────────────────────────────────
// (a) LA PIEZA mira visibilidad, no presencia. Cierra el atajo.
// (b) CLIENTES descuelga su modal al cerrarlo. Hacía falta igual, y no por elegancia: la regla
//     `body:has(.modal-overlay) #tut-help-btn { display:none !important }` de `styles.css` es
//     ESTRUCTURAL —mira si el nodo existe, no si se ve—, así que con el residuo el botón
//     flotante de ayuda se apagaba para siempre. Medido en Edge: con residuo, `display:none` y
//     caja 0×0; al borrarlo, vuelve. Eso NO pasa por la pieza: (a) no lo arreglaba.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { cargarDashboard, pintarVista, todos, datosDeMuestra } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');
const require = createRequire(import.meta.url);
const ts = require('typescript');

const TECLA_N = { key: 'n', metaKey: false, ctrlKey: false, altKey: false, target: null };

/** Monta Clientes y devuelve con qué trabajar: el documento, la pieza y los botones. */
async function fichaDeCliente() {
  const banco = cargarDashboard(RAIZ, { datos: datosDeMuestra });
  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `🔴 la vista de Clientes no monta: ${r.error && r.error.message}`);
  const doc = banco.ctx.document;
  const abrir = todos(r.contenedor).filter((n) => n.tagName === 'BUTTON'
    && /btn-primary/.test(n.className || '') && /nuevo/i.test(n.textContent || ''))[0];
  assert.ok(abrir, '🔴 CIEGO: no encuentro el botón que abre la ficha; no puedo medir nada.');
  const cerrar = () => todos(doc.body).filter((n) => n.tagName === 'BUTTON'
    && /cancelar/i.test(n.textContent || ''))[0];
  return { banco, doc, abrir, cerrar };
}

const hayModal = (banco, doc) => !!doc.querySelector(banco.ctx.atajoNuevo.SELECTOR_MODAL);
const puedeLaN = (banco, doc) => banco.ctx.atajoNuevo.sePuedeDisparar(TECLA_N, doc);

// ═══ ① EL QUE DECIDE, sobre la vista REAL ════════════════════════════════════════════════════

test('SCRUM-777 · 🔴 abrir y CERRAR la ficha de cliente NO deja muerta la «N»', async () => {
  const { banco, doc, abrir, cerrar } = await fichaDeCliente();

  // SUELO: sin tocar nada la «N» funciona. Sin esto, un `true` al final no probaría nada.
  assert.equal(hayModal(banco, doc), false, '🔴 SUELO: ya hay un modal antes de abrir ninguno.');
  assert.equal(puedeLaN(banco, doc), true, '🔴 SUELO: la «N» ya estaba muerta antes de empezar.');

  abrir.click();
  // ✅ CONTROL POSITIVO, y es el que puede romperse por el otro lado: con la ficha ABIERTA la «N»
  // TIENE que seguir sin disparar. Ésa es la razón de existir de `sePuedeDisparar`.
  assert.equal(hayModal(banco, doc), true, '🔴 la ficha no ha abierto ningún overlay: no mido nada.');
  assert.equal(puedeLaN(banco, doc), false,
    '🔴 CON LA FICHA ABIERTA LA «N» DISPARA. El arreglo se ha pasado de frenada: el atajo abriría '
    + 'otra creación encima de un formulario a medio llenar, que es lo que la condición existe '
    + 'para impedir.');

  const cerrarBtn = cerrar();
  assert.ok(cerrarBtn, '🔴 CIEGO: no encuentro por dónde se cierra la ficha.');
  cerrarBtn.click();

  assert.equal(puedeLaN(banco, doc), true,
    '🔴 TRAS CERRAR LA FICHA, LA «N» SIGUE MUERTA. Es el defecto de SCRUM-777: un gesto que el '
    + 'profesional hace veinte veces al día desactivaba el atajo en TODAS las pantallas hasta '
    + 'recargar, sin error y sin síntoma.');
});

test('SCRUM-777 · 🔴 y la ficha SE PUEDE REABRIR: se descuelga, no se destruye', async () => {
  const { banco, doc, abrir, cerrar } = await fichaDeCliente();
  abrir.click();
  const primera = doc.querySelector('.modal-overlay');
  cerrar().click();
  assert.equal(hayModal(banco, doc), false,
    '🔴 al cerrar sigue habiendo un overlay colgado: `closeModal` no lo ha descolgado.');

  abrir.click();
  const segunda = doc.querySelector('.modal-overlay');
  assert.ok(segunda,
    '🔴 LA FICHA YA NO SE REABRE. Descolgarla al cerrar ha roto su ciclo de vida: `openModal` la '
    + 'reutiliza (`if (!modalBackdrop) buildModal()`) y hay que volver a colgarla del `body`.');
  assert.equal(segunda, primera,
    '🔴 la ficha se ha RECONSTRUIDO en vez de reutilizarse. `buildModal` cablea campos y oyentes '
    + 'una sola vez: reconstruirla es otro ciclo de vida y no es lo que este ticket arregla.');
  assert.equal(puedeLaN(banco, doc), false, '🔴 con la ficha reabierta la «N» vuelve a disparar.');
});

// ═══ ② EL CRITERIO DE LA PIEZA — visibilidad, no presencia ═══════════════════════════════════

test('SCRUM-777 · la pieza distingue un modal ESCONDIDO de uno DELANTE', async () => {
  const banco = cargarDashboard(RAIZ);
  const A = banco.ctx.atajoNuevo;
  const nodo = (display) => ({ style: display === undefined ? {} : { display } });
  const docCon = (n) => ({ querySelector: () => n, querySelectorAll: () => (n ? [n] : []) });

  assert.equal(A.sePuedeDisparar(TECLA_N, docCon(nodo('none'))), true,
    '🔴 un overlay con `display:none` sigue matando el atajo: la pieza mira presencia, no '
    + 'visibilidad. Es el defecto entero de este ticket.');
  assert.equal(A.sePuedeDisparar(TECLA_N, docCon(nodo('flex'))), false,
    '🔴 un overlay VISIBLE ha dejado de contar: el atajo dispararía encima de un modal abierto.');
  assert.equal(A.sePuedeDisparar(TECLA_N, docCon(nodo(undefined))), false,
    '🔴 FAIL-CLOSED ROTO: un nodo del que no se puede medir nada tiene que contar como delante. '
    + 'Ante la duda no abrir es recuperable; abrir encima de un formulario a medio llenar, no.');
  assert.equal(A.sePuedeDisparar(TECLA_N, docCon(null)), true,
    '🔴 sin ningún modal en el documento la «N» tiene que poder disparar.');

  // 🔴 Y EL CASO QUE `querySelector` NO VEÍA: con DOS overlays, uno escondido delante del otro.
  // Antes se miraba sólo el primero; ahora se recorren todos.
  const dos = [nodo('none'), nodo('flex')];
  assert.equal(A.sePuedeDisparar(TECLA_N, { querySelector: () => dos[0], querySelectorAll: () => dos }), false,
    '🔴 con un overlay escondido DELANTE de uno visible, la pieza se queda con el primero y deja '
    + 'disparar la «N» encima de un modal abierto.');
});

test('SCRUM-777 · lo que el criterio NO mira, y las dos razones están medidas', () => {
  const pieza = fs.readFileSync(path.join(DIR_JS, 'atajoNuevo.js'), 'utf8');
  const sf = ts.createSourceFile('atajoNuevo.js', pieza, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  // Por AST: los comentarios de este fichero NOMBRAN `opacity` y `offsetParent` para explicar por
  // qué NO se usan. Un `includes` sobre el fuente se cazaría a sí mismo (SCRUM-203).
  const propiedades = [];
  const v = (n) => {
    if (ts.isPropertyAccessExpression(n)) propiedades.push(n.name.text);
    ts.forEachChild(n, v);
  };
  v(sf);
  assert.ok(propiedades.includes('display'),
    '🔴 SUELO: el criterio ya no lee `display`; este control no sabe lo que está mirando.');
  assert.equal(propiedades.includes('opacity'), false,
    '🔴 el criterio ha empezado a mirar `opacity`. MEDIDO: `.modal-overlay` lleva '
    + '`animation: fade-in .15s` y `@keyframes fade-in` arranca en `opacity: 0`, así que la «N» '
    + 'dispararía durante los primeros fotogramas de un modal que se abre DE VERDAD. Y un overlay '
    + 'transparente se sigue comiendo los clics: está delante aunque no se vea.');
  assert.equal(propiedades.includes('offsetParent'), false,
    '🔴 el criterio ha empezado a mirar `offsetParent`. MEDIDO: `.modal-overlay` es '
    + '`position: fixed`, así que su `offsetParent` es `null` TAMBIÉN cuando está abierto: ese '
    + 'criterio daría por ausentes a todos los modales.');
});

// ═══ ③ EL CENSO — quién más cierra ESCONDIÉNDOSE ═════════════════════════════════════════════

/**
 * Por AST: variables a las que se les da una clase del `SELECTOR_MODAL`, y qué se les hace para
 * cerrarlas. Los comentarios no son nodos, así que la explicación de este ticket no se cuenta.
 *
 * ⚠️ LÍMITE DECLARADO, y está medido: sólo reconoce el overlay cuando se identifica por su CLASE
 * y se cierra a través de SU VARIABLE. Dos ficheros del árbol lo cierran por `id`
 * —`expensesView` con `getElementById('exp-modal')?.remove()` y `onboardingView` con un overlay
 * identificado por `id`— y los DOS borran; el censo no los clasifica y por eso salen en la lista
 * de CIEGOS en vez de contarse como limpios.
 */
function censoDeCierres() {
  const pieza = fs.readFileSync(path.join(DIR_JS, 'atajoNuevo.js'), 'utf8');
  const m = pieza.match(/SELECTOR_MODAL\s*=\s*\n?\s*"([^"]+)"/);
  assert.ok(m, '🔴 CIEGO: no sé leer `SELECTOR_MODAL` de la pieza.');
  const CLASES = m[1].split(',').map((s) => s.trim()).filter((s) => s.startsWith('.')).map((s) => s.slice(1));

  const esconden = [];
  const borran = [];
  const ciegos = [];
  for (const f of fs.readdirSync(DIR_JS).filter((x) => x.endsWith('.js'))) {
    if (f === 'atajoNuevo.js') continue;
    const src = fs.readFileSync(path.join(DIR_JS, f), 'utf8');
    if (!CLASES.some((c) => src.includes(c))) continue;
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const overlays = new Set();
    const tieneClase = (a) => ts.isStringLiteralLike(a) && CLASES.some((c) => a.text.split(/\s+/).includes(c));
    const v1 = (n) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
          && ts.isPropertyAccessExpression(n.left) && n.left.name.text === 'className'
          && ts.isIdentifier(n.left.expression) && tieneClase(n.right)) overlays.add(n.left.expression.text);
      if (ts.isVariableDeclaration(n) && n.initializer && ts.isCallExpression(n.initializer)
          && ts.isIdentifier(n.name) && n.initializer.arguments.some(tieneClase)) overlays.add(n.name.text);
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
          && ts.isIdentifier(n.left) && ts.isCallExpression(n.right)
          && n.right.arguments.some(tieneClase)) overlays.add(n.left.text);
      ts.forEachChild(n, v1);
    };
    v1(sf);
    if (!overlays.size) { ciegos.push(f); continue; }

    let borra = false;
    let esconde = false;
    const v2 = (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
          && n.expression.name.text === 'remove' && ts.isIdentifier(n.expression.expression)
          && overlays.has(n.expression.expression.text)) borra = true;
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
          && ts.isPropertyAccessExpression(n.left) && ts.isPropertyAccessExpression(n.left.expression)
          && n.left.expression.name.text === 'style' && ts.isIdentifier(n.left.expression.expression)
          && overlays.has(n.left.expression.expression.text) && n.left.name.text === 'display'
          && ts.isStringLiteralLike(n.right) && n.right.text === 'none') esconde = true;
      ts.forEachChild(n, v2);
    };
    v2(sf);
    if (esconde && !borra) esconden.push(f);
    else if (borra) borran.push(f);
    else ciegos.push(f);
  }
  return { esconden: esconden.sort(), borran: borran.sort(), ciegos: ciegos.sort() };
}

test('SCRUM-777 · SUELO: el censo VE los dos tipos de cierre', () => {
  const c = censoDeCierres();
  // CONTROL POSITIVO: tiene que encontrar ficheros que BORRAN de verdad.
  assert.ok(c.borran.length >= 8,
    `🔴 CIEGO: sólo ${c.borran.length} ficheros clasificados como «borran». El censo no está `
    + 'leyendo el árbol y su lista de «esconden» no significaría nada.');
  assert.ok(c.borran.includes('jobNuevoModal.js'),
    '🔴 CONTROL NEGATIVO: `jobNuevoModal.js` borra su overlay (`overlay.remove()`) y el censo no '
    + 'lo ve así. Si no distingue, su lista de culpables es ruido.');
});

test('SCRUM-777 · 🔴 la lista de modales que se cierran ESCONDIÉNDOSE no CRECE', () => {
  const c = censoDeCierres();
  assert.deepEqual(c.esconden, ['productsView.js', 'providersView.js'],
    '🔴 HA CAMBIADO EL CONJUNTO DE MODALES QUE SE CIERRAN ESCONDIÉNDOSE.\n'
    + `   Lo que hay ahora: ${c.esconden.join(', ')}.\n`
    + '   · Si hay uno NUEVO: cierra su modal con `style.display = "none"` y lo deja colgado del '
    + '`body`. La pieza ya no se traga eso para el atajo, pero la regla CSS '
    + '`body:has(.modal-overlay) #tut-help-btn` SÍ: apaga el botón de ayuda para siempre.\n'
    + '   · Si FALTA uno: se ha arreglado, bien. Quítalo de esta lista en el mismo commit.\n'
    + '   · `customersView.js` salió de aquí en SCRUM-777, y ése es el cambio (b) de este ticket.');
  assert.equal(c.esconden.includes('customersView.js'), false,
    '🔴 `customersView.js` ha vuelto a cerrar su modal escondiéndolo. Es el defecto que este '
    + 'ticket arregla, y su víctima medida no es sólo el atajo: el botón flotante de ayuda se '
    + 'apaga para siempre (`body:has(.modal-overlay) #tut-help-btn`).');
});

test('SCRUM-777 · el censo DECLARA lo que no sabe leer, en vez de callarlo', () => {
  const c = censoDeCierres();
  // No se fija la lista de ciegos —eso caduca— pero SÍ que el canal exista y que los dos que se
  // midieron a mano sigan ahí: los dos BORRAN, por `id`, y el censo no sabe verlo.
  assert.ok(Array.isArray(c.ciegos), '🔴 el censo ya no devuelve lista de ciegos.');
  assert.deepEqual(c.ciegos, ['expensesView.js'],
    '🔴 HA CAMBIADO LO QUE EL CENSO NO SABE LEER.\n'
    + `   Ciegos ahora: ${c.ciegos.join(', ') || '(ninguno)'}.\n`
    + '   `expensesView.js` crea su overlay con la clase pero lo cierra por ID '
    + '(`getElementById("exp-modal")?.remove()`), así que el censo ve el overlay y no ve el '
    + 'cierre. MEDIDO A MANO el 6-sep-2026: BORRA. Se declara ciego en vez de contarlo como '
    + 'limpio — si mañana lo clasifica, comprueba que lo hace bien antes de quitarlo de aquí.');

  // 🔴 Y EL SEGUNDO LÍMITE, que no sale ni como ciego: `onboardingView.js` NO ENTRA EN LA
  // POBLACIÓN. Su overlay se identifica por `id` (`#onboarding-backdrop`, que sí está en el
  // SELECTOR_MODAL) y no por clase, y este censo empieza filtrando por CLASE. MEDIDO a mano:
  // BORRA (`backdrop.remove()`). Se deja escrito aquí para que el día que alguien amplíe el
  // censo a los ids sepa que ese fichero le va a aparecer y ya está medido.
  assert.equal(c.esconden.includes('onboardingView.js'), false,
    '🔴 `onboardingView.js` ha entrado en la lista de los que esconden. Estaba medido como que '
    + 'BORRA: vuelve a medirlo antes de darlo por culpable.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LAS MUTACIONES QUE ME TUMBAN (contrato de SCRUM-745)
//
// Las dos son el defecto entero, una por cada mitad del arreglo. Apuntan a `public/`, que no
// tiene paso de compilación: se muta exactamente lo que el guard lee.
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // (a) la pieza vuelve a mirar PRESENCIA en vez de visibilidad.
    fichero: 'public/dashboard/js/atajoNuevo.js',
    de: '    if (n.style && n.style.display === "none") return false;          // ①',
    a: '    // ①',
    cae: 'la pieza distingue un modal ESCONDIDO de uno DELANTE',
  },
  {
    // (b) Clientes vuelve a esconder su modal en vez de descolgarlo.
    fichero: 'public/dashboard/js/customersView.js',
    de: '      if (typeof modalBackdrop.remove === "function") modalBackdrop.remove();',
    a: '      // sin descolgar',
    cae: 'la lista de modales que se cierran ESCONDIÉNDOSE no CRECE',
  },
];
