// tests/scrum543-landing-a11y.test.mjs — SCRUM-543
//
// LA RED QUE SÍ CORRE SIEMPRE. El árbitro de verdad es `npm run guard:a11y-landing`, que mide el
// árbol de accesibilidad y el área que recibe el toque en Edge. Este fichero NO lo sustituye: la
// suite no arranca navegador (misma decisión que los otros cinco guards de navegador).
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR, Y SE DICE CON ESAS PALABRAS ──────────
// 🔴 Que el texto SUENE separado no se comprueba aquí: un `<br>` separa a la vista y no en el
// árbol, así que el marcado no distingue los dos casos. Y que un táctil llegue a 44 px tampoco:
// el área se amplía con un pseudo-elemento, y sólo el navegador sabe qué recibe el toque.
// Aquí se vigila que las PIEZAS sigan puestas y que el guard no desaparezca.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANDING = fs.readFileSync(path.join(RAIZ, 'public', 'index.html'), 'utf8');

// ── ① SUELO ─────────────────────────────────────────────────────────────────
test('SCRUM-543 · SUELO: la landing se lee y trae sus secciones', () => {
  assert.ok(LANDING.length > 20000, '🔴 CIEGO: public/index.html vino demasiado corto.');
  const n = (LANDING.match(/<section/g) || []).length;
  assert.ok(n >= 9, `🔴 CIEGO: sólo se ven ${n} secciones. El verde de abajo no significaría nada.`);
});

// ── ② LO QUE SEPARA EL TEXTO SIGUE PUESTO ───────────────────────────────────
// 🔴 EL DEFECTO QUE ESTE TICKET VENÍA A ARREGLAR AQUÍ NO EXISTÍA, y conviene que quede escrito
// para que nadie lo «arregle» otra vez: se creía que el héroe se oía «Sin tarjetaListo» y la
// demo «presupuestoDel». Medido contra el algoritmo ACCNAME —el que usa un lector de pantalla
// para anunciar— salen separados YA, sin tocar nada: el `<span class="dot">` tiene caja propia y
// el `<br>` es un salto, y el algoritmo inserta separación en ambos casos.
//
// El origen del falso positivo fue leer la SERIALIZACIÓN CRUDA del árbol, que concatena los
// nodos de texto hermanos tal cual, en vez del nombre accesible computado. Dos instrumentos
// distintos sobre el mismo nodo, y sólo uno responde a «qué se oye».
//
// Lo que sí hay que proteger es lo que produce esa separación. Si alguien retira el `.dot` o el
// `<br>` por limpieza visual, el texto SÍ se pega — y entonces el guard de navegador lo canta.
test('SCRUM-543 · lo que separa el texto del héroe y de la demo sigue en su sitio', () => {
  const malos = [];
  // ⚠️ SCRUM-553: el patrón era `<span class="dot">` con el `>` PEGADO. Se toleran atributos —
  //   un `id`, un `aria-hidden`, un `data-*`— porque eso es marcado correcto y el extractor no
  //   tiene por qué asumir que la etiqueta viene desnuda. Lo que se vigila NO se toca: sigue
  //   exigiendo `class="dot"` EXACTO y el `</span>` inmediato, que es lo que separa el texto.
  const dots = (LANDING.match(/<span[^>]*class="dot"[^>]*><\/span>/g) || []).length;
  if (dots < 2) malos.push(`héroe .note: quedan ${dots} de 2 <span class="dot"> (son los que separan)`);
  // ⚠️ SCRUM-553: igual aquí. Se tolera el hueco de atributos en el `<br>` y en el `<span>`, y
  //   se conserva la ADYACENCIA —`</span>` pegado al `<br>` pegado al `<span class="ts">`—,
  //   que es justamente lo que produce la separación. Tolerar atributos no es aceptar cualquier
  //   cosa: sin `class="ts"` exacto y sin ese orden, sigue sin casar.
  const brs = (LANDING.match(/<\/span><br[^>]*><span[^>]*class="ts"[^>]*>/g) || []).length;
  if (brs !== 5) malos.push(`demo: ${brs} de 5 pasos conservan el <br> entre título y descripción`);
  assert.deepEqual(malos, [],
    '🔴 SE HA RETIRADO LO QUE SEPARA EL TEXTO:\n    ' + malos.join('\n    ') +
    '\n\n  Sin eso el nombre accesible se pega («Sin tarjetaListo»). Compruébalo con ' +
    '`npm run guard:a11y-landing`, que es el único que sabe cómo suena.');
});

// ── ③ CADA REGIÓN PUBLICADA TIENE NOMBRE, Y SU id RESUELVE ──────────────────
// Un `aria-labelledby` que apunta a un id inexistente no da error en ninguna parte: no nombra
// nada, y se ve idéntico en el fuente a uno que funciona.
const REGIONES = ['reg-hero', 'reg-probar', 'reg-como', 'reg-todo', 'reg-precios', 'reg-faq', 'reg-cta'];
test('SCRUM-543 · las 7 secciones publicadas se nombran con su propio encabezado', () => {
  const malas = [];
  for (const id of REGIONES) {
    if (!LANDING.includes(`aria-labelledby="${id}"`)) { malas.push(`${id}: ninguna sección lo usa`); continue; }
    if (!new RegExp(`<h[12] id="${id}">`).test(LANDING)) {
      malas.push(`${id}: el aria-labelledby apunta a un encabezado QUE NO EXISTE`);
    }
  }
  assert.deepEqual(malas, [], '🔴 REGIONES SIN NOMBRE QUE RESUELVA:\n    ' + malas.join('\n    ') +
    '\n\n  El nombre TIENE que salir del encabezado que ya existe: un rótulo nuevo sería microcopy ' +
    'sin aprobar (regla 30).');
});

// ── ④ LOS TÁCTILES CONSERVAN SU MECANISMO ───────────────────────────────────
test('SCRUM-543 · el logo y «Ver planes» conservan lo que les da los 44 px', () => {
  assert.match(LANDING, /\.logo\{[^}]*min-height:44px/,
    '🔴 el logo ha perdido su `min-height:44px`: volvería a los 34 px medidos, y es el elemento ' +
    'que más se toca por error.');
  assert.match(LANDING, /\.announce a::after\{[^}]*top:-12px;bottom:-12px/,
    '🔴 «Ver planes →» ha perdido el pseudo-elemento que le da el área tocable. Su caja mide 24 px: ' +
    'sin esto vuelve a estar por debajo de AB6, y su `getBoundingClientRect` NO lo delata.');
  assert.match(LANDING, /\.announce-in\{[^}]*padding:12px 22px/,
    '🔴 la barra ha vuelto a 10px de padding. Con 10 medía 44 EXACTOS y el área tocable del enlace ' +
    'no cabía sin invadir el header: se quedaba en 42,6 px. Medido, no supuesto.');
});

// ── ⑤ LO QUE ESTÁ EN PROPUESTA SIGUE SIN PUBLICARSE ─────────────────────────
// Este ticket toca la landing publicada. Si al pasar por aquí alguien destapa una sección cuyo
// copy no está aprobado, el arreglo de accesibilidad habría publicado microcopy (regla 30).
test('SCRUM-543 · las secciones en propuesta siguen ocultas', () => {
  for (const [id, marca] of [['gremios', 'data-microcopy'], ['comparativa', 'data-propuesta']]) {
    const m = new RegExp(`<section id="${id}"[^>]*>`).exec(LANDING);
    assert.ok(m, `🔴 CIEGO: no encuentro la sección #${id}.`);
    assert.match(m[0], /\shidden(\s|>|=)/,
      `🔴 #${id} lleva ${marca} (copy sin aprobar) y ha perdido el \`hidden\`: se publicaría microcopy ` +
      'que el fundador no ha visto.');
  }
});

// ── ⑥ QUE EL ÁRBITRO DE VERDAD SIGA AHÍ ─────────────────────────────────────
test('SCRUM-543 · el guard de navegador existe y sigue registrado', () => {
  const script = path.join(RAIZ, 'scripts', 'guard-a11y-landing.mjs');
  assert.ok(fs.existsSync(script), '🔴 falta `scripts/guard-a11y-landing.mjs`.');
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['guard:a11y-landing'], 'node scripts/guard-a11y-landing.mjs',
    '🔴 el guard ya no está registrado: existiría el fichero y no lo lanzaría nadie.');

  // ⚠️ SCRUM-562 · el medidor del área de toque se mudó a `scripts/_medidor-de-toque.mjs`,
  //    porque este guard y el de SCRUM-542 llevaban cada uno su copia y medían distinto. Se mira
  //    la UNIÓN: la comprobación sigue al mecanismo, no se retira.
  const propio = fs.readFileSync(script, 'utf8');
  const fuente = propio + '\n' + fs.readFileSync(path.join(RAIZ, 'scripts', '_medidor-de-toque.mjs'), 'utf8');

  // 🔴 Y LO QUE SCRUM-562 VINO A QUITAR: el idioma que da por bueno lo que otro elemento tapa.
  //    Se mira sólo el CÓDIGO —sin comentarios—, porque las cabeceras lo CITAN para explicarlo.
  const codigo = propio.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
  assert.doesNotMatch(codigo, /elementsFromPoint\([^)]*\)\s*\.includes/,
    '🔴 ha vuelto `elementsFromPoint(...).includes(el)`. Eso pregunta si el elemento está en la ' +
    'pila y contesta que sí aunque algo esté ENCIMA tapándolo: su fallo produce verdes. Usa ' +
    '`_medidor-de-toque.mjs`.');

  assert.match(fuente, /elementsFromPoint/,
    '🔴 el guard ha dejado de medir QUÉ RECIBE EL TOQUE. Medir la caja daría 24 px para un enlace ' +
    'que sí es tocable en 44: mentiría hacia el lado incómodo, y peor, al revés si alguien quita ' +
    'el pseudo-elemento.');
  assert.match(fuente, /toLocaleUpperCase/,
    '🔴 el guard ha perdido la comparación insensible a mayúsculas: el árbol devuelve el texto ya ' +
    'transformado por `text-transform` y daría rojo permanente sin nada roto (medido en SCRUM-541).');
  assert.match(fuente, /no sabe decir que no/,
    '🔴 el guard ha perdido su CONTROL NEGATIVO del detector de toque.');
});
