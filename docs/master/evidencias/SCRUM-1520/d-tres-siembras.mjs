// docs/master/evidencias/SCRUM-1520/d-tres-siembras.mjs — SCRUM-1520d · las tres rutas que callan, por la cadena de HOY
//
//     node docs/master/evidencias/SCRUM-1520/d-tres-siembras.mjs
//
// QUÉ MIDE. Que las tres formas que censa `d-la-ruta-que-calla.mjs` CALLAN de verdad con la cadena
// que corre hoy `npm test` (envoltorio → `node --test --test-force-exit --import=./scripts/
// tuberia-bloqueante.mjs`, la pieza que entró el 14-oct con SCRUM-1405c, después de que SCRUM-1520 ②
// midiera las variantes I y K). Cada siembra es un fichero con un caso que CAE; se lanza sola por la
// cadena y se lee el código de salida y el resumen («ℹ tests / pass / fail / todo»).
//   R  control positivo: el caso cae sin más → tiene que salir 1 (si sale 0, el banco no vale)
//   X  `process.exit(0)` en el caso anterior al que cae
//   C  `process.exitCode = 0` en un `after`
//   T  el caso que cae está marcado `{ todo: true }`
//   T2 el caso llama a `t.todo()` y luego cae
//
// QUÉ NO MIDE. Linux. Corre donde se lance (aquí, Windows). El código de salida del corredor no
// depende del sistema (sale de `runner.js`, leído en SCRUM-1520 ①), pero eso es lectura, no medida.
//
// Sale 0 si pudo medir y el control positivo salió 1; 2 si no.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { temporal } from '../../../../tests/_temporal.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const dir = temporal('scrum1520d-');
const ENCABEZADO = "import { test, after } from 'node:test';\nimport assert from 'node:assert/strict';\n";
const cae = (n, extra = '') => `test('caso ${n}', ${extra}() => { assert.equal(1, 2, 'cae a propósito'); });\n`;
const pasa = (n) => `test('caso ${n}', () => { assert.ok(true); });\n`;

const SIEMBRAS = [
  ['R', 'sin más: el caso 3 cae', pasa(1) + pasa(2) + cae(3)],
  ['X', 'process.exit(0) en el caso 2; el 3 cae', pasa(1) + "test('caso 2', () => { process.exit(0); });\n" + cae(3)],
  ['C', 'process.exitCode = 0 en un after; el 3 cae', "after(() => { process.exitCode = 0; });\n" + pasa(1) + pasa(2) + cae(3)],
  ['T', '{ todo: true } en el caso 3, que cae', pasa(1) + pasa(2) + cae(3, '{ todo: true }, ')],
  ['T2', 't.todo() dentro del caso 3, que luego cae', pasa(1) + pasa(2) + "test('caso 3', (t) => { t.todo('pendiente'); assert.equal(1, 2, 'cae a propósito'); });\n"],
];

const env = { ...process.env };
delete env.FORCE_COLOR; delete env.NO_COLOR; delete env.NODE_TEST_CONTEXT;
const filas = [];
for (const [id, que, cuerpo] of SIEMBRAS) {
  const f = join(dir, `siembra-${id}.test.mjs`);
  writeFileSync(f, ENCABEZADO + cuerpo);
  const r = spawnSync(process.execPath, [join(RAIZ, 'scripts', 'tanda-con-veredicto.mjs'), process.execPath, '--test', '--test-force-exit',
    '--import=./scripts/tuberia-bloqueante.mjs', '--test-reporter=spec', f], { cwd: RAIZ, env, encoding: 'utf8', timeout: 120_000 });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/\x1B\[[0-9;?]*[ -/]*[@-~]/g, '');
  const cifra = (k) => (salida.match(new RegExp(`^ℹ ${k} (\\d+)$`, 'm')) ?? [])[1] ?? '?';
  filas.push({ id, que, salida: r.status, tests: cifra('tests'), pass: cifra('pass'), fail: cifra('fail'), todo: cifra('todo'), bytes: salida.length });
}

console.log(`SCRUM-1520d · tres rutas que callan · node ${process.version} · ${process.platform} · cadena: tanda-con-veredicto → node --test --test-force-exit --import=./scripts/tuberia-bloqueante.mjs`);
console.log('id | qué se siembra | salida | ℹ tests | pass | fail | todo');
for (const x of filas) console.log(`${x.id} | ${x.que} | ${x.salida} | ${x.tests} | ${x.pass} | ${x.fail} | ${x.todo}`);
const r = filas.find((x) => x.id === 'R');
const ciego = filas.filter((x) => x.salida === null || x.tests === '?' || x.bytes === 0);
if (r.salida !== 1 || ciego.length) {
  console.log(`CIEGO: ${r.salida !== 1 ? `el control positivo R salió ${r.salida}, no 1` : ''}${ciego.length ? ` · sin resumen legible: ${ciego.map((x) => x.id).join(', ')}` : ''}. La tabla NO VALE.`);
  process.exitCode = 2;
}
