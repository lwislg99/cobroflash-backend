// scripts/tuberia-bloqueante.mjs — SCRUM-1405c · la salida C de SCRUM-1405
//
// Autorización: SCRUM-1405 c.19584, el fundador, 14-oct-2026: «Ok la C». Autoriza conservar
// `--test-force-exit` y poner BLOQUEANTE la tubería de salida de cada hijo. NO autoriza la A
// (quitar el flag) ni la B.
//
// ── QUÉ ARREGLA ─────────────────────────────────────────────────────────────────────────────
// Con `--test-force-exit`, el hijo que `node --test` lanza por cada fichero hace `process.exit()`
// en cuanto acaba su último test, con bytes de su informe todavía SIN ESCRIBIR en la tubería hacia
// el corredor. En Linux esa tubería no es bloqueante (node sólo la pone bloqueante en Windows), y lo
// encolado se tira: se pierden los nombres de los casos de la cola (medido en
// docs/master/SCRUM-1405.md: 13 de 16 tandas pierden con el flag; con la tubería bloqueante, 0 de 12).
// Este módulo hace en todas partes lo que node ya hace en Windows.
//
// ── CÓMO SE CARGA, Y A QUIÉN LE LLEGA (el alcance, declarado) ───────────────────────────────
// Va en el script `test` de package.json como `--import=./scripts/tuberia-bloqueante.mjs`, detrás de
// `--test`. Lo cargan: el proceso `node --test` (el corredor) y CADA hijo que lanza por fichero,
// porque el corredor les pasa su `execArgv`. NO les llega a los procesos que un test lance por su
// cuenta (no heredan `execArgv`), ni al envoltorio `tanda-con-veredicto.mjs`, ni a `npm run build`.
// tests/scrum1405c-tuberia-bloqueante.test.mjs mide las dos mitades de esa frase.
//
// ── 🔴 POR QUÉ GRITA EN VEZ DE CALLARSE ─────────────────────────────────────────────────────
// `process.stdout._handle.setBlocking` es una pieza INTERNA de node: puede cambiar de nombre o
// desaparecer sin aviso. Si un día no está, la tubería vuelve a no bloquear y la pérdida vuelve, y
// el síntoma es silencioso por definición: casos que corrieron y cuyo nombre no llega. Por eso:
//   · si la salida estándar es una tubería (lo dice `fstatSync`, que es API PÚBLICA y no depende de
//     la pieza interna) y no se puede poner bloqueante, el módulo LANZA al cargarse. El proceso no
//     arranca, el fichero sale en rojo con este mensaje, y la tanda también.
//   · si la salida es un fichero o un terminal, no hace nada: ahí node ya escribe síncrono.
// Un instrumento cuyo error cae del lado de «todo bien» es peor que no tenerlo (c.19584).
import fs from 'node:fs';
import net from 'node:net';
import { isMainThread } from 'node:worker_threads';

export const MARCA = Symbol.for('yaqu.scrum1405c.tuberiaBloqueante');

/** Qué es la salida, por API PÚBLICA y por dos vías que no dependen de la pieza interna:
 *  · el descriptor (`fstatSync`): una tubería anónima es FIFO; la de `spawn` en POSIX es un par de
 *    sockets. En Windows `fstat` de una tubería no dice nada (medido: los cuatro `is*` en false);
 *  · el objeto: node da un `net.Socket` para una tubería o un terminal, y un escritor síncrono para
 *    un fichero. Un `net.Socket` que no es terminal es una tubería. */
export function tipoDeSalida(stream = process.stdout, fd = 1) {
  if (stream?.isTTY) return 'terminal';
  let st = null;
  try { st = fs.fstatSync(fd); } catch { /* sin descriptor legible: decide el objeto */ }
  if (st && (st.isFIFO() || st.isSocket())) return 'tuberia';
  if (stream instanceof net.Socket) return 'tuberia';
  if (st?.isFile()) return 'fichero';
  if (st?.isCharacterDevice()) return 'terminal';
  return st ? 'otro' : 'desconocido';
}

/** Pone bloqueante `stream` si es una tubería. Devuelve qué hizo; LANZA si es una tubería y no
 *  puede. */
export function bloquearSalida(stream = process.stdout, fd = 1) {
  const tipo = tipoDeSalida(stream, fd);
  if (tipo !== 'tuberia') return { tipo, puesto: false };
  const h = stream?._handle;
  if (!h || typeof h.setBlocking !== 'function') {
    throw new Error(
      '🔴 SCRUM-1405c · la salida estándar es una tubería y este node ya no ofrece '
      + '`process.stdout._handle.setBlocking` (pieza interna). Sin ella, con --test-force-exit se '
      + 'vuelven a perder EN SILENCIO los informes de la cola de cada fichero. No se sigue: revisa '
      + 'scripts/tuberia-bloqueante.mjs contra el node instalado (' + process.version + ') y '
      + 'docs/master/SCRUM-1405.md, salida C.');
  }
  const err = h.setBlocking(true);
  if (err) {
    throw new Error(
      `🔴 SCRUM-1405c · setBlocking(true) sobre la tubería de salida devolvió el error ${err} `
      + `(node ${process.version}). La tubería NO es bloqueante y los informes de la cola se pueden `
      + 'perder en silencio. No se sigue.');
  }
  return { tipo, puesto: true };
}

// Sólo el hilo principal: en un worker `process.stdout` es otro objeto, sin `_handle`, y el fd 1
// es el del proceso, que ya lo ha bloqueado el hilo principal.
if (isMainThread && !globalThis[MARCA]) {
  globalThis[MARCA] = bloquearSalida();
}
