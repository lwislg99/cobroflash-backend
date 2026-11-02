// tests/scrum1335e-scrum804-en-clon-somero.test.mjs — SCRUM-1335e
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// ⛔ NO TOCA EL REMOTO DE VERDAD: todo pasa en un repositorio SINTÉTICO del temporal.
//
// `tests/scrum804-la-rama-viva.test.mjs` MORÍA AL CARGAR en un clon de profundidad 1: sin la punta
// de `main`, su instantánea no tiene sha y la lectura `for-each-ref --merged=<sha>` del nivel
// superior salía `--merged=null` → `fatal: malformed object name null`. El fichero no llegaba a
// declarar ni un caso.
//
// Medido el 2-nov-2026 por la línea `SIN INFORME ENTERO` de SCRUM-1335d en su primera pasada de CI
// (job de zona del PR #3029): es el ÚNICO fichero de 1.576 sin informe, en las DOS zonas. El job
// de zona hace `actions/checkout` sin `fetch-depth: 0`, y moría igual en las dos, así que el
// comparador lo daba por «comparado e igual» desde SCRUM-925 (17-sep): seis semanas sin medirse.
//
// Lo que aquí se fija es lo que hace SCRUM-1331 en `scrum804b`: nada que pueda lanzar al cargar, los
// casos puros corren, y los que miran el árbol vivo CAEN diciendo por qué. Un ciego no es un verde.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { temporalDeFixtureGit, gitDeFixture } from './_censo-fixture.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SUJETO = path.join(RAIZ, 'tests', 'scrum804-la-rama-viva.test.mjs');

/** Las mutaciones de este guard, en el catálogo del meta-guard (SCRUM-1387: nada de banco con lista propia). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La exigencia, muda: en el clon somero los casos del árbol vivo caen por un TypeError sin motivo.
    fichero: 'tests/scrum804-la-rama-viva.test.mjs',
    de: '  if (CIEGO) assert.fail(CIEGO);',
    a: '  if (CIEGO) { /* mudo */ }',
    cae: 'y los que miran el árbol vivo CAEN nombrando la causa',
  },
  {
    // Nunca ciego: vuelve el `--merged=null` en el nivel superior, la forma exacta de SCRUM-1335d.
    fichero: 'tests/scrum804-la-rama-viva.test.mjs',
    de: 'const CIEGO = motivoDeCiego();',
    a: 'const CIEGO = null;',
    cae: 'scrum804 en un clon somero NO muere al cargar',
  },
  {
    // El rojo sin remedio: cae, pero no dice qué hay que arreglar.
    fichero: 'tests/scrum804-la-rama-viva.test.mjs',
    de: "'verde. Si esto es un job de CI, su `actions/checkout` necesita `fetch-depth: 0` y la punta de '",
    a: "'verde. Si esto es un job de CI, revisa el checkout y la punta de '",
    cae: 'y los que miran el árbol vivo CAEN nombrando la causa',
  },
  {
    // Un caso del árbol vivo sin la exigencia: en el clon somero pasaría EN VACÍO.
    fichero: 'tests/scrum804-la-rama-viva.test.mjs',
    de: "test('SCRUM-804 · ✅ SIN RASTRO es un veredicto, no un hueco', () => {\n  exigirArbol();",
    a: "test('SCRUM-804 · ✅ SIN RASTRO es un veredicto, no un hueco', () => {",
    cae: 'todo caso de scrum804 que lee el árbol vivo EMPIEZA por exigirArbol()',
  },
];

/** El remoto y el clon con la forma del job de zona: profundidad 1, UNA rama, sin `main`. */
let banco = null;
function montar() {
  if (banco) return banco;
  const dir = temporalDeFixtureGit('scrum1335e-');
  const g = (cwd, ...args) => gitDeFixture(args, { cwd });
  const remoto = path.join(dir, 'remoto.git');
  const obra = path.join(dir, 'obra');
  gitDeFixture(['init', '-q', '--bare', '-b', 'main', remoto]);
  fs.mkdirSync(obra);
  g(obra, 'init', '-q', '-b', 'main');
  g(obra, 'config', 'user.email', 'fixture@yaqu.test');
  g(obra, 'config', 'user.name', 'Fixture');
  g(obra, 'config', 'commit.gpgsign', 'false');
  g(obra, 'remote', 'add', 'origin', remoto);
  const commit = (fichero) => {
    fs.writeFileSync(path.join(obra, fichero), `${fichero}\n`);
    g(obra, 'add', '-A');
    g(obra, 'commit', '-q', '-m', `banco: ${fichero}`);
  };
  commit('a.txt');
  commit('b.txt');
  g(obra, 'push', '-q', 'origin', 'main');
  g(obra, 'checkout', '-q', '-b', 'scrum-8-viva');
  commit('c.txt');
  g(obra, 'push', '-q', 'origin', 'scrum-8-viva');

  const somero = path.join(dir, 'somero');
  gitDeFixture(['clone', '-q', '--depth', '1', '--single-branch', '--branch', 'scrum-8-viva',
    pathToFileURL(remoto).href, somero]);
  banco = { somero };
  return banco;
}

/** El hijo no hereda el contexto del runner de tests (SCRUM-1349). */
function entornoHacia(somero) {
  const e = { ...process.env, SCRUM804_GIT_EN: somero };
  for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete e[k];
  return e;
}

let corrida = null;
function correrScrum804() {
  if (corrida) return corrida;
  const { somero } = montar();
  const r = spawnSync(process.execPath, ['--test-reporter=tap', SUJETO],
    { cwd: RAIZ, env: entornoHacia(somero), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  corrida = { status: r.status, salida: `${r.stdout ?? ''}${r.stderr ?? ''}` };
  return corrida;
}

/** Los bloques TAP de primer nivel: cada `ok N - …` / `not ok N - …` con lo que lleva debajo. */
function bloques(salida) {
  const filas = salida.split(/\r?\n/);
  const out = [];
  for (const fila of filas) {
    const m = /^(not ok|ok) \d+ - (.*)$/.exec(fila);
    if (m) out.push({ ok: m[1] === 'ok', nombre: m[2], cuerpo: [] });
    else if (out.length) out[out.length - 1].cuerpo.push(fila);
  }
  return out;
}

test('SCRUM-1335e · CONTROL: el banco tiene la forma del job de zona (somero y sin la punta de `main`)', () => {
  const { somero } = montar();
  const g = (...args) => spawnSync('git', args, { cwd: somero, encoding: 'utf8' });
  assert.equal(g('rev-parse', '--is-shallow-repository').stdout.trim(), 'true',
    '🔴 el clon de profundidad 1 no es somero: el banco no monta el caso que dice medir');
  assert.notEqual(g('rev-parse', '--verify', '-q', 'refs/remotes/origin/main').status, 0,
    '🔴 el clon trae la punta de `main`: no es la forma del checkout del job de zona');
  assert.equal(g('rev-parse', '--verify', '-q', 'refs/remotes/origin/scrum-8-viva').status, 0,
    '🔴 el clon no trae ni la rama que se pidió: el banco está roto, no el sujeto');
});

test('SCRUM-1335e · 🔴 scrum804 en un clon somero NO muere al cargar: declara sus casos', () => {
  const { salida } = correrScrum804();
  assert.doesNotMatch(salida, /malformed object name/,
    `🔴 scrum804 sigue muriendo al cargar en un clon somero (la forma de SCRUM-1335d). Salida:\n${salida.slice(-1500)}`);
  const b = bloques(salida);
  assert.ok(b.some((x) => x.ok),
    `🔴 ningún caso de scrum804 ha pasado en el clon somero: los PUROS tampoco han corrido. Salida:\n${salida.slice(-1500)}`);
});

test('SCRUM-1335e · 🔴 y los que miran el árbol vivo CAEN nombrando la causa, nunca en verde', () => {
  const { status, salida } = correrScrum804();
  assert.notEqual(status, 0,
    `🔴 scrum804 sale VERDE en un clon somero: el censo de la rama viva no se ha comprobado y nadie lo dice. Salida:\n${salida.slice(-1500)}`);
  const caidos = bloques(salida).filter((x) => !x.ok);
  assert.ok(caidos.length > 0, `🔴 no ha caído ningún caso. Salida:\n${salida.slice(-1500)}`);
  for (const c of caidos) {
    const texto = c.cuerpo.join('\n');
    assert.match(texto, /CIEGO · CLON SOMERO/,
      `🔴 «${c.nombre}» cae en el clon somero, pero NO por el clon: un rojo que no nombra su causa manda a buscarla en el diff.\n${texto.slice(0, 1200)}`);
  }
  assert.match(salida, /fetch-depth: 0/, '🔴 el rojo no dice qué hay que arreglar');
});

// 🔴 LA MITAD QUE EL CLON NO VE: un caso que lee el árbol vivo y NO empieza por `exigirArbol()`
// pasa EN VACÍO en un clon somero (el censo ciego trae `porTicket` vacío, y «no hay ramas falsas»
// sobre cero ramas es verde). Los dos casos de arriba no lo cazan: sólo miran los que CAEN. Así que
// se mira la fuente, por AST: qué casos nombran algo del árbol vivo, y si su primera sentencia es la
// exigencia. Medido al escribirlo: quitarla de «SIN RASTRO» dejaba los otros tres casos en verde.
const DEL_ARBOL_VIVO = new Set([
  'censo',
  'CRUDAS',
  'CRUDAS_EN_MAIN',
  'CRUDAS_VIVAS',
  'NO_FIABLE',
  'REFS_MOVIDAS',
  'git',
  'execFileSync',
  'refsCrudasEnVivo',
  'ramasDeLaHistoriaDeMerges',
]);

test('SCRUM-1335e · 🔴 todo caso de scrum804 que lee el árbol vivo EMPIEZA por exigirArbol()', async () => {
  const { default: ts } = await import('typescript');
  const fuente = fs.readFileSync(SUJETO, 'utf8');
  const sf = ts.createSourceFile(SUJETO, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const casos = [];
  for (const st of sf.statements) {
    if (!ts.isExpressionStatement(st) || !ts.isCallExpression(st.expression)) continue;
    const c = st.expression;
    if (!ts.isIdentifier(c.expression) || c.expression.text !== 'test') continue;
    const [nombre, fn] = c.arguments;
    if (!nombre || !fn || !ts.isStringLiteralLike(nombre) || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) continue;
    const nombres = new Set();
    const visitar = (n) => { if (ts.isIdentifier(n)) nombres.add(n.text); ts.forEachChild(n, visitar); };
    visitar(fn.body);
    const primera = ts.isBlock(fn.body) ? fn.body.statements[0] : null;
    const empiezaExigiendo = !!primera && ts.isExpressionStatement(primera)
      && ts.isCallExpression(primera.expression) && ts.isIdentifier(primera.expression.expression)
      && primera.expression.expression.text === 'exigirArbol';
    casos.push({ nombre: nombre.text, vivo: [...nombres].some((x) => DEL_ARBOL_VIVO.has(x)), empiezaExigiendo });
  }
  // Suelo: si el recorrido no encuentra casos, o ninguno vivo y ninguno puro, no ha mirado nada.
  assert.ok(casos.some((x) => x.vivo), '🔴 CIEGO: el AST no encuentra ningún caso que lea el árbol vivo en scrum804');
  assert.ok(casos.some((x) => !x.vivo), '🔴 CIEGO: el AST no encuentra ningún caso puro en scrum804');
  const sinExigir = casos.filter((x) => x.vivo && !x.empiezaExigiendo).map((x) => x.nombre);
  assert.deepEqual(sinExigir, [],
    '🔴 estos casos leen el árbol vivo y NO empiezan por `exigirArbol()`: en un clon somero pasan en vacío:\n   · '
    + sinExigir.join('\n   · '));
});
