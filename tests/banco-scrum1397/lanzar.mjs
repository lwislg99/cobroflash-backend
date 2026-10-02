// Lanzador de SCRUM-1397: corre ficheros de test con el banco desechable puesto y deja el TAP en
// un fichero FUERA del árbol. Imprime población y EXIT, y el código de salida es el de node.
//
// Uso: node tests/banco-scrum1397/lanzar.mjs <url del banco | -> <fichero TAP de salida> <test…>
//   «-» en la url = sin banco (los casos con base saltan).
// El entorno del hijo se construye a mano: sin FORCE_COLOR, NODE_OPTIONS ni NODE_TEST_CONTEXT.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [, , url, salida, ...ficheros] = process.argv;
if (!url || !salida || ficheros.length === 0) {
  console.log('CIEGO: uso: lanzar.mjs <url|-> <fichero.tap> <test…>');
  console.log('EXIT=2');
  process.exit(2);
}
const RAIZ = path.resolve(import.meta.dirname, '..', '..');
const faltan = ficheros.filter((f) => !fs.existsSync(path.resolve(RAIZ, f)));
if (faltan.length) {
  console.log('CIEGO: no existen: ' + faltan.join(', '));
  console.log('EXIT=2');
  process.exit(2);
}
if (path.resolve(salida).startsWith(RAIZ + path.sep)) {
  console.log('CIEGO: el TAP va FUERA del árbol');
  console.log('EXIT=2');
  process.exit(2);
}

const env = {};
for (const k of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOME', 'ComSpec', 'PATHEXT', 'windir']) {
  if (process.env[k] !== undefined) env[k] = process.env[k];
}
if (url !== '-') env.LIBRO_PG_URL = url;

fs.rmSync(salida, { force: true });
console.log(`POBLACION: ${ficheros.length} fichero(s) · banco: ${url === '-' ? 'NINGUNO' : 'puesto'}`);
const r = spawnSync(process.execPath, [
  '--test', '--test-force-exit', '--test-concurrency=1',
  '--test-reporter=tap', `--test-reporter-destination=${salida}`,
  ...ficheros,
], { cwd: RAIZ, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const tap = fs.existsSync(salida) ? fs.readFileSync(salida, 'utf8') : '';
const cuenta = (re) => (tap.match(re) || []).length;
const dato = (nombre) => (tap.match(new RegExp(`^# ${nombre} (\\d+)$`, 'm')) || [])[1];
if (!tap || dato('tests') === undefined) {
  console.log('CIEGO: el hijo no dejó un TAP completo (sin resumen final)');
  if (r.stderr) console.log(r.stderr.slice(-2000));
  console.log('EXIT=2');
  process.exit(2);
}
console.log(`casos=${dato('tests')} · pasan=${dato('pass')} · caen=${dato('fail')} · saltos=${dato('skipped')} · cancelados=${dato('cancelled')}`);
// Cada caída sale CON SU MOTIVO. «Caen 2» cuando se esperaban 2 no dice nada: la primera pasada de
// este ticket cayó por el banco («prepared statement already exists») y el recuento era el esperado.
const lineas = tap.split(/\r?\n/);
lineas.forEach((l, i) => {
  if (/# SKIP/.test(l)) console.log('  ↷ ' + l.trim());
  if (!/^\s*not ok /.test(l)) return;
  console.log('  ✖ ' + l.trim());
  const j = lineas.findIndex((x, k) => k > i && /^\s+error:/.test(x));
  if (j < 0) return;
  const enLinea = lineas[j].replace(/^\s+error:\s*/, '');
  const motivo = /^\|/.test(enLinea) ? (lineas.slice(j + 1, j + 8).find((x) => x.trim() !== '') || '') : enLinea;
  console.log('      motivo: ' + motivo.trim().slice(0, 300));
});
console.log(`líneas «not ok»: ${cuenta(/^\s*not ok /gm)}`);
console.log(`EXIT=${r.status}`);
process.exit(r.status ?? 2);
