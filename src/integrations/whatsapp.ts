// src/integrations/whatsapp.ts
import axios from 'axios';
import { config } from '../core/config/env';
import { prisma } from '../core/db/prisma';
import { normalizePhone } from '../core/utils/utils';
import { validateTemplateComponents } from './whatsappTemplates';

const BASE_URL = 'https://graph.facebook.com/v21.0';

/**
 * J3: ¿el destinatario se dio de baja de WhatsApp para este merchant?
 * Compara el teléfono normalizado contra los clientes con `waOptOut=true`
 * (los teléfonos guardados pueden venir con separadores/prefijos sucios).
 */
async function isWaOptedOut(merchantId: number, to: string): Promise<boolean> {
  try {
    const optedOut = await prisma.customer.findMany({
      where: { merchantId, waOptOut: true, phone: { not: null } },
      select: { phone: true },
    });
    return optedOut.some((c) => normalizePhone(c.phone || '') === to);
  } catch (err: any) {
    console.error('[WhatsApp] Error comprobando waOptOut:', err?.message || err);
    return false; // ante la duda no bloquear: el guard es best-effort, el dato manda en BD
  }
}

export async function sendWhatsAppTemplate(params: {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: any[];
  // J3: si se indica, se respeta la baja (waOptOut) de ese número para ese merchant
  merchantId?: number;
}) {
  const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
  const token = config.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !token) {
    console.warn('[WhatsApp] Credenciales no configuradas, mensaje omitido');
    return { ok: false, reason: 'not_configured' };
  }

  // J3: baja del canal — bloqueo de plantillas a ese número para ese merchant
  if (params.merchantId && (await isWaOptedOut(params.merchantId, params.to))) {
    console.warn(`[WhatsApp] ${params.to} dado de baja (waOptOut) para merchant ${params.merchantId}; envío bloqueado`);
    return { ok: false, reason: 'wa_opt_out' };
  }

  // J7: validar contra la spec aprobada ANTES de llamar a Meta (evita #132000/#132001)
  const invalid = validateTemplateComponents(params.templateName, params.components);
  if (invalid) {
    console.error('[WhatsApp] Plantilla inválida, envío abortado:', invalid);
    return { ok: false, error: `template_invalid: ${invalid}` };
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: params.to,
        type: 'template',
        template: {
          name: params.templateName,
          language: { code: params.languageCode ?? 'es' },
          components: params.components ?? [],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      },
    );

    return { ok: true, data: response.data };
  } catch (err: any) {
    console.error('[WhatsApp] Error enviando mensaje:', err?.response?.data || err?.message);
    return { ok: false, error: err?.response?.data || err?.message };
  }
}

export async function sendWhatsAppText(params: {
  to: string;
  text: string;
}) {
  const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
  const token = config.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !token) {
    console.warn('[WhatsApp] Credenciales no configuradas, mensaje omitido');
    return { ok: false, reason: 'not_configured' };
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: params.to,
        type: 'text',
        text: { body: params.text },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      },
    );

    return { ok: true, data: response.data };
  } catch (err: any) {
    console.error('[WhatsApp] Error enviando texto:', err?.response?.data || err?.message);
    return { ok: false, error: err?.response?.data || err?.message };
  }
}