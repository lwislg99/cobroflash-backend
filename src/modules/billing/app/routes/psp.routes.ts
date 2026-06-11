// srcNew/modules/billing/app/routes/psp.routes.ts
// src/modules/billing/app/routes/psp.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { PSPWebhookSchema } from '../../../../core/validation/schemas';
import { ensureInvoiceForCharge } from '../../../../lib/invoicing';
import { sendInvoiceEmail } from '../../../../lib/email';
import { normalizePhone } from '../../../../core/utils/utils';
import { config } from '../../../../core/config/env';
import { sendWhatsAppText } from '../../../../integrations/whatsapp';
import { sendPaymentConfirmation } from '../../../../integrations/whatsappNotifications';
import { recordCustomerEvent } from '../../../system/customerEvents.service';
import { sendMerchantPaymentEmail } from '../../../messaging/domain/merchantNotifications';


const router = Router();

router.post('/', async (req, res) => {
  try {
    const body = PSPWebhookSchema.parse(req.body);
    const chargeId =
      typeof body.charge_id === 'number' ? body.charge_id : Number(body.charge_id);
    if (!Number.isInteger(chargeId)) {
      return res.status(400).json({ error: 'invalid_charge_id' });
    }

    const charge = await prisma.charge.findUnique({ where: { id: chargeId } });
    if (!charge) return res.status(404).json({ error: 'charge_not_found' });

    if (charge.status === 'paid' && body.event === 'payment.confirmed') {
      await prisma.event.create({
        data: {
          chargeId,
          type: 'paid',
          payload: { duplicate: true, body } as any,
        },
      });
    
      if (config.AUTO_INVOICE_ON_PAID) {
        try {
          const inv = await ensureInvoiceForCharge(chargeId, prisma);
    
          // Solo enviamos email si hay PDF real
          const hasRealPdf =
            !!inv.pdfUrl && inv.pdfUrl !== 'PENDING_PDF' && inv.pdfUrl !== '';
    
          if (
            hasRealPdf &&
            config.AUTO_EMAIL_INVOICE_ON_PAID &&
            charge.customerId
          ) {
            const cust = await prisma.customer.findUnique({
              where: { id: charge.customerId },
            });
            if (cust?.email) {
              await sendInvoiceEmail({
                invoiceId: inv.id,
                toEmail: cust.email,
                toName: cust.name ?? '',
                prisma,
              });
            }
          }
        } catch (e) {
          console.error('auto-invoice/error duplicate', e);
        }
      }
    
      return res.json({ ok: true, status: 'already_paid' });
    }
    

    if (
      (charge.status === 'failed' && body.event === 'payment.failed') ||
      (charge.status === 'expired' && body.event === 'payment.expired')
    ) {
      return res.json({ ok: true, status: `already_${charge.status}` });
    }

    if (body.event === 'payment.confirmed') {
      const updated = await prisma.charge.update({
        where: { id: chargeId },
        data: {
          status: 'paid',
          method: body.method ?? charge.method,
          reference: body.bank_ref ?? charge.reference,
          events: { create: { type: 'paid', payload: body as any } },
          reconciliations: {
            create: { bankRef: body.bank_ref ?? 'n/a', matched: true },
          },
        },
        include: { customer: true },
      });

      // P0-3: marcar la factura como PAGADA de forma ROBUSTA, independiente de la
      // generación del PDF. Antes solo se marcaba si ensureInvoiceForCharge() devolvía
      // un invoiceId, pero esa función genera el PDF y, si falla (ver P0-2), lanzaba y
      // la factura se quedaba en PENDIENTE aunque el cobro estuviera pagado. La factura
      // se localiza por chargeId directo o vía el presupuesto ligado al cobro.
      let paidInvoiceNumber: string | null = null;   // nº de factura real para la confirmación (P1-6)
      try {
        const linkedQuote = await prisma.quote.findFirst({
          where: { chargeId: updated.id },
          select: { id: true },
        });
        const linkedInvoice = await prisma.invoice.findFirst({
          where: {
            OR: [
              { chargeId: updated.id },
              ...(linkedQuote ? [{ quoteId: linkedQuote.id }] : []),
            ],
          },
          select: { id: true, number: true },
        });
        if (linkedInvoice) {
          paidInvoiceNumber = linkedInvoice.number;
          await prisma.invoice.update({
            where: { id: linkedInvoice.id },
            data: { status: 'paid', paidAt: new Date() },
          });
        }
      } catch (e) {
        console.error('[psp] P0-3 marcar factura pagada (robusto) error', e);
      }

      // 👇 NUEVO: intentamos emitir / asegurar la factura
        // 👇 NUEVO: intentamos emitir / asegurar la factura
  let invoiceId: number | null = null;

  if (config.AUTO_INVOICE_ON_PAID) {
    try {
      const inv = await ensureInvoiceForCharge(updated.id, prisma);
      invoiceId = inv.id;

      // P0-4: enviar el email de la factura SIEMPRE (sendInvoiceEmail genera el
      // PDF bajo demanda si falta y envía por Resend con adjunto). Antes se
      // exigía un PDF "real" y, como la generación se quedaba en PENDING, el
      // email no salía nunca.
      if (config.AUTO_EMAIL_INVOICE_ON_PAID && updated.customer?.email) {
        try {
          await sendInvoiceEmail({
            invoiceId: inv.id,
            toEmail: updated.customer.email,
            toName: updated.customer.name ?? '',
            prisma,
          });
        } catch (e) {
          console.error('auto-email error', e);
        }
      }
    } catch (e) {
      console.error('auto-invoice error', e);
    }
  }


        // 👇 NUEVO: si hemos conseguido una factura, la marcamos como PAGADA
        if (invoiceId) {
          try {
            await prisma.invoice.update({
              where: { id: invoiceId },
              data: {
                status: 'paid',
                // solo ponemos paidAt si no lo tenía aún, para que sea idempotente
                paidAt: new Date(),
              },
            });
          } catch (e) {
            console.error('auto-mark invoice paid error', e);
          }
        }
  
      
      

      // Cargar merchant para notificaciones
      const merchant = await prisma.merchant.findUnique({
        where: { id: updated.merchantId },
        select: { whatsappPhone: true, googleReviewUrl: true, name: true, legalName: true, email: true, notifyEmailOnPaid: true },
      });

      // Confirmación de pago al cliente por WhatsApp (payment_confirmation_es, fire-and-forget)
      if (updated.customer?.phone) {
        const invConf = invoiceId
          ? await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { number: true } }).catch(() => null)
          : null;
        const amt = Number(body.amount ?? updated.amount).toFixed(2);
        const cur = body.currency ?? updated.currency;
        sendPaymentConfirmation({
          toPhone: updated.customer.phone,
          customerName: updated.customer.name,
          merchantId: updated.merchantId, // J3: respeta waOptOut
          amountWithCurrency: `${amt} ${cur}`,
          // P1-6: nº de factura REAL (sin '#'; la plantilla ya antepone "#") — no el id del cobro.
          invoiceNumber: invConf?.number || paidInvoiceNumber || String(updated.id),
          // P1-7: nombre del negocio como en presupuesto/factura/landing (legalName||name).
          businessName: merchant?.legalName || merchant?.name,
        }).catch(() => {});

        // ENT-3: historial
        recordCustomerEvent({
          merchantId: updated.merchantId,
          customerId: updated.customerId,
          type: 'payment_received',
          title: 'Pago recibido',
          detail: `${amt} ${cur}${invConf?.number ? ` · Factura ${invConf.number}` : ''}`,
        });
      }

      // Solicitud de reseña Google al cliente (fire-and-forget)
      if (merchant?.googleReviewUrl && updated.customer?.phone) {
        const reviewPhone = normalizePhone(updated.customer.phone);
        if (reviewPhone) {
          const customerName = updated.customer.name || 'Cliente';
          const merchantName = merchant.name || 'tu proveedor';
          sendWhatsAppText({
            to: reviewPhone,
            text: `¡Hola ${customerName}! Gracias por confiar en ${merchantName} 🙏\n\nSi estás satisfecho con el servicio, nos ayudaría mucho que dejaras una reseña en Google:\n${merchant.googleReviewUrl}`,
          }).catch((err) => console.error('[review] Error enviando reseña:', err?.message));
        }
      }

      // Notificar al profesional por WhatsApp (fire-and-forget)
      const merchantPhone = normalizePhone(merchant?.whatsappPhone);
      if (merchantPhone) {
        const customerName = updated.customer?.name || 'Un cliente';
        const amount = body.amount ?? updated.amount.toString();
        const currency = body.currency ?? updated.currency;
        sendWhatsAppText({
          to: merchantPhone,
          text: `💰 Pago recibido de ${customerName}: ${amount} ${currency}`,
        }).catch((err) => console.error('[psp] Error notificando al merchant:', err));
      }

      // Email al merchant si tiene notificaciones activadas
      if (merchant?.notifyEmailOnPaid && merchant?.email) {
        const inv = await prisma.invoice.findFirst({ where: { id: invoiceId ?? undefined }, select: { number: true } }).catch(() => null);
        sendMerchantPaymentEmail({
          merchantEmail: merchant.email,
          merchantName: merchant.name || 'Tu negocio',
          customerName: updated.customer?.name || 'Cliente',
          amount: (body.amount ?? updated.amount).toString(),
          currency: body.currency ?? updated.currency,
          invoiceNumber: inv?.number ?? null,
        }).catch(() => {});
      }

      return res.json({ ok: true, status: 'paid' });
    }


    if (body.event === 'payment.failed') {
      await prisma.charge.update({
        where: { id: chargeId },
        data: {
          status: 'failed',
          events: { create: { type: 'failed', payload: body as any } },
        },
      });
      return res.json({ ok: true, status: 'failed' });
    }

    if (body.event === 'payment.expired') {
      await prisma.charge.update({
        where: { id: chargeId },
        data: {
          status: 'expired',
          events: { create: { type: 'expired', payload: body as any } },
        },
      });
      return res.json({ ok: true, status: 'expired' });
    }

    return res.status(400).json({ error: 'unhandled_event' });
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({
        error: 'validation_error',
        details: err.errors,
      });
    }
    console.error('POST /webhooks/psp error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
