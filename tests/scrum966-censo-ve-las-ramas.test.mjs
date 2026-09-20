// SCRUM-966 · el censo de huérfanos también mira las RAMAS LOCALES que no son HEAD de un worktree.
//
// ── EL ROJO, y existía de verdad el 20-sep-2026 ───────────────────────────────────────────────
// La Sesión 4 dejó `scrum-944b-nombre-del-trabajo` con 5 commits en NINGÚN remoto. Esa rama no era
// el HEAD de ningún worktree (su árbol, `wt-s4b-943`, estaba en `scrum-943-categoria-validada`),
// así que el censo de SCRUM-946 —que recorre `git worktree list`— no la veía. Cinco commits
// invisibles es exactamente lo que este censo existe para impedir.
//
// Se fabrica un repositorio de verdad en el temporal del SISTEMA (nunca dentro del árbol:
// SCRUM-824) con un remoto desnudo y CUATRO ramas locales, una por caso:
//
//   main            HEAD del principal, empujada          → no sale
//   rama-con-arbol  HEAD de un worktree, sin empujar      → sale por el censo de WORKTREES, no por
//                                                            el de ramas (no se cuenta dos veces)
//   huerfana        sin worktree, commit sin empujar      → 🔴 el caso del ticket: sale NOMBRADA
//   empujada        sin worktree, ya está en el remoto    → no sale (el positivo)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  censo, resumen, ramasConWorktree, ramasDeForEachRef, candidatas,
  RAMA_SIN_EMPUJAR, NO_PUDE_MIRAR,
} from '../scripts/equipo/huerfanos.mjs';

const CLI = path.resolve(import.meta.dirname, '..', 'scripts', 'equipo', 'huerfanos.mjs');
const HORA = 3600 * 1000;
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum966-'));
const principal = path.join(raiz, 'principal');

function git(cwd, ...args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} → ${r.status}: ${r.stderr}`);
  return r.stdout.trim();
}
function commit(arbol, fichero, texto, msg) {
  fs.writeFileSync(path.join(raiz, arbol, fichero), texto);
  git(path.join(raiz, arbol), 'add', fichero);
  git(path.join(raiz, arbol), 'commit', '-q', '-m', msg);
}
const ramaFila = (c, nombre) => (c.ramas?.filas ?? []).find((f) => f.rama === nombre);

before(() => {
  const remoto = path.join(raiz, 'remoto.git');
  spawnSync('git', ['init', '-q', '--bare', remoto]);
  spawnSync('git', ['init', '-q', '-b', 'main', principal]);
  git(principal, 'config', 'user.email', 'censo@example.invalid');
  git(principal, 'config', 'user.name', 'censo');
  commit('principal', 'a.txt', 'uno\n', 'base');
  git(principal, 'remote', 'add', 'origin', remoto);
  git(principal, 'push', '-q', '-u', 'origin', 'main');

  // Un worktree con su propia rama sin empujar: lo cubre el censo de SCRUM-946.
  git(principal, 'worktree', 'add', '-q', '-b', 'rama-con-arbol', path.join(raiz, 'con-arbol'), 'origin/main');
  commit('con-arbol', 'b.txt', 'dos\n', 'en su árbol, sin empujar');

  // 🔴 El caso del ticket: una rama local con commits y SIN worktree.
  //    Se fabrica en el worktree de arriba y se deja como rama suelta al volver a la suya.
  git(path.join(raiz, 'con-arbol'), 'checkout', '-q', '-b', 'huerfana', 'origin/main');
  commit('con-arbol', 'c.txt', 'tres\n', 'huérfano de verdad');
  git(path.join(raiz, 'con-arbol'), 'checkout', '-q', '-b', 'empujada', 'origin/main');
  commit('con-arbol', 'd.txt', 'cuatro\n', 'este sí se empuja');
  git(path.join(raiz, 'con-arbol'), 'push', '-q', 'origin', 'empujada');
  git(path.join(raiz, 'con-arbol'), 'checkout', '-q', 'rama-con-arbol');
});

after(() => { fs.rmSync(raiz, { recursive: true, force: true }); });

test('scrum966: ROJO — una rama local SIN worktree con commits en ningún remoto sale NOMBRADA', () => {
  const c = censo({ repo: principal, ventanaMs: 72 * HORA });
  assert.equal(c.ramas.ok, true, c.ramas.motivo);
  const f = ramaFila(c, 'huerfana');
  assert.ok(f, 'la rama «huerfana» no aparece: es justo lo que dejó fuera los 5 commits de 944b');
  assert.equal(f.estado, RAMA_SIN_EMPUJAR);
  assert.equal(f.sinEmpujar, 1);
  const r = resumen(c, 72);
  assert.match(r.texto, /huerfana · 1 commit/);
  assert.ok(r.codigo >= 1, 'un huérfano nombrado no puede salir con código 0');
});

test('scrum966: POBLACIÓN — declara cuántas ramas locales miró y cuántas no tienen worktree', () => {
  const c = censo({ repo: principal, ventanaMs: 72 * HORA });
  assert.equal(c.ramas.miradas, 4, 'main, rama-con-arbol, huerfana y empujada');
  assert.equal(c.ramas.sinWorktree, 2, 'huerfana y empujada');
  assert.match(resumen(c, 72).texto, /2 ramas locales sin worktree \(de 4\)/);
});

test('scrum966: POSITIVO — una rama sin worktree YA EMPUJADA no sale; la que tiene worktree no se cuenta dos veces', () => {
  const c = censo({ repo: principal, ventanaMs: 72 * HORA });
  assert.equal(ramaFila(c, 'empujada'), undefined, 'está en origin/empujada: no es huérfana');
  assert.equal(ramaFila(c, 'main'), undefined);
  assert.equal(ramaFila(c, 'rama-con-arbol'), undefined, 'ésa ya la nombra el censo de worktrees');
  // Y el censo de worktrees la sigue nombrando: ganar cobertura no puede perder detección.
  assert.match(resumen(c, 72).texto, /con-arbol · rama-con-arbol · 1 commit/);
});

test('scrum966: SUELO — si no se pueden listar las ramas, NO se lee como «no hay ramas huérfanas»', () => {
  const gitCiego = (cwd, args) => args[0] === 'for-each-ref'
    ? { status: 128, stdout: '' }
    : spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  const c = censo({ repo: principal, git: gitCiego, ventanaMs: 72 * HORA });
  assert.equal(c.ramas.ok, false);
  const r = resumen(c, 72);
  assert.equal(r.codigo, 2, '«no pude mirar» gana a cualquier verde');
  assert.match(r.texto, /NO PUDE MIRAR/);
  assert.doesNotMatch(r.texto, /nada que salvar/);
});

test('scrum966: NEGATIVO — el censo de ramas no toca nada', () => {
  const foto = () => [git(principal, 'for-each-ref'), git(principal, 'worktree', 'list', '--porcelain'),
    git(path.join(raiz, 'con-arbol'), 'status', '--porcelain')].join('\n');
  const antes = foto();
  censo({ repo: principal, ventanaMs: 72 * HORA });
  assert.equal(foto(), antes);
});

test('scrum966: la CLI nombra la rama huérfana y sale distinto de 0', () => {
  const env = { ...process.env };
  delete env.FORCE_COLOR; delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [CLI, '--repo', principal], { encoding: 'utf8', env });
  assert.notEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /2 ramas locales sin worktree \(de 4\)/);
  assert.match(r.stdout, /huerfana · 1 commit/);
});

test('scrum966: decisiones puras — quién tiene worktree, qué ramas hay y cuáles son candidatas', () => {
  const porcelana = 'worktree /a\nHEAD abc\nbranch refs/heads/con-arbol\n\nworktree /b\nHEAD def\ndetached\n';
  assert.deepEqual([...ramasConWorktree(porcelana)], ['con-arbol'],
    'un worktree en detached no reclama ninguna rama');
  assert.deepEqual(ramasDeForEachRef('abc con-arbol\ndef sin-arbol\n\n'),
    [{ sha: 'abc', rama: 'con-arbol' }, { sha: 'def', rama: 'sin-arbol' }]);
  const ramas = [{ sha: 'abc', rama: 'con-arbol' }, { sha: 'def', rama: 'sin-arbol' }, { sha: 'ghi', rama: 'al-dia' }];
  assert.deepEqual(candidatas(ramas, new Set(['con-arbol']), new Set(['abc', 'def'])),
    [{ sha: 'def', rama: 'sin-arbol' }],
    'con-arbol la cubre el censo de worktrees; al-dia tiene la punta en un remoto');
  assert.equal(NO_PUDE_MIRAR, 'NO-PUDE-MIRAR');
});
