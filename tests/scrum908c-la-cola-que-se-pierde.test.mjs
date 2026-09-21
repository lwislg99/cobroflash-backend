// tests/scrum908c-la-cola-que-se-pierde.test.mjs — SCRUM-908c · J6 (calidad y seguridad)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 RECALIBRADO: EL CASO ANTERIOR SUPONÍA UNA CAPACIDAD (64 KiB + 64 KiB) QUE NUNCA SE MIDIÓ
//
// El commit ROJO A PROPÓSITO del 18-sep (run 35364145759, cabeza f6ac3021) hizo caer los DOS
// brazos: en el CI de Linux llegaron ENTEROS los 99.003 bytes del caso, así que ni se perdió nada
// SIN ARREGLO ni se ejerció el bloqueo CON ARREGLO. El transporte del CI acepta, sin bloquearse,
// más de lo que la hipótesis previa (pipe de 64 KiB + marca de agua de 64 KiB, sin medir) suponía.
// Error propio de J6, confesado (A9): un número elegido no es un número medido.
//
// Esta versión NO ASUME ningún tamaño. Antes de fabricar el caso, un brazo CAPACIDAD mide el
// techo real de ESTA máquina (el hijo escribe a ráfagas y se para en cuanto su PROPIO Writable
// dice `writableLength > 0`), y el tamaño del caso se DERIVA de esa medición. El caso se calibra
// solo, por dentro, en cada corrida.
//
// El mecanismo que este fichero sigue demostrando con un caso fabricado:
//
//   1. el hijo de `node:test` corre con `--test-force-exit` (el meta-guard lo lanza con
//      `run({ forceExit: true })`, `scripts/meta-guard-mutaciones.mjs`);
//   2. al acabar, Node espera al `unpipe` del reporter y llama a `process.exit()` SIN esperar a
//      que stdout se vacíe (`lib/internal/test_runner/test.js` de Node 24.20.0, 1463-1487);
//   3. `process.exit()` avisa en su propia documentación que lo pendiente en una tubería
//      asíncrona puede quedar «truncated and lost» (`doc/api/process.md`, línea 4237);
//   4. así que si el hijo sale con datos aún en su Writable (`writableLength > 0`), esos datos NO
//      llegan al padre. La LEY de este fichero usa esa señal — la que el propio proceso reporta
//      de sí mismo al salir —, no una plataforma ni una capacidad supuesta.
//
// ── QUÉ HACE ESTE FICHERO ────────────────────────────────────────────────────────────────────
// Un hijo fabricado, lanzado EXACTAMENTE como lo lanza `run()` (NODE_TEST_CONTEXT=child-v8 +
// `--test-force-exit`, stdio en tuberías: `lib/internal/test_runner/runner.js`, 476-510), y un
// padre que se PARA sin leer mientras el hijo escribe y sale. Cuatro brazos:
//
//   CAPACIDAD ..... un hijo SIN node:test escribe ráfagas de tamaño fijo y se para en cuanto SU
//                   PROPIO `process.stdout.writableLength` deja de ser 0 (o al llegar a un techo
//                   de seguridad). Lo que el padre parado recibió de verdad es la capacidad
//                   MEDIDA de esta máquina, y de ahí sale el tamaño del caso de abajo.
//   SUELO ......... stdout a FICHERO (síncrono): los 5 mensajes llegan enteros. Si no, el caso
//                   fabricado no sirve para nada de lo que viene detrás.
//   SIN ARREGLO ... tubería + padre parado. La LEY: si el propio hijo midió cola > 0 al salir
//                   (`process.on('exit')`, antes de que nada pueda vaciarla), el NOMBRADO y la
//                   COLA tienen que faltar; si midió cola === 0, tiene que llegar todo. No se lee
//                   la plataforma ni se asume una capacidad: se lee lo que el hijo dice de sí
//                   mismo (SCRUM-702 — una comprobación que asevera cosas distintas según el
//                   entorno no se comprueba en el otro).
//   CON ARREGLO ... lo mismo, con stdout bloqueante en el hijo (`--import` de una línea): cada
//                   `write()` se vacía antes de devolver el control, así que en `exit` la cola
//                   TIENE que ser 0 y no puede perderse nada. Es el arreglo que se le propone a S3.
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

// ── La sonda de CAPACIDAD ───────────────────────────────────────────────────────────────────
// Ráfagas de este tamaño hasta que el propio Writable vea cola, o hasta el TECHO (que existe solo
// para no escribir sin fin si esta máquina admite más de lo razonable: si se llega a él sin ver
// cola, la base para calibrar es «al menos el techo», no un número inventado por encima).
const PASO_CAPACIDAD = 4096;
const TECHO_CAPACIDAD = 2 * 1024 * 1024;

// El tamaño del caso real se deriva de lo medido: el doble de la capacidad + un margen fijo,
// topado en el mismo TECHO que se sondeó (no se le pide al caso más de lo que se comprobó).
const MARGEN_CAPACIDAD = 2;
const MARGEN_FIJO = 64 * 1024;

// MEDIDO en el CI de Linux (run 35364145759, ci-rojo-f6ac3021.txt): con TAM_RELLENO=11000 el hijo
// escribe 99.003 bytes — el texto del Error viaja OCHO veces (mensaje y pila, del error y de su
// envoltorio, en `test:complete` y en `test:fail`), más cabeceras: la razón bytes/relleno medida
// es 9,0003. Es una escala para no tener que sondear el hijo REAL (que no se puede trocear en
// ráfagas controladas); el propio SUELO comprueba después que el resultado cae donde debe.
const RATIO_BYTES_POR_RELLENO = 9;
const TAM_RELLENO_MIN = 11000; // suelo: nunca por debajo del valor ya usado en CI

// La pausa del padre. En Linux, con el hijo bloqueado por su propia cola, la pausa se agota; en
// Windows la escritura es síncrona y el hijo no sale con nada pendiente.
const PAUSA_MS = 2000;

// El arreglo que se mide: stdout bloqueante en el hijo, cargado antes que nada con `--import`.
// Es lo que hace el paquete `set-blocking` para que `process.exit()` no trunque la salida.
const PRELOAD = 'data:text/javascript,' + encodeURIComponent(
  'process.stdout._handle?.setBlocking?.(true); globalThis.__j6StdoutBloqueante = true;');

/** Entorno común, construido A MANO (A21): nunca `{ ...process.env }`, para no heredar el color
 *  ni nada que no se haya pedido. */
function entornoBase(extra) {
  const env = { ...extra };
  for (const k of ['PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'HOME']) {
    if (process.env[k] !== undefined) env[k] = process.env[k];
  }
  return env;
}

/** El hijo de la sonda de CAPACIDAD. Sin node:test: escribe ráfagas y se para solo. */
function cuerpoDelCapacidad() {
  return [
    "import fs from 'node:fs';",
    `const PASO = Buffer.alloc(${PASO_CAPACIDAD}, 67);`,
    `const TECHO = ${TECHO_CAPACIDAD};`,
    'let escrito = 0;',
    'let cola = 0;',
    'while (escrito < TECHO) {',
    '  process.stdout.write(PASO);',
    '  escrito += PASO.length;',
    '  cola = process.stdout.writableLength;',
    '  if (cola > 0) break;',
    '}',
    'const MARCA = process.env.J6_908C_MARCA_CAP;',
    "fs.writeFileSync(MARCA, JSON.stringify({ escrito, cola }));",
    'process.exit();',
    '',
  ].join('\n');
}

/** El hijo fabricado. El testigo de SALIDA (A21): al salir, apunta la cola que él mismo ve en su
 *  Writable — la señal de la que depende la LEY, medida por el proceso sobre sí mismo. */
function cuerpoDelHijo(tamRelleno) {
  return [
    "import test from 'node:test';",
    "import fs from 'node:fs';",
    'const MARCA = process.env.J6_908C_MARCA;',
    "if (MARCA) process.on('exit', () => {",
    '  try { fs.writeFileSync(MARCA, JSON.stringify({ colaAlSalir: process.stdout.writableLength })); } catch {}',
    '});',
    `test(${JSON.stringify(RELLENO)}, () => { throw new Error('r'.repeat(${tamRelleno})); });`,
    `test(${JSON.stringify(NOMBRADO)}, () => { throw new Error('el nombrado'); });`,
    ...COLA.map((c) => `test(${JSON.stringify(c)}, () => {});`),
    '',
  ].join('\n');
}

/** El hijo, como lo lanza `run()`. */
function entornoDelHijo(marca) {
  return entornoBase({ NODE_TEST_CONTEXT: 'child-v8', J6_908C_MARCA: marca });
}

/** Espera SÍNCRONA: el padre no atiende su bucle de eventos, así que no lee la tubería. Vuelve
 *  en cuanto la marca existe (el hijo salió), o al agotar `ms`. */
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
    c.on('close', (code) => {
      let colaAlSalir = null;
      try { colaAlSalir = JSON.parse(fs.readFileSync(marca, 'utf8')).colaAlSalir; } catch {}
      ok({
        ...trocear(Buffer.concat(trozos)), code, salioDuranteLaPausa, colaAlSalir,
        stderr: Buffer.concat(errores).toString('utf8').slice(0, 400),
      });
    });
  });
}

/** La sonda de CAPACIDAD: mismo patrón (tubería + padre parado), sin node:test de por medio. */
function correrCapacidad(dir) {
  const hijo = path.join(dir, 'capacidad-908c.mjs');
  fs.writeFileSync(hijo, cuerpoDelCapacidad());
  const marca = path.join(dir, 'marca-capacidad.json');
  const c = spawn(process.execPath, [hijo],
    { env: entornoBase({ J6_908C_MARCA_CAP: marca }), stdio: ['ignore', 'pipe', 'pipe'] });
  let recibido = 0;
  const errores = [];
  c.stdout.on('data', (d) => { recibido += d.length; });
  c.stderr.on('data', (d) => errores.push(d));
  const salioDuranteLaPausa = pararSinLeer(marca, PAUSA_MS);
  return new Promise((ok, ko) => {
    c.on('error', ko);
    c.on('close', () => {
      let medido = null;
      try { medido = JSON.parse(fs.readFileSync(marca, 'utf8')); } catch {}
      ok({ recibido, salioDuranteLaPausa, medido, stderr: Buffer.concat(errores).toString('utf8').slice(0, 400) });
    });
  });
}

const resumen = (r) => `bytes=${r.bytes} mensajes=${r.mensajes.length} sobrante=${r.sobrante} `
  + `llegados=[${[...llegados(r)].join(',')}]`
  + ('salioDuranteLaPausa' in r ? ` salioDuranteLaPausa=${r.salioDuranteLaPausa} code=${r.code} colaAlSalir=${r.colaAlSalir}` : '');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Una sola pasada de cada brazo, compartida: los tests juzgan la misma medición.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const medir = (async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `yaqu-908c-${process.pid}-`));
  try {
    // ── 1) CAPACIDAD: cuánto acepta el transporte en ESTA máquina antes de que el propio
    //    Writable de Node vea cola. Sin asumir ningún número (SCRUM-908c, recalibración). ──────
    const capacidad = await correrCapacidad(dir);
    const colaCap = capacidad.medido?.cola ?? 0;
    // Si nunca se vio cola dentro del TECHO de la sonda (Windows: escritura síncrona, así que
    // `writableLength` nunca deja de ser 0), NO hay un techo finito que medir en esta máquina:
    // fingir uno igual al de la sonda sería pedirle al caso que supere su propio límite de
    // búsqueda, que es imposible por construcción. `capacidadBase` queda `null` y el caso usa el
    // tamaño mínimo conocido — en esa máquina nada se pierde por este mecanismo, sea cual sea el
    // tamaño (SCRUM-908/908b: 0 de 91 en Windows), así que agrandarlo no añade nada.
    const capacidadBase = colaCap > 0 ? capacidad.recibido : null;
    const tamRelleno = capacidadBase === null
      ? TAM_RELLENO_MIN
      : Math.max(TAM_RELLENO_MIN,
          Math.ceil(Math.min(capacidadBase * MARGEN_CAPACIDAD + MARGEN_FIJO, TECHO_CAPACIDAD) / RATIO_BYTES_POR_RELLENO));

    // ── 2) El caso fabricado, con el tamaño DERIVADO de lo medido, no de un número elegido. ────
    const hijo = path.join(dir, 'hijo-908c.mjs');
    fs.writeFileSync(hijo, cuerpoDelHijo(tamRelleno));
    const rutaSuelo = path.join(dir, 'suelo.bin');
    const fd = fs.openSync(rutaSuelo, 'w');
    try { await correrAFichero(hijo, fd, path.join(dir, 'marca-suelo.json')); } finally { fs.closeSync(fd); }
    const suelo = trocear(fs.readFileSync(rutaSuelo));
    const sinArreglo = await correrConPadreParado(hijo, path.join(dir, 'marca-sin.json'));
    // 🔴 ROJO A PROPÓSITO (SCRUM-908c, A23 nº 8): sin el `--import`, para comprobar en el CI de
    // Linux que la recalibración por CAPACIDAD SÍ distingue roto de arreglado antes de creérsela.
    // Se restaura en el commit siguiente si SIN ARREGLO sale verde y CON ARREGLO sale rojo aquí.
    const conArreglo = await correrConPadreParado(hijo, path.join(dir, 'marca-con.json') /* , ['--import', PRELOAD] */);
    // POBLACIÓN (A3): qué se midió y sobre cuántos mensajes.
    console.log(`# SCRUM-908c · node=${process.version} pausa=${PAUSA_MS}ms tamRelleno=${tamRelleno} `
      + `capacidadBase=${capacidadBase}`);
    console.log(`# CAPACIDAD    escrito=${capacidad.medido?.escrito ?? 0} cola-al-parar=${colaCap} `
      + `recibido=${capacidad.recibido} salioDuranteLaPausa=${capacidad.salioDuranteLaPausa}`);
    console.log(`# SUELO        ${resumen(suelo)}`);
    console.log(`# SIN ARREGLO  ${resumen(sinArreglo)}`);
    console.log(`# CON ARREGLO  ${resumen(conArreglo)}`);
    return { suelo, sinArreglo, conArreglo, capacidad, capacidadBase, tamRelleno };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})();

test('SCRUM-908c · 🔴 CAPACIDAD: mide el techo real del transporte en ESTA máquina, sin asumir un número', async () => {
  const { capacidad, capacidadBase, tamRelleno } = await medir;
  assert.ok(capacidad.medido, `🔴 CIEGO: el hijo de la sonda de CAPACIDAD no dejó su marca. stderr=${capacidad.stderr}`);
  assert.ok(capacidad.recibido <= capacidad.medido.escrito,
    `🔴 CIEGO: llegaron más bytes (${capacidad.recibido}) de los que el hijo escribió `
    + `(${capacidad.medido.escrito}); la sonda no es de fiar.`);
  assert.ok(capacidad.medido.escrito > 0, '🔴 CIEGO: la sonda no llegó a escribir nada.');
  console.log(`# SCRUM-908c · CAPACIDAD medida: escrito=${capacidad.medido.escrito} `
    + `cola-al-parar=${capacidad.medido.cola} recibido=${capacidad.recibido} → `
    + `capacidadBase=${capacidadBase} tamRelleno=${tamRelleno}`);
});

test('SCRUM-908c · 🔴 SUELO: el hijo fabricado emite sus 5 veredictos, y el caso cae donde debe', async () => {
  const { suelo, capacidadBase, tamRelleno } = await medir;
  assert.equal(suelo.sobrante, 0, `🔴 CIEGO: el fichero del SUELO acaba a medio mensaje. ${resumen(suelo)}`);
  assert.deepEqual([...llegados(suelo)].sort(), [...TODOS].sort(),
    `🔴 CIEGO: el hijo no emite sus 5 veredictos ni escribiendo a fichero. ${resumen(suelo)}`);
  // El borde del caso, sobre los bytes REALES y la capacidad MEDIDA (no supuestos):
  const off = offsetDe(suelo, NOMBRADO);
  if (capacidadBase !== null) {
    assert.ok(off > capacidadBase,
      `🔴 caso mal calibrado: el NOMBRADO empieza en el byte ${off}, dentro de la capacidad MEDIDA `
      + `en esta máquina (${capacidadBase} bytes). Así no se puede perder, y el brazo SIN ARREGLO no `
      + `mediría nada. tamRelleno=${tamRelleno}`);
  } else {
    // No se pudo medir un techo finito aquí (la sonda de CAPACIDAD llegó a su techo sin ver
    // cola): no hay número contra el que comparar `off`, y no lo hay porque en esta máquina el
    // mecanismo no se puede exercitar por escritura síncrona (Windows). Se declara, no se finge.
    console.log(`# SCRUM-908c · SUELO: sin techo finito medible en esta máquina; off=${off} sin comparar`);
  }
  assert.ok(suelo.bytes < TECHO_CAPACIDAD * 4,
    `🔴 caso desbocado: el hijo escribe ${suelo.bytes} bytes, muy por encima del techo de sondeo `
    + `(${TECHO_CAPACIDAD}). Revisar la fórmula de tamRelleno. capacidadBase=${capacidadBase}`);
});

test('SCRUM-908c · 🔴 SIN ARREGLO: la LEY depende de la cola que el propio hijo mide al salir, no de una capacidad supuesta', async () => {
  const { sinArreglo: r } = await medir;
  assert.ok(r.bytes > 0, `🔴 CIEGO: por la tubería no llegó nada. ${resumen(r)} stderr=${r.stderr}`);
  // ⚠️ NO se exige `salioDuranteLaPausa`: en Windows la escritura es SÍNCRONA, así que el hijo se
  // queda bloqueado dentro de la pausa (no llega a salir hasta que el padre empieza a leer, ya
  // fuera de ella) y aun así no pierde nada — es el comportamiento CORRECTO de esa plataforma
  // (SCRUM-908/908b: 0 de 91 en Windows), no un caso sin ejercitar. La marca de salida del propio
  // hijo (`colaAlSalir`) es fiable exista o no `salioDuranteLaPausa`: se escribe en su
  // `process.on('exit')`, cuando quiera que ese `exit` ocurra.
  assert.ok(r.colaAlSalir !== null, `🔴 CIEGO: el hijo no dejó su marca de salida. ${resumen(r)} stderr=${r.stderr}`);
  const vistos = llegados(r);
  if (r.colaAlSalir > 0) {
    // El propio hijo midió, en su `process.on('exit')`, que su Writable seguía con datos sin
    // vaciar. `process.exit()` los trunca: el NOMBRADO y la COLA tienen que faltar.
    assert.equal(vistos.has(NOMBRADO), false,
      `🔴 el hijo salió con ${r.colaAlSalir} bytes pendientes en su propio Writable y aun así llegó `
      + `el NOMBRADO: la causa de SCRUM-908 no es ésta. ${resumen(r)}`);
    for (const c of COLA) {
      assert.equal(vistos.has(c), false, `🔴 llegó ${c} detrás de un NOMBRADO perdido (cola=${r.colaAlSalir}). ${resumen(r)}`);
    }
  } else {
    // El propio hijo midió cola === 0: no quedaba nada pendiente al salir, así que tiene que
    // haber llegado todo (Windows: escritura síncrona, cola siempre 0).
    assert.deepEqual([...vistos].sort(), [...TODOS].sort(),
      `🔴 el hijo salió con cola=0 según su propia medición y aun así se perdió algo. ${resumen(r)}`);
    assert.equal(r.sobrante, 0, `🔴 la tubería acabó a medio mensaje. ${resumen(r)}`);
  }
});

test('SCRUM-908c · ✅ CON ARREGLO: stdout bloqueante en el hijo, la cola al salir es SIEMPRE 0 y llega TODO', async () => {
  const { conArreglo: r } = await medir;
  // ⚠️ Igual que en SIN ARREGLO: no se exige `salioDuranteLaPausa` (ver el comentario de allí).
  assert.ok(r.colaAlSalir !== null, `🔴 CIEGO: el hijo no dejó su marca de salida. ${resumen(r)} stderr=${r.stderr}`);
  assert.equal(r.colaAlSalir, 0,
    `🔴 con stdout bloqueante el hijo salió con ${r.colaAlSalir} bytes aún pendientes: el arreglo no `
    + `impidió la salida con cola (o el --import no llegó). ${resumen(r)} stderr=${r.stderr}`);
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
    const env = entornoBase({});
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
