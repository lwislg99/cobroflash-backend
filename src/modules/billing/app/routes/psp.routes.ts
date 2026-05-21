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

      // 👇 NUEVO: intentamos emitir / asegurar la factura
        // 👇 NUEVO: intentamos emitir / asegurar la factura
  let invoiceId: number | null = null;

  if (config.AUTO_INVOICE_ON_PAID) {
    try {
      const inv = await ensureInvoiceForCharge(updated.id, prisma);
      invoiceId = inv.id;

      // Solo enviamos email si hay PDF real
      const hasRealPdf =
        !!inv.pdfUrl && inv.pdfUrl !== 'PENDING_PDF' && inv.pdfUrl !== '';

      if (
        hasRealPdf &&
        config.AUTO_EMAIL_INVOICE_ON_PAID &&
        updated.customer?.email
      ) {
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
  
      
      

      // Notificar al profesional por WhatsApp (fire-and-forget)
      const merchant = await prisma.merchant.findUnique({
        where: { id: updated.merchantId },
        select: { whatsappPhone: true },
      });
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
