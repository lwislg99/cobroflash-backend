// SCRUM-1298d · con `mesas` en la instalación, una mesa que no se puede preparar NO impide lanzar: la
// sesión arranca en `config.repo`, COMO SIN MESAS, y el veredicto lo dice (`MESA-FALLIDA`).
//
// POR QUÉ. Hasta aquí, cualquier paso de `prepararMesa` que fallaba (fetch caído, mesa sucia, sin
// identidad…) cortaba el lanzamiento. Con eso el interruptor (`mesas`) no se podía dar: un lanzador que
// no lanza es peor que una mesa vieja (orden del orquestador, 11-nov-2026). Ahora cae hacia lo de hoy.
//
// Por EFECTO: una instalación de verdad (pasa la puerta de integridad), un origin desnudo, y un `claude`
// falso que APUNTA su `process.cwd()` al recibir `--bg`. El control positivo va primero: si la mesa sale
// bien, `claude` arranca EN LA MESA. Sin él, «arrancó en el repo» no distinguiría el arreglo de un
// lanzador que ignora las mesas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mesaDelLanzamiento, prepararMesa } from '../scripts/equipo/sesion.mjs';

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`. Es el comportamiento de antes de 1298d.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: "    if (typeof config.repo !== 'string' || !config.repo) return p;",
    a: '    return p;',
    cae: 'sin poder traer origin, la sesión SE LANZA en el repo',
  },
];

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'equipo', 'sesion.mjs');
const EQUIPO = { prefijo: '', puestos: ['orquestador', 'sesion-0', 'sesion-1'], orquestador: 'orquestador' };
const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const git = (cwd, ...a) => execFileSync('git', ['-c', 'core.autocrlf=false', '-C', cwd, ...a], { encoding: 'utf8', env: GIT_ENV }).trim();

// El generador de identidad de S0, de mentira: escribe los dos ficheros que la mesa tolera.
const GENERADOR = [
  "import fs from 'node:fs'; import path from 'node:path';",
  'const [, , accion, puesto, mesa] = process.argv;',
  "if (accion !== 'mesa') process.exit(2);",
  "fs.writeFileSync(path.join(mesa, 'CLAUDE.local.md'), 'Eres ' + puesto + '\\n');",
  "fs.writeFileSync(path.join(mesa, '.yaqu-puesto.json'), JSON.stringify({ puesto }));",
].join('\n');

function banco() {
  // SCRUM-824 · el temporal cuelga de `os.tmpdir()` A LA VISTA (el censo no atraviesa `temporal()`), y se
  // borra al salir aunque el test caiga (lo mismo que SCRUM-864, sin esconder la raíz).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `yaqu-1298d-${process.pid}-`));
  process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* limpieza */ } });
  const origen = path.join(dir, 'origen.git');
  const semilla = path.join(dir, 'semilla');
  const repo = path.join(dir, 'repo');
  const mesas = path.join(dir, 'mesas');
  fs.mkdirSync(mesas);
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origen]);
  execFileSync('git', ['init', '-q', '-b', 'main', semilla]);
  fs.mkdirSync(path.join(semilla, 'scripts', 'equipo'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(semilla, 'scripts', 'equipo', 'sesion.mjs'));
  fs.writeFileSync(path.join(semilla, 'scripts', 'carriles.mjs'), GENERADOR);
  // Con `core.autocrlf=false` el commit guarda los mismos bytes: la copia instalada pasa la puerta.
  git(semilla, 'add', '-A');
  git(semilla, 'commit', '-q', '-m', 'banco');
  git(semilla, 'remote', 'add', 'origin', origen);
  git(semilla, 'push', '-q', 'origin', 'main');
  execFileSync('git', ['clone', '-q', '-c', 'core.autocrlf=false', origen, repo]);

  fs.mkdirSync(path.join(dir, 'instalacion'));
  fs.copyFileSync(SCRIPT, path.join(dir, 'instalacion', 'sesion.mjs'));
  fs.writeFileSync(path.join(dir, 'claude-falso.mjs'), [
    "import fs from 'node:fs';",
    `const DONDE = ${JSON.stringify(path.join(dir, 'cwd-del-bg.txt'))};`,
    'const args = process.argv.slice(2);',
    "if (args[0] === 'agents' && args[1] === '--json') {",
    "  const viva = fs.existsSync(DONDE) ? [{ id: 'ab00129d', name: 'sesion-1', kind: 'background', pid: 4242, sessionId: '1298d129-8d12-498d-898d-1298d1298d12' }] : [];",
    '  process.stdout.write(JSON.stringify(viva)); process.exit(0);',
    '}',
    "if (args[0] === '--bg') { fs.writeFileSync(DONDE, process.cwd()); process.stdout.write('backgrounded \\u00b7 ab00129d \\u00b7 sesion-1\\n'); process.exit(0); }",
    'process.exit(0);',
  ].join('\n'));
  const config = { repo, mesas };
  fs.writeFileSync(path.join(dir, 'instalacion', 'config.json'), JSON.stringify({
    ...config, claude: [process.execPath, path.join(dir, 'claude-falso.mjs')], jobs: path.join(dir, 'jobs'),
    ...EQUIPO, traspasos: path.join(dir, 'memoria'),
  }));
  fs.mkdirSync(path.join(dir, 'memoria'));
  fs.writeFileSync(path.join(dir, 'encargo.txt'), 'encargo de prueba');

  const lanzar = () => {
    const entornoHijo = { ...process.env };
    delete entornoHijo.FORCE_COLOR;
    delete entornoHijo.NODE_OPTIONS;
    delete entornoHijo.NODE_TEST_CONTEXT;
    const p = spawnSync(process.execPath, [path.join(dir, 'instalacion', 'sesion.mjs'), 'lanzar', 'sesion-1', path.join(dir, 'encargo.txt')],
      { encoding: 'utf8', env: entornoHijo, cwd: path.join(dir, 'instalacion') });
    let v = null;
    try { v = JSON.parse((p.stdout || '').trim().split('\n').at(-1)); } catch { /* sin veredicto */ }
    return { status: p.status, v, crudo: `${p.stdout}\n${p.stderr}` };
  };
  const cwdDelBg = () => (fs.existsSync(path.join(dir, 'cwd-del-bg.txt')) ? fs.readFileSync(path.join(dir, 'cwd-del-bg.txt'), 'utf8') : null);
  const ensuciar = () => fs.writeFileSync(path.join(mesas, 'mesa-s1', 'medicion.txt'), 'trabajo de alguien\n');
  return { dir, repo, mesas, config, lanzar, cwdDelBg, ensuciar, mesa: path.join(mesas, 'mesa-s1') };
}

const misma = (a, b) => fs.realpathSync.native(a) === fs.realpathSync.native(b);

test('SCRUM-1298d · CONTROL POSITIVO: con la mesa bien preparada, `claude` arranca EN LA MESA', () => {
  const b = banco();
  const { status, v, crudo } = b.lanzar();
  assert.equal(status, 0, `🔴 no se lanzó: ${crudo}`);
  assert.equal(v.veredicto, 'LANZADA');
  assert.equal(v.mesa.veredicto, 'MESA', `🔴 el banco no llega a preparar la mesa, y los casos de abajo no medirían: ${crudo}`);
  const donde = b.cwdDelBg();
  assert.ok(donde, '🔴 CIEGO: el claude falso no recibió el --bg');
  assert.ok(misma(donde, b.mesa), `🔴 claude no arrancó en la mesa (${b.mesa}), sino en ${donde}`);
}, { timeout: 60_000 });

test('SCRUM-1298d · 🔴 sin poder traer origin, la sesión SE LANZA en el repo y el veredicto lo dice', () => {
  const b = banco();
  git(b.repo, 'remote', 'set-url', 'origin', path.join(b.dir, 'no-existe.git'));
  const { status, v, crudo } = b.lanzar();
  assert.equal(status, 0, `🔴 un fetch caído impidió lanzar: ${crudo}`);
  assert.equal(v.veredicto, 'LANZADA');
  assert.equal(v.mesa.veredicto, 'MESA-FALLIDA', '🔴 se lanzó en el repo SIN decirlo');
  assert.equal(v.mesa.fallo, 'NO-PUDE-MIRAR');
  assert.match(v.mesa.motivo, /fetch/);
  const donde = b.cwdDelBg();
  assert.ok(donde, '🔴 CIEGO: el claude falso no recibió el --bg');
  assert.ok(misma(donde, b.repo), `🔴 claude no arrancó en config.repo (${b.repo}), sino en ${donde}`);
}, { timeout: 60_000 });

test('SCRUM-1298d · una mesa SUCIA no se toca, y la sesión se lanza en el repo', () => {
  const b = banco();
  const p = prepararMesa({ config: b.config, nombre: 'sesion-1', equipo: EQUIPO });
  assert.equal(p.ok, true, JSON.stringify(p));
  b.ensuciar();
  const { status, v, crudo } = b.lanzar();
  assert.equal(status, 0, `🔴 una mesa sucia impidió lanzar: ${crudo}`);
  assert.equal(v.mesa.veredicto, 'MESA-FALLIDA');
  assert.equal(v.mesa.fallo, 'MESA-SUCIA');
  assert.ok(misma(b.cwdDelBg(), b.repo), '🔴 claude no arrancó en config.repo');
  assert.equal(fs.readFileSync(path.join(b.mesa, 'medicion.txt'), 'utf8'), 'trabajo de alguien\n', '🔴 el trabajo de la mesa se pisó');
}, { timeout: 60_000 });

test('SCRUM-1298d · con `mesas` pero sin `repo` no hay a dónde caer: no se lanza', () => {
  const m = mesaDelLanzamiento({ config: { mesas: path.resolve('/x/cobroFlash') }, nombre: 'sesion-1', equipo: EQUIPO });
  assert.equal(m.ok, false);
  assert.equal(m.veredicto, 'NO-PUDE-MIRAR');
});
