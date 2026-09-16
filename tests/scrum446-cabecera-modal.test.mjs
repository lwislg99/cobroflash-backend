// tests/scrum446-cabecera-modal.test.mjs — SCRUM-446
//
// LA CABECERA DE UN MODAL SALE DE UN SOLO SITIO.
//
// ── PARA QUÉ ────────────────────────────────────────────────────────────────────────────────
// Había **24 cabeceras escritas a mano en 16 ficheros**. Mientras sean 24, el «?» de SCRUM-416 y su
// manejador habría que meterlos 24 veces — y a la 25ª cabecera nueva, nadie se acordaría. Por eso el
// constructor devuelve un **nodo** y no una cadena: una cadena no puede llevar comportamiento, y las
// siete cabeceras que se construyen con `createElement` habrían quedado fuera.
//
// ── LO QUE VIGILA ───────────────────────────────────────────────────────────────────────────
// Que nadie vuelva a escribir una a mano. **Derivado del árbol, sin lista blanca**: cualquier
// fichero de `public/dashboard/js/` que produzca marcado de cabecera sin pasar por el constructor
// sale nombrado.
//
// ── LOS TRES OVERLAYS PROPIOS, QUE NO SE UNIFICAN ───────────────────────────────────────────
// `signaturePad`, `onboardingView` y `tutorial` **no usan el modal compartido**: montan su propio
// overlay. No entran en el constructor y **se declaran aquí**, porque la información que llevan es
// la que impide dar SCRUM-416 por resuelto a medias:
//
//   **La ayuda está oculta hoy por DOS mecanismos distintos.** En los modales compartidos, por
//   `display:none !important` (`styles.css:2173`). En la firma, **no está oculta: está DEBAJO** —
//   su overlay va a `z-index: 1200` y el FAB a `350`.
//
// Quien arregle solo el primero verá desaparecer el síntoma en 24 de 27 sitios y lo dará por
// resuelto. Está escrito aquí para que el guard lo recuerde cuando nadie lo haga.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIR = path.join(RAIZ, 'public/dashboard/js');
const CONSTRUCTOR = 'modalHeader.js';

/** Cabeceras escritas a mano, por fichero. El constructor queda fuera: es quien las hace. */
function cabecerasAMano() {
  const fuera = [];
  let ficheros;
  try {
    ficheros = fs.readdirSync(DIR).filter((f) => f.endsWith('.js'));
  } catch (e) {
    assert.fail(
      `🔴 no se pudo leer ${DIR} (${e && e.code ? e.code : e}).\n\n`
      + '  «Ninguna a mano» y «no supe leer el directorio» son el mismo verde.');
  }
  for (const f of ficheros) {
    if (f === CONSTRUCTOR) continue;
    // ⚠️ SIN COMENTARIOS. Media docena de estos ficheros EXPLICAN en su cabecera que la cabecera
    // sale del constructor, y un guard de texto no distingue la prohibición de su explicación
    // (SCRUM-203, que en este repo ya ha mordido siete veces).
    const codigo = soloEjecutable(fs.readFileSync(path.join(DIR, f), 'utf8'));
    // Las dos formas de escribir una: en marcado, o construyendo el nodo.
    const enMarcado = (codigo.match(/<div class="modal-header"/g) || []).length;
    const enDom = (codigo.match(/className\s*=\s*['"]modal-header['"]|createElement\([^)]*['"]modal-header['"]/g) || []).length;
    if (enMarcado + enDom > 0) fuera.push(`${f} (${enMarcado} en marcado, ${enDom} en DOM)`);
  }
  return { fuera, ficheros };
}

/** Cuántas llamadas al constructor hay, y desde cuántos ficheros. */
function usosDelConstructor() {
  const porFichero = new Map();
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.js'))) {
    if (f === CONSTRUCTOR) continue;
    const codigo = soloEjecutable(fs.readFileSync(path.join(DIR, f), 'utf8'));
    const n = (codigo.match(/cabeceraModal\(/g) || []).length;
    if (n) porFichero.set(f, n);
  }
  return porFichero;
}

test('SCRUM-446 · SUELO: el detector ve ficheros y ve cabeceras', () => {
  // Sabemos que hay 24 en 16 ficheros. Si el escáner devolviera cero de todo, «ninguna a mano»
  // significaría «no miré ninguna» — y eso es lo mismo que un verde regalado.
  const { ficheros } = cabecerasAMano();
  assert.ok(ficheros.length >= 20,
    `🔴 solo ${ficheros.length} ficheros leídos en ${DIR}: el detector no está mirando donde cree`);
  const usos = usosDelConstructor();
  const total = [...usos.values()].reduce((a, b) => a + b, 0);
  assert.ok(total >= 20,
    `🔴 solo ${total} llamadas al constructor: eran 24. O se han perdido cabeceras por el camino, o `
    + 'el detector dejó de encontrarlas — y en los dos casos lo de abajo no significa nada.');
  assert.ok(usos.size >= 14,
    `🔴 solo ${usos.size} ficheros usan el constructor: eran 16`);
});

test('SCRUM-446 · ninguna cabecera de modal se escribe a mano', () => {
  const { fuera } = cabecerasAMano();
  assert.deepEqual(
    fuera, [],
    '🔴 HAY CABECERAS DE MODAL ESCRITAS A MANO:\n    ' + fuera.join('\n    ')
    + '\n\n  Van por `cabeceraModal({ titulo, idCierre?, idTitulo?, alCerrar?, sinCierre?,\n'
    + '  etiquetaCierre? })` de `modalHeader.js`, que devuelve el nodo listo para insertar:\n\n'
    + "      raiz.querySelector('.modal').prepend(cabeceraModal({ titulo: '…' }));\n\n"
    + '  No es una manía de estilo: mientras haya cabeceras sueltas, el «?» de la ayuda (SCRUM-416)\n'
    + '  y su manejador hay que meterlos en cada una — y a la siguiente que se escriba, nadie se\n'
    + '  acordará. Ése es el defecto que este constructor existe para cerrar.');
});

test('SCRUM-446 · el constructor pone `<h3>`, y eso cambia lo que se OYE', () => {
  // Antes había cuatro etiquetas de título: h3 ×12, span ×5, div ×5, otras 2. No es cosmético: un
  // lector de pantalla anuncia el `h3` como ENCABEZADO y no anuncia nada de un `span`. Se adoptó la
  // mayoría existente —nada de inventar `h2`— y **doce cabeceras pasan a anunciarse**.
  const s = fs.readFileSync(path.join(DIR, CONSTRUCTOR), 'utf8');
  assert.match(soloEjecutable(s), /createElement\('h3'\)/,
    '🔴 el título ha dejado de ser `<h3>`. Si se cambia a `span` o `div`, doce modales dejan de '
    + 'anunciarse como encabezado para quien usa lector de pantalla: es una decisión de '
    + 'accesibilidad (AB6), no un detalle de marcado.');
});

test('SCRUM-446 · el botón de cierre es OPCIONAL, y hay quien no lo tiene', () => {
  // `customerDetailView` y una de `quotesView` no tienen botón hoy, y siguen sin tenerlo: si su
  // ausencia era deliberada se respeta, y si fue descuido es otro ticket con su propia víctima.
  // **Un refactor no decide comportamiento.**
  const s = soloEjecutable(fs.readFileSync(path.join(DIR, CONSTRUCTOR), 'utf8'));
  assert.match(s, /if \(!opciones\.sinCierre\)/,
    '🔴 el botón ha dejado de ser opcional: o se le añade uno a quien no lo tenía, o se le quita a '
    + 'las otras 22. Las dos cosas son cambiar comportamiento en un refactor.');
  const usan = [...fs.readdirSync(DIR)]
    .filter((f) => f.endsWith('.js') && f !== CONSTRUCTOR)
    .filter((f) => /sinCierre:\s*true/.test(soloEjecutable(fs.readFileSync(path.join(DIR, f), 'utf8'))));
  assert.ok(usan.length >= 2,
    `🔴 solo ${usan.length} cabeceras sin botón: eran 2 (customerDetailView y una de quotesView). Si `
    + 'han perdido la opción, se les ha añadido un botón que no tenían.');
});

test('SCRUM-446 · el `aria-labelledby` de los tres modales sigue apuntando a algo', () => {
  // 🔴 LA REGRESIÓN QUE ESTA MIGRACIÓN LLEGÓ A INTRODUCIR, y que cazó medir: tres modales llevan
  // `aria-labelledby` al id del título. Al pasar por el constructor, dos perdieron ese id y la
  // referencia quedó apuntando a nada — el modal se queda SIN NOMBRE ACCESIBLE, en silencio.
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.js'))) {
    const codigo = soloEjecutable(fs.readFileSync(path.join(DIR, f), 'utf8'));
    for (const m of codigo.matchAll(/aria-labelledby="([^"]+)"/g)) {
      const id = m[1];
      const declarado = new RegExp(`idTitulo:\\s*['"]${id}['"]|id="${id}"`).test(codigo);
      assert.ok(declarado,
        `🔴 ${f}: un modal dice \`aria-labelledby="${id}"\` y NADIE declara ese id. La referencia `
        + 'apunta a nada y el modal se queda sin nombre accesible.\n\n'
        + `  Si la cabecera pasa por el constructor, pásale \`idTitulo: '${id}'\`.`);
    }
  }
});

test('SCRUM-446 · los TRES overlays propios se declaran, no se unifican', () => {
  // No usan el modal compartido: montan su propio overlay, así que el constructor no los alcanza.
  // Se comprueba que siguen existiendo, porque el día que uno se pase al modal compartido hay que
  // decidirlo — no descubrirlo.
  const propios = ['signaturePad.js', 'onboardingView.js', 'tutorial.js'];
  const faltan = propios.filter((f) => !fs.existsSync(path.join(DIR, f)));
  assert.deepEqual(faltan, [],
    '🔴 han desaparecido overlays declarados como propios: ' + faltan.join(', ')
    + '\n\n  Si se han unificado con el modal compartido, quítalos de esta lista Y revisa que la\n'
    + '  ayuda de SCRUM-416 les llegue: hasta hoy NO les llegaba, y por dos motivos distintos.');

  // Y la mitad que de verdad importa: los DOS mecanismos de ocultación, para que nadie dé
  // SCRUM-416 por resuelto arreglando solo uno. Y se comprueban DONDE VIVEN, que no es donde yo
  // supuse al escribir esto: el z-index no está en el CSS, está EN LÍNEA en el JS.
  const css = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
  assert.match(css, /display:\s*none\s*!important/,
    '🔴 ya no está el `display:none !important` que oculta la ayuda en los modales compartidos: si '
    + 'se ha quitado, medio SCRUM-416 puede estar hecho y hay que decirlo, no suponerlo.');

  const firma = fs.readFileSync(path.join(DIR, 'signaturePad.js'), 'utf8');
  assert.match(firma, /z-index:\s*1200/,
    '🔴 ha cambiado el z-index del overlay de la FIRMA (`signaturePad.js`). Ahí la ayuda NO está '
    + 'oculta: está DEBAJO. Si el número cambia, el segundo mecanismo puede haberse arreglado — o '
    + 'roto — sin que nadie lo diga.');
  const fab = fs.readFileSync(path.join(DIR, 'tutorial.js'), 'utf8');
  assert.match(fab, /z-index:\s*350/,
    '🔴 ha cambiado el z-index del FAB de ayuda (`tutorial.js`). Los dos números van juntos: 1200 '
    + 'contra 350 es lo que deja la ayuda por debajo de la firma.');
});
