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

/**
 * Cada celda con su columna, su fila y el trozo de HTML que la forma.
 *
 * La fila se arrastra a propósito: el primer intento identificaba las celdas por su índice y el
 * rojo decía «celda 7», que obliga a contar `<div>` a mano para saber cuál es. El guard de
 * navegador ya nombraba «fila "historial-cliente" · columna «Con YaQu»»; que la red diga menos
 * que el guard es una diferencia gratuita entre dos mensajes del mismo defecto.
 */
function celdas() {
  const out = [];
  for (const f of [...LANDING.matchAll(/<div class="cmp-row" data-fila="([a-z-]+)"[\s\S]*?\n      <\/div>/g)]) {
    for (const c of f[0].matchAll(/<div class="cmp-cell( cmp-yaqu)?">([\s\S]*?)<\/div>/g)) {
      out.push({ fila: f[1], columna: c[1] ? 'Con YaQu' : 'Tu método actual', html: c[2] });
    }
  }
  return out;
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

// ── ② LA ETIQUETA, EN CADA CELDA ────────────────────────────────────────────
//
// 🔴 SCRUM-550 · EL MENSAJE DE ESTE TEST AFIRMABA ALGO QUE NADIE HABÍA MEDIDO.
// Decía: «Medido en el árbol: sin él se oye "Tu método actualTu palabra contra la suya"». Se
// había leído la SERIALIZACIÓN CRUDA del árbol —que concatena los nodos de texto hermanos tal
// cual— en vez del nombre accesible computado, que es lo que un lector de pantalla anuncia.
//
// Al medirlo con `accname` salieron LOS CUATRO CASOS, y ninguno de los dos mecanismos es «el
// que separa»: SON DOS REDES, y hace falta perder LAS DOS para que el texto se pegue.
//
//     display:block + espacio  → «TU MÉTODO ACTUAL Tu palabra contra la suya.»
//     display:block SIN espacio→ «TU MÉTODO ACTUAL Tu palabra contra la suya.»   (el block basta)
//     display:inline + espacio → «TU MÉTODO ACTUAL Tu palabra contra la suya.»   (el espacio basta)
//     display:inline SIN espacio → «TU MÉTODO ACTUALTu palabra contra la suya.»  🔴 PEGADO
//
// (En el cuarto caso, a 1280 px sigue separando: ahí la etiqueta lleva `position:absolute` de la
// media query, que la saca del flujo inline. El pegado sale a 360. Los dos anchos NO se comportan
// igual, que es justo lo que el guard de navegador existe para ver.)
//
// Por eso se exigen LAS DOS y se dice por qué. La primera versión de este arreglo iba a retirar
// la exigencia del espacio por «inerte» — y habría dejado el sistema con una sola red, creyendo
// que quitaba ruido.
test('SCRUM-541 · cada celda trae su etiqueta de columna, con sus DOS redes de separación', () => {
  const malas = [];
  for (const c of celdas()) {
    const donde = `fila "${c.fila}" · columna «${c.columna}»`;
    const m = /<span class="cmp-lbl">([^<]+)<\/span>(.?)/.exec(c.html);
    if (!m) { malas.push(`${donde}: NO tiene .cmp-lbl`); continue; }
    if (m[1].trim() !== c.columna) malas.push(`${donde}: la etiqueta dice «${m[1]}», que no es su columna`);
    if (m[2] !== ' ') malas.push(`${donde}: falta el espacio tras </span> (RED 1 de 2)`);
  }
  assert.deepEqual(malas, [],
    '🔴 CELDAS SIN SU ETIQUETA DE COLUMNA BIEN PUESTA:\n    ' + malas.join('\n    ') +
    '\n\n  En una comparativa esto no confunde: INVIERTE el mensaje. Quien no ve la tabla puede\n' +
    '  entender que el problema es lo que ofrecemos nosotros.\n' +
    '  ⚠️ Con `.cmp-lbl` en `display:block` esta red sola no cambia nada — pero es la que queda\n' +
    '  si mañana alguien toca ese display. No se retira: se sostienen las dos.');

  assert.match(LANDING, /\.cmp-lbl\{display:block/,
    '🔴 `.cmp-lbl` ha dejado de ser `display:block` (RED 2 de 2). Con el espacio puesto todavía se\n' +
    '  oye separado, así que esto NO es un defecto por sí solo — pero el sistema se queda con una\n' +
    '  sola red, y el día que se pierda también el espacio se oirá «Tu método actualTu palabra».\n' +
    '  Medido en los cuatro casos (SCRUM-550). Compruébalo con `npm run guard:a11y-comparativa`.');
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
