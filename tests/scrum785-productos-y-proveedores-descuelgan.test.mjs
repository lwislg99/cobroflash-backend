// tests/scrum785-productos-y-proveedores-descuelgan.test.mjs — SCRUM-785
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EDITAR UN PRODUCTO O UN PROVEEDOR APAGABA EL BOTÓN DE AYUDA PARA EL RESTO DE LA SESIÓN.
//
// Los dos cuelgan su modal de edición del `body` **ya escondido** y lo cierran escondiéndolo otra
// vez, así que el nodo se queda ahí para siempre. Para el atajo «N» eso ya daba igual desde
// SCRUM-777 —la pieza mira visibilidad—, pero hay una segunda víctima que NO pasa por la pieza:
//
//     styles.css →  body:has(.modal-overlay) #tut-help-btn { display: none !important; }
//
// `:has()` es ESTRUCTURAL: mira si el nodo EXISTE, no si se ve. Medido en Edge, con el ciclo de
// vida de estos dos ficheros reproducido:
//
//     ciclo «antes»  · tras EDITAR y CERRAR → display:none · caja 0,00×0   🔴
//     ciclo «ahora»  · tras EDITAR y CERRAR → inline-block · caja 9,98×21  ✔
//     los dos ciclos · con el modal ABIERTO → display:none                 ✅ la regla hace lo suyo
//
// ── LO QUE ESTE TICKET NO TOCA ──────────────────────────────────────────────────────────────
// ⛔ La regla `body:has(.modal-overlay)` se queda: con un modal de verdad hace exactamente lo que
//    debe, y hay un control aquí que lo exige.
// ⛔ `sePuedeDisparar` no se toca: ya está arreglado y tiene su guard en SCRUM-777.
// ⛔ El formulario en línea de las dos pantallas no se toca. Que su botón primario sea un
//    CONFIRMAR y no un ABRIR está medido en SCRUM-769 y por eso siguen SIN atajo «N».
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');
const require = createRequire(import.meta.url);
const ts = require('typescript');

/** El banco necesita un merchant y UNA fila: sin fila no hay «Editar» que pulsar. */
const DATOS = (url) => {
  const u = String(url || '');
  if (u.indexOf('/admin/merchant') !== -1) return { id: 7, name: 'QA' };
  if (/\/admin\/products\b/.test(u)) {
    return { ok: true, items: [{ id: 1, name: 'Grifo', price: 100, cost: 60, description: '', providerId: null, itemKind: null, active: true }] };
  }
  if (/\/admin\/providers\b/.test(u)) {
    return { ok: true, items: [{ id: 1, name: 'Proveedor QA', phone: '', email: '', notes: '' }] };
  }
  if (/\/billing\/plans/.test(u)) return { plans: [], currentPlan: null, founding: null };
  return [];
};

const PANTALLAS = [
  { vista: 'renderProductsView', quien: 'Productos' },
  { vista: 'renderProvidersView', quien: 'Proveedores' },
];

/**
 * Monta la pantalla y devuelve con qué trabajar.
 *
 * ⚠️ LÍMITE DEL BANCO, DECLARADO: `openEditModal` rellena los campos con
 * `body.querySelector('[name="name"]')`, y el mini-DOM devuelve `null` para ese selector —**sin
 * anotarlo en `selectoresNoSoportados`**, medido—. Así que la apertura LANZA a mitad. No es un
 * defecto del producto y no estorba a lo que se mide aquí: el `buildEditModal()` ya ha corrido y
 * el overlay ya está colgado del `body`, que es justo el residuo del que va este ticket. El
 * `catch` se declara y, para que no tape un no-op, se exige a continuación que el overlay ESTÉ.
 */
async function pantalla(vista) {
  const banco = cargarDashboard(RAIZ, { datos: DATOS });
  const r = await pintarVista(banco, vista);
  assert.equal(r.error, null, `🔴 ${vista} no monta: ${r.error && r.error.message}`);
  const doc = banco.ctx.document;
  const editar = todos(r.contenedor).filter((n) => n.tagName === 'BUTTON'
    && /editar/i.test(n.textContent || ''))[0];
  assert.ok(editar, `🔴 CIEGO: sin fila que editar no puedo provocar el modal en ${vista}.`);
  const cerrar = () => todos(doc.body).filter((n) => n.tagName === 'BUTTON'
    && /cancelar/i.test(n.textContent || ''))[0];
  const pulsar = (b) => { try { b.click(); } catch { /* límite del banco, declarado arriba */ } };
  const overlays = () => doc.querySelectorAll('.modal-overlay').length;
  return { banco, doc, editar, cerrar, pulsar, overlays };
}

// ═══ ① EL QUE DECIDE, sobre el código REAL de cada pantalla ══════════════════════════════════

for (const { vista, quien } of PANTALLAS) {
  test(`SCRUM-785 · 🔴 ${quien}: tras EDITAR y cerrar NO queda un modal colgado del body`, async () => {
    const p = await pantalla(vista);
    assert.equal(p.overlays(), 0, `🔴 SUELO: ${quien} ya deja un overlay colgado con sólo montarse.`);

    p.pulsar(p.editar);
    assert.equal(p.overlays(), 1,
      `🔴 CIEGO: al pulsar «Editar» no se ha construido ningún overlay en ${quien}, así que el `
      + '`catch` del banco está tapando un no-op y no estoy midiendo nada.');

    const cerrarBtn = p.cerrar();
    assert.ok(cerrarBtn, `🔴 CIEGO: no encuentro por dónde se cierra el modal de ${quien}.`);
    p.pulsar(cerrarBtn);

    assert.equal(p.overlays(), 0,
      `🔴 ${quien} SIGUE DEJANDO SU MODAL COLGADO DEL BODY tras cerrarlo. Con ese nodo presente, `
      + '`body:has(.modal-overlay) #tut-help-btn` apaga el botón flotante de ayuda para el resto '
      + 'de la sesión: `:has()` mira si el nodo EXISTE, no si se ve. Medido en Edge: con el '
      + 'residuo el «?» computa `display:none` y caja 0×0.');
  });

  test(`SCRUM-785 · 🔴 ${quien}: se DESCUELGA, no se destruye — reabre y es el MISMO nodo`, async () => {
    const p = await pantalla(vista);
    p.pulsar(p.editar);
    const primera = p.doc.querySelector('.modal-overlay');
    assert.ok(primera, `🔴 CIEGO: no se ha abierto ningún overlay en ${quien}.`);
    p.pulsar(p.cerrar());
    assert.equal(p.overlays(), 0, `🔴 ${quien} no ha descolgado su modal al cerrarlo.`);

    p.pulsar(p.editar);
    const segunda = p.doc.querySelector('.modal-overlay');
    assert.ok(segunda,
      `🔴 EL MODAL DE ${quien.toUpperCase()} YA NO SE REABRE. Descolgarlo al cerrar ha roto su `
      + 'ciclo de vida: la vista lo reutiliza (`if (!editOverlay) …`) y hay que volver a colgarlo '
      + 'del `body` al reabrir.');
    assert.equal(segunda, primera,
      `🔴 el modal de ${quien} se ha RECONSTRUIDO en vez de reutilizarse. Su `
      + '`build…()` cablea campos y oyentes UNA sola vez: reconstruirlo es otro ciclo de vida.');
  });
}

// ═══ ② EL CENSO QUE FALTABA: ¿QUIÉN MÁS DEPENDE DE QUE UN OVERLAY EXISTA? ════════════════════

/**
 * SCRUM-777 dejó declarado este hueco: «no se ha censado si algún otro CSS o JS depende de la
 * PRESENCIA de un overlay». Si hubiera una segunda regla estructural, la víctima de este ticket
 * no sería una: serían dos, y el ticket cambiaría de tamaño.
 *
 * Se mide sobre el TEXTO de la hoja, pero descontando comentarios: `styles.css` explica la regla
 * en prosa y un `includes` a pelo se contaría a sí mismo (SCRUM-203). El censo en CSSOM —sobre el
 * navegador, donde los comentarios no son reglas— dio lo mismo: 659 reglas leídas, 0 hojas
 * ciegas, SEIS selectores nombran un overlay y **UNO SOLO es estructural**.
 */
function reglasQueNombranUnOverlay() {
  const pieza = fs.readFileSync(path.join(DIR_JS, 'atajoNuevo.js'), 'utf8');
  const m = pieza.match(/SELECTOR_MODAL\s*=\s*\n?\s*"([^"]+)"/);
  assert.ok(m, '🔴 CIEGO: no sé leer `SELECTOR_MODAL` de la pieza.');
  const AGUJAS = m[1].split(',').map((s) => s.trim().replace(/^[.#]/, ''));

  const css = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  const selectores = [];
  // Un selector es todo lo que hay antes de una `{` de bloque de declaraciones.
  for (const trozo of css.split('}')) {
    const i = trozo.lastIndexOf('{');
    if (i === -1) continue;
    const sel = trozo.slice(0, i).split('\n').map((l) => l.trim()).filter(Boolean).join(' ').trim();
    if (sel && AGUJAS.some((a) => sel.includes(a))) selectores.push(sel);
  }
  return selectores;
}

test('SCRUM-785 · SUELO: el censo de CSS VE la regla estructural que ya conocíamos', () => {
  const sels = reglasQueNombranUnOverlay();
  assert.ok(sels.length >= 4,
    `🔴 CIEGO: sólo ${sels.length} selectores nombran un overlay. El censo no está leyendo la hoja.`);
  assert.ok(sels.some((s) => s.includes('tut-help-btn')),
    '🔴 CONTROL POSITIVO ROTO: el censo no encuentra `body:has(.modal-overlay) #tut-help-btn`, '
    + `que es la regla de la que va este ticket. Selectores vistos: ${sels.join(' | ')}.`);
});

test('SCRUM-785 · 🔴 NO hay una SEGUNDA regla que dependa de que el overlay EXISTA', () => {
  const sels = reglasQueNombranUnOverlay();
  // Estructural = decide sobre OTRO elemento porque el overlay exista. `:has()`, y los
  // combinadores de hermano `~` y `+`, que también miran la estructura y no el estilo del propio
  // overlay. Un selector que estila al overlay o a su descendiente NO cuenta: ése se apaga solo
  // cuando el overlay se esconde.
  const estructurales = sels.filter((s) => /:has\(|~|\+/.test(s));
  assert.deepEqual(estructurales, ['body:has(.modal-overlay) #tut-help-btn'],
    '🔴 HA CAMBIADO EL CONJUNTO DE REGLAS ESTRUCTURALES QUE DEPENDEN DE UN OVERLAY.\n'
    + `   Lo que hay ahora: ${estructurales.join(' | ') || '(ninguna)'}.\n`
    + '   · Si hay una NUEVA: la víctima de un overlay colgado ya no es una, son dos, y hay que '
    + 'medir la segunda antes de darla por cubierta.\n'
    + '   · Si FALTA la conocida: alguien ha retirado la regla del botón de ayuda. Eso NO es de '
    + 'este ticket — con un modal de verdad la regla hace lo que debe.');
});

test('SCRUM-785 · y el JS que pregunta si existe un overlay está censado', () => {
  const pieza = fs.readFileSync(path.join(DIR_JS, 'atajoNuevo.js'), 'utf8');
  const m = pieza.match(/SELECTOR_MODAL\s*=\s*\n?\s*"([^"]+)"/);
  const AGUJAS = m[1].split(',').map((s) => s.trim().replace(/^[.#]/, ''));
  const consultas = [];
  for (const f of fs.readdirSync(DIR_JS).filter((x) => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(DIR_JS, f), 'utf8');
    if (!AGUJAS.some((a) => src.includes(a))) continue;
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const v = (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
          && ['querySelector', 'querySelectorAll', 'closest', 'getElementById', 'matches'].includes(n.expression.name.text)) {
        for (const a of n.arguments) {
          if (ts.isStringLiteralLike(a) && AGUJAS.some((x) => a.text.includes(x))) consultas.push(f);
          if (ts.isIdentifier(a) && a.text === 'SELECTOR_MODAL') consultas.push(f);
          if (ts.isPropertyAccessExpression(a) && a.name.text === 'SELECTOR_MODAL') consultas.push(f);
        }
      }
      ts.forEachChild(n, v);
    };
    v(sf);
  }
  const ficheros = [...new Set(consultas)].sort();
  // CONTROL POSITIVO: la propia pieza pregunta, y tiene que salir.
  assert.ok(ficheros.includes('atajoNuevo.js'),
    '🔴 CONTROL POSITIVO ROTO: el censo no ve la consulta de la propia pieza. No sabe encontrar '
    + 'lo que dice contar.');
  assert.deepEqual(ficheros, ['api.js', 'atajoNuevo.js', 'homeView.js', 'onboardingView.js'],
    '🔴 HA CAMBIADO QUIÉN PREGUNTA SI EXISTE UN OVERLAY.\n'
    + `   Ficheros ahora: ${ficheros.join(', ')}.\n`
    + '   MEDIDO el 6-sep-2026, uno a uno: `api.js` los BORRA todos al navegar; `atajoNuevo.js` ya '
    + 'mira visibilidad (SCRUM-777); `homeView.js` pregunta si su cotización rápida está abierta y '
    + 'la BORRA al cerrar; `onboardingView.js` pregunta lo mismo y también BORRA. Ninguno se comía '
    + 'un residuo. Si entra uno nuevo, mídelo antes de darlo por inofensivo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LAS MUTACIONES QUE ME TUMBAN (contrato de SCRUM-745)
// Una por pantalla: si vuelve a esconder en vez de descolgar, cae su test.
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/productsView.js',
    de: "            if (typeof editOverlay.remove === 'function') editOverlay.remove();",
    a: '            // sin descolgar',
    cae: 'Productos: tras EDITAR y cerrar NO queda un modal colgado del body',
  },
  {
    fichero: 'public/dashboard/js/providersView.js',
    de: "        if (typeof editProviderOverlay.remove === 'function') editProviderOverlay.remove();",
    a: '        // sin descolgar',
    cae: 'Proveedores: tras EDITAR y cerrar NO queda un modal colgado del body',
  },
];
