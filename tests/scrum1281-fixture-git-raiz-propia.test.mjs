// SCRUM-1281 — El intermitente del check obligatorio: la familia de fixtures de git deja de compartir
// sitio con la tanda, y cuando cae con su firma LO DICE con un marcador fijo.
//
// Contexto (medido por J6, 29-sep-2026): 4 rojos de `build + tests` desde el 24-sep en los que git se
// queda sin un fichero bajo `.git/objects` a mitad de operación, siempre en `repoFixture()` o un clon
// suyo. El experimento de `maintenance.auto` salió negativo. Este fichero NO arregla la causa, que no
// está nombrada: fija los dos pasos baratos que la harán medible.
//   ① la firma reconoce los 4 textos reales de CI y NO un error de git cualquiera;
//   ② CONTROL VIVO: se hace caer a git DE VERDAD con la firma y el marcador sale por el stderr de un
//      proceso hijo —que es lo que leerá el CI—, no solo en un valor devuelto;
//   ③ la familia vive en su raíz propia (en CI, `$RUNNER_TEMP`, fuera de la `/tmp` compartida).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  FIRMA_1281, esFirma1281, raizDeFixturesGit, temporalDeFixtureGit, repoFixture,
} from './_censo-fixture.mjs';
import { temporal, caeEnElArbol } from './_temporal.mjs';

const FIXTURE = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '_censo-fixture.mjs')).href;

// Los textos tal cual los recogió J6 de los jobs rojos (SCRUM-1281, tabla ②).
const REALES = [
  "fatal: failed to copy file to '/tmp/suelo-AbC123/.git/objects/e6/1f0c2d9a': No such file or directory",
  "fatal: failed to copy file to '/tmp/alcanzabilidad-XyZ789/.git/objects/3b/77aa01': No such file or directory",
  'error: unable to create temporary file: No such file or directory',
  'fatal: failed to write commit object',
];
const AJENOS = [
  'fatal: not a git repository (or any of the parent directories): .git',
  "error: pathspec 'nada' did not match any file(s) known to git",
  'fatal: destination path \'x\' already exists and is not an empty directory.',
  "fatal: failed to copy file to '/tmp/x/LEEME.md': Permission denied",
  '',
];

test('SCRUM-1281 ① la firma reconoce los 4 textos reales de CI y ningún otro error de git', () => {
  for (const t of REALES) assert.equal(esFirma1281(t), true, `no reconoce: ${t}`);
  for (const t of AJENOS) assert.equal(esFirma1281(t), false, `falso positivo: ${t}`);
});

test('SCRUM-1281 ② control vivo: git cae de verdad con la firma y el marcador sale por stderr', () => {
  const dir = temporalDeFixtureGit('control-1281-');
  // Fechas y autor FIJOS: los objetos salen iguales en cualquier máquina, así que se sabe de antemano
  // en qué `objects/xx` caerá el commit del control y el resultado no depende del reloj.
  const env = {
    ...process.env, GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@b.test', GIT_COMMITTER_NAME: 'a',
    GIT_COMMITTER_EMAIL: 'a@b.test', GIT_AUTHOR_DATE: '2026-09-29T12:00:00Z', GIT_COMMITTER_DATE: '2026-09-29T12:00:00Z',
  };
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8', env });
  assert.equal(git('init', '-q').status, 0);
  assert.equal(git('commit', '-q', '--allow-empty', '-m', 'base').status, 0);
  // El árbol ya existe; lo único que el segundo commit tiene que escribir es el objeto COMMIT. Cada
  // `objects/xx` que aún no existe pasa a ser un FICHERO: el temporal no se puede crear ahí y git
  // cae con «failed to write commit object», la firma del rojo de `main` del 29-sep (caso 4).
  const objetos = path.join(dir, '.git', 'objects');
  for (let i = 0; i < 256; i++) {
    const xx = path.join(objetos, i.toString(16).padStart(2, '0'));
    if (!fs.existsSync(xx)) fs.writeFileSync(xx, '');
  }
  const hijo = [
    `import { gitDeFixture } from ${JSON.stringify(FIXTURE)};`,
    `try { gitDeFixture(['commit','-q','--allow-empty','-m','control 1281'], { cwd: ${JSON.stringify(dir)}, env: process.env }); console.log('NO-CAYO'); }`,
    `catch (e) { console.log(e.message.startsWith(${JSON.stringify(FIRMA_1281)}) ? 'MENSAJE-MARCADO' : 'MENSAJE-SIN-MARCA'); }`,
  ].join('\n');
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', hijo], { encoding: 'utf8', env });
  assert.equal(r.stdout.trim(), 'MENSAJE-MARCADO', `el control no reprodujo la firma: stdout=${r.stdout} stderr=${r.stderr}`);
  const lineas = r.stderr.split('\n').filter((l) => l.startsWith(FIRMA_1281));
  assert.equal(lineas.length, 1, `el marcador tiene que salir en UNA línea propia de stderr:\n${r.stderr}`);
  assert.match(lineas[0], /git commit perdió un fichero bajo \.git\/objects/);
  assert.match(lineas[0], /failed to write commit object/, 'el control tiene que caer con la firma REAL del caso 4');
});

test('SCRUM-1281 ③ la familia vive en su raíz propia; en CI, fuera de la /tmp compartida', () => {
  assert.equal(raizDeFixturesGit({ RUNNER_TEMP: '/home/runner/work/_temp' }), path.join('/home/runner/work/_temp', 'yaqu-fixtures-git'));
  assert.equal(raizDeFixturesGit({ YAQU_RAIZ_FIXTURES_GIT: '/otra', RUNNER_TEMP: '/x' }), '/otra');
  assert.equal(raizDeFixturesGit({}), path.join(os.tmpdir(), 'yaqu-fixtures-git'));

  const raiz = raizDeFixturesGit();
  assert.ok(repoFixture().startsWith(raiz + path.sep), `repoFixture() está fuera de ${raiz}`);
  // Aquí vivía un `if (process.env.RUNNER_TEMP …)` que solo aseveraba en CI: una comprobación que
  // solo asevera en un entorno no se comprueba en el otro (SCRUM-702 lo cazó). No hace falta: que
  // con `RUNNER_TEMP` la raíz cuelga de él lo prueba la primera línea, con el entorno INYECTADO, y
  // que `repoFixture()` vive en esa raíz lo prueba la de arriba, en cualquier máquina.
});

test('SCRUM-1281 ④ 🔴 la raíz propia NUNCA es el repositorio: `temporal()` lanza antes de crear nada', () => {
  // El censo de SCRUM-824 da por sano todo `temporal(…)` y todo `temporalDeFixtureGit(…)` sin mirar
  // sus argumentos. Con `dentroDe` —y con `YAQU_RAIZ_FIXTURES_GIT`, que es una variable de entorno y
  // puede valer cualquier cosa— esa confianza hay que sujetarla POR EFECTO, o es una frase.
  const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const enElArbol = path.join(RAIZ, 'tests', 'no-debe-existir-1281');
  assert.equal(fs.existsSync(enElArbol), false, 'el banco está sucio: el directorio de la prueba ya existe');

  assert.throws(() => temporal('caso-1281-', { dentroDe: enElArbol }), /DENTRO del repositorio/,
    '🔴 `temporal()` acepta crear dentro del árbol: es el defecto de SCRUM-824, y el censo lo daría por sano');
  assert.throws(() => temporal('caso-1281-', { dentroDe: RAIZ }), /DENTRO del repositorio/,
    '🔴 `temporal()` acepta la propia raíz del repositorio como sitio');

  // Y por la puerta de la familia: la variable de entorno apuntando al árbol.
  const antes = process.env.YAQU_RAIZ_FIXTURES_GIT;
  process.env.YAQU_RAIZ_FIXTURES_GIT = enElArbol;
  try {
    assert.throws(() => temporalDeFixtureGit('caso-1281-'), /DENTRO del repositorio/,
      '🔴 `temporalDeFixtureGit()` no pasa por la negativa de `temporal()`: el censo lo da por sano '
      + 'por su NOMBRE, y esto es lo único que sujeta ese nombre');
  } finally {
    if (antes === undefined) delete process.env.YAQU_RAIZ_FIXTURES_GIT;
    else process.env.YAQU_RAIZ_FIXTURES_GIT = antes;
  }
  assert.equal(fs.existsSync(enElArbol), false, '🔴 lanzó, pero DESPUÉS de crear el directorio en el árbol');

  // LA MITAD QUE ABSUELVE: fuera del árbol sí crea. Sin esto, un `temporal()` que lanzara siempre
  // con `dentroDe` también pasaría lo de arriba.
  const fuera = temporal('caso-1281-', { dentroDe: path.join(os.tmpdir(), 'yaqu-1281-control') });
  assert.equal(fs.existsSync(fuera), true, '🔴 con una raíz de fuera del árbol no ha creado nada');
  assert.equal(caeEnElArbol(fuera), false);
  assert.equal(caeEnElArbol(path.join(RAIZ, 'tests')), true);
  // Un vecino con el mismo prefijo de nombre no es el árbol: un prefijo no es un nombre.
  assert.equal(caeEnElArbol(RAIZ + '-otro'), false, '🔴 confunde un directorio VECINO con el repositorio');
});
