// tests/scrum1331-sin-red-se-dice.test.mjs — SCRUM-1331
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// SIN RED, EL FICHERO DECLARA SUS TESTS Y EL ROJO DICE QUE NO ES TU CAMBIO
//
// EL DEFECTO (1-oct-2026, CI del PR #2046): `tests/scrum804b-el-barrido-de-la-42.test.mjs` hacía
// `git ls-remote` EN EL NIVEL SUPERIOR del módulo. Con el runner sin DNS el fichero moría al
// cargar y no declaraba ni un caso: el check obligatorio caía con «1 fail» sin nombre —el único
// rojo de 9.404 tests— y quien lo miraba buscaba la causa en su propio diff.
//
// CÓMO SE MIDE, sin tocar el runner ni la red de la máquina: el DNS caído se FABRICA con una
// reescritura de URL de git que vive sólo en el entorno del proceso hijo (`GIT_CONFIG_COUNT`), a
// un host `.invalid`, que es un dominio reservado que nunca resuelve. Es el fallo de verdad —git
// escribe literalmente `Could not resolve host`—, no una simulación. Y por eso este fichero NO
// necesita red para correr: la quita él.
//
// LO QUE FIJA:
//   ① sin red, 804b DECLARA sus 5 casos; los 2 puros pasan y los 3 de red caen diciendo
//      «CIEGO · SIN RED · ESTO NO ES TU CAMBIO»;
//   ② 🔴 LA DECISIÓN (orquestador del equipo de Javier, 1-oct-2026, SCRUM-1331): sin red el check
//      CAE (opción A). Pasar a «se salta con su motivo» (opción B) necesita su palabra y que el
//      aviso final de la tanda esté en `main` y visto en un run real. Quien cambie `ciego()` en
//      804b para que salte tumba ESTE fichero, a propósito;
//   ③ `censarConMotivo` distingue SIN_RED de SIN_REFS: «no hay red» no es «no pude leer»;
//   ④ el envoltorio de la tanda REPITE al final qué rojos no son un caso que falle, sin cambiar
//      el código de salida.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { temporal } from './_temporal.mjs';
import { esFalloDeRed } from '../scripts/censo-regla-42.mjs';
import { clasificarVentana, lectorDeHuellas, redactar, RED, NATIVA, SIN_HUELLA } from '../scripts/_huella-de-la-caida.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ENVOLTORIO = path.join(RAIZ, 'scripts', 'tanda-con-veredicto.mjs');
const F804B = 'tests/scrum804b-el-barrido-de-la-42.test.mjs';

/** Lo que el meta-guard de la casa EJECUTA contra este fichero. */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El censo que ya no reconoce la red: todo fallo de `ls-remote` vuelve a ser «no pude leer».
    fichero: 'scripts/censo-regla-42.mjs',
    de: "ciego: { que: esFalloDeRed(detalle) ? SIN_RED : SIN_REFS, detalle: detalle.slice(0, 300) } };",
    a: "ciego: { que: SIN_REFS, detalle: detalle.slice(0, 300) } };",
    cae: 'el censo distingue SIN_RED de SIN_REFS',
  },
  {
    // El envoltorio que lee las huellas y se las calla: el rojo vuelve a no decir nada de sí mismo.
    fichero: 'scripts/tanda-con-veredicto.mjs',
    de: '    if (aviso) process.stderr.write(aviso);',
    a: '    if (false) process.stderr.write(aviso);',
    cae: 'el envoltorio dice al final qué rojos NO son un caso que falle',
  },
  {
    // El lector que ya no ve la huella de red: «no había red» pasa a «sin huella reconocida».
    fichero: 'scripts/_huella-de-la-caida.mjs',
    de: '  if (deRed) return { clase: RED, huella: deRed.trim().slice(0, 240) };',
    a: '  if (false) return { clase: RED, huella: deRed.trim().slice(0, 240) };',
    cae: 'el envoltorio dice al final qué rojos NO son un caso que falle',
  },
];

/**
 * El entorno de un `node --test` hijo: sin `NODE_TEST_CONTEXT` (o no ejecuta nada y sale 0), sin
 * `NODE_OPTIONS` (en el CI trae reporters que pisarían el TAP de la tanda: SCRUM-1308) y sin
 * `FORCE_COLOR`.
 */
function entorno(extra = {}) {
  const e = { ...process.env, ...extra };
  delete e.NODE_TEST_CONTEXT;
  delete e.NODE_OPTIONS;
  delete e.FORCE_COLOR;
  return e;
}

/** El DNS caído, fabricado: git reescribe github.com a un host que no resuelve nunca. */
const SIN_DNS = {
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'url.https://sin-dns.invalid/.insteadOf',
  GIT_CONFIG_VALUE_0: 'https://github.com/',
};

/** Recuento del TAP: `{ tests, pass, fail, skipped }`. */
function recuento(tap) {
  const n = (clave) => Number((new RegExp(`^# ${clave} (\\d+)$`, 'm').exec(tap) || [])[1] ?? NaN);
  return { tests: n('tests'), pass: n('pass'), fail: n('fail'), skipped: n('skipped') };
}

// ═══ ① y ② · EL FICHERO REAL, CON EL DNS CAÍDO ═════════════════════════════════════════════

test('SCRUM-1331 · 🔴 sin DNS, scrum804b DECLARA sus 5 casos y los 3 de red caen diciendo CIEGO · SIN RED', () => {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', F804B],
    { cwd: RAIZ, env: entorno(SIN_DNS), encoding: 'utf8', timeout: 120_000 });
  const tap = r.stdout;

  // SUELO (A21): el DNS caído SE APLICÓ. Sin este testigo, una pasada con red se leería igual que
  // un arreglo perfecto.
  assert.match(tap, /sin-dns\.invalid/,
    '🔴 NO PUDE MIRAR: en la salida no aparece el host fabricado, así que el DNS caído no se aplicó '
    + `y esto no ha medido nada. Salida: ${tap.slice(0, 600)} ${r.stderr.slice(0, 300)}`);

  const c = recuento(tap);
  assert.equal(c.tests, 5,
    `🔴 sin red el fichero declara ${c.tests} caso(s) y tiene 5: ha vuelto a llamar a la red AL CARGAR `
    + '(el defecto de SCRUM-1331: 1 = sólo el fichero, 0 casos declarados).');
  assert.equal(c.pass, 2, `🔴 los dos casos PUROS (identidad y artefactos) no necesitan red y han pasado ${c.pass}.`);

  // 🔴 LA DECISIÓN FIRMADA: sin red, CAE. No se salta.
  assert.equal(c.skipped, 0,
    '🔴 un caso de red se ha SALTADO sin red. Eso es la opción B de SCRUM-1331, que no está firmada: '
    + 'deja entrar un merge con el barrido de la regla 42 sin comprobar.');
  assert.equal(c.fail, 3, `🔴 sin red tienen que caer los 3 casos que dependen de ella y han caído ${c.fail}.`);
  assert.notEqual(r.status, 0, '🔴 sin red la pasada ha salido con 0: un CIEGO se ha leído como verde.');

  // Y lo que DICE el rojo, que es lo que cambia.
  const dicen = tap.match(/CIEGO · SIN RED · ESTO NO ES TU CAMBIO/g) || [];
  assert.ok(dicen.length >= 3,
    `🔴 los casos caen pero ${dicen.length} dicen «CIEGO · SIN RED · ESTO NO ES TU CAMBIO»: quien lo `
    + 'lea volverá a buscar la causa en su diff.');
  assert.match(tap, /Could not resolve host/, '🔴 el mensaje no trae lo que dijo git: no se puede comprobar que era la red.');
});

// ═══ ③ · «NO HAY RED» NO ES «NO PUDE LEER» ══════════════════════════════════════════════════

test('SCRUM-1331 · 🔴 el censo distingue SIN_RED de SIN_REFS: «no hay red» no es «no pude leer»', () => {
  const pregunta = "import { censarConMotivo } from './scripts/censo-regla-42.mjs';"
    + 'const r = censarConMotivo([866]);'
    + "process.stdout.write(JSON.stringify({ censo: r.censo === null ? null : 'medido', ciego: r.ciego }));";
  const censo = (extra) => {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', pregunta],
      { cwd: RAIZ, env: entorno(extra), encoding: 'utf8', timeout: 60_000 });
    assert.equal(r.status, 0, `🔴 NO PUDE MIRAR: el censo hijo ha salido con ${r.status}: ${r.stderr.slice(0, 400)}`);
    return JSON.parse(r.stdout);
  };

  const sinRed = censo(SIN_DNS);
  assert.equal(sinRed.censo, null, '🔴 sin red el censo devuelve filas: clasifica sin haber leído las ramas.');
  assert.equal(sinRed.ciego?.que, 'SIN_RED',
    `🔴 con el DNS caído el censo se declara ${sinRed.ciego?.que} («${sinRed.ciego?.detalle}») y no SIN_RED.`);
  assert.match(sinRed.ciego.detalle, /sin-dns\.invalid/, '🔴 el detalle no trae lo que dijo git.');

  // El otro lado, y sin red tampoco: fuera de un repositorio `ls-remote` falla por algo que NO es
  // la red (`GIT_DIR` a un directorio vacío: git no encuentra ni repositorio ni remoto).
  const sinRepo = censo({ GIT_DIR: temporal('yaqu-1331-') });
  assert.equal(sinRepo.censo, null);
  assert.equal(sinRepo.ciego?.que, 'SIN_REFS',
    `🔴 sin repositorio el censo sale ${sinRepo.ciego?.que} («${sinRepo.ciego?.detalle}»): le echa la `
    + 'culpa a la red de un fallo que no es de red, y mandaría a relanzar algo que no se arregla relanzando.');
  assert.ok(sinRepo.ciego.detalle.length > 0, '🔴 SIN_REFS sin decir qué contestó git.');

  // Y las frases, una a una: lo que es red y lo que se le parece.
  for (const si of [
    "fatal: unable to access 'https://github.com/x/y.git/': Could not resolve host: github.com",
    "fatal: unable to access 'https://github.com/x/y.git/': Failed to connect to github.com port 443 after 21050 ms: Timed out",
    'ssh: connect to host github.com port 22: Connection timed out',
  ]) assert.equal(esFalloDeRed(si), true, `🔴 no reconoce como RED: ${si}`);
  for (const no of [
    "fatal: unable to access 'https://github.com/x/y.git/': The requested URL returned error: 403",
    "fatal: 'origin' does not appear to be a git repository",
    'fatal: not a git repository (or any of the parent directories): .git',
    '',
  ]) assert.equal(esFalloDeRed(no), false, `🔴 toma por RED lo que no lo es: «${no}»`);
});

// ═══ ④ · LA TANDA DICE QUÉ ROJOS NO SON UN CASO QUE FALLE ═══════════════════════════════════

const SANO = "import test from 'node:test';\ntest('sano', () => {});\n";
// Pasa su caso y el PROCESO sale ≠ 0 escribiendo la frase literal de libuv que dejó `scrum1216b`
// (SCRUM-1332). No es una muerte nativa de verdad —ésa la fabrica el test de SCRUM-1332—: es lo
// que el lector VE de ella, que es lo que aquí se mide.
const MUERE_AL_SALIR = "import test from 'node:test';\nimport fs from 'node:fs';\n"
  + "process.on('exit', () => { fs.writeSync(2, 'Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\\\\win\\\\async.c, line 94\\n'); process.exitCode = 7; });\n"
  + "test('pasa, y luego muere el proceso', () => {});\n";
const NO_CARGA_SIN_RED = "import test from 'node:test';\n"
  + "process.stderr.write(\"fatal: unable to access 'https://github.com/x/y.git/': Could not resolve host: github.com\\n\");\n"
  + "throw new Error('no llega a declarar nada');\n";
const NO_CARGA_Y_ES_TUYO = "import test from 'node:test';\nthrow new Error('un error al cargar que SÍ puede ser del cambio');\n";
const CIEGOS = "import test from 'node:test';\nimport assert from 'node:assert/strict';\n"
  + "test('ciego que cae', () => { assert.fail('🔴 CIEGO · SIN RED · ESTO NO ES TU CAMBIO. no se pudo mirar.'); });\n"
  + "test('ciego que se salta', (t) => { t.skip('CIEGO · SIN RED: el barrido no se ha comprobado'); });\n"
  + "test('salto corriente', { skip: 'falta una variable de entorno' }, () => {});\n";
const ROJO = "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('rojo de caso, de los de verdad', () => assert.equal(1, 2));\n";

function tanda(ficheros) {
  const dir = temporal('yaqu-1331-');
  for (const [nombre, codigo] of Object.entries(ficheros)) fs.writeFileSync(path.join(dir, nombre), codigo);
  return dir;
}
const envuelta = (dir, args, extra = {}) => spawnSync(process.execPath, [ENVOLTORIO, 'node', '--test', ...args],
  { cwd: dir, env: entorno(extra), encoding: 'utf8', timeout: 120_000 });
const directa = (dir, args) => spawnSync(process.execPath, ['--test', ...args],
  { cwd: dir, env: entorno(), encoding: 'utf8', timeout: 120_000 });

test('SCRUM-1331 · 🔴 el envoltorio dice al final qué rojos NO son un caso que falle, y no cambia el código de salida', () => {
  const ficheros = {
    'a-sano.test.mjs': SANO,
    'b-muere.test.mjs': MUERE_AL_SALIR,
    'c-sin-red.test.mjs': NO_CARGA_SIN_RED,
    'd-tuyo.test.mjs': NO_CARGA_Y_ES_TUYO,
    'e-ciegos.test.mjs': CIEGOS,
    'f-rojo.test.mjs': ROJO,
  };
  const dir = tanda(ficheros);
  const nombres = Object.keys(ficheros);
  const d = directa(dir, nombres);
  const r = envuelta(dir, nombres);

  // El código de salida es el de la tanda. El aviso no lo toca.
  assert.equal(d.status, 1, `🔴 NO PUDE MIRAR: la tanda fabricada, sin envoltorio, sale ${d.status} y tenía que salir 1.`);
  assert.equal(r.status, d.status, `🔴 el envoltorio ha cambiado el código de salida: ${d.status} → ${r.status}.`);
  // Y la salida estándar pasa TAL CUAL (858b): el aviso va por la de error.
  assert.match(r.stdout, /ℹ fail 5/, `🔴 la tanda fabricada no trae sus 5 caídos: ${r.stdout.slice(-500)}`);
  assert.doesNotMatch(r.stdout, /LO QUE ESTA TANDA DICE/, '🔴 el aviso se ha colado en la salida estándar de la tanda.');

  const aviso = r.stderr;
  assert.match(aviso, /LO QUE ESTA TANDA DICE DE SUS ROJOS/, `🔴 el envoltorio no dice nada de sus rojos. stderr: ${aviso.slice(-600)}`);
  // La población, declarada (A3).
  assert.match(aviso, /población: 5 caído\(s\) en «failing tests» · 3 fichero\(s\) caído\(s\) SIN caso caído · 1 caso\(s\) caído\(s\) por CIEGO · 1 saltado\(s\) por CIEGO · 1 rojo\(s\) de caso/,
    `🔴 la población del aviso no es la de la tanda fabricada. stderr: ${aviso.slice(-900)}`);

  const linea = (aguja) => aviso.split('\n').find((l) => l.includes(aguja)) ?? '';
  assert.match(linea('b-muere.test.mjs'), /MURIÓ EL PROCESO, NO FALLÓ UN TEST .*0 casos caídos dentro.*async\.c/,
    '🔴 el fichero que pasa sus casos y muere al salir no sale como «murió el proceso».');
  assert.match(linea('c-sin-red.test.mjs'), /NO HABÍA RED .*0 casos caídos dentro.*Could not resolve host/,
    '🔴 el fichero que no carga por falta de red no sale como «no había red».');
  // 🔴 EL NEGATIVO: un fichero que no carga SIN huella no se absuelve. Puede ser del cambio.
  assert.match(linea('d-tuyo.test.mjs'), /FICHERO CAÍDO SIN CASO CAÍDO .*sin huella reconocida/,
    '🔴 el fichero que no carga por un error cualquiera no sale como «sin huella reconocida».');
  assert.doesNotMatch(linea('d-tuyo.test.mjs'), /NO HABÍA RED|MURIÓ EL PROCESO|RELANZA/i,
    '🔴 un error al cargar SIN huella de red ni nativa se ha absuelto: el aviso manda a relanzar un fallo que puede ser del cambio.');

  assert.match(linea('«ciego que cae»'), /CIEGO · SIN RED .*NO PUDO MIRAR/, '🔴 el caso que cae por CIEGO no se nombra.');
  assert.match(linea('«ciego que se salta»'), /ESTA TANDA NO COMPROBÓ/,
    '🔴 un caso saltado por CIEGO no se repite al final: un salto así sólo se vería en el TAP.');
  assert.equal(linea('salto corriente'), '', '🔴 un salto corriente (sin CIEGO) se ha colado en el aviso: sería ruido en cada tanda.');
  assert.equal(linea('«rojo de caso, de los de verdad»'), '', '🔴 un rojo de caso normal aparece como si no fuera un fallo.');
  assert.match(aviso, /Y ADEMÁS hay 1 rojo\(s\) de caso que NO son nada de lo de arriba/,
    '🔴 el aviso no dice que ADEMÁS hay un rojo de verdad: se leería como «todo lo rojo es del entorno».');
});

test('SCRUM-1331 · ✅ una tanda sana no dice nada, y una que no se puede leer LO DICE', () => {
  const dir = tanda({ 'a-sano.test.mjs': SANO, 'b-muere.test.mjs': MUERE_AL_SALIR });

  // POSITIVO: sin rojos ni ciegos, ni una línea de más (858b: la salida pasa tal cual).
  const sana = envuelta(dir, ['a-sano.test.mjs']);
  assert.equal(sana.status, 0, `una tanda sana envuelta sale ${sana.status}: ${sana.stderr.slice(-300)}`);
  assert.equal(sana.stderr, '', '🔴 el envoltorio escribe en una tanda sana.');

  // Con color (FORCE_COLOR viene puesto en las sesiones de fondo: SCRUM-928) lee igual.
  const color = envuelta(dir, ['a-sano.test.mjs', 'b-muere.test.mjs'], { FORCE_COLOR: '3' });
  assert.equal(color.status, 1);
  assert.match(color.stderr, /MURIÓ EL PROCESO, NO FALLÓ UN TEST · b-muere\.test\.mjs/,
    '🔴 con el reporter en color el lector no ve al fichero caído.');

  // 🔴 CIEGO DECLARADO: con otro reporter no ve la sección de caídos, y lo dice en vez de callar.
  const tap = envuelta(dir, ['--test-reporter=tap', 'a-sano.test.mjs', 'b-muere.test.mjs']);
  assert.equal(tap.status, 1);
  assert.match(tap.stderr, /no puedo decirlo.*No es un «no hay»: es que no pude mirar/s,
    '🔴 una tanda ROJA que el lector no sabe leer no dice que no pudo: su silencio se lee como «no hay nada raro».');
});

test('SCRUM-1331 · el lector, por dentro: la huella se busca SÓLO en la salida del fichero que cae', () => {
  // La frase de red la escribe un caso que PASA; el que cae después no la tiene en su ventana.
  const salida = [
    '✔ uno que pasa (1ms)',
    'fatal: Could not resolve host: github.com',
    '✔ otro que pasa y que escribió eso (1ms)',
    'Error: boom',
    '✖ tests\\x.test.mjs (5ms)',
    'ℹ tests 3',
    '',
    '✖ failing tests:',
    '',
    'test at tests\\' + ['x.test.mjs', 1, 1].join(':'),
    '✖ tests\\x.test.mjs (5ms)',
    "  'test failed'",
    '',
  ].join('\n');
  const lector = lectorDeHuellas();
  // A trozos que parten las líneas por cualquier sitio, como llega de una tubería.
  for (let i = 0; i < salida.length; i += 7) lector.texto(salida.slice(i, i + 7));
  const informe = lector.fin();
  assert.equal(informe.vistaLaSeccion, true);
  assert.deepEqual(informe.ficherosMuertos, [{ fichero: 'tests/x.test.mjs', casosCaidosDentro: 0, clase: SIN_HUELLA, huella: '' }],
    '🔴 el lector le cuelga al fichero caído la salida de un caso anterior que pasó.');
  assert.notEqual(informe.ficherosMuertos[0].clase, RED);
  assert.notEqual(informe.ficherosMuertos[0].clase, NATIVA);
  assert.equal(redactar({ ...informe, ficherosMuertos: [] }, 1), '', 'sin nada que decir, no dice nada');
});

test('SCRUM-1331 · clasificarVentana, con entradas fabricadas: red, nativa y nada', () => {
  const red = clasificarVentana(['✔ uno (1ms)', 'fatal: Could not resolve host: github.com']);
  assert.equal(red.clase, RED);
  assert.match(red.huella, /Could not resolve host/);
  assert.equal(clasificarVentana(['----- Native stack trace -----']).clase, NATIVA);
  assert.deepEqual(clasificarVentana(['Error: boom', "  'test failed'"]), { clase: SIN_HUELLA, huella: '' });
  assert.equal(clasificarVentana(['Segmentation fault', 'fatal: Could not resolve host: x']).clase, RED,
    'la red se mira ANTES que lo nativo');
});
