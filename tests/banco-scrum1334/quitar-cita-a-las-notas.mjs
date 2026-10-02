// SCRUM-1334 · la «B» preparada: quitarle el `>` a las notas y a la historia que cinco fichas del
// equipo de Luis tienen escritas como cita. En una ficha toda cita es un texto firmado, también para
// `constaAprobado`; una nota en cita cuenta como aprobada.
//
//   node tests/banco-scrum1334/quitar-cita-a-las-notas.mjs               sólo dice qué cambiaría
//   node tests/banco-scrum1334/quitar-cita-a-las-notas.mjs --copia <dir> escribe una COPIA de docs/microcopy ya cambiada
//   node tests/banco-scrum1334/quitar-cita-a-las-notas.mjs --aplicar     cambia las fichas de verdad
//
// ⛔ `--aplicar` NO se lanza sin el sí del fundador: las cinco fichas son de otro equipo.
//
// Cada línea se localiza por IDENTIDAD (ficha + texto exacto), no por número de línea. No mueve
// líneas: a la nota se le quita el `> ` y la línea `>` en blanco de dentro del bloque se queda vacía.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const DIR = path.join(RAIZ, 'docs', 'microcopy');

const NOTAS = {
  '2026-09-03-SCRUM-704-guardar-lineas-dictadas.md': [
    '⚠️ **Y el censo de marcadores dice UNO, no veintiséis, y las dos cifras son correctas.** Ese censo',
    'cuenta **literales que contienen la marca**, y esta pantalla la factoriza en una constante que',
    'concatena veintiséis veces. Quien lea ese «1» no debe deducir «un rótulo pendiente».',
    'Por eso la entrada de `parteDetailView.js` en `tests/scrum402-marcador-no-se-pinta.test.mjs`',
    '**sigue en 1 y no se retira**: aplicar este aviso no ha cambiado el número, porque este aviso',
    'nunca fue un literal marcado aparte.',
  ],
  '2026-09-04-SCRUM-605-atajos-valido-hasta.md': [
    '⚠️ **Cómo estaba escrito antes, y por qué se corrige.** Nació diciendo «Aprobado por el **ASESOR**»',
    'y añadía, con toda razón, «a la espera de la firma del fundador — esto no es su firma». **El',
    'fichero era escrupuloso: el defecto estaba en `constaAprobado()`**, que lo contaba como aprobación',
    'igualmente, porque sólo miraba que el texto estuviera escrito en `docs/microcopy/` y **no quién lo',
    'firmaba**. La regla 30 dice que la microcopy la aprueba el fundador; el guard comprobaba que',
    'alguien la hubiera escrito. Dos afirmaciones distintas con el mismo verde.',
    'La firma del fundador llegó, así que **la aprobación no se retira**: se corrige la línea que la',
    'atribuía mal, y el hueco del guard se cierra en SCRUM-726.',
    '⚠️ **El nombre accesible está construido y NO cableado todavía.** Hoy la vista pone el **mismo**',
    'texto en el rótulo y en el `aria-label` (una sola llamada a `rotuloDeAtajo`), así que para que',
    'digan cosas distintas hace falta **una línea** en `quotesView.js` — fichero de otro carril en',
    'vuelo (SCRUM-594). Queda listo para que sea una línea y no un rediseño.',
  ],
  '2026-09-07-SCRUM-722-nuevo-albaran.md': [
    '[PENDIENTE microcopy oficial] Nuevo albarán',
  ],
  '2026-09-08-SCRUM-728-serie-ocupada.md': [
    'No se pudo crear el albarán: **API 500: internal_error**',
  ],
  '2026-09-09-SCRUM-832-la-ficha-que-ya-no-esta.md': [
    '«Dos respuestas distintas a "no existe" y "no es tuyo" convierten la lista de ids en un',
    'directorio de la competencia.»',
  ],
};

const citaDe = (linea) => {
  const m = /^>\s?(.*)$/.exec(linea.trim());
  return m ? m[1].trim() : null;
};

/** El texto de la ficha con las notas fuera de cita, y cuántas líneas cambió de cada clase. */
function sinCita(texto, notas) {
  const fin = texto.includes('\r\n') ? '\r\n' : '\n';
  const lineas = texto.split(/\r?\n/);
  const esNota = lineas.map((l) => notas.includes(citaDe(l)));
  let quitadas = 0;
  let blancos = 0;
  const out = lineas.map((l, i) => {
    if (esNota[i]) { quitadas++; return citaDe(l); }
    // El `>` a secas que separa dos párrafos DE LA MISMA nota: sin él quedaría una cita vacía suelta.
    if (citaDe(l) === '' && esNota[i - 1] && esNota[i + 1]) { blancos++; return ''; }
    return l;
  });
  return { texto: out.join(fin), quitadas, blancos };
}

const aplicar = process.argv.includes('--aplicar');
const iCopia = process.argv.indexOf('--copia');
const copia = iCopia > 0 ? path.resolve(process.argv[iCopia + 1]) : null;
if (copia) fs.cpSync(DIR, copia, { recursive: true });

const esperadas = Object.values(NOTAS).reduce((n, l) => n + l.length, 0);
console.log(`POBLACION fichas=${Object.keys(NOTAS).length} · líneas de nota esperadas=${esperadas} · modo=${aplicar ? 'APLICAR' : copia ? 'copia en ' + copia : 'sólo decir'}`);

let total = 0;
for (const [ficha, notas] of Object.entries(NOTAS)) {
  const ruta = path.join(DIR, ficha);
  const antes = fs.readFileSync(ruta, 'utf8');
  const r = sinCita(antes, notas);
  total += r.quitadas;
  const mismasLineas = antes.split(/\r?\n/).length === r.texto.split(/\r?\n/).length;
  console.log(`  ${r.quitadas === notas.length ? 'ok ' : 'MAL'} ${ficha}: ${r.quitadas} de ${notas.length} notas fuera de cita, ${r.blancos} separadores vaciados, mismas líneas=${mismasLineas}`);
  if (aplicar) fs.writeFileSync(ruta, r.texto);
  if (copia) fs.writeFileSync(path.join(copia, ficha), r.texto);
}
console.log(`líneas cambiadas: ${total} de ${esperadas}`);

if (copia) {
  // Lo que pierde el lector con el cambio: tiene que ser las notas y NADA más.
  const { literalesAprobados } = await import(pathToFileURL(path.join(RAIZ, 'tests/_microcopy-aprobada.mjs')).href);
  const antes = new Set(literalesAprobados());
  const despues = new Set(literalesAprobados({ dir: copia }));
  const perdidos = [...antes].filter((t) => !despues.has(t));
  const ganados = [...despues].filter((t) => !antes.has(t));
  const todas = new Set(Object.values(NOTAS).flat());
  const noSonNotas = perdidos.filter((t) => ![...todas].some((n) => n === t || n.includes(t)));
  console.log(`literales aprobados: antes=${antes.size} · después=${despues.size} · perdidos=${perdidos.length} · ganados=${ganados.length}`);
  console.log(`perdidos que NO son una de las notas: ${noSonNotas.length}`);
  for (const t of noSonNotas) console.log('   ⚠️ ' + t);
}
const ok = total === esperadas;
console.log(`\nEXIT=${ok ? 0 : 1}`);
process.exit(ok ? 0 : 1);
