// docs/master/evidencias/scrum675/censo-de-ventanas-fijas.mjs — SCRUM-675
//
// ¿CUANTOS GUARDS LEEN POR VENTANA FIJA, Y CUANTOS DE ESOS PUEDEN QUEDARSE CIEGOS?
//
// 🔒 Una ventana fija no lee el codigo: lee los primeros N caracteres de donde estaba el codigo.
//
// 🔴 LA DISTINCION QUE DECIDE EL TAMANO, y sin ella el numero no vale:
//
//   · VENTANA QUE ACOTA UNA BUSQUEDA — el trozo se usa para decidir (`match`, `test`, `includes`,
//     `indexOf`, un `assert` sobre el). Si el simbolo cae fuera, **el guard deja de ver y pasa en
//     verde**. Estas son las peligrosas.
//   · VENTANA QUE SOLO TRUNCA — el trozo se usa para IMPRIMIR (`.slice(0, 100)` dentro de un
//     mensaje de error). Que corte no ciega nada: el fallo ya se decidio antes.
//
// Contarlas juntas daria un numero grande y falso, como paso en SCRUM-857 con la union ingenua.
//
// AST y no grep: `.slice(0, 120)` aparece tambien dentro de cadenas y comentarios.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const MINIMO = 100; // por debajo de esto es un truncado de mensaje, no una ventana de lectura
const DECIDEN = new Set(['match', 'test', 'includes', 'indexOf', 'search', 'matchAll', 'split', 'replace']);

function ficheros(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, acc);
    else if (/\.(mjs|js|ts)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

/** ¿Este nodo lleva dentro un numero literal >= MINIMO? Es lo que hace «fija» a la ventana. */
function numeroGrande(nodo) {
  let n = null;
  (function r(x) {
    if (n != null) return;
    if (ts.isNumericLiteral(x) && Number(x.text) >= MINIMO) { n = Number(x.text); return; }
    ts.forEachChild(x, r);
  })(nodo);
  return n;
}

const ventanas = [];
for (const f of [...ficheros(path.join(RAIZ, 'tests')), ...ficheros(path.join(RAIZ, 'scripts'))]) {
  const rel = path.relative(RAIZ, f).replace(/\\/g, '/');
  const codigo = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(rel, codigo, ts.ScriptTarget.Latest, true);

  // ── ① las variables que GUARDAN el resultado de una ventana ────────────────────────────
  const deVentana = new Map(); // nombre -> {linea, tam}
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

  // ── ② ¿alguna de esas variables se usa para DECIDIR? ───────────────────────────────────
  const usadaParaDecidir = new Set();
  const silenciosas = new Set();
  (function r(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const met = n.expression.name.getText();
      const sujeto = n.expression.expression.getText();
      if (DECIDEN.has(met) && deVentana.has(sujeto)) usadaParaDecidir.add(sujeto);
    }
    // `assert.match(ventana, ...)` / `assert.ok(ventana.includes(...))`
    if (ts.isCallExpression(n) && n.arguments.length) {
      for (const a of n.arguments) {
        if (ts.isIdentifier(a) && deVentana.has(a.getText())
          && ts.isPropertyAccessExpression(n.expression)
          && /^(match|doesNotMatch|ok|equal|notEqual|deepEqual)$/.test(n.expression.name.getText())) {
          usadaParaDecidir.add(a.getText());
          // 🔴 LA DISTINCION QUE DE VERDAD DECIDE, y no estaba en el ticket:
          //
          //   · `assert.match(ventana, /X/)`        -> si X sale de la ventana, el guard CAE.
          //     Es fragil, pero su ceguera es RUIDOSA: alguien se entera.
          //   · `assert.doesNotMatch(ventana, /X/)` -> si X sale de la ventana, el guard PASA.
          //     **Ceguera SILENCIOSA en verde.** Estas son las que muerden.
          if (/^(doesNotMatch|notEqual)$/.test(n.expression.name.getText())) {
            silenciosas.add(a.getText());
          }
        }
      }
    }
    ts.forEachChild(n, r);
  })(sf);

  for (const [nombre, info] of deVentana) {
    ventanas.push({
      fichero: rel, linea: info.linea, tam: info.tam, nombre,
      decide: usadaParaDecidir.has(nombre),
      silenciosa: silenciosas.has(nombre),
    });
  }
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────
if (ventanas.length === 0) {
  console.log('🔴 CENSO CIEGO: cero ventanas fijas. El ticket nombra una con su margen medido,');
  console.log('   asi que un cero aqui es el instrumento roto, no el arbol limpio.');
  process.exit(3);
}

const peligrosas = ventanas.filter((v) => v.decide);
const inocuas = ventanas.filter((v) => !v.decide);

console.log(`VENTANAS FIJAS (>= ${MINIMO} caracteres) EN tests/ Y scripts/: ${ventanas.length}`);
console.log(`  · que solo TRUNCAN para imprimir (inocuas) .......: ${inocuas.length}`);
console.log(`  · 🔴 que ACOTAN UNA BUSQUEDA (pueden cegar) ......: ${peligrosas.length}`);
console.log('');
const silenciosas2 = peligrosas.filter((v) => v.silenciosa);
console.log(`  · 🔴🔴 de esas, con CEGUERA SILENCIOSA (assert negativo: si el simbolo sale de la`);
console.log(`        ventana, el guard PASA en verde en vez de caer) ..: ${silenciosas2.length}`);
console.log('');
console.log('LAS QUE PUEDEN CEGAR (🔴🔴 = ceguera silenciosa, en verde):');
for (const v of peligrosas.sort((a, b) => a.fichero.localeCompare(b.fichero))) {
  console.log(`   ${v.silenciosa ? '🔴🔴' : '  🔴'} ${v.fichero}:${v.linea}  ${v.nombre} = ventana de ${v.tam}`);
}

// ── CONTROL POSITIVO: una ventana sintetica con la forma peligrosa tiene que verse ───────
const SINT = `
  const bloque = fuente.slice(i, i + 1400);
  assert.match(bloque, /taxName/, 'x');
  const soloImprime = texto.slice(0, 80);
  console.log(soloImprime);
  const truncadoGrande = otro.slice(0, 300);
  console.log('mensaje: ' + truncadoGrande);
`;
const sfS = ts.createSourceFile('s.mjs', SINT, ts.ScriptTarget.Latest, true);
const dv = new Map();
(function r(n) {
  if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.initializer
    && ts.isCallExpression(n.initializer) && ts.isPropertyAccessExpression(n.initializer.expression)
    && /^(slice|substring|substr)$/.test(n.initializer.expression.name.getText())) {
    const tam = numeroGrande(n.initializer);
    if (tam != null) dv.set(n.name.getText(), tam);
  }
  ts.forEachChild(n, r);
})(sfS);
let decideS = false;
(function r(n) {
  if (ts.isCallExpression(n) && n.arguments.length) {
    for (const a of n.arguments) {
      if (ts.isIdentifier(a) && a.getText() === 'bloque') decideS = true;
    }
  }
  ts.forEachChild(n, r);
})(sfS);
console.log('');
console.log('CONTROL POSITIVO (fuente sintetica: 1 peligrosa de 1400 + 1 truncado de 120):');
console.log(`   ve la ventana de 1400: ${dv.get('bloque') === 1400 ? 'SI ✅' : '🔴 NO'}`);
console.log(`   la marca como que DECIDE: ${decideS ? 'SI ✅' : '🔴 NO'}`);
console.log(`   NO cuenta el truncado de 80 (bajo el umbral): ${dv.has('soloImprime') ? '🔴 lo cuenta' : 'correcto ✅'}`);
// 🔴 Y el control que faltaba: un truncado GRANDE (300) si entra como ventana, pero como solo se
// IMPRIME no debe marcarse como que decide. La primera version comprobaba lo que no era: que no
// se contara como ventana, en vez de que no se contara como PELIGROSA.
let decideTrunc = false;
(function r(n) {
  if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
    && DECIDEN.has(n.expression.name.getText())
    && n.expression.expression.getText() === 'truncadoGrande') decideTrunc = true;
  ts.forEachChild(n, r);
})(sfS);
console.log(`   el truncado de 300 entra como ventana: ${dv.has('truncadoGrande') ? 'SI (correcto: mide >= 100)' : 'no'}`);
console.log(`   …pero NO como peligrosa: ${decideTrunc ? '🔴 la marca' : 'correcto ✅'}`);
