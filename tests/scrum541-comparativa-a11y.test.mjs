// tests/scrum541-comparativa-a11y.test.mjs — SCRUM-541
//
// LA RED QUE SÍ CORRE SIEMPRE. El árbitro de verdad es `npm run guard:a11y-comparativa`, que mide
// el ÁRBOL DE ACCESIBILIDAD RENDERIZADO en Edge. Este fichero NO lo sustituye: la suite no
// arranca un navegador (misma decisión que guard:contraste, guard:caja-avisos, guard:aviso-bizum
// y guard:vias-de-cobro).
//
// ── QUÉ VIGILA ESTE, ENTONCES ────────────────────────────────────────────────
// Lo que se puede afirmar sin navegador, más una cosa que importa tanto como el resto: QUE EL
// GUARD DE NAVEGADOR NO DESAPAREZCA. Un guard que sólo corre a mano se borra en un `git rm` y
// nadie se entera; la suite es el único sitio donde su ausencia hace ruido.
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR, Y SE DICE CON ESAS PALABRAS ──────────
// 🔴 Que la etiqueta LLEGUE al árbol de accesibilidad NO se comprueba aquí. Un `display:none` en
// `.cmp-lbl` dejaría este fichero en verde y sacaría la etiqueta del árbol — exactamente el fallo
// que el ticket persigue. Eso sólo lo ve el navegador. Aquí se vigila el marcado y la estructura.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANDING = fs.readFileSync(path.join(RAIZ, 'public', 'index.html'), 'utf8');

/** Cada celda con su columna y el trozo de HTML que la forma. */
function celdas() {
  return [...LANDING.matchAll(/<div class="cmp-cell( cmp-yaqu)?">([\s\S]*?)<\/div>/g)]
    .map((m) => ({ columna: m[1] ? 'Con YaQu' : 'Tu método actual', html: m[2] }));
}
function filas() {
  return [...LANDING.matchAll(/<div class="cmp-row" data-fila="([a-z-]+)"([^>]*)>/g)]
    .map((m) => ({ id: m[1], attrs: m[2] }));
}

// ── ① EL SUELO ──────────────────────────────────────────────────────────────
test('SCRUM-541 · SUELO: el extractor encuentra las celdas y las filas', () => {
  assert.ok(celdas().length >= 12,
    `🔴 CIEGO: se han encontrado ${celdas().length} celdas y se esperaban 12 (6 filas × 2). ` +
    'El verde de abajo no significaría «todas están etiquetadas», sino «no se miró».');
  assert.equal(filas().length, 6, '🔴 CIEGO: no se encuentran las 6 filas de la comparativa.');
});

// ── ② LA ETIQUETA, EN CADA CELDA Y SEPARADA ─────────────────────────────────
test('SCRUM-541 · cada celda trae su etiqueta de columna, y NO pegada al texto', () => {
  const malas = [];
  for (const [i, c] of celdas().entries()) {
    const m = /<span class="cmp-lbl">([^<]+)<\/span>(.?)/.exec(c.html);
    if (!m) { malas.push(`celda ${i} (${c.columna}): NO tiene .cmp-lbl`); continue; }
    if (m[1].trim() !== c.columna) malas.push(`celda ${i}: la etiqueta dice «${m[1]}» y su columna es «${c.columna}»`);
    // El separador. Medido en el árbol: sin él se oye "Tu método actualTu palabra contra la suya",
    // y un sintetizador pronuncia "actualTu" como una sola palabra.
    if (m[2] !== ' ') malas.push(`celda ${i} (${c.columna}): la etiqueta va PEGADA al texto (falta el espacio tras </span>)`);
  }
  assert.deepEqual(malas, [],
    '🔴 CELDAS SIN SU ETIQUETA DE COLUMNA BIEN PUESTA:\n    ' + malas.join('\n    ') +
    '\n\n  En una comparativa esto no confunde: INVIERTE el mensaje. Quien no ve la tabla puede\n' +
    '  entender que el problema es lo que ofrecemos nosotros.');
});

// ── ③ LA FILA AGRUPA, Y SU aria-labelledby RESUELVE ─────────────────────────
// Un `aria-labelledby` que apunta a un id inexistente no da error en ninguna parte: simplemente
// no nombra nada. Se ve idéntico en el fuente a uno que funciona.
test('SCRUM-541 · cada fila es un grupo nombrado por su situación, y el id EXISTE', () => {
  const malas = [];
  for (const f of filas()) {
    if (!/role="group"/.test(f.attrs)) { malas.push(`fila "${f.id}": sin role="group"`); continue; }
    const m = /aria-labelledby="([^"]+)"/.exec(f.attrs);
    if (!m) { malas.push(`fila "${f.id}": sin aria-labelledby`); continue; }
    if (!LANDING.includes(`id="${m[1]}"`)) {
      malas.push(`fila "${f.id}": aria-labelledby="${m[1]}" apunta a un id QUE NO EXISTE`);
    }
  }
  assert.deepEqual(malas, [],
    '🔴 FILAS QUE NO ATAN SUS DOS RESPUESTAS A SU PREGUNTA:\n    ' + malas.join('\n    '));
});

// ── ④ QUE EL ÁRBITRO DE VERDAD SIGA AHÍ ─────────────────────────────────────
test('SCRUM-541 · el guard de navegador existe y sigue registrado en package.json', () => {
  const script = path.join(RAIZ, 'scripts', 'guard-a11y-comparativa.mjs');
  assert.ok(fs.existsSync(script),
    '🔴 falta `scripts/guard-a11y-comparativa.mjs`. Es el ÚNICO que mira el árbol de accesibilidad ' +
    'renderizado; sin él, lo de arriba comprueba el marcado y nadie comprueba lo que se oye.');

  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['guard:a11y-comparativa'], 'node scripts/guard-a11y-comparativa.mjs',
    '🔴 el guard ya no está registrado en package.json: existiría el fichero y no lo lanzaría nadie.');

  // Y que conserve su control negativo: un guard que no sabe fallar es decoración.
  const fuente = fs.readFileSync(script, 'utf8');
  assert.match(fuente, /ETIQUETA QUE NO EXISTE/,
    '🔴 el guard ha perdido su CONTROL NEGATIVO. Sin él, «lee bien» y «no lee nada» darían el mismo verde.');
  assert.match(fuente, /toLocaleUpperCase/,
    '🔴 el guard ha perdido la comparación insensible a mayúsculas. El árbol devuelve la etiqueta ' +
    'en MAYÚSCULAS por el `text-transform` del CSS: sin esto da rojo permanente sin nada roto, y ' +
    'el segundo que lo vea lo desactiva.');
});
