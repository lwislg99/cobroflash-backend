// tests/scrum1405c-tuberia-bloqueante.test.mjs — SCRUM-1405c · J3 · la salida C de SCRUM-1405
//
// Autorización: SCRUM-1405 c.19584 (el fundador, 14-oct-2026: «Ok la C»). La C conserva
// `--test-force-exit` y pone BLOQUEANTE la tubería de salida de cada hijo con
// `scripts/tuberia-bloqueante.mjs`, cargado por `--import` desde el script `test` de package.json.
//
// Lo que este fichero comprueba, y por qué cada cosa:
//
//   ① EL CABLEADO. El script `test` sigue llevando `--test-force-exit` (la A no está autorizada) y
//      lleva el `--import` del módulo. El token se LEE de package.json y es el que usan ② y ④: si
//      alguien lo cambia, este fichero mide lo que hay, no una copia.
//   ② EL ALCANCE, medido: el hijo que `node --test` lanza por fichero carga el módulo y su salida
//      queda bloqueante; un proceso que ese test lance por su cuenta NO lo carga.
//   ③ 🔴 LA PIEZA INTERNA. El módulo se apoya en `process.stdout._handle.setBlocking`, interna de
//      node. Si un día desaparece, el módulo LANZA y el proceso no arranca: eso hace que el caso
//      «real» de ③ caiga con el mensaje del módulo en CUALQUIER tanda, y es la alarma. Los casos
//      sembrados comprueban que el módulo grita (sin la pieza, y con la pieza devolviendo error) y
//      que no grita donde no debe (salida a fichero).
//   ④ EL ROJO PRIMERO, en la MISMA máquina y el mismo proceso: una cobaya que escribe mucho, con el
//      flag, sin el módulo PIERDE casos; con el módulo, no. Sólo donde la tubería nativa NO es
//      bloqueante, y eso se MIDE en cada corrida, no se deduce del sistema: en Windows node ya la
//      pone bloqueante y no hay rojo que ver (máquina de J3f: 30 pasadas, 0 pierden, también
//      forzando `setBlocking(false)`). Si el brazo sin módulo deja de perder, el caso cae: el verde
//      del brazo con módulo ya no probaría nada (puede que node arreglara nodejs/node#64833;
//      entonces hay que decidir si la C sigue haciendo falta).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULO = path.join(RAIZ, 'scripts', 'tuberia-bloqueante.mjs');
const CLAVE = "Symbol.for('yaqu.scrum1405c.tuberiaBloqueante')";

/** El token `--import=…tuberia-bloqueante.mjs` del script `test`, tal cual está escrito. */
function tokenDelScript() {
  const script = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).scripts.test;
  const palabras = String(script).trim().split(/\s+/);
  return { script, palabras, token: palabras.find((p) => /^--import=.*tuberia-bloqueante\.mjs$/.test(p)) };
}

/** Entorno a mano (A21): sin NODE_TEST_CONTEXT ni NODE_OPTIONS heredados (el nieto de una tanda los
 *  hereda y entonces no informa, o pisa el TAP de la tanda), sin color. */
function entorno(extra = {}) {
  const env = { ...extra };
  for (const k of ['PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE']) {
    if (process.env[k] !== undefined) env[k] = process.env[k];
  }
  return env;
}


const lanzar = (args, opciones = {}) => spawnSync(process.execPath, args, {
  cwd: RAIZ, encoding: 'utf8', timeout: 120_000, maxBuffer: 1 << 28,
  stdio: ['ignore', 'pipe', 'pipe'], env: entorno(opciones.env), ...opciones.spawn,
});

// ── ① EL CABLEADO ───────────────────────────────────────────────────────────────────────────

test('SCRUM-1405c · ① `npm test` conserva --test-force-exit y carga el módulo de la tubería', () => {
  assert.ok(fs.existsSync(MODULO), '🔴 NO PUDE MIRAR: no existe scripts/tuberia-bloqueante.mjs');
  const { script, palabras, token } = tokenDelScript();
  const iTest = palabras.indexOf('--test');
  assert.ok(iTest >= 0, `🔴 NO PUDE MIRAR: el script \`test\` no lanza \`node --test\`: ${script}`);
  assert.ok(palabras.includes('--test-force-exit'),
    `🔴 el script \`test\` ya no lleva --test-force-exit. La salida firmada es la C (conservarlo); quitarlo es la A, que NO está autorizada (SCRUM-1405 c.19584). Script: ${script}`);
  assert.ok(token,
    `🔴 el script \`test\` no carga scripts/tuberia-bloqueante.mjs: con --test-force-exit, los informes de la cola se pierden en Linux (SCRUM-1405). Script: ${script}`);
  assert.ok(palabras.indexOf(token) > iTest,
    `🔴 el --import va ANTES de --test: lo cargaría el envoltorio, no el corredor ni sus hijos. Script: ${script}`);
});

// ── ② EL ALCANCE ────────────────────────────────────────────────────────────────────────────

test('SCRUM-1405c · ② lo carga el hijo de cada fichero (y su salida queda bloqueante); NO lo carga lo que ese test lance', () => {
  const { token } = tokenDelScript();
  assert.ok(token, '🔴 NO PUDE MIRAR: sin el token del script `test` (ver ①)');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `yaqu-1405c-${process.pid}-`));
  try {
    const informe = path.join(dir, 'alcance.json');
    const fichero = path.join(dir, 'alcance.test.mjs');
    fs.writeFileSync(fichero, [
      "import test from 'node:test';",
      "import fs from 'node:fs';",
      "import { spawnSync } from 'node:child_process';",
      "test('alcance', () => {",
      `  const hijo = globalThis[${CLAVE}] ?? null;`,
      `  const r = spawnSync(process.execPath, ['-e', ${JSON.stringify(`process.stdout.write(JSON.stringify(globalThis[${CLAVE}] ?? null))`)}], { encoding: 'utf8' });`,
      '  fs.writeFileSync(process.env.INFORME_1405C, JSON.stringify({ hijo, nieto: JSON.parse(r.stdout), nietoCodigo: r.status }));',
      '});',
      '',
    ].join('\n'));
    const r = lanzar(['--test', '--test-force-exit', token, '--test-reporter=tap', fichero],
      { env: { INFORME_1405C: informe } });
    assert.equal(r.status, 0, `🔴 NO PUDE MIRAR: la tanda de una línea salió con ${r.status}. stdout: ${r.stdout.slice(-1500)} stderr: ${r.stderr.slice(-600)}`);
    assert.ok(fs.existsSync(informe), `🔴 NO PUDE MIRAR: el test sonda no dejó informe. stdout: ${r.stdout.slice(-600)}`);
    const { hijo, nieto, nietoCodigo } = JSON.parse(fs.readFileSync(informe, 'utf8'));
    assert.deepEqual(hijo, { tipo: 'tuberia', puesto: true },
      `🔴 el hijo del fichero no tiene la salida bloqueante: ${JSON.stringify(hijo)}`);
    assert.equal(nietoCodigo, 0, '🔴 NO PUDE MIRAR: el nieto no corrió');
    assert.equal(nieto, null,
      `el alcance ha cambiado: un proceso que lanza un test ahora también carga el módulo (${JSON.stringify(nieto)}). Actualiza el alcance declarado en scripts/tuberia-bloqueante.mjs y en docs/master/SCRUM-1405.md.`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── ③ 🔴 LA PIEZA INTERNA ────────────────────────────────────────────────────────────────────

const LEER_MARCA = `process.stderr.write('MARCA=' + JSON.stringify(globalThis[${CLAVE}] ?? null))`;

test('SCRUM-1405c · ③ 🔴 ALARMA: en ESTE node la salida en tubería se puede poner bloqueante', () => {
  const r = lanzar(['--import=' + new URL('file:' + MODULO.replace(/\\/g, '/')).href, '-e', LEER_MARCA]);
  assert.equal(r.status, 0,
    `🔴 el módulo de la salida C no arranca en node ${process.version}. Casi seguro: la pieza interna \`process.stdout._handle.setBlocking\` ha cambiado, y SIN ella los informes de la cola vuelven a perderse en silencio en Linux. stderr: ${r.stderr.slice(-800)}`);
  assert.match(r.stderr, /MARCA=\{"tipo":"tuberia","puesto":true\}/,
    `🔴 el módulo arrancó pero no puso la tubería bloqueante: ${r.stderr.slice(-400)}`);
});

/** Un preload que siembra el defecto ANTES de que cargue el módulo. */
const sembrado = (codigo) => '--import=data:text/javascript,' + encodeURIComponent(codigo);
const moduloUrl = () => '--import=' + new URL('file:' + MODULO.replace(/\\/g, '/')).href;

test('SCRUM-1405c · ③ sembrado: SIN la pieza interna, el módulo GRITA y el proceso no arranca', () => {
  const r = lanzar([sembrado("Object.defineProperty(process.stdout._handle, 'setBlocking', { value: undefined });"),
    moduloUrl(), '-e', LEER_MARCA]);
  assert.notEqual(r.status, 0, `🔴 sin setBlocking el proceso arrancó igual (salió ${r.status}): el módulo se calla. stderr: ${r.stderr.slice(-400)}`);
  assert.match(r.stderr, /SCRUM-1405c · la salida estándar es una tubería y este node ya no ofrece/,
    `🔴 cae, pero no dice POR QUÉ: ${r.stderr.slice(-600)}`);
  assert.doesNotMatch(r.stderr, /MARCA=/, '🔴 el cuerpo llegó a correr: el módulo no paró el proceso');
});

test('SCRUM-1405c · ③ sembrado: sin `_handle` (la pieza renombrada), el módulo GRITA', () => {
  const r = lanzar([sembrado("Object.defineProperty(process.stdout, '_handle', { value: null, configurable: true });"),
    moduloUrl(), '-e', 'void 0']);
  assert.notEqual(r.status, 0, `🔴 sin _handle el proceso arrancó igual (salió ${r.status}). stderr: ${r.stderr.slice(-400)}`);
  assert.match(r.stderr, /SCRUM-1405c · la salida estándar es una tubería/, `🔴 no dice por qué: ${r.stderr.slice(-600)}`);
});

test('SCRUM-1405c · ③ sembrado: si setBlocking devuelve error, el módulo GRITA', () => {
  const r = lanzar([sembrado("Object.defineProperty(process.stdout._handle, 'setBlocking', { value: () => -22 });"),
    moduloUrl(), '-e', LEER_MARCA]);
  assert.notEqual(r.status, 0, `🔴 con setBlocking en error el proceso arrancó igual. stderr: ${r.stderr.slice(-400)}`);
  assert.match(r.stderr, /devolvió el error -22/, `🔴 no dice por qué: ${r.stderr.slice(-600)}`);
});

test('SCRUM-1405c · ③ control negativo: con la salida a FICHERO no hace nada, aunque falte la pieza', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `yaqu-1405c-${process.pid}-`));
  try {
    const fd = fs.openSync(path.join(dir, 'salida.txt'), 'w');
    let r;
    try {
      r = lanzar([sembrado("if (process.stdout._handle) Object.defineProperty(process.stdout._handle, 'setBlocking', { value: undefined });"),
        moduloUrl(), '-e', LEER_MARCA], { spawn: { stdio: ['ignore', fd, 'pipe'] } });
    } finally { fs.closeSync(fd); }
    assert.equal(r.status, 0, `🔴 con la salida a fichero el módulo grita sin motivo: ${r.stderr.slice(-600)}`);
    assert.match(r.stderr, /MARCA=\{"tipo":"fichero","puesto":false\}/, `marca inesperada: ${r.stderr.slice(-400)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── ④ EL ROJO PRIMERO ───────────────────────────────────────────────────────────────────────

const COPIAS = 4;
const CASOS = 80;
const PASADAS = 4;

// 80 casos que escriben ~4 KB de informe cada uno: unos 330 KB por fichero, como la cobaya «grande»
// de SCRUM-1405 §② (336 KB; 98 de 100 pasadas pierden con el flag en Linux, 97 con carga).
const CUERPO_COBAYA = [
  "import test from 'node:test';",
  `for (let i = 1; i <= ${CASOS}; i++) test('cobaya1405c-' + String(i).padStart(3, '0'), (t) => { t.diagnostic('x'.repeat(4000)); });`,
  '',
].join('\n');

/** ¿Pierde ESTE node sin el módulo? Se MIDE, no se deduce del sistema: un hijo SIN el módulo escribe
 *  1 MiB de un tirón a una tubería y dice cuánto le queda sin escribir al volver de `write()`. Con la
 *  tubería bloqueante, 0 (medido en Windows, también forzando `setBlocking(false)`); sin ella, lo que
 *  no cupo. `null` = no se pudo medir. */
function tuberiaNativaNoBloqueante() {
  const r = lanzar(['-e', "process.stdout.write(Buffer.alloc(1 << 20, 120)); process.stderr.write('PENDIENTE=' + process.stdout.writableLength)"]);
  const m = /PENDIENTE=(\d+)/.exec(r.stderr || '');
  return m ? Number(m[1]) > 0 : null;
}
const NATIVA_NO_BLOQUEANTE = tuberiaNativaNoBloqueante();

function brazo(ficheros, extra) {
  const filas = [];
  for (let p = 0; p < PASADAS; p++) {
    const r = lanzar(['--test', '--test-force-exit', ...extra, '--test-reporter=tap', `--test-concurrency=${COPIAS}`, ...ficheros]);
    const informados = (r.stdout.match(/^\s*ok \d+ - cobaya1405c-/gm) || []).length;
    filas.push({ codigo: r.status, informados, faltan: COPIAS * CASOS - informados });
  }
  return filas;
}

test('SCRUM-1405c · ④ 🔴 EL ROJO PRIMERO: sin el módulo la cobaya PIERDE casos; con él, ninguno',
  { skip: NATIVA_NO_BLOQUEANTE === false
    ? 'este node ya escribe BLOQUEANTE en una tubería sin el módulo (medido: 0 bytes pendientes tras 1 MiB): no hay rojo que ver. Pasa en Windows (J3f: 0 de 30 pasadas de cobaya pierden). Se mide en el CI de Linux.'
    : false },
  (t) => {
    assert.notEqual(NATIVA_NO_BLOQUEANTE, null, '🔴 NO PUDE MIRAR: la sonda de la tubería nativa no contestó');
    const { token } = tokenDelScript();
    assert.ok(token, '🔴 NO PUDE MIRAR: sin el token del script `test` (ver ①)');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `yaqu-1405c-${process.pid}-`));
    try {
      const ficheros = [];
      for (let i = 1; i <= COPIAS; i++) {
        const f = path.join(dir, `cobaya-${i}.test.mjs`);
        fs.writeFileSync(f, CUERPO_COBAYA);
        ficheros.push(f);
      }
      const sin = brazo(ficheros, []);
      const con = brazo(ficheros, [token]);
      const resumen = `sin el módulo: ${JSON.stringify(sin)} · con el módulo: ${JSON.stringify(con)}`;
      for (const f of [...sin, ...con]) {
        assert.equal(f.codigo, 0, `🔴 NO PUDE MIRAR: una pasada de la cobaya no salió con 0. ${resumen}`);
      }
      assert.ok(sin.some((f) => f.faltan > 0),
        `🔴 CIEGO: sin el módulo la cobaya NO pierde en ${PASADAS} pasadas, así que el verde de abajo no probaría nada. ¿Ha arreglado node la pérdida (nodejs/node#64833)? Entonces hay que decidir si la C sigue haciendo falta. ${resumen}`);
      assert.ok(con.every((f) => f.faltan === 0),
        `🔴 con el módulo la cobaya SIGUE perdiendo casos: la salida C no basta. ${resumen}`);
      t.diagnostic(`SCRUM-1405c · ${resumen}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
