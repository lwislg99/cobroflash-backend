// src/modules/billing/app/routes/mpWebhook.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { config } from '../../../../core/config/env';
import { verifyMpWebhookSignature, getMpPayment } from '../../../../integrations/mercadopago';
import { ensureInvoiceForCharge, ensureChargeReceiptToken } from '../../../../lib/invoicing';
import { sendInvoiceEmail } from '../../../../lib/email';
import { normalizePhone } from '../../../../core/utils/utils';
import { sendWhatsAppCtaUrl } from '../../../../integrations/whatsapp';
import { sendPaymentConfirmationInvoice, notifyMerchantPaid } from '../../../../integrations/whatsappNotifications';
import { recordCustomerEvent } from '../../../system/customerEvents.service';
import { isReceiptNumber } from '../../../invoicing/domain/invoiceNumber.service';
import { recalcJobCobradoForCharge } from '../../../jobs/domain/job.service'; // SCRUM-13
import { datosDeCobroPagado } from '../../domain/instanteDeCobro'; // SCRUM-397
// SCRUM-502: la guarda de anulada se CONSUME de donde vive, no se reescribe aqui.
import { puedeCobrarPorPasarela } from '../../../system/invoiceAdmin';

const router = Router();

// SCRUM-99/100: FAIL-CLOSED — el secreto es obligatorio, mismo patrón que /webhooks/stripe.
// Extraída (SCRUM-100) para poder testear el guard sin BD: /webhooks/mp responde 200 a MP
// SIEMPRE de inmediato (para evitar reintentos, antes de validar nada — ver el handler), así
// que el status HTTP nunca distingue "rechazado" de "procesado"; esta función sí lo hace.
export function checkMpWebhookAuth(params: {
  xSignature: string;
  xRequestId: string;
  dataId: string;
  secret: string;
}): 'no-secret' | 'invalid' | 'ok' {
  if (!params.secret) return 'no-secret';
  const valid = verifyMpWebhookSignature(params);
  return valid ? 'ok' : 'invalid';
}

/**
 * POST /webhooks/mp
 * IPN de Mercado Pago: recibe notificaciones de pagos.
 * Docs: https://www.mercadopago.com.mx/developers/es/docs/your-integrations/notifications/webhooks
 */
router.post('/', async (req, res) => {
  // Responder 200 inmediatamente para evitar reintentos de MP mientras procesamos
  res.status(200).json({ ok: true });

  try {
    const body = req.body;

    // Solo nos interesan eventos de tipo 'payment'
    if (body?.type !== 'payment' || !body?.data?.id) {
      console.log('[mpWebhook] Evento ignorado:', body?.type);
      return;
    }

    const mpPaymentId = String(body.data.id);
    const xSignature  = String(req.headers['x-signature'] || '');
    const xRequestId  = String(req.headers['x-request-id'] || '');

    // Antes de SCRUM-99: sin MP_WEBHOOK_SECRET, se procesaba el payload SIN verificar
    // (fail-open) — cualquiera podía marcar un cobro como pagado sin haber pagado.
    const authResult = checkMpWebhookAuth({ xSignature, xRequestId, dataId: mpPaymentId, secret: config.MP_WEBHOOK_SECRET });
    if (authResult === 'no-secret') {
      console.error('🚨 [mpWebhook] MP_WEBHOOK_SECRET no configurado — payload RECHAZADO (fail-closed). Configúralo en Railway.');
      return;
    }
    if (authResult === 'invalid') {
      console.error('[mpWebhook] Firma inválida — payload ignorado');
      return;
    }

    // Obtener detalles del pago desde la API de MP
    const accessToken = config.MP_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('[mpWebhook] MP_ACCESS_TOKEN no configurado');
      return;
    }

    let payment;
    try {
      payment = await getMpPayment(mpPaymentId, accessToken);
    } catch (e: any) {
      console.error('[mpWebhook] Error consultando pago MP:', e?.response?.data || e?.message);
      return;
    }

    // Extraer chargeId desde external_reference = "charge_<id>"
    const match = payment.externalReference.match(/^charge_(\d+)$/);
    if (!match) {
      console.warn('[mpWebhook] external_reference no reconocida:', payment.externalReference);
      return;
    }
    const chargeId = Number(match[1]);

    const charge = await prisma.charge.findUnique({ where: { id: chargeId } });
    if (!charge) {
      console.warn('[mpWebhook] Charge no encontrado:', chargeId);
      return;
    }

    // Mapear estado de MP a estado interno
    const mpStatus = payment.status;

    if (mpStatus === 'approved' && charge.status !== 'paid') {
      // SCRUM-397 · el mismo generador que `/webhooks/psp`: columna y evento con UN solo instante.
      // Aquí no hay fecha declarada —lo confirma Mercado Pago, no una persona—, así que el
      // instante es el de proceso, que es lo correcto para un aviso automático.
      const updated = await prisma.charge.update({
        where: { id: chargeId },
        data: {
          ...datosDeCobroPagado(new Date(), { mp_payment_id: mpPaymentId, mp_status: mpStatus, ...payment }),
          // SCRUM-489 · aquí se escribía `'mp'` a fuego, y `'mp'` NO está en `PAID_VIA`. No era una
          // preferencia: es el `update` que marca el cobro como PAGADO, así que el `paid_via` que
          // quedaba registrado era falso — la familia de SCRUM-191, sobre la columna que viaja al
          // CSV del asesor fiscal.
          //
          // 🔴 Y no hace falta traductor nuevo: `getMpPayment()` (arriba) YA devuelve el método
          // traducido al vocabulario de la casa. SCRUM-474 arregló el TRADUCTOR y no a su
          // CONSUMIDOR, así que llevaba desde entonces devolviendo el valor bueno para que nadie lo
          // mirara. Esto solo deja de tirarlo.
          //
          // El caso difícil ya lo resuelve él: si MercadoPago manda un `payment_type_id` que no
          // conocemos —o no lo manda—, devuelve el DESCONOCIDO DECLARADO. Decir que no consta, no
          // adivinar; y aquí pesa más que en ningún otro sitio porque el cobro ya está cerrado.
          method: payment.method,
          reference: mpPaymentId,
          reconciliations: {
            create: { bankRef: mpPaymentId, matched: true },
          },
        },
        include: { customer: true, merchant: true },
      });

      // Factura automática
      let invoiceId: number | null = null;
      // SCRUM-502 · el estado, para la guarda de anulada. `ensureInvoiceForCharge` puede devolver
      // una factura EXISTENTE (busca por el evento `invoiced` y por `quoteId`, sin filtro de
      // estado), asi que lo que llega aqui puede estar anulado.
      let invoiceEstado: string | null = null;
      if (config.AUTO_INVOICE_ON_PAID) {
        try {
          const inv = await ensureInvoiceForCharge(chargeId, prisma);
          invoiceId = inv.id;
          invoiceEstado = (inv as { status?: string }).status ?? null;

          // P0-4: email SIEMPRE (sendInvoiceEmail genera el PDF si falta y envía por Resend)
          if (config.AUTO_EMAIL_INVOICE_ON_PAID && updated.customer?.email) {
            await sendInvoiceEmail({
              invoiceId: inv.id,
              toEmail: updated.customer.email,
              toName: updated.customer.name ?? '',
              prisma,
            }).catch((e) => console.error('[mpWebhook] email error:', e));
          }
        } catch (e) {
          console.error('[mpWebhook] auto-invoice error:', e);
        }
      }

      // 🔴 SCRUM-502 · UNA ANULADA NO VUELVE. Esta puerta actualizaba por `id` sin mirar el estado.
      // ⚠️ El `.catch(() => {})` de abajo se traga el fallo de escritura y NO se toca en esta tanda:
      // es otro defecto, esta reportado, y una cosa por tanda.
      if (invoiceId && puedeCobrarPorPasarela({ status: invoiceEstado ?? '' })) {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: { status: 'paid', paidAt: new Date() },
        }).catch(() => {});
      }

      // Confirmación de pago al cliente (J1: payment_confirmation_invoice_es, con botón
      // "Ver documento" → /recibo/:token; copy neutro factura/justificante).
      const merchant = updated.merchant as any;
      const amt = Number(updated.amount).toFixed(2);
      const cur = updated.currency;
      const invConf = invoiceId
        ? await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { number: true } }).catch(() => null)
        : null;
      const documentNumber = invConf?.number || String(updated.id);   // P1-6: sin '#'
      if (updated.customer?.phone) {
        // SCRUM-74: token OPACO del recibo público, NUNCA el chargeId (IDOR/RGPD).
        const receiptToken = await ensureChargeReceiptToken(updated.id, prisma);
        sendPaymentConfirmationInvoice({
          toPhone: updated.customer.phone,
          customerName: updated.customer.name,
          merchantId: updated.merchantId, // J3: respeta waOptOut
          customerId: updated.customerId ?? undefined, // A5.3: vía ventana (0 €) si hay entrante <24 h
          amountWithCurrency: `${amt} ${cur}`,
          documentNumber,
          businessName: merchant?.legalName || merchant?.name,     // P1-7
          chargeId: updated.id, // log interno (WhatsAppMessage.relatedId), NO la URL pública
          receiptToken, // botón "Ver documento" → /recibo/:token
        }).catch(() => {});

        // ENT-3: historial
        recordCustomerEvent({
          merchantId: updated.merchantId,
          customerId: updated.customerId,
          type: 'payment_received',
          title: 'Pago recibido (Mercado Pago)',
          detail: `${Number(updated.amount).toFixed(2)} ${updated.currency}${invConf?.number ? ` · ${isReceiptNumber(invConf.number) ? 'Justificante' : 'Factura'} ${invConf.number}` : ''}`,
        });
      }

      // Notificaciones WhatsApp al merchant y reseña al cliente
      if (merchant?.googleReviewUrl && updated.customer?.phone) {
        const phone = normalizePhone(updated.customer.phone);
        if (phone) {
          sendWhatsAppCtaUrl({
            to: phone,
            merchantId: updated.merchantId, // V0-2: demo solo a DEMO_SAFE_NUMBERS
            bodyText: `¡Gracias por confiar en *${merchant.name}*, ${updated.customer.name || 'Cliente'}! 🙏\n¿Nos dejas una reseña en Google? Solo te lleva 10 segundos y nos ayuda muchísimo ⭐`,
            buttonText: '⭐ Dejar reseña',
            url: merchant.googleReviewUrl,
            // SCRUM-227: deja rastro consultable de la reseña (relatedType 'review', no 'charge')
            log: { customerId: updated.customer?.id ?? null, relatedType: 'review', relatedId: updated.id },
            // SCRUM-227: el fallo se registra (dentro de sendWhatsAppCtaUrl) y aquí se LOGUEA en vez
            // de tragarse — pero NO se relanza: un throw reventaría el webhook y el PSP reintentaría el cobro.
          }).catch((err) => console.error('[review] Error enviando reseña:', err?.message));
        }
      }

      // Aviso al PRO (J1: texto libre con ventana 24 h abierta; si no, fallback merchant_alert_es).
      {
        const customerName = updated.customer?.name || 'Un cliente';
        notifyMerchantPaid({
          merchantId: updated.merchantId, // V0-2 + J3 reaplicados dentro
          merchantPhone: merchant?.whatsappPhone,
          customerName,
          freeText: `💰 Pago recibido (Mercado Pago) de ${customerName}: ${payment.amount} ${payment.currency}`,
          detail: `${amt} ${cur}${documentNumber ? ` · ${documentNumber}` : ''}`,
        }).catch(() => {});
      }

      console.log(`[mpWebhook] Charge ${chargeId} marcado como pagado (MP ${mpPaymentId})`);

      // SCRUM-13 (COBROS-1): igual que en /webhooks/psp — recálculo del Job.totalCobrado
      // (suma desde cero) AÑADIDO al final, fire-and-forget; la cadena de arriba NO se toca.
      recalcJobCobradoForCharge(updated.id).catch((e) => console.error('[mpWebhook] SCRUM-13 recalc totalCobrado:', e?.message || e));
    } else if (['rejected', 'cancelled'].includes(mpStatus) && charge.status === 'pending') {
      await prisma.charge.update({
        where: { id: chargeId },
        data: {
          status: 'failed',
          events: { create: { type: 'failed', payload: { mp_payment_id: mpPaymentId, mp_status: mpStatus } as any } },
        },
      });
      console.log(`[mpWebhook] Charge ${chargeId} marcado como fallido (MP status: ${mpStatus})`);
    } else {
      console.log(`[mpWebhook] Estado MP '${mpStatus}' para charge ${chargeId} (ya en '${charge.status}') — sin cambios`);
    }
  } catch (err) {
    console.error('[mpWebhook] Error inesperado:', (err as any)?.message || 'error desconocido'); // SCRUM-105
  }
});

export default router;
