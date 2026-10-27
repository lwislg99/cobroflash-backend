// SCRUM-1105c — `allocateQuoteNumber` devuelve `{ numero, seq, year }` desde SCRUM-592, y quien guarda
// su resultado en una variable tiene que desestructurarlo. `scripts/seed-video.mjs` lo guardaba
// entero y lo metía en `Quote.quoteNumber` (Int): la siembra revertía entera, y nadie lo vio en 53
// días porque el seed no se había ejecutado nunca contra una base (SCRUM-1098 §5).
//
// Cuenta COSAS: por AST, cada declaración `const x = await allocateQuoteNumber(...)` en `src/` y
// `scripts/`. Una que no sea `{ seq … }` cae. Población declarada y con suelo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIRS = ['src', 'scripts'];
// Las que hay hoy: seed-video + tres rutas/servicios de src. Si baja, el barrido se ha descarriado.
const SUELO = 4;

function ficheros(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') out.push(...ficheros(p)); }
    else if (/\.(ts|mjs)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** Cada `x = await allocateQuoteNumber(...)` de un fuente: {linea, desestructurado}. */
export function declaraciones(texto, nombre = 'x.mjs') {
  const sf = ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true);
  const out = [];
  const visita = (n) => {
    if (ts.isVariableDeclaration(n) && n.initializer) {
      let ini = n.initializer;
      if (ts.isAwaitExpression(ini)) ini = ini.expression;
      if (ts.isCallExpression(ini) && ts.isIdentifier(ini.expression) && ini.expression.text === 'allocateQuoteNumber') {
        const conSeq = ts.isObjectBindingPattern(n.name) &&
          n.name.elements.some((el) => (el.propertyName ?? el.name).getText(sf) === 'seq');
        out.push({ linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, desestructurado: conSeq });
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return out;
}

test('control sembrado: el lector caza el objeto entero y acepta la forma de las rutas', () => {
  assert.deepEqual(declaraciones('const n = await allocateQuoteNumber(tx, 1);').map((d) => d.desestructurado), [false]);
  assert.deepEqual(declaraciones('const { seq: n, year } = await allocateQuoteNumber(tx, 1);').map((d) => d.desestructurado), [true]);
  assert.deepEqual(declaraciones('const { numero } = await allocateQuoteNumber(tx, 1);').map((d) => d.desestructurado), [false]);
  assert.equal(declaraciones('// const n = await allocateQuoteNumber(tx, 1);').length, 0, 'un comentario no es una llamada');
});

test('toda declaración con el resultado de allocateQuoteNumber lo desestructura con `seq`', () => {
  const hallados = [];
  for (const d of DIRS) {
    for (const f of ficheros(path.join(RAIZ, d))) {
      const texto = fs.readFileSync(f, 'utf8');
      if (!texto.includes('allocateQuoteNumber')) continue;
      for (const x of declaraciones(texto, f)) hallados.push({ f: path.relative(RAIZ, f).replaceAll('\\', '/'), ...x });
    }
  }
  console.log(`scrum1105c · población: ${hallados.length} declaraciones en ${new Set(hallados.map((h) => h.f)).size} ficheros`);
  assert.ok(hallados.length >= SUELO, `solo ${hallados.length} declaraciones (suelo ${SUELO}): el barrido no ve lo que hay`);
  assert.ok(hallados.some((h) => h.f === 'scripts/seed-video.mjs'), 'seed-video.mjs tiene que estar en la población');
  const malas = hallados.filter((h) => !h.desestructurado).map((h) => `${h.f}:${h.linea}`);
  assert.deepEqual(malas, [], 'guardan el objeto entero de allocateQuoteNumber');
});
