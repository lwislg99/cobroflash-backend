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
// ── SCRUM-250 · POR QUÉ YA NO SE SONDEA LA TABLA ─────────────────────────────
// Estos dos subtests esperaban la fila con un bucle de 30 × 100 ms. `recordWaMessage` se
// llama SIN `await` (y así debe seguir: registrar telemetría no puede tumbar un envío), así
// que el INSERT podía aterrizar después de esos 3 s bajo contención del pool de staging —
// el mismo retraso que deja huérfanas en SCRUM-194. Resultado: cayó en dos tandas y no cayó
// en la tercera CON EL MISMO CÓDIGO. La variable era la latencia, no el diff.
//
// Subir el sondeo habría escondido la carrera. Lo que se hace es esperar A LA PROMESA que
// producción ya crea y tira: `interceptarWaLog` la recoge desde fuera (envuelve, no
// sustituye) sin tocar una línea de `src/`. El detalle, en `tests/_wa-log-sync.mjs`.
//
// ⚠️ Toca BD real (staging), gateado:
//   QA_DB_TEST=1 WHATSAPP_DRY_RUN=1 DATABASE_URL_TESTS="..." npm run test:staging
import './_staging-db.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { withMerchant, registrarBarridoFinal } from './_merchant-fixture.mjs';
import { interceptarWaLog } from './_wa-log-sync.mjs';

const ENABLED = process.env.QA_DB_TEST === '1';

/** El objeto `exports` REAL del módulo de log — el mismo que lee `whatsapp.js` en cada llamada. */
async function moduloDeLog() {
  return (await import('../dist/modules/messaging/domain/whatsappLog.service.js')).default;
}

test('SCRUM-115: sendWhatsAppTemplate bloqueado por wa_opt_out registra status:failed en WA-0b (waMessageId null)', { skip: !ENABLED }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  registrarBarridoFinal(prisma);
  const { sendWhatsAppTemplate } = await import('../dist/integrations/whatsapp.js');
  const log = await moduloDeLog();

  await withMerchant(prisma, { name: 'QA SCRUM-115', email: `qa-scrum115-${Date.now()}@test.local` }, async (merchant) => {
    const phone = '34600000088';
    const customer = await prisma.customer.create({
      data: { merchantId: merchant.id, name: 'Cliente opt-out', phone, waOptOut: true },
    });

    const t0 = new Date();
    const wa = interceptarWaLog({ log, prisma });
    let row = null;
    try {
      const result = await sendWhatsAppTemplate({
        to: phone,
        templateName: 'payment_request_es',
        merchantId: merchant.id,
        log: { customerId: customer.id, relatedType: 'invoice', relatedId: 999 },
      });

      assert.equal(result.ok, false);
      assert.equal(result.reason, 'wa_opt_out');

      // SCRUM-250: el punto de sincronización. Resuelve cuando la escritura TERMINA, no
      // cuando lo dice un reloj. La promesa ya está registrada aquí: `logFailure()` está en
      // el camino hacia el `return` del envío que acabamos de esperar.
      await wa.esperar();

      row = await prisma.whatsAppMessage.findFirst({
        where: { merchantId: merchant.id, customerId: customer.id, createdAt: { gte: t0 } },
      });
    } finally {
      wa.restaurar();
    }

    // `wa.explicar` añade el motivo REAL si la escritura falló (p. ej. P2024 del pool), que
    // `recordWaMessage` se traga por diseño. Sin esto el rojo solo diría "no hay fila".
    assert.ok(row, wa.explicar('debe quedar una fila en WA-0b para el intento bloqueado'));
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
  const log = await moduloDeLog();

  const DEMO_MERCHANT_ID = 1; // regla 8
  const phone = '34600000099'; // deliberadamente fuera de cualquier DEMO_SAFE_NUMBERS razonable
  const t0 = new Date();

  const wa = interceptarWaLog({ log, prisma });
  let row = null;
  try {
    const result = await sendWhatsAppText({
      to: phone,
      text: 'SCRUM-115 test — no debe salir de verdad (bloqueado por V0-2)',
      merchantId: DEMO_MERCHANT_ID,
      log: { relatedType: 'invoice', relatedId: 999 },
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'demo_safe_numbers');

    await wa.esperar(); // SCRUM-250: ver el subtest de arriba

    row = await prisma.whatsAppMessage.findFirst({
      where: { merchantId: DEMO_MERCHANT_ID, relatedType: 'invoice', relatedId: 999, createdAt: { gte: t0 } },
    });

    assert.ok(row, wa.explicar('debe quedar una fila en WA-0b para el intento bloqueado'));
    assert.equal(row.status, 'failed');
    assert.equal(row.error, 'demo_safe_numbers');
    assert.equal(row.type, 'service');
    assert.equal(row.waMessageId, null);
  } finally {
    wa.restaurar();
    // La fila es del merchant DEMO (id=1), que ningún barrido toca: se limpia aquí o se queda.
    if (row) await prisma.whatsAppMessage.delete({ where: { id: row.id } }).catch(() => {});
  }
});
