// tests/scrum1393e-vigia-absuelve-sustituidos.test.mjs — SCRUM-1393e
//
// La única excepción a «un CIEGO nunca se absuelve» (decisión del fundador del 21-oct, opción (a)):
// el CIEGO «sustituido» (run del CI cancelado con 0 jobs, que GitHub cancela al llegar el siguiente
// commit) lo absuelve un VERDE que lo CONTIENE en la línea de primer padre, y el cierre lo lista. Con
// un descendiente aún CORRIENDO, espera sin avisar ni reabrir (orden del orquestador). Todos los
// casos se SIEMBRAN aquí, sin red. Lo que sólo se ve en GitHub (que la API dé 0 jobs al cancelar por
// sustitución) es CIEGO declarado en el registro.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  veredictoDeCommit, accionDelIssue, absolucionDeSustituidos, bajarPorSustituidos, marcaDeAviso, marcaDeCierre,
  topeDeCorridaDelCI, JOBS_DEL_CI, CAUSA_SUSTITUIDO,
} from '../scripts/vigia-silencio-de-main.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOTOR = path.join(RAIZ, 'scripts', 'vigia-silencio-de-main.mjs');
const AHORA = '2026-10-21T12:00:00Z';
const TOPE = topeDeCorridaDelCI(fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'ci.yml'), 'utf8'));
const job = (name, conclusion) => ({ name, status: 'completed', conclusion });
const run = (conclusion, status = 'completed') => ({ status, conclusion, created_at: '2026-10-21T11:55:00Z', html_url: 'https://x/run' });
const juez = (sha, r, jobs) => veredictoDeCommit({ sha, run: r, jobs, ahora: AHORA, topeMin: TOPE });
const VERDE = (sha) => juez(sha, run('success'), JOBS_DEL_CI.map((n) => job(n, 'success')));
const ROJO = (sha) => juez(sha, run('failure'), [job(JOBS_DEL_CI[0], 'failure')]);
const SUSTITUIDO = (sha) => juez(sha, run('cancelled'), []);
const CANCELADO_CON_JOBS = (sha) => juez(sha, run('cancelled'), JOBS_DEL_CI.map((n) => job(n, 'cancelled')));
const CORRIENDO = (sha) => juez(sha, run(null, 'in_progress'), null);
const P = 'a'.repeat(40); // la punta
const V = 'b'.repeat(40); // el commit sustituido, padre de la punta
const W = 'c'.repeat(40); // un commit de otra rama, o más viejo, según el caso
const LINEA = [P, V, W]; // `git rev-list --first-parent P`: la punta primero
const pasada = (veredictos, linea = LINEA, punta = P) => ({ veredictos, ahora: AHORA, origen: 'siembra', urlDelRun: 'https://x/p', punta, linea });

test('SCRUM-1393e · los cebos son lo que dicen ser, y la causa sale del DATO (conclusión + 0 jobs), no del texto', () => {
  assert.deepEqual([VERDE(P), ROJO(P), SUSTITUIDO(V), CANCELADO_CON_JOBS(V), CORRIENDO(P)].map((v) => v.estado), ['VERDE', 'ROJO', 'CIEGO', 'CIEGO', 'CORRIENDO']);
  assert.equal(SUSTITUIDO(V).causa, CAUSA_SUSTITUIDO);
  assert.equal(CANCELADO_CON_JOBS(V).causa, null, 'cancelado CON trabajo: no es sustitución');
  assert.equal(juez(V, run('failure'), []).causa, null, '0 jobs pero no cancelado');
  assert.equal(juez(V, run('skipped'), []).causa, null);
  assert.equal(juez(V, null, null).causa, null, 'sin run');
  assert.equal(juez(V, run(null, 'queued'), null).causa ?? null, null);
  // el motivo es el mismo texto con o sin causa: lo que decide es el campo
  assert.equal(SUSTITUIDO(V).motivo, juez(V, { ...run('cancelled') }, []).motivo);
});

test('SCRUM-1393e · SIEMBRA: sustituido + verde posterior que lo contiene → CIERRA y lo LISTA como absuelto', () => {
  const a = accionDelIssue(pasada([SUSTITUIDO(V), VERDE(P)]), { estado: 'abierto' });
  assert.deepEqual(a.pasos, ['comentar', 'cerrar']);
  assert.ok(a.cuerpo.includes(`\`${V.slice(0, 12)}\` — no verificado, absuelto por el verde de \`${P.slice(0, 12)}\``), a.cuerpo);
  assert.ok(a.cuerpo.includes(marcaDeCierre(P)));
  assert.ok(!a.cuerpo.includes(marcaDeAviso(SUSTITUIDO(V))), 'no se avisa como CIEGO lo que se absuelve');
  assert.doesNotMatch(a.cuerpo, /@claude/i);
  // también si ya estaba PENDIENTE en el Issue y esta pasada lo vuelve a juzgar
  const pendiente = accionDelIssue(pasada([SUSTITUIDO(V), VERDE(P)]), { previos: marcaDeAviso(SUSTITUIDO(V)), estado: 'abierto' });
  assert.deepEqual(pendiente.pasos, ['comentar', 'cerrar']);
  assert.match(pendiente.cuerpo, /absuelto por el verde/);
});

test('SCRUM-1393e · SIEMBRA: un cancelado CON jobs NO cierra, aunque la punta salga verde', () => {
  const a = accionDelIssue(pasada([CANCELADO_CON_JOBS(V), VERDE(P)]), { estado: 'abierto' });
  assert.deepEqual(a.pasos, ['comentar']);
  assert.ok(a.cuerpo.includes(marcaDeAviso(CANCELADO_CON_JOBS(V))));
  assert.doesNotMatch(a.cuerpo, /absuelto/);
});

test('SCRUM-1393e · SIEMBRA: un sustituido SIN verde posterior no cierra — y si el posterior es ROJO, avisa y reabre', () => {
  const rojo = accionDelIssue(pasada([SUSTITUIDO(V), ROJO(P)]), { previos: marcaDeCierre(W), estado: 'cerrado' });
  assert.deepEqual(rojo.pasos, ['reabrir', 'comentar']);
  assert.ok(rojo.cuerpo.includes(marcaDeAviso(SUSTITUIDO(V))), 'juzgado y sin verde que lo contenga: se avisa');
  // un verde MÁS VIEJO que él (W, debajo en la línea) no lo contiene
  const viejo = accionDelIssue(pasada([VERDE(W), SUSTITUIDO(V), ROJO(P)]), { estado: 'abierto' });
  assert.deepEqual(viejo.pasos, ['comentar']);
  assert.equal(absolucionDeSustituidos([VERDE(W), SUSTITUIDO(V)], LINEA).absueltos.size, 0);
});

test('SCRUM-1393e · SIEMBRA: un verde que NO lo contiene (otra rama) no lo absuelve, ni cierra', () => {
  // la punta P está verde, pero en su línea no está V: V es de otra rama
  const otraRama = accionDelIssue(pasada([SUSTITUIDO(V), VERDE(P)], [P, W]), { estado: 'abierto' });
  assert.deepEqual(otraRama.pasos, ['comentar']);
  assert.match(otraRama.motivo, /CIEGO o SIN-LEER en esta pasada/);
  // un verde W que no está en la línea no absuelve a V, que sí está
  assert.equal(absolucionDeSustituidos([VERDE(W), SUSTITUIDO(V)], [P, V]).absueltos.size, 0);
  // sin línea, nada se absuelve (lo que hacía 1393d)
  assert.deepEqual(accionDelIssue(pasada([SUSTITUIDO(V), VERDE(P)], null), { estado: 'abierto' }).pasos, ['comentar']);
});

test('SCRUM-1393e · SIEMBRA: con el sustituto aún CORRIENDO, ESPERA — ni reabre ni comenta, y no cierra', () => {
  const cerrado = accionDelIssue(pasada([SUSTITUIDO(V), CORRIENDO(P)]), { previos: marcaDeCierre(W), estado: 'cerrado' });
  assert.deepEqual(cerrado.pasos, [], cerrado.motivo);
  assert.match(cerrado.motivo, /en espera de su sustituto/);
  const abierto = accionDelIssue(pasada([SUSTITUIDO(V), CORRIENDO(P)]), { estado: 'abierto' });
  assert.deepEqual(abierto.pasos, []);
  // la espera no tapa otro CIEGO de la misma pasada
  assert.deepEqual(accionDelIssue(pasada([CANCELADO_CON_JOBS(W), SUSTITUIDO(V), CORRIENDO(P)]), { estado: 'cerrado' }).pasos, ['reabrir', 'comentar']);
  // con un verde que lo contiene Y uno corriendo más arriba, manda el verde (más cercano)
  const linea = [P, W, V];
  assert.equal(absolucionDeSustituidos([SUSTITUIDO(V), VERDE(W), CORRIENDO(P)], linea).absueltos.get(V), W);
});

test('SCRUM-1393e · SIEMBRA: la punta de CONTEXTO sin run no se avisa, pero tampoco deja cerrar', () => {
  const sinRun = { ...juez(P, null, null), contexto: true };
  assert.equal(sinRun.estado, 'CIEGO');
  const a = accionDelIssue(pasada([VERDE(W), sinRun], [P, W]), { previos: marcaDeCierre(W), estado: 'cerrado' });
  assert.deepEqual(a.pasos, [], a.motivo);
  assert.match(a.motivo, /la punta .* sale CIEGO/);
  // la misma punta, sin la marca de contexto (venía en la lista), sí se avisa
  assert.deepEqual(accionDelIssue(pasada([VERDE(W), juez(P, null, null)], [P, W]), { previos: marcaDeCierre(W), estado: 'cerrado' }).pasos, ['reabrir', 'comentar']);
  // y una punta de contexto VERDE cierra como cualquier otra
  assert.deepEqual(accionDelIssue(pasada([SUSTITUIDO(V), { ...VERDE(P), contexto: true }]), { estado: 'abierto' }).pasos, ['comentar', 'cerrar']);
});

test('SCRUM-1393e · el verde que absuelve es el MÁS CERCANO de los que lo contienen', () => {
  const X = 'd'.repeat(40);
  const { absueltos } = absolucionDeSustituidos([VERDE(P), VERDE(X), SUSTITUIDO(V)], [P, X, V]);
  assert.equal(absueltos.get(V), X);
});

test('SCRUM-1393e · la bajada por la línea juzga los sustituidos de debajo de un verde y para en el primero que no lo es', async () => {
  const [A, B, C, D, E] = ['1', '2', '3', '4', '5'].map((c) => c.repeat(40));
  const linea = [A, B, C, D, E];
  const github = { [B]: SUSTITUIDO(B), [C]: SUSTITUIDO(C), [D]: VERDE(D), [E]: SUSTITUIDO(E) };
  const veredictos = [VERDE(A)];
  const pedidos = [];
  await bajarPorSustituidos(veredictos, linea, async (sha) => { pedidos.push(sha); veredictos.push(github[sha]); return github[sha]; });
  assert.deepEqual(pedidos, [B, C, D], 'baja por B y C, para en D (verde) y no llega a E');
  const a = accionDelIssue(pasada(veredictos, linea, A), { estado: 'abierto' });
  assert.deepEqual(a.pasos, ['comentar', 'cerrar']);
  assert.equal((a.cuerpo.match(/absuelto por el verde de/g) ?? []).length, 2);
  // también para en un CIEGO que NO es sustitución (cancelado con trabajo): debajo ya no son suyos
  const conTrabajo = { [B]: SUSTITUIDO(B), [C]: CANCELADO_CON_JOBS(C), [D]: SUSTITUIDO(D) };
  const otros = [];
  await bajarPorSustituidos([VERDE(A)], linea, async (sha) => { otros.push(sha); return conTrabajo[sha]; });
  assert.deepEqual(otros, [B, C], 'para en C y no pide D');
  // un commit que no está en la línea no hace bajar nada
  const nada = [];
  await bajarPorSustituidos([VERDE(W)], linea, async (sha) => { nada.push(sha); return SUSTITUIDO(sha); });
  assert.deepEqual(nada, []);
});

test('SCRUM-1393e · consola: `--pendientes` lista los pendientes y `--accion-del-issue --linea` absuelve', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1393e-'));
  try {
    const env = { ...process.env, URL_RUN: 'https://x/p' };
    for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete env[k];
    const f = (n, t) => { fs.writeFileSync(path.join(dir, n), t); return path.join(dir, n); };
    const pend = execFileSync(process.execPath, [MOTOR, '--pendientes', f('p.txt', `${marcaDeAviso(SUSTITUIDO(V))}\n${marcaDeAviso(ROJO(W))}`)], { env, encoding: 'utf8' });
    assert.equal(pend.trim(), V);
    const accion = (linea) => execFileSync(process.execPath, [MOTOR, '--accion-del-issue', f('v.json', JSON.stringify({ ahora: AHORA, origen: 'siembra', veredictos: [SUSTITUIDO(V), VERDE(P)] })),
      '--punta', P, ...(linea ? ['--linea', f('l.txt', linea.join('\n'))] : []), '--estado-issue', 'abierto', '--previos', f('q.txt', ''), '--cuerpo', path.join(dir, 'c.md')], { env, encoding: 'utf8' });
    assert.match(accion(LINEA), /^PASOS=comentar,cerrar$/m);
    assert.match(fs.readFileSync(path.join(dir, 'c.md'), 'utf8'), /absuelto por el verde/);
    assert.match(accion(null), /^PASOS=comentar$/m, 'sin línea no absuelve');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-1393e · el workflow lee el Issue ANTES de juzgar y le da al motor la punta, los pendientes y la línea', () => {
  const yml = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'vigia-de-main.yml'), 'utf8')
    .split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n');
  const leer = yml.indexOf('- name: Leer el Issue');
  const juzgar = yml.indexOf('- name: Juzgar los commits');
  const avisar = yml.indexOf('- name: Avisar o cerrar en el Issue');
  assert.ok(leer > 0 && leer < juzgar && juzgar < avisar, `orden de los pasos: ${leer} ${juzgar} ${avisar}`);
  assert.match(yml, /git rev-list --first-parent "\$PUNTA" > linea\.txt/);
  assert.match(yml, /--pendientes previos\.txt >> commits\.txt/);
  assert.match(yml, /--commits commits\.txt --contexto "\$PUNTA" --linea linea\.txt --json vigia\.json/);
  assert.match(yml, /--accion-del-issue vigia\.json --punta "\$PUNTA" --linea linea\.txt/);
  for (const v of ['NUM', 'ESTADO', 'PUNTA']) assert.match(yml.slice(avisar), new RegExp(`^\\s+${v}: \\$\\{\\{ steps\\.(issue|juez)\\.outputs\\.`, 'm'), `el paso de avisar recibe ${v}`);
});
