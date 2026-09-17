// tests/scrum894-el-boton-que-no-callaba.test.mjs — SCRUM-894.
//
// ── QUÉ CUBRE ESTE FICHERO, Y QUÉ NO ─────────────────────────────────────────────────────────
// El COMPORTAMIENTO —que «Guardar cambios» o guarda o dice qué falta y lleva a ello— lo mide
// `scripts/guard-guardar-sin-callar.mjs` EN NAVEGADOR, sobre el DOM vivo, desde las nueve
// pestañas. No puede medirse aquí: `npm test` no arranca un navegador, y sobre todo, lo que
// fallaba ERA EL NAVEGADOR (su validación interactiva aborta el envío cuando un control
// `required` vive en un panel con `display:none`).
//
// Aquí se vigilan las cosas que el navegador NO puede ver, y que si se pierden dejan el guard
// verde sobre una pantalla rota:
//
//   1. QUE `noValidate` SIGA PUESTO. Es la pieza entera: sin ella el navegador vuelve a abortar
//      el `submit` y todo lo demás —el aviso, la pestaña, el foco— se queda otra vez en código
//      muerto. Y es UNA LÍNEA que cualquiera puede quitar por parecerle de más.
//   2. QUE LA LISTA DE OBLIGATORIOS SIGA DERIVÁNDOSE. La que había estaba escrita a mano y ya
//      había divergido: nombraba cinco campos cuando los `required` del formulario son siete.
//      Una copia a mano no avisa cuando se queda corta.
//   3. QUE EL AVISO SE SIGA COMPONIENDO CON LOS DOS RÓTULOS DE LA PANTALLA, y no con prosa
//      escrita aquí. Es lo que hace que el arreglo respete la regla 30 sin marcador.
//   4. QUE LA MEDICIÓN NO DESAPAREZCA EN SILENCIO: el guard existe y está cableado.
//   5. QUE LA PREMISA DEL TICKET SIGA SIENDO CIERTA: el NIF vive en OTRA pestaña distinta de
//      Cobros. Si algún día se mudara, este defecto cambia de forma y hay que volver a medirlo.
//
// ── POR QUÉ IMPORTA ──────────────────────────────────────────────────────────────────────────
// Sin Connect activo, «Configuración › Cobros» es la ÚNICA salida del pago. Un botón que no hace
// nada y calla no cuesta ese botón: cuesta la confianza en el resto de la aplicación, y eso no
// se arregla arreglando el botón después.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';
import mapa from '../public/dashboard/js/settingsSubmenus.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => {
  try {
    return fs.readFileSync(path.join(RAIZ, p), 'utf8');
  } catch (e) {
    assert.fail(`🔴 no se pudo leer ${p} (${e && e.code ? e.code : e}). «Está bien» y «no supe `
      + 'mirar» son el mismo verde, y aquí el verde equivocado dice que nadie se queda delante '
      + 'de un botón mudo.');
  }
};

// Los comentarios NO cuentan: este fichero lleva dentro, en prosa, casi todo lo que vigila, y un
// guard que se diera por satisfecho con su propia documentación sería exactamente el verde hueco
// que viene a impedir.
const VISTA = soloEjecutable(leer('public/dashboard/js/settingsView.js'));

// ── 1 · LA PIEZA ENTERA: `noValidate` ────────────────────────────────────────────────────────

test('SCRUM-894 · 🔴 el formulario sigue con `noValidate`: sin eso el `submit` no llega a ocurrir', () => {
  assert.match(VISTA, /form\.noValidate\s*=\s*true/,
    '🔴 `form.noValidate = true` ha desaparecido de `settingsView.js`.\n\n'
    + '  Con la validación interactiva del navegador encendida, pulsar «Guardar cambios» con un\n'
    + '  campo `required` vacío EN OTRA PESTAÑA no dispara el evento `submit`: el navegador aborta\n'
    + '  el envío y lo cuenta por consola («An invalid form control with name=\'taxId\' is not\n'
    + '  focusable»). Todo el aviso de este ticket vive DENTRO de ese `submit`, así que sin esta\n'
    + '  línea vuelve a ser código muerto y el botón vuelve a callarse. Medido el 17-sep-2026:\n'
    + '  8 de 9 pestañas completamente mudas.\n\n'
    + '  Si hay que quitarla, el aviso tiene que colgar de otro sitio ANTES — y medirse con\n'
    + '  `npm run guard:guardar-sin-callar`, no razonarse.');
});

// ── 2 · LA LISTA DE OBLIGATORIOS SE DERIVA, NO SE COPIA ──────────────────────────────────────

test('SCRUM-894 · 🔴 los obligatorios salen de la pantalla, no de una lista escrita a mano', () => {
  assert.match(VISTA, /\.validity\.valid/,
    '🔴 el formulario ya no consulta `validity` de sus controles. Si la comprobación ha vuelto a '
    + 'ser una lista escrita a mano, vuelve a poder quedarse corta sin que nadie se entere: la '
    + 'que había nombraba CINCO campos y los `required` del formulario son SIETE.');
  assert.match(VISTA, /willValidate/,
    '🔴 se ha perdido el filtro por `willValidate`. Sin él entran controles que el navegador ni '
    + 'siquiera valida (deshabilitados, ocultos por tipo) y el aviso nombraría campos que el '
    + 'profesional no puede rellenar.');

  // La condición vieja, la que enumeraba a mano. Si vuelve, vuelve la divergencia.
  assert.ok(!/!payload\.name\s*\|\|\s*!payload\.legalName/.test(VISTA),
    '🔴 ha vuelto la comprobación a mano `!payload.name || !payload.legalName || …`.\n\n'
    + '  Esa lista ya había divergido de los `required` de la pantalla, y además vivía DESPUÉS de '
    + 'componer el payload, dentro de un `submit` que no ocurría. No se arregla completándola: se '
    + 'deriva, que es lo que no se queda corto solo.');

  // Y que la comprobación vaya ANTES de componer el payload: si va después, un fallo al construirlo
  // se come el aviso.
  const iCheck = VISTA.indexOf('camposInvalidos()');
  const iPayload = VISTA.indexOf('const payload');
  assert.notEqual(iCheck, -1, '🔴 `camposInvalidos()` ya no existe: la comprobación derivada se ha ido.');
  assert.notEqual(iPayload, -1, '🔴 no se encuentra la composición del payload: el guard no sabe qué mira.');
  assert.ok(iCheck < iPayload,
    '🔴 la comprobación de lo que falta ha quedado DESPUÉS de componer el payload. Ahí es donde '
    + 'estaba antes, y por eso un envío que no llegaba a ocurrir se llevaba el aviso por delante.');
});

// ── 3 · EL AVISO SE COMPONE CON LOS RÓTULOS DE LA PANTALLA (regla 30) ────────────────────────

test('SCRUM-894 · 🔴 el aviso nombra el campo y su pestaña con rótulos que ya están en pantalla', () => {
  assert.match(VISTA, /function\s+rotuloDelCampo/,
    '🔴 `rotuloDelCampo` ha desaparecido: el aviso ya no saca el nombre del campo de su `<label>`.');
  assert.match(VISTA, /function\s+pestanaDelCampo/,
    '🔴 `pestanaDelCampo` ha desaparecido: el aviso ya no dice DÓNDE está lo que falta, y «qué '
    + 'falta» sin «dónde» es media respuesta en una pantalla de diez paneles.');
  assert.match(VISTA, /rotuloDeSubmenu\(/,
    '🔴 el nombre de la pestaña ha dejado de salir de `rotuloDeSubmenu`, que es el único sitio '
    + 'donde viven los rótulos aprobados (5-ago-2026, fijados carácter a carácter en '
    + '`tests/scrum284-configuracion-submenus.test.mjs`). Escribirlo aparte es abrir la segunda '
    + 'fuente que este mapa existe para impedir.');

  // Regla 30 con mecanismo, no con confianza: la prosa vive en UNA constante y sólo ahí.
  assert.match(VISTA, /const\s+PROSA_FALTAN\s*=/,
    '🔴 `PROSA_FALTAN` ha desaparecido. Es el ÚNICO sitio donde entra el texto que firme el '
    + 'fundador (regla 30). Sin esa ranura, la prosa acaba repartida por el fichero y nadie sabe '
    + 'qué está firmado y qué no.');

  // Y que el aviso se pinte de verdad, no sólo se calcule.
  assert.match(VISTA, /setAlert\("error",\s*avisoDeFaltantes\(/,
    '🔴 el aviso ya no llega a `setAlert`. Calcular qué falta y no pintarlo es el silencio de '
    + 'siempre con más código detrás.');

  // Y que lleve a la pestaña, que es la otra mitad del arreglo.
  assert.match(VISTA, /function\s+llevarAlCampo/,
    '🔴 `llevarAlCampo` ha desaparecido: el aviso diría dónde está el campo y dejaría al '
    + 'profesional buscarlo. Nombrar la pestaña y no abrirla es pedirle que navegue con el error '
    + 'delante.');
});

// ── 4 · LA MEDICIÓN NO PUEDE DESAPARECER EN SILENCIO ─────────────────────────────────────────

test('SCRUM-894 · 🔴 el control en navegador sigue existiendo y cableado', () => {
  const guard = leer('scripts/guard-guardar-sin-callar.mjs');

  assert.match(guard, /puppeteer-core/,
    '🔴 el control ya no abre navegador. Medido leyendo el `.js` volvería a ser el verde que '
    + 'falló aquí: el aviso ESTABA escrito en el fichero y no se veía nunca, porque el `submit` '
    + 'que lo contenía no llegaba a dispararse.');
  assert.match(guard, /renderSettingsView\(/,
    '🔴 el guard ya no RENDERIZA la pantalla. Sin render no hay DOM que medir.');
  assert.match(guard, /\.click\(\)/,
    '🔴 el guard ya no PULSA nada. El defecto de este ticket sólo existe al pulsar: una pantalla '
    + 'pintada y nunca tocada se ve perfecta.');

  // Las dos mitades del control. Sin el perfil que SÍ guarda, «no guarda» no distingue un botón
  // mudo de un instrumento que no sabe pulsarlo.
  for (const mitad of [/SIN NIF/, /COMPLETO/]) {
    assert.match(guard, mitad, `🔴 falta la mitad ${mitad} del control. Las dos van: una mide el `
      + 'defecto y la otra demuestra que el instrumento sabe ver el camino bueno.');
  }

  assert.match(guard, /NO SUPO MIRAR/,
    '🔴 el guard ya no sabe declararse ciego. Si no encuentra la caja del aviso y contesta «0 '
    + 'fallos», está mintiendo en la dirección más cara: diría que nadie se queda delante de un '
    + 'botón mudo.');
  assert.match(guard, /calSabeDecirNo|calSabeDecirSi/,
    '🔴 el guard perdió la CALIBRACIÓN. Un detector que no demuestra que sabe cambiar de '
    + 'respuesta —ver el aviso cuando está y dejar de verlo cuando no— da un verde que no '
    + 'significa nada.');
  assert.match(guard, /POBLACIÓN/,
    '🔴 el guard ya no declara su población. «0 fallos» sin «sobre cuántos» no es un verde: es '
    + 'una frase, y aquí la población es el número de pestañas desde las que se puede pulsar.');

  // Que se pueda lanzar sin conocer la ruta: si no está en `package.json`, no lo corre nadie —y
  // además `guards:visuales` deriva SU lista de aquí, así que fuera de package.json tampoco
  // correría en CI.
  const pkg = JSON.parse(leer('package.json'));
  assert.equal(pkg.scripts['guard:guardar-sin-callar'], 'node scripts/guard-guardar-sin-callar.mjs',
    '🔴 `npm run guard:guardar-sin-callar` ya no existe. `scripts/guards-visuales.mjs` deriva de '
    + '`package.json` qué guards de navegador corre en CI: fuera de ahí, este control no lo '
    + 'ejecuta nadie y vuelve a depender de que alguien se acuerde.');
});

// ── 5 · LA PREMISA DEL TICKET SIGUE SIENDO CIERTA ────────────────────────────────────────────

test('SCRUM-894 · 🔴 el NIF sigue viviendo en una pestaña distinta de Cobros', () => {
  const dondeVive = mapa.submenuDeCampo('taxId');
  const dondeSePulsa = mapa.submenuDeCampo('iban');

  assert.equal(dondeSePulsa, 'cobro',
    '🔴 `iban` ya no está en «Cobros». Este guard usa esa pareja para comprobar que el defecto '
    + 'medido —lo que falta está en OTRA pestaña— sigue siendo posible. Si el mapa ha cambiado, '
    + 'hay que volver a medir, no actualizar este número.');
  assert.notEqual(dondeVive, dondeSePulsa,
    `🔴 \`taxId\` ha pasado a vivir en «${dondeVive}», la misma pestaña que \`iban\`.\n\n`
    + '  Es una buena noticia y aun así es un rojo: el defecto de SCRUM-894 era «lo obligatorio '
    + 'está en otra pestaña», y si ya no lo está, lo que este fichero vigila ha dejado de '
    + 'describir la pantalla. Se vuelve a medir con `npm run guard:guardar-sin-callar` y se '
    + 'reescribe esta comprobación, no se relaja.');

  // Y que el campo siga siendo obligatorio EN LA PANTALLA. Este ticket no decide si debe serlo
  // —eso es producto— pero sí deja constancia de dónde está decidido hoy, que es el único sitio:
  // el frontal. El servidor lo acepta ausente (`taxId: z.string().min(1).optional()`).
  assert.match(VISTA, /createField\(\s*"NIF\/CIF",\s*"taxId",\s*"text",\s*true\s*\)/,
    '🔴 `taxId` ha dejado de ser `required` en el formulario, o su rótulo ha cambiado.\n\n'
    + '  Si ha dejado de ser obligatorio, es una decisión de PRODUCTO y no de este ticket: el '
    + 'aviso que se arregló aquí deja de tener caso y hay que decirlo, no borrarlo de tapadillo. '
    + 'Si sólo ha cambiado el rótulo, el guard de navegador lo deriva del `<label>` y sigue '
    + 'midiendo bien; lo que hay que actualizar es esta línea.');
});
