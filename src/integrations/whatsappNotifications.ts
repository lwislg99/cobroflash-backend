// src/integrations/whatsappNotifications.ts
// Helpers de alto nivel para envíos de plantillas concretas.
// La spec canónica de las plantillas vive en docs/WHATSAPP_TEMPLATES.md.
import { normalizePhone } from '../core/utils/utils';
import { sendWhatsAppTemplate, sendWhatsAppText } from './whatsapp';
import {
  buildPaymentConfirmation,
  buildPaymentConfirmationInvoice,
  buildMerchantAlert,
} from './whatsappTemplates';

/**
 * Confirmación de pago al cliente (plantilla payment_confirmation_es, sin botones).
 * Cuerpo: {{1}} nombre cliente · {{2}} importe con moneda · {{3}} nº factura · {{4}} nombre negocio
 * Fire-and-forget: nunca lanza; devuelve {ok}.
 */
export async function sendPaymentConfirmation(params: {
  toPhone: string | null | undefined;
  customerName?: string | null;
  amountWithCurrency: string;
  invoiceNumber: string;
  businessName?: string | null;
  merchantId?: number; // J3: respeta waOptOut del número para ese merchant
}): Promise<{ ok: boolean }> {
  const to = normalizePhone(params.toPhone || '');
  if (!to) return { ok: false };

  try {
    const result = await sendWhatsAppTemplate({
      to,
      merchantId: params.merchantId,
      ...buildPaymentConfirmation({
        customerName: params.customerName || 'Cliente',
        amountWithCurrency: params.amountWithCurrency,
        invoiceNumber: params.invoiceNumber,
        businessName: params.businessName || 'tu proveedor',
      }),
    });
    return { ok: !!result.ok };
  } catch (err: any) {
    console.error('[payment_confirmation] error:', err?.message || err);
    return { ok: false };
  }
}

/**
 * Confirmación de pago al cliente CON botón "Ver documento" → /recibo/{{chargeId}}
 * (plantilla payment_confirmation_invoice_es). Copy NEUTRO: vale para factura (post-SIF)
 * y para justificante (pre-SIF) — por eso `documentNumber` (no "invoiceNumber").
 * Sustituye a sendPaymentConfirmation() en los webhooks de pago (J1, plantillas Approved).
 * Cuerpo: {{1}} nombre · {{2}} importe con moneda · {{3}} nº documento · {{4}} negocio · botón = chargeId
 * Fire-and-forget: nunca lanza; devuelve {ok}.
 */
export async function sendPaymentConfirmationInvoice(params: {
  toPhone: string | null | undefined;
  customerName?: string | null;
  amountWithCurrency: string;
  documentNumber: string;
  businessName?: string | null;
  chargeId: number;
  merchantId?: number; // J3: respeta waOptOut del número para ese merchant
}): Promise<{ ok: boolean }> {
  const to = normalizePhone(params.toPhone || '');
  if (!to) return { ok: false };

  try {
    const result = await sendWhatsAppTemplate({
      to,
      merchantId: params.merchantId,
      ...buildPaymentConfirmationInvoice({
        customerName: params.customerName || 'Cliente',
        amountWithCurrency: params.amountWithCurrency,
        documentNumber: params.documentNumber,
        businessName: params.businessName || 'tu proveedor',
        chargeId: params.chargeId,
      }),
    });
    return { ok: !!result.ok };
  } catch (err: any) {
    console.error('[payment_confirmation_invoice] error:', err?.message || err);
    return { ok: false };
  }
}

/**
 * Aviso al PROFESIONAL de un pago recibido, robusto a la ventana de 24 h.
 * Estrategia decidida al conectar (J1, opción 1, sin schema): se INTENTA el texto libre
 * (gratis y rico si la ventana de servicio del PRO está abierta); si `sendWhatsAppText`
 * devuelve `{ok:false}` (ventana cerrada / error de entrega de Meta), se cae a la plantilla
 * Utility `merchant_alert_es`. Idempotente y sin estado nuevo. Los guards de demo (V0-2) y
 * waOptOut (J3) se reaplican dentro de cada envío, así que el fallback nunca salta esas reglas.
 * Fire-and-forget: nunca lanza.
 */
export async function notifyMerchantPaid(params: {
  merchantId: number;
  merchantPhone: string | null | undefined;
  freeText: string;            // texto a intentar con la ventana abierta
  customerName?: string | null;
  detail: string;              // "{importe con moneda} · {referencia}" para la plantilla
}): Promise<{ ok: boolean; via: 'text' | 'template' | 'none' }> {
  const to = normalizePhone(params.merchantPhone || '');
  if (!to) return { ok: false, via: 'none' };

  // 1) Ventana 24 h abierta → texto libre.
  const text = await sendWhatsAppText({
    to,
    merchantId: params.merchantId,
    text: params.freeText,
  }).catch(() => ({ ok: false as const }));
  if (text.ok) return { ok: true, via: 'text' };

  // 2) Ventana cerrada / error → fallback a plantilla.
  try {
    const result = await sendWhatsAppTemplate({
      to,
      merchantId: params.merchantId,
      ...buildMerchantAlert({
        customerName: params.customerName || 'Un cliente',
        action: 'te ha pagado',
        detail: params.detail,
      }),
    });
    return { ok: !!result.ok, via: 'template' };
  } catch (err: any) {
    console.error('[merchant_alert] fallback error:', err?.message || err);
    return { ok: false, via: 'none' };
  }
}
