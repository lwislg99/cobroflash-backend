// tests/_poblacion-de-tests.mjs — SCRUM-708
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// QUIÉN REGISTRA TESTS, Y CUÁNTOS — por AST, y en UN solo sitio
//
// Dos guards distintos necesitan la misma pregunta y no se responde dos veces:
//
//   · `scrum708-el-fichero-que-no-corre` pregunta QUIÉN registra tests, para cruzarlo con el
//     patrón que la tanda ejecuta de verdad (el fichero renombrado).
//   · el registro de poblaciones de `scrum810b` pregunta CUÁNTOS hay, para compararlo con la
//     base de fusión (el test que desaparece).
//
// 🔴 POR AST Y NO POR TEXTO, y no es preferencia. Un `grep` cuenta `// test('x')` comentado y
// cuenta el `test(` que vive dentro de una cadena de ejemplo — este árbol está lleno de guards
// que llevan fuentes sintéticos como dato. Es la trampa de autorreferencia de SCRUM-693/694, y
// aquí saldría como una población inflada que además CRECE al documentar.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const LLAMADAS = ['test', 'it', 'describe'];

function arbolDe(codigo, nombre) {
  return ts.createSourceFile(nombre, String(codigo || ''), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

/**
 * ¿Este fichero REGISTRA tests? Importa `node:test` **y** llama a `test`/`it`/`describe`.
 *
 * Las dos condiciones hacen falta: sólo la llamada metería en la población a medio `public/` por
 * usar `re.test(s)` —que además es un acceso a propiedad y aquí no cuenta—, y sólo el import
 * metería a los ayudantes que reexportan el módulo sin registrar nada.
 */
export function registraTests(codigo, nombre = 'x.mjs') {
  const sf = arbolDe(codigo, nombre);
  let importa = false;
  let llama = false;
  (function recorrer(n) {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)
        && n.moduleSpecifier.text === 'node:test') importa = true;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)
        && LLAMADAS.includes(n.expression.text)) llama = true;
    ts.forEachChild(n, recorrer);
  })(sf);
  return importa && llama;
}

/** Cuántos tests DECLARA un fuente. `describe` no cuenta: agrupa, no es un caso. */
export function testsDeclarados(codigo, nombre = 'x.mjs') {
  const sf = arbolDe(codigo, nombre);
  let n = 0;
  (function recorrer(x) {
    if (ts.isCallExpression(x) && ts.isIdentifier(x.expression)
        && ['test', 'it'].includes(x.expression.text)) n++;
    ts.forEachChild(x, recorrer);
  })(sf);
  return n;
}

/**
 * La población de UN árbol: cuántos tests declaran los ficheros de `tests/*.test.mjs`.
 *
 * 🔴 Tiene que servir sobre un árbol AJENO (el de la base de fusión, materializado en un
 * temporal), así que la raíz es un parámetro y no hay ni una ruta absoluta escrita aquí.
 */
export function testsDeclaradosEn(raiz) {
  const dir = path.join(raiz, 'tests');
  let total = 0;
  for (const nombre of fs.readdirSync(dir)) {
    if (!nombre.endsWith('.test.mjs')) continue;
    total += testsDeclarados(fs.readFileSync(path.join(dir, nombre), 'utf8'), nombre);
  }
  return total;
}
