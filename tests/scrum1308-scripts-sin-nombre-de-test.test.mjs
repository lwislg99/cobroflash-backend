// tests/scrum1308-scripts-sin-nombre-de-test.test.mjs — SCRUM-1308
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 FUERA DE `tests/` NINGÚN FICHERO PUEDE LLAMARSE COMO UN TEST
//
// `node --test` SIN ficheros descubre por NOMBRE y EJECUTA lo que casa con su patrón, y lo cuenta
// como un test en VERDE si sale 0. El 30-sep, con una lista de ficheros vacía (un `sed` que falló),
// ejecutó dos scripts de `scripts/` que se llamaban como tests: la tanda gateada, que conectó a una
// base de verdad, y la sonda de WhatsApp. Se renombraron (autorización del fundador, SCRUM-1308) y
// este guard impide que vuelva a existir un tercero.
//
// ── EL PATRÓN SE DERIVA, NO SE COPIA ─────────────────────────────────────────────────────────────
// Se le pregunta a `node` el suyo (`kDefaultPattern` del runner) y se compara con `path.matchesGlob`,
// el comparador del propio `node`. Si el patrón se copiara a ojo y fuera más estrecho, este guard
// daría cero y seguiría habiendo ficheros ejecutables. Y para no fiarse ni de eso, se CONTRASTA: en un
// directorio temporal se fabrican ficheros de juguete, se lanza `node --test` sin argumentos de
// verdad, y lo que ejecuta tiene que ser EXACTAMENTE lo que el comparador dice que casa.
//
// Población: todo el árbol menos `node_modules/` y `.git/` (lo que `node --test` recorrería lanzado
// desde la raíz), y menos `tests/`, que es donde los tests SÍ tienen que casar.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** El patrón con el que `node --test` descubre, preguntado a `node`. Sin él, CIEGO. */
function patronDeNode() {
  const r = spawnSync(process.execPath,
    ['--expose-internals', '-e', "process.stdout.write(String(require('internal/test_runner/utils').kDefaultPattern || ''))"],
    { encoding: 'utf8' });
  const p = (r.stdout || '').trim();
  assert.ok(r.status === 0 && p.includes('test'),
    `🔴 CIEGO: no he podido preguntarle a node su patrón de descubrimiento (status ${r.status}, «${p}» ${r.stderr || ''}).`);
  return p;
}
const PATRON = patronDeNode();
const casa = (rel) => path.matchesGlob(rel, PATRON);

/** Rutas relativas (con `/`) de todos los ficheros bajo `base`, sin `node_modules/` ni `.git/`. */
function ficherosDe(base) {
  const out = [];
  (function andar(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        andar(path.join(dir, e.name), rel ? `${rel}/${e.name}` : e.name);
      } else out.push(rel ? `${rel}/${e.name}` : e.name);
    }
  }(base, ''));
  return out;
}

/** Los que `node --test` ejecutaría y no son tests: todo lo que casa fuera de `tests/`. */
const ejecutablesFueraDeTests = (lista) => lista.filter((f) => !f.startsWith('tests/') && casa(f));

test('SCRUM-1308 · el comparador es el de node --test: lo que ejecuta de verdad = lo que casa', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1308-'));
  try {
    const marca = path.join(dir, 'ejecutados.txt');
    const juguetes = [
      'scripts/test-foo.mjs', 'scripts/bar-test.mjs', 'scripts/baz.test.cjs', 'scripts/qux_test.js',
      'scripts/test.js', 'scripts/test/dentro.mjs',
      'scripts/normal.mjs', 'scripts/testing.mjs', 'scripts/contest.mjs', 'scripts/staging-gated.mjs', 'scripts/wa-prueba.mjs',
    ];
    for (const j of juguetes) {
      const f = path.join(dir, ...j.split('/'));
      fs.mkdirSync(path.dirname(f), { recursive: true });
      const cuerpo = `require('node:fs').appendFileSync(${JSON.stringify(marca)}, ${JSON.stringify(j + '\n')});\n`;
      fs.writeFileSync(f, j.endsWith('.mjs') ? `import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);\n${cuerpo}` : cuerpo);
    }
    // Sin NODE_TEST_CONTEXT: heredado del runner que corre ESTE test, el hijo se portaría como subproceso de test.
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap'], { cwd: dir, encoding: 'utf8', env });
    const ejecutados = fs.existsSync(marca) ? fs.readFileSync(marca, 'utf8').split('\n').filter(Boolean).sort() : [];
    const segunElComparador = juguetes.filter(casa).sort();
    assert.ok(ejecutados.length >= 4, `🔴 CIEGO: node --test no ejecutó los juguetes que debía (status ${r.status}): ${JSON.stringify(ejecutados)}`);
    assert.deepEqual(ejecutados, segunElComparador,
      '🔴 el comparador de este guard NO coincide con lo que node --test ejecuta de verdad: su cero no valdría nada.');
    assert.ok(!ejecutados.includes('scripts/normal.mjs') && !ejecutados.includes('scripts/staging-gated.mjs') && !ejecutados.includes('scripts/wa-prueba.mjs'),
      '🔴 node --test ejecuta un nombre que este guard da por seguro');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-1308 · control positivo: el detector VE un nombre que casa, y nombra los dos viejos', () => {
  const lista = ['scripts/wa-test.mjs', 'scripts/test-staging-gated.mjs', 'scripts/x.test.ts', 'scripts/normal.mjs',
    'tests/scrum1308-scripts-sin-nombre-de-test.test.mjs', 'public/dashboard/js/app.js'];
  assert.deepEqual(ejecutablesFueraDeTests(lista), ['scripts/wa-test.mjs', 'scripts/test-staging-gated.mjs', 'scripts/x.test.ts'],
    '🔴 el detector no ve los nombres que node --test descubriría fuera de tests/ (o ve de más)');
});

test('SCRUM-1308 · 🔴 fuera de tests/ NINGÚN fichero se llama como un test (node --test lo ejecutaría)', () => {
  const todos = ficherosDe(RAIZ);
  assert.ok(todos.length > 1000 && todos.some((f) => f === 'scripts/staging-gated.mjs'),
    `🔴 CIEGO: el recorrido del árbol no ve lo que debe (${todos.length} ficheros).`);
  assert.ok(todos.filter((f) => f.startsWith('tests/') && casa(f)).length > 100,
    '🔴 CIEGO: el patrón no casa ni con los tests de verdad; su cero de abajo no significaría nada.');
  const malos = ejecutablesFueraDeTests(todos);
  assert.deepEqual(malos, [],
    '🔴 FICHEROS FUERA DE tests/ QUE `node --test` DESCUBRIRÍA Y EJECUTARÍA POR SU NOMBRE:\n'
    + malos.map((f) => `    ${f}`).join('\n')
    + `\n  Patrón de node: ${PATRON}\n  Renómbralo (sin test-, -test, .test, _test ni carpeta test/). Ver SCRUM-1308.`);
});
