// src/integrations/whatsappNotifications.ts
// Helpers de alto nivel para envíos de plantillas concretas.
// La spec canónica de las plantillas vive en docs/WHATSAPP_TEMPLATES.md.
import { normalizePhone, formatMoneyEs } from '../core/utils/utils';
// SCRUM-877: el enlace del recibo salía con el dominio ESCRITO A PELO, así que no seguía a
// `PUBLIC_BASE_URL` — la raíz que el resto del sistema usa para todo lo que manda al cliente
// (`env.ts:211`). `BASE_URL` es esa misma variable. El TEXTO del mensaje no cambia: sólo la raíz.
import { BASE_URL } from '../core/config/env';
import { sendWhatsAppTemplate, sendWhatsAppText, sendWhatsAppWindowFirst, sendWhatsAppCtaUrl } from './whatsapp';
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
  // SCRUM-931: el importe entra en BRUTO y la forma se da una sola vez, dentro del builder.
  amount: number;
  currency: string;
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
        amount: params.amount,
        currency: params.currency,
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
 * Confirmación de pago al cliente CON botón "Ver documento" → /recibo/{{receiptToken}}
 * (plantilla payment_confirmation_invoice_es). Copy NEUTRO: vale para factura (post-SIF)
 * y para justificante (pre-SIF) — por eso `documentNumber` (no "invoiceNumber").
 * Sustituye a sendPaymentConfirmation() en los webhooks de pago (J1, plantillas Approved).
 * Cuerpo: {{1}} nombre · {{2}} importe con moneda · {{3}} nº documento · {{4}} negocio · botón = receiptToken
 * Fire-and-forget: nunca lanza; devuelve {ok}.
 *
 * SCRUM-74: el enlace público usa el token OPACO (`Charge.receiptToken`, `ensureChargeReceiptToken`),
 * NUNCA `chargeId` (IDOR/RGPD — el id es autoincremental y enumerable). `chargeId` se conserva
 * solo para el log interno (`WhatsAppMessage.relatedId`), que no es público.
 */
export async function sendPaymentConfirmationInvoice(params: {
  toPhone: string | null | undefined;
  customerName?: string | null;
  // SCRUM-931: en bruto. El texto libre de abajo y la plantilla comparten UNA sola forma.
  amount: number;
  currency: string;
  documentNumber: string;
  businessName?: string | null;
  chargeId: number;
  receiptToken: string;
  // SCRUM-245: OBLIGATORIO desde que se borró la rama «legacy» de abajo. Era opcional para
  // sostener un camino sin merchant que ya no existe; dejarlo opcional invitaría a recrearlo.
  merchantId: number;   // J3: respeta waOptOut del número para ese merchant
  customerId?: number;  // A5.3: habilita la vía ventana (0 €) si hay entrante <24 h
}): Promise<{ ok: boolean }> {
  const to = normalizePhone(params.toPhone || '');
  if (!to) return { ok: false };

  const customerName = params.customerName || 'Cliente';
  const businessName = params.businessName || 'tu proveedor';

  try {
    // A5.3: el pago casi siempre llega minutos después de una interacción del
    // cliente (tap en el WhatsApp del cobro) → intentar SIEMPRE la ventana antes
    // de gastar plantilla. El texto lleva el mismo contenido que la plantilla,
    // incluido el enlace al recibo (donde vive la reseña de A2.5).
    // SCRUM-245: aquí había un `if (params.merchantId)` y, debajo, una rama «llamadas legacy»
    // que mandaba la plantilla sin merchant. Estaba MUERTA —los dos únicos llamadores
    // (`mpWebhook:158`, `psp:196`) pasan `merchantId`— y el código que nadie puede ejecutar no
    // protege nada: solo miente a quien lo lea, que creerá que ese camino existe. Si algún día
    // vuelve a hacer falta, está en el historial. Ahora `merchantId` es obligatorio en la firma,
    // así que la rama no puede renacer sin que el compilador lo diga.
    // 🔴 SCRUM-931 · UNA sola forma para los TRES caminos de este envío. Aquí estaba la cara más
    // fea del defecto: el importe crudo no iba solo a la plantilla, iba también al TEXTO LIBRE y al
    // botón de ventana. O sea que el cliente leía «419.87 EUR» tanto si su ventana de 24 h estaba
    // abierta como si no — a diferencia del presupuesto (`sendQuote`), donde el texto libre SÍ
    // pasaba por `formatMoneyEs` y sólo la plantilla iba en crudo, y el mismo cliente podía recibir
    // dos formatos del MISMO importe según el camino. Con el importe en bruto y la forma dada una
    // vez, los tres caminos no pueden divergir.
    const importe = formatMoneyEs(params.amount, params.currency);
    const result = await sendWhatsAppWindowFirst({
      to,
      merchantId: params.merchantId,
      customerId: params.customerId ?? null,
      windowText:
        `Hola ${customerName} 👋\n` +
        `Hemos confirmado tu pago de ${importe} (documento de cobro ${params.documentNumber}).\n` +
        `¡Gracias por confiar en ${businessName}!\n` +
        `Tu recibo, aquí 👇\n` +
        `${BASE_URL}/recibo/${params.receiptToken}`,
      // A23: en ventana → botón-enlace "Ver recibo" (sin URL cruda)
      windowCta: {
        bodyText:
          `Hola ${customerName} 👋\n` +
          `Hemos confirmado tu pago de *${importe}* (documento ${params.documentNumber}).\n` +
          `¡Gracias por confiar en *${businessName}*!`,
        buttonText: 'Ver recibo',
        url: `${BASE_URL}/recibo/${params.receiptToken}`,
      },
      template: buildPaymentConfirmationInvoice({
        customerName,
        amount: params.amount,
        currency: params.currency,
        documentNumber: params.documentNumber,
        businessName,
        urlToken: params.receiptToken,
      }),
      log: { customerId: params.customerId ?? null, relatedType: 'charge', relatedId: params.chargeId },
    });
    return { ok: !!result.ok };
  } catch (err: any) {
    console.error('[payment_confirmation_invoice] error:', err?.message || err);
    return { ok: false };
  }
}

/**
 * Aviso al PROFESIONAL robusto a la ventana de 24 h, genérico para los eventos PRO-facing
 * (pago recibido y decisión de presupuesto aceptado/rechazado).
 * Estrategia decidida al conectar (J1, opción 1, sin schema): se INTENTA el texto libre
 * (gratis y rico si la ventana de servicio del PRO está abierta); si `sendWhatsAppText`
 * devuelve `{ok:false}` (ventana cerrada / error de entrega de Meta), se cae a la plantilla
 * Utility `merchant_alert_es`. Idempotente y sin estado nuevo. Los guards de demo (V0-2) y
 * waOptOut (J3) se reaplican dentro de cada envío, así que el fallback nunca salta esas reglas.
 * Fire-and-forget: nunca lanza.
 */
export async function notifyMerchantAlert(params: {
  merchantId: number;
  merchantPhone: string | null | undefined;
  freeText: string;            // texto a intentar con la ventana abierta
  customerName?: string | null;
  action: string;              // "te ha pagado" | "ha aceptado tu presupuesto" | "ha rechazado tu presupuesto"
  detail: string;              // "{importe con moneda} · {referencia}" para la plantilla
  cta?: { text: string; url: string }; // A23: si se pasa, el intento en-ventana usa BOTÓN-ENLACE (sin URL cruda)
}): Promise<{ ok: boolean; via: 'text' | 'template' | 'none' }> {
  const to = normalizePhone(params.merchantPhone || '');
  if (!to) return { ok: false, via: 'none' };

  // 1) Ventana 24 h abierta → botón-enlace (si hay cta) o texto libre.
  const windowResult = params.cta
    ? await sendWhatsAppCtaUrl({ to, merchantId: params.merchantId, bodyText: params.freeText, buttonText: params.cta.text, url: params.cta.url }).catch(() => ({ ok: false as const }))
    : await sendWhatsAppText({ to, merchantId: params.merchantId, text: params.freeText }).catch(() => ({ ok: false as const }));
  if (windowResult.ok) return { ok: true, via: 'text' };

  // 2) Ventana cerrada / error → fallback a plantilla.
  try {
    const result = await sendWhatsAppTemplate({
      to,
      merchantId: params.merchantId,
      ...buildMerchantAlert({
        customerName: params.customerName || 'Un cliente',
        action: params.action,
        detail: params.detail,
      }),
    });
    return { ok: !!result.ok, via: 'template' };
  } catch (err: any) {
    console.error('[merchant_alert] fallback error:', err?.message || err);
    return { ok: false, via: 'none' };
  }
}

/** Atajo de notifyMerchantAlert para el pago recibido (action fija "te ha pagado"). */
export async function notifyMerchantPaid(params: {
  merchantId: number;
  merchantPhone: string | null | undefined;
  freeText: string;
  customerName?: string | null;
  detail: string;
}): Promise<{ ok: boolean; via: 'text' | 'template' | 'none' }> {
  return notifyMerchantAlert({ ...params, action: 'te ha pagado' });
}
