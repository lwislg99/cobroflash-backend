// tests/scrum1289-por-que-cayo.test.mjs — SCRUM-1289
//
// El «por qué cayó» del check obligatorio leía un TAP roto y callaba: se leía como «no cayó nada».
// Lo que se vigila aquí son las dos maneras de volver a eso:
//   1. que el diagnóstico se fíe de un TAP ilegible (NUL, sin resumen, dos resúmenes, o un
//      `fail N` sin un solo `not ok`) y diga «nada» en vez de «no supe mirar»;
//   2. que el hijo que lo rompía vuelva a heredar los reporters de la tanda.
// Y lo que no puede pasar nunca: que este paso ponga en rojo el job obligatorio.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  integridadTap, diagnostico, informe, lineaDeIntegridad, VEREDICTO,
} from '../scripts/equipo/por-que-cayo.mjs';

const RAIZ = path.join(import.meta.dirname, '..');
const GUION = path.join(RAIZ, 'scripts', 'equipo', 'por-que-cayo.mjs');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/equipo/por-que-cayo.mjs',
    de: '  if (nul > 0) {',
    a: '  if (false) {',
    cae: 'un TAP con NUL es ILEGIBLE',
  },
  {
    fichero: 'scripts/equipo/por-que-cayo.mjs',
    de: '  if (tests.length > 1) return',
    a: '  if (false) return',
    cae: 'dos resúmenes en un TAP',
  },
  {
    fichero: 'scripts/equipo/por-que-cayo.mjs',
    de: '  if (nFail > 0 && notOk === 0) {',
    a: '  if (false) {',
    cae: 'fail N sin un solo `not ok`',
  },
  {
    fichero: 'tests/scrum976-guards-entrada-con-techo.test.mjs',
    de: '  delete env.NODE_OPTIONS;\n',
    a: '\n',
    cae: 'el hijo de scrum976 no hereda los reporters',
  },
  {
    fichero: '.github/workflows/ci.yml',
    de: '          set -o pipefail\n          npm test 2>&1 | tee',
    a: '          npm test 2>&1 | tee',
    cae: 'el paso de la tanda deja el log spec en fichero SIN perder su código de salida',
  },
  {
    fichero: '.github/workflows/ci.yml',
    de: '"${{ runner.temp }}/tanda-spec.log" || true',
    a: '"${{ runner.temp }}/tanda-spec.log"',
    cae: 'el diagnóstico no puede poner el job en rojo',
  },
];

// ── Un TAP con la FORMA medida del roto: cabeza de otra tanda, tramo de NUL, cola del padre ─────
const TAP_SANO_VERDE = 'TAP version 13\nok 1 - a\n1..1\n# tests 1\n# pass 1\n# fail 0\n';
const TAP_SANO_ROJO = 'TAP version 13\nok 1 - a\nnot ok 2 - tests/b.test.mjs\n  ---\n  exitCode: 1\n  signal: ~\n  ...\n1..2\n# tests 2\n# pass 1\n# fail 1\n';
const cabezaAjena = 'TAP version 13\nok 1 - public/ · x\n1..1\n# tests 1\n# pass 1\n# fail 0\n';
const TAP_ROTO = Buffer.concat([Buffer.from(cabezaAjena), Buffer.alloc(4096), Buffer.from('ok 88 - z\n1..88\n# tests 88\n# fail 1\n')]);
const SPEC_ROJO = 'ℹ tests 88\nℹ fail 1\n\n✖ failing tests:\n\n✖ SCRUM-1 · lo que cae (3ms)\n  AssertionError: motivo\n      at x (node:internal)\n';

test('SCRUM-1289 · 🔴 CONTROL POSITIVO: un TAP con NUL es ILEGIBLE, y dice cuánto y desde dónde', () => {
  const i = integridadTap(TAP_ROTO);
  assert.equal(i.ok, false);
  assert.match(i.motivo, /4096 bytes NUL/);
  assert.match(i.motivo, new RegExp(`desde el byte ${Buffer.byteLength(cabezaAjena)}`));
});

test('SCRUM-1289 · 🔴 dos resúmenes en un TAP = dos tandas en el mismo fichero: ILEGIBLE', () => {
  // Es la forma que da el defecto en Windows (reproducido): el hijo trunca antes de que el padre
  // escriba mucho, y no queda NUL. Solo se ve contando resúmenes.
  const i = integridadTap(Buffer.from(cabezaAjena + TAP_SANO_VERDE));
  assert.equal(i.ok, false);
  assert.match(i.motivo, /2 resúmenes/);
});

test('SCRUM-1289 · 🔴 fail N sin un solo `not ok` en el TAP: ILEGIBLE, nunca «no cayó nada»', () => {
  const i = integridadTap(Buffer.from('TAP version 13\nok 1 - a\n# tests 2\n# fail 1\n'));
  assert.equal(i.ok, false);
  assert.match(i.motivo, /fail 1 y no hay ni un `not ok`/);
});

test('SCRUM-1289 · sin resumen o vacío: ILEGIBLE (la tanda no terminó)', () => {
  assert.equal(integridadTap(Buffer.from('TAP version 13\nok 1 - a\n')).ok, false);
  assert.equal(integridadTap(Buffer.alloc(0)).ok, false);
  assert.equal(integridadTap(null).ok, false);
});

test('SCRUM-1289 · ✅ CONTROL NEGATIVO: un TAP sano se lee, y sus `not ok` salen con exitCode', () => {
  assert.equal(integridadTap(Buffer.from(TAP_SANO_VERDE)).ok, true);
  const d = diagnostico({ tap: Buffer.from(TAP_SANO_ROJO), spec: null });
  assert.equal(d.veredicto, VEREDICTO.CAYERON);
  assert.equal(d.fuente, 'TAP');
  assert.ok(d.lineas.some((l) => l.includes('exitCode: 1')), '🔴 lo que el log `spec` no dice es justo lo que aporta el TAP');
});

test('SCRUM-1289 · 🔴 TAP ilegible → va al log spec, y el aviso de que no pudo leer el TAP NO se pierde', () => {
  const d = diagnostico({ tap: TAP_ROTO, spec: Buffer.from(SPEC_ROJO) });
  assert.equal(d.veredicto, VEREDICTO.CAYERON);
  assert.equal(d.fuente, 'log spec');
  assert.ok(d.lineas.some((l) => l.includes('✖ SCRUM-1 · lo que cae')));
  assert.ok(!d.lineas.some((l) => /^\s+at /.test(l)), 'las pilas no aportan y entierran el motivo');
  assert.match(informe(d), /NO SUPE LEER EL TAP/);
});

test('SCRUM-1289 · 🔴 las tres salidas NO se confunden: cayeron, sin fallos, no supe mirar', () => {
  const cayeron = diagnostico({ tap: Buffer.from(TAP_SANO_ROJO), spec: null });
  const limpio = diagnostico({ tap: Buffer.from(TAP_SANO_VERDE), spec: null });
  const ciego = diagnostico({ tap: TAP_ROTO, spec: Buffer.from('ℹ tests 3\n') });
  const sinNada = diagnostico({ tap: null, spec: null });
  assert.equal(cayeron.veredicto, VEREDICTO.CAYERON);
  assert.equal(limpio.veredicto, VEREDICTO.SIN_FALLOS);
  assert.equal(ciego.veredicto, VEREDICTO.NO_SUPE_MIRAR);
  assert.equal(sinNada.veredicto, VEREDICTO.NO_SUPE_MIRAR);
  const textos = [informe(cayeron), informe(limpio), informe(ciego)];
  assert.equal(new Set(textos).size, 3);
  assert.match(informe(limpio), /NO TIENE FALLOS/);
  assert.match(informe(ciego), /NO SUPE MIRAR: esto NO quiere decir que no cayera nada/);
});

test('SCRUM-1289 · 🔴 el diagnóstico SALE 0 aunque no haya ficheros; la integridad sale 1 si no puede leer', () => {
  const env = { ...process.env };
  delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT; delete env.FORCE_COLOR;
  const noHay = path.join(RAIZ, 'no-existe-scrum1289.tap');
  const d = spawnSync(process.execPath, [GUION, noHay, noHay], { encoding: 'utf8', env });
  assert.equal(d.status, 0, `🔴 el diagnóstico tumbaría el job obligatorio:\n${d.stdout}${d.stderr}`);
  assert.match(d.stdout, /NO SUPE MIRAR/);
  const i = spawnSync(process.execPath, [GUION, '--integridad', noHay], { encoding: 'utf8', env });
  assert.equal(i.status, 1, '🔴 un «no pude mirar» del paso informativo NUNCA sale en verde');
  assert.equal(lineaDeIntegridad(Buffer.from(TAP_SANO_VERDE)).codigo, 0);
});

test('SCRUM-1289 · 🔴 el hijo de scrum976 no hereda los reporters de la tanda (`NODE_OPTIONS`)', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'tests', 'scrum976-guards-entrada-con-techo.test.mjs'), 'utf8');
  const lanzar = src.slice(src.indexOf('function lanzar('), src.indexOf('spawnSync(', src.indexOf('function lanzar(')));
  assert.match(lanzar, /delete env\.NODE_OPTIONS;/,
    '🔴 `guards-entrada.mjs` lanza `node --test`: con los reporters heredados, TRUNCA el TAP de la tanda');
});

// ── ci.yml ──────────────────────────────────────────────────────────────────────────────────────
const CI = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'ci.yml'), 'utf8');
function paso(nombre) {
  const i = CI.indexOf(`      - name: ${nombre}`);
  assert.notEqual(i, -1, `🔴 CIEGO: no encuentro el paso «${nombre}» en ci.yml`);
  const j = CI.indexOf('\n      - ', i + 10);
  return CI.slice(i, j === -1 ? undefined : j);
}

test('SCRUM-1289 · 🔴 el paso de la tanda deja el log spec en fichero SIN perder su código de salida', () => {
  const p = paso('Tests (incluidos los de banco desechable)');
  assert.match(p, /set -o pipefail\n\s+npm test 2>&1 \| tee "\$RUNNER_TEMP\/tanda-spec\.log"/,
    '🔴 sin `pipefail`, el código de salida es el de `tee` y una tanda roja sale VERDE (SCRUM-850)');
  assert.match(p, /--test-reporter=tap --test-reporter-destination=\$\{\{ runner\.temp \}\}\/tanda\.tap/);
});

test('SCRUM-1289 · 🔴 el diagnóstico no puede poner el job en rojo, y lee las DOS fuentes', () => {
  const p = paso('Por qué cayó (sólo si la tanda falla)');
  assert.match(p, /if: failure\(\)/);
  assert.match(p, /por-que-cayo\.mjs "\$\{\{ runner\.temp \}\}\/tanda\.tap" "\$\{\{ runner\.temp \}\}\/tanda-spec\.log" \|\| true/);
  const i = paso('¿Se puede leer el TAP de la tanda? (informativo)');
  assert.match(i, /if: always\(\)/);
  assert.match(i, /continue-on-error: true/);
  assert.match(i, /set -o pipefail/, '🔴 sin `pipefail` el `tee` se come el 1 y un TAP roto sale verde');
});
