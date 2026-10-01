// sonda-proceso.mjs — SCRUM-1328 · se carga con `--import` desde NODE_OPTIONS en TODO proceso node
// que herede el entorno. Apunta dos lineas en SONDA_1328_LOG: una al arrancar (quien es, con que
// marca y con que opciones) y otra al salir (si llego a cargar el arnes de node:test).
//
// El proceso que carga el arnes SIN la marca de hijo de la tanda (NODE_TEST_CONTEXT) y CON un destino
// de reporter heredado por NODE_OPTIONS es el que abre ese destino truncandolo.
//
// No cambia nada del proceso: solo escucha `exit`. Si no puede escribir, calla.
import fs from 'node:fs';

const log = process.env.SONDA_1328_LOG;
if (log) {
  const ctx = process.env.NODE_TEST_CONTEXT || null;
  const destinoHeredado = /--test-reporter-destination=(?!stdout|stderr)/.test(process.env.NODE_OPTIONS || '');
  const quien = () => ({
    pid: process.pid, ppid: process.ppid, ctx, destinoHeredado,
    argv: process.argv.slice(1, 6).map((a) => String(a).slice(-90)),
    execArgv: process.execArgv.slice(0, 6),
  });
  const apuntar = (o) => { try { fs.appendFileSync(log, JSON.stringify(o) + '\n'); } catch { /* la sonda no rompe al sujeto */ } };
  apuntar({ fase: 'arranque', ...quien() });
  process.on('exit', (codigo) => {
    const mods = process.moduleLoadList || [];
    apuntar({
      fase: 'salida', codigo, ...quien(),
      arnes: mods.some((m) => m.endsWith('internal/test_runner/harness')),
      corredor: mods.some((m) => m.endsWith('internal/test_runner/runner')),
    });
  });
}
