// tests/scrum1636c-iva-con-coma-en-el-servidor.test.mjs — SCRUM-1636 · la mitad de S1
//
// EL TIPO DE IVA SE PINTABA CON PUNTO («IVA (7.5%)») en dos sitios del servidor:
//   · `quoteDecisionLanding.routes.ts` — la página donde EL CLIENTE FINAL acepta y firma.
//   · `presentacionIva.ts` (`pieDePresupuesto`) — el pie del PDF del presupuesto y, con descuento,
//     las filas de esa misma página.
// Criterio: `rotuloDeTipo`, el de la factura (SCRUM-636). Sin texto nuevo. NO toca el redondeo
// (SCRUM-1446/1608: un 7,5 sigue siendo 7,5, no 8) y un entero sale igual que antes («21», nunca
// «21,0»).
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderQuoteDetail } from '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';
import { pieDePresupuesto } from '../dist/modules/quotes/domain/presentacionIva.js';
import { calcTotal } from '../dist/core/utils/utils.js';
import { presupuesto } from './_fixtures-firma-888d.mjs';

/** Los rótulos del bloque de totales de la página, en orden. */
function rotulosDeTotales(html) {
  const inicio = html.search(/<div class="totals-block"[^>]*>/);
  assert.ok(inicio >= 0, '🔴 CIEGO: la página no pinta bloque de totales');
  const re = /<div class="totals-row"[^>]*><span[^>]*>([^<]*)<\/span>/g;
  const out = [];
  let m;
  while ((m = re.exec(html.slice(inicio))) !== null) out.push(m[1]);
  return out;
}

const pagina = (lines, global = null) =>
  renderQuoteDetail(presupuesto({ total: calcTotal(lines, global).toFixed(2), lines, discountGlobalAmount: global }), 'abc123', null);

const MEZCLA = [
  { concept: 'Material', qty: 2, price: 100, tax: 0.075 },
  { concept: 'Mano de obra', qty: 1, price: 50, tax: 0.21 },
];

test('SCRUM-1636c · ① la página de firma SIN descuento pinta «IVA (7,5%)», con coma', () => {
  const rotulos = rotulosDeTotales(pagina(MEZCLA));
  assert.ok(rotulos.includes('IVA (7,5%)'), `🔴 la página del cliente no pinta «IVA (7,5%)»: ${JSON.stringify(rotulos)}`);
  assert.ok(!rotulos.some((r) => r.includes('7.5')), `🔴 sigue saliendo un punto: ${JSON.stringify(rotulos)}`);
});

test('SCRUM-1636c · ② con descuento (el pie) la página sigue con SU rótulo «IVA (7,5%)», no el crudo', () => {
  const rotulos = rotulosDeTotales(pagina(MEZCLA, 10));
  assert.ok(rotulos.includes('Descuento global'), `🔴 CIEGO: no pasó por el pie: ${JSON.stringify(rotulos)}`);
  assert.ok(rotulos.includes('IVA (7,5%)'), `🔴 con descuento no sale «IVA (7,5%)»: ${JSON.stringify(rotulos)}`);
  assert.ok(!rotulos.some((r) => /^IVA \d/.test(r)), `🔴 el rótulo del pie se coló sin traducir: ${JSON.stringify(rotulos)}`);
});

test('SCRUM-1636c · ③ el pie del PDF del presupuesto rotula «IVA 7,5%:»', () => {
  const pie = pieDePresupuesto({ lineas: MEZCLA, modo: 'sumar', nombreImpuesto: 'IVA' });
  const ivas = pie.filas.map((f) => f.etiqueta).filter((e) => e.startsWith('IVA'));
  assert.deepEqual(ivas.sort(), ['IVA 21%:', 'IVA 7,5%:']);
});

test('SCRUM-1636c · ④ CONTROL: un tipo entero NO gana coma ni «,0» (página y pie)', () => {
  const enteros = [{ concept: 'A', qty: 1, price: 100, tax: 0.21 }, { concept: 'B', qty: 1, price: 100, tax: 0.10 }];
  for (const global of [null, 5]) {
    const rotulos = rotulosDeTotales(pagina(enteros, global));
    const ivas = rotulos.filter((r) => r.startsWith('IVA'));
    assert.deepEqual(ivas, ['IVA (21%)', 'IVA (10%)'], `🔴 global=${global}: ${JSON.stringify(rotulos)}`);
  }
  const pie = pieDePresupuesto({ lineas: enteros, modo: 'sumar', nombreImpuesto: 'IVA' });
  assert.ok(!pie.filas.some((f) => /,0%|,00%/.test(f.etiqueta)), JSON.stringify(pie.filas));
});
