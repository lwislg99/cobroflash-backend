// Espía de medición (SCRUM-1396, J4). No cambia lo que devuelve mkdtempSync.
//  · anota cada mkdtempSync: «C <fichero:línea> <dir>» en ESPIA_LOG
//  · si ESPIA_ARMAR lleva ese fichero:línea, ARMA un fallo: la siguiente llamada a un método de
//    `assert` lanza un AssertionError de verdad (el test falla por un assert, no por un exit).
//    Anota «A …» al armar y «F …» al disparar.
const fs = require('node:fs');
const assert = require('node:assert');
const { syncBuiltinESMExports } = require('node:module');
const log = process.env.ESPIA_LOG;
if (log) {
  const armar = new Set((process.env.ESPIA_ARMAR || '').split(',').filter(Boolean));
  let armado = null;
  const anota = (l) => { try { fs.appendFileSync(log, l + '\n'); } catch { /* el espía no rompe al sujeto */ } };
  const orig = fs.mkdtempSync;
  fs.mkdtempSync = function (...a) {
    const dir = orig.apply(this, a);
    let quien = '?';
    try {
      const pila = new Error().stack.split('\n').slice(2);
      const marco = pila.find((l) => /tests[\\/]/.test(l)) || pila[0] || '';
      const m = /([^\\/()]+\.(?:mjs|js|cjs)):(\d+):\d+/.exec(marco);
      if (m) quien = `${m[1]}:${m[2]}`;
    } catch { /* sin pila */ }
    anota(`C\t${quien}\t${dir}`);
    if (armar.has(quien)) { armado = { quien, dir }; anota(`A\t${quien}\t${dir}`); }
    return dir;
  };
  if (armar.size) {
    const envolver = (obj) => {
      for (const k of Object.keys(obj)) {
        if (typeof obj[k] !== 'function' || k === 'AssertionError' || k === 'strict' || k === 'CallTracker' || k === 'Assert') continue;
        const f = obj[k];
        obj[k] = function (...a) {
          if (armado) {
            const x = armado; armado = null;
            anota(`F\t${x.quien}\t${x.dir}\tassert.${k}`);
            throw new assert.AssertionError({ message: `FALLO INYECTADO por la medición de SCRUM-1396 tras crear ${x.quien}` });
          }
          return f.apply(this, a);
        };
      }
    };
    envolver(assert);
    if (assert.strict && assert.strict !== assert) envolver(assert.strict);
  }
  syncBuiltinESMExports();
}
