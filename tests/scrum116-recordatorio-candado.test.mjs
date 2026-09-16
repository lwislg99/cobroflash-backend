// SCRUM-116 — un recordatorio FALLIDO ya no se guarda como enviado.
//
// El daño que esto previene: `reminderXSentAt` es la llave del cron
// (`invoiceReminder.service`, `where: { reminder7SentAt: null }`). Marcarla cuando el envío
// falla saca la factura de esa consulta PARA SIEMPRE — nadie vuelve a reclamarla. En un
// producto cuyo argumento de venta es la morosidad, eso es dinero que no entra.
//
// ⚠️ EL SIMÉTRICO es el segundo caso: una factura YA marcada NO debe volver a entrar. Sin
// él, «no marcar nunca» pasaría el primero y romperíamos la idempotencia sin enterarnos
// (SCRUM-108).
//
// ── CÓMO SE FUERZA EL FALLO, y por qué YA NO SE HACE COMO ANTES (SCRUM-175) ───────────
// Este test decía: «el `.env` del carril B no lleva credenciales de WhatsApp, así que todo
// envío sale por el guard `not_configured` → {ok:false}». Esa premisa MURIÓ el día que
// nació el runner gateado de SCRUM-157, y el test se puso rojo acusando una fuga de dinero
// que no existe:
//   · `scripts/test-staging-gated.mjs` arranca la tanda QA_DB_TEST con `WHATSAPP_DRY_RUN=1`;
//   · en `integrations/whatsapp.ts` el guard de credenciales es
//     `if ((!phoneNumberId || !token) && !isDryRun())` — o sea que el dry-run lo SALTA;
//   · y la rama dry-run devuelve `{ok:true, dryRun:true}`, indistinguible de un envío real.
// Resultado: el envío «salía», el candado se cerraba y la aserción de abajo cantaba FUGA.
// El código de producción estaba bien todo el rato (`invoiceReminder.service.ts:84-90`
// escribe DENTRO de la rama de éxito); lo que estaba mal era el input de este test.
//
// La lección va más allá del arreglo: **una precondición que depende del entorno no es una
// precondición, es una suposición**. Aquí el fallo lo produce ahora la FIXTURE — el tope
// duro J6 por cliente y día (`whatsapp.ts`, `customer_daily_cap`), que se comprueba ANTES
// de la rama dry-run y no toca Meta ni con credenciales puestas. Y no se supone: se
// COMPRUEBA, con la fila de fallo que deja el propio guard (assert de precondición).
//
// EFECTO SOBRE STAGING: `sendInvoicePaymentReminders()` recorre las facturas pendientes de
// TODA la BD, no solo las nuestras. Con `WHATSAPP_DRY_RUN=1` esos envíos ajenos «salen» y
// SÍ se marcan — es una escritura sobre datos que no son de este test. Nuestro merchant es
// efímero y se limpia; lo de fuera, no. (Registrado en SCRUM-175; evitarlo pediría filtrar
// por merchant en el servicio, que es cambio de producción y va aparte.)
//
// Datos EFÍMEROS propios, limpieza con withMerchant (SCRUM-113).
//
// ⚠️ GATEADO:  QA_DB_TEST=1 npm run test:staging
import './_staging-db.mjs'; // SCRUM-60: fuerza staging (fail-closed anti-prod)
import test from 'node:test';
import assert from 'node:assert/strict';
import { withMerchant } from './_merchant-fixture.mjs';

const ENABLED = process.env.QA_DB_TEST === '1';
const DIA = 24 * 60 * 60 * 1000;

test('SCRUM-116: un recordatorio que falla NO cierra el candado; uno enviado SÍ', { skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated' }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { sendInvoicePaymentReminders } = await import('../dist/modules/billing/domain/invoiceReminder.service.js');
  const { config } = await import('../dist/core/config/env.js');

  const stamp = Date.now();
  const hace10dias = new Date(Date.now() - 10 * DIA); // > 7 días → entra en el recordatorio de 7d

  await withMerchant(
    prisma,
    { name: `QA S116 ${stamp}`, email: `qa-s116-${stamp}@test.local` },
    async (merchant) => {
      // ⚠️ TELÉFONOS DISTINTOS, y no es cosmético (hallazgo de SCRUM-175): la baja de
      // WhatsApp (J3) se comprueba por NÚMERO, no por cliente (`isWaOptedOut(merchantId, to)`).
      // Con el mismo teléfono para los dos, la baja del cliente (C) bloqueaba también el envío
      // de (A) — el test pasaba, sí, pero por un guard que no era el que decía estar probando.
      const mkCliente = (nombre, sufijo, waOptOut = false) => prisma.customer.create({
        data: { merchantId: merchant.id, name: nombre, phone: `3460${sufijo}${String(stamp).slice(-6)}`.slice(0, 11), waOptOut },
      });
      const mkFactura = (customerId, sufijo, extra = {}) => prisma.invoice.create({
        data: {
          merchantId: merchant.id, customerId,
          number: `2026-S116-${sufijo}-${stamp % 1000}`,
          total: '100.00', currency: 'EUR', type: 'F1', status: 'pending',
          pdfUrl: 'P', qrData: 'Q', lines: [],
          createdAt: hace10dias,
          ...extra,
        },
      });

      const cliente = await mkCliente('Cliente S116', '0');
      const clienteBaja = await mkCliente('Cliente S116 DE BAJA', '1', true);

      // (A) EL CASO DEL TICKET: pendiente, sin recordar, envío condenado a fallar.
      // Lleva `charge` a propósito: es el caso REAL (factura con enlace de pago) y es el que
      // viaja por plantilla, que es donde vive el tope J6 con el que forzamos el fallo.
      const cobro = await prisma.charge.create({
        data: {
          merchantId: merchant.id, customerId: cliente.id, concept: 'QA S116',
          amount: '100.00', currency: 'EUR', method: 'card', status: 'pending',
        },
      });
      const aReclamar = await mkFactura(cliente.id, 'A', { chargeId: cobro.id });
      // (B) EL SIMÉTRICO: ya recordada de verdad → el candado debe seguir cerrado.
      const yaRecordada = await mkFactura(cliente.id, 'B', { reminder7SentAt: new Date(Date.now() - 2 * DIA) });
      // (C) Cliente dado de BAJA de WhatsApp (J3): no debe ni intentarse.
      const deClienteDeBaja = await mkFactura(clienteBaja.id, 'C');

      // ── EL FALLO, FORZADO POR LA FIXTURE (SCRUM-175) ──────────────────────────
      // J6: `WA_CUSTOMER_DAILY_CAP` plantillas por cliente y día. Se cuentan las que
      // LLEGARON a Meta (`waMessageId != null`, SCRUM-115), así que se siembran con wamid.
      // Ese guard corre ANTES de la rama dry-run → el envío falla con credenciales, sin
      // ellas y en dry-run: el resultado ya no depende de cómo esté montado el entorno.
      for (let i = 0; i < config.WA_CUSTOMER_DAILY_CAP; i++) {
        await prisma.whatsAppMessage.create({
          data: {
            merchantId: merchant.id, customerId: cliente.id, type: 'template',
            templateName: 'payment_request_es', waMessageId: `wamid.qa-s116-${stamp}-${i}`,
            status: 'sent',
          },
        });
      }

      const antes = await prisma.invoice.findMany({
        where: { merchantId: merchant.id },
        select: { id: true, reminder7SentAt: true },
      });
      assert.equal(antes.find((i) => i.id === aReclamar.id).reminder7SentAt, null,
        'precondición: la factura A empieza SIN recordar');

      // ── El cron, con el envío de A tocando el tope J6 ─────────────────────────
      await sendInvoicePaymentReminders();

      const despues = new Map(
        (await prisma.invoice.findMany({
          where: { merchantId: merchant.id },
          select: { id: true, reminder7SentAt: true },
        })).map((i) => [i.id, i.reminder7SentAt]),
      );

      // PRECONDICIÓN COMPROBADA, no supuesta (la lección de SCRUM-175): que el envío se
      // INTENTÓ y NO salió. El guard deja su propia fila de fallo (`logFailure`), así que
      // se puede mirar. Sin esto, un futuro en el que el envío vuelva a «salir» dejaría el
      // assert de abajo pasando por la razón equivocada — verde sobre una premisa muerta.
      const fallo = await prisma.whatsAppMessage.findFirst({
        where: { merchantId: merchant.id, status: 'failed', relatedType: 'invoice', relatedId: aReclamar.id },
      });
      assert.ok(fallo, 'PREMISA ROTA: no consta ningún intento fallido para la factura A — ' +
        'este test necesita un envío que FALLE como input; si el envío está saliendo, lo que ' +
        'mide el assert siguiente no es el candado (SCRUM-175).');
      // El MOTIVO no se fija a propósito: el tope J6 garantiza el fallo con el canal montado,
      // pero en un entorno sin credenciales y sin dry-run gana un guard anterior
      // (`not_configured`). Las dos cosas son el mismo input —un envío que no salió— y este
      // test mide el candado, no qué guard lo paró. El motivo real queda en el diagnóstico.
      t.diagnostic(`envío de A fallido por: ${fallo.error} (input del candado)`);

      // (A) LO QUE ARREGLA EL TICKET: el envío falló → NO se marca → mañana se reintenta.
      assert.equal(despues.get(aReclamar.id), null,
        'FUGA DE DINERO: el envío falló y aun así se marcó como recordada. Esa factura sale ' +
        'del `where` del cron y no se reclama nunca más (SCRUM-116).');

      // (B) EL SIMÉTRICO: la ya recordada conserva su fecha — no se borra ni se duplica.
      assert.ok(despues.get(yaRecordada.id) instanceof Date,
        'una factura ya recordada debe CONSERVAR su marca: el candado sigue siendo idempotente');
      assert.equal(despues.get(yaRecordada.id).getTime(), antes.find((i) => i.id === yaRecordada.id).reminder7SentAt.getTime(),
        'y su fecha no debe reescribirse en cada pasada');

      // (C) Cliente de baja: tampoco se marca — pero por otra razón. Se filtra en el `where`
      //     (J3, legal), no se trata como un fallo de envío.
      assert.equal(despues.get(deClienteDeBaja.id), null,
        'un cliente dado de baja no debe quedar marcado como recordado');

      t.diagnostic('fallo (J6) → sin marcar ✓ · ya recordada → intacta ✓ · opt-out → sin marcar ✓');
    },
  );

  await prisma.$disconnect();
});
