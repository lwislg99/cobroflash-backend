// src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts
// Webhook entrante de WhatsApp Cloud API.
// GET  /webhooks/whatsapp  → verificación Meta (handshake hub.challenge)
// POST /webhooks/whatsapp  → mensajes entrantes (acepto/rechazo por texto libre)
import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../../../../core/db/prisma';
import { config } from '../../../../core/config/env';
import { normalizePhone } from '../../../../core/utils/utils';
import { sendWhatsAppText } from '../../../../integrations/whatsapp';
import { sendMerchantQuoteAcceptedEmail } from '../../../messaging/domain/merchantNotifications';

const router = Router();

// Valida la firma X-Hub-Signature-256 de Meta usando el App Secret.
// Si no hay WHATSAPP_APP_SECRET configurado, no validamos (devuelve true).
function isValidSignature(req: any): boolean {
  const secret = config.WHATSAPP_APP_SECRET;
  if (!secret) return true; // validación opcional hasta configurar el secret
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

  if (mode === 'subscribe' && token && token === config.WHATSAPP_VERIFY_TOKEN) {
    console.log('[WA webhook] Verified by Meta');
    return res.status(200).send(String(challenge ?? ''));
  }
  console.warn('[WA webhook] Verification failed', { mode, tokenMatches: token === config.WHATSAPP_VERIFY_TOKEN });
  return res.status(403).send('Forbidden');
});

// ── Mensajes entrantes ────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  // Validar firma de Meta antes de procesar (si hay App Secret configurado)
  if (!isValidSignature(req)) {
    console.warn('[WA webhook] Invalid X-Hub-Signature-256 — rejected');
    return res.status(401).send('invalid signature');
  }

  // ACK inmediato (Meta reintenta si tardamos >20s)
  res.status(200).send('OK');

  try {
    const entries = req.body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const messages = change?.value?.messages ?? [];
        for (const msg of messages) {
          if (msg.type !== 'text') continue;
          const from = String(msg.from || '');
          const text = String(msg.text?.body || '').trim();
          if (!from || !text) continue;
          handleIncomingText(from, text).catch((e) =>
            console.error('[WA in] handler error:', e?.message),
          );
        }
      }
    }
  } catch (err: any) {
    console.error('[WA webhook] Parse error:', err?.message);
  }
});

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

  console.log(`[WA in] from=${phone} text="${text.slice(0, 80)}"`);

  // Buscar todos los customers con este número (cross-merchant)
  const customers = await prisma.customer.findMany({
    where: { phone },
    select: { id: true, merchantId: true, name: true },
  });

  if (!customers.length) {
    await sendWhatsAppText({
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
      to: from,
      text: `Para responder al presupuesto #${quote.id}, escribe *Acepto* o *No*. También puedes firmarlo desde el enlace que te enviamos.`,
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

    await sendWhatsAppText({
      to: from,
      text: `✅ ¡Perfecto! Hemos registrado tu aceptación del presupuesto #${quote.id}. Te avisaremos con los siguientes pasos.`,
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
        text: `✅ *${customer?.name || 'Cliente'}* aceptó el presupuesto #${quote.id} (${Number(quote.total).toFixed(2)} ${quote.currency}) por WhatsApp.`,
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
      to: from,
      text: `Hemos registrado tu rechazo del presupuesto #${quote.id}. Gracias por avisar.`,
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
        text: `❌ *${customer?.name || 'Cliente'}* rechazó el presupuesto #${quote.id} por WhatsApp.`,
      }).catch(() => {});
    }
  }
}

export default router;
