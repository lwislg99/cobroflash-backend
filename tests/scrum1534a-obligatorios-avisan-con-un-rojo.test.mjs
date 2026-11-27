// tests/scrum1534a-obligatorios-avisan-con-un-rojo.test.mjs — SCRUM-1534a
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// Decisión del fundador (SCRUM-1534 c.22933) y reparto del orquestador (c.22944, punto d): en el
// modo RACHAS de `scripts/vigia-silencio-de-main.mjs`, un check OBLIGATORIO de `main` (los que el
// vigía lee del ruleset y pasa en `veredicto({ obligatorios })`) avisa con UN rojo. Los demás jobs
// siguen avisando con `UMBRAL_ROJOS_SEGUIDOS` seguidos. Antes, la línea `!f.obligatorio` les quitaba
// el aviso de rojo: «guards de navegador», obligatorio hoy, tuvo una racha de 72 rojos (medida el 2026-11-27 sobre origin/main 600aafc43, SCRUM-1534 c.22940)
// en `main` entre el 16 y el 27-nov, de la que este modo no podía avisar.
//
// Banco: historiales sembrados en memoria con la forma de `leerHistorial` (sin red, sin fixture).
// Los nombres de job son los REALES de `JOBS_DE_MAIN`, y los obligatorios, los dos que el ruleset
// devolvió el 27-nov-2026 (medido en el registro, docs/master/SCRUM-1534.md).
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  veredicto, informe, JOBS_DE_MAIN, UMBRAL_ROJOS_SEGUIDOS, SALIDA_OK, SALIDA_AVISO, SALIDA_CIEGO,
} from '../scripts/vigia-silencio-de-main.mjs';

const BUILD = 'build + tests (con banco desechable)';
const NAVEGADOR = 'guards de navegador (fuera de la tanda)';
const META = 'meta-guard · los guards caen cuando deben';
const OBLIGATORIOS = [BUILD, NAVEGADOR];
const DE_CI = JOBS_DE_MAIN.filter((j) => j.workflow === 'CI').map((j) => j.job);

const t = (i) => new Date(Date.UTC(2026, 10, 27, 8, i)).toISOString();
/** `n` runs de CI en `main`, todo verde salvo lo que diga `rojos(i)` → lista de jobs en failure. */
function historial(n, rojos = () => []) {
  return Array.from({ length: n }, (_, i) => ({
    workflow: 'CI', evento: 'push', creado: t(i), sha: `sha${String(i).padStart(5, '0')}`,
    jobs: Object.fromEntries(DE_CI.map((j) => [j, rojos(i).includes(j) ? 'failure' : 'success'])),
  }));
}
const mirar = (runs, obligatorios = OBLIGATORIOS) => veredicto({ runs, ahora: t(runs.length), obligatorios });
const salida = (v) => Number(informe(v, { ahora: 'x', origen: 'banco', poblacion: 'runs=…' }).split('\n').at(-1).replace('EXIT=', ''));
const avisosDe = (v) => v.avisos.map((f) => `${f.estado} · ${f.job}`);

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // M1 · volver a excluir los obligatorios del aviso de rojo (lo que había antes de SCRUM-1534a)
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: "(f.estado === 'ROJO-SOSTENIDO')",
    a: "(f.estado === 'ROJO-SOSTENIDO' && !f.obligatorio)",
    cae: '(a) UN rojo de «build + tests» en main avisa',
  },
  {
    // M1, el mismo cambio visto desde el otro obligatorio
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: "(f.estado === 'ROJO-SOSTENIDO')",
    a: "(f.estado === 'ROJO-SOSTENIDO' && !f.obligatorio)",
    cae: '(b) UN rojo de «guards de navegador» en main avisa',
  },
  {
    // M2 · racha 1 para todos los jobs, obligatorios o no
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: 'const umbralDeRojos = fila.obligatorio ? 1 : U.rojos;',
    a: 'const umbralDeRojos = 1;',
    cae: '(c) UN rojo del meta-guard, que no es obligatorio, no avisa',
  },
];

test('SCRUM-1534a · SUELO: el banco siembra lo que dice (todo verde = sin avisos y salida 0)', () => {
  const runs = historial(6);
  const v = mirar(runs);
  assert.equal(v.ciego, null);
  assert.equal(v.filas.length, JOBS_DE_MAIN.length);
  assert.equal(DE_CI.includes(BUILD) && DE_CI.includes(NAVEGADOR) && DE_CI.includes(META), true, 'los nombres sembrados son los de JOBS_DE_MAIN');
  assert.deepEqual(v.filas.filter((f) => f.obligatorio).map((f) => f.job).sort(), [...OBLIGATORIOS].sort());
  assert.deepEqual(avisosDe(v), []);
  assert.equal(salida(v), SALIDA_OK);
});

test('SCRUM-1534a · (a) UN rojo de «build + tests» en main avisa, y la fila dice qué job y qué sha', () => {
  const runs = historial(6, (i) => (i === 5 ? [BUILD] : []));
  const v = mirar(runs);
  assert.deepEqual(avisosDe(v), [`ROJO-SOSTENIDO · ${BUILD}`]);
  assert.equal(v.avisos[0].rojosSeguidos, 1);
  assert.match(v.avisos[0].ultima, /^failure · sha00005 · /);
  assert.match(v.avisos[0].motivo, /sha00005/);
  assert.equal(salida(v), SALIDA_AVISO);
});

test('SCRUM-1534a · (b) UN rojo de «guards de navegador» en main avisa, y la fila dice qué job y qué sha', () => {
  const runs = historial(6, (i) => (i === 5 ? [NAVEGADOR] : []));
  const v = mirar(runs);
  assert.deepEqual(avisosDe(v), [`ROJO-SOSTENIDO · ${NAVEGADOR}`]);
  assert.match(v.avisos[0].ultima, /^failure · sha00005 · /);
  assert.match(v.avisos[0].motivo, /sha00005/);
  assert.equal(salida(v), SALIDA_AVISO);
  // Lo mismo, con navegador fuera de la lista de obligatorios: vuelve a la racha y UN rojo calla.
  const comoAntes = mirar(runs, [BUILD]);
  assert.deepEqual(avisosDe(comoAntes), []);
  assert.equal(comoAntes.filas.find((f) => f.job === NAVEGADOR).estado, 'ROJO-RECIENTE');
});

test('SCRUM-1534a · (c) UN rojo del meta-guard, que no es obligatorio, no avisa hasta UMBRAL_ROJOS_SEGUIDOS', () => {
  const conRojos = (k) => mirar(historial(UMBRAL_ROJOS_SEGUIDOS + 1, (i) => (i > UMBRAL_ROJOS_SEGUIDOS - k ? [META] : [])));
  const uno = conRojos(1);
  assert.equal(uno.filas.find((f) => f.job === META).rojosSeguidos, 1);
  assert.equal(uno.filas.find((f) => f.job === META).estado, 'ROJO-RECIENTE');
  assert.deepEqual(avisosDe(uno), []);
  assert.equal(salida(uno), SALIDA_OK);
  // El borde sale de la constante: uno menos calla, el umbral avisa.
  const casi = conRojos(UMBRAL_ROJOS_SEGUIDOS - 1);
  assert.equal(casi.filas.find((f) => f.job === META).rojosSeguidos, UMBRAL_ROJOS_SEGUIDOS - 1);
  assert.deepEqual(avisosDe(casi), []);
  const justo = conRojos(UMBRAL_ROJOS_SEGUIDOS);
  assert.equal(justo.filas.find((f) => f.job === META).rojosSeguidos, UMBRAL_ROJOS_SEGUIDOS);
  assert.deepEqual(avisosDe(justo), [`ROJO-SOSTENIDO · ${META}`]);
  assert.equal(salida(justo), SALIDA_AVISO);
});

test('SCRUM-1534a · (d) un obligatorio en rojo y DESPUÉS en verde no avisa: manda el estado vigente', () => {
  const runs = historial(6, (i) => (i === 4 ? [BUILD, NAVEGADOR] : []));
  const v = mirar(runs);
  for (const job of OBLIGATORIOS) {
    const f = v.filas.find((x) => x.job === job);
    assert.equal(f.rojosSeguidos, 0, job);
    assert.equal(f.estado, 'VERDE', job);
  }
  assert.deepEqual(avisosDe(v), []);
  assert.equal(salida(v), SALIDA_OK);
  // Positivo del mismo banco: cortado en el run rojo, los dos avisan.
  assert.deepEqual(avisosDe(mirar(runs.slice(0, 5))).sort(), [`ROJO-SOSTENIDO · ${BUILD}`, `ROJO-SOSTENIDO · ${NAVEGADOR}`].sort());
});

test('SCRUM-1534a · (e) sin la lista de obligatorios (null) sigue CIEGO, también con un obligatorio en rojo', () => {
  const runs = historial(6, (i) => (i === 5 ? [BUILD] : []));
  const v = mirar(runs, null);
  assert.match(v.ciego, /obligatorios/);
  assert.deepEqual(v.filas, []);
  assert.deepEqual(v.avisos, []);
  assert.equal(salida(v), SALIDA_CIEGO);
});
