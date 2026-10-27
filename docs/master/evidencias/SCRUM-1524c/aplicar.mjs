// SCRUM-1524c · aplica la TABLA y la NOTA. Cada `viejo` tiene que estar EXACTAMENTE una vez en su
// línea; si no, no escribe NADA en ningún fichero y sale 2. El número de líneas de cada documento no
// puede cambiar: otros ficheros los citan por fichero:línea.
//   node docs/master/evidencias/SCRUM-1524c/aplicar.mjs          (desde la raíz del árbol)
import fs from 'node:fs';
import { TABLA, NOTA } from './tabla.mjs';

const docs = new Map();
const lineas = (p) => { if (!docs.has(p)) docs.set(p, fs.readFileSync(p, 'utf8').split('\n')); return docs.get(p); };
const antes = new Map();
const fallos = [];
let tocadas = 0;
let iguales = 0;
for (const f of [...TABLA, NOTA]) {
  const L = lineas(f.doc);
  if (!antes.has(f.doc)) antes.set(f.doc, L.length);
  const i = f.linea - 1;
  if (f.viejo === '') {
    if (L[i] !== '') { fallos.push(`${f.doc}:${f.linea} no está en blanco`); continue; }
    L[i] = f.nuevo; tocadas++; continue;
  }
  const veces = L[i].split(f.viejo).length - 1;
  if (veces !== 1) { fallos.push(`${f.doc}:${f.linea} · «${f.viejo.slice(0, 60)}» aparece ${veces} veces`); continue; }
  if (f.viejo === f.nuevo) { iguales++; continue; }
  L[i] = L[i].replace(f.viejo, () => f.nuevo); tocadas++;
}
console.log(`POBLACION · ${TABLA.length} citas + 1 nota · ${docs.size} documentos`);
if (fallos.length) { console.log('NO SE ESCRIBE NADA:\n  ' + fallos.join('\n  ')); console.log('EXIT=2'); process.exit(2); }
for (const [p, L] of docs) {
  if (L.length !== antes.get(p)) { console.log(`LINEAS CAMBIADAS en ${p}`); console.log('EXIT=2'); process.exit(2); }
  fs.writeFileSync(p, L.join('\n'));
  console.log(`  escrito ${p} · ${L.length - 1} líneas, las mismas`);
}
console.log(`tocadas ${tocadas} · sin tocar a propósito ${iguales}`);
console.log('EXIT=0');
