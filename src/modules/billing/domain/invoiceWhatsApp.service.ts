// src/modules/billing/domain/invoiceWhatsApp.service.ts
// Envío de la factura por WhatsApp (plantilla payment_request_es).
// Lógica de dominio reutilizable: la usan el endpoint admin (resend-whatsapp)
// y el flujo público de aceptación de presupuesto (sin auth), evitando llamadas
// HTTP internas a rutas /admin que fallarían por falta de sesión.
// Spec de la plantilla: docs/WHATSAPP_TEMPLATES.md
import fetch from 'node-fetch';
import { prisma } from '../../../core/db/prisma';
import { BASE_URL } from '../../../core/config/env';
import { internalHeaders } from '../../../core/http/internalAuth';
import { normalizePhone, formatMoneyEs } from '../../../core/utils/utils';
import { sendWhatsAppWindowFirst } from '../../../integrations/whatsapp';
import { buildPaymentRequest } from '../../../integrations/whatsappTemplates';
import { recordCustomerEvent } from '../../system/customerEvents.service';
import { isReceiptNumber } from '../../invoicing/domain/invoiceNumber.service';
import { ensureChargeReceiptToken } from '../../../lib/invoicing';

export type SendInvoiceWAResult = {
  ok: boolean;
  reason?: string;
  chargeId?: number;
  payToken?: string; // SCRUM-85: token opaco para /pay/invoice — el que debe usar cualquier link público
  to?: string;
};

/**
 * Asegura un cobro para la factura (lo crea si no existe) y envía
 * payment_request_es al cliente. No lanza: devuelve {ok,reason}.
 */
export async function sendInvoicePaymentRequest(invoiceId: number): Promise<SendInvoiceWAResult> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { merchant: true, customer: true },
  });
  if (!invoice) return { ok: false, reason: 'invoice_not_found' };
  if (!invoice.customer?.phone) return { ok: false, reason: 'customer_without_phone' };

  const to = normalizePhone(invoice.customer.phone);
  if (!to) return { ok: false, reason: 'invalid_phone_format' };

  // Asegurar cobro (idempotente): reutiliza el existente o crea uno nuevo.
  let chargeId: number | null = invoice.chargeId ?? null;
  if (!chargeId) {
    try {
      // A2.1: heredar los métodos de pago del presupuesto de origen (selector al crear)
      const quotePayMethods = invoice.quoteId
        ? await prisma.quote
            .findUnique({ where: { id: invoice.quoteId }, select: { payMethods: true } })
            .then((q) => (Array.isArray(q?.payMethods) ? q!.payMethods : null))
            .catch(() => null)
        : null;

      const chargeResp = await fetch(`${BASE_URL}/charges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...internalHeaders() },
        body: JSON.stringify({
          merchant_id: invoice.merchantId,
          customer_id: invoice.customerId, // cliente real de la factura (no duplicar)
          // Regla 24/26: un J-… es JUSTIFICANTE — el copy jamás dice "factura"
          concept: `${isReceiptNumber(invoice.number) ? 'Justificante' : 'Factura'} ${invoice.number}`,
          amount: Number(invoice.total),
          currency: invoice.currency || 'EUR',
          method_preference: 'card',
          ...(quotePayMethods ? { pay_methods: quotePayMethods } : {}),
          meta: { invoice_id: invoice.id, quote_id: invoice.quoteId },
        }),
      });
      if (!chargeResp.ok) return { ok: false, reason: 'charge_creation_failed' };
      const cj: any = await chargeResp.json().catch(() => null);
      if (!cj?.id) return { ok: false, reason: 'charge_creation_invalid_response' };
      chargeId = Number(cj.id);
      await prisma.invoice.update({ where: { id: invoice.id }, data: { chargeId } });
    } catch (err: any) {
      console.error('[invoiceWhatsApp] charge error:', err?.message || err);
      return { ok: false, reason: 'charge_creation_failed' };
    }
  }

  const businessName = invoice.merchant?.legalName || invoice.merchant?.name || 'Tu proveedor';
  const amountWithCurrency = `${Number(invoice.total).toFixed(2)} ${invoice.currency}`;
  // Regla 24/26: en el texto de ventana (copy nuestro, no de Meta) un J-… es "justificante"
  const docLabel = isReceiptNumber(invoice.number) ? 'justificante' : 'factura';
  // SCRUM-85: token OPACO del cobro (Charge.receiptToken) — NUNCA el chargeId en la URL pública.
  const payToken = await ensureChargeReceiptToken(chargeId, prisma);
  // A5.2: ventana-first — si el cliente interactuó hace <24 h, el enlace de pago
  // viaja como texto gratis; si no, plantilla payment_request_es como siempre.
  const result = await sendWhatsAppWindowFirst({
    to,
    merchantId: invoice.merchantId, // J3: respeta waOptOut
    customerId: invoice.customerId,
    windowText:
      `Hola ${invoice.customer.name || 'Cliente'} 👋\n` +
      `${businessName} te envía el ${docLabel} ${invoice.number}.\n` +
      `A pagar: ${amountWithCurrency}\n` +
      `Paga de forma segura desde aquí 👇\n` +
      `https://yaqu.app/pay/invoice/${payToken}`,
    // A23: en ventana → botón-enlace "Pagar" (sin URL cruda, dinero es-ES)
    windowCta: {
      bodyText:
        `Hola ${invoice.customer.name || 'Cliente'} 👋\n` +
        `*${businessName}* te envía el ${docLabel} ${invoice.number}.\n` +
        `A pagar: *${formatMoneyEs(invoice.total, invoice.currency)}*`,
      buttonText: `Pagar ${formatMoneyEs(invoice.total, invoice.currency)}`,
      url: `https://yaqu.app/pay/invoice/${payToken}`,
    },
    template: buildPaymentRequest({
      customerName: invoice.customer.name || 'Cliente',
      businessName,
      invoiceNumber: invoice.number,
      amountWithCurrency,
      urlToken: payToken,
    }),
    log: { customerId: invoice.customerId, relatedType: 'invoice', relatedId: invoice.id }, // WA-0b
  });

  if (!result.ok) return { ok: false, reason: 'whatsapp_send_failed', chargeId: chargeId ?? undefined, payToken, to };

  // ENT-3: historial
  recordCustomerEvent({
    merchantId: invoice.merchantId,
    customerId: invoice.customerId,
    type: 'invoice_issued',
    title: `Factura ${invoice.number} enviada por WhatsApp`,
    detail: `${Number(invoice.total).toFixed(2)} ${invoice.currency}`,
  });

  return { ok: true, chargeId: chargeId ?? undefined, payToken, to };
}
