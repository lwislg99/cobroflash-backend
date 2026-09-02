// tests/_solo-codigo.mjs — SCRUM-693
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// QUITAR LOS COMENTARIOS DE UN FUENTE, BIEN. Y SOBRE TODO: SABER QUÉ SE ESTÁ PREGUNTANDO.
//
// ── EL DEFECTO QUE LO MOTIVA, MEDIDO EL 2-sep-2026 ──────────────────────────────────────
// `scrum578` prohíbe la cadena del rótulo viejo del teléfono en `customersView.js`, y hace bien:
// aquel rótulo pedía un formato que el sistema no aplicaba. Pero su filtro saltaba las líneas
// `//` y **no los bloques** `/* */`. Consecuencia: DOCUMENTAR por qué se retiró aquel texto hacía
// caer el guard. Me pasó al cerrar SCRUM-575, con un JSDoc que citaba la cadena para que nadie la
// reintrodujera.
//
// Y el daño no es el rojo: es que empuja a escribir comentarios VAGOS —«aquel texto», «el rótulo
// antiguo»— justo en el sitio donde hace falta precisión. Un guard que cobra un impuesto sobre la
// claridad del código acaba pagándose con código peor documentado.
//
// Es la familia de siempre: el instrumento dice medir «este texto no se PINTA en la pantalla» y
// en realidad mide «este texto no APARECE en el fichero». Son dos preguntas distintas.
//
// ── POR QUÉ EL SCANNER DE TypeScript Y NO UN REGEX ──────────────────────────────────────
// Un regex ingenuo falla en los dos sentidos, y los dos casos existen de verdad:
//
//   ① `const u = "http://ejemplo.com";`  ← el `//` va DENTRO de una cadena. Un regex que corte
//      en `//` se come media línea de CÓDIGO REAL y el guard deja de ver lo que vigila.
//   ② `/* antes ponía "el texto" aquí */` ← una cadena DENTRO de un comentario. Un filtro por
//      líneas que sólo mire `//` la conserva, y el guard salta por su propia documentación.
//
// El scanner de TypeScript tokeniza de verdad, así que las dos cosas quedan bien POR
// CONSTRUCCIÓN — no por una lista de excepciones que alguien tenga que mantener. Es el mismo
// criterio que ya usa `scrum402` con el AST: «los comentarios no son nodos de literal, así que
// quedan fuera por construcción». Aquí se reusa esa idea, no se inventa otra.
//
// Cero dependencias nuevas (regla 36): `typescript` ya está en el árbol y lo usan quince guards.
// ═════════════════════════════════════════════════════════════════════════════════════════
import ts from 'typescript';

/**
 * El fuente con los COMENTARIOS en blanco — no borrados: sustituidos por espacios, y los saltos
 * de línea conservados.
 *
 * 🔴 CONSERVAR LA LONGITUD Y LAS LÍNEAS NO ES UN CAPRICHO: los guards que usan esto hacen
 * `slice(indexOf('function a'), indexOf('function b'))` para acotar un bloque, y cuentan líneas
 * para señalar dónde está el problema. Si el filtro encogiera el texto, esos índices apuntarían a
 * otro sitio y el guard mediría un trozo que no es el suyo — un falso verde silencioso.
 *
 * @param {string} fuente  el código tal cual está en disco
 * @param {string} nombre  sólo para los mensajes del scanner
 * @returns {string} el mismo texto con los comentarios en blanco
 */
export function soloCodigo(fuente, nombre = 'x.js') {
  const sc = ts.createScanner(ts.ScriptTarget.Latest, /* skipTrivia */ false,
    ts.LanguageVariant.Standard, String(fuente ?? ''));
  let salida = '';
  let clase;
  while ((clase = sc.scan()) !== ts.SyntaxKind.EndOfFileToken) {
    const texto = sc.getTokenText();
    const esComentario = clase === ts.SyntaxKind.SingleLineCommentTrivia
      || clase === ts.SyntaxKind.MultiLineCommentTrivia;
    // Los `\n` se conservan: si un comentario de bloque ocupa seis líneas, siguen siendo seis.
    salida += esComentario ? texto.replace(/[^\n]/g, ' ') : texto;
  }
  return salida;
}

/**
 * Los TEXTOS de todos los literales del fuente: cadenas, plantillas y los trozos de una plantilla
 * con interpolaciones.
 *
 * 🔴 ESTA ES LA FUNCIÓN QUE CONTESTA «¿ESTE TEXTO SE PINTA?», y es una pregunta distinta de
 * «¿aparece en el fichero?». Un comentario no es un literal, así que queda fuera por construcción.
 * Mismo motor que `marcadoresEnLiterales` de `scrum402`, del que sale esta idea.
 *
 * Se devuelven los textos y no un booleano a propósito: quien pregunte decide qué busca, y puede
 * decir en su rojo CUÁL era el literal que sobra.
 */
export function literalesDe(fuente, nombre = 'x.js') {
  const sf = ts.createSourceFile(nombre, String(fuente ?? ''), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const textos = [];
  const visitar = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) textos.push(n.text);
    else if (ts.isTemplateExpression(n)) {
      textos.push(n.head.text, ...n.templateSpans.map((s) => s.literal.text));
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return textos;
}

/**
 * ¿Algún literal del fuente CONTIENE este texto? El atajo de `literalesDe` para la pregunta que
 * hacen los guards de microcopy: «¿esto se pinta en alguna pantalla?».
 */
export function algunLiteralContiene(fuente, texto, nombre = 'x.js') {
  return literalesDe(fuente, nombre).some((t) => t.includes(texto));
}
