// tests/scrum1792-regla7-ruta-msys.test.mjs — SCRUM-1792
//
// EL CASO REAL (orquestador J, 23-nov-2026): desde Git Bash,
//     git worktree remove "/c/Users/Javier Pereira/cobroflash-jv-j3cp"
// sobre un árbol cuyo `node_modules` era un ENLACE al compartido, y la regla 7 de
// `.claude/hooks/guard-dangerous.mjs` (cadenas de junction, SCRUM-429) NO paró.
//
// La causa, medida aquí (no la que se leyó en el ticket): el bucle de la regla 7 descarta toda
// palabra que empiece por `/`, para no tomar por ruta las opciones de `rmdir` (`/s`, `/q`). Una
// ruta MSYS (`/c/…`) empieza por `/`, así que se descartaba ENTERA y no se miraba nunca. El
// traductor ya existía —`posixADrive`, SCRUM-1091— y la regla 7 no lo usaba.
//
// ── LA MISMA FORMA QUE scrum1091 ───────────────────────────────────────────────────────────
//   ① Grupo determinista: corre en CUALQUIER host (el CI es `ubuntu-latest`). La `plataforma` y la
//     sonda del enlace se inyectan por `opciones` de `evaluar()`, igual que el `cwd`; así la
//     traducción se ejerce sin un disco con letra. Es el que tumba la mutación del catálogo.
//   ② Grupo end-to-end con un enlace FABRICADO en un temporal: el destino es una carpeta del propio
//     temporal con un testigo dentro, nunca un `node_modules` de verdad (cicatriz J6 de SCRUM-1391).
//     La forma MSYS y la nativa `C:\…` sólo existen en win32 y fuera se declara el motivo; la ruta
//     relativa y el árbol sin enlace corren en cualquier host.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluar } from '../.claude/hooks/guard-dangerous.mjs';
import { temporal, borrarTemporal } from './_temporal.mjs';

// Quitar la traducción de la regla 7 vuelve a dejar pasar la ruta MSYS: lo cazan el caso del
// grupo determinista (cualquier host) y, en win32, el end-to-end.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: '.claude/hooks/guard-dangerous.mjs',
    de: '.map((t) => (/^\\/[a-zA-Z]\\//.test(t) ? posixADrive(t, plataforma) : t));',
    a: '.map((t) => t);',
    cae: 'SCRUM-1792 · 🔴 EL CASO, en cualquier host: `git worktree remove "/c/…"` con el node_modules enlazado PARA',
  },
];

const SENTINEL_FALSO = path.join(os.tmpdir(), 'yaqu-1792-sentinel-que-no-existe');
// El sentinel de un solo uso de la regla 5-7: si existiera de verdad, un caso que bloquea lo GASTARÍA.
const DESTRUCTIVO_FALSO = path.join(os.tmpdir(), 'yaqu-1792-allow-destructivo-que-no-existe');
const llamada = (c) => JSON.stringify({ tool_name: 'Bash', tool_input: { command: c, description: 'prueba' } });

// ── ① DETERMINISTA: la traducción, en CUALQUIER host ─────────────────────────────────────────

/** Sonda falsa: anota cada ruta que la regla 7 pregunta y sólo da «enlace» para `enlaces`. */
function sondaFalsa(enlaces) {
  const consultas = [];
  const conocidos = new Set(enlaces.map((e) => path.win32.normalize(e).toLowerCase()));
  const esEnlace = (q) => {
    consultas.push(q);
    return conocidos.has(path.win32.normalize(q).toLowerCase());
  };
  return { consultas, esEnlace };
}

function evaluarWin32(comando, enlaces) {
  const sonda = sondaFalsa(enlaces);
  const r = evaluar(llamada(comando), SENTINEL_FALSO, {
    cwd: 'Z:/base',
    sentinelDestructivo: DESTRUCTIVO_FALSO,
    plataforma: 'win32',
    esEnlace: sonda.esEnlace,
  });
  return { ...r, consultas: sonda.consultas };
}

const ENLACE_FALSO = 'c:/Users/x/arbol/node_modules';

test('SCRUM-1792 · 🔴 EL CASO, en cualquier host: `git worktree remove "/c/…"` con el node_modules enlazado PARA', () => {
  const r = evaluarWin32('git worktree remove "/c/Users/x/arbol"', [ENLACE_FALSO]);
  assert.equal(r.bloqueado, true, `🔴 la ruta MSYS no se miró. consultas=${JSON.stringify(r.consultas)}`);
  assert.match(r.motivo, /contiene un ENLACE \(junction\)/);
  assert.ok(r.consultas.includes('c:\\Users\\x\\arbol\\node_modules'), JSON.stringify(r.consultas));
});

// `rm -rf` con ruta absoluta lo para antes la regla 4 (AA2), con otro motivo: el hueco de la 7 es `rm -r`.
test('SCRUM-1792 · 🔴 `rm -r "/c/…"`, que comparte el bucle, también PARA', () => {
  const r = evaluarWin32('rm -r "/c/Users/x/arbol"', [ENLACE_FALSO]);
  assert.equal(r.bloqueado, true, `🔴 consultas=${JSON.stringify(r.consultas)}`);
  assert.match(r.motivo, /contiene un ENLACE \(junction\)/);
});

test('SCRUM-1792 · 🔴 `rmdir /s /q "/c/…"` PARA, y `/s` y `/q` siguen siendo opciones: no se preguntan como discos', () => {
  const r = evaluarWin32('rmdir /s /q "/c/Users/x/arbol"', [ENLACE_FALSO]);
  assert.equal(r.bloqueado, true, `🔴 consultas=${JSON.stringify(r.consultas)}`);
  // Sin enlace: la lista EXACTA de lo que se pregunta. Ni `s:/` ni `q:/`: sólo el árbol y su node_modules.
  const limpio = evaluarWin32('rmdir /s /q "/c/Users/x/arbol"', []);
  assert.equal(limpio.bloqueado, false);
  assert.deepEqual(limpio.consultas, ['c:/Users/x/arbol', 'c:\\Users\\x\\arbol\\node_modules']);
});

test('SCRUM-1792 · control: sin enlace en la ruta MSYS, `git worktree remove "/c/…"` NO para', () => {
  const r = evaluarWin32('git worktree remove "/c/Users/x/arbol"', ['c:/Users/x/OTRO/node_modules']);
  assert.equal(r.bloqueado, false, `🔴 paró sin enlace: ${r.motivo}`);
  assert.ok(r.consultas.includes('c:\\Users\\x\\arbol\\node_modules'), `🔴 ni siquiera miró: ${JSON.stringify(r.consultas)}`);
});

// ── ② END-TO-END con un enlace fabricado ────────────────────────────────────────────────────

// SCRUM-456 exige el motivo del `skip` como LITERAL en el propio sitio: se repite en cada `skip:`.
const ES_WIN32 = process.platform === 'win32';

/** El `dir` de Windows (`C:\x\y`) en la forma MSYS que usan las sesiones (`/c/x/y`). */
function aPosix(dirWindows) {
  const [letra, ...resto] = dirWindows.replace(/\\/g, '/').split(':/');
  return `/${letra.toLowerCase()}/${resto.join(':/')}`;
}

const DIR = fs.realpathSync(temporal('yaqu-1792-'));
const DESTINO = path.join(DIR, 'destino');
const CON_ENLACE = path.join(DIR, 'con-enlace');
const SIN_ENLACE = path.join(DIR, 'sin-enlace');
const TESTIGO = path.join(DESTINO, 'testigo.txt');
fs.mkdirSync(DESTINO);
fs.writeFileSync(TESTIGO, 'lo enlazado tiene que seguir aquí\n');
fs.mkdirSync(CON_ENLACE);
fs.symlinkSync(DESTINO, path.join(CON_ENLACE, 'node_modules'), 'junction');
fs.mkdirSync(path.join(SIN_ENLACE, 'node_modules'), { recursive: true });

test.after(() => {
  // Primero el enlace, SIN seguirlo; después se comprueba que lo enlazado sigue entero; y sólo
  // entonces se borra el temporal (cicatriz J6 de SCRUM-1391).
  fs.unlinkSync(path.join(CON_ENLACE, 'node_modules'));
  assert.equal(fs.readFileSync(TESTIGO, 'utf8'), 'lo enlazado tiene que seguir aquí\n');
  borrarTemporal(DIR);
});

const e2e = (comando, cwd = DIR) =>
  evaluar(llamada(comando), SENTINEL_FALSO, { cwd, sentinelDestructivo: DESTRUCTIVO_FALSO });

test('SCRUM-1792 · el banco: `con-enlace/node_modules` ES un enlace y `sin-enlace/node_modules` no', () => {
  assert.equal(fs.lstatSync(path.join(CON_ENLACE, 'node_modules')).isSymbolicLink(), true);
  assert.equal(fs.lstatSync(path.join(SIN_ENLACE, 'node_modules')).isSymbolicLink(), false);
});

test('SCRUM-1792 · 🔴 EL CASO REAL en el host: `git worktree remove "/c/…"` sobre un árbol con node_modules enlazado PARA', { skip: !ES_WIN32 && 'la forma MSYS (/c/…) sólo existe en win32; este runner no lo es (el grupo determinista la cubre aquí)' }, () => {
  const { bloqueado, motivo } = e2e(`git worktree remove "${aPosix(CON_ENLACE)}"`);
  assert.equal(bloqueado, true, `🔴 la regla 7 no vio el enlace con la ruta MSYS. motivo=${motivo}`);
  assert.match(motivo, /contiene un ENLACE \(junction\)/);
});

test('SCRUM-1792 · 🔴 `rm -r "/c/…"` y `rmdir /s /q "/c/…"` sobre el mismo árbol PARAN en el host', { skip: !ES_WIN32 && 'la forma MSYS (/c/…) sólo existe en win32; este runner no lo es (el grupo determinista la cubre aquí)' }, () => {
  for (const comando of [`rm -r "${aPosix(CON_ENLACE)}"`, `rmdir /s /q "${aPosix(CON_ENLACE)}"`]) {
    const { bloqueado, motivo } = e2e(comando);
    assert.equal(bloqueado, true, `🔴 ${comando} pasó. motivo=${motivo}`);
    assert.match(motivo, /contiene un ENLACE \(junction\)/);
  }
});

test('SCRUM-1792 · control: la misma orden con la ruta nativa `C:\\…` sigue parando', { skip: !ES_WIN32 && 'una ruta con letra de unidad sólo existe en win32; este runner no lo es' }, () => {
  const { bloqueado, motivo } = e2e(`git worktree remove '${CON_ENLACE}'`);
  assert.equal(bloqueado, true, `🔴 la forma nativa dejó de parar. motivo=${motivo}`);
  assert.match(motivo, /contiene un ENLACE \(junction\)/);
});

test('SCRUM-1792 · control: la misma orden con ruta RELATIVA sigue parando (cualquier host)', () => {
  for (const comando of ['git worktree remove con-enlace', 'rm -rf con-enlace']) {
    const { bloqueado, motivo } = e2e(comando);
    assert.equal(bloqueado, true, `🔴 ${comando} dejó de parar. motivo=${motivo}`);
    assert.match(motivo, /contiene un ENLACE \(junction\)/);
  }
});

test('SCRUM-1792 · control: un árbol SIN enlace no para, ni relativo ni en forma MSYS', () => {
  const comandos = ['git worktree remove sin-enlace'];
  if (ES_WIN32) comandos.push(`git worktree remove "${aPosix(SIN_ENLACE)}"`);
  for (const comando of comandos) {
    const { bloqueado, motivo } = e2e(comando);
    assert.equal(bloqueado, false, `🔴 ${comando} paró sin enlace: ${motivo}`);
  }
});
