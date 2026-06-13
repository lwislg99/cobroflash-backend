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
import { buildQuoteDecision } from '../../../../integrations/whatsappTemplates';
import { recordCustomerEvent } from '../../customerEvents.service';
import { sendTechQuoteApprovedEmail } from '../../../messaging/domain/merchantNotifications';
import { normalizePhone } from '../../../../core/utils/utils';
import { BASE_URL } from '../../../../core/config/env';
import { applyVeriFactu } from '../../../invoicing/domain/verifactu.service';
import { allocateInvoiceNumber, isReceiptNumber } from '../../../invoicing/domain/invoiceNumber.service';

import fetch from 'node-fetch';

const router = Router();

/**
 * GET /admin/quotes
 */
router.get('/', async (req, res) => {
  try {
    const search   = req.query.search   ? String(req.query.search)   : undefined;
    const status   = req.query.status   ? String(req.query.status)   : undefined;
    const dateFrom = req.query.dateFrom ? new Date(String(req.query.dateFrom)) : null;
    const dateTo   = req.query.dateTo   ? (() => { const d = new Date(String(req.query.dateTo)); d.setHours(23,59,59,999); return d; })() : null;
    const quotes = await listQuotesAdmin(req.merchantId, search, status, dateFrom, dateTo);
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

    // Escalar las líneas de la cotización al porcentaje facturado (ej. 50% en FIFTY_FIFTY)
    const quoteLines = Array.isArray(quote.lines) ? quote.lines as any[] : [];
    const scaledLines = stage.percentage < 1
      ? quoteLines.map((l: any) => ({ ...l, price: Number(l.price) * stage.percentage }))
      : quoteLines;

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await allocateInvoiceNumber(tx, quote.merchantId);
      return tx.invoice.create({
        data: {
          merchantId: quote.merchantId,
          customerId: quote.customerId,
          quoteId: quote.id,
          number: invoiceNumber,
          type: isReceiptNumber(invoiceNumber) ? 'JUST' : 'F1', // V0-0
          total: invoiceAmount.toFixed(2),
          currency: quote.currency,
          lines: scaledLines.length > 0 ? scaledLines : undefined,
          pdfUrl: 'PENDING_PDF',
          qrData: 'PENDING_QR',
          registerId: null,
        },
      });
    });

    // Aplicar VeriFactu para merchants españoles con NIF (V0-0: nunca a justificantes)
    let vfApplied = false;
    if (merchant.country === 'ES' && merchant.taxId && !isReceiptNumber(invoice.number)) {
      try {
        await applyVeriFactu(invoice, merchant.taxId, prisma);
        vfApplied = true;
      } catch (e) {
        console.error('[verifactu] Error al aplicar VeriFactu en quote invoice:', e);
      }
    }

    return res.status(201).json({
      id: invoice.id,
      number: invoice.number,
      total: invoice.total.toString(),
      currency: invoice.currency,
      createdAt: invoice.createdAt,
      percentage: stage.percentage,
      veriFactu: vfApplied,
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

    if (quote.status === 'pending_approval') {
      return res.status(409).json({ error: 'pending_approval' });
    }

    const to = normalizePhone(quote.customer.phone);
    if (!to) {
      return res.status(400).json({ error: 'invalid_phone_format' });
    }

    // Plantilla quote_decision_es (estructura en src/integrations/whatsappTemplates.ts)
    const businessName = quote.merchant?.legalName || quote.merchant?.name || 'Tu proveedor';
    const result = await sendWhatsAppTemplate({
      to,
      merchantId: quote.merchantId, // J3: respeta waOptOut
      log: { customerId: quote.customerId, relatedType: 'quote', relatedId: quote.id }, // WA-0b
      ...buildQuoteDecision({
        customerName: quote.customer.name ?? 'Cliente',
        businessName,
        quoteNumber: quote.id,
        totalWithCurrency: `${Number(quote.total).toFixed(2)} ${quote.currency}`,
        quoteId: quote.id,
      }),
    });

    if (!result.ok) {
      // Bloqueos de POLÍTICA propios (no son errores de Meta) — mensaje específico (J5)
      const reason = (result as any).reason as string | undefined;
      if (reason === 'demo_safe_numbers') {
        return res.status(200).json({
          ok: false, sent: false, error: 'demo_safe_numbers',
          message: 'Modo demo seguro: este número no está en DEMO_SAFE_NUMBERS, no se envía nada (V0-2).',
        });
      }
      if (reason === 'wa_opt_out') {
        return res.status(200).json({
          ok: false, sent: false, error: 'wa_opt_out',
          message: 'Este cliente se dio de baja de WhatsApp (no se le envían más mensajes).',
        });
      }

      console.error('[send-whatsapp] Error de Meta API:', result.error);
      // P3-2: NO devolver un 502 crudo. El presupuesto sigue guardado; informamos
      // con un mensaje claro (incluyendo el motivo de Meta si lo hay) y 200 ok:false.
      const metaMsg =
        (result.error as any)?.error?.message ||
        (typeof result.error === 'string' ? result.error : '') ||
        'WhatsApp rechazó el envío';
      return res.status(200).json({
        ok: false,
        sent: false,
        error: 'whatsapp_send_failed',
        message: `No se pudo enviar por WhatsApp: ${metaMsg}. El presupuesto quedó guardado; puedes reintentarlo.`,
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

    // ENT-3: historial
    recordCustomerEvent({
      merchantId: quote.merchantId,
      customerId: quote.customerId,
      type: 'quote_sent',
      title: `Presupuesto #${quote.id} enviado por WhatsApp`,
      detail: `${Number(quote.total).toFixed(2)} ${quote.currency}`,
    });

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
 * POST /admin/quotes/:id/approve — aprueba una cotización pendiente (ENT-2). Solo admin.
 */
router.post('/:id/approve', async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'forbidden', required_role: 'admin' });
    }
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const quote = await prisma.quote.findFirst({
      where: { id, merchantId: req.merchantId },
      select: {
        id: true, status: true, total: true, currency: true, teamMemberId: true,
        customer: { select: { name: true } },
      },
    });
    if (!quote) return res.status(404).json({ error: 'not_found' });
    if (quote.status !== 'pending_approval') {
      return res.status(409).json({ error: 'not_pending_approval' });
    }

    await prisma.quote.update({ where: { id }, data: { status: 'draft' } });

    // Avisar por email al técnico que creó el presupuesto (si tiene email) — fire-and-forget
    if (quote.teamMemberId) {
      const tech = await prisma.teamMember.findUnique({
        where: { id: quote.teamMemberId },
        select: { email: true, name: true },
      }).catch(() => null);
      if (tech?.email) {
        sendTechQuoteApprovedEmail({
          techEmail: tech.email,
          techName: tech.name || '',
          quoteId: quote.id,
          customerName: quote.customer?.name || 'el cliente',
          total: Number(quote.total).toFixed(2),
          currency: quote.currency,
        }).catch(() => {});
      }
    }

    return res.json({ ok: true, id, status: 'draft' });
  } catch (err) {
    console.error('[POST /admin/quotes/:id/approve]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * PUT /admin/quotes/:id/notes
 * Guarda notas internas (solo visibles en el BO, nunca al cliente)
 */
router.put('/:id/notes', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });
    const notes = req.body?.notes !== undefined ? String(req.body.notes ?? '') : null;
    await prisma.quote.updateMany({
      where: { id, merchantId: req.merchantId },
      data: { internalNotes: notes || null },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[PUT /admin/quotes/:id/notes]', err);
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