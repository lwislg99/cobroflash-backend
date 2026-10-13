// tests/_titulo-provisional-del-router.mjs — SCRUM-1482b
//
// QUÉ TÍTULO ESCRIBE EL ROUTER al abrir la ficha de un presupuesto, sacado del router DE VERDAD.
//
// POR QUÉ EXISTE. El banco de vistas no ejecuta el router (`app.js` arranca la aplicación entera).
// Hasta el 13-oct-2026, los tests que montan la ficha SEMBRABAN el título de la vista con una
// cadena copiada a mano de lo que el router escribía («Presupuesto #» + el id de la ruta). Una
// copia no se entera cuando el original cambia: un router que escribiera otra cosa los habría
// dejado a todos en verde, midiendo una ficha que ya no recibe ese título (SCRUM-1482 c.19078).
//
// QUÉ HACE. Busca por AST, en `public/dashboard/js/app.js`, el `case 'quotes-detail'` del router y
// la asignación `viewTitle.textContent = <expresión>` que lleva dentro, y EVALÚA esa expresión con
// lo único que el router tiene en ese momento: `state` (con el id de la ruta) y `L` (el locale).
//
// FALLA CERRADO («no pude mirar» no es un título):
//   · si no hay exactamente UN `case 'quotes-detail'`, o no hay exactamente UNA asignación → lanza;
//   · si la expresión nombra algo que no sea `state` o `L` → `ReferenceError`, que sale tal cual;
//   · si el resultado no es un texto → lanza.
//
// LO QUE NO MIRA: que esa línea se ejecute de verdad en el navegador, ni `document.title` (la
// pestaña), que el router escribe después a partir de este mismo título. Eso se mide en navegador.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RUTA = path.join('public', 'dashboard', 'js', 'app.js');

/** La expresión que el router asigna al título de la vista en `case 'quotes-detail'`, como texto. */
export function expresionDelTituloDeLaFicha(raiz) {
  const fuente = fs.readFileSync(path.join(raiz, RUTA), 'utf8');
  const arbol = ts.createSourceFile('app.js', fuente, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);

  const casos = [];
  const buscarCasos = (nodo) => {
    if (ts.isCaseClause(nodo) && ts.isStringLiteral(nodo.expression) && nodo.expression.text === 'quotes-detail') casos.push(nodo);
    ts.forEachChild(nodo, buscarCasos);
  };
  buscarCasos(arbol);
  if (casos.length !== 1) {
    throw new Error(`CIEGO: en ${RUTA} hay ${casos.length} \`case 'quotes-detail'\` y se espera exactamente uno. `
      + 'Si el router ha cambiado de forma, este helper ya no sabe qué título escribe.');
  }

  const asignaciones = [];
  const buscarAsignaciones = (nodo) => {
    if (ts.isBinaryExpression(nodo)
      && nodo.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && nodo.left.getText(arbol) === 'viewTitle.textContent') asignaciones.push(nodo.right.getText(arbol));
    ts.forEachChild(nodo, buscarAsignaciones);
  };
  casos[0].statements.forEach(buscarAsignaciones);
  if (asignaciones.length !== 1) {
    throw new Error(`CIEGO: el \`case 'quotes-detail'\` de ${RUTA} asigna \`viewTitle.textContent\` ${asignaciones.length} `
      + 'veces y se espera exactamente una. Con dos no se sabe cuál es el título de la ficha.');
  }
  return asignaciones[0];
}

/**
 * El título que el router deja al abrir la ficha del presupuesto `quoteId`, con ese locale.
 * @param {string} raiz la raíz del repositorio
 * @param {{ quoteId: number | null, locale: { quote: string, quotePlural: string } }} con
 */
export function tituloProvisionalDelRouter(raiz, { quoteId, locale }) {
  const expresion = expresionDelTituloDeLaFicha(raiz);
  // Sólo `state` y `L`: es lo que el router tiene a mano antes de que llegue ninguna respuesta.
  const titulo = new Function('state', 'L', `"use strict"; return (${expresion});`)({ quoteId }, locale);
  if (typeof titulo !== 'string') {
    throw new Error(`CIEGO: la expresión del router (\`${expresion}\`) no da un texto con este locale: ${JSON.stringify(titulo)}.`);
  }
  return titulo;
}
