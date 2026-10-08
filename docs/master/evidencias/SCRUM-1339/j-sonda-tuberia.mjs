// docs/master/evidencias/SCRUM-1339/j-sonda-tuberia.mjs — SCRUM-1339j · se carga con `--import`.
//
// Sólo actúa DENTRO del proceso hijo de un fichero de test (`NODE_TEST_CONTEXT` puesto). Hace dos
// cosas, según el entorno:
//   J_TUBERIA=no-bloqueante → pone la salida estándar del hijo NO bloqueante. En Linux ya lo es;
//       en Windows node la pone bloqueante (lib/net.js), y por eso aquí no se pierde nada. Es el
//       brazo inverso de la celda C de SCRUM-1405 (allí se puso bloqueante en Linux).
//   J_TESTIGO=<fichero>     → al salir, apunta cuánto se escribió y cuánto quedó SIN escribir.
import fs from 'node:fs';

if (process.env.NODE_TEST_CONTEXT) {
  let puesta = 'sin tocar';
  if (process.env.J_TUBERIA === 'no-bloqueante') {
    try {
      const r = process.stdout._handle?.setBlocking?.(false);
      puesta = `setBlocking(false) devolvió ${r}`;
    } catch (e) { puesta = `setBlocking lanzó ${e.message}`; }
  }
  // J_COLA=<N> → la COLA que no llega, fabricada: los últimos N bytes que el hijo escribe hacia el
  // padre no se entregan nunca. Sólo se activa cuando el hijo lleva escritos más de 100.000 B, para
  // que la pasada LIMPIA (42.535 B) llegue entera y el corte caiga sólo en las mutadas. No imita
  // CÓMO se pierde la cola en Linux: fija CUÁNTA se pierde, para ver qué dicta el instrumento.
  const COLA = Number(process.env.J_COLA || 0);
  if (COLA > 0) {
    const escribir = process.stdout.write.bind(process.stdout);
    let total = 0; let retenido = Buffer.alloc(0);
    process.stdout.write = (trozo, cod, cb) => {
      const b = Buffer.isBuffer(trozo) ? trozo : Buffer.from(trozo, typeof cod === 'string' ? cod : 'utf8');
      const hecho = typeof cod === 'function' ? cod : cb;
      total += b.length;
      if (total <= 100000) return escribir(b, hecho);
      retenido = Buffer.concat([retenido, b]);
      if (retenido.length <= COLA) { if (hecho) process.nextTick(hecho); return true; }
      const sale = retenido.subarray(0, retenido.length - COLA);
      retenido = Buffer.from(retenido.subarray(retenido.length - COLA));
      return escribir(sale, hecho);
    };
    puesta += ` · cola de ${COLA} B retenida`;
  }
  if (process.env.J_TESTIGO) {
    process.on('exit', (codigo) => {
      try {
        fs.appendFileSync(process.env.J_TESTIGO, JSON.stringify({
          pid: process.pid, codigo, puesta,
          escritos: process.stdout.bytesWritten,
          pendientes: process.stdout.writableLength,
          forceExit: process.execArgv.includes('--test-force-exit'),
        }) + '\n');
      } catch { /* un testigo que no se puede escribir se ve en el recuento de líneas */ }
    });
  }
}
