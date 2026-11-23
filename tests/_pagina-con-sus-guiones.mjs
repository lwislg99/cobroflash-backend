// SCRUM-1756f · una página pública se lee con los guiones que ENLAZA, no sólo con su HTML.
//
// Desde 1756f el `<script>` en línea de la landing y de precios vive en `public/landing.js` y
// `public/precios.js` (CSP paso 2, `script-src 'self'`). Los tests que buscaban código dentro del
// `<script>` de la página siguen exigiendo lo mismo: sólo cambia DÓNDE lo leen. El guion se saca
// del `<script src>` de la propia página —no de una lista escrita aquí—, así que un guion que deje
// de enlazarse deja de contar, y un código que vuelva al HTML sigue contando.
//
// Gemelo de `_pagina-con-sus-hojas.mjs` (1756d). El `<script>` lo lee `scriptsDeLaPagina`, el ÚNICO
// extractor de `tests/` (SCRUM-670/676): aquí no hay regex propia.
import fs from 'node:fs';
import path from 'node:path';
import { scriptsDeLaPagina } from './_scripts-de-la-pagina.mjs';

/** Rutas `public/…` de los guiones locales (clásicos) que enlaza un HTML de `public/`, en orden y sin repetir. */
export function guionesEnlazados(html, relHtml = 'public/index.html') {
  const res = scriptsDeLaPagina(html);
  if (res.ilegibles.length) {
    throw new Error('🔴 el extractor no sabe leer estas etiquetas <script>: ' + res.ilegibles.join(' | '));
  }
  const out = [];
  for (const src of res.clasicos) {
    const limpio = src.split(/[?#]/)[0];
    const rel = limpio.startsWith('/')
      ? 'public' + limpio
      : path.posix.join(path.posix.dirname(relHtml), limpio);
    if (!out.includes(rel)) out.push(rel);
  }
  return out;
}

/**
 * El HTML de la página seguido del texto de cada guion local que enlaza (los de `excluir`, no).
 * Un guion enlazado que no existe en el árbol es un error: callar lo haría parecer vacío.
 */
export function paginaConSusGuiones(raiz, relHtml, { excluir = [] } = {}) {
  const html = fs.readFileSync(path.join(raiz, relHtml), 'utf8');
  return [html, ...textosDeLosGuiones(raiz, html, relHtml, excluir)].join('\n');
}

/** Sólo el texto de los guiones locales que enlaza la página (para sumarlo a otra lectura sin repetir el HTML). */
export function guionesDeLaPagina(raiz, relHtml, { excluir = [] } = {}) {
  const html = fs.readFileSync(path.join(raiz, relHtml), 'utf8');
  return textosDeLosGuiones(raiz, html, relHtml, excluir).join('\n');
}

function textosDeLosGuiones(raiz, html, relHtml, excluir) {
  const trozos = [];
  for (const rel of guionesEnlazados(html, relHtml)) {
    if (excluir.includes(rel)) continue;
    const abs = path.join(raiz, rel);
    if (!fs.existsSync(abs)) throw new Error(`🔴 ${relHtml} enlaza ${rel} y no existe en el árbol.`);
    trozos.push(fs.readFileSync(abs, 'utf8'));
  }
  return trozos;
}
