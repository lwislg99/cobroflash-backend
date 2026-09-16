// SCRUM-877 ② · ¿CUANTOS `yaqu.app` ABSOLUTOS HAY EN public/, Y EN QUE POSICION?
//
// SOLO CUENTA. No toca el front (regla 4: vanilla, sin bundler) y NO amplia la poblacion del
// guard: `src/` se queda como primer paso. Esto da la cifra para que el fundador decida si
// `public/` entra, se queda fuera con motivo escrito, o es su propio ticket.
//
// ⚠️ El criterio es el MISMO que el del guard, pero `public/` no es TypeScript: son `.html` y `.js`
// sueltos. Asi que el analizador por AST se usa donde se puede (`.js`) y en el HTML se clasifica
// por contexto textual — y eso se DICE, porque no es la misma fuerza de medida.
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.argv[2];
const RE = /https?:\/\/(?:www\.)?yaqu\.app/g;

function ficheros(carpeta) {
  const out = [];
  const andar = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { andar(p); continue; }
      if (/\.(html|js|css|json|webmanifest)$/.test(e.name)) out.push(path.relative(RAIZ, p).split(path.sep).join('/'));
    }
  };
  const d = path.join(RAIZ, carpeta);
  if (fs.existsSync(d)) andar(d);
  return out.sort();
}

const lista = ficheros('public');
console.log('POBLACION');
console.log('  ficheros en public/ (html/js/css/json/webmanifest) : ' + lista.length);
if (lista.length < 20) { console.log('🔴 CIEGO: eso no es el front. No se afirma nada.'); process.exit(2); }

// Clasificacion por contexto, igual de posicion que el guard:
//   URL        -> tras href=/src=/content=/action=/url:  o inicio de una cadena de URL
//   CONTENIDO  -> texto que una persona lee (tras cerrar etiqueta, o en prosa)
//   META       -> dentro de una etiqueta <meta|link> (canonical, og:url…): es URL, pero de
//                 METADATOS del documento, y esos SIEMPRE son absolutos por definicion del
//                 estandar. Se cuenta aparte porque meterlos con los demas inflaria el numero.
function clasificar(linea, idx) {
  const izq = linea.slice(0, idx);
  const abre = izq.lastIndexOf('<');
  const cierra = izq.lastIndexOf('>');
  const dentroDeEtiqueta = abre > cierra;
  const etiqueta = dentroDeEtiqueta ? (/<\s*([a-zA-Z0-9-]+)/.exec(izq.slice(abre)) || [])[1] : null;

  if (etiqueta && /^(meta|link)$/i.test(etiqueta)) return 'META';
  if (/(?:href|src|content|action|url)\s*[:=]\s*["'`]?\s*$/i.test(izq)) return 'URL';
  if (/["'`]$/.test(izq)) return 'URL';                    // inicio de una cadena
  if (!dentroDeEtiqueta) return 'CONTENIDO';
  return 'INDETERMINADA';
}

const conteo = { URL: 0, CONTENIDO: 0, META: 0, INDETERMINADA: 0 };
const detalle = [];
for (const rel of lista) {
  const ls = fs.readFileSync(path.join(RAIZ, rel), 'utf8').split('\n');
  for (let i = 0; i < ls.length; i++) {
    RE.lastIndex = 0;
    let m;
    while ((m = RE.exec(ls[i])) !== null) {
      const c = clasificar(ls[i], m.index);
      conteo[c]++;
      detalle.push({ rel, linea: i + 1, clase: c, muestra: ls[i].slice(Math.max(0, m.index - 30), m.index + 34).trim() });
    }
  }
}

const total = Object.values(conteo).reduce((a, b) => a + b, 0);
console.log('\nEL NUMERO');
console.log('  `yaqu.app` absolutos en public/ : ' + total);
console.log('    · en posicion de URL          : ' + conteo.URL);
console.log('    · en METADATOS (meta/link)    : ' + conteo.META);
console.log('    · en CONTENIDO visible        : ' + conteo.CONTENIDO);
console.log('    · ⚠️ indeterminadas            : ' + conteo.INDETERMINADA);

// 🔴 CONTROL: si sale cero, o todo cae en un solo cubo, el criterio no discrimina.
if (total === 0) { console.log('\n🔴 CIEGO: cero en todo el front. El criterio esta roto.'); process.exit(2); }
const cubos = Object.values(conteo).filter((n) => n > 0).length;
console.log('  cubos con contenido             : ' + cubos + (cubos >= 2 ? '  OK (discrimina)' : '  ⚠️ todo en uno: no discrimina'));

console.log('\nPOR FICHERO');
const porFichero = new Map();
for (const d of detalle) {
  if (!porFichero.has(d.rel)) porFichero.set(d.rel, []);
  porFichero.get(d.rel).push(d);
}
for (const [rel, ds] of [...porFichero].sort((a, b) => b[1].length - a[1].length)) {
  const c = ds.reduce((acc, d) => { acc[d.clase] = (acc[d.clase] || 0) + 1; return acc; }, {});
  console.log('  ' + String(ds.length).padStart(3) + '  ' + rel + '   ' + JSON.stringify(c));
}

console.log('\nMUESTRA de cada clase');
for (const clase of ['URL', 'META', 'CONTENIDO', 'INDETERMINADA']) {
  const ejemplos = detalle.filter((d) => d.clase === clase).slice(0, 3);
  console.log('\n  ' + clase + ' (' + conteo[clase] + ')');
  for (const e of ejemplos) console.log('    ' + e.rel + ':' + e.linea + '   ' + e.muestra);
}
