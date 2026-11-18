// SCRUM-1756d · una página pública se lee con las hojas que ENLAZA, no sólo con su HTML.
//
// Desde 1756d el CSS de la landing, precios y términos vive en hojas de `public/` (CSP paso 3,
// `style-src 'self'`). Los tests que buscaban reglas dentro del `<style>` de la página siguen
// exigiendo lo mismo: sólo cambia DÓNDE lo leen. La hoja se saca del `<link rel="stylesheet">` de
// la propia página —no de una lista escrita aquí—, así que una hoja que deje de enlazarse deja de
// contar, y una regla que vuelva al HTML sigue contando.
//
// El `<link>` lo lee `hojasDeLaPagina`, el ÚNICO extractor de `tests/` (SCRUM-676): aquí no hay
// regex propia.
import fs from 'node:fs';
import path from 'node:path';
import { hojasDeLaPagina } from './_scripts-de-la-pagina.mjs';

/** Rutas `public/…` de las hojas locales que enlaza un HTML de `public/`, en orden y sin repetir. */
export function hojasEnlazadas(html, relHtml = 'public/index.html') {
  const res = hojasDeLaPagina(html);
  if (res.ilegibles.length) {
    throw new Error('🔴 el extractor no sabe leer estas etiquetas <link>: ' + res.ilegibles.join(' | '));
  }
  const out = [];
  for (const href of res.locales) {
    const limpio = href.split(/[?#]/)[0];
    const rel = limpio.startsWith('/')
      ? 'public' + limpio
      : path.posix.join(path.posix.dirname(relHtml), limpio);
    if (!out.includes(rel)) out.push(rel);
  }
  return out;
}

/**
 * El HTML de la página seguido del texto de cada hoja local que enlaza (las de `excluir`, no).
 * Una hoja enlazada que no existe en el árbol es un error: callar la haría parecer vacía.
 */
export function paginaConSusHojas(raiz, relHtml, { excluir = [] } = {}) {
  const html = fs.readFileSync(path.join(raiz, relHtml), 'utf8');
  const trozos = [html];
  for (const rel of hojasEnlazadas(html, relHtml)) {
    if (excluir.includes(rel)) continue;
    const abs = path.join(raiz, rel);
    if (!fs.existsSync(abs)) throw new Error(`🔴 ${relHtml} enlaza ${rel} y no existe en el árbol.`);
    trozos.push(fs.readFileSync(abs, 'utf8'));
  }
  return trozos.join('\n');
}
