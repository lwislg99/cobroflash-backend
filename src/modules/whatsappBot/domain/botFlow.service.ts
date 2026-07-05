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
import { normalizePhone, formatMoneyEs } from '../../../core/utils/utils';
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

  // ── Flujo "pedir presupuesto": 2 preguntas, una a una (K1) ─────────────
  if (session?.state === 'asking_description' && text) {
    await setSession(phone, {
      merchantId,
      state: 'asking_zone',
      data: { ...(session.data || {}), description: text.slice(0, 1000) },
    }, session);
    await sendWhatsAppText({ to: from, text: '📍 ¿En qué zona está el trabajo? (barrio o municipio)' });
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
      text: `✅ ¡Listo! ${businessName} ya tiene tu solicitud y te responderá pronto con el presupuesto por aquí.`,
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
        text: `No tienes presupuestos pendientes con ${businessName}. Si necesitas uno nuevo, toca "🛠 Pedir presupuesto" en el menú 👇`,
      });
      await sendMenu(from, merchantId, businessName);
    } else {
      // A8.1: dinero SIEMPRE en formato es-ES ("2.383,70 €"), nunca "2383.70 EUR"
      const lines = quotes.map((q) =>
        `📄 *Presupuesto #${q.quoteNumber ?? q.id}* · ${formatMoneyEs(q.total, q.currency)}\n👉 Ver y firmar: ${BASE_URL}/pay/quote/${q.id}`,
      );
      await sendWhatsAppText({
        to: from,
        text: `Esto es lo que tienes pendiente de decidir con ${businessName}:\n\n${lines.join('\n\n')}`,
      });
    }
    await setSession(phone, { merchantId, state: 'menu', data: { lastAction: 'quotes' } }, session);
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
      // A8.1: dinero es-ES + cierre honesto (los métodos concretos los decide
      // su página de pago — no prometer tarjeta si el merchant no la tiene)
      const lines = charges.map((c) =>
        `💳 *${formatMoneyEs(c.amount, c.currency)}*${c.concept ? ` · ${c.concept}` : ''}\n👉 Pagar seguro: ${BASE_URL}/pay/invoice/${c.id}`,
      );
      await sendWhatsAppText({
        to: from,
        text: `Esto es lo que tienes pendiente con ${businessName}:\n\n${lines.join('\n\n')}\n\nPagas desde el enlace, con pago seguro y cifrado.`,
      });
    }
    await setSession(phone, { merchantId, state: 'menu', data: { lastAction: 'pay' } }, session);
    return true;
  }

  if (listId === 'bot_request') {
    await setSession(phone, { merchantId, state: 'asking_description', data: { lastAction: 'request' } }, session);
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
    await setSession(phone, { merchantId, state: 'handoff', data: {} }, session);
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
    await setSession(phone, { merchantId, state: 'handoff', data: {} }, session);
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
