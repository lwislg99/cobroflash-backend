// tests/scrum899-sesion-lista-blanca.test.mjs — SCRUM-899 · la puerta de las sesiones de fondo
//
// `scripts/equipo/sesion.mjs` es lo único que la regla de permiso permanente deja ejecutar para
// lanzar o parar sesiones del equipo. Este test fija las tres cosas que lo hacen aceptable:
//   · la LISTA BLANCA de nombres (orquestador, sesion-0…5) y el modo `auto`, sin saltarse permisos;
//   · lo medido en SCRUM-899: reanudar con el sessionId COMPLETO y SIN flags;
//   · la PUERTA DE INTEGRIDAD: una copia alterada, o ejecutada desde un árbol de git, no actúa.
//     Se prueba EJECUTANDO la copia instalada con un `claude` falso que deja constancia si lo llaman.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'equipo', 'sesion.mjs');
const s = await import(pathToFileURL(SCRIPT).href);

// El rojo de cada pieza, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: 'if (!Buffer.from(main.stdoutBuffer).equals(propio)) {',
    a: 'if (false) {',
    cae: '🔴 ROJO: una copia ALTERADA se niega a actuar y no llama a claude',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: "if (dentro.status === 0 && dentro.stdout.trim() === 'true') {",
    a: 'if (false) {',
    cae: '🔴 ROJO: ejecutada desde un árbol de git, no actúa',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: 'export const NOMBRES = /^(orquestador|sesion-[0-5])$/;',
    a: 'export const NOMBRES = /^.+$/;',
    cae: '🔴 la lista blanca rechaza cualquier nombre que no sea del equipo',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: "return ['--bg', '--resume', sessionId, prompt];",
    a: "return ['--bg', '-n', nombre, '--resume', sessionId, prompt];",
    cae: '🔴 reanudar va con el sessionId COMPLETO y SIN flags (con flags arranca una copia)',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: "return ['--bg', '-n', nombre, '--permission-mode', 'auto', prompt];",
    a: "return ['--bg', '-n', nombre, '--permission-mode', 'bypassPermissions', prompt];",
    cae: '🔴 una sesión nueva va en modo auto y NUNCA con un modo que se salte permisos',
  },
];

const UUID = 'd521a2f6-ff99-4970-a1bc-f8064ed68061';

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Lista blanca y argumentos
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('🔴 la lista blanca rechaza cualquier nombre que no sea del equipo', () => {
  for (const bueno of ['orquestador', 'sesion-0', 'sesion-5']) assert.equal(s.validarNombre(bueno), null, `🔴 rechaza «${bueno}»`);
  for (const malo of ['control-899-auto', 'sesion-6', 'cobroflash-backend-b9', 'orquestador ', 'sesion-1;x', '', undefined]) {
    assert.equal(s.validarNombre(malo)?.veredicto, 'NOMBRE-NO-PERMITIDO', `🔴 acepta «${malo}»: podría parar o lanzar una sesión ajena al equipo`);
  }
  assert.throws(() => s.argsLanzar({ modo: 'nueva', nombre: 'control-899-x', prompt: 'p' }), '🔴 construye argumentos para un nombre fuera de la lista');
});

test('🔴 una sesión nueva va en modo auto y NUNCA con un modo que se salte permisos', () => {
  const args = s.argsLanzar({ modo: 'nueva', nombre: 'sesion-3', prompt: 'hola --dangerously-skip-permissions' });
  assert.deepEqual(args.slice(0, 5), ['--bg', '-n', 'sesion-3', '--permission-mode', 'auto'],
    '🔴 medido en SCRUM-899: `plan` se bloquea esperando un permiso; solo `auto` trabaja sola sin saltarse permisos');
  const flags = args.slice(0, -1).join(' ');
  assert.doesNotMatch(flags, /dangerously|bypass/i, '🔴 un modo que se salta permisos');
  assert.equal(args.at(-1), 'hola --dangerously-skip-permissions', '🔴 el prompt no viaja como UN argumento: podría inyectar flags');
});

test('🔴 reanudar va con el sessionId COMPLETO y SIN flags (con flags arranca una copia)', () => {
  assert.deepEqual(s.argsLanzar({ modo: 'reanudar', nombre: 'sesion-1', sessionId: UUID, prompt: 'p' }),
    ['--bg', '--resume', UUID, 'p'],
    '🔴 medido en SCRUM-899 (3b): con flags, `--resume` arranca una copia con id nuevo');
  assert.throws(() => s.argsLanzar({ modo: 'reanudar', nombre: 'sesion-1', sessionId: 'd521a2f6', prompt: 'p' }),
    '🔴 acepta el id corto: medido en SCRUM-899 (3a), cae en el selector interactivo y se queda parada');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Decisiones
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('decidir lanzar: viva, bloqueada, reanudar, nueva, y no pude mirar', () => {
  const ahora = 10 * 60 * 60 * 1000;
  const viva = { id: 'aaaaaaaa', name: 'sesion-2', kind: 'background', state: 'working' };
  assert.equal(s.decidirLanzar({ nombre: 'sesion-2', agentes: [viva], registro: {}, ahora }).veredicto, 'YA-VIVA');
  assert.equal(s.decidirLanzar({ nombre: 'sesion-2', agentes: [{ ...viva, state: 'blocked', waitingFor: 'permission prompt' }], registro: {}, ahora }).veredicto,
    'BLOQUEADA', '🔴 una sesión bloqueada se trata como viva y nadie lo dice');
  const reciente = { 'sesion-2': { sessionId: UUID, ultimaTanda: ahora - 30 * 60 * 1000 } };
  assert.deepEqual(s.decidirLanzar({ nombre: 'sesion-2', agentes: [], registro: reciente, ahora }), { veredicto: 'REANUDAR', sessionId: UUID });
  const vieja = { 'sesion-2': { sessionId: UUID, ultimaTanda: ahora - 2 * 60 * 60 * 1000 } };
  assert.equal(s.decidirLanzar({ nombre: 'sesion-2', agentes: [], registro: vieja, ahora }).veredicto, 'NUEVA', '🔴 reanuda una sesión con la caché fría');
  assert.equal(s.decidirLanzar({ nombre: 'sesion-2', agentes: [], registro: {}, ahora }).veredicto, 'NUEVA');
  assert.equal(s.decidirLanzar({ nombre: 'sesion-2', agentes: null, registro: {}, ahora }).veredicto, 'NO-PUDE-MIRAR', '🔴 SUELO: sin listado, lanza a ciegas');
  assert.equal(s.decidirLanzar({ nombre: 'sesion-2', agentes: [viva, { ...viva, id: 'bbbbbbbb' }], registro: {}, ahora }).veredicto, 'NO-PUDE-MIRAR');
});

test('decidir parar: por id, solo si el nombre casa y es de fondo', () => {
  const agentes = [
    { id: 'cccccccc', name: 'sesion-4', kind: 'background' },
    { id: 'dddddddd', name: 'cobroflash-backend-b9', kind: 'interactive' },
  ];
  assert.deepEqual(s.decidirParar({ nombre: 'sesion-4', agentes }), { veredicto: 'PARAR', id: 'cccccccc' });
  assert.equal(s.decidirParar({ nombre: 'cobroflash-backend-b9', agentes }).veredicto, 'NOMBRE-NO-PERMITIDO', '🔴 para una sesión ajena');
  assert.equal(s.decidirParar({ nombre: 'sesion-1', agentes }).veredicto, 'NADA');
  assert.equal(s.decidirParar({ nombre: 'sesion-4', agentes: null }).veredicto, 'NO-PUDE-MIRAR');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Banco: repositorio con origin/main, copia instalada y un `claude` falso
// ═════════════════════════════════════════════════════════════════════════════════════════════

function banco({ alterar = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum899-'));
  const git = (cwd, ...a) => execFileSync('git', ['-c', 'core.autocrlf=false', '-C', cwd, ...a], { encoding: 'utf8' });

  // El repositorio: el sesion.mjs de ESTE árbol, en `origin/main`.
  const repo = path.join(dir, 'repo');
  execFileSync('git', ['init', '-q', repo]);
  fs.mkdirSync(path.join(repo, 'scripts', 'equipo'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(repo, 'scripts', 'equipo', 'sesion.mjs'));
  git(repo, 'add', '.');
  git(repo, '-c', 'user.name=banco', '-c', 'user.email=banco@x', 'commit', '-q', '-m', 'banco');
  git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');

  // La instalación, como la hará el instalador: con `git show`, fuera de cualquier árbol.
  const inst = path.join(dir, 'instalacion');
  fs.mkdirSync(inst);
  const contenido = execFileSync('git', ['-C', repo, 'show', 'origin/main:scripts/equipo/sesion.mjs']);
  const final = alterar ? Buffer.concat([contenido, Buffer.from('\n// tocado\n')]) : contenido;
  fs.writeFileSync(path.join(inst, 'sesion.mjs'), final);

  // El `claude` falso: deja constancia de cada llamada y contesta un listado vacío.
  const marca = path.join(dir, 'llamadas.txt');
  const falso = path.join(dir, 'claude-falso.mjs');
  fs.writeFileSync(falso, `import fs from 'node:fs'; fs.appendFileSync(${JSON.stringify(marca)}, process.argv.slice(2).join(' ') + '\\n'); process.stdout.write('[]');\n`);
  fs.writeFileSync(path.join(inst, 'config.json'), JSON.stringify({ repo, claude: [process.execPath, falso] }));
  return { dir, repo, inst, marca };
}

function correr(script, ...args) {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  let v = null;
  try { v = JSON.parse((r.stdout || '').trim().split('\n').at(-1)); } catch { /* sin veredicto */ }
  return { status: r.status, v };
}

test('🔴 SUELO del banco: la copia instalada e IDÉNTICA actúa (llama a claude)', () => {
  const b = banco();
  try {
    const r = correr(path.join(b.inst, 'sesion.mjs'), 'estado');
    assert.equal(r.v?.veredicto, 'ESTADO', `🔴 NO PUDE MIRAR: la copia buena no actúa (${JSON.stringify(r.v)}); el rojo de abajo no mediría nada`);
    assert.ok(fs.existsSync(b.marca), '🔴 NO PUDE MIRAR: la copia buena no llamó al claude falso');
  } finally { fs.rmSync(b.dir, { recursive: true, force: true }); }
});

test('🔴 ROJO: una copia ALTERADA se niega a actuar y no llama a claude', () => {
  const b = banco({ alterar: true });
  try {
    const r = correr(path.join(b.inst, 'sesion.mjs'), 'estado');
    assert.equal(r.v?.veredicto, 'ALTERADO', `🔴 una copia distinta de origin/main actúa: ${JSON.stringify(r.v)}`);
    assert.equal(r.status, 2);
    assert.equal(fs.existsSync(b.marca), false, '🔴 la copia alterada llegó a llamar a claude');
  } finally { fs.rmSync(b.dir, { recursive: true, force: true }); }
});

test('🔴 ROJO: ejecutada desde un árbol de git, no actúa', () => {
  const b = banco();
  try {
    // La del propio repositorio del banco: es la misma de origin/main, pero vive en un árbol.
    fs.copyFileSync(path.join(b.inst, 'config.json'), path.join(b.repo, 'scripts', 'equipo', 'config.json'));
    const r = correr(path.join(b.repo, 'scripts', 'equipo', 'sesion.mjs'), 'estado');
    assert.equal(r.v?.veredicto, 'DESDE-UN-ARBOL', `🔴 actúa desde un worktree: ${JSON.stringify(r.v)}`);
    assert.equal(fs.existsSync(b.marca), false, '🔴 desde un árbol llegó a llamar a claude');
  } finally { fs.rmSync(b.dir, { recursive: true, force: true }); }
});

test('SUELO: sin config.json, o sin origin/main, «no pude mirar» y no actúa', () => {
  const b = banco();
  try {
    fs.rmSync(path.join(b.inst, 'config.json'));
    assert.equal(correr(path.join(b.inst, 'sesion.mjs'), 'estado').v?.veredicto, 'NO-PUDE-MIRAR');
  } finally { fs.rmSync(b.dir, { recursive: true, force: true }); }
  const c = banco();
  try {
    execFileSync('git', ['-C', c.repo, 'update-ref', '-d', 'refs/remotes/origin/main']);
    const r = correr(path.join(c.inst, 'sesion.mjs'), 'estado');
    assert.equal(r.v?.veredicto, 'NO-PUDE-MIRAR');
    assert.equal(fs.existsSync(c.marca), false);
  } finally { fs.rmSync(c.dir, { recursive: true, force: true }); }
});
