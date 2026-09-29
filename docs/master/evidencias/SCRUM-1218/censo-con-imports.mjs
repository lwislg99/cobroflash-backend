// docs/master/evidencias/SCRUM-1218/censo-con-imports.mjs — SCRUM-1218 (reescrita, 28-sep-2026)
//
// ¿Qué `tests/*.test.mjs` tienen, EN SU PROCESO, una llamada a `fetch(…)` y otra a `<x>.listen(0, …)`?
// El censo original (SCRUM-1204) miraba cada fichero por separado y no seguía los imports: `scrum1216b`
// abortó con la firma de libuv y no salía, porque las dos llamadas viven en `tests/_banco-camino-real.mjs`.
//
// Por AST (TypeScript, ya en el árbol), sin contar comentarios ni cadenas. Sigue TRANSITIVAMENTE los
// imports RELATIVOS (estáticos, `export … from` e `import('…')` con literal). No sigue paquetes de
// `node_modules` ni lo que el test carga de `dist/` con `require`/rutas calculadas: límite declarado.
// Tampoco ve `fetch` si se llama por otro nombre (`globalThis.fetch`, `const f = fetch`).
//
//   node docs/master/evidencias/SCRUM-1218/censo-con-imports.mjs
//
// Sale 0 si los controles se cumplen y 1 si alguno falla o hay ficheros que no se pudieron leer (CIEGO).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const ts = createRequire(path.join(REPO, 'package.json'))('typescript');
const TESTS = path.join(REPO, 'tests');

const cache = new Map(); // ruta absoluta → { fetch, listen0, imports[] } | { ciego }
function propio(abs) {
  if (cache.has(abs)) return cache.get(abs);
  let r;
  try {
    const texto = fs.readFileSync(abs, 'utf8');
    const sf = ts.createSourceFile(abs, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    if (sf.parseDiagnostics?.length) throw new Error('no parsea');
    r = { fetch: false, listen0: false, imports: [] };
    const relativo = (n) => n && ts.isStringLiteralLike(n) && /^\.\.?\//.test(n.text) ? n.text : null;
    const ver = (n) => {
      if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && relativo(n.moduleSpecifier)) {
        r.imports.push(path.resolve(path.dirname(abs), n.moduleSpecifier.text));
      }
      if (ts.isCallExpression(n)) {
        const e = n.expression;
        if (e.kind === ts.SyntaxKind.ImportKeyword && relativo(n.arguments[0])) {
          r.imports.push(path.resolve(path.dirname(abs), n.arguments[0].text));
        }
        if (ts.isIdentifier(e) && e.text === 'fetch') r.fetch = true;
        if (ts.isPropertyAccessExpression(e) && e.name.text === 'listen' && n.arguments[0]
          && ts.isNumericLiteral(n.arguments[0]) && n.arguments[0].text === '0') r.listen0 = true;
      }
      ts.forEachChild(n, ver);
    };
    ver(sf);
  } catch (err) {
    r = { ciego: String(err.message || err) };
  }
  cache.set(abs, r);
  return r;
}

/** Recorre el grafo de imports relativos desde `raiz`; dice qué ve y DÓNDE. */
function cierre(raiz) {
  const vistos = new Set(); const pila = [raiz];
  const fetchEn = [], listenEn = [], ciegos = [];
  while (pila.length) {
    const f = pila.pop();
    if (vistos.has(f)) continue;
    vistos.add(f);
    if (!/\.(mjs|js|cjs)$/.test(f) || !fs.existsSync(f)) continue; // .ts/.json/dist: fuera (límite)
    const p = propio(f);
    if (p.ciego) { ciegos.push(path.relative(REPO, f)); continue; }
    if (p.fetch) fetchEn.push(path.relative(REPO, f).split(path.sep).join('/'));
    if (p.listen0) listenEn.push(path.relative(REPO, f).split(path.sep).join('/'));
    pila.push(...p.imports);
  }
  return { fetchEn, listenEn, ciegos };
}

const ficheros = fs.readdirSync(TESTS).filter((f) => f.endsWith('.test.mjs')).sort();
const filas = [];
const ciegos = new Set();
for (const f of ficheros) {
  const abs = path.join(TESTS, f);
  const c = cierre(abs);
  c.ciegos.forEach((x) => ciegos.add(x));
  if (c.fetchEn.length && c.listenEn.length) {
    const yo = `tests/${f}`;
    const directo = c.fetchEn.includes(yo) && c.listenEn.includes(yo);
    filas.push({ f, directo, via: [...new Set([...c.fetchEn, ...c.listenEn].filter((x) => x !== yo))] });
  }
}

const directos = filas.filter((x) => x.directo);
const porImport = filas.filter((x) => !x.directo);
console.log(`población: ${ficheros.length} tests/*.test.mjs · ficheros que no se pudieron leer (CIEGOS): ${ciegos.size}`);
console.log(`con fetch() y .listen(0) en su proceso: ${filas.length} · en el propio fichero: ${directos.length} · sólo a través de imports: ${porImport.length}`);
console.log('\n── a través de imports (lo que el censo de SCRUM-1204 no veía):');
for (const x of porImport) console.log(`  ${x.f}  ←  ${x.via.join(', ')}`);
console.log('\n── en el propio fichero:');
for (const x of directos) console.log(`  ${x.f}${x.via.length ? `  (+ ${x.via.join(', ')})` : ''}`);

// Controles. El positivo PUEDE fallar: con el censo viejo (sin seguir imports) 1216b sale NO.
const tiene = (nombre) => filas.some((x) => x.f === nombre);
const controles = [
  ['POSITIVO por import: scrum1216b (abortó con la firma el 28-sep)', tiene('scrum1216b-numero-de-arranque.test.mjs'), true],
  ['POSITIVO directo: albaran (fetch + listen(0) en el propio fichero)', tiene('albaran.test.mjs'), true],
  ['NEGATIVO: scrum910d (migrado a node:http en SCRUM-1204)', tiene('scrum910d-microcopy-recibo-pendiente.test.mjs'), false],
  ['NEGATIVO: scrum1107b (node:http desde siempre)', tiene('scrum1107b-rutas-garantia.test.mjs'), false],
];
// Un negativo sobre un fichero que no existe se cumple en VACÍO: cada control nombra un fichero que
// tiene que estar en la población, o el control mismo es el que falla.
const existe = ['scrum1216b-numero-de-arranque.test.mjs', 'albaran.test.mjs',
  'scrum910d-microcopy-recibo-pendiente.test.mjs', 'scrum1107b-rutas-garantia.test.mjs'].map((f) => ficheros.includes(f));
let mal = ciegos.size > 0;
console.log('\n── controles:');
for (const [i, [nombre, visto, esperado]] of controles.entries()) {
  if (!existe[i]) { mal = true; console.log(`  🔴 ${nombre}: el fichero NO ESTÁ en la población (control en vacío)`); continue; }
  const ok = visto === esperado;
  if (!ok) mal = true;
  console.log(`  ${ok ? '✅' : '🔴'} ${nombre}: ${visto ? 'SÍ' : 'NO'} (esperado ${esperado ? 'SÍ' : 'NO'})`);
}
if (ciegos.size) console.log(`🔴 CIEGO: ${[...ciegos].join(', ')}`);
process.exit(mal ? 1 : 0);
