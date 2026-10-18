// SCRUM-1298c · sin `mesas`, `lanzar` arranca la sesión en `config.repo`, no en el cwd de quien lanza.
//
// POR QUÉ. El 18-oct-2026 `sesion-0` no arrancó dos veces: `sesion.mjs` se corrió desde la carpeta de la
// instalación (`AppData/Local/yaqu-equipo`), `claude --bg` heredó ese cwd, que no cuelga de ninguna
// carpeta de confianza, y se negó («Workspace not trusted», sólo en stderr). A mano, desde el repo,
// arrancó. Que un arranque dependa de dónde está quien teclea no es un camino: es una casualidad.
//
// Por EFECTO: una instalación de verdad con un `claude` falso que APUNTA su `process.cwd()` al recibir
// `--bg`, y `sesion.mjs` corrido desde OTRA carpeta (la de la instalación, como el 18-oct).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { temporal } from './_temporal.mjs'; // SCRUM-864 · el temporal se borra pase lo que pase
import { mesaDelLanzamiento } from '../scripts/equipo/sesion.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'equipo', 'sesion.mjs');
const EQUIPO = { prefijo: '', puestos: ['orquestador', 'sesion-0', 'sesion-1'], orquestador: 'orquestador' };

function banco() {
  const dir = temporal(`yaqu-1298c-${process.pid}-`);
  const git = (...a) => execFileSync('git', ['-c', 'core.autocrlf=false', '-C', path.join(dir, 'repo'), ...a], { encoding: 'utf8' });
  execFileSync('git', ['init', '-q', path.join(dir, 'repo')]);
  fs.mkdirSync(path.join(dir, 'repo', 'scripts', 'equipo'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(dir, 'repo', 'scripts', 'equipo', 'sesion.mjs'));
  git('add', '.');
  git('-c', 'user.name=banco', '-c', 'user.email=banco@x', 'commit', '-q', '-m', 'banco');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');

  // Con `core.autocrlf=false` el commit guarda los mismos bytes: la copia pasa la puerta de integridad.
  fs.mkdirSync(path.join(dir, 'instalacion'));
  fs.copyFileSync(SCRIPT, path.join(dir, 'instalacion', 'sesion.mjs'));
  fs.writeFileSync(path.join(dir, 'claude-falso.mjs'), [
    "import fs from 'node:fs';",
    `const DONDE = ${JSON.stringify(path.join(dir, 'cwd-del-bg.txt'))};`,
    'const args = process.argv.slice(2);',
    "if (args[0] === 'agents' && args[1] === '--json') {",
    "  const viva = fs.existsSync(DONDE) ? [{ id: 'ab001298', name: 'sesion-1', kind: 'background', pid: 4242, sessionId: '12981298-1298-4298-8298-129812981298' }] : [];",
    '  process.stdout.write(JSON.stringify(viva)); process.exit(0);',
    '}',
    "if (args[0] === '--bg') { fs.writeFileSync(DONDE, process.cwd()); process.stdout.write('backgrounded \\u00b7 ab001298 \\u00b7 sesion-1\\n'); process.exit(0); }",
    'process.exit(0);',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'instalacion', 'config.json'), JSON.stringify({
    repo: path.join(dir, 'repo'), claude: [process.execPath, path.join(dir, 'claude-falso.mjs')], jobs: path.join(dir, 'jobs'),
    ...EQUIPO, traspasos: path.join(dir, 'memoria'),
  }));
  fs.mkdirSync(path.join(dir, 'memoria'));
  fs.writeFileSync(path.join(dir, 'encargo.txt'), 'encargo de prueba');

  const correr = (...a) => {
    const entornoHijo = { ...process.env };
    delete entornoHijo.FORCE_COLOR;
    delete entornoHijo.NODE_OPTIONS;
    delete entornoHijo.NODE_TEST_CONTEXT;
    // Desde la carpeta de la INSTALACIÓN, como el 18-oct: lo que no puede pasar es que `claude` herede esto.
    const p = spawnSync(process.execPath, [path.join(dir, 'instalacion', 'sesion.mjs'), ...a], { encoding: 'utf8', env: entornoHijo, cwd: path.join(dir, 'instalacion') });
    let v = null;
    try { v = JSON.parse((p.stdout || '').trim().split('\n').at(-1)); } catch { /* sin veredicto */ }
    return { status: p.status, v, crudo: `${p.stdout}\n${p.stderr}` };
  };
  const cwdDelBg = () => (fs.existsSync(path.join(dir, 'cwd-del-bg.txt')) ? fs.readFileSync(path.join(dir, 'cwd-del-bg.txt'), 'utf8') : null);
  return { correr, cwdDelBg, repo: path.join(dir, 'repo'), instalacion: path.join(dir, 'instalacion'), encargo: path.join(dir, 'encargo.txt') };
}

const misma = (a, b) => fs.realpathSync.native(a) === fs.realpathSync.native(b);

test('SCRUM-1298c · 🔴 `lanzar` corrido desde la carpeta de la instalación arranca `claude` en el REPO', () => {
  const b = banco();
  const { status, v, crudo } = b.correr('lanzar', 'sesion-1', b.encargo);
  assert.equal(status, 0, `🔴 no se lanzó: ${crudo}`);
  assert.equal(v.veredicto, 'LANZADA');
  assert.equal(v.mesa.veredicto, 'SIN-MESA');
  const donde = b.cwdDelBg();
  assert.ok(donde, '🔴 CIEGO: el claude falso no recibió el --bg');
  assert.ok(!misma(donde, b.instalacion), `🔴 claude heredó el cwd de quien lanza (la instalación): ${donde}`);
  assert.ok(misma(donde, b.repo), `🔴 claude no arrancó en config.repo (${b.repo}), sino en ${donde}`);
}, { timeout: 30_000 });

test('SCRUM-1298c · sin `mesas` ni `repo` no se lanza: no hay de dónde', () => {
  const m = mesaDelLanzamiento({ config: {}, nombre: 'sesion-1', equipo: EQUIPO });
  assert.equal(m.ok, false);
  assert.equal(m.veredicto, 'NO-PUDE-MIRAR');
  assert.match(m.motivo, /ni `repo`/);
});
