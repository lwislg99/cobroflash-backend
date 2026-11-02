// SCRUM-1634 (S4). Sólo lectura, EN MEMORIA: nada se escribe en el árbol.
// CONTROL POSITIVO del «no entra»: el mismo `expensesView.js` con la firma de 1588 copiada en la
// línea de cada uno de los cinco rótulos tiene que dar SEIS hojas APROBADO; y con el marcador de
// pendiente, cinco PENDIENTE + «Alquiler de local» APROBADO. Si el censo no las viera así, el
// «hoy no entran» de `salida.txt` sería ceguera de la sonda y no un hecho del fichero.
// Uso: node control-positivo.mjs <ruta del _censo-convenio-microcopy.mjs> <árbol>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [script, raiz] = process.argv.slice(2);
const { censarFuente } = await import(pathToFileURL(script).href);
const rel = 'public/dashboard/js/expensesView.js';
const fuente = fs.readFileSync(path.join(raiz, rel), 'utf8');
const CINCO = ['Materiales', 'Desplazamiento', 'Herramientas', 'Subcontrata', 'Otros'];
const conMarca = (marca) => {
  let t = fuente;
  for (const r of CINCO) {
    const antes = `{ label: '${r}' },`;
    if (!t.includes(antes)) throw new Error(`CIEGO: no encuentro ${antes} en ${rel}`);
    t = t.replace(antes, `{ label: '${r}', ${marca}\n  },`);
  }
  return t;
};
for (const [nombre, marca] of [
  ['firmados', '// APROBADO por <quién> el <fecha> (SCRUM-1634 c.<n>)'],
  ['pendientes', '// [PENDIENTE microcopy oficial]'],
]) {
  const r = censarFuente(rel, conMarca(marca), {});
  console.log(`${nombre}: ciegos ${r.ciegos.length} · objetos ${r.objetos} · hojas ${r.hojas.length}`);
  for (const h of r.hojas) console.log('  ', h.clase, h.id);
}
const hoy = censarFuente(rel, fuente, {});
console.log(`hoy (sin tocar): objetos ${hoy.objetos} · hojas ${hoy.hojas.length}`);
for (const h of hoy.hojas) console.log('  ', h.clase, h.id);
