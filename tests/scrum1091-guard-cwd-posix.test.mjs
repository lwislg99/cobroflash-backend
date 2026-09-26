// tests/scrum1091-guard-cwd-posix.test.mjs — SCRUM-1091
//
// EL CASO REAL, MEDIDO POR J6: con un `cd "/c/…" &&` delante —la forma en la que el propio
// prompt de arranque dice a TODA sesión de esta máquina que anteponga cada comando, porque el
// shell vuelve al directorio base tras cada uno— la regla 5 (redirección que trunca un fichero
// existente) dejaba de ver ficheros que SÍ existían.
//
// SCRUM-454 ya probaba `cd <ruta> && …`, pero con la ruta en forma NATIVA (`D:/x/y`). Nadie había
// probado la forma MSYS (`/d/x/y`) que es la que de verdad escriben las sesiones, y ahí es donde
// vivía el agujero: en Windows `path.isAbsolute('/c/…')` ya da `true`, así que `cwdDelComando` lo
// devolvía SIN TRADUCIR, y luego `path.resolve(cwd, destino)` lo trataba como relativo al drive
// actual — `C:\c\Users\…`, una ruta que nunca existe. El ENOENT de esa ruta inventada se leía como
// «no hay nada que perder», y el guard fallaba ABIERTO justo en el caso que más importa.
//
// ── POR QUÉ HAY DOS GRUPOS DE TESTS AQUÍ ─────────────────────────────────────────────────────
// `.github/workflows/ci.yml` corre TODO en `ubuntu-latest` — no hay ningún runner Windows en este
// repo. El defecto y el arreglo dependen de `path.isAbsolute`/`path.resolve` NATIVOS de Windows
// (`process.platform === 'win32'`), así que una reproducción con ficheros reales y la `evaluar()`
// completa SOLO puede darse en un host Windows de verdad: en Linux, `path.isAbsolute('/c/…')` es
// simplemente una ruta POSIX válida y no hay nada que duplicar.
//   ① Grupo determinista (corre en CUALQUIER host, con `path.win32` explícito y la `plataforma`
//     inyectable de `cwdDelComando` — SCRUM-1091): prueba la TRADUCCIÓN de verdad, sin fs.
//   ② Grupo end-to-end con `evaluar()` y un repo Git real: solo tiene sentido en `win32`, y en
//     cualquier otro host se declara el motivo (nunca un salto silencioso, A3) — verificado en
//     rojo/verde en la máquina de desarrollo real; el detalle está en `docs/master/SCRUM-1091.md`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluar, cwdDelComando } from '../.claude/hooks/guard-dangerous.mjs';

// ── ① DETERMINISTA: la traducción en sí, en CUALQUIER host ──────────────────────────────────

test('SCRUM-1091 · en win32, `/<letra>/…` se traduce a `<letra>:/…` — y ahí YA NO duplica la letra', () => {
  const cwd = cwdDelComando('cd "/d/Users/javier/repro" && echo hola', 'Z:/donde-sea', 'win32');
  assert.equal(cwd, 'd:/Users/javier/repro', `🔴 no tradujo: ${cwd}`);
  // Lo que de verdad importaba: con la forma traducida, path.win32.resolve ya no duplica la letra.
  assert.equal(path.win32.resolve(cwd, 'victima.md'), 'd:\\Users\\javier\\repro\\victima.md');
});

test('SCRUM-1091 · 🔴 LA RAÍZ DEL DEFECTO, sin fs y sin depender del cwd del host: `/d/…` YA es "absoluta" para win32', () => {
  // Esto es lo que hacía caer a `cwdDelComando` antes del arreglo: como `path.win32.isAbsolute`
  // ya da `true` para una ruta MSYS sin traducir, el código devolvía el destino TAL CUAL, sin
  // pasar por `posixADrive`. (La duplicación exacta de la letra que se ve en el mundo real —
  // `C:\c\Users\…`— depende encima de en qué drive esté el `cwd` del proceso, que varía de
  // máquina a máquina y en el runner de CI ni siquiera tiene una: por eso esta prueba no intenta
  // reproducir el string exacto, que dejaría de ser determinista, y se queda en el hecho que SÍ
  // lo es — medido en rojo el 26-sep-2026 al intentar lo primero.)
  assert.equal(path.win32.isAbsolute('/d/Users/javier/repro'), true,
    'si esto cambia, ya no hace falta `posixADrive`: revisar por qué dejó de hacer falta antes de tocar nada');
});

test('SCRUM-1091 · fuera de win32 (p.ej. el runner de CI), la forma MSYS se deja tal cual: no hay nada que traducir', () => {
  assert.equal(cwdDelComando('cd "/d/Users/x" && echo hola', '/donde-sea', 'linux'), '/d/Users/x');
});

test('SCRUM-1091 · una ruta YA nativa de Windows (sin forma MSYS) no se toca, tampoco en win32', () => {
  assert.equal(cwdDelComando('cd "D:/Users/x" && echo hola', 'Z:/donde-sea', 'win32'), 'D:/Users/x');
});

// ── ② END-TO-END: solo tiene sentido en un host win32 de verdad ─────────────────────────────

// SCRUM-456 exige el motivo del `skip` como LITERAL en el propio sitio (análisis estructural del
// AST, no por nombre de variable): una constante compartida no cuenta como declarado. Se repite
// el literal en cada `skip:`, igual que el resto de tests gateados de esta casa (`!ENABLED && '…'`).
const ES_WIN32 = process.platform === 'win32';

const SENTINEL_FALSO = path.join(os.tmpdir(), 'yaqu-1091-sentinel-que-no-existe');
const llamada = (c) => JSON.stringify({ tool_name: 'Bash', tool_input: { command: c, description: 'prueba' } });

function repoConVictima() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1091-')));
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 'x@x');
  git('config', 'user.name', 'x');
  fs.writeFileSync(path.join(dir, 'victima.md'), 'CONTENIDO ORIGINAL QUE NO DEBERIA PERDERSE\n');
  git('add', '-A');
  git('commit', '-qm', 'base');
  return dir;
}

/** El `dir` de Windows (`D:\x\y`) en la forma MSYS que usan las sesiones (`/d/x/y`). */
function aPosix(dirWindows) {
  const [letra, ...resto] = dirWindows.replace(/\\/g, '/').split(':/');
  return `/${letra.toLowerCase()}/${resto.join(':/')}`;
}

const DIR = ES_WIN32 ? repoConVictima() : null;
test.after(() => { if (DIR) fs.rmSync(DIR, { recursive: true, force: true }); });

test('SCRUM-1091 · cwdDelComando (host real) traduce `/<letra>/…`: path.resolve ya no duplica la letra', { skip: !ES_WIN32 && 'el defecto depende de path.isAbsolute/resolve NATIVOS de Windows; este runner no es win32 (ver docs/master/SCRUM-1091.md)' }, () => {
  const cwd = cwdDelComando(`cd "${aPosix(DIR)}" && echo hola`, 'Z:/donde-sea');
  assert.equal(path.resolve(cwd, 'victima.md').toLowerCase(), path.join(DIR, 'victima.md').toLowerCase(),
    `🔴 la letra se duplica: cwdDelComando devolvió ${cwd}`);
});

test('SCRUM-1091 · una ruta ya nativa (sin forma MSYS) no se toca, en el host real', { skip: !ES_WIN32 && 'el defecto depende de path.isAbsolute/resolve NATIVOS de Windows; este runner no es win32 (ver docs/master/SCRUM-1091.md)' }, () => {
  assert.equal(cwdDelComando(`cd "${DIR.replace(/\\/g, '/')}" && echo hola`, 'Z:/donde-sea'), DIR.replace(/\\/g, '/'));
});

test('SCRUM-1091 · 🔴 EL CASO REAL: `cd "/<letra>/…" && … > fichero-existente` SÍ bloquea (antes pasaba limpio)', { skip: !ES_WIN32 && 'el defecto depende de path.isAbsolute/resolve NATIVOS de Windows; este runner no es win32 (ver docs/master/SCRUM-1091.md)' }, () => {
  const comando = `cd "${aPosix(DIR)}" && echo "NUEVO TEXTO QUE TRUNCA" > victima.md`;
  const { bloqueado, motivo } = evaluar(llamada(comando), SENTINEL_FALSO);
  assert.equal(bloqueado, true,
    '🔴 con `cd "/<letra>/…" &&` delante —la forma en la que TODA sesión antepone sus comandos— '
    + `una redirección que trunca un fichero real pasa limpio: la regla 5 está ciega. motivo=${motivo}`);
  assert.match(motivo, /TRUNCA un fichero/);
});

test('SCRUM-1091 · control negativo: la misma forma de `cd`, sobre un fichero que NO existe, no bloquea', { skip: !ES_WIN32 && 'el defecto depende de path.isAbsolute/resolve NATIVOS de Windows; este runner no es win32 (ver docs/master/SCRUM-1091.md)' }, () => {
  const comando = `cd "${aPosix(DIR)}" && echo "contenido" > nuevo-de-verdad.md`;
  const { bloqueado } = evaluar(llamada(comando), SENTINEL_FALSO);
  assert.equal(bloqueado, false, '🔴 control negativo: no debería bloquear algo nuevo');
});
