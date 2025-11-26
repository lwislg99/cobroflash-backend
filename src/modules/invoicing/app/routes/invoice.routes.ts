// srcNew/modules/invoicing/app/routes/invoice.routes.ts
import { Router } from 'express';
import { IssueInvoiceSchema } from '../../../../core/validation/schemas';
import { prisma } from '../../../../core/db/prisma';

// ⚠️ Igual que en otros puntos: seguimos usando lib/invoicing
// Asegúrate de tener srcNew/lib/invoicing.ts copiado desde src/lib/invoicing.ts
import { ensureInvoiceForCharge } from '../../../../lib/invoicing';

const router = Router();

router.post('/issue', async (req, res) => {
  try {
    const { charge_id } = IssueInvoiceSchema.parse(req.body);
    const inv = await ensureInvoiceForCharge(charge_id, prisma);

    return res.json({
      id: inv.id,
      number: inv.number,
      pdf_url: inv.pdfUrl,
      currency: inv.currency,
      total: inv.total.toString(),
      quote_id: inv.quoteId ?? null,
      created_at: inv.createdAt,
    });
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({
        error: 'validation_error',
        details: err.errors,
      });
    }

    if (String(err.message || '').startsWith('charge_not_paid')) {
      const status = String(err.message).split(':')[1] || 'unknown';
      return res.status(409).json({ error: 'charge_not_paid', status });
    }

    if (err.message === 'charge_not_found') {
      return res.status(404).json({ error: 'charge_not_found' });
    }

    console.error('POST /invoice/issue error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});




/**
 * POST /invoice/:id/paid-webhook
 *
 * Webhook / simulación de confirmación de pago.
 * - Marca la factura como PAID (si no lo estaba).
 * - Rellena paidAt con la fecha actual si estaba null.
 * - Devuelve invoice + quote + merchant + customer
 *   para poder disparar un WhatsApp de confirmación.
 */
router.post('/:id/paid-webhook', async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    if (!Number.isInteger(invoiceId)) {
      return res.status(400).json({ error: 'invalid_invoice_id' });
    }

    // 1) Cargar la factura con sus relaciones
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        quote: {
          include: {
            merchant: true,
            customer: true,
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'invoice_not_found' });
    }

    // 2) Si ya está pagada, devolvemos idempotente
    if (invoice.status === 'paid') {
      return res.json({
        ok: true,
        status: 'already_paid',
        invoice: {
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
          total: invoice.total,
          currency: invoice.currency,
          paidAt: invoice.paidAt,
        },
      });
    }

    const now = new Date();

    // 3) Actualizar a PAID
    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'paid',
        paidAt: invoice.paidAt ?? now,
      },
      include: {
        quote: {
          include: {
            merchant: true,
            customer: true,
          },
        },
      },
    });

    const quote = updated.quote;
    const merchant = quote?.merchant;
    const customer = quote?.customer;

    // 4) Respuesta pensada para n8n / WhatsApp
    return res.json({
      ok: true,
      status: 'paid',
      invoice: {
        id: updated.id,
        number: updated.number,
        status: updated.status,
        total: updated.total,
        currency: updated.currency,
        createdAt: updated.createdAt,
        paidAt: updated.paidAt,
      },
      quote: quote
        ? {
            id: quote.id,
            status: quote.status,
            total: quote.total,
            currency: quote.currency,
            paymentTerms: (quote as any).paymentTerms ?? null,
          }
        : null,
      merchant: merchant
        ? {
            id: merchant.id,
            name: merchant.name || merchant.legalName || null,
            legalName: merchant.legalName,
            taxId: merchant.taxId,
            address: merchant.address,
            whatsappPhone: merchant.whatsappPhone,
            defaultCurrency: merchant.defaultCurrency,
          }
        : null,
      customer: customer
        ? {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
          }
        : null,
    });
  } catch (err) {
    console.error('[POST /invoice/:id/paid-webhook] error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});






export default router;
