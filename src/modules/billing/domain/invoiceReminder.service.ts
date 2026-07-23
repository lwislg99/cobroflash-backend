/**
 * Recordatorios automáticos de facturas impagadas.
 *
 * - Día 7:  primera notificación suave ("no olvides pagar")
 * - Día 14: segunda notificación más urgente
 *
 * Se usa la plantilla payment_request_es (ya aprobada en Meta) cuando la
 * factura tiene un charge con URL de pago. Si no, se envía un texto libre.
 * El cron ejecuta esto cada hora; los campos reminder7SentAt / reminder14SentAt
 * actúan como candados para garantizar idempotencia.
 */
import { prisma } from '../../../core/db/prisma';
import { sendWhatsAppWindowFirst, sendWhatsAppText } from '../../../integrations/whatsapp';
import { buildPaymentRequest } from '../../../integrations/whatsappTemplates';
import { normalizePhone, formatMoneyEs } from '../../../core/utils/utils';
import { BASE_URL } from '../../../core/config/env';
import { isReceiptNumber, appendStageLabel } from '../../invoicing/domain/invoiceNumber.service';
import { recordCustomerEvent } from '../../system/customerEvents.service';
import { ensureChargeReceiptToken } from '../../../lib/invoicing';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function sendInvoicePaymentReminders(): Promise<void> {
  const now   = new Date();
  const cut7  = new Date(now.getTime() - 7  * DAY_MS);
  const cut14 = new Date(now.getTime() - 14 * DAY_MS);

  // ── Recordatorios de 7 días ─────────────────────────────────────────────
  const toRemind7 = await prisma.invoice.findMany({
    where: {
      status: 'pending',
      createdAt: { lte: cut7 },
      reminder7SentAt: null,
      customer: { phone: { not: null } },
    },
    include: {
      customer: true,
      merchant: { select: { name: true, whatsappPhone: true } },
      charge: true,
    },
    take: 50,
  });

  // ── Recordatorios de 14 días ────────────────────────────────────────────
  const toRemind14 = await prisma.invoice.findMany({
    where: {
      status: 'pending',
      createdAt: { lte: cut14 },
      reminder14SentAt: null,
      // reminder7SentAt puede ser null si el cliente no tiene WA → no bloquear el de 14d
      customer: { phone: { not: null } },
    },
    include: {
      customer: true,
      merchant: { select: { name: true, whatsappPhone: true } },
      charge: true,
    },
    take: 50,
  });

  const total7  = toRemind7.length;
  const total14 = toRemind14.length;
  if (!total7 && !total14) return;

  console.log(`[invoiceReminder] ${total7} recordatorio(s) 7d, ${total14} recordatorio(s) 14d`);

  for (const inv of toRemind7) {
    await sendReminderWA(inv, 7);
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { reminder7SentAt: new Date() },
    }).catch((e) => console.error(`[invoiceReminder] error 7d inv #${inv.id}:`, e?.message));
  }

  for (const inv of toRemind14) {
    await sendReminderWA(inv, 14);
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { reminder14SentAt: new Date() },
    }).catch((e) => console.error(`[invoiceReminder] error 14d inv #${inv.id}:`, e?.message));
  }
}

async function sendReminderWA(
  inv: {
    id: number;
    merchantId: number;
    customerId: number;
    number: string;
    total: { toString(): string };
    currency: string;
    chargeId: number | null;
    charge: { id: number } | null;
    customer: { name: string; phone: string | null } | null;
    merchant: { name: string } | null;
    stageLabel: string | null; // SCRUM-33
  },
  day: 7 | 14,
): Promise<void> {
  const phone = normalizePhone(inv.customer?.phone);
  if (!phone) return;

  const customerName  = inv.customer?.name  || 'Cliente';
  const merchantName  = inv.merchant?.name  || 'tu proveedor';
  const total         = Number(inv.total.toString()).toFixed(2);
  const chargeId      = inv.chargeId ?? inv.charge?.id ?? null;
  // Regla 24/26: un J-… es un JUSTIFICANTE — el copy propio nunca dice "factura" pre-SIF
  const docLabel      = isReceiptNumber(inv.number) ? 'justificante' : 'factura';
  const urgency       = day === 14 ? '\nPor favor, complétalo a la mayor brevedad posible.' : '';

  try {
    if (chargeId) {
      // SCRUM-85: token OPACO del cobro (Charge.receiptToken) — NUNCA el chargeId en la URL pública.
      const payToken = await ensureChargeReceiptToken(chargeId, prisma);
      // A5.2 ventana-first: si el cliente interactuó hace <24 h el recordatorio
      // viaja como texto gratis; si no, plantilla payment_request_es (botón de pago).
      const result = await sendWhatsAppWindowFirst({
        to: phone,
        merchantId: inv.merchantId, // J3: respeta waOptOut
        customerId: inv.customerId,
        windowText:
          `Hola ${customerName} 👋\n` +
          `Te recordamos que tienes pendiente el pago del ${docLabel} ${appendStageLabel(inv.number, inv.stageLabel)} ` +
          `por ${total} ${inv.currency} de parte de ${merchantName}.${urgency}\n` +
          `Paga de forma segura desde aquí 👇\n` +
          `${BASE_URL}/pay/invoice/${payToken}\n` +
          `Si ya lo has pagado, ignora este mensaje. ¡Gracias!`,
        // A23: en ventana → botón-enlace "Pagar ahora" (sin URL cruda, dinero es-ES)
        windowCta: {
          bodyText:
            `Hola ${customerName} 👋\n` +
            `Te recordamos el pago pendiente del ${docLabel} ${appendStageLabel(inv.number, inv.stageLabel)} por *${formatMoneyEs(inv.total, inv.currency)}* de parte de *${merchantName}*.${urgency}\n` +
            `Si ya lo has pagado, ignora este mensaje. ¡Gracias!`,
          buttonText: 'Pagar ahora',
          url: `${BASE_URL}/pay/invoice/${payToken}`,
        },
        // SCRUM-33: sin variable nueva en la plantilla Meta — el label viaja dentro
        // del valor de invoiceNumber (ya es una variable propia de la plantilla).
        template: buildPaymentRequest({
          customerName,
          businessName: merchantName,
          invoiceNumber: appendStageLabel(inv.number, inv.stageLabel),
          amountWithCurrency: `${total} ${inv.currency}`,
          urlToken: payToken,
        }),
        log: { customerId: inv.customerId, relatedType: 'invoice', relatedId: inv.id },
      });
      if (result.ok) {
        console.log(`[invoiceReminder] ✓ ${day}d vía ${result.via} → inv #${inv.number}`); // SCRUM-101: sin nombre del cliente
      } else {
        console.error(`[invoiceReminder] WA error ${day}d → inv #${inv.number}:`, result.error || result.reason);
        // A20.5 (J5): el fallo del cron queda REGISTRADO y visible en el BO (360)
        recordCustomerEvent({
          merchantId: inv.merchantId,
          customerId: inv.customerId,
          type: 'wa_send_failed',
          title: `⚠️ Recordatorio de cobro (${day} días) no entregado por WhatsApp`,
          detail: `${docLabel} ${inv.number} · el enlace sigue activo — envíaselo por email o SMS desde el detalle`,
        });
      }
    } else {
      // Sin charge → texto libre (solo entrega dentro de ventana 24h)
      await sendWhatsAppText({
        to: phone,
        merchantId: inv.merchantId, // V0-2: demo solo a DEMO_SAFE_NUMBERS
        text: `Hola ${customerName} 👋, te recordamos que tienes pendiente el pago del ${docLabel} *${inv.number}* por *${total} ${inv.currency}* de parte de *${merchantName}*.\n${urgency}\nSi ya has realizado el pago, por favor ignora este mensaje. ¡Gracias!`,
      });
      console.log(`[invoiceReminder] ✓ texto ${day}d → inv #${inv.number}`); // SCRUM-101: sin nombre del cliente
    }
  } catch (err: any) {
    console.error(`[invoiceReminder] excepción ${day}d → inv #${inv.number}:`, err?.message);
  }
}
