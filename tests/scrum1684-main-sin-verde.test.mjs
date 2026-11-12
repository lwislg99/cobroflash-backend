// SCRUM-1684 · la alarma «main sin verde del obligatorio > 48 h», en la §4 (MAIN) del latido.
// Letra del orquestador (10-nov-2026): avisa cuando el último run VERDE del obligatorio sobre main tenga más
// de 48 h, y DISTINGUE ① rojos (nombra el primero) · ② ningún run · ③ no pude leer — ③ nunca silencio ni verde.
// Control positivo por los dos lados: rojo en ①②③ simulados, verde con un run verde fresco, y el borde 47:59 / 48:00.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  alarmaSinVerde, seccionMain, commitsDeCorridas, salidaDe, informe,
  HORAS_SIN_VERDE_DE_MAIN, COMMITS_DE_MAIN, SALIDA_OK, SALIDA_AVISO, SALIDA_CIEGO,
} from '../scripts/equipo/latido.mjs';

const AHORA = Date.parse('2026-11-10T18:00:00Z');
const hace = (h) => new Date(AHORA - h * 36e5).toISOString();
const sha = (s) => s.padEnd(40, '0');
// Un commit de main tal como lo deja `commitsDeCorridas`: su job obligatorio con veredicto y hora de cierre.
const c = (s, conclusion, horas, extra = {}) => ({
  sha: sha(s), cancelada: false,
  checkRuns: [{ name: 'build + tests (con banco desechable)', status: conclusion ? 'completed' : 'in_progress', conclusion, started_at: hace(horas + 0.5), completed_at: conclusion ? hace(horas) : null }],
  ...extra,
});
const cancelado = (s) => ({ sha: sha(s), cancelada: true, checkRuns: [] });

test('SCRUM-1684 · VERDE: un run verde fresco NO avisa y la sección sale OK', () => {
  const commits = [c('aaaa', 'success', 1)];
  assert.equal(alarmaSinVerde({ commits, ahora: AHORA, leidasTodas: false }).caso, 0, 'un verde de hace 1 h con la página llena no es «no sé»: el verde está DENTRO');
  const s = seccionMain({ commits, ahora: AHORA, leidasTodas: false });
  assert.equal(s.pudo, true);
  assert.deepEqual(s.alertas, []);
  assert.match(s.poblacion, /el último verde es aaaa0000 .* hace 1\.0 h\), dentro de las 48 h/);
  assert.equal(salidaDe([s]), SALIDA_OK);
});

test('SCRUM-1684 · borde: 47:59 no avisa, 48:00 sí', () => {
  assert.equal(HORAS_SIN_VERDE_DE_MAIN, 48);
  assert.equal(alarmaSinVerde({ commits: [c('aaaa', 'success', 47 + 59 / 60)], ahora: AHORA, leidasTodas: true }).caso, 0);
  assert.equal(alarmaSinVerde({ commits: [c('aaaa', 'success', 48)], ahora: AHORA, leidasTodas: true }).caso, 2);
});

test('SCRUM-1684 · 🔴 ① hubo runs y están en ROJO: avisa y nombra el PRIMER rojo (el más viejo tras el verde)', () => {
  const commits = [c('rojo3', 'failure', 2), cancelado('canc1'), c('rojo2', 'failure', 20), c('rojo1', 'failure', 49), c('verde', 'success', 50)];
  const a = alarmaSinVerde({ commits, ahora: AHORA, leidasTodas: false });
  assert.equal(a.caso, 1);
  assert.match(a.linea, /caso ① EN ROJO: el último verde es verde000 .*hace 2\.1 días \(50 h\)\); detrás: 3 en ROJO, el PRIMER rojo: rojo1000 · 1 sin terminar/);
  const s = seccionMain({ commits, ahora: AHORA, leidasTodas: false });
  assert.equal(s.pudo, true);
  assert.equal(s.alertas.length, 2, 'la alarma va DELANTE del aviso de siempre («main X en ROJO»), no lo sustituye');
  assert.match(s.alertas[0].linea, /ALARMA · main sin verde del obligatorio en más de 48 h · caso ①/);
  assert.match(s.alertas[1].linea, /main rojo3000 tiene el obligatorio en ROJO/);
  assert.equal(salidaDe([s]), SALIDA_AVISO);
});

test('SCRUM-1684 · 🔴 ② no hubo ningún run: ni después del verde, ni que terminara, ni en absoluto', () => {
  const parada = alarmaSinVerde({ commits: [c('verde', 'success', 72)], ahora: AHORA, leidasTodas: false });
  assert.equal(parada.caso, 2);
  assert.match(parada.linea, /caso ② SIN CORRIDAS: el último verde es verde000 .* no hubo NINGUNA corrida sobre main/);
  // Canceladas y en curso: no son verdes, pero tampoco el rojo de ① (decisión del orquestador, 10-nov).
  const sinTerminar = alarmaSinVerde({ commits: [c('encurso', null, 1), cancelado('canc1'), cancelado('canc2'), c('verde', 'success', 60)], ahora: AHORA, leidasTodas: false });
  assert.equal(sinTerminar.caso, 2);
  assert.match(sinTerminar.linea, /detrás hubo 3 y NINGUNA terminó \(canceladas o en curso\)/);
  // Cero corridas con la lista ENTERA: alarma ②, y la sección lo dice con su población, no ciega.
  const vacia = seccionMain({ commits: commitsDeCorridas([], () => []), ahora: AHORA, leidasTodas: true });
  assert.equal(vacia.pudo, true);
  assert.match(vacia.alertas[0].linea, /caso ② SIN CORRIDAS: la API no tiene NINGUNA corrida/);
  assert.equal(salidaDe([vacia]), SALIDA_AVISO);
});

test('SCRUM-1684 · 🔴 ③ no pude leer: la lista, los jobs de una corrida, o una página LLENA sin verde → CIEGO, nunca ②', () => {
  // La lista no llegó.
  const sinLista = seccionMain({ commits: commitsDeCorridas(undefined, () => []), ahora: AHORA, leidasTodas: false });
  assert.equal(sinLista.pudo, false);
  assert.match(sinLista.motivo, /caso ③ NO PUDE LEER: la lista de corridas .* no llegó.*NO es «no hubo corridas»/);
  // Los jobs de una corrida (delante del verde) no se dejaron leer.
  const sinJobs = alarmaSinVerde({ commits: [{ sha: sha('x'), cancelada: false, checkRuns: undefined }, c('verde', 'success', 1)], ahora: AHORA, leidasTodas: true });
  assert.equal(sinJobs.caso, 3);
  // per_page corto: la página vino llena, todo rojo o sin terminar, y ningún verde dentro.
  const llena = Array.from({ length: COMMITS_DE_MAIN }, (_, i) => (i % 2 ? cancelado(`c${i}`) : c(`r${i}`, 'failure', i)));
  const a = alarmaSinVerde({ commits: llena, ahora: AHORA, leidasTodas: false });
  assert.equal(a.caso, 3, '🔴 «no pude mirar» y «no hay nada» jamás salen iguales: una página llena sin verde es ③');
  assert.match(a.linea, /en las 20 corridas leídas \(la página vino LLENA, per_page=20\) no hay ningún verde \(10 en ROJO/);
  const s = seccionMain({ commits: llena, ahora: AHORA, leidasTodas: false });
  assert.equal(salidaDe([s]), SALIDA_CIEGO);
  assert.match(s.alertas[0].linea, /tiene el obligatorio en ROJO/, 'lo que SÍ se leyó sigue saliendo');
  // CONTROL: la MISMA lista, pero con la API diciendo que no hay más → ya no es ③ sino ①.
  assert.equal(alarmaSinVerde({ commits: llena, ahora: AHORA, leidasTodas: true }).caso, 1);
  // Un verde sin hora de cierre no se da por fresco.
  assert.equal(alarmaSinVerde({ commits: [c('verde', 'success', 1, { checkRuns: [{ name: 'build + tests', status: 'completed', conclusion: 'success' }] })], ahora: AHORA, leidasTodas: true }).caso, 3);
  // Y el informe lo pinta como NO PUDE MIRAR, no como ✅.
  assert.match(informe([s], { ahora: AHORA }), /🔴 MAIN · NO PUDE MIRAR: ALARMA · main sin verde del obligatorio en más de 48 h\? · caso ③/);
});

test('SCRUM-1684 · commitsDeCorridas sigue DETRÁS de los rojos hasta el primer verde, y ahí para', () => {
  const corrida = (s, extra = {}) => ({ id: s, head_sha: sha(s), event: 'push', head_branch: 'main', status: 'completed', conclusion: 'success', ...extra });
  const pedidos = [];
  const jobs = { r2: 'failure', r1: 'failure', v: 'success', viejo: 'success' };
  const jobsDe = (x) => { pedidos.push(x.id); return [{ name: 'build + tests', status: 'completed', conclusion: jobs[x.id], completed_at: hace(1) }]; };
  const commits = commitsDeCorridas([corrida('r2'), corrida('r1'), corrida('v'), corrida('viejo')], jobsDe);
  assert.deepEqual(pedidos, ['r2', 'r1', 'v'], '🔴 parar en el primer ROJO deja la alarma sin la edad del último verde');
});

test('SCRUM-1684 · el latido real PIDE la alarma: main() pasa `leidasTodas` a seccionMain', () => {
  const src = fs.readFileSync(new URL('../scripts/equipo/latido.mjs', import.meta.url), 'utf8');
  assert.match(src, /const leidasTodas = Array\.isArray\(corridas\) && corridas\.length < COMMITS_DE_MAIN;/);
  assert.match(src, /const sMain = seccionMain\(\{ commits, ultimoMerge, ahora, leidasTodas \}\);/);
});
