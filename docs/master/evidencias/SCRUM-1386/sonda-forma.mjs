#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1386/sonda-forma.mjs — SCRUM-1386
//
// SONDA · dos preguntas que el banco no contesta, porque la puerta no enseña lo que ve:
//   ① ¿con qué `status`/`signal` le llega a un padre un `node --test` matado desde fuera, según QUIÉN mata?
//   ② ¿cómo pinta el runner un FICHERO cuyo proceso matan, comparado con uno que revienta solo?
// Todo en un temporal, con ficheros de mentira. No toca el árbol ni escribe en él: va por stdout.
// Es de Windows (mata con `taskkill` y `Stop-Process`).
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { temporal } from '../../../../tests/_temporal.mjs';

if (process.platform !== 'win32') { console.error('SONDA=CIEGA · mata con taskkill: sólo mide en Windows.'); process.exit(2); }
const TMP = temporal('scrum1386-sonda-');
const ENV = {};
for (const k of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'USERPROFILE', 'ComSpec', 'PATHEXT']) if (process.env[k] !== undefined) ENV[k] = process.env[k];
const escribir = (n, t) => { const f = path.join(TMP, n); fs.writeFileSync(f, t); return f; };
const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*[A-Za-z]', 'g');

const LIMPIO = escribir('limpio.test.mjs', "import test from 'node:test';\ntest('caso limpio', () => {});\n");
const CUELGA = escribir('cuelga.test.mjs', "import fs from 'node:fs';\nimport test from 'node:test';\nfs.writeFileSync(process.env.SONDA_PID, String(process.pid));\ntest('caso que no acaba', async () => { await new Promise((r) => setTimeout(r, 60000)); });\n");
const REVIENTA = escribir('revienta.test.mjs', "import test from 'node:test';\nthrow new Error('reviento en la primera linea');\n");
const CALLADO = escribir('callado.test.mjs', 'process.exit(1);\n');
const ROJO = escribir('rojo.test.mjs', "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('caso que cae de verdad', () => { assert.equal(1, 2); });\n");

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
function lanzar(args, env) {
  const h = spawn(process.execPath, args, { cwd: TMP, env });
  let out = ''; let err = '';
  h.stdout.on('data', (d) => { out += d; }); h.stderr.on('data', (d) => { err += d; });
  const fin = new Promise((res) => h.on('close', (status, signal) => res({ status, signal, out: out.replace(ANSI, ''), err: err.replace(ANSI, '') })));
  return { h, fin };
}
async function esperarPid(f) {
  for (let i = 0; i < 200; i += 1) { if (fs.existsSync(f) && fs.readFileSync(f, 'utf8').trim()) return Number(fs.readFileSync(f, 'utf8')); await dormir(50); }
  return null;
}
const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
let nPid = 0;
const ficheroDePid = () => { nPid += 1; return path.join(TMP, 'pid-' + nPid); };

console.log('SONDA forma · ' + process.platform + ' · node ' + process.version);

// ── ① quién mata al RUNNER y qué ve su padre ────────────────────────────────────────────────
const MATADORES = {
  'taskkill /F': (pid) => spawnSync('taskkill.exe', ['/F', '/PID', String(pid)], { encoding: 'utf8' }).status,
  'taskkill /F /T': (pid) => spawnSync('taskkill.exe', ['/F', '/T', '/PID', String(pid)], { encoding: 'utf8' }).status,
  'Stop-Process -Force': (pid) => spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Stop-Process -Id ' + pid + ' -Force'], { encoding: 'utf8' }).status,
  'process.kill(pid) de node': (pid) => { process.kill(pid); return 0; },
  "process.kill(pid, 'SIGKILL') de node": (pid) => { process.kill(pid, 'SIGKILL'); return 0; },
};
console.log('\n① EL RUNNER MATADO DESDE FUERA · población ' + Object.keys(MATADORES).length + ' formas de matar');
for (const [nombre, matar] of Object.entries(MATADORES)) {
  const pidf = ficheroDePid();
  const { h, fin } = lanzar(['--test', LIMPIO, CUELGA], { ...ENV, SONDA_PID: pidf });
  const nieto = await esperarPid(pidf);
  const antes = vivo(h.pid);
  matar(h.pid);
  const r = await fin;
  if (nieto && vivo(nieto)) { try { process.kill(nieto, 'SIGKILL'); } catch { /* ya no está */ } }
  console.log('   ' + nombre.padEnd(38) + ' → status=' + r.status + ' signal=' + r.signal
    + ' · resumen=' + (/\btests\s+\d+\s*$/m.test(r.out) ? 'SÍ' : 'no') + ' · bytes de salida=' + (r.out.length + r.err.length)
    + ' · TESTIGO runner_vivo_antes=' + antes + ' nieto_arrancó=' + (nieto ? 'sí' : 'NO'));
}

// ── ② un FICHERO que muere: matado, reventado, callado, y el rojo de verdad ─────────────────
console.log('\n② CÓMO PINTA EL RUNNER UN FICHERO QUE MUERE · población 4 formas');
async function forma(titulo, fichero, matarAlNieto) {
  const pidf = ficheroDePid();
  const { fin } = lanzar(['--test', '--test-reporter=spec', LIMPIO, fichero], { ...ENV, SONDA_PID: pidf });
  let testigo = '';
  if (matarAlNieto) {
    const nieto = await esperarPid(pidf);
    await dormir(300);
    const antes = nieto ? vivo(nieto) : false;
    if (nieto) spawnSync('taskkill.exe', ['/F', '/PID', String(nieto)], { encoding: 'utf8' });
    await dormir(200);
    testigo = ' · TESTIGO vivo_antes=' + antes + ' vivo_después=' + (nieto ? vivo(nieto) : '?');
  }
  const r = await fin;
  console.log('\n   ▓ ' + titulo + testigo);
  console.log('     status del runner=' + r.status + ' · tests=' + ((/\btests\s+(\d+)\s*$/m.exec(r.out) || [])[1]) + ' · fail=' + ((/\bfail\s+(\d+)\s*$/m.exec(r.out) || [])[1])
    + ' · ¿deja su traza en el stdout del runner?=' + (/reviento en la primera linea/.test(r.out) ? 'SÍ' : 'no'));
  const lineas = r.out.split(TMP).join('<tmp>').split(/\r?\n/);
  const desde = lineas.findIndex((l) => /failing tests/.test(l));
  for (const l of (desde >= 0 ? lineas.slice(desde) : lineas.slice(-5)).filter((x) => x.trim()).slice(0, 5)) console.log('     │ ' + l);
}
await forma('MATADO desde fuera (taskkill /F al proceso del fichero)', CUELGA, true);
await forma('REVIENTA en su primera línea (throw al cargar)', REVIENTA, false);
await forma('CALLADO: process.exit(1) sin una letra', CALLADO, false);
await forma('ROJO DE VERDAD: un assert que cae', ROJO, false);

console.log('\nSONDA=0');
