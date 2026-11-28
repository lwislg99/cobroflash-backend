// tests/scrum1502z-la-union-no-cruza-el-fin-de-linea.test.mjs — SCRUM-1502z
//
// LA UNIÓN DE COMENTARIOS DEL CENSO DE MARCAS NO CRUZA UN FIN DE LÍNEA CON CÓDIGO.
//
// ── EL DEFECTO ───────────────────────────────────────────────────────────────────────────────────
// `bloquesDeComentario` (`tests/_procedencia-aprobacion.mjs`) unía dos `//` seguidos sin mirar si el
// primero iba detrás de código. Un comentario al FINAL de una línea y un `//` en la línea siguiente
// salían como UN bloque, y la procedencia de uno (`(SCRUM-N comentario M)`) vestía a una marca de
// aprobación que no la tenía: el censo fallaba hacia ABIERTO. Lo dejó dicho jv-j6gp
// en SCRUM-1502y; la decisión de cerrarlo con la regla estricta es de SCRUM-1502 c.22993.
//
// ── QUÉ ATA ESTE FICHERO ─────────────────────────────────────────────────────────────────────────
// Fuente SEMBRADO aquí mismo (no ficheros del árbol): la marca sin procedencia debajo de un fin de
// línea con procedencia sale SIN procedencia; y su control: dos `//` en su propia línea siguen
// siendo UN bloque, porque la procedencia en la segunda línea de un mismo comentario es legítima.
//
// ── LO QUE NO ATA ────────────────────────────────────────────────────────────────────────────────
// · Los números de los censos que usan el lector (scrum387, scrum921c): cada uno tiene su trinquete.
// · El coste conocido de la regla: una firma escrita en el `//` de DEBAJO de una marca de fin de
//   línea ya no cuenta (el caso de `scrum377:72`, que 1502z pasó a una sola línea). Se fija abajo.
import test from 'node:test';
import assert from 'node:assert/strict';

import { bloquesDeComentario } from './_procedencia-aprobacion.mjs';

// Catálogo del meta-guard de mutaciones (SCRUM-836d): cada una, aplicada al lector, tumba el caso
// que nombra. Medidas con `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'tests/_procedencia-aprobacion.mjs',
    de: '        suelto: r.kind === ts.SyntaxKind.SingleLineCommentTrivia && /^\\s*$/.test(delante),',
    a: '        suelto: r.kind === ts.SyntaxKind.SingleLineCommentTrivia,',
    cae: 'SCRUM-1502z · la marca sin procedencia, debajo de un fin de línea con procedencia, sale SIN procedencia',
  },
  {
    fichero: 'tests/_procedencia-aprobacion.mjs',
    de: "      const delante = codigo.slice(codigo.lastIndexOf('\\n', r.pos - 1) + 1, r.pos);",
    a: '      const delante = codigo.slice(0, r.pos);',
    cae: 'SCRUM-1502z · CONTROL: dos `//` en su propia línea siguen siendo UN bloque',
  },
];

// Las mismas MARCA y PROCEDENCIA que `scrum387-procedencia-aprobacion.test.mjs` (líneas 44 y 46).
const MARCA = /aprobad[oa]s?\s+por\s+el\s+fundador/i;
const PROCEDENCIA = /SCRUM-\d+|docs\/[\w./ -]+/i;
const SIN = '// APROBADO por el fundador el 1-ene-2026';
const NOTA = '// nota (SCRUM-5 comentario 6)';

/** Cada bloque con marca de un fuente sembrado: su línea y si el censo le ve procedencia. */
const veredictos = (codigo) => bloquesDeComentario(codigo, 'sembrado.js')
  .filter((b) => MARCA.test(b.texto))
  .map((b) => ({ linea: b.linea, procedencia: PROCEDENCIA.test(b.texto) }));

test('SCRUM-1502z · la marca sin procedencia, debajo de un fin de línea con procedencia, sale SIN procedencia', () => {
  const trasComa = `const T = {\n  uno: 'Texto de prueba uno', ${NOTA}\n  ${SIN}\n  dos: 'Texto de prueba dos',\n};\n`;
  const trasPuntoYComa = `const uno = 'Texto de prueba uno'; ${NOTA}\n${SIN}\nconst dos = 'Texto de prueba dos';\n`;
  assert.deepEqual(veredictos(trasComa), [{ linea: 3, procedencia: false }], 'detrás de una coma');
  assert.deepEqual(veredictos(trasPuntoYComa), [{ linea: 3 - 1, procedencia: false }], 'detrás de un punto y coma');
  // Y el fin de línea sale como su propio bloque, con su texto entero y nada más.
  assert.deepEqual(bloquesDeComentario(trasComa, 'sembrado.js').map((b) => b.texto), [NOTA, SIN]);
});

test('SCRUM-1502z · CONTROL: dos `//` en su propia línea siguen siendo UN bloque', () => {
  // La procedencia en la segunda línea del mismo comentario es la forma de siempre (1502y :111).
  const seguidos = `const x = 0;\n${SIN}\n// Consta en: SCRUM-284.\nconst y = 1;\n`;
  assert.deepEqual(veredictos(seguidos), [{ linea: 2, procedencia: true }]);
  // Con sangría delante también es «en su propia línea».
  const sangrados = `function f() {\n    ${SIN}\n    // Consta en: SCRUM-284.\n  return 1;\n}\n`;
  assert.deepEqual(veredictos(sangrados), [{ linea: 2, procedencia: true }]);
});

test('SCRUM-1502z · el coste conocido: la firma en el `//` de debajo de una marca de fin de línea ya no cuenta', () => {
  // La forma que tenía `scrum377:72` hasta 1502z (SCRUM-1502 c.22993): falla hacia CERRADO, que es
  // lo que se eligió. Una firma así se escribe en la misma línea que la marca, o encima.
  const abajo = 'const TOPE = 6; // tras la microcopy aprobada por el fundador.\n// Consta en: SCRUM-1502 comentario 20853.\n';
  const enLaLinea = 'const TOPE = 6; // tras la microcopy aprobada por el fundador. Consta en: SCRUM-1502 comentario 20853.\n';
  assert.deepEqual(veredictos(abajo), [{ linea: 1, procedencia: false }]);
  assert.deepEqual(veredictos(enLaLinea), [{ linea: 1, procedencia: true }]);
});
