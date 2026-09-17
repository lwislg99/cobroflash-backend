// tests/scrum888b-descuento-redibuja.test.mjs — SCRUM-888 (punto 2).
//
// ── QUÉ CUBRE ESTE FICHERO, Y QUÉ NO ─────────────────────────────────────────────────────────
// El COMPORTAMIENTO —teclear un dto de línea o un descuento global y que el total grande y la vista
// previa digan lo mismo— lo mide `scripts/guard-descuento-redibuja.mjs` en navegador, con el panel
// real. `npm test` no arranca navegador, y el banco de Node repinta el total con `innerHTML`
// acumulando nodos (SCRUM-897), así que mediría otra cosa.
//
// Aquí se vigila el CABLEADO, que es lo que se rompió las dos veces:
//   1. el descuento global recalcula, REDIBUJA la vista previa y guarda el borrador;
//   2. el dto de línea escucha `input` con el MISMO `onChange` que cantidad, precio e IVA;
//   3. y el guard de navegador sigue en la puerta de CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { soloEjecutable } from './_guard-texto.mjs';
import { fueraDeLaTanda } from '../scripts/guards-visuales.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const vista = soloEjecutable(fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/quotesView.js'), 'utf8'));

/** El cuerpo de la función que se pasa como oyente, recortado casando llaves. */
function cuerpoDelOyente(fuente, ancla) {
  const desde = fuente.indexOf(ancla);
  if (desde === -1) return null;
  const abre = fuente.indexOf('{', desde + ancla.length);
  let nivel = 0;
  for (let i = abre; i < fuente.length; i++) {
    if (fuente[i] === '{') nivel++;
    else if (fuente[i] === '}' && --nivel === 0) return fuente.slice(abre, i + 1);
  }
  return null;
}

test('SCRUM-888 · 🔴 el descuento global redibuja la vista previa y guarda el borrador, no solo recalcula', () => {
  const cuerpo = cuerpoDelOyente(vista, 'descuentoGlobalInput.addEventListener("input", function ()');
  assert.ok(cuerpo, '🔴 el descuento global ya no escucha `input` con una función: no sé qué hace al teclear');
  for (const pieza of ['recalcTotals()', 'renderPreview()', 'scheduleDraftSave()']) {
    assert.ok(cuerpo.includes(pieza), `🔴 al teclear el descuento global ya no se llama a \`${pieza}\`. `
      + 'Medido en staging (17-sep-2026): sin `renderPreview` el total dice 175,04 € y la vista previa 241,52 €.');
  }
});

test('SCRUM-888 · 🔴 el dto de línea escucha `input` con el MISMO onChange que cantidad, precio e IVA', () => {
  assert.match(vista, /\bdtoInput\.addEventListener\(\s*"input"\s*,\s*onChange\s*\)/,
    '🔴 el dto de línea vuelve a no tener oyente (o tiene uno propio): teclear un 15 % no movería ni el '
    + 'total ni la vista previa');
  // Y ese `onChange` es el de la línea: el que ya usan los otros campos del dinero.
  for (const campo of ['qtyInput', 'vatInput']) {
    assert.match(vista, new RegExp(`\\b${campo}\\.addEventListener\\(\\s*"input"\\s*,\\s*onChange\\s*\\)`),
      `🔴 \`${campo}\` ya no usa \`onChange\`: la comparación de arriba ha dejado de significar «el mismo camino»`);
  }
});

test('SCRUM-888 · el guard de navegador existe y sigue en la puerta de CI (guards:visuales)', () => {
  assert.ok(fs.existsSync(path.join(RAIZ, 'scripts/guard-descuento-redibuja.mjs')));
  assert.ok(fueraDeLaTanda().includes('guard:descuento-redibuja'),
    '🔴 guards:visuales ya no recoge el guard: el comportamiento dejaría de medirse en cada PR');
});
