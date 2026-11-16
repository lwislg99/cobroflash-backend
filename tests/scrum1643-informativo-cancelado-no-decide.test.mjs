// tests/scrum1643-informativo-cancelado-no-decide.test.mjs — SCRUM-1643
//
// Medido por S5 (equipo de Luis): en #3015 (run 41099403956, commit 3527028a3) el obligatorio y el
// meta-guard salieron en success, y «constancia del ALTER (informativo)» —`continue-on-error` en
// `ci.yml`— acabó sus 9 pasos en success y se cerró `cancelled`. El run salió `cancelled`, y
// `veredictoDeCommit` daba CIEGO, «sin probar: constancia del ALTER cancelled». Un job que por diseño
// no decide estaba decidiendo el commit.
//
// El arreglo cambia la clasificación de UN tipo de job: el informativo (leído de `ci.yml`, no de una
// lista a mano) que acaba sin veredicto (cancelled/skipped). No relaja nada más: su `failure` sigue
// ROJO, y el obligatorio, el meta-guard (y sus partes) y el trinquete cancelados siguen CIEGO.
//
// Los jobs son los REALES del run, bajados con `gh api` (docs/master/evidencias/SCRUM-1643/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  veredictoDeCommit, jobsInformativosDelCI, sueloPorCommit, JOBS_DEL_CI, JOB_OBLIGATORIO, JOB_META_GUARD,
} from '../scripts/vigia-silencio-de-main.mjs';

// Lo que tiene que tumbar a este fichero (las corre el meta-guard con `aplicarUna`).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El defecto del ticket: el informativo sin veredicto vuelve a contar como «sin probar».
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: "j.conclusion !== 'success') && !informativosApartados.includes(j));",
    a: "j.conclusion !== 'success'));",
    cae: 'con los informativos de ci.yml, el run real sale VERDE y lo dice',
  },
  {
    // Un obligatorio o un meta-guard con `continue-on-error` dejaría de decidir.
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: '  && j.name !== JOB_OBLIGATORIO && j.name !== JOB_META_GUARD\n',
    a: '',
    cae: 'CONTROL: un informativo no decide; uno obligatorio sí',
  },
  {
    // Un lector sin sangría coge el `continue-on-error` de un PASO y hace informativo al obligatorio.
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: 'if (/^ {4}continue-on-error:',
    a: 'if (/^\\s+continue-on-error:',
    cae: 'los informativos se LEEN de ci.yml',
  },
  {
    // Cualquier run `cancelled` cuadraría, aunque no se cancelara ningún informativo.
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: "(run.conclusion === 'cancelled' && informativosApartados.some((j) => j.conclusion === 'cancelled'));",
    a: "run.conclusion === 'cancelled';",
    cae: 'CONTROL: un informativo no decide; uno obligatorio sí',
  },
];

const raiz = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const REAL = JSON.parse(readFileSync(raiz('docs/master/evidencias/SCRUM-1643/run-41099403956.json'), 'utf8'));
const CI_YML = readFileSync(raiz('.github/workflows/ci.yml'), 'utf8');
const INFORMATIVOS = jobsInformativosDelCI(CI_YML);
const CONSTANCIA = 'constancia del ALTER (informativo)';
const VIGIA = 'vigía del despliegue (informativo)';
const TRINQUETE = 'trinquete · ningún test nuevo mide la zona de la máquina';

const juez = (jobs, { run = REAL.run, informativos = INFORMATIVOS } = {}) => veredictoDeCommit({
  sha: REAL.sha, run, jobs, ahora: '2026-11-12T12:00:00Z', topeMin: 130, informativos,
});
const con = (nombre, conclusion) => REAL.jobs.map((j) => (j.name === nombre ? { ...j, conclusion } : j));

test('SCRUM-1643 · el dato real es lo que dice el ticket (si no, el resto no prueba nada)', () => {
  assert.equal(REAL.sha, '3527028a3388de64c5e2429cb0d19d665e768473');
  assert.deepEqual([REAL.run.status, REAL.run.conclusion, REAL.run.event], ['completed', 'cancelled', 'push']);
  assert.equal(REAL.jobs.length, 9, 'los 9 jobs del run');
  const c = REAL.jobs.find((j) => j.name === CONSTANCIA);
  assert.deepEqual([c.status, c.conclusion], ['completed', 'cancelled']);
  assert.ok(c.steps.length > 0 && c.steps.every((s) => s.conclusion === 'success'), 'todos sus pasos en success');
  const otros = REAL.jobs.filter((j) => j.name !== CONSTANCIA);
  assert.deepEqual([...new Set(otros.map((j) => j.conclusion))], ['success'], 'los otros 8, en success');
  assert.ok(otros.some((j) => j.name === JOB_OBLIGATORIO) && otros.some((j) => j.name === JOB_META_GUARD));
});

test('SCRUM-1643 · los informativos se LEEN de ci.yml: los dos de job con continue-on-error, y ni el obligatorio ni el meta-guard', () => {
  assert.deepEqual([...INFORMATIVOS].sort(), [CONSTANCIA, VIGIA].sort(), JSON.stringify(INFORMATIVOS));
  // El obligatorio tiene `continue-on-error` en PASOS (8 espacios): un lector que no mire la sangría lo cazaría.
  assert.match(CI_YML, /^ {8}continue-on-error: true/m, 'control positivo: ci.yml tiene continue-on-error de paso');
  for (const n of [JOB_OBLIGATORIO, JOB_META_GUARD, TRINQUETE]) assert.ok(!INFORMATIVOS.includes(n), n);
  assert.ok(INFORMATIVOS.every((n) => JOBS_DEL_CI.includes(n)), 'todo informativo es un job que el vigía ya exige');
  // Sembrado: el lector ve un informativo nuevo, y no uno de paso, ni uno con `false`.
  const sembrado = 'jobs:\n  a:\n    name: uno (informativo)\n    continue-on-error: true\n  b:\n    name: dos\n    steps:\n      - run: x\n        continue-on-error: true\n  c:\n    name: "tres"\n    continue-on-error: false\non:\n  x:\n    name: fuera\n    continue-on-error: true\n';
  assert.deepEqual(jobsInformativosDelCI(sembrado), ['uno (informativo)']);
  assert.deepEqual(jobsInformativosDelCI(sembrado.replace(/\n/g, '\r\n')), ['uno (informativo)'], 'también con CRLF');
  assert.deepEqual(jobsInformativosDelCI(''), [], 'sin ci.yml: ninguno, y nada se aparta');
});

test('SCRUM-1643 · ROJO PRIMERO: sin informativos, el run real sale CIEGO «sin probar» (lo que medía el ticket)', () => {
  const v = juez(REAL.jobs, { informativos: [] });
  assert.equal(v.estado, 'CIEGO');
  assert.equal(v.motivo, `sin probar: «${CONSTANCIA}» cancelled`);
  assert.equal(v.causa, null);
});

test('SCRUM-1643 · con los informativos de ci.yml, el run real sale VERDE y lo dice', () => {
  const v = juez(REAL.jobs);
  assert.equal(v.estado, 'VERDE', v.motivo);
  assert.match(v.motivo, /^8 jobs en success · informativo sin veredicto, no decide: «constancia del ALTER \(informativo\)» cancelled$/);
});

test('SCRUM-1643 · CONTROL: un informativo no decide; uno obligatorio sí', () => {
  // El obligatorio, el meta-guard, una parte del meta-guard y el trinquete cancelados: CIEGO.
  for (const n of [JOB_OBLIGATORIO, JOB_META_GUARD, 'meta-guard · parte 2 de 3', TRINQUETE]) {
    assert.ok(REAL.jobs.some((j) => j.name === n), `el job ${n} está en el run real`);
    const v = juez(con(n, 'cancelled'));
    assert.equal(v.estado, 'CIEGO', `${n}: ${v.motivo}`);
  }
  // Y aunque alguien pusiera `continue-on-error` al obligatorio o al meta-guard, siguen decidiendo.
  for (const n of [JOB_OBLIGATORIO, JOB_META_GUARD]) {
    const v = juez(con(n, 'cancelled'), { informativos: [...INFORMATIVOS, n] });
    assert.equal(v.estado, 'CIEGO', `${n} declarado informativo: ${v.motivo}`);
  }
  // Un informativo en `failure` sigue ROJO: sólo se aparta su «sin veredicto».
  assert.equal(juez(con(CONSTANCIA, 'failure')).estado, 'ROJO');
  // El otro informativo cancelado, también: VERDE, nombrando los dos.
  const dos = juez(con(VIGIA, 'cancelled'));
  assert.equal(dos.estado, 'VERDE', dos.motivo);
  assert.match(dos.motivo, /«vigía del despliegue \(informativo\)» cancelled, «constancia del ALTER \(informativo\)» cancelled/);
  // Un run `failure` con todo en success no cuadra, aparte informativos o no.
  assert.equal(juez(REAL.jobs, { run: { ...REAL.run, conclusion: 'failure' } }).estado, 'CIEGO');
  // Un run `cancelled` sin ningún informativo cancelado tampoco cuadra.
  const todoVerde = con(CONSTANCIA, 'success');
  assert.equal(juez(todoVerde).estado, 'CIEGO');
  assert.equal(juez(todoVerde, { run: { ...REAL.run, conclusion: 'success' } }).estado, 'VERDE');
});

test('SCRUM-1643 · el suelo reconoce los cebos del informativo, y un juez que no los aparta no pasa', () => {
  const s = sueloPorCommit();
  assert.equal(s.ok, true, s.detalle);
  assert.equal(s.estado['cebo-informativo-no-decide'], 'VERDE');
  assert.equal(s.estado['cebo-informativo-sin-declarar'], 'CIEGO');
  assert.equal(s.estado['cebo-obligatorio-declarado-informativo'], 'CIEGO');
  // El juez de antes de SCRUM-1643 (ignora `informativos`) no pasa el suelo.
  const deAntes = (e) => veredictoDeCommit({ ...e, informativos: [] });
  assert.equal(sueloPorCommit(deAntes).ok, false, 'un juez que no aparta informativos tiene que salir del suelo');
  // Ni uno que los aparta todos.
  const todoInformativo = (e) => veredictoDeCommit({ ...e, informativos: JOBS_DEL_CI });
  assert.equal(sueloPorCommit(todoInformativo).ok, false);
});
