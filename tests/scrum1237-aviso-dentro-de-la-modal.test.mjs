// tests/scrum1237-aviso-dentro-de-la-modal.test.mjs — SCRUM-1237
//
// EL DEFECTO, MEDIDO EN yaqu.app (build 37c52e17, sonda con cero escrituras): en la modal «Presupuesto
// #N generado» se pulsa «✉ Enviar por email» con un cliente sin correo. El servidor contesta 400
// `customer_missing_email` y la pantalla lo traduce bien… y lo escribe con `setAlert` en el aviso del
// FORMULARIO, que la modal TAPA (`elementFromPoint` no lo alcanza). El botón vuelve a su rótulo, nada
// pasa a «hecho» y el error aparece al cerrar. Lo mismo con los errores de WhatsApp de esa modal.
//
// QUÉ SE VIGILA, sobre el AST de `openQuoteModal` (los comentarios no son nodos: no se lee a sí mismo):
//   1. cada `setAlert(...)` de la modal va seguido, en su mismo bloque, de `copiarAvisoALaModal()`;
//   2. el aviso de la modal se cuelga DENTRO de la modal (`shareWrap`), no en la página;
//   3. con `clienteSinEmail` el botón de correo nace desactivado (la conducta de la ficha);
//   4. `clienteSinEmail` sólo se pone si el detalle LLEGÓ (`detailRes.ok`), y viaja en la hoja.
// El veredicto de verdad es el navegador (sondas-s2/sin-correo-1237.mjs); esto es la red que corre siempre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHERO = path.join(RAIZ, 'public', 'dashboard', 'js', 'quotesView.js');
const FUENTE = fs.readFileSync(FICHERO, 'utf8');

const esLlamadaA = (n, nombre) => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === nombre;

function recorrer(nodo, f) {
  f(nodo);
  ts.forEachChild(nodo, (h) => recorrer(h, f));
}

/** Lo que falta en un fuente para que el arreglo esté entero. Puro: recibe el texto. */
export function faltasDe(fuente) {
  const sf = ts.createSourceFile('quotesView.js', fuente, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS);
  const faltas = [];
  let modal = null;
  recorrer(sf, (n) => { if (ts.isFunctionDeclaration(n) && n.name && n.name.text === 'openQuoteModal') modal = n; });
  if (!modal) return ['no se encuentra `openQuoteModal`: el guard no mide nada'];

  // 1 · cada setAlert de la modal, seguido de la copia
  let avisos = 0;
  recorrer(modal.body, (n) => {
    if (!esLlamadaA(n, 'setAlert')) return;
    avisos++;
    const sentencia = n.parent;
    const bloque = sentencia && sentencia.parent;
    const siguiente = bloque && ts.isBlock(bloque) ? bloque.statements[bloque.statements.indexOf(sentencia) + 1] : null;
    const copia = siguiente && ts.isExpressionStatement(siguiente) && esLlamadaA(siguiente.expression, 'copiarAvisoALaModal');
    if (!copia) faltas.push(`línea ${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}: \`${n.getText(sf).slice(0, 60)}\` no va seguido de \`copiarAvisoALaModal()\``);
  });
  if (avisos === 0) faltas.push('la modal no tiene ningún `setAlert`: el guard no mide nada');

  // 2 · el aviso, dentro de la modal
  let colgado = false;
  recorrer(modal.body, (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'appendChild'
      && n.expression.expression.getText(sf) === 'shareWrap' && n.arguments[0] && n.arguments[0].getText(sf) === 'avisoDeLaModal') colgado = true;
  });
  if (!colgado) faltas.push('`avisoDeLaModal` no se cuelga de `shareWrap`: no está dentro de la modal');

  // 3 · con clienteSinEmail, el botón nace desactivado
  const param = modal.parameters[0];
  const recibe = param && ts.isObjectBindingPattern(param.name) && param.name.elements.some((e) => e.name.getText(sf) === 'clienteSinEmail');
  if (!recibe) faltas.push('`openQuoteModal` no recibe `clienteSinEmail`');
  let desactiva = false;
  recorrer(modal.body, (n) => {
    if (!ts.isIfStatement(n) || n.expression.getText(sf) !== 'clienteSinEmail') return;
    recorrer(n.thenStatement, (m) => {
      if (ts.isBinaryExpression(m) && m.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && m.left.getText(sf) === 'emailBtn.disabled' && m.right.kind === ts.SyntaxKind.TrueKeyword) desactiva = true;
    });
  });
  if (!desactiva) faltas.push('con `clienteSinEmail` el botón de correo no se desactiva');

  // 4 · se pone sólo si el detalle llegó, y viaja en la hoja
  let dentroDelOk = false;
  let fueraDelOk = false;
  recorrer(sf, (n) => {
    if (!(ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && n.left.getText(sf) === 'clienteSinEmail')) return;
    let p = n.parent;
    let bajoOk = false;
    while (p) { if (ts.isIfStatement(p) && p.expression.getText(sf) === 'detailRes.ok') { bajoOk = true; break; } p = p.parent; }
    if (bajoOk) dentroDelOk = true; else fueraDelOk = true;
  });
  if (!dentroDelOk) faltas.push('`clienteSinEmail` no se calcula dentro de `if (detailRes.ok)`');
  if (fueraDelOk) faltas.push('`clienteSinEmail` se asigna fuera de `if (detailRes.ok)`: sin detalle se daría por «sin email»');
  let enLaHoja = false;
  recorrer(sf, (n) => {
    if (ts.isVariableDeclaration(n) && n.name.getText(sf) === 'hojaDeEstePresupuesto' && n.initializer && ts.isObjectLiteralExpression(n.initializer)
      && n.initializer.properties.some((p) => p.name && p.name.getText(sf) === 'clienteSinEmail')) enLaHoja = true;
  });
  if (!enLaHoja) faltas.push('`hojaDeEstePresupuesto` no lleva `clienteSinEmail`');
  return faltas;
}

test('SCRUM-1237 · los avisos de la modal de revisar y enviar se ven DENTRO de la modal', () => {
  assert.deepEqual(faltasDe(FUENTE), []);
});

test('SCRUM-1237 · CONTROL: el guard cae con cada una de las regresiones', () => {
  const mutantes = {
    'quitar una copia': ['setAlert("error", err.message || "Error enviando el email.");\n        copiarAvisoALaModal();', 'setAlert("error", err.message || "Error enviando el email.");'],
    'colgar el aviso en la página': ['shareWrap.appendChild(avisoDeLaModal);', 'document.body.appendChild(avisoDeLaModal);'],
    'no desactivar el botón': ['emailBtn.disabled = true;\n      emailBtn.title', 'emailBtn.disabled = false;\n      emailBtn.title'],
    'sacarlo de la hoja': ['pendingApproval, clienteSinEmail };', 'pendingApproval };'],
    'darlo por «sin email» sin detalle': ['let clienteSinEmail = false;', 'let clienteSinEmail = false; clienteSinEmail = true;'],
  };
  for (const [nombre, [de, a]] of Object.entries(mutantes)) {
    assert.ok(FUENTE.includes(de), `CIEGO: el mutante «${nombre}» no encuentra su texto en el fuente`);
    assert.ok(faltasDe(FUENTE.replace(de, a)).length > 0, `el guard NO cae con «${nombre}»`);
  }
});
