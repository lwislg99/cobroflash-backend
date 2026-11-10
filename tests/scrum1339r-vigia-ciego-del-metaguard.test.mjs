// tests/scrum1339r-vigia-ciego-del-metaguard.test.mjs — SCRUM-1339r
//
// El vigía de `main` recoge el CIEGO del meta-guard (decisión del fundador, SCRUM-1339 c.20219, 2b):
// su job cortado o cancelado, o salido con 2 en el paso de las mutaciones, es CIEGO con causa propia,
// no ROJO. Sin red. Los casos se SIEMBRAN aquí con la forma que dio `main` del 19 al 21-oct (medido en
// 60 runs por push: 15 cortados a los 30 min y 3 salidos con 2, los 18 con «guards de navegador» en
// rojo al lado, y por eso hasta hoy el vigía los decía ROJO). Las anotaciones son las literales de dos
// jobs reales. Que `checks: read` deje leerlas en GitHub no se prueba aquí: es CIEGO declarado.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  veredictoDeCommit, accionDelIssue, marcaDeAviso, sueloPorCommit, conRun, topeDeCorridaDelCI,
  codigoDeSalidaDeAnotaciones, ciegoDelMetaGuard, JOBS_DEL_CI, JOB_META_GUARD, PASO_DEL_META_GUARD,
  SALIDA_CIEGO_DEL_META_GUARD, CAUSA_META_GUARD,
} from '../scripts/vigia-silencio-de-main.mjs';
import { SALIDA_CIEGO, SALIDA_MUDO } from '../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CI_YML = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'ci.yml'), 'utf8');
const VIGIA_YML = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'vigia-de-main.yml'), 'utf8');
const AHORA = '2026-10-22T09:00:00Z';
const TOPE = topeDeCorridaDelCI(CI_YML);
const NAVEGADOR = 'guards de navegador (fuera de la tanda)';
const job = (name, conclusion, extra = {}) => ({ name, status: 'completed', conclusion, ...extra });
const run = (conclusion) => ({ status: 'completed', conclusion, created_at: '2026-10-22T08:20:00Z', html_url: 'https://x/run' });
/** Los seis jobs del CI en success, con el meta-guard y los `otros` cambiados. */
const jobsCon = (metaGuard, otros = []) => [
  ...JOBS_DEL_CI.filter((n) => n !== JOB_META_GUARD && !otros.some((o) => o.name === n)).map((n) => job(n, 'success')),
  ...otros, metaGuard,
];
const mgFallo = (codigo, paso = PASO_DEL_META_GUARD) => job(JOB_META_GUARD, 'failure', { steps: [{ name: 'Compilar (tsc)', conclusion: paso === PASO_DEL_META_GUARD ? 'success' : 'failure' }, { name: PASO_DEL_META_GUARD, conclusion: paso === PASO_DEL_META_GUARD ? 'failure' : 'skipped' }], codigoDeSalida: codigo });
const mgCortado = () => job(JOB_META_GUARD, 'cancelled', { steps: [{ name: PASO_DEL_META_GUARD, conclusion: 'cancelled' }] });
const juzgar = (sha, jobs, concl = 'failure') => veredictoDeCommit({ sha, run: run(concl), jobs, ahora: AHORA, topeMin: TOPE });
const VERDE = (sha) => juzgar(sha, JOBS_DEL_CI.map((n) => job(n, 'success')), 'success');
const P = 'a'.repeat(40);
const V = 'b'.repeat(40);
const pasada = (veredictos) => ({ veredictos, ahora: AHORA, origen: 'siembra', urlDelRun: 'https://x/p', punta: P });

// Las anotaciones de dos jobs reales, copiadas tal cual (sólo `annotation_level` y `message`).
const ANOT_SALIO_CON_2 = [ // job 115146037750 (#2354), «vivas 519 · mudas 0 · ciegas 1»
  { annotation_level: 'warning', message: 'Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4.' },
  { annotation_level: 'failure', message: 'Process completed with exit code 2.' },
  { annotation_level: 'notice', message: '"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026."' },
];
const ANOT_CORTADO = [ // el meta-guard de 75884928b (run 39628953329), cortado a los 30 min
  { annotation_level: 'failure', message: 'The job has exceeded the maximum execution time of 30m0s' },
  { annotation_level: 'failure', message: 'The operation was canceled.' },
];

test('SCRUM-1339r · las identidades existen: el job y su paso están en ci.yml, y el 2 es el del meta-guard', () => {
  assert.ok(JOBS_DEL_CI.includes(JOB_META_GUARD), 'el meta-guard es uno de los jobs del CI que juzga el vigía');
  assert.match(CI_YML, new RegExp(`^\\s+name: ${JOB_META_GUARD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm'));
  assert.match(CI_YML, new RegExp(`^\\s+- name: ${PASO_DEL_META_GUARD}\\s*$`, 'm'));
  assert.equal(SALIDA_CIEGO_DEL_META_GUARD, SALIDA_CIEGO, 'el 2 del vigía es la SALIDA_CIEGO del instrumento');
  assert.notEqual(SALIDA_MUDO, SALIDA_CIEGO, 'y su 1 (MUDO) es otro: ése sí es un rojo');
  assert.match(VIGIA_YML, /^\s+checks: read\s*$/m, 'sin `checks: read` la anotación no se puede leer y todo 2 sale ROJO');
});

test('SCRUM-1339r · el código se lee de la anotación real: 2 en el que salió con 2, nada en el cortado', () => {
  assert.equal(codigoDeSalidaDeAnotaciones(ANOT_SALIO_CON_2), 2);
  assert.equal(codigoDeSalidaDeAnotaciones(ANOT_CORTADO), null);
  assert.equal(codigoDeSalidaDeAnotaciones([]), null);
  assert.equal(codigoDeSalidaDeAnotaciones(null), null);
  assert.equal(codigoDeSalidaDeAnotaciones([...ANOT_SALIO_CON_2, { annotation_level: 'failure', message: 'Process completed with exit code 1.' }]), null, 'dos códigos: no se sabe cuál');
  assert.equal(codigoDeSalidaDeAnotaciones([{ annotation_level: 'warning', message: 'Process completed with exit code 2.' }]), null, 'sólo cuenta la del nivel failure');
});

test('SCRUM-1339r · SIEMBRA: el meta-guard con su 2 y «guards de navegador» en rojo es CIEGO del meta-guard, y nombra el rojo', () => {
  const v = juzgar(V, jobsCon(mgFallo(2), [job(NAVEGADOR, 'failure')]));
  assert.equal(v.estado, 'CIEGO');
  assert.equal(v.causa, CAUSA_META_GUARD);
  assert.match(v.motivo, /^CIEGO del meta-guard: salió con 2/);
  assert.ok(v.motivo.includes(`además en rojo: «${NAVEGADOR}»`), v.motivo);
  // y a solas, sin otro rojo, también
  assert.equal(juzgar(V, jobsCon(mgFallo(2))).estado, 'CIEGO');
});

test('SCRUM-1339r · SIEMBRA: el meta-guard cortado a los 30 min con otro rojo al lado es CIEGO, no ROJO', () => {
  const v = juzgar(V, jobsCon(mgCortado(), [job(NAVEGADOR, 'failure')]));
  assert.equal(v.estado, 'CIEGO');
  assert.equal(v.causa, CAUSA_META_GUARD);
  assert.match(v.motivo, /no llegó a su resumen/);
  // el run ENTERO cancelado (todos sus jobs) es CIEGO del run, no del meta-guard (SCRUM-1393e)
  const todo = juzgar(V, JOBS_DEL_CI.map((n) => job(n, 'cancelled')), 'cancelled');
  assert.equal(todo.estado, 'CIEGO');
  assert.equal(todo.causa, null);
});

test('SCRUM-1339r · lo que SIGUE siendo ROJO: su 1 (un guard MUDO), su 2 de otro paso, y un 2 que no se pudo leer (lo dice)', () => {
  const mudo = juzgar(V, jobsCon(mgFallo(1)));
  assert.equal(mudo.estado, 'ROJO');
  assert.equal(juzgar(V, jobsCon(mgFallo(2, 'Compilar (tsc)'))).estado, 'ROJO', '`tsc` también sale con 2');
  const sinLeer = juzgar(V, jobsCon(mgFallo(null)));
  assert.equal(sinLeer.estado, 'ROJO');
  assert.match(sinLeer.motivo, /no se pudo leer: puede ser su CIEGO \(2\)/);
  assert.doesNotMatch(mudo.motivo, /no se pudo leer/, 'un 1 leído no se disfraza de duda');
  assert.equal(ciegoDelMetaGuard(jobsCon(job(JOB_META_GUARD, 'success'))), null);
});

test('SCRUM-1339r · el CIEGO del meta-guard NO lo absuelve la punta VERDE (como ROJO, sí lo absolvía)', () => {
  const ciego = juzgar(V, jobsCon(mgFallo(2), [job(NAVEGADOR, 'failure')]));
  const pendiente = accionDelIssue(pasada([VERDE(P)]), { previos: marcaDeAviso(ciego), estado: 'abierto' });
  assert.deepEqual(pendiente.pasos, []);
  assert.match(pendiente.motivo, /CIEGO pendiente/);
  // el control: el mismo commit como ROJO de antes sí deja cerrar
  const comoRojo = { ...ciego, estado: 'ROJO', causa: null };
  assert.deepEqual(accionDelIssue(pasada([VERDE(P)]), { previos: marcaDeAviso(comoRojo), estado: 'abierto' }).pasos, ['comentar', 'cerrar']);
  // tiene run: un «sin run» al que sustituyó no se queda esperando para siempre
  assert.equal(conRun(ciego), true);
});

test('SCRUM-1339r · el suelo reconoce los cebos del meta-guard, y un juez que lo dice ROJO no pasa', () => {
  assert.equal(sueloPorCommit().ok, true, sueloPorCommit().detalle);
  const comoAntes = (e) => { const v = veredictoDeCommit(e); return v.causa === CAUSA_META_GUARD ? { ...v, estado: 'ROJO' } : v; };
  assert.equal(sueloPorCommit(comoAntes).ok, false, 'el vigía de antes (el 2 como ROJO) tiene que salir CIEGO del suelo');
});

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Sin el CIEGO del meta-guard: el 2 con otro rojo al lado vuelve a ser ROJO.
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: '  if (delMetaGuard) {',
    a: '  if (false) {',
    cae: 'SCRUM-1339r · SIEMBRA: el meta-guard con su 2 y «guards de navegador» en rojo es CIEGO del meta-guard',
  },
  {
    // El cortado a los 30 min ya no es del meta-guard: vuelve a ROJO por el otro job.
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: "  if (j.conclusion === 'cancelled' || j.conclusion === 'timed_out') return",
    a: '  if (false) return',
    cae: 'SCRUM-1339r · SIEMBRA: el meta-guard cortado a los 30 min con otro rojo al lado es CIEGO',
  },
];
