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
// asking_zone|done|handoff (regla 27).
import { prisma } from '../../../core/db/prisma';
import { BASE_URL } from '../../../core/config/env';
import { normalizePhone } from '../../../core/utils/utils';
import { sendWhatsAppText, sendWhatsAppList } from '../../../integrations/whatsapp';
import { notifyMerchantAlert } from '../../../integrations/whatsappNotifications';
import { recordCustomerEvent } from '../../system/customerEvents.service';

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

/** Menú oficial K1 (lista): Ver presupuestos · Pagar pendiente · Pedir presupuesto · Hablar con [Negocio]. */
async function sendMenu(to: string, merchantId: number, businessName: string) {
  await sendWhatsAppList({
    to,
    merchantId,
    bodyText: `Hola 👋 Soy el asistente de ${businessName}. ¿Qué necesitas?`,
    buttonText: 'Ver opciones',
    rows: [
      { id: 'bot_quotes', title: '📄 Ver mis presupuestos' },
      { id: 'bot_pay', title: '💳 Pagar pendiente' },
      { id: 'bot_request', title: '🛠 Pedir presupuesto' },
      { id: 'bot_human', title: `💬 Hablar con ${businessName}`.slice(0, 24) },
    ],
  });
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

  // ── Identidad (número COMPARTIDO entre merchants) ──────────────────────
  const customers = await prisma.customer.findMany({
    where: { phone },
    select: { id: true, merchantId: true, name: true },
  });

  if (!customers.length) {
    // K1: desconocido → respuesta única, SIN captura, fin (throttle 24h vía sesión)
    if (session?.state === 'done') return true;
    await sendWhatsAppText({
      to: from,
      text: 'Este número envía presupuestos y facturas de negocios que usan YaQu. Si esperas un presupuesto, pídele a tu profesional que te lo envíe por aquí. 👋',
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
        select: { id: true, name: true, legalName: true },
      });
      await sendWhatsAppList({
        to: from,
        bodyText: '¿Con qué negocio quieres hablar?',
        buttonText: 'Elegir negocio',
        rows: merchants.map((m) => ({ id: `bot_m_${m.id}`, title: merchantDisplayName(m).slice(0, 24) })),
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

  // ── Flujo "pedir presupuesto": 2 preguntas, una a una (K1) ─────────────
  if (session?.state === 'asking_description' && text) {
    await setSession(phone, {
      merchantId,
      state: 'asking_zone',
      data: { ...(session.data || {}), description: text.slice(0, 1000) },
    }, session);
    await sendWhatsAppText({ to: from, text: '¿Zona aproximada? (barrio o municipio)' });
    return true;
  }

  if (session?.state === 'asking_zone' && text) {
    const description = String(session.data?.description || '').trim() || '(sin descripción)';
    const zone = text.slice(0, 120);
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
        `"${description.slice(0, 300)}"\nZona: ${zone}\n\nRevísalo en Solicitudes: ${BASE_URL}/dashboard/`,
    }).catch((e) => console.error('[bot] aviso solicitud:', e?.message || e));

    await sendWhatsAppText({
      to: from,
      text: `✅ ¡Pedido! ${businessName} ha recibido tu solicitud y te responderá con el presupuesto.`,
    });
    await setSession(phone, { merchantId, state: 'done', data: {} }, session);
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
        text: 'No tienes presupuestos pendientes ahora mismo. Si necesitas uno nuevo, elige "🛠 Pedir presupuesto" en el menú.',
      });
      await sendMenu(from, merchantId, businessName);
    } else {
      const lines = quotes.map((q) =>
        `📄 Presupuesto #${q.quoteNumber ?? q.id} · ${Number(q.total).toFixed(2)} ${q.currency}\n${BASE_URL}/pay/quote/${q.id}`,
      );
      await sendWhatsAppText({
        to: from,
        text: `Tus presupuestos pendientes:\n\n${lines.join('\n\n')}\n\nÁbrelos para verlos y firmarlos.`,
      });
    }
    await setSession(phone, { merchantId, state: 'menu', data: {} }, session);
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
      await sendWhatsAppText({ to: from, text: '🎉 No tienes pagos pendientes con este negocio.' });
    } else {
      const lines = charges.map((c) =>
        `💳 ${Number(c.amount).toFixed(2)} ${c.currency}${c.concept ? ` · ${c.concept}` : ''}\n${BASE_URL}/pay/invoice/${c.id}`,
      );
      await sendWhatsAppText({ to: from, text: `Tus pagos pendientes:\n\n${lines.join('\n\n')}` });
    }
    await setSession(phone, { merchantId, state: 'menu', data: {} }, session);
    return true;
  }

  if (listId === 'bot_request') {
    await setSession(phone, { merchantId, state: 'asking_description', data: {} }, session);
    // Copy oficial K1
    await sendWhatsAppText({ to: from, text: '¿Qué necesitas? Puedes mandar audio.' });
    return true;
  }

  if (listId === 'bot_human') {
    notifyMerchantAlert({
      merchantId,
      merchantPhone: merchant.whatsappPhone,
      customerName: customer.name || 'Un cliente',
      action: 'quiere hablar contigo por WhatsApp',
      detail: `Su número: +${phone}`,
      freeText: `💬 *${customer.name || 'Un cliente'}* (+${phone}) quiere hablar contigo. Escríbele desde tu número personal.`,
    }).catch((e) => console.error('[bot] handoff aviso:', e?.message || e));
    // Copy oficial K1
    await sendWhatsAppText({
      to: from,
      text: `✅ Avisado. ${businessName} te escribirá desde su número personal.`,
    });
    await setSession(phone, { merchantId, state: 'handoff', data: {} }, session);
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
      freeText: `💬 *${customer.name || 'Un cliente'}* (+${phone}) te ha escrito: "${text.slice(0, 300)}". Respóndele desde tu número personal.`,
    }).catch((e) => console.error('[bot] handoff 2ª vez:', e?.message || e));
    await sendWhatsAppText({
      to: from,
      text: `✅ Avisado. ${businessName} te escribirá desde su número personal.`,
    });
    await setSession(phone, { merchantId, state: 'handoff', data: {} }, session);
    return true;
  }

  await sendMenu(from, merchantId, businessName);
  await setSession(phone, { merchantId, state: 'menu', data: { offMenuCount: offMenuCount + 1 } }, session);
  return true;
}
