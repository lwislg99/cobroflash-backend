// tests/scrum544-reserva-barra-anuncio.test.mjs — SCRUM-544 · la barra guarda su sitio.
//
// El árbitro del salto es el NAVEGADOR (`npm run guard:cls-barra-anuncio`, con 4G emulada y los
// tres casos). Esto es la red que SÍ corre siempre: vigila que el mecanismo siga en pie, porque
// una regla CSS de una línea es exactamente lo que se borra «limpiando» sin que nadie lo note.
//
// Lo que sostiene:
//   ① la reserva existe y es la que ocupa sitio SIN pintar (`visibility`, no `display`);
//   ② NO hay una altura escrita a mano — el hueco lo calcula el navegador con el contenido real;
//   ③ el interruptor sigue siendo `hidden`, que es lo que mueve el JS del contador;
//   ④ SUELO: si el extractor no encuentra la barra, se declara ciego en vez de dar verde.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANDING = path.join(RAIZ, 'public', 'index.html');
const html = fs.readFileSync(LANDING, 'utf8');

/** Las reglas CSS que mencionan `.announce`, sin comentarios (que es donde se explica la regla). */
function reglasDeLaBarra(texto = html) {
  const sinComentarios = texto.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  return (sinComentarios.match(/\.announce[^{]*\{[^}]*\}/g) || []);
}

test('SCRUM-544 · 🔴 SUELO: si no se encuentran las reglas de la barra, se declara CIEGO', () => {
  assert.equal(reglasDeLaBarra('<style>.otra{color:red}</style>').length, 0,
    'control: sobre un CSS sin `.announce` tiene que devolver 0');
  const reglas = reglasDeLaBarra();
  assert.ok(reglas.length >= 3,
    '🔴 solo ' + reglas.length + ' reglas de `.announce` en la landing. El extractor no está ' +
    'mirando donde cree, y entonces el verde de abajo no significa «la reserva está»: significa ' +
    '«no supe buscarla».');
});

test('SCRUM-544 · 🔴 la barra RESERVA su sitio: `hidden` no la saca del flujo', () => {
  const reglas = reglasDeLaBarra();
  const reserva = reglas.find((r) => /\.announce\[hidden\]/.test(r));
  assert.ok(reserva,
    '🔴 NO ESTÁ LA RESERVA. Sin la regla `.announce[hidden]`, el atributo vale `display:none`: la ' +
    'barra desaparece del flujo y, al llegar la respuesta de `/public/founding-status`, se ' +
    'despliega empujando la página entera. Medido en Edge con 4G: CLS 0,386 a 360 px y 0,108 a ' +
    '390, contra un límite de 0,1. Compruébalo con `npm run guard:cls-barra-anuncio`.');
  assert.match(reserva, /visibility\s*:\s*hidden/,
    '🔴 la reserva no oculta con `visibility`. Con `display:none` la caja no ocupa sitio y no hay ' +
    'reserva; con `visibility:hidden` ocupa y además sale del árbol de accesibilidad.');
  assert.match(reserva, /display\s*:\s*block/,
    '🔴 falta devolverle el `display`: el `hidden` del navegador impone `display:none` y hay que ' +
    'anularlo explícitamente, o la regla de `visibility` no llega a aplicarse.');
});

test('SCRUM-544 · 🔴 la reserva NO lleva una altura escrita a mano', () => {
  const reserva = reglasDeLaBarra().find((r) => /\.announce\[hidden\]/.test(r));
  assert.doesNotMatch(reserva, /(min-)?height\s*:\s*[0-9]/,
    '🔴 la reserva tiene una altura fija. Medido: la barra ocupa 112 px a 320 y 360, 91 de 390 a ' +
    '600, 95 a 601 y 44 a 1200 — cinco alturas, y cambian además con lo que devuelva el fetch. ' +
    'Una altura a ojo o se queda corta (vuelve a desplazar) o se pasa (hueco en blanco en la ' +
    'parte más cara de la página). El hueco lo calcula el navegador con el contenido real.');
});

test('SCRUM-544 · el interruptor sigue siendo `hidden`, que es lo que mueve el contador', () => {
  // Si alguien cambiara el JS a `style.display` o a una clase, la reserva dejaría de aplicarse
  // y el salto volvería en silencio: la regla CSS seguiría ahí, verde, sin gobernar nada.
  assert.match(html, /<div class="announce" id="announce" hidden>/,
    '🔴 la barra ya no nace con el atributo `hidden`: la reserva cuelga de `.announce[hidden]` y ' +
    'dejaría de aplicarse.');
  assert.match(html, /getElementById\('announce'\)[\s\S]{0,80}?hidden\s*=\s*false/,
    '🔴 el contador ya no despliega la barra con `hidden = false`. Si pasó a `display` o a una ' +
    'clase, la reserva no gobierna nada y el salto vuelve sin que este test se entere.');
});

test('SCRUM-544 · el texto de la barra NO se toca (regla 30 + A22)', () => {
  // Este ticket es de maquetación. Que la oferta y su condición sigan literales lo garantiza el
  // guard de SCRUM-341; aquí se fija lo mínimo: que el bloque de la escasez siga siendo el mismo
  // elemento separado que SCRUM-330 dejó, para poder ocultarlo solo.
  assert.match(html, /id="ann-plazas"/,
    '🔴 ha desaparecido `#ann-plazas`: es el contenedor que SCRUM-330 separó para poder ocultar la ' +
    'escasez sin llevarse la oferta por delante.');
  assert.match(html, /id="ann-left"/, '🔴 ha desaparecido `#ann-left`, donde se escribe el número');
});
