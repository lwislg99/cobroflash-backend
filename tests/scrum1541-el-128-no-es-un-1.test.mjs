// tests/scrum1541-el-128-no-es-un-1.test.mjs — SCRUM-1541
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// ⛔ NO TOCA EL REMOTO DE VERDAD: todo pasa en un repositorio SINTÉTICO del temporal.
//
// `git merge-base --is-ancestor` sale 0, 1 o 128, y el censo de la regla 42 leía cualquier cosa
// distinta de 0 como «rama viva». Sólo era cierto porque el job obligatorio trae la historia entera
// (`fetch-depth: 0`). Medido el 14-oct-2026 en un clon de profundidad 1 del repositorio: las 105
// ramas `scrum-N` dan 128 —también las 18 mergeadas— y el censo de `main` sacaba SCRUM-1039 FUERA
// («rama viva SIN mergear») donde el clon completo lo saca DENTRO.
//
// 🔴 POR QUÉ UN CLON SOMERO HECHO A PROPÓSITO: la dependencia es de `ci.yml`, y el job que la tiene
// no puede comprobarla desde dentro, porque allí la historia SIEMPRE está entera. Así que aquí se
// monta un remoto con una rama mergeada y otra viva, y se mira desde un clon completo y desde uno
// de profundidad 1.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { temporalDeFixtureGit, gitDeFixture } from './_censo-fixture.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const CENSO = pathToFileURL(path.join(RAIZ, 'scripts', 'censo-regla-42.mjs')).href;
const SUJETO = path.join(RAIZ, 'tests', 'scrum804b-el-barrido-de-la-42.test.mjs');
const FUERA_ = 'FUERA';

/** El remoto y sus dos clones, una vez por proceso. */
let banco = null;
function montar() {
  if (banco) return banco;
  const dir = temporalDeFixtureGit('scrum1541-');
  const g = (cwd, ...args) => gitDeFixture(args, { cwd });
  const remoto = path.join(dir, 'remoto.git');
  const obra = path.join(dir, 'obra');
  gitDeFixture(['init', '-q', '--bare', '-b', 'main', remoto]);
  fs.mkdirSync(obra);
  g(obra, 'init', '-q', '-b', 'main');
  g(obra, 'config', 'user.email', 'fixture@yaqu.test');
  g(obra, 'config', 'user.name', 'Fixture');
  g(obra, 'config', 'commit.gpgsign', 'false');
  g(obra, 'remote', 'add', 'origin', remoto);
  const commit = (fichero, texto) => {
    fs.writeFileSync(path.join(obra, fichero), texto);
    g(obra, 'add', '-A');
    g(obra, 'commit', '-q', '-m', `banco: ${fichero}`);
    return g(obra, 'rev-parse', 'HEAD').trim();
  };
  // A queda DENTRO de main, pero por debajo del corte de un clon de profundidad 1.
  const a = commit('a.txt', 'a\n');
  commit('b.txt', 'b\n');
  g(obra, 'push', '-q', 'origin', 'main');
  g(obra, 'push', '-q', 'origin', `${a}:refs/heads/scrum-7-mergeada`);
  g(obra, 'checkout', '-q', '-b', 'scrum-8-viva');
  commit('c.txt', 'c\n');
  g(obra, 'push', '-q', 'origin', 'scrum-8-viva');

  const completo = path.join(dir, 'completo');
  const somero = path.join(dir, 'somero');
  gitDeFixture(['clone', '-q', remoto, completo]);
  gitDeFixture(['clone', '-q', '--depth', '1', pathToFileURL(remoto).href, somero]);
  banco = { completo, somero, a };
  return banco;
}

/** El hijo no hereda el contexto del runner de tests (SCRUM-1349). */
const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];

/** El censo de verdad, corrido DENTRO de un clon (sus órdenes de git van al cwd). */
function censoEn(cwd, tickets, expr = 'censarConMotivo') {
  const programa = `import * as c from ${JSON.stringify(CENSO)};\n`
    + `const r = c.${expr}(${JSON.stringify(tickets)});\n`
    + 'process.stdout.write(JSON.stringify(r.ciego ? { ciego: r.ciego } : { somero: r.censo.somero, filas: r.censo.filas.map((f) => ({ n: f.n, cubo: f.cubo, motivo: f.motivo })) }));';
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', programa], { cwd, encoding: 'utf8', env: entorno });
  assert.equal(r.status, 0, `🔴 el censo no ha corrido en ${cwd}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

test('SCRUM-1541 · CONTROL: el banco es lo que dice ser (un clon completo, uno somero, y A fuera del somero)', () => {
  const { completo, somero, a } = montar();
  const g = (cwd, ...args) => gitDeFixture(args, { cwd }).trim();
  assert.equal(g(completo, 'rev-parse', '--is-shallow-repository'), 'false');
  assert.equal(g(somero, 'rev-parse', '--is-shallow-repository'), 'true',
    '🔴 el clon de profundidad 1 no es somero: el banco no monta el caso que dice medir');
  assert.notEqual(spawnSync('git', ['cat-file', '-e', `${a}^{commit}`], { cwd: somero }).status, 0,
    '🔴 el commit de la rama mergeada SÍ está en el clon somero: el 128 no se provocaría');
});

test('SCRUM-1541 · ① 🔴 en un clon COMPLETO, la mergeada sale mergeada y la viva FUERA', () => {
  const { completo } = montar();
  const r = censoEn(completo, [7, 8]);
  assert.equal(r.ciego, undefined, `🔴 CIEGO en el clon completo: ${JSON.stringify(r.ciego)}`);
  const [f7, f8] = [7, 8].map((n) => r.filas.find((f) => f.n === n));
  assert.match(f7.motivo, /rama MERGEADA/, `🔴 SCRUM-7 está mergeada y sale ${f7.cubo} (${f7.motivo})`);
  assert.equal(f8.cubo, FUERA_, `🔴 SCRUM-8 tiene obra fuera y sale ${f8.cubo} (${f8.motivo})`);
  // Detrás de lo que ya hacía bien el código de antes: así este caso es el CONTROL de ②, en los dos.
  assert.equal(r.somero, false, '🔴 el censo cree somero un clon completo');
});

test('SCRUM-1541 · ② 🔴 en un clon SOMERO, ni la mergeada sale FUERA ni nada se da por sabido: NO DECIDIBLE, con su motivo', () => {
  const { somero } = montar();
  const r = censoEn(somero, [7, 8]);
  assert.equal(r.ciego, undefined, `🔴 CIEGO en el clon somero: ${JSON.stringify(r.ciego)}`);
  for (const n of [7, 8]) {
    const f = r.filas.find((x) => x.n === n);
    assert.notEqual(f.cubo, FUERA_,
      `🔴 SCRUM-${n} sale FUERA en un clon somero (${f.motivo}). Es el defecto de SCRUM-1541: un 128 leído como «no es ancestro».`);
    assert.equal(f.cubo, 'NO_DECIDIBLE', `🔴 SCRUM-${n} sale ${f.cubo} (${f.motivo})`);
    assert.match(f.motivo, /no se puede saber .* SOMERO/, `🔴 el motivo no dice por qué no se sabe: ${f.motivo}`);
  }
  assert.equal(r.somero, true, '🔴 el censo no sabe que el clon es somero');
});

test('SCRUM-1541 · ③ 🔴 el guard de la dependencia: `scrum804b` corrido en un clon SOMERO cae nombrando la causa', () => {
  const { somero } = montar();
  const entorno = { ...process.env };
  for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];
  const r = spawnSync(process.execPath, ['--test-reporter=tap', SUJETO],
    { cwd: somero, env: entorno, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  assert.notEqual(r.status, 0, `🔴 \`scrum804b\` sale VERDE en un clon somero: el barrido de la 42 no está comprobado y nadie lo dice. Salida:\n${salida.slice(-1500)}`);
  assert.match(salida, /CIEGO · CLON SOMERO/,
    `🔴 \`scrum804b\` cae en un clon somero, pero NO por el clon: un rojo que no nombra su causa manda a buscarla en el diff. Salida:\n${salida.slice(-1500)}`);
  assert.match(salida, /fetch-depth: 0/, '🔴 el rojo no dice qué hay que arreglar');
});
