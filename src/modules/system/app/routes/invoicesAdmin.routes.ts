// src/modules/system/app/routes/invoicesAdmin.routes.ts
import { Router } from 'express';
import {
  listInvoicesAdmin,
  getInvoiceDetailAdmin,
  updateInvoiceStatusAdmin,
  markInvoicePaidAdmin,
  markInvoicePendingAdmin,
} from '../../invoiceAdmin';

import fetch from 'node-fetch';

import { BASE_URL } from '../../../../core/config/env';
import { prisma } from '../../../../core/db/prisma';
import { applyVeriFactu } from '../../../invoicing/domain/verifactu.service';
import { generateInvoicePdf } from '../../../../lib/pdf';

import { sendWhatsAppTemplate, sendWhatsAppText } from '../../../../integrations/whatsapp';
import { normalizePhone } from '../../../../core/utils/utils';


const router = Router();

/**
 * GET /admin/invoices?status=pending|paid|expired|all&search=texto
 */
router.get('/', async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : 'all';
    const search = req.query.search ? String(req.query.search) : undefined;

    const invoices = await listInvoicesAdmin(req.merchantId, status, search);
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

    res.json(invoice);
  } catch (err) {
    console.error('[GET /admin/invoices/:id]', err);
    res.status(500).json({ error: 'internal_error' });
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

    const invoice = await getInvoiceDetailAdmin(id);
    if (!invoice) {
      return res.status(404).json({ ok: false, error: 'invoice_not_found' });
    }

    if (!invoice.customer?.phone) {
      return res.status(400).json({ ok: false, error: 'customer_without_phone' });
    }

    const customer = invoice.customer;

    // Idempotencia: si ya tiene charge, reutilizamos
    let chargeId: number | null = invoice.chargeId ?? null;
    let payCardUrl: string | null = null;

    if (!chargeId) {
      const chargeResp = await fetch(`${BASE_URL}/charges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: invoice.merchantId,
          customer: {
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
          },
          concept: `Factura ${invoice.number}`,
          amount: Number(invoice.total),
          currency: invoice.currency || 'EUR',
          method_preference: 'card',
          meta: { invoice_id: invoice.id, quote_id: invoice.quoteId },
        }),
      });

      if (!chargeResp.ok) {
        return res.status(502).json({ ok: false, error: 'charge_creation_failed' });
      }

      const chargeJson: any = await chargeResp.json().catch(() => null);
      if (!chargeJson?.id) {
        return res.status(502).json({ ok: false, error: 'charge_creation_invalid_response' });
      }

      chargeId = chargeJson.id;

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { chargeId },
      });
    }

    payCardUrl = `${BASE_URL}/pay/card/${chargeId}`;

    // Envío directo por WhatsApp con plantilla payment_request_es
    // Variables:
    //   {{1}} = nombre cliente
    //   {{2}} = número factura
    //   {{3}} = importe
    //   {{4}} = URL de pago
    const to = normalizePhone(customer.phone);
    if (!to) {
      return res.status(400).json({ ok: false, error: 'invalid_phone_format' });
    }

    const result = await sendWhatsAppTemplate({
      to,
      templateName: 'payment_request_es',
      languageCode: 'es',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: customer.name || 'Cliente' },
            { type: 'text', text: invoice.number },
            { type: 'text', text: Number(invoice.total).toFixed(2) },
            { type: 'text', text: payCardUrl },
          ],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            { type: 'text', text: String(chargeId) },
          ],
        },
      ],
    });

    if (!result.ok) {
      console.error('[resend-whatsapp] Error Meta API:', result.error);
      return res.status(502).json({ ok: false, error: 'whatsapp_send_failed', detail: result.error });
    }

    return res.json({
      ok: true,
      sent: true,
      invoice_id: invoice.id,
      charge_id: chargeId,
      to,
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
        templateName: 'payment_request_es',
        languageCode: 'es',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: customerName },
              { type: 'text', text: invoice.number },
              { type: 'text', text: total },
              { type: 'text', text: payUrl },
            ],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: String(chargeId) }],
          },
        ],
      });
      sent = result.ok;
      if (!result.ok) {
        console.error('[send-reminder] WA template error:', result.error);
      }
    } else {
      await sendWhatsAppText({
        to: phone,
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
      include: { merchant: true, customer: true },
    });

    if (!invoice) return res.status(404).json({ error: 'not_found' });
    if (!invoice.merchant || !invoice.customer) {
      return res.status(500).json({ error: 'missing_relations' });
    }

    const merchant  = invoice.merchant;
    let qrData      = invoice.qrData;
    let vfHash      = invoice.vfHash ?? null;

    // (Re)aplicar VeriFactu si es merchant español con NIF
    if (merchant.country === 'ES' && merchant.taxId) {
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

export default router;
