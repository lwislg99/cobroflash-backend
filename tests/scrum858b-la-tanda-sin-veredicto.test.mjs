// SCRUM-858b · UNA TANDA SIN VEREDICTO NUNCA SALE EN VERDE.
//
// Sin gate: tandas FABRICADAS en un temporal, lanzadas con `node --test` a través de
// `scripts/tanda-con-veredicto.mjs`. Ni BD, ni red, ni la suite real.
//
// EL DEFECTO (SCRUM-858, 15-sep-2026): dos tandas se quedaron 161 y 257 min SIN ESCRIBIR UN BYTE y
// sin línea de resumen. Una tanda así no da rojo: no da nada, y lo que queda es una salida parcial
// con «0 fallos hasta aquí». El cuelgue NO se ha reproducido (17-sep: 5 pasadas completas + 5
// `npm test`, todas terminan), así que esto no lo arregla: impide que vuelva a pasar EN SILENCIO.
//
// POR QUÉ UN ENVOLTORIO Y NO UN `--import`: medido con Node 24.8, con `node --test --import=…` y con
// `NODE_OPTIONS=--import`, el módulo SOLO se carga en los procesos HIJO (`NODE_TEST_CONTEXT`), nunca
// en el padre que imprime el resumen. El cierre tiene que estar FUERA de la tanda.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { temporal } from './_temporal.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ENVOLTORIO = path.join(RAIZ, 'scripts', 'tanda-con-veredicto.mjs');

/** El entorno de una tanda de verdad: sin `NODE_TEST_CONTEXT`, o `node --test` no corre nada y sale 0. */
const entorno = (extra = {}) => {
  const e = { ...process.env, ...extra };
  delete e.NODE_TEST_CONTEXT;
  return e;
};

/** Una tanda fabricada: ficheros de test en un temporal propio. */
function tanda(ficheros) {
  const dir = temporal('yaqu-858b-');
  for (const [nombre, codigo] of Object.entries(ficheros)) fs.writeFileSync(path.join(dir, nombre), codigo);
  return dir;
}
const SANO = "import test from 'node:test';\ntest('sano', () => {});\n";
const ROJO = "import test from 'node:test';\nimport assert from 'node:assert';\ntest('rojo', () => assert.equal(1, 2));\n";
const CUELGA = "import test from 'node:test';\ntest('se cuelga', () => new Promise(() => { setInterval(() => {}, 1000); }));\n";

const envuelta = (dir, args, extra = {}, timeout = 120_000) => spawnSync(process.execPath,
  [ENVOLTORIO, 'node', '--test', ...args], { cwd: dir, env: entorno(extra), encoding: 'utf8', timeout });
const directa = (dir, args) => spawnSync(process.execPath, ['--test', ...args],
  { cwd: dir, env: entorno(), encoding: 'utf8', timeout: 120_000 });

/** Los `node` vivos cuya línea de órdenes nombra este directorio. Por PATH, nunca por nombre a secas. */
function nodesVivosCon(dir) {
  const aguja = path.basename(dir);
  if (process.platform === 'win32') {
    const salida = execFileSync('wmic', ['process', 'where', "name='node.exe'", 'get', 'ProcessId,CommandLine'], { encoding: 'utf8' });
    return salida.split('\n').filter((l) => l.includes(aguja) && !l.includes('wmic'));
  }
  const salida = execFileSync('ps', ['-eo', 'pid,args'], { encoding: 'utf8' });
  return salida.split('\n').filter((l) => l.includes(aguja) && /node/.test(l) && !/\bps\b/.test(l));
}

test('SCRUM-858b · SUELO: el envoltorio existe y el script `test` de package.json lo usa', () => {
  assert.ok(fs.existsSync(ENVOLTORIO), '🔴 NO PUDE MIRAR: no existe scripts/tanda-con-veredicto.mjs');
  const script = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).scripts.test;
  assert.match(script, /node scripts\/tanda-con-veredicto\.mjs node --test /,
    `🔴 \`npm test\` no pasa por el envoltorio: una tanda colgada seguiría sin veredicto. Script: ${script}`);
});

test('SCRUM-858b · 🔴 una tanda MUDA más que el tope sale con 3, y para SOLO su árbol', () => {
  const dir = tanda({ 'cuelga.test.mjs': CUELGA });
  const r = envuelta(dir, ['cuelga.test.mjs'], { TANDA_SILENCIO_MAX_MIN: '0.05' });
  assert.notEqual(r.error?.code, 'ETIMEDOUT',
    '🔴 la tanda colgada NO ha salido: ha tenido que matarla el tope externo del test. Es el cuelgue mudo de SCRUM-858.');
  assert.equal(r.status, 3, `🔴 una tanda muda ha salido con ${r.status} (esperado 3). stderr: ${r.stderr.slice(-400)}`);
  assert.match(r.stderr, /TANDA SIN VEREDICTO/, '🔴 sale con 3 pero no DICE por qué');
  // Y no deja huérfanos: el hijo que se colgó tiene que estar parado.
  const vivos = nodesVivosCon(dir);
  assert.deepEqual(vivos, [], '🔴 ha quedado un node huérfano de la tanda parada:\n' + vivos.join('\n'));
});

test('SCRUM-858b · 🔴 una tanda que sale con 0 SIN línea de recuento sale con 4', () => {
  const dir = tanda({ 'sano.test.mjs': SANO });
  // El recuento se va a un fichero y por la salida estándar no pasa ninguno: un cero sin veredicto.
  const r = envuelta(dir, ['--test-reporter=tap', `--test-reporter-destination=${path.join(dir, 'fuera.tap')}`, 'sano.test.mjs']);
  assert.equal(r.status, 4, `🔴 un 0 sin recuento ha salido con ${r.status}. stderr: ${r.stderr.slice(-400)}`);
  assert.match(r.stderr, /TANDA SIN RESUMEN/);

  // Y el caso más desnudo: algo que «termina bien» sin ser una tanda en absoluto.
  const nada = spawnSync(process.execPath, [ENVOLTORIO, 'node', '-e', "console.log('hola')"], { env: entorno(), encoding: 'utf8', timeout: 60_000 });
  assert.equal(nada.status, 4, `🔴 un proceso que sale 0 sin recuento ha salido con ${nada.status}`);
});

test('SCRUM-858b · ✅ POSITIVO: una tanda sana sale IGUAL que sin envoltorio, y con 0', () => {
  const dir = tanda({ 'a.test.mjs': SANO, 'b.test.mjs': SANO });
  const sin = directa(dir, ['a.test.mjs', 'b.test.mjs']);
  const con = envuelta(dir, ['a.test.mjs', 'b.test.mjs']);
  assert.equal(sin.status, 0, 'SUELO: la tanda sana sin envoltorio sale 0');
  assert.equal(con.status, sin.status, `🔴 el envoltorio cambia el código de una tanda sana: ${con.status}`);
  // La salida pasa TAL CUAL. Lo único que cambia entre dos ejecuciones es el tiempo, y se enmascara.
  const sinTiempos = (s) => s.replace(/\d+(\.\d+)?ms/g, 'Nms').replace(/duration_ms \S+/g, 'duration_ms N');
  assert.equal(sinTiempos(con.stdout), sinTiempos(sin.stdout), '🔴 el envoltorio altera la salida de la tanda');
  assert.equal(con.stderr, '', '🔴 el envoltorio escribe algo en una tanda sana');
});

test('SCRUM-858b · ✅ NEGATIVO: una tanda con un test ROJO nunca sale 0 por el envoltorio', () => {
  const dir = tanda({ 'rojo.test.mjs': ROJO, 'sano.test.mjs': SANO });
  const sin = directa(dir, ['rojo.test.mjs', 'sano.test.mjs']);
  const con = envuelta(dir, ['rojo.test.mjs', 'sano.test.mjs']);
  assert.notEqual(sin.status, 0, 'SUELO: la tanda roja sin envoltorio no sale 0');
  assert.equal(con.status, sin.status, `🔴 el envoltorio cambia el código de una tanda roja: ${sin.status} → ${con.status}`);
});

// En Windows no hay señales que atrapar: `kill` es TerminateProcess y Ctrl+C lo recibe ya todo el grupo
// de consola, el hijo incluido. La propagación es un problema POSIX, que es donde corre el CI.
test('SCRUM-858b · ✅ una señal al envoltorio llega al hijo y la tanda no sale 0',
  { skip: process.platform === 'win32' && 'en Windows no hay señales POSIX que propagar; lo mide el CI (Linux)' }, async () => {
    const dir = tanda({ 'cuelga.test.mjs': CUELGA });
    const p = spawn(process.execPath, [ENVOLTORIO, 'node', '--test', 'cuelga.test.mjs'], { cwd: dir, env: entorno(), stdio: 'ignore' });
    await new Promise((ok) => setTimeout(ok, 1500));
    p.kill('SIGTERM');
    const codigo = await new Promise((ok) => p.on('exit', (c, s) => ok(c ?? s)));
    assert.notEqual(codigo, 0, '🔴 una tanda interrumpida ha salido con 0');
    await new Promise((ok) => setTimeout(ok, 500));
    assert.deepEqual(nodesVivosCon(dir), [], '🔴 la señal no ha llegado al hijo: sigue vivo');
  });
