// src/modules/payments/disputes.service.ts — A21.1 (EXT3, R14)
// Disputa de tarjeta (charge.dispute.created) → aviso WA/BO al merchant y
// paquete de evidencia en 1 clic desde la factura. "La firma digital gana
// disputas" — el paquete junta TODO lo que el banco pide: presupuesto firmado,
// evidencia de aceptación (ts/IP/UA), justificante y el registro de entrega
// de los WhatsApp. El handler lo comparten el webhook Connect (spec R14) y el
// de plataforma (las tarjetas de HOY aún van por la cuenta de plataforma).
import { prisma } from '../../core/db/prisma';
import { recordCustomerEvent } from '../system/customerEvents.service';
import { notifyMerchantAlert } from '../../integrations/whatsappNotifications';
import { formatMoneyEs } from '../../core/utils/utils';

export async function handleStripeDispute(dispute: {
  id?: string;
  payment_intent?: string | { id: string } | null;
  amount?: number | null;
  currency?: string | null;
  reason?: string | null;
}): Promise<void> {
  const piId = typeof dispute.payment_intent === 'string'
    ? dispute.payment_intent
    : dispute.payment_intent?.id || '';
  if (!piId) {
    console.warn('[dispute] charge.dispute.created sin payment_intent — ignorado');
    return;
  }
  const charge = await prisma.charge.findFirst({
    where: { intentId: piId },
    include: {
      merchant: { select: { id: true, name: true, whatsappPhone: true } },
      customer: { select: { id: true, name: true } },
    },
  });
  if (!charge) {
    console.warn(`[dispute] sin charge para intent ${piId} — revisar a mano en Stripe`);
    return;
  }
  const invoice = await prisma.invoice.findFirst({
    where: { chargeId: charge.id },
    select: { id: true, number: true },
    orderBy: { id: 'desc' },
  });

  const amountTxt = dispute.amount != null
    ? formatMoneyEs(dispute.amount / 100, (dispute.currency || 'EUR').toUpperCase())
    : formatMoneyEs(charge.amount, charge.currency);
  const custName = charge.customer?.name || 'un cliente';

  // BO (ficha 360 + timeline): siempre queda constancia
  recordCustomerEvent({
    merchantId: charge.merchantId,
    customerId: charge.customerId ?? undefined,
    type: 'dispute_created',
    title: `⚠️ Disputa abierta por el banco de ${custName}`,
    detail: `${amountTxt}${dispute.reason ? ` · motivo: ${dispute.reason}` : ''}` +
      (invoice ? ` · genera el paquete de evidencia desde la factura ${invoice.number}` : ''),
  });

  // WA al pro (ventana-first + plantilla merchant_alert si existe)
  await notifyMerchantAlert({
    merchantId: charge.merchantId,
    merchantPhone: charge.merchant?.whatsappPhone,
    customerName: custName,
    action: 'ha disputado un cobro',
    detail: `${amountTxt}${invoice ? ` · ${invoice.number}` : ''}`,
    freeText:
      `⚠️ El banco de ${custName} ha abierto una disputa por ${amountTxt}.\n` +
      `Tranquilo: tienes el presupuesto FIRMADO. Entra en la factura` +
      `${invoice ? ` ${invoice.number}` : ''} y pulsa "Paquete de disputa" — ` +
      `sale todo listo para responder al banco.`,
  }).catch(() => null);

  console.log(`[dispute] registrado para charge ${charge.id} (${amountTxt})`);
}
