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

export default router;
