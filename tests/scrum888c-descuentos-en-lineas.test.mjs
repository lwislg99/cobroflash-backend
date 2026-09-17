// tests/scrum888c-descuentos-en-lineas.test.mjs — SCRUM-888 (C + punto 1 front + borrador).
//
// ── QUÉ CUBRE ESTE FICHERO, Y QUÉ NO ─────────────────────────────────────────────────────────
// Lo PINTADO lo miden dos guards de navegador con el panel real:
//   · `guard:descuento-redibuja` — la fila de la vista previa = la fila del editor, y recargar
//     devuelve el dto y el descuento global del borrador;
//   · `guard:descuentos-en-el-detalle` — el detalle pinta líneas, base e IVA con los descuentos.
//
// Aquí, lo que se puede sin navegador:
//   1. la cuenta por línea (`importeDeLinea`): sin dto es EXACTAMENTE la de antes; con dto, la del editor;
//   2. que las tres filas (editor, vista previa, detalle) la usen, y que el detalle NO deduzca el
//      descuento global del total;
//   3. que el borrador guarde y restaure el dto de la línea y el descuento global;
//   4. y que los dos guards sigan en la puerta de CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import D from '../public/dashboard/js/quoteDescuentos.js';
import { soloEjecutable } from './_guard-texto.mjs';
import { fueraDeLaTanda } from '../scripts/guards-visuales.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => soloEjecutable(fs.readFileSync(path.join(RAIZ, rel), 'utf8'));

test('SCRUM-888c · POSITIVO: sin dto, `importeDeLinea` da EXACTAMENTE la cuenta de antes', () => {
  // Igualdad estricta de coma flotante, no «casi»: las tres filas pasaban de `qty × price × (1+tax)`
  // a esta función, y un céntimo de diferencia cambiaría una cifra que hoy está bien.
  for (const [qty, price, tax] of [[8, 24.95, 0.21], [11, 19.99, 0.10], [1, 120, 0.21], [3, 0.875, 0.21], [2.5, 13.33, 0.04]]) {
    const base = qty * price;
    const r = D.importeDeLinea(qty, price, null, tax);
    assert.equal(r.base, base);
    assert.equal(r.cuota, base * tax);
    assert.equal(r.total, base + base * tax);
    assert.deepEqual(D.importeDeLinea(qty, price, '', tax), r, '🔴 un dto vacío no es «sin descuento»');
  }
});

test('SCRUM-888c · 🔴 con dto, `importeDeLinea` aplica el dto como el editor (8 × 24,95 al 21 % con 15 % = 205,29 €)', () => {
  const r = D.importeDeLinea(8, 24.95, 15, 0.21);
  assert.equal(r.base, 8 * D.precioEfectivo(24.95, 15));
  assert.equal(Math.round(r.total * 100), 20529);
  assert.notEqual(Math.round(r.total * 100), 24152, '🔴 el dto no se aplica: es la cifra del defecto');
  // Lo ilegible vale 0, como en `totalesConDescuento`.
  assert.deepEqual(D.importeDeLinea('x', 10, null, 0.21), { base: 0, cuota: 0, total: 0 });
});

test('SCRUM-888c · 🔴 las TRES filas (editor, vista previa, detalle) usan `importeDeLinea`', () => {
  const vista = leer('public/dashboard/js/quotesView.js');
  const usos = vista.match(/quoteDescuentos\.importeDeLinea\(/g) || [];
  assert.ok(usos.length >= 2, `🔴 quotesView.js llama ${usos.length} vez/veces a importeDeLinea: la fila del editor y la de la vista previa tienen que usarla las dos`);
  const previa = vista.slice(vista.indexOf('function renderPreview('));
  assert.ok(previa.slice(0, previa.indexOf('.filter(Boolean)')).includes('importeDeLinea('),
    '🔴 la fila de la vista previa vuelve a hacer su propia cuenta (sin el dto de la línea)');

  const detalle = leer('public/dashboard/js/quotesDetailView.js');
  assert.ok(detalle.includes('quoteDescuentos.importeDeLinea('), '🔴 la fila del detalle no usa importeDeLinea');
  assert.ok(!/const base = qty \* price/.test(detalle), '🔴 el detalle vuelve a calcular la base de la línea a mano');
});

test('SCRUM-888c · 🔴 el detalle toma base e IVA de `totalesConDescuento` con el global del SERVIDOR, sin deducirlo del total', () => {
  const detalle = leer('public/dashboard/js/quotesDetailView.js');
  assert.match(detalle, /quoteDescuentos\.totalesConDescuento\(\s*lineasParaTotales\s*,\s*descuentoGlobal\s*\)/,
    '🔴 base e IVA del detalle no salen de la cuenta compartida');
  assert.match(detalle, /const descuentoGlobal = quote\.discountGlobalAmount \?\? null/,
    '🔴 el global del detalle ya no sale de `quote.discountGlobalAmount`');
  assert.ok(!/quote\.total\s*-/.test(detalle),
    '🔴 algo resta del total guardado: deducir el descuento global del total es una segunda cuenta');
});

test('SCRUM-888c · 🔴 el borrador guarda y restaura el dto de la línea y el descuento global', () => {
  const vista = leer('public/dashboard/js/quotesView.js');
  const guardar = vista.slice(vista.indexOf('function saveDraft('), vista.indexOf('function scheduleDraftSave('));
  assert.match(guardar, /\bdto:\s*\(l\.dtoInput && l\.dtoInput\.value\) \|\| ""/, '🔴 saveDraft no guarda el dto de la línea');
  assert.match(guardar, /\bdescuentoGlobal:\s*descuentoGlobalInput\.value \|\| ""/, '🔴 saveDraft no guarda el descuento global');
  const cargar = vista.slice(vista.indexOf('function loadDraft('), vista.indexOf('function formatMoney('));
  assert.match(cargar, /descuentoGlobalInput\.value = d\.descuentoGlobal/, '🔴 loadDraft no restaura el descuento global');
  assert.match(cargar, /dtoGlobalCampo\.hidden = false/, '🔴 el global se restaura detrás de un botón cerrado: nadie lo ve');
  // El dto de la línea vuelve por `addLine`, que lo lee de `initial.dto`.
  assert.match(vista, /dtoInput\.value = initial && initial\.dto != null/, '🔴 addLine ya no lee `initial.dto`');
});

test('SCRUM-888c · los dos guards de navegador siguen en la puerta de CI (guards:visuales)', () => {
  const fuera = fueraDeLaTanda();
  for (const g of ['guard:descuento-redibuja', 'guard:descuentos-en-el-detalle']) {
    assert.ok(fuera.includes(g), `🔴 guards:visuales ya no recoge \`${g}\``);
  }
});
