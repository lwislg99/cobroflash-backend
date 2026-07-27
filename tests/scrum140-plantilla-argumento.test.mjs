// SCRUM-140 — la plantilla viaja como ARGUMENTO, no por un canal global implícito.
//
// QUÉ ELIMINA (no "mitiga"): `sessionStorage['pf_load_template']` era un canal global entre dos
// escritores (`templatesView` «Usar», `quotesDetailView` «Duplicar») y un lector (`quotesView`).
// De ese diseño salieron los dos fallos de SCRUM-134:
//   1. OFF-BY-ONE — el escritor navegaba ANTES de escribir y el lector corre síncrono dentro de
//      esa navegación → abría la plantilla de la vez anterior.
//   2. HUÉRFANA — lo escrito y no consumido sobrevivía y pre-rellenaba un "+ Nuevo presupuesto"
//      normal con líneas que nadie pidió (líneas = dinero).
// SCRUM-134 los cerró de forma DEFENSIVA (swap de orden + sello `_ts` con ventana de 15 s). Este
// ticket quita la causa: con un argumento no hay orden que respetar, ni estado residual que
// consumir, ni umbral temporal que ajustar.
//
// ⚠️ LÍMITE HONESTO: guard ESTRUCTURAL sobre el fuente. `app.js`/`quotesView.js` son vanilla de
// navegador (usan `document`/`sessionStorage`, sin bundler) y no se pueden importar en node para
// ejecutar la navegación. Verifica que el CANAL no ha vuelto y que el argumento se pasa y se
// recibe — no que el navegador lo renderice bien. La verificación de comportamiento es el guion
// de staging de SCRUM-134 (2 plantillas efímeras: A→A, B→B, nuevo→vacío).
//
// SIN GATE: solo lee ficheros.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const JS = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'public', 'dashboard', 'js');
const leer = (f) => fs.readFileSync(path.join(JS, f), 'utf8');
/** Líneas de CÓDIGO (sin comentarios): los comentarios SÍ pueden nombrar el canal retirado. */
const codigo = (f) => leer(f).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

test('SCRUM-140: el canal global sessionStorage ha DESAPARECIDO del código', () => {
  // Este es el assert central: si vuelve la clave, vuelve la clase entera (off-by-one + huérfana).
  const conCanal = fs.readdirSync(JS)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => /pf_load_template/.test(codigo(f)));

  assert.deepEqual(conCanal, [],
    `\n🔴 Vuelve el canal global 'pf_load_template' en: ${conCanal.join(', ')}\n` +
    'La plantilla se pasa como ARGUMENTO: renderAppView("quotes-new", { template }).\n' +
    'Con sessionStorage vuelven el orden escribir/navegar y la plantilla huérfana (SCRUM-134).\n');
});

test('SCRUM-140: sobra el sello de frescura — era una heurística temporal, no una garantía', () => {
  // `_ts` + ventana de 15 s existía solo para distinguir "recién escrita" de "huérfana". Sin
  // canal no hay huérfanas, así que el umbral (que podía descartar una plantilla legítima en una
  // navegación lenta) deja de tener sentido.
  assert.doesNotMatch(codigo('quotesView.js'), /_ts/, 'quotesView ya no comprueba frescura');
  assert.doesNotMatch(codigo('templatesView.js'), /_ts/, 'templatesView ya no sella frescura');
  assert.doesNotMatch(codigo('quotesDetailView.js'), /_ts/, 'quotesDetailView ya no sella frescura');
});

test('SCRUM-140: los dos escritores pasan la plantilla como argumento de la navegación', () => {
  for (const f of ['templatesView.js', 'quotesDetailView.js']) {
    assert.match(codigo(f), /renderAppView\(\s*['"]quotes-new['"]\s*,\s*\{\s*template:/,
      `${f} debe navegar con { template: … }`);
  }
});

test('SCRUM-140: el acoplamiento es VISIBLE en la firma, y la vista lo recibe', () => {
  // Antes nada en `renderQuotesView(container)` decía que su contenido podía venir de otra vista.
  assert.match(codigo('quotesView.js'), /function renderQuotesView\(\s*container\s*,\s*template\s*\)/,
    'renderQuotesView debe declarar `template` en su firma');
  assert.match(codigo('app.js'), /renderQuotesView\(\s*viewContainer\s*,\s*options\.template/,
    'app.js debe pasar options.template a la vista');
});

test('SCRUM-140: la plantilla NO se persiste en appState (sería el estado residual otra vez)', () => {
  // `renderView` guarda quoteId/invoiceId/jobId en `state` porque son de vista. La plantilla es
  // de UN SOLO USO: persistirla reintroduciría exactamente la huérfana que se está eliminando.
  assert.doesNotMatch(codigo('app.js'), /state\.template\s*=/,
    'la plantilla no debe guardarse en window.appState');
});

test('SCRUM-140: sin plantilla, el editor NO carga líneas (las 5 navegaciones que no la pasan)', () => {
  // customerDetailView, invoicesView, quoteRequestsView, el "+ Nuevo presupuesto" de
  // templatesView y el deep-link por hash navegan a 'quotes-new' SIN plantilla. Con el canal
  // global podían recoger lo que otra vista hubiera dejado escrito; con argumento reciben null.
  const src = codigo('quotesView.js');
  assert.match(src, /if\s*\(\s*template\s*&&\s*Array\.isArray\(template\.lines\)\s*&&\s*template\.lines\.length\s*>\s*0\s*\)/,
    'solo se cargan líneas si la plantilla llega Y trae líneas');
});
