// SCRUM-386 · LAS HOJAS DEL ALBARÁN VIVEN FUERA DE LA VISTA DEL TRABAJO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA DEUDA QUE SALDA
//
// `openAlbEditorSheet` y `openFacturarParcialSheet` estaban ANIDADAS dentro de
// `renderJobDetailView`. Por eso la página del albarán (SCRUM-302) no podía hacerlas: solo podía
// NAVEGAR hasta la fila del Trabajo, y la fila tenía que conservar sus botones para no dejar
// callejones sin salida. C2 lo declaró como deuda; esto es esa deuda.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE GUARD MIRA EL ÁMBITO Y NO EL TEXTO
//
// Una función anidada y una a nivel de módulo se escriben IGUAL salvo por la sangría, así que un
// guard de texto (`grep 'function openAlbEditorSheet'`) pasa en verde en los dos casos. Lo que
// distingue una mudanza hecha de una deshecha es el ÁMBITO, y eso solo lo ve un parser.
//
// Se comprueban dos cosas distintas, y hacen falta las dos:
//
//   ① que estén DECLARADAS a nivel de módulo — si vuelven dentro, rojo;
//   ② que no CAPTUREN nada del ámbito de `renderJobDetailView` — porque se puede sacar una
//      función y dejarla usando un nombre de fuera; entonces está «fuera» pero sigue atada, y el
//      día que alguien la llame desde otra pantalla reventará con un ReferenceError.
//
// ⚠️ ALCANCE DECLARADO: esto NO comprueba que la página del albarán las llame. Cablearlas es
// decisión de producto (qué botones quedan en la fila) y va en su ticket; aquí solo se garantiza
// que YA SE PUEDE.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA = path.join(RAIZ, 'public/dashboard/js/jobDetailView.js');
const CODIGO = fs.readFileSync(RUTA, 'utf8');
const SF = ts.createSourceFile(RUTA, CODIGO, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);

/** Las que tienen que estar fuera. `buildAlbEditor`/`albTotalesJS` van porque el editor las arrastra. */
const FUERA = ['albTotalesJS', 'buildAlbEditor', 'openAlbEditorSheet', 'openFacturarParcialSheet'];

/** Declaraciones de función a NIVEL DE MÓDULO (hijas directas del fichero). */
function funcionesDeModulo() {
  const out = new Map();
  for (const n of SF.statements) {
    if (ts.isFunctionDeclaration(n) && n.name) out.set(n.name.text, n);
  }
  return out;
}

function buscarFuncion(nombre) {
  let h = null;
  const v = (n) => { if (ts.isFunctionDeclaration(n) && n.name?.text === nombre) { h = n; return; } ts.forEachChild(n, v); };
  v(SF);
  return h;
}

function declaradosEn(nodo) {
  const out = new Set();
  const anotar = (name) => {
    if (!name) return;
    if (ts.isIdentifier(name)) out.add(name.text);
    else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const el of name.elements) if (ts.isBindingElement(el)) anotar(el.name);
    }
  };
  const v = (n) => {
    if (ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isBindingElement(n)) anotar(n.name);
    if (ts.isFunctionDeclaration(n) && n.name) out.add(n.name.text);
    if (ts.isCatchClause(n) && n.variableDeclaration) anotar(n.variableDeclaration.name);
    ts.forEachChild(n, v);
  };
  v(nodo);
  return out;
}

function usadosEn(nodo) {
  const out = new Set();
  const v = (n) => {
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const prop = ts.isPropertyAccessExpression(p) && p.name === n;
      const clave = ts.isPropertyAssignment(p) && p.name === n;
      const decl = (ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p)) && p.name === n;
      const nomFn = (ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p)) && p.name === n;
      if (!prop && !clave && !decl && !nomFn) out.add(n.text);
    }
    ts.forEachChild(n, v);
  };
  v(nodo);
  return out;
}

// ── SUELO: el parser ve de verdad este fichero ───────────────────────────────

test('SCRUM-386 · SUELO: el parser encuentra la vista y sus funciones de módulo', () => {
  // Sin esto, un cambio de nombre de fichero o un fallo de parseo dejaría los tests de abajo en
  // verde por no encontrar NADA — que es como un guard deja de vigilar sin que se note.
  const mod = funcionesDeModulo();
  assert.ok(mod.size >= 8, `🔴 solo veo ${mod.size} funciones de módulo: el parser no está leyendo el fichero`);
  assert.ok(buscarFuncion('renderJobDetailView'), '🔴 no encuentro renderJobDetailView');
});

// ── ① Declaradas a nivel de módulo ───────────────────────────────────────────

for (const nombre of FUERA) {
  test(`SCRUM-386 · ${nombre} está a nivel de MÓDULO, no anidada`, () => {
    const mod = funcionesDeModulo();
    assert.ok(
      mod.has(nombre),
      `🔴 ${nombre} ha vuelto DENTRO de renderJobDetailView. Anidada, la página del albarán no ` +
        'puede hacerla: solo navegar hasta la fila, y vuelven los callejones sin salida de C2.',
    );
  });
}

// ── ② Y sin atar nada del ámbito de la vista ─────────────────────────────────

for (const nombre of FUERA) {
  test(`SCRUM-386 · ${nombre} no captura nada del ámbito de renderJobDetailView`, () => {
    const externa = buscarFuncion('renderJobDetailView');
    const fn = buscarFuncion(nombre);
    assert.ok(fn, `no encuentro ${nombre}`);

    const delaVista = declaradosEn(externa);
    const propios = declaradosEn(fn);
    const atados = [...usadosEn(fn)].filter((n) => delaVista.has(n) && !propios.has(n));

    assert.deepEqual(
      atados, [],
      `🔴 ${nombre} sigue usando ${atados.join(', ')} del ámbito de renderJobDetailView. Está ` +
        'fuera pero atada: llamarla desde otra pantalla reventaría con un ReferenceError, que es ' +
        'exactamente lo que esta mudanza venía a evitar.',
    );
  });
}

// ── El contexto entra por parámetro, y con los mismos nombres ────────────────

test('SCRUM-386 · el contexto viaja por parámetro (por eso el cuerpo no cambió)', () => {
  // La firma es lo ÚNICO que cambió en la mudanza. Si alguien la revierte a capturar del ámbito,
  // el test de arriba lo caza; éste deja escrito CÓMO se hizo, para que la próxima persona no
  // tenga que deducirlo del diff.
  assert.match(CODIGO, /function buildAlbEditor\([^)]*ctx = \{\}\) \{/,
    '🔴 buildAlbEditor ya no recibe el contexto por parámetro');
  assert.match(CODIGO, /const \{ cur, refresh, setStatus \} = ctx;/,
    '🔴 el contexto ya no se desestructura con los mismos nombres: el cuerpo habría que reescribirlo');
  assert.match(CODIGO, /function openAlbEditorSheet\(alb, ctx\) \{/);
  assert.match(CODIGO, /function openFacturarParcialSheet\(alb, ctx\) \{/,
    '🔴 openFacturarParcialSheet ya no recibe el contexto por parámetro');
  assert.match(CODIGO, /const \{ refresh, setStatus \} = ctx;/,
    '🔴 la hoja de facturar ya no desestructura con los mismos nombres');
});

test('SCRUM-386 · la línea del apiRequest de facturar-parcial no se tocó', () => {
  // La condición que puso el fundador al dar el GO. Se comprueba el TEXTO EXACTO: esta hoja es un
  // CLIENTE del camino de emisión (que vive en el servidor), y una mudanza no puede cambiar ni la
  // ruta ni la forma de la llamada.
  assert.match(
    CODIGO,
    /const d = await apiRequest\(`\/admin\/albaranes\/\$\{alb\.id\}\/facturar-parcial`, \{/,
    '🔴 la llamada a facturar-parcial ha cambiado: esto ya no es una mudanza',
  );
});

// ── EL CONTRATO DEL CONTEXTO, POR AST ───────────────────────────────────────────────────
//
// ⚠️ ESTE GUARD SE HA EQUIVOCADO CUATRO VECES, Y LAS CUATRO ENSEÑAN COSAS DISTINTAS. Van las
// cuatro enteras a propósito: resumirlas las convierte en una sola lección, y no lo son.
//
//   1ª · EL REGEX QUE NO CRUZABA LOS `;`. Buscaba la llamada entera con un regex multilínea
//        (`buildAlbEditor\(bodyEl,[^;]*?\}, \{ cur…`) y salía ROJA con el código CORRECTO: `[^;]*?`
//        no puede cruzar los `;` del cuerpo del objeto de opciones. El fallo estaba en el
//        INSTRUMENTO, no en lo medido — la misma familia que un «0 menciones» de un grep apuntado a
//        un fichero que no existe.
//
//   2ª · EL LITERAL CONGELADO. El arreglo de la anterior —contar el literal exacto
//        `{ cur, refresh, setStatus })`— aguantó hasta que SCRUM-300 (C5) necesitó añadir
//        `direccionSugerida` a uno de los dos pasos. El contador bajó de 2 a 1 y el guard se puso
//        rojo ante un cambio LEGÍTIMO. Es la que da la lección de fondo, porque hacía **imposible
//        una clase entera de cambio**: cualquier propiedad añadida a cualquiera de los pasos lo
//        rompía. La señal que lo delata, y sirve para la próxima vez: **si no existe NINGUNA forma
//        de escribir el cambio legítimo que deje el guard verde, el problema es del guard.** Un
//        contrato admite muchas redacciones; una redacción solo se admite a sí misma. Misma familia
//        que SCRUM-381: un guard que fija una ruta sin resolverla vigila la ortografía, no el
//        cableado.
//
//   3ª · Y VOLVIÓ A MORDER, tercera vez y mismo patrón. SCRUM-292 añadió `customer` al contexto de
//        la hoja de facturar —necesita saber si al cliente le falta el NIF— y el guard salió ROJO
//        con el código CORRECTO, porque exigía el objeto literal `{ refresh, setStatus }`.
//        **Extender un contexto no es dejar de pasarlo.**
//
//   4ª · LA MÁS CARA, y es de este mismo arreglo. SCRUM-392 cambió el regex por el escáner AST de
//        abajo —el mecanismo correcto— pero su tabla `RECIBEN_CTX` solo llevaba `buildAlbEditor` y
//        `openAlbEditorSheet`: **`openFacturarParcialSheet` se quedó FUERA DEL CENSO.** El guard al
//        que sustituía sí la comprobaba, así que el cambio de instrumento **borró una comprobación
//        y nada se puso rojo** — el suelo global de entonces (`pasos.length >= 3`) se satisfacía de
//        sobra con las llamadas de las otras dos funciones. Un suelo que cuenta el TOTAL no nota
//        que un sumando ha desaparecido.
//
//        **Un escáner que sustituye a otro tiene que cubrir todo lo que cubría el anterior, y eso
//        no lo dice ningún test que no se escriba a propósito.** De ahí el SUELO POR FUNCIÓN de más
//        abajo: cada función declarada tiene que aparecer en el censo al menos una vez, y si no
//        aparece el guard dice SU NOMBRE en vez de callarse tras un total que cuadra.
//
// LO QUE SE SOSTIENE: cada llamada pasa un contexto que CONTIENE al menos las claves que el cuerpo
// de esa función desestructura. Añadir claves es libre; quitar una que el cuerpo usa, no — llega
// `undefined`, compila, pasa el CI y revienta en la obra.

/**
 * Las funciones que reciben contexto. **La LISTA va a mano porque es la declaración de intención**
 * (si alguien le quita el `ctx` a una, queremos rojo, no que el guard se encoja con el código).
 *
 * La POSICIÓN del argumento y las CLAVES exigidas **NO se escriben aquí: se DERIVAN del código**
 * (`posicionDeCtx` y `clavesExigidas`). Una tabla a mano se desincroniza del cuerpo que dice
 * servir, y eso es el defecto de las cuatro lecciones de arriba cometido una capa más abajo.
 */
const RECIBEN_CTX = ['buildAlbEditor', 'openAlbEditorSheet', 'openFacturarParcialSheet'];

/** En qué posición está el parámetro `ctx` de esa función. `null` = no lo recibe (o no existe). */
function posicionDeCtx(nombre) {
  const fn = buscarFuncion(nombre);
  if (!fn) return null;
  const i = fn.parameters.findIndex((p) => ts.isIdentifier(p.name) && p.name.text === 'ctx');
  return i === -1 ? null : i;
}

/** Las claves que el CUERPO de esa función desestructura de `ctx` (`const { … } = ctx;`). */
function clavesPropias(nombre) {
  const fn = buscarFuncion(nombre);
  const out = new Set();
  if (!fn) return out;
  const v = (n) => {
    if (
      ts.isVariableDeclaration(n) && ts.isObjectBindingPattern(n.name) &&
      n.initializer && ts.isIdentifier(n.initializer) && n.initializer.text === 'ctx'
    ) {
      for (const el of n.name.elements) out.add((el.propertyName || el.name).getText(SF));
    }
    ts.forEachChild(n, v);
  };
  v(fn);
  return out;
}

/** A qué otras funciones con contexto les REENVÍA esa función su propio `ctx` (`…, ctx)`). */
function reenviosDe(nombre) {
  const fn = buscarFuncion(nombre);
  const out = new Set();
  if (!fn) return out;
  const v = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && RECIBEN_CTX.includes(n.expression.text)) {
      const i = posicionDeCtx(n.expression.text);
      const arg = i === null ? undefined : n.arguments[i];
      if (arg && ts.isIdentifier(arg) && arg.text === 'ctx') out.add(n.expression.text);
    }
    ts.forEachChild(n, v);
  };
  v(fn);
  return out;
}

/**
 * El contrato COMPLETO de una función: lo que su cuerpo desestructura **más** lo que exige aquello
 * a lo que reenvía su `ctx` intacto.
 *
 * ⚠️ Lo transitivo no es un adorno: `openAlbEditorSheet` **no desestructura nada** —solo reenvía a
 * `buildAlbEditor`—, así que derivar únicamente de su propio cuerpo le daría un contrato VACÍO y el
 * paso de contexto del botón «Editar líneas» dejaría de comprobarse. Sería la 4ª lección otra vez,
 * en versión silenciosa.
 */
function clavesExigidas(nombre, vistos = new Set()) {
  if (vistos.has(nombre)) return new Set();
  vistos.add(nombre);
  const out = clavesPropias(nombre);
  for (const destino of reenviosDe(nombre)) {
    for (const k of clavesExigidas(destino, vistos)) out.add(k);
  }
  return out;
}

/** Todo paso de contexto del fichero, con sus claves si es un objeto literal. */
function pasosDeContexto() {
  const out = [];
  const v = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && RECIBEN_CTX.includes(n.expression.text)) {
      const i = posicionDeCtx(n.expression.text);
      const arg = i === null ? undefined : n.arguments[i];
      out.push({
        fn: n.expression.text,
        linea: SF.getLineAndCharacterOfPosition(n.getStart(SF)).line + 1,
        // Objeto escrito ahí mismo → se pueden leer sus claves.
        claves: arg && ts.isObjectLiteralExpression(arg)
          ? arg.properties.map((p) => p.name && p.name.getText(SF)).filter(Boolean)
          : null,
        // `…, ctx)` → REENVÍO: el contexto viene de más arriba y ya se validó en su origen.
        reenvio: arg && ts.isIdentifier(arg) ? arg.text : null,
        ausente: arg === undefined,
      });
    }
    ts.forEachChild(n, v);
  };
  v(SF);
  return out;
}

/** Nº mínimo de pasos de contexto MEDIDO en el árbol: 3 literales + 1 reenvío (7-ago-2026). */
const PASOS_ESPERADOS = 4;
/** De ésos, los escritos como objeto ahí mismo: crear, editar desde la fila y facturar parcial. */
const LITERALES_ESPERADOS = 3;

test('SCRUM-386 · los tres llamadores le pasan el contexto (el HECHO, no su redacción)', () => {
  // Sacar la función y no pasarle el contexto compila igual y revienta en tiempo de ejecución,
  // que es el peor de los dos momentos: pasa el CI y falla en la obra.

  // ── SUELO A · el escáner sabe DÓNDE mirar en cada función ──────────────────────────────
  // Si una función declarada no existe o perdió su `ctx`, el censo se queda corto EN SILENCIO.
  const ciegas = RECIBEN_CTX.filter((f) => posicionDeCtx(f) === null);
  assert.deepEqual(
    ciegas, [],
    `🔴 ESCÁNER CIEGO en: ${ciegas.join(', ')}. O la función ya no existe (¿la renombraron?) o ha ` +
      'perdido su parámetro `ctx`. En los dos casos el censo dejaría de contar sus llamadas y el ' +
      'total seguiría cuadrando gracias a las demás — que es exactamente cómo este guard perdió a ' +
      '`openFacturarParcialSheet` (4ª lección de arriba). ARREGLA EL ESCÁNER, no el número.',
  );

  // ── SUELO B · y sabe QUÉ exigir ────────────────────────────────────────────────────────
  // El contrato se DERIVA del cuerpo. Si la derivación no saca nada, no es que no haga falta
  // ninguna clave: es que no supo leer, y entonces todo pasaría en verde sin comprobar nada.
  const contrato = new Map(RECIBEN_CTX.map((f) => [f, [...clavesExigidas(f)]]));
  const sinContrato = [...contrato].filter(([, ks]) => ks.length === 0).map(([f]) => f);
  assert.deepEqual(
    sinContrato, [],
    `🔴 no he podido DERIVAR qué claves exige ${sinContrato.join(', ')}. Se leen del ` +
      '`const { … } = ctx;` de su cuerpo, más lo que exija aquello a lo que reenvía su `ctx`. Un ' +
      'contrato vacío haría pasar cualquier contexto: «no supe leer» no es «no exige nada».',
  );

  const pasos = pasosDeContexto();

  // ── SUELO C · POR FUNCIÓN, no por total ────────────────────────────────────────────────
  // El suelo global no nota que un sumando desapareció. Éste sí, y dice el nombre.
  const sinLlamadas = RECIBEN_CTX.filter((f) => !pasos.some((p) => p.fn === f));
  assert.deepEqual(
    sinLlamadas, [],
    `🔴 CENSO INCOMPLETO: no he visto NI UNA llamada a ${sinLlamadas.join(', ')}. Si de verdad ya ` +
      'no se llama, sácala de RECIBEN_CTX a conciencia; si se llama de otra forma, arregla el ' +
      'escáner. Lo que no vale es un guard que no vigila una función y no lo dice.',
  );

  assert.ok(
    pasos.length >= PASOS_ESPERADOS,
    `🔴 ESCÁNER CIEGO: esperaba al menos ${PASOS_ESPERADOS} llamadas con contexto (crear, editar ` +
      `desde la fila, facturar parcial y el reenvío de la hoja) y encontré ${pasos.length}. Si las ` +
      'llamadas cambiaron de forma, ARREGLA EL ESCÁNER — un censo que no sabe mirar da el mismo ' +
      'número que un censo vacío.',
  );

  const sinContexto = pasos.filter((p) => p.ausente);
  assert.deepEqual(
    sinContexto.map((p) => `${p.fn}:${p.linea}`), [],
    '🔴 hay llamadas SIN contexto: ' + sinContexto.map((p) => `${p.fn}:${p.linea}`).join(' · '),
  );

  // Los que escriben el objeto ahí mismo: cada uno tiene que llevar lo que SU función exige.
  // De más, lo que quieran — añadir claves es libre (2ª y 3ª lección).
  const literales = pasos.filter((p) => p.claves);
  assert.ok(
    literales.length >= LITERALES_ESPERADOS,
    `🔴 esperaba al menos ${LITERALES_ESPERADOS} pasos de contexto escritos como objeto (el editor ` +
      `desde la fila, el de crear y el de facturar parcial) y hay ${literales.length}.`,
  );

  for (const p of literales) {
    const exige = contrato.get(p.fn);
    const faltan = exige.filter((k) => !p.claves.includes(k));
    assert.deepEqual(
      faltan, [],
      `🔴 ${p.fn} (línea ${p.linea}) recibe un contexto SIN «${faltan.join('», «')}». Su cuerpo ` +
        `desestructura {${exige.join(', ')}}, así que la que falte llega \`undefined\` y revienta ` +
        `al usarla: compila, pasa el CI y falla en la obra. Lleva: {${p.claves.join(', ')}}.`,
    );
  }

  // Y el reenvío de la hoja al editor, que es lo que hace que el de la fila llegue hasta abajo.
  const reenvios = pasos.filter((p) => p.reenvio === 'ctx');
  assert.ok(
    reenvios.length >= 1,
    '🔴 `openAlbEditorSheet` ya no reenvía su `ctx` a `buildAlbEditor`: el contexto se pierde a ' +
      'mitad de camino y el editor abierto desde la fila se queda sin él.',
  );
});

test('SCRUM-386 · el botón «Editar líneas» le pasa el contexto a la hoja', () => {
  const desdeLaFila = pasosDeContexto().find((p) => p.fn === 'openAlbEditorSheet' && p.claves);
  assert.ok(desdeLaFila, '🔴 el botón «Editar líneas» ya no le pasa un contexto a la hoja');
  // `openAlbEditorSheet` no desestructura nada: lo reenvía. Su contrato es el de `buildAlbEditor`,
  // y por eso `clavesExigidas` resuelve el reenvío en vez de quedarse en el cuerpo propio.
  const exige = [...clavesExigidas('openAlbEditorSheet')];
  const faltan = exige.filter((k) => !desdeLaFila.claves.includes(k));
  assert.deepEqual(
    faltan, [],
    `🔴 al abrir el editor desde la fila falta «${faltan.join('», «')}» en el contexto. Ese ctx ` +
      `viaja intacto hasta buildAlbEditor, que desestructura {${exige.join(', ')}}.`,
  );
});
