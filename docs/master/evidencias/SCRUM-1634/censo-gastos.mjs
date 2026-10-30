// SCRUM-1634 (S4, 29-oct-2026). Sólo lectura. Corre el censo de firmas de SCRUM-1157
// (`scripts/_censo-convenio-microcopy.mjs`) contra un árbol y enseña qué hojas de
// `public/dashboard/js/expensesView.js` entran, con su clase.
// CONTROL: la población total tiene que cuadrar con la de la CLI del censo sobre el mismo árbol
// (`node scripts/_censo-convenio-microcopy.mjs --raiz <árbol>`, primera línea): si no, esto no
// está leyendo lo mismo y su «no entra» no vale.
// Uso: node censo-gastos.mjs <ruta del _censo-convenio-microcopy.mjs> <árbol>
//   (la ruta del script va aparte porque necesita `typescript` a su lado: un árbol sin
//    node_modules propio lo toma de otro con el MISMO script, comparado por hash).
import { pathToFileURL } from 'node:url';
const [script, raiz] = process.argv.slice(2);
const m = await import(pathToFileURL(script).href);
const r = m.censar({ raiz });
console.log('estado', r.estado, 'poblacion', JSON.stringify(r.poblacion));
const g = (r.hojas || []).filter((h) => h.id.includes('expensesView'));
console.log('hojas de expensesView:', g.length);
for (const h of g) console.log(' ', h.clase, h.id, h.porGrupo ? '(por grupo)' : '');
