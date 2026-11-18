// SCRUM-1756d · una página pública se lee con las hojas que ENLAZA, no sólo con su HTML.
//
// Desde 1756d el CSS de la landing, precios y términos vive en hojas de `public/` (CSP paso 3,
// `style-src 'self'`). Los tests que buscaban reglas dentro del `<style>` de la página siguen
// exigiendo lo mismo: sólo cambia DÓNDE lo leen. La hoja se saca del `<link rel="stylesheet">` de
// la propia página —no de una lista escrita aquí—, así que una hoja que deje de enlazarse deja de
// contar, y una regla que vuelva al HTML sigue contando.
import fs from 'node:fs';
import path from 'node:path';

/** Rutas `public/<x>.css` de las hojas locales que enlaza un HTML, en orden y sin repetir. */
export function hojasEnlazadas(html) {
  const out = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/\brel\s*=\s*["']?stylesheet\b/i.test(tag)) continue;
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (!href || !/^\/[^/]/.test(href[1])) continue; // sólo locales, servidas desde 'self'
    const rel = 'public' + href[1].split(/[?#]/)[0];
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
  for (const rel of hojasEnlazadas(html)) {
    if (excluir.includes(rel)) continue;
    const abs = path.join(raiz, rel);
    if (!fs.existsSync(abs)) throw new Error(`🔴 ${relHtml} enlaza ${rel} y no existe en el árbol.`);
    trozos.push(fs.readFileSync(abs, 'utf8'));
  }
  return trozos.join('\n');
}
