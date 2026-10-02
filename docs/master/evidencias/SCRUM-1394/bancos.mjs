// ESTRATO FIRME: las carpetas de evidencias que llevan un BANCO de mutación en git.
// Para cada una: ¿el banco trae sus mutaciones escritas DENTRO (lista propia) o las toma del test
// (`MUTACIONES_QUE_ME_TUMBAN`, o sea, del catálogo)? ¿Y los tests del ticket están en el catálogo?
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.resolve(process.argv[2]);
const m = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs')).href);
const catalogo = new Map(m.censoDeDeclaraciones().map((c) => [c.guard, c.mutaciones.length]));
const seguidos = execFileSync('git', ['ls-files', '-z'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean);
const tests = seguidos.filter((f) => /^tests\/[^/]+\.test\.mjs$/.test(f)).map((f) => path.basename(f));
const evid = seguidos.filter((f) => /^docs\/(master\/)?evidencias\//.test(f) && /mut/i.test(path.basename(f)));
const carpetas = new Map();
for (const f of evid) { const d = path.dirname(f); carpetas.set(d, [...(carpetas.get(d) || []), f]); }

let fuera = 0; let dentro = 0; let mixto = 0; let sinGuion = 0;
const filas = [];
console.log('BANCOS de mutación en git · ' + carpetas.size + ' carpetas · catálogo ' + catalogo.size + ' guards');
for (const [d, fich] of [...carpetas].sort()) {
  const n = (/scrum-?0*(\d+)/i.exec(d) || [])[1];
  const propios = tests.filter((t) => new RegExp('^scrum0*' + n + '[a-z]?-').test(t));
  const propiosEnCat = propios.filter((t) => catalogo.has(t));
  const guiones = fich.filter((f) => /\.mjs(\.txt)?$/.test(f));
  let listaPropia = 0; let usaCatalogo = false; const apunta = new Set();
  for (const g of guiones) {
    const t = fs.readFileSync(path.join(RAIZ, g), 'utf8');
    if (/MUTACIONES_QUE_ME_TUMBAN|censoDeDeclaraciones|mutacionesDeclaradas/.test(t)) usaCatalogo = true;
    // mutaciones escritas en el propio guion: entradas con `de:` y `a:` (o `busca`/`pon`, `antes`/`despues`).
    listaPropia += (t.match(/^\s*(?:\{\s*)?(?:de|busca|antes|quita|desde)\s*:/gm) || []).length;
    for (const x of t.match(/[\w.-]+\.test\.mjs/g) || []) if (tests.includes(x)) apunta.add(x);
  }
  const apuntaEnCat = [...apunta].filter((t) => catalogo.has(t));
  let clase;
  if (!guiones.length) { clase = 'SÓLO SALIDAS (sin guion en git)'; sinGuion += 1; }
  else if (usaCatalogo && !listaPropia) { clase = 'TOMA LAS DEL TEST (catálogo)'; dentro += 1; }
  else if (usaCatalogo) { clase = 'MIXTO (nombra el catálogo y además trae lista propia)'; mixto += 1; }
  else { clase = 'LISTA PROPIA, fuera del catálogo'; fuera += 1; }
  console.log('\n' + d + '\n   ' + clase + ' · entradas propias≈' + listaPropia
    + '\n   tests del ticket: ' + propios.length + ' (en el catálogo: ' + propiosEnCat.length + ')'
    + ' · tests a los que apunta el guion: ' + apunta.size + ' (en el catálogo: ' + apuntaEnCat.length + ')');
  filas.push({ d, clase, listaPropia, tocaCatalogo: propiosEnCat.length + apuntaEnCat.length > 0 });
}
console.log('\nRECUENTO sobre ' + carpetas.size + ' carpetas: lista propia fuera del catálogo ' + fuera + ' · toma las del test ' + dentro + ' · mixto ' + mixto + ' · sólo salidas ' + sinGuion);

// ── SCRUM-1394 · los de FUERA, por nombre, y lo que esa palabra NO dice ──────────────────────────
// «Fuera» es la rama por defecto: un guion que no nombra el catálogo. No es «le encontré una lista».
//   · sin entradas reconocidas: el patrón de arriba (`de:`, `busca:`, `antes:`…) no ve su lista —va por
//     `id:`, o en un JSON aparte—, así que de ese banco sólo se sabe que su guion no nombra el catálogo.
//   · algún test del ticket, o al que apunta el guion, SÍ está en el catálogo: sus mutaciones pueden
//     estar además declaradas allí. Si coinciden con las del banco NO se mide aquí.
const losDeFuera = filas.filter((x) => x.clase.startsWith('LISTA PROPIA'));
console.log('\nFUERA DEL CATÁLOGO, por nombre:');
for (const x of losDeFuera) {
  console.log('   ' + x.d + (x.listaPropia ? '' : ' · sin entradas reconocidas') + (x.tocaCatalogo ? ' · algún test suyo SÍ está en el catálogo' : ''));
}
// CONTROLES, juzgados: uno que sé FUERA tiene que salir nombrado, y uno que sé DENTRO no puede salir.
const CONTROLES = [
  { rotulo: 'CONTROL POSITIVO', d: 'docs/master/evidencias/scrum1326', fuera: true, porque: 'su guion trae 20 mutaciones escritas dentro y su test no declara ninguna' },
  { rotulo: 'CONTROL NEGATIVO', d: 'docs/master/evidencias/scrum1331', fuera: false, porque: 'su guion toma las mutaciones del test, que las declara' },
];
console.log('');
let ciego = false;
for (const c of CONTROLES) {
  const mirado = filas.some((x) => x.d === c.d);
  const sale = losDeFuera.some((x) => x.d === c.d);
  const vale = mirado && sale === c.fuera;
  if (!vale) ciego = true;
  console.log(c.rotulo + ' · ' + c.d + ' (' + c.porque + '): ' + (!mirado ? 'NO ESTÁ ENTRE LOS MIRADOS' : sale ? 'sale FUERA' : 'no sale fuera') + (vale ? '' : '   ← NO ES LO QUE SÉ DE ÉL'));
}
// La línea que sale SIEMPRE, también con cero.
const firmes = losDeFuera.filter((x) => x.listaPropia && !x.tocaCatalogo).length;
console.log('\n' + carpetas.size + ' bancos mirados · ' + losDeFuera.length + ' fuera del catálogo   (población: ' + evid.length + ' ficheros de evidencias con «mut» en el nombre, en ' + carpetas.size
  + ' carpetas · catálogo: ' + catalogo.size + ' guards, ' + [...catalogo.values()].reduce((a, b) => a + b, 0) + ' declaraciones · de los ' + losDeFuera.length + ': ' + firmes
  + ' con lista reconocida y ningún test suyo en el catálogo, ' + losDeFuera.filter((x) => !x.listaPropia).length + ' sin entradas reconocidas, ' + losDeFuera.filter((x) => x.tocaCatalogo).length + ' con algún test suyo en el catálogo)');
if (ciego) {
  console.log('CIEGO: un control ya no da lo que sé de él. Los números de arriba NO se leen hasta re-anclarlo.');
  process.exitCode = 2;
}
