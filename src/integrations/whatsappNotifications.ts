// src/integrations/whatsappNotifications.ts
// Helpers de alto nivel para envíos de plantillas concretas.
// La spec canónica de las plantillas vive en docs/WHATSAPP_TEMPLATES.md.
import { normalizePhone } from '../core/utils/utils';
import { sendWhatsAppTemplate } from './whatsapp';

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
}): Promise<{ ok: boolean }> {
  const to = normalizePhone(params.toPhone || '');
  if (!to) return { ok: false };

  try {
    const result = await sendWhatsAppTemplate({
      to,
      templateName: 'payment_confirmation_es',
      languageCode: 'es',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: params.customerName || 'Cliente' },
            { type: 'text', text: params.amountWithCurrency },
            { type: 'text', text: params.invoiceNumber },
            { type: 'text', text: params.businessName || 'tu proveedor' },
          ],
        },
      ],
    });
    return { ok: !!result.ok };
  } catch (err: any) {
    console.error('[payment_confirmation] error:', err?.message || err);
    return { ok: false };
  }
}
