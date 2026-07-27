import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(raiz, 'public', 'dashboard', 'js', 'quotesView.js'), 'utf8');
const css = fs.readFileSync(path.join(raiz, 'public', 'dashboard', 'css', 'styles.css'), 'utf8');

// Código SIN comentarios: un guard que prohíbe un patrón tiene que mirar el CÓDIGO, no la
// prosa que explica por qué se retiró (trampa de auto-referencia de SCRUM-129).
const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

/**
 * SCRUM-139 F5 — LAS ACCIONES DE LA LÍNEA, AL MENÚ DE AB3.
 *
 * La premisa del ticket ("la línea tiene demasiados botones") era falsa: tenía DOS. Lo cierto
 * es que uno de los dos no funciona en móvil —el arrastre HTML5 se apoya en eventos de ratón—
 * y que la tira de acciones costaba ~45 px por línea. Con Subir/Bajar/Eliminar son tres
 * acciones secundarias, que es el caso que AB3 describe para `overflowMenu`.
 */

test('SCRUM-139 F5: el móvil puede reordenar líneas sin arrastrar', () => {
  assert.ok(/function moverLinea\(/.test(codigo), 'desaparece moverLinea: en móvil el arrastre no se dispara con el dedo, así que reordenar volvería a ser imposible');
  assert.ok(/moverLinea\(lineObj, -1\)/.test(codigo) && /moverLinea\(lineObj, \+1\)/.test(codigo), 'faltan las acciones Subir y/o Bajar');
});

test('SCRUM-139 F5: el orden sigue derivándose del DOM, sin una segunda forma de ordenar', () => {
  // `syncLinesOrder` deriva el array `lines` del orden de las filas, y es lo que ya usaba el
  // arrastre. Si moverLinea reordenara el array por su cuenta habría DOS mecanismos de orden
  // que pueden discrepar, y el que manda en el PDF es el array.
  const cuerpo = codigo.slice(codigo.indexOf('function moverLinea('), codigo.indexOf('function syncLinesOrder'));
  assert.ok(/insertBefore/.test(cuerpo), 'moverLinea ya no mueve el nodo');
  assert.ok(/syncLinesOrder\(\)/.test(cuerpo), 'moverLinea no vuelve a derivar el orden del DOM: el array de líneas puede quedar desparejado del que se ve');
  assert.ok(
    !/lines\.splice|lines\.reverse|lines\[i\]\s*=/.test(cuerpo),
    'moverLinea reordena el array por su cuenta: dos mecanismos de orden que pueden discrepar, y el que va al PDF es el array'
  );
});

test('SCRUM-139 F5: el menú es el helper compartido de AB3, con salida si no está', () => {
  assert.ok(
    /overflowMenu\(\[subirBtn, bajarBtn, removeBtn\]/.test(codigo),
    'las acciones de la línea dejan de usar overflowMenu: se perdería teclado, foco, cierre y la hoja inferior de AB3'
  );
  // Perder el menú no puede costar la posibilidad de BORRAR una línea.
  assert.ok(
    /typeof overflowMenu === "function"/.test(codigo),
    'se da por hecho que overflowMenu está cargado: si no lo estuviera, la línea se quedaría sin forma de borrarse'
  );
  assert.ok(
    /actionsTd\.appendChild\(removeBtn\)/.test(codigo),
    'sin el menú no queda ningún camino visible para eliminar una línea'
  );
});

test('SCRUM-139 F5: Subir/Bajar en los extremos se DESHABILITAN, no se esconden', () => {
  // Mismo criterio que SCRUM-89 con las acciones vetadas por rol: un menú cuyos ítems cambian
  // según la fila obliga a leerlo entero cada vez.
  assert.ok(/subirBtn\.disabled = idx === 0/.test(codigo), 'la primera línea deja de deshabilitar "Subir"');
  assert.ok(/bajarBtn\.disabled = idx === lines\.length - 1/.test(codigo), 'la última línea deja de deshabilitar "Bajar"');
});

test('SCRUM-139 F5: el asa de arrastre no se promete en móvil, pero sigue viva en escritorio', () => {
  const movil = (css.match(/@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\n\}/g) || []).join('\n');
  assert.ok(
    /\.quote-drag-handle\s*\{\s*display:\s*none/.test(movil),
    'el asa vuelve a pintarse en móvil: ahí el arrastre HTML5 no se dispara con el dedo, así que es una promesa falsa'
  );
  assert.ok(
    /dragHandle\.draggable = true/.test(codigo) && /"dragstart"/.test(codigo),
    'se pierde el arrastre de escritorio, donde sí funciona'
  );
});

test('SCRUM-139 F5: las acciones dejan de ocupar una tira a lo ancho de la línea', () => {
  // Ancla a PRINCIPIO DE LÍNEA a propósito: `.quote-line__actions {` a secas casa antes con la
  // regla de F2 que lo lleva dentro (`.quote-line--vacia:not(:focus-within) > .quote-line__actions {`)
  // y el guard acababa leyendo un trozo de CSS que no era el suyo.
  const bloque = css.slice(css.indexOf('\n.quote-line__actions {'), css.indexOf('.quote-line__actions .overflow-trigger'));
  assert.ok(!/grid-column:\s*1\s*\/\s*-1/.test(bloque), 'las acciones vuelven a ocupar la fila entera: ~45 px por línea para un botón');
  assert.ok(!/border-top/.test(bloque), 'vuelve la línea divisoria de la tira de acciones, que ya no separa nada');
  assert.ok(
    /\.quote-line__actions \.overflow-trigger[\s\S]{0,120}?min-height:\s*44px/.test(css),
    'el disparador «⋯» baja de 44 px: `.overflow-trigger` viene con btn-sm y se queda corto para el pulgar (AB6)'
  );
});
