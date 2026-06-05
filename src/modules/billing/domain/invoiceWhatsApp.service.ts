// src/modules/billing/domain/invoiceWhatsApp.service.ts
// Envío de la factura por WhatsApp (plantilla payment_request_es).
// Lógica de dominio reutilizable: la usan el endpoint admin (resend-whatsapp)
// y el flujo público de aceptación de presupuesto (sin auth), evitando llamadas
// HTTP internas a rutas /admin que fallarían por falta de sesión.
// Spec de la plantilla: docs/WHATSAPP_TEMPLATES.md
import fetch from 'node-fetch';
import { prisma } from '../../../core/db/prisma';
import { BASE_URL } from '../../../core/config/env';
import { normalizePhone } from '../../../core/utils/utils';
import { sendWhatsAppTemplate } from '../../../integrations/whatsapp';

export type SendInvoiceWAResult = {
  ok: boolean;
  reason?: string;
  chargeId?: number;
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
      const chargeResp = await fetch(`${BASE_URL}/charges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: invoice.merchantId,
          customer: {
            name: invoice.customer.name,
            phone: invoice.customer.phone,
            email: invoice.customer.email,
          },
          concept: `Factura ${invoice.number}`,
          amount: Number(invoice.total),
          currency: invoice.currency || 'EUR',
          method_preference: 'card',
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
  const result = await sendWhatsAppTemplate({
    to,
    templateName: 'payment_request_es',
    languageCode: 'es',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: invoice.customer.name || 'Cliente' },
          { type: 'text', text: businessName },
          { type: 'text', text: invoice.number },
          { type: 'text', text: `${Number(invoice.total).toFixed(2)} ${invoice.currency}` },
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

  if (!result.ok) return { ok: false, reason: 'whatsapp_send_failed', chargeId: chargeId ?? undefined, to };
  return { ok: true, chargeId: chargeId ?? undefined, to };
}
