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

// ── ② LOS SEPARADORES SIGUEN PUESTOS ────────────────────────────────────────
// No se comprueba cómo suena (eso es del navegador), sino que el espacio no se haya perdido en
// una edición posterior: es lo único que separa «Sin tarjeta Listo» de «Sin tarjetaListo».
test('SCRUM-543 · los separadores del héroe y de la demo no se han perdido', () => {
  const malos = [];
  if (!/<\/span> Sin tarjeta<span class="dot"><\/span> Listo/.test(LANDING)) {
    malos.push('héroe .note: falta el espacio tras alguno de los <span class="dot"> (vacíos: no aportan ninguno)');
  }
  const pasos = (LANDING.match(/<\/span><br> <span class="ts">/g) || []).length;
  if (pasos !== 5) malos.push(`demo: ${pasos} de 5 pasos con espacio tras el <br> (el <br> NO separa en el árbol)`);
  const nums = (LANDING.match(/<\/span> <span><span class="tt">/g) || []).length;
  if (nums !== 5) malos.push(`demo: ${nums} de 5 pasos con el número separado de su título`);
  assert.deepEqual(malos, [], '🔴 SEPARADORES PERDIDOS:\n    ' + malos.join('\n    '));
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

  const fuente = fs.readFileSync(script, 'utf8');
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
