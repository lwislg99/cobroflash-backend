// src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts
// Webhook entrante de WhatsApp Cloud API.
// GET  /webhooks/whatsapp  → verificación Meta (handshake hub.challenge)
// POST /webhooks/whatsapp  → mensajes entrantes (acepto/rechazo por texto libre)
import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../../../../core/db/prisma';
import { config } from '../../../../core/config/env';
import { maskPhone, normalizePhone, formatMoneyEs } from '../../../../core/utils/utils';
import { sendWhatsAppText, markInboundRead } from '../../../../integrations/whatsapp';
import { sendMerchantQuoteAcceptedEmail } from '../../../messaging/domain/merchantNotifications';
import { updateWaMessageStatus, recordInboundWaMessage } from '../../../messaging/domain/whatsappLog.service';
import { isFlagEnabled } from '../../../../core/flags';
import { notifyMerchantAlert } from '../../../../integrations/whatsappNotifications';
import { handleBotMessage, handleUnsupportedMedia, handleIncomingPhoto, isMidIntake, type BotInput } from '../../domain/botFlow.service';
import { ensureJobForQuote } from '../../../jobs/domain/job.service';
import { handleMaintenanceButton } from '../../../maintenance/domain/maintenance.service';

const router = Router();

// A8.2: Meta REINTENTA webhooks (y puede entregar dos veces) — dedupe por
// wamid con LRU en memoria para que dos entregas del mismo mensaje no
// dupliquen la respuesta del bot. 500 ids ≈ sobra para el volumen F1.
const seenWamids = new Set<string>();
const seenOrder: string[] = [];
export function isDuplicateWamid(id: string): boolean { // A12.2: exportada para la suite
  if (!id) return false;
  if (seenWamids.has(id)) return true;
  seenWamids.add(id);
  seenOrder.push(id);
  if (seenOrder.length > 500) seenWamids.delete(seenOrder.shift() as string);
  return false;
}

// A8.2 (#15): tipos de mensaje que el bot no entiende — respuesta amable + menú.
// MEDIA-1 (FASE 3): 'image' se gestiona aparte (handleIncomingPhoto) → ya no aquí.
const UNSUPPORTED_TYPES = new Set(['audio', 'video', 'document', 'sticker', 'contacts']);

// Valida la firma X-Hub-Signature-256 de Meta usando el App Secret.
// SCRUM-99: FAIL-CLOSED — sin WHATSAPP_APP_SECRET, la firma se considera SIEMPRE
// inválida (antes: sin secreto, se aceptaba cualquier payload sin verificar).
export function isValidSignature(req: any): boolean { // SCRUM-100: exportada para el test del guard
  const secret = config.WHATSAPP_APP_SECRET;
  if (!secret) {
    console.error('🚨 [WA webhook] WHATSAPP_APP_SECRET no configurado — payload RECHAZADO (fail-closed). Configúralo en Railway.');
    return false;
  }
  const header = String(req.headers['x-hub-signature-256'] || '');
  const raw: Buffer | undefined = req.rawBody;
  if (!header.startsWith('sha256=') || !raw) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ── Verificación Meta ─────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // SCRUM-105: comparación en tiempo constante, igual que el resto de secretos del
  // código (requireInternalSecret) — el handshake es de configuración única con Meta,
  // pero no hay motivo para que sea la única comparación de secreto sin timingSafeEqual.
  const expected = config.WHATSAPP_VERIFY_TOKEN;
  const tokenMatches =
    typeof token === 'string' &&
    !!expected &&
    token.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));

  if (mode === 'subscribe' && tokenMatches) {
    console.log('[WA webhook] Verified by Meta');
    return res.status(200).send(String(challenge ?? ''));
  }
  console.warn('[WA webhook] Verification failed', { mode, tokenMatches });
  return res.status(403).send('Forbidden');
});

// ── Mensajes entrantes ────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  // Diagnóstico (J5, nunca fallo silencioso): dejar constancia de CUALQUIER
  // POST de Meta antes de validar nada — permite distinguir "no llega" de
  // "llega y se rechaza" mirando los logs.
  try {
    const fields = (req.body?.entry ?? [])
      .flatMap((e: any) => (e.changes ?? []).map((c: any) => c.field))
      .join(',');
    console.log(`[WA webhook] POST recibido (fields: ${fields || 'desconocido'})`);
  } catch { /* solo logging */ }

  // Validar firma de Meta antes de procesar (SCRUM-99: obligatoria, fail-closed)
  if (!isValidSignature(req)) {
    console.warn('[WA webhook] Invalid X-Hub-Signature-256 — rejected (revisa que WHATSAPP_APP_SECRET en Railway sea la "Clave secreta de la aplicación" de Meta)');
    return res.status(401).send('invalid signature');
  }

  // ACK inmediato (Meta reintenta si tardamos >20s)
  res.status(200).send('OK');

  try {
    const entries = req.body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        // WA-0b: estados de entrega (queued/sent/delivered/read/failed) de mensajes salientes
        const statuses = change?.value?.statuses ?? [];
        for (const st of statuses) {
          const waMessageId = String(st.id || '');
          const status = String(st.status || '');
          if (!waMessageId || !status) continue;
          const err = st.errors?.[0]
            ? `${st.errors[0].code}: ${st.errors[0].title || st.errors[0].message || ''}`
            : null;
          updateWaMessageStatus(waMessageId, status, err).catch((e) =>
            console.error('[WA status] update error:', e?.message),
          );
        }

        const messages = change?.value?.messages ?? [];
        for (const msg of messages) {
          const from = String(msg.from || '');
          if (!from) continue;

          // A8.2: entrega duplicada del mismo mensaje (reintento de Meta) → fuera
          if (isDuplicateWamid(String(msg.id || ''))) continue;

          // A5.2: CUALQUIER entrante (texto, tap de botón/lista, audio…) abre o
          // renueva la ventana de servicio de 24 h → se registra para que los
          // envíos ventana-first sepan cuándo el texto libre viaja gratis.
          recordInboundWaMessage(from).catch(() => {});

          // A23: marca el entrante como leído + "escribiendo…" (best-effort) si el bot va a responder.
          if (isFlagEnabled('BOT_INBOUND_ENABLED')) markInboundRead(String(msg.id || '')).catch(() => {});

          if (msg.type === 'text') {
            const text = String(msg.text?.body || '').trim();
            if (!text) continue;
            routeIncoming(from, { text }).catch((e) =>
              console.error('[WA in] handler error:', e?.message),
            );
          } else if (msg.type === 'interactive') {
            // BOT-1: respuesta de lista/botón interactivo
            const listReplyId = String(
              msg.interactive?.list_reply?.id || msg.interactive?.button_reply?.id || '',
            );
            if (!listReplyId) continue;
            routeIncoming(from, { listReplyId }).catch((e) =>
              console.error('[WA in] handler error:', e?.message),
            );
          } else if (msg.type === 'button') {
            // SCRUM-50: quick-reply de PLANTILLA (p. ej. «👍 Recibido» de albaran_firmado_es).
            // Meta lo entrega como type:'button' con button.text/payload (DISTINTO de 'interactive',
            // que es de los interactivos del bot). Acuse digno, JAMÁS el menú genérico. La ventana
            // 24h ya se abrió arriba (recordInboundWaMessage) → el acuse viaja como sesión (0 €).
            const btnText = String(msg.button?.text || msg.button?.payload || '');
            handleTemplateButtonReply(from, btnText).catch((e) =>
              console.error('[WA in] button error:', e?.message),
            );
          } else if (msg.type === 'location') {
            // A23: ubicación compartida por el cliente → se usa como "zona" del flujo del bot.
            const loc: any = msg.location || {};
            const zoneText = String(loc.name || loc.address || (loc.latitude != null ? `📍 ${loc.latitude}, ${loc.longitude}` : '')).trim();
            if (zoneText) routeIncoming(from, { text: zoneText }).catch((e) =>
              console.error('[WA in] handler error:', e?.message),
            );
          } else if (msg.type === 'image' && isFlagEnabled('BOT_INBOUND_ENABLED')) {
            // MEDIA-1 (FASE 3): foto entrante → adjuntarla a la solicitud reciente
            // del cliente (si la hay). handleIncomingPhoto cae al mensaje amable si
            // no hay solicitud o falla la descarga. Nunca crashea.
            const mediaId = String(msg.image?.id || '');
            if (mediaId) {
              handleIncomingPhoto(from, mediaId).catch((e) =>
                console.error('[WA in] photo error:', e?.message),
              );
            } else {
              handleUnsupportedMedia(from).catch(() => {});
            }
          } else if (UNSUPPORTED_TYPES.has(String(msg.type || '')) && isFlagEnabled('BOT_INBOUND_ENABLED')) {
            // A8.2 (#15): audio/vídeo/documento/sticker/contactos →
            // respuesta amable + menú si no hay flujo a medias (el audio→texto
            // real es F2, MEDIA-1). Nunca crashea.
            handleUnsupportedMedia(from).catch(() => {});
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[WA webhook] Parse error:', err?.message);
  }
});

// ── Router de entrantes ───────────────────────────────────────────────────
// Orden: J3 (BAJA/STOP, ley del canal, con o sin bot) → decisión Acepto/No
// sobre plantilla (si hay exactamente 1 presupuesto enviado) → BOT-1 (flag).
async function routeIncoming(from: string, input: BotInput): Promise<void> {
  const phone = normalizePhone(from);
  if (!phone) return;
  const text = (input.text || '').trim();

  console.log(`[WA in] from=${maskPhone(phone)} ${input.listReplyId ? `list=${input.listReplyId}` : `text="${text.slice(0, 80)}"`}`);

  // A15.2 (MANT-1): botones de la propuesta de mantenimiento — vienen DEL PRO
  // (el servicio verifica que el emisor es el whatsappPhone del merchant dueño).
  const mant = /^mant_(ok|later|cancel)_(\d+)_(\d+)$/.exec(input.listReplyId || '');
  if (mant) {
    const handled = await handleMaintenanceButton(
      phone, mant[1] as 'ok' | 'later' | 'cancel', Number(mant[2]), Number(mant[3]),
    ).catch((e) => { console.error('[maintenance] botón error:', e?.message); return true; });
    if (handled) return;
  }

  // J3: baja del canal — "BAJA"/"STOP" → waOptOut + confirmación + aviso al pro
  if (/^(baja|stop)[.!]?$/i.test(text)) {
    await handleOptOutRequest(phone, from);
    return;
  }

  if (isFlagEnabled('BOT_INBOUND_ENABLED')) {
    // La decisión sobre plantilla sigue mandando: "Acepto"/"No" con UN solo
    // presupuesto enviado es la respuesta a quote_decision_es, no chat del bot.
    // B1 (7-jul): PERO no si el cliente está a mitad de la captación de un
    // presupuesto nuevo — ahí "vale/ok/no" es su respuesta al bot, no una
    // decisión sobre el presupuesto viejo (evita aceptarlo/rechazarlo por error).
    if (text && parseDecision(text) !== 'unknown' && !(await isMidIntake(phone))) {
      const handled = await tryLegacyDecision(phone, from, text);
      if (handled) return;
    }
    const done = await handleBotMessage(from, input);
    if (done) return;
  }

  // Flag OFF (o bot no aplica) → comportamiento clásico
  if (text) await handleIncomingText(from, text);
}

// J3 (F1-build): procesar la baja del canal para TODOS los merchants que
// tengan este número como cliente. Bloqueo real en sendWhatsAppTemplate.
async function handleOptOutRequest(phone: string, from: string): Promise<void> {
  const customers = await prisma.customer.findMany({
    where: { phone: { in: [phone, `+${phone}`] } },
    select: { id: true, merchantId: true, name: true },
  });
  if (!customers.length) {
    // SCRUM-245: numero desconocido pidiendo la baja — no hay merchant al que atribuirlo.
    await sendWhatsAppText({
      sinMerchant: 'remitente-desconocido',
      to: from,
      text: 'Este número no tiene mensajes activos. No te enviaremos nada. 👋',
    });
    return;
  }
  await prisma.customer.updateMany({ where: { phone: { in: [phone, `+${phone}`] } }, data: { waOptOut: true } });
  await sendWhatsAppText({
    sinMerchant: 'multi-merchant', // SCRUM-245: la baja vale para TODOS sus negocios (customers.map)
    to: from,
    text: 'Hecho ✅ No te enviaremos más mensajes por WhatsApp. Si cambias de opinión, díselo a tu profesional.',
  });
  // Aviso a cada pro afectado (texto libre → fallback plantilla)
  const merchants = await prisma.merchant.findMany({
    where: { id: { in: [...new Set(customers.map((c) => c.merchantId))] } },
    select: { id: true, whatsappPhone: true },
  });
  for (const m of merchants) {
    const cust = customers.find((c) => c.merchantId === m.id);
    notifyMerchantAlert({
      merchantId: m.id,
      merchantPhone: m.whatsappPhone,
      customerName: cust?.name || 'Un cliente',
      action: 'se ha dado de baja de WhatsApp',
      detail: 'Escribió BAJA — no recibirá más mensajes',
      freeText: `🔕 *${cust?.name || 'Un cliente'}* se ha dado de baja de WhatsApp (escribió BAJA). No le llegarán más mensajes; puedes reactivarlo desde su ficha.`,
    }).catch(() => {});
  }
}

// SCRUM-50 (PIEZA 2): acuse de un quick-reply de PLANTILLA. Hoy el único es «👍 Recibido»
// (albaran_firmado_es): confirmamos con un gracias breve en la ventana ya abierta (0 €), sin
// menú genérico. Otros button-replies de plantilla se ignoran con elegancia hasta tener su copy.
async function handleTemplateButtonReply(from: string, btnText: string): Promise<void> {
  if (/recibido/i.test(btnText)) {
    await sendWhatsAppText({ to: from, text: '¡Gracias por confirmar! 🙌 Tu profesional ya lo sabe.' });
  }
}

// Decisión Acepto/No con exactamente UN presupuesto enviado (para el gate del
// bot). Devuelve true si la aplicó; false → que decida el menú del bot.
async function tryLegacyDecision(phone: string, from: string, text: string): Promise<boolean> {
  const customers = await prisma.customer.findMany({
    where: { phone: { in: [phone, `+${phone}`] } },
    select: { id: true },
  });
  if (!customers.length) return false;
  const pending = await prisma.quote.findMany({
    where: { customerId: { in: customers.map((c) => c.id) }, status: 'sent' },
    orderBy: { createdAt: 'desc' },
    take: 2,
  });
  if (pending.length !== 1) return false;
  await handleIncomingText(from, text); // reutiliza el flujo clásico completo
  return true;
}

// ── Lógica de decisión ────────────────────────────────────────────────────
type Decision = 'accept' | 'reject' | 'unknown';

function parseDecision(text: string): Decision {
  const t = text.toLowerCase().trim();
  // Rechazo primero (tiene prioridad ante "no gracias", "no me interesa")
  if (/\b(no|rechaz|cancel|paso|mejor no|no gracias|negativo|nel)\b/i.test(t)) return 'reject';
  if (/\b(acept|s[ií]|ok|okay|okey|dale|vale|confirm|adelante|de acuerdo|perfecto|me interesa|quiero|listo|va|sale|claro)\b/i.test(t)) return 'accept';
  return 'unknown';
}

async function handleIncomingText(from: string, text: string): Promise<void> {
  const phone = normalizePhone(from);
  if (!phone) return;

  console.log(`[WA in] from=${maskPhone(phone)} text="${text.slice(0, 80)}"`);

  // Buscar todos los customers con este número (cross-merchant)
  const customers = await prisma.customer.findMany({
    where: { phone: { in: [phone, `+${phone}`] } },
    select: { id: true, merchantId: true, name: true },
  });

  if (!customers.length) {
    await sendWhatsAppText({
      sinMerchant: 'remitente-desconocido', // SCRUM-245: el numero que escribe no es cliente de ningun negocio
      to: from,
      text: 'Hola 👋 No encontramos un presupuesto asociado a este número. Si te enviaron uno recientemente, ábrelo desde el enlace del mensaje.',
    });
    return;
  }

  // Quotes pendientes (status='sent') de cualquiera de estos customers
  const pending = await prisma.quote.findMany({
    where: {
      customerId: { in: customers.map((c) => c.id) },
      status: 'sent',
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (pending.length === 0) {
    // SCRUM-50 (PIEZA 3): si el cliente RECIBIÓ un albarán por WhatsApp hace poco y no tiene
    // presupuesto pendiente, este texto es su respuesta SOBRE el albarán → avisar al pro
    // (notifyMerchantAlert: window-first + guards completos) + acuse digno. JAMÁS el "no tienes
    // presupuestos" (respuesta errónea para quien pregunta por su albarán).
    const albaranMsg = await prisma.whatsAppMessage.findFirst({
      where: {
        customerId: { in: customers.map((c) => c.id) },
        relatedType: 'albaran',
        type: 'template',
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      select: { merchantId: true, customerId: true },
    }).catch(() => null);

    if (albaranMsg) {
      const cust = customers.find((c) => c.id === albaranMsg.customerId) || customers[0];
      const merchant = await prisma.merchant.findUnique({
        where: { id: albaranMsg.merchantId },
        select: { whatsappPhone: true },
      });
      const snippet = text.replace(/\s+/g, ' ').slice(0, 60); // {{3}} de la plantilla: sin saltos de línea
      notifyMerchantAlert({
        merchantId: albaranMsg.merchantId,
        merchantPhone: merchant?.whatsappPhone,
        customerName: cust?.name || 'Un cliente',
        action: 'te ha escrito sobre un albarán',
        detail: snippet,
        freeText: `💬 *${cust?.name || 'Un cliente'}* te ha escrito sobre un albarán: "${text.slice(0, 200)}". Respóndele desde tu WhatsApp o el panel.`,
      }).catch(() => {});
      await sendWhatsAppText({
        to: from,
        merchantId: albaranMsg.merchantId, // V0-2: demo solo a DEMO_SAFE_NUMBERS
        text: 'Gracias por tu mensaje 🙌 Se lo hemos pasado a tu profesional, que te responderá en breve.',
      });
      return;
    }

    await sendWhatsAppText({
      to: from,
      text: 'Hola 👋 No tienes presupuestos pendientes en este momento.',
    });
    return;
  }

  if (pending.length > 1) {
    await sendWhatsAppText({
      to: from,
      text: 'Tienes varios presupuestos pendientes. Para responder, por favor abre el enlace que te enviamos en cada uno.',
    });
    return;
  }

  const quote = pending[0];
  const decision = parseDecision(text);

  if (decision === 'unknown') {
    await sendWhatsAppText({
      merchantId: quote.merchantId,
      exentoDelDemo: 'respuesta-a-entrante', // SCRUM-245: responde a quien acaba de escribir
      to: from,
      text: `Para responder al presupuesto #${(quote as any).quoteNumber ?? quote.id}, escribe *Acepto* o *No*. También puedes firmarlo desde el enlace que te enviamos.`,
    });
    return;
  }

  if (decision === 'accept') {
    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
        rejectedAt: null,
        decisionChannel: 'whatsapp_text',
      },
    });

    // A13.1 (JOB-1): auto-creación del Trabajo al aceptar (idempotente)
    ensureJobForQuote(quote.id).catch(() => {});

    await sendWhatsAppText({
      merchantId: quote.merchantId,
      exentoDelDemo: 'respuesta-a-entrante', // SCRUM-245: responde a quien acaba de escribir
      to: from,
      text: `✅ ¡Perfecto! Hemos registrado tu aceptación del presupuesto #${(quote as any).quoteNumber ?? quote.id}. Te avisaremos con los siguientes pasos.`,
    });

    // Email al merchant si tiene la notificación activa
    const merchant = await prisma.merchant.findUnique({
      where: { id: quote.merchantId },
      select: { email: true, name: true, notifyEmailOnQuoteAccepted: true, whatsappPhone: true },
    });
    const customer = await prisma.customer.findUnique({
      where: { id: quote.customerId },
      select: { name: true },
    });

    if (merchant?.notifyEmailOnQuoteAccepted && merchant.email) {
      sendMerchantQuoteAcceptedEmail({
        merchantEmail: merchant.email,
        merchantName:  merchant.name || 'Tu negocio',
        customerName:  customer?.name || 'Cliente',
        quoteId:       quote.id,
        total:         Number(quote.total).toFixed(2),
        currency:      quote.currency,
      }).catch(() => {});
    }

    // WhatsApp al merchant
    const mPhone = normalizePhone(merchant?.whatsappPhone);
    if (mPhone) {
      sendWhatsAppText({
        to: mPhone,
        text: `✅ *${customer?.name || 'Cliente'}* aceptó el presupuesto #${(quote as any).quoteNumber ?? quote.id} (${formatMoneyEs(quote.total, quote.currency)}) por WhatsApp.`,
      }).catch(() => {});
    }
    return;
  }

  if (decision === 'reject') {
    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: 'rejected',
        rejectedAt: new Date(),
        decisionChannel: 'whatsapp_text',
      },
    });

    await sendWhatsAppText({
      merchantId: quote.merchantId,
      exentoDelDemo: 'respuesta-a-entrante', // SCRUM-245: responde a quien acaba de escribir
      to: from,
      text: `Hemos registrado tu rechazo del presupuesto #${(quote as any).quoteNumber ?? quote.id}. Gracias por avisar.`,
    });

    const merchant = await prisma.merchant.findUnique({
      where: { id: quote.merchantId },
      select: { whatsappPhone: true },
    });
    const customer = await prisma.customer.findUnique({
      where: { id: quote.customerId },
      select: { name: true },
    });
    const mPhone = normalizePhone(merchant?.whatsappPhone);
    if (mPhone) {
      sendWhatsAppText({
        to: mPhone,
        text: `❌ *${customer?.name || 'Cliente'}* rechazó el presupuesto #${(quote as any).quoteNumber ?? quote.id} por WhatsApp.`,
      }).catch(() => {});
    }
  }
}

export default router;
