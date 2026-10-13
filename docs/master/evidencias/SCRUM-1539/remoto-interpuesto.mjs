// docs/master/evidencias/SCRUM-1539/remoto-interpuesto.mjs — SCRUM-1539
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// ⛔ ESTO NO ES UN TEST NI TOCA EL REMOTO. Es una PRECARGA (`node --import <este fichero>`): se
// pone delante de `execFileSync` y decide qué CONTESTA `git ls-remote` dentro de ese proceso.
//
// Existe porque la avería de SCRUM-1539 es una CARRERA: `scrum804b` leía las ramas del remoto dos
// veces, y entre las dos alguien mergeaba el ticket elegido y el merge borraba su rama. Una carrera
// no se reproduce esperando a que vuelva a tocar: se FABRICA. Y fabricarla contra el remoto de
// verdad sería borrar una rama de otro, así que lo que se fabrica es la RESPUESTA.
//
// Tres modos, por la variable `REMOTO_INTERPUESTO` (un JSON):
//   · { modo: 'cronometro' }  no cambia nada: sólo apunta cuándo se lee el remoto.
//   · { modo: 'carrera' }     la 1ª lectura es la de verdad; de la 2ª en adelante se QUITAN las
//                             ramas del ticket más alto que la 1ª vio vivo. Es lo que hace un merge.
//   · { modo: 'fabricado', lecturas: ['…', '…'] }  ninguna lectura sale de la máquina: la n-ésima
//                             contesta `lecturas[n-1]` (y la última se repite).
//
// 🔴 EL TESTIGO NO ES OPCIONAL (A21). Sin `testigo` (la ruta de un fichero) la precarga LANZA: un
// sujeto que corrió sin la interposición puesta se lee igual que una carrera que no hace daño.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { appendFileSync } from 'node:fs';

const cp = createRequire(import.meta.url)('node:child_process');

const conf = JSON.parse(process.env.REMOTO_INTERPUESTO ?? 'null');
if (!conf || !['cronometro', 'carrera', 'fabricado'].includes(conf.modo) || !conf.testigo) {
  throw new Error('REMOTO_INTERPUESTO tiene que ser un JSON con `modo` (cronometro | carrera | fabricado) y `testigo`.');
}
if (conf.modo === 'fabricado' && !(Array.isArray(conf.lecturas) && conf.lecturas.length)) {
  throw new Error('REMOTO_INTERPUESTO en modo `fabricado` pide `lecturas`: al menos una.');
}

const apunta = (o) => appendFileSync(conf.testigo, `${JSON.stringify(o)}\n`);
const NUMERO_DE_RAMA = /^refs\/heads\/scrum-(\d+)(?:[a-z]\d*)?(?:-|$)/;

const deVerdad = cp.execFileSync;
let lecturas = 0;
/** sha → ref, de la 1ª lectura; y los sha que `merge-base --is-ancestor` dio por NO mergeados. */
const refDe = new Map();
const vivos = [];
let finDeLaPrimera = null;

function numeroDe(ref) {
  const m = NUMERO_DE_RAMA.exec(ref ?? '');
  return m ? Number(m[1]) : null;
}

cp.execFileSync = function execFileSyncInterpuesto(orden, args, ...resto) {
  const esGit = orden === 'git' && Array.isArray(args);

  if (esGit && args[0] === 'ls-remote') {
    lecturas += 1;
    const empieza = Date.now();
    let salida = conf.modo === 'fabricado'
      ? conf.lecturas[Math.min(lecturas, conf.lecturas.length) - 1]
      : deVerdad.call(this, orden, args, ...resto);
    const acaba = Date.now();
    const anota = { que: 'ls-remote', n: lecturas, empieza, acaba, lineas: salida.split('\n').filter(Boolean).length };

    if (lecturas === 1) {
      finDeLaPrimera = acaba;
      for (const l of salida.split('\n')) {
        const [sha, ref] = l.split(/\s+/);
        if (sha && ref) refDe.set(sha, ref);
      }
    } else {
      anota.msDesdeLaPrimera = empieza - finDeLaPrimera;
      if (conf.modo === 'carrera') {
        const numeros = vivos.map((sha) => numeroDe(refDe.get(sha))).filter((n) => n !== null);
        const elegido = numeros.length ? Math.max(...numeros) : null;
        const antes = salida.split('\n');
        const despues = antes.filter((l) => numeroDe(l.split(/\s+/)[1]) !== elegido);
        anota.elegido = elegido;
        anota.quitadas = antes.filter((l) => !despues.includes(l)).map((l) => l.split(/\s+/)[1]);
        salida = despues.join('\n');
      }
    }
    apunta(anota);
    return salida;
  }

  // Sólo durante la ventana: lo que el test da por «rama viva» es lo que aquí LANZA.
  if (esGit && args[0] === 'merge-base' && lecturas === 1) {
    try {
      return deVerdad.call(this, orden, args, ...resto);
    } catch (e) {
      vivos.push(args[2]);
      throw e;
    }
  }
  return deVerdad.call(this, orden, args, ...resto);
};
syncBuiltinESMExports();

process.on('exit', (codigo) => apunta({ que: 'fin', lecturas, vivos: vivos.length, codigo }));
