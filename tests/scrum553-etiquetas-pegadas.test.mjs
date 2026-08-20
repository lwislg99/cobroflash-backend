// tests/scrum553-etiquetas-pegadas.test.mjs — SCRUM-553
//
// Sin gate: lee ficheros. Ni BD, ni red, ni servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUE SE VIGILA, Y POR QUE UN TRINQUETE Y NO UN BARRIDO
//
// Un extractor con el `>` PEGADO (`<section class="hero">`) deja de encontrar la etiqueta en
// cuanto alguien le añade un `id`, un `aria-*` o una clase. Paso cuatro veces en una semana.
//
// 🔴 LA MEDICION DECIDE LA SALIDA, y por eso el ticket pedia medir antes de proponer:
//   · 32 ocurrencias en 21 ficheros — no cuatro. Tras arreglar el fichero del propio
//     incidente (`scrum543-landing-a11y`), 29 en 20.
//   · NINGUNA da verde al no encontrar nada: todas se declaran ciegas o lanzan. El grupo
//     peligroso esta VACIO, y se dice con esas palabras.
//   · 27 de las 32 leen marcado VIVO de `public/`: ahi es donde el disparador benigno ocurre.
//
// Con 0 peligrosas y 27 en riesgo, un barrido de 27 sitios a mano es justo la clase de cambio
// que introduce el defecto numero 5. Asi que: se arregla el fichero del incidente como piloto,
// y el resto queda bajo TRINQUETE — el numero no puede SUBIR sin que alguien lo vea.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  censar, pegadasEn, elMayorEsDeLaEtiqueta, ETIQUETAS_HTML, AUTORREFERENCIA,
} from '../scripts/censo-etiquetas-pegadas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Medido el 20-ago-2026, DESPUES del piloto. Solo puede BAJAR. */
const TOPE = 29;

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · «no hay extractores con el `>` pegado» y «no supe mirar» dan el mismo cero
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-553 · 🔴 SUELO: el censo LEE el árbol antes de dar un número', () => {
  const r = censar(RAIZ);
  assert.ok(r.leidos > 400,
    `🔴 CIEGO: solo se han leído ${r.leidos} ficheros de tests/ y scripts/, y hay más de 600. `
    + 'Si el barrido se rompió, el cero de abajo se leería como «ningún extractor afectado», que '
    + 'es la conclusión más cara que puede dar este fichero.');
  assert.ok(r.html.length > 0,
    '🔴 CIEGO: CERO extractores HTML con el `>` pegado. Sabemos que había cuatro sólo en los '
    + 'incidentes de esta semana, y dos de ellos ya arreglados en SCRUM-543. Un cero aquí '
    + 'significa que el detector dejó de casar, no que el repo esté limpio.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL TRINQUETE
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-553 · 🔴 el número de etiquetas con el `>` pegado NO SUBE', () => {
  const r = censar(RAIZ);
  assert.ok(r.html.length <= TOPE,
    `🔴 HAN APARECIDO EXTRACTORES NUEVOS CON EL \`>\` PEGADO: ${r.html.length} (el tope es ${TOPE}).\n\n`
    + r.html.slice(0, 40).map((h) => `   · ${h.fichero}:${h.linea}  ${h.etiqueta}`).join('\n')
    + '\n\n  Deja hueco a los atributos y no toques lo que vigilas:\n'
    + '      ANTES   /<h1>([\\s\\S]*?)<\\/h1>/\n'
    + '      DESPUÉS /<h1[^>]*>([\\s\\S]*?)<\\/h1>/\n\n'
    + '  Aceptar `<h1 id="x">` NO puede convertirse en aceptar cualquier cosa: se tolera el hueco\n'
    + '  de los atributos y NADA MÁS.');

  if (r.html.length < TOPE) {
    // Bajar es la dirección buena, pero el número no se mueve solo: si baja, alguien arregló
    // algo y el tope tiene que bajar con él, o el trinquete deja de apretar.
    assert.fail(`✅ han bajado a ${r.html.length}. Baja \`TOPE\` a ese número en este fichero: `
      + 'un trinquete que no se ajusta al arreglarlo deja de proteger de lo siguiente.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL HALLAZGO, FIJADO · ninguna da verde al no encontrar nada
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-553 · el reparto por fichero es el medido, y `public/` es donde muerde', () => {
  const r = censar(RAIZ);
  assert.ok(r.ficheros.length <= 20,
    `🔴 el censo toca ${r.ficheros.length} ficheros y se midieron 20. Si ha subido, hay extractores `
    + 'nuevos en ficheros que antes estaban limpios.');
  // Los dos del incidente ya están arreglados y no deben volver a aparecer.
  // 🔴 RESPALDO FUERTE de la negación de abajo (SCRUM-237): un `assert.ok(!…includes(TOKEN))`
  //   con un token concreto que NUNCA aparece en positivo es el bug de scrum73 — pasa en verde
  //   sin comprobar nada si el token está mal escrito. Aquí el hermano positivo del MISMO token
  //   demuestra que el fichero existe, así que el «no está en la lista» significa algo.
  const PILOTO = 'tests/scrum543-landing-a11y.test.mjs';
  assert.ok(fs.existsSync(path.join(RAIZ, PILOTO)),
    `🔴 no existe ${PILOTO}: la negación de abajo sería verdad por vacío, no por limpieza`);
  assert.ok(!r.ficheros.includes(PILOTO),
    `🔴 \`${PILOTO}\` ha vuelto a tener una etiqueta con el \`>\` pegado: es el fichero del `
    + 'incidente y el piloto de este ticket.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL DETECTOR SABE ACUSAR Y SABE ABSOLVER — con las dos trampas que me mordieron a mí
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-553 · CONTROL: acusa al `>` pegado y absuelve al que tolera atributos', () => {
  const acusa = pegadasEn('const m = html.match(/<section class="hero">/);', 'x.mjs');
  assert.equal(acusa.length, 1, '🔴 no ve un `<section class="hero">` con el `>` pegado: está ciego');
  assert.equal(acusa[0].tag, 'section');

  const absuelve = pegadasEn('const m = html.match(/<section[^>]*class="hero"[^>]*>/);', 'x.mjs');
  assert.deepEqual(absuelve, [],
    '🔴 acusa a un patrón que YA tolera atributos. Un guard que marca lo correcto se acaba '
    + 'desactivando, y entonces no protege de nada.');
});

test('SCRUM-553 · 🔴 CONTROL: el `>` de una clase negada NO es el de la etiqueta', () => {
  // 🔴 LA TRAMPA QUE INFLÓ MI PRIMERA MEDICIÓN de 32 a 50. En `<h3[^>]*>` el primer `>` está
  // DENTRO de la clase negada; el hueco capturado es `[^` y ninguna marca de tolerancia casa,
  // así que se contaban como «pegados» justo los patrones que ya toleran atributos.
  assert.equal(elMayorEsDeLaEtiqueta('[^'), false, '🔴 da por cerrado un `[` que sigue abierto');
  assert.equal(elMayorEsDeLaEtiqueta('[^>]*'), true);
  assert.equal(elMayorEsDeLaEtiqueta(' class="hero"'), true);
  assert.deepEqual(pegadasEn('const m = html.match(/<h3[^>]*class="t"[^>]*>([^<]+)</g);', 'x.mjs'), [],
    '🔴 vuelve a contar como pegado un patrón tolerante: el número que reporte será falso');
});

test('SCRUM-553 · el XML de VeriFactu se cuenta APARTE, no se mezcla', () => {
  // Mismo modo de fallo, pero el disparador no existe: nadie le pone un `aria-label` a un
  // `<sum1:RegistroAlta>`. Mezclarlos habría dado 99 y ninguna decisión.
  const r = pegadasEn('const m = xml.match(/<sum1:RegistroAlta>/);', 'x.mjs');
  assert.equal(r.length, 1, '🔴 ni siquiera lo ve');
  assert.equal(r[0].html, false, '🔴 clasifica una etiqueta de VeriFactu como HTML');
  assert.ok(ETIQUETAS_HTML.has('section') && !ETIQUETAS_HTML.has('sum1:registroalta'));
});

test('SCRUM-553 · 🔴 la exclusión por autorreferencia ampara algo REAL, y nada más', () => {
  // 🔴 LA QUINTA VEZ QUE ESTE REPO SE CAZA A SÍ MISMO (SCRUM-176/168/3/193 y ésta). Este censo
  //   y su test tienen que ESCRIBIR los patrones malos para explicarlos y para probarse, así
  //   que se contaban a sí mismos: el número subía de 29 a 40. Se excluyen los dos ficheros del
  //   mecanismo — y una exclusión sin comprobar es un permiso, así que aquí se comprueba que
  //   son exactamente esos dos y que sin ella el número CAMBIA de verdad.
  assert.deepEqual([...AUTORREFERENCIA].sort(), [
    'scripts/censo-etiquetas-pegadas.mjs',
    'tests/scrum553-etiquetas-pegadas.test.mjs',
  ].sort(),
  '🔴 la lista de exclusión ha cambiado. Solo puede contener el censo y su propio test: en cuanto ampare un fichero de verdad, deja de ser una nota y pasa a ser un agujero.');

  const sin = censar(RAIZ).html.length;
  const con = censar(RAIZ, { incluirAutorreferencia: true }).html.length;
  assert.ok(con > sin,
    `🔴 la exclusión no cambia nada (${con} con, ${sin} sin): entonces no ampara la`
    + ' autorreferencia que dice amparar, y está de adorno.');
});
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ROJO POR EL MECANISMO · sobre el arreglo piloto, y en las dos direcciones
// ═════════════════════════════════════════════════════════════════════════════════════════

const LANDING = fs.readFileSync(path.join(RAIZ, 'public', 'index.html'), 'utf8');
/** Los dos patrones tal y como quedaron en `scrum543-landing-a11y` tras el arreglo. */
const DOTS = /<span[^>]*class="dot"[^>]*><\/span>/g;
const BRS = /<\/span><br[^>]*><span[^>]*class="ts"[^>]*>/g;

test('SCRUM-553 · 🔴 el patrón arreglado SIGUE encontrando lo que buscaba', () => {
  assert.ok((LANDING.match(DOTS) || []).length >= 2,
    '🔴 el patrón tolerante ya no encuentra los `<span class="dot">`: el arreglo rompió el guard');
  assert.equal((LANDING.match(BRS) || []).length, 5,
    '🔴 el patrón tolerante ya no encuentra los 5 `<br>` de la demo');
});

test('SCRUM-553 · 🔴 y los sigue encontrando CON ATRIBUTOS AÑADIDOS (el caso del incidente)', () => {
  // Es exactamente lo que pasó: SCRUM-543 le puso `id="reg-hero"` al h1 y el extractor viejo
  // devolvió `null`. Se hace en memoria: `public/index.html` no se toca (lo lee S3 en paralelo).
  const conAtributos = LANDING
    .replace(/<span class="dot"><\/span>/g, '<span class="dot" aria-hidden="true"></span>')
    .replace(/<br>/g, '<br class="salto">');
  assert.notEqual(conAtributos, LANDING, '🔴 la inyección no se aplicó: no probaría nada');

  assert.ok((conAtributos.match(DOTS) || []).length >= 2,
    '🔴 CON UN `aria-hidden` AÑADIDO el patrón deja de encontrar los dots. Es el defecto que este '
    + 'ticket viene a cerrar, cometido por el arreglo.');
  assert.equal((conAtributos.match(BRS) || []).length, 5,
    '🔴 con una clase en el `<br>` el patrón deja de encontrar los 5 pasos');
});

test('SCRUM-553 · 🔴 pero CAE si se quita lo que de verdad vigila, y dice cuál', () => {
  // Tolerar atributos no puede convertirse en aceptar cualquier cosa: ésta es la línea fina.
  const sinDots = LANDING.replace(/<span class="dot"><\/span>/g, '');
  assert.notEqual(sinDots, LANDING, '🔴 la inyección no se aplicó');
  assert.ok((sinDots.match(DOTS) || []).length < 2,
    '🔴 se retiraron los `.dot` y el patrón sigue contándolos: entonces no vigila nada');

  const sinBr = LANDING.replace(/<\/span><br><span class="ts">/g, '</span><span class="ts">');
  assert.notEqual(sinBr, LANDING, '🔴 la inyección no se aplicó');
  assert.notEqual((sinBr.match(BRS) || []).length, 5,
    '🔴 se quitó el `<br>` que separa y el patrón sigue dando 5');

  // Y la clase SIGUE siendo exacta: `dot-grande` no es `dot`.
  const otraClase = LANDING.replace(/<span class="dot"><\/span>/g, '<span class="dot-grande"></span>');
  assert.ok((otraClase.match(DOTS) || []).length < 2,
    '🔴 acepta `class="dot-grande"` como si fuera `class="dot"`: eso YA es relajar el guard, que '
    + 'es justo lo que el ticket prohíbe. Se tolera el hueco de los atributos y nada más.');
});
