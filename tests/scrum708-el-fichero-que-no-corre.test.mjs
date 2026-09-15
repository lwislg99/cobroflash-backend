// tests/scrum708-el-fichero-que-no-corre.test.mjs — SCRUM-708
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL FICHERO RENOMBRADO, DETECTADO DIRECTAMENTE — y no de refilón por el total
//
// ── EL HUECO QUE VIENE A CERRAR ──────────────────────────────────────────────────────────
// `_suelo-de-la-tanda.mjs` dejó escrito, entre los caminos que sacan tests de la tanda sin
// producir un rojo, **«un fichero renombrado y no re-referenciado»**. Y SCRUM-702 declaró que ése
// era el único caso que el detector de mudos NO ve: un fichero mudo deja entrada en el TAP con su
// nombre, pero uno que ni siquiera se le pasa a `node --test` **no deja nada**. Sólo lo notaba el
// total — y el total es un INDICIO, porque compara un número declarado en otro árbol.
//
// 🔴 Y el total ya no puede verlo, aunque quisiera. Medido el 8-sep-2026: la tanda tiene **751
// ficheros** y **8,1 tests de media**, con un máximo de **25** (`scrum411`). O sea que perder un
// fichero entero mueve el total entre 1 y 25. Un suelo con cualquier margen de trabajo se lo come
// entero. **La cifra agregada no puede, por construcción, ver la pérdida de un fichero.**
//
// ── LO QUE SE MIDIÓ ANTES DE CONSTRUIR ───────────────────────────────────────────────────
// Barrido el 8-sep-2026 sobre `origin/main` = `f1c84a8a`, 1.217 ficheros de código del árbol:
//
//     registran tests y SÍ los corre `npm test`  →  749
//     registran tests y NO los corre nadie       →    0
//
// **Era un hueco de verdad, sin víctima** — a diferencia del censo de entorno del mismo ticket,
// que ya se le escapaba una. Pero un hueco sin víctima y sin instrumento es un hueco que nadie
// vuelve a medir: dentro de dos semanas se lee como pendiente y cuesta otra tanda. Por eso no se
// declara: se cierra.
//
// ── POR QUÉ ESTO NO NECESITA QUE NADIE SE ACUERDE ────────────────────────────────────────
// 🔒 Los dos lados se miden **sobre el mismo árbol y en el mismo instante**: quién registra tests
// (por AST) y a quién se lo pasa la tanda (por el patrón de `package.json`). No hay número
// declarado, así que no hay nada que envejezca ni que subir. Margen cero por construcción.
//
// ── ⚠️ Y EL PATRÓN SE DERIVA, NO SE COPIA ───────────────────────────────────────────────
// Escribir `tests/*.test.mjs` aquí a mano sería la lista mantenida a mano de siempre: el día que
// alguien cambie el `test` de `package.json`, este guard seguiría verde midiendo un patrón que ya
// no usa nadie. Se lee del script real. Y si de ahí no sale ningún patrón, esto se declara
// CIEGO en vez de decir «cero fuera» — que es el mismo número con el significado contrario.
//
// ── ⛔ POR QUÉ NO DECLARA `MUTACIONES_QUE_ME_TUMBAN` ─────────────────────────────────────
// El defecto que vigila es **renombrar o mover un fichero**, y una mutación de SCRUM-745 es una
// sustitución de texto: no puede imitarlo. Declarar una que mutara este mismo guard no imitaría el
// defecto, imitaría una avería del instrumento. Media declaración parece cobertura, así que no se
// pone ninguna y queda dicho por qué. El rojo se ejercita a mano, y está abajo con fuente sintético.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registraTests, testsDeclarados } from './_poblacion-de-tests.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

/** Carpetas que no son código nuestro, o que son artefactos. */
const FUERA = new Set(['node_modules', '.git', 'dist', 'coverage', '.playwright-mcp', '.m']);

/**
 * Los patrones que la tanda expande de verdad, LEÍDOS del script `test` de `package.json`.
 *
 * Todo lo que no empiece por `-` después de `node` es un patrón; las banderas se descartan. Si no
 * queda ninguno, devuelve `[]` — y el que llame tiene que tratar eso como ceguera, no como cero.
 */
export function patronesDeLaTanda(script) {
  const trozos = String(script || '').split('&&');
  const conNode = trozos.find((t) => /(^|\s)node\s+--test(\s|$)/.test(t));
  if (!conNode) return [];
  return conNode.trim().split(/\s+/)
    .slice(1)                                   // fuera el propio `node`
    .filter((a) => !a.startsWith('-'))          // fuera las banderas
    .filter((a) => /\.m?js$/.test(a));          // un patrón de ficheros, no un subcomando
}

/** Un patrón de shell a expresión regular. `*` no cruza carpetas, que es como lo expande la shell. */
export function patronARegex(patron) {
  const escapado = patron.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp('^' + escapado + '$');
}

/** Todos los ficheros de código del árbol, en rutas relativas con barras normales. */
function ficherosDeCodigo(dir = '', acc = []) {
  for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
    if (FUERA.has(e.name)) continue;
    const rel = dir ? dir + '/' + e.name : e.name;
    if (e.isDirectory()) ficherosDeCodigo(rel, acc);
    else if (/\.(mjs|cjs|js)$/.test(e.name)) acc.push(rel);
  }
  return acc;
}

// El barrido cuesta ~3 s (AST de mil ficheros). Se hace UNA vez: repetirlo por test duplicaba el
// coste sin añadir ni una medición, y el árbol no cambia dentro de la misma tanda.
let cache = null;
function barrido() {
  if (cache) return cache;
  const script = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).scripts.test;
  const patrones = patronesDeLaTanda(script).map(patronARegex);
  const ficheros = ficherosDeCodigo();
  const conTests = ficheros.filter((rel) => registraTests(fs.readFileSync(path.join(RAIZ, rel), 'utf8'), rel));
  cache = {
    script,
    patrones,
    leidos: ficheros.length,
    dentro: conTests.filter((rel) => patrones.some((p) => p.test(rel))),
    fuera: conTests.filter((rel) => !patrones.some((p) => p.test(rel))),
  };
  return cache;
}

test('SCRUM-708 · 🔴 SUELO: si no sé de dónde sale el patrón, soy CIEGO — no digo «cero»', () => {
  const { script, patrones, leidos, dentro } = barrido();
  assert.ok(patrones.length > 0,
    '🔴 CIEGO: del script `test` de package.json no sale ningún patrón de ficheros, así que no sé '
    + 'a quién se le pasa la tanda. Un «cero fuera» calculado sin patrón no dice que no falte '
    + 'nadie: dice que no he mirado.\n  script: ' + script);
  assert.ok(leidos >= 300,
    '🔴 CIEGO: sólo he barrido ' + leidos + ' ficheros de código. El árbol tiene más de mil; una '
    + 'población así de pequeña significa que el barrido se ha roto, no que el árbol haya encogido.');
  assert.ok(dentro.length >= 500,
    '🔴 CIEGO: sólo veo ' + dentro.length + ' ficheros que registren tests, y la tanda tiene más de '
    + 'setecientos. Si el clasificador ha dejado de reconocerlos, el «0 fuera» de al lado es mi '
    + 'ceguera y no una propiedad del árbol.');
  // 🔒 Control positivo que no envejece: este guard tiene que verse A SÍ MISMO. Si el barrido no
  // encuentra el fichero desde el que se está ejecutando, no está mirando donde dice.
  assert.ok(dentro.includes('tests/scrum708-el-fichero-que-no-corre.test.mjs'),
    '🔴 CIEGO: el barrido no se ve a sí mismo. Está mirando otro sitio.');
});

test('SCRUM-708 · 🔴 NINGÚN fichero registra tests fuera de lo que la tanda ejecuta', () => {
  const { fuera, script } = barrido();
  assert.deepEqual(fuera, [],
    '🔴 hay ' + fuera.length + ' fichero(s) que registran tests y que `npm test` NO ejecuta:\n  '
    + fuera.join('\n  ')
    + '\n\n  Sus tests no corren y NADIE grita: no fallan, no aparecen en el TAP y el detector de '
    + 'ficheros mudos tampoco los ve, porque un fichero mudo deja entrada con su nombre y éste no '
    + 'deja nada. Lo único que lo notaba era el total, y el total no puede: la media es de 8,1 '
    + 'tests por fichero (máximo 25 medido el 8-sep-2026) y cualquier margen de suelo se lo come.'
    + '\n\n  Si el fichero se ha movido o renombrado a propósito, devuélvelo al patrón o AMPLÍA el '
    + 'script `test` en el mismo commit.\n  script actual: ' + script);
});

test('SCRUM-708 · ✅ CONTROL POSITIVO: un fichero renombrado FUERA del patrón se caza', () => {
  // El defecto, sintético: el mismo fuente que hoy corre, con otro nombre.
  const patrones = patronesDeLaTanda('npm run build && node --test --test-force-exit tests/*.test.mjs')
    .map(patronARegex);
  const casa = (rel) => patrones.some((p) => p.test(rel));

  assert.ok(casa('tests/scrum708-el-fichero-que-no-corre.test.mjs'),
    '🔴 el patrón derivado no reconoce un fichero que SÍ corre hoy: entonces no es el patrón.');

  for (const renombrado of [
    'tests/scrum708-el-fichero-que-no-corre.mjs',      // se le cayó el `.test`
    'tests/viejos/scrum708-el-fichero-que-no-corre.test.mjs', // movido a una subcarpeta
    'test/scrum708-el-fichero-que-no-corre.test.mjs',  // carpeta en singular
    'scrum708-el-fichero-que-no-corre.test.mjs',       // sacado de `tests/`
  ]) {
    assert.equal(casa(renombrado), false,
      '🔴 `' + renombrado + '` NO lo ejecuta la tanda y el guard cree que sí. Con esto, un fichero '
      + 'movido pasaría por dentro y el detector no valdría para nada.');
  }
});

test('SCRUM-708 · ✅ CONTROL NEGATIVO: el clasificador no cuenta lo que no es un test', () => {
  assert.equal(registraTests("import test from 'node:test';\ntest('x', () => {});"), true,
    '🔴 CIEGO: no reconoce el caso más simple de todos.');
  // Una expresión regular usa `.test(`, y eso NO es registrar un test.
  assert.equal(registraTests("const re = /a/;\nexport const f = (s) => re.test(s);"), false,
    '🔴 está contando `re.test(s)` como un test: la población medida no sería la que dice.');
  // Importar `node:test` sin llamar a nada tampoco lo es (un ayudante que reexporta, por ejemplo).
  assert.equal(registraTests("import test from 'node:test';\nexport const t = test;"), false,
    '🔴 un fichero que importa el módulo pero no registra nada se está contando como test.');
  // Y NOMBRARLO en un comentario o en una cadena tampoco.
  assert.equal(registraTests("// import test from 'node:test'; test('x', () => {});"), false,
    '🔴 un comentario se está leyendo como código: es la autorreferencia de siempre.');
  assert.equal(registraTests("const ejemplo = `import test from 'node:test'; test('x', () => {});`;"), false,
    '🔴 un fuente de ejemplo dentro de una cadena se está contando como test de verdad.');
});

test('SCRUM-708 · 🔴 contar tests por AST no cuenta ni comentarios ni fuentes de ejemplo', () => {
  // El mismo contador alimenta la población «tests-declarados» del registro de `scrum810b`. Si
  // contara texto, DOCUMENTAR un guard subiría la población y retirar un comentario la bajaría:
  // el suelo derivado hablaría de pérdidas que no existen y callaría las que sí.
  assert.equal(testsDeclarados("import test from 'node:test';\ntest('a', () => {});\ntest('b', () => {});"), 2);
  assert.equal(testsDeclarados("// test('a', () => {});\n/* test('b', () => {}); */"), 0,
    '🔴 está contando tests comentados: documentar subiría la población.');
  assert.equal(testsDeclarados("const ejemplo = `test('a', () => {});`;"), 0,
    '🔴 está contando un fuente de ejemplo dentro de una cadena. Este árbol está lleno de guards '
    + 'que llevan fuentes sintéticos como dato: los contaría todos.');
  assert.equal(testsDeclarados("const re = /x/;\nre.test('a');"), 0,
    '🔴 está contando `re.test(...)`, que es una expresión regular y no un test.');
  // `describe` agrupa, no es un caso: contarlo desviaría la población del número que se compara.
  assert.equal(testsDeclarados("import { describe, it } from 'node:test';\ndescribe('g', () => { it('a', () => {}); });"), 1,
    '🔴 `describe` se está contando como un caso.');
});

test('SCRUM-708 · 🔴 el lector del script distingue «no hay patrón» de «no he mirado»', () => {
  assert.deepEqual(patronesDeLaTanda('npm run build && node --test --test-force-exit tests/*.test.mjs'),
    ['tests/*.test.mjs']);
  // Varios patrones: los coge todos.
  assert.deepEqual(patronesDeLaTanda('node --test tests/*.test.mjs tests/extra/*.test.mjs'),
    ['tests/*.test.mjs', 'tests/extra/*.test.mjs']);
  // 🔴 Y el caso que obliga a declararse ciego: `node --test` a secas descubre ficheros por su
  // cuenta, sin patrón que leer. Devolver `[]` es lo correcto; lo que NO vale es que el guard de
  // arriba lo tome por «no falta nadie».
  assert.deepEqual(patronesDeLaTanda('node --test'), []);
  assert.deepEqual(patronesDeLaTanda('vitest run'), []);
  assert.deepEqual(patronesDeLaTanda(''), []);
});
