// SCRUM-946 · el censo de huérfanos NOMBRA lo que no está salvado, y no toca nada.
//
// Se fabrica un repositorio de verdad en el temporal del SISTEMA (nunca dentro del árbol: SCRUM-824)
// con un remoto desnudo y seis worktrees, uno por caso:
//
//   limpio      al día con el remoto                → no sale
//   empujado    commit nuevo YA empujado            → no sale (control de que «empujado» se ve)
//   sinEmpujar  commit que no está en ningún remoto → SIN-EMPUJAR, nombrado
//   sucio       árbol sucio SIN commits             → SUCIO, nombrado (el caso que decide del ticket)
//   viejo       árbol sucio tocado hace 10 días     → contado como antiguo, NO listado
//   borrado     registrado pero sin directorio      → NO-PUDE-MIRAR, y el censo sale con 2
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  censo, resumen, clasificar, entradasDeStatus, rutasDeWorktrees,
  SIN_EMPUJAR, SUCIO, SUCIO_ANTIGUO, LIMPIO, NO_PUDE_MIRAR,
} from '../scripts/equipo/huerfanos.mjs';

const CLI = path.resolve(import.meta.dirname, '..', 'scripts', 'equipo', 'huerfanos.mjs');
const HORA = 3600 * 1000;
let raiz, principal;

function git(cwd, ...args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} → ${r.status}: ${r.stderr}`);
  return r.stdout.trim();
}
function commit(cwd, fichero, texto, msg) {
  fs.writeFileSync(path.join(cwd, fichero), texto);
  git(cwd, 'add', fichero);
  git(cwd, 'commit', '-q', '-m', msg);
}
const fila = (c, nombre) => c.filas.find((f) => f.worktree === nombre);

before(() => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum946-'));
  const remoto = path.join(raiz, 'remoto.git');
  principal = path.join(raiz, 'principal');
  spawnSync('git', ['init', '-q', '--bare', remoto]);
  spawnSync('git', ['init', '-q', '-b', 'main', principal]);
  git(principal, 'config', 'user.email', 'censo@example.invalid');
  git(principal, 'config', 'user.name', 'censo');
  commit(principal, 'a.txt', 'uno\n', 'base');
  git(principal, 'remote', 'add', 'origin', remoto);
  git(principal, 'push', '-q', '-u', 'origin', 'main');

  for (const n of ['limpio', 'empujado', 'sinEmpujar', 'sucio', 'viejo', 'borrado']) {
    git(principal, 'worktree', 'add', '-q', '-b', `rama-${n}`, path.join(raiz, n), 'origin/main');
  }
  commit(path.join(raiz, 'empujado'), 'b.txt', 'dos\n', 'empujado');
  git(path.join(raiz, 'empujado'), 'push', '-q', 'origin', 'rama-empujado');
  commit(path.join(raiz, 'sinEmpujar'), 'c.txt', 'tres\n', 'sin empujar');
  fs.writeFileSync(path.join(raiz, 'sucio', 'a.txt'), 'tocado\n');
  fs.writeFileSync(path.join(raiz, 'viejo', 'a.txt'), 'tocado hace mucho\n');
  const haceDiez = new Date(Date.now() - 10 * 24 * HORA);
  fs.utimesSync(path.join(raiz, 'viejo', 'a.txt'), haceDiez, haceDiez);
  fs.rmSync(path.join(raiz, 'borrado'), { recursive: true, force: true });
});

after(() => { if (raiz) fs.rmSync(raiz, { recursive: true, force: true }); });

test('scrum946: POBLACIÓN — mira los siete worktrees, el principal incluido', () => {
  const c = censo({ repo: principal, ventanaMs: 72 * HORA });
  assert.equal(c.ok, true);
  assert.equal(c.filas.length, 7, 'un censo que no declara sobre cuántos miró no ha dicho nada');
});

test('scrum946: ROJO — un commit que no está en ningún remoto sale NOMBRADO', () => {
  const c = censo({ repo: principal, ventanaMs: 72 * HORA });
  assert.equal(fila(c, 'sinEmpujar').estado, SIN_EMPUJAR);
  assert.equal(fila(c, 'sinEmpujar').sinEmpujar, 1);
  assert.match(resumen(c, 72).texto, /sinEmpujar · rama-sinEmpujar · 1 commit/);
});

test('scrum946: EL QUE DECIDE — árbol sucio SIN commits también sale', () => {
  const c = censo({ repo: principal, ventanaMs: 72 * HORA });
  assert.equal(fila(c, 'sucio').estado, SUCIO);
  assert.equal(fila(c, 'sucio').sinEmpujar, 0, 'no sale por commits: sale por el árbol');
  assert.match(resumen(c, 72).texto, /sucio · rama-sucio · 1 modificado/);
});

test('scrum946: POSITIVO — limpio y al día NO sale; un commit ya empujado tampoco', () => {
  const c = censo({ repo: principal, ventanaMs: 72 * HORA });
  assert.equal(fila(c, 'limpio').estado, LIMPIO);
  assert.equal(fila(c, 'empujado').estado, LIMPIO, 'el commit está en origin/rama-empujado');
  const texto = resumen(c, 72).texto;
  assert.doesNotMatch(texto, /rama-limpio/);
  assert.doesNotMatch(texto, /rama-empujado/);
});

test('scrum946: FILTRO POR EDAD — sucio de hace 10 días se CUENTA pero no se lista', () => {
  const c = censo({ repo: principal, ventanaMs: 72 * HORA });
  assert.equal(fila(c, 'viejo').estado, SUCIO_ANTIGUO);
  const texto = resumen(c, 72).texto;
  assert.match(texto, /1 sucios antiguos \(no listados\)/);
  assert.doesNotMatch(texto, /rama-viejo/);
  // Control: con una ventana que lo abarca, el mismo árbol SÍ sale. El filtro es de edad, no ceguera.
  const ancho = censo({ repo: principal, ventanaMs: 30 * 24 * HORA });
  assert.equal(fila(ancho, 'viejo').estado, SUCIO);
});

test('scrum946: SUELO — un worktree sin directorio es NO-PUDE-MIRAR, nunca limpio, y el censo sale con 2', () => {
  const c = censo({ repo: principal, ventanaMs: 72 * HORA });
  assert.equal(fila(c, 'borrado').estado, NO_PUDE_MIRAR);
  const r = resumen(c, 72);
  assert.equal(r.codigo, 2);
  assert.match(r.texto, /1 NO PUDE MIRAR/);
  assert.match(r.texto, /borrado · la ruta no existe/);
});

test('scrum946: sin poder listar los worktrees, NO dice «sin huérfanos»', () => {
  const c = censo({ repo: path.join(raiz, 'no-es-un-repo'), ventanaMs: HORA });
  const r = resumen(c, 1);
  assert.equal(c.ok, false);
  assert.equal(r.codigo, 2);
  assert.match(r.texto, /NO PUDE MIRAR/);
  assert.doesNotMatch(r.texto, /nada que salvar/);
});

test('scrum946: NEGATIVO — el censo no toca nada: refs, índice y árboles iguales antes y después', () => {
  const foto = () => ['limpio', 'sinEmpujar', 'sucio', 'viejo'].map((n) => {
    const d = path.join(raiz, n);
    return [git(d, 'rev-parse', 'HEAD'), git(d, 'status', '--porcelain'), fs.statSync(path.join(d, 'a.txt')).mtimeMs].join('|');
  }).join('\n') + git(principal, 'for-each-ref') + git(principal, 'worktree', 'list', '--porcelain');
  const antes = foto();
  censo({ repo: principal, ventanaMs: 72 * HORA });
  assert.equal(foto(), antes);
});

test('scrum946: la CLI sale con 2 sobre el repo fabricado y declara la población', () => {
  const env = { ...process.env };
  delete env.FORCE_COLOR; delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [CLI, '--repo', principal], { encoding: 'utf8', env });
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stdout, /7 worktrees mirados · 1 con commits SIN EMPUJAR · 1 sucios recientes/);
});

test('scrum946: decisiones puras — sin número de commits es NO-PUDE-MIRAR; sucio sin fecha se LISTA', () => {
  const base = { modificados: 0, sinSeguir: 0, ultimoToqueMs: null, ahoraMs: 1e12, ventanaMs: HORA };
  assert.equal(clasificar({ ...base, sinEmpujar: null }), NO_PUDE_MIRAR);
  assert.equal(clasificar({ ...base, sinEmpujar: 0 }), LIMPIO);
  assert.equal(clasificar({ ...base, sinEmpujar: 0, modificados: 1 }), SUCIO, 'sin fecha no se puede decir que sea viejo');
  assert.equal(clasificar({ ...base, sinEmpujar: 2, modificados: 1, ultimoToqueMs: 0 }), SIN_EMPUJAR, 'los commits se listan sea cual sea su edad');
  assert.deepEqual(entradasDeStatus(' M a.txt\0?? b c.txt\0R  nuevo.txt\0viejo.txt\0'),
    [{ codigo: ' M', ruta: 'a.txt' }, { codigo: '??', ruta: 'b c.txt' }, { codigo: 'R ', ruta: 'nuevo.txt' }]);
  assert.equal(rutasDeWorktrees('HEAD abc\nbranch x\n'), null, 'una salida sin worktrees no se lee como «cero»');
});
