// tests/scrum973-titulo-del-pr.test.mjs — SCRUM-973
//
// EL PR NACÍA LLAMÁNDOSE «Merge remote-tracking branch 'origin/main' into scrum-…».
//
// `.github/workflows/pr-automatico.yml` titulaba el PR con `git log -1 --pretty=%s`: el ÚLTIMO
// commit de la rama. Y el último commit de una rama viva suele ser el merge de `main` que hay que
// hacer antes de empujar. MEDIDO el 20-sep-2026 sobre los 100 últimos PR del repositorio:
// **10 salieron así** (#1546, #1539, #1521, #1505, #1503, #1502, #1497, #1495, #1463, #1462) y
// alguien fue a renombrarlos a mano.
//
// ── CÓMO SE COMPRUEBA, Y POR QUÉ NO BASTA LEER EL YAML ────────────────────────────────────────
// Se EJERCITA el mecanismo: se fabrica un repositorio de verdad en el temporal del SISTEMA
// (SCRUM-824) con la forma exacta del caso —un commit propio y encima el merge de `main`— y se
// corre el MISMO comando de git que lleva el workflow, leído del propio fichero. Si alguien cambia
// la línea del workflow, este test corre el comando nuevo: no hay dos copias que puedan divergir.
//
// ⚠️ Un test que sólo mirara el texto del YAML diría que todo está bien con un comando que no hace
//    lo que promete — y ese es justo el error que trajo este ticket.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { temporal } from './_temporal.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const WF = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'pr-automatico.yml'), 'utf8');

/**
 * El tramo del paso «Abrir el PR» que compone título, espejo y `gh pr create`.
 * ⚠️ Se ancla en `NUM="$(gh pr create` y NO en `gh pr create` a secas: esa cadena aparece ANTES en
 *    un comentario del fichero, y cortar ahí dejaba fuera justo lo que se venía a medir — el tramo
 *    salía vacío y los asserts caían sobre la nada. Un trozo mal cortado no es un hallazgo.
 */
const PASO = (() => {
  const i = WF.indexOf('TITULO="$(git log');
  const j = WF.indexOf('NUM="$(gh pr create');
  return i !== -1 && j > i ? WF.slice(i, j) : '';
})();
const raiz = temporal('scrum973-');
const repo = path.join(raiz, 'repo');

function git(cwd, ...args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} → ${r.status}: ${r.stderr}`);
  return r.stdout.trim();
}
function commit(msg, fichero, texto) {
  fs.writeFileSync(path.join(repo, fichero), texto);
  git(repo, 'add', fichero);
  git(repo, 'commit', '-q', '-m', msg);
}

/**
 * Los argumentos de git del workflow, sacados del propio fichero: `['log', …]`. Null si ya no está.
 * ⚠️ El `log` va DENTRO de lo que se devuelve. La primera versión lo dejaba fuera del grupo y el
 *    test llamaba a `git --reverse …` → «unknown option», que se lee como un rojo del arreglo y no
 *    lo era: era el instrumento mal montado.
 */
export function ordenDelTitulo(yaml) {
  const m = /TITULO="\$\((git log [^|]+?)\s*\|\s*head -n 1\)"/.exec(String(yaml));
  return m ? m[1].trim().split(/\s+/).slice(1) : null; // fuera el `git`, dentro el `log`
}

const EL_PROPIO = 'SCRUM-000: lo que de verdad hace esta rama';
const EL_MERGE = "Merge remote-tracking branch 'origin/main' into scrum-000-lo-que-sea";

before(() => {
  fs.mkdirSync(repo, { recursive: true });
  spawnSync('git', ['init', '-q', '-b', 'main', repo]);
  git(repo, 'config', 'user.email', 'pr@example.invalid');
  git(repo, 'config', 'user.name', 'pr');
  commit('base', 'a.txt', 'uno\n');
  // `origin/main` avanza por su cuenta, como en el repositorio de verdad.
  git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(repo, 'checkout', '-q', '-b', 'main-remota');
  commit('SCRUM-999: algo que entró en main mientras tanto', 'm.txt', 'main\n');
  git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  // La rama: SU commit primero y encima el merge de main, que es la forma del defecto.
  git(repo, 'checkout', '-q', 'main');
  commit(EL_PROPIO, 'b.txt', 'dos\n');
  git(repo, 'merge', '-q', '--no-ff', 'refs/remotes/origin/main', '-m', EL_MERGE);
});

after(() => { fs.rmSync(raiz, { recursive: true, force: true }); });

test('SCRUM-973 · SUELO: el banco reproduce el caso — el último commit ES el merge', () => {
  assert.equal(git(repo, 'log', '-1', '--pretty=%s'), EL_MERGE,
    '🔴 el banco no monta el caso que se viene a medir: sin el merge arriba, lo de abajo no prueba nada.');
  assert.equal(git(repo, 'rev-list', '--count', 'refs/remotes/origin/main..HEAD'), '2',
    '🔴 la rama no tiene por delante de main el commit propio y el merge.');
});

test('SCRUM-973 · 🔴 EL ROJO: el mecanismo VIEJO titula el PR con el merge', () => {
  // Esto es literalmente lo que había en el workflow hasta hoy.
  assert.equal(git(repo, 'log', '-1', '--pretty=%s'), EL_MERGE,
    '🔴 si esto deja de ser el merge, el rojo de este ticket ya no se reproduce y hay que remedirlo.');
});

test('SCRUM-973 · ✅ EL VERDE: el comando DEL WORKFLOW saca el primer commit propio', () => {
  const orden = ordenDelTitulo(WF);
  assert.ok(orden, '🔴 el workflow ya no compone el título con `git log … | head -n 1`: '
    + 'o se arregló de otra forma, o se deshizo. Este test no puede medir lo que no encuentra.');
  const salida = git(repo, ...orden).split('\n');
  assert.equal(salida[0], EL_PROPIO,
    `🔴 el título sigue sin ser el primer commit propio de la rama. Orden usada: git ${orden.join(' ')}`);
  assert.ok(!salida.includes(EL_MERGE), '🔴 el merge sigue entrando en la lista de candidatos.');
});

test('SCRUM-973 · ✅ CONTROL NEGATIVO: sin merge encima, el título sigue siendo el commit propio', () => {
  // Ganar el caso del merge no puede perder el caso normal, que es el de todos los días.
  const orden = ordenDelTitulo(WF);
  git(repo, 'checkout', '-q', '-b', 'sin-merge', 'refs/remotes/origin/main');
  commit(EL_PROPIO, 'c.txt', 'tres\n');
  assert.equal(git(repo, ...orden).split('\n')[0], EL_PROPIO);
  assert.equal(git(repo, 'log', '-1', '--pretty=%s'), EL_PROPIO,
    'control del propio caso: aquí el viejo y el nuevo coinciden, y por eso este caso nunca avisó.');
});

test('SCRUM-973 · 🔴 SUELO del workflow: si sólo hay merges, NO vuelve al último commit', () => {
  // LA RAMA REHECHA, que es el caso real: su commit propio ya entró en `main` por otra vía, así
  // que al mergear `main` lo único que queda por delante es el merge. `--no-merges` no devuelve
  // nada y el workflow tiene que caer al NOMBRE DE LA RAMA, no al `git log -1` que es el defecto.
  const mainConLoSuyo = git(repo, 'commit-tree', '-p', git(repo, 'rev-parse', 'refs/remotes/origin/main'),
    '-p', git(repo, 'rev-parse', 'sin-merge'), '-m', 'Merge pull request #0 from lwislg99/sin-merge',
    git(repo, 'rev-parse', 'sin-merge^{tree}'));
  git(repo, 'update-ref', 'refs/remotes/origin/main', mainConLoSuyo);
  git(repo, 'checkout', '-q', 'sin-merge');
  git(repo, 'merge', '-q', '--no-ff', 'refs/remotes/origin/main', '-m', EL_MERGE);

  const orden = ordenDelTitulo(WF);
  assert.equal(git(repo, 'rev-list', '--count', 'refs/remotes/origin/main..HEAD'), '1',
    'el banco no reproduce el caso: por delante de main tiene que quedar SÓLO el merge.');
  assert.equal(git(repo, ...orden), '',
    'el banco no reproduce el caso: no debería quedar ningún commit propio sin mergear.');

  assert.match(PASO, /if \[ -z "\$TITULO" \]/,
    '🔴 el workflow no contempla que no haya commit propio: titularía el PR con la cadena vacía.');
  assert.match(PASO, /TITULO="\$RAMA"/,
    '🔴 el suelo no cae al nombre de la rama. Volver a `git log -1` sería el defecto otra vez.');
});

test('SCRUM-973 · 🔴 el ESPEJO mira también el TÍTULO, no sólo el cuerpo', () => {
  // Era un hueco: el título sale del asunto de un commit igual que el cuerpo —texto que escribe
  // otra persona— y sólo se comprobaba el cuerpo. Un commit titulado con la mención abría un PR
  // que despertaba a una sesión que nadie llamó.
  assert.ok(PASO.length > 0,
    '🔴 no encuentro el tramo del paso «Abrir el PR»: sin él, lo de abajo mediría sobre el vacío.');
  assert.match(PASO, /printf[^|]*"\$TITULO"[^|]*"\$CUERPO"[^|]*\| node -e/,
    '🔴 el espejo vuelve a mirar sólo el cuerpo: el título es la otra puerta y entra igual.');
  assert.ok(PASO.indexOf('TITULO=') < PASO.indexOf('cuerpoNoDebeDespertar'),
    '🔴 el título se compone DESPUÉS del espejo: se comprobaría una variable vacía.');
});

test('SCRUM-973 · ✅ el cuerpo sigue saliendo en orden y no se ha tocado', () => {
  // Lo que ya funcionaba tiene que seguir: la lista del cuerpo va con `--reverse`, y de ahí sale
  // la idea de este arreglo — el título es la primera línea de esa misma lista.
  assert.match(WF, /git log --reverse --pretty='- %s' origin\/main\.\.HEAD/,
    '🔴 ha cambiado cómo se compone la lista de commits del cuerpo.');
});
