// tests/scrum1648b-guard-dangerous-powershell-y-cwd.test.mjs — SCRUM-1648b
//
// `.claude/hooks/guard-dangerous.mjs` FALLABA HACIA ABIERTO por cinco sitios (SCRUM-1648, medido por
// la S5 el 2-nov-2026 con el banco de `docs/master/evidencias/scrum1648/`):
//   1. en PowerShell leía `\` como escape de POSIX: `cd D:\a\b` quedaba en `D:ab`, una ruta que no
//      existe, y «no existe» se leía como «nada que perder»;
//   2. un `>` con ruta ABSOLUTA se preguntaba a git desde la carpeta de la sesión: si el fichero era
//      de OTRO repo, git daba 128 y el guard lo tomaba por «fuera de jurisdicción»;
//   3. la regla 7 (junction) descartaba la ruta MSYS (`/c/…`): lo curó SCRUM-1792 y aquí sólo se ata;
//   4. `Remove-Item -Recurse` no entraba en la regla 7;
//   5. `Set-Location X` no contaba como `cd`: se miraba el árbol de la sesión y no X.
//
// ── LA MISMA FORMA QUE scrum1792 ───────────────────────────────────────────────────────────
//   ① Grupo determinista: corre en CUALQUIER host (el CI es `ubuntu-latest`). `plataforma` y la
//     sonda del enlace se inyectan por `opciones` de `evaluar()`. Una ruta relativa a una UNIDAD
//     (`Z:xrepo`, la lectura de bash) la completa el host: de ésas se asevera la forma, no la ruta
//     (rojo del primer CI, run 46000711974; se reproduce en Windows con
//     `docs/master/evidencias/scrum1648/host-linux.mjs`).
//   ② End-to-end con dos repos de git fabricados en un temporal (uno sucio, uno limpio), con barra
//     normal: corre en cualquier host. Ata el `>` absoluto desde otro repo y `Set-Location`.
//   ③ End-to-end sólo en win32: la ruta con `\` sin comillas y una junction de verdad, cuyo destino
//     es una carpeta del propio temporal con un testigo (cicatriz J6 de SCRUM-1391).
// Se llama a `evaluar()` con los dos sentinels apuntando a rutas que no existen: por el CLI (stdin)
// un caso que bloquea GASTARÍA el `.claude/allow-destructivo` de verdad si otra sesión lo tuviera.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { evaluar, acciones, cwdDelComando } from '../.claude/hooks/guard-dangerous.mjs';
import { temporal, borrarTemporal } from './_temporal.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: '.claude/hooks/guard-dangerous.mjs',
    de: "const barraLiteral = herramienta === 'PowerShell';",
    a: 'const barraLiteral = false;',
    cae: 'SCRUM-1648b · (a) PowerShell, en cualquier host: `git worktree remove Z:\\x\\arbol` sin comillas, con el node_modules enlazado, PARA',
  },
  {
    fichero: '.claude/hooks/guard-dangerous.mjs',
    de: 'const carpetas = [path.dirname(abs), cwd];',
    a: 'const carpetas = [cwd];',
    cae: 'SCRUM-1648b · (e) `>` con la ruta absoluta de un rastreado de OTRO repo PARA, se lance desde otro repo o desde fuera de git',
  },
  {
    fichero: '.claude/hooks/guard-dangerous.mjs',
    de: '|| (REMOVE_ITEM.has(a.programa) && flags(a).some(esRecurse))',
    a: '',
    cae: 'SCRUM-1648b · (g) PowerShell, en cualquier host: `Remove-Item -Recurse -Force` sobre un árbol con el node_modules enlazado PARA',
  },
  {
    fichero: '.claude/hooks/guard-dangerous.mjs',
    de: "const SET_LOCATION = new Set(['set-location', 'sl', 'chdir']);",
    a: 'const SET_LOCATION = new Set([]);',
    cae: 'SCRUM-1648b · (h) `Set-Location <repo SUCIO>; git reset --hard` PARA mirando ESE repo, no la carpeta de la sesión',
  },
];

const SENTINEL_FALSO = path.join(os.tmpdir(), 'yaqu-1648b-sentinel-que-no-existe');
const DESTRUCTIVO_FALSO = path.join(os.tmpdir(), 'yaqu-1648b-allow-destructivo-que-no-existe');
const llamada = (herramienta, c) => JSON.stringify({ tool_name: herramienta, tool_input: { command: c, description: 'prueba' } });

// ── ① DETERMINISTA, en CUALQUIER host ────────────────────────────────────────────────────────

function evaluarWin32(herramienta, comando, enlaces) {
  const consultas = [];
  const conocidos = new Set(enlaces.map((e) => path.win32.normalize(e).toLowerCase()));
  const esEnlace = (q) => { consultas.push(q); return conocidos.has(path.win32.normalize(q).toLowerCase()); };
  const r = evaluar(llamada(herramienta, comando), SENTINEL_FALSO, {
    cwd: 'Q:/base', sentinelDestructivo: DESTRUCTIVO_FALSO, plataforma: 'win32', esEnlace,
  });
  return { ...r, consultas };
}
const ENLACE_FALSO = 'Z:/x/arbol/node_modules';

test('SCRUM-1648b · (a) PowerShell, en cualquier host: `git worktree remove Z:\\x\\arbol` sin comillas, con el node_modules enlazado, PARA', () => {
  const r = evaluarWin32('PowerShell', 'git worktree remove Z:\\x\\arbol', [ENLACE_FALSO]);
  assert.equal(r.bloqueado, true, `🔴 la ruta con \\ no se miró. consultas=${JSON.stringify(r.consultas)}`);
  assert.match(r.motivo, /contiene un ENLACE \(junction\)/);
  assert.ok(r.consultas.includes('Z:\\x\\arbol\\node_modules'), JSON.stringify(r.consultas));
});

test('SCRUM-1648b · (a) control: la MISMA orden en Bash sigue leyendo `\\` como escape, que es lo que hace bash', () => {
  // En bash `Z:\x\arbol` ES `Z:xarbol`: el guard tiene que seguir leyendo lo que el shell ejecuta.
  const r = evaluarWin32('Bash', 'git worktree remove Z:\\x\\arbol', [ENLACE_FALSO]);
  assert.equal(r.bloqueado, false);
  assert.ok(r.consultas.length > 0, 'el control no miró nada: no distingue «no es enlace» de «no pregunté»');
  // Lo que no depende del host es la lectura del shell: la palabra es `Z:xarbol`.
  const palabras = acciones('git worktree remove Z:\\x\\arbol', 0, 'Bash').flatMap((a) => a.palabras.map((p) => p.texto));
  assert.ok(palabras.includes('Z:xarbol'), JSON.stringify(palabras));
  // `Z:xarbol` es relativa a la UNIDAD Z:, y `path.win32.resolve` la completa con la carpeta actual
  // de esa unidad, que saca del host (`process.env['=Z:']` o `process.cwd()`): en Windows sale
  // `Z:\xarbol`, y en el CI de Linux `Z:\home\runner\work\…\xarbol` (run 46000711974). Por eso se
  // asevera la forma, no la ruta: se pregunta por una `…\xarbol` de Z:, y nunca por la que lee
  // PowerShell.
  assert.ok(r.consultas.some((q) => q.startsWith('Z:\\') && path.win32.basename(q) === 'xarbol'), JSON.stringify(r.consultas));
  for (const dePowerShell of ['Z:\\x\\arbol', 'Z:\\x\\arbol\\node_modules']) {
    assert.ok(!r.consultas.includes(dePowerShell), `leyó la ruta de PowerShell: ${JSON.stringify(r.consultas)}`);
  }
});

test('SCRUM-1648b · (b) PowerShell, en cualquier host: `rm -r Z:\\x\\arbol` sin comillas, con el node_modules enlazado, PARA', () => {
  const r = evaluarWin32('PowerShell', 'rm -r Z:\\x\\arbol', [ENLACE_FALSO]);
  assert.equal(r.bloqueado, true, JSON.stringify(r.consultas));
  assert.match(r.motivo, /contiene un ENLACE \(junction\)/);
});

test('SCRUM-1648b · (c) PowerShell, en cualquier host: el destino de `> Z:\\x\\f.txt` llega ENTERO a la regla 5', () => {
  const ps = acciones('echo x > Z:\\x\\f.txt', 0, 'PowerShell').flatMap((a) => a.redirecciones);
  assert.deepEqual(ps, ['Z:\\x\\f.txt']);
  // Y en Bash, igual que antes: el shell se come las barras.
  const bash = acciones('echo x > Z:\\x\\f.txt', 0, 'Bash').flatMap((a) => a.redirecciones);
  assert.deepEqual(bash, ['Z:xf.txt']);
});

test('SCRUM-1648b · (d) PowerShell, en cualquier host: `cd Z:\\x\\repo; …` se evalúa en Z:\\x\\repo, no en una ruta inventada', () => {
  assert.equal(cwdDelComando('cd Z:\\x\\repo; git switch -c nueva', 'Q:/base', 'win32', 'PowerShell'), 'Z:\\x\\repo');
  // En Bash es `Z:xrepo`, relativa a la unidad Z:: su carpeta la pone el host, como en el control de
  // (a). Fijo en cualquier host: no es la de PowerShell, es de Z: y acaba en `xrepo`.
  const enBash = cwdDelComando('cd Z:\\x\\repo && git switch -c nueva', 'Q:/base', 'win32', 'Bash');
  assert.notEqual(enBash, 'Z:\\x\\repo');
  assert.ok(enBash.startsWith('Z:\\') && path.win32.basename(enBash) === 'xrepo', enBash);
});

test('SCRUM-1648b · (f) MSYS, en cualquier host: `git worktree remove /z/x/arbol` con el node_modules enlazado PARA', () => {
  // Lo curó SCRUM-1792; aquí se ata también SIN comillas y desde PowerShell.
  for (const herramienta of ['Bash', 'PowerShell']) {
    const r = evaluarWin32(herramienta, 'git worktree remove /z/x/arbol', [ENLACE_FALSO]);
    assert.equal(r.bloqueado, true, `${herramienta}: ${JSON.stringify(r.consultas)}`);
  }
});

test('SCRUM-1648b · (g) PowerShell, en cualquier host: `Remove-Item -Recurse -Force` sobre un árbol con el node_modules enlazado PARA', () => {
  const ordenes = [
    'Remove-Item -Recurse -Force Z:\\x\\arbol',
    'Remove-Item Z:/x/arbol -Recurse',
    'Remove-Item -LiteralPath "Z:\\x\\arbol" -rec -fo',
    'ri -r Z:\\x\\arbol',
    'rd Z:\\x\\arbol -Recurse',
  ];
  for (const orden of ordenes) {
    const r = evaluarWin32('PowerShell', orden, [ENLACE_FALSO]);
    assert.equal(r.bloqueado, true, `🔴 pasó: ${orden} · consultas=${JSON.stringify(r.consultas)}`);
    assert.match(r.motivo, /contiene un ENLACE \(junction\)/);
  }
  // Control: el mismo árbol SIN enlace no para (la sonda sí pregunta, y dice que no).
  const limpio = evaluarWin32('PowerShell', 'Remove-Item -Recurse -Force Z:\\x\\arbol', []);
  assert.equal(limpio.bloqueado, false);
  assert.ok(limpio.consultas.includes('Z:\\x\\arbol\\node_modules'), JSON.stringify(limpio.consultas));
});

test('SCRUM-1648b · (h) en cualquier host: `Set-Location` y sus alias cuentan como `cd`, con `-Path` o sin él', () => {
  const casos = [
    'Set-Location Z:\\x\\repo; git reset --hard',
    'Set-Location -Path Z:\\x\\repo; git reset --hard',
    'sl Z:\\x\\repo; git reset --hard',
    'chdir Z:\\x\\repo; git reset --hard',
  ];
  for (const c of casos) assert.equal(cwdDelComando(c, 'Q:/base', 'win32', 'PowerShell'), 'Z:\\x\\repo', c);
});

// ── ② END-TO-END con dos repos de verdad, en CUALQUIER host ──────────────────────────────────

const DIR = fs.realpathSync(temporal('yaqu-1648b-'));
const SUCIO = path.join(DIR, 'sucio');
const LIMPIO = path.join(DIR, 'limpio');
const NO_REPO = path.join(DIR, 'base-no-repo');
const DESTINO = path.join(DIR, 'destino');
const CONJ = path.join(DIR, 'conj');
const TESTIGO = path.join(DESTINO, 'testigo.txt');
const SIN_COMMITEAR = 'trabajo SIN COMMITEAR\n';
// Cada creación nombra su constante, que cuelga de DIR a la vista: el censo de SCRUM-824 no sigue
// la variable de un bucle.
fs.mkdirSync(SUCIO);
fs.mkdirSync(LIMPIO);
fs.mkdirSync(NO_REPO);
fs.mkdirSync(DESTINO);
fs.mkdirSync(CONJ);
const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const iniciar = (r) => {
  git(r, 'init', '-q');
  git(r, 'config', 'user.email', 'banco@example.invalid');
  git(r, 'config', 'user.name', 'banco');
  git(r, 'config', 'core.autocrlf', 'false');
};
const comitear = (r) => { git(r, 'add', '.'); git(r, 'commit', '-qm', 'base'); };
iniciar(SUCIO);
fs.writeFileSync(path.join(SUCIO, 'rastreado.txt'), 'trabajo\n');
fs.writeFileSync(path.join(SUCIO, '.gitignore'), 'ignorado.log\n');
comitear(SUCIO);
iniciar(LIMPIO);
fs.writeFileSync(path.join(LIMPIO, 'rastreado.txt'), 'trabajo\n');
fs.writeFileSync(path.join(LIMPIO, '.gitignore'), 'ignorado.log\n');
comitear(LIMPIO);
fs.writeFileSync(path.join(LIMPIO, 'ignorado.log'), 'ruido\n');
fs.writeFileSync(path.join(SUCIO, 'rastreado.txt'), SIN_COMMITEAR);
fs.writeFileSync(TESTIGO, 'lo enlazado tiene que seguir aquí\n');
fs.symlinkSync(DESTINO, path.join(CONJ, 'node_modules'), 'junction');

test.after(() => {
  // Primero el enlace, SIN seguirlo; después se comprueba que lo enlazado sigue entero; y sólo
  // entonces se borra el temporal (cicatriz J6 de SCRUM-1391). El guard sólo PREGUNTA.
  fs.unlinkSync(path.join(CONJ, 'node_modules'));
  assert.equal(fs.readFileSync(TESTIGO, 'utf8'), 'lo enlazado tiene que seguir aquí\n');
  assert.equal(fs.readFileSync(path.join(SUCIO, 'rastreado.txt'), 'utf8'), SIN_COMMITEAR);
  borrarTemporal(DIR);
});

const fw = (p) => p.replace(/\\/g, '/');
const e2e = (herramienta, comando, base) =>
  evaluar(llamada(herramienta, comando), SENTINEL_FALSO, { base, sentinelDestructivo: DESTRUCTIVO_FALSO });

test('SCRUM-1648b · el banco: un repo sucio, uno limpio, una carpeta que no es repo y un enlace de verdad', () => {
  assert.equal(git(SUCIO, 'status', '--porcelain', '--untracked-files=no').trim(), 'M rastreado.txt');
  assert.equal(git(LIMPIO, 'status', '--porcelain', '--untracked-files=no').trim(), '');
  assert.equal(fs.lstatSync(path.join(CONJ, 'node_modules')).isSymbolicLink(), true);
  assert.throws(() => git(NO_REPO, 'rev-parse', '--git-dir'));
});

test('SCRUM-1648b · (e) `>` con la ruta absoluta de un rastreado de OTRO repo PARA, se lance desde otro repo o desde fuera de git', () => {
  const objetivo = fw(path.join(LIMPIO, 'rastreado.txt'));
  for (const [nombre, base] of [['el mismo repo', LIMPIO], ['OTRO repo', SUCIO], ['una carpeta que no es repo', NO_REPO]]) {
    for (const herramienta of ['PowerShell', 'Bash']) {
      const r = e2e(herramienta, `echo x > "${objetivo}"`, base);
      assert.equal(r.bloqueado, true, `🔴 desde ${nombre} (${herramienta}) pasó el > sobre ${objetivo}`);
      assert.match(r.motivo, /TRUNCA un fichero que ya existe y que git no ignora/);
    }
  }
});

test('SCRUM-1648b · (e) control: lo que git IGNORA en su repo y lo que no existe siguen pasando, también desde otro repo', () => {
  // El mismo motivo que arriba SÍ sale para el rastreado: la negación tiene su positivo al lado.
  const rastreado = e2e('Bash', `echo x > "${fw(path.join(LIMPIO, 'rastreado.txt'))}"`, SUCIO);
  assert.match(rastreado.motivo, /TRUNCA un fichero/);
  for (const nombre of ['ignorado.log', 'no-existe.txt']) {
    const r = e2e('Bash', `echo x > "${fw(path.join(LIMPIO, nombre))}"`, SUCIO);
    assert.equal(r.bloqueado, false, `${nombre}: ${r.motivo}`);
  }
});

test('SCRUM-1648b · (h) `Set-Location <repo SUCIO>; git reset --hard` PARA mirando ESE repo, no la carpeta de la sesión', () => {
  const r = e2e('PowerShell', `Set-Location "${fw(SUCIO)}"; git reset --hard`, LIMPIO);
  assert.equal(r.bloqueado, true, '🔴 miró la carpeta de la sesión (limpia) y no el repo sucio de Set-Location');
  assert.match(r.motivo, /DESCARTA cambios sin commitear/);
  assert.match(r.motivo, /rastreado\.txt/);
});

test('SCRUM-1648b · (h) el reverso: `Set-Location <repo LIMPIO>; git switch -c nueva` DEJA aunque la sesión esté en un árbol sucio', () => {
  // Antes se bloqueaba listando los cambios del árbol de la SESIÓN (visto en vivo, SCRUM-1648 c.21339).
  const r = e2e('PowerShell', `Set-Location "${fw(LIMPIO)}"; git switch -c nueva`, SUCIO);
  assert.equal(r.bloqueado, false, r.motivo);
  // Positivo: la misma orden SIN el Set-Location, desde el sucio, para.
  assert.equal(e2e('PowerShell', 'git switch -c nueva', SUCIO).bloqueado, true);
});

test('SCRUM-1648b · regla 6 con ruta absoluta: `git checkout -- <rastreado de OTRO repo>` se pregunta en ESE repo', () => {
  const sucio = e2e('Bash', `git checkout -- "${fw(path.join(SUCIO, 'rastreado.txt'))}"`, LIMPIO);
  assert.equal(sucio.bloqueado, true);
  assert.match(sucio.motivo, /DESCARTA cambios sin commitear/);
  assert.match(sucio.motivo, /rastreado\.txt/);
  const limpio = e2e('Bash', `git checkout -- "${fw(path.join(LIMPIO, 'rastreado.txt'))}"`, SUCIO);
  assert.equal(limpio.bloqueado, false, limpio.motivo);
});

// ── ③ END-TO-END sólo en win32: `\` sin comillas y la junction de verdad ─────────────────────

// SCRUM-456 exige el motivo del `skip` como LITERAL en el propio sitio: se repite en cada `skip:`.
const ES_WIN32 = process.platform === 'win32';
/** La ruta en su forma corta 8.3: sin comillas, una ruta con espacios son varias palabras. */
function rutaCorta(dir) {
  if (!ES_WIN32) return dir;
  try {
    const corta = execFileSync('cmd', ['/d', '/c', `for %I in ("${dir}") do @echo %~sI`], { encoding: 'utf8', windowsVerbatimArguments: true }).trim();
    return corta && fs.existsSync(corta) ? corta : dir;
  } catch {
    return dir;
  }
}
const bs = (p) => rutaCorta(p).replace(/\//g, '\\');
const msys = (p) => fw(rutaCorta(p)).replace(/^([A-Za-z]):/, (_, l) => `/${l.toLowerCase()}`);
const SE_PUEDE = ES_WIN32 && !/\s/.test(rutaCorta(DIR));

test('SCRUM-1648b · win32 · (a)(b)(g) `git worktree remove`, `rm -r` y `Remove-Item -Recurse` con `X:\\…` sin comillas PARAN ante la junction de verdad', { skip: !SE_PUEDE && 'una ruta con letra de unidad y barras invertidas sólo existe en win32, y sin comillas no admite espacios; el grupo determinista lo ata en cualquier host' }, () => {
  for (const orden of [`git worktree remove ${bs(CONJ)}`, `rm -r ${bs(CONJ)}`, `Remove-Item -Recurse -Force ${bs(CONJ)}`]) {
    const r = e2e('PowerShell', orden, NO_REPO);
    assert.equal(r.bloqueado, true, `🔴 pasó: ${orden}`);
    assert.match(r.motivo, /contiene un ENLACE \(junction\)/);
  }
});

test('SCRUM-1648b · win32 · (c) PowerShell: `echo x > X:\\…\\rastreado.txt` sin comillas PARA, absoluto y relativo tras el `cd`', { skip: !SE_PUEDE && 'una ruta con letra de unidad y barras invertidas sólo existe en win32, y sin comillas no admite espacios; el grupo determinista lo ata en cualquier host' }, () => {
  const absoluto = e2e('PowerShell', `echo x > ${bs(path.join(LIMPIO, 'rastreado.txt'))}`, NO_REPO);
  assert.equal(absoluto.bloqueado, true);
  assert.match(absoluto.motivo, /TRUNCA un fichero/);
  const relativo = e2e('PowerShell', `cd ${bs(SUCIO)}; echo x > rastreado.txt`, NO_REPO);
  assert.equal(relativo.bloqueado, true);
  assert.match(relativo.motivo, /TRUNCA un fichero/);
});

test('SCRUM-1648b · win32 · (d) PowerShell: `cd X:\\…\\repo-LIMPIO; git switch -c nueva` DEJA, y en el árbol SUCIO PARA', { skip: !SE_PUEDE && 'una ruta con letra de unidad y barras invertidas sólo existe en win32, y sin comillas no admite espacios; el grupo determinista lo ata en cualquier host' }, () => {
  const limpio = e2e('PowerShell', `cd ${bs(LIMPIO)}; git switch -c nueva`, NO_REPO);
  assert.equal(limpio.bloqueado, false, limpio.motivo);
  const sucio = e2e('PowerShell', `cd ${bs(SUCIO)}; git switch -c nueva`, NO_REPO);
  assert.equal(sucio.bloqueado, true);
  assert.match(sucio.motivo, /CAMBIA la rama actual de un arbol que tiene cambios SIN COMMITEAR/);
});

test('SCRUM-1648b · win32 · (f) MSYS: `git worktree remove /c/…` y `> /c/…/rastreado.txt` PARAN', { skip: !SE_PUEDE && 'la forma MSYS (/c/…) sólo existe en win32, y sin comillas no admite espacios; el grupo determinista lo ata en cualquier host' }, () => {
  const arbol = e2e('Bash', `git worktree remove ${msys(CONJ)}`, NO_REPO);
  assert.equal(arbol.bloqueado, true);
  assert.match(arbol.motivo, /contiene un ENLACE \(junction\)/);
  const trunca = e2e('Bash', `echo x > ${msys(path.join(LIMPIO, 'rastreado.txt'))}`, NO_REPO);
  assert.equal(trunca.bloqueado, true);
  assert.match(trunca.motivo, /TRUNCA un fichero/);
});

test('SCRUM-1648b · win32 · (h) PowerShell: `Set-Location X:\\…\\repo-SUCIO; git reset --hard` PARA mirando X', { skip: !SE_PUEDE && 'una ruta con letra de unidad y barras invertidas sólo existe en win32, y sin comillas no admite espacios; el grupo determinista lo ata en cualquier host' }, () => {
  const r = e2e('PowerShell', `Set-Location ${bs(SUCIO)}; git reset --hard`, LIMPIO);
  assert.equal(r.bloqueado, true);
  assert.match(r.motivo, /DESCARTA cambios sin commitear/);
  assert.match(r.motivo, /rastreado\.txt/);
});
