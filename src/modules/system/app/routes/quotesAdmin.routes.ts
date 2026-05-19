// src/modules/system/app/routes/quotesAdmin.routes.ts
import { Router } from 'express';
import {
  listQuotesAdmin,
  getQuoteDetailAdmin,
  acceptQuoteAdmin,
  rejectQuoteAdmin,
  createInvoiceFromQuoteAdmin,
} from '../../quoteAdmin';


import { prisma } from '../../../../core/db/prisma'; // si no estaba ya
import { getNextBillingStage } from '../../../quotes/domain/billingPlan';

import fetch from 'node-fetch';


const router = Router();

/**
 * GET /admin/quotes
 * Lista resumida de presupuestos.
 */
router.get('/', async (req, res) => {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const quotes = await listQuotesAdmin(search);
    return res.json(quotes);
  } catch (err) {
    console.error('[GET /admin/quotes]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/quotes/:id/accept
 * Marca el presupuesto como ACCEPTED (no crea cobros).
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
 * Marca el presupuesto como REJECTED y guarda motivo/comentario.
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
 *
 * Genera la siguiente factura del presupuesto, según paymentTerms.
 * Usa el helper de billingPlan:
 *   - FULL_UPFRONT  → 1 factura del 100%
 *   - FIFTY_FIFTY   → 2 facturas del 50%
 *   - MANUAL / SIN_CONDICIONES → no genera facturas automáticas
 *
 * Reglas:
 *   - Solo permite presupuestos con status = 'accepted'
 *   - Idempotente por tramo:
 *       si ya se han generado todas las facturas definidas en el plan,
 *       devuelve 409 no_more_invoices_for_payment_terms
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
        Invoice: true, // relación definida en el modelo Quote
      },
    });

    if (!quote) {
      return res.status(404).json({ error: 'quote_not_found' });
    }

    if (quote.status !== 'accepted') {
      return res.status(409).json({ error: 'quote_not_accepted' });
    }

    if (!quote.merchant || !quote.customer) {
      return res.status(500).json({ error: 'quote_missing_relations' });
    }

    const existingInvoices = quote.Invoice || [];
    const paymentTerms = (quote as any).paymentTerms ?? null;

    // Miramos qué tramo toca ahora (FULL_UPFRONT o FIFTY_FIFTY, etc.)
    const stage = getNextBillingStage(paymentTerms, existingInvoices.length);

    if (!stage) {
      // No queda nada por facturar para estas condiciones
      return res
        .status(409)
        .json({ error: 'no_more_invoices_for_payment_terms' });
    }

    const percentage = stage.percentage; // 1 -> 100%, 0.5 -> 50%

    // quote.total es Decimal -> lo pasamos a número
    const totalNumber = Number(quote.total);
    const invoiceAmount = totalNumber * percentage;

    const merchant = quote.merchant;

    // Generamos número de factura: PREFIJO + número correlativo con padding
    const nextNumber = merchant.nextInvoiceNumber;
    const padded = String(nextNumber).padStart(6, '0');
    const invoiceNumber = `${merchant.invoiceSeriesPrefix}${padded}`;

    // Creamos la factura y adelantamos el contador de la serie
    const [invoice] = await prisma.$transaction([
      prisma.invoice.create({
        data: {
          merchantId: quote.merchantId,
          customerId: quote.customerId,
          quoteId: quote.id,
          number: invoiceNumber,
          total: invoiceAmount.toFixed(2),
          currency: quote.currency,
          // De momento placeholders; más adelante enganchamos PDF/VeriFactu
          pdfUrl: 'PENDING_PDF',
          qrData: 'PENDING_QR',
          registerId: null,
        },
      }),
      prisma.merchant.update({
        where: { id: merchant.id },
        data: {
          nextInvoiceNumber: { increment: 1 },
        },
      }),
    ]);

    return res.status(201).json({
      id: invoice.id,
      number: invoice.number,
      total: invoice.total.toString(),
      currency: invoice.currency,
      createdAt: invoice.createdAt,
      percentage, // opcional, por si quieres verlo en el BO
    });
  } catch (err) {
    console.error('[POST /admin/quotes/:id/invoice] error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});



/**
 * POST /admin/quotes/:id/send-whatsapp
 *
 * Se llama desde el panel admin después de crear el presupuesto en DRAFT.
 * - NO cambia el estado del presupuesto.
 * - Solo prepara los datos y los manda al webhook de n8n (OnSend),
 *   que será quien llame a la API de WhatsApp.
 */
router.post('/:id/send-whatsapp', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    // Cargamos el presupuesto con merchant y customer
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

    if (!quote.customer || !quote.customer.phone) {
      return res
        .status(400)
        .json({ error: 'customer_missing_phone' });
    }

    const n8nUrl = process.env.N8N_ONSEND_URL;

    if (!n8nUrl) {
      console.warn(
        '[ADMIN send-whatsapp] N8N_ON_SEND_URL no configurado, no se envía nada a n8n',
      );
      return res.json({
        ok: true,
        sent: false,
        reason: 'n8n_url_not_configured',
        quote_id: quote.id,
      });
    }

    // Payload sencillo para n8n
    const payload = {
      quote_id: quote.id,
      to: quote.customer.phone, // 34XXXXXXXXX
      customer_name: quote.customer.name || '',
      amount: quote.total.toString(),
      currency: quote.currency,
      // por ahora un texto genérico; luego si quieres metemos primer concepto, etc.
      concept: `Presupuesto #${quote.id}`,
      payment_terms: (quote as any).paymentTerms ?? null,
      quote_pdf_url: quote.pdfUrl ?? null,
    };

    const resp = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.N8N_WEBHOOK_KEY
          ? { 'x-api-key': process.env.N8N_WEBHOOK_KEY }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.error(
        '[ADMIN send-whatsapp] n8n error',
        resp.status,
        text,
      );
      return res.status(502).json({
        error: 'n8n_error',
        status: resp.status,
        body: text,
      });
    }

    const n8nResult = await resp.json().catch(() => ({}));

    return res.json({
      ok: true,
      sent: true,
      quote_id: quote.id,
      n8n_result: n8nResult,
    });
  } catch (err) {
    console.error('[POST /admin/quotes/:id/send-whatsapp]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});


/**
 * GET /admin/quotes/:id
 * Detalle completo de un presupuesto.
 *
 * IMPORTANTE: va DESPUÉS de /:id/accept, /:id/reject y /:id/invoice
 * para no interferir con esas rutas.
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


