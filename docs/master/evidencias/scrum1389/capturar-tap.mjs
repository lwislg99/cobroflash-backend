#!/usr/bin/env node
// docs/master/evidencias/scrum1389/capturar-tap.mjs — SCRUM-1389c
//
// Captura el TAP de los 9 casos del banco de SCRUM-1389 (`banco.mjs`, mismos ficheros y mismo modo
// de correr) y lo deja en `tests/fixtures/scrum1389c/caso-N.tap`: es el positivo SEMBRADO de
// `tests/scrum1389c-senal-tres-clases.test.mjs`. Las rutas de la máquina salen como `<banco>`.
//
// USO:  node docs/master/evidencias/scrum1389/capturar-tap.mjs [carpeta-de-salida]
import fs from 'node:fs';
import path from 'node:path';
import { temporal } from '../../../../tests/_temporal.mjs'; // SCRUM-864 · el temporal se borra pase lo que pase
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SALIDA = process.argv[2] ?? path.join(RAIZ, 'tests', 'fixtures', 'scrum1389c');
fs.mkdirSync(SALIDA, { recursive: true });
const TMP = temporal('scrum1389c-cap-');
const ENV = {};
for (const k of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA']) {
  if (process.env[k] !== undefined) ENV[k] = process.env[k];
}
const escribir = (n, t) => { fs.writeFileSync(path.join(TMP, n), t); return n; };
const LIMPIO = escribir('limpio.test.mjs', "import test from 'node:test';\ntest('caso limpio del banco', () => {});\n");
const OTRO = escribir('otro-limpio.test.mjs', "import test from 'node:test';\ntest('otro caso limpio del banco', () => {});\n");
const ROJO = escribir('rojo.test.mjs', "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('caso que cae de verdad', () => { assert.equal(1, 2); });\n");
const IMPORT_ROTO = escribir('import-roto.test.mjs', "import test from 'node:test';\nimport './este-modulo-no-existe.mjs';\ntest('nunca llega a registrarse', () => {});\n");
const SINTAXIS = escribir('sintaxis-rota.test.mjs', "import test from 'node:test';\ntest('nunca llega', () => { ;;; ) \n");
const THROW = escribir('throw-arriba.test.mjs', "throw new Error('revienta en la primera linea');\n");
const EXIT1 = escribir('exit-uno-mudo.test.mjs', 'process.exit(1);\n');
const NATIVO = escribir('nativo.test.mjs', 'process.exit(3221225794);\n');
const MEDIO = escribir('muere-a-medias.test.mjs', "import test from 'node:test';\ntest('pasa y luego el proceso muere', () => {});\ntest('mata el proceso', () => { process.exit(3221225794); });\ntest('este ya no corre', () => {});\n");
const RENOMBRA = escribir('a-renombra.test.mjs', "import fs from 'node:fs';\nimport test from 'node:test';\n"
  + "test('renombra el binario', () => { const de = process.env.BANCO_NODE_COPIA; let ultimo;\n"
  + "  for (let i = 0; i < 50; i += 1) { try { fs.renameSync(de, de + '.ya-no'); return; } catch (e) { ultimo = e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100); } }\n"
  + "  throw ultimo; });\n");

const casos = [
  [1, [LIMPIO, OTRO]], [2, [LIMPIO, ROJO]], [3, [LIMPIO, IMPORT_ROTO]], [4, [LIMPIO, SINTAXIS]], [5, [LIMPIO, THROW]],
  [6, [LIMPIO, EXIT1]], [7, [LIMPIO, NATIVO]], [8, [LIMPIO, MEDIO]],
];
const correr = (n, ficheros, exe = process.execPath, env = ENV) => {
  const r = spawnSync(exe, ['--test', '--test-concurrency=1', '--test-reporter=tap', ...ficheros], { cwd: TMP, env, encoding: 'utf8', timeout: 120000 });
  // Sin rutas de la máquina: la carpeta temporal pasa a <banco>. Node la escribe con el nombre CORTO
  // de Windows (`JAVIER~1`), con las barras dobladas o como URL, así que se busca por el NOMBRE de la
  // carpeta, no por la ruta que dio `mkdtemp` (la primera captura salió con la ruta entera por eso).
  const carpeta = path.basename(TMP);
  const tap = (r.stdout || '')
    .replace(new RegExp(`file:///[^\\s']*?${carpeta}`, 'g'), '<banco>')
    .replace(new RegExp(`[A-Za-z]:[^\\s']*?${carpeta}`, 'g'), '<banco>')
    .replace(new RegExp(`/[^\\s']*?${carpeta}`, 'g'), '<banco>');
  if (tap.includes(carpeta)) throw new Error(`caso ${n}: la carpeta temporal sigue en el TAP`);
  fs.writeFileSync(path.join(SALIDA, `caso-${n}.tap`), tap);
  console.log(`caso ${n}: EXIT=${r.status} bytes=${tap.length} ` + (tap.match(/^# (tests|pass|fail) \d+$/gm) || []).join(' · '));
};
const t0 = Date.now();
for (const [n, f] of casos) correr(n, f);
const copia = path.join(TMP, 'node-copia' + path.extname(process.execPath));
fs.copyFileSync(process.execPath, copia);
correr(9, [RENOMBRA, LIMPIO, OTRO], copia, { ...ENV, BANCO_NODE_COPIA: copia });
console.log('TESTIGO caso 9: binario renombrado = ' + fs.existsSync(copia + '.ya-no'));
console.log('ms=' + (Date.now() - t0) + ' · node ' + process.version + ' · ' + process.platform);
