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

test('SCRUM-386 · los dos llamadores le pasan el contexto', () => {
  // Sacar la función y no pasarle el contexto compila igual y revienta en tiempo de ejecución,
  // que es el peor de los dos momentos: pasa el CI y falla en la obra.
  //
  // ⚠️ La primera versión de este test buscaba la llamada entera con un regex multilínea
  // (`buildAlbEditor\(bodyEl,[^;]*?\}, \{ cur…`) y salía ROJA con el código CORRECTO: `[^;]*?` no
  // puede cruzar los `;` del cuerpo del objeto de opciones. El fallo estaba en el instrumento, no
  // en lo medido — igual que el «0 menciones» de un grep apuntado a un fichero inexistente.
  // Ahora se cuentan los PASOS de contexto, que es el hecho, y no la forma de escribirlos.
  const pasoFacturar = (CODIGO.match(/openFacturarParcialSheet\(alb, \{ refresh, setStatus \}\)/g) || []).length;
  assert.equal(pasoFacturar, 1,
    '🔴 la hoja de facturar parcial no recibe su contexto del único llamador que tiene');

  const pasos = (CODIGO.match(/\{ cur, refresh, setStatus \}\)/g) || []).length;
  assert.equal(
    pasos, 2,
    '🔴 esperaba DOS pasos de contexto (el editor desde la fila y el de crear) y hay ' + pasos + '. ' +
      'Sacar la función y no pasarle el contexto compila igual y revienta en ejecución: pasa el ' +
      'CI y falla en la obra.',
  );
  assert.match(CODIGO, /openAlbEditorSheet\(alb, \{ cur, refresh, setStatus \}\)/,
    '🔴 el botón «Editar líneas» ya no le pasa el contexto a la hoja');
});
