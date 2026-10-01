// tests/scrum1289b-reporters-como-argumentos.test.mjs — SCRUM-1289b
//
// EL ARREGLO DE RAÍZ DEL TAP ROTO. SCRUM-1289 (S5) midió que el TAP de TODAS las tandas del CI salía
// con un 94 % de NUL: un test que lanza su propio `node --test` heredaba de `NODE_OPTIONS` los
// reporters de la tanda y TRUNCABA `tanda.tap`. S5 arregló los dos hijos que lo hacían; esto quita
// la causa: `tanda-con-veredicto.mjs` saca los reporters de `NODE_OPTIONS` y se los pasa como
// ARGUMENTOS a la tanda, que no se heredan.
//
// Se mide EL VIAJE, no el gesto: una tanda de verdad, con los reporters en `NODE_OPTIONS` como los
// pone `ci.yml`, y dentro un test que lanza su `node --test` sin limpiar `NODE_OPTIONS` (la forma
// exacta de scrum976 antes de SCRUM-1289). Y con CONTROL POSITIVO: la misma tanda SIN el envoltorio
// tiene que romper el TAP. Si no lo rompe, este banco no sabe ver la avería y lo dice en ROJO.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { separarReporters, reportersComoArgumentos } from '../scripts/_reporters-de-node-options.mjs';
import { veredictoDelSuelo, integridadDelTap, SALIDA_NO_SUPE_MIRAR } from '../scripts/_suelo-de-la-tanda.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENVOLTORIO = path.join(RAIZ, 'scripts', 'tanda-con-veredicto.mjs');

// Lo que pone `ci.yml` (paso «Tests»), con el destino cambiado por uno propio.
const opcionesDelCi = (tap) =>
  `--test-reporter=spec --test-reporter-destination=stdout --test-reporter=tap --test-reporter-destination=${tap}`;

// ═══ LA FUNCIÓN ══════════════════════════════════════════════════════════════════════════

test('1289b · separa los reporters del CI y deja el resto de `NODE_OPTIONS`, en su orden', () => {
  const r = separarReporters(`--max-old-space-size=4096 ${opcionesDelCi('/tmp/t.tap')} --enable-source-maps`);
  assert.deepEqual(r.reporters, [
    '--test-reporter=spec', '--test-reporter-destination=stdout',
    '--test-reporter=tap', '--test-reporter-destination=/tmp/t.tap',
  ]);
  assert.equal(r.resto, '--max-old-space-size=4096 --enable-source-maps');
});

test('1289b · también la forma con espacio (`--test-reporter tap`) y los valores entre comillas', () => {
  const r = separarReporters('--test-reporter tap --test-reporter-destination "C:/con espacio/t.tap"');
  // Sin las comillas: como argumento no hay shell que las quite.
  assert.deepEqual(r.reporters, ['--test-reporter=tap', '--test-reporter-destination=C:/con espacio/t.tap']);
  assert.equal(r.resto, '');
});

test('1289b · los reporters van JUSTO DETRÁS de `--test`, delante de los ficheros', () => {
  // Detrás de los ficheros node los ignora en silencio (medido por S5 en SCRUM-1289).
  const env = { NODE_OPTIONS: `--max-old-space-size=4096 ${opcionesDelCi('t.tap')}`, OTRA: '1' };
  const r = reportersComoArgumentos('node', ['--test', '--test-force-exit', 'tests/a.test.mjs'], env);
  assert.deepEqual(r.args, ['--test', ...r.movidos, '--test-force-exit', 'tests/a.test.mjs']);
  assert.equal(r.movidos.length, 4);
  assert.equal(r.env.NODE_OPTIONS, '--max-old-space-size=4096', 'lo que no es reporter se queda');
  assert.equal(r.env.OTRA, '1');
  assert.equal(env.NODE_OPTIONS.includes('--test-reporter'), true, 'no toca el entorno que recibe');
});

test('1289b · sin reporters, o si la orden no es `node --test`, todo queda EXACTAMENTE igual', () => {
  const sin = { NODE_OPTIONS: '--max-old-space-size=4096' };
  assert.deepEqual(reportersComoArgumentos('node', ['--test', 'a'], sin).args, ['--test', 'a']);
  assert.equal(reportersComoArgumentos('node', ['--test', 'a'], sin).env, sin);
  const con = { NODE_OPTIONS: opcionesDelCi('t.tap') };
  assert.equal(reportersComoArgumentos('npm', ['test'], con).env, con, 'no hay dónde meterlos: no se tocan');
  assert.equal(reportersComoArgumentos('node', ['script.mjs'], con).env, con);
  // Y si NODE_OPTIONS solo traía reporters, no se deja la variable vacía: se quita.
  assert.equal('NODE_OPTIONS' in reportersComoArgumentos('node', ['--test', 'a'], con).env, false);
});

// ═══ EL VIAJE ════════════════════════════════════════════════════════════════════════════

// Como en el CI, el padre ya ha ESCRITO parte de su TAP cuando el nieto lo trunca: por eso un
// primer fichero con muchos tests, y el que lanza al nieto después. Con el padre sin escribir aún,
// el truncado no deja huella (medido: así nació este banco, y su control positivo lo cazó).
const PRIMEROS = 20;
const TOTAL = PRIMEROS + 1;

/** Una tanda de juguete: `a-primero` (20 tests) y `b-lanza`, que lanza un `node --test` de `nieto`. */
function banco() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1289b-'));
  fs.writeFileSync(path.join(dir, 'nieto.test.mjs'),
    "import test from 'node:test';\ntest('nieto', () => {});\n");
  fs.writeFileSync(path.join(dir, 'a-primero.test.mjs'),
    "import test from 'node:test';\n" +
    `for (let i = 0; i < ${PRIMEROS}; i++) test('primero con un nombre largo para ocupar bytes ' + i, () => {});\n`);
  // La forma de scrum976 ANTES de SCRUM-1289: borra NODE_TEST_CONTEXT y NO borra NODE_OPTIONS.
  fs.writeFileSync(path.join(dir, 'b-lanza.test.mjs'), [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { spawnSync } from 'node:child_process';",
    "test('lanza su propio node --test', () => {",
    '  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;',
    "  const r = spawnSync(process.execPath, ['--test', 'nieto.test.mjs'], { cwd: import.meta.dirname, env, encoding: 'utf8' });",
    "  assert.equal(r.status, 0, 'el nieto tiene que correr: ' + r.stderr);",
    '});',
    '',
  ].join('\n'));
  return dir;
}

/** Legible = sin NUL y con UN solo resumen, que es el de la tanda entera. */
function leerTap(tap) {
  const buf = fs.existsSync(tap) ? fs.readFileSync(tap) : Buffer.alloc(0);
  const nul = buf.reduce((n, b) => n + (b === 0 ? 1 : 0), 0);
  const resumenes = [...buf.toString('utf8').replace(/\0/g, '').matchAll(/^# tests (\d+)$/gm)].map((m) => Number(m[1]));
  return { bytes: buf.length, nul, resumenes, legible: buf.length > 0 && nul === 0 && resumenes.length === 1 && resumenes[0] === TOTAL };
}

function correr(dir, conEnvoltorio) {
  const tap = path.join(dir, conEnvoltorio ? 'con.tap' : 'sin.tap');
  const env = { ...process.env, NODE_OPTIONS: opcionesDelCi(tap) };
  delete env.NODE_TEST_CONTEXT;
  delete env.FORCE_COLOR;
  // Concurrencia 1: el orden de los ficheros tiene que ser el mismo en cada pasada.
  const orden = ['--test', '--test-force-exit', '--test-concurrency=1', 'a-primero.test.mjs', 'b-lanza.test.mjs'];
  const r = conEnvoltorio
    ? spawnSync(process.execPath, [ENVOLTORIO, 'node', ...orden], { cwd: dir, env, encoding: 'utf8' })
    : spawnSync(process.execPath, orden, { cwd: dir, env, encoding: 'utf8' });
  return { r, tap: leerTap(tap) };
}

test('1289b · 🔴 CONTROL POSITIVO: SIN el envoltorio, el nieto ROMPE el TAP (si no, este banco no ve la avería)', () => {
  const dir = banco();
  try {
    const { r, tap } = correr(dir, false);
    assert.equal(r.status, 0, `la tanda de juguete tiene que ir verde (como las del CI): ${r.stderr}`);
    assert.equal(tap.legible, false,
      '🔴 NO SUPE REPRODUCIR LA AVERÍA: con los reporters en NODE_OPTIONS y un nieto que los hereda, el ' +
      `TAP salió legible (${JSON.stringify(tap)}). Sin esto, el verde del test de abajo no prueba nada.`);
    // Y sobre ESE TAP roto de verdad, el suelo de la tanda se niega a contar (punto 3 de SCRUM-1289).
    const v = veredictoDelSuelo(fs.readFileSync(path.join(dir, 'sin.tap'), 'utf8'), 1);
    assert.equal(v.salida, SALIDA_NO_SUPE_MIRAR,
      `🔴 el suelo CUENTA sobre un TAP roto (salida ${v.salida}, total ${v.total}): acertaría por suerte.`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('1289b · 🔴 CON el envoltorio, el mismo nieto ya no toca el TAP: sin NUL y UN solo resumen', () => {
  const dir = banco();
  try {
    const { r, tap } = correr(dir, true);
    assert.equal(r.status, 0, `la tanda tiene que salir verde: ${r.stderr}`);
    assert.match(r.stdout, new RegExp(`tests ${TOTAL}`),'el spec sigue yendo a stdout, que es de donde el envoltorio lee el recuento');
    assert.equal(tap.legible, true, `🔴 EL TAP SIGUE ROTO con el envoltorio: ${JSON.stringify(tap)}`);
    // CONTROL del suelo: sobre el TAP sano SÍ cuenta, y cuenta lo de la tanda.
    const v = veredictoDelSuelo(fs.readFileSync(path.join(dir, 'con.tap'), 'utf8'), 1);
    assert.equal(v.salida, 0, `🔴 el suelo se niega a contar un TAP sano: ${v.titulo}`);
    assert.equal(v.total, TOTAL);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ═══ EL SUELO QUE ACERTABA POR SUERTE ════════════════════════════════════════════════════

const TAP_SANO = 'TAP version 13\nok 1 - a\n1..1\n# tests 7000\n# pass 7000\n# fail 0\n';

test('1289b · 🔴 el suelo NO cuenta sobre un TAP con NUL, aunque el total esté en la cola', () => {
  // La forma exacta que S5 midió: el tramo de NUL en medio y el `# tests` del padre al final.
  const roto = 'TAP version 13\n' + '\0'.repeat(500) + TAP_SANO.slice('TAP version 13\n'.length);
  assert.equal(integridadDelTap(roto).legible, false);
  const v = veredictoDelSuelo(roto, 1);
  assert.equal(v.salida, SALIDA_NO_SUPE_MIRAR, `🔴 contó ${v.total} sobre un TAP roto`);
  assert.match(v.detalle, /NUL/);
});

test('1289b · 🔴 el suelo NO cuenta con DOS resúmenes en la raíz (el del hijo y el del padre)', () => {
  const dos = 'TAP version 13\nok 1 - hijo\n1..1\n# tests 4\n# pass 4\n' + TAP_SANO.slice('TAP version 13\n'.length);
  const v = veredictoDelSuelo(dos, 1);
  assert.equal(v.salida, SALIDA_NO_SUPE_MIRAR);
  assert.match(v.detalle, /2 resúmenes/);
});

test('1289b · CONTROL: un TAP sano se sigue contando igual, con CRLF incluido', () => {
  assert.equal(veredictoDelSuelo(TAP_SANO, 1).salida, 0);
  assert.equal(veredictoDelSuelo(TAP_SANO.replace(/\n/g, '\r\n'), 1).salida, 0);
});
