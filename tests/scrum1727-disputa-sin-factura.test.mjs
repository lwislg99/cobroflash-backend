// SCRUM-1727 · El aviso de disputa de un cobro SIN factura ya no manda a «la factura».
//
// Hasta aquí, cuando un banco abría una disputa sobre un cobro que no tiene factura, el WhatsApp al
// profesional decía «Entra en la factura y pulsa "Paquete de disputa"». Esa factura no existe, y el
// paquete sólo se genera desde una factura (`GET /admin/invoices/:id/dispute-package`). El
// profesional buscaba una pantalla que no hay, justo cuando un banco le reclama el dinero.
//
// TEXTO FIRMADO: SCRUM-1656, texto 3 de la tanda del comentario 21722 (la PROPUESTA recomendada),
// firmado en el comentario 21724 («Ok firmo todo», transcrito por el orquestador del equipo de
// Javier). Copiado aquí ENTERO y a mano, no compuesto con trozos del código: si el código cambia una
// coma, esto cae. Ficha: `docs/microcopy/2026-11-12-SCRUM-1656-disputa-sin-factura.md`.
//
// Se ejecuta el camino real (`handleStripeDispute` desde dist/, base doblada, WhatsApp en dry-run),
// con el mismo banco que `tests/scrum1436-disputa-firmado-solo-con-firma.test.mjs`.
//
// Regla 28: no cambia ni CUÁNDO ni A QUIÉN. Se comprueba aquí: un solo texto, al mismo teléfono,
// con o sin factura.

import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';

const TELEFONO_PRO = '+34600000042'; // rango imposible de laboratorio (SCRUM-262)
const INTENT = 'pi_1TestDisputa1727';
const COBRO = 901;
const FACTURA = 'F-2026-017';
const CLIENTE = 'Cliente de laboratorio';

const { formatMoneyEs } = moduloDeDist('../dist/core/utils/utils.js');
const IMPORTE = formatMoneyEs(120, 'EUR');

// EL LITERAL FIRMADO (SCRUM-1656 c.21722 texto 3, firma c.21724): dos líneas.
const FIRMADO_SIN_FACTURA =
  `⚠️ El banco de ${CLIENTE} ha abierto una disputa por ${IMPORTE}.\n`
  + `Este cobro no tiene factura, así que no hay "Paquete de disputa". Reúne el presupuesto y los mensajes con ${CLIENTE} para responder al banco.`;

// El aviso CON factura y sin presupuesto, como está hoy (SCRUM-1436 c.18747). Tiene que seguir igual.
const FIRMADO_CON_FACTURA_SIN_PRESUPUESTO =
  `⚠️ El banco de ${CLIENTE} ha abierto una disputa por ${IMPORTE}. Entra en la factura ${FACTURA} y pulsa "Paquete de disputa": reúne lo que hay para responder al banco.`;

async function envioDe(factura, etiqueta) {
  inyectarBase({
    'charge.findFirst': (args) => (args?.where?.intentId !== INTENT ? null : {
      id: COBRO,
      merchantId: MERCHANT,
      customerId: 55,
      amount: '120.00',
      currency: 'EUR',
      merchant: { id: MERCHANT, name: 'Taller de prueba', whatsappPhone: TELEFONO_PRO },
      customer: { id: 55, name: CLIENTE },
    }),
    'invoice.findFirst': () => factura,
    'quote.findFirst': () => null,
  }, ['../dist/modules/payments/disputes.service.js',
      '../dist/modules/system/customerEvents.service.js',
      '../dist/integrations/whatsappNotifications.js']);

  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  try {
    const { handleStripeDispute } = moduloDeDist('../dist/modules/payments/disputes.service.js');
    assert.equal(typeof handleStripeDispute, 'function', '🔴 CIEGO: no se encuentra `handleStripeDispute` en `dist/`.');
    await handleStripeDispute(
      { id: `dp_1727_${etiqueta}`, payment_intent: INTENT, amount: 12000, currency: 'eur', reason: 'fraudulent' },
      `evt_1727_${etiqueta}`,
    );
  } finally {
    delete globalThis.__waDryRunOutbox;
  }
  // SUELO: «dice X» sobre un buzón vacío no mediría nada.
  assert.ok(buzon.length >= 1, `🔴 CIEGO (${etiqueta}): no ha salido nada hacia el profesional.`);
  return buzon;
}

const textos = (buzon) => buzon.filter((e) => e.kind === 'text');

// Mutaciones que este fichero TIENE que cazar (catálogo de la casa, `scripts/meta-guard-mutaciones.mjs`).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Vuelve el defecto: sin factura se cae al aviso que manda a «la factura».
    fichero: 'src/modules/payments/disputes.service.ts',
    de: 'if (p.numeroDeFactura === null) {',
    a: 'if (p.numeroDeFactura === undefined) {',
    cae: 'SCRUM-1727 · 🔴 el cobro NO tiene factura',
  },
  {
    // Una tilde menos en el literal firmado: el byte a byte tiene que verlo.
    fichero: 'src/modules/payments/disputes.service.ts',
    de: 'Este cobro no tiene factura, así que',
    a: 'Este cobro no tiene factura, asi que',
    cae: 'SCRUM-1727 · 🔴 el cobro NO tiene factura',
  },
  {
    // La condición al revés: el aviso CON factura recibe el texto sin factura. Cae el control.
    fichero: 'src/modules/payments/disputes.service.ts',
    de: 'if (p.numeroDeFactura === null) {',
    a: 'if (p.numeroDeFactura !== null) {',
    cae: 'SCRUM-1727 · ✅ CONTROL',
  },
];

test('SCRUM-1727 · 🔴 el cobro NO tiene factura → el aviso es el texto firmado, byte a byte, y no manda a «la factura»', async () => {
  const buzon = await envioDe(null, 'sin-factura');
  const t = textos(buzon);
  assert.equal(t.length, 1, `🔴 CIEGO: han salido ${t.length} textos y se esperaba 1. Buzón: ${JSON.stringify(buzon)}`);
  assert.ok(!t[0].text.includes('Entra en la factura'),
    `🔴 sin factura, el aviso sigue mandando al profesional a una factura que no existe:\n${t[0].text}`);
  assert.equal(t[0].text, FIRMADO_SIN_FACTURA, '🔴 el aviso sin factura no es el literal firmado en SCRUM-1656 c.21724.');
});

test('SCRUM-1727 · ✅ CONTROL: con factura, el aviso no cambia ni una letra', async () => {
  const buzon = await envioDe({ id: 1, number: FACTURA, quoteId: null }, 'con-factura');
  const t = textos(buzon);
  assert.equal(t.length, 1, `🔴 CIEGO: han salido ${t.length} textos y se esperaba 1.`);
  // Positivo del mismo token que el caso sin factura niega (SCRUM-237): con factura SÍ se manda a ella.
  assert.ok(t[0].text.includes('Entra en la factura'), '🔴 con factura, el aviso ya no manda a la factura.');
  assert.equal(t[0].text, FIRMADO_CON_FACTURA_SIN_PRESUPUESTO,
    '🔴 el arreglo del cobro sin factura ha tocado el aviso del cobro CON factura.');
});

test('SCRUM-1727 · ✅ regla 28: con y sin factura sale UN aviso, por la misma vía y al mismo teléfono', async () => {
  const sin = await envioDe(null, 'r28-sin');
  const con = await envioDe({ id: 1, number: FACTURA, quoteId: null }, 'r28-con');
  for (const [nombre, b] of [['sin factura', sin], ['con factura', con]]) {
    assert.equal(b.length, 1, `🔴 (${nombre}) han salido ${b.length} envíos y se esperaba 1: cambia CUÁNTO se manda.`);
    assert.equal(b[0].kind, 'text', `🔴 (${nombre}) la vía ha cambiado: ${b[0].kind}.`);
    // El envío normaliza el número (sin «+»): se compara por dígitos.
    assert.equal(String(b[0].to).replace(/\D/g, ''), TELEFONO_PRO.replace(/\D/g, ''),
      `🔴 (${nombre}) ha cambiado A QUIÉN se manda: ${b[0].to}.`);
  }
  assert.equal(sin[0].to, con[0].to, '🔴 con y sin factura el aviso va a sitios distintos.');
});
