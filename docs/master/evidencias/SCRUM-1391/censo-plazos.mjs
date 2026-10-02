// SCRUM-1391 · censo por AST de TODO `timeout:` escrito en un objeto literal dentro de `tests/`.
// Cada aparicion se clasifica por LA LLAMADA que recibe ese objeto, no por el texto de la linea.
//   uso: node censo-plazos.mjs <raiz del repo, para typescript> <carpeta tests a censar> [--lista]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(process.argv[2]);
const DIR = path.resolve(process.argv[3]);
const LISTA = process.argv.includes('--lista');
const ts = createRequire(path.join(RAIZ, 'package.json'))('typescript');

const DE_TEST = new Set(['test', 'it', 'describe', 'suite', 'before', 'after', 'beforeEach', 'afterEach']);
const nombreDe = (callee) => {
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return nombreDe(callee.expression) + '.' + callee.name.text;
  return '(otra)';
};
// ¿Es una llamada del corredor de tests? `test(...)`, `it(...)`, `t.test(...)`, `test.skip(...)`, `describe.only(...)`.
const esDeTest = (nombre) => {
  const partes = nombre.split('.');
  return DE_TEST.has(partes[0]) || (partes.length === 2 && DE_TEST.has(partes[1]));
};

const ficheros = fs.readdirSync(DIR).filter((f) => f.endsWith('.mjs')).sort();
const filas = [];
let ilegibles = 0;
for (const f of ficheros) {
  const codigo = fs.readFileSync(path.join(DIR, f), 'utf8');
  if (!codigo.includes('timeout')) continue;
  let sf;
  try { sf = ts.createSourceFile(f, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS); } catch { ilegibles += 1; continue; }
  const visita = (n) => {
    if (ts.isPropertyAssignment(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) && n.name.text === 'timeout'
      && ts.isObjectLiteralExpression(n.parent)) {
      const obj = n.parent;
      const llamada = obj.parent && (ts.isCallExpression(obj.parent) || ts.isNewExpression(obj.parent)) ? obj.parent : null;
      const quien = llamada ? nombreDe(llamada.expression) : '(objeto suelto, no es argumento directo)';
      const linea = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
      filas.push({ f, linea, quien, valor: n.initializer.getText(sf).slice(0, 40), test: Boolean(llamada) && esDeTest(quien) });
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
}

const deTest = filas.filter((x) => x.test);
const resto = filas.filter((x) => !x.test);
const fich = (xs) => new Set(xs.map((x) => x.f)).size;
console.log('CENSO de `timeout:` en ' + DIR);
console.log('POBLACION: ' + ficheros.length + ' ficheros .mjs · ' + ficheros.filter((f) => f.endsWith('.test.mjs')).length + ' son .test.mjs · ilegibles ' + ilegibles);
console.log('apariciones de `timeout:` en un objeto literal: ' + filas.length + ' en ' + fich(filas) + ' ficheros');
console.log('  ① PLAZO DE TEST (el objeto es argumento de test/it/describe/hook): ' + deTest.length + ' plazos en ' + fich(deTest) + ' ficheros');
for (const x of deTest) console.log('     ' + x.f + ':' + x.linea + ' · ' + x.quien + ' · ' + x.valor);
console.log('  ② OTROS (el objeto va a otra llamada): ' + resto.length + ' en ' + fich(resto) + ' ficheros');
const porQuien = new Map();
for (const x of resto) porQuien.set(x.quien, [...(porQuien.get(x.quien) || []), x]);
for (const [q, xs] of [...porQuien].sort((a, b) => b[1].length - a[1].length)) {
  console.log('     ' + q + ' · ' + xs.length + ' en ' + fich(xs) + ' ficheros');
  if (LISTA) for (const x of xs) console.log('        ' + x.f + ':' + x.linea + ' · ' + x.valor);
}
// CONTROL POSITIVO: el censo tiene que ver el plazo de 120 s del caso ④ de scrum976, que se que esta.
const control = deTest.find((x) => x.f === 'scrum976-guards-entrada-con-techo.test.mjs');
console.log('CONTROL POSITIVO · scrum976 (se que lleva un plazo de test): ' + (control ? 'VISTO en la linea ' + control.linea + ' (' + control.valor + ')' : 'NO VISTO → el censo esta CIEGO'));
process.exit(control ? 0 : 2);
