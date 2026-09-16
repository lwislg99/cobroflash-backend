// docs/master/evidencias/scrum675/censo-v2-fuente-cruda.mjs — SCRUM-675 (fase b)
//
// 🔴 CORRIGE EL CENSO DE LA FASE a, Y EL NUMERO BAJA.
//
// Aquel censo conto 21 ventanas «que pueden cegar» sin preguntar UNA cosa que lo decide todo:
//
//   ¿el texto sobre el que se abre la ventana viene YA LIMPIO DE COMENTARIOS?
//
// `leerFuente(ruta, { ancla })` y `soloEjecutable()` (SCRUM-719) QUITAN los comentarios antes de
// devolver el texto. Sobre un texto asi, **escribir un comentario no empuja nada**: el comentario
// no llega a estar en lo que la ventana mide. La fragilidad que este ticket persigue NO EXISTE.
//
// Medido en la fase b: de las 2 «ciegas silenciosas» de la fase a, **una lee sin comentarios**
// (`scrum819`, cuyo bloque real son 401 caracteres contra una ventana de 700 — la ventana es MAS
// GRANDE que el bloque) y **solo la otra lee el fichero crudo** (`scrum338`).
//
// Contarlas juntas era el mismo error que la union ingenua de SCRUM-857: un numero grande y falso.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const MINIMO = 100;
const DECIDEN = new Set(['match', 'test', 'includes', 'indexOf', 'search', 'matchAll', 'split', 'replace']);
/** Los lectores que DEVUELVEN el texto ya sin comentarios. Derivado de los helpers de la casa. */
const LIMPIAN = /soloEjecutable|leerFuente|ejecutableDe/;

function ficheros(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, acc);
    else if (/\.(mjs|js|ts)$/.test(e.name)) acc.push(p);
  }
  return acc;
}
function numeroGrande(nodo) {
  let n = null;
  (function r(x) {
    if (n != null) return;
    if (ts.isNumericLiteral(x) && Number(x.text) >= MINIMO) { n = Number(x.text); return; }
    ts.forEachChild(x, r);
  })(nodo);
  return n;
}

const filas = [];
for (const f of [...ficheros(path.join(RAIZ, 'tests')), ...ficheros(path.join(RAIZ, 'scripts'))]) {
  const rel = path.relative(RAIZ, f).replace(/\\/g, '/');
  const codigo = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(rel, codigo, ts.ScriptTarget.Latest, true);
  // ⚠️ La pregunta se hace por FICHERO y no por variable: si el fichero usa un lector que limpia,
  // sus ventanas se abren sobre texto limpio. Es una aproximacion y se DICE — un fichero podria
  // mezclar los dos lectores. Abajo se declara como limite.
  const limpia = LIMPIAN.test(codigo);

  const deVentana = new Map();
  (function r(n) {
    if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.initializer
      && ts.isCallExpression(n.initializer) && ts.isPropertyAccessExpression(n.initializer.expression)
      && /^(slice|substring|substr)$/.test(n.initializer.expression.name.getText())) {
      const tam = numeroGrande(n.initializer);
      if (tam != null) {
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
        deVentana.set(n.name.getText(), { linea: line + 1, tam });
      }
    }
    ts.forEachChild(n, r);
  })(sf);

  const decide = new Set();
  const silenciosa = new Set();
  (function r(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const met = n.expression.name.getText();
      if (DECIDEN.has(met) && deVentana.has(n.expression.expression.getText())) decide.add(n.expression.expression.getText());
    }
    if (ts.isCallExpression(n) && n.arguments.length && ts.isPropertyAccessExpression(n.expression)) {
      const met = n.expression.name.getText();
      for (const a of n.arguments) {
        if (ts.isIdentifier(a) && deVentana.has(a.getText())
          && /^(match|doesNotMatch|ok|equal|notEqual|deepEqual)$/.test(met)) {
          decide.add(a.getText());
          if (/^(doesNotMatch|notEqual)$/.test(met)) silenciosa.add(a.getText());
        }
      }
    }
    ts.forEachChild(n, r);
  })(sf);

  for (const [nombre, info] of deVentana) {
    if (!decide.has(nombre)) continue;
    filas.push({ fichero: rel, linea: info.linea, tam: info.tam, nombre, limpia, silenciosa: silenciosa.has(nombre) });
  }
}

if (!filas.length) {
  console.log('🔴 CENSO CIEGO: cero ventanas que decidan. La fase a midio 21 con su lista.');
  process.exit(3);
}

const crudas = filas.filter((f) => !f.limpia);
const limpias = filas.filter((f) => f.limpia);
console.log(`VENTANAS QUE DECIDEN (las 21 de la fase a, re-examinadas): ${filas.length}`);
console.log(`  · sobre texto YA LIMPIO de comentarios -> un comentario NO las ciega: ${limpias.length}`);
console.log(`  · 🔴 sobre el fichero CRUDO -> un comentario SI las ciega ...........: ${crudas.length}`);
console.log('');
console.log('LAS FRAGILES DE VERDAD (fuente cruda):');
for (const f of crudas.sort((a, b) => a.fichero.localeCompare(b.fichero))) {
  console.log(`   ${f.silenciosa ? '🔴🔴' : '  🔴'} ${f.fichero}:${f.linea}  ${f.nombre} = ventana ${f.tam}`
    + (f.silenciosa ? '  (ceguera SILENCIOSA)' : ''));
}
console.log('');
console.log('CONTROL POSITIVO — los dos casos ya medidos a mano en la fase b:');
const c338 = filas.find((f) => f.fichero.includes('scrum338'));
const c819 = filas.find((f) => f.fichero.includes('scrum819'));
console.log(`   scrum338 (medido: lee CRUDO)        -> el censo dice ${c338 ? (c338.limpia ? '🔴 limpia' : 'cruda ✅') : '🔴 no lo ve'}`);
console.log(`   scrum819 (medido: lee SIN comentarios) -> el censo dice ${c819 ? (c819.limpia ? 'limpia ✅' : '🔴 cruda') : '🔴 no lo ve'}`);
console.log('');
console.log('LIMITE DECLARADO: la pregunta «¿limpia?» se hace por FICHERO, no por variable. Un');
console.log('fichero que mezclara los dos lectores saldria como limpio entero. No se ha medido si');
console.log('alguno lo hace: se dice en vez de darlo por imposible.');
