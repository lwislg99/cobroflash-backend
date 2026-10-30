// tests/scrum1393g-vigia-cierra-con-ciegos-dichos.test.mjs — SCRUM-1393g
//
// Decisión del fundador (SCRUM-1393 c.21059, 27-oct-2026): el vigía de `main` CIERRA su Issue con la
// punta VERDE y 0 pendientes. Los CIEGO ya no bloquean el cierre, pero el comentario de cierre los
// DECLARA: cuántos y sobre qué población. Motivo, medido en c.21036: 20 verdes desde el 21-oct,
// 0 cierres, ~124 CIEGO por pasada.
//
// «Pendiente» = un commit del Issue cuya última marca es CIEGO o SIN-LEER y que ESTA pasada no ha
// vuelto a juzgar (o ha vuelto a salir SIN-LEER: el vigía no supo mirar). El workflow vuelve a juzgar
// todos los pendientes en cada pasada (`--pendientes previos.txt`), así que si un CIEGO re-juzgado
// siguiera contando como pendiente, la decisión no cambiaría nada: medido el 27-oct sobre #2641,
// 98 pendientes, todos CIEGO, 0 cierres en 213 comentarios.
//
// Ninguna otra condición cambia (regla 41): punta no VERDE, SIN-LEER en la pasada, «sustituido» en
// espera y la reapertura con un CIEGO nuevo siguen como estaban. Sin red: los casos se SIEMBRAN.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  veredictoDeCommit, accionDelIssue, marcaDeAviso, marcaDeCierre, topeDeCorridaDelCI, JOBS_DEL_CI,
} from '../scripts/vigia-silencio-de-main.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Volver a la regla de 1393d: un CIEGO de la pasada bloquea el cierre.
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: "  else if (sinLeer.length) motivo = `${sinLeer.length} commit(s) SIN-LEER en esta pasada`;",
    a: "  else if (ciegos.length) motivo = `${ciegos.length} commit(s) CIEGO o SIN-LEER en esta pasada`;",
    cae: 'punta VERDE con CIEGO en la pasada CIERRA',
  },
  {
    // Un CIEGO re-juzgado sigue pendiente: el #2641 de hoy no cerraría nunca.
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: "  const juzgados = new Set(veredictos.filter((v) => v.estado === 'VERDE' || v.estado === 'ROJO' || v.estado === 'CIEGO').map((v) => v.sha));",
    a: "  const juzgados = new Set(veredictos.filter((v) => v.estado === 'VERDE' || v.estado === 'ROJO').map((v) => v.sha));",
    cae: 'un CIEGO pendiente que la pasada vuelve a juzgar CIEGO ya no bloquea',
  },
  {
    // Cerrar callando los CIEGO: la mitad «se DICEN» de la decisión.
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: '      ...declarados,\n',
    a: '',
    cae: 'el cierre DECLARA cuántos CIEGO y sobre qué población',
  },
  {
    // Un pendiente que la pasada no vuelve a juzgar deja de bloquear.
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: '  else if (pendientes.length) motivo =',
    a: '  else if (false) motivo =',
    cae: 'un pendiente que la pasada NO vuelve a juzgar sigue SIN cerrar',
  },
  {
    // Con el Issue cerrado, un CIEGO nuevo se pierde en silencio en vez de reabrir.
    fichero: 'scripts/vigia-silencio-de-main.mjs',
    de: "  if (!motivo && estado !== 'abierto' && ciegosNuevos.length)",
    a: '  if (false)',
    cae: 'con el Issue CERRADO, un CIEGO nuevo lo REABRE',
  },
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AHORA = '2026-10-27T16:00:00Z';
const TOPE = topeDeCorridaDelCI(fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'ci.yml'), 'utf8'));
const job = (name, conclusion) => ({ name, status: 'completed', conclusion });
const run = (conclusion) => ({ status: 'completed', conclusion, created_at: '2026-10-27T15:55:00Z', html_url: 'https://x/run' });
const VERDE = (sha) => veredictoDeCommit({ sha, run: run('success'), jobs: JOBS_DEL_CI.map((n) => job(n, 'success')), ahora: AHORA, topeMin: TOPE });
const ROJO = (sha) => veredictoDeCommit({ sha, run: run('failure'), jobs: [job(JOBS_DEL_CI[0], 'failure')], ahora: AHORA, topeMin: TOPE });
const CIEGO = (sha) => veredictoDeCommit({ sha, run: run('cancelled'), jobs: [], ahora: AHORA, topeMin: TOPE });
const SIN_LEER = (sha) => veredictoDeCommit({ sha, run: run('success'), jobs: null, ahora: AHORA, topeMin: TOPE });
const P = 'a'.repeat(40); // la punta
const V = 'b'.repeat(40); // un CIEGO viejo, ya avisado
const W = 'c'.repeat(40); // un CIEGO nuevo
const X = 'd'.repeat(40); // un pendiente que la pasada no vuelve a juzgar
// Sin `linea`: ningún CIEGO se absuelve, que es justo lo que se quiere probar.
const pasada = (veredictos, punta = P) => ({ veredictos, ahora: AHORA, origen: 'siembra', urlDelRun: 'https://x/p', punta });

test('SCRUM-1393g · los cebos son lo que dicen ser (si no, el resto no prueba nada)', () => {
  assert.deepEqual([VERDE(P), ROJO(P), CIEGO(P), SIN_LEER(P)].map((v) => v.estado), ['VERDE', 'ROJO', 'CIEGO', 'SIN-LEER']);
});

test('SCRUM-1393g · punta VERDE con CIEGO en la pasada CIERRA', () => {
  const a = accionDelIssue(pasada([CIEGO(W), VERDE(P)]), { estado: 'abierto' });
  assert.deepEqual(a.pasos, ['comentar', 'cerrar'], a.motivo);
  assert.ok(a.cuerpo.includes(marcaDeAviso(CIEGO(W))), 'el CIEGO nuevo se avisa en el mismo comentario');
  assert.ok(a.cuerpo.includes(marcaDeCierre(P)), 'lleva la marca de cierre');
  assert.doesNotMatch(a.cuerpo, /@claude/i);
});

test('SCRUM-1393g · un CIEGO pendiente que la pasada vuelve a juzgar CIEGO ya no bloquea', () => {
  const a = accionDelIssue(pasada([CIEGO(V), VERDE(P)]), { previos: marcaDeAviso(CIEGO(V)), estado: 'abierto' });
  assert.deepEqual(a.pasos, ['comentar', 'cerrar'], a.motivo);
  assert.ok(!a.cuerpo.includes(marcaDeAviso(CIEGO(V))), 'ya avisado: no se vuelve a avisar');
});

test('SCRUM-1393g · el cierre DECLARA cuántos CIEGO y sobre qué población', () => {
  const a = accionDelIssue(pasada([CIEGO(V), CIEGO(W), VERDE(P)]), { previos: marcaDeAviso(CIEGO(V)), estado: 'abierto' });
  assert.deepEqual(a.pasos, ['comentar', 'cerrar'], a.motivo);
  const cierre = a.cuerpo.slice(a.cuerpo.indexOf('Vigía de main · CERRADO'));
  assert.match(cierre, /\b2 CIEGO sin absolver de 3 commits mirados en esta pasada\b/);
  assert.ok(cierre.includes(V.slice(0, 12)) && cierre.includes(W.slice(0, 12)), 'nombra los dos');
  assert.match(cierre, /c\.21059/, 'cita la decisión');
  assert.match(cierre, /3 commits mirados · 0 rojos · 2 ciegos \(sin verificar\) · 0 corriendo · 0 sin leer · 1 verdes/);
  assert.match(a.motivo, /2 CIEGO declarados/);
  // y sin CIEGO no declara nada (el cierre de 1393d, intacto)
  const limpio = accionDelIssue(pasada([VERDE(P)]), { estado: 'abierto' });
  assert.deepEqual(limpio.pasos, ['comentar', 'cerrar']);
  assert.doesNotMatch(limpio.cuerpo, /CIEGO sin absolver/);
});

test('SCRUM-1393g · un pendiente que la pasada NO vuelve a juzgar sigue SIN cerrar', () => {
  const a = accionDelIssue(pasada([CIEGO(V), VERDE(P)]), { previos: `${marcaDeAviso(CIEGO(V))}\n${marcaDeAviso(CIEGO(X))}`, estado: 'abierto' });
  assert.ok(!a.pasos.includes('cerrar'), a.motivo);
  assert.match(a.motivo, /1 CIEGO pendiente\(s\) en el Issue: dddddddddddd/);
  // y uno que vuelve SIN-LEER (el vigía no supo mirar) tampoco cierra
  const sl = accionDelIssue(pasada([SIN_LEER(X), VERDE(P)]), { previos: marcaDeAviso(CIEGO(X)), estado: 'abierto' });
  assert.ok(!sl.pasos.includes('cerrar'), sl.motivo);
  assert.match(sl.motivo, /SIN-LEER en esta pasada/);
});

test('SCRUM-1393g · punta ROJA o CIEGA sigue sin cerrar, haya o no CIEGO', () => {
  for (const punta of [ROJO(P), CIEGO(P)]) {
    const a = accionDelIssue(pasada([CIEGO(W), punta]), { estado: 'abierto' });
    assert.deepEqual(a.pasos, ['comentar'], a.motivo);
    assert.match(a.motivo, new RegExp(`la punta ${P.slice(0, 12)} sale ${punta.estado}`));
  }
});

test('SCRUM-1393g · con el Issue CERRADO, un CIEGO nuevo lo REABRE', () => {
  const previos = `${marcaDeAviso(ROJO(V))}\n${marcaDeCierre(V)}`;
  const a = accionDelIssue(pasada([CIEGO(W), VERDE(P)]), { previos, estado: 'cerrado' });
  assert.deepEqual(a.pasos, ['reabrir', 'comentar'], a.motivo);
  assert.ok(a.cuerpo.includes(marcaDeAviso(CIEGO(W))));
  // sin Issue, lo crea
  assert.deepEqual(accionDelIssue(pasada([CIEGO(W), VERDE(P)]), { estado: 'ninguno' }).pasos, ['crear']);
  // y uno YA avisado no reabre: no hay nada nuevo que decir
  const ya = accionDelIssue(pasada([CIEGO(W), VERDE(P)]), { previos: `${marcaDeAviso(CIEGO(W))}\n${marcaDeCierre(V)}`, estado: 'cerrado' });
  assert.deepEqual(ya.pasos, [], ya.motivo);
});
