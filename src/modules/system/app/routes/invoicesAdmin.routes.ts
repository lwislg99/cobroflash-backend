// src/modules/system/app/routes/invoicesAdmin.routes.ts
import { Router } from 'express';
import { recordAudit, requestIp } from '../../audit.service'; // A11.1 (S2)
import { requireRole } from '../../../../core/http/authMiddleware'; // A21.3 (S1)
import { UnpayNotAllowedError } from '../../invoiceAdmin';
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
import { getDeliveryStatus } from '../../../messaging/domain/whatsappLog.service';
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

    const invoice = await getInvoiceDetailAdmin(id, req.merchantId); // A21.3: scoped
    if (!invoice) {
      return res.status(404).json({ error: 'not_found' });
    }

    // V0-0: la pantalla del merchant demo muestra la marca de agua DEMO
    // WA-0b: estado de entrega del último WhatsApp de esta factura (chip)
    const waDelivery = await getDeliveryStatus(req.merchantId, 'invoice', id);
    res.json({ ...invoice, demo: isDemoMerchant({ id: req.merchantId }), waDelivery });
  } catch (err) {
    console.error('[GET /admin/invoices/:id]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/invoices/:id/payment-anomaly — A21.2 (V4/V5)
 * F1 = NADA automático: si llegó un importe DISTINTO, la factura sigue pending
 * y aquí solo se ANOTA (ficha 360) para la decisión manual del pro (runbook O).
 */
router.post('/:id/payment-anomaly', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const amount = Number(req.body?.amount);
    if (!Number.isInteger(id) || !Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: 'invalid_input' });
    }
    const invoice = await prisma.invoice.findFirst({
      where: { id, merchantId: req.merchantId },
      select: { id: true, number: true, total: true, currency: true, customerId: true },
    });
    if (!invoice) return res.status(404).json({ error: 'not_found' });

    const total = Number(invoice.total);
    const diff = Math.round((amount - total) * 100) / 100;
    const kind = diff < 0 ? 'parcial' : 'sobrepago';
    const detail = diff < 0
      ? `Recibidos ${amount.toFixed(2)} de ${total.toFixed(2)} ${invoice.currency} (faltan ${Math.abs(diff).toFixed(2)}). La factura SIGUE pendiente — decide: esperar el resto o ajustar con el cliente (runbook V4).`
      : `Recibidos ${amount.toFixed(2)} ${invoice.currency} (sobran ${diff.toFixed(2)}). Anota la devolución manual de la diferencia antes de marcarla pagada (runbook V5).`;

    recordCustomerEvent({
      merchantId: req.merchantId,
      customerId: invoice.customerId,
      type: 'payment_anomaly',
      title: `⚠️ Importe distinto en ${invoice.number} (${kind})`,
      detail,
    });
    return res.json({ ok: true, kind, message: detail });
  } catch (err) {
    console.error('[POST /admin/invoices/:id/payment-anomaly]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * GET /admin/invoices/:id/dispute-package — A21.1 (R14)
 * Paquete de evidencia de disputa en 1 clic: HTML imprimible (→ PDF con el
 * navegador) con TODO lo que el banco pide: presupuesto firmado + evidencia de
 * aceptación (ts/IP/UA) + justificante/factura + registro de mensajes WhatsApp.
 */
router.get('/:id/dispute-package', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });

    const invoice = await prisma.invoice.findFirst({
      where: { id, merchantId: req.merchantId },
      include: {
        merchant: { select: { name: true, legalName: true, taxId: true, address: true } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        quote: true,
        charge: { select: { id: true, method: true, intentId: true, reference: true, status: true } },
      },
    });
    if (!invoice) return res.status(404).json({ error: 'not_found' });

    const quote = invoice.quote as any;
    const messages = await prisma.whatsAppMessage.findMany({
      where: {
        merchantId: req.merchantId,
        OR: [
          ...(invoice.quoteId ? [{ relatedType: 'quote', relatedId: invoice.quoteId }] : []),
          { relatedType: 'invoice', relatedId: invoice.id },
          ...(invoice.chargeId ? [{ relatedType: 'charge', relatedId: invoice.chargeId }] : []),
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fD = (d: Date | string | null | undefined) => d ? new Date(d).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' }) : '—';
    const money = (n: unknown, cur?: string) => `${Number(n ?? 0).toFixed(2)} ${cur || invoice.currency}`;
    const ev = (quote?.evidence ?? {}) as Record<string, unknown>;

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<title>Paquete de disputa · ${esc(invoice.number)}</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;color:#0f1c17;margin:0;padding:32px;max-width:820px;margin:0 auto}
  h1{font-size:22px;margin:0 0 2px} .sub{color:#6b756f;font-size:13px;margin:0 0 22px}
  h2{font-size:15px;border-bottom:2px solid #e7e9e5;padding-bottom:6px;margin:26px 0 10px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  td,th{padding:6px 8px;border-bottom:1px solid #f1f2ee;text-align:left;vertical-align:top}
  th{color:#6b756f;font-weight:600;width:220px}
  .sig{max-width:340px;border:1px solid #e7e9e5;border-radius:8px;padding:8px;background:#fff}
  .badge{display:inline-block;background:#ecfdf5;color:#166534;font-weight:700;border-radius:999px;padding:3px 12px;font-size:12px}
  .print{position:fixed;top:16px;right:16px;background:#16a34a;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer}
  @media print{.print{display:none} body{padding:0}}
</style></head><body>
<button class="print" onclick="window.print()">🖨 Imprimir / PDF</button>
<h1>Paquete de evidencia de disputa</h1>
<p class="sub">${esc(invoice.merchant?.legalName || invoice.merchant?.name)} · generado el ${fD(new Date())} · documento ${esc(invoice.number)}</p>

<h2>1 · Aceptación del presupuesto (firma y evidencia)</h2>
<table>
  <tr><th>Presupuesto</th><td>#${esc(quote?.quoteNumber ?? quote?.id ?? '—')} · ${quote ? money(quote.total, quote.currency) : '—'}</td></tr>
  <tr><th>Aceptado el</th><td>${fD(quote?.acceptedAt)}</td></tr>
  <tr><th>Canal de aceptación</th><td>${esc(quote?.decisionChannel ?? '—')}</td></tr>
  <tr><th>Evidencia técnica</th><td>${['ts','ip','ua','method','typedName'].filter(k => ev[k]).map(k => `<strong>${k.toUpperCase()}</strong>: ${esc(ev[k])}`).join('<br/>') || '—'}</td></tr>
  <tr><th>Firma del cliente</th><td>${quote?.signatureUrl ? `<img class="sig" src="${esc(quote.signatureUrl)}" alt="firma"/>` : (ev.method === 'checkbox' || ev.typedName ? 'Aceptación expresa sin trazo ("Acepto sin firmar") — ver evidencia técnica' : '—')}</td></tr>
  <tr><th>Comentario del cliente</th><td>${esc(quote?.decisionComment ?? '—')}</td></tr>
</table>

<h2>2 · Documento de cobro</h2>
<table>
  <tr><th>Número</th><td>${esc(invoice.number)} <span class="badge">${esc(invoice.status.toUpperCase())}</span></td></tr>
  <tr><th>Emitido</th><td>${fD(invoice.createdAt)}</td></tr>
  <tr><th>Importe</th><td>${money(invoice.total)}</td></tr>
  <tr><th>Pagado el</th><td>${fD(invoice.paidAt)}</td></tr>
  <tr><th>Cliente</th><td>${esc(invoice.customer?.name)} · ${esc(invoice.customer?.phone ?? '')} ${esc(invoice.customer?.email ?? '')}</td></tr>
</table>

<h2>3 · Cobro y referencia del procesador</h2>
<table>
  <tr><th>Método</th><td>${esc(invoice.charge?.method ?? 'manual')}</td></tr>
  <tr><th>Referencia (payment intent)</th><td>${esc(invoice.charge?.intentId ?? invoice.charge?.reference ?? '—')}</td></tr>
  <tr><th>Estado del cobro</th><td>${esc(invoice.charge?.status ?? '—')}</td></tr>
</table>

<h2>4 · Registro de mensajes WhatsApp (entrega y lectura)</h2>
<table>
  <tr><th style="width:170px">Fecha</th><th style="width:110px">Tipo</th><th>Plantilla / doc</th><th style="width:110px">Estado</th></tr>
  ${messages.length ? messages.map((m) => `<tr>
    <td>${fD(m.createdAt)}</td><td>${esc(m.type)}</td>
    <td>${esc(m.templateName ?? '—')} · ${esc(m.relatedType ?? '')} ${esc(m.relatedId ?? '')}</td>
    <td><strong>${esc(m.status)}</strong></td></tr>`).join('') : '<tr><td colspan="4">Sin mensajes registrados</td></tr>'}
</table>

<p class="sub" style="margin-top:26px">La aceptación queda registrada con marca de tiempo, IP y dispositivo en el momento de la firma.
PDF del presupuesto firmado y del justificante: disponibles desde el panel (se adjuntan a la respuesta de la disputa).</p>
</body></html>`;

    return res.status(200).type('html').send(html);
  } catch (err) {
    console.error('[GET /admin/invoices/:id/dispute-package]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/invoices/bulk-paid
 * Marca múltiples facturas como pagadas en una sola operación.
 * Body: { ids: number[] }
 */
router.post('/bulk-paid', requireRole('admin'), async (req, res) => {
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

    // A11.1 (S2): marcar pagado a mano queda auditado (quién, desde dónde, qué)
    recordAudit({
      merchantId: req.merchantId, teamMemberId: req.teamMemberId ?? null,
      action: 'marcar_pagado_manual', entityType: 'invoice',
      meta: { ids, updated: result.count, via: 'bulk' }, ip: requestIp(req),
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
router.put('/:id/status', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const status = String(req.body?.status || '').toLowerCase();
    if (!['pending', 'paid', 'expired'].includes(status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }

    const updated = await updateInvoiceStatusAdmin(id, status, req.merchantId);
    if (!updated) {
      return res.status(404).json({ error: 'not_found' });
    }

    // A11.1 (S2): pagado a mano / deshacer pago auditados con userId+IP
    // (doble click = sin cambio → sin audit duplicado, A21.3)
    if (!(updated as any).__unchanged && (status === 'paid' || status === 'pending')) {
      recordAudit({
        merchantId: req.merchantId, teamMemberId: req.teamMemberId ?? null,
        action: status === 'paid' ? 'marcar_pagado_manual' : 'deshacer_pago',
        entityType: 'invoice', entityId: id,
        meta: { via: 'status', number: (updated as any).number ?? null }, ip: requestIp(req),
      });
    }

    res.json(updated);
  } catch (err) {
    if (err instanceof UnpayNotAllowedError) {
      return res.status(409).json({ error: 'unpay_not_allowed', message: err.message });
    }
    console.error('[PUT /admin/invoices/:id/status]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * (Opcional) Endpoints legacy pay/unpay si quieres mantenerlos
 */
router.post('/:id/pay', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const updated = await markInvoicePaidAdmin(id, req.merchantId);
    if (!updated) return res.status(404).json({ error: 'not_found' });
    if (!(updated as any).__unchanged) recordAudit({ // A11.1 (S2)
      merchantId: req.merchantId, teamMemberId: req.teamMemberId ?? null,
      action: 'marcar_pagado_manual', entityType: 'invoice', entityId: id,
      meta: { via: 'pay' }, ip: requestIp(req),
    });
    res.json(updated);
  } catch (err) {
    console.error('[POST /admin/invoices/:id/pay]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/:id/unpay', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'invalid_id' });
    }

    const updated = await markInvoicePendingAdmin(id, req.merchantId);
    if (!updated) return res.status(404).json({ error: 'not_found' });
    if (!(updated as any).__unchanged) recordAudit({ // A11.1 (S2)
      merchantId: req.merchantId, teamMemberId: req.teamMemberId ?? null,
      action: 'deshacer_pago', entityType: 'invoice', entityId: id,
      meta: { via: 'unpay' }, ip: requestIp(req),
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof UnpayNotAllowedError) {
      return res.status(409).json({ error: 'unpay_not_allowed', message: err.message });
    }
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
router.post('/:id/resend-whatsapp', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'invalid_id' });
    }

    // Lógica compartida (asegura cobro + envía payment_request_es)
    const r = await sendInvoicePaymentRequest(id);
    if (!r.ok) {
      // A20.5 (J5): mensaje HUMANO por motivo + charge_id para que la UI pueda
      // ofrecer SIEMPRE "Copiar enlace" aunque WhatsApp falle.
      const J5_MESSAGES: Record<string, string> = {
        customer_without_phone: 'Este cliente no tiene teléfono guardado — añádelo o envíale el enlace por email.',
        invalid_phone_format: 'El teléfono del cliente no tiene un formato válido.',
        wa_opt_out: 'Este cliente se dio de baja de WhatsApp — envíale el enlace por email o SMS.',
        daily_cap: 'Has llegado al tope diario de envíos — copia el enlace y mándaselo tú.',
        customer_daily_cap: 'Este cliente ya recibió varios mensajes hoy (anti-spam) — copia el enlace.',
        demo_safe_numbers: 'Modo demo seguro: este número no está en la lista de pruebas.',
      };
      const code = r.reason === 'invoice_not_found' ? 404
        : r.reason === 'customer_without_phone' || r.reason === 'invalid_phone_format' ? 400
        : 502;
      return res.status(code).json({
        ok: false,
        error: r.reason || 'whatsapp_send_failed',
        message: J5_MESSAGES[String(r.reason)] || 'No se pudo enviar por WhatsApp — copia el enlace y mándaselo por SMS o llámale.',
        charge_id: r.chargeId ?? null,
      });
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
 * POST /admin/invoices/:id/send-email — A20.5 (J5): el fallback por email del
 * documento de cobro, disponible SIEMPRE que el WhatsApp falle (o a demanda).
 */
router.post('/:id/send-email', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ ok: false, error: 'invalid_id' });

    const invoice = await prisma.invoice.findFirst({
      where: { id, merchantId: req.merchantId },
      include: { customer: { select: { email: true, name: true } } },
    });
    if (!invoice) return res.status(404).json({ ok: false, error: 'not_found' });
    if (!invoice.customer?.email) {
      return res.status(400).json({ ok: false, error: 'customer_without_email', message: 'Este cliente no tiene email guardado.' });
    }

    const { sendInvoiceEmail } = await import('../../../messaging/domain/email.service');
    await sendInvoiceEmail({ invoiceId: id, toEmail: invoice.customer.email, toName: invoice.customer.name || undefined, prisma });
    return res.json({ ok: true, to: invoice.customer.email });
  } catch (err: any) {
    console.error('[POST /admin/invoices/:id/send-email]', err?.message || err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

/**
 * POST /admin/invoices/:id/send-reminder
 * Envía manualmente un recordatorio de pago al cliente.
 * Usa payment_request_es si la factura tiene charge; texto libre si no.
 * Actualiza el campo reminder7SentAt o reminder14SentAt según corresponda.
 */
router.post('/:id/send-reminder', requireRole('admin'), async (req, res) => {
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
router.post('/:id/rectify', requireRole('admin'), async (req, res) => {
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

    // A11.1 (S2): anular vía R1 es la única anulación permitida (regla 29) — auditada
    recordAudit({
      merchantId: req.merchantId, teamMemberId: req.teamMemberId ?? null,
      action: 'anular_factura', entityType: 'invoice', entityId: original.id,
      meta: { number: original.number, rectification: rect.number, rectificationId: rect.id },
      ip: requestIp(req),
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
