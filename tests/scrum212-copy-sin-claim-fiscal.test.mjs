// SCRUM-212 (hallazgo del censo) · LA LANDING DEL CLIENTE NO AFIRMA NADA FISCAL A PARTIR DE UN
// IMPORTE.
//
// EL DEFECTO, y por qué importa aunque el cliente nunca leyera la palabra:
//
//   · `quoteDecisionLanding.routes.ts` llamaba «exento» a una cuota 0 —en un comentario— y de
//     ahí razonaba el resto. **Una cuota 0 no es una exención**: puede ser un país donde no se
//     repercute, un tipo 0, o una línea sin tipo informado. «Exento» es una calificación con
//     causa legal propia (arts. 20-25 LIVA; en el registro VeriFactu se declara en
//     `OperacionExenta` con causa E1..E6, ni siquiera con el tipo), y quién lo es sale del
//     dictamen del asesor — no de que un número valga cero.
//   · Y el que SÍ veía el cliente: en la ruta de TRAMOS, el JS escribía
//     `'Total · ' + label + ' · IVA incluido'` SIN CONDICIÓN. Un presupuesto con tramos y cuota
//     0 le afirmaba al cliente que el IVA estaba incluido cuando no había ninguno. La ruta sin
//     tramos ya lo hacía bien («Total del presupuesto»); eran dos caminos con dos criterios.
//
// QUÉ VIGILA ESTE GUARD: que **ninguna de las dos rutas** derive una afirmación fiscal de un
// importe. No es «que no aparezca la palabra exento» — es que no aparezca **como conclusión de
// que la cuota vale cero**.
//
// ⚠️ MIRA EL HTML RENDERIZADO, NO EL FUENTE. Un guard de texto sobre el fichero se cazaría a sí
// mismo: sus comentarios están llenos de la palabra que vigila, escrita justo para explicar por
// qué no debe salir. Es la trampa de SCRUM-176/168/3/193, y el motivo de que este test importe
// las funciones y las EJECUTE.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderQuoteDetail,
  TIER_JS,
} from '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';

/** Presupuesto mínimo con el que la landing sabe renderizar. `tax` en FRACCIÓN (0.21 = 21 %). */
const presupuesto = (tax) => ({
  id: 1,
  token: 'tok',
  currency: 'EUR',
  total: 100,
  status: 'sent',
  createdAt: new Date('2026-07-01T10:00:00Z'),
  validUntil: null,
  paymentTerms: null,
  merchant: { name: 'Fontanería Demo', legalName: 'Fontanería Demo SL', logoUrl: null },
  customer: { name: 'Cliente' },
  lines: [{ concept: 'Reparación', qty: 1, price: 100, tax }],
});

const render = (tax, tiers = null) => renderQuoteDetail(presupuesto(tax), 'tok', tiers);

// ── 1 · SUELO ANTI-VERDE-HUECO ────────────────────────────────────────────────────────────
// Sin esto, el día que el render devolviera '' o petara, los asserts de ausencia de abajo
// pasarían en vacío sin comprobar nada. Un verde hueco es peor que un rojo.
test('SCRUM-212 · el render produce HTML de verdad (suelo)', () => {
  const html = render(0.21);
  assert.ok(html.length > 200, `el render devolvió algo vacío o mínimo (${html.length} chars)`);
  assert.ok(html.includes('Reparación'), 'el concepto de la línea no sale: la fixture no encaja');
});

// ── 2 · CONTROL POSITIVO: con IVA, SÍ se dice ─────────────────────────────────────────────
// Es la mitad que impide que este guard se cumpla borrando el copy: si «IVA incluido»
// desapareciera del todo, esto se pone rojo.
test('SCRUM-212 · con cuota > 0 la landing SÍ afirma «IVA incluido» y desglosa', () => {
  const html = render(0.21);
  assert.match(html, /IVA incluido/, '🔴 con IVA de verdad debe decirse: el cliente tiene que saberlo');
  assert.match(html, /Base imponible/, '🔴 falta el desglose con cuota > 0');
});

// ── 3 · EL GUARD · cuota 0 no genera NINGÚN claim fiscal ──────────────────────────────────
test('SCRUM-212 · con cuota 0 la landing NO dice «exento» ni afirma «IVA incluido»', () => {
  const html = render(0);

  assert.doesNotMatch(
    html, /exent/i,
    '🔴 LA LANDING LLAMA «EXENTO» A UN IMPORTE.\n\n' +
      '  Una cuota 0 no es una exención: puede ser un tipo 0, un país donde no se repercute, o\n' +
      '  una línea sin tipo. «Exento» es una calificación fiscal con causa legal (arts. 20-25\n' +
      '  LIVA) que en VeriFactu se declara en `OperacionExenta` con causa E1..E6 — y quién lo\n' +
      '  es lo dice el dictamen del asesor, no un número que vale cero.\n\n' +
      '  Esto además es SUPERFICIE PÚBLICA: lo lee el cliente final del profesional.',
  );

  assert.doesNotMatch(
    html, /IVA incluido/,
    '🔴 SE AFIRMA «IVA incluido» SIN QUE HAYA IVA.\n\n' +
      '  Con cuota 0 no hay nada incluido. El copy correcto sin cuota es «Total del\n' +
      '  presupuesto», que es lo que ya hacía esta misma ruta.',
  );

  // Y lo que SÍ debe salir, para que el guard no se cumpla dejando la pantalla muda.
  assert.match(html, /Total del presupuesto/,
    '🔴 sin cuota debe seguir habiendo etiqueta de total; callar no es la solución');
});

// ── 4 · LA RUTA DE TRAMOS: el claim va condicionado, no fijo ──────────────────────────────
// El JS de tramos corre en el navegador y reescribe la etiqueta del héroe. Aquí no hay DOM, así
// que se comprueba lo que se puede comprobar sin fingir cobertura: que el literal NO viaja
// pegado incondicionalmente, y que la decisión se toma mirando el bloque que el servidor solo
// pinta cuando hay cuota.
test('SCRUM-212 · el JS de tramos condiciona «IVA incluido», no lo concatena siempre', () => {
  const js = TIER_JS('tok');

  assert.ok(js.includes('amount-hero-label'),
    '🔴 el JS ya no toca la etiqueta del héroe: este guard dejó de vigilar nada');

  assert.doesNotMatch(
    js, /\+\s*'\s*·\s*IVA incluido'\s*;/,
    '🔴 «IVA incluido» vuelve a concatenarse SIN CONDICIÓN en la ruta de tramos.\n\n' +
      '  Un presupuesto con tramos y cuota 0 le afirmaría al cliente que el IVA está incluido\n' +
      '  cuando no hay ninguno. La condición debe salir de `.totals-block`, que el servidor\n' +
      '  solo pinta cuando hay cuota — así los dos caminos no pueden separarse.',
  );

  assert.match(js, /totals-block/,
    '🔴 el JS de tramos no consulta `.totals-block`: no está condicionando por la cuota real');
});
