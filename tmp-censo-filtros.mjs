// CENSO CLASIFICADO de los filtros de comentarios propios de tests/.
// No se clasifica MIRANDO la regex: se EJECUTA contra dos sondas y se mira qué hace.
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.cwd();
const DIR = path.join(RAIZ, 'tests');

// SONDA 1 — ¿ciega CODIGO REAL? Hay un `//` dentro de una cadena (una URL) y codigo vivo detras.
const SONDA_CIEGA = "const u = 'https://yaqu.app/x'; const VIVO_UNO = 1;";
// SONDA 2 — ¿quita de verdad un comentario al final de linea?
const SONDA_ENCOGE = 'const x = 1; // aqui va PALABRA_DOS';

const ficheros = fs.readdirSync(DIR).filter((n) => /\.(mjs|js)$/.test(n));
if (ficheros.length === 0) { console.log('CIEGO: cero ficheros en tests/'); process.exit(1); }

// Un literal de regex dentro de `.replace(` — con clases y escapes.
const RE_LITERAL = /\.replace\(\s*(\/(?:\\.|\[(?:\\.|[^\]\\])*\]|[^/\\\n])+\/[gimsuy]*)/g;

const censo = [];
for (const nombre of ficheros) {
  const rel = 'tests/' + nombre;
  const fuente = fs.readFileSync(path.join(DIR, nombre), 'utf8');
  const usaHelper = /soloEjecutable/.test(fuente);

  const propios = [];
  for (const m of fuente.matchAll(RE_LITERAL)) {
    const literal = m[1];
    const corte = literal.lastIndexOf('/');
    const cuerpo = literal.slice(1, corte);
    const flags = literal.slice(corte + 1);
    // Solo interesan las que hablan de comentarios.
    if (!/\\\/\\\/|\\\/\\\*/.test(cuerpo)) continue;
    let re;
    try { re = new RegExp(cuerpo, flags); } catch { continue; }
    propios.push({ literal, re });
  }

  const soloLineasEnteras = /startsWith\(\s*['"]\/\/['"]\s*\)/.test(fuente)
    || /\/\^\\s\*\\\/\\\//.test(fuente);

  if (propios.length === 0 && !soloLineasEnteras) continue;

  // EJECUTAR: se aplican todas sus regex en cadena, como hace el fichero.
  const aplicar = (texto) => propios.reduce((t, p) => {
    try { return t.replace(p.re, ''); } catch { return t; }
    }, texto);

  const trasCiega = aplicar(SONDA_CIEGA);
  const trasEncoge = aplicar(SONDA_ENCOGE);

  const ciegaCodigo = !trasCiega.includes('VIVO_UNO');
  const quitaComentario = !trasEncoge.includes('PALABRA_DOS');

  censo.push({
    rel, usaHelper, nRegex: propios.length, soloLineasEnteras,
    ciegaCodigo, quitaComentario,
    muestra: propios[0] ? propios[0].literal.slice(0, 70) : '(startsWith)',
    trasCiega: trasCiega.trim().slice(0, 70),
  });
}

const conPropio = censo.filter((c) => c.nRegex > 0 || c.soloLineasEnteras);
const ciegan = conPropio.filter((c) => c.ciegaCodigo);
const encogen = conPropio.filter((c) => !c.ciegaCodigo && !c.quitaComentario);
const correctos = conPropio.filter((c) => !c.ciegaCodigo && c.quitaComentario);

console.log('=================== CENSO ===================');
console.log('  ficheros de tests/                    : ' + ficheros.length);
console.log('  con FILTRO PROPIO                     : ' + conPropio.length);
console.log('  de esos, que YA usan soloEjecutable   : ' + conPropio.filter((c) => c.usaHelper).length);
console.log('');
console.log('  🔴 CIEGAN CODIGO REAL (verde falso)   : ' + ciegan.length);
console.log('  ⚠️  SOLO ENCOGEN / dejan comentario    : ' + encogen.length);
console.log('  ✅ correctos (quitan comentario, no ciegan): ' + correctos.length);

if (conPropio.length === 0) { console.log('CIEGO: cero filtros propios y sabemos que hay decenas.'); process.exit(1); }

console.log('\n=========== LOS QUE CIEGAN CODIGO ===========');
for (const c of ciegan) {
  console.log('  ' + c.rel + (c.usaHelper ? '   [ademas usa el helper]' : ''));
  console.log('       regex : ' + c.muestra);
  console.log('       sonda -> ' + JSON.stringify(c.trasCiega));
}
