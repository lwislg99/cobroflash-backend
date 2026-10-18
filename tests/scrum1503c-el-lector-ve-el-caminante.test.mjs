// SCRUM-1503c — La dirigida dejaba fuera a 24 tests que SÍ recorren directorios (J3, 8-oct-2026, a65a8c75).
//
// `scripts/_tests-que-cubren.mjs` elige qué tests corren antes de empujar. Tres rojos en seis días
// (#2141, #2220, #2280) los cazó sólo el CI, porque el lector no veía tres formas de la casa y el
// test no dejaba rastro —ni RECORRE ni NO_SE—, así que no entraba nunca:
//   · el caminante invocado EN EL SITIO, `(function anda(dir) { … })(RAIZ)` (22 de los 24);
//   · el caminante pasado COMO VALOR, `dirs.forEach(walk)` (1, `scrum164`);
//   · dos `const dir` en un fichero, y ganaba siempre el primero (1, `scrum628`).
// El fundador eligió arreglar el lector (salida B, SCRUM-1503 c.18852). Aquí se sujeta:
//   ① EL CASO REAL: los tres tests del ticket entran al tocar lo que leen.
//   ② cada forma sobre un árbol fabricado, con su mitad que absuelve. Dos de las mitades salieron al
//      medir el arreglo: con el ámbito bien leído, `dir || POR_DEFECTO` caía en NO_SE (34 tests de más
//      en toda dirigida), y un `(function anda(n) {…})(sf)` que recorre el árbol sintáctico heredaba
//      por el NOMBRE el caminante de otro `anda` del mismo fichero.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { temporal } from './_temporal.mjs';
import { analizarArbol, seleccionar, motivosParaNoFiarse, RECORRE, NO_SE } from '../scripts/_tests-que-cubren.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El caminante en el sitio vuelve a ser invisible.
    fichero: 'scripts/_tests-que-cubren.mjs',
    de: 'return e && (ts.isFunctionExpression(e) || ts.isArrowFunction(e)) && nombreDe(e) ? e : null;',
    a: 'return null;',
    cae: 'SCRUM-1503c ② el caminante en el sitio',
  },
  {
    // `lista.forEach(caminante)` deja de mirarse.
    fichero: 'scripts/_tests-que-cubren.mjs',
    de: 'if (!caminantes.get(caminante)?.has(0)) continue;',
    a: 'continue;',
    cae: 'SCRUM-1503c ② el caminante como valor',
  },
  {
    // Vuelve a ganar la primera declaración del nombre, sin ámbito.
    fichero: 'scripts/_tests-que-cubren.mjs',
    de: 'const elegida = visibles.length ?',
    a: 'const elegida = false ?',
    cae: 'SCRUM-1503c ② dos declaraciones con el mismo nombre',
  },
  {
    // `dir || POR_DEFECTO` deja de leerse: vuelve a NO_SE.
    fichero: 'scripts/_tests-que-cubren.mjs',
    de: "if (b.estado === 'd') return b;",
    a: '',
    cae: 'SCRUM-1503c ② el directorio por defecto',
  },
  {
    // El caminante en el sitio se busca por NOMBRE: el homónimo hereda.
    fichero: 'scripts/_tests-que-cubren.mjs',
    de: 'const indices = nodo ? porNodo.get(nodo) : caminantes.get(quien);',
    a: 'const indices = caminantes.get(quien);',
    cae: 'SCRUM-1503c ② el homónimo',
  },
];

const ARBOL = analizarArbol(RAIZ);

test('SCRUM-1503c ① 🔴 el caso REAL: los tres del ticket entran al tocar lo que leen', () => {
  assert.deepEqual(motivosParaNoFiarse(ARBOL), [], '🔴 NO MEDIDO: el análisis del árbol no es fiable');
  const CASOS = [
    // [test, fichero tocado, cubo esperado o null si basta con que entre]
    ['tests/scrum622-desconocido-no-es-verde.test.mjs', 'docs/master/evidencias/SCRUM-1339/h-entradas.mjs', null],
    ['tests/scrum164-gate-por-campo.test.mjs', 'src/core/flags.ts', RECORRE],
    ['tests/scrum628-cobertura-visual-del-dashboard.test.mjs', 'tests/scrum713c-trinquete-de-estilos-en-js.test.mjs', RECORRE],
  ];
  for (const [t, tocado, cubo] of CASOS) {
    assert.ok(fs.existsSync(path.join(RAIZ, t)) && fs.existsSync(path.join(RAIZ, tocado)),
      `🔴 NO MEDIDO: ya no existe ${t} o ${tocado}. Busca otro caso de la misma forma y cámbialo aquí.`);
    const r = seleccionar(ARBOL, [tocado]).elegidos.get(t);
    assert.ok(r, `🔴 tocar ${tocado} no trae ${t}: es el defecto de SCRUM-1503`);
    if (cubo) assert.equal(r.cubo, cubo, `🔴 ${t} entra, pero no por recorrer la carpeta (${r.cubo} · ${r.por})`);
  }
  const s = seleccionar(ARBOL, ['docs/master/evidencias/SCRUM-1339/h-entradas.mjs']);
  assert.ok(s.elegidos.size < ARBOL.tests.length / 2,
    `🔴 la dirigida elige ${s.elegidos.size} de ${ARBOL.tests.length}: el arreglo ensanchó el lector en vez de arreglarlo`);
});

// ─── El árbol fabricado ──────────────────────────────────────────────────────────────────────
const RAIZ_DE = "const RAIZ = path.resolve(import.meta.dirname, '..');\n";
const FABRICADOS = {
  'public/js/a.js': 'export const a = 1;\n',
  'docs/x.md': '# x\n',
  'tests/en-el-sitio.test.mjs': RAIZ_DE
    + "(function anda(dir) {\n  for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) anda(path.join(dir, e.name));\n})(path.join(RAIZ, 'public'));\n",
  'tests/en-el-sitio-anonimo.test.mjs': '((dir) => { for (const f of fs.readdirSync(dir)) cuenta(f); })(dondeSea);\n',
  'tests/como-valor.test.mjs': RAIZ_DE
    + "const dirs = [path.join(RAIZ, 'public', 'js')];\nfunction walk(d) { for (const f of fs.readdirSync(d)) cuenta(f); }\ndirs.forEach(walk);\n",
  'tests/como-valor-opaco.test.mjs': 'function walk(d) { for (const f of fs.readdirSync(d)) cuenta(f); }\notrasCarpetas().forEach(walk);\n',
  'tests/dos-dir.test.mjs': RAIZ_DE
    + "function uno() { const dir = path.join(RAIZ, 'docs'); return fs.readdirSync(dir); }\n"
    + "function dos() { const dir = path.join(RAIZ, 'public', 'js'); return fs.readdirSync(dir); }\n",
  'tests/por-defecto.test.mjs': RAIZ_DE
    + "function lista(dir) { const D = dir || path.join(RAIZ, 'docs'); return fs.readdirSync(D); }\n",
  'tests/homonimo.test.mjs': RAIZ_DE
    + "(function anda(d) {\n  for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) anda(path.join(d, e.name));\n})(path.join(RAIZ, 'docs'));\n"
    + '(function anda(n) { ts.forEachChild(n, anda); })(arbolSintactico);\n',
};

function arbolFabricado() {
  const raiz = temporal('yaqu-1503c-');
  for (const [rel, texto] of Object.entries(FABRICADOS)) {
    const abs = path.join(raiz, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, texto);
  }
  return analizarArbol(raiz);
}
const FAB = arbolFabricado();
const cubos = (tocado) => Object.fromEntries([...seleccionar(FAB, [tocado]).elegidos]
  .map(([t, r]) => [t.replace(/^tests\/|\.test\.mjs$/g, ''), r.cubo]));

test('SCRUM-1503c ② el caminante en el sitio: con nombre se resuelve; sin nombre sigue entrando siempre', () => {
  assert.equal(FAB.tests.length, 7, 'el banco no ha montado sus siete tests');
  assert.equal(cubos('public/js/a.js')['en-el-sitio'], RECORRE,
    '🔴 `(function anda(dir) {…})(path.join(RAIZ, "public"))` no se ve: tocar `public/js/a.js` no lo trae');
  assert.equal(cubos('docs/x.md')['en-el-sitio'], undefined, '🔴 quien recorre `public` entra por tocar `docs/`');
  assert.equal(cubos('docs/x.md')['en-el-sitio-anonimo'], NO_SE, '🔴 el anónimo en el sitio dejó de entrar siempre');
});

test('SCRUM-1503c ② el caminante como valor: `dirs.forEach(walk)` recorre cada elemento; una lista opaca entra siempre', () => {
  assert.equal(cubos('public/js/a.js')['como-valor'], RECORRE, '🔴 `dirs.forEach(walk)` no se ve');
  assert.equal(cubos('docs/x.md')['como-valor'], undefined, '🔴 quien recorre `public/js` entra por tocar `docs/`');
  assert.equal(cubos('docs/x.md')['como-valor-opaco'], NO_SE,
    '🔴 `otrasCarpetas().forEach(walk)` no entra: una lista que no se lee tiene que ser NO_SE, nunca un cero');
});

test('SCRUM-1503c ② dos declaraciones con el mismo nombre: gana la del ámbito del uso', () => {
  assert.equal(cubos('public/js/a.js')['dos-dir'], RECORRE,
    '🔴 el segundo `const dir` (public/js) se leyó como el primero (docs)');
  assert.equal(cubos('docs/x.md')['dos-dir'], RECORRE, '🔴 el primer `const dir` dejó de leerse');
});

test('SCRUM-1503c ② el directorio por defecto: `dir || path.join(RAIZ, "docs")` recorre docs, no entra siempre', () => {
  assert.equal(cubos('docs/x.md')['por-defecto'], RECORRE, '🔴 el directorio por defecto no se lee');
  assert.equal(cubos('public/js/a.js')['por-defecto'], undefined,
    '🔴 entra por tocar `public/`: `dir || …` ha caído en NO_SE, y eso mete el test en TODA dirigida');
});

test('SCRUM-1503c ② el homónimo: un `anda` que recorre el árbol sintáctico no hereda el caminante de otro `anda`', () => {
  assert.equal(cubos('docs/x.md').homonimo, RECORRE, '🔴 el `anda` que recorre `docs` no se ve');
  assert.equal(cubos('public/js/a.js').homonimo, undefined,
    '🔴 el homónimo entra por tocar `public/`: `anda(arbolSintactico)` se tomó por un caminante de directorios');
});
