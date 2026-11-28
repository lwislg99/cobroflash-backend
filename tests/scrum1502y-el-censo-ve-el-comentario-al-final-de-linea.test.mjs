// tests/scrum1502y-el-censo-ve-el-comentario-al-final-de-linea.test.mjs — SCRUM-1502y
//
// EL CENSO DE MARCAS DE APROBACIÓN VE TAMBIÉN EL COMENTARIO ESCRITO AL FINAL DE UNA LÍNEA DE CÓDIGO.
//
// ── EL DEFECTO ───────────────────────────────────────────────────────────────────────────────────
// `bloquesDeComentario` (`tests/_procedencia-aprobacion.mjs`) recorría el árbol con `forEachChild`,
// que solo entrega NODOS. Una `,`, un `=`, una `{` o un `[` no lo son, y el comentario escrito
// detrás de ellos en la misma línea no cuelga de ningún nodo: no se recogía. Lo midió jv-j1le con
// una sonda (SCRUM-1502 comentario 22953) y por eso puso sus marcas en la línea de encima.
//
// Medido el 28-nov-2026 sobre `origin/main` 154c44557: de las 168 líneas de `src/` y `public/` que
// llevan la marca en un `//`, 112 van detrás de una `,` y el censo no veía NINGUNA. Seis ficheros,
// 87 de ellas en uno solo. Una marca que el censo no ve no puede salir «sin procedencia» ni «sin
// respaldo»: escribirla al final de la línea era, sin que nadie lo quisiera, la forma de no ser
// censada.
//
// ── QUÉ ATA ESTE FICHERO ─────────────────────────────────────────────────────────────────────────
// Los casos son fuente SEMBRADO aquí mismo, no ficheros del árbol: el día que alguien suba esas
// marcas a la línea de encima, un positivo tomado de main dejaría este fichero mudo.
//
// ── LO QUE NO ATA ────────────────────────────────────────────────────────────────────────────────
// · Los números de los censos que usan el lector (scrum387, scrum921c): cada uno tiene su trinquete.
// · La unión de `//` seguidos NO se tocó aquí. Desde SCRUM-1502z un comentario de fin de línea y el
//   `//` de la línea SIGUIENTE ya no salen como UN bloque: el caso de abajo lo afirma así (antes lo
//   fijaba como «queda dicho»).
import test from 'node:test';
import assert from 'node:assert/strict';

import { bloquesDeComentario } from './_procedencia-aprobacion.mjs';

// Catálogo del meta-guard de mutaciones (SCRUM-836d): cada una, aplicada al lector, tumba el caso
// que nombra. Medidas con `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'tests/_procedencia-aprobacion.mjs',
    de: '    recogerTrasLosSignos(n);',
    a: '    void n;',
    cae: 'SCRUM-1502y · la misma marca, detrás de la coma, se ve en la línea del literal',
  },
  {
    fichero: 'tests/_procedencia-aprobacion.mjs',
    de: '      if (h.kind === ts.SyntaxKind.SyntaxList) recogerTrasLosSignos(h);',
    a: '      if (h.kind === ts.SyntaxKind.SyntaxList) continue;',
    cae: 'SCRUM-1502y · la misma marca, detrás de la coma, se ve en la línea del literal',
  },
  {
    fichero: 'tests/_procedencia-aprobacion.mjs',
    de: '      else if (ts.isTokenKind(h.kind)) recoger(ts.getTrailingCommentRanges(codigo, h.getEnd()));',
    a: '      else if (h.kind === ts.SyntaxKind.CommaToken) recoger(ts.getTrailingCommentRanges(codigo, h.getEnd()));',
    cae: 'SCRUM-1502y · una marca detrás de un `=` se ve',
  },
];

const MARCA = /aprobad[oa]s?\s+por\s+el\s+fundador/i;
const TEXTO = '// APROBADO por el fundador el 1-ene-2026 (SCRUM-1 comentario 2)';

/** Los bloques con marca de un fuente sembrado, reducidos a lo que se compara. */
const conMarca = (codigo, nombre = 'sembrado.js') => bloquesDeComentario(codigo, nombre)
  .filter((b) => MARCA.test(b.texto))
  .map((b) => ({ linea: b.linea, texto: b.texto }));

test('SCRUM-1502y · SUELO: la marca en su propia línea, encima del literal, se ve (como antes)', () => {
  const codigo = `const T = {\n  ${TEXTO}\n  uno: 'Texto de prueba uno',\n};\n`;
  assert.deepEqual(conMarca(codigo), [{ linea: 2, texto: TEXTO }]);
});

test('SCRUM-1502y · la misma marca, detrás de la coma, se ve en la línea del literal', () => {
  // Con una propiedad detrás, y siendo la última (lo que sigue a la coma es la llave, no un nodo).
  const enMedio = `const T = {\n  uno: 'Texto de prueba uno', ${TEXTO}\n  dos: 'Texto de prueba dos',\n};\n`;
  const laUltima = `const T = {\n  cero: 0,\n  uno: 'Texto de prueba uno', ${TEXTO}\n};\n`;
  assert.deepEqual(conMarca(enMedio), [{ linea: 2, texto: TEXTO }], 'detrás de la coma, con otra propiedad debajo');
  assert.deepEqual(conMarca(laUltima), [{ linea: 3, texto: TEXTO }], 'detrás de la coma de la última propiedad');
  // La coma no es solo de los objetos.
  const lista = `const L = [\n  'Texto de prueba uno', ${TEXTO}\n  'Texto de prueba dos',\n];\n`;
  const llamada = `f(\n  'Texto de prueba uno', ${TEXTO}\n  'Texto de prueba dos',\n);\n`;
  assert.deepEqual(conMarca(lista), [{ linea: 2, texto: TEXTO }], 'detrás de la coma de una lista');
  assert.deepEqual(conMarca(llamada), [{ linea: 2, texto: TEXTO }], 'detrás de la coma de un argumento');
});

test('SCRUM-1502y · una marca detrás de un `=` se ve', () => {
  // La forma que jv-j1le midió en SCRUM-1502 comentario 22953: la constante, el `=`, la marca, y el
  // literal en la línea de debajo.
  const constante = `const uno = ${TEXTO}\n  'Texto de prueba uno';\n`;
  const propiedad = `objeto.uno = ${TEXTO}\n  'Texto de prueba uno';\n`;
  assert.deepEqual(conMarca(constante), [{ linea: 1, texto: TEXTO }], 'detrás del `=` de una constante');
  assert.deepEqual(conMarca(propiedad), [{ linea: 1, texto: TEXTO }], 'detrás del `=` de una asignación');
  // Y detrás de los signos que abren: la llave y el corchete.
  assert.deepEqual(conMarca(`const T = { ${TEXTO}\n  uno: 'Texto de prueba uno',\n};\n`), [{ linea: 1, texto: TEXTO }], 'detrás de la llave');
  assert.deepEqual(conMarca(`const L = [ ${TEXTO}\n  'Texto de prueba uno',\n];\n`), [{ linea: 1, texto: TEXTO }], 'detrás del corchete');
});

test('SCRUM-1502y · cada comentario sale UNA vez: ver los de fin de línea no duplica ninguno', () => {
  // Detrás del `;` ya se veía (cuelga del final de la sentencia). Con el recorrido nuevo se llega a
  // él por dos caminos, y tiene que seguir saliendo una sola vez.
  const codigo = [
    '/** Cabecera de documentación. */',
    `const uno = 'Texto de prueba uno'; ${TEXTO}`,
    'const T = {',
    `  dos: 'Texto de prueba dos', ${TEXTO}`,
    '  /* un bloque suelto */',
    "  tres: 'Texto de prueba tres',",
    '};',
    '',
  ].join('\n');
  const todos = bloquesDeComentario(codigo, 'sembrado.js');
  assert.deepEqual(todos.map((b) => b.linea), [1, 2, 4, 5], 'cuatro comentarios escritos, cuatro bloques');
  assert.equal(new Set(todos.map((b) => b.inicio)).size, todos.length, 'dos bloques empiezan en el mismo sitio');
  assert.deepEqual(conMarca(codigo).map((b) => b.linea), [2, 4]);
});

test('SCRUM-1502y · la unión de `//` seguidos sigue igual', () => {
  // Dos `//` seguidos son UN bloque: la procedencia puede ir en la segunda línea.
  const seguidos = '// Los rótulos, aprobados por el fundador.\n// Consta en SCRUM-284.\nconst x = 1;\n';
  assert.deepEqual(conMarca(seguidos), [{ linea: 1, texto: '// Los rótulos, aprobados por el fundador.\n// Consta en SCRUM-284.' }]);
  // Separados por código son DOS: el ticket del segundo no es la procedencia del primero.
  const separados = '// aprobado por el fundador\nconst x = 1;\n// SCRUM-284\n';
  assert.deepEqual(bloquesDeComentario(separados, 'p.ts').map((b) => b.texto), ['// aprobado por el fundador', '// SCRUM-284']);
  // Y lo que importa de este ticket: dos marcas de fin de línea en dos líneas seguidas tienen
  // CÓDIGO entre ellas, así que son dos bloques. La procedencia de una no tapa a la otra.
  const SIN = '// APROBADO por el fundador el 1-ene-2026';
  const dosLineas = `const T = {\n  uno: 'Texto de prueba uno', ${TEXTO}\n  dos: 'Texto de prueba dos', ${SIN}\n};\n`;
  assert.deepEqual(conMarca(dosLineas), [{ linea: 2, texto: TEXTO }, { linea: 3, texto: SIN }]);
});

test('SCRUM-1502y · un comentario de fin de línea y el `//` de la línea siguiente son DOS bloques', () => {
  // Lo cambia SCRUM-1502z (c.22993): hasta entonces eran UN bloque y la procedencia de uno vestía al
  // otro, así que el censo fallaba hacia abierto. Un comentario de fin de línea ya no se une con el siguiente.
  const trasComa = `const T = {\n  uno: 'Texto de prueba uno', ${TEXTO}\n  // y esto va en su propia línea\n  dos: 2,\n};\n`;
  const trasPuntoYComa = `const uno = 'Texto de prueba uno'; ${TEXTO}\n// y esto va en su propia línea\nconst dos = 2;\n`;
  assert.deepEqual(conMarca(trasComa), [{ linea: 2, texto: TEXTO }]);
  assert.deepEqual(conMarca(trasPuntoYComa), [{ linea: 1, texto: TEXTO }]);
});

test('SCRUM-1502y · una plantilla con `${}` delante no ciega lo que viene detrás (SCRUM-814)', () => {
  // El defecto que obligó a leer con el parser: tras una plantilla con sustituciones, un escáner
  // suelto se descarrila. El recorrido por signos pasa por dentro de la plantilla y no puede perder
  // lo que hay después.
  const codigo = [
    'const sql = tx.$executeRaw`UPDATE t SET a = ${a}, b = ${b} WHERE id = ${id}`;',
    'const T = {',
    `  uno: 'Texto de prueba uno', ${TEXTO}`,
    '};',
    TEXTO,
    'const dos = 2;',
    '',
  ].join('\n');
  assert.deepEqual(conMarca(codigo, 'sembrado.ts').map((b) => b.linea), [3, 5]);
});

test('SCRUM-1502y · lo que parece un comentario DENTRO de una cadena o de un JSDoc no es un bloque aparte', () => {
  // El positivo con el mismo texto está en todos los casos de arriba: ahí SÍ es un comentario.
  const enCadena = `const uno = 'https://ejemplo.invalid/a, ${TEXTO}';\nconst dos = [1, 2];\n`;
  assert.deepEqual(bloquesDeComentario(enCadena, 'sembrado.js').map((b) => b.texto), []);
  const enJsdoc = `/**\n * @param {string} a, ${TEXTO}\n * @returns {string} = ${TEXTO}\n */\nfunction f(a) { return a; }\n`;
  const bloques = bloquesDeComentario(enJsdoc, 'sembrado.js');
  assert.equal(bloques.length, 1, 'el JSDoc es UN comentario');
  assert.equal(bloques[0].linea, 1);
});
