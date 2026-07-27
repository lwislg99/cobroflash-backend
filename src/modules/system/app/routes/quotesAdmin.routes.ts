// src/modules/system/app/routes/quotesAdmin.routes.ts
import { Router } from 'express';
import {
  listQuotesAdmin,
  getQuoteDetailAdmin,
  acceptQuoteAdmin,
  rejectQuoteAdmin,
} from '../../quoteAdmin';

import { prisma } from '../../../../core/db/prisma';
import { resolveBillingPlan, distributeStageAmounts } from '../../../quotes/domain/billingPlan';
import { sendQuoteWhatsAppToCustomer } from '../../../quotes/domain/sendQuote.service';
import { suggestMaintenance } from '../../../maintenance/domain/maintenance.service';
import { isFlagEnabled } from '../../../../core/flags';
import { getDeliveryStatus } from '../../../messaging/domain/whatsappLog.service';
import { recordCustomerEvent } from '../../customerEvents.service';
import { sendTechQuoteApprovedEmail } from '../../../messaging/domain/merchantNotifications';
import { ensureJobForQuote } from '../../../jobs/domain/job.service';
import { applyVeriFactu } from '../../../invoicing/domain/verifactu.service';
import { allocateInvoiceNumber, isReceiptNumber } from '../../../invoicing/domain/invoiceNumber.service';
import { stageLinesReconciled, grossOfLines } from '../../../invoicing/domain/invoiceLines.service'; // SCRUM-141: el total se deriva de las líneas
import { requireRole } from '../../../../core/http/authMiddleware'; // SCRUM-55 (S1: emitir factura = admin)

import fetch from 'node-fetch';
import { sendSuccessBody, sendFailureBody } from '../../../../lib/sendOutcome'; // SCRUM-126

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
    }, req.merchantId); // A12.1: scoped

    // A13.1 (JOB-1): auto-creación del Trabajo al aceptar (idempotente)
    ensureJobForQuote(id).catch(() => {});

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
    }, req.merchantId); // A12.1: scoped

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
 * SCRUM-55 (D2 del fundador): EMITE FACTURA → dinero. S1: "Facturas: emitir ❌ Técnico".
 * Estaba abierta mientras POST /admin/jobs/:id/consolidar-albaranes —que emite igual—
 * sí la citaba en un comentario. La regla estaba escrita al lado; faltaba aplicarla.
 * Si un flujo real de técnico la necesitara, se escala al admin; no se baja el permiso.
 */
router.post('/:id/invoice', requireRole('admin'), async (req, res) => {
  try {
    const quoteId = Number(req.params.id);
    if (!Number.isInteger(quoteId)) {
      return res.status(400).json({ error: 'invalid_quote_id' });
    }

    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, merchantId: req.merchantId }, // A12.1: scoped (regla 2)
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
    // SCRUM-27: plan efectivo (custom o preset); selección por conteo igual que antes.
    const plan = resolveBillingPlan(quote);
    const stage = plan[existingInvoices.length] ?? null;

    if (!stage) {
      return res.status(409).json({ error: 'no_more_invoices_for_payment_terms' });
    }

    const isCustomPlan = Array.isArray((quote as any).customBillingPlan) && (quote as any).customBillingPlan.length > 0;
    const merchant = quote.merchant;

    // SCRUM-141: las líneas del tramo PRIMERO, y el importe DERIVADO de ellas — el total de una
    // factura es consecuencia de sus líneas, no al revés. Antes el importe venía de
    // `distributeStageAmounts` y las líneas se escalaban aparte: dos redondeos independientes que
    // podían diferir 1 cént., y esa diferencia quedaba SELLADA en la huella VeriFactu
    // (`importeTotal` del total vs `cuotaTotal` de las líneas). Ver invoiceLines.service.ts.
    const quoteLines = Array.isArray(quote.lines) ? quote.lines as any[] : [];
    const scaledLines = stageLinesReconciled(
      quoteLines, plan, stage.index, distributeStageAmounts(quote.total, plan)[stage.index],
    );
    const invoiceAmount = grossOfLines(scaledLines);

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
          stageLabel: isCustomPlan ? stage.label : null, // SCRUM-27: etiqueta congelada (solo custom)
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
      return res.status(400).json({ ok: false, error: 'invalid_id' });
    }

    // A15.2: la lógica vive en sendQuoteWhatsAppToCustomer (texto K1 + guards
    // intactos) para que "Aprobar y enviar" del ciclo de mantenimientos sea
    // EXACTAMENTE el flujo normal. Aquí solo se mapean reasons → HTTP de siempre.
    const result = await sendQuoteWhatsAppToCustomer(id, req.merchantId);

    if (!result.ok) {
      switch (result.reason) {
        // Precondición real: nunca se intentó el envío — sin `sent`.
        case 'not_found':
          return res.status(404).json({ ok: false, error: 'not_found' });
        case 'customer_missing_phone':
          return res.status(400).json({ ok: false, error: 'customer_missing_phone' });
        case 'invalid_phone_format':
          return res.status(400).json({ ok: false, error: 'invalid_phone_format' });
        case 'pending_approval':
          return res.status(409).json({ ok: false, error: 'pending_approval' });
        // SCRUM-126: envío intentado, no salió — SIEMPRE 200, vocabulario compartido
        // (src/lib/sendOutcome.ts). Antes cada motivo repetía su mensaje aquí a mano.
        case 'demo_safe_numbers':
        case 'wa_opt_out':
        case 'daily_cap':
        case 'customer_daily_cap':
          return res.status(200).json(sendFailureBody(result.reason));
        default: {
          // P3-2: NO devolver un 502 crudo. El presupuesto sigue guardado; informamos
          // con un mensaje claro (incluyendo el motivo de Meta si lo hay).
          const metaMsg =
            (result.error as any)?.error?.message ||
            (typeof result.error === 'string' ? result.error : '') ||
            'WhatsApp rechazó el envío';
          return res.status(200).json(sendFailureBody('whatsapp_send_failed', {
            message: `No se pudo enviar por WhatsApp: ${metaMsg}. El presupuesto quedó guardado; puedes reintentarlo.`,
            detail: result.error,
          }));
        }
      }
    }

    return res.json(sendSuccessBody({
      quote_id: result.quoteId,
      to: result.to,
    }));
  } catch (err) {
    console.error('[POST /admin/quotes/:id/send-whatsapp]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
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
      customer: { name: quote.customer.name, phone: quote.customer.phone, email: quote.customer.email, legalName: (quote.customer as any).legalName, taxId: (quote.customer as any).taxId }, // A20.4
      docFields: ((quote as any).docFields as any) ?? null, // A20.4
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
    if (!quote) return res.status(404).json({ ok: false, error: 'not_found' });
    if (quote.status === 'pending_approval') return res.status(409).json({ ok: false, error: 'pending_approval' });
    if (!quote.customer?.email) return res.status(400).json({ ok: false, error: 'customer_missing_email' });

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

    return res.json(sendSuccessBody());
  } catch (err: any) {
    if (err?.message === 'customer_missing_email') {
      return res.status(400).json({ ok: false, error: 'customer_missing_email' });
    }
    console.error('[POST /admin/quotes/:id/send-email]', err?.message || err);
    return res.status(200).json(sendFailureBody('email_send_failed', {
      message: 'No se pudo enviar el email. El presupuesto quedó guardado; puedes reintentarlo.',
    }));
  }
});

/**
 * POST /admin/quotes/:id/approve — aprueba una cotización pendiente (ENT-2). Solo admin.
 */
// SCRUM-55: gate inline (`if req.userRole !== 'admin'`) → requireRole. Mismo
// comportamiento; ahora la red fail-closed lo ve.
router.post('/:id/approve', requireRole('admin'), async (req, res) => {
  try {
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

    const detail = await getQuoteDetailAdmin(id, req.merchantId); // A12.1: scoped
    // WA-0b: estado de entrega del último WhatsApp de este presupuesto (chip)
    const waDelivery = await getDeliveryStatus(req.merchantId, 'quote', id);

    // A15.1 (MANT-1, tras flag): en un presupuesto ACEPTADO cuya línea matchea
    // una categoría mantenible del gremio, el detalle ofrece el toggle "Crear
    // recordatorio de mantenimiento"; si ya hay plan, se muestra su estado.
    let maintenance: unknown;
    try {
      const merchant = await prisma.merchant.findUnique({
        where: { id: req.merchantId },
        select: { id: true, country: true, flags: true, trade: true },
      });
      if (merchant && isFlagEnabled('MAINTENANCE_ENABLED', { merchant })) {
        const plan = await prisma.maintenancePlan.findFirst({
          where: { merchantId: req.merchantId, quoteId: id, active: true },
          select: { id: true, title: true, intervalMonths: true, nextDueAt: true },
        });
        const suggestion = (detail as any)?.status === 'accepted' && !plan
          ? suggestMaintenance(merchant.trade, (detail as any)?.lines)
          : null;
        maintenance = {
          enabled: true,
          plan: plan ?? null,
          suggestion: suggestion
            ? { title: suggestion.title, intervalMonths: suggestion.intervalMonths, matchedConcept: suggestion.matchedConcept }
            : null,
        };
      }
    } catch (e) {
      console.error('[GET /admin/quotes/:id] maintenance enrich:', (e as Error)?.message);
    }

    return res.json({ ...detail, waDelivery, ...(maintenance ? { maintenance } : {}) });
  } catch (err: any) {
    console.error('[GET /admin/quotes/:id]', err);
    if (err.message === 'quote_not_found') {
      return res.status(404).json({ error: 'not_found' });
    }
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;