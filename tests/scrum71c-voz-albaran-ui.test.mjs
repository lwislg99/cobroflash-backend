// SCRUM-71 (punto 3) — la pantalla del dictado en obra. Sin gate: lee ficheros.
//
// ⚠️ LO QUE ESTE FICHERO **NO** PUEDE PROBAR, y hay que decirlo antes que nada:
// `docs/VOZ_MATRIX.md` sigue diciendo que **el camino feliz con micrófono real no se ha
// probado NUNCA en ningún dispositivo** — lo único verificado es la degradación, en headless.
// Estos tests fijan el CABLEADO y las decisiones de diseño; que el dictado funcione en un
// Android a pleno sol es verificación humana y sigue pendiente (del fundador).
//
// EL CONTEXTO que decide la forma: el operario dicta en obra, con una mano y guantes. Por eso
// la revisión va en HOJA INFERIOR (bottom sheet de AB3/SCRUM-31 F2) y no en un modal de
// escritorio con checkboxes pequeños. Y por eso «la voz propone, el humano corrige» se lleva
// más lejos que en presupuestos: un presupuesto se rehace, un albarán **lo firma el cliente** y
// desde `emitido` se congela.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');
const VISTA = leer('public', 'dashboard', 'js', 'jobDetailView.js');
const CODIGO = soloEjecutable(VISTA); // principio 10
const CSS = leer('public', 'dashboard', 'css', 'styles.css');

// ── 1. El flag PROPIO gobierna la superficie, y llega al front ───────────────────────────

test('SCRUM-71 · el micro se pinta solo con VOICE_ALBARAN_ENABLED, no con el de presupuestos', () => {
  assert.ok(
    /appVoiceAlbaranEnabled === true/.test(CODIGO),
    '🔴 la pantalla no mira el flag PROPIO del albarán. Reutilizar `appVoiceEnabled` ataría las ' +
      'dos voces: apagar la del albarán apagaría la del presupuesto, y son riesgos distintos ' +
      '(el albarán lo firma el cliente y se congela).',
  );
  assert.ok(
    /voiceAlbaranEnabled/.test(leer('src', 'app.ts')),
    '🔴 `/admin/me` no sirve el flag: sin eso `window.appVoiceAlbaranEnabled` es undefined y el ' +
      'micro no se pintaría NUNCA — un flag que no llega es una función muerta, no una apagada.',
  );
  assert.ok(/appVoiceAlbaranEnabled/.test(leer('public', 'dashboard', 'js', 'app.js')));
});

test('SCRUM-71 · sin soporte del navegador el micro NO se pinta (degradación silenciosa)', () => {
  assert.ok(
    /voiceSupportProbe\(\)/.test(CODIGO) && /attachVoiceInput/.test(CODIGO),
    '🔴 falta el gate de VZ-1. Sin él se pintaría un micro en navegadores donde la API no ' +
      'existe o está rota (iOS en PWA): un botón roto en obra es peor que no tenerlo.',
  );
});

// ── 2. Hoja inferior, no modal de escritorio ─────────────────────────────────────────────

test('SCRUM-71 · la revisión usa el bottom sheet de AB3, no un componente nuevo', () => {
  assert.ok(
    /overlay\.className = 'modal-overlay'/.test(CODIGO),
    '🔴 no reutiliza `.modal-overlay`/`.modal` del inventario AB3',
  );
  // Es lo que convierte el modal en hoja inferior por debajo de 640px (SCRUM-31 F2).
  assert.ok(
    /max-width:\s*639px[\s\S]{0,400}slide-from-bottom/.test(CSS),
    '🔴 el CSS ya no convierte `.modal` en bottom sheet en móvil: la revisión volvería a ser un ' +
      'diálogo centrado, que es justo lo que se descartó para alguien con una mano en obra.',
  );
});

test('SCRUM-71 · los targets son de pulgar, no de ratón', () => {
  const enBloque = CODIGO.slice(CODIGO.indexOf('abrirHojaDictado'));
  const min44 = (enBloque.match(/min-height:44px/g) || []).length;
  assert.ok(
    min44 >= 3,
    `🔴 solo ${min44} controles declaran 44 px de alto. AB6 los exige, y aquí no es cosmético: ` +
      `se pulsa con guantes.`,
  );
  assert.ok(
    /width:20px;height:20px/.test(enBloque),
    '🔴 los checkboxes vuelven a ser del tamaño por defecto (~16 px). En obra no se acierta.',
  );
});

// ── 3. «La voz propone, el humano corrige» ───────────────────────────────────────────────

test('SCRUM-71 · las líneas aceptadas caen en el editor EDITABLE, no se guardan solas', () => {
  assert.ok(
    /rows\.appendChild\(mkRow\(\{/.test(CODIGO),
    '🔴 las líneas propuestas deben aterrizar en `mkRow` —las filas que el pro ya edita y que no ' +
      'se persisten hasta que pulse guardar—, no escribirse por su cuenta. Un albarán lo firma ' +
      'el cliente: la última palabra es del humano.',
  );
  // El bloque del dictado, ACOTADO. La primera versión de este assert cortaba hasta el final
  // del fichero y capturaba el modal de facturación parcial que vive más abajo — un guard
  // sobre-dimensionado que acusaba código legítimo. Se acota entre el nombre de la función y
  // su última línea.
  const BLOQUE = CODIGO.slice(
    CODIGO.indexOf('function abrirHojaDictado'),
    CODIGO.indexOf('Líneas añadidas'),
  );
  const llamadas = [...BLOQUE.matchAll(/apiRequest\('([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(
    llamadas,
    ['/admin/ai/suggest-albaran-lines'],
    `🔴 el dictado llama a algo más que al extractor (${llamadas.join(', ')}). No puede guardar ` +
      `ni emitir nada por su cuenta: propone, y guarda el humano.`,
  );
});

test('SCRUM-71 · se puede rechazar línea a línea antes de añadirlas', () => {
  const enBloque = CODIGO.slice(CODIGO.indexOf('pintarPropuesta'));
  assert.ok(/type = 'checkbox'/.test(enBloque) && /m\.chk\.checked/.test(enBloque),
    '🔴 no hay forma de descartar una línea propuesta: sería «la voz decide», no «la voz propone»');
});

// ── 4. SIN_VALORAR: la pantalla no contradice al saneado ─────────────────────────────────

test('SCRUM-71 · en SIN_VALORAR no se muestra ni se arrastra precio', () => {
  const enBloque = CODIGO.slice(CODIGO.indexOf('pintarPropuesta'));
  assert.ok(
    /modo === 'VALORADO' && l\.precioUnitario != null/.test(enBloque),
    '🔴 el detalle de la línea propuesta enseña precio sin comprobar el modo. El saneado del ' +
      'servidor ya lo quita en SIN_VALORAR, así que la pantalla estaría enseñando un precio que ' +
      'NO se va a guardar — peor que no enseñarlo: promete algo que no ocurre.',
  );
  assert.ok(
    /\.\.\.\(modo === 'VALORADO'/.test(enBloque),
    '🔴 se arrastra precio/IVA a la fila nueva sin mirar el modo',
  );
});

// ── 5. El texto viene de un modelo: se escapa ────────────────────────────────────────────

test('SCRUM-71 · el concepto propuesto se escapa antes de ir a innerHTML', () => {
  assert.ok(
    /escVoz\(l\.concepto\)/.test(CODIGO),
    '🔴 el concepto va a `innerHTML` sin escapar. Viene de un MODELO DE LENGUAJE a partir de lo ' +
      'que alguien dictó: es la entrada menos controlada de la pantalla.',
  );
  assert.ok(
    /const escVoz = /.test(CODIGO),
    '🔴 el escape debe ser local, no un global de otro fichero (lección de SCRUM-153c: una ' +
      'dependencia invisible cuyo fallo es inyección de HTML, no un error visible)',
  );
});

// ── 6. Recordatorio ejecutable: la matriz de móviles sigue pendiente ─────────────────────

test('SCRUM-71 · la verificación en móvil real SIGUE PENDIENTE (y es del fundador)', () => {
  const matriz = leer('docs', 'VOZ_MATRIX.md');
  if (/⏳\s*(HUMANO|pendiente)/.test(matriz)) {
    assert.ok(true); // sigue pendiente: esta pantalla NO está verificada en un móvil de verdad
  } else {
    assert.fail(
      'La matriz de VOZ_MATRIX.md ya no tiene pendientes: toca revisar esta pantalla contra los ' +
        'dispositivos reales y, si va bien, borrar este test.',
    );
  }
});
