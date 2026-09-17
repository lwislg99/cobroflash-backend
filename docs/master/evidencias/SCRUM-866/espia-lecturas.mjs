// Espía de lecturas: apunta QUÉ ficheros lee el proceso mientras corre el test.
//
// Hace falta porque media casa son guards ESTÁTICOS: no ejecutan el fichero que mutan, lo leen
// como texto y asertan sobre él. Para ésos la cobertura no dice nada —y un «no cubierto» se leería
// como «el test no pasa por ahí», que es exactamente el error que este ticket persigue.
import fs from 'node:fs';
import path from 'node:path';

const DEST = process.env.ESPIA_DEST;
const RAIZ = process.cwd();

const apunta = (p) => {
  try {
    if (!DEST || typeof p !== 'string') return;
    fs.appendFileSync(DEST, path.relative(RAIZ, path.resolve(p)).replace(/\\/g, '/') + '\n');
  } catch { /* el espía nunca puede tumbar la medición */ }
};

for (const nombre of ['readFileSync', 'openSync', 'createReadStream']) {
  const orig = fs[nombre];
  if (typeof orig !== 'function') continue;
  fs[nombre] = function (p, ...resto) { apunta(p); return orig.call(this, p, ...resto); };
}
const origLeer = fs.promises.readFile;
fs.promises.readFile = function (p, ...resto) { apunta(p); return origLeer.call(this, p, ...resto); };
