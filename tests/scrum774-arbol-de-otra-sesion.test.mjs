// tests/scrum774-arbol-de-otra-sesion.test.mjs — SCRUM-774
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// DOS SESIONES SOBRE EL MISMO ÁRBOL: `checkout -b` de una pisa el trabajo sin commitear de otra.
//
// El 6-sep-2026, S1 trabajaba SCRUM-586 en `cobroflash-b3` con cambios sin commitear. Otra sesión
// hizo `git checkout -b scrum-760` sobre ESE MISMO árbol y luego `reset --hard`. Ninguna de las
// dos rompió una regla: `checkout -b` no descarta nada (git arrastra lo sin commitear a la rama
// nueva) y el `reset --hard` siguiente YA estaba cubierto por la comprobación que ya tenía
// `guard-dangerous.mjs` para ese comando. El agujero real
// es que `checkout -b` cambia la rama actual SIN preguntar, y lo próximo que la sesión dueña haga
// (un `git merge`, un commit) aterriza en la rama nueva sin que nadie lo note — no hay error, no
// hay conflicto, no hay rojo.
//
// Decisión del fundador (Jira SCRUM-774, comentario 16265): `npm run arbol:mio` en el PASO 0 de
// las normas + ampliar `guard-dangerous.mjs:479` a `checkout -b`/`switch -c` con cambios sin
// commitear. Condición previa: reproducir el pisotón HOY antes de construir — ver el primer test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { evaluar } from '../.claude/hooks/guard-dangerous.mjs';
import { veredictoArbol, arbolMio } from '../scripts/arbol-mio.mjs';
import { temporal } from './_temporal.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARBOL_MIO = path.join(RAIZ, 'scripts', 'arbol-mio.mjs');
const SENTINEL_FALSO = path.join(os.tmpdir(), 'yaqu-774-sentinel-inexistente');

const llamada = (command) =>
  JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } });
const veredicto = (comando, cwd) => evaluar(llamada(comando), SENTINEL_FALSO, { cwd });

/** Un repo con una rama base y, sobre ella, otra rama con trabajo SIN COMMITEAR (la víctima). */
function repoConVictima() {
  const dir = fs.realpathSync(temporal('yaqu-774-'));
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 'x@x');
  git('config', 'user.name', 'x');
  fs.writeFileSync(path.join(dir, 'a.sql'), 'base\n');
  git('add', '-A');
  git('commit', '-qm', 'base');
  git('checkout', '-q', '-b', 'scrum-586-victima');
  // La sesión dueña deja trabajo SIN COMMITEAR.
  fs.writeFileSync(path.join(dir, 'a.sql'), 'base\ntrabajo de scrum-586 sin commitear\n');
  fs.writeFileSync(path.join(dir, 'b.sql'), 'segundo fichero, tambien sin commitear\n');
  return dir;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE — reproducir el caso EXACTO del incidente
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-774 · 🔴 EL PISOTÓN: checkout -b de OTRA sesión sobre un árbol con trabajo sin '
  + 'commitear — con el guard YA ampliado, cae; documentado que ANTES no caía', () => {
  const dir = repoConVictima();
  const antes = spawnSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }).stdout;
  assert.match(antes, /a\.sql/, '🔴 SUELO: la víctima tiene que tener algo sin commitear, o esto no reproduce nada');

  const r = veredicto('git checkout -b scrum-760-otra-sesion', dir);
  assert.equal(r.bloqueado, true,
    '🔴 el guard ampliado tiene que PARAR aquí: es el momento exacto en que el árbol de otra '
    + 'sesión cambia de rama sin que ella lo sepa.');
  assert.match(r.motivo, /CAMBIA la rama actual/);
  assert.match(r.motivo, /a\.sql/, '🔴 el aviso tiene que ENSEÑAR qué hay sin commitear, no solo avisar en abstracto');

  // Y el reset --hard que vino DESPUÉS en el incidente real ya estaba cubierto (regla 6 vieja):
  // no es lo que este ticket arregla, pero se confirma que sigue cubierto.
  const rReset = veredicto('git reset --hard', dir);
  assert.equal(rReset.bloqueado, true, '🔴 CONTROL: el reset --hard posterior debía seguir bloqueado (ya lo estaba antes de este ticket)');

  fs.rmSync(dir, { recursive: true, force: true });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ CONTROL POSITIVO — una sesión en su propio árbol, sin nada que pisar, no ve ningún estorbo
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-774 · ✅ POSITIVO: checkout -b con el árbol LIMPIO no bloquea nada', () => {
  const dir = fs.realpathSync(temporal('yaqu-774-limpio-'));
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q'); git('config', 'user.email', 'x@x'); git('config', 'user.name', 'x');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'x\n');
  git('add', '-A'); git('commit', '-qm', 'base');

  const r = veredicto('git checkout -b scrum-1-nueva', dir);
  assert.equal(r.bloqueado, false, `🔴 EL GUARD BLOQUEA ALGO LEGÍTIMO: ${r.motivo}`);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('SCRUM-774 · ✅ NEGATIVO: cambiar a una rama YA EXISTENTE (sin -b) sigue sin bloquear, '
  + 'aunque el árbol esté sucio — fuera de alcance a propósito (decisión del fundador)', () => {
  const dir = repoConVictima();
  spawnSync('git', ['branch', 'otra-existente'], { cwd: dir });
  const r = veredicto('git checkout otra-existente', dir);
  assert.equal(r.bloqueado, false,
    '🔴 el ticket sólo pide cubrir la forma que CREA rama (-b/-c); un checkout de rutina a una '
    + 'rama existente no puede empezar a bloquear como efecto colateral.');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('SCRUM-774 · switch -c con árbol sucio también cae, por el mismo motivo que checkout -b', () => {
  const dir = repoConVictima();
  const r = veredicto('git switch -c scrum-761-otra', dir);
  assert.equal(r.bloqueado, true, `🔴 'git switch -c' debería caer igual que 'git checkout -b': ${JSON.stringify(r)}`);
  assert.match(r.motivo, /CAMBIA la rama actual/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('SCRUM-774 · switch SIN -c (a una rama existente) no bloquea', () => {
  const dir = repoConVictima();
  spawnSync('git', ['branch', 'otra-existente'], { cwd: dir });
  const r = veredicto('git switch otra-existente', dir);
  assert.equal(r.bloqueado, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// `npm run arbol:mio` — punto 2 del ticket
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-774 · veredictoArbol: MIO cuando la rama empieza por scrum-<n>(-letra)?-', () => {
  assert.deepEqual(veredictoArbol('scrum-774-arbol-mio', '774'), { veredicto: 'MIO' });
  assert.deepEqual(veredictoArbol('scrum-774b-otra-fase', '774'), { veredicto: 'MIO' });
  assert.deepEqual(veredictoArbol('scrum-0774-con-ceros', '774'), { veredicto: 'MIO' });
});

test('SCRUM-774 · veredictoArbol: 🔴 NO-MIO cuando la rama es de otro ticket, o no es scrum-*', () => {
  const r1 = veredictoArbol('scrum-760-otra-sesion', '774');
  assert.equal(r1.veredicto, 'NO-MIO');
  assert.match(r1.motivo, /774/);

  const r2 = veredictoArbol('scrum-7740-mas-digitos', '774'); // 🔴 NEGATIVO: «7740» no es «774»
  assert.equal(r2.veredicto, 'NO-MIO',
    '🔴 un prefijo no es un nombre: la rama de otro ticket que empieza igual no puede colar');

  const r3 = veredictoArbol('rama-cualquiera', '774');
  assert.equal(r3.veredicto, 'NO-MIO');
});

test('SCRUM-774 · veredictoArbol: sin ticket, INFORMATIVO; con HEAD desacoplado, CIEGO', () => {
  assert.deepEqual(veredictoArbol('scrum-774-x', undefined), { veredicto: 'INFORMATIVO' });
  const r = veredictoArbol('', '774');
  assert.equal(r.veredicto, 'CIEGO', '🔴 sin rama que comparar, el veredicto es CIEGO, no NO-MIO ni MIO');
});

test('SCRUM-774 · arbolMio: SUELO — sobre un árbol git de verdad, ve el árbol y la rama', () => {
  const dir = fs.realpathSync(temporal('yaqu-774-suelo-'));
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q'); git('config', 'user.email', 'x@x'); git('config', 'user.name', 'x');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'x\n'); git('add', '-A'); git('commit', '-qm', 'base');
  git('checkout', '-q', '-b', 'scrum-774-suelo-test');

  const r = arbolMio(dir, '774');
  assert.equal(r.veredicto, 'MIO');
  assert.match(r.rama, /^scrum-774-suelo-test$/);
  assert.ok(r.arbol && r.arbol.length > 0, '🔴 CIEGO: no ha visto ningún árbol');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('SCRUM-774 · arbolMio: fuera de un repo git, CIEGO — nunca "MIO" por defecto', () => {
  const dir = fs.realpathSync(temporal('yaqu-774-norepo-')); // sin `git init`
  const r = arbolMio(dir, '774');
  assert.equal(r.veredicto, 'CIEGO');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('SCRUM-774 · el CLI `arbol-mio.mjs` sale con 1 cuando NO-MIO, y con 0 cuando MIO o informativo', () => {
  const dir = fs.realpathSync(temporal('yaqu-774-cli-'));
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q'); git('config', 'user.email', 'x@x'); git('config', 'user.name', 'x');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'x\n'); git('add', '-A'); git('commit', '-qm', 'base');
  git('checkout', '-q', '-b', 'scrum-774-cli-test');

  const propio = spawnSync(process.execPath, [ARBOL_MIO, '774'], { cwd: dir, encoding: 'utf8' });
  assert.equal(propio.status, 0, `🔴 esperaba exit 0 (MIO): ${propio.stdout}${propio.stderr}`);

  const ajeno = spawnSync(process.execPath, [ARBOL_MIO, '999'], { cwd: dir, encoding: 'utf8' });
  assert.equal(ajeno.status, 1, `🔴 esperaba exit 1 (NO-MIO): ${ajeno.stdout}${ajeno.stderr}`);

  const sinTicket = spawnSync(process.execPath, [ARBOL_MIO], { cwd: dir, encoding: 'utf8' });
  assert.equal(sinTicket.status, 0, '🔴 sin ticket, sólo informa: no puede fallar');

  fs.rmSync(dir, { recursive: true, force: true });
});
