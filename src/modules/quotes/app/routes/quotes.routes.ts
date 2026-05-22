// src/modules/quotes/app/routes/quotes.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import {
  CreateQuoteSchema,
  AcceptQuoteSchema,
  RejectQuoteSchema,
  type QuoteTier,
} from '../../../../core/validation/schemas';
import { calcTotal, normalizePhone } from '../../../../core/utils/utils';

function calcTierTotal(lines: Array<{qty: number; price: number; tax?: number}>): number {
  return Math.round(lines.reduce((s, l) => s + l.qty * l.price * (1 + (l.tax ?? 0)), 0) * 100) / 100;
}
import { sendWhatsAppText } from '../../../../integrations/whatsapp';
import { getNextBillingStage } from '../../domain/billingPlan';

import fetch from 'node-fetch';

import { generateQuotePdf } from '../../../../lib/pdf';

const BASE_API_URL =
  process.env.PUBLIC_BASE_URL || 'http://localhost:3000';


const router = Router();

/**
 * POST /quote/create
 * Crea un presupuesto en estado DRAFT.
 */
router.post('/create', async (req, res) => {
  try {
    const body = CreateQuoteSchema.parse(req.body);
    const { merchant_id, customer_id, currency } = body;

    // Validar: se necesita lines O tiers (no los dos, no ninguno)
    if (!body.lines && !body.tiers) {
      return res.status(400).json({ error: 'validation_error', details: 'lines or tiers required' });
    }

    const merchant = await prisma.merchant.findUnique({ where: { id: merchant_id } });
    if (!merchant) return res.status(404).json({ error: 'merchant_not_found' });

    const customer = await prisma.customer.findUnique({ where: { id: customer_id } });
    if (!customer) return res.status(404).json({ error: 'customer_not_found' });

    // Calcular total: si hay tiers, usamos el "better" (o el de en medio)
    let totalNum: number;
    let tiersWithTotal: (QuoteTier & { total: number })[] | undefined;
    let canonicalLines: any[];

    if (body.tiers) {
      tiersWithTotal = body.tiers.map((t) => ({ ...t, total: calcTierTotal(t.lines) }));
      const betterTier = tiersWithTotal.find((t) => t.id === 'better') ?? tiersWithTotal[1];
      totalNum = betterTier.total;
      canonicalLines = betterTier.lines; // líneas del tier recomendado como referencia
    } else {
      canonicalLines = body.lines!;
      totalNum = calcTotal(canonicalLines);
    }

    // 1) Crear el presupuesto en DRAFT
    const quote = await prisma.quote.create({
      data: {
        merchantId: merchant_id,
        customerId: customer_id,
        status: 'draft',
        total: totalNum.toFixed(2),
        currency: currency.toUpperCase(),
        lines: canonicalLines,
        tiers: tiersWithTotal as any ?? undefined,
        paymentTerms: body.paymentTerms ?? null,
      },
    });

    // 2) Generar PDF
    try {
      const pdf = await generateQuotePdf({
        quoteId: quote.id,
        merchant: {
          name: merchant.name, legalName: merchant.legalName,
          taxId: merchant.taxId, address: merchant.address,
          whatsappPhone: merchant.whatsappPhone,
          logoUrl: merchant.logoUrl,
        },
        customer: { name: customer.name, phone: customer.phone, email: customer.email },
        currency: quote.currency,
        total: quote.total.toString(),
        lines: canonicalLines as any,
        tiers: tiersWithTotal,
        country: merchant.country,
      });

      await prisma.quote.update({
        where: { id: quote.id },
        data: { pdfUrl: pdf.publicUrlPath },
      });
    } catch (e) {
      console.error('Error generando PDF de presupuesto', e);
    }

    return res.status(201).json({
      id: quote.id,
      status: quote.status,
      total: quote.total.toString(),
      currency: quote.currency,
    });
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({
        error: 'validation_error',
        details: err.errors,
      });
    }
    console.error('POST /quote/create error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});


/**
 * POST /quote/:id/accept
 * Decisión del CLIENTE: acepta el presupuesto.
 * No crea cobros ni facturas, solo marca la decisión.
 */
router.post('/:id/accept', async (req, res) => {
  try {
    const quoteId = Number(req.params.id);
    if (!Number.isInteger(quoteId)) {
      return res.status(400).json({ error: 'invalid_quote_id' });
    }

    const body = AcceptQuoteSchema.parse(req.body);

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
    });

    if (!quote) {
      return res.status(404).json({ error: 'quote_not_found' });
    }

    // Idempotencia: si ya está aceptado devolvemos ok
    if (quote.status === 'accepted') {
      return res.json({
        ok: true,
        status: 'already_accepted',
        quote_id: quote.id,
      });
    }

    // Si ya estaba rechazado, no dejamos aceptarlo por esta vía
    if (quote.status === 'rejected') {
      return res.status(409).json({
        ok: false,
        error: 'already_rejected',
      });
    }

    const now = new Date();

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: 'accepted',
        acceptedAt: now,
        rejectedAt: null,
        decisionChannel: body.channel ?? 'whatsapp',
        decisionComment: body.comment ?? null,
        paymentTerms: body.paymentTerms ?? quote.paymentTerms,
        evidence: body.evidence ?? quote.evidence ?? {},
      },
    });

    return res.json({
      ok: true,
      status: 'accepted',
      quote_id: updated.id,
      accepted_at: updated.acceptedAt,
    });
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({
        error: 'validation_error',
        details: err.errors,
      });
    }
    console.error('POST /quote/:id/accept error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /quote/:id/reject
 * Decisión del CLIENTE: rechaza el presupuesto.
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const quoteId = Number(req.params.id);
    if (!Number.isInteger(quoteId)) {
      return res.status(400).json({ error: 'invalid_quote_id' });
    }

    const body = RejectQuoteSchema.parse(req.body);

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
    });

    if (!quote) {
      return res.status(404).json({ error: 'quote_not_found' });
    }

    // Si ya estaba rechazado → idempotente
    if (quote.status === 'rejected') {
      return res.json({
        ok: true,
        status: 'already_rejected',
        quote_id: quote.id,
      });
    }

    // Si ya estaba aceptado → conflicto
    if (quote.status === 'accepted') {
      return res.status(409).json({
        ok: false,
        error: 'already_accepted',
      });
    }

    const now = new Date();

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: 'rejected',
        rejectedAt: now,
        acceptedAt: null,
        decisionChannel: body.channel ?? 'whatsapp',
        rejectionReason: body.reason ?? null,
        decisionComment: body.comment ?? null,
        evidence: body.evidence ?? quote.evidence ?? {},
      },
    });

    return res.json({
      ok: true,
      status: 'rejected',
      quote_id: updated.id,
      rejected_at: updated.rejectedAt,
    });
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({
        error: 'validation_error',
        details: err.errors,
      });
    }
    console.error('POST /quote/:id/reject error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});



/**
 * POST /quote/:id/decision
 * Endpoint pensado para WhatsApp / n8n.
 *
 * Body:
 *  {
 *    "decision": "accept" | "reject",
 *    "comment": "texto opcional que escribe el cliente",
 *    "reason":  "opcional, motivo corto (ej. 'too_expensive')"
 *  }
 *
 * Efectos:
 *  - Actualiza el presupuesto con status, fechas y canal = 'whatsapp'
 *  - Si decision = accept → marca ACCEPTED y genera la siguiente factura
 *    según paymentTerms (FULL_UPFRONT o FIFTY_FIFTY).
 */
router.post('/:id/decision', async (req, res) => {
  try {
    const quoteId = Number(req.params.id);
    if (!Number.isInteger(quoteId)) {
      return res.status(400).json({ error: 'invalid_quote_id' });
    }

    const decision = String(req.body?.decision || '').toLowerCase();
    const comment = req.body?.comment ? String(req.body.comment) : undefined;
    const reason = req.body?.reason ? String(req.body.reason) : undefined;
    const signatureData = req.body?.signatureData ? String(req.body.signatureData) : null;
    const tierId = req.body?.tierId ? String(req.body.tierId) : null;

    if (!['accept', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'invalid_decision' });
    }

    // Cargamos el presupuesto con merchant, customer e invoices existentes
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        merchant: true,
        customer: true,
        Invoice: true,
      },
    });

    if (!quote) {
      return res.status(404).json({ error: 'quote_not_found' });
    }

    // Si ya está aceptado/rechazado, devolvemos idempotente
    if (decision === 'accept' && quote.status === 'accepted') {
      return res.json({ ok: true, status: 'already_accepted' });
    }
    if (decision === 'reject' && quote.status === 'rejected') {
      return res.json({ ok: true, status: 'already_rejected' });
    }

    let updatedQuote: any = quote;
    let createdInvoice: any = null;

    if (decision === 'accept') {
      // 1) Marcamos el presupuesto como ACCEPTED vía WhatsApp
      const now = new Date();

      // Si hay tiers y el cliente eligió uno, recalcular el total
      let tierTotal: string | undefined;
      let selectedLines: any[] | undefined;
      if (tierId && quote.tiers) {
        const tiers = quote.tiers as QuoteTier[];
        const chosen = tiers.find((t) => t.id === tierId);
        if (chosen) {
          tierTotal = calcTierTotal(chosen.lines).toFixed(2);
          selectedLines = chosen.lines;
        }
      }

      updatedQuote = await prisma.quote.update({
        where: { id: quoteId },
        data: {
          status: 'accepted',
          acceptedAt: now,
          decisionChannel: 'whatsapp',
          decisionComment: comment,
          rejectionReason: null,
          rejectedAt: null,
          ...(signatureData ? { signatureUrl: signatureData } : {}),
          ...(tierId ? { selectedTierId: tierId } : {}),
          ...(tierTotal ? { total: tierTotal } : {}),
          ...(selectedLines ? { lines: selectedLines } : {}),
        },
      });

      // Regenerar PDF con firma si se adjuntó
      if (signatureData) {
        try {
          const merchant = quote.merchant;
          const customer = quote.customer;
          const pdf = await generateQuotePdf({
            quoteId: quote.id,
            merchant: {
              name: merchant.name, legalName: merchant.legalName,
              taxId: merchant.taxId, address: merchant.address,
              whatsappPhone: merchant.whatsappPhone,
              logoUrl: merchant.logoUrl,
            },
            customer: { name: customer.name, phone: customer.phone, email: customer.email },
            currency: quote.currency,
            total: quote.total.toString(),
            lines: quote.lines as any,
            signatureData,
            signedAt: now,
            country: merchant.country,
          });
          await prisma.quote.update({ where: { id: quoteId }, data: { pdfUrl: pdf.publicUrlPath } });
        } catch (e) {
          console.error('[decision] Error regenerando PDF con firma:', e);
        }
      }

      // 2) Según paymentTerms, generamos la siguiente factura
      const existingInvoices = quote.Invoice || [];
      let paymentTerms = (quote as any).paymentTerms ?? null;

      // ✅ Si no hay condiciones de pago grabadas,
      // usamos FULL_UPFRONT como default
      if (!paymentTerms) {
        paymentTerms = 'FULL_UPFRONT';
      }

      const stage = getNextBillingStage(paymentTerms, existingInvoices.length);

      if (stage) {
        const percentage = stage.percentage; // 1 → 100%, 0.5 → 50%
        const totalNumber = Number(quote.total);
        const invoiceAmount = totalNumber * percentage;

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
            data: {
              nextInvoiceNumber: { increment: 1 },
            },
          }),
        ]);

        createdInvoice = invoice;


        

        


        // 3) Si las condiciones de pago son FULL_UPFRONT,
        // disparamos el envío de la factura por WhatsApp (n8n)
        if (paymentTerms === 'FULL_UPFRONT' && createdInvoice) {
          const url = `${BASE_API_URL}/admin/invoices/${encodeURIComponent(
            createdInvoice.id
          )}/resend-whatsapp`;

          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }).catch((err) => {
            console.error(
              '[POST /quote/:id/decision] error al llamar a resend-whatsapp:',
              err
            );
          });
        }
      }

    } else {
      // decision === 'reject'
      updatedQuote = await prisma.quote.update({
        where: { id: quoteId },
        data: {
          status: 'rejected',
          rejectedAt: new Date(),
          acceptedAt: null,
          decisionChannel: 'whatsapp',
          rejectionReason: reason || comment || null,
          decisionComment: comment ?? null,
        },
      });
    }

    // Notificar al profesional por WhatsApp (fire-and-forget)
    const merchantPhone = normalizePhone(quote.merchant?.whatsappPhone);
    if (merchantPhone) {
      const customerName = quote.customer?.name || 'El cliente';
      const text = decision === 'accept'
        ? `✅ ${customerName} aceptó tu cotización #${quoteId} por ${Number(quote.total).toFixed(2)} ${quote.currency}`
        : `❌ ${customerName} rechazó la cotización #${quoteId}. Motivo: ${reason || comment || 'Sin especificar'}`;
      sendWhatsAppText({ to: merchantPhone, text }).catch((err) =>
        console.error('[decision] Error notificando al merchant:', err)
      );
    }

    // Nota: usamos `quote` (el original con include) para merchant / customer
    const merchant = quote.merchant;
    const customer = quote.customer;

    return res.json({
      ok: true,
      quote: {
        id: updatedQuote.id,
        status: updatedQuote.status,
        acceptedAt: updatedQuote.acceptedAt,
        rejectedAt: updatedQuote.rejectedAt,
        decisionChannel: updatedQuote.decisionChannel,
        decisionComment: updatedQuote.decisionComment,
        rejectionReason: updatedQuote.rejectionReason,
        paymentTerms: (updatedQuote as any).paymentTerms ?? null,
        total: updatedQuote.total,
        currency: updatedQuote.currency,
      },
      invoice: createdInvoice
        ? {
            id: createdInvoice.id,
            number: createdInvoice.number,
            total: createdInvoice.total,
            currency: createdInvoice.currency,
            pdfUrl: createdInvoice.pdfUrl,
            createdAt: createdInvoice.createdAt,
            status: createdInvoice.status,
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
    console.error('[POST /quote/:id/decision] error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});



export default router;
