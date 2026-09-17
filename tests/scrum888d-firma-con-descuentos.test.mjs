// tests/scrum888d-firma-con-descuentos.test.mjs — SCRUM-888 · punto 1 (página de firma del cliente)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA PÁGINA DE FIRMA SUMA EL TOTAL QUE EL CLIENTE FIRMA
//
// `quoteDecisionLanding.routes.ts` pintaba «Base imponible» e «IVA (x%)» con `calcVatBreakdown`
// sobre las líneas SIN descuentos, bajo un total que SÍ los lleva (`calcTotal`). Medido:
//   · C3-B (todo 21 %, dto de línea + 25 € global), firma 559,70: Base 539,49 · IVA 113,29 → 652,78.
//   · C3 (21 % y 10 %), firma 539,05: Base 539,49 · IVA 67,12 · IVA 21,99 → 628,60.
//
// ── LA FIRMA (SCRUM-888 comentario 15788, orquestador por delegación del fundador) ───────────────
//   · La MISMA cuenta que el pie del PDF del presupuesto (`pieDePresupuesto`).
//   (a) Tres filas con los rótulos de SCRUM-594, sin dos puntos: «Suma de líneas», «Descuento»,
//       «Descuento global». (b) El IVA mantiene el rótulo de la página, «IVA (21%)».
//   (c) La página sigue siempre en el modo «sumar»; «IVA no incluido» queda fuera (hueco declarado).
//   · SIN descuentos, la página sale byte a byte igual que antes (el céntimo del punto 4 no se toca).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { renderQuoteDetail } from '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';
import { pieDePresupuesto } from '../dist/modules/quotes/domain/presentacionIva.js';
import { calcTotal, formatMoneyEs } from '../dist/core/utils/utils.js';
import { presupuesto, FIXTURES_SIN_DESCUENTO } from './_fixtures-firma-888d.mjs';

/** Las filas del bloque de totales de la página, en orden: [rótulo, importe tal cual se ve]. */
function filasDeTotales(html) {
  // Con hueco para atributos en cada etiqueta (SCRUM-553): se leen las filas, no la forma exacta.
  const inicio = html.search(/<div class="totals-block"[^>]*>/);
  if (inicio < 0) return [];
  const filas = [];
  const re = /<div class="totals-row"[^>]*><span[^>]*>([^<]*)<\/span><span[^>]*>([^<]*)<\/span><\/div>/g;
  let m;
  while ((m = re.exec(html.slice(inicio))) !== null) filas.push([m[1], m[2]]);
  return filas;
}

/** El importe de una fila de la página, de vuelta a céntimos. «1.234,56 €» / «-25,00 €». */
const centimos = (txt) => Math.round(Number(String(txt).replace(/[^\d,-]/g, '').replace(',', '.')) * 100);

const C3_UN_IVA = [
  { concept: 'Punto de luz', qty: 8, price: 24.95, dto: 15, tax: 0.21 },
  { concept: 'Base de enchufe schuko', qty: 11, price: 19.99, dto: 10, tax: 0.21 },
  { concept: 'Boletín eléctrico (CIE)', qty: 1, price: 120, tax: 0.21 },
];
const C3 = [C3_UN_IVA[0], { ...C3_UN_IVA[1], tax: 0.10 }, C3_UN_IVA[2]];

const CASOS = [
  ['C3-B · dto de línea + global, un IVA', C3_UN_IVA, 25,
    ['Suma de líneas', 'Descuento', 'Descuento global', 'Base imponible', 'IVA (21%)']],
  ['C3 · dto de línea + global, IVA mezclado', C3, 25,
    ['Suma de líneas', 'Descuento', 'Descuento global', 'Base imponible', 'IVA (21%)', 'IVA (10%)']],
  ['solo dto de línea', C3_UN_IVA, null,
    ['Suma de líneas', 'Descuento', 'Base imponible', 'IVA (21%)']],
  ['solo global', C3_UN_IVA.map(({ dto, ...l }) => l), '25.00',
    ['Suma de líneas', 'Descuento global', 'Base imponible', 'IVA (21%)']],
];

test('SCRUM-888d · 🔴 con descuentos, base e IVA de la página suman EXACTAMENTE el total firmado', () => {
  for (const [nombre, lines, global, rotulos] of CASOS) {
    const total = calcTotal(lines, global);
    const html = renderQuoteDetail(presupuesto({ total: total.toFixed(2), lines, discountGlobalAmount: global }), 'abc123', null);
    const filas = filasDeTotales(html);
    assert.deepEqual(filas.map(([r]) => r), rotulos, `🔴 ${nombre}: las filas no son las firmadas (15788)`);

    const baseEIva = filas.filter(([r]) => r === 'Base imponible' || r.startsWith('IVA ('))
      .reduce((a, [, imp]) => a + centimos(imp), 0);
    assert.equal(baseEIva, Math.round(total * 100),
      `🔴 ${nombre}: el cliente firma ${total.toFixed(2)} € y la página le suma ${(baseEIva / 100).toFixed(2)} €`);

    // Cada importe es EL del pie del PDF, pintado como la página pinta el dinero.
    const pie = pieDePresupuesto({ lineas: lines, modo: 'sumar', nombreImpuesto: 'IVA', descuentoGlobal: global });
    assert.deepEqual(filas.map(([, imp]) => imp), pie.filas.map((f) => formatMoneyEs(f.importe, 'EUR')),
      `🔴 ${nombre}: algún importe no es el del pie del documento`);
  }
});

test('SCRUM-888d · ✅ SIN descuentos, las páginas son BYTE A BYTE las de antes del arreglo (8 casos)', () => {
  // Huella tomada con el código anterior (main 2be8fe16 + el GET de este PR, que no toca la página).
  const HUELLA = '4eaf52182a7f1945309de9c0dcd3d5ca1bce20293cdafaee5135cd908d14ca9e';
  assert.equal(FIXTURES_SIN_DESCUENTO.length, 8, '🔴 CIEGO: la muestra no es la de la huella');
  const h = createHash('sha256');
  for (const [nombre, q, tiers] of FIXTURES_SIN_DESCUENTO) h.update(nombre + '\n' + renderQuoteDetail(q, 'abc123', tiers) + '\n');
  assert.equal(h.digest('hex'), HUELLA,
    '🔴 una página SIN descuento ha cambiado: este arreglo sólo puede tocar las que llevan descuento');
  // SUELO: la huella mira páginas con bloque de IVA (si no, un bloque roto pasaría igual).
  const [, c1] = FIXTURES_SIN_DESCUENTO[0];
  assert.deepEqual(filasDeTotales(renderQuoteDetail(c1, 'abc123', null)).map(([r]) => r), ['Base imponible', 'IVA (21%)'],
    '🔴 CIEGO: C1 ya no pinta su bloque de totales');
});
