// tests/scrum935b-main-no-cancela.test.mjs — SCRUM-935 (opción B, decisión del comentario 16227)
//
// En una rama de PR, los commits intermedios son borradores: un push nuevo cancela el CI anterior.
// En `main` cada commit es un estado YA desplegado: cancelarlo no ahorra trabajo, decide que ese
// estado no se comprueba nunca (38 de 44 runs cancelados en 5 h, 87 % el 21-sep).
//
// Lo que fija este fichero es la CONFIGURACIÓN de `concurrency` de ci.yml, evaluada sobre los dos
// únicos refs en los que corre (A23·5: no busca un texto, evalúa la expresión):
//   · `refs/heads/main`      → NO cancela.
//   · `refs/pull/<n>/merge`  → SIGUE cancelando, y el grupo sigue siendo por ref.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const CI = fs.readFileSync(path.join(RAIZ, '.github/workflows/ci.yml'), 'utf8');

// Sin comentarios (A23·2/3): por líneas, con `\r?\n`, y sin `.*$` sobre el fichero entero.
const LINEAS = CI.split(/\r?\n/)
  .map((l) => l.replace(/^\s*#.*$/, '').replace(/\s+#.*$/, ''))
  .filter((l) => l.trim() !== '');

function bloque(nombre) {
  const i = LINEAS.findIndex((l) => l === `${nombre}:`);
  if (i < 0) return null;
  const dentro = [];
  for (let j = i + 1; j < LINEAS.length && /^\s/.test(LINEAS[j]); j++) dentro.push(LINEAS[j].trim());
  return dentro;
}

function clave(lineas, nombre) {
  const l = lineas.find((x) => x.startsWith(`${nombre}:`));
  return l === undefined ? null : l.slice(nombre.length + 1).trim();
}

// Evalúa `cancel-in-progress` para un ref. Una forma que no sabe evaluar NO es un verde: lanza.
function cancela(valor, ref) {
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  const m = valor.match(/^\$\{\{\s*github\.ref\s*(==|!=)\s*'([^']+)'\s*\}\}$/);
  assert.ok(m, `🔴 no sé evaluar cancel-in-progress: «${valor}». Un guard que no puede mirar no da verde.`);
  return m[1] === '==' ? ref === m[2] : ref !== m[2];
}

const REF_MAIN = 'refs/heads/main';
const REF_PR = 'refs/pull/1234/merge';

const CONC = bloque('concurrency');
const CANCELA = CONC === null ? null : clave(CONC, 'cancel-in-progress');
const GRUPO = CONC === null ? null : clave(CONC, 'group');

test('SCRUM-935b · 🔴 SUELO: el bloque `concurrency` se lee de verdad', () => {
  assert.ok(CI.length > 2000, `🔴 CIEGO: ci.yml tiene ${CI.length} bytes.`);
  assert.ok(CONC !== null && CONC.length >= 2, '🔴 no encuentro el bloque `concurrency:` de ci.yml.');
  assert.ok(CANCELA !== null && GRUPO !== null,
    `🔴 al bloque le falta group (${GRUPO}) o cancel-in-progress (${CANCELA}).`);
});

test('SCRUM-935b · POBLACIÓN: ci.yml solo corre en PR y en push a main (los dos refs de abajo son todos)', () => {
  assert.ok(LINEAS.includes('  pull_request:') && LINEAS.includes('  push:'), '🔴 cambiaron los eventos de ci.yml.');
  const ramas = LINEAS.filter((l) => /^\s+branches:/.test(l)).map((l) => l.trim());
  assert.deepEqual(ramas, ['branches: [main]', 'branches: [main]'],
    '🔴 ci.yml corre ahora sobre otras ramas: este guard tendría que evaluar también sus refs.');
});

test('SCRUM-935b · 🔴 ROJO: en `main` el CI NO se cancela (cada commit de main está desplegado)', () => {
  assert.equal(cancela(CANCELA, REF_MAIN), false,
    `🔴 cancel-in-progress = «${CANCELA}» cancela el CI de main: el estado desplegado no se comprueba nunca (SCRUM-935).`);
});

test('SCRUM-935b · POSITIVO: en una rama de PR un push nuevo SIGUE cancelando al anterior', () => {
  assert.equal(cancela(CANCELA, REF_PR), true,
    `🔴 cancel-in-progress = «${CANCELA}» ya no cancela en PR: cada push apilaría un CI completo (~11 min).`);
  // El grupo debe ser POR REF: con `sha`/`run_id` cada run sería su propio grupo y nada cancelaría.
  assert.ok(GRUPO.includes('${{ github.ref }}'), `🔴 el grupo «${GRUPO}» ya no es por ref.`);
  assert.doesNotMatch(GRUPO, /github\.(sha|run_id|run_number|run_attempt)/,
    `🔴 el grupo «${GRUPO}» es único por run: en un PR nada se cancelaría nunca.`);
});

test('SCRUM-935b · CONTROL del instrumento: el evaluador ve el defecto si vuelve (mecanismo, A23·12)', () => {
  // El valor de ANTES del arreglo, evaluado: debe dar «cancela en main». Si diera false, el rojo de
  // arriba no podría caer nunca.
  assert.equal(cancela('true', REF_MAIN), true);
  assert.equal(cancela("${{ github.ref != 'refs/heads/main' }}", REF_MAIN), false);
  assert.equal(cancela("${{ github.ref != 'refs/heads/main' }}", REF_PR), true);
  assert.equal(cancela("${{ github.ref == 'refs/heads/main' }}", REF_MAIN), true);
  assert.throws(() => cancela("${{ github.event_name == 'push' }}", REF_MAIN), /no sé evaluar/);
});
