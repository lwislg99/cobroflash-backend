// docs/master/evidencias/SCRUM-1560f/a-poblacion.mjs — SCRUM-1560f · ¿QUIÉN USA LOS DATOS DEL CENSO?
//
// CÓMO SE ELIGE LA POBLACIÓN (declarado, no deducido):
//   · el universo es TODO el código que sigue git (`git ls-files`, .mjs/.js/.cjs), no una carpeta;
//   · un fichero CONSUME si su AST (compilador de TypeScript) tiene un `import … from`, un
//     `export … from` o un `import()` cuyo especificador, resuelto desde el propio fichero, es
//     `scripts/_datos-del-censo.mjs`. Un comentario, una cadena o un `.md` que lo nombran NO cuentan;
//   · se separan los que importan `datosDelCenso` (sirven datos a una vista) de los que sólo leen
//     otra cosa (`CONTRATOS`, `IDS`…), y de cada uno, las vistas que monta (`enVista(…)`): literal,
//     constante con literal, o «la recorre» si el argumento es una variable de bucle.
//   · y, aparte, los ficheros que NOMBRAN el módulo sin importarlo: es la diferencia con un `grep`.
//
// CONTROL POSITIVO, antes de dar nada: el clasificador corre sobre cuatro fuentes escritas aquí
// (un import real, tres dinámicos —literal, `new URL` y ayudante—, uno dentro de un comentario y uno
// dentro de una cadena) y tiene que acertar las seis; y en el árbol tiene que encontrar `scripts/censo-objetivo-tactil-panel.mjs`,
// que se sabe que lo importa. Si falla cualquiera, sale CIEGO (código 2) sin imprimir la tabla.
//
//   node docs/master/evidencias/SCRUM-1560f/a-poblacion.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const OBJETIVO = 'scripts/_datos-del-censo.mjs';

function analizar(rel, fuente) {
  const sf = ts.createSourceFile(rel, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const resuelve = (esp) => path.posix.normalize(path.posix.join(path.posix.dirname(rel), esp));
  const nombres = new Set();
  let importa = false;
  const constantes = new Map();
  const vistas = [];
  const visita = (n) => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)
      && resuelve(n.moduleSpecifier.text) === OBJETIVO) {
      importa = true;
      const ligas = ts.isImportDeclaration(n) ? n.importClause?.namedBindings : n.exportClause;
      if (ligas && (ts.isNamedImports(ligas) || ts.isNamedExports(ligas))) for (const e of ligas.elements) nombres.add((e.propertyName || e.name).text);
      else nombres.add('*');
    }
    // Un `import()` o un ayudante (`imp('scripts/…')`) que recibe la ruta: literal relativa al fichero,
    // literal relativa a la raíz, o `new URL(literal, import.meta.url)`. Los nombres, del `const { … }`
    // que recoge el resultado; sin él, `import()`.
    if (ts.isCallExpression(n) && n.arguments[0]) {
      let a = n.arguments[0];
      if (ts.isNewExpression(a) && ts.isIdentifier(a.expression) && a.expression.text === 'URL' && a.arguments?.[0]) a = a.arguments[0];
      if (ts.isStringLiteral(a) && (resuelve(a.text) === OBJETIVO || path.posix.normalize(a.text) === OBJETIVO)) {
        importa = true;
        let p = n.parent;
        while (p && (ts.isAwaitExpression(p) || ts.isParenthesizedExpression(p))) p = p.parent;
        if (p && ts.isVariableDeclaration(p) && ts.isObjectBindingPattern(p.name)) for (const e of p.name.elements) nombres.add((e.propertyName || e.name).text);
        else nombres.add('import()');
      }
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isStringLiteral(n.initializer)) constantes.set(n.name.text, n.initializer.text);
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'enVista') {
      const a = n.arguments[0];
      if (a && ts.isStringLiteral(a)) vistas.push(a.text);
      else if (a && ts.isIdentifier(a)) vistas.push({ id: a.text });
      else vistas.push('¿?');
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  const vs = vistas.map((v) => (typeof v === 'string' ? v : constantes.has(v.id) ? constantes.get(v.id) : `«la recorre» (${v.id})`));
  return { importa, nombres: [...nombres], vistas: [...new Set(vs)] };
}

// ── control positivo del clasificador ───────────────────────────────────────────────────────────
const casos = [
  ['tests/x.test.mjs', "import { datosDelCenso } from '../scripts/_datos-del-censo.mjs';", true],
  ['docs/master/evidencias/A/b.mjs', "const m = await import('../../../../scripts/_datos-del-censo.mjs');", true],
  ['docs/master/evidencias/A/c.mjs', "const { datosDelCenso } = await import(new URL('../../../../scripts/_datos-del-censo.mjs', import.meta.url));", true],
  ['docs/master/evidencias/A/d.mjs', "const { datosDelCenso } = await imp('scripts/_datos-del-censo.mjs');", true],
  ['tests/y.test.mjs', "// import { datosDelCenso } from '../scripts/_datos-del-censo.mjs';", false],
  ['tests/z.test.mjs', "const s = \"import { datosDelCenso } from '../scripts/_datos-del-censo.mjs'\";", false],
];
const fallosControl = casos.filter(([rel, src, esperado]) => analizar(rel, src).importa !== esperado).map(([rel]) => rel);

const universo = execFileSync('git', ['ls-files', '-z'], { cwd: RAIZ, encoding: 'utf8' }).split('\0')
  .filter((f) => /\.(mjs|cjs|js)$/.test(f) && !f.startsWith('node_modules/'));
const filas = [];
const nombranSinImportar = [];
const BASENAME = path.posix.basename(OBJETIVO);
for (const rel of universo) {
  if (rel === OBJETIVO) continue;
  const fuente = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const a = analizar(rel, fuente);
  if (a.importa) filas.push({ rel, ...a });
  else if (fuente.includes(BASENAME)) nombranSinImportar.push(rel);
}

const conocido = filas.some((f) => f.rel === 'scripts/censo-objetivo-tactil-panel.mjs' && f.nombres.includes('datosDelCenso'));
if (fallosControl.length || !conocido || universo.length < 500) {
  console.log(`CIEGO · control del clasificador: ${casos.length - fallosControl.length}/${casos.length} bien, fallan [${fallosControl.join(', ')}]`
    + ` · ve al censo táctil: ${conocido ? 'sí' : 'NO'} · universo: ${universo.length} ficheros`);
  process.exit(2);
}

const sirven = filas.filter((f) => f.nombres.includes('datosDelCenso') || f.nombres.includes('*') || f.nombres.includes('import()'));
const otros = filas.filter((f) => !sirven.includes(f));
console.log(`POBLACIÓN · ${universo.length} ficheros de código seguidos por git, leídos por AST · control del clasificador 6/6 · ve al censo táctil: sí`);
console.log(`  importan ${OBJETIVO}: ${filas.length} · de ellos, con datosDelCenso: ${sirven.length} · sólo otras cosas: ${otros.length}`);
console.log(`  lo NOMBRAN sin importarlo (lo que un grep contaría de más): ${nombranSinImportar.length}`);
console.log('\nCON datosDelCenso (sirven datos a una vista):');
for (const f of sirven) console.log(`  ${f.rel}\n      importa: ${f.nombres.join(', ')}\n      monta: ${f.vistas.length ? f.vistas.join(', ') : '— (no llama a enVista)'}`);
console.log('\nSÓLO OTRAS COSAS:');
for (const f of otros) console.log(`  ${f.rel}  (${f.nombres.join(', ')})`);
console.log('\nLO NOMBRAN SIN IMPORTARLO:');
for (const f of nombranSinImportar) console.log(`  ${f}`);
