// tests/scrum302-sin-callejones.test.mjs — SCRUM-302 (C2)
//
// LA FILA DEL TRABAJO SE RECORTÓ, PERO NO DEL TODO, Y ESTE GUARD ES LA RAZÓN DE QUE ESO SEA
// SEGURO EN VEZ DE UN DESCUIDO.
//
// Al mudar las acciones del albarán a su página, cuatro de ellas no se mudaron: SE PUENTEARON.
// `btnFacturar` y `btnEditarLineas` no hacen el trabajo — llaman a `renderAppView('jobs-detail')`
// y lo delegan en la fila, porque el mecanismo real (`openFacturarParcialSheet`,
// `openAlbEditorSheet`) vive ANIDADO dentro de `renderJobDetailView` y no es alcanzable desde
// fuera.
//
// El modo de fallo que esto vigila es silencioso y llega tarde: alguien termina el traslado,
// vacía la fila «que ya estaba duplicada», y los dos botones de la página siguen ahí, siguen
// navegando, y aterrizan en un Trabajo donde ya no hay nada que pulsar. Nada peta. Ningún test
// se pone rojo. El pro descubre que no puede facturar lo que ha entregado.
//
// Por eso el contrato no es un comentario: el conjunto de puentes se DERIVA del AST de la página
// (quién navega de verdad), se contrasta con lo declarado, y se exige que la fila conserve el
// mecanismo de cada uno.
//
// ⚠️ DESTINO ≠ CALLEJÓN. `btnVerTrabajo` también navega, y está bien: navegar ES lo que hace.
// La distinción la marca `PUENTES_A_LA_FILA`, y el guard exige que sea EXACTA en los dos
// sentidos — ni de más (declarar un puente que no navega) ni de menos (navegar sin declararlo).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const PAGINA = path.join(RAIZ, 'public/dashboard/js/albaranDetailView.js');
const FILA = path.join(RAIZ, 'public/dashboard/js/jobDetailView.js');

const codigoPagina = fs.readFileSync(PAGINA, 'utf8');
const codigoFila = fs.readFileSync(FILA, 'utf8');

const sf = (nombre, codigo) =>
  ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

/**
 * Deriva, del objeto `botones` de la página, qué acciones navegan a `jobs-detail`.
 *
 * Se mira la PROPIEDAD entera (`btnX: () => mk('btnX', handler)`), no el nombre del botón: el id
 * y la clave podrían divergir y lo que importa es qué hace el handler que cuelga de esa clave.
 */
function accionesQueNavegan(codigo) {
  const arbol = sf('albaranDetailView.js', codigo);
  let objeto = null;
  (function buscar(n) {
    if (!objeto && ts.isVariableDeclaration(n) && n.name.getText() === 'botones'
        && n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
      objeto = n.initializer;
      return;
    }
    if (!objeto) ts.forEachChild(n, buscar);
  })(arbol);
  if (!objeto) return null; // el suelo de abajo lo convierte en rojo, no en «ninguna»

  const navegan = [];
  for (const prop of objeto.properties) {
    if (!prop.name) continue;
    const texto = prop.getText(arbol);
    // La navegación es una llamada concreta, con su destino literal: no vale «contiene jobs-detail»
    // (eso casaría con el comentario que explica la prohibición — la trampa de siempre).
    let navega = false;
    (function mirar(n) {
      if (navega) return;
      if (ts.isCallExpression(n) && n.expression.getText(arbol).endsWith('renderAppView')) {
        const arg0 = n.arguments[0];
        if (arg0 && ts.isStringLiteral(arg0) && arg0.text === 'jobs-detail') navega = true;
      }
      ts.forEachChild(n, mirar);
    })(prop);
    if (navega) navegan.push(prop.name.getText(arbol));
    void texto;
  }
  return navegan;
}

/** Los puentes DECLARADOS en la página, leídos del propio fichero (no re-escritos aquí). */
function puentesDeclarados(codigo) {
  const arbol = sf('albaranDetailView.js', codigo);
  let obj = null;
  (function buscar(n) {
    if (!obj && ts.isVariableDeclaration(n) && n.name.getText() === 'PUENTES_A_LA_FILA'
        && n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
      obj = n.initializer;
      return;
    }
    if (!obj) ts.forEachChild(n, buscar);
  })(arbol);
  if (!obj) return null;
  const pares = {};
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer)) {
      pares[p.name.getText(arbol)] = p.initializer.text;
    }
  }
  return pares;
}

/**
 * ¿La fila sigue OFRECIENDO ese mecanismo?
 *
 * ⚠️ NO basta con encontrar un `mkBtn(...)` que llame a la función. La primera versión de este
 * guard hacía exactamente eso y NO se puso roja al borrar `acts.appendChild(editBtn())`: el
 * constructor `editBtn` seguía declarado, así que el guard veía el botón que ya no pintaba nadie.
 * Un botón creado y jamás añadido al DOM no existe para el pro — es el mismo fallo que este
 * fichero dice cazar, escondido dentro del propio cazador.
 *
 * Así que se exigen las DOS cosas: que exista el botón y que llegue a la pantalla. Se sube desde
 * la llamada `mkBtn` hasta el nombre con el que se guarda, y se comprueba que ese nombre aparece
 * dentro de algún `appendChild(...)`. Si el botón se appendea en línea (sin nombre intermedio),
 * eso ya es llegar a la pantalla.
 */
function laFilaOfrece(codigo, nombreFuncion) {
  const arbol = sf('jobDetailView.js', codigo);

  // 1 · todo lo que se appendea, en texto: basta para preguntar si un identificador está ahí
  const appendeado = [];
  (function recoger(n) {
    if (ts.isCallExpression(n) && n.expression.getText(arbol).endsWith('appendChild')) {
      appendeado.push(...n.arguments.map((a) => a.getText(arbol)));
    }
    ts.forEachChild(n, recoger);
  })(arbol);

  // 2 · los `mkBtn` cuyo handler invoca el mecanismo
  let ofrecido = false;
  (function mirar(n) {
    if (ofrecido) return;
    if (ts.isCallExpression(n) && n.expression.getText(arbol).endsWith('mkBtn')) {
      let usaElMecanismo = false;
      (function buscarLlamada(x) {
        if (usaElMecanismo) return;
        if (ts.isCallExpression(x) && x.expression.getText(arbol).endsWith(nombreFuncion)) usaElMecanismo = true;
        ts.forEachChild(x, buscarLlamada);
      })(n);
      if (usaElMecanismo) {
        // 3 · ¿llega a la pantalla? Subir al nombre con el que se guarda.
        let nodo = n, nombre = null;
        while (nodo && !nombre) {
          if (ts.isVariableDeclaration(nodo) && ts.isIdentifier(nodo.name)) nombre = nodo.name.text;
          nodo = nodo.parent;
        }
        if (!nombre) {
          ofrecido = appendeado.some((a) => a.includes('mkBtn')); // appendeado en línea
        } else {
          const re = new RegExp(`\\b${nombre}\\b`);
          ofrecido = appendeado.some((a) => re.test(a));
        }
      }
    }
    ts.forEachChild(n, mirar);
  })(arbol);
  return ofrecido;
}

test('SCRUM-302 · SUELO: el detector de navegación encuentra algo, y encuentra el destino legítimo', () => {
  const navegan = accionesQueNavegan(codigoPagina);
  assert.notEqual(navegan, null, 'no se encontró el objeto `botones`: el detector no ha mirado nada, no es que no haya navegaciones');
  assert.ok(navegan.length > 0, 'cero navegaciones detectadas — con `btnVerTrabajo` en el árbol eso significa detector roto, no página limpia');
  assert.ok(
    navegan.includes('btnVerTrabajo'),
    'el detector no ve `btnVerTrabajo`, que navega POR DEFINICIÓN. Si no caza ese, tampoco cazaría un puente nuevo',
  );
});

test('SCRUM-302 · todo puente declarado navega de verdad', () => {
  const declarados = puentesDeclarados(codigoPagina);
  assert.notEqual(declarados, null, 'falta `PUENTES_A_LA_FILA` en la página');
  const navegan = accionesQueNavegan(codigoPagina);
  for (const id of Object.keys(declarados)) {
    assert.ok(
      navegan.includes(id),
      `\`${id}\` está declarado como puente pero ya no navega. Si se ha implementado de verdad en la página, sácalo de PUENTES_A_LA_FILA y libera a la fila`,
    );
  }
});

test('SCRUM-302 · toda navegación a jobs-detail está declarada (o es un destino, no un puente)', () => {
  const declarados = puentesDeclarados(codigoPagina);
  const navegan = accionesQueNavegan(codigoPagina);
  const DESTINOS_LEGITIMOS = ['btnVerTrabajo']; // ir al Trabajo ES su función, no una delegación
  const huerfanos = navegan.filter((id) => !DESTINOS_LEGITIMOS.includes(id) && !(id in declarados));
  assert.deepEqual(
    huerfanos, [],
    'estas acciones navegan al Trabajo sin declarar de qué mecanismo dependen. Si delegan, decláralas en PUENTES_A_LA_FILA; si su función es navegar, añádelas a DESTINOS_LEGITIMOS con su motivo',
  );
});

test('SCRUM-302 · la fila conserva el mecanismo de cada puente (nada de callejones sin salida)', () => {
  const declarados = puentesDeclarados(codigoPagina);
  for (const [id, funcion] of Object.entries(declarados)) {
    assert.ok(
      laFilaOfrece(codigoFila, funcion),
      `\`${id}\` navega al Trabajo esperando encontrar \`${funcion}()\`, pero la fila ya no tiene ningún botón que la llame: el botón de la página es un callejón sin salida. O se devuelve el botón a la fila, o se implementa la acción en la página y se saca de PUENTES_A_LA_FILA`,
    );
  }
});
