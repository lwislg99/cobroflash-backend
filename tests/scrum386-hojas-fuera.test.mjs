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
const FUERA = ['albTotalesJS', 'buildAlbEditor', 'openAlbEditorSheet'];

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
});

// ── EL CONTRATO DEL CONTEXTO, POR AST ───────────────────────────────────────────────────
//
// ⚠️ ESTE TEST SE HA EQUIVOCADO DOS VECES EN LA MISMA DIRECCIÓN. Las dos vigilando la
// REDACCIÓN en vez del contrato, y merece la pena que las dos queden escritas:
//
//   1ª · buscaba la llamada entera con un regex multilínea (`buildAlbEditor\(bodyEl,[^;]*?\},
//        \{ cur…`) y salía ROJA con el código CORRECTO: `[^;]*?` no cruza los `;` del cuerpo del
//        objeto de opciones. Falso rojo.
//   2ª · el arreglo de aquella —contar el literal exacto `{ cur, refresh, setStatus })`— aguantó
//        hasta que SCRUM-300 (C5) necesitó añadir `direccionSugerida` a uno de los dos pasos.
//        Entonces el contador bajó de 2 a 1 y el guard se puso rojo ante un cambio LEGÍTIMO.
//
// La segunda es la que da la lección, porque el guard hacía **imposible una clase entera de
// cambio**: cualquier propiedad añadida a cualquiera de los dos pasos lo rompía. Y eso ya no es
// vigilar un contrato — es congelar una redacción. Misma familia que SCRUM-381: un guard que fija
// una ruta sin resolverla vigila la ortografía, no el cableado.
//
// Lo que de verdad hay que sostener: **cada llamada recibe un contexto que CONTIENE al menos
// `cur`, `refresh` y `setStatus`**. Añadir claves es libre; quitar una de las tres, no.

/** Qué funciones reciben contexto, y en qué POSICIÓN de sus argumentos. */
const RECIBEN_CTX = {
  buildAlbEditor: 3,      // (box, alb, opciones, ctx)
  openAlbEditorSheet: 1,  // (alb, ctx)
};

/** Las tres que el cuerpo desestructura: si falta una, revienta en ejecución, no al compilar. */
const CLAVES_MINIMAS = ['cur', 'refresh', 'setStatus'];

/** Todo paso de contexto del fichero, con sus claves si es un objeto literal. */
function pasosDeContexto() {
  const out = [];
  const v = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const i = RECIBEN_CTX[n.expression.text];
      if (i !== undefined) {
        const arg = n.arguments[i];
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
    }
    ts.forEachChild(n, v);
  };
  v(SF);
  return out;
}

test('SCRUM-386 · los dos llamadores le pasan el contexto (el HECHO, no su redacción)', () => {
  // Sacar la función y no pasarle el contexto compila igual y revienta en tiempo de ejecución,
  // que es el peor de los dos momentos: pasa el CI y falla en la obra.
  const pasos = pasosDeContexto();

  // SUELO. Si el escáner deja de reconocer las llamadas —porque se renombren, se muevan a un
  // método o se llamen por referencia— aquí sale CERO, y «no supe mirar» se lee igual que «está
  // bien». Falla en vez de informar de cero.
  assert.ok(
    pasos.length >= 3,
    `🔴 ESCÁNER CIEGO: esperaba al menos 3 llamadas con contexto (crear, editar y el reenvío de ` +
      `la hoja) y encontré ${pasos.length}. Si las llamadas cambiaron de forma, ARREGLA EL ` +
      'ESCÁNER — un censo que no sabe mirar da el mismo número que un censo vacío.',
  );

  const sinContexto = pasos.filter((p) => p.ausente);
  assert.deepEqual(
    sinContexto.map((p) => `${p.fn}:${p.linea}`), [],
    '🔴 hay llamadas SIN contexto: ' + sinContexto.map((p) => `${p.fn}:${p.linea}`).join(' · '),
  );

  // Los que escriben el objeto ahí mismo: tienen que llevar las tres. De más, lo que quieran.
  const literales = pasos.filter((p) => p.claves);
  assert.equal(
    literales.length, 2,
    `🔴 esperaba DOS pasos de contexto escritos como objeto (el editor desde la fila y el de ` +
      `crear) y hay ${literales.length}.`,
  );

  for (const p of literales) {
    const faltan = CLAVES_MINIMAS.filter((k) => !p.claves.includes(k));
    assert.deepEqual(
      faltan, [],
      `🔴 ${p.fn} (línea ${p.linea}) recibe un contexto SIN «${faltan.join('», «')}». El cuerpo ` +
        'desestructura las tres, así que la que falte llega `undefined` y revienta al usarla: ' +
        `compila, pasa el CI y falla en la obra. Lleva: {${p.claves.join(', ')}}.`,
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
  const faltan = CLAVES_MINIMAS.filter((k) => !desdeLaFila.claves.includes(k));
  assert.deepEqual(
    faltan, [],
    `🔴 al abrir el editor desde la fila falta «${faltan.join('», «')}» en el contexto.`,
  );
});
