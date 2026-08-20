#!/usr/bin/env node
// scripts/censo-etiquetas-pegadas.mjs — SCRUM-553
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO, Y POR QUE UN CENSO Y NO UN BARRIDO
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// Un extractor que busca `<section class="hero">` con el `>` PEGADO deja de encontrar la
// etiqueta en cuanto alguien le añade un `id`, un `aria-*` o una clase. El disparador es
// siempre benigno —marcado correcto— y el que asume de mas es el extractor.
//
// Paso cuatro veces en una semana. Las dos ultimas: `_cifras-heroe.mjs` buscando
// `<section class="hero">` (cayeron los 4 tests de SCRUM-331 declarandose ciegos, y eso
// estuvo BIEN) y `scrum331-heroe.test.mjs` buscando `<h1>` despues de que SCRUM-543 le
// pusiera `id="reg-hero"` — ese cayo por «no se pudo leer», que parece cambio de copy cuando
// es cambio de marcado. Ese es el peor modo.
//
// 🔴 LA MEDICION QUE DECIDE QUE SE HACE (20-ago-2026): son 32 en 21 ficheros, no cuatro. Y de
// las 32, NINGUNA da verde al no encontrar nada — todas se declaran ciegas o lanzan. O sea que
// el problema medido no es «hay guards mintiendo»: es «hay 27 ocurrencias leyendo marcado vivo
// que se van a romper una a una cada vez que alguien toque una pagina».
//
// Con esos numeros, un barrido de 27 sitios a mano es justo la clase de cambio que introduce
// el defecto numero 5. Lo que este fichero hace es un TRINQUETE: cuenta, y cae si el numero
// SUBE, nombrando la ocurrencia nueva. La quinta vez deja de ser silenciosa.
//
// LA FORMA CORRECTA cuando se arregla una, y es la convencion que ya dejo SCRUM-543:
//     ANTES:  /<h1>([\s\S]*?)<\/h1>/          ← el `>` pegado
//     DESPUES:/<h1[^>]*>([\s\S]*?)<\/h1>/     ← tolera atributos, y lo vigilado sigue siendo
//                                               el TEXTO del h1
// Aceptar `<h1 id="x">` NO puede convertirse en aceptar cualquier cosa: se tolera el hueco de
// los atributos y NADA MAS.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Nombres de etiqueta HTML: son las que alguien edita y a las que se les añaden atributos. */
export const ETIQUETAS_HTML = new Set(('html,head,body,title,meta,link,script,style,section,div,'
  + 'span,p,a,ul,ol,li,h1,h2,h3,h4,h5,h6,header,footer,nav,main,aside,article,figure,figcaption,'
  + 'table,thead,tbody,tfoot,tr,td,th,caption,form,input,button,label,select,option,textarea,'
  + 'fieldset,legend,img,svg,path,dialog,details,summary,strong,b,i,em,small,code,pre,blockquote,'
  + 'br,hr,iframe,canvas,video,audio,source,time,mark,sup,sub,output,progress,meter,template,'
  + 'picture,object').split(','));

const ETIQUETA = /<([a-z][a-z0-9]{0,12})((?:[^<>\n]){0,100}?)>/g;
/** Construcciones que YA dejan hueco a los atributos. */
const TOLERA = [/\[\^>\]/, /\.\*/, /\[\\s\\S\]/, /\\s\*/];
/** Señales de que esa cadena se usa para BUSCAR y no es HTML de pega de un fixture. */
const USO_EXTRACTOR = /\.(match|matchAll|includes|indexOf|split|replace|search)\s*\(|new RegExp|\.test\s*\(/;

/**
 * ¿Es este `>` el de la etiqueta?
 *
 * 🔴 NO SIEMPRE, Y ES LA TRAMPA DE ESTA MEDICION. En `<h3[^>]*>` el primer `>` esta DENTRO de
 * la clase negada, asi que el hueco capturado es `[^` y ninguna marca de TOLERA casa: la
 * primera version de este censo conto como «pegados» justo los patrones que YA toleran
 * atributos, e inflo el numero a 50. Si el hueco deja un `[` sin cerrar, ese `>` no es el de
 * la etiqueta.
 */
export function elMayorEsDeLaEtiqueta(hueco) {
  const abre = (hueco.match(/\[/g) || []).length;
  const cierra = (hueco.match(/\]/g) || []).length;
  return abre <= cierra;
}

/** Ocurrencias de una etiqueta de apertura escrita con el `>` pegado, en una fuente. */
export function pegadasEn(fuente, rel) {
  const out = [];
  fuente.split('\n').forEach((linea, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(linea)) return; // un comentario no extrae nada
    for (const m of linea.matchAll(ETIQUETA)) {
      if (!elMayorEsDeLaEtiqueta(m[2])) continue;
      if (TOLERA.some((re) => re.test(m[2]))) continue;
      const enRegex = /\/[^/\n]*<[a-z]/.test(linea.slice(0, m.index + 1));
      if (!(enRegex || USO_EXTRACTOR.test(linea))) continue;
      out.push({
        fichero: rel, linea: i + 1, tag: m[1], etiqueta: m[0].slice(0, 60),
        html: ETIQUETAS_HTML.has(m[1]), texto: linea.trim().slice(0, 115),
      });
    }
  });
  return out;
}

function ficherosDe(dir) {
  const out = [];
  const anda = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) anda(p);
      else if (/\.(mjs|js)$/.test(e.name)) out.push(p);
    }
  };
  anda(dir);
  return out;
}

export const ZONAS = ['tests', 'scripts'];

/**
 * 🔴 LA TRAMPA DE AUTORREFERENCIA, que en este repo ya ha mordido cinco veces
 * (SCRUM-176/168/3/193 y ésta). Este censo y su test tienen que ESCRIBIR los patrones malos
 * para explicarlos y para probarse a sí mismos: el corpus sintético de
 * `pegadasEn('…/<section class="hero">/…')` es exactamente lo que el censo busca, así que se
 * contaba a sí mismo y subía el número de 29 a 40.
 *
 * Se excluyen los DOS ficheros del propio mecanismo, y sólo esos. No es una lista de
 * excepciones que pueda crecer: el test comprueba que son exactamente estos dos y que sin la
 * exclusión el número cambia — o sea que la exclusión ampara algo real y nada más.
 */
export const AUTORREFERENCIA = [
  'scripts/censo-etiquetas-pegadas.mjs',
  'tests/scrum553-etiquetas-pegadas.test.mjs',
];

export function censar(raiz, { incluirAutorreferencia = false } = {}) {
  const todas = [];
  let leidos = 0;
  for (const zona of ZONAS) {
    for (const abs of ficherosDe(path.join(raiz, zona))) {
      leidos += 1;
      const rel = path.relative(raiz, abs).replace(/\\/g, '/');
      if (!incluirAutorreferencia && AUTORREFERENCIA.includes(rel)) continue;
      todas.push(...pegadasEn(fs.readFileSync(abs, 'utf8'), rel));
    }
  }
  const html = todas.filter((h) => h.html);
  return {
    leidos,
    html,
    otros: todas.filter((h) => !h.html),
    ficheros: [...new Set(html.map((h) => h.fichero))].sort(),
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const r = censar(process.cwd());
  console.log('ficheros leídos ................... ' + r.leidos);
  console.log('🔴 etiquetas HTML con el `>` pegado  ' + r.html.length + '  en ' + r.ficheros.length + ' ficheros');
  console.log('   XML/otros (VeriFactu, etc.) ..... ' + r.otros.length);
  const porFichero = {};
  for (const h of r.html) (porFichero[h.fichero] ??= []).push(h);
  for (const [f, hs] of Object.entries(porFichero).sort((a, b) => b[1].length - a[1].length)) {
    console.log('   ' + String(hs.length).padStart(2) + '  ' + f);
    for (const h of hs) console.log('        :' + h.linea + '  ' + h.etiqueta);
  }
}
