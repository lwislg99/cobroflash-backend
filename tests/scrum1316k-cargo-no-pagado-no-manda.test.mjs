/**
 * SCRUM-1316k · UN CARGO NO PAGADO NO MANDA SOBRE EL MÉTODO DECLARADO
 *
 * Decisión del fundador: SCRUM-1316 c.22438, punto 2. Hallazgo: c.22437 (jv-j2eb).
 *
 * `metodoDeUnCobro` preferia `Charge.method` aunque el cargo NO estuviera pagado. `Charge.method`
 * se escribe al CREAR el cargo (la intención, `metodoDesdePreferencia`), no al cobrarlo: un cargo
 * `pending` o `failed` con `method = card` no dice que el dinero entrara con tarjeta. Medido en
 * staging (c.22437): 1 factura `paid` con `paid_via = bizum_manual` cuyo cargo sigue `pending` con
 * `method = card`; el recibo HTML (`invoicesAdmin.routes.ts`, que ya selecciona `charge.status`)
 * decía «card».
 *
 * La regla: solo un cargo con `status = 'paid'` aporta su método; si no, manda `paidVia` (lo
 * declarado); si no hay nada, `null` = «no consta» (política de `metodoDeCobro.ts`, que no cambia).
 *
 * ⚠️ Si el llamador NO trae el estado del cargo (`status` ausente), se conserva lo de antes: el
 * cargo manda. Es a propósito y está acotado: el informe X2 (`reports.routes.ts`, carril S1) solo
 * selecciona `charge.method`; tratar el estado ausente como «no pagado» le quitaría el método a las
 * facturas pagadas por pasarela sin `paid_via` (dev: 9 de 9). La línea de S1 está pedida en
 * SCRUM-1316 c.22445. El caso ⑤ fija ese comportamiento para que no cambie sin querer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { metodoDeUnCobro, ROTULO_SIN_METODO } =
  await import('../dist/modules/billing/domain/metodoDeCobro.js');

// Mutaciones (A3, SCRUM-1731): catálogo de la casa, se aplican con `aplicarUna`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Vuelve a preferir el cargo aunque no esté pagado: el defecto de c.22437.
    fichero: 'src/modules/billing/domain/metodoDeCobro.ts',
    de: "const cargoQueCuenta = cobro.charge && cargoAportaMetodo(cobro.charge) ? cobro.charge : null;",
    a: 'const cargoQueCuenta = cobro.charge ?? null;',
    cae: 'cargo de tarjeta NO pagado y Bizum declarado',
  },
];

// ① El caso real de staging: factura cobrada a mano como Bizum, cargo de tarjeta sin pagar.
test('SCRUM-1316k · ① cargo de tarjeta NO pagado y Bizum declarado → Bizum (pending, failed, expired)', () => {
  for (const status of ['pending', 'failed', 'expired']) {
    const factura = { paidVia: 'bizum_manual', charge: { method: 'card', status } };
    assert.equal(metodoDeUnCobro(factura), 'bizum_manual',
      `🔴 un cargo «${status}» manda sobre lo declarado: el recibo diría tarjeta.`);
  }
});

// ② Control: el cargo PAGADO sigue mandando (el hecho consumado gana a lo declarado).
test('SCRUM-1316k · ② control: cargo de tarjeta PAGADO → tarjeta, como hoy', () => {
  assert.equal(metodoDeUnCobro({ paidVia: null, charge: { method: 'card', status: 'paid' } }), 'card');
  assert.equal(metodoDeUnCobro({ paidVia: 'bizum_manual', charge: { method: 'card', status: 'paid' } }), 'card',
    '🔴 con el cargo pagado manda el cargo, aunque haya algo declarado.');
});

// ③ Cargo no pagado y nada declarado → «no consta», no el método del intento.
test('SCRUM-1316k · ③ cargo NO pagado y nada declarado → no consta (null)', () => {
  for (const paidVia of [null, '', '   ', undefined]) {
    const f = { paidVia, charge: { method: 'card', status: 'pending' } };
    assert.equal(metodoDeUnCobro(f), null, `🔴 paidVia=${JSON.stringify(paidVia)} se inventa «card».`);
    assert.equal(metodoDeUnCobro(f) ?? ROTULO_SIN_METODO, ROTULO_SIN_METODO);
  }
});

// ④ Sin cargo, lo de siempre (Cobros pasa facturas sin `charge`).
test('SCRUM-1316k · ④ sin cargo: manda lo declarado, o null', () => {
  assert.equal(metodoDeUnCobro({ paidVia: 'transfer' }), 'transfer');
  assert.equal(metodoDeUnCobro({ paidVia: 'transfer', charge: null }), 'transfer');
  assert.equal(metodoDeUnCobro({ paidVia: null, charge: null }), null);
});

// ⑤ Estado AUSENTE (el llamador no lo seleccionó): se conserva el comportamiento anterior.
test('SCRUM-1316k · ⑤ estado del cargo AUSENTE → el cargo manda, como antes (informe X2, S1)', () => {
  assert.equal(metodoDeUnCobro({ paidVia: null, charge: { method: 'card' } }), 'card',
    '🔴 un llamador sin `status` pierde el método de los cobros por pasarela.');
  assert.equal(metodoDeUnCobro({ paidVia: 'bizum_manual', charge: { method: 'card' } }), 'card');
});
