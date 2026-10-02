// mini-tanda.mjs — SCRUM-1328 · la VERDAD POR BYTES de cada intruso que la sonda de procesos nombra.
//
// Uso (desde la raiz del repo): node <ruta>/mini-tanda.mjs <via> <fichero de test> [...]
//   via = opciones   : reporters en NODE_OPTIONS (como ci.yml en main)
//   via = argumentos : reporters como argumentos del `node --test` (nadie los hereda)
//
// Por cada fichero corre una tanda de TRES, en orden y de uno en uno (`--test-concurrency=1`):
//     relleno de 300 casos · EL FICHERO · relleno de 40 casos
// con el TAP a un fichero fuera del arbol, y dice como queda: bytes, NUL, tramos y quien queda en cabeza.
// Con el padre llevando ya ~70 KB escritos, un hijo que trunque deja el hueco en NUL: aqui la sonda de
// bytes SI ve (su limite de un solo fichero no aplica).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const [via, ...ficheros] = process.argv.slice(2);
const barras = (p) => p.split(path.sep).join('/');
const CSI = /\x1B\[[0-9;?]*[ -\/]*[@-~]/g;
const A = path.join(AQUI, 'repro', 'a.test.mjs');
const C = path.join(AQUI, 'repro', 'c.test.mjs');

console.log(`POBLACION ficheros=${ficheros.length} via=${via} node=${process.version}`);
for (const f of ficheros) {
  const tap = path.join(os.tmpdir(), `yaqu-1328-mini-${process.pid}.tap`);
  fs.rmSync(tap, { force: true });
  const env = { ...process.env, MODO: 'sin-hijo' };
  delete env.FORCE_COLOR; delete env.NODE_TEST_CONTEXT; delete env.NODE_OPTIONS;
  const reporters = ['--test-reporter=spec', '--test-reporter-destination=stdout', '--test-reporter=tap', `--test-reporter-destination=${barras(tap)}`];
  const args = ['--test', '--test-force-exit', '--test-concurrency=1'];
  if (via === 'opciones') env.NODE_OPTIONS = reporters.join(' '); else args.push(...reporters);
  const r = spawnSync(process.execPath, [...args, A, f, C], { encoding: 'utf8', env, timeout: 300_000, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  const consola = (r.stdout || '').replace(CSI, '');
  const num = (k) => (consola.match(new RegExp(`^ℹ ${k} (\\d+)`, 'm')) || [null, null])[1];
  if (!fs.existsSync(tap)) { console.log(`SIN_TAP  ${f} salida=${r.status}`); continue; }
  const b = fs.readFileSync(tap);
  let nul = 0; let primerNul = -1; let ultimoNul = -1;
  for (let i = 0; i < b.length; i++) if (b[i] === 0) { nul++; if (primerNul < 0) primerNul = i; ultimoNul = i; }
  const s = b.toString('utf8');
  const cabeza = (s.match(/^(?:not ok|ok) 1 - (.*)$/m) || [null, '(sin caso 1)'])[1].slice(0, 70);
  const rec = [...s.matchAll(/^# tests (\d+)/gm)].map((m) => m[1]);
  const casos = [...s.matchAll(/^(?:not ok|ok) (\d+)/gm)].map((m) => Number(m[1]));
  const relleno = (s.match(/PADRE-A caso/g) || []).length;
  console.log(`${nul ? 'PISADO ' : 'ENTERO '} salida=${r.status} consola: tests=${num('tests')} fail=${num('fail')} · TAP: bytes=${b.length} NUL=${nul}${nul ? ` (${primerNul}..${ultimoNul + 1})` : ''} recuentos=[${rec}] casos_legibles=${casos.length} relleno_A_legible=${relleno}/300\n          cabeza: «${cabeza}»  ${f}`);
  fs.rmSync(tap, { force: true });
}
console.log('EXIT=0');
