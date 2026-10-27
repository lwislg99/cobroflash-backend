// SCRUM-1295b · `carriles.mjs de` contesta TODAS las rutas que se le pasan. Antes leía sólo la primera y
// salía con 0: `de a b` callaba `b` con la misma cara que si `b` no tuviera nada que decir (familia «no
// pude mirar» = «no hay nada»). Y sin ruta no contesta: dice cómo se usa y sale con 2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(RAIZ, 'scripts', 'carriles.mjs');

// Los `node` hijos NO heredan el entorno de la tanda (SCRUM-1349).
const entorno = { ...process.env };
delete entorno.FORCE_COLOR; delete entorno.NODE_OPTIONS; delete entorno.NODE_TEST_CONTEXT;
const de = (...rels) => spawnSync(process.execPath, [CLI, 'de', ...rels.map((r) => path.join(RAIZ, r))], { cwd: RAIZ, env: entorno, encoding: 'utf8' });

// Dos rutas de dueños DISTINTOS: si se contestara dos veces la primera, el test lo ve.
const A = 'scripts/carriles.mjs';
const B = 'scripts/_censo-rango-del-parte.mjs';

test('SCRUM-1295b · `de a b` contesta las dos rutas, cada una con su dueño, y en el orden pedido', () => {
  const r = de(A, B);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const lineas = r.stdout.split(/\r?\n/).filter((l) => / → /.test(l));
  assert.equal(lineas.length, 2, `esperaba una respuesta por ruta:\n${r.stdout}`);
  assert.ok(lineas[0].startsWith(`${A} → S0 `), lineas[0]);
  assert.ok(lineas[1].startsWith(`${B} → S1 `), lineas[1]);
});

test('SCRUM-1295b · una sola ruta contesta lo mismo que antes (una línea con su dueño)', () => {
  const r = de(B);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const lineas = r.stdout.split(/\r?\n/).filter((l) => / → /.test(l));
  assert.deepEqual(lineas.map((l) => l.split(' → ')[0]), [B]);
});

test('SCRUM-1295b · `de` sin ruta NO contesta: dice cómo se usa y sale con 2', () => {
  const r = de();
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stdout, /NO-PUDE-MIRAR: uso: de <ruta>/);
  assert.doesNotMatch(r.stdout, / → /);
});
