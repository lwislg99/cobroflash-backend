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
// CÓMO SE FUERZA EL FALLO, y por qué es determinista aquí: el `.env` del carril B solo
// lleva `DATABASE_URL_STAGING` (SCRUM-60), así que no hay credenciales de WhatsApp y todo
// envío sale por el guard `not_configured` → `{ok:false}`. No hace falta simular nada.
//
// EFECTO SOBRE STAGING: `sendInvoicePaymentReminders()` recorre las facturas pendientes de
// TODA la BD, no solo las nuestras. Con los envíos fallando no marca ninguna — que es
// justamente lo que este arreglo garantiza. Antes del fix, esta misma llamada habría
// marcado en falso las facturas pendientes de otros merchants de staging.
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

test('SCRUM-116: un recordatorio que falla NO cierra el candado; uno enviado SÍ', { skip: !ENABLED }, async (t) => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { sendInvoicePaymentReminders } = await import('../dist/modules/billing/domain/invoiceReminder.service.js');

  const stamp = Date.now();
  const hace10dias = new Date(Date.now() - 10 * DIA); // > 7 días → entra en el recordatorio de 7d

  await withMerchant(
    prisma,
    { name: `QA S116 ${stamp}`, email: `qa-s116-${stamp}@test.local` },
    async (merchant) => {
      const mkCliente = (nombre, waOptOut = false) => prisma.customer.create({
        data: { merchantId: merchant.id, name: nombre, phone: `34600${String(stamp).slice(-6)}`.slice(0, 11), waOptOut },
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

      const cliente = await mkCliente('Cliente S116');
      const clienteBaja = await mkCliente('Cliente S116 DE BAJA', true);

      // (A) EL CASO DEL TICKET: pendiente, sin recordar, envío condenado a fallar.
      const aReclamar = await mkFactura(cliente.id, 'A');
      // (B) EL SIMÉTRICO: ya recordada de verdad → el candado debe seguir cerrado.
      const yaRecordada = await mkFactura(cliente.id, 'B', { reminder7SentAt: new Date(Date.now() - 2 * DIA) });
      // (C) Cliente dado de BAJA de WhatsApp (J3): no debe ni intentarse.
      const deClienteDeBaja = await mkFactura(clienteBaja.id, 'C');

      const antes = await prisma.invoice.findMany({
        where: { merchantId: merchant.id },
        select: { id: true, reminder7SentAt: true },
      });
      assert.equal(antes.find((i) => i.id === aReclamar.id).reminder7SentAt, null,
        'precondición: la factura A empieza SIN recordar');

      // ── El cron, con los envíos fallando por `not_configured` ────────────
      await sendInvoicePaymentReminders();

      const despues = new Map(
        (await prisma.invoice.findMany({
          where: { merchantId: merchant.id },
          select: { id: true, reminder7SentAt: true },
        })).map((i) => [i.id, i.reminder7SentAt]),
      );

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

      t.diagnostic('fallo → sin marcar ✓ · ya recordada → intacta ✓ · opt-out → sin marcar ✓');
    },
  );

  await prisma.$disconnect();
});
