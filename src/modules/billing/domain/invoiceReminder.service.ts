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
import { sendWhatsAppTemplate, sendWhatsAppText } from '../../../integrations/whatsapp';
import { normalizePhone } from '../../../core/utils/utils';
import { BASE_URL } from '../../../core/config/env';

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
    number: string;
    total: { toString(): string };
    currency: string;
    chargeId: number | null;
    charge: { id: number } | null;
    customer: { name: string; phone: string | null } | null;
    merchant: { name: string } | null;
  },
  day: 7 | 14,
): Promise<void> {
  const phone = normalizePhone(inv.customer?.phone);
  if (!phone) return;

  const customerName  = inv.customer?.name  || 'Cliente';
  const merchantName  = inv.merchant?.name  || 'tu proveedor';
  const total         = Number(inv.total.toString()).toFixed(2);
  const chargeId      = inv.chargeId ?? inv.charge?.id ?? null;
  const payUrl        = chargeId ? `${BASE_URL}/pay/card/${chargeId}` : null;

  try {
    if (payUrl) {
      // Usar template aprobado con botón de pago
      const result = await sendWhatsAppTemplate({
        to: phone,
        templateName: 'payment_request_es',
        languageCode: 'es',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: customerName },
              { type: 'text', text: merchantName },
              { type: 'text', text: inv.number },
              { type: 'text', text: `${total} ${inv.currency}` },
            ],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: String(chargeId) }],
          },
        ],
      });
      if (result.ok) {
        console.log(`[invoiceReminder] ✓ ${day}d → inv #${inv.number} (${customerName})`);
      } else {
        console.error(`[invoiceReminder] WA error ${day}d → inv #${inv.number}:`, result.error);
      }
    } else {
      // Sin charge → texto libre (funciona dentro de ventana 24h)
      const urgency = day === 14 ? 'Por favor, completa el pago a la mayor brevedad posible.' : '';
      await sendWhatsAppText({
        to: phone,
        text: `Hola ${customerName} 👋, te recordamos que tienes pendiente el pago de la factura *${inv.number}* por *${total} ${inv.currency}* de parte de *${merchantName}*.\n\n${urgency}\nSi ya has realizado el pago, por favor ignora este mensaje. ¡Gracias!`,
      });
      console.log(`[invoiceReminder] ✓ texto ${day}d → inv #${inv.number} (${customerName})`);
    }
  } catch (err: any) {
    console.error(`[invoiceReminder] excepción ${day}d → inv #${inv.number}:`, err?.message);
  }
}
