// tests/scrum1393c-vigia-de-main-por-commit.test.mjs — SCRUM-1393c
//
// El modo por commit de `scripts/vigia-silencio-de-main.mjs`, que llama `.github/workflows/vigia-de-main.yml`.
// Sin red: se ejercitan las funciones puras. Los positivos se SIEMBRAN aquí (un rojo y dos CIEGO
// fabricados), no se toman prestados del árbol: un positivo prestado se jubila el día que alguien
// arregla el defecto. Y se comprueba que sin ellos el instrumento dice CIEGO, no verde.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  veredictoDeCommit, salidaDeCommits, sueloPorCommit, informeDeCommits, cuerpoDelAviso, marcaDeAviso,
  topeDeCorridaDelCI, JOBS_DEL_CI, SALIDA_OK, SALIDA_AVISO, SALIDA_CIEGO,
} from '../scripts/vigia-silencio-de-main.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AHORA = '2026-10-21T12:00:00Z';
const TOPE = topeDeCorridaDelCI(fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'ci.yml'), 'utf8'));
const job = (name, conclusion, status = 'completed') => ({ name, status, conclusion });
const verdes = () => JOBS_DEL_CI.map((n) => job(n, 'success'));
const run = (conclusion, status = 'completed', creado = '2026-10-21T11:55:00Z') => ({ status, conclusion, created_at: creado, html_url: 'https://x/run' });
const juzgar = (sha, r, jobs) => veredictoDeCommit({ sha, run: r, jobs, ahora: AHORA, topeMin: TOPE });

test('SCRUM-1393c · el tope sale de ci.yml y no está vacío (población del instrumento)', () => {
  assert.ok(Number.isInteger(TOPE) && TOPE > 0, `tope derivado de ci.yml: ${TOPE}`);
  assert.equal(JOBS_DEL_CI.length, 6, 'los seis jobs del CI declarados en JOBS_DE_MAIN');
  assert.equal(topeDeCorridaDelCI('jobs:\n  a:\n    runs-on: x\n'), null, 'sin timeout-minutes: null, no cero');
});

test('SCRUM-1393c · SIEMBRA: un rojo, dos CIEGO y un colgado fabricados salen como tales; el verde calla', () => {
  const lote = [
    juzgar('a'.repeat(40), run('success'), verdes()),
    juzgar('b'.repeat(40), run('failure'), [...verdes().slice(1), job(JOBS_DEL_CI[0], 'failure')]),
    juzgar('c'.repeat(40), run('cancelled'), []),
    juzgar('d'.repeat(40), null, null),
    juzgar('e'.repeat(40), run(null, 'queued', '2026-10-21T06:00:00Z'), null),
  ];
  assert.deepEqual(lote.map((v) => v.estado), ['VERDE', 'ROJO', 'CIEGO', 'CIEGO', 'CIEGO']);
  assert.match(lote[2].motivo, /0 jobs/);
  assert.match(lote[3].motivo, /no corrió/);
  assert.match(lote[4].motivo, /colgado o en cola/);
  assert.equal(salidaDeCommits(lote), SALIDA_AVISO);
  const texto = informeDeCommits(lote, { ahora: AHORA, origen: 'siembra' });
  assert.match(texto, /^POBLACION commits=5 /);
  assert.match(texto, /5 commits mirados · 1 rojos · 3 ciegos \(sin verificar\) · 0 corriendo · 0 sin leer · 1 verdes/);
});

test('SCRUM-1393c · los CIEGO de un job: cancelado, saltado, con timeout o ausente NO son verde', () => {
  for (const c of ['cancelled', 'skipped', 'timed_out']) {
    const v = juzgar('f'.repeat(40), run('success'), [...verdes().slice(1), job(JOBS_DEL_CI[0], c)]);
    assert.equal(v.estado, 'CIEGO', `job ${c}`);
  }
  assert.equal(juzgar('f'.repeat(40), run('success'), verdes().slice(1)).estado, 'CIEGO', 'job declarado ausente');
  assert.equal(juzgar('f'.repeat(40), run('failure'), verdes()).estado, 'CIEGO', 'run en failure con todos sus jobs en success');
});

test('SCRUM-1393c · QUITANDO la siembra: sin commits sale CIEGO (2), y un CORRIENDO solo no es verde ni aviso', () => {
  assert.equal(salidaDeCommits([]), SALIDA_CIEGO, 'cero commits mirados es «no he mirado»');
  assert.equal(salidaDeCommits([juzgar('a'.repeat(40), run('success'), verdes())]), SALIDA_OK);
  const corriendo = juzgar('g'.repeat(40), run(null, 'in_progress'), null);
  assert.equal(corriendo.estado, 'CORRIENDO');
  assert.equal(salidaDeCommits([corriendo]), SALIDA_OK, 'corriendo dentro del tope no avisa: se declara');
  const sinTope = veredictoDeCommit({ sha: 'h'.repeat(40), run: run(null, 'in_progress'), jobs: null, ahora: AHORA, topeMin: null });
  assert.equal(sinTope.estado, 'SIN-LEER');
  assert.equal(salidaDeCommits([sinTope]), SALIDA_CIEGO);
});

test('SCRUM-1393c · el suelo reconoce sus cebos, y un juez ciego NO pasa el suelo', () => {
  assert.equal(sueloPorCommit().ok, true, sueloPorCommit().detalle);
  assert.equal(sueloPorCommit(() => ({ estado: 'VERDE' })).ok, false, 'un juez que siempre dice verde tiene que salir CIEGO');
  assert.equal(sueloPorCommit(() => ({ estado: 'ROJO' })).ok, false, 'uno que siempre grita, también');
});

test('SCRUM-1393c · el aviso: sólo lo nuevo, con marca, sin despertar a Claude, y vacío si ya se dijo', () => {
  const rojo = juzgar('b'.repeat(40), run('failure'), [job(JOBS_DEL_CI[0], 'failure')]);
  const ciego = juzgar('c'.repeat(40), run('cancelled'), []);
  const verde = juzgar('a'.repeat(40), run('success'), verdes());
  const j = { veredictos: [rojo, ciego, verde], ahora: AHORA, origen: 'siembra', urlDelRun: 'https://x/p' };
  const cuerpo = cuerpoDelAviso(j);
  assert.ok(cuerpo.includes(marcaDeAviso(rojo)) && cuerpo.includes(marcaDeAviso(ciego)));
  assert.ok(!cuerpo.includes(marcaDeAviso(verde)), 'un verde no se nombra');
  assert.doesNotMatch(cuerpo, /@claude/i);
  assert.equal(cuerpoDelAviso(j, cuerpo), '', 'lo ya avisado no se repite');
  assert.ok(cuerpoDelAviso(j, marcaDeAviso(rojo)).includes(marcaDeAviso(ciego)), 'sólo se calla lo que tiene marca');
  assert.equal(cuerpoDelAviso({ ...j, veredictos: [verde] }), '', 'todo verde: nada que decir');
});
