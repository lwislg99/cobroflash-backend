// tests/scrum1393f-vigia-absuelve-sin-run.test.mjs — SCRUM-1393f
//
// Decisión del fundador del 21-oct («2-A»): un commit SIN NINGÚN run porque el siguiente le quitó el
// sitio en la cola del CI (en `main` no se cancela el run en curso, y el commit nuevo sustituye al
// que espera) se absuelve igual que el «sustituido» de 1393e, siempre que un commit posterior que
// lo contiene salga VERDE. Lo que separa ese «sin run» de un «GitHub no disparó» es el dato del
// SUCESOR inmediato en la línea de primer padre: si él tiene run, a éste lo sustituyeron; si él
// tampoco, no se sabe, y sigue CIEGO. Todos los casos se SIEMBRAN aquí, sin red.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  veredictoDeCommit, accionDelIssue, absolucionDeSustituidos, bajarPorSustituidos, juzgarSucesoresDeSinRun,
  sinRunPorSustitucion, conRun, marcaDeAviso, marcaDeCierre, topeDeCorridaDelCI, JOBS_DEL_CI,
} from '../scripts/vigia-silencio-de-main.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AHORA = '2026-10-21T12:00:00Z';
const TOPE = topeDeCorridaDelCI(fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'ci.yml'), 'utf8'));
const job = (name, conclusion) => ({ name, status: 'completed', conclusion });
const run = (conclusion, status = 'completed', created_at = '2026-10-21T11:55:00Z') => ({ status, conclusion, created_at, html_url: 'https://x/run' });
const juez = (sha, r, jobs) => veredictoDeCommit({ sha, run: r, jobs, ahora: AHORA, topeMin: TOPE });
const VERDE = (sha) => juez(sha, run('success'), JOBS_DEL_CI.map((n) => job(n, 'success')));
const ROJO = (sha) => juez(sha, run('failure'), [job(JOBS_DEL_CI[0], 'failure')]);
const SUSTITUIDO = (sha) => juez(sha, run('cancelled'), []);
const CORRIENDO = (sha) => juez(sha, run(null, 'in_progress'), null);
const ATASCADO = (sha) => juez(sha, run(null, 'in_progress', '2026-10-20T00:00:00Z'), null); // CIEGO con run
const SIN_RUN = (sha) => juez(sha, null, null);
const P = 'a'.repeat(40); // la punta
const S = 'b'.repeat(40); // el commit sin run, padre de la punta
const W = 'c'.repeat(40); // otro commit (de otra rama o más viejo, según el caso)
const LINEA = [P, S, W]; // `git rev-list --first-parent P`: la punta primero
const pasada = (veredictos, linea = LINEA, punta = P) => ({ veredictos, ahora: AHORA, origen: 'siembra', urlDelRun: 'https://x/p', punta, linea });

test('SCRUM-1393f · los cebos son lo que dicen ser: «sin run» es un DATO propio, y no toca la causa de 1393e', () => {
  assert.deepEqual([SIN_RUN(S), ATASCADO(S), SUSTITUIDO(S)].map((v) => v.estado), ['CIEGO', 'CIEGO', 'CIEGO']);
  assert.equal(SIN_RUN(S).sinRun, true);
  assert.equal(SIN_RUN(S).causa, null, 'la causa «sustituido» sigue siendo sólo el cancelado con 0 jobs');
  for (const v of [VERDE(S), ROJO(S), SUSTITUIDO(S), CORRIENDO(S), ATASCADO(S)]) assert.equal(v.sinRun, undefined, v.estado);
  // tiene run: verde, rojo, corriendo y el sustituido; no el sin run, ni el atascado (conservador), ni nada
  assert.deepEqual([VERDE(P), ROJO(P), CORRIENDO(P), SUSTITUIDO(P), ATASCADO(P), SIN_RUN(P), undefined].map(conRun), [true, true, true, true, false, false, false]);
});

test('SCRUM-1393f · SIEMBRA: sin run + sucesor con run VERDE que lo contiene → CIERRA y lo LISTA como absuelto', () => {
  const a = accionDelIssue(pasada([SIN_RUN(S), VERDE(P)]), { estado: 'abierto' });
  assert.deepEqual(a.pasos, ['comentar', 'cerrar'], a.motivo);
  assert.ok(a.cuerpo.includes(`\`${S.slice(0, 12)}\` — no verificado, absuelto por el verde de \`${P.slice(0, 12)}\` · SIN run`), a.cuerpo);
  assert.ok(a.cuerpo.includes(marcaDeCierre(P)));
  assert.ok(!a.cuerpo.includes(marcaDeAviso(SIN_RUN(S))), 'no se avisa como CIEGO lo que se absuelve');
  assert.doesNotMatch(a.cuerpo, /@claude/i);
  // también si ya estaba PENDIENTE en el Issue
  assert.deepEqual(accionDelIssue(pasada([SIN_RUN(S), VERDE(P)]), { previos: marcaDeAviso(SIN_RUN(S)), estado: 'abierto' }).pasos, ['comentar', 'cerrar']);
  // y con el sucesor sustituido (con run) y el verde más arriba: el verde lo contiene
  const linea = [P, W, S];
  const b = accionDelIssue(pasada([SIN_RUN(S), SUSTITUIDO(W), VERDE(P)], linea), { estado: 'abierto' });
  assert.deepEqual(b.pasos, ['comentar', 'cerrar'], b.motivo);
  assert.equal((b.cuerpo.match(/absuelto por el verde de/g) ?? []).length, 2);
});

test('SCRUM-1393f · SIEMBRA: sin run SIN sucesor con run → sigue CIEGO, avisa y no cierra', () => {
  // el sucesor tampoco tiene run: «GitHub no disparó» tiene este aspecto
  const linea = [P, W, S];
  const a = accionDelIssue(pasada([SIN_RUN(S), SIN_RUN(W), VERDE(P)], linea), { previos: marcaDeCierre('e'.repeat(40)), estado: 'cerrado' });
  assert.deepEqual(a.pasos, ['reabrir', 'comentar'], a.motivo);
  assert.ok(a.cuerpo.includes(marcaDeAviso(SIN_RUN(S))));
  assert.doesNotMatch(a.cuerpo, new RegExp(`${S.slice(0, 12)}\` — no verificado`));
  assert.equal(sinRunPorSustitucion(SIN_RUN(S), [SIN_RUN(S), SIN_RUN(W)], linea), false);
  // un sucesor con run ATASCADO (CIEGO por tope) no cuenta como prueba de sustitución
  assert.equal(absolucionDeSustituidos([SIN_RUN(S), ATASCADO(W), VERDE(P)], linea).absueltos.size, 0);
  // el sucesor no juzgado: no se sabe, no se absuelve
  assert.equal(absolucionDeSustituidos([SIN_RUN(S), VERDE(P)], linea).absueltos.size, 0);
  // la punta sin run no tiene sucesor: CIEGO
  assert.equal(sinRunPorSustitucion(SIN_RUN(P), [SIN_RUN(P)], LINEA), false);
});

test('SCRUM-1393f · SIEMBRA: sin run cuyo sucesor está CORRIENDO → ESPERA, ni reabre ni comenta', () => {
  const cerrado = accionDelIssue(pasada([SIN_RUN(S), CORRIENDO(P)]), { previos: marcaDeCierre(W), estado: 'cerrado' });
  assert.deepEqual(cerrado.pasos, [], cerrado.motivo);
  assert.match(cerrado.motivo, /en espera de su sustituto/);
  assert.deepEqual(accionDelIssue(pasada([SIN_RUN(S), CORRIENDO(P)]), { estado: 'abierto' }).pasos, []);
});

test('SCRUM-1393f · SIEMBRA: sin run de OTRA rama → no se absuelve, ni cierra', () => {
  const a = accionDelIssue(pasada([SIN_RUN(S), VERDE(P)], [P, W]), { estado: 'abierto' });
  assert.deepEqual(a.pasos, ['comentar']);
  assert.match(a.motivo, /CIEGO o SIN-LEER en esta pasada/);
  assert.equal(sinRunPorSustitucion(SIN_RUN(S), [SIN_RUN(S), VERDE(P)], [P, W]), false);
  // sin línea, tampoco
  assert.deepEqual(accionDelIssue(pasada([SIN_RUN(S), VERDE(P)], null), { estado: 'abierto' }).pasos, ['comentar']);
  // y un ROJO por encima no lo absuelve
  assert.deepEqual(accionDelIssue(pasada([SIN_RUN(S), ROJO(P)]), { estado: 'abierto' }).pasos, ['comentar']);
});

test('SCRUM-1393f · la bajada sigue por un sin run con sucesor con run, y para en el sin run cuyo sucesor no lo tiene', async () => {
  const [A, B, C, D, E] = ['1', '2', '3', '4', '5'].map((c) => c.repeat(40));
  const linea = [A, B, C, D, E];
  const github = { [B]: SIN_RUN(B), [C]: SUSTITUIDO(C), [D]: SIN_RUN(D), [E]: SIN_RUN(E) };
  const veredictos = [VERDE(A)];
  const pedidos = [];
  await bajarPorSustituidos(veredictos, linea, async (sha) => { pedidos.push(sha); veredictos.push(github[sha]); return github[sha]; });
  // B (sucesor A, verde) sigue; C sustituido sigue; D (sucesor C, con run) sigue; E (sucesor D, sin run) para
  assert.deepEqual(pedidos, [B, C, D, E]);
  const { absueltos } = absolucionDeSustituidos(veredictos, linea);
  assert.deepEqual([...absueltos.keys()].sort(), [B, C, D].sort());
  assert.ok(!absueltos.has(E), 'E: su sucesor D no tiene run');
});

test('SCRUM-1393f · un pendiente sin run cuyo sucesor no está en la pasada: se juzga el sucesor como CONTEXTO', async () => {
  const veredictos = [SIN_RUN(S), { ...VERDE(P), contexto: true }];
  const linea = [P, W, S];
  const pedidos = [];
  await juzgarSucesoresDeSinRun(veredictos, linea, async (sha) => { pedidos.push(sha); const v = SUSTITUIDO(sha); veredictos.push(v); return v; });
  assert.deepEqual(pedidos, [W]);
  assert.equal(veredictos.find((v) => v.sha === W).contexto, true, 'el sucesor juzgado no se avisa por sí');
  const a = accionDelIssue(pasada(veredictos, linea), { previos: marcaDeAviso(SIN_RUN(S)), estado: 'abierto' });
  assert.deepEqual(a.pasos, ['comentar', 'cerrar'], a.motivo);
  // ya juzgado, o la punta, o fuera de la línea: no se pide nada
  const nada = [];
  await juzgarSucesoresDeSinRun([SIN_RUN(S), VERDE(P)], LINEA, async (sha) => { nada.push(sha); return VERDE(sha); });
  await juzgarSucesoresDeSinRun([SIN_RUN(P)], LINEA, async (sha) => { nada.push(sha); return VERDE(sha); });
  await juzgarSucesoresDeSinRun([SIN_RUN(S)], [P, W], async (sha) => { nada.push(sha); return VERDE(sha); });
  assert.deepEqual(nada, []);
});
