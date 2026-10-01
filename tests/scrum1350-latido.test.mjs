// SCRUM-1350 · EL LATIDO — lo que ya se sabía en otro sitio, delante de quien reparte.
//
// El 29-sep-2026 diez PR nacieron rojos y estuvieron dos días así. Los vigías los VIERON (issue
// #1241, avisador rojo en los diez) y nadie se enteró: el aviso iba a buzones que nadie abre.
// `scripts/equipo/latido.mjs` no detecta nada nuevo; reúne. Aquí se comprueba lo que un parte así
// puede hacer mal: callar. Cada sección tiene su ROJO (ve lo que tiene que ver), su NEGATIVO (no
// acusa a lo que está bien) y su CIEGO (si no pudo mirar, lo dice y NO sale 0 ni 1).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seccionPRs, seccionSesiones, seccionTraspasos, seccionMain, seccionDespliegue,
  fallosDelLog, salidaDe, informe, puestoDe,
  SALIDA_OK, SALIDA_AVISO, SALIDA_CIEGO, HORAS_DE_ROJO, MINUTOS_DE_DESPLIEGUE,
} from '../scripts/equipo/latido.mjs';

const OBLIG = 'build + tests (con banco desechable)';
const REGLAS = [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: OBLIG }] } }];
const AHORA = Date.parse('2026-10-01T12:00:00Z');
const H = 36e5;

const pr = (numero, extra = {}) => ({
  number: numero, headRefName: `scrum-${numero}-x`, author: { login: 'lwislg99' }, isDraft: false, labels: [],
  autoMergeRequest: {}, mergeStateStatus: 'BLOCKED', mergeable: 'MERGEABLE', ...extra,
});
const check = (conclusion, extra = {}) => ({ id: 1, name: OBLIG, status: 'completed', conclusion, started_at: '2026-10-01T09:00:00Z', ...extra });

function prs({ lista, checks = {}, minutos = {} }) {
  return seccionPRs({ prs: lista, reglas: REGLAS, checksDe: (n) => checks[n], minutosDesdePush: (n) => minutos[n] });
}

test('SCRUM-1350 · SUELO: el clasificador prestado reconoce el cebo (si no, nada de abajo mide)', () => {
  const s = prs({ lista: [pr(1)], checks: { 1: [check('failure')] }, minutos: { 1: 600 } });
  assert.equal(s.pudo, true);
  assert.equal(s.filas[0].causa, 'ROJO-OBLIGATORIO', `🔴 CIEGO: un obligatorio en failure no sale ROJO-OBLIGATORIO sino ${s.filas[0].causa}`);
  assert.match(s.poblacion, /1 PR abiertos .* obligatorios: build \+ tests/);
});

test(`SCRUM-1350 · 🔴 un PR con el obligatorio rojo ≥ ${HORAS_DE_ROJO} h sale, con su rama y su edad`, () => {
  const s = prs({ lista: [pr(1), pr(2)], checks: { 1: [check('failure')], 2: [check('failure')] }, minutos: { 1: 180, 2: 30 } });
  assert.deepEqual(s.alertas.map((a) => a.numero), [1], '🔴 el de 3 h se avisa; el de 30 min todavía puede estar mirándolo su dueño');
  assert.match(s.alertas[0].linea, /#1 scrum-1-x · ROJO-OBLIGATORIO · 3\.0 h desde su último push/);
});

test('SCRUM-1350 · 🔴 «sin check» NO es lo mismo que «aún no ha arrancado»: la edad del push decide', () => {
  // Medido el 1-oct-2026: a los 2 min de un push del bot el PR no tenía checks, se leyó como «mudo»
  // y el push «de arreglo» canceló la corrida buena que estaba arrancando.
  const s = prs({ lista: [pr(1), pr(2)], checks: { 1: [], 2: [] }, minutos: { 1: 2, 2: 45 } });
  assert.deepEqual(s.alertas.map((a) => a.numero), [2], '🔴 el de 2 min es un «todavía no»; el de 45 min sí está mudo');
  assert.match(s.alertas[0].linea, /punta SIN ningún check · 45 min desde su último push/);
});

test('SCRUM-1350 · NEGATIVO: un PR verde y un borrador no se acusan, y el borrador se CUENTA', () => {
  const s = prs({ lista: [pr(1), pr(2, { isDraft: true })], checks: { 1: [check('success')], 2: [check('failure')] }, minutos: { 1: 600, 2: 600 } });
  assert.deepEqual(s.alertas, []);
  assert.match(s.poblacion, /2 PR abiertos \(1 en borrador, 1 vigilados\)/);
});

test('SCRUM-1350 · 🔴 CIEGO: sin la lista de PR la sección NO sale vacía, sale «no pude mirar», y el comando sale 2', () => {
  const s = seccionPRs({ prs: undefined, reglas: REGLAS, checksDe: () => undefined, minutosDesdePush: () => undefined });
  assert.equal(s.pudo, false);
  assert.equal(salidaDe([s]), SALIDA_CIEGO);
  assert.match(informe([s], { ahora: AHORA }), /NO PUDE MIRAR[\s\S]*Esto NO quiere decir que no haya nada/);
});

test('SCRUM-1350 · 🔴 un «no sé» gana a un «hay cosas»: ciego + avisos sale 2, no 1', () => {
  const rojo = prs({ lista: [pr(1)], checks: { 1: [check('failure')] }, minutos: { 1: 600 } });
  const ciega = seccionMain({ commits: [] });
  assert.equal(salidaDe([rojo]), SALIDA_AVISO);
  assert.equal(salidaDe([rojo, ciega]), SALIDA_CIEGO);
  assert.equal(salidaDe([prs({ lista: [pr(1)], checks: { 1: [check('success')] }, minutos: { 1: 600 } })]), SALIDA_OK);
});

const sesion = (nombre, estado, extra = {}) => ({ id: nombre, nombre, estado, actualizado: AHORA - 20 * 60000, creado: AHORA - 5 * H, prs: [], ...extra });

test('SCRUM-1350 · 🔴 una sesión bloqueada sale con lo que ESPERA, no solo con que está parada', () => {
  const s = seccionSesiones({ sesiones: [sesion('s4-1oct', 'blocked', { needs: 'approve 4 server messages' }), sesion('s2-1oct', 'working')], filasPR: [], ahora: AHORA });
  assert.equal(s.alertas.length, 1);
  assert.match(s.alertas[0].linea, /s4-1oct .* BLOQUEADA hace 20 min · espera: approve 4 server messages/);
  assert.match(s.poblacion, /2 con actividad en 24 h \(1 blocked, 1 working\)/);
});

test('SCRUM-1350 · 🔴 NADIE VUELVE: la sesión que ya no trabaja con un PR suyo rojo, o sin veredicto', () => {
  const filasPR = [{ numero: 10, causa: 'ROJO-OBLIGATORIO' }, { numero: 11, causa: 'ESPERANDO' }];
  const s = seccionSesiones({
    sesiones: [sesion('s1-1oct', 'done', { prs: [10, 11, 12] }), sesion('s2-1oct', 'working', { prs: [10] })],
    filasPR, ahora: AHORA,
  });
  assert.equal(s.alertas.length, 2, '🔴 dos avisos: el rojo y el que cerró sin veredicto. El #12 ya no está abierto, y la que TRABAJA no se acusa');
  assert.match(s.alertas[0].linea, /s1-1oct .* ya NO trabaja \(done\) y su PR #10 sigue ROJO-OBLIGATORIO: nadie vuelve/);
  assert.match(s.alertas[1].linea, /PR #11 sigue ABIERTO sin veredicto \(ESPERANDO\)/);
});

test('SCRUM-1350 · sin la sección PR, las sesiones lo DICEN en vez de callar el cruce', () => {
  const s = seccionSesiones({ sesiones: [sesion('s1-1oct', 'done', { prs: [10] })], filasPR: null, ahora: AHORA });
  assert.match(s.poblacion, /sin la sección PR no se pudo cruzar/);
  assert.equal(seccionSesiones({ sesiones: undefined, filasPR: [], ahora: AHORA }).pudo, false);
});

test('SCRUM-1350 · 🔴 TRASPASO: que el fichero exista no basta — tiene que ser posterior al arranque de ESA sesión', () => {
  const cerrada = sesion('s3-1oct', 'done');
  const viejo = seccionTraspasos({ sesiones: [cerrada], ahora: AHORA, mtimeDelTraspaso: () => AHORA - 48 * H });
  assert.match(viejo.alertas[0].linea, /su traspaso es ANTERIOR a su arranque/);
  const falta = seccionTraspasos({ sesiones: [cerrada], ahora: AHORA, mtimeDelTraspaso: () => null });
  assert.match(falta.alertas[0].linea, /project_s3_traspaso\.md NO EXISTE/);
  const bien = seccionTraspasos({ sesiones: [cerrada, sesion('s2-1oct', 'working')], ahora: AHORA, mtimeDelTraspaso: () => AHORA - H });
  assert.deepEqual(bien.alertas, []);
  assert.match(bien.poblacion, /^1 sesiones que ya no trabajan/);
  assert.equal(seccionTraspasos({ sesiones: [cerrada], ahora: AHORA, mtimeDelTraspaso: () => undefined }).pudo, false, '🔴 no poder mirar NO es «no existe»');
});

test('SCRUM-1350 · el puesto sale del nombre, y un nombre que no lo dice no se inventa', () => {
  assert.equal(puestoDe('s3-1oct'), 3);
  assert.equal(puestoDe('sesion-5'), 5);
  assert.equal(puestoDe('s4-1octb'), 4);
  assert.equal(puestoDe('cobroflash-backend-57'), null);
  const s = seccionTraspasos({ sesiones: [sesion('cobroflash-backend-57', 'done')], ahora: AHORA, mtimeDelTraspaso: () => null });
  assert.match(s.poblacion, /1 sin puesto reconocible en el nombre \(NO medidas\)/);
});

const commit = (sha, conclusion, estado = 'completed') => ({ sha: sha.padEnd(40, '0'), checkRuns: conclusion === undefined ? [] : [check(conclusion, { status: estado })] });

test('SCRUM-1350 · MAIN: el último verde del OBLIGATORIO y cuántos commits hay detrás sin veredicto', () => {
  const s = seccionMain({ commits: [commit('aaaa', undefined), commit('bbbb', 'cancelled'), commit('cccc', 'success'), commit('dddd', 'failure')] });
  assert.deepEqual(s.alertas, []);
  assert.match(s.poblacion, /último con el obligatorio VERDE: cccc0000 · 2 commit\(s\) más nuevos sin veredicto/);
});

test('SCRUM-1350 · 🔴 MAIN en rojo se avisa; sin NINGÚN veredicto también; y sin poder leer un commit, CIEGO', () => {
  assert.match(seccionMain({ commits: [commit('aaaa', undefined), commit('bbbb', 'failure')] }).alertas[0].linea, /main bbbb0000 tiene el obligatorio en ROJO \(1 commit/);
  assert.match(seccionMain({ commits: [commit('aaaa', undefined), commit('bbbb', null, 'in_progress')] }).alertas[0].linea, /ninguno de los últimos 2 commits/);
  assert.equal(seccionMain({ commits: [{ sha: 'a'.repeat(40), checkRuns: undefined }] }).pudo, false);
  assert.equal(seccionMain({ commits: [] }).pudo, false);
});

test(`SCRUM-1350 · 🔴 DESPLIEGUE: in_progress más de ${MINUTOS_DE_DESPLIEGUE} min es ATASCADO; uno recién lanzado no`, () => {
  const d = (min, estados) => ({ sha: 'e'.repeat(40), creado: new Date(AHORA - min * 60000).toISOString(), estados });
  assert.equal(seccionDespliegue({ despliegues: [d(30, ['in_progress', 'in_progress'])], ahora: AHORA }).alertas.length, 1);
  assert.deepEqual(seccionDespliegue({ despliegues: [d(3, ['in_progress'])], ahora: AHORA }).alertas, []);
  assert.deepEqual(seccionDespliegue({ despliegues: [d(30, ['inactive', 'success', 'in_progress'])], ahora: AHORA }).alertas, []);
  assert.equal(seccionDespliegue({ despliegues: [], ahora: AHORA }).pudo, false);
  assert.equal(seccionDespliegue({ despliegues: [d(30, undefined)], ahora: AHORA }).pudo, false);
});

test('SCRUM-1350 · lo que cayó: los nombres del resumen `spec`; sin resumen es «no supe», NO «cero fallos»', () => {
  const log = [
    '2026-10-01T10:00:00.0000000Z ✔ uno que pasa (1.2ms)',
    '2026-10-01T10:00:01.0000000Z ✖ failing tests:',
    '2026-10-01T10:00:01.1000000Z ',
    '2026-10-01T10:00:01.2000000Z ✖ SCRUM-1 · el que cae (3.4ms)',
    '2026-10-01T10:00:01.3000000Z   AssertionError: x',
    '2026-10-01T10:00:01.4000000Z ✖ SCRUM-2 · el otro (0.5ms)',
  ].join('\n');
  assert.deepEqual(fallosDelLog(log), ['SCRUM-1 · el que cae', 'SCRUM-2 · el otro']);
  assert.equal(fallosDelLog('✔ todo bien\n##[error]Process completed with exit code 1.'), null);
  const s = prs({ lista: [pr(7)], checks: { 7: [check('failure')] }, minutos: { 7: 600 } });
  assert.match(informe([s], { ahora: AHORA, fallosDe: () => ['SCRUM-1 · el que cae'] }), /✖ SCRUM-1 · el que cae/);
  assert.match(informe([s], { ahora: AHORA, fallosDe: () => null }), /no supe leer qué cayó/);
});
