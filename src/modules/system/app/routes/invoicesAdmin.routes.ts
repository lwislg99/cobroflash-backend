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
const N8N_ON_INVOICE_SEND_URL =
  process.env.N8N_ON_INVOICE_SEND_URL || '';

import { BASE_URL } from '../../../../core/config/env';


const router = Router();

/**
 * GET /admin/invoices?status=pending|paid|expired|all&search=texto
 */
router.get('/', async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : 'all';
    const search = req.query.search ? String(req.query.search) : undefined;

    const invoices = await listInvoicesAdmin(status, search);
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
router.post('/:id/resend-whatsapp', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'invalid_id' });
    }

    // Si no hay URL configurada, devolvemos ok pero sin enviar nada
    if (!N8N_ON_INVOICE_SEND_URL) {
      return res.json({
        ok: true,
        sent: false,
        reason: 'n8n_invoice_url_not_configured',
        invoice_id: id,
      });
    }

    // 1) Cargamos la factura con detalle (merchant, customer, quote, etc.)
    const invoice = await getInvoiceDetailAdmin(id);
    if (!invoice) {
      return res.status(404).json({ ok: false, error: 'invoice_not_found' });
    }

    if (!invoice.customer || !invoice.customer.phone) {
      return res.status(400).json({
        ok: false,
        error: 'customer_without_phone',
      });
    }

    const customer = invoice.customer;

    // 2) Creamos un CHARGE para esta factura (para poder pagarla)
    let chargeId: number | null = null;
    let payBankUrl: string | null = null;
    let payCardUrl: string | null = null;

    try {
      const customerPayload = customer
        ? {
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
          }
        : undefined;

      const chargeResp = await fetch(`${BASE_URL}/charges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: invoice.merchantId,
          customer: customerPayload,
          concept: `Factura ${invoice.number} de Presupuesto #${invoice.quoteId}`,
          amount: Number(invoice.total),          // nos aseguramos de que es número
          currency: invoice.currency || 'EUR',
          method_preference: 'card',
          meta: {
            invoice_id: invoice.id,
            quote_id: invoice.quoteId,
          },
        }),
      });

      if (!chargeResp.ok) {
        const text = await chargeResp.text().catch(() => '');
        console.error(
          '[POST /admin/invoices/:id/resend-whatsapp] error al crear charge',
          chargeResp.status,
          text,
        );
        return res.status(502).json({
          ok: false,
          error: 'charge_creation_failed',
          status: chargeResp.status,
          details: text,
        });
      }

      const chargeJson: any = await chargeResp.json().catch(() => null);
      if (!chargeJson?.id) {
        console.error(
          '[POST /admin/invoices/:id/resend-whatsapp] respuesta sin id de charge',
          chargeJson,
        );
        return res.status(502).json({
          ok: false,
          error: 'charge_creation_invalid_response',
        });
      }

      chargeId = chargeJson.id;
      payBankUrl = `${BASE_URL}/pay/bank/${chargeId}`;
      payCardUrl = `${BASE_URL}/pay/card/${chargeId}`;
    } catch (err) {
      console.error(
        '[POST /admin/invoices/:id/resend-whatsapp] excepción creando charge',
        err,
      );
      return res
        .status(500)
        .json({ ok: false, error: 'charge_creation_exception' });
    }

    // 3) Payload para n8n (OnInvoiceSend), ya con charge y URLs
    const payload = {
      invoice_id: invoice.id,
      quote_id: invoice.quoteId,
      charge_id: chargeId,
      to: customer.phone,
      customer_name: customer.name || 'Cliente',
      amount: invoice.total?.toString() ?? '0',
      currency: invoice.currency || 'EUR',
      concept: `Factura ${invoice.number} de Presupuesto #${invoice.quoteId}`,
      pay_bank_url: payBankUrl,
      pay_card_url: payCardUrl,
    };

    const n8nResponse = await fetch(N8N_ON_INVOICE_SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const n8nBody = (await n8nResponse.json().catch(() => null)) as unknown;

    if (!n8nResponse.ok) {
      return res.status(502).json({
        ok: false,
        error: 'n8n_error',
        status: n8nResponse.status,
        n8n_body: n8nBody,
      });
    }

    return res.json({
      ok: true,
      sent: true,
      invoice_id: invoice.id,
      n8n_result: n8nBody,
    });
  } catch (err) {
    console.error('[POST /admin/invoices/:id/resend-whatsapp]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});


export default router;
