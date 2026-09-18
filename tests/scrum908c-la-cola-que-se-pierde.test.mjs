// tests/scrum908c-la-cola-que-se-pierde.test.mjs — SCRUM-908c · J6 (calidad y seguridad)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA MUDA INTERMITENTE NO ERA DEL GUARD: ERA DE LA TUBERÍA
//
// La mutación nº 2 de `scrum859` salió MUDA en 8 de 49 jobs del meta-guard en CI (17-sep 16:00Z
// → 18-sep 14:03Z, leídos uno a uno en sus logs), y las 4 que llevan diagnóstico tienen la MISMA
// firma: «NO APARECE · 9 pasados · 7 caídos» frente a 20 en la limpia. Faltan el test nombrado y
// los tres que van detrás. En Windows, 0 de 91 (SCRUM-908 y 908b).
//
// El mecanismo que este fichero DEMUESTRA con un caso fabricado:
//
//   1. el hijo de `node:test` corre con `--test-force-exit` (el meta-guard lo lanza con
//      `run({ forceExit: true })`, `scripts/meta-guard-mutaciones.mjs`);
//   2. al acabar, Node espera al `unpipe` del reporter y llama a `process.exit()` SIN esperar a
//      que stdout se vacíe (`lib/internal/test_runner/test.js` de Node 24.20.0, 1463-1487);
//   3. en POSIX la escritura a una tubería es ASÍNCRONA; en Windows, SÍNCRONA
//      (`doc/api/process.md` de Node 24.20.0, línea 4237);
//   4. así que en Linux, lo que el padre no haya leído cuando el hijo sale **se pierde**, y
//      `process.exit()` lo avisa en su propia documentación (process.md, «truncated and lost»).
//
// Con la mutación, el hijo de scrum859 escribe ~1 MB, y justo antes del test nombrado van 327 KB
// en una sola ráfaga. Si el padre no ha terminado de leerla cuando llega la cola, la cola no llega.
//
// ── QUÉ HACE ESTE FICHERO ────────────────────────────────────────────────────────────────────
// Un hijo fabricado, lanzado EXACTAMENTE como lo lanza `run()` (NODE_TEST_CONTEXT=child-v8 +
// `--test-force-exit`, stdio en tuberías: `lib/internal/test_runner/runner.js`, 476-510), y un
// padre que se PARA sin leer mientras el hijo escribe y sale. Tres brazos:
//
//   SUELO ......... stdout a FICHERO (síncrono): los 5 mensajes llegan enteros. Si no, el caso
//                   fabricado no sirve para nada de lo que viene detrás.
//   SIN ARREGLO ... tubería + padre parado. La ley que se exige es la MISMA en las dos
//                   plataformas: si el hijo SALE mientras el padre no lee, la cola se pierde; si
//                   no puede salir, llega entera. En Linux sale (y se pierde); en Windows no
//                   puede salir, porque la tubería es síncrona (y llega). No se lee la plataforma:
//                   se mide lo que pasó (SCRUM-702 — una comprobación que asevera cosas distintas
//                   según el entorno no se comprueba en el otro).
//   CON ARREGLO ... lo mismo, con stdout bloqueante en el hijo (`--import` de una línea): el hijo
//                   no puede salir con datos pendientes y llega todo. Es el arreglo que se le
//                   propone a S3.
//
// ⛔ NO toca el instrumento (`scripts/meta-guard-mutaciones.mjs`, de S3), ni `scrum859`, ni el
//    workflow (S5). Mide la tubería con un caso propio, fuera del árbol.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import v8 from 'node:v8';
import { spawn } from 'node:child_process';

// Los títulos van en ASCII a propósito: V8 serializa una cadena de un byte como latin1, así que el
// título aparece LITERAL en los bytes del mensaje y se puede buscar sin deserializar (los mensajes
// que llevan un Error no los lee el `Deserializer` por defecto).
const RELLENO = 'RELLENO-908c';
const NOMBRADO = 'NOMBRADO-908c';
const COLA = ['COLA-908c-1', 'COLA-908c-2', 'COLA-908c-3'];
const TODOS = [RELLENO, NOMBRADO, ...COLA];

// El tamaño del relleno decide el caso. Tiene que dejar el NOMBRADO MÁS ALLÁ de lo que cabe en la
// tubería (64 KiB en Linux) y el total POR DEBAJO de tubería + marca de agua del socket (64 + 64
// KiB en POSIX): si el total la pasa, el hijo se queda esperando `drain`, no sale, y no hay nada
// que perder. Los dos bordes se comprueban en el SUELO sobre los bytes reales, no se suponen.
// MEDIDO: el texto del Error viaja OCHO veces (mensaje y pila, del error y de su envoltorio, en
// `test:complete` y en `test:fail`), así que el relleno ocupa ~8 × TAM. Con 20.000 el hijo
// escribía 171.459 bytes y se pasaba del segundo borde.
const TAM_RELLENO = 11000;
const TUBERIA = 64 * 1024;
const MARCA_DE_AGUA = 64 * 1024;

// La pausa del padre. En el brazo SIN ARREGLO de Linux el hijo sale en ~0,2 s; cuando el hijo se
// queda BLOQUEADO (tubería síncrona o stdout bloqueante) la pausa se agota.
const PAUSA_MS = 2000;

// El arreglo que se mide: stdout bloqueante en el hijo, cargado antes que nada con `--import`.
// Es lo que hace el paquete `set-blocking` para que `process.exit()` no trunque la salida.
const PRELOAD = 'data:text/javascript,' + encodeURIComponent(
  'process.stdout._handle?.setBlocking?.(true); globalThis.__j6StdoutBloqueante = true;');

/** El hijo fabricado. El testigo de SALIDA (A21): escribe su marca en `exit`. */
function cuerpoDelHijo() {
  return [
    "import test from 'node:test';",
    "import fs from 'node:fs';",
    'const MARCA = process.env.J6_908C_MARCA;',
    "if (MARCA) process.on('exit', () => { try { fs.writeFileSync(MARCA, 'salio'); } catch {} });",
    `test(${JSON.stringify(RELLENO)}, () => { throw new Error('r'.repeat(${TAM_RELLENO})); });`,
    `test(${JSON.stringify(NOMBRADO)}, () => { throw new Error('el nombrado'); });`,
    ...COLA.map((c) => `test(${JSON.stringify(c)}, () => {});`),
    '',
  ].join('\n');
}

/** El hijo, como lo lanza `run()`. El entorno se construye A MANO (A21), sin heredar el color. */
function entornoDelHijo(marca) {
  const env = { NODE_TEST_CONTEXT: 'child-v8', J6_908C_MARCA: marca };
  for (const k of ['PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'HOME']) {
    if (process.env[k] !== undefined) env[k] = process.env[k];
  }
  return env;
}

/** Espera SÍNCRONA: el padre no atiende su bucle de eventos, así que no lee la tubería. */
function pararSinLeer(marca, ms) {
  const celda = new Int32Array(new SharedArrayBuffer(4));
  const hasta = Date.now() + ms;
  while (Date.now() < hasta) {
    if (fs.existsSync(marca)) return true;
    Atomics.wait(celda, 0, 0, 10);
  }
  return fs.existsSync(marca);
}

/** Trocea el flujo del reporter v8 igual que `runner.js` (cabecera V8 + 4 bytes de longitud). */
function trocear(buf) {
  const s = new v8.Serializer(); s.writeHeader();
  const H = s.releaseBuffer().length;
  const mensajes = [];
  let i = 0;
  while (i + H + 4 <= buf.length) {
    const fin = i + H + 4 + buf.readUInt32BE(i + H);
    if (fin > buf.length) break;
    mensajes.push(buf.subarray(i, fin));
    i = fin;
  }
  return { mensajes, sobrante: buf.length - i, bytes: buf.length };
}

const TIPOS_VEREDICTO = [Buffer.from('test:pass', 'latin1'), Buffer.from('test:fail', 'latin1')];
const esVeredicto = (m) => TIPOS_VEREDICTO.some((t) => m.includes(t));

/** Qué títulos llegaron con su veredicto (`test:pass` / `test:fail`) en un mensaje ENTERO. */
function llegados({ mensajes }) {
  const vistos = new Set();
  for (const m of mensajes) {
    if (!esVeredicto(m)) continue;
    for (const t of TODOS) if (m.includes(Buffer.from(t, 'latin1'))) vistos.add(t);
  }
  return vistos;
}

/**
 * Offset del primer mensaje de VEREDICTO que nombra `titulo`. Sólo de veredicto: el
 * `test:enqueue` de cada test sale al principio del flujo (medido: byte 372), y medir contra él
 * daba el caso por mal calibrado cuando no lo estaba.
 */
function offsetDe({ mensajes }, titulo) {
  let off = 0;
  for (const m of mensajes) {
    if (esVeredicto(m) && m.includes(Buffer.from(titulo, 'latin1'))) return off;
    off += m.length;
  }
  return -1;
}

/** SUELO: stdout a un descriptor de FICHERO. Escritura síncrona: aquí no se pierde nada. */
function correrAFichero(hijo, fd, marca) {
  return new Promise((ok, ko) => {
    const c = spawn(process.execPath, ['--test-force-exit', hijo],
      { env: entornoDelHijo(marca), stdio: ['ignore', fd, 'ignore'] });
    c.on('error', ko);
    c.on('exit', ok);
  });
}

/** Tubería, y el padre PARADO sin leer desde el primer instante. */
function correrConPadreParado(hijo, marca, extra = []) {
  const c = spawn(process.execPath, [...extra, '--test-force-exit', hijo],
    { env: entornoDelHijo(marca), stdio: ['pipe', 'pipe', 'pipe'] });
  const trozos = [];
  const errores = [];
  c.stdout.on('data', (d) => trozos.push(d));
  c.stderr.on('data', (d) => errores.push(d));
  // Síncrono y justo después de `spawn`: hasta que vuelva, este proceso no lee ni un byte.
  const salioDuranteLaPausa = pararSinLeer(marca, PAUSA_MS);
  return new Promise((ok, ko) => {
    c.on('error', ko);
    c.on('close', (code) => ok({
      ...trocear(Buffer.concat(trozos)), code, salioDuranteLaPausa,
      stderr: Buffer.concat(errores).toString('utf8').slice(0, 400),
    }));
  });
}

const resumen = (r) => `bytes=${r.bytes} mensajes=${r.mensajes.length} sobrante=${r.sobrante} `
  + `llegados=[${[...llegados(r)].join(',')}]`
  + ('salioDuranteLaPausa' in r ? ` salioDuranteLaPausa=${r.salioDuranteLaPausa} code=${r.code}` : '');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Una sola pasada de cada brazo, compartida: los tests juzgan la misma medición.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const medir = (async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `yaqu-908c-${process.pid}-`));
  try {
    const hijo = path.join(dir, 'hijo-908c.mjs');
    fs.writeFileSync(hijo, cuerpoDelHijo());
    const rutaSuelo = path.join(dir, 'suelo.bin');
    const fd = fs.openSync(rutaSuelo, 'w');
    try { await correrAFichero(hijo, fd, path.join(dir, 'marca-suelo')); } finally { fs.closeSync(fd); }
    const suelo = trocear(fs.readFileSync(rutaSuelo));
    const sinArreglo = await correrConPadreParado(hijo, path.join(dir, 'marca-sin'));
    const conArreglo = await correrConPadreParado(hijo, path.join(dir, 'marca-con'), []);
    // POBLACIÓN (A3): qué se midió y sobre cuántos mensajes.
    console.log(`# SCRUM-908c · node=${process.version} pausa=${PAUSA_MS}ms relleno=${TAM_RELLENO}`);
    console.log(`# SUELO        ${resumen(suelo)}`);
    console.log(`# SIN ARREGLO  ${resumen(sinArreglo)}`);
    console.log(`# CON ARREGLO  ${resumen(conArreglo)}`);
    return { suelo, sinArreglo, conArreglo };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})();

test('SCRUM-908c · 🔴 SUELO: el hijo fabricado emite sus 5 veredictos, y el caso cae donde debe', async () => {
  const { suelo } = await medir;
  assert.equal(suelo.sobrante, 0, `🔴 CIEGO: el fichero del SUELO acaba a medio mensaje. ${resumen(suelo)}`);
  assert.deepEqual([...llegados(suelo)].sort(), [...TODOS].sort(),
    `🔴 CIEGO: el hijo no emite sus 5 veredictos ni escribiendo a fichero. ${resumen(suelo)}`);
  // Los dos bordes del caso, sobre los bytes REALES (no supuestos):
  const off = offsetDe(suelo, NOMBRADO);
  assert.ok(off > TUBERIA + 4096,
    `🔴 caso mal calibrado: el NOMBRADO empieza en el byte ${off}, dentro de lo que cabe en la `
    + `tubería (${TUBERIA}). Así no se puede perder, y el brazo SIN ARREGLO no mediría nada.`);
  assert.ok(suelo.bytes < TUBERIA + MARCA_DE_AGUA - 8192,
    `🔴 caso mal calibrado: el hijo escribe ${suelo.bytes} bytes, más de tubería + marca de agua `
    + `(${TUBERIA + MARCA_DE_AGUA}). Esperaría un \`drain\` que el padre parado no da, y no saldría.`);
});

test('SCRUM-908c · 🔴 SIN ARREGLO: si el hijo sale mientras el padre no lee, la cola SE PIERDE; si no puede salir, llega', async () => {
  const { sinArreglo: r } = await medir;
  const vistos = llegados(r);
  assert.ok(r.bytes > 0, `🔴 CIEGO: por la tubería no llegó nada. ${resumen(r)} stderr=${r.stderr}`);
  if (r.salioDuranteLaPausa) {
    // Linux: la tubería es asíncrona. El hijo SALIÓ con el padre parado, y lo que no cupo en la
    // tubería se quedó en la cola de libuv, que `process.exit()` tira.
    assert.equal(vistos.has(NOMBRADO), false,
      '🔴 el hijo salió con el padre parado y aun así llegó el NOMBRADO: Node ya vacía stdout '
      + `antes de salir, y la causa de SCRUM-908 no es ésta. ${resumen(r)}`);
    for (const c of COLA) {
      assert.equal(vistos.has(c), false, `🔴 llegó ${c} detrás de un NOMBRADO perdido. ${resumen(r)}`);
    }
    assert.ok(r.sobrante > 0 || r.bytes <= TUBERIA,
      `🔴 se perdió la cola pero lo recibido ni acaba a medias ni cabe en la tubería. ${resumen(r)}`);
  } else {
    // Windows: la tubería es síncrona, el hijo se bloquea al llenarla y no puede salir con datos
    // pendientes. Es la razón medida de que la muda no se reprodujera nunca en local (0 de 91).
    assert.deepEqual([...vistos].sort(), [...TODOS].sort(),
      `🔴 el hijo NO salió durante la pausa y aun así se perdió la cola. ${resumen(r)}`);
    assert.equal(r.sobrante, 0, `🔴 la tubería acabó a medio mensaje. ${resumen(r)}`);
  }
});

test('SCRUM-908c · ✅ CON ARREGLO: stdout bloqueante en el hijo, no sale con datos pendientes y llega TODO', async () => {
  const { conArreglo: r } = await medir;
  // Sólo vale porque el SUELO garantiza que el hijo escribe MÁS de lo que cabe en la tubería: con
  // stdout bloqueante, llenarla lo detiene hasta que el padre lea.
  assert.equal(r.salioDuranteLaPausa, false,
    '🔴 el hijo salió con el padre parado aunque su stdout debía ser bloqueante: el arreglo no se '
    + `aplicó (o el caso ya no llena la tubería: mira el SUELO). ${resumen(r)} stderr=${r.stderr}`);
  assert.equal(r.sobrante, 0, `🔴 la tubería acabó a medio mensaje. ${resumen(r)}`);
  assert.deepEqual([...llegados(r)].sort(), [...TODOS].sort(),
    `🔴 con stdout bloqueante se perdió algo. ${resumen(r)}`);
});

test('SCRUM-908c · ✅ el vehículo del arreglo: `run({ execArgv })` le pasa el `--import` al hijo', async () => {
  // Lo que se le propone a S3 es un `execArgv` en el `run()` del meta-guard. Esto comprueba el
  // vehículo, no el efecto: que el preload llega al proceso hijo que corre los tests.
  //
  // ⚠️ `run()` NO se puede llamar desde aquí dentro: este fichero corre como hijo de `node --test`
  // (NODE_TEST_CONTEXT puesto) y `run()` entonces se salta los ficheros con sólo un aviso
  // (`runner.js`, 956-960). MEDIDO: la primera versión de este test daba `pasados=[]` y
  // `caidos=[]` — un cero que el CIEGO de abajo cazó. Por eso lo corre un conductor aparte, sin
  // esa variable, que es como corre el meta-guard (`npm run meta:mutaciones`).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `yaqu-908c-run-${process.pid}-`));
  try {
    const f = path.join(dir, 'vehiculo-908c.mjs');
    fs.writeFileSync(f, [
      "import test from 'node:test';",
      "import assert from 'node:assert/strict';",
      "test('VEHICULO-908c', () => { assert.equal(globalThis.__j6StdoutBloqueante, true); });",
      '',
    ].join('\n'));
    const conductor = path.join(dir, 'conductor-908c.mjs');
    fs.writeFileSync(conductor, [
      "import { run } from 'node:test';",
      'const [f, pre] = process.argv.slice(2);',
      'const pasados = []; const caidos = [];',
      "for await (const ev of run({ files: [f], forceExit: true, execArgv: ['--import', pre] })) {",
      "  if (ev.type === 'test:pass' && !ev.data.skip) pasados.push(ev.data.name);",
      "  if (ev.type === 'test:fail') caidos.push(ev.data.name);",
      '}',
      "process.stdout.write('RESULTADO ' + JSON.stringify({ pasados, caidos }) + '\\n');",
      '',
    ].join('\n'));
    const env = entornoDelHijo('');
    delete env.NODE_TEST_CONTEXT;
    delete env.J6_908C_MARCA;
    const salida = await new Promise((ok, ko) => {
      const c = spawn(process.execPath, [conductor, f, PRELOAD], { env, stdio: ['ignore', 'pipe', 'pipe'] });
      const out = [];
      c.stdout.on('data', (d) => out.push(d));
      c.on('error', ko);
      c.on('close', () => ok(Buffer.concat(out).toString('utf8')));
    });
    const linea = salida.split(/\r?\n/).find((l) => l.startsWith('RESULTADO '));
    assert.ok(linea, `🔴 CIEGO: el conductor no dejó su línea de resultado. Salida: ${salida.slice(0, 300)}`);
    const { pasados, caidos } = JSON.parse(linea.slice('RESULTADO '.length));
    assert.deepEqual(caidos, [], `🔴 el preload no llegó al hijo: cayeron ${JSON.stringify(caidos)}`);
    assert.deepEqual(pasados, ['VEHICULO-908c'], `🔴 CIEGO: pasados=${JSON.stringify(pasados)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
