// tests/scrum1238c-espera-no-es-fin.test.mjs — SCRUM-1238c · «te está esperando» no sale como «terminó»
//
// `sesion.mjs` (`estadoDeJob`) daba `terminal: true` a todo `state.json` con `firstTerminalAt`, y
// `clasificarAgente` declaraba MUERTA a esa sesión si no tenía `pid`. `firstTerminalAt` es «terminó
// ALGÚN turno»: medido el 29-oct-2026, en 16 de los 38 `state.json` terminales de la máquina es
// anterior a `lastTerminalAt` (la sesión volvió a trabajar y el campo siguió puesto). La forma que
// eso mataba la midió SCRUM-1238: `blocked` + `firstTerminalAt` + `needs` (J2 `4d9f556d`, 28-sep).
//
// 🔴 LOS DOS CONTROLES, y por qué hacen falta los dos: con sólo el de la que espera, el arreglo podría
// ser «ninguna termina», que es la mentira contraria; con sólo el de la que acabó, el defecto sigue.
//
// Las formas son las MEDIDAS, no inventadas: la J2 de `tests/scrum1238b-clase-de-sesion.test.mjs`, y
// una `done` con `firstTerminalAt` < `lastTerminalAt` como las 16 del censo del 29-oct.
//
// Mutaciones que me tumban (base: todo verde):
//   M1 · `terminal: !espera && …` → `terminal: j.firstTerminalAt != null || ESTADOS_TERMINALES.includes(j.state)`
//        (la línea de antes): caen ①, ③ y ⑤.
//   M2 · sin el `if (job.espera === true)` de `clasificarAgente`: cae ②.
//   M3 · `if (!e.espera) continue;` → `if (false) continue;` en `esperandoEnJobs`: cae ④.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { temporal } from './_temporal.mjs';
import { leerJob, clasificarAgente, esperandoEnJobs } from '../scripts/equipo/sesion.mjs';

const PREGUNTA = '1) approve generic error message on dropped connection; 2) decide if six other routes get a ticket';
// J2 `4d9f556d`, 28-sep: terminó un turno preguntando (forma de SCRUM-1238 ③ y de scrum1238b).
const ESPERA = { name: 'sesion-2', state: 'blocked', tempo: 'idle', firstTerminalAt: '2026-09-28T13:50:10.174Z', needs: PREGUNTA };
// Una de las 16 del censo: terminó, volvió a trabajar, y terminó otra vez. Sin pregunta.
const ACABO = { name: 'sesion-1', state: 'done', tempo: 'idle', firstTerminalAt: '2026-10-22T09:49:00.000Z', lastTerminalAt: '2026-10-22T10:37:00.000Z' };
// Reanudada: trabajando otra vez, con el `firstTerminalAt` de su primer turno todavía puesto.
const REANUDADA = { name: 'sesion-3', state: 'working', tempo: 'active', firstTerminalAt: '2026-10-22T09:49:00.000Z' };
const SIN_PID = { id: 'a1238c01', name: 'sesion-2', kind: 'background' };

test('SCRUM-1238c · ① la que ESPERA no es terminal, y su pregunta viaja', () => {
  const e = leerJob(ESPERA);
  assert.equal(e.terminal, false, '🔴 una sesión con `needs` sale TERMINADA: es el defecto entero');
  assert.equal(e.espera, true, '🔴 no se ve que espera');
  assert.equal(e.pregunta, PREGUNTA, '🔴 la pregunta no viaja: se dice que espera pero no QUÉ');
});

test('SCRUM-1238c · ② sin pid, la que espera sale ESPERA — ni MUERTA ni NO-PUDE-MIRAR', () => {
  const c = clasificarAgente(SIN_PID, leerJob(ESPERA));
  assert.equal(c.estado, 'ESPERA', `🔴 «te espera» sale como «${c.estado}»: ${c.motivo}`);
  assert.equal(c.pregunta, PREGUNTA);
});

test('SCRUM-1238c · ③ CONTROL: la que de verdad ACABÓ sigue saliendo MUERTA, y la reanudada no', () => {
  const e = leerJob(ACABO);
  assert.equal(e.terminal, true, '🔴 la mentira contraria: una `done` sin pregunta ha dejado de ser terminal');
  assert.equal(e.espera, false);
  assert.equal(e.cuando, ACABO.lastTerminalAt, 'el «terminó» se fecha con el ÚLTIMO final, no con el primero');
  assert.equal(clasificarAgente(SIN_PID, e).estado, 'MUERTA');
  // Y el proceso sigue mandando: con pid es VIVA aunque el state.json diga `done` (SCRUM-954).
  assert.equal(clasificarAgente({ ...SIN_PID, pid: 4242 }, e).estado, 'VIVA');
  const r = leerJob(REANUDADA);
  assert.equal(r.terminal, false, '🔴 `firstTerminalAt` de un turno viejo vuelve a ser muerte');
  assert.equal(clasificarAgente(SIN_PID, r).estado, 'NO-PUDE-MIRAR');
});

test('SCRUM-1238c · ④ `esperandoEnJobs` DICE la pregunta desde la carpeta, y declara su población', () => {
  const raiz = temporal('yaqu-1238c-jobs-');
  const ahora = Date.parse('2026-10-29T10:00:00.000Z');
  const reciente = '2026-10-29T09:00:00.000Z';
  const sembrar = (id, j) => {
    fs.mkdirSync(path.join(raiz, id));
    fs.writeFileSync(path.join(raiz, id, 'state.json'), JSON.stringify({ ...j, updatedAt: reciente }));
  };
  sembrar('a1238c01', ESPERA);
  sembrar('a1238c02', ACABO);
  sembrar('a1238c03', REANUDADA);
  fs.mkdirSync(path.join(raiz, 'a1238c04'));
  fs.writeFileSync(path.join(raiz, 'a1238c04', 'state.json'), '{ roto');
  const r = esperandoEnJobs(raiz, { ahora, conProceso: new Set(['a1238c03']) });
  assert.equal(r.leido, true);
  assert.deepEqual(r.filas.map((f) => [f.id, f.pregunta, f.conProceso]), [['a1238c01', PREGUNTA, false]],
    '🔴 la lista de las que esperan no es exactamente la que espera');
  assert.match(r.poblacion, /^3 state\.json leídos · 3 tocados en 24 h · 1 ilegibles$/, `población: ${r.poblacion}`);
  assert.deepEqual(r.ilegibles, ['a1238c04'], 'un state.json roto no se calla: se nombra');
});

test('SCRUM-1238c · ⑤ «no pude mirar la carpeta» NO sale como «nadie espera»', () => {
  const r = esperandoEnJobs(path.join(temporal('yaqu-1238c-nada-'), 'no-existe'));
  assert.equal(r.leido, false, '🔴 sin carpeta, el instrumento contesta como si hubiera mirado');
  assert.equal(r.filas, undefined, '🔴 sin carpeta no puede haber una lista, ni vacía');
  // Y el reverso de ①: lo que hay en `needs` cuenta aunque el `state` diga `done`.
  assert.equal(leerJob({ ...ACABO, needs: 'sí o no' }).terminal, false);
});
