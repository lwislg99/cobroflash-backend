// CENSO · ¿cuántos tickets AFIRMAN mutaciones en su registro y no tienen ninguna en el catálogo
// que el meta-guard corre en CI?
//
// El catálogo no se reescribe: sale de `censoDeDeclaraciones()` del propio meta-guard.
// Lo que es heurístico se dice: la «afirmación» se lee del TEXTO del registro.
//
// USO: node censo.mjs <raíz> [--lista]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.resolve(process.argv[2]);
const LISTA = process.argv.includes('--lista');
const m = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs')).href);
const catalogo = new Map(m.censoDeDeclaraciones().map((c) => [c.guard, c.mutaciones.length]));
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 28 });
const seguidos = git('ls-files', '-z').split('\0').filter(Boolean);
const tests = new Set(seguidos.filter((f) => /^tests\/[^/]+\.test\.mjs$/.test(f)).map((f) => path.basename(f)));
const registros = seguidos.filter((f) => /^docs\/master\/SCRUM-\d+\.md$/.test(f));

// Una AFIRMACIÓN de mutaciones: una línea que habla de mutar Y trae una cuenta («6 de 6», «14 mutaciones»,
// «3 mutantes») o un resultado («caen», «vivas», «mueren», «mata»).
const HABLA = /mutaci[oó]n|mutaciones|mutante/i;
const CUENTA = /\b\d+\s+de\s+\d+\b|\b\d+\s+(?:mutaci|mutante)|(?:mutaci\w+|mutantes?)\D{0,25}\b\d+\b/i;
const RESULTADO = /\b(?:caen?|cae|cay[oó]|vivas?|muere[n]?|muri[oó]|mata[n]?|matad[oa]s?|rojo)\b/i;

// La fecha en que nació el catálogo: un ticket anterior no pudo declarar en él.
const nacio = git('log', '--diff-filter=A', '--format=%cI', '--', 'scripts/meta-guard-mutaciones.mjs').trim().split('\n').pop();
const fechaDe = (f) => git('log', '--diff-filter=A', '--format=%cI', '--', f).trim().split('\n').pop() || '';

const filas = [];
for (const f of registros) {
  const n = /SCRUM-(\d+)\.md$/.exec(f)[1];
  const texto = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  const lineas = texto.split(/\r?\n/);
  const afirma = lineas.filter((l) => HABLA.test(l) && (CUENTA.test(l) || RESULTADO.test(l)));
  if (!afirma.length) continue;
  // Sus tests PROPIOS: por el número del ticket, anclado al nombre (un prefijo no es un nombre).
  const propios = [...tests].filter((t) => new RegExp('^scrum0*' + n + '[a-z]?-').test(t));
  const nombrados = [...new Set((texto.match(/[\w.-]+\.test\.mjs/g) || []))].filter((t) => tests.has(t));
  const enCat = (l) => l.filter((t) => catalogo.has(t));
  let clase;
  if (enCat(propios).length) clase = 'A · test propio EN el catálogo';
  else if (propios.length) clase = 'B · tiene test propio y NINGUNO está en el catálogo';
  else if (enCat(nombrados).length) clase = 'C1 · sin test propio; nombra alguno que SÍ está';
  else if (nombrados.length) clase = 'C2 · sin test propio; nombra tests y NINGUNO está';
  else clase = 'C3 · sin test propio y sin nombrar ninguno';
  filas.push({ n: Number(n), f, clase, propios, nombrados, afirma, fecha: fechaDe(f) });
}

console.log('CENSO mutaciones-fuera-del-catálogo · raíz ' + RAIZ + ' @ ' + git('rev-parse', 'HEAD').trim());
console.log('CATÁLOGO: ' + catalogo.size + ' guards · ' + [...catalogo.values()].reduce((a, b) => a + b, 0) + ' declaraciones · nació el ' + nacio);
console.log('POBLACIÓN: ' + registros.length + ' registros · ' + filas.length + ' AFIRMAN mutaciones (línea con «mutar» + cuenta o resultado) · tests seguidos ' + tests.size);
const porClase = new Map();
for (const x of filas) porClase.set(x.clase, [...(porClase.get(x.clase) || []), x]);
for (const [c, xs] of [...porClase].sort()) {
  const tras = xs.filter((x) => x.fecha >= nacio).length;
  console.log('\n' + c + ': ' + xs.length + '  (registro nacido DESPUÉS del catálogo: ' + tras + ')');
  if (LISTA && !c.startsWith('A')) {
    for (const x of xs.sort((a, b) => a.n - b.n)) {
      console.log('   SCRUM-' + x.n + ' · ' + x.fecha.slice(0, 10) + ' · propios=[' + x.propios.join(', ') + ']' + (x.propios.length ? '' : ' · nombrados=' + x.nombrados.length));
      console.log('      «' + x.afirma[0].trim().slice(0, 230) + '»' + (x.afirma.length > 1 ? '  (+' + (x.afirma.length - 1) + ' líneas)' : ''));
    }
  }
}
// CONTROLES: dos casos de los que sé la respuesta, y aquí se JUZGAN. Los que traía este censo sólo se
// imprimían, y ninguno de los dos valía (SCRUM-1394): el positivo caducó cuando `scrum976` empezó a
// declarar, y el negativo decía «su test declara» de un test que no declara nada.
// Los dos pueden caducar, y que caduquen es el aviso: entonces el censo sale CIEGO (2), no verde.
const de = (n) => filas.find((x) => x.n === n);
const CONTROLES = [
  { rotulo: 'CONTROL POSITIVO', n: 1327, espera: 'B', porque: 'sé que está FUERA: tiene test propio, `scrum1327-el-veredicto-no-se-decide-a-mano.test.mjs`, y ese test no declara ninguna mutación' },
  { rotulo: 'CONTROL NEGATIVO', n: 1336, espera: 'A', porque: 'sé que está DENTRO: su test propio, `scrum1336-un-ciego-no-se-pinta-de-hallazgo.test.mjs`, declara las suyas' },
];
console.log('');
let ciego = false;
for (const c of CONTROLES) {
  const sale = de(c.n) ? de(c.n).clase : 'NO SALE EN EL CENSO';
  const vale = sale.startsWith(c.espera + ' ');
  if (!vale) ciego = true;
  console.log(c.rotulo + ' · SCRUM-' + c.n + ' (' + c.porque + '): ' + sale + (vale ? '' : '   ← ESPERABA ' + c.espera));
}
if (ciego) {
  console.log('\nCIEGO: un control ya no da lo que sé de él. O el mundo se movió o el censo no ve: sus números de arriba NO se leen hasta re-anclarlo.');
  process.exitCode = 2;
}
