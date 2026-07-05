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
import { sendWhatsAppWindowFirst } from '../../../../integrations/whatsapp';
import { buildQuoteDecision } from '../../../../integrations/whatsappTemplates';
import { getDeliveryStatus } from '../../../messaging/domain/whatsappLog.service';
import { recordCustomerEvent } from '../../customerEvents.service';
import { sendTechQuoteApprovedEmail } from '../../../messaging/domain/merchantNotifications';
import { normalizePhone, formatMoneyEs } from '../../../../core/utils/utils';
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

    // A5.5 (ciclo cero-plantillas): si la ventana de 24 h está abierta (p. ej.
    // presupuesto nacido de una solicitud del bot — el cliente ACABA de
    // escribirnos), el envío sale como TEXTO de sesión (0 €, texto oficial del
    // master K1); si no, plantilla quote_decision_es como siempre.
    const businessName = quote.merchant?.legalName || quote.merchant?.name || 'Tu proveedor';
    const displayNum = quote.quoteNumber ?? quote.id; // A1.2: número visible por merchant
    const result = await sendWhatsAppWindowFirst({
      to,
      merchantId: quote.merchantId, // J3: respeta waOptOut
      customerId: quote.customerId,
      windowText:
        `Hola ${quote.customer.name ?? 'Cliente'} 👋\n` +
        `${businessName} te ha preparado tu presupuesto:\n` +
        `📄 *Presupuesto #${displayNum}* · *${formatMoneyEs(quote.total, quote.currency)}*\n` +
        `Ábrelo, revísalo y fírmalo desde aquí 👇\n` +
        `${BASE_URL}/pay/quote/${quote.id}`,
      template: buildQuoteDecision({
        customerName: quote.customer.name ?? 'Cliente',
        businessName,
        quoteNumber: displayNum,
        totalWithCurrency: `${Number(quote.total).toFixed(2)} ${quote.currency}`,
        quoteId: quote.id, // el botón URL sigue con el id global (/pay/quote/:id)
      }),
      log: { customerId: quote.customerId, relatedType: 'quote', relatedId: quote.id }, // WA-0b
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
      // A3.2: topes anti-abuso del canal (J6 / PV-WA-CAPS)
      if (reason === 'daily_cap') {
        return res.status(200).json({
          ok: false, sent: false, error: 'daily_cap',
          message: 'Has alcanzado el tope diario de mensajes de WhatsApp. Vuelve a intentarlo mañana o envíalo por email.',
        });
      }
      if (reason === 'customer_daily_cap') {
        return res.status(200).json({
          ok: false, sent: false, error: 'customer_daily_cap',
          message: 'Este cliente ya recibió varios mensajes hoy (límite anti-spam). Vuelve a intentarlo mañana o envíalo por email.',
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
      title: `Presupuesto #${quote.quoteNumber ?? quote.id} enviado por WhatsApp`,
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
 * GET /admin/quotes/:id/pdf — sirve el PDF del presupuesto REGENERÁNDOLO
 * bajo demanda (mismo patrón que /admin/invoices/:id/pdf, P0-2): el fs de
 * Railway es efímero y el fichero de quote.pdfUrl muere en cada deploy.
 * Si el cliente firmó (quote.signatureUrl), el PDF sale SIEMPRE con la firma
 * y la fecha (feedback fundador: "la firma debería ir dentro").
 */
router.get('/:id/pdf', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const quote = await prisma.quote.findFirst({
      where: { id, merchantId: req.merchantId }, // multi-tenant
      include: { merchant: true, customer: true },
    });
    if (!quote) return res.status(404).json({ error: 'not_found' });

    const { generateQuotePdf } = await import('../../../../lib/pdf');
    const pdf = await generateQuotePdf({
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      merchant: {
        name: quote.merchant.name, legalName: quote.merchant.legalName,
        taxId: quote.merchant.taxId, address: quote.merchant.address,
        whatsappPhone: quote.merchant.whatsappPhone,
        logoUrl: quote.merchant.logoUrl,
      },
      customer: { name: quote.customer.name, phone: quote.customer.phone, email: quote.customer.email },
      currency: quote.currency,
      total: quote.total.toString(),
      lines: (Array.isArray(quote.lines) ? quote.lines : []) as any,
      tiers: (quote.tiers as any) ?? undefined,
      signatureData: quote.signatureUrl || undefined,
      signedAt: quote.acceptedAt ?? undefined,
      country: quote.merchant.country,
    });

    await prisma.quote.update({ where: { id }, data: { pdfUrl: pdf.publicUrlPath } }).catch(() => {});

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="presupuesto-${quote.quoteNumber ?? quote.id}.pdf"`);
    return res.sendFile(pdf.outPath);
  } catch (err) {
    console.error('[GET /admin/quotes/:id/pdf]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/quotes/:id/send-email — A2.3: envía el presupuesto al cliente
 * por email (Resend, link a /pay/quote/:id). Mismo efecto de estado que el
 * envío por WhatsApp: draft → sent (máquina L: "envío").
 */
router.post('/:id/send-email', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const quote = await prisma.quote.findFirst({
      where: { id, merchantId: req.merchantId },
      select: { id: true, quoteNumber: true, status: true, total: true, currency: true, merchantId: true, customerId: true, customer: { select: { email: true } } },
    });
    if (!quote) return res.status(404).json({ error: 'not_found' });
    if (quote.status === 'pending_approval') return res.status(409).json({ error: 'pending_approval' });
    if (!quote.customer?.email) return res.status(400).json({ error: 'customer_missing_email' });

    const { sendQuoteEmail } = await import('../../../messaging/domain/email.service');
    await sendQuoteEmail({ quoteId: id, prisma });

    if (quote.status === 'draft') {
      await prisma.quote.update({ where: { id }, data: { status: 'sent' } });
    }

    recordCustomerEvent({
      merchantId: quote.merchantId,
      customerId: quote.customerId,
      type: 'quote_sent',
      title: `Presupuesto #${quote.quoteNumber ?? quote.id} enviado por email`,
      detail: `${Number(quote.total).toFixed(2)} ${quote.currency}`,
    });

    return res.json({ ok: true, sent: true });
  } catch (err: any) {
    if (err?.message === 'customer_missing_email') {
      return res.status(400).json({ error: 'customer_missing_email' });
    }
    console.error('[POST /admin/quotes/:id/send-email]', err?.message || err);
    return res.status(200).json({
      ok: false, sent: false, error: 'email_send_failed',
      message: 'No se pudo enviar el email. El presupuesto quedó guardado; puedes reintentarlo.',
    });
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
        id: true, quoteNumber: true, status: true, total: true, currency: true, teamMemberId: true,
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
          quoteId: quote.quoteNumber ?? quote.id, // A1.2: solo display en el email
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
    // WA-0b: estado de entrega del último WhatsApp de este presupuesto (chip)
    const waDelivery = await getDeliveryStatus(req.merchantId, 'quote', id);
    return res.json({ ...detail, waDelivery });
  } catch (err: any) {
    console.error('[GET /admin/quotes/:id]', err);
    if (err.message === 'quote_not_found') {
      return res.status(404).json({ error: 'not_found' });
    }
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;