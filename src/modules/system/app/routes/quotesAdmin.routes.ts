// src/modules/system/app/routes/quotesAdmin.routes.ts
import { Router } from 'express';
import {
  listQuotesAdmin,
  getQuoteDetailAdmin,
  acceptQuoteAdmin,
  rejectQuoteAdmin,
  createInvoiceFromQuoteAdmin,
} from '../../quoteAdmin';

import { prisma } from '../../../../core/db/prisma';
import { getNextBillingStage } from '../../../quotes/domain/billingPlan';
import { sendWhatsAppTemplate } from '../../../../integrations/whatsapp';
import { normalizePhone } from '../../../../core/utils/utils';
import { BASE_URL } from '../../../../core/config/env';

import fetch from 'node-fetch';

const router = Router();

/**
 * GET /admin/quotes
 */
router.get('/', async (req, res) => {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const quotes = await listQuotesAdmin(req.merchantId, search);
    return res.json(quotes);
  } catch (err) {
    console.error('[GET /admin/quotes]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/quotes/:id/accept
 */
router.post('/:id/accept', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const { channel, comment, paymentTerms, evidence } = req.body ?? {};

    const updated = await acceptQuoteAdmin(id, {
      channel,
      comment,
      paymentTerms,
      evidence,
    });

    return res.json({
      id: updated.id,
      status: updated.status,
      acceptedAt: updated.acceptedAt,
    });
  } catch (err: any) {
    console.error('[POST /admin/quotes/:id/accept]', err);
    if (err.message === 'quote_not_found') {
      return res.status(404).json({ error: 'not_found' });
    }
    if (err.message === 'quote_already_rejected') {
      return res.status(409).json({ error: 'already_rejected' });
    }
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/quotes/:id/reject
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const { channel, reason, comment, evidence } = req.body ?? {};

    const updated = await rejectQuoteAdmin(id, {
      channel,
      reason,
      comment,
      evidence,
    });

    return res.json({
      id: updated.id,
      status: updated.status,
      rejectedAt: updated.rejectedAt,
      rejectionReason: updated.rejectionReason,
    });
  } catch (err: any) {
    console.error('[POST /admin/quotes/:id/reject]', err);
    if (err.message === 'quote_not_found') {
      return res.status(404).json({ error: 'not_found' });
    }
    if (err.message === 'quote_already_accepted') {
      return res.status(409).json({ error: 'already_accepted' });
    }
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/quotes/:id/invoice
 */
router.post('/:id/invoice', async (req, res) => {
  try {
    const quoteId = Number(req.params.id);
    if (!Number.isInteger(quoteId)) {
      return res.status(400).json({ error: 'invalid_quote_id' });
    }

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        merchant: true,
        customer: true,
        Invoice: true,
      },
    });

    if (!quote) return res.status(404).json({ error: 'quote_not_found' });
    if (quote.status !== 'accepted') {
      return res.status(409).json({ error: 'quote_not_accepted' });
    }
    if (!quote.merchant || !quote.customer) {
      return res.status(500).json({ error: 'quote_missing_relations' });
    }

    const existingInvoices = quote.Invoice || [];
    const paymentTerms = (quote as any).paymentTerms ?? null;
    const stage = getNextBillingStage(paymentTerms, existingInvoices.length);

    if (!stage) {
      return res.status(409).json({ error: 'no_more_invoices_for_payment_terms' });
    }

    const totalNumber = Number(quote.total);
    const invoiceAmount = totalNumber * stage.percentage;
    const merchant = quote.merchant;
    const nextNumber = merchant.nextInvoiceNumber;
    const padded = String(nextNumber).padStart(6, '0');
    const invoiceNumber = `${merchant.invoiceSeriesPrefix}${padded}`;

    const [invoice] = await prisma.$transaction([
      prisma.invoice.create({
        data: {
          merchantId: quote.merchantId,
          customerId: quote.customerId,
          quoteId: quote.id,
          number: invoiceNumber,
          total: invoiceAmount.toFixed(2),
          currency: quote.currency,
          pdfUrl: 'PENDING_PDF',
          qrData: 'PENDING_QR',
          registerId: null,
        },
      }),
      prisma.merchant.update({
        where: { id: merchant.id },
        data: { nextInvoiceNumber: { increment: 1 } },
      }),
    ]);

    return res.status(201).json({
      id: invoice.id,
      number: invoice.number,
      total: invoice.total.toString(),
      currency: invoice.currency,
      createdAt: invoice.createdAt,
      percentage: stage.percentage,
    });
  } catch (err) {
    console.error('[POST /admin/quotes/:id/invoice] error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/quotes/:id/send-whatsapp
 * Envía el presupuesto por WhatsApp directamente via API de Meta.
 * Ya NO usa n8n.
 */
router.post('/:id/send-whatsapp', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        merchant: true,
        customer: true,
      },
    });

    if (!quote) {
      return res.status(404).json({ error: 'not_found' });
    }

    if (!quote.customer?.phone) {
      return res.status(400).json({ error: 'customer_missing_phone' });
    }

    if (!quote.pdfUrl || quote.pdfUrl === 'PENDING_PDF') {
      return res.status(400).json({ error: 'quote_pdf_not_ready' });
    }

    const to = normalizePhone(quote.customer.phone);
    if (!to) {
      return res.status(400).json({ error: 'invalid_phone_format' });
    }

    // URL pública del PDF
    const pdfUrl = quote.pdfUrl.startsWith('http')
      ? quote.pdfUrl
      : `${BASE_URL}${quote.pdfUrl}`;

    // Llamada directa a la API de Meta con la plantilla quote_decision_es
    // Variables:
    //   {{1}} = nombre cliente
    //   {{2}} = número presupuesto
    //   {{3}} = total (número)
    //   {{4}} = moneda
    //   {{5}} = URL del PDF
    // Botón dinámico {{1}} = quote ID (se añade al final de la URL base)
    const result = await sendWhatsAppTemplate({
      to,
      templateName: 'quote_decision_es',
      languageCode: 'es',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: quote.customer.name ?? 'Cliente' },
            { type: 'text', text: String(quote.id) },
            { type: 'text', text: Number(quote.total).toFixed(2) },
            { type: 'text', text: quote.currency },
            { type: 'text', text: pdfUrl },
          ],
        },
        // Botón 0: Aceptar Presupuesto (índice 0)
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            { type: 'text', text: String(quote.id) },
          ],
        },
        // Botón 1: Rechazar Presupuesto (índice 1)
        {
          type: 'button',
          sub_type: 'url',
          index: '1',
          parameters: [
            { type: 'text', text: String(quote.id) },
          ],
        },
      ],
    });

    if (!result.ok) {
      console.error('[send-whatsapp] Error de Meta API:', result.error);
      return res.status(502).json({
        ok: false,
        error: 'whatsapp_send_failed',
        detail: result.error,
      });
    }

    // Marcar como enviado si estaba en draft
    if (quote.status === 'draft') {
      await prisma.quote.update({
        where: { id: quote.id },
        data: { status: 'sent' },
      });
    }

    return res.json({
      ok: true,
      sent: true,
      quote_id: quote.id,
      to,
    });
  } catch (err) {
    console.error('[POST /admin/quotes/:id/send-whatsapp]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * GET /admin/quotes/:id
 * IMPORTANTE: siempre al final para no interceptar las rutas anteriores
 */
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const detail = await getQuoteDetailAdmin(id);
    return res.json(detail);
  } catch (err: any) {
    console.error('[GET /admin/quotes/:id]', err);
    if (err.message === 'quote_not_found') {
      return res.status(404).json({ error: 'not_found' });
    }
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;