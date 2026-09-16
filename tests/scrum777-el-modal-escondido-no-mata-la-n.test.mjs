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
  const PARTES = m[1].split(',').map((s) => s.trim());
  const CLASES = PARTES.filter((s) => s.startsWith('.')).map((s) => s.slice(1));
  // 🔴 SCRUM-785 · LOS IDS TAMBIÉN. El censo de SCRUM-777 sólo miraba clases, y por eso
  // `onboardingView.js` NI ENTRABA EN LA POBLACIÓN: su overlay se identifica por `id`
  // (`#onboarding-backdrop`, que está en el propio `SELECTOR_MODAL`). Se sabía a mano; ahora se
  // deriva.
  const IDS = PARTES.filter((s) => s.startsWith('#')).map((s) => s.slice(1));

  const esconden = [];
  const borran = [];
  const ciegos = [];
  for (const f of fs.readdirSync(DIR_JS).filter((x) => x.endsWith('.js'))) {
    if (f === 'atajoNuevo.js') continue;
    const src = fs.readFileSync(path.join(DIR_JS, f), 'utf8');
    if (!CLASES.some((c) => src.includes(c)) && !IDS.some((i) => src.includes(i))) continue;
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const overlays = new Set();
    // Los ids que se le ponen a un overlay, para reconocer después un cierre por `getElementById`.
    const idsDeOverlay = new Set(IDS);
    const tieneClase = (a) => ts.isStringLiteralLike(a) && CLASES.some((c) => a.text.split(/\s+/).includes(c));
    const esIdDeModal = (a) => ts.isStringLiteralLike(a) && IDS.includes(a.text);
    const v1 = (n) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
          && ts.isPropertyAccessExpression(n.left) && n.left.name.text === 'className'
          && ts.isIdentifier(n.left.expression) && tieneClase(n.right)) overlays.add(n.left.expression.text);
      // 🔴 SCRUM-785 · `x.id = "onboarding-backdrop"` también hace de `x` un overlay.
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
          && ts.isPropertyAccessExpression(n.left) && n.left.name.text === 'id'
          && ts.isIdentifier(n.left.expression) && esIdDeModal(n.right)) overlays.add(n.left.expression.text);
      if (ts.isVariableDeclaration(n) && n.initializer && ts.isCallExpression(n.initializer)
          && ts.isIdentifier(n.name) && n.initializer.arguments.some(tieneClase)) overlays.add(n.name.text);
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
          && ts.isIdentifier(n.left) && ts.isCallExpression(n.right)
          && n.right.arguments.some(tieneClase)) overlays.add(n.left.text);
      ts.forEachChild(n, v1);
    };
    v1(sf);
    // 🔴 SCRUM-785 · TERCERA FORMA, Y ERA LA QUE FALTABA: EL ALIAS.
    //
    // `productsView` y `providersView` construyen el overlay dentro de `buildEditModal()`, que lo
    // DEVUELVE, y el resto del fichero lo maneja por otro nombre:
    //     let editOverlay = null;  …  if (!editOverlay) editOverlay = buildEditModal();
    // El censo veía `ov` (el de dentro) y no veía `editOverlay` (el de fuera), así que el
    // `editOverlay.remove()` de SCRUM-785 le resultaba INVISIBLE y los seguía dando por
    // «esconden». Medido: con la corrección aplicada, el censo seguía acusándolos.
    //
    // Se resuelve derivando: una función que declara un overlay y lo DEVUELVE convierte en
    // overlay a quien recoja su resultado.
    const fabricas = new Set();
    const v1c = (n) => {
      if ((ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n)) && n.body) {
        let devuelveOverlay = false;
        const rv = (x) => {
          if (ts.isReturnStatement(x) && x.expression && ts.isIdentifier(x.expression)
              && overlays.has(x.expression.text)) devuelveOverlay = true;
          ts.forEachChild(x, rv);
        };
        rv(n.body);
        if (devuelveOverlay && n.name && ts.isIdentifier(n.name)) fabricas.add(n.name.text);
      }
      ts.forEachChild(n, v1c);
    };
    v1c(sf);
    const v1d = (n) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
          && ts.isIdentifier(n.left) && ts.isCallExpression(n.right)
          && ts.isIdentifier(n.right.expression) && fabricas.has(n.right.expression.text)) {
        overlays.add(n.left.text);
      }
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
          && ts.isCallExpression(n.initializer) && ts.isIdentifier(n.initializer.expression)
          && fabricas.has(n.initializer.expression.text)) overlays.add(n.name.text);
      ts.forEachChild(n, v1d);
    };
    v1d(sf);
    // 🔴 SCRUM-785 · segunda pasada: el ID que se le da a un overlay ya reconocido. Es lo que
    // permite ver el cierre de `expensesView`, que crea por clase y borra por
    // `getElementById('exp-modal')?.remove()`. También se sabía a mano; ahora se deriva.
    const v1b = (n) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
          && ts.isPropertyAccessExpression(n.left) && n.left.name.text === 'id'
          && ts.isIdentifier(n.left.expression) && overlays.has(n.left.expression.text)
          && ts.isStringLiteralLike(n.right)) idsDeOverlay.add(n.right.text);
      ts.forEachChild(n, v1b);
    };
    v1b(sf);
    if (!overlays.size) { ciegos.push(f); continue; }

    let borra = false;
    let esconde = false;
    /** ¿Esta expresión ES un overlay? Su variable, o un `getElementById` de su id. */
    const esOverlay = (n) => {
      if (ts.isIdentifier(n) && overlays.has(n.text)) return true;
      // `document.getElementById('exp-modal')` — con o sin `?.` delante del `remove`.
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
          && n.expression.name.text === 'getElementById'
          && n.arguments.length === 1 && ts.isStringLiteralLike(n.arguments[0])
          && idsDeOverlay.has(n.arguments[0].text)) return true;
      return false;
    };
    const v2 = (n) => {
      if (ts.isCallExpression(n) && (ts.isPropertyAccessExpression(n.expression))
          && n.expression.name.text === 'remove' && esOverlay(n.expression.expression)) borra = true;
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
  // 🔴 SCRUM-785 · LA LISTA ESTÁ VACÍA, y un cero sobre población vacía no sería un dato. Por eso
  // va atado a que el censo SIGA CLASIFICANDO: si dejara de ver ficheros, su cero de culpables
  // sería ceguera y no limpieza. El suelo de arriba exige además que `jobNuevoModal` salga como
  // «borra», que es el control negativo.
  assert.ok(c.borran.length >= 16,
    `🔴 CIEGO: el censo sólo clasifica ${c.borran.length} ficheros como «borran». Con una `
    + 'población así de corta, la lista vacía de abajo no significaría «no hay ninguno», sino '
    + '«he dejado de mirar».');
  assert.deepEqual(c.esconden, [],
    '🔴 HA VUELTO A HABER MODALES QUE SE CIERRAN ESCONDIÉNDOSE.\n'
    + `   Lo que hay ahora: ${c.esconden.join(', ')}.\n`
    + '   Cierra su modal con `style.display = "none"` y lo deja colgado del `body`. La pieza ya '
    + 'no se traga eso para el atajo (SCRUM-777), pero la regla CSS '
    + '`body:has(.modal-overlay) #tut-help-btn` SÍ: `:has()` es ESTRUCTURAL y apaga el botón '
    + 'flotante de ayuda para el resto de la sesión.\n'
    + '   Se descuelga con `remove()` al cerrar y se reengancha al reabrir — el mismo nodo, con '
    + 'sus campos y sus oyentes. Así lo hacen `customersView` (SCRUM-777) y `productsView` y '
    + '`providersView` (SCRUM-785), que son los tres que estuvieron aquí.');
  assert.equal(c.esconden.includes('customersView.js'), false,
    '🔴 `customersView.js` ha vuelto a cerrar su modal escondiéndolo. Es el defecto que este '
    + 'ticket arregla, y su víctima medida no es sólo el atajo: el botón flotante de ayuda se '
    + 'apaga para siempre (`body:has(.modal-overlay) #tut-help-btn`).');
});

test('SCRUM-777 · el censo DECLARA lo que no sabe leer, en vez de callarlo', () => {
  const c = censoDeCierres();
  assert.ok(Array.isArray(c.ciegos), '🔴 el censo ya no devuelve lista de ciegos.');

  // 🔴 SCRUM-785 · LOS DOS AGUJEROS QUE SCRUM-777 DEJÓ DOCUMENTADOS ESTÁN CERRADOS, Y NO A MANO:
  //   · `expensesView.js` creaba por CLASE y cerraba por ID (`getElementById('exp-modal')?.remove()`).
  //     Ahora el censo aprende el `id` que se le pone a un overlay y reconoce ese cierre.
  //   · `onboardingView.js` NI ENTRABA EN LA POBLACIÓN: su overlay se identifica por `id`
  //     (`#onboarding-backdrop`), y el censo filtraba sólo por clase. Ahora los ids del propio
  //     `SELECTOR_MODAL` también entran.
  //   · Y de paso apareció un TERCERO que nadie había declarado: `productsView` y `providersView`
  //     manejan su overlay por un ALIAS (`editOverlay = buildEditModal()`), así que su `remove()`
  //     era invisible. Ahora una función que devuelve un overlay convierte en overlay a quien
  //     recoja su resultado.
  //
  // Un censo con casos que sólo se saben a mano es un censo con agujeros documentados. Este ya no
  // los tiene, y por eso la lista se fija en VACÍA en vez de enumerar excusas.
  assert.deepEqual(c.ciegos, [],
    '🔴 EL CENSO HA VUELTO A NO SABER LEER ALGO.\n'
    + `   Ciegos ahora: ${c.ciegos.join(', ') || '(ninguno)'}.\n`
    + '   Un fichero aquí NO es un fichero limpio: es uno del que este guard no puede afirmar '
    + 'nada. Mídelo a mano y, si el censo debería saber verlo, enséñaselo — las tres formas que '
    + 'ya entiende son: la clase, el id del `SELECTOR_MODAL`, y el alias de una función que '
    + 'devuelve el overlay.');
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
