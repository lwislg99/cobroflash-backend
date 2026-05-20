// src/integrations/whatsapp.ts
import axios from 'axios';
import { config } from '../core/config/env';

const BASE_URL = 'https://graph.facebook.com/v21.0';

export async function sendWhatsAppTemplate(params: {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: any[];
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