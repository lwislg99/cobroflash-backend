// SCRUM-1316 ③ · ¿Alguna rama remota trae en docs/legal/ la pregunta al asesor sobre el medio de pago?
//
// uso (desde la raíz del repo, tras `git fetch origin`): node docs/master/evidencias/scrum1316/ramas-con-la-frase.mjs
//
// Recorre TODAS las ramas remotas y busca, solo en docs/legal/, la frase del real decreto-ley o su
// nombre. Lleva su control positivo dentro: la misma búsqueda con una palabra que SÍ está en
// docs/legal/ de casi todas las ramas («Iberley»). Si el control da 0, el recorrido está ciego y sale 2.
import { execFileSync } from 'node:child_process';

const git = (args) => {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return ''; } // git grep sale con 1 cuando no encuentra nada
};
const ramas = git(['branch', '-r', '--format=%(refname:short)']).split('\n')
  .map((r) => r.trim()).filter((r) => r && r !== 'origin' && !r.endsWith('/HEAD'));
const BUSCADO = 'cheque nominativo|Decreto-ley 26/2026|RDL 26/2026|Decreto-ley 29/2026|RDL 29/2026';
const con = (patron, r) => git(['grep', '-l', '-E', patron, r, '--', 'docs/legal']).trim() !== '';

const conFrase = ramas.filter((r) => con(BUSCADO, r));
const control = ramas.slice(0, 40).filter((r) => con('Iberley', r)).length;
console.log(`POBLACION: ${ramas.length} ramas remotas`);
console.log(`control positivo: de las 40 primeras, ${control} traen «Iberley» en docs/legal/`);
console.log(`con la frase o el nombre del real decreto-ley en docs/legal/: ${conFrase.length}`);
for (const r of conFrase) console.log('  · ' + r);
if (!ramas.length || !control) { console.error('CIEGO: sin ramas o sin control'); process.exit(2); }
