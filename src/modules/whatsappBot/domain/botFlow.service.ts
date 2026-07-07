// src/modules/whatsappBot/domain/botFlow.service.ts
// BOT-1 (K1) — bot entrante SIN IA: botones y flujos cerrados.
// Flag: BOT_INBOUND_ENABLED (Parte P, default OFF). Todas las respuestas del
// bot son SERVICE MESSAGES (responden a un entrante → ventana abierta → coste 0);
// el bot JAMÁS inicia con plantilla.
//
// El bot NUNCA (K1, regla 30): da/negocia precios · promete plazos · modifica/
// acepta/rechaza presupuestos · responde dudas fiscales/legales · pide datos de
// pago · conversación libre (texto fuera de flujo → reenseñar menú; 2ª vez →
// handoff). Estados CERRADOS: menu|choosing_merchant|asking_description|
// asking_zone|confirming_request|done|handoff (regla 27).
//
// A18 (7-jul, cambio de master K1 aprobado por el fundador): la captación de
// "pedir presupuesto" ahora (1) VALIDA cada respuesta (no guarda saludos ni
// basura tipo "Zona: Hola"), (2) CONFIRMA con botones [✅ Enviar]/[✏️ Reescribir]
// antes de crear la solicitud, y (3) admite "cancelar" en cualquier paso.
import { prisma } from '../../../core/db/prisma';
import { BASE_URL } from '../../../core/config/env';
import { normalizePhone, formatMoneyEs } from '../../../core/utils/utils';
import { sendWhatsAppText, sendWhatsAppList, sendWhatsAppButtons, sendWhatsAppCtaUrl, sendWhatsAppLocationRequest, downloadWhatsAppMedia } from '../../../integrations/whatsapp';
import { notifyMerchantAlert } from '../../../integrations/whatsappNotifications';
import { recordCustomerEvent } from '../../system/customerEvents.service';
import { saveQuoteRequestPhoto } from '../../quoteRequests/domain/attachment.service';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // K1: expiresAt = +24h

export interface BotInput {
  /** Texto libre del mensaje (si type=text) */
  text?: string | null;
  /** id de la fila elegida en una lista interactiva (si type=interactive) */
  listReplyId?: string | null;
}

type SessionRow = {
  id: number;
  phone: string;
  merchantId: number | null;
  state: string;
  data: any;
  expiresAt: Date;
};

async function getSession(phone: string): Promise<SessionRow | null> {
  return prisma.botSession.findFirst({
    where: { phone, expiresAt: { gt: new Date() } },
    orderBy: { id: 'desc' },
  }) as any;
}

async function setSession(
  phone: string,
  patch: { merchantId?: number | null; state?: string; data?: any },
  existing?: SessionRow | null,
): Promise<SessionRow> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  if (existing) {
    return prisma.botSession.update({
      where: { id: existing.id },
      data: { ...patch, expiresAt },
    }) as any;
  }
  return prisma.botSession.create({
    data: {
      phone,
      merchantId: patch.merchantId ?? null,
      state: patch.state ?? 'menu',
      data: patch.data ?? {},
      expiresAt,
    },
  }) as any;
}

function merchantDisplayName(m: { legalName?: string | null; name?: string | null }): string {
  return m.legalName || m.name || 'el negocio';
}

// ── A18: validación mínima de la captación (sin IA, solo descartar basura) ──
// Saludos/cortesías sueltas que NO son ni una descripción ni una zona.
const GREETING_ONLY_RE = /^(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|men[uú]|opciones|hey|hi|hello|holi|gracias|ok|okay|okey|vale|s[ií]|no|👋)[\s!.,👋🙂🙋‍♂️🙋‍♀️]*$/iu;
// Petición explícita de abandonar el flujo.
const CANCEL_RE = /^(cancelar|cancela|salir|s[aá]lir|d[eé]jalo|dejarlo|olv[ií]dalo|olvida|nada|volver|atr[aá]s|men[uú])[\s!.]*$/iu;
// Respuestas de zona "sin zona concreta" que SÍ son válidas.
const NO_ZONE_RE = /^(no lo s[eé]|no s[eé]|a domicilio|domicilio|cualquiera|donde sea|indiferente)\b/i;

/** Nº de caracteres "útiles" (letras/números Unicode); ignora espacios/emojis/signos. */
function usefulLen(text: string): number {
  const m = (text || '').match(/[\p{L}\p{N}]/gu);
  return m ? m.length : 0;
}
function isGreetingOnly(text: string): boolean { return GREETING_ONLY_RE.test((text || '').trim()); }
function isCancel(text: string): boolean { return CANCEL_RE.test((text || '').trim()); }
/** Descripción válida = no es un saludo suelto y tiene algo de sustancia. */
function isValidDescription(text: string): boolean {
  return !isGreetingOnly(text) && usefulLen(text) >= 4;
}
/** Zona válida = "no lo sé"/"a domicilio", o algo que no sea un saludo suelto. */
function isValidZone(text: string): boolean {
  const t = (text || '').trim();
  if (NO_ZONE_RE.test(t)) return true;
  return !isGreetingOnly(text) && usefulLen(text) >= 2;
}

/**
 * B1 (7-jul): ¿el número está a mitad de la captación de presupuesto? El router
 * de entrantes lo usa para NO dejar que "vale/ok/no" dentro del flujo se
 * interprete como Acepto/No sobre un presupuesto enviado (secuestro de decisión).
 */
export async function isMidIntake(phone: string): Promise<boolean> {
  const p = normalizePhone(phone);
  if (!p) return false;
  const session = await getSession(p);
  const s = session?.state;
  return s === 'asking_description' || s === 'asking_zone' || s === 'confirming_request';
}

/** Botones de la confirmación (A18). Reutilizados al re-mostrar. */
const CONFIRM_BUTTONS = [
  { id: 'bot_confirm_send', title: '✅ Enviar' },
  { id: 'bot_confirm_edit', title: '✏️ Reescribir' },
];

/** Menú oficial K1 (lista) — copy v2 aprobado por el fundador (5-jul-2026). */
async function sendMenu(to: string, merchantId: number, businessName: string) {
  await sendWhatsAppList({
    to,
    merchantId,
    bodyText: `Hola 👋 Soy el asistente de ${businessName}. Dime qué necesitas:`,
    buttonText: 'Ver opciones',
    rows: [
      { id: 'bot_quotes', title: '📄 Mis presupuestos', description: 'Pendientes de ver o firmar' },
      { id: 'bot_pay', title: '💳 Pagar pendiente', description: 'Tus cobros abiertos, con enlace seguro' },
      { id: 'bot_request', title: '🛠 Pedir presupuesto', description: 'Te lo pido en 2 preguntas' },
      { id: 'bot_human', title: `💬 Hablar con ${businessName}`.slice(0, 24), description: 'Te escribirá personalmente' },
    ],
  });
}

/**
 * A8.2 (#15): mensaje NO soportado (audio, imagen, vídeo, documento, sticker,
 * ubicación…) → respuesta amable + menú si no hay un flujo a medias. El copy
 * es el oficial v2.1 (master K1). Nunca crashea: cualquier error se traga.
 */
export async function handleUnsupportedMedia(from: string): Promise<void> {
  try {
    const phone = normalizePhone(from);
    if (!phone) return;
    const session = await getSession(phone);
    if (session?.state === 'handoff') return; // mudo 24h también para media

    await sendWhatsAppText({
      to: from,
      text: '🙏 De momento solo entiendo texto. ¿Me lo escribes en un mensaje?',
    });

    // Menú solo si NO hay flujo a medias (en mitad de "pedir presupuesto" el
    // menú despistaría) y si sabemos con qué negocio habla.
    const midFlow = session?.state === 'asking_description' || session?.state === 'asking_zone';
    if (!midFlow && session?.merchantId) {
      const merchant = await prisma.merchant.findUnique({
        where: { id: session.merchantId },
        select: { id: true, name: true, legalName: true },
      });
      if (merchant) await sendMenu(from, merchant.id, merchantDisplayName(merchant));
    }
  } catch (err: any) {
    console.error('[bot] handleUnsupportedMedia:', err?.message || err);
  }
}

/**
 * MEDIA-1 (FASE 3): foto entrante → se adjunta a la solicitud de presupuesto
 * más reciente (<48 h) de ese cliente y se confirma. Si no hay solicitud
 * reciente (o falla la descarga), cae al mensaje amable de handleUnsupportedMedia.
 * Solo mensajes de servicio (responde a un entrante → ventana abierta → 0 €).
 */
export async function handleIncomingPhoto(from: string, mediaId: string): Promise<void> {
  try {
    const phone = normalizePhone(from);
    if (!phone || !mediaId) return;

    const session = await getSession(phone);
    if (session?.state === 'handoff') return; // mudo 24 h también para fotos

    // Clientes con este número (cross-merchant); si la sesión fija merchant, se prioriza.
    const customers = await prisma.customer.findMany({
      where: { phone: { in: [phone, `+${phone}`] } },
      select: { id: true },
    });
    if (!customers.length) { await handleUnsupportedMedia(from); return; }

    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const request = await prisma.quoteRequest.findFirst({
      where: {
        customerId: { in: customers.map((c) => c.id) },
        createdAt: { gte: since },
        ...(session?.merchantId ? { merchantId: session.merchantId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, merchantId: true },
    });
    if (!request) { await handleUnsupportedMedia(from); return; }

    const media = await downloadWhatsAppMedia(mediaId);
    if (!media || !String(media.mime).startsWith('image/')) { await handleUnsupportedMedia(from); return; }

    await saveQuoteRequestPhoto({
      merchantId: request.merchantId,
      quoteRequestId: request.id,
      buffer: media.buffer,
      mime: media.mime,
    });

    const merchant = await prisma.merchant.findUnique({
      where: { id: request.merchantId },
      select: { name: true, legalName: true },
    });
    const businessName = merchant ? merchantDisplayName(merchant) : 'tu profesional';
    await sendWhatsAppText({
      to: from,
      text: `📎 ¡Foto recibida! La he añadido a tu solicitud para que *${businessName}* la vea al preparar el presupuesto.`,
    });
  } catch (err: any) {
    console.error('[bot] handleIncomingPhoto:', err?.message || err);
    try { await handleUnsupportedMedia(from); } catch { /* best-effort */ }
  }
}

/**
 * Punto de entrada del bot. Devuelve true si el bot GESTIONÓ el mensaje
 * (el caller no debe hacer nada más); false si el bot no aplica.
 */
export async function handleBotMessage(from: string, input: BotInput): Promise<boolean> {
  const phone = normalizePhone(from);
  if (!phone) return false;

  const text = (input.text || '').trim();
  const listId = (input.listReplyId || '').trim();

  const session = await getSession(phone);

  // K1: handoff = bot MUDO 24h (el pro responde desde su número personal)
  if (session?.state === 'handoff') return true;

  // A8.2: doble tap del MISMO botón en <90 s → idempotente (se ignora en
  // silencio; la primera respuesta ya está en su chat). Un re-tap tardío
  // (minutos después) vuelve a responder con normalidad.
  if (listId && session?.data?.lastListId === listId) {
    const lastAt = Number(session.data?.lastListAt || 0);
    if (Date.now() - lastAt < 90_000) return true;
  }

  // ── Identidad (número COMPARTIDO entre merchants) ──────────────────────
  // Las fichas guardan el teléfono con o sin '+' según cómo se creó el
  // cliente; buscamos ambas variantes para no perder merchants (K1: si hay
  // varios, se pregunta con lista).
  const customers = await prisma.customer.findMany({
    where: { phone: { in: [phone, `+${phone}`] } },
    select: { id: true, merchantId: true, name: true },
  });

  if (!customers.length) {
    // K1: desconocido → respuesta única, SIN captura, fin (throttle 24h vía sesión)
    if (session?.state === 'done') return true;
    await sendWhatsAppText({
      to: from,
      text: '👋 Este número lo usan profesionales que trabajan con YaQu para enviar presupuestos y cobros a sus clientes. Si esperas un presupuesto, pídele a tu profesional que te lo mande por aquí.',
    });
    await setSession(phone, { state: 'done' }, session);
    return true;
  }

  const merchantIds = [...new Set(customers.map((c) => c.merchantId))];
  let merchantId = session?.merchantId ?? (merchantIds.length === 1 ? merchantIds[0] : null);

  // Varios negocios → elegir con lista (state choosing_merchant)
  if (!merchantId) {
    if (session?.state === 'choosing_merchant' && listId.startsWith('bot_m_')) {
      const chosen = Number(listId.slice('bot_m_'.length));
      if (merchantIds.includes(chosen)) {
        merchantId = chosen;
      }
    }
    if (!merchantId) {
      const merchants = await prisma.merchant.findMany({
        where: { id: { in: merchantIds } },
        select: { id: true, name: true, legalName: true, trade: true },
      });
      const TRADE_LABEL: Record<string, string> = {
        electricista: 'Electricista', fontanero: 'Fontanero', reformista: 'Reformas',
        pintor: 'Pintor', cerrajero: 'Cerrajero', climatizacion: 'Climatización',
      };
      await sendWhatsAppList({
        to: from,
        bodyText: '👋 Este número atiende a varios negocios. ¿Con cuál quieres hablar?',
        buttonText: 'Elegir negocio',
        rows: merchants.map((m) => ({
          id: `bot_m_${m.id}`,
          title: merchantDisplayName(m).slice(0, 24),
          ...(m.trade && TRADE_LABEL[m.trade] ? { description: TRADE_LABEL[m.trade] } : {}),
        })),
      });
      await setSession(phone, { state: 'choosing_merchant' }, session);
      return true;
    }
  }

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, name: true, legalName: true, whatsappPhone: true },
  });
  if (!merchant) return false;
  const businessName = merchantDisplayName(merchant);
  const customer = customers.find((c) => c.merchantId === merchantId) || customers[0];

  // ── Flujo "pedir presupuesto": describir → zona → CONFIRMAR (A18, K1) ───
  // Cancelar en cualquier paso vuelve al menú sin crear nada.
  const inIntake = session?.state === 'asking_description'
    || session?.state === 'asking_zone'
    || session?.state === 'confirming_request';
  if (inIntake && text && isCancel(text)) {
    await sendWhatsAppText({ to: from, text: 'Sin problema, lo dejamos 👍' });
    await sendMenu(from, merchantId, businessName);
    await setSession(phone, { merchantId, state: 'menu', data: { offMenuCount: 0 } }, session);
    return true;
  }

  // Paso 1: descripción — se VALIDA (no guardar saludos ni basura).
  if (session?.state === 'asking_description' && text) {
    if (!isValidDescription(text)) {
      await sendWhatsAppText({
        to: from,
        text: '🙂 ¿Me cuentas un poco más? Por ejemplo: "se me ha roto un grifo en la cocina y pierde agua".\n\n(o escribe *cancelar* para salir)',
      });
      return true; // seguimos en asking_description
    }
    await setSession(phone, {
      merchantId,
      state: 'asking_zone',
      data: { ...(session.data || {}), description: text.slice(0, 1000) },
    }, session);
    // A23: ofrecer compartir ubicación (botón) o escribir la zona. Si el interactivo
    // falla por lo que sea, cae a texto para no dejar al cliente sin pregunta.
    const locReq = await sendWhatsAppLocationRequest({
      to: from,
      merchantId,
      bodyText: '📍 ¿En qué zona está el trabajo? Comparte tu ubicación con el botón, o escribe el barrio o municipio (si no aplica, escribe "a domicilio").',
    });
    if (!locReq.ok) {
      await sendWhatsAppText({
        to: from,
        text: '📍 ¿En qué zona está el trabajo? (barrio o municipio). Si no aplica, escribe "a domicilio".',
      });
    }
    return true;
  }

  // Paso 2: zona — se VALIDA y se pasa a CONFIRMAR (no se crea aún).
  if (session?.state === 'asking_zone' && text) {
    if (!isValidZone(text)) {
      await sendWhatsAppText({
        to: from,
        text: '📍 Dime la zona (barrio o municipio), por ejemplo "Chamberí". Si no aplica, escribe "a domicilio".\n\n(o *cancelar*)',
      });
      return true; // seguimos en asking_zone
    }
    const description = String(session.data?.description || '').trim() || '(sin descripción)';
    const zone = text.slice(0, 120);
    await setSession(phone, {
      merchantId,
      state: 'confirming_request',
      data: { ...(session.data || {}), description, zone, lastListId: undefined, lastListAt: undefined },
    }, session);
    await sendWhatsAppButtons({
      to: from,
      merchantId,
      bodyText: `📋 Voy a enviar esto a ${businessName}:\n\n• Necesito: "${description}"\n• Zona: ${zone}\n\n¿Lo envío?`,
      buttons: CONFIRM_BUTTONS,
    });
    return true;
  }

  // Paso 3: confirmación — [✅ Enviar] crea la solicitud; [✏️ Reescribir] reinicia.
  if (session?.state === 'confirming_request') {
    const t = (text || '').trim().toLowerCase();
    const wantsSend = listId === 'bot_confirm_send'
      || /^(s[ií]|env[ií]a(?:r|lo|la)?|vale|ok(?:ay|ey)?|correcto|confirmo?|adelante|dale|perfecto)\b/.test(t);
    const wantsEdit = listId === 'bot_confirm_edit'
      || /^(no|edita(?:r|lo)?|reescrib|cambia(?:r|lo)?|corrige|corregir)\b/.test(t);

    if (wantsEdit) {
      await setSession(phone, {
        merchantId,
        state: 'asking_description',
        data: { ...(session.data || {}), description: undefined, zone: undefined, lastAction: 'request' },
      }, session);
      await sendWhatsAppText({ to: from, text: '✏️ Vale, empezamos de nuevo. Cuéntame qué necesitas.' });
      return true;
    }

    if (wantsSend) {
      const description = String(session.data?.description || '').trim() || '(sin descripción)';
      const zone = String(session.data?.zone || '').trim() || '(sin zona)';
      const request = await prisma.quoteRequest.create({
        data: {
          merchantId,
          customerId: customer.id,
          description,
          zone,
          source: 'whatsapp_bot', // K1
          status: 'pending',
        },
      });
      recordCustomerEvent({
        merchantId,
        customerId: customer.id,
        type: 'quote_requested',
        title: `Solicitud de presupuesto por WhatsApp (bot) #${request.id}`,
        detail: `${description.slice(0, 120)} · Zona: ${zone}`,
      });
      // Aviso al PRO con resumen + link al BO (texto libre → fallback plantilla)
      notifyMerchantAlert({
        merchantId,
        merchantPhone: merchant.whatsappPhone,
        customerName: customer.name || 'Un cliente',
        action: 'te ha pedido un presupuesto por WhatsApp',
        detail: `${description.slice(0, 80)} · Zona: ${zone}`,
        freeText:
          `🛠 *${customer.name || 'Un cliente'}* te ha pedido un presupuesto por WhatsApp:\n` +
          `"${description.slice(0, 300)}"\nZona: ${zone}`,
        cta: { text: 'Abrir en YaQu', url: `${BASE_URL}/dashboard/` },
      }).catch((e) => console.error('[bot] aviso solicitud:', e?.message || e));

      await sendWhatsAppText({
        to: from,
        text: `✅ ¡Listo! ${businessName} ya tiene tu solicitud y te responderá pronto con el presupuesto por aquí.`,
      });
      // lastListId marca el envío para que un re-tap inmediato sea idempotente (A8.2)
      await setSession(phone, { merchantId, state: 'done', data: { lastListId: 'bot_confirm_send', lastListAt: Date.now() } }, session);
      return true;
    }

    // Ni enviar ni reescribir ni cancelar → recordar los botones (sin crear nada).
    await sendWhatsAppButtons({
      to: from,
      merchantId,
      bodyText: 'Cuando quieras, elige una opción para tu solicitud 👇',
      buttons: CONFIRM_BUTTONS,
    });
    return true;
  }

  // ── Opciones del menú (respuesta de lista) ─────────────────────────────
  if (listId === 'bot_quotes') {
    const quotes = await prisma.quote.findMany({
      where: { customerId: customer.id, merchantId, status: 'sent' },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, quoteNumber: true, total: true, currency: true },
    });
    if (!quotes.length) {
      await sendWhatsAppText({
        to: from,
        text: `No tienes presupuestos pendientes con ${businessName}. Si necesitas uno nuevo, toca "🛠 Pedir presupuesto" en el menú 👇`,
      });
      await sendMenu(from, merchantId, businessName);
    } else {
      // A23: un botón-enlace "Ver y firmar" por presupuesto (sin URL cruda). Dinero es-ES.
      await sendWhatsAppText({
        to: from,
        text: quotes.length === 1
          ? `Esto tienes pendiente de decidir con *${businessName}* 👇`
          : `Tienes *${quotes.length}* presupuestos pendientes con *${businessName}* 👇`,
      });
      for (const q of quotes) {
        await sendWhatsAppCtaUrl({
          to: from,
          merchantId,
          bodyText: `📄 *Presupuesto #${q.quoteNumber ?? q.id}*\nTotal: *${formatMoneyEs(q.total, q.currency)}*`,
          buttonText: 'Ver y firmar',
          url: `${BASE_URL}/pay/quote/${q.id}`,
        });
      }
    }
    await setSession(phone, { merchantId, state: 'menu', data: { lastAction: 'quotes', lastListId: listId, lastListAt: Date.now() } }, session);
    return true;
  }

  if (listId === 'bot_pay') {
    const charges = await prisma.charge.findMany({
      where: { customerId: customer.id, merchantId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, amount: true, currency: true, concept: true },
    });
    if (!charges.length) {
      // A8.1: tras "estás al día", el menú — que la conversación nunca muera
      await sendWhatsAppText({ to: from, text: `🎉 ¡Estás al día! No tienes ningún pago pendiente con ${businessName}.` });
      await sendMenu(from, merchantId, businessName);
    } else {
      // A23: un botón-enlace "Pagar [importe]" por cobro (pago seguro y cifrado en la página).
      await sendWhatsAppText({
        to: from,
        text: charges.length === 1
          ? `Esto tienes pendiente de pago con *${businessName}* 👇`
          : `Tienes *${charges.length}* pagos pendientes con *${businessName}* 👇`,
      });
      for (const c of charges) {
        const amount = formatMoneyEs(c.amount, c.currency);
        await sendWhatsAppCtaUrl({
          to: from,
          merchantId,
          bodyText: `💳 *${amount}*${c.concept ? `\n${c.concept}` : ''}`,
          buttonText: `Pagar ${amount}`,
          url: `${BASE_URL}/pay/invoice/${c.id}`,
        });
      }
    }
    await setSession(phone, { merchantId, state: 'menu', data: { lastAction: 'pay', lastListId: listId, lastListAt: Date.now() } }, session);
    return true;
  }

  if (listId === 'bot_request') {
    await setSession(phone, { merchantId, state: 'asking_description', data: { lastAction: 'request', lastListId: listId, lastListAt: Date.now() } }, session);
    // Copy v2 (fundador 5-jul): sin invitar al audio hasta MEDIA-1, con ejemplo
    await sendWhatsAppText({
      to: from,
      text: '📝 Cuéntame qué necesitas — cuanto más detalle, mejor.\n\nPor ejemplo: "cambiar 3 enchufes y poner un foco en la cocina".',
    });
    return true;
  }

  if (listId === 'bot_human') {
    // A8.3/A8.1: CONTEXTO para el pro — en qué estaba el cliente al pedir humano
    const CONTEXT_LABEL: Record<string, string> = {
      quotes: 'estaba viendo sus presupuestos',
      pay: 'estaba mirando sus pagos pendientes',
      request: 'estaba pidiendo un presupuesto',
    };
    const context = CONTEXT_LABEL[String(session?.data?.lastAction || '')] || 'estaba en el menú';
    notifyMerchantAlert({
      merchantId,
      merchantPhone: merchant.whatsappPhone,
      customerName: customer.name || 'Un cliente',
      action: 'quiere hablar contigo por WhatsApp',
      detail: `Su número: +${phone}`,
      freeText:
        `💬 *${customer.name || 'Un cliente'}* (+${phone}) quiere hablar contigo.\n` +
        `Contexto: ${context}.\n` +
        `Escríbele desde tu número personal — el asistente queda en silencio 24 h.`,
    }).catch((e) => console.error('[bot] handoff aviso:', e?.message || e));
    await sendWhatsAppText({
      to: from,
      text: `✅ Hecho, le he avisado. ${businessName} te escribirá en cuanto pueda desde su número personal.`,
    });
    // A8.3: registro permanente en el timeline del cliente (las sesiones caducan a 24 h)
    recordCustomerEvent({
      merchantId,
      customerId: customer.id,
      type: 'handoff',
      title: '💬 Pidió hablar contigo por WhatsApp (bot)',
      detail: `Contexto: ${context}`,
    });
    await setSession(phone, { merchantId, state: 'handoff', data: { lastAction: session?.data?.lastAction } }, session);
    return true;
  }

  // ── A8.2 (#16/17): botón de un menú VIEJO o incoherente con el estado
  // (p. ej. un bot_m_* con negocio ya fijado, o un id que ya no existe) →
  // respuesta idempotente digna: menú fresco, sin contar como texto libre.
  if (listId) {
    await sendWhatsAppText({ to: from, text: 'Ese menú ya caducó — te dejo el de ahora 👇' });
    await sendMenu(from, merchantId, businessName);
    await setSession(phone, {
      merchantId,
      state: 'menu',
      data: { offMenuCount: Number(session?.data?.offMenuCount || 0), lastListId: listId, lastListAt: Date.now() },
    }, session);
    return true;
  }

  // ── Saludos: son una petición explícita de menú, NO "texto fuera de
  // flujo" (los clientes dicen "hola" siempre; sin esto, dos holas seguidos
  // disparaban el handoff K1 y el bot enmudecía 24h). Resetea el contador.
  if (/^(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|men[uú]|opciones|hey|hi|hello|empezar|inicio)[\s!.👋🙂🙋]*$/iu.test(text)) {
    await sendMenu(from, merchantId, businessName);
    await setSession(phone, { merchantId, state: 'menu', data: { offMenuCount: 0 } }, session);
    return true;
  }

  // ── Texto fuera de flujo (K1): reenseñar menú; 2ª vez → handoff ────────
  const offMenuCount = Number(session?.data?.offMenuCount || 0);
  if (offMenuCount >= 1) {
    notifyMerchantAlert({
      merchantId,
      merchantPhone: merchant.whatsappPhone,
      customerName: customer.name || 'Un cliente',
      action: 'te ha escrito por WhatsApp',
      detail: `"${text.slice(0, 80)}" · Su número: +${phone}`,
      freeText: `💬 *${customer.name || 'Un cliente'}* (+${phone}) te ha escrito: "${text.slice(0, 300)}".\nRespóndele desde tu número personal — el asistente queda en silencio 24 h.`,
    }).catch((e) => console.error('[bot] handoff 2ª vez:', e?.message || e));
    await sendWhatsAppText({
      to: from,
      text: `✅ Te paso con ${businessName}: le he avisado y te escribirá en cuanto pueda desde su número personal.`,
    });
    // A8.3: registro permanente en el timeline del cliente
    recordCustomerEvent({
      merchantId,
      customerId: customer.id,
      type: 'handoff',
      title: '💬 Te escribió por WhatsApp y pasó a humano (bot)',
      detail: `"${text.slice(0, 120)}"`,
    });
    await setSession(phone, { merchantId, state: 'handoff', data: { lastAction: session?.data?.lastAction } }, session);
    return true;
  }

  // 1ª vez: explicar con honestidad qué sabe hacer (sin precios/plazos, K1)
  await sendWhatsAppText({
    to: from,
    text: `🙈 Eso no lo sé responder — soy un asistente sencillo (los precios y los plazos te los da ${businessName}). Esto sí puedo hacerlo:`,
  });
  await sendMenu(from, merchantId, businessName);
  await setSession(phone, { merchantId, state: 'menu', data: { offMenuCount: offMenuCount + 1 } }, session);
  return true;
}
