// SCRUM-115 — un envío de WhatsApp que NO llega a Meta (guard, credencial, error de API)
// antes desaparecía sin dejar rastro: sendWhatsAppTemplate solo llamaba a recordWaMessage
// (WA-0b) en el camino de ÉXITO, y sendWhatsAppText no lo llamaba nunca. El front podía
// arreglarse para leer bien `ok`/`sent`, pero el título del ticket ("el fallo no se
// registra en ningún sitio") seguía siendo cierto: nada quedaba para consultar más allá
// de un console.error o un toast que desaparece en unos segundos.
//
// Este test fija que un guard bloqueado deja una fila `status:'failed'` en WA-0b, Y que
// esa fila tiene `waMessageId: null` — la señal que usan los topes A3.2/J6 para NO contar
// intentos que nunca llegaron a Meta como si hubieran consumido cupo/gasto.
//
// ⚠️ Toca BD real (staging), gateado:
//   QA_DB_TEST=1 WHATSAPP_DRY_RUN=1 DATABASE_URL_STAGING="..." npm run test:staging
import './_staging-db.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { withMerchant, registrarBarridoFinal } from './_merchant-fixture.mjs';

const ENABLED = process.env.QA_DB_TEST === '1';

test('SCRUM-115: sendWhatsAppTemplate bloqueado por wa_opt_out registra status:failed en WA-0b (waMessageId null)', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  registrarBarridoFinal(prisma);
  const { sendWhatsAppTemplate } = await import('../dist/integrations/whatsapp.js');

  await withMerchant(prisma, { name: 'QA SCRUM-115', email: `qa-scrum115-${Date.now()}@test.local` }, async (merchant) => {
    const phone = '34600000088';
    const customer = await prisma.customer.create({
      data: { merchantId: merchant.id, name: 'Cliente opt-out', phone, waOptOut: true },
    });

    const t0 = new Date();
    const result = await sendWhatsAppTemplate({
      to: phone,
      templateName: 'payment_request_es',
      merchantId: merchant.id,
      log: { customerId: customer.id, relatedType: 'invoice', relatedId: 999 },
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'wa_opt_out');

    // Fire-and-forget: esperar con reintento corto a que el INSERT aterrice.
    let row = null;
    for (let i = 0; i < 30 && !row; i++) {
      row = await prisma.whatsAppMessage.findFirst({
        where: { merchantId: merchant.id, customerId: customer.id, createdAt: { gte: t0 } },
      });
      if (!row) await new Promise((r) => setTimeout(r, 100));
    }

    assert.ok(row, 'debe quedar una fila en WA-0b para el intento bloqueado');
    assert.equal(row.status, 'failed');
    assert.equal(row.error, 'wa_opt_out');
    assert.equal(row.type, 'template');
    assert.equal(row.relatedType, 'invoice');
    assert.equal(row.relatedId, 999);
    assert.equal(row.waMessageId, null, 'sin waMessageId: nunca llegó a Meta, así que no debe consumir el tope A3.2/J6');
  });
});

test('SCRUM-115: sendWhatsAppText bloqueado (demo fuera de DEMO_SAFE_NUMBERS) registra status:failed en WA-0b', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  registrarBarridoFinal(prisma);
  const { sendWhatsAppText } = await import('../dist/integrations/whatsapp.js');

  const DEMO_MERCHANT_ID = 1; // regla 8
  const phone = '34600000099'; // deliberadamente fuera de cualquier DEMO_SAFE_NUMBERS razonable
  const t0 = new Date();

  const result = await sendWhatsAppText({
    to: phone,
    text: 'SCRUM-115 test — no debe salir de verdad (bloqueado por V0-2)',
    merchantId: DEMO_MERCHANT_ID,
    log: { relatedType: 'invoice', relatedId: 999 },
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'demo_safe_numbers');

  let row = null;
  try {
    for (let i = 0; i < 30 && !row; i++) {
      row = await prisma.whatsAppMessage.findFirst({
        where: { merchantId: DEMO_MERCHANT_ID, relatedType: 'invoice', relatedId: 999, createdAt: { gte: t0 } },
      });
      if (!row) await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(row, 'debe quedar una fila en WA-0b para el intento bloqueado');
    assert.equal(row.status, 'failed');
    assert.equal(row.error, 'demo_safe_numbers');
    assert.equal(row.type, 'service');
    assert.equal(row.waMessageId, null);
  } finally {
    if (row) await prisma.whatsAppMessage.delete({ where: { id: row.id } }).catch(() => {});
  }
});
