// SCRUM-1395 · como nacio `tests/_filtro-sin-suelo-heredados.json`. Se corrio UNA vez, el 6-oct-2026.
// ⛔ NO es la forma de «arreglar» un rojo del trinquete: la lista solo mengua. Queda aqui como
// constancia de que la lista de partida salio del censo y no se escribio a mano.
// Uso:  node docs/master/evidencias/scrum1395/generar-heredados.mjs <sha de origin/main> > salida.json
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const { censoDelFiltro, FORMAS } = await import(pathToFileURL(path.join(RAIZ, 'tests', '_censo-filtro-sin-suelo.mjs')).href);
const c = censoDelFiltro(RAIZ);
const sinJuzgar = Object.fromEntries(c.de(FORMAS.SIN_JUZGAR).map((x) => [x.fichero, 'PON AQUI LO QUE SE VIO']));
process.stdout.write(`${JSON.stringify({
  ticket: 'SCRUM-1395',
  medidoContra: process.argv[2] || 'FALTA EL SHA',
  ficheros: c.de(FORMAS.SIN_SUELO).map((x) => x.fichero),
  sinJuzgar,
}, null, 2)}\n`);
