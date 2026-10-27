// docs/master/evidencias/SCRUM-1517b/censo-de-usos.mjs — SCRUM-1517b
//
// ¿QUIÉN USA, EN `src/`, LOS NOMBRES QUE SE LE PASAN? Por AST, no por texto: un comentario que
// nombra la función no cuenta, y un import tampoco (se cuenta aparte).
//
//   node docs/master/evidencias/SCRUM-1517b/censo-de-usos.mjs nombreA nombreB "literal:un_texto"
//
// Por cada uso dice: fichero:línea · la función que lo envuelve · y, si está dentro de un
// `router.get('/ruta', …)` (o post/put/patch/delete/use), el verbo y la ruta.
// `literal:xxx` busca literales de cadena IGUALES a xxx (no subcadenas).
//
// Sólo LEE `src/`. No importa ni ejecuta nada del árbol.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const ts = createRequire(path.join(RAIZ, 'x.js'))('typescript');

const pedidos = process.argv.slice(2);
if (!pedidos.length) { console.log('CIEGO: no se ha pedido ningún nombre'); console.log('EXIT=2'); process.exit(2); }
const nombres = new Set(pedidos.filter((p) => !p.startsWith('literal:')));
const literales = new Set(pedidos.filter((p) => p.startsWith('literal:')).map((p) => p.slice('literal:'.length)));

const ficheros = [];
(function andar(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) andar(f);
    else if (/\.ts$/.test(e.name) && !/\.d\.ts$/.test(e.name)) ficheros.push(f);
  }
})(path.join(RAIZ, 'src'));

const VERBOS = new Set(['get', 'post', 'put', 'patch', 'delete', 'use', 'all']);
const usos = [];
const imports = new Map();
const declaraciones = new Map();

for (const f of ficheros) {
  const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
  const rel = path.relative(RAIZ, f).split(path.sep).join('/');
  const anotar = (nodo, clave) => {
    let funcion = null; let ruta = null; let enCatch = false;
    for (let p = nodo.parent; p; p = p.parent) {
      if (ts.isCatchClause(p)) enCatch = true;
      if (!funcion && (ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name) funcion = p.name.getText(sf);
      if (!funcion && (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && ts.isVariableDeclaration(p.parent)) funcion = p.parent.name.getText(sf);
      if (!ruta && ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression)
        && VERBOS.has(p.expression.name.text) && p.arguments.length && ts.isStringLiteralLike(p.arguments[0])) {
        ruta = `${p.expression.name.text.toUpperCase()} ${p.arguments[0].text}`;
      }
    }
    const linea = sf.getLineAndCharacterOfPosition(nodo.getStart(sf)).line + 1;
    usos.push({ clave, rel, linea, funcion, ruta, enCatch });
  };
  (function ver(n) {
    if (ts.isIdentifier(n) && nombres.has(n.text)) {
      const p = n.parent;
      const esImport = ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isExportSpecifier(p);
      const esDeclaracion = (ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p) || ts.isVariableDeclaration(p)) && p.name === n;
      if (esImport) imports.set(n.text, [...(imports.get(n.text) ?? []), rel]);
      else if (esDeclaracion) declaraciones.set(n.text, [...(declaraciones.get(n.text) ?? []), `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`]);
      else anotar(n, n.text);
    }
    if (ts.isStringLiteralLike(n) && literales.has(n.text)) anotar(n, `literal:${n.text}`);
    ts.forEachChild(n, ver);
  })(sf);
}

console.log(`POBLACION: ${ficheros.length} ficheros .ts de src/ leídos por AST · ${pedidos.length} claves pedidas`);
for (const p of pedidos) {
  const mios = usos.filter((u) => u.clave === p);
  const n = p.startsWith('literal:') ? null : p;
  console.log('');
  console.log(`── ${p} · ${mios.length} usos`
    + (n ? ` · declarado en ${(declaraciones.get(n) ?? ['(ningún sitio de src/)']).join(', ')} · importado por ${new Set(imports.get(n) ?? []).size} ficheros` : ''));
  for (const u of mios) {
    console.log(`   ${u.rel}:${u.linea} · en ${u.funcion ?? '(nivel de módulo)'}${u.ruta ? ` · ${u.ruta}` : ''}${u.enCatch ? ' · DENTRO DE UN catch' : ''}`);
  }
}
console.log('');
console.log(`TOTAL: ${usos.length} usos`);
console.log('EXIT=0');
