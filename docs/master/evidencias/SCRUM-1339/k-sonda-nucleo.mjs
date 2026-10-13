// docs/master/evidencias/SCRUM-1339/k-sonda-nucleo.mjs — SCRUM-1339k · se carga con `--import`.
//
// Sólo actúa DENTRO del proceso hijo de un fichero de test (`NODE_TEST_CONTEXT` puesto).
//
// ⚠️ ESTO ES UN MODELO, NO LINUX. En Windows node cambia la escritura de la salida estándar por
// una síncrona (`lib/net.js`: `this._write = makeSyncWrite(fd)`), y por eso aquí nunca queda nada
// pendiente al salir. Esta sonda devuelve a la salida del hijo las DOS cosas que en Linux sí tiene:
//   · la marca de agua de Linux (`K_MARCA`, 65.536 por defecto; en Windows node pone 16.384), y
//   · una escritura que puede NO caber: un «núcleo» FABRICADO que admite `K_CAP` bytes y que el
//     padre vacía a `K_RITMO` bytes por milisegundo. Lo que no cabe espera a la siguiente vuelta
//     del bucle de eventos (como espera libuv a que el descriptor vuelva a admitir escritura), y
//     si el proceso sale antes, NO SE ENTREGA.
// Todo lo demás es node de verdad: el corredor de tests, el flujo, `pipe`, la pausa y `process.exit()`.
// El núcleo es inventado y sus dos parámetros no están medidos en ningún runner: se barren.
//
//   K_MODELO=1        activa el núcleo fabricado
//   K_ATASCO=<N>      en vez de ritmo: el núcleo deja de admitir cuando el hijo lleva N bytes
//                     ENTREGADOS, y vuelve a admitir a los K_SUELTA ms (por defecto nunca)
//   K_TRAS_GORDO=<x>  el peor caso, puesto a mano: tras ENTREGAR entero cada mensaje de 65.536 B o
//                     más, el núcleo admite x bytes y deja de admitir durante K_SUELTA ms
//   K_TESTIGO=<fich>  al salir apunta lo entregado, lo perdido y la traza de escrituras
import fs from 'node:fs';

if (process.env.NODE_TEST_CONTEXT && (process.env.K_MODELO || process.env.K_TESTIGO)) {
  const so = process.stdout;
  const MODELO = process.env.K_MODELO === '1';
  const MARCA = Number(process.env.K_MARCA || 65536);
  const CAP = Number(process.env.K_CAP || 65536);
  const RITMO = Number(process.env.K_RITMO || 0);
  const ATASCO = process.env.K_ATASCO === undefined ? null : Number(process.env.K_ATASCO);
  const SUELTA = process.env.K_SUELTA === undefined ? Infinity : Number(process.env.K_SUELTA);
  const TRAS_GORDO = process.env.K_TRAS_GORDO === undefined ? null : Number(process.env.K_TRAS_GORDO);
  let gracia = Infinity; let atascos = 0;
  const traza = []; // [bytes del trozo, pendiente en el flujo al entrar, 1 si cupo entero al momento, vueltas del bucle]
  let entregados = 0; let pedidos = 0; let vueltas = 0; let pausas = 0; let atascadoDesde = null;
  let ocupado = 0; let reloj = performance.now();
  // Cuenta vueltas del bucle de eventos sin mantenerlo vivo.
  (function gira() { setImmediate(() => { vueltas += 1; gira(); }).unref(); })();

  const entregar = (b) => { let i = 0; while (i < b.length) i += fs.writeSync(1, b, i, b.length - i); entregados += b.length; };
  const libre = () => {
    if (TRAS_GORDO !== null) {
      if (gracia > 0) return gracia;
      if (atascadoDesde === null) { atascadoDesde = performance.now(); atascos += 1; }
      if (performance.now() - atascadoDesde < SUELTA) return 0;
      atascadoDesde = null; gracia = Infinity; return gracia;
    }
    if (ATASCO !== null) {
      if (entregados < ATASCO) return ATASCO - entregados;
      if (atascadoDesde === null) atascadoDesde = performance.now();
      return performance.now() - atascadoDesde >= SUELTA ? Infinity : 0;
    }
    const ahora = performance.now();
    ocupado = Math.max(0, ocupado - (ahora - reloj) * RITMO); reloj = ahora;
    return Math.floor(CAP - ocupado);
  };
  let enVuelo = null;
  const intenta = () => {
    const n = Math.min(libre(), enVuelo.b.length);
    if (n > 0) { entregar(enVuelo.b.subarray(0, n)); ocupado += n; if (gracia !== Infinity) gracia -= n; enVuelo.b = enVuelo.b.subarray(n); }
    if (TRAS_GORDO !== null && enVuelo.b.length === 0 && enVuelo.total >= 65536) gracia = TRAS_GORDO;
    return enVuelo.b.length === 0;
  };
  const espera = () => setImmediate(() => {
    if (!enVuelo) return;
    if (intenta()) { const { cb } = enVuelo; enVuelo = null; cb(); } else espera();
  });

  if (MODELO) {
    so._writableState.highWaterMark = MARCA;
    so._writev = null;
    so._write = (trozo, cod, cb) => {
      const b = Buffer.isBuffer(trozo) ? trozo : Buffer.from(trozo, cod);
      enVuelo = { b, cb, total: b.length };
      const cupo = intenta();
      traza.push([b.length, so.writableLength, cupo ? 1 : 0, vueltas]);
      if (cupo) { enVuelo = null; cb(); } else espera();
    };
    const escribir = so.write.bind(so);
    so.write = (trozo, ...r) => {
      pedidos += Buffer.isBuffer(trozo) ? trozo.length : Buffer.byteLength(String(trozo));
      const ret = escribir(trozo, ...r); if (ret === false) pausas += 1; return ret;
    };
  } else {
    const escribir = so.write.bind(so);
    so.write = (trozo, ...r) => {
      const n = Buffer.isBuffer(trozo) ? trozo.length : Buffer.byteLength(String(trozo));
      pedidos += n; entregados += n;
      traza.push([n, so.writableLength, 1, vueltas]);
      return escribir(trozo, ...r);
    };
  }
  if (process.env.K_TESTIGO) {
    process.on('exit', (codigo) => {
      try {
        fs.appendFileSync(process.env.K_TESTIGO, JSON.stringify({
          pid: process.pid, codigo, modelo: MODELO, marca: so.writableHighWaterMark, cap: CAP, ritmo: RITMO, atasco: ATASCO,
          pedidos, entregados, perdidos: pedidos - entregados, pendienteEnElFlujo: so.writableLength,
          pausas, atascos, vueltas, escrituras: traza.length, traza,
        }) + '\n');
      } catch { /* un testigo que no se escribe se ve en el recuento de líneas */ }
    });
  }
}
