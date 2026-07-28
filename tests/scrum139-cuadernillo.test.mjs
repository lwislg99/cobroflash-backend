import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFuente } from './_guard-texto.mjs'; // SCRUM-193

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE = path.join(raiz, 'public', 'dashboard', 'js', 'quotesView.js');
const HOJA = path.join(raiz, 'public', 'dashboard', 'css', 'styles.css');
const src = leerFuente(FUENTE);
const css = leerFuente(HOJA);

/**
 * SCRUM-139 F2 — EL CUADERNILLO.
 *
 * quotesView.js es un módulo de navegador (no importable desde node:test), así que estos
 * guards son ESTRUCTURALES sobre la fuente, igual que los de SCRUM-132. No prueban el
 * render: prueban que no vuelvan las dos regresiones concretas que rompen esta fase.
 */

test('SCRUM-139 F2: el editor arranca con varias líneas dibujadas, no con una', () => {
  const m = src.match(/const\s+LINEAS_CUADERNILLO\s*=\s*(\d+)/);
  assert.ok(m, 'no existe LINEAS_CUADERNILLO: el número de líneas del cuadernillo debe ser explícito y de un solo sitio');
  assert.ok(
    Number(m[1]) >= 2,
    `LINEAS_CUADERNILLO = ${m[1]}: con una sola línea esto vuelve a ser una hoja en blanco con un botón, que es justo lo que SCRUM-139 F2 retira`
  );
});

test('SCRUM-139 F2: el cuadernillo se dibuja al arrancar Y al reiniciar el formulario', () => {
  const llamadas = (src.match(/dibujarCuadernillo\(\)/g) || []).length;
  // 1 definición + arranque + reset = 3 apariciones mínimo.
  assert.ok(
    llamadas >= 3,
    `dibujarCuadernillo() aparece ${llamadas} veces; "empezar de cero" debe devolver el cuadernillo, no una línea suelta`
  );
});

test('SCRUM-139 F2: nadie vuelve a asumir "hay UNA fila y está vacía"', () => {
  // La comprobación vieja miraba si había exactamente 1 fila. Con 3 vacías de salida eso es
  // falso siempre: plantillas e IA habrían cargado sus líneas DEBAJO de las tres vacías.
  const fragil = /existingRows\.length\s*===\s*1/;
  assert.ok(
    !fragil.test(src),
    'vuelve el patrón "existingRows.length === 1": con el cuadernillo deja líneas vacías por delante de las de la plantilla/IA'
  );
});

test('SCRUM-139 F2: plantilla e IA deciden por "editor en blanco", no por número de filas', () => {
  assert.ok(/function\s+editorEnBlanco\s*\(/.test(src), 'falta el helper editorEnBlanco()');
  const usos = (src.match(/editorEnBlanco\(\)/g) || []).length;
  assert.ok(
    usos >= 3,
    `editorEnBlanco() se usa ${usos - 1} vez/veces; deben pasar por él AMBOS caminos que cargan líneas (plantilla e IA)`
  );
});

test('SCRUM-139 F2: cargar una plantilla no borra en silencio lo que el usuario ya escribió', () => {
  // Regresión real corregida en F2: un `else { linesBody.innerHTML=''; lines=[] }` vaciaba
  // TODO en cuanto hubiera 2+ filas, contradiciendo el propio aviso de la pantalla.
  //
  // Este guard mira el FICHERO ENTERO a propósito. La primera versión recortaba el bloque de
  // la plantilla entre dos anclas de texto y una de ellas ('líneas añadidas') casaba antes con
  // el COMENTARIO que explica el arreglo: el guard se leía a sí mismo y pasaba en verde con la
  // regresión puesta (lo cazó la prueba en rojo, no la revisión). Nada de anclar en prosa:
  // vaciar el editor dentro de un `else` no es correcto en ningún camino de esta pantalla.
  const vaciadoIncondicional = /else\s*\{[^{}]*linesBody\.innerHTML\s*=\s*['"`]['"`]\s*;[^{}]*lines\s*=\s*\[\]/;
  assert.ok(
    !vaciadoIncondicional.test(src),
    'un `else` vuelve a vaciar el editor de líneas: destruye en silencio lo que el usuario ya escribió'
  );
});

test('SCRUM-139 F2: el renglón en blanco lo marca el JS y lo dibuja el CSS — las dos mitades o ninguna', () => {
  // Guard CRUZADO. El renglón en blanco es un pacto entre dos ficheros: recalcTotals pone y
  // quita .quote-line--vacia, y styles.css es quien lo apaga y lo colapsa. Si desaparece una
  // mitad la otra queda muda EN SILENCIO: sin la clase, el móvil vuelve a los ~400 px por
  // renglón vacío (medido) y el cuadernillo deja de caber en pantalla; sin el CSS, la clase
  // no hace nada. Ninguna de las dos roturas da error en consola.
  assert.ok(
    /classList\.toggle\(\s*["']quote-line--vacia["']/.test(src),
    'recalcTotals ya no marca .quote-line--vacia: el CSS del renglón en blanco queda muerto'
  );
  assert.ok(
    /\.quote-line--vacia\b/.test(css),
    'styles.css ya no define .quote-line--vacia: el JS marca una clase que no pinta nada'
  );
  assert.ok(
    /quote-line--vacia:not\(:focus-within\)/.test(css),
    'se pierde el colapso del renglón vacío: sin él, tres renglones en blanco ocupan ~1.200 px en un móvil de 390 px'
  );
  assert.ok(
    /:focus-within/.test(css) && css.indexOf('.quote-line--vacia') !== -1,
    'el renglón colapsado debe volver a desplegarse al enfocarlo, o esconde campos sin salida'
  );
});
