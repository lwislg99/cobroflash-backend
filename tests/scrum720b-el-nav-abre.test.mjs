// tests/scrum720b-el-nav-abre.test.mjs — SCRUM-720b
//
// «PARTES POR VALORAR» ESTABA EN LA BARRA, TENÍA SU `case`, TENÍA SU VISTA — Y NO ABRÍA.
//
// El fundador la pulsó en producción y no pasó nada. Medido PULSANDO, en un navegador de verdad:
//
//     ReferenceError: opts is not defined
//         at renderView (app.js:326:57)
//         at HTMLButtonElement.<anonymous> (app.js:489:41)
//
// El parámetro de `renderView` se llama `options`; el `case` escribía `opts`. Y el título ya se
// había puesto en la línea de arriba, así que la pantalla se quedaba **en blanco con el rótulo
// correcto** — que es exactamente lo que se ve como «no pasa nada».
//
// ── 🔒 POR QUÉ 21/21 EN VERDE NO LO VIERON ───────────────────────────────────────────────
// `scrum652d` mide que ninguna entrada del nav lleve a una vista SIN CONTEXTO, y `scrum652f` que
// el extractor no se quede ciego. Las dos son ciertas y ninguna PULSA. **Se medía el mecanismo, no
// el hecho.** Un `data-view` que existe y un `case` que existe no son una pantalla que se abre.
//
// ── LO QUE VIGILA ESTE FICHERO ────────────────────────────────────────────────────────────
// Que dentro de `renderView` **no se lea ningún identificador que no esté a su alcance**. Eso es,
// por construcción, la clase entera de este defecto: un `ReferenceError` en el router deja la
// pantalla en blanco sin que falle ningún test.
//
// ⚠️ Y ESTE INSTRUMENTO NACIÓ ROTO. La primera versión recogía las declaraciones de las funciones
// HERMANAS, así que `opts` —parámetro de `window.renderAppView = function (view, opts)`, otra
// función del mismo fichero— salía «a alcance» y el defecto pasaba. **Daba 0 con el fallo puesto.**
// No lo vi mirando la salida: lo dijo la inyección. Por eso abajo hay una AUTOPRUEBA sobre fuente
// sintética, donde la respuesta se sabe por construcción y no por intuición.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(RAIZ, 'public', 'dashboard', 'js');

/** Lo que el navegador trae puesto. No son identificadores que nadie tenga que declarar. */
const DEL_NAVEGADOR = new Set(['window', 'document', 'console', 'location', 'history', 'navigator',
  'localStorage', 'sessionStorage', 'fetch', 'setTimeout', 'clearTimeout', 'setInterval',
  'clearInterval', 'JSON', 'Math', 'Date', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'Promise', 'Error', 'Map', 'Set', 'RegExp', 'Intl', 'URL', 'URLSearchParams', 'undefined', 'NaN',
  'Infinity', 'parseInt', 'parseFloat', 'isNaN', 'encodeURIComponent', 'decodeURIComponent',
  'requestAnimationFrame', 'alert', 'confirm', 'prompt', 'FormData', 'Blob', 'File', 'FileReader',
  'AbortController', 'CustomEvent', 'Event', 'globalThis', 'queueMicrotask', 'structuredClone',
  'btoa', 'atob', 'TextEncoder', 'TextDecoder', 'crypto', 'performance', 'matchMedia']);

/**
 * Los nombres a los que un nodo puede llegar: los suyos y los de sus ámbitos padres.
 *
 * 🔴 En cada ámbito se recogen SOLO sus propias declaraciones. Al entrar en una función anidada se
 * PARA —se queda su nombre, no su interior—, porque lo que declara una función hermana NO está a
 * alcance. Ése fue el fallo de la primera versión y es lo que hacía invisible a `opts`.
 */
function nombresAlAlcance(nodo) {
  const nombres = new Set();
  const recoge = (n, esRaiz) => {
    if (!esRaiz && (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)
      || ts.isArrowFunction(n) || ts.isMethodDeclaration(n))) {
      if (n.name && ts.isIdentifier(n.name)) nombres.add(n.name.text);
      return;
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) nombres.add(n.name.text);
    if (ts.isFunctionDeclaration(n) && n.name) nombres.add(n.name.text);
    if (ts.isParameter(n) && ts.isIdentifier(n.name)) nombres.add(n.name.text);
    if (ts.isBindingElement(n) && ts.isIdentifier(n.name)) nombres.add(n.name.text);
    if (ts.isClassDeclaration(n) && n.name) nombres.add(n.name.text);
    ts.forEachChild(n, (h) => recoge(h, false));
  };
  for (let a = nodo; a; a = a.parent) recoge(a, true);
  return nombres;
}

/** Lo que declaran a nivel superior TODOS los scripts del dashboard: comparten ámbito global. */
function globalesDeLaPagina(dirJs) {
  const out = new Set();
  for (const f of fs.readdirSync(dirJs).filter((x) => x.endsWith('.js'))) {
    const s = ts.createSourceFile(f, fs.readFileSync(path.join(dirJs, f), 'utf8'),
      ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    for (const st of s.statements) {
      if (ts.isFunctionDeclaration(st) && st.name) out.add(st.name.text);
      if (ts.isClassDeclaration(st) && st.name) out.add(st.name.text);
      if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) out.add(d.name.text);
      }
    }
  }
  return out;
}

/** Los identificadores que una función LEE y que no puede resolver. `[{ nombre, linea }]`. */
function leidosSinResolver(fuente, nombreFn, globales, archivo = 'app.js') {
  const sf = ts.createSourceFile(archivo, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let fn = null;
  const busca = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === nombreFn) fn = n;
    ts.forEachChild(n, busca);
  };
  busca(sf);
  if (!fn) return null;

  const alcance = nombresAlAlcance(fn);
  const vistos = new Map();
  const recorre = (n) => {
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const esNombreDeAlgo = (ts.isPropertyAccessExpression(p) && p.name === n)
        || (ts.isPropertyAssignment(p) && p.name === n)
        || (ts.isBindingElement(p) && p.propertyName === n)
        || ts.isParameter(p) || ts.isVariableDeclaration(p) || ts.isFunctionDeclaration(p)
        || (ts.isMethodDeclaration(p) && p.name === n);
      if (!esNombreDeAlgo && !vistos.has(n.text)) {
        vistos.set(n.text, sf.getLineAndCharacterOfPosition(n.getStart()).line + 1);
      }
    }
    ts.forEachChild(n, recorre);
  };
  ts.forEachChild(fn, recorre);

  return [...vistos]
    .filter(([nom]) => !alcance.has(nom) && !globales.has(nom) && !DEL_NAVEGADOR.has(nom))
    .map(([nombre, linea]) => ({ nombre, linea }));
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 0 · 🔴 AUTOPRUEBA DEL INSTRUMENTO — sobre fuente sintética, ANTES de creerse su número
//
// 🔒 MIRAR LAS MUESTRAS A OJO NO ES UN CONTROL. Esta autoprueba funciona cuando el error NO se ve,
// que es justo cuando hace falta. Y no es teórica: la primera versión de este instrumento daba
// CERO con el defecto puesto, y sólo se supo inyectándolo.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-720b · 🔴 AUTOPRUEBA: el instrumento CAZA un identificador de una función hermana', () => {
  const SANO = 'function router(view, options) { pinta(view, options); }\nfunction otra(view, opts) { return opts; }\n';
  const ROTO = 'function router(view, options) { pinta(view, opts); }\nfunction otra(view, opts) { return opts; }\n';
  const globales = new Set(['pinta', 'router', 'otra']);

  assert.deepEqual(leidosSinResolver(SANO, 'router', globales), [],
    '🔴 el instrumento ACUSA a un fuente sano. Un detector que señala al inocente se desactiva en '
    + 'una semana — está escrito en este árbol y ya pasó.');

  const cazado = leidosSinResolver(ROTO, 'router', globales);
  assert.deepEqual(cazado.map((x) => x.nombre), ['opts'],
    '🔴 EL INSTRUMENTO NO VE EL DEFECTO. `opts` está declarado en `otra`, que es una función '
    + 'HERMANA: no está al alcance de `router`. Si esto no lo caza, el cero de abajo no significa '
    + '«el router está sano», significa «no he mirado» — y es exactamente lo que hizo la primera '
    + 'versión de este fichero.');

  // Y no confunde un nombre de propiedad con una lectura: `a.opts` no es leer `opts`.
  assert.deepEqual(leidosSinResolver('function router(a) { return a.opts; }', 'router', globales), [],
    '🔴 el instrumento cuenta un NOMBRE DE PROPIEDAD como identificador leído: acusaría a medio árbol.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 1 · SUELO — cero identificadores leídos es CEGUERA, no un router simple
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-720b · 🔴 SUELO: el instrumento VE el router y el ámbito de la página', () => {
  const globales = globalesDeLaPagina(JS);
  assert.ok(globales.size >= 300,
    `🔴 CIEGO: sólo se ven ${globales.size} globales en los scripts del dashboard. Con pocos, casi `
    + 'cualquier identificador saldría «sin resolver» y el guard acusaría al sano.');

  const app = fs.readFileSync(path.join(JS, 'app.js'), 'utf8');
  const sf = ts.createSourceFile('app.js', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let existe = false;
  const busca = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === 'renderView') existe = true;
    ts.forEachChild(n, busca);
  };
  ts.forEachChild(sf, busca);
  assert.ok(existe,
    '🔴 CIEGO: no se encuentra `renderView` en `app.js`. O el router cambió de nombre o de forma: '
    + 'en los dos casos este guard estaría pasando en vacío.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 2 · 🔴 EL HECHO: el router no lee nada que no esté a su alcance
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-720b · 🔴 `renderView` no lee ningún identificador fuera de su alcance', () => {
  const app = fs.readFileSync(path.join(JS, 'app.js'), 'utf8');
  const sueltos = leidosSinResolver(app, 'renderView', globalesDeLaPagina(JS));
  assert.ok(sueltos !== null, '🔴 no se encuentra `renderView`');

  assert.deepEqual(sueltos, [],
    '🔴 EL ROUTER LEE UN IDENTIFICADOR QUE NO EXISTE A SU ALCANCE:\n'
    + sueltos.map((x) => `    app.js:${x.linea}  ${x.nombre}`).join('\n')
    + '\n  Eso es un `ReferenceError` en cuanto alguien pulse esa entrada del nav. Y NO se ve como\n'
    + '  un error: el título de la pantalla ya se ha puesto en la línea de arriba, así que el\n'
    + '  profesional ve el rótulo correcto y la pantalla EN BLANCO. «No pasa nada».\n'
    + '  Le pasó a «Partes por valorar» y llegó a producción con la suite en verde: `opts` donde el\n'
    + '  parámetro se llama `options`.');
});
