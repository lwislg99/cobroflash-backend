// SCRUM-1540 · `ramas-borrables.mjs` NO propone borrar una rama cuya punta VIVA no sabe si está en main.
//
// Visto en rojo el 14-oct-2026 con el guion sin tocar, en un remoto de juguete: una rama ya mergeada
// recibe un commit nuevo desde otro clon; en el clon que no ha hecho `fetch`, `git branch -r --merged`
// la seguía dando por mergeada (su ref LOCAL estaba en la punta vieja) y el guion la ponía en su
// `git push origin --delete`, con sus tres controles en verde. Aquí se monta ese mismo juguete y se
// lanza el guion de verdad: en seco, nunca con `--ejecutar`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  veredictoDeAncestro, clasificar, sondasSembradas, leerVivas, DENTRO, FUERA, NO_SE_SABE,
} from '../scripts/verificacion-s5/ramas-borrables.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUION = path.join(RAIZ, 'scripts', 'verificacion-s5', 'ramas-borrables.mjs');

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // «No se puede saber» (128) vuelve a leerse como «dentro de main»: lo peligroso.
    fichero: 'scripts/verificacion-s5/ramas-borrables.mjs',
    de: '  if (codigo === 0) return DENTRO;',
    a: '  if (codigo !== 1) return DENTRO;',
    cae: 'SCRUM-1540 · los TRES valores de --is-ancestor: 0 dentro, 1 fuera, y todo lo demás NO SE PUEDE SABER',
  },
  {
    // Una punta viva que no está en el clon deja de apartarse con su motivo.
    fichero: 'scripts/verificacion-s5/ramas-borrables.mjs',
    de: '    if (!estaEnElAlmacen(sha)) {',
    a: '    if (false) {',
    cae: 'SCRUM-1540 · 🔴 una punta viva que este clon no tiene NO es borrable: sale en NO SE PUEDE SABER con su motivo',
  },
  {
    // La sonda sembrada del FUERA se apaga: una sonda que siempre dice «dentro» pasaría el control.
    fichero: 'scripts/verificacion-s5/ramas-borrables.mjs',
    de: '  if (veredictoDeAncestro(codigoAncestroDe(main, padre)) !== FUERA) fallos.push(',
    a: '  if (false) fallos.push(',
    cae: 'SCRUM-1540 · las sondas se prueban sobre lo SEMBRADO: una que siempre dice «dentro» deja el guion CIEGO',
  },
];

test('SCRUM-1540 · los TRES valores de --is-ancestor: 0 dentro, 1 fuera, y todo lo demás NO SE PUEDE SABER', () => {
  assert.equal(veredictoDeAncestro(0), DENTRO);
  assert.equal(veredictoDeAncestro(1), FUERA);
  for (const c of [128, 129, 2, null, undefined]) assert.equal(veredictoDeAncestro(c), NO_SE_SABE, `código ${c}`);
});

const SHA = (c) => c.repeat(40);
test('SCRUM-1540 · 🔴 una punta viva que este clon no tiene NO es borrable: sale en NO SE PUEDE SABER con su motivo', () => {
  const vivas = leerVivas([`${SHA('a')}\trefs/heads/main`, `${SHA('b')}\trefs/heads/scrum-1-mergeada`, `${SHA('c')}\trefs/heads/scrum-2-otra`, `${SHA('d')}\trefs/heads/scrum-3-viva`, `${SHA('e')}\trefs/heads/scrum-4-rara`].join('\n'));
  const r = clasificar({
    vivas,
    estaEnElAlmacen: (sha) => sha !== SHA('b'), // la punta nueva de scrum-1 no ha llegado a este clon
    codigoAncestro: (sha) => ({ [SHA('c')]: 0, [SHA('d')]: 1, [SHA('e')]: 128, [SHA('b')]: 128 })[sha],
    nombradasPorUnMerge: new Set(['scrum-1-mergeada', 'scrum-2-otra', 'scrum-3-viva', 'scrum-4-rara']),
  });
  assert.deepEqual(r.borrables, ['scrum-2-otra']);
  assert.deepEqual([...r.sinMergear], ['scrum-3-viva']);
  assert.deepEqual([...r.noSeSabe.keys()], ['scrum-1-mergeada', 'scrum-4-rara']);
  assert.match(r.noSeSabe.get('scrum-1-mergeada'), /su punta viva bbbbbbbbb no está en este clon/);
  assert.match(r.noSeSabe.get('scrum-4-rara'), /salió con 128/);
  assert.ok(!r.mergeadas.has('main') && !r.borrables.includes('main'), 'main no se juzga nunca');
});

test('SCRUM-1540 · las sondas se prueban sobre lo SEMBRADO: una que siempre dice «dentro» deja el guion CIEGO', () => {
  const [main, padre, ausente] = [SHA('1'), SHA('2'), SHA('f')];
  const sana = {
    main, padre, ausente,
    estaEnElAlmacen: (s) => s !== ausente,
    codigoAncestroDe: (s, base) => (s === ausente ? 128 : s === padre && base === main ? 0 : 1),
    commitsFueraDe: (base, s) => (base === padre && s === main ? 1 : 0),
  };
  assert.deepEqual(sondasSembradas(sana), []);
  const siempreDentro = sondasSembradas({ ...sana, codigoAncestroDe: () => 0 });
  assert.ok(siempreDentro.includes('main sale dentro de su propio padre: la sonda no ve un FUERA'), siempreDentro.join(' | '));
  assert.ok(siempreDentro.includes('un sha que no existe no sale NO SE PUEDE SABER'));
  assert.ok(sondasSembradas({ ...sana, commitsFueraDe: () => 0 }).length > 0, 'una segunda sonda que no cuenta nada no pasa');
});

// ── el guion LANZADO sobre el juguete del rojo ──────────────────────────────────────────────────
function g(cwd, ...a) {
  const r = spawnSync('git', a, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')} → ${r.status}: ${r.stderr}`);
  return r.stdout.trim();
}
function juguete(dir) {
  const remoto = path.join(dir, 'remoto.git'); const a = path.join(dir, 'a'); const b = path.join(dir, 'b');
  g(dir, 'init', '-q', '--bare', '-b', 'main', remoto);
  g(dir, 'clone', '-q', remoto, a);
  const id = (c) => { g(c, 'config', 'user.email', 't@t'); g(c, 'config', 'user.name', 't'); };
  id(a);
  const commit = (c, f, msg) => { fs.writeFileSync(path.join(c, f), msg); g(c, 'add', f); g(c, 'commit', '-q', '-m', msg); };
  commit(a, 'f.txt', 'inicio'); g(a, 'push', '-q', 'origin', 'main');
  // Veinte ramas mergeadas cada una por su PROPIO merge: el control de proporción tiene población.
  for (let k = 1; k <= 20; k++) {
    const rama = k === 1 ? 'scrum-1-mergeada' : `scrum-${k}-otra`;
    g(a, 'switch', '-q', '-c', rama, 'main'); commit(a, `h${k}.txt`, `t${k}`); g(a, 'push', '-q', 'origin', rama);
    g(a, 'switch', '-q', 'main'); g(a, 'merge', '-q', '--no-ff', rama, '-m', `Merge pull request #${k} from o/${rama}`); g(a, 'push', '-q', 'origin', 'main');
  }
  g(a, 'switch', '-q', '-c', 'solo-nombre', 'main'); g(a, 'push', '-q', 'origin', 'solo-nombre'); g(a, 'switch', '-q', 'main');
  g(a, 'fetch', '-q', 'origin');
  // Otro clon empuja un commit NUEVO a la rama ya mergeada; `a` no se entera.
  g(dir, 'clone', '-q', remoto, b); id(b);
  g(b, 'switch', '-q', 'scrum-1-mergeada'); commit(b, 'nuevo.txt', 'commit SIN mergear'); g(b, 'push', '-q', 'origin', 'scrum-1-mergeada');
  return { a, nuevo: g(b, 'rev-parse', 'HEAD') };
}
const lanzar = (cwd) => spawnSync(process.execPath, [GUION], { cwd, encoding: 'utf8', timeout: 120000 });
const enLosComandos = (salida, rama) => salida.split('\n').some((l) => l.startsWith('git push') && l.split(' ').includes(rama));
const borrables = (salida) => { const l = salida.split('\n'); const i = l.findIndex((x) => x.startsWith('BORRABLES:')); const j = l.findIndex((x) => x.startsWith('══ EN SECO')); return l.slice(i + 2, j).map((x) => x.trim()).filter(Boolean); };

test('SCRUM-1540 · 🔴 EL CASO, lanzado: el clon sin fetch NO propone borrar la rama con un commit sin mergear', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1540-'));
  try {
    const { a, nuevo } = juguete(dir);
    // El escenario es el del rojo: la ref local miente y la punta viva ni siquiera está en el clon.
    assert.notEqual(g(a, 'rev-parse', 'refs/remotes/origin/scrum-1-mergeada'), nuevo);
    assert.notEqual(spawnSync('git', ['cat-file', '-e', `${nuevo}^{commit}`], { cwd: a }).status, 0);
    const r = lanzar(a);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(!enLosComandos(r.stdout, 'scrum-1-mergeada'), '🔴 la propone borrar: se perdería su commit nuevo');
    assert.ok(!borrables(r.stdout).includes('scrum-1-mergeada'));
    // …y no por haberla perdido de vista: el guion la nombra, en su propia lista.
    assert.ok(r.stdout.includes('scrum-1-mergeada'), 'la rama no sale en NINGÚN sitio: el guion no la ha visto');
    assert.match(r.stdout, /🔴 NO SE PUEDE SABER — 1\./);
    assert.match(r.stdout, new RegExp(`scrum-1-mergeada · su punta viva ${nuevo.slice(0, 9)} no está en este clon`));
    // CONTROL POSITIVO: las otras diecinueve, mergeadas por su propio merge, SÍ salen; la que ningún merge nombra, apartada.
    assert.equal(borrables(r.stdout).length, 19, r.stdout);
    assert.ok(enLosComandos(r.stdout, 'scrum-2-otra'));
    assert.match(r.stdout, /APARTADAS DEL BARRIDO — 1\.[\s\S]*solo-nombre/);
    // Con el clon al día deja de ser «no se sabe» y pasa a FUERA: sigue sin ser borrable.
    g(a, 'fetch', '-q', 'origin');
    const r2 = lanzar(a);
    assert.equal(r2.status, 0, r2.stdout + r2.stderr);
    assert.match(r2.stdout, /fuera: 1 · NO SE PUEDE SABER: 0/);
    assert.ok(!enLosComandos(r2.stdout, 'scrum-1-mergeada'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
