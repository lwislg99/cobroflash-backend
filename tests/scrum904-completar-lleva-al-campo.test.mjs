// tests/scrum904-completar-lleva-al-campo.test.mjs — SCRUM-904.
//
// ── QUÉ CUBRE ESTE FICHERO, Y QUÉ NO ─────────────────────────────────────────────────────────
// El COMPORTAMIENTO —pulsar «Completar →» desde cualquier pestaña y acabar en el sitio— lo mide
// `scripts/guard-completar-lleva-al-campo.mjs` EN NAVEGADOR. No puede medirse aquí: «se ve» no
// existe fuera de un motor de maquetado, y en el fuente un `focus()` sobre un campo visible y uno
// sobre un campo oculto **se leen igual**. Es la lección de SCRUM-515, otra vez.
//
// Aquí se vigila lo que sí se puede sin navegador, y que si se pierde deja el guard verde sobre una
// pantalla rota:
//
//   1. QUE EL DESTINO DE «Cobros con tarjeta» SE SIGA PIDIENDO POR IDENTIDAD. Buscarlo por el texto
//      de una etiqueta es lo que lo tuvo roto: no casaba nunca.
//   2. QUE SE SIGA ABRIENDO LA PESTAÑA DEL DESTINO, y pulsando la pestaña del producto en vez de
//      replicar su estado.
//   3. QUE `llevarASuPestana` SIGA PUDIENDO DECIR QUE NO. Si deja de comprobar que el destino se ve,
//      vuelve a ser un clic que no hace nada y no lo dice.
//   4. QUE LA MEDICIÓN NO DESAPAREZCA EN SILENCIO: el guard existe, está cableado, y conserva sus
//      cuatro patas —incluida la mutación que CUENTA sus sustituciones—.
//   5. QUE LOS DESTINOS DEL CHECKLIST SIGAN TENIENDO SITIO EN EL MAPA. Si un `focus:` apunta a un
//      campo que el mapa de submenús no conoce, no hay pestaña que abrir y el defecto vuelve.
//
// ── POR QUÉ IMPORTA ──────────────────────────────────────────────────────────────────────────
// El checklist es la pantalla que le dice al profesional qué le falta para poder cobrar. Medido el
// 17-sep-2026: de sus 36 acciones, **33 no hacían nada**. Una lista de tareas en la que dos de cada
// tres flechas no llevan a ninguna parte no es una ayuda con fallos: enseña a no fiarse de ella.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';
import { fueraDeLaTanda } from '../scripts/guards-visuales.mjs';
import mapa from '../public/dashboard/js/settingsSubmenus.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => {
  try {
    return fs.readFileSync(path.join(RAIZ, p), 'utf8');
  } catch (e) {
    assert.fail(`🔴 no se pudo leer ${p} (${e && e.code ? e.code : e}). «Está bien» y «no supe `
      + 'mirar» son el mismo verde, y aquí el verde equivocado dice que el checklist lleva a alguna '
      + 'parte.');
  }
};

// Los comentarios NO cuentan: este fichero explica en prosa casi todo lo que vigila, y un guard
// satisfecho con su propia documentación es el verde hueco que viene a impedir.
const VISTA = soloEjecutable(leer('public/dashboard/js/settingsView.js'));

// ── 1 · EL DESTINO DE CONNECT, POR IDENTIDAD ─────────────────────────────────────────────────

test('SCRUM-904 · 🔴 «Cobros con tarjeta» apunta a su bloque por IDENTIDAD, no por el texto de un rótulo', () => {
  assert.match(VISTA, /function\s+bloqueDeConnect/,
    '🔴 `bloqueDeConnect()` ha desaparecido. Ese bloque es el único destino del checklist que no es '
    + 'un campo, y sin una forma de pedirlo por identidad se vuelve a buscar por texto.');
  assert.match(VISTA, /getElementById\(['"]connect-status-body['"]\)/,
    '🔴 el bloque de Connect ya no se pide por su `id`. Referenciar por identidad no caduca; por '
    + 'texto, sí.');

  // 🔴 LA BÚSQUEDA QUE ESTUVO ROTA. Medido en el DOM pintado, con la tarjeta de Connect
  // renderizada de verdad: los `<h2>` que casan esa expresión son CERO —el rótulo del bloque es un
  // `<p>`—, así que `find` devolvía `undefined` y las nueve pestañas caían en la rama de reserva.
  assert.ok(!/\/tarjeta\|Stripe\|Connect\/i/.test(VISTA),
    '🔴 ha vuelto la búsqueda del destino de Connect por el texto de un `<h2>`:\n\n'
    + '      h2s.find((h) => /tarjeta|Stripe|Connect/i.test(h.textContent))\n\n'
    + '  No casaba NUNCA. El rótulo de ese bloque es un `<p>`, no un `<h2>`, y ningún `<h2>` de la '
    + 'pantalla contiene esas palabras. No se arregla añadiéndole un `<h2>` al bloque: se pide el '
    + 'bloque por su `id`, que es lo que no depende de cómo esté rotulado.');
});

// ── 2 y 3 · SE ABRE LA PESTAÑA, Y SE SABE DECIR QUE NO ───────────────────────────────────────

test('SCRUM-904 · 🔴 el clic abre la pestaña del destino, pulsando la del producto', () => {
  assert.match(VISTA, /function\s+llevarASuPestana/,
    '🔴 `llevarASuPestana` ha desaparecido: sin abrir el panel del destino, `scrollIntoView` y '
    + '`focus()` caen sobre algo con `display:none` y no hacen nada. Son las 33 de este ticket.');

  const cuerpo = VISTA.slice(VISTA.indexOf('function llevarASuPestana'));
  const fin = cuerpo.indexOf('\n}');
  const fn = cuerpo.slice(0, fin === -1 ? 900 : fin);

  assert.match(fn, /button\[data-submenu=/,
    '🔴 ya no se abre la pestaña pulsando el botón del producto. Replicar aquí `submenuActivo` y '
    + '`pintarNav` —que viven en el cierre de `renderSettingsView`— sería la segunda fuente de '
    + 'siempre: dos sitios decidiendo qué significa «abrir una pestaña».');
  assert.match(fn, /closest\(['"]\[data-submenu\]['"]\)/,
    '🔴 la pestaña del destino ya no se deriva del propio destino. Escribirla a mano por fila es '
    + 'una tabla que se queda vieja en cuanto un campo cambie de panel.');

  // 🔴 LA MITAD QUE SE OLVIDA: saber decir que NO.
  assert.match(fn, /offsetParent\s*===\s*null/,
    '🔴 `llevarASuPestana` ha dejado de comprobar que el destino SE VE.\n\n'
    + '  Sin eso vuelve a ser un clic que da por hecho que funcionó: el bloque de Connect con el '
    + 'flag apagado sigue oculto aunque su panel esté abierto, y el checklist diría que te ha '
    + 'llevado a un sitio donde no hay nada. Un instrumento que sólo sabe decir que sí no es un '
    + 'instrumento.');
  assert.match(fn, /return\s+false/,
    '🔴 `llevarASuPestana` ya no devuelve `false` en ningún caso: no puede informar de que no pudo, '
    + 'y quien la llama no tiene forma de reaccionar.');
});

// ── 4 · LA MEDICIÓN NO PUEDE DESAPARECER EN SILENCIO ─────────────────────────────────────────

test('SCRUM-904 · 🔴 el guard de navegador sigue existiendo, cableado y con sus cuatro patas', () => {
  const guard = leer('scripts/guard-completar-lleva-al-campo.mjs');

  assert.match(guard, /puppeteer-core/,
    '🔴 el control ya no abre navegador. Medido leyendo el `.js` sería el verde de SCRUM-515: un '
    + '`focus()` sobre un campo oculto y uno sobre un campo visible se leen IGUAL en el fuente.');
  assert.match(guard, /renderSettingsView\(/, '🔴 el guard ya no renderiza la pantalla.');
  assert.match(guard, /\.click\(\)/,
    '🔴 el guard ya no PULSA nada. Este defecto no existe hasta que alguien pulsa: la pantalla '
    + 'pintada y sin tocar se ve perfecta, y por eso llevaba ahí desde siempre.');

  // ④ LA MUTACIÓN, Y QUE CUENTE. Una mutación que no muta es un verde que no significa nada.
  assert.match(guard, /sustituciones/,
    '🔴 la mutación ya no cuenta sus sustituciones. Si la diana deja de existir y nadie lo nota, el '
    + 'guard mide DOS VECES el mismo código y concluye que «la mutación no rompió nada».');
  assert.match(guard, /sustituciones\s*!==\s*1/,
    '🔴 ya no se exige que la sustitución sea EXACTAMENTE una. Cero significa que no mutó; más de '
    + 'una, que no sabe qué ha mutado. Las dos son ceguera, no verde.');

  // ③ EL SUELO.
  assert.match(guard, /0 acciones/,
    '🔴 el guard ha perdido su suelo. «0 acciones» no es «0 mudas»: es que no ha mirado ninguna, y '
    + 'ese cero se leería como que el checklist está bien.');
  assert.match(guard, /tarjeta de Stripe Connect NO se ha pintado/,
    '🔴 el guard ya no exige que la tarjeta de Connect esté MONTADA antes de dar veredicto.\n\n'
    + '  Es el suelo que nace del error de la primera pasada: con `/admin/connect/status` '
    + 'devolviendo `{enabled:false}`, `renderConnectCard` hace `return` en su primera línea, la '
    + 'tarjeta no se pinta y los 9 casos de esa fila caen en la reserva POR UN MOTIVO QUE NO ES EL '
    + 'QUE SE INVESTIGA. Un banco que no monta la superficie no la mide: la declara no medida.');

  // 🔴 EL ORDEN DEL VEREDICTO. Lo enseñó el propio guard en su primera pasada en rojo.
  const iFallos = guard.indexOf('if (fallos.length) {');
  const iCiegoFinal = guard.indexOf('if (ciegos.length) process.exit(SALIDA_CIEGO);');
  assert.notEqual(iFallos, -1, '🔴 el guard ya no publica sus fallos.');
  assert.notEqual(iCiegoFinal, -1, '🔴 el guard ya no sale por «no supe medir» cuando corresponde.');
  assert.ok(iFallos < iCiegoFinal,
    '🔴 la ceguera ha vuelto a decidir el veredicto POR ENCIMA de los hallazgos.\n\n'
    + '  Pasó de verdad: contra el código de antes del arreglo, el barrido encontró sus 33 acciones '
    + 'mudas y el guard contestó «NO SUPE MEDIR» con exit 2, porque la mutación no encontró su '
    + 'diana —esa línea aún no existía—. Un guard que ha VISTO 33 defectos no puede decir que no '
    + 'supo medir. La ceguera decide SÓLO cuando no hay fallos, que es el único caso en que un «0 '
    + 'fallos» podría mentir.');

  // La POBLACIÓN se compara por conjuntos, porque se mueve con el merchant.
  assert.match(guard, /POBLACIÓN/, '🔴 el guard ya no declara su población.');
  assert.match(guard, /salieron|entraron/,
    '🔴 el guard ya no compara CONJUNTOS al releer la población. El checklist sólo pinta '
    + '«Completar →» en lo que no está en verde, así que el número de acciones se mueve con el '
    + 'merchant: un número suelto sobre una población que cambia no es reproducible por '
    + 'construcción.');

  // Cableado: `guards:visuales` deriva SU lista de `package.json`. Fuera de ahí, no corre en CI.
  const pkg = JSON.parse(leer('package.json'));
  assert.equal(pkg.scripts['guard:completar-lleva-al-campo'], 'node scripts/guard-completar-lleva-al-campo.mjs',
    '🔴 `npm run guard:completar-lleva-al-campo` ya no existe, así que no lo corre nadie.');
  assert.ok(fueraDeLaTanda(pkg.scripts).includes('guard:completar-lleva-al-campo'),
    '🔴 el guard ha dejado de estar en la lista que `guards:visuales` corre en CI. Un guard que hay '
    + 'que descubrir leyendo `scripts/` es un guard que no se ejecuta.');
});

// ── 5 · LOS DESTINOS DEL CHECKLIST TIENEN SITIO EN EL MAPA ───────────────────────────────────

test('SCRUM-904 · 🔴 cada campo al que apunta el checklist vive en un submenú conocido', () => {
  // Los `focus:` del checklist, leídos del propio fichero: si mañana se añade una fila, entra sola.
  const focos = [...VISTA.matchAll(/focus:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.ok(focos.length >= 3,
    `🔴 sólo se han encontrado ${focos.length} destinos \`focus:\` en el checklist, y había tres. O `
    + 'han cambiado de forma —y este guard ha dejado de verlos— o han desaparecido. Un censo corto '
    + 'no es un checklist pequeño: es un instrumento que no mira.');

  for (const campo of focos) {
    let submenu;
    assert.doesNotThrow(() => { submenu = mapa.submenuDeCampo(campo); },
      `🔴 el checklist apunta a «${campo}» y el mapa de submenús no sabe dónde vive.\n\n`
      + '  Sin submenú no hay pestaña que abrir, así que ese «Completar →» vuelve a ser un clic que '
      + 'no lleva a ninguna parte. Se le da sitio en `settingsSubmenus.js`; no se quita del '
      + 'checklist.');
    assert.ok(mapa.SUBMENUS.includes(submenu),
      `🔴 «${campo}» está asignado a «${submenu}», que no es uno de los submenús de la pantalla.`);
  }
});

// ── 6 · UNA FILA PUEDE QUEDAR KO SIN OFRECERSE COMO ACCIÓN (SCRUM-904, 26-sep, com. 17138) ──────
//
// El comportamiento de verdad —texto, `disabled`, sin «Completar →» con el flag apagado— lo mide
// la comprobación ⑤ del guard, EN NAVEGADOR, por la misma razón que el resto de este fichero: un
// botón `disabled` y uno que no lo es se leen igual en el fuente si solo se busca el atributo a
// ojo. Aquí se vigila que el MECANISMO exista y que la comprobación ⑤ no desaparezca en silencio.

test('SCRUM-904 · 🔴 una fila con `completable: false` deja de invitar, no solo cambia de texto', () => {
  assert.match(VISTA, /completable\s*:\s*connectEnabled/,
    '🔴 la fila de Connect ya no decide su `completable` a partir del flag. Sin eso, «Aún no '
    + 'disponible en tu cuenta» sería solo un cambio de texto sobre una fila que sigue prometiendo '
    + 'una acción.');
  assert.match(VISTA, /r\.completable\s*!==\s*false/,
    '🔴 el `forEach` de las filas ya no lee `completable`: aunque la fila lo declare, nadie lo mira.');
  assert.match(VISTA, /row\.disabled\s*=\s*true/,
    '🔴 la fila no completable ha dejado de nacer `disabled`. Un botón que sigue activo, aunque no '
    + 'tenga la flecha, sigue siendo clicable de verdad.');
  assert.match(VISTA, /if\s*\(completable\)\s*{\s*\n\s*row\.addEventListener/,
    '🔴 el listener de clic ya no se salta para las filas no completables: seguiría intentando '
    + 'llevar a un sitio que la propia fila dice que no existe.');

  const guard = leer('scripts/guard-completar-lleva-al-campo.mjs');
  assert.match(guard, /LEER_FILA_CONNECT/,
    '🔴 la comprobación ⑤ (flag OFF) ha desaparecido del guard: sin ella, un `disabled` que se '
    + 'pierde no lo nota nadie hasta que alguien mira la pantalla a mano.');
  assert.match(guard, /connect=off/,
    '🔴 el guard ya no sabe pedir la página con el flag de Connect apagado.');
  assert.match(guard, /control positivo, flag ON/,
    '🔴 la comprobación ⑤ ha perdido su control positivo: sin él, un `disabled` que sale SIEMPRE '
    + '—también con el flag encendido— pasaría el mismo verde.');
});

// ── 7 · EL AVISO DE PESTAÑA DEL CHECKLIST SALE DE LO QUE LA PANTALLA YA MUESTRA ─────────────────

test('SCRUM-904 · 🔴 el aviso de pestaña del checklist no inventa un rótulo propio', () => {
  const submenus = leer('public/dashboard/js/settingsSubmenus.js');
  assert.match(submenus, /function\s+checklistEstaEnLaPestana/,
    '🔴 `checklistEstaEnLaPestana` ha desaparecido: sin ella, el aviso de la 17138 vuelve a ser un '
    + 'texto escrito a mano fila por fila, que es como se desfasa de la pantalla.');
  // No reusa el prefijo de SCRUM-894 («Para guardar, rellena…»): aquí nadie está guardando.
  const cuerpo = submenus.slice(submenus.indexOf('function checklistEstaEnLaPestana'));
  const fn = cuerpo.slice(0, cuerpo.indexOf('\n}'));
  assert.ok(!/Para guardar/.test(fn),
    '🔴 el aviso del checklist ha vuelto a decir «Para guardar,», que es el texto de SCRUM-894 (un '
    + 'error de guardado) y aquí sería falso: se navega desde una lista de pendientes, no desde un '
    + 'intento de guardar.');
  assert.match(fn, /está en la pestaña/, '🔴 el literal firmado en la 17138 ha cambiado.');

  assert.match(VISTA, /checklistEstaEnLaPestana\(/,
    '🔴 `settingsView.js` ya no llama a `checklistEstaEnLaPestana`: el aviso dejó de pintarse.');
  assert.match(VISTA, /closest\(['"]\.field['"]\)/,
    '🔴 el rótulo del campo ya no se lee del `<label>` real del formulario: si se escribe a mano '
    + 'aquí, puede desfasarse de lo que la pantalla muestra de verdad.');
});
