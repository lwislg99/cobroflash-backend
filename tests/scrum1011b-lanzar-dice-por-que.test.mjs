// SCRUM-1011b · cuando `claude --bg` no confirma la sesión, `lanzar` y `relevar` dicen POR QUÉ.
//
// EL DEFECTO, medido el 18-oct-2026: el orquestador lanzó `sesion-0` dos veces y recibió las dos
// `{"veredicto":"NO-PUDE-MIRAR","motivo":"claude no confirmó la sesión de fondo","salida":""}`. Los dos
// sitios (`relevar` y `lanzar`) guardaban el final de stdout y TIRABAN stderr, el código de salida y el
// error del lanzamiento: un `claude` que falla escribe el motivo en stderr, y el instrumento se lo comía.
// La decisión no cambia (sale 2 y no lanza): lo que se prueba aquí es que la causa VIAJA.
//
// Por EFECTO: una instalación de verdad (copia idéntica a `origin/main` de un repo de banco, fuera de un
// árbol de git) con un `claude` falso que contesta `agents --json` y falla `--bg` escribiendo SÓLO en stderr.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { temporal } from './_temporal.mjs'; // SCRUM-864 · el temporal se borra pase lo que pase
import { casosEscritos } from './_casos-escritos.mjs'; // SCRUM-1415 · un caso por fila, con su nombre escrito
import { rastroDeClaude } from '../scripts/equipo/sesion.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'equipo', 'sesion.mjs');
const MOTIVO = 'Error: no se pudo crear la sesion de fondo (motivo de prueba 1011b)';

/** El `--bg` falla con `MOTIVO` en stderr y NADA en stdout, como el `claude` del 18-oct. */
function banco() {
  const dir = temporal(`yaqu-1011b-${process.pid}-`);
  const git = (...a) => execFileSync('git', ['-c', 'core.autocrlf=false', '-C', path.join(dir, 'repo'), ...a], { encoding: 'utf8' });
  execFileSync('git', ['init', '-q', path.join(dir, 'repo')]);
  fs.mkdirSync(path.join(dir, 'repo', 'scripts', 'equipo'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(dir, 'repo', 'scripts', 'equipo', 'sesion.mjs'));
  git('add', '.');
  git('-c', 'user.name=banco', '-c', 'user.email=banco@x', 'commit', '-q', '-m', 'banco');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');

  // La puerta de integridad exige la copia idéntica a la del commit: con `core.autocrlf=false` el commit
  // guarda los mismos bytes, así que se copia el fichero (si no fuera idéntica, saldría DESDE-OTRA-VERSION).
  fs.mkdirSync(path.join(dir, 'instalacion'));
  fs.copyFileSync(SCRIPT, path.join(dir, 'instalacion', 'sesion.mjs'));
  fs.writeFileSync(path.join(dir, 'claude-falso.mjs'), [
    'const args = process.argv.slice(2);',
    "if (args[0] === 'agents' && args[1] === '--json') { process.stdout.write('[]'); process.exit(0); }",
    `if (args[0] === '--bg') { process.stderr.write(${JSON.stringify(`${MOTIVO}\n`)}); process.exit(3); }`,
    'process.exit(0);',
  ].join('\n'));
  fs.mkdirSync(path.join(dir, 'memoria'));
  fs.writeFileSync(path.join(dir, 'instalacion', 'config.json'), JSON.stringify({
    repo: path.join(dir, 'repo'), claude: [process.execPath, path.join(dir, 'claude-falso.mjs')], jobs: path.join(dir, 'jobs'),
    prefijo: '', puestos: ['orquestador', 'sesion-0', 'sesion-1'], orquestador: 'orquestador', traspasos: path.join(dir, 'memoria'),
  }));
  fs.writeFileSync(path.join(dir, 'encargo.txt'), 'encargo de prueba');

  const correr = (...a) => {
    const entornoHijo = { ...process.env };
    delete entornoHijo.FORCE_COLOR;
    delete entornoHijo.NODE_OPTIONS;
    delete entornoHijo.NODE_TEST_CONTEXT;
    const p = spawnSync(process.execPath, [path.join(dir, 'instalacion', 'sesion.mjs'), ...a], { encoding: 'utf8', env: entornoHijo });
    let v = null;
    try { v = JSON.parse((p.stdout || '').trim().split('\n').at(-1)); } catch { /* sin veredicto */ }
    return { status: p.status, v, crudo: `${p.stdout}\n${p.stderr}` };
  };
  return { correr, encargo: path.join(dir, 'encargo.txt') };
}

const falloDeBg = casosEscritos(['lanzar', 'relevar'],
  (accion) => `SCRUM-1011b · 🔴 \`${accion}\`: claude --bg falla escribiendo en stderr → sale 2, NO lanza, y el motivo VIAJA`,
  (accion) => {
    const b = banco();
    const { status, v, crudo } = b.correr(accion, 'sesion-0', b.encargo);
    assert.ok(v, `🔴 sin veredicto JSON:\n${crudo}`);
    assert.equal(status, 2, `🔴 tenía que fallar cerrado: ${JSON.stringify(v)}`);
    assert.equal(v.veredicto, 'NO-PUDE-MIRAR');
    assert.equal(v.motivo, 'claude no confirmó la sesión de fondo');
    assert.match(v.errores, /motivo de prueba 1011b/, `🔴 el stderr de claude no viaja en la salida: ${JSON.stringify(v)}`);
    assert.equal(v.status, 3, `🔴 el código de salida de claude no viaja: ${JSON.stringify(v)}`);
    assert.equal(v.salida, '', 'stdout estaba vacío, y se sigue diciendo');
    assert.equal(v.error, null);
  });
test('SCRUM-1011b · 🔴 `lanzar`: claude --bg falla escribiendo en stderr → sale 2, NO lanza, y el motivo VIAJA', { timeout: 30_000 }, falloDeBg(0));
test('SCRUM-1011b · 🔴 `relevar`: claude --bg falla escribiendo en stderr → sale 2, NO lanza, y el motivo VIAJA', { timeout: 30_000 }, falloDeBg(1));
falloDeBg.todos();

test('SCRUM-1011b · `rastroDeClaude`: un claude que NI ARRANCA (`error`, `status` null) también dice por qué', () => {
  const r = rastroDeClaude({ status: null, signal: null, stdout: null, stderr: null, error: Object.assign(new Error('spawnSync claude.exe ENAMETOOLONG'), { code: 'ENAMETOOLONG' }) });
  assert.deepEqual(r, { status: null, senal: null, error: 'ENAMETOOLONG', salida: '', errores: '' });
});

test('SCRUM-1011b · `rastroDeClaude`: la señal viaja, y de stdout y stderr va el FINAL (ahí está el error)', () => {
  const r = rastroDeClaude({ status: null, signal: 'SIGTERM', stdout: `${'a'.repeat(1000)}FIN-STDOUT`, stderr: `${'b'.repeat(2000)}FIN-STDERR` });
  assert.equal(r.senal, 'SIGTERM');
  assert.equal(r.salida.length, 400);
  assert.ok(r.salida.endsWith('FIN-STDOUT'));
  assert.equal(r.errores.length, 800);
  assert.ok(r.errores.endsWith('FIN-STDERR'));
});
