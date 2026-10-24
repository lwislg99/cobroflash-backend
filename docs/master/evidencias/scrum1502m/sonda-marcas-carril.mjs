// node sonda-marcas.mjs <raiz> <fichero1> [fichero2...]
// Mismo camino que tests/scrum921c (marcasDe + noAfirma + respaldoDe), filtrado a unos ficheros.
// Lista TODAS las marcas que afirman en esos ficheros, con su nivel, y las negadas/citadas aparte.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [, , raiz, ...ficheros] = process.argv;
const imp = (p) => import(pathToFileURL(path.join(raiz, p)).href);
const { marcasDe } = await imp('tests/_procedencia-aprobacion.mjs');
const { indiceDeFuentes, respaldoDe } = await imp('tests/_respaldo-de-firma.mjs');
const { loQueSeLee } = await imp('tests/_cita-declarada.mjs');
const MARCA = /(?:aprobad|autorizad|firmad|validad|refrendad)[oa]s?\s+por\s+el\s+fundador|\bel\s+fundador\s+(?:lo\s+|la\s+|los\s+|las\s+|ya\s+|s[ií]\s+)*(?:decide|decidi[oó]|aprueba|aprob[oó]|autoriza|autoriz[oó]|firma|firm[oó]|valida|valid[oó])(?![A-Za-z0-9_áéíóúüñÁÉÍÓÚÜÑ])/i;
const EXCLUIR = /^tests\/(_procedencia-aprobacion|_respaldo-de-firma|_censo-firmas-autorizacion|_microcopy-aprobada|scrum387-|scrum921)/;
const FIN = '(?![A-Za-z0-9_áéíóúüñÁÉÍÓÚÜÑ])';
const NEGACION = new RegExp(`\\bNO\\s+(?:est[aá]n?|son|es|se|lo)${FIN}|NO\\s+es\\s+«|\\bning[uú]n[oa]?${FIN}|sin\\s+firmar|todav[ií]a\\s+no`, 'i');
const niega = (t) => t.split(/(?<=[.:;])\s|\n/).filter((f) => MARCA.test(f)).some((f) => NEGACION.test(f));
const marcas = marcasDe(raiz, { dirs: ['src', 'public', 'tests', 'scripts'], marca: MARCA, excluir: EXCLUIR, literalesTras: 45 });
const indice = indiceDeFuentes(raiz);
console.log('POBLACION: marcas en el arbol =', marcas.length);
const nivelGlobal = {};
for (const b of marcas) {
  const t = loQueSeLee(b.texto, b.fichero);
  let nivel;
  if (!MARCA.test(t)) nivel = 'citada';
  else if (niega(t)) nivel = 'negada';
  else nivel = respaldoDe({ ...b, texto: t }, indice).nivel;
  nivelGlobal[nivel] = (nivelGlobal[nivel] || 0) + 1;
  if (!ficheros.some((f) => b.fichero === f)) continue;
  const lineaMarca = t.split('\n').find((l) => MARCA.test(l)) ?? '';
  console.log(`${b.fichero}:${b.linea}\t${nivel}\t${lineaMarca.trim().slice(0, 150)}`);
}
console.log('NIVELES (arbol entero):', JSON.stringify(nivelGlobal));
for (const f of ficheros) console.log('marcas en', f, '=', marcas.filter((b) => b.fichero === f).length);
