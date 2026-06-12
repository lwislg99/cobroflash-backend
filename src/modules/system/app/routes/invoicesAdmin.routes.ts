// src/modules/system/app/routes/invoicesAdmin.routes.ts
import { Router } from 'express';
import {
  listInvoicesAdmin,
  getInvoiceDetailAdmin,
  updateInvoiceStatusAdmin,
  markInvoicePaidAdmin,
  markInvoicePendingAdmin,
} from '../../invoiceAdmin';

import { BASE_URL } from '../../../../core/config/env';
import { prisma } from '../../../../core/db/prisma';
import { applyVeriFactu } from '../../../invoicing/domain/verifactu.service';
import { allocateInvoiceNumber, isReceiptNumber } from '../../../invoicing/domain/invoiceNumber.service';
import { isDemoMerchant, DEMO_WATERMARK } from '../../../invoicing/domain/emission.service';
import { recordCustomerEvent } from '../../customerEvents.service';
import { generateInvoicePdf } from '../../../../lib/pdf';

import { sendWhatsAppTemplate, sendWhatsAppText } from '../../../../integrations/whatsapp';
import { buildPaymentRequest } from '../../../../integrations/whatsappTemplates';
import { sendInvoicePaymentRequest } from '../../../billing/domain/invoiceWhatsApp.service';
import { normalizePhone } from '../../../../core/utils/utils';
import fs from 'fs';
import { ensureInvoicePdf } from '../../../../lib/invoicing';


const router = Router();

/**
 * GET /admin/invoices?status=pending|paid|expired|all&search=texto
 */
router.get('/', async (req, res) => {
  try {
    const status   = req.query.status   ? String(req.query.status)   : 'all';
    const search   = req.query.search   ? String(req.query.search)   : undefined;
    const dateFrom = req.query.dateFrom ? new Date(String(req.query.dateFrom)) : null;
    const dateTo   = req.query.dateTo   ? (() => { const d = new Date(String(req.query.dateTo)); d.setHours(23,59,59,999); return d; })() : null;

    const invoices = await listInvoicesAdmin(req.merchantId, status, search, dateFrom, dateTo);
    res.json(invoices);
  } catch (err) {
    console.error('[GET /admin/invoices]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * GET /admin/invoices/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const invoice = await getInvoiceDetailAdmin(id);
    if (!invoice) {
      return res.status(404).json({ error: 'not_found' });
    }

    // V0-0: la pantalla del merchant demo muestra la marca de agua DEMO
    res.json({ ...invoice, demo: isDemoMerchant({ id: req.merchantId }) });
  } catch (err) {
    console.error('[GET /admin/invoices/:id]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/invoices/bulk-paid
 * Marca múltiples facturas como pagadas en una sola operación.
 * Body: { ids: number[] }
 */
router.post('/bulk-paid', async (req, res) => {
  try {
    const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
    if (ids.length === 0) return res.status(400).json({ error: 'no_ids' });
    if (ids.length > 100) return res.status(400).json({ error: 'too_many', max: 100 });

    const result = await prisma.invoice.updateMany({
      where: {
        id: { in: ids },
        merchantId: req.merchantId,
        status: { not: 'paid' }, // solo las que aún no están pagadas
      },
      data: { status: 'paid', paidAt: new Date() },
    });

    return res.json({ ok: true, updated: result.count });
  } catch (err) {
    console.error('[POST /admin/invoices/bulk-paid]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * PUT /admin/invoices/:id/status
 * Cambia el estado (pending / paid / expired) – lo usa el botón del BO.
 */
router.put('/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const status = String(req.body?.status || '').toLowerCase();
    if (!['pending', 'paid', 'expired'].includes(status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }

    const updated = await updateInvoiceStatusAdmin(id, status);
    if (!updated) {
      return res.status(404).json({ error: 'not_found' });
    }

    res.json(updated);
  } catch (err) {
    console.error('[PUT /admin/invoices/:id/status]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * (Opcional) Endpoints legacy pay/unpay si quieres mantenerlos
 */
router.post('/:id/pay', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const updated = await markInvoicePaidAdmin(id);
    if (!updated) return res.status(404).json({ error: 'not_found' });
    res.json(updated);
  } catch (err) {
    console.error('[POST /admin/invoices/:id/pay]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/:id/unpay', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const updated = await markInvoicePendingAdmin(id);
    if (!updated) return res.status(404).json({ error: 'not_found' });
    res.json(updated);
  } catch (err) {
    console.error('[POST /admin/invoices/:id/unpay]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/invoices/:id/resend-whatsapp
 * Envía la factura por WhatsApp vía n8n (OnInvoiceSend)
 */
/**
 * POST /admin/invoices/:id/resend-whatsapp
 * Envía la factura por WhatsApp directamente via API de Meta.
 * Ya NO usa n8n.
 */
router.post('/:id/resend-whatsapp', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'invalid_id' });
    }

    // Lógica compartida (asegura cobro + envía payment_request_es)
    const r = await sendInvoicePaymentRequest(id);
    if (!r.ok) {
      const code = r.reason === 'invoice_not_found' ? 404
        : r.reason === 'customer_without_phone' || r.reason === 'invalid_phone_format' ? 400
        : 502;
      return res.status(code).json({ ok: false, error: r.reason || 'whatsapp_send_failed' });
    }

    return res.json({
      ok: true,
      sent: true,
      invoice_id: id,
      charge_id: r.chargeId,
      to: r.to,
    });
  } catch (err) {
    console.error('[POST /admin/invoices/:id/resend-whatsapp]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

/**
 * POST /admin/invoices/:id/send-reminder
 * Envía manualmente un recordatorio de pago al cliente.
 * Usa payment_request_es si la factura tiene charge; texto libre si no.
 * Actualiza el campo reminder7SentAt o reminder14SentAt según corresponda.
 */
router.post('/:id/send-reminder', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const invoice = await prisma.invoice.findFirst({
      where: { id, merchantId: req.merchantId },
      include: { customer: true, merchant: true },
    });

    if (!invoice) return res.status(404).json({ error: 'not_found' });
    if (invoice.status === 'paid') return res.status(409).json({ error: 'invoice_already_paid' });

    const phone = normalizePhone(invoice.customer?.phone);
    if (!phone) return res.status(400).json({ error: 'customer_missing_phone' });

    const customerName = invoice.customer?.name || 'Cliente';
    const merchantName = invoice.merchant?.name || 'tu proveedor';
    const total        = Number(invoice.total).toFixed(2);
    const chargeId     = invoice.chargeId;
    const payUrl       = chargeId ? `${BASE_URL}/pay/card/${chargeId}` : null;

    let sent = false;

    if (payUrl) {
      const result = await sendWhatsAppTemplate({
        to: phone,
        merchantId: invoice.merchantId, // J3: respeta waOptOut
        ...buildPaymentRequest({
          customerName,
          businessName: merchantName,
          invoiceNumber: invoice.number,
          amountWithCurrency: `${total} ${invoice.currency}`,
          chargeId: chargeId as number,
        }),
      });
      sent = result.ok;
      if (!result.ok) {
        console.error('[send-reminder] WA template error:', result.error);
      }
    } else {
      await sendWhatsAppText({
        to: phone,
        merchantId: invoice.merchantId, // V0-2: demo solo a DEMO_SAFE_NUMBERS
        text: `Hola ${customerName} 👋, te recordamos que tienes pendiente el pago de la factura *${invoice.number}* por *${total} ${invoice.currency}* de parte de *${merchantName}*.\n\n¡Gracias!`,
      });
      sent = true;
    }

    // Actualizar el campo de recordatorio correspondiente según antigüedad
    const daysSinceCreation = (Date.now() - new Date(invoice.createdAt).getTime()) / (24 * 60 * 60 * 1000);
    const updateData: any = {};
    if (!invoice.reminder7SentAt)  updateData.reminder7SentAt  = new Date();
    else if (!invoice.reminder14SentAt) updateData.reminder14SentAt = new Date();

    if (Object.keys(updateData).length > 0) {
      await prisma.invoice.update({ where: { id }, data: updateData });
    }

    return res.json({ ok: true, sent, via: payUrl ? 'template' : 'text', phone });
  } catch (err) {
    console.error('[POST /admin/invoices/:id/send-reminder]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/invoices/:id/rectify
 * Emite una FACTURA RECTIFICATIVA (tipo R1, RD 1619/2012) de la factura dada:
 * mismas líneas con importes en NEGATIVO, serie propia (2026-CF-R-001) y
 * referencia a la original. La rectificativa nace 'paid' (no es cobrable: no
 * debe recibir recordatorios y su total negativo resta en el P&L al emitirse).
 */
router.post('/:id/rectify', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const original = await prisma.invoice.findFirst({
      where: { id, merchantId: req.merchantId },
      include: { merchant: true },
    });
    if (!original) return res.status(404).json({ error: 'not_found' });
    if (original.type === 'R1') {
      return res.status(409).json({ error: 'cannot_rectify_rectification' });
    }

    const existing = await prisma.invoice.findFirst({
      where: { merchantId: req.merchantId, rectifiesId: id },
      select: { id: true, number: true },
    });
    if (existing) {
      return res.status(409).json({ error: 'already_rectified', rectification: existing });
    }

    // Líneas en negativo; si la original no tiene líneas, una única línea por el total
    const origLines = Array.isArray(original.lines) ? (original.lines as any[]) : [];
    const negLines = origLines.length > 0
      ? origLines.map((l: any) => ({ ...l, price: -(Number(l.price) || 0) }))
      : [{ concept: `Rectificación de la factura ${original.number}`, qty: 1, price: -Number(original.total), tax: 0 }];

    // V0-0: los justificantes no se rectifican (no son facturas) y un merchant ES
    // sin INVOICING_ES_ENABLED no puede emitir R1 (allocate lanzaría invoicing_es_disabled).
    if (isReceiptNumber(original.number)) {
      return res.status(409).json({ error: 'cannot_rectify_receipt' });
    }

    const rect = await prisma.$transaction(async (tx) => {
      const number = await allocateInvoiceNumber(tx, req.merchantId, { rectifying: true });
      return tx.invoice.create({
        data: {
          merchantId: original.merchantId,
          customerId: original.customerId,
          quoteId: original.quoteId,
          number,
          total: (-Number(original.total)).toFixed(2),
          currency: original.currency,
          lines: negLines,
          type: 'R1',
          rectifiesId: original.id,
          status: 'paid',
          paidAt: new Date(),
          pdfUrl: 'PENDING_PDF',
          qrData: 'PENDING_QR',
          registerId: null,
        },
      });
    });

    // VeriFactu (tipoFactura R1) para merchants españoles con NIF
    let vfApplied = false;
    if (original.merchant?.country === 'ES' && original.merchant.taxId) {
      try {
        await applyVeriFactu(rect, original.merchant.taxId, prisma);
        vfApplied = true;
      } catch (e) {
        console.error('[rectify] Error al aplicar VeriFactu:', e);
      }
    }

    recordCustomerEvent({
      merchantId: original.merchantId,
      customerId: original.customerId,
      type: 'invoice_rectified',
      title: `Factura ${original.number} rectificada (${rect.number})`,
      meta: { invoiceId: original.id, rectificationId: rect.id },
    });

    return res.status(201).json({
      ok: true,
      id: rect.id,
      number: rect.number,
      total: rect.total.toString(),
      currency: rect.currency,
      rectifies: { id: original.id, number: original.number },
      veriFactu: vfApplied,
    });
  } catch (err) {
    console.error('[POST /admin/invoices/:id/rectify]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/invoices/:id/regenerate-pdf
 * Regenera el PDF de una factura aplicando VeriFactu si corresponde.
 * Útil para facturas creadas antes del sprint VeriFactu.
 */
router.post('/:id/regenerate-pdf', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const invoice = await prisma.invoice.findFirst({
      where: { id, merchantId: req.merchantId },
      include: { merchant: true, customer: true, rectifies: { select: { number: true } } },
    });

    if (!invoice) return res.status(404).json({ error: 'not_found' });
    if (!invoice.merchant || !invoice.customer) {
      return res.status(500).json({ error: 'missing_relations' });
    }

    const merchant  = invoice.merchant;
    let qrData      = invoice.qrData;
    let vfHash      = invoice.vfHash ?? null;

    // (Re)aplicar VeriFactu si es merchant español con NIF (V0-0: nunca a justificantes)
    if (merchant.country === 'ES' && merchant.taxId && !isReceiptNumber(invoice.number)) {
      try {
        const vf = await applyVeriFactu(invoice, merchant.taxId, prisma);
        qrData = vf.qrUrl;
        vfHash = vf.vfHash;
      } catch (e) {
        console.error('[regenerate-pdf] VeriFactu error:', e);
      }
    }

    const invLines = invoice.lines && Array.isArray(invoice.lines)
      ? invoice.lines as any[]
      : [];

    const pdf = await generateInvoicePdf({
      number: invoice.number,
      merchant: {
        name: merchant.name,
        legalName: merchant.legalName,
        taxId: merchant.taxId,
        address: merchant.address,
        logoUrl: merchant.logoUrl,
      },
      customer: {
        name:  invoice.customer.name,
        email: invoice.customer.email,
        phone: invoice.customer.phone,
      },
      currency: invoice.currency,
      total: invoice.total.toString(),
      qrData,
      vfHash,
      createdAt: invoice.createdAt,
      lines: invLines,
      type: invoice.type,
      rectifiesNumber: invoice.rectifies?.number ?? null,
      watermark: isDemoMerchant(merchant) ? DEMO_WATERMARK : null,
    });

    await prisma.invoice.update({
      where: { id },
      data: { pdfUrl: pdf.publicUrlPath, qrData },
    });

    return res.json({ ok: true, pdfUrl: pdf.publicUrlPath, veriFactu: !!vfHash });
  } catch (err) {
    console.error('[POST /admin/invoices/:id/regenerate-pdf]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * GET /admin/invoices/:id/pdf — abre el PDF de la factura.
 * P0-2: genera el PDF BAJO DEMANDA si la factura está en PENDING_PDF o si el
 * fichero no existe (el filesystem de Railway es efímero y se pierde al redeploy).
 * Así "Abrir PDF" siempre sirve un PDF real, sin enlazar nunca a 'PENDING_PDF'.
 */
router.get('/:id/pdf', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    // Scope multi-tenant: 404 si no es del merchant.
    const owned = await prisma.invoice.findFirst({ where: { id, merchantId: req.merchantId }, select: { id: true } });
    if (!owned) return res.status(404).json({ error: 'not_found' });

    // Genera el PDF bajo demanda si falta (helper compartido) y lo sirve.
    const { diskPath, number } = await ensureInvoicePdf(id, prisma);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${number}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    return fs.createReadStream(diskPath).pipe(res);
  } catch (err) {
    console.error('[GET /admin/invoices/:id/pdf]', err);
    return res.status(500).json({ error: 'pdf_generation_failed' });
  }
});

export default router;
