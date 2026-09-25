// tests/scrum1000-vigia-sesiones-jv.test.mjs — SCRUM-1000
//
// Las funciones PURAS de `scripts/vigia-sesiones-jv.mjs`: qué sesiones hay que avisar a partir de
// un `sesion.mjs estado` fabricado (SCRUM-1026 ya prueba `sesionesBloqueadas`/`clasificarAgente`
// en `tests/scrum1007-1011-1026-relevo-lanzar-bloqueo.test.mjs`; esto no repite esa parte, prueba
// SOLO lo nuevo: decidir si empeora y componer el cuerpo del issue).
//
// El caso motivador, REAL, medido en esta máquina el 23-sep-2026 con
// `node "C:/Users/Javier Pereira/AppData/Local/yaqu-equipo/sesion.mjs" estado`: `jv-j3` salía a la
// vez en `bloqueadas` (avisar:true) y en `restos` (MUERTA). Los fixtures de abajo son ESA forma.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'vigia-sesiones-jv.mjs');
const m = await import(pathToFileURL(SCRIPT).href);

const ESTADO_REAL_MEDIDO = {
  bloqueadas: [{ id: '34714ba0', nombre: 'jv-j3', waitingFor: 'algo interactivo', sinActividadMs: 30349907, avisar: true }],
  restos: [{ id: '34714ba0', nombre: 'jv-j3', cwd: 'C:\\jv', kind: 'background', state: 'blocked', pid: null, clasificacion: 'MUERTA', porque: 'sin pid, y su state.json dice que terminó' }],
};

test('sesionesQueAvisan: une bloqueadas (avisar:true) y restos MUERTA, filtra lo que no avisa', () => {
  const estado = {
    bloqueadas: [
      { id: 'a1', nombre: 'jv-j2', waitingFor: 'algo interactivo', avisar: true },
      { id: 'a2', nombre: 'jv-j5', waitingFor: 'algo interactivo', avisar: false }, // bajo el umbral: NO avisa
    ],
    restos: [
      { id: 'a3', nombre: 'jv-j3', clasificacion: 'MUERTA', porque: 'sin pid' },
      { id: 'a4', nombre: 'jv-j4', clasificacion: 'NO-PUDE-MIRAR', porque: 'x' }, // no es MUERTA: NO entra
    ],
  };
  const lista = m.sesionesQueAvisan(estado);
  assert.deepEqual(lista.map((s) => s.id).sort(), ['a1', 'a3']);
  assert.equal(lista.find((s) => s.id === 'a1').clase, 'BLOQUEADA');
  assert.equal(lista.find((s) => s.id === 'a3').clase, 'MUERTA');
});

test('sesionesQueAvisan: el mismo id en bloqueadas Y restos (caso REAL medido, jv-j3) sale UNA vez por cada fuente, no se deduplica a ciegas', () => {
  const lista = m.sesionesQueAvisan(ESTADO_REAL_MEDIDO);
  assert.equal(lista.length, 2);
  assert.deepEqual(lista.map((s) => s.clase).sort(), ['BLOQUEADA', 'MUERTA']);
});

test('sesionesQueAvisan: sin bloqueadas ni restos, población vacía de verdad (no ciega)', () => {
  assert.deepEqual(m.sesionesQueAvisan({ bloqueadas: [], restos: [] }), []);
  assert.deepEqual(m.sesionesQueAvisan({}), []);
});

test('queEmpeora: un id nuevo empeora; el mismo id repetido NO vuelve a avisar', () => {
  const ahora = [{ id: 'x1', nombre: 'jv-j6' }, { id: 'x2', nombre: 'jv-j3' }];
  const r1 = m.queEmpeora({ antes: [], ahora });
  assert.equal(r1.empeora, true);
  assert.deepEqual(r1.nuevos.map((s) => s.id), ['x1', 'x2']);

  const r2 = m.queEmpeora({ antes: ['x1', 'x2'], ahora });
  assert.equal(r2.empeora, false);
  assert.deepEqual(r2.nuevos, []);
});

test('queEmpeora: control positivo — vaciar la lista de "antes" no es el mismo caso que vaciar "ahora" (A3)', () => {
  // Si el generador comparara por longitud en vez de por conjunto, esto colaría en falso.
  const r = m.queEmpeora({ antes: ['x1'], ahora: [{ id: 'x2', nombre: 'jv-j2' }] });
  assert.equal(r.empeora, true);
  assert.deepEqual(r.nuevos.map((s) => s.id), ['x2']);
});

test('componerCuerpo + leerMarca: la marca escrita hoy es exactamente lo que se lee mañana (round-trip)', () => {
  const lista = m.sesionesQueAvisan(ESTADO_REAL_MEDIDO);
  const cuerpo = m.componerCuerpo(lista);
  assert.match(cuerpo, /jv-j3/);
  assert.match(cuerpo, /BLOQUEADA/);
  assert.match(cuerpo, /MUERTA/);
  const marca = m.leerMarca(cuerpo);
  assert.deepEqual(marca.sort(), lista.map((s) => s.id).sort());
});

test('componerCuerpo: lista vacía compone un cuerpo legible y una marca `[]`, no un cuerpo roto', () => {
  const cuerpo = m.componerCuerpo([]);
  assert.match(cuerpo, /Ninguna sesión/);
  assert.deepEqual(m.leerMarca(cuerpo), []);
});

test('leerMarca: un cuerpo SIN marca (issue creado a mano, o primera vez) es memoria vacía, no un fallo', () => {
  assert.deepEqual(m.leerMarca('cualquier texto sin la marca'), []);
  assert.deepEqual(m.leerMarca(undefined), []);
});
