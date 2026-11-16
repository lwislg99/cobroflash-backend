// tests/scrum1736-latido-cierre-rama-homonima.test.mjs — SCRUM-1736
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL HOOK DE CIERRE NO TOMA POR TUYA LA RAMA LOCAL HOMÓNIMA DE OTRA SESIÓN
//
// Medido el 13-nov-2026 (J4, en #3137, #3141 y #3142): la sesión trabaja en `<rama>-al-dia` y empuja
// `git push origin HEAD:<rama>`. Los worktrees comparten un solo `.git`, así que `refs/heads/<rama>` es
// la que tiene colgada OTRA sesión, por DETRÁS de lo empujado. El hook comparaba esa local con origin
// por igualdad y daba 🔴 «NO es lo empujado» en las tres: un aviso falso, sin nada que empujar.
//
// Todo contra repositorios git DE VERDAD (un origin `--bare` y dos worktrees), con `medir()` entero
// —ls-remote, rev-parse y merge-base reales— y solo los check-runs inyectados (sin red):
//   · ROJO→VERDE: el caso del 13-nov ya no da SIN-EMPUJAR (con su CONTROL: sin `dentro`, sí lo daba);
//   · POSITIVO: un commit propio sin empujar SIGUE dando SIN-EMPUJAR; y una local divergida también;
//   · SUELO: un origin que movió otro y que este repo no ha traído → «no pude mirar», no verde.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { medir, veredictoDeRama, localDentroDe } from '../.claude/hooks/latido-cierre.mjs';
import { temporal, borrarTemporal } from './_temporal.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El defecto medido: juzgar la local homónima por igualdad, sin mirar si está dentro.
    fichero: '.claude/hooks/latido-cierre.mjs',
    de: 'if (local && local !== remoto && dentro !== true) {',
    a: 'if (local && local !== remoto) {',
    cae: 'SCRUM-1736 · 🔴 ROJO→VERDE: HEAD:<rama> desde otra rama, con la homónima de OTRA sesión por detrás → NO es SIN-EMPUJAR',
  },
  {
    // `medir` sin cablear la comparación: el arreglo existiría y el hook no lo usaría.
    fichero: '.claude/hooks/latido-cierre.mjs',
    de: 'return veredictoDeRama({ rama, remoto, local, dentro, runs });',
    a: 'return veredictoDeRama({ rama, remoto, local, runs });',
    cae: 'SCRUM-1736 · 🔴 ROJO→VERDE: HEAD:<rama> desde otra rama, con la homónima de OTRA sesión por detrás → NO es SIN-EMPUJAR',
  },
  {
    // El arreglo pasado de largo: «da igual la local». Un commit propio sin empujar dejaría de avisar.
    fichero: '.claude/hooks/latido-cierre.mjs',
    de: 'if (local && local !== remoto && dentro !== true) {',
    a: 'if (false) {',
    cae: 'SCRUM-1736 · 🔴 POSITIVO: un commit PROPIO sin empujar sigue dando SIN-EMPUJAR',
  },
  {
    // «No pude comparar» leído como «está dentro»: el fallo abierto que este hook tiene prohibido.
    fichero: '.claude/hooks/latido-cierre.mjs',
    de: '  if (r.status === 1) return false;\n  return null;',
    a: '  if (r.status === 1) return false;\n  return true;',
    cae: 'SCRUM-1736 · 🔴 SUELO: un origin que movió otro y este repo no ha traído → «no pude mirar», nunca verde',
  },
];

const VERDE = [{ name: 'build + tests (con banco desechable)', status: 'completed', conclusion: 'success' }];
const checks = () => VERDE;

/** Un origin `--bare`, la sesión A con `scrum-x` colgada y empujada, y la sesión B en otro worktree. */
function banco() {
  const dir = temporal('scrum1736-');
  const g = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  const origen = path.join(dir, 'origen.git');
  const A = path.join(dir, 'A');
  const B = path.join(dir, 'B');
  // TODA escritura del banco y de los casos pasa por aquí: cuelga a la vista de `temporal()` (SCRUM-824).
  const escribir = (sub, fichero, texto) => fs.writeFileSync(path.join(dir, sub, fichero), texto);
  g(dir, 'init', '-q', '--bare', '-b', 'main', origen);
  g(dir, 'clone', '-q', origen, A);
  g(A, 'config', 'user.email', 'scrum1736@test');
  g(A, 'config', 'user.name', 'scrum1736');
  g(A, 'config', 'core.autocrlf', 'false');
  escribir('A', 'f.txt', 'base\n');
  g(A, 'add', '-A');
  g(A, 'commit', '-qm', 'base');
  const base = g(A, 'rev-parse', 'HEAD');
  g(A, 'push', '-q', 'origin', 'HEAD:main');
  g(A, 'checkout', '-qb', 'scrum-x');
  escribir('A', 'f.txt', 'de la sesión A\n');
  g(A, 'commit', '-qam', 'de A');
  g(A, 'push', '-q', 'origin', 'scrum-x');
  // La sesión B: otro worktree del MISMO `.git`, en una rama con otro nombre.
  g(A, 'worktree', 'add', '-q', '-b', 'scrum-x-al-dia', B, 'scrum-x');
  escribir('B', 'g.txt', 'puesta al día por B\n');
  g(B, 'add', '-A');
  g(B, 'commit', '-qm', 'de B');
  return { dir, g, A, B, origen, base, escribir };
}

function conBanco(fn) {
  const b = banco();
  try { return fn(b); } finally { borrarTemporal(b.dir); }
}

const limite = () => Date.now() + 30_000;

test('SCRUM-1736 · 🔴 ROJO→VERDE: HEAD:<rama> desde otra rama, con la homónima de OTRA sesión por detrás → NO es SIN-EMPUJAR', () => {
  conBanco(({ g, A, B }) => {
    g(B, 'push', '-q', 'origin', 'HEAD:scrum-x');
    const remoto = g(B, 'rev-parse', 'HEAD');
    const local = g(B, 'rev-parse', 'refs/heads/scrum-x');
    // CONTROL: el caso de verdad reproduce el del 13-nov — la homónima es otra, está colgada en A, y
    // juzgada como antes (sin `dentro`) daba el 🔴 falso.
    assert.notEqual(local, remoto, '🔴 el banco no reproduce: la homónima ES lo empujado');
    assert.equal(g(B, 'branch', '--show-current'), 'scrum-x-al-dia');
    assert.match(g(B, 'worktree', 'list', '--porcelain'), new RegExp(`HEAD ${local}\\nbranch refs/heads/scrum-x\\n`),
      '🔴 la homónima no está colgada en el otro worktree');
    assert.equal(g(A, 'branch', '--show-current'), 'scrum-x');
    assert.equal(veredictoDeRama({ rama: 'scrum-x', remoto, local, runs: VERDE }).estado, 'SIN-EMPUJAR',
      '🔴 CONTROL: juzgada por igualdad, la homónima de otra sesión da el aviso falso');

    const [v] = medir(['scrum-x'], limite(), { cwd: B, checks });
    assert.equal(v.estado, 'VERDE', JSON.stringify(v));
    assert.equal(v.sha, remoto.slice(0, 8));
  });
});

test('SCRUM-1736 · 🔴 POSITIVO: un commit PROPIO sin empujar sigue dando SIN-EMPUJAR', () => {
  conBanco(({ g, A, escribir }) => {
    // La sesión A, en su propia rama: empuja, y después deja un commit sin empujar.
    escribir('A', 'f.txt', 'commit que no llega a origin\n');
    g(A, 'commit', '-qam', 'sin empujar');
    const [v] = medir(['scrum-x'], limite(), { cwd: A, checks });
    assert.equal(v.estado, 'SIN-EMPUJAR', JSON.stringify(v));
    assert.match(v.linea, /tiene commits que NO están en lo empujado/);
  });
});

test('SCRUM-1736 · 🔴 POSITIVO: una local DIVERGIDA de lo empujado sigue dando SIN-EMPUJAR', () => {
  conBanco(({ g, A, B, escribir }) => {
    g(B, 'push', '-q', 'origin', 'HEAD:scrum-x');
    // A, sin traer lo de B, hace su propio commit: ni ella está dentro de origin ni origin de ella.
    escribir('A', 'f.txt', 'divergida\n');
    g(A, 'commit', '-qam', 'divergida');
    const [v] = medir(['scrum-x'], limite(), { cwd: A, checks });
    assert.equal(v.estado, 'SIN-EMPUJAR', JSON.stringify(v));
  });
});

test('SCRUM-1736 · 🔴 SUELO: un origin que movió otro y este repo no ha traído → «no pude mirar», nunca verde', () => {
  conBanco(({ g, dir, origen, escribir }) => {
    // Otro clon (el bot, metiendo main) mueve `scrum-x` en origin; este `.git` no lo ha traído.
    const C = path.join(dir, 'C');
    g(dir, 'clone', '-q', '-b', 'scrum-x', origen, C);
    g(C, 'config', 'user.email', 'bot@test');
    g(C, 'config', 'user.name', 'bot');
    escribir('C', 'h.txt', 'del bot\n');
    g(C, 'add', '-A');
    g(C, 'commit', '-qm', 'del bot');
    g(C, 'push', '-q', 'origin', 'scrum-x');
    const remoto = g(C, 'rev-parse', 'HEAD');
    const A = path.join(dir, 'A');
    // CONTROL: de verdad no está en este repositorio.
    assert.throws(() => g(A, 'cat-file', '-e', `${remoto}^{commit}`));
    assert.equal(localDentroDe(A, g(A, 'rev-parse', 'refs/heads/scrum-x'), remoto), null);
    const [v] = medir(['scrum-x'], limite(), { cwd: A, checks });
    assert.equal(v.estado, 'CIEGO', JSON.stringify(v));
    assert.match(v.linea, /NO PUDE MIRAR/);
  });
});

test('SCRUM-1736 · la comparación sola: dentro, fuera y sin respuesta', () => {
  conBanco(({ g, A, B, base }) => {
    const deA = g(A, 'rev-parse', 'scrum-x');
    const deB = g(B, 'rev-parse', 'HEAD');
    assert.equal(localDentroDe(A, base, deA), true);
    assert.equal(localDentroDe(A, deA, deB), true);
    assert.equal(localDentroDe(A, deB, deA), false);
    assert.equal(localDentroDe(A, 'c'.repeat(40), deA), null);
  });
});

test('SCRUM-1736 · sin `dentro` (quien no lo mide) se juzga como antes; `null` es CIEGO, no SIN-EMPUJAR', () => {
  const a = 'a'.repeat(40), b = 'b'.repeat(40);
  assert.equal(veredictoDeRama({ rama: 'r', remoto: a, local: b, runs: VERDE }).estado, 'SIN-EMPUJAR');
  assert.equal(veredictoDeRama({ rama: 'r', remoto: a, local: b, dentro: false, runs: VERDE }).estado, 'SIN-EMPUJAR');
  assert.equal(veredictoDeRama({ rama: 'r', remoto: a, local: b, dentro: null, runs: VERDE }).estado, 'CIEGO');
  assert.equal(veredictoDeRama({ rama: 'r', remoto: a, local: b, dentro: true, runs: VERDE }).estado, 'VERDE');
  // Dentro no absuelve el CI: lo empujado sigue juzgándose por su obligatorio.
  assert.equal(veredictoDeRama({ rama: 'r', remoto: a, local: b, dentro: true, runs: [] }).estado, 'TODAVIA-NO');
});
