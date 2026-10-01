// misma-forma-a9.mjs — SCRUM-1340 · ¿hay OTRO guard cuya aplicabilidad la escribe el sujeto?
//
// `tests/scrum1294-a9-leccion-en-a10.test.mjs` exige la línea «A9:» a los tramos cuya ANCLA lleva
// fecha desde su corte (2026-09-30). La fecha la escribe el propio registro. Aquí se pregunta al
// MERGE: entradas nacidas en un merge posterior a ese corte cuya ancla dice una fecha anterior.
// Sólo lee. No arregla nada: es un recuento para el orquestador.
//
//   node docs/master/evidencias/scrum1340/misma-forma-a9.mjs <raiz ABSOLUTA>
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = process.argv[2];
const imp = (rel) => import(pathToFileURL(path.join(RAIZ, rel)).href);
const motor = await imp('tests/_skill-ui-por-efecto.mjs');
const m267 = await imp('tests/scrum267-ancla-de-medicion.test.mjs');

const CORTE_A9 = '2026-09-30';
// Posteriores, con holgura a favor del guard: sólo merges del 30-sep a las 00:00Z en adelante.
const u = motor.leerUnidades(RAIZ, `${CORTE_A9}T00:00:00Z`);
if (u.ciego) { console.log('A9 CIEGO ' + u.ciego); process.exit(2); }
const porFichero = motor.agruparPorFichero(m267.entradasTroceadas());

let nacidas = 0; const exentas = [];
for (const unidad of u.historia) {
  const { entradas, como } = motor.entradasDeLaUnidad(unidad, porFichero);
  if (como !== 'nacidas') continue;
  for (const e of entradas) {
    nacidas++;
    const a = m267.RE_ANCLA.exec(e.cuerpo);
    const fecha = a ? a[2].slice(0, 10) : null;
    if (fecha !== null && fecha >= CORTE_A9) continue;
    exentas.push({ clave: e.clave, fecha, llevaA9: /^A9:/m.test(e.cuerpo), merge: unidad.id, instante: unidad.instante });
  }
}
console.log('A9 poblacion: merges de primer padre desde ' + CORTE_A9 + 'T00:00Z = ' + u.historia.length
  + ' · entradas nacidas en ellos = ' + nacidas);
console.log('A9 de ellas, con ancla ANTERIOR al corte o sin ancla (el guard no las mira) = ' + exentas.length
  + ' · y de esas SIN linea A9 = ' + exentas.filter((x) => !x.llevaA9).length);
for (const x of exentas) console.log('A9 ' + (x.llevaA9 ? 'con A9' : 'SIN A9') + ' · ancla ' + x.fecha + ' · merge ' + x.merge.slice(0, 8) + ' ' + x.instante + ' · ' + x.clave.slice(0, 110));
console.log('A9 EXIT=0');
