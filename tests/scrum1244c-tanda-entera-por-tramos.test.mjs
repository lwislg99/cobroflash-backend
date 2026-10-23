// SCRUM-1244c · La tanda entera por tramos (`scripts/tanda-entera-por-tramos.mjs`) distingue «verde» de
// «no llegué a terminar». Lo que este test sostiene, con tramos de MUESTRA sembrados por él mismo:
//   · los dos tramos vistos en verde → VERDE (0), y el recuento es el de los ficheros sembrados;
//   · un tramo cuyo `node --test` MUERE a mitad (el test mata a su propio runner) → ese tramo CIEGO (2), y
//     la pasada CIEGO aunque el otro tramo esté en verde;
//   · un tramo que no se llegó a correr (el comando murió antes de apuntar nada) → CIEGO;
//   · un tramo que pasa del tope de tiempo → se para y sale CIEGO, no verde;
//   · un caído de verdad → ROJO (1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registroDelTramo } from '../scripts/tanda-entera-por-tramos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'tanda-entera-por-tramos.mjs');

const PASA = "import { test } from 'node:test';\ntest('pasa', () => {});\n";
const CAE = "import { test } from 'node:test';\ntest('cae a proposito', () => { throw new Error('sembrado'); });\n";
// Mata al `node --test` que lo ejecuta: lo mismo que le hace el reaper a la tanda entera.
const MATA = "import { test } from 'node:test';\ntest('mata a su runner', () => { process.kill(process.ppid, 'SIGKILL'); });\n";
const TARDA = "import { test } from 'node:test';\ntest('tarda', async () => { await new Promise((ok) => setTimeout(ok, 60000)); });\n";

function sembrar(ficheros) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1244c-'));
  const dir = path.join(raiz, 'tests');
  fs.mkdirSync(dir);
  for (const [nombre, cuerpo] of Object.entries(ficheros)) fs.writeFileSync(path.join(dir, nombre), cuerpo);
  return { raiz, dir };
}

function correr({ raiz, dir }, args, extra = {}) {
  const env = { ...process.env, TANDA_TRAMOS_BASE: path.join(raiz, 'registro'), TANDA_TRAMOS_ARBOL: 'banco-1244c', ...extra };
  for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete env[k];
  const r = spawnSync(process.execPath, [SCRIPT, '--dir', dir, ...args], { cwd: RAIZ, env, encoding: 'utf8', timeout: 120000 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

const limpiar = ({ raiz }) => fs.rmSync(raiz, { recursive: true, force: true });

test('SCRUM-1244c · CONTROL: los dos tramos en verde dan VERDE, con la población sembrada', () => {
  const b = sembrar({ 'a.test.mjs': PASA, 'b.test.mjs': PASA, 'c.test.mjs': PASA, 'd.test.mjs': PASA });
  try {
    assert.equal(correr(b, ['--tramo', '1/2']).status, 0);
    assert.equal(correr(b, ['--tramo', '2/2']).status, 0);
    const r = correr(b, ['--resumen', '2']);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /vistos 2 de 2 \(1, 2\) · 4 ficheros · 4 tests · 4 pass · 0 fail/);
    assert.match(r.out, /VEREDICTO DE LA PASADA: VERDE/);
  } finally { limpiar(b); }
});

test('SCRUM-1244c · 🔴 EL CASO: un tramo cuyo runner muere a mitad sale CIEGO, y la pasada también', () => {
  const b = sembrar({ 'a.test.mjs': PASA, 'b.test.mjs': PASA, 'c.test.mjs': MATA, 'd.test.mjs': PASA });
  try {
    assert.equal(correr(b, ['--tramo', '1/2']).status, 0);
    const t2 = correr(b, ['--tramo', '2/2']);
    assert.equal(t2.status, 2, t2.out);
    assert.match(t2.out, /CIEGO · sin recuento/);
    const r = correr(b, ['--resumen', '2']);
    assert.equal(r.status, 2, r.out);
    assert.match(r.out, /VEREDICTO DE LA PASADA: CIEGO/);
    assert.doesNotMatch(r.out, /VEREDICTO DE LA PASADA: VERDE/);
  } finally { limpiar(b); }
});

test('SCRUM-1244c · 🔴 un tramo que no llegó a apuntar nada deja la pasada CIEGA aunque lo visto sea verde', () => {
  const b = sembrar({ 'a.test.mjs': PASA, 'b.test.mjs': PASA, 'c.test.mjs': PASA, 'd.test.mjs': PASA });
  try {
    assert.equal(correr(b, ['--tramo', '1/2']).status, 0);
    const r = correr(b, ['--resumen', '2']);
    assert.equal(r.status, 2, r.out);
    assert.match(r.out, /faltan los tramos 2 de 2/);
  } finally { limpiar(b); }
});

test('SCRUM-1244c · 🔴 un tramo que pasa del tope se para y sale CIEGO, no verde', () => {
  const b = sembrar({ 'a.test.mjs': TARDA });
  try {
    const t = correr(b, ['--tramo', '1/1'], { TANDA_TRAMOS_TOPE_MS: '3000' });
    assert.equal(t.status, 2, t.out);
    assert.match(t.out, /CIEGO · no cupo/);
    assert.equal(correr(b, ['--resumen', '1']).status, 2);
  } finally { limpiar(b); }
});

test('SCRUM-1244c · un caído de verdad sale ROJO, con su nombre', () => {
  const b = sembrar({ 'a.test.mjs': PASA, 'b.test.mjs': CAE });
  try {
    assert.equal(correr(b, ['--tramo', '1/1']).status, 1);
    const r = correr(b, ['--resumen', '1']);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /not ok · cae a proposito/);
  } finally { limpiar(b); }
});

test('SCRUM-1244c · el registro: cuentas que no suman, cancelados o cero tests no dejan decir verde', () => {
  const base = { i: 1, n: 1, ficheros: 1, status: 0, signal: null, ms: 10, agotado: false };
  const tap = (s) => `TAP version 13\n${s}\n`;
  assert.deepEqual(registroDelTramo({ ...base, texto: tap('# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0') }).ciegos, []);
  assert.match(registroDelTramo({ ...base, texto: tap('# tests 3\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0') }).ciegos.join(), /no suman/);
  assert.match(registroDelTramo({ ...base, texto: tap('# tests 2\n# pass 1\n# fail 0\n# cancelled 1\n# skipped 0\n# todo 0') }).ciegos.join(), /cancelado/);
  assert.match(registroDelTramo({ ...base, texto: tap('# tests 0\n# pass 0\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0') }).ciegos.join(), /cero tests/);
  assert.match(registroDelTramo({ ...base, texto: '' }).ciegos.join(), /sin recuento/);
});
