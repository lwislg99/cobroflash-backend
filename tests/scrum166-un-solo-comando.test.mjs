import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'));
const doc = fs.readFileSync(path.join(raiz, 'docs', 'QA', 'SUITE_REGRESION.md'), 'utf8');

/**
 * SCRUM-166 — UN NOMBRE POR COSA.
 *
 * Convivían `test:staging` (la tanda vieja, que NO gateaba) y `test:staging:gated` (el runner
 * de SCRUM-157). Dos comandos parecidos para lo mismo es cómo se acaba tecleando el que no
 * toca — y el que sonaba a "la tanda de staging" era justo el que dejaba fuera `a55` y
 * `bot-suite`, que contaban como cobertura sin ejecutarse nunca.
 */

test('SCRUM-166: `test:staging` ES el runner gateado', () => {
  const cmd = pkg.scripts['test:staging'];
  assert.ok(cmd, 'desaparece test:staging: es el comando que la gente teclea');
  assert.match(
    cmd, /scripts\/test-staging-gated\.mjs/,
    'test:staging vuelve a lanzar `node --test` a pelo: eso NO exporta A55_DB_TEST ni BOT_SUITE_TEST, y esos dos ficheros dejan de ejecutarse sin que nada lo diga'
  );
});

test('SCRUM-166: no vuelve el segundo nombre', () => {
  assert.equal(
    pkg.scripts['test:staging:gated'], undefined,
    'reaparece test:staging:gated: dos comandos para lo mismo es cómo se teclea el que no toca'
  );
});

test('SCRUM-166: las variables las pone el RUNNER, no el shell', () => {
  // `npm` lanza los scripts con cmd.exe en Windows, así que un `VAR=1 node ...` inline (sintaxis
  // POSIX) se rompe en la máquina del carril B. El runner las exporta desde JS vía el `env` de
  // spawnSync, y por eso es cross-platform. Al runbook: variables en JS ganan a variables en shell.
  const cmd = pkg.scripts['test:staging'];
  assert.doesNotMatch(
    cmd, /\b[A-Z_]+=[^ ]+ +node/,
    'vuelve una variable inline en el script de npm: sintaxis POSIX que cmd.exe no entiende'
  );
});

test('SCRUM-166: el doc no apunta a un comando que ya no existe', () => {
  // El fallo que llevamos el día entero cazando: documentación que nombra algo inexistente.
  assert.doesNotMatch(
    doc, /npm run test:staging:gated/,
    'SUITE_REGRESION.md sigue mandando ejecutar un script que se ha eliminado'
  );
  assert.match(doc, /npm run test:staging\b/, 'el doc debe nombrar el comando que SÍ existe');
});

test('SCRUM-166: el runner que el comando invoca existe de verdad', () => {
  // Guarda de presencia: sin esto, los asserts de arriba pasarían con un script que apunta a
  // un fichero borrado — que es exactamente la clase de divergencia que este ticket cierra.
  assert.ok(
    fs.existsSync(path.join(raiz, 'scripts', 'test-staging-gated.mjs')),
    'el script al que apunta test:staging no existe'
  );
});
