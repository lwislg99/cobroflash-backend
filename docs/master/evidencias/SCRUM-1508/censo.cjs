// SCRUM-1508 · censo por AST. Uso: node censo.cjs <raiz> <modo> [--modelo auditLog] [--fn recordAudit]
// modos: escritores | lectores | forma
const fs = require('fs');
const path = require('path');
const ts = require(process.env.TS_LIB);

const raiz = path.resolve(process.argv[2]);
const modo = process.argv[3];
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const MODELO = arg('--modelo', 'auditLog');
const FN = arg('--fn', 'recordAudit');
const TABLA = arg('--tabla', 'audit_log');

const EXT = new Set(['.ts', '.mjs', '.js', '.cjs']);
function* andar(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git' || e.name === '.claude') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) yield* andar(p);
    else if (EXT.has(path.extname(e.name))) yield p;
  }
}
const ficheros = fs.statSync(raiz).isDirectory() ? [...andar(raiz)] : [raiz];
const LECT = new Set(['findMany', 'findFirst', 'findUnique', 'findFirstOrThrow', 'findUniqueOrThrow', 'count', 'groupBy', 'aggregate']);
const ESCR = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany', 'createManyAndReturn']);
const out = [];
let nFicheros = 0, nNodos = 0;

const rel = (f) => path.relative(raiz, f).replace(/\\/g, '/');
const linea = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
function fnQueEnvuelve(n) {
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isFunctionDeclaration(p) && p.name) return p.name.text;
    if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && p.parent && ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name)) return p.parent.name.text;
    if (ts.isMethodDeclaration(p) && p.name) return p.name.getText();
  }
  return '(módulo/handler)';
}
// ¿el valor de esta expresión lo recoge alguien? await / return / asignación / argumento / void…
function destino(n) {
  let c = n, p = n.parent;
  while (p && (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isNonNullExpression(p))) { c = p; p = p.parent; }
  if (!p) return '?';
  if (ts.isAwaitExpression(p)) return 'await';
  if (ts.isReturnStatement(p)) return 'return';
  if (ts.isArrowFunction(p) && p.body === c) return 'return';
  if (ts.isExpressionStatement(p)) return 'SUELTA';
  if (ts.isVoidExpression(p)) return 'SUELTA(void)';
  if (ts.isVariableDeclaration(p) || ts.isBinaryExpression(p) || ts.isPropertyAssignment(p)) return 'asignada';
  if (ts.isCallExpression(p) && p.arguments.includes(c)) return 'argumento';
  if (ts.isArrayLiteralExpression(p)) return 'en-array';
  if (ts.isPropertyAccessExpression(p) && p.expression === c) return 'encadenada';
  return ts.SyntaxKind[p.kind];
}
function accionDe(call, sf) {
  const o = call.arguments[0];
  if (!o || !ts.isObjectLiteralExpression(o)) return o ? `(${o.getText(sf).slice(0, 40)})` : '(sin arg)';
  for (const pr of o.properties) if (ts.isPropertyAssignment(pr) && pr.name.getText(sf) === 'action') return pr.initializer.getText(sf).slice(0, 80);
  return '(sin action)';
}
function whereAccion(call, sf) {
  const t = call.arguments[0] ? call.arguments[0].getText(sf) : '';
  const m = t.match(/action\s*:\s*([^,}\n]+(?:\{[^}]*\})?)/);
  return m ? m[1].trim().slice(0, 90) : '(sin filtro de action)';
}
// cadena a.b.c… ¿empieza por algo y termina en .catch?
function raizDeCadena(n) {
  let e = n;
  for (;;) {
    if (ts.isCallExpression(e)) e = e.expression;
    else if (ts.isPropertyAccessExpression(e)) e = e.expression;
    else if (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e)) e = e.expression;
    else return e;
  }
}
function tieneThrow(n) { let t = false; (function v(x) { if (ts.isThrowStatement(x)) t = true; else if (!t) ts.forEachChild(x, v); })(n); return t; }

for (const f of ficheros) {
  const src = fs.readFileSync(f, 'utf8');
  const kind = f.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, kind);
  nFicheros += 1;
  (function v(n) {
    nNodos += 1;
    if (modo === 'escritores') {
      if (ts.isCallExpression(n)) {
        const c = n.expression;
        if (ts.isIdentifier(c) && (c.text === FN || c.text === FN + 'OrThrow')) {
          out.push([rel(f), linea(sf, n), c.text, accionDe(n, sf), destino(n), n.arguments.length > 1 ? 'cliente=' + n.arguments[1].getText(sf).slice(0, 30) : '', fnQueEnvuelve(n)]);
        }
        if (ts.isPropertyAccessExpression(c) && ESCR.has(c.name.text) && ts.isPropertyAccessExpression(c.expression) && c.expression.name.text === MODELO) {
          out.push([rel(f), linea(sf, n), `DIRECTO .${MODELO}.${c.name.text}`, '', destino(n), '', fnQueEnvuelve(n)]);
        }
      }
      // alias: la función pasada o guardada sin llamarla
      if (ts.isIdentifier(n) && (n.text === FN || n.text === FN + 'OrThrow') && !(ts.isCallExpression(n.parent) && n.parent.expression === n)
          && !ts.isImportSpecifier(n.parent) && !ts.isFunctionDeclaration(n.parent) && !ts.isExportSpecifier(n.parent)) {
        out.push([rel(f), linea(sf, n), 'ALIAS ' + n.text, ts.SyntaxKind[n.parent.kind], '', '', fnQueEnvuelve(n)]);
      }
    }
    if (modo === 'lectores') {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ts.isPropertyAccessExpression(n.expression.expression)
          && n.expression.expression.name.text === MODELO && LECT.has(n.expression.name.text)) {
        out.push([rel(f), linea(sf, n), `.${MODELO}.${n.expression.name.text}`, whereAccion(n, sf), destino(n), fnQueEnvuelve(n)]);
      }
      // acceso dinámico o por nombre: cadena con el nombre del modelo o de la tabla
      if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n))
          && (n.text === MODELO || new RegExp(`\\b${TABLA}\\b`, 'i').test(n.text) || new RegExp(`"${MODELO[0].toUpperCase() + MODELO.slice(1)}"`).test(n.text))) {
        out.push([rel(f), linea(sf, n), 'CADENA', JSON.stringify(n.text.slice(0, 70)), ts.SyntaxKind[n.parent.kind], fnQueEnvuelve(n)]);
      }
      // la propiedad nombrada sin método de lectura conocido (p. ej. prisma.auditLog pasado entero, o [modelo])
      if (ts.isPropertyAccessExpression(n) && n.name.text === MODELO && !(ts.isPropertyAccessExpression(n.parent) && (LECT.has(n.parent.name.text) || ESCR.has(n.parent.name.text)))) {
        out.push([rel(f), linea(sf, n), 'DELEGADO-SUELTO', n.parent.getText(sf).slice(0, 60), '', fnQueEnvuelve(n)]);
      }
    }
    if (modo === 'forma') {
      // promesa cuyo error se traga y cuyo valor nadie recoge:  X(...).catch(h)  SUELTA, con h sin throw
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'catch') {
        const d = destino(n);
        const h = n.arguments[0];
        const relanza = h ? tieneThrow(h) : false;
        if (d.startsWith('SUELTA') && !relanza) {
          const cuerpo = n.expression.expression.getText(sf).replace(/\s+/g, ' ');
          const r = raizDeCadena(n.expression.expression);
          out.push([rel(f), linea(sf, n), fnQueEnvuelve(n), (r.getText(sf) || '').slice(0, 20), cuerpo.slice(0, 110), h ? h.getText(sf).replace(/\s+/g, ' ').slice(0, 60) : '(sin handler)']);
        }
      }
    }
    ts.forEachChild(n, v);
  })(sf);
}
for (const r of out) console.log(r.join(' | '));
console.error(`# población: ${nFicheros} ficheros, ${nNodos} nodos · hallazgos: ${out.length} · modo=${modo} modelo=${MODELO} fn=${FN}`);
