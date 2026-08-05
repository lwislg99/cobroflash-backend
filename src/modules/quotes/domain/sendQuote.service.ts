// src/modules/quotes/domain/sendQuote.service.ts — A15.2 (EXT3)
// Envío de un presupuesto al CLIENTE por WhatsApp, extraído tal cual de
// POST /admin/quotes/:id/send-whatsapp para poder reutilizarlo desde el ciclo
// de mantenimientos ("Aprobar y enviar" = flujo normal, master MANT-1) sin
// duplicar el texto oficial K1 ni los guards. La ruta admin mapea los reasons
// a sus mismas respuestas de siempre (contrato intacto).
import { prisma } from '../../../core/db/prisma';
import { sendWhatsAppWindowFirst } from '../../../integrations/whatsapp';
import { buildQuoteDecision } from '../../../integrations/whatsappTemplates';
import { recordCustomerEvent } from '../../system/customerEvents.service';
import { normalizePhone, formatMoneyEs } from '../../../core/utils/utils';
import { BASE_URL } from '../../../core/config/env';
import { ensureQuoteDecisionToken } from './quoteToken.service'; // SCRUM-95

export type SendQuoteResult =
  | { ok: true; sent: true; to: string; quoteId: number }
  | { ok: false; sent: false; reason:
        | 'not_found' | 'customer_missing_phone' | 'invalid_phone_format'
        | 'pending_approval' | 'demo_safe_numbers' | 'wa_opt_out'
        | 'daily_cap' | 'customer_daily_cap' | 'whatsapp_send_failed'
        | 'ventana_cerrada'; // SCRUM-195: se decidió NO mandar, no es que fallara
      error?: unknown };

export async function sendQuoteWhatsAppToCustomer(
  quoteId: number,
  merchantId?: number, // si viene, se exige pertenencia (multi-tenant)
  // SCRUM-195 (rebanada 3): con la ventana cerrada, NO caer a `quote_decision_es`. Reutilizar
  // la plantilla que ABRE la conversación le llega al cliente como el mensaje de antes — la
  // receta del «pero si esto ya lo firmé». Por defecto `false`: el envío normal no cambia.
  //
  // ⚠️ QUIÉN lo pone NO se decide aquí. Depende del ROL del presupuesto (`Quote.esAdicional`),
  // que es schema del fundador y está PENDIENTE. Deducirlo de otra cosa sería simular el rol.
  opciones: { sinPlantilla?: boolean } = {},
): Promise<SendQuoteResult> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { merchant: true, customer: true },
  });

  if (!quote || (merchantId != null && quote.merchantId !== merchantId)) {
    return { ok: false, sent: false, reason: 'not_found' };
  }
  if (!quote.customer?.phone) {
    return { ok: false, sent: false, reason: 'customer_missing_phone' };
  }
  if (quote.status === 'pending_approval') {
    return { ok: false, sent: false, reason: 'pending_approval' };
  }
  const to = normalizePhone(quote.customer.phone);
  if (!to) {
    return { ok: false, sent: false, reason: 'invalid_phone_format' };
  }

  // A5.5 (ciclo cero-plantillas): ventana abierta → TEXTO de sesión (0 €, texto
  // oficial del master K1); si no, plantilla quote_decision_es como siempre.
  const businessName = quote.merchant?.legalName || quote.merchant?.name || 'Tu proveedor';
  const displayNum = quote.quoteNumber ?? quote.id;
  // SCRUM-95: token opaco (Quote.decisionToken), NUNCA el id — sexta puerta de la
  // misma fuga (SCRUM-72/74/85/87/90). Generado perezosamente aquí, en el primer
  // envío real del presupuesto.
  const decisionToken = await ensureQuoteDecisionToken(quote.id, prisma);
  const result = await sendWhatsAppWindowFirst({
    to,
    merchantId: quote.merchantId, // J3: respeta waOptOut
    customerId: quote.customerId,
    windowText:
      `Hola ${quote.customer.name ?? 'Cliente'} 👋\n` +
      `${businessName} te ha preparado tu presupuesto:\n` +
      `📄 *Presupuesto #${displayNum}* · *${formatMoneyEs(quote.total, quote.currency)}*\n` +
      `Ábrelo, revísalo y fírmalo desde aquí 👇\n` +
      `${BASE_URL}/pay/quote/${decisionToken}`,
    // A23: en ventana → botón-enlace "Ver y firmar" (sin URL cruda)
    windowCta: {
      bodyText:
        `Hola ${quote.customer.name ?? 'Cliente'} 👋\n` +
        `*${businessName}* te ha preparado tu presupuesto:\n` +
        `📄 *Presupuesto #${displayNum}* · *${formatMoneyEs(quote.total, quote.currency)}*`,
      buttonText: 'Ver y firmar',
      url: `${BASE_URL}/pay/quote/${decisionToken}`,
    },
    template: buildQuoteDecision({
      customerName: quote.customer.name ?? 'Cliente',
      businessName,
      quoteNumber: displayNum,
      totalWithCurrency: `${Number(quote.total).toFixed(2)} ${quote.currency}`,
      decisionToken, // SCRUM-95: token opaco, no el id global
    }),
    sinPlantilla: opciones.sinPlantilla === true, // SCRUM-195
    log: { customerId: quote.customerId, relatedType: 'quote', relatedId: quote.id }, // WA-0b
  });

  if (!result.ok) {
    const reason = (result as { reason?: string }).reason;
    if (reason === 'demo_safe_numbers' || reason === 'wa_opt_out' ||
        reason === 'daily_cap' || reason === 'customer_daily_cap' ||
        reason === 'ventana_cerrada') { // SCRUM-195: motivo propio, con su copy aprobado
      return { ok: false, sent: false, reason };
    }
    console.error('[sendQuote] Error de Meta API:', (result as { error?: unknown }).error);
    return { ok: false, sent: false, reason: 'whatsapp_send_failed', error: (result as { error?: unknown }).error };
  }

  // Marcar como enviado si estaba en draft
  if (quote.status === 'draft') {
    await prisma.quote.update({ where: { id: quote.id }, data: { status: 'sent' } });
  }

  // ENT-3: historial
  recordCustomerEvent({
    merchantId: quote.merchantId,
    customerId: quote.customerId,
    type: 'quote_sent',
    title: `Presupuesto #${displayNum} enviado por WhatsApp`,
    detail: `${Number(quote.total).toFixed(2)} ${quote.currency}`,
  });

  return { ok: true, sent: true, to, quoteId: quote.id };
}
