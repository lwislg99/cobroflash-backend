// tests/scrum1313-ciego-no-es-verde-ni-rojo.test.mjs — SCRUM-1313
//
// CUATRO GUARDS DE NAVEGADOR ESTUVIERON CIEGOS DOS DÍAS Y EL RECUENTO DECÍA «33 · no verdes: 4».
//
// Medido (docs/master/SCRUM-1313.md): desde el PR #1943 de SCRUM-825 (29-sep-2026) la ruta
// `#invoices-new` falla cerrado en modo 'no', y el valor 'justificante' cae a 'no'. Los arneses de
// `pasos-del-editor`, `un-solo-presupuesto`, `cabecera-del-editor` y `ajustes-del-justificante`
// seguían sirviendo 'justificante' o 'no' al abrir esa página: se pintaba el listado, no el editor, y
// no tenían nada que mirar. El job de CI que los corre no es obligatorio, así que el PR mergeó.
//
// Este fichero vigila las DOS cosas que lo dejaron pasar, y las dos corren en `npm test`:
//
//   A · LA PUERTA CUENTA TRES COSAS. `recuento` separa verdes, CIEGOS y rojos con la misma regla
//       que decide el código de salida. Sobre la función pura: lanzar la puerta son 37 navegadores.
//   B · EL ARNÉS SIRVE UN MODO QUE EXISTE. Todo guard que le sirve `documentoSuelto` al panel sirve
//       un valor que el panel LEE TAL CUAL, y el que abre `#invoices-new` sirve uno que lo pinta.
//       La regla NO se escribe aquí: se saca de `app.js` y se EJECUTA (la condición la pone quien
//       la cumple). Es lo que habría puesto en rojo el check obligatorio del PR #1943.
//
// ⚠️ LO QUE NO VIGILA, DECLARADO: que el editor se pinte de verdad. Eso sólo lo sabe un navegador,
// y lo dicen los propios guards con su CIEGO. Esto caza la causa conocida —un modo fuera del
// contrato—, no cualquier causa futura de que una pantalla no se pinte.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { recuento, veredicto, anuncio, filaDeFicheroAusente } from '../scripts/guards-visuales.mjs';
import { SALIDA_NO_ENCONTRADO, SALIDA_NO_ARRANCA } from '../scripts/_navegador.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const fila = (g, estado, codigo) => ({ g, estado, codigo });
const repetir = (n, f) => Array.from({ length: n }, (_, i) => f(i));

// ═════════════════════════════════════════════════════════════════════════════════════════════
// A · EL RECUENTO
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1313 · A1 · la tanda del 1-oct: 33 verdes, 4 CIEGOS y 0 rojos se dicen por separado', () => {
  const filas = [
    ...repetir(33, (i) => fila('guard:v' + i, 'verde', 0)),
    ...repetir(4, (i) => fila('guard:c' + i, 'CIEGO', SALIDA_NO_ENCONTRADO)),
  ];
  const c = recuento(filas);
  assert.equal(c.linea, '33 verdes · 4 CIEGOS · 0 rojos');
  assert.deepEqual([c.verdes, c.ciegos, c.rojos, c.total], [33, 4, 0, 37]);
});

test('SCRUM-1313 · A2 · 🔴 EL CONTROL: un rojo y un CIEGO no caen en la misma cuenta', () => {
  const conRojo = recuento([fila('a', 'verde', 0), fila('b', 'rojo(1)', 1)]);
  const conCiego = recuento([fila('a', 'verde', 0), fila('b', 'CIEGO', SALIDA_NO_ENCONTRADO)]);
  assert.equal(conRojo.linea, '1 verde · 0 CIEGOS · 1 rojo');
  assert.equal(conCiego.linea, '1 verde · 1 CIEGO · 0 rojos');
  // Lo que prueba el arreglo no es ninguna de las dos líneas: es que sean DISTINTAS. La de antes
  // («verdes: 1 · no verdes: 1») era la misma para las dos tandas.
  assert.notEqual(conRojo.linea, conCiego.linea);
});

test('SCRUM-1313 · A3 · las tres cuentas suman la población, también con códigos raros', () => {
  const filas = [
    fila('a', 'verde', 0), fila('b', 'rojo(1)', 1), fila('c', 'CIEGO', SALIDA_NO_ENCONTRADO),
    fila('d', 'NO ARRANCA', SALIDA_NO_ARRANCA), fila('e', 'TOPE', null), fila('f', 'rojo(143)', 143),
  ];
  const c = recuento(filas);
  assert.equal(c.verdes + c.ciegos + c.rojos, filas.length);
  assert.equal(c.total, filas.length);
  // Un código fuera del vocabulario cuenta como rojo, igual que en `veredicto` (fail-closed).
  assert.deepEqual([c.verdes, c.ciegos, c.rojos], [1, 3, 2]);
  // Y si los que no midieron no son todos del mismo tipo, se dice cuáles.
  assert.equal(c.linea, '1 verde · 3 CIEGOS (1 CIEGO · 1 NO ARRANCA · 1 TOPE) · 2 rojos');
});

test('SCRUM-1313 · A4 · el recuento y el código de salida clasifican IGUAL', () => {
  const tandas = [
    [fila('a', 'verde', 0)],
    [fila('a', 'verde', 0), fila('b', 'CIEGO', SALIDA_NO_ENCONTRADO)],
    [fila('a', 'rojo(1)', 1), fila('b', 'CIEGO', SALIDA_NO_ENCONTRADO), fila('c', 'TOPE', null)],
    [fila('a', 'NO ARRANCA', SALIDA_NO_ARRANCA), fila('b', 'NO ARRANCA', SALIDA_NO_ARRANCA)],
  ];
  for (const filas of tandas) {
    const c = recuento(filas);
    const v = veredicto(filas);
    assert.equal(c.ciegos, v.ciegos, 'los ciegos del recuento no son los del veredicto');
    assert.equal(c.rojos, v.defectos, 'los rojos del recuento no son los defectos del veredicto');
    assert.equal(v.codigo === 1, c.rojos > 0, 'sale por la puerta 1 si y sólo si hay algún rojo contado');
    assert.equal(v.codigo === 0, c.ciegos + c.rojos === 0);
  }
});

test('SCRUM-1313 · A5 · un guard declarado sin fichero deja FILA: es un CIEGO, no un hueco', () => {
  const ausente = filaDeFicheroAusente('guard:fantasma');
  const filas = [fila('a', 'verde', 0), ausente];
  // Antes no dejaba fila: `veredicto` veía sólo verdes y contestaba 0 con un guard sin correr.
  assert.equal(veredicto([fila('a', 'verde', 0)]).codigo, 0, 'suelo: sin la fila, la tanda es verde');
  assert.equal(veredicto(filas).codigo, SALIDA_NO_ENCONTRADO);
  assert.equal(recuento(filas).linea, '1 verde · 1 CIEGO · 0 rojos');
  assert.match(ausente.salida, /guard:fantasma/);
});

test('SCRUM-1313 · A6 · el recuento viaja a la anotación y al resumen de Actions', () => {
  const filas = [fila('a', 'verde', 0), fila('b', 'CIEGO', SALIDA_NO_ENCONTRADO)];
  const v = veredicto(filas);
  const con = anuncio(v, recuento(filas));
  assert.ok(con.anotacion.includes('1 verde · 1 CIEGO · 0 rojos'));
  assert.ok(con.resumen.includes('1 verde · 1 CIEGO · 0 rojos'));
  // Sin recuento sigue valiendo, como lo usa SCRUM-639.
  assert.ok(!anuncio(v).anotacion.includes('CIEGO · 0 rojos'));
});

/** El fuente sin comentarios: mi propia explicación nombra lo que se retiró. */
function sinComentarios(fuente) {
  const sf = ts.createSourceFile('x.mjs', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const trozos = [];
  const visitar = (n) => {
    if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) trozos.push(n.text);
    else if (ts.isIdentifier(n)) trozos.push(n.text);
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return trozos;
}

test('SCRUM-1313 · A7 · la puerta USA el recuento: la línea de dos cuentas no vuelve', () => {
  const trozos = sinComentarios(fs.readFileSync(path.join(RAIZ, 'scripts/guards-visuales.mjs'), 'utf8'));
  assert.ok(trozos.length > 300, 'suelo: el fuente de la puerta se ha leído (' + trozos.length + ' trozos)');
  // Positivo, con el mismo lector: una cadena que SÍ está en la puerta.
  assert.ok(trozos.some((t) => t.includes(' s en serie')), 'control: el lector ve las cadenas de la puerta');
  assert.ok(trozos.filter((t) => t === 'recuento').length >= 2, 'la puerta no llama a `recuento`');
  assert.equal(trozos.filter((t) => t.includes('no verdes')).length, 0, 'ha vuelto «no verdes»: dos cuentas donde hay tres');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// B · EL MODO QUE SIRVE CADA ARNÉS
// ═════════════════════════════════════════════════════════════════════════════════════════════

const arbolDe = (fuente, nombre = 'x.mjs') =>
  ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

/** Las cadenas a las que puede valer una expresión, o `null` si no se sabe leer. */
function cadenasDe(expr) {
  if (ts.isParenthesizedExpression(expr)) return cadenasDe(expr.expression);
  if (ts.isStringLiteralLike(expr)) return [expr.text];
  if (ts.isConditionalExpression(expr)) {
    const si = cadenasDe(expr.whenTrue);
    const no = cadenasDe(expr.whenFalse);
    return si && no ? [...si, ...no] : null;
  }
  return null;
}

/**
 * Qué modos le sirve un guard al panel y si abre `#invoices-new`.
 *
 * Lee por AST: `documentoSuelto: 'x'` y `documentoSuelto: variable`, y de la variable, TODAS sus
 * asignaciones. Lo que no sabe leer lo devuelve en `ilegible`, no lo calla.
 */
function leerArnes(fuente) {
  const sf = arbolDe(fuente);
  const valores = new Set();
  const ilegible = [];
  const variables = new Set();
  let propiedades = 0;
  let abreElSuelto = false;

  const visitar = (n) => {
    if ((ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n))
      && n.text.includes('invoices-new')) abreElSuelto = true;
    if (ts.isPropertyAssignment(n) && n.name && n.name.getText(sf) === 'documentoSuelto') {
      propiedades += 1;
      const directas = cadenasDe(n.initializer);
      if (directas) directas.forEach((v) => valores.add(v));
      else if (ts.isIdentifier(n.initializer)) variables.add(n.initializer.text);
      else ilegible.push('`documentoSuelto: ' + n.initializer.getText(sf) + '`');
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);

  for (const nombre of variables) {
    let asignaciones = 0;
    const buscar = (n) => {
      let derecha = null;
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nombre && n.initializer) derecha = n.initializer;
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isIdentifier(n.left) && n.left.text === nombre) derecha = n.right;
      if (derecha) {
        asignaciones += 1;
        const c = cadenasDe(derecha);
        if (c) c.forEach((v) => valores.add(v));
        else ilegible.push('`' + nombre + ' = ' + derecha.getText(sf) + '`');
      }
      ts.forEachChild(n, buscar);
    };
    buscar(sf);
    if (asignaciones === 0) ilegible.push('`' + nombre + '` no se asigna con una cadena en este fichero');
  }
  return { valores: [...valores].sort(), ilegible, propiedades, abreElSuelto };
}

/**
 * LA REGLA, SACADA DEL DESTINO. `app.js` decide qué hace con lo que manda el servidor en
 * `window.appDocumentoSuelto = <expresión sobre me>`. Se extrae ESA expresión y se ejecuta.
 */
function reglaDelPanel() {
  const ruta = path.join(RAIZ, 'public/dashboard/js/app.js');
  const sf = arbolDe(fs.readFileSync(ruta, 'utf8'), 'app.js');
  const expresiones = [];
  let puertaDeLaRuta = 0;
  const visitar = (n) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && n.left.getText(sf) === 'window.appDocumentoSuelto') expresiones.push(n.right.getText(sf));
    // La puerta de la ruta: dentro del `case 'invoices-new'`, un `if` que compara el modo con 'no'.
    if (ts.isCaseClause(n) && ts.isStringLiteralLike(n.expression) && n.expression.text === 'invoices-new') {
      const dentro = (m) => {
        if (ts.isIfStatement(m) && m.expression.getText(sf).replace(/\s+/g, ' ') === "window.appDocumentoSuelto === 'no'") puertaDeLaRuta += 1;
        ts.forEachChild(m, dentro);
      };
      n.statements.forEach(dentro);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return { expresiones, puertaDeLaRuta };
}

const regla = reglaDelPanel();
const normalizar = regla.expresiones.length === 1 ? new Function('me', 'return (' + regla.expresiones[0] + ');') : null;
/** Lo que el panel acaba teniendo en `window.appDocumentoSuelto` si el servidor manda `v`. */
const loQueLeeElPanel = (v) => normalizar({ documentoSuelto: v });
/** ¿Con ese valor la ruta `#invoices-new` pinta el editor? (su puerta lo niega sólo en 'no') */
const pintaElEditor = (v) => loQueLeeElPanel(v) !== 'no';

/** Los defectos del arnés de un guard, con las DOS reglas. */
function defectosDelArnes(a) {
  const mal = [];
  for (const v of a.valores) {
    if (loQueLeeElPanel(v) !== v) mal.push('sirve «' + v + '» y el panel lo lee como «' + loQueLeeElPanel(v) + '»: ese modo no existe en el contrato');
  }
  if (a.abreElSuelto && !a.valores.some(pintaElEditor)) {
    mal.push('abre `#invoices-new` y sólo sirve ' + JSON.stringify(a.valores) + ': con eso la ruta pinta el listado y el guard se queda CIEGO');
  }
  return mal;
}

test('SCRUM-1313 · B0 · suelo: la regla del panel se ha podido sacar de app.js, y es la que se cree', () => {
  assert.equal(regla.expresiones.length, 1, 'app.js asigna `window.appDocumentoSuelto` ' + regla.expresiones.length + ' veces; se esperaba UNA');
  assert.equal(regla.puertaDeLaRuta, 1, 'el `case \'invoices-new\'` ya no tiene UNA puerta `=== \'no\'`: la regla B2 de este fichero hay que volver a derivarla');
  // La regla ejecutada, en sus tres entradas conocidas. Si D1 se deshace, esto lo dice.
  assert.equal(loQueLeeElPanel('factura'), 'factura');
  assert.equal(loQueLeeElPanel('no'), 'no');
  assert.equal(loQueLeeElPanel('justificante'), 'no', 'SCRUM-825 D1: un «justificante» cae a «no»');
  assert.equal(pintaElEditor('factura'), true);
  assert.equal(pintaElEditor('no'), false);
});

test('SCRUM-1313 · B1 · 🔴 EL ROJO, fabricado: los cuatro arneses tal como estaban en main se cazan', () => {
  // (1) ajustes-del-justificante: el valor escrito a pelo.
  const directo = leerArnes("const me = () => ({ id: 1, documentoSuelto: 'justificante' });\nawait pag.goto(`http://x/dashboard/index.html#invoices-new`);");
  assert.deepEqual(directo.valores, ['justificante']);
  assert.equal(defectosDelArnes(directo).length, 2, 'ni existe en el contrato ni pinta el editor');
  // (2) pasos-del-editor y un-solo-presupuesto: por una variable, con ternario.
  const porVariable = leerArnes("let modoSuelto = 'no';\nconst me = () => ({ documentoSuelto: modoSuelto });\nmodoSuelto = suelto ? 'justificante' : 'no';\nawait pag.goto(`http://x/#invoices-new`);");
  assert.deepEqual(porVariable.valores, ['justificante', 'no']);
  assert.ok(defectosDelArnes(porVariable).some((d) => d.includes('«justificante»')));
  // (3) cabecera-del-editor: un valor que SÍ existe, pero que no pinta la página que abre.
  const soloNo = leerArnes("const me = () => ({ documentoSuelto: 'no' });\nawait pag.goto(`http://x/#invoices-new`);");
  assert.deepEqual(defectosDelArnes(soloNo), ['abre `#invoices-new` y sólo sirve ["no"]: con eso la ruta pinta el listado y el guard se queda CIEGO']);
  // Y los TRES positivos, para que el rojo no sea «todo cae»:
  assert.deepEqual(defectosDelArnes(leerArnes("const me = () => ({ documentoSuelto: 'no' });\nawait pag.goto(`http://x/#quotes-new`);")), []);
  assert.deepEqual(defectosDelArnes(leerArnes("let m = 'no';\nconst me = () => ({ documentoSuelto: m });\nm = h === 'invoices-new' ? 'factura' : 'no';\nawait pag.goto(`http://x/#invoices-new`);")), []);
  assert.deepEqual(defectosDelArnes(leerArnes("const me = () => ({ documentoSuelto: 'factura' });\nawait pag.goto(`http://x/#invoices-new`);")), []);
  // Lo que no sabe leer NO pasa por limpio: lo dice.
  assert.equal(leerArnes('function f(modo) { return { documentoSuelto: modo }; }').ilegible.length, 1);
});

/**
 * Los que sirven el modo de una forma que este lector no alcanza. Cada uno con su motivo, y B2
 * comprueba que SIGUEN siendo ilegibles: si un día se pueden leer, sobran aquí y el test lo pide.
 */
const NO_SE_LEEN_POR_AST = new Map([
  ['guard-caja-documento-suelto.mjs', 'no pasa por la ruta: monta `renderDocumentoSueltoView` a mano y recibe el modo por parámetro'],
  ['guard-marcadores-en-pantalla.mjs', 'el modo va dentro de una plantilla de texto que se inyecta en la página, no en un objeto del guard'],
]);

test('SCRUM-1313 · B2 · todo guard que sirve `documentoSuelto` sirve un modo que el panel entiende', () => {
  const dir = path.join(RAIZ, 'scripts');
  const guards = fs.readdirSync(dir).filter((f) => /^guard-.*\.mjs$/.test(f)).sort();
  // POBLACIÓN: por TEXTO (quien nombra el campo), para no depender de la forma que este lector sabe leer.
  const poblacion = guards.filter((f) => fs.readFileSync(path.join(dir, f), 'utf8').includes('documentoSuelto'));
  assert.ok(guards.length >= 30, 'suelo: sólo he visto ' + guards.length + ' guards en scripts/');
  assert.ok(poblacion.length >= 8, 'suelo: sólo ' + poblacion.length + ' guards nombran `documentoSuelto`; el 1-oct-2026 eran 8');

  const defectos = [];
  const leidos = [];
  const abren = [];
  for (const f of poblacion) {
    const a = leerArnes(fs.readFileSync(path.join(dir, f), 'utf8'));
    const declarado = NO_SE_LEEN_POR_AST.has(f);
    const legible = a.propiedades > 0 && a.ilegible.length === 0 && a.valores.length > 0;
    if (declarado) {
      assert.ok(!legible, f + ' YA se puede leer (' + JSON.stringify(a.valores) + '): sácalo de NO_SE_LEEN_POR_AST');
      continue;
    }
    assert.ok(legible, f + ' nombra `documentoSuelto` y no sé leer qué sirve (' + (a.ilegible.join('; ') || 'ninguna propiedad') + '). O se escribe de una forma legible, o se declara en NO_SE_LEEN_POR_AST con su motivo.');
    leidos.push(f);
    if (a.abreElSuelto) abren.push(f);
    for (const d of defectosDelArnes(a)) defectos.push(f + ' → ' + d);
  }
  for (const f of NO_SE_LEEN_POR_AST.keys()) assert.ok(poblacion.includes(f), f + ' está declarado y ya no nombra `documentoSuelto`: la declaración sobra');

  // Los cuatro del ticket están en lo MEDIDO, por nombre: si uno se cae de la población, se nota.
  const LOS_CUATRO = ['guard-915g-ajustes-del-justificante.mjs', 'guard-915i-cabecera.mjs', 'guard-965-un-solo-presupuesto.mjs', 'guard-pasos-del-editor.mjs'];
  for (const f of LOS_CUATRO) assert.ok(abren.includes(f), f + ' ya no se lee como un guard que abre `#invoices-new`');
  assert.equal(leidos.length + NO_SE_LEEN_POR_AST.size, poblacion.length, 'leídos + declarados no suman la población');

  assert.deepEqual(defectos, [], 'POBLACIÓN: ' + poblacion.length + ' guards, ' + leidos.length + ' leídos, ' + abren.length + ' abren el documento suelto.\n' + defectos.join('\n'));
});
