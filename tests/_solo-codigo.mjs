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
  // 🔴 SCRUM-696 · LA PILA, Y POR QUÉ UNA PLANTILLA NO SE ESCANEA «DE SEGUIDO»
  //
  // `sc.scan()` a secas NO sabe volver a entrar en una plantilla. Ante `` `hola ${x} adiós` ``
  // devuelve `TemplateHead` (que es `` `hola ${ ``), luego escanea `x`, y al llegar al `}` lo lee
  // como una llave de cierre CUALQUIERA. A partir de ahí sigue en modo código: el ` adiós` son
  // identificadores sueltos y la comilla invertida FINAL la lee como la APERTURA de otra
  // plantilla. El scanner se queda dentro de una plantilla fantasma hasta el final del fichero.
  //
  // Eso rompía las dos direcciones, y las dos estaban medidas en el árbol el 2-sep-2026:
  //   · 723 de 1.111 ficheros conservaban comentarios SIN blanquear (falso positivo: el guard
  //     salta por su propia documentación, justo lo que este módulo existía para evitar).
  //   · 🔴 60 ficheros perdían CÓDIGO REAL, que es el daño caro. El patrón era siempre el mismo,
  //     una URL dentro de una plantilla: `` `https://wa.me/${tel}` ``, `` `file://${argv[1]}` ``,
  //     `` `http://127.0.0.1:${PUERTO}` ``. El `//` de la URL se leía como comentario y se comía
  //     el resto de la línea, cierre de plantilla incluido. Código que nadie volvía a vigilar.
  //
  // O sea: la enfermedad ① de la cabecera —el `//` dentro de una cadena— vivía DENTRO del módulo
  // escrito para curarla, sólo que en plantillas en vez de en cadenas.
  //
  // El arreglo es pedirle al scanner que relea ese `}` COMO continuación de la plantilla. Y hace
  // falta una pila porque no toda llave de cierre lo es: en `` `a ${ {b:1} } c` `` la primera
  // cierra un objeto y la segunda la interpolación. Se apila QUÉ abrió cada llave y sólo se relee
  // cuando lo que hay encima es una plantilla. Las ANIDADAS —`` `a ${`b ${c}`} d` ``— salen
  // solas: cada `TemplateHead` apila la suya y cada `TemplateTail` la desapila.
  // 🔴 SCRUM-696 · Y LO MISMO CON LAS EXPRESIONES REGULARES, QUE ES OTRO LITERAL MAL LEÍDO
  //
  // `scan()` nunca devuelve un regex por su cuenta: ante `/` da `SlashToken` (división) y hay que
  // pedirle `reScanSlashToken()` para que lea el literal entero. Sin eso, el cuerpo del regex se
  // tokeniza como si fuera código, y basta con que dentro haya dos barras seguidas para que el
  // scanner crea que empieza un comentario y blanquee hasta el final de la línea.
  //
  // No es hipotético: `src/core/validation/schemas.ts:300` tiene `!/^https?:\/\//i.test(v)`, donde
  // las dos últimas barras SÍ quedan pegadas (`…\/` + `/i`). Ahí se perdía el resto de la línea,
  // que es justo donde vive `` `https://${v.trim()}` ``. El censo del árbol lo cazó en 83 ficheros
  // después de arreglar las plantillas, y por eso este trozo va en el mismo ticket: sin él, el
  // censo no puede dar cero y el módulo seguiría cegando código.
  //
  // Cuándo un `/` PUEDE abrir un regex se decide por el token anterior, que es la regla de siempre
  // de JavaScript: detrás de algo que ya es un VALOR (identificador, literal, `)`, `]`, `}`) una
  // barra sólo puede ser división; detrás de un operador, una coma o un paréntesis de apertura,
  // sólo puede ser un regex. Los dos casos que esta regla resuelve mal —el `}` que cierra un
  // bloque y el `)` de un `if`— caen del lado «división», que es exactamente lo que el módulo
  // hacía ANTES para todos: donde la regla duda, no se empeora nada.
  const YA_ES_VALOR = new Set([
    ts.SyntaxKind.Identifier, ts.SyntaxKind.NumericLiteral, ts.SyntaxKind.BigIntLiteral,
    ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NoSubstitutionTemplateLiteral,
    ts.SyntaxKind.TemplateTail, ts.SyntaxKind.RegularExpressionLiteral,
    ts.SyntaxKind.CloseParenToken, ts.SyntaxKind.CloseBracketToken, ts.SyntaxKind.CloseBraceToken,
    ts.SyntaxKind.ThisKeyword, ts.SyntaxKind.SuperKeyword, ts.SyntaxKind.TrueKeyword,
    ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword,
    ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken,
  ]);
  let anterior = ts.SyntaxKind.Unknown;
  const llaves = [];
  while ((clase = sc.scan()) !== ts.SyntaxKind.EndOfFileToken) {
    if (clase === ts.SyntaxKind.CloseBraceToken && llaves[llaves.length - 1] === 'plantilla') {
      clase = sc.reScanTemplateToken(/* isTaggedTemplate */ false);
    }
    if ((clase === ts.SyntaxKind.SlashToken || clase === ts.SyntaxKind.SlashEqualsToken)
        && !YA_ES_VALOR.has(anterior)) {
      clase = sc.reScanSlashToken();
    }
    if (clase === ts.SyntaxKind.TemplateHead) llaves.push('plantilla');
    else if (clase === ts.SyntaxKind.TemplateTail) llaves.pop();
    else if (clase === ts.SyntaxKind.OpenBraceToken) llaves.push('bloque');
    else if (clase === ts.SyntaxKind.CloseBraceToken && llaves.length) llaves.pop();

    const texto = sc.getTokenText();
    const esComentario = clase === ts.SyntaxKind.SingleLineCommentTrivia
      || clase === ts.SyntaxKind.MultiLineCommentTrivia;
    // Los `\n` se conservan: si un comentario de bloque ocupa seis líneas, siguen siendo seis.
    salida += esComentario ? texto.replace(/[^\n]/g, ' ') : texto;
    // La trivia no cuenta como «token anterior»: entre un `(` y el `/` puede haber un salto
    // de linea o un comentario, y eso no cambia que ahi empiece un regex.
    const esTrivia = clase >= ts.SyntaxKind.FirstTriviaToken && clase <= ts.SyntaxKind.LastTriviaToken;
    if (!esTrivia) anterior = clase;
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
