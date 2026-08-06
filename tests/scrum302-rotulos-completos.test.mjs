// tests/scrum302-rotulos-completos.test.mjs — SCRUM-302 (C2)
//
// TODO BOTÓN QUE LA PÁGINA CREA TIENE QUE TENER RÓTULO. Suena obvio; llegó a main sin cumplirse.
//
// ── EL FALLO REAL QUE ESTE GUARD EXISTE PARA CAZAR ──────────────────────────────────────────
// Una edición partió `ROTULOS_ALBARAN` en dos objetos para colar una constante entre medias, y
// llamó a la cola `_FIN_ROTULOS`. Nadie leía la cola. Seis de los diez botones se quedaron sin
// entrada, `ROTULOS_ALBARAN[id]` devolvió `undefined` y el `||` los mandó al marcador. En el
// estado `borrador` los TRES botones de la barra decían «[PENDIENTE microcopy oficial]».
//
// ── POR QUÉ NO LO CAZÓ NADA ─────────────────────────────────────────────────────────────────
// Porque el JS era VÁLIDO: dos objetos bien formados, cero errores de sintaxis, cero excepciones
// en tiempo de ejecución. El guard del marcador (SCRUM-283) seguía verde porque comprueba que el
// marcador EXISTA y se use — y aquí se usaba, de más. Y el guard del patrón seguía verde porque
// mira DÓNDE va cada acción, no cómo se llama. Cada instrumento miraba a su sitio; el hueco
// estaba entre los tres.
//
// El marcador es una red de seguridad legítima —mejor un texto visible que un botón mudo— pero
// **cae hacia el lado equivocado en una fusión**: convierte «se ha perdido un rótulo» en «esta
// acción todavía no tiene rótulo aprobado», que es una frase perfectamente normal en este
// proyecto. Un relleno que se pinta es peor que un hueco: parece intencionado.
//
// Así que la lista de botones NO se escribe aquí: se DERIVA del AST de la vista. Una lista a mano
// tendría el mismo defecto que causó el fallo — no avisa de lo que le falta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const VISTA = path.join(import.meta.dirname, '..', 'public/dashboard/js/albaranDetailView.js');
const codigo = fs.readFileSync(VISTA, 'utf8');
const arbol = ts.createSourceFile('albaranDetailView.js', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

/** Los botones que la vista CREA de verdad: primer argumento literal de cada `mk('btnX', …)`. */
function botonesCreados() {
  const ids = new Set();
  (function mirar(n) {
    if (ts.isCallExpression(n) && n.expression.getText(arbol) === 'mk') {
      const a0 = n.arguments[0];
      if (a0 && ts.isStringLiteral(a0)) ids.add(a0.text);
    }
    ts.forEachChild(n, mirar);
  })(arbol);
  return [...ids];
}

/** Las claves de `ROTULOS_ALBARAN`, leídas del objeto REAL — no de una copia en el test. */
function rotulosDeclarados() {
  let obj = null;
  (function buscar(n) {
    if (!obj && ts.isVariableDeclaration(n) && n.name.getText(arbol) === 'ROTULOS_ALBARAN'
        && n.initializer && ts.isObjectLiteralExpression(n.initializer)) { obj = n.initializer; return; }
    if (!obj) ts.forEachChild(n, buscar);
  })(arbol);
  if (!obj) return null;
  const pares = {};
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer)) pares[p.name.getText(arbol)] = p.initializer.text;
  }
  return pares;
}

test('SCRUM-302 · SUELO: el extractor ve botones y ve rótulos', () => {
  const creados = botonesCreados();
  const rotulos = rotulosDeclarados();
  assert.ok(creados.length >= 9, `solo ${creados.length} botones derivados de la vista: el extractor no está mirando, la página tiene al menos nueve`);
  assert.notEqual(rotulos, null, 'no se encontró `ROTULOS_ALBARAN`');
  assert.ok(Object.keys(rotulos).length >= 9, `solo ${Object.keys(rotulos).length} rótulos leídos: o el objeto está partido otra vez, o el lector no lo ve entero`);
});

test('SCRUM-302 · ningún botón de la página se queda sin rótulo', () => {
  const rotulos = rotulosDeclarados();
  const sinRotulo = botonesCreados().filter((id) => !(id in rotulos));
  assert.deepEqual(
    sinRotulo, [],
    `estos botones se pintarían con el marcador «[PENDIENTE microcopy oficial]» en pantalla: ${JSON.stringify(sinRotulo)}. Si el rótulo existe pero está fuera de ROTULOS_ALBARAN, el objeto se ha partido — vuelve a unirlo. Si de verdad falta microcopy, pídelo al fundador (regla 30) y déjalo declarado, no suelto`,
  );
});

// Objetos que legítimamente tienen claves `btnX` con valor de texto SIN ser rótulos. Va aquí
// arriba y con su motivo porque una excepción que no se ve es una excepción que nadie revisa.
//   · PUENTES_A_LA_FILA — mapea acción → nombre de la función de `jobDetailView.js` que tiene el
//     mecanismo. Su valor es un IDENTIFICADOR, no texto de pantalla (SCRUM-302, sin-callejones).
// La primera versión de este guard no la tenía y dio ROJO EN FALSO el primer día. Un guard que da
// rojo en falso es un guard que alguien acaba silenciando, así que se declara, no se afloja.
const OBJETOS_QUE_NO_SON_ROTULOS = ['PUENTES_A_LA_FILA'];

test('SCRUM-302 · SUELO: la excepción declarada sigue existiendo', () => {
  // Si `PUENTES_A_LA_FILA` desaparece, esta excepción deja de proteger nada y pasa a ser un
  // agujero abierto para el próximo objeto que se llame igual.
  for (const nombre of OBJETOS_QUE_NO_SON_ROTULOS) {
    assert.match(codigo, new RegExp(`const ${nombre}\\s*=`),
      `\`${nombre}\` está en la lista de excepciones pero ya no existe: quítalo de OBJETOS_QUE_NO_SON_ROTULOS`);
  }
});

test('SCRUM-302 · no hay rótulos huérfanos declarados fuera de ROTULOS_ALBARAN', () => {
  // La forma EXACTA en que se rompió: un segundo objeto con pinta de rótulos que nadie lee.
  // Se detecta por el contenido (claves `btnX`), no por el nombre `_FIN_ROTULOS`: el próximo
  // accidente se llamará de otra manera.
  const huerfanos = [];
  (function mirar(n) {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isObjectLiteralExpression(n.initializer)
        && n.name.getText(arbol) !== 'ROTULOS_ALBARAN'
        && !OBJETOS_QUE_NO_SON_ROTULOS.includes(n.name.getText(arbol))) {
      const claves = n.initializer.properties
        .filter((p) => ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer))
        .map((p) => p.name.getText(arbol))
        .filter((k) => /^btn[A-Z]/.test(k));
      if (claves.length) huerfanos.push({ objeto: n.name.getText(arbol), claves });
    }
    ts.forEachChild(n, mirar);
  })(arbol);
  assert.deepEqual(
    huerfanos, [],
    `hay rótulos de botón declarados en un objeto que la vista no lee: ${JSON.stringify(huerfanos)}. Es como se perdieron seis rótulos camino de main — el JS es válido y nada peta, simplemente no se pintan`,
  );
});

test('SCRUM-302 · ningún rótulo aprobado es el propio marcador', () => {
  // Un rótulo puede existir y aun así no decir nada: copiar el marcador dentro del objeto pasaría
  // los dos tests de arriba y seguiría pintando relleno en pantalla.
  const rotulos = rotulosDeclarados();
  const relleno = Object.entries(rotulos).filter(([, v]) => /PENDIENTE|TODO|FIXME|XXX/i.test(v));
  assert.deepEqual(relleno, [], `rótulos que son relleno, no texto: ${JSON.stringify(relleno)}`);
});
