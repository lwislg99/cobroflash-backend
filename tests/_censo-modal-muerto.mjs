// tests/_censo-modal-muerto.mjs — SCRUM-867 · ¿QUEDA ALGO QUE CARGUE, LLAME O PRECACHEE UN FICHERO
// DEL DASHBOARD?
//
// Tres vías, y son tres porque un fichero del panel puede seguir vivo por cualquiera de ellas:
//
//   ① EL ÍNDICE   — un `<script src>` de `public/dashboard/index.html`. Es lo que hace que el
//                   navegador lo descargue y lo EJECUTE en cada visita, lo llame alguien o no.
//   ② EL SERVICE WORKER — una entrada del `const SHELL = [...]` de `public/sw.js`. Precachea, así
//                   que sobrevive al borrado del fichero: `cache.addAll` es atómico y si la ruta
//                   ya no resuelve, **el precache entero falla** (SCRUM-274). Por eso se mira
//                   aparte del índice y no «se supone».
//   ③ EL CÓDIGO   — una llamada o una cadena dentro de otro `.js` del panel.
//
// 🔴 POR AST Y NO POR TEXTO, y no es preferencia de estilo: un guard que busca el nombre en el
// fuente crudo **se caza a sí mismo** en el comentario que explica la prohibición, y cuenta como
// «vivo» un fichero al que sólo nombra la prosa. Ha mordido cuatro veces en esta casa. Aquí un
// comentario no es un nodo, así que no cuenta; y los comentarios HTML se quitan antes de leer los
// `<script>`, porque un `<script>` comentado no carga nada.
//
// Puro a propósito: recibe FUENTES y devuelve HALLAZGOS. Así el guard puede fabricarle una
// referencia en memoria —su suelo— sin escribir un byte en el árbol ni en el disco.
import ts from 'typescript';

/** Los `src` de los `<script>` del HTML, sin los que viven dentro de un comentario. */
export function scriptsDelHtml(html) {
  const sinComentarios = String(html || '').replace(/<!--[\s\S]*?-->/g, '');
  return [...sinComentarios.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
}

/**
 * Las entradas del `const SHELL = [...]` de `sw.js`.
 *
 * Devuelve `null` —y no `[]`— cuando no encuentra el bloque: «no hay ninguna» y «no supe mirar» no
 * se pueden escribir igual, o el día que alguien renombre `SHELL` este censo daría verde vacío.
 */
export function entradasDelShell(sw) {
  const bloque = String(sw || '').match(/const SHELL = \[([\s\S]*?)\];/);
  if (!bloque) return null;
  return [...bloque[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

/**
 * Referencias EJECUTABLES a un fichero o a una función dentro de un `.js`.
 *
 * @param codigo   el fuente
 * @param nombre   con qué nombre se reporta (y con el que lo lee el parser)
 * @param fichero  nombre de fichero a buscar dentro de las cadenas (p. ej. `nuevaFacturaModal.js`)
 * @param funcion  identificador a buscar (p. ej. `openNuevaFacturaModal`)
 */
export function referenciasEnJs(codigo, nombre, { fichero = null, funcion = null } = {}) {
  const sf = ts.createSourceFile(nombre || 'x.js', String(codigo || ''), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const out = [];
  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const ver = (n) => {
    if (funcion && ts.isIdentifier(n) && n.text === funcion) {
      out.push({ via: 'identificador', texto: n.text, linea: linea(n) });
    } else if (fichero && ts.isStringLiteralLike(n) && String(n.text).includes(fichero)) {
      out.push({ via: 'cadena', texto: n.text, linea: linea(n) });
    }
    ts.forEachChild(n, ver);   // ⚠️ `ver` no devuelve nada: `forEachChild` CORTA con cualquier truthy
  };
  ver(sf);
  return out;
}

/**
 * El censo entero, a partir de fuentes ya leídas.
 *
 * @param html      contenido de `index.html`
 * @param sw        contenido de `sw.js`
 * @param scripts   `[{ ruta, texto }]` de los `.js` del panel
 * @param fichero   el fichero vigilado (`nuevaFacturaModal.js`)
 * @param funcion   su función publicada (`openNuevaFacturaModal`)
 */
export function censoDeReferencias({ html, sw, scripts, fichero, funcion }) {
  const enIndice = scriptsDelHtml(html).filter((s) => s.includes(fichero));
  const shell = entradasDelShell(sw);
  const enCodigo = [];
  for (const { ruta, texto } of scripts || []) {
    for (const r of referenciasEnJs(texto, ruta, { fichero, funcion })) enCodigo.push({ ruta, ...r });
  }
  return {
    enIndice,
    enShell: shell === null ? null : shell.filter((e) => e.includes(fichero)),
    shellIlegible: shell === null,
    enCodigo,
    vivo: enIndice.length > 0 || (shell !== null && shell.some((e) => e.includes(fichero))) || enCodigo.length > 0,
  };
}
