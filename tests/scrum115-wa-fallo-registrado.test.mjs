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

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-245 (2-ago-2026) · AQUÍ HABÍA UN SEGUNDO TEST, y su desaparición se declara en vez de
// dejarla en el `git log`.
//
// Ejercitaba la MISMA propiedad —un envío bloqueado deja fila `status:'failed'`— pero por
// `sendWhatsAppText` y con el freno del demo (`demo_safe_numbers`). Ese freno se retiró: el
// requisito de producto es que se pueda escribir a cualquier número que meta el profesional
// (máster J0), y la premisa que lo sostenía se midió y era falsa.
//
// NO se re-ancló, y el motivo es medido, no comodidad: el test de arriba ya fija la propiedad
// con `wa_opt_out`, así que re-anclar a lo mismo habría sido duplicarlo. Lo que SÍ se pierde es
// la cobertura de `sendWhatsAppText`, y conviene saber por qué no se puede recuperar hoy: sus
// dos caminos de fallo restantes son `not_configured` y el error de Meta, y **ninguno es
// alcanzable en la tanda gateada**, que corre con `WHATSAPP_DRY_RUN=1` y sale antes por el
// early-return del dry-run.
//
// O sea: `sendWhatsAppText` se queda sin ningún fallo ejercitable en la tanda. Eso es un hueco
// REAL de cobertura, y está escrito aquí para que se lea al mirar este fichero — que es donde
// alguien lo buscará — y no en un ticket que nadie relee.
// ─────────────────────────────────────────────────────────────────────────────────────────
