// tests/scrum1016o-aria-label-firmado.test.mjs — SCRUM-1016o
//
// El `aria-label` de la animación del héroe (`<div class="stage">` de public/index.html) es lo que
// oye un lector de pantalla en lugar de la demo. Decía «Demostración: de presupuesto a cobro», y la
// animación termina en «Firmado»: nunca llega al cobro. La puerta de go-live lo tenía en su fila 12
// como «Falso siempre» (docs/go-live/puerta.json).
//
// FIRMA (regla 39): SCRUM-1016 c.20778, P4, 24-oct-2026 — el fundador firma el literal propuesto por
// J4 en c.20752. El literal de abajo se copió de ese comentario por programa, no a mano.
//
// POBLACIÓN: los `<div class="stage">` de la landing, fuera de los comentarios HTML. Hoy hay UNO.
// Si no se ve ninguno, el test dice CIEGO: «no hay label viejo» sin haber encontrado la animación
// no es un verde.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANDING = fs.readFileSync(path.join(RAIZ, 'public', 'index.html'), 'utf8');

const FIRMADO = 'Demostración: del presupuesto a la firma';
const VIEJO = 'Demostración: de presupuesto a cobro';

/** Los aria-label de cada `<div class="stage">` del HTML, quitados antes los comentarios. */
function labelsDeLaAnimacion(html) {
  const sinComentarios = html.replace(/<!--[\s\S]*?-->/g, '');
  const etiquetas = sinComentarios.match(/<div\b[^>]*\bclass="stage"[^>]*>/g) || [];
  return etiquetas.map((t) => (t.match(/\baria-label="([^"]*)"/) || [])[1] ?? null);
}

/** [] si la animación lleva el literal firmado; si no, qué falla. */
function juzgar(html) {
  const labels = labelsDeLaAnimacion(html);
  if (labels.length === 0) return ['🔴 CIEGO: no se ve ningún <div class="stage">; no se ha mirado nada.'];
  return labels
    .filter((l) => l !== FIRMADO)
    .map((l) => `🔴 la animación se anuncia como ${JSON.stringify(l)}, y lo firmado es ${JSON.stringify(FIRMADO)} (SCRUM-1016 c.20778).`);
}

test('SCRUM-1016o · la animación del héroe se anuncia con el literal firmado', () => {
  const labels = labelsDeLaAnimacion(LANDING);
  assert.equal(labels.length, 1, `🔴 se esperaba UNA animación (.stage) y se ven ${labels.length}.`);
  assert.deepEqual(juzgar(LANDING), []);
  assert.ok(!LANDING.includes(VIEJO), '🔴 el literal viejo sigue en la landing.');
});

test('SCRUM-1016o · el juez cae con el literal viejo y dice CIEGO sin animación', () => {
  const viejo = `<div class="stage" aria-label="${VIEJO}">`;
  assert.equal(juzgar(viejo).length, 1);
  assert.match(juzgar(viejo)[0], /de presupuesto a cobro/);
  assert.equal(juzgar('<div class="stage">').length, 1, 'una animación sin aria-label también cae');
  assert.match(juzgar('<p>nada</p>')[0], /CIEGO/);
  // Una animación comentada no cuenta: lo comentado no se sirve como nombre accesible.
  assert.match(juzgar(`<!-- <div class="stage" aria-label="${FIRMADO}"> -->`)[0], /CIEGO/);
  assert.deepEqual(juzgar(`<div class="stage" aria-label="${FIRMADO}">`), []);
});
