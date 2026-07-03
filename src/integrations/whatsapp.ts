// src/integrations/whatsapp.ts
import axios from 'axios';
import { config } from '../core/config/env';
import { prisma } from '../core/db/prisma';
import { normalizePhone } from '../core/utils/utils';
import { validateTemplateComponents } from './whatsappTemplates';
import { demoSendBlocked } from './whatsappPolicy';
import {
  recordWaMessage,
  extractWaMessageId,
  type WaRelatedType,
} from '../modules/messaging/domain/whatsappLog.service';

const BASE_URL = 'https://graph.facebook.com/v21.0';

// WA-0b: metadata opcional para el log de mensajes (chip de entrega). No afecta al envío.
export interface WaLogMeta {
  customerId?: number | null;
  relatedType?: WaRelatedType | null;
  relatedId?: number | null;
}

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
  // WA-0b: si se indica merchantId, se registra el mensaje en el log de entrega
  log?: WaLogMeta;
}) {
  const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
  const token = config.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !token) {
    console.warn('[WhatsApp] Credenciales no configuradas, mensaje omitido');
    return { ok: false, reason: 'not_configured' };
  }

  // V0-2: modo demo seguro — el demo solo envía a DEMO_SAFE_NUMBERS
  if (demoSendBlocked(params.merchantId, params.to, config.DEMO_SAFE_NUMBERS)) {
    console.warn(`[WhatsApp] V0-2: envío desde el merchant demo a ${params.to} BLOQUEADO (no está en DEMO_SAFE_NUMBERS)`);
    return { ok: false, reason: 'demo_safe_numbers' };
  }

  // J3: baja del canal — bloqueo de plantillas a ese número para ese merchant
  if (params.merchantId && (await isWaOptedOut(params.merchantId, params.to))) {
    console.warn(`[WhatsApp] ${params.to} dado de baja (waOptOut) para merchant ${params.merchantId}; envío bloqueado`);
    return { ok: false, reason: 'wa_opt_out' };
  }

  // A3.2 (PV-WA-CAPS): topes anti-abuso del número compartido, contados sobre
  // el log WA-0b (WhatsAppMessage). Best-effort: si la BD falla, NO se bloquea.
  if (params.merchantId) {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Tope por merchant/día (protege el número y el gasto)
      const sentToday = await prisma.whatsAppMessage.count({
        where: { merchantId: params.merchantId, type: 'template', createdAt: { gte: startOfDay } },
      });
      if (sentToday >= config.WA_DAILY_TEMPLATE_CAP) {
        // Alerta interna de gasto/uso diario (visible en logs de Railway)
        console.error(
          `[WhatsApp][ALERTA] merchant ${params.merchantId} alcanzó el tope diario de plantillas ` +
          `(${sentToday}/${config.WA_DAILY_TEMPLATE_CAP}); envío BLOQUEADO (A3.2)`,
        );
        return { ok: false, reason: 'daily_cap' };
      }

      // J6: tope duro de mensajes-iniciados-por-negocio por CLIENTE y día
      const customerId = params.log?.customerId;
      if (customerId) {
        const toCustomerToday = await prisma.whatsAppMessage.count({
          where: { merchantId: params.merchantId, customerId, type: 'template', createdAt: { gte: startOfDay } },
        });
        if (toCustomerToday >= config.WA_CUSTOMER_DAILY_CAP) {
          console.warn(
            `[WhatsApp] J6: cliente ${customerId} ya recibió ${toCustomerToday} plantillas hoy ` +
            `del merchant ${params.merchantId}; envío BLOQUEADO`,
          );
          return { ok: false, reason: 'customer_daily_cap' };
        }
      }
    } catch (err: any) {
      console.error('[WhatsApp] Error comprobando topes A3.2 (no se bloquea):', err?.message || err);
    }
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

    // WA-0b: registrar el envío con el waMessageId que devuelve Meta
    if (params.merchantId) {
      recordWaMessage({
        merchantId: params.merchantId,
        customerId: params.log?.customerId ?? null,
        type: 'template',
        templateName: params.templateName,
        waMessageId: extractWaMessageId(response.data),
        status: 'sent',
        relatedType: params.log?.relatedType ?? null,
        relatedId: params.log?.relatedId ?? null,
      }).catch(() => {});
    }

    return { ok: true, data: response.data };
  } catch (err: any) {
    console.error('[WhatsApp] Error enviando mensaje:', err?.response?.data || err?.message);
    return { ok: false, error: err?.response?.data || err?.message };
  }
}

export async function sendWhatsAppText(params: {
  to: string;
  text: string;
  // V0-2: si se indica, el merchant demo solo puede enviar a DEMO_SAFE_NUMBERS
  merchantId?: number;
}) {
  const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
  const token = config.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !token) {
    console.warn('[WhatsApp] Credenciales no configuradas, mensaje omitido');
    return { ok: false, reason: 'not_configured' };
  }

  // V0-2: modo demo seguro (los textos libres además solo entregan en ventana 24h — J2)
  if (demoSendBlocked(params.merchantId, params.to, config.DEMO_SAFE_NUMBERS)) {
    console.warn(`[WhatsApp] V0-2: texto desde el merchant demo a ${params.to} BLOQUEADO (no está en DEMO_SAFE_NUMBERS)`);
    return { ok: false, reason: 'demo_safe_numbers' };
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