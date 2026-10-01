// SCRUM-1350 · EL LATIDO — lo que ya se sabía en otro sitio, delante de quien reparte.
//
// El 29-sep-2026 diez PR nacieron rojos y estuvieron dos días así. Los vigías los VIERON (issue
// #1241, avisador rojo en los diez) y nadie se enteró: el aviso iba a buzones que nadie abre.
// `scripts/equipo/latido.mjs` no detecta nada nuevo; reúne. Aquí se comprueba lo que un parte así
// puede hacer mal: callar. Cada sección tiene su ROJO (ve lo que tiene que ver), su NEGATIVO (no
// acusa a lo que está bien) y su CIEGO (si no pudo mirar, lo dice y NO sale 0 ni 1).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  seccionPRs, seccionSesiones, seccionTraspasos, seccionMain, seccionDespliegue,
  seccionCementerio, actualizarLibro, leerTrabajos, leerLibro,
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

// ───────────────────────────── SCRUM-1357 · el registro manda, y el cementerio ─────────────────────────────
//
// Medido el 1-oct-2026: (a) dos sesiones lanzadas quedaron pidiendo un permiso; el lanzador dijo
// «backgrounded», el panel no las listaba y se las dio por trabajando una hora. (b) Ocho sesiones
// en `blocked` del 27 al 29-sep, cada una con su pregunta, ninguna contestada: la sección SESIONES
// solo mira 24 h. (c) `leerSesiones` saltaba en silencio un state.json que no se dejaba leer.

test('SCRUM-1357 · 🔴 el bloqueo NO siempre está en `state`: working + tempo=blocked sale BLOQUEADA, y se dice dónde estaba', () => {
  // El caso real: s3-1octc, 1-oct 11:53Z → state=working, tempo=blocked, needs="approve Entering worktree".
  const s = seccionSesiones({
    sesiones: [
      sesion('s3-1octc', 'working', { tempo: 'blocked', needs: 'approve Entering worktree' }),
      sesion('s1-1octc', 'working', { tempo: 'blocked' }),
      sesion('s4-1octb', 'working', { tempo: 'idle', needs: 'approve 2 edits' }),
      sesion('s2-1oct', 'working', { tempo: 'active' }),
    ],
    filasPR: [], ahora: AHORA,
  });
  assert.equal(s.alertas.length, 3, '🔴 las tres que esperan salen; la que trabaja de verdad, no');
  assert.match(s.alertas[2].linea, /s4-1octb .* espera: approve 2 edits · ⚠️ su state dice «working»: el bloqueo está en needs/);
  assert.match(s.alertas[0].linea, /s3-1octc .* BLOQUEADA hace 20 min · espera: approve Entering worktree · ⚠️ su state dice «working»: el bloqueo está en tempo/);
  assert.match(s.alertas[1].linea, /s1-1octc .* BLOQUEADA .* espera: no lo dice/);
  assert.match(s.poblacion, /leído del REGISTRO, no del panel/);
});

const vieja = (nombre, dias, extra = {}) => sesion(nombre, 'blocked', { actualizado: AHORA - dias * 24 * H, ...extra });

test('SCRUM-1357 · 🔴 CEMENTERIO: la pregunta de una sesión bloqueada hace días SALE, con su edad, la más vieja primero', () => {
  const sesiones = [
    vieja('s4-29a', 2, { needs: 'approve or reject the two proposed texts for SCRUM-1266' }),
    vieja('s0-27c', 3, { needs: 'grant permission to edit that file' }),
    sesion('s2-1oct', 'working'),
    sesion('s1-26d', 'done', { actualizado: AHORA - 5 * 24 * H }),
  ];
  assert.deepEqual(seccionSesiones({ sesiones, filasPR: [], ahora: AHORA }).alertas, [], 'SUELO: SESIONES no las ve (por eso hace falta la sección)');
  const c = seccionCementerio({ sesiones, libro: null, ahora: AHORA });
  assert.equal(c.pudo, true);
  assert.deepEqual(c.alertas.map((a) => a.sesion), ['s0-27c', 's4-29a']);
  assert.match(c.alertas[0].linea, /s0-27c \(s0-27c\) · hace 3\.0 días · espera: grant permission to edit that file/);
  assert.match(c.poblacion, /4 trabajos leídos · 2 pregunta\(s\) sin contestar/);
  assert.equal(salidaDe([c]), SALIDA_AVISO);
});

test('SCRUM-1357 · NEGATIVO: sin bloqueadas viejas no acusa a nadie, y las de hoy las deja a SESIONES (contadas)', () => {
  const c = seccionCementerio({ sesiones: [sesion('s4-1oct', 'blocked', { needs: 'x' }), sesion('s2-1oct', 'working')], libro: null, ahora: AHORA });
  assert.deepEqual(c.alertas, []);
  assert.match(c.poblacion, /0 pregunta\(s\) sin contestar .* 1 de hoy \(están en SESIONES\)/);
  assert.equal(salidaDe([c]), SALIDA_OK);
});

test('SCRUM-1357 · 🔴 CIEGO: un state.json ilegible NO es una sesión que no existe — sale 2 y enseña lo que sí leyó', () => {
  const sesiones = [vieja('s4-29a', 2, { needs: 'la pregunta' })];
  const c = seccionCementerio({ sesiones, ilegibles: [{ id: 'abcd1234', motivo: 'SyntaxError' }], libro: null, ahora: AHORA });
  assert.equal(c.pudo, false, '🔴 con un fichero sin leer, «8 preguntas» puede ser «9»: no es un recuento, es un mínimo');
  assert.equal(salidaDe([c]), SALIDA_CIEGO);
  const txt = informe([c], { ahora: AHORA });
  assert.match(txt, /CEMENTERIO · NO PUDE MIRAR: 1 state\.json que NO se dejan leer \(abcd1234: SyntaxError\)/);
  assert.match(txt, /· s4-29a .* espera: la pregunta/, '🔴 estar ciego de UNO no tapa a los que sí se leyeron');
  // …y sin carpeta, o con el libro corrupto, tampoco sale «vacío».
  assert.equal(seccionCementerio({ sesiones: undefined, libro: null, ahora: AHORA }).pudo, false);
  assert.equal(seccionCementerio({ sesiones, libro: undefined, ahora: AHORA }).pudo, false);
  // SESIONES también lo dice: el ilegible puede ser de hoy.
  assert.match(seccionSesiones({ sesiones, filasPR: [], ilegibles: [{ id: 'abcd1234', motivo: 'x' }], ahora: AHORA }).poblacion, /1 state\.json ILEGIBLES/);
});

test('SCRUM-1357 · 🔴 el lector cuenta lo que NO pudo leer en vez de saltárselo (contra disco)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-latido-'));
  try {
    const pon = (id, txt) => { fs.mkdirSync(path.join(dir, id)); if (txt !== null) fs.writeFileSync(path.join(dir, id, 'state.json'), txt); };
    pon('buena', JSON.stringify({ state: 'working', tempo: 'blocked', needs: 'approve MCP', name: 's1-1octb', updatedAt: '2026-10-01T10:00:00Z' }));
    pon('rota', '{"state": "blo');
    pon('vacia', '');
    pon('sin', null);
    const t = leerTrabajos(dir);
    assert.deepEqual(t.sesiones.map((s) => [s.id, s.estado, s.tempo, s.needs]), [['buena', 'working', 'blocked', 'approve MCP']]);
    assert.deepEqual(t.ilegibles.map((i) => i.id).sort(), ['rota', 'vacia'], '🔴 las dos que no parsean se CUENTAN');
    assert.deepEqual(t.sinEstado, ['sin'], 'una carpeta de trabajo sin state.json es un lanzamiento sin registro: se nombra');
    const c = seccionCementerio({ ...t, libro: null, ahora: AHORA });
    assert.equal(c.pudo, false);
    assert.match(c.motivo, /2 state\.json que NO se dejan leer.*1 carpeta\(s\) de trabajo SIN state\.json \(sin\)/);
    assert.equal(leerTrabajos(path.join(dir, 'no-existe')), undefined);
    // El libro: no existir no es un fallo; existir y no parsear, sí.
    assert.equal(leerLibro(path.join(dir, 'libro.json')), null);
    fs.writeFileSync(path.join(dir, 'libro.json'), '{roto');
    assert.equal(leerLibro(path.join(dir, 'libro.json')), undefined);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('SCRUM-1357 · 🔴 una pregunta NO caduca porque paren a quien la hizo: el libro la conserva cuando el registro la borra', () => {
  // Medido el 1-oct: ningún trabajo terminado conserva `needs`. Parar una sesión bloqueada BORRA su pregunta.
  const antes = [vieja('s3-29c', 2, { id: 'j1', needs: 'signal to continue' })];
  const libro = actualizarLibro({}, antes);
  assert.equal(libro.j1.needs, 'signal to continue');
  const parada = [sesion('s3-29c', 'stopped', { id: 'j1', actualizado: AHORA - H })];
  const libro2 = actualizarLibro(libro, parada);
  assert.ok(libro2.j1, '🔴 parada ≠ contestada: sigue en el libro');
  const c = seccionCementerio({ sesiones: parada, libro: libro2, ahora: AHORA });
  assert.equal(c.alertas.length, 1);
  assert.match(c.alertas[0].linea, /s3-29c \(j1\) · hace 2\.0 días · espera: signal to continue · ⚠️ el registro ya la da por «stopped» y ha BORRADO la pregunta/);
  // Su carpeta borrada del todo: tampoco la saca.
  assert.match(seccionCementerio({ sesiones: [], libro: libro2, ahora: AHORA }).alertas[0].linea, /su carpeta ya no existe/);
});

test('SCRUM-1357 · NEGATIVO del libro: la que SIGUIÓ trabajando sale sola; la «contestada» deja de avisar; otra pregunta nueva vuelve a avisar', () => {
  const bloqueada = [vieja('s4-28d', 3, { id: 'j2', needs: 'can a session render signed text?' })];
  let libro = actualizarLibro({}, bloqueada);
  // Le aprobaron el permiso y siguió: no es una pregunta muerta.
  assert.deepEqual(actualizarLibro(libro, [sesion('s4-28d', 'working', { id: 'j2' })]), {});
  assert.deepEqual(actualizarLibro(libro, [sesion('s4-28d', 'done', { id: 'j2' })]), {});
  // Contestada en otro sitio (SCRUM-1353, comentario 17881): se apunta DÓNDE y deja de salir, sin tocar el registro.
  libro = { j2: { ...libro.j2, contestada: { cuando: AHORA, donde: 'SCRUM-1353 c.17881' } } };
  libro = actualizarLibro(libro, bloqueada);
  const c = seccionCementerio({ sesiones: bloqueada, libro, ahora: AHORA });
  assert.deepEqual(c.alertas, []);
  assert.match(c.poblacion, /1 marcada\(s\) como contestadas/);
  // La misma sesión con OTRA pregunta: la respuesta apuntada era de la anterior.
  const otra = [vieja('s4-28d', 3, { id: 'j2', needs: 'and now a different question' })];
  const libro3 = actualizarLibro(libro, otra);
  assert.deepEqual([libro3.j2.needs, libro3.j2.contestada], ['and now a different question', undefined], '🔴 el libro apunta la pregunta NUEVA, sin la respuesta de la vieja');
  const c2 = seccionCementerio({ sesiones: otra, libro: libro3, ahora: AHORA });
  assert.equal(c2.alertas.length, 1, '🔴 una respuesta no contesta a la pregunta siguiente');
  // Y si el libro no se pudo guardar, se dice.
  assert.match(seccionCementerio({ sesiones: bloqueada, libro, libroGuardado: false, ahora: AHORA }).poblacion, /NO pude guardar el libro/);
});
