// src/integrations/whatsapp.ts
import axios from 'axios';
import { maskPhone } from '../core/utils/utils'; // A11.2 (S3): PII fuera de logs
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
// Buzón de salida SOLO para tests (A8.4): si la suite define
// globalThis.__waDryRunOutbox (array), cada envío dry-run se apunta ahí para
// poder asertar QUÉ respondió el bot sin tocar Meta. En prod no existe y no hace nada.
const dryRunRecord = (entry: any) => { try { (globalThis as any).__waDryRunOutbox?.push(entry); } catch { /* test-only */ } };

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

/**
 * MEDIA-1 (FASE 3): descarga un adjunto entrante de WhatsApp por su media_id.
 * Dos pasos (Cloud API): GET /{media_id} → { url, mime_type } (url temporal,
 * ~5 min) y luego GET de esa url con el token → bytes. Devuelve null ante
 * cualquier fallo (el bot cae al comportamiento amable). En dry-run (tests)
 * devuelve un buffer simbólico para poder asertar el flujo sin tocar Meta.
 */
export async function downloadWhatsAppMedia(
  mediaId: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  if (isDryRun()) return { buffer: Buffer.from(`dryrun-media-${mediaId}`), mime: 'image/jpeg' };
  const token = config.WHATSAPP_ACCESS_TOKEN;
  if (!token || !mediaId) return null;
  try {
    const meta = await axios.get(`${BASE_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
    const mediaUrl = meta.data?.url;
    const mime = String(meta.data?.mime_type || 'application/octet-stream');
    if (!mediaUrl) return null;
    const bin = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer',
      timeout: 20000,
      maxContentLength: 12 * 1024 * 1024, // 12 MB de guarda
    });
    return { buffer: Buffer.from(bin.data), mime };
  } catch (err: any) {
    console.error('[WhatsApp] downloadWhatsAppMedia error:', err?.response?.status, err?.message);
    return null;
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
    console.warn(`[WhatsApp] V0-2: envío desde el merchant demo a ${maskPhone(params.to)} BLOQUEADO (no está en DEMO_SAFE_NUMBERS)`);
    return { ok: false, reason: 'demo_safe_numbers' };
  }

  // J3: baja del canal — bloqueo de plantillas a ese número para ese merchant
  if (params.merchantId && (await isWaOptedOut(params.merchantId, params.to))) {
    console.warn(`[WhatsApp] ${maskPhone(params.to)} dado de baja (waOptOut) para merchant ${params.merchantId}; envío bloqueado`);
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
    dryRunRecord({ kind: 'template', to: params.to, templateName: params.templateName });
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
  windowCta?: { bodyText: string; buttonText: string; url: string }; // A23: si se pasa, la vía ventana usa botón-enlace (sin URL cruda)
  template: { templateName: string; languageCode?: string; components?: any[] };
  log?: WaLogMeta;
}): Promise<{ ok: boolean; via: 'window' | 'template' | 'none'; reason?: string; error?: any; data?: any }> {
  // J3: la baja del canal manda también sobre los textos de ventana
  if (await isWaOptedOut(params.merchantId, params.to)) {
    console.warn(`[WhatsApp] ${maskPhone(params.to)} dado de baja (waOptOut) para merchant ${params.merchantId}; ventana-first bloqueado`);
    return { ok: false, via: 'none', reason: 'wa_opt_out' };
  }

  const customerId = params.customerId ?? params.log?.customerId ?? null;
  if (customerId && (await isServiceWindowOpen(params.merchantId, customerId))) {
    // A23: si el llamador da windowCta, la ventana viaja como BOTÓN-ENLACE (sin URL cruda);
    // si no, texto libre como siempre. En ambos casos = service message (0 €).
    const text = params.windowCta
      ? await sendWhatsAppCtaUrl({
          to: params.to,
          merchantId: params.merchantId,
          bodyText: params.windowCta.bodyText,
          buttonText: params.windowCta.buttonText,
          url: params.windowCta.url,
        }).catch(() => ({ ok: false as const, data: undefined as any }))
      : await sendWhatsAppText({
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
    console.warn(`[WhatsApp] V0-2: texto desde el merchant demo a ${maskPhone(params.to)} BLOQUEADO (no está en DEMO_SAFE_NUMBERS)`);
    return { ok: false, reason: 'demo_safe_numbers' };
  }

  // A5.5/A8.4: dry-run — Meta no se toca (quien registre el log usa este wamid)
  if (isDryRun()) { dryRunRecord({ kind: 'text', to: params.to, text: params.text }); return { ok: true, data: dryRunData(), dryRun: true } as any; }

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
 * A15.2 (MANT-1): mensaje interactivo de BOTONES de respuesta (máx 3, límite
 * de Meta). Service message: solo entrega con la ventana 24h abierta — se usa
 * para la propuesta de mantenimiento AL PRO ([Aprobar y enviar] [Posponer 30d]
 * [Cancelar plan]); fuera de ventana el ciclo degrada con dignidad (el draft
 * queda visible en el BO y el fallo se registra).
 */
export async function sendWhatsAppButtons(params: {
  to: string;
  bodyText: string;
  buttons: Array<{ id: string; title: string }>; // title máx 20 chars (Meta)
  merchantId?: number; // V0-2: demo solo a DEMO_SAFE_NUMBERS
}) {
  const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
  const token = config.WHATSAPP_ACCESS_TOKEN;

  if ((!phoneNumberId || !token) && !isDryRun()) {
    console.warn('[WhatsApp] Credenciales no configuradas, botones omitidos');
    return { ok: false, reason: 'not_configured' };
  }
  if (demoSendBlocked(params.merchantId, params.to, config.DEMO_SAFE_NUMBERS)) {
    console.warn(`[WhatsApp] V0-2: botones desde el merchant demo a ${maskPhone(params.to)} BLOQUEADOS`);
    return { ok: false, reason: 'demo_safe_numbers' };
  }

  // A5.5/A8.4: dry-run — Meta no se toca
  if (isDryRun()) { dryRunRecord({ kind: 'buttons', to: params.to, bodyText: params.bodyText, buttons: params.buttons.map((b) => b.id) }); return { ok: true, data: dryRunData(), dryRun: true } as any; }

  try {
    const response = await axios.post(
      `${BASE_URL}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: params.to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: params.bodyText },
          action: {
            buttons: params.buttons.slice(0, 3).map((b) => ({
              type: 'reply',
              reply: { id: b.id, title: b.title.slice(0, 20) },
            })),
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
    console.error('[WhatsApp] Error enviando botones:', err?.response?.data || err?.message);
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
    console.warn(`[WhatsApp] V0-2: lista desde el merchant demo a ${maskPhone(params.to)} BLOQUEADA`);
    return { ok: false, reason: 'demo_safe_numbers' };
  }

  // A5.5/A8.4: dry-run — Meta no se toca
  if (isDryRun()) { dryRunRecord({ kind: 'list', to: params.to, bodyText: params.bodyText, rows: params.rows.map((r) => r.id) }); return { ok: true, data: dryRunData(), dryRun: true } as any; }

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

/**
 * A23 (K1): mensaje interactivo con BOTÓN DE ENLACE (`cta_url`). Muestra un botón que
 * ABRE la URL — sin enseñar el enlace crudo. Service message: solo entrega con la ventana
 * 24 h abierta (Meta rechaza fuera de ventana → ok:false, ideal para el patrón ventana-first).
 */
export async function sendWhatsAppCtaUrl(params: {
  to: string;
  bodyText: string;
  buttonText: string;   // display_text (máx 30 chars — límite de Meta)
  url: string;
  header?: string;      // texto de cabecera (máx 60)
  footer?: string;      // texto de pie (máx 60)
  merchantId?: number;  // V0-2: demo solo a DEMO_SAFE_NUMBERS
}) {
  const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
  const token = config.WHATSAPP_ACCESS_TOKEN;
  if ((!phoneNumberId || !token) && !isDryRun()) {
    console.warn('[WhatsApp] Credenciales no configuradas, cta_url omitido');
    return { ok: false, reason: 'not_configured' };
  }
  if (demoSendBlocked(params.merchantId, params.to, config.DEMO_SAFE_NUMBERS)) {
    console.warn(`[WhatsApp] V0-2: cta_url desde el merchant demo a ${maskPhone(params.to)} BLOQUEADO`);
    return { ok: false, reason: 'demo_safe_numbers' };
  }
  if (isDryRun()) {
    dryRunRecord({ kind: 'cta_url', to: params.to, bodyText: params.bodyText, buttonText: params.buttonText, url: params.url });
    return { ok: true, data: dryRunData(), dryRun: true } as any;
  }
  try {
    const interactive: any = {
      type: 'cta_url',
      body: { text: params.bodyText },
      action: { name: 'cta_url', parameters: { display_text: params.buttonText.slice(0, 30), url: params.url } },
    };
    if (params.header) interactive.header = { type: 'text', text: params.header.slice(0, 60) };
    if (params.footer) interactive.footer = { text: params.footer.slice(0, 60) };
    const response = await axios.post(
      `${BASE_URL}/${phoneNumberId}/messages`,
      { messaging_product: 'whatsapp', to: params.to, type: 'interactive', interactive },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 10_000 },
    );
    return { ok: true, data: response.data };
  } catch (err: any) {
    console.error('[WhatsApp] Error enviando cta_url:', err?.response?.data || err?.message);
    return { ok: false, error: err?.response?.data || err?.message };
  }
}

/**
 * A23 (K1): enviar un DOCUMENTO (p. ej. el PDF del recibo/factura) en el chat. `link` debe
 * ser una URL pública que Meta pueda descargar. Service message (solo en ventana 24 h).
 */
export async function sendWhatsAppDocument(params: {
  to: string;
  link: string;
  filename?: string;
  caption?: string;
  merchantId?: number;
}) {
  const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
  const token = config.WHATSAPP_ACCESS_TOKEN;
  if ((!phoneNumberId || !token) && !isDryRun()) {
    console.warn('[WhatsApp] Credenciales no configuradas, documento omitido');
    return { ok: false, reason: 'not_configured' };
  }
  if (demoSendBlocked(params.merchantId, params.to, config.DEMO_SAFE_NUMBERS)) {
    console.warn(`[WhatsApp] V0-2: documento desde el merchant demo a ${maskPhone(params.to)} BLOQUEADO`);
    return { ok: false, reason: 'demo_safe_numbers' };
  }
  if (isDryRun()) {
    dryRunRecord({ kind: 'document', to: params.to, link: params.link, filename: params.filename });
    return { ok: true, data: dryRunData(), dryRun: true } as any;
  }
  try {
    const document: any = { link: params.link };
    if (params.filename) document.filename = params.filename;
    if (params.caption) document.caption = params.caption;
    const response = await axios.post(
      `${BASE_URL}/${phoneNumberId}/messages`,
      { messaging_product: 'whatsapp', to: params.to, type: 'document', document },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 10_000 },
    );
    return { ok: true, data: response.data };
  } catch (err: any) {
    console.error('[WhatsApp] Error enviando documento:', err?.response?.data || err?.message);
    return { ok: false, error: err?.response?.data || err?.message };
  }
}

/**
 * A23 (K1): pedir la UBICACIÓN al cliente (interactive `location_request_message`). Muestra
 * un botón "Enviar ubicación"; el cliente puede tocarlo o escribir la zona. Service message.
 */
export async function sendWhatsAppLocationRequest(params: {
  to: string;
  bodyText: string;
  merchantId?: number;
}) {
  const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
  const token = config.WHATSAPP_ACCESS_TOKEN;
  if ((!phoneNumberId || !token) && !isDryRun()) {
    console.warn('[WhatsApp] Credenciales no configuradas, location_request omitido');
    return { ok: false, reason: 'not_configured' };
  }
  if (demoSendBlocked(params.merchantId, params.to, config.DEMO_SAFE_NUMBERS)) {
    console.warn(`[WhatsApp] V0-2: location_request desde el merchant demo a ${maskPhone(params.to)} BLOQUEADO`);
    return { ok: false, reason: 'demo_safe_numbers' };
  }
  if (isDryRun()) {
    dryRunRecord({ kind: 'location_request', to: params.to, bodyText: params.bodyText });
    return { ok: true, data: dryRunData(), dryRun: true } as any;
  }
  try {
    const response = await axios.post(
      `${BASE_URL}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: params.to,
        type: 'interactive',
        interactive: { type: 'location_request_message', body: { text: params.bodyText }, action: { name: 'send_location' } },
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 10_000 },
    );
    return { ok: true, data: response.data };
  } catch (err: any) {
    console.error('[WhatsApp] Error enviando location_request:', err?.response?.data || err?.message);
    return { ok: false, error: err?.response?.data || err?.message };
  }
}

/**
 * A23: marcar el ENTRANTE como leído (doble check azul) y mostrar "escribiendo…" al cliente
 * antes de responder — hace que el bot se sienta instantáneo y humano. Best-effort total:
 * el bot funciona igual sin esto. Si el campo `typing_indicator` no está soportado, reintenta
 * solo el "read".
 */
export async function markInboundRead(messageId: string): Promise<void> {
  const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
  const token = config.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token || isDryRun() || !messageId) return;
  const url = `${BASE_URL}/${phoneNumberId}/messages`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  try {
    await axios.post(url, { messaging_product: 'whatsapp', status: 'read', message_id: messageId, typing_indicator: { type: 'text' } }, { headers, timeout: 8_000 });
  } catch {
    try { await axios.post(url, { messaging_product: 'whatsapp', status: 'read', message_id: messageId }, { headers, timeout: 8_000 }); } catch { /* best-effort */ }
  }
}