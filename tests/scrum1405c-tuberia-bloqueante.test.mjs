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
//
//   SCRUM-1405d · el brazo CON módulo ya no afirma «ninguno»: afirma lo que el módulo LOGRA, medido.
//      Decisión B del fundador (SCRUM-1405 c.20140, 21-oct-2026: «Ok vamos con la B»). Con «ninguno»
//      el caso caía en el 12,6 % de los obligatorios (38 de 302) sin que el código cambiara: el
//      módulo reduce la pérdida, no la lleva a cero (SCRUM-1559h, commit 13d392ac1). Las dos cifras
//      de abajo son las MEDIDAS, no elegidas; población, ventana y salida en docs/master/SCRUM-1405.md, APÉNDICE SCRUM-1405d.
//
//   SCRUM-1574 · ④ ya no se salta porque lo diga la sonda: la sonda dio 0 en 14 de 316 obligatorios de
//      Linux, donde la tubería NO bloquea, y esos jobs salieron verdes sin medir nada. Ahora se salta
//      sólo si el brazo SIN módulo no pierde, y el salto dice «NO MEDIDO» con lo que midió
//      (`decidirCuarto`; registro en docs/master/SCRUM-1574.md).
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

/** La sonda: un hijo SIN el módulo escribe 1 MiB de un tirón a una tubería y dice cuánto le queda sin
 *  escribir al volver de `write()`. `null` = no contestó.
 *  SCRUM-1574 · más de 0 PRUEBA que la tubería no bloquea; 0 NO prueba que bloquee. En Linux node nunca
 *  la pone bloqueante (sólo en Windows: lib/net.js:655-658 de v24.21.0) y la salida del hijo es un
 *  socketpair (deps/uv/src/unix/process.c:207), así que un 0 sólo dice que el lector la vació a tiempo.
 *  Pasó en 14 de los 316 obligatorios de SCRUM-1405d, y ④ se saltó diciendo «ya escribe BLOQUEANTE». */
function bytesPendientesDeLaSonda() {
  const r = lanzar(['-e', "process.stdout.write(Buffer.alloc(1 << 20, 120)); process.stderr.write('PENDIENTE=' + process.stdout.writableLength)"]);
  const m = /PENDIENTE=(\d+)/.exec(r.stderr || '');
  return m ? Number(m[1]) : null;
}
// SCRUM-1625b · EXPERIMENTO (rama que no entra en main): la sonda corre a la CARGA del fichero, donde
// estaba antes de SCRUM-1574, y no al principio de ④, justo antes de los dos brazos.
const PENDIENTE_DE_LA_SONDA = bytesPendientesDeLaSonda();

/** Qué hace ④ con lo que ha visto (SCRUM-1574). Quien decide si hay rojo que ver es el brazo SIN el
 *  módulo, no la sonda: `pendiente` son los bytes de la sonda y `sinFaltan` los casos que pierde cada
 *  pasada sin el módulo. Estados: 'medir' (se juzga el brazo CON), 'no-medido' (se salta, con el motivo
 *  medido en el log), 'ciego' y 'no-pude' (rojo). */
function decidirCuarto(pendiente, sinFaltan) {
  if (pendiente === null) return { estado: 'no-pude', motivo: '🔴 NO PUDE MIRAR: la sonda de la tubería nativa no contestó' };
  const sinPierde = sinFaltan.some((x) => x > 0);
  if (sinPierde) return { estado: 'medir', motivo: '' };
  if (pendiente > 0) return { estado: 'ciego', motivo: `🔴 CIEGO: la sonda dejó ${pendiente} bytes pendientes (la tubería NO bloquea) y aun así, sin el módulo, la cobaya NO pierde en ${sinFaltan.length} pasadas: el verde de abajo no probaría nada. ¿Ha arreglado node la pérdida (nodejs/node#64833)? Entonces hay que decidir si la C sigue haciendo falta.` };
  return { estado: 'no-medido', motivo: `NO MEDIDO: sin el módulo la cobaya no pierde en ${sinFaltan.length} pasadas (faltan ${sinFaltan.join(',')}) y la sonda dejó 0 bytes pendientes tras 1 MiB: en este node no hay rojo que ver. Pasa en Windows (J3f: 0 de 30 pasadas de cobaya pierden). Se mide en el CI de Linux.` };
}

// Lo que la cobaya pierde CON el módulo en el CI de Linux, medido el 21-oct-2026 sobre origin/main
// fe65a8b7fca8b1e42448c8134e26d880d96b9ba7 (el módulo y este caso, sin cambios desde f13e8664a):
// los 302 obligatorios con esta línea de ci.yml entre el 14-oct 07:59Z y el 20-oct 15:35Z, 1.208
// pasadas. Pierden 41 (3,4 %; 3,3 % y 3,5 % en cada mitad). Máximo por pasada: 15 de 320, igual en
// las dos mitades. Pasadas que pierden en un mismo job: 0 en 264, 1 en 35, 2 en 3, nunca 3 o 4.
// SIN el módulo, en los mismos 302: pierden 3 o 4 pasadas de 4 en todos (0 de 302 con 2 o menos).
// Si una cifra sube, el módulo pierde más que cuando se midió: se mide otra vez, no se ensancha.
const CON_MAX_POR_PASADA = 15;
const CON_MAX_PASADAS_QUE_PIERDEN = 2;

/** Los `faltan` de las pasadas CON el módulo, contra lo medido. Devuelve los motivos de rojo ([] = verde). */
function juzgarConModulo(faltan) {
  const motivos = [];
  const peor = Math.max(...faltan);
  if (peor > CON_MAX_POR_PASADA) motivos.push(`una pasada pierde ${peor} de ${COPIAS * CASOS} (medido: como mucho ${CON_MAX_POR_PASADA})`);
  const pierden = faltan.filter((x) => x > 0).length;
  if (pierden > CON_MAX_PASADAS_QUE_PIERDEN) motivos.push(`pierden ${pierden} pasadas de ${faltan.length} (medido: como mucho ${CON_MAX_PASADAS_QUE_PIERDEN})`);
  return motivos;
}

function brazo(ficheros, extra) {
  const filas = [];
  for (let p = 0; p < PASADAS; p++) {
    const r = lanzar(['--test', '--test-force-exit', ...extra, '--test-reporter=tap', `--test-concurrency=${COPIAS}`, ...ficheros]);
    const informados = (r.stdout.match(/^\s*ok \d+ - cobaya1405c-/gm) || []).length;
    filas.push({ codigo: r.status, informados, faltan: COPIAS * CASOS - informados });
  }
  return filas;
}

test('SCRUM-1405c · ④ 🔴 EL ROJO PRIMERO: sin el módulo la cobaya PIERDE casos; con él, no más de lo medido (SCRUM-1405d)',
  (t) => {
    const pendiente = PENDIENTE_DE_LA_SONDA;
    assert.notEqual(pendiente, null, decidirCuarto(null, []).motivo);
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
      for (const f of sin) {
        assert.equal(f.codigo, 0, `🔴 NO PUDE MIRAR: una pasada de la cobaya no salió con 0. sin el módulo: ${JSON.stringify(sin)}`);
      }
      const decision = decidirCuarto(pendiente, sin.map((f) => f.faltan));
      if (decision.estado === 'no-medido') {
        t.skip(decision.motivo);
        return;
      }
      assert.equal(decision.estado, 'medir', `${decision.motivo} sonda: ${pendiente} bytes · sin el módulo: ${JSON.stringify(sin)}`);
      const con = brazo(ficheros, [token]);
      const resumen = `sonda: ${pendiente} bytes · sin el módulo: ${JSON.stringify(sin)} · con el módulo: ${JSON.stringify(con)}`;
      for (const f of con) {
        assert.equal(f.codigo, 0, `🔴 NO PUDE MIRAR: una pasada de la cobaya no salió con 0. ${resumen}`);
      }
      assert.deepEqual(juzgarConModulo(con.map((f) => f.faltan)), [],
        `🔴 con el módulo la cobaya pierde MÁS de lo medido el 21-oct-2026 (SCRUM-1405d): la salida C ha empeorado. ${resumen}`);
      t.diagnostic(`SCRUM-1405c · ${resumen}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

// SCRUM-1405d · las mutaciones del juez, para el meta-guard. Cada una afloja lo que el módulo tiene que
// cumplir, y el caso «el juez» tiene que caer con todas.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Sin el tope de pasadas que pierden: el brazo SIN módulo de 117751198316 (0,10,8,7) pasaría.
    fichero: 'tests/scrum1405c-tuberia-bloqueante.test.mjs',
    de: '  if (pierden > CON_MAX_PASADAS_QUE_PIERDEN) motivos.push',
    a: '  if (false) motivos.push',
    cae: 'SCRUM-1405d · ④ el juez',
  },
  {
    // El tope por pasada, al máximo medido SIN módulo (52).
    fichero: 'tests/scrum1405c-tuberia-bloqueante.test.mjs',
    de: '  if (peor > CON_MAX_POR_PASADA) motivos',
    a: '  if (peor > 52) motivos',
    cae: 'SCRUM-1405d · ④ el juez',
  },
  {
    // Vuelta al «ninguno» de 1405c: lo que el módulo SÍ logra pasa a ser rojo.
    fichero: 'tests/scrum1405c-tuberia-bloqueante.test.mjs',
    de: '  const pierden = faltan.filter((x) => x > 0).length;',
    a: '  const pierden = faltan.filter((x) => x > 0).length * (CON_MAX_PASADAS_QUE_PIERDEN + 1);',
    cae: 'SCRUM-1405d · ④ el juez',
  },
  {
    // Un juez que no mira nada.
    fichero: 'tests/scrum1405c-tuberia-bloqueante.test.mjs',
    de: '  return motivos;\n}',
    a: '  return [];\n}',
    cae: 'SCRUM-1405d · ④ el juez',
  },
  {
    // SCRUM-1574 · vuelta al salto por la sonda: con 0 bytes pendientes no se mide aunque el brazo SIN pierda.
    fichero: 'tests/scrum1405c-tuberia-bloqueante.test.mjs',
    de: "  if (sinPierde) return { estado: 'medir'",
    a: "  if (sinPierde && pendiente > 0) return { estado: 'medir'",
    cae: 'SCRUM-1574 · ④ la decisión',
  },
  {
    // SCRUM-1574 · el salto mudo: se salta sin decir que no midió.
    fichero: 'tests/scrum1405c-tuberia-bloqueante.test.mjs',
    de: "  return { estado: 'no-medido', motivo: `NO MEDIDO: sin el módulo",
    a: "  return { estado: 'no-medido', motivo: `sin el módulo",
    cae: 'SCRUM-1574 · ④ la decisión',
  },
  {
    // SCRUM-1574 · sin CIEGO: una tubería que no bloquea y una cobaya que no pierde pasarían a saltarse.
    fichero: 'tests/scrum1405c-tuberia-bloqueante.test.mjs',
    de: "  if (pendiente > 0) return { estado: 'ciego'",
    a: "  if (false) return { estado: 'ciego'",
    cae: 'SCRUM-1574 · ④ la decisión',
  },
];

// El juez de ④ corre en Linux; éste, en TODA tanda (también en Windows, donde ④ se salta). Las filas
// son pasadas REALES del CI (job de GitHub Actions entre paréntesis), salvo los bordes, que salen de
// las dos constantes.
test('SCRUM-1405d · ④ el juez: lo peor medido CON el módulo pasa; el brazo SIN módulo (el módulo roto) cae', () => {
  const verdes = {
    'una pasada en el máximo (116542397959)': [15, 0, 0, 0],
    'dos pasadas que pierden (116953966815)': [0, 7, 14, 0],
    'dos pasadas que pierden (118033018003)': [0, 14, 0, 4],
    'borde: las dos cifras justas': [CON_MAX_POR_PASADA, CON_MAX_POR_PASADA, 0, 0],
  };
  for (const [nombre, faltan] of Object.entries(verdes)) {
    assert.deepEqual(juzgarConModulo(faltan), [], `🔴 el juez tumba lo que el módulo SÍ logra: ${nombre}`);
  }
  const rojos = {
    'sin módulo, el único job de 302 con las 4 pasadas en 15 o menos (117751198316)': [0, 10, 8, 7],
    'sin módulo, el job de SCRUM-1559h (117734088229)': [14, 10, 27, 31],
    'borde: una pasada uno por encima': [CON_MAX_POR_PASADA + 1, 0, 0, 0],
    'borde: una pasada que pierde de más': Array.from({ length: CON_MAX_PASADAS_QUE_PIERDEN + 1 }, () => 1),
  };
  for (const [nombre, faltan] of Object.entries(rojos)) {
    assert.notDeepEqual(juzgarConModulo(faltan), [], `🔴 el juez deja pasar una pérdida que el módulo NO logra: ${nombre}`);
  }
});

// SCRUM-1574 · la decisión de ④ corre en TODA tanda (en Windows ④ se salta). Los brazos SIN módulo son
// filas reales del CI (job entre paréntesis); la sonda a 0 es lo que dijo en los 14 jobs de SCRUM-1574, y
// 983040 (1 MiB menos 64 KiB) es una cifra fabricada: el log no imprime lo que deja la sonda.
test('SCRUM-1574 · ④ la decisión: una sonda a 0 no salta si el brazo SIN módulo pierde; un salto dice NO MEDIDO', () => {
  const casos = [
    // El positivo sembrado: el caso de los 14 jobs. Antes se saltaba; ahora tiene que medir.
    { nombre: 'sonda a 0 y el brazo SIN pierde (115745643294)', pendiente: 0, sin: [28, 12, 29, 13], espera: 'medir' },
    { nombre: 'sonda a 0 y el brazo SIN pierde en una pasada', pendiente: 0, sin: [0, 0, 1, 0], espera: 'medir' },
    // El negativo: un job normal mide.
    { nombre: 'sonda con pendientes y el brazo SIN pierde (117734088229)', pendiente: 983040, sin: [14, 10, 27, 31], espera: 'medir' },
    { nombre: 'sonda a 0 y el brazo SIN no pierde (Windows)', pendiente: 0, sin: [0, 0, 0, 0], espera: 'no-medido' },
    { nombre: 'sonda con pendientes y el brazo SIN no pierde', pendiente: 983040, sin: [0, 0, 0, 0], espera: 'ciego' },
    { nombre: 'la sonda no contestó', pendiente: null, sin: [], espera: 'no-pude' },
  ];
  for (const estado of ['medir', 'no-medido', 'ciego', 'no-pude']) {
    assert.ok(casos.some((c) => c.espera === estado), `🔴 CIEGO: no hay ningún caso sembrado que deba dar «${estado}»`);
  }
  assert.ok(casos.some((c) => c.pendiente === 0 && c.espera === 'medir'),
    '🔴 CIEGO: falta el caso de SCRUM-1574 (sonda a 0 con el brazo SIN perdiendo)');
  for (const c of casos) {
    const d = decidirCuarto(c.pendiente, c.sin);
    assert.equal(d.estado, c.espera, `🔴 ${c.nombre}: sale «${d.estado}» y tiene que salir «${c.espera}». ${d.motivo}`);
    if (d.estado === 'no-medido') {
      assert.match(d.motivo, /^NO MEDIDO: /, `🔴 ${c.nombre}: el salto no dice que no midió: ${d.motivo}`);
      assert.ok(d.motivo.includes(`faltan ${c.sin.join(',')}`), `🔴 ${c.nombre}: el salto no dice lo que midió: ${d.motivo}`);
    }
    if (d.estado === 'ciego' || d.estado === 'no-pude') assert.match(d.motivo, /^🔴 /, `🔴 ${c.nombre}: un rojo sin motivo: ${d.motivo}`);
  }
});
