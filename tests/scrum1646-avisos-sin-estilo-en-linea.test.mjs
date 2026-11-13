// SCRUM-1646 (CSP paso 2, `style-src 'self'`) · los tres avisos públicos de `publicNotFound.ts`
// —documento no disponible, página no encontrada, factura en proceso— sin `<style>` en línea.
//
// Mide el HTML GENERADO (no el fuente): con la CSP aplicada, un `<style>` o un `style=` no se pinta y
// la página sale desnuda. Las capturas byte a byte con la CSP aplicada, en el registro
// (`docs/master/SCRUM-1646.md`); aquí, lo que se puede atar sin navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { hojasDeLaPagina } from './_scripts-de-la-pagina.mjs';

const require = createRequire(import.meta.url);
const avisos = require('../dist/core/http/publicNotFound.js');
const { CACHE_CON_HUELLA, huellaDeContenido } = require('../dist/core/http/huellaEstaticos.js');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/core/http/publicNotFound.ts',
    de: "  ${enlaceDeAviso('pagina-no-encontrada')}\n",
    a: "  <style>${AVISOS_CSS['pagina-no-encontrada']}</style>\n",
    cae: 'SCRUM-1646 · las tres páginas sin <style> ni style=, con su hoja desde \'self\' y huella buena',
  },
  {
    fichero: 'src/core/http/publicNotFound.ts',
    de: "return pedida === HUELLAS_AVISOS[hoja] ? CACHE_CON_HUELLA : 'no-cache';",
    a: 'return CACHE_CON_HUELLA;',
    cae: 'SCRUM-1646 · immutable SÓLO con la huella buena',
  },
];

/** Censo sobre el HTML: etiquetas `<style>`, atributos `style=` y `<script>` sin `src`, fuera de comentarios. */
function censo(html) {
  const limpio = html.replace(/<!--[\s\S]*?-->/g, '');
  const etiquetas = [...limpio.matchAll(/<[a-zA-Z][^>]*>/g)].map((m) => m[0]);
  return {
    style: etiquetas.filter((t) => /^<style\b/i.test(t)).length,
    atributoStyle: etiquetas.filter((t) => /\sstyle\s*=/i.test(t)).length,
    scriptEnLinea: etiquetas.filter((t) => /^<script\b/i.test(t) && !/\ssrc\s*=/i.test(t)).length,
    // SCRUM-676: los `<link>` los lee UN extractor, `hojasDeLaPagina`; aquí no se duplica.
    hojas: hojasDeLaPagina(html).locales,
  };
}

const CARAS = [
  ['documento-no-disponible', () => avisos.documentNotFoundHtml()],
  ['pagina-no-encontrada', () => avisos.notFoundPageHtml()],
  ['documento-en-registro', () => avisos.documentoEnRegistroHtml('Texto de prueba')],
];

test('SCRUM-1646 · CONTROL: el censo ve un <style>, un style= y un <script> sembrados, e ignora el comentario', () => {
  const c = censo('<head><!-- <style>x</style> --><style>a{}</style><link rel="stylesheet" href="/a.css"/></head><div style="x"></div><script>1</script><script src="/b.js"></script>');
  assert.deepEqual(c, { style: 1, atributoStyle: 1, scriptEnLinea: 1, hojas: ['/a.css'] });
});

test("SCRUM-1646 · las tres páginas sin <style> ni style=, con su hoja desde 'self' y huella buena", () => {
  assert.equal(CARAS.length, Object.keys(avisos.AVISOS_CSS).length, 'CIEGO: hay hojas sin página o páginas sin hoja');
  for (const [hoja, pagina] of CARAS) {
    const html = pagina();
    const c = censo(html);
    assert.equal(c.style, 0, `${hoja}: lleva <style> en línea`);
    assert.equal(c.atributoStyle, 0, `${hoja}: lleva style=`);
    assert.equal(c.scriptEnLinea, 0, `${hoja}: lleva <script> en línea`);
    const huella = crypto.createHash('sha1').update(avisos.AVISOS_CSS[hoja]).digest('hex');
    assert.equal(c.hojas.length, 1, `${hoja}: tiene que cargar exactamente su hoja`);
    const [ruta, query] = c.hojas[0].split('?');
    assert.equal(ruta, avisos.rutaDeAviso(hoja), `${hoja}: la hoja no es la suya`);
    assert.ok(ruta.startsWith('/') && !ruta.startsWith('//'), `${hoja}: la hoja no sale de 'self'`);
    assert.equal(query, `v=${huellaDeContenido(avisos.AVISOS_CSS[hoja])}`, `${hoja}: huella que no es la del contenido`);
    assert.ok(huella.startsWith(query.slice(2)) && query.length > 6, `${hoja}: la huella de la casa ya no es el sha1 del contenido (${query} vs ${huella})`);
    // en el MISMO sitio de la cascada que el <style>: dentro de <head>, detrás del <title>
    assert.ok(html.indexOf('</title>') < html.indexOf('<link rel="stylesheet"') && html.indexOf('<link rel="stylesheet"') < html.indexOf('</head>'), `${hoja}: la hoja no está donde estaba el <style>`);
  }
});

test('SCRUM-1646 · immutable SÓLO con la huella buena', () => {
  for (const [hoja, pagina] of CARAS) {
    const v = /\?v=([^"]+)"/.exec(pagina())[1];
    assert.equal(avisos.cacheDelAviso(hoja, v), CACHE_CON_HUELLA);
    assert.equal(avisos.cacheDelAviso(hoja, 'vieja'), 'no-cache');
    assert.equal(avisos.cacheDelAviso(hoja, undefined), 'no-cache');
  }
});

test('SCRUM-1646 · las hojas son CSS sin datos: ni etiquetas, ni plantilla sin resolver, y cada una con su cuerpo y su tarjeta', () => {
  for (const [hoja, css] of Object.entries(avisos.AVISOS_CSS)) {
    assert.doesNotMatch(css, /[<>]|\$\{/, `${hoja}: la hoja lleva marcado o una plantilla`);
    assert.match(css, /body\{margin:0;/, `${hoja}: sin la regla del body`);
    assert.match(css, /\.card\{background:#fff;/, `${hoja}: sin la tarjeta`);
  }
});
