import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFuente } from './_guard-texto.mjs'; // SCRUM-193

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = leerFuente(path.join(raiz, 'public', 'dashboard', 'js', 'quotesView.js'));
const css = leerFuente(path.join(raiz, 'public', 'dashboard', 'css', 'styles.css'));

// Código SIN comentarios: un guard que prohíbe un patrón tiene que mirar el CÓDIGO, no la prosa
// que explica por qué se retiró (trampa de auto-referencia de SCRUM-129).
const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

/**
 * SCRUM-139 F6 — PLANTILLAS A UN TOQUE.
 */

test('SCRUM-139 F6: cargar una plantilla tiene UN solo camino', () => {
  // EL GUARD QUE IMPORTA. Ahora hay dos disparadores (fichas y modal) y lo que se ejecuta al
  // cargar no es cosmético: lleva dentro la lectura CRUDA de `l.tax` (SCRUM-132 — con `|| 0`
  // una línea sin IVA se emitía al 0 %) y el "vaciar solo si está en blanco" (F2 — el `else`
  // viejo destruía en silencio lo ya escrito). Duplicar ese bloque es garantizar que una de
  // las dos copias se quede sin una de esas dos correcciones, cada una con su propio ticket.
  const cargas = (codigo.match(/addLine\(\{ concept: l\.concept/g) || []).length;
  assert.equal(
    cargas, 1,
    `hay ${cargas} copias del bucle que carga una plantilla; debe haber UNA (cargarPlantilla), o una de ellas se quedará sin la lectura cruda de l.tax (SCRUM-132) o sin el vaciado condicional (F2)`
  );
  assert.ok(/function cargarPlantilla\(/.test(codigo), 'desaparece cargarPlantilla: vuelve la lógica suelta en cada disparador');
  assert.ok(/cargarPlantilla\(tpl\)/.test(codigo), 'el modal deja de usar el camino compartido');
});

test('SCRUM-139 F6: la carga por ficha conserva las correcciones de SCRUM-132 y F2', () => {
  const carga = codigo.slice(codigo.indexOf('function cargarPlantilla('), codigo.indexOf('async function pintarPlantillasRapidas'));
  assert.ok(/editorEnBlanco\(\)/.test(carga), 'la carga deja de vaciar solo si el editor está en blanco: destruiría líneas ya escritas (regresión de F2)');
  assert.ok(/tax: l\.tax/.test(carga), 'la carga deja de pasar `tax` crudo: con `|| 0` una línea sin IVA se emite al 0 % (regresión de SCRUM-132)');
  assert.ok(!/l\.tax\s*\|\|\s*0/.test(carga), 'vuelve `l.tax || 0`, que es exactamente el bug que cerró SCRUM-132');
});

test('SCRUM-139 F6: las fichas y el botón de la cabecera no dicen lo mismo', () => {
  // Hasta 3 plantillas, las fichas SON la lista completa y el botón abriría un modal con esas
  // mismas tres. A partir de ahí el botón pasa a ser "ver las N".
  assert.ok(/templates\.slice\(0, 3\)/.test(codigo), 'cambia el tope de fichas sin revisar la regla de convivencia con el botón de la cabecera');
  assert.ok(/useTemplateBtn\.hidden = true/.test(codigo), 'con 3 plantillas o menos, el botón deja de esconderse y duplica lo que ya hay a la vista');
  assert.ok(/Ver las \$\{templates\.length\}/.test(codigo), 'con más de 3 plantillas el botón no pasa a ser "ver las N"');
});

test('SCRUM-139 F6: un atajo que falla no molesta al usuario', () => {
  // Las fichas son un ATAJO, no algo que el usuario haya pedido: si la petición falla, el
  // camino del modal sigue entero y un aviso de error sería ruido por algo que nadie pidió.
  const pintar = codigo.slice(codigo.indexOf('async function pintarPlantillasRapidas'), codigo.indexOf('pintarPlantillasRapidas();'));
  assert.ok(/catch/.test(pintar), 'la carga de las fichas deja de estar protegida: un fallo del endpoint rompería el editor entero');
  assert.ok(!/setAlert\(/.test(pintar), 'las fichas avisan de su propio fallo: es un atajo, y el camino del modal sigue disponible');
});

test('SCRUM-139 F6: el rótulo de las fichas no miente a mitad de presupuesto', () => {
  assert.ok(
    /editorEnBlanco\(\)\s*\?\s*'Empieza con una plantilla'/.test(codigo),
    'el rótulo se queda fijo: "Empieza con una plantilla" sobre un presupuesto a medio escribir es falso, y esconde que las líneas se AÑADEN'
  );
});

test('SCRUM-139 F6: las fichas no usan el idioma visual de "crear" ni estilos en línea', () => {
  const chip = css.slice(css.indexOf('.quote-plantilla-chip {'), css.indexOf('.quote-plantilla-chip:hover'));
  assert.ok(!/dashed/.test(chip), 'la ficha vuelve al borde discontinuo, RESERVADO desde F2 a "+ Añadir línea" (crear)');
  assert.ok(/min-height:\s*44px/.test(chip), 'la ficha baja de 44 px de target (AB6)');
  assert.ok(
    !/useTemplateBtn\.style\.cssText|saveTemplateBtn\.style\.cssText/.test(codigo),
    'vuelven los estilos EN LÍNEA a los botones de plantilla (AB3: cero estilos inline aleatorios)'
  );
});
