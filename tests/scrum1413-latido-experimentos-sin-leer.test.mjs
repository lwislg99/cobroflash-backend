// SCRUM-1413 · EL LATIDO Y LOS EXPERIMENTOS QUE NADIE LEYÓ
//
// El 1-oct-2026 se lanzó el experimento de SCRUM-1384 en una rama `exp-*`, nadie leyó el resultado y
// sus artefactos caducaban a los tres días (el detalle, en `docs/master/SCRUM-1413.md`). Una rama
// `exp-*` no abre PR: nada la vigila. La sección EXPERIMENTOS del latido nombra todo run terminado
// cuyo id no esté citado en `docs/master/` de main, y dice cuándo caducan sus artefactos.
//
// Como las demás secciones: su ROJO (ve lo que tiene que ver), su NEGATIVO (no acusa a lo que está
// bien) y su CIEGO (si no pudo mirar, lo dice, y no sale ni 0 ni 1).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seccionExperimentos, citaElRun, salidaDe, informe,
  SALIDA_OK, SALIDA_AVISO, SALIDA_CIEGO,
} from '../scripts/equipo/latido.mjs';

const AHORA = Date.parse('2026-10-02T12:00:00Z');
const RAMA = 'exp-1-una-pregunta';
const run = (id, extra = {}) => ({ id, status: 'completed', created_at: '2026-10-01T14:00:51Z', ...extra });
const artefacto = (expires_at, expired = false) => ({ expired, expires_at });
const lista = (runs) => ({ total: runs.length, runs });
const artefactos = (as) => ({ total: as.length, artefactos: as });

/** Un mundo sano por defecto; cada caso cambia UNA cosa. */
const mundo = (extra = {}) => ({
  ramas: [RAMA],
  runsDe: () => lista([run(111)]),
  artefactosDe: () => artefactos([artefacto('2026-10-04T14:08:02Z'), artefacto('2026-10-04T15:00:00Z')]),
  citadoEnMain: () => false,
  ahora: AHORA,
  ...extra,
});

test('SCRUM-1413 · ROJO: un run terminado, con artefactos vivos y sin citar en main, sale con rama, id y CUÁNDO caduca', () => {
  const s = seccionExperimentos(mundo());
  assert.equal(s.pudo, true);
  assert.equal(s.alertas.length, 1);
  const l = s.alertas[0].linea;
  assert.match(l, /exp-1-una-pregunta · run 111 /);
  assert.match(l, /SIN LEER/);
  assert.match(l, /2 de 2 artefacto\(s\) vivos/);
  // La PRIMERA caducidad, no la última: es la que manda sobre cuánto tiempo queda.
  assert.match(l, /CADUCA el 2026-10-04T14:08Z/);
  assert.match(l, /faltan 2\.1 días/);
  assert.equal(salidaDe([s]), SALIDA_AVISO);
});

test('SCRUM-1413 · ROJO: si los artefactos YA caducaron sin cita, se dice PERDIDO y no «sin leer»', () => {
  const s = seccionExperimentos(mundo({ artefactosDe: () => artefactos([artefacto('2026-09-30T00:00:00Z', true)]) }));
  assert.equal(s.alertas.length, 1);
  assert.match(s.alertas[0].linea, /PERDIDO: sus 1 artefacto\(s\) YA CADUCARON/);
  assert.doesNotMatch(s.alertas[0].linea, /SIN LEER/);
});

test('SCRUM-1413 · ROJO: con varios, lo perdido va primero y luego lo que caduca antes', () => {
  const porRun = {
    1: artefactos([artefacto('2026-10-05T00:00:00Z')]),
    2: artefactos([artefacto('2026-09-01T00:00:00Z', true)]),
    3: artefactos([artefacto('2026-10-03T00:00:00Z')]),
  };
  const s = seccionExperimentos(mundo({ runsDe: () => lista([run(1), run(2), run(3)]), artefactosDe: (id) => porRun[id] }));
  assert.deepEqual(s.alertas.map((a) => a.linea.match(/run (\d+)/)[1]), ['2', '3', '1']);
});

test('SCRUM-1413 · NEGATIVO: un run citado en docs/master de main no sale, y la sección da 0', () => {
  const s = seccionExperimentos(mundo({ citadoEnMain: () => true, artefactosDe: () => { throw new Error('a un run ya citado no se le piden los artefactos'); } }));
  assert.equal(s.pudo, true);
  assert.equal(s.alertas.length, 0);
  assert.match(s.poblacion, /1 rama\(s\) `exp-\*` \(0 sin ningún run\) · 1 run\(s\) terminados: 1 citados/);
  assert.equal(salidaDe([s]), SALIDA_OK);
});

test('SCRUM-1413 · NEGATIVO: un run que aún corre no se acusa y se cuenta; uno sin artefactos tampoco', () => {
  const s = seccionExperimentos(mundo({
    runsDe: () => lista([run(1, { status: 'in_progress' }), run(2)]),
    artefactosDe: () => artefactos([]),
  }));
  assert.equal(s.alertas.length, 0);
  assert.match(s.poblacion, /1 sin citar y sin artefactos · 1 aún corriendo/);
});

test('SCRUM-1413 · ROJO: una rama exp-* de la que no llega NINGÚN run se nombra; no pasa por «nada que leer»', () => {
  // Visto al estrenar la sección el 2-oct-2026: la API dio la lista vacía de una rama que tenía su run.
  const s = seccionExperimentos(mundo({ ramas: [RAMA, 'exp-2-otra'], runsDe: (r) => (r === RAMA ? lista([]) : lista([run(7)])), citadoEnMain: () => true }));
  assert.equal(s.pudo, true);
  assert.equal(s.alertas.length, 1);
  assert.match(s.alertas[0].linea, /^exp-1-una-pregunta · la API no devuelve NINGÚN run/);
  assert.match(s.poblacion, /2 rama\(s\) `exp-\*` \(1 sin ningún run\)/);
  assert.equal(salidaDe([s]), SALIDA_AVISO);
});

test('SCRUM-1413 · NEGATIVO: sin ninguna rama exp-* la sección MIRÓ y lo dice con su población', () => {
  const s = seccionExperimentos(mundo({ ramas: [] }));
  assert.equal(s.pudo, true);
  assert.match(s.poblacion, /^0 rama\(s\)/);
});

test('SCRUM-1413 · la cita casa por el id ENTERO: una subcadena de otro número no es una cita', () => {
  assert.equal(citaElRun('run `36873018664`, a las 14:00', 36873018664), true);
  assert.equal(citaElRun('36873018664', '36873018664'), true);
  assert.equal(citaElRun('job 1368730186649 y job 936873018664', 36873018664), false);
  assert.equal(citaElRun('', 36873018664), false);
});

test('SCRUM-1413 · CIEGO: cada cosa que no se puede leer da NO PUDE MIRAR (salida 2), nunca una lista corta', () => {
  const casos = {
    'las ramas no llegaron': { ramas: undefined },
    'los runs de una rama no llegaron': { runsDe: () => undefined },
    'la lista de runs viene cortada': { runsDe: () => ({ total: 130, runs: [run(1)] }) },
    'no se pudo buscar en main': { citadoEnMain: () => undefined },
    'los artefactos no llegaron': { artefactosDe: () => undefined },
    'la lista de artefactos viene cortada': { artefactosDe: () => ({ total: 12, artefactos: [artefacto('2026-10-04T14:08:02Z')] }) },
    'un artefacto sin fecha legible': { artefactosDe: () => artefactos([artefacto(undefined)]) },
  };
  for (const [nombre, extra] of Object.entries(casos)) {
    const s = seccionExperimentos(mundo(extra));
    assert.equal(s.pudo, false, nombre);
    assert.ok(s.motivo && s.motivo.length > 10, nombre);
    assert.equal(salidaDe([s]), SALIDA_CIEGO, nombre);
  }
});

test('SCRUM-1413 · CIEGO: un fallo en la SEGUNDA rama no deja pasar por buena la primera', () => {
  const s = seccionExperimentos(mundo({ ramas: [RAMA, 'exp-2-otra'], runsDe: (r) => (r === RAMA ? lista([run(1)]) : undefined) }));
  assert.equal(s.pudo, false);
  assert.match(s.motivo, /exp-2-otra/);
  assert.match(informe([s], { ahora: AHORA }), /EXPERIMENTOS · NO PUDE MIRAR/);
});
