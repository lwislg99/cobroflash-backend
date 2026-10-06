// docs/master/evidencias/SCRUM-1405/sonda.mjs — SCRUM-1405
//
// SONDA DE SALIDA. Se carga con `--import` (por NODE_OPTIONS) y sólo hace algo dentro del HIJO que
// `node --test` lanza por cada fichero (los que llevan NODE_TEST_CONTEXT) y sólo si SONDA_1405_DIR
// existe. No toca ningún fichero de test: mira desde fuera.
//
// Qué apunta, en el evento 'exit' del hijo (que salta también dentro de `process.exit()`):
//   pendientes  bytes que la salida estándar tiene aceptados y SIN ESCRIBIR en ese instante
//   cola        lo mismo, visto por libuv (writeQueueSize del handle)
//   escritos    bytes que han salido ya
//   recursos    qué mantiene vivo el bucle en ese instante (lo que el flag corta)
//
// SONDA_1405_BLOQUEANTE=1 hace además lo que node ya hace en Windows y no en Linux: poner la
// tubería de la salida estándar en modo bloqueante. Es el brazo que separa mecanismo de correlación.
//
// ⚠️ Una sonda cambia lo que mide (añade un oyente de 'exit' y un módulo que cargar). Por eso el
// contraste que decide se hace SIN ella, y ella va en un brazo aparte.
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.env.SONDA_1405_DIR;

if (DIR && process.env.NODE_TEST_CONTEXT) {
  const t0 = Date.now();
  let bloqueante = 'no pedido';
  if (process.env.SONDA_1405_BLOQUEANTE === '1') {
    try {
      const h = process.stdout._handle;
      if (h && typeof h.setBlocking === 'function') {
        const err = h.setBlocking(true);
        bloqueante = err ? `error ${err}` : 'puesto';
      } else {
        bloqueante = 'sin setBlocking';
      }
    } catch (e) {
      bloqueante = `excepción ${e.message}`;
    }
  }
  process.on('exit', (codigo) => {
    try {
      const so = process.stdout;
      const recursos = {};
      for (const r of process.getActiveResourcesInfo()) recursos[r] = (recursos[r] || 0) + 1;
      const fila = {
        fichero: path.basename(process.argv[1] || ''),
        pid: process.pid,
        codigo,
        forzado: process.execArgv.includes('--test-force-exit'),
        tipo: so._type ?? null,
        pendientes: so.writableLength,
        cola: so._handle?.writeQueueSize ?? null,
        escritos: so._handle?.bytesWritten ?? null,
        bloqueante,
        ms: Date.now() - t0,
        recursos,
      };
      fs.writeFileSync(path.join(DIR, `${process.pid}-${t0}.json`), JSON.stringify(fila) + '\n');
    } catch {
      // una sonda que no puede escribir no tumba al sujeto: su ausencia se cuenta al juntar
    }
  });
}
