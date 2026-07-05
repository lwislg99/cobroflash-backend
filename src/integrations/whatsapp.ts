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
  isServiceWindowOpen,
  type WaRelatedType,
} from '../modules/messaging/domain/whatsappLog.service';

const BASE_URL = 'https://graph.facebook.com/v21.0';

// A5.5/A8.4 — MODO DRY-RUN (SOLO tests/CI, no es flag de producto): con
// WHATSAPP_DRY_RUN=1 los senders pasan TODOS los guards (optOut, demo, topes,
// validación J7) pero NO llaman a Meta: devuelven un wamid simulado y registran
// el log WA-0b igual. Permite probar flujos completos sin gastar mensajes.
const isDryRun = () => process.env.WHATSAPP_DRY_RUN === '1';
const dryRunData = () => ({ messages: [{ id: `wamid.dryrun.${Date.now()}.${Math.random().toString(36).slice(2, 8)}` }] });

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

  if ((!phoneNumberId || !token) && !isDryRun()) {
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

  // A5.5/A8.4: dry-run — guards pasados, Meta no se toca, log igual
  if (isDryRun()) {
    const data = dryRunData();
    if (params.merchantId) {
      recordWaMessage({
        merchantId: params.merchantId,
        customerId: params.log?.customerId ?? null,
        type: 'template',
        templateName: params.templateName,
        waMessageId: extractWaMessageId(data),
        status: 'sent',
        relatedType: params.log?.relatedType ?? null,
        relatedId: params.log?.relatedId ?? null,
      }).catch(() => {});
    }
    return { ok: true, data, dryRun: true } as any;
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

/**
 * A5.2 — Envío VENTANA-FIRST (Ola 5, estrategia de coste ~0):
 * si la ventana de servicio de 24 h del cliente está abierta (hubo un entrante
 * hace <23,5 h), envía `windowText` como texto libre (0 €) y lo registra como
 * `type:'service'` guardando en `templateName` la plantilla que se AHORRÓ (métrica
 * A5.4). Si la ventana está cerrada, o el texto falla pese a todo, cae a la
 * plantilla pagada de siempre. Guards: waOptOut (J3) se comprueba aquí para el
 * texto; V0-2 (demo) y los topes A3.2 se reaplican dentro de cada sender de base.
 */
export async function sendWhatsAppWindowFirst(params: {
  to: string;
  merchantId: number;
  customerId?: number | null;
  windowText: string;
  template: { templateName: string; languageCode?: string; components?: any[] };
  log?: WaLogMeta;
}): Promise<{ ok: boolean; via: 'window' | 'template' | 'none'; reason?: string; error?: any; data?: any }> {
  // J3: la baja del canal manda también sobre los textos de ventana
  if (await isWaOptedOut(params.merchantId, params.to)) {
    console.warn(`[WhatsApp] ${params.to} dado de baja (waOptOut) para merchant ${params.merchantId}; ventana-first bloqueado`);
    return { ok: false, via: 'none', reason: 'wa_opt_out' };
  }

  const customerId = params.customerId ?? params.log?.customerId ?? null;
  if (customerId && (await isServiceWindowOpen(params.merchantId, customerId))) {
    const text = await sendWhatsAppText({
      to: params.to,
      merchantId: params.merchantId,
      text: params.windowText,
    }).catch(() => ({ ok: false as const, data: undefined as any }));

    if (text.ok) {
      recordWaMessage({
        merchantId: params.merchantId,
        customerId,
        type: 'service',
        templateName: params.template.templateName, // la plantilla que NO se pagó
        waMessageId: extractWaMessageId((text as any).data),
        status: 'sent',
        relatedType: params.log?.relatedType ?? null,
        relatedId: params.log?.relatedId ?? null,
        costEstimate: 0,
      }).catch(() => {});
      return { ok: true, via: 'window' };
    }
    console.warn('[WhatsApp] A5.2: ventana abierta pero el texto falló; fallback a plantilla');
  }

  const result = await sendWhatsAppTemplate({
    to: params.to,
    merchantId: params.merchantId,
    log: { ...(params.log ?? {}), customerId },
    templateName: params.template.templateName,
    languageCode: params.template.languageCode,
    components: params.template.components,
  });
  return { ...result, via: 'template' };
}

export async function sendWhatsAppText(params: {
  to: string;
  text: string;
  // V0-2: si se indica, el merchant demo solo puede enviar a DEMO_SAFE_NUMBERS
  merchantId?: number;
}) {
  const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
  const token = config.WHATSAPP_ACCESS_TOKEN;

  if ((!phoneNumberId || !token) && !isDryRun()) {
    console.warn('[WhatsApp] Credenciales no configuradas, mensaje omitido');
    return { ok: false, reason: 'not_configured' };
  }

  // V0-2: modo demo seguro (los textos libres además solo entregan en ventana 24h — J2)
  if (demoSendBlocked(params.merchantId, params.to, config.DEMO_SAFE_NUMBERS)) {
    console.warn(`[WhatsApp] V0-2: texto desde el merchant demo a ${params.to} BLOQUEADO (no está en DEMO_SAFE_NUMBERS)`);
    return { ok: false, reason: 'demo_safe_numbers' };
  }

  // A5.5/A8.4: dry-run — Meta no se toca (quien registre el log usa este wamid)
  if (isDryRun()) return { ok: true, data: dryRunData(), dryRun: true } as any;

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

/**
 * BOT-1 (K1): mensaje interactivo de LISTA (service message — solo llega con
 * la ventana 24h abierta, que es exactamente el caso del bot: SIEMPRE responde
 * a un entrante → coste 0). Máx 10 filas por sección (límite de Meta).
 */
export async function sendWhatsAppList(params: {
  to: string;
  bodyText: string;
  buttonText: string; // texto del botón que despliega la lista (máx 20 chars)
  rows: Array<{ id: string; title: string; description?: string }>;
  merchantId?: number; // V0-2: demo solo a DEMO_SAFE_NUMBERS
}) {
  const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
  const token = config.WHATSAPP_ACCESS_TOKEN;

  if ((!phoneNumberId || !token) && !isDryRun()) {
    console.warn('[WhatsApp] Credenciales no configuradas, lista omitida');
    return { ok: false, reason: 'not_configured' };
  }
  if (demoSendBlocked(params.merchantId, params.to, config.DEMO_SAFE_NUMBERS)) {
    console.warn(`[WhatsApp] V0-2: lista desde el merchant demo a ${params.to} BLOQUEADA`);
    return { ok: false, reason: 'demo_safe_numbers' };
  }

  // A5.5/A8.4: dry-run — Meta no se toca
  if (isDryRun()) return { ok: true, data: dryRunData(), dryRun: true } as any;

  try {
    const response = await axios.post(
      `${BASE_URL}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: params.to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: params.bodyText },
          action: {
            button: params.buttonText.slice(0, 20),
            sections: [
              {
                rows: params.rows.slice(0, 10).map((r) => ({
                  id: r.id,
                  title: r.title.slice(0, 24), // límites de Meta
                  ...(r.description ? { description: r.description.slice(0, 72) } : {}),
                })),
              },
            ],
          },
        },
      },
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 10_000,
      },
    );
    return { ok: true, data: response.data };
  } catch (err: any) {
    console.error('[WhatsApp] Error enviando lista:', err?.response?.data || err?.message);
    return { ok: false, error: err?.response?.data || err?.message };
  }
}