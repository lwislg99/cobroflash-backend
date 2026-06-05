import { prisma } from '../../../core/db/prisma';
import { sendWhatsAppTemplate } from '../../../integrations/whatsapp';
import { normalizePhone } from '../../../core/utils/utils';

const REMINDER_AFTER_MS = 24 * 60 * 60 * 1000; // 24 horas

export async function sendPendingReminders(): Promise<void> {
  const cutoff = new Date(Date.now() - REMINDER_AFTER_MS);

  const quotes = await prisma.quote.findMany({
    where: {
      status: 'sent',
      reminderSentAt: null,
      updatedAt: { lte: cutoff },
    },
    include: {
      customer: { select: { name: true, phone: true } },
      merchant: { select: { name: true, logoUrl: true } },
    },
    take: 50, // procesar en lotes
  });

  if (!quotes.length) return;

  console.log(`[reminder] ${quotes.length} cotización(es) sin respuesta >24h`);

  for (const quote of quotes) {
    const phone = normalizePhone(quote.customer?.phone);
    if (!phone) {
      await markReminded(quote.id);
      continue;
    }

    const customerName = quote.customer?.name || 'Cliente';
    const merchantName = quote.merchant?.name || 'Tu proveedor';
    const total = Number(quote.total).toFixed(2);

    try {
      // Reusa quote_decision_es como recordatorio (ver docs/WHATSAPP_TEMPLATES.md)
      // Cuerpo: nombre · nombre negocio · nº presupuesto · total con moneda · Botón: id presupuesto
      const result = await sendWhatsAppTemplate({
        to: phone,
        templateName: 'quote_decision_es',
        languageCode: 'es',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: customerName },
              { type: 'text', text: merchantName },
              { type: 'text', text: String(quote.id) },
              { type: 'text', text: `${total} ${quote.currency}` },
            ],
          },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: String(quote.id) }] },
        ],
      });

      if (result.ok) {
        console.log(`[reminder] OK → quote #${quote.id} (${customerName})`);
      } else {
        console.error(`[reminder] WA error → quote #${quote.id}:`, result.error);
      }
    } catch (err: any) {
      console.error(`[reminder] excepción → quote #${quote.id}:`, err?.message);
    }

    // Marcar como recordado siempre (evita reintentos infinitos aunque falle WA)
    await markReminded(quote.id);
  }
}

async function markReminded(quoteId: number) {
  await prisma.quote.update({
    where: { id: quoteId },
    data: { reminderSentAt: new Date() },
  }).catch((e) => console.error(`[reminder] error marcando quote #${quoteId}:`, e?.message));
}
