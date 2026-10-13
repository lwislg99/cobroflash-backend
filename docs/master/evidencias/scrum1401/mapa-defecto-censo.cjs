// SCRUM-1401 parte 5 - censo por AST de `MAPA[clave] ?? defecto` (y `||`) en src/.
// Uso: node mapa-defecto-censo.cjs <raiz con src/> <ruta a node_modules/typescript> [--todos]
// Solo LEE. Declara su poblacion. Con --todos lista tambien los accesos por clave SIN defecto.
const path = require('path');
const fs = require('fs');
const [raiz, rutaTs] = process.argv.slice(2);
const TODOS = process.argv.includes('--todos');
if (!raiz || !rutaTs) { console.error('uso: node censo.cjs <raiz> <typescript>'); process.exit(2); }
const ts = require(path.resolve(rutaTs));

function ficheros(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}
const lista = ficheros(path.join(raiz, 'src'));
const program = ts.createProgram(lista, {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.NodeJs, strict: true, esModuleInterop: true,
  resolveJsonModule: true, skipLibCheck: true, noEmit: true,
});
const checker = program.getTypeChecker();

function pelar(n) {
  while (n && (ts.isParenthesizedExpression(n) || ts.isNonNullExpression(n) || ts.isAsExpression(n) || ts.isTypeAssertionExpression?.(n))) n = n.expression;
  return n;
}
const esDefecto = (k) => k === ts.SyntaxKind.QuestionQuestionToken || k === ts.SyntaxKind.BarBarToken;
function operandos(bin, op, out = []) {
  const izq = pelar(bin.left);
  if (ts.isBinaryExpression(izq) && izq.operatorToken.kind === op) operandos(izq, op, out); else out.push(izq);
  out.push(pelar(bin.right));
  return out;
}
function tipo(n) { try { return checker.typeToString(checker.getTypeAtLocation(n)); } catch { return '?'; } }
function claseDe(acc) {
  const tRec = checker.getTypeAtLocation(acc.expression);
  const arg = acc.argumentExpression;
  const tArg = checker.getTypeAtLocation(arg);
  const numerico = (tArg.flags & ts.TypeFlags.NumberLike) !== 0 || ts.isNumericLiteral(arg);
  const lista2 = checker.isArrayType(tRec) || checker.isTupleType(tRec) || /\[\]$|Array</.test(checker.typeToString(tRec));
  if (lista2 || numerico) return 'indice';
  if (ts.isStringLiteralLike(arg)) return 'clave-literal';
  return 'mapa';
}

let nBin = 0, nAcc = 0, sinParsear = 0;
const filas = [], detras = [], sueltos = [];
const vistosConDefecto = new Set();
for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile) continue;
  const rel = path.relative(raiz, sf.fileName).replace(/\\/g, '/');
  if (!rel.startsWith('src/')) continue;
  if (sf.parseDiagnostics && sf.parseDiagnostics.length) sinParsear++;
  const lin = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const apunta = (acc, op, donde) => {
    const c = claseDe(acc);
    vistosConDefecto.add(acc);
    donde.push({ rel, linea: lin(acc), op, clase: c, receptor: acc.expression.getText(sf), tipoRec: tipo(acc.expression).slice(0, 90),
      clave: acc.argumentExpression.getText(sf), tipoClave: tipo(acc.argumentExpression).slice(0, 60),
      texto: sf.text.split(/\r?\n/)[lin(acc) - 1].trim().slice(0, 200) });
  };
  const visita = (n) => {
    if (ts.isElementAccessExpression(n)) nAcc++;
    if (ts.isBinaryExpression(n) && esDefecto(n.operatorToken.kind)) {
      nBin++;
      const padre = pelar(n.parent);
      const esRaiz = !(ts.isBinaryExpression(n.parent) && n.parent.operatorToken.kind === n.operatorToken.kind && pelar(n.parent.left) === n);
      if (esRaiz) {
        const ops = operandos(n, n.operatorToken.kind);
        const op = n.operatorToken.kind === ts.SyntaxKind.BarBarToken ? '||' : '??';
        ops.slice(0, -1).forEach((o) => {
          if (ts.isElementAccessExpression(o)) apunta(o, op, filas);
          else {
            // MAPA[clave]?.prop ?? defecto  /  MAPA[clave].prop ?? defecto
            let x = o;
            while (x && (ts.isPropertyAccessExpression(x) || ts.isCallExpression(x) || ts.isNonNullExpression(x))) x = x.expression;
            if (x && x !== o && ts.isElementAccessExpression(x)) apunta(x, op, detras);
          }
        });
      }
      void padre;
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  if (TODOS) {
    const v2 = (n) => {
      if (ts.isElementAccessExpression(n) && !vistosConDefecto.has(n)) {
        const esDestino = ts.isBinaryExpression(n.parent) && n.parent.left === n && n.parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
        if (!esDestino && claseDe(n) === 'mapa') sueltos.push({ rel, linea: lin(n), receptor: n.expression.getText(sf), tipoRec: tipo(n.expression).slice(0, 70), clave: n.argumentExpression.getText(sf), tipoClave: tipo(n.argumentExpression).slice(0, 50) });
      }
      ts.forEachChild(n, v2);
    };
    v2(sf);
  }
}
const cuenta = (xs) => xs.reduce((a, f) => ((a[f.clase] = (a[f.clase] || 0) + 1), a), {});
console.log(`POBLACION: ${lista.length} ficheros .ts en src/ · ${sinParsear} con error de parseo · ${nBin} expresiones ?? o || · ${nAcc} accesos por corchete`);
console.log(`CON DEFECTO DIRECTO (X[k] ?? d / X[k] || d): ${filas.length} · por clase ${JSON.stringify(cuenta(filas))}`);
console.log(`CON PROPIEDAD DETRAS (X[k]?.p ?? d): ${detras.length} · por clase ${JSON.stringify(cuenta(detras))}`);
const pinta = (f) => console.log(`${f.clase}\t${f.op}\t${f.rel}:${f.linea}\t${f.receptor} : ${f.tipoRec}\t[${f.clave} : ${f.tipoClave}]\t${f.texto}`);
console.log('--- DIRECTO, clase mapa');
filas.filter((f) => f.clase === 'mapa').forEach(pinta);
console.log('--- DIRECTO, clase clave-literal');
filas.filter((f) => f.clase === 'clave-literal').forEach(pinta);
console.log('--- DETRAS, clase mapa');
detras.filter((f) => f.clase === 'mapa').forEach(pinta);
console.log('--- DIRECTO, clase indice (solo recuento por fichero)');
const porFich = {};
filas.filter((f) => f.clase === 'indice').forEach((f) => (porFich[f.rel] = (porFich[f.rel] || 0) + 1));
console.log(Object.keys(porFich).length + ' ficheros');
if (TODOS) {
  console.log(`--- SIN DEFECTO, clase mapa (lecturas): ${sueltos.length}`);
  sueltos.forEach((f) => console.log(`${f.rel}:${f.linea}\t${f.receptor} : ${f.tipoRec}\t[${f.clave} : ${f.tipoClave}]`));
}
const ctl = (nombre) => filas.concat(detras).filter((f) => f.receptor === nombre).length;
console.log(`CONTROL POSITIVO: SINONIMOS_UNIDAD -> ${ctl('SINONIMOS_UNIDAD')} (se espera >=1) · CONTROL CERO: BY_PLAN -> ${ctl('BY_PLAN')} · MAPA_QUE_NO_EXISTE -> ${ctl('MAPA_QUE_NO_EXISTE')}`);
console.log('EXIT=0');
