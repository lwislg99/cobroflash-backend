// SÓLO LEE. Censo de controles de tests/ anclados a algo que se mueve.
// Uso: node censo-anclas.cjs <árbol> <ruta de typescript>
//
// Dos familias, por AST (los comentarios no cuentan):
//   A · ANCLAS A TEXTO DEL CÓDIGO: `X.indexOf('…')`, `X.includes('…')`, `/…/.test(X)`, `assert.match(X, /…/)`…
//       donde X es el texto de un fichero de src/ o public/ leído con readFileSync y la ruta se puede
//       resolver estáticamente. Se comprueba si el literal SIGUE en ese fichero HOY.
//       Como la tanda está en verde, un ancla AUSENTE sólo puede ser: (n) un control NEGATIVO a propósito
//       («esto no debe volver») o (v) un control que PASA EN VACÍO. Eso se separa por la forma de uso.
//   B · ANCLAS A NÚMERO DE LÍNEA: comparaciones de `.linea`/`.line` con un número literal, y `[N]` /
//       `.slice(N, M)` sobre el resultado de `split('\n')`. Se listan para revisarlas a mano.
const fs = require('node:fs');
const path = require('node:path');
const [raiz, tsPath] = process.argv.slice(2);
const ts = require(tsPath);
const DIR = path.join(raiz, 'tests');
const ficheros = fs.readdirSync(DIR).filter((f) => f.endsWith('.mjs'));

const cacheTexto = new Map();
const textoDe = (rel) => {
  if (!cacheTexto.has(rel)) { const abs = path.join(raiz, rel); cacheTexto.set(rel, fs.existsSync(abs) && fs.statSync(abs).isFile() ? fs.readFileSync(abs, 'utf8') : fs.existsSync(abs) ? 'ES-DIRECTORIO' : null); }
  return cacheTexto.get(rel);
};

function rutaEstatica(nodo, consts) {
  // 'src/x.ts' · path.join(A, '..', 'src', 'x.ts') · path.resolve(…) · new URL('../src/x.ts', import.meta.url) · IDENT const
  if (!nodo) return null;
  if (ts.isStringLiteral(nodo) || ts.isNoSubstitutionTemplateLiteral(nodo)) return limpia(nodo.text);
  if (ts.isIdentifier(nodo) && consts.has(nodo.text)) return consts.get(nodo.text);
  if (ts.isCallExpression(nodo) && ts.isPropertyAccessExpression(nodo.expression)
      && ['join', 'resolve'].includes(nodo.expression.name.text)) {
    // Sólo se puede ignorar el PRIMER argumento (la raíz: RAIZ, __dirname, import.meta.dirname…). Un hueco
    // más adelante (`path.join('src', modulo, 'x.ts')`) da una ruta que no es la de verdad: no se resuelve.
    const valores = nodo.arguments.map((a) => (ts.isStringLiteral(a) ? a.text : ts.isIdentifier(a) && consts.has(a.text) ? consts.get(a.text) : null));
    if (valores.slice(1).some((v) => v === null)) return null;
    const partes = valores.filter((p) => p !== null);
    if (!partes.length) return null;
    return limpia(path.posix.join(...partes.map((p) => p.replace(/\\/g, '/'))));
  }
  if (ts.isNewExpression(nodo) && nodo.expression.getText() === 'URL' && nodo.arguments?.[0] && ts.isStringLiteral(nodo.arguments[0])) return limpia(nodo.arguments[0].text);
  return null;
}
function limpia(p) {
  const s = p.replace(/\\/g, '/').replace(/^(\.\.\/|\.\/)+/, '');
  return /^(src|public)\//.test(s) ? s : null;
}
function rutaLeida(expr, consts) {
  // busca un readFileSync(…) dentro de la expresión (puede ir envuelto: sinComentarios(fs.readFileSync(…)).replace(…))
  let r = null;
  (function rec(n) {
    if (r) return;
    if (ts.isCallExpression(n) && ((ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'readFileSync') || (ts.isIdentifier(n.expression) && n.expression.text === 'readFileSync'))) {
      r = rutaEstatica(n.arguments[0], consts);
      return;
    }
    n.forEachChild(rec);
  })(expr);
  return r;
}

const filasA = [];
const filasB = [];
for (const f of ficheros) {
  const fuente = fs.readFileSync(path.join(DIR, f), 'utf8');
  const sf = ts.createSourceFile(f, fuente, ts.ScriptTarget.Latest, true);
  const consts = new Map();   // IDENT → ruta src/…
  const textos = new Map();   // IDENT → ruta del fichero cuyo TEXTO guarda
  const lineasDe = new Map(); // IDENT → ruta, cuando es split('\n') de un texto
  (function rec(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const ruta = rutaEstatica(n.initializer, consts);
      if (ruta) consts.set(n.name.text, ruta);
      const leida = rutaLeida(n.initializer, consts);
      if (leida) {
        const t = n.initializer.getText(sf);
        if (/\.split\(\s*['"`]\\n['"`]\s*\)/.test(t) || /\.split\(\s*\/\\r\?\\n\//.test(t)) lineasDe.set(n.name.text, leida);
        else textos.set(n.name.text, leida);
      } else if (ts.isCallExpression(n.initializer) && ts.isPropertyAccessExpression(n.initializer.expression)
          && n.initializer.expression.name.text === 'split' && ts.isIdentifier(n.initializer.expression.expression)
          && textos.has(n.initializer.expression.expression.text)) {
        lineasDe.set(n.name.text, textos.get(n.initializer.expression.expression.text));
      }
    }
    n.forEachChild(rec);
  })(sf);

  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  // La declaración que VE este uso: la del bloque más cercano hacia arriba (no la última del fichero
  // con ese nombre — `src` se reutiliza en tests distintos para ficheros distintos).
  const declaracionVisible = (ident) => {
    for (let p = ident.parent; p; p = p.parent) {
      const sentencias = ts.isBlock(p) || ts.isSourceFile(p) ? p.statements : null;
      if (!sentencias) continue;
      for (const s of sentencias) {
        if (!ts.isVariableStatement(s)) continue;
        for (const d of s.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === ident.text && d.initializer) return d;
      }
    }
    return null;
  };
  const textoVisible = (ident) => {
    const d = declaracionVisible(ident);
    if (!d) return null;
    const leida = rutaLeida(d.initializer, consts);
    if (leida) return leida;
    // const limpio = desnudar(crudo) / soloCodigo(fs.readFileSync(…)) / X.replace(…)
    let r = null;
    (function rec(n) { if (r) return; if (ts.isIdentifier(n) && n !== d.name && n.text !== ident.text) { const dd = declaracionVisible(n); if (dd) r = rutaLeida(dd.initializer, consts); } n.forEachChild(rec); })(d.initializer);
    return r;
  };
  const clasificaUso = (n) => {
    // sube por los padres hasta la sentencia y mira la forma
    let p = n.parent; let negado = false;
    for (let k = 0; k < 4 && p; k++, p = p.parent) {
      if (ts.isPrefixUnaryExpression(p) && p.operator === ts.SyntaxKind.ExclamationToken) negado = true;
      if (ts.isBinaryExpression(p) && /^(-1|0)$/.test(p.right.getText(sf)) && ['===', '==', '<', '!=='].includes(p.operatorToken.getText(sf))) negado = negado || p.operatorToken.getText(sf) !== '!==';
      if (ts.isCallExpression(p) && /doesNotMatch|notEqual|notOk/.test(p.expression.getText(sf))) negado = true;
      if (ts.isCallExpression(p) && /^assert\.equal$|^assert\.strictEqual$/.test(p.expression.getText(sf)) && p.arguments[1] && /^(-1|false)$/.test(p.arguments[1].getText(sf))) negado = true;
    }
    const enAssert = (() => { let q = n.parent; for (let k = 0; k < 4 && q; k++, q = q.parent) if (ts.isCallExpression(q) && /^assert(\.|$)/.test(q.expression.getText(sf))) return true; return false; })();
    const guardado = ts.isVariableDeclaration(n.parent) || (ts.isBinaryExpression(n.parent) && n.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken);
    return negado ? 'NEGATIVO' : enAssert ? 'ASSERT' : guardado ? 'GUARDADO-EN-VARIABLE' : 'OTRO';
  };

  (function rec(n) {
    // A · X.metodo(literal) / /re/.test(X) / assert.match(X, /re/)
    if (ts.isCallExpression(n)) {
      const e = n.expression;
      let objetivo = null, literal = null, esRegex = false, metodo = null;
      if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && textoVisible(e.expression)
          && ['indexOf', 'lastIndexOf', 'includes', 'search', 'match', 'startsWith'].includes(e.name.text) && n.arguments[0]) {
        objetivo = textoVisible(e.expression); metodo = e.name.text;
        const a = n.arguments[0];
        if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) literal = a.text;
        else if (ts.isRegularExpressionLiteral(a)) { literal = a.text; esRegex = true; }
      } else if (ts.isPropertyAccessExpression(e) && ['test', 'exec'].includes(e.name.text) && ts.isRegularExpressionLiteral(e.expression)
          && n.arguments[0] && ts.isIdentifier(n.arguments[0]) && textoVisible(n.arguments[0])) {
        objetivo = textoVisible(n.arguments[0]); metodo = e.name.text; literal = e.expression.text; esRegex = true;
      } else if (/^assert\.(match|doesNotMatch)$/.test(e.getText(sf)) && n.arguments[0] && ts.isIdentifier(n.arguments[0])
          && textoVisible(n.arguments[0]) && n.arguments[1] && ts.isRegularExpressionLiteral(n.arguments[1])) {
        objetivo = textoVisible(n.arguments[0]); metodo = e.getText(sf); literal = n.arguments[1].text; esRegex = true;
      }
      if (objetivo && literal !== null) {
        const texto = textoDe(objetivo);
        let presente = null;
        if (texto === null) presente = 'FICHERO-NO-EXISTE';
        else if (esRegex) { try { const m = /^\/(.*)\/([a-z]*)$/s.exec(literal); presente = new RegExp(m[1], m[2].replace('g', '')).test(texto) ? 'SÍ' : 'NO'; } catch { presente = 'REGEX-NO-COMPILA'; } }
        else presente = texto.includes(literal) ? 'SÍ' : 'NO';
        const uso = metodo === 'assert.doesNotMatch' ? 'NEGATIVO' : clasificaUso(n);
        filasA.push({ test: f, linea: linea(n), objetivo, metodo, literal: literal.slice(0, 70), presente, uso });
      }
    }
    // B · línea literal
    if (ts.isBinaryExpression(n) && ['===', '==', '>=', '<=', '<', '>'].includes(n.operatorToken.getText(sf))) {
      const lados = [n.left, n.right];
      const prop = lados.find((x) => (ts.isPropertyAccessExpression(x) && /^(linea|line|lineNumber|numeroDeLinea)$/.test(x.name.text)) || (ts.isIdentifier(x) && /^(linea|line|lineNumber)$/.test(x.text)));
      const num = lados.find((x) => ts.isNumericLiteral(x) && Number(x.text) > 2);
      if (prop && num) filasB.push({ test: f, linea: linea(n), forma: n.getText(sf).slice(0, 80) });
    }
    if (ts.isElementAccessExpression(n) && ts.isIdentifier(n.expression) && lineasDe.has(n.expression.text) && ts.isNumericLiteral(n.argumentExpression) && Number(n.argumentExpression.text) > 0) {
      filasB.push({ test: f, linea: linea(n), forma: n.getText(sf).slice(0, 80), objetivo: lineasDe.get(n.expression.text) });
    }
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'slice'
        && ts.isIdentifier(n.expression.expression) && lineasDe.has(n.expression.expression.text) && n.arguments.some((a) => ts.isNumericLiteral(a) && Number(a.text) > 0)) {
      filasB.push({ test: f, linea: linea(n), forma: n.getText(sf).slice(0, 80), objetivo: lineasDe.get(n.expression.expression.text) });
    }
    n.forEachChild(rec);
  })(sf);
}

const cuenta = (arr, k) => arr.reduce((a, x) => ({ ...a, [x[k]]: (a[x[k]] || 0) + 1 }), {});
console.log(`POBLACIÓN: ${ficheros.length} ficheros de tests/ · A: ${filasA.length} anclas a texto con fichero resuelto · B: ${filasB.length} anclas a línea`);
console.log('A por presencia:', JSON.stringify(cuenta(filasA, 'presente')));
const ausentes = filasA.filter((x) => x.presente !== 'SÍ');
console.log('A AUSENTES por uso:', JSON.stringify(cuenta(ausentes, 'uso')));
console.log('\n## A · ausentes (no NEGATIVO)');
for (const x of ausentes.filter((x) => x.uso !== 'NEGATIVO')) console.log(`${x.test}:${x.linea} | ${x.objetivo} | ${x.metodo} | ${JSON.stringify(x.literal)} | ${x.presente} | ${x.uso}`);
console.log('\n## A · ausentes NEGATIVO (probablemente a propósito)');
for (const x of ausentes.filter((x) => x.uso === 'NEGATIVO')) console.log(`${x.test}:${x.linea} | ${x.objetivo} | ${JSON.stringify(x.literal)}`);
console.log('\n## B · anclas a número de línea');
for (const x of filasB) console.log(`${x.test}:${x.linea} | ${x.objetivo ?? '—'} | ${x.forma}`);
fs.writeFileSync(path.join(require('node:os').tmpdir(), 'scrum1445-censo-anclas.json'), JSON.stringify({ filasA, filasB }, null, 1));
