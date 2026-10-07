// docs/master/evidencias/scrum1502/lista.mjs — SCRUM-1502
//
// LA LISTA DE LAS CONGELADAS, CON SU TEXTO. NO ES UN CENSO: la lista la da `congeladas()`, que es
// el mismo camino que decide si el árbol pasa. Este guion sólo le pone al lado, a cada
// `fichero:línea`, el comentario y los literales que el lector de la casa (`marcasDe`) ve debajo.
//
// Uso:  node docs/master/evidencias/scrum1502/lista.mjs <salida.json>
//
// Control: cada `fichero:línea` de `congeladas()` tiene que encontrarse entre los bloques de
// `marcasDe`, o el guion sale con código 2 sin escribir nada.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const desde = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);

const guard = await desde('tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs');
const { marcasDe } = await desde('tests/_procedencia-aprobacion.mjs');
const { indiceDeFuentes, esProsaDistintiva } = await desde('tests/_respaldo-de-firma.mjs');

const lista = guard.congeladas();
const bloques = marcasDe(RAIZ, { dirs: ['src', 'public', 'tests', 'scripts'], marca: /fundador/i, literalesTras: 45 });
const porDonde = new Map(bloques.map((b) => [`${b.fichero}:${b.linea}`, b]));
const perdidas = lista.filter((d) => !porDonde.has(d));
if (perdidas.length) {
  console.error(`CIEGO: ${perdidas.length} de ${lista.length} congeladas no aparecen en marcasDe: ${perdidas.join(', ')}`);
  process.exit(2);
}

const indice = indiceDeFuentes(RAIZ);
const filas = lista.map((donde) => {
  const b = porDonde.get(donde);
  const prosa = b.literales.filter(esProsaDistintiva);
  return {
    donde,
    comentario: b.texto,
    literales: b.literales,
    prosa,
    // Dónde aparece cada literal de prosa en las fuentes, ATRIBUYA o no el fichero. El guard sólo
    // cuenta las que atribuyen; aquí se enseñan las dos para ver qué queda a una cita de absolver.
    apariciones: prosa.map((frase) => ({
      frase,
      en: indice.filter((f) => f.texto.includes(frase)).map((f) => ({ ruta: f.ruta, atribuye: f.atribuye })),
    })),
  };
});

const salida = process.argv[2];
if (!salida) { console.error('falta la ruta de salida'); process.exit(2); }
fs.writeFileSync(salida, JSON.stringify({
  trinquete: guard.SIN_RESPALDO,
  congeladas: lista.length,
  porNivel: guard.porNivel(),
  fuentes: indice.length,
  fuentesQueAtribuyen: indice.filter((f) => f.atribuye).length,
  filas,
}, null, 2));
console.error(`POBLACION congeladas=${lista.length} trinquete=${guard.SIN_RESPALDO} bloques=${bloques.length} fuentes=${indice.length}`);
