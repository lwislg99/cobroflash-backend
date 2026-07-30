// src/modules/system/app/routes/invoicesAdmin.routes.ts
import { Router } from 'express';
import { recordAudit, requestIp, actorDeRequest, sobreFiscal, flagsFiscalesDe } from '../../audit.service'; // A11.1 (S2) · SCRUM-207
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
import { applyVeriFactu, applyVeriFactuAnulacion } from '../../../invoicing/domain/verifactu.service'; // SCRUM-153
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
import { ensureInvoicePdf, ensureChargeReceiptToken } from '../../../../lib/invoicing';
import { sendSuccessBody, sendFailureBody, SEND_FAILURE_MESSAGES, type SendFailureReason } from '../../../../lib/sendOutcome'; // SCRUM-126
import { esErrorSinSellar, ERROR_SIN_SELLAR } from '../../../invoicing/domain/portonDocumento'; // SCRUM-206


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
    // SCRUM-85: token OPACO para que el frontend construya /pay/invoice sin usar chargeId.
    const payToken = invoice.chargeId ? await ensureChargeReceiptToken(invoice.chargeId, prisma) : null;
    res.json({ ...invoice, demo: isDemoMerchant({ id: req.merchantId }), waDelivery, payToken });
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
      // SCRUM-126: precondición real (nunca se intentó el envío) → status real, sin `sent`.
      // Este era el ÚNICO de los 9 endpoints de envío que trataba una política de envío
      // (opt-out/tope/demo) como error de servidor (502) — el resto ya usaba 200+soft-fail.
      // Se alinea: cualquier motivo que NO sea precondición pasa a 200 (ok:true, sent:false).
      if (r.reason === 'invoice_not_found') {
        return res.status(404).json({ ok: false, error: r.reason, message: 'Factura no encontrada.' });
      }
      if (r.reason === 'customer_missing_phone' || r.reason === 'invalid_phone_format') {
        const PRECONDITION_MESSAGES: Record<string, string> = {
          customer_missing_phone: 'Este cliente no tiene teléfono guardado — añádelo o envíale el enlace por email.',
          invalid_phone_format: 'El teléfono del cliente no tiene un formato válido.',
        };
        return res.status(400).json({ ok: false, error: r.reason, message: PRECONDITION_MESSAGES[r.reason] });
      }
      // Envío intentado, no salió (wa_opt_out/daily_cap/customer_daily_cap/demo_safe_numbers/
      // charge_creation_*/whatsapp_send_failed) — A20.5 (J5): charge_id/pay_token SIEMPRE
      // presentes para que la UI pueda ofrecer "Copiar enlace" aunque WhatsApp falle.
      const reason: SendFailureReason =
        r.reason && r.reason in SEND_FAILURE_MESSAGES ? (r.reason as SendFailureReason) : 'whatsapp_send_failed';
      return res.status(200).json(sendFailureBody(reason, {
        charge_id: r.chargeId ?? null,
        pay_token: r.payToken ?? null, // SCRUM-85: el frontend debe construir /pay/invoice con ESTO, no charge_id
      }));
    }

    return res.json(sendSuccessBody({
      invoice_id: id,
      charge_id: r.chargeId,
      pay_token: r.payToken ?? null,
      to: r.to,
    }));
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
    // SCRUM-126: "customer_missing_email" (no "customer_without_email") — mismo código
    // que usa quotesAdmin.routes.ts para la misma condición en /admin/quotes/:id/send-email.
    if (!invoice.customer?.email) {
      return res.status(400).json({ ok: false, error: 'customer_missing_email', message: 'Este cliente no tiene email guardado.' });
    }

    const { sendInvoiceEmail } = await import('../../../messaging/domain/email.service');
    await sendInvoiceEmail({ invoiceId: id, toEmail: invoice.customer.email, toName: invoice.customer.name || undefined, prisma });
    return res.json(sendSuccessBody({ to: invoice.customer.email }));
  } catch (err: any) {
    console.error('[POST /admin/invoices/:id/send-email]', err?.message || err);
    // SCRUM-126: antes CUALQUIER fallo (incluido un simple error de Resend) devolvía 500
    // genérico — el único de los 9 endpoints sin rama de soft-fail. Se alinea con el
    // hermano de presupuestos (quotesAdmin.routes.ts): 200 + sent:false, salvo que sea
    // realmente la factura la que no existe (defensivo: el caller ya la comprobó arriba).
    if (err?.message === 'invoice_not_found') return res.status(404).json({ ok: false, error: 'not_found' });
    return res.status(200).json(sendFailureBody('email_send_failed'));
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

    // SCRUM-126: precondición real (nunca se intentó el envío) — ok:false explícito,
    // antes iba bare {error} sin `ok` (inconsistente con el resto de los 9 endpoints).
    if (!invoice) return res.status(404).json({ ok: false, error: 'not_found' });
    if (invoice.status === 'paid') return res.status(409).json({ ok: false, error: 'invoice_already_paid' });

    const phone = normalizePhone(invoice.customer?.phone);
    if (!phone) return res.status(400).json({ ok: false, error: 'customer_missing_phone' });

    const customerName = invoice.customer?.name || 'Cliente';
    const merchantName = invoice.merchant?.name || 'tu proveedor';
    const total        = Number(invoice.total).toFixed(2);
    const chargeId     = invoice.chargeId;
    // SCRUM-85: token OPACO — NUNCA el chargeId en la URL pública (el botón real de
    // payment_request_es apunta a /pay/invoice/{{1}}, ver WHATSAPP_TEMPLATES.md §2).
    const payToken     = chargeId ? await ensureChargeReceiptToken(chargeId, prisma) : null;
    const payUrl       = payToken ? `${BASE_URL}/pay/invoice/${payToken}` : null;

    let sent = false;
    // SCRUM-126: antes `sent:false` viajaba SIN explicar por qué — el único de los 9
    // endpoints que no decía nada del motivo. failReason lo captura para el cuerpo final.
    let failReason: SendFailureReason = 'whatsapp_send_failed';

    if (payUrl) {
      const result = await sendWhatsAppTemplate({
        to: phone,
        merchantId: invoice.merchantId, // J3: respeta waOptOut
        ...buildPaymentRequest({
          customerName,
          businessName: merchantName,
          invoiceNumber: invoice.number,
          amountWithCurrency: `${total} ${invoice.currency}`,
          urlToken: payToken as string,
        }),
      });
      sent = result.ok;
      if (!result.ok) {
        console.error('[send-reminder] WA template error:', result.error);
        if ((result as any)?.reason && (result as any).reason in SEND_FAILURE_MESSAGES) failReason = (result as any).reason;
      }
    } else {
      // SCRUM-116: antes ponía `sent = true` SIN mirar el retorno, así que ni el `sent:false`
      // del cuerpo llegaba a aparecer: el backend afirmaba haber enviado.
      const result = await sendWhatsAppText({
        to: phone,
        merchantId: invoice.merchantId, // V0-2: demo solo a DEMO_SAFE_NUMBERS
        text: `Hola ${customerName} 👋, te recordamos que tienes pendiente el pago de la factura *${invoice.number}* por *${total} ${invoice.currency}* de parte de *${merchantName}*.\n\n¡Gracias!`,
        // SCRUM-115: si falla, que la fila de WA-0b quede enlazada a ESTA factura/cliente.
        log: { customerId: invoice.customerId, relatedType: 'invoice', relatedId: id },
      });
      sent = !!result?.ok;
      if (!sent) {
        console.error('[send-reminder] WA texto NO entregado:', (result as any)?.error || (result as any)?.reason);
        if ((result as any)?.reason && (result as any).reason in SEND_FAILURE_MESSAGES) failReason = (result as any).reason;
      }
    }

    // SCRUM-116: la fecha se marca SOLO si el envío salió. Antes se escribía siempre, y como
    // el cron filtra por `reminderXSentAt: null`, un fallo sacaba la factura de su `where`
    // PARA SIEMPRE: nadie volvía a reclamarla. El registro decía «recordado» y el usuario leía
    // «✓ enviado». Ahora, si falla, la factura sigue viva para la pasada de mañana.
    if (sent) {
      const updateData: any = {};
      if (!invoice.reminder7SentAt)  updateData.reminder7SentAt  = new Date();
      else if (!invoice.reminder14SentAt) updateData.reminder14SentAt = new Date();

      if (Object.keys(updateData).length > 0) {
        await prisma.invoice.update({ where: { id }, data: updateData });
      }
    }

    const extra = { via: payUrl ? 'template' : 'text', phone };
    return res.json(sent ? sendSuccessBody(extra) : sendFailureBody(failReason, extra));
  } catch (err) {
    console.error('[POST /admin/invoices/:id/send-reminder]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

/**
 * SCRUM-153 · MOTIVOS DE ANULACIÓN — lista CERRADA, y no es burocracia.
 *
 * El registro oficial de la AEAT no lleva motivo (comprobado contra el XSD: `RegistroAnulacion`
 * no tiene dónde ponerlo), así que esto es INTERNO. Cerrada y no texto libre por tres razones:
 * RGPD —un campo libre en zona fiscal invita a escribir datos personales que no hay obligación
 * de recoger—, porque así se puede CONTAR (un 60 % de «duplicada» es un bug de producto, no un
 * hábito del usuario), y porque hace verificable la regla de abajo.
 *
 * ⚠️ ANULAR ≠ RECTIFICAR, y esto ACOTA la ruta: se anula lo que NUNCA DEBIÓ EXISTIR (duplicado,
 * prueba, error de subida). Si la operación SÍ existió y el importe está mal, eso es una R1
 * (`/rectify`, justo debajo). Los motivos son todos de «no hubo operación» a propósito: son lo
 * que hace cumplible esa regla en vez de dejarla en un comentario.
 */
const MOTIVOS_ANULACION = ['duplicada', 'error_sin_operacion', 'datos_cliente', 'prueba'] as const;

/**
 * POST /admin/invoices/:id/annul — SCRUM-153 · ANULAR una factura emitida.
 *
 * La maquinaria fiscal existía desde SCRUM-145 (`applyVeriFactuAnulacion`, huella encadenada,
 * columnas ya en staging y prod): lo que faltaba era el disparador. La Parte L declaraba
 * `pending → annulled` y no había nadie que la ejecutara.
 *
 * TRES COSAS QUE NO SON OBVIAS Y SON EL TICKET ENTERO:
 *
 * 1. NO BORRA NADA. La factura sigue existiendo, anulada, con su registro de alta intacto y su
 *    anulación encadenada detrás (regla 29). Su número NO se reutiliza: el hueco en la serie es
 *    correcto, no un fallo que haya que «arreglar» renumerando.
 *
 * 2. LIBERA los albaranes — cambio de criterio de P10 (expediente fiscal, 27-jul-2026). Una
 *    factura anulada no cobró nada, así que ese trabajo SIGUE SIN FACTURAR y su plazo del
 *    art. 13.2 sigue corriendo. Dejarlo ligado significaría que el pro no puede volver a
 *    facturarlo nunca: no es un apunte contable, es dinero real que no se cobra.
 *
 * 3. EL LIBRO DE SCRUM-170 SE ENTERA. Lo facturado de cada línea es la suma de las filas de
 *    facturas no anuladas, así que hay que decirle CUÁL deja de contar. Es el único punto del
 *    flujo donde una anulación puede perder dinero en silencio: sin esto el albarán quedaría
 *    «facturado» por cantidades anuladas y ese trabajo no volvería a aparecer en la bandeja.
 */
router.post('/:id/annul', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const motivo = String(req.body?.motivo || '');
    if (!(MOTIVOS_ANULACION as readonly string[]).includes(motivo)) {
      return res.status(400).json({
        error: 'motivo_invalido',
        message: 'Elige por qué se anula: duplicada, emitida por error, datos del cliente equivocados o prueba.',
        motivos: MOTIVOS_ANULACION,
      });
    }

    // SCRUM-207: `include: { merchant: … }` es ADITIVO — solo para congelar los flags
    // fiscales del momento en el registro. No cambia ninguna condición de este flujo.
    const invoice = await prisma.invoice.findFirst({
      where: { id, merchantId: req.merchantId },
      include: { merchant: { select: { id: true, country: true, flags: true } } },
    });
    if (!invoice) return res.status(404).json({ error: 'not_found' });

    // Idempotente: volver a anular lo ya anulado no es error del usuario, y sobre todo NO repite
    // el sellado — una segunda huella de anulación en la cadena sería un registro falso.
    if (invoice.status === 'annulled') {
      return res.json({ ok: true, status: 'annulled', yaEstaba: true });
    }
    // Una factura COBRADA no se anula: el dinero entró, la operación existió. Eso es devolución
    // + R1 (y ninguno de los motivos de arriba podría ser cierto).
    if (invoice.status !== 'pending') {
      return res.status(409).json({
        error: 'invoice_not_pending',
        message: 'Solo se anula una factura pendiente. Si ya se cobró, hay que rectificarla (R1), no anularla.',
      });
    }
    // V0-0: un justificante J- no está en la cadena fiscal; no hay anulación que registrar.
    if (isReceiptNumber(invoice.number)) {
      return res.status(409).json({
        error: 'receipt_not_annullable',
        message: 'Este documento es un justificante, no una factura fiscal: no entra en la cadena VeriFactu.',
      });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId }, select: { taxId: true, country: true },
    });

    // ── 1) EL SELLADO, PRIMERO Y FUERA DE TODA TRANSACCIÓN (SCRUM-173/177) ──────────────────
    // `applyVeriFactuAnulacion` extiende LA MISMA cadena que el alta y trae su propio cerrojo
    // por merchant; llamarla dentro de una `$transaction` lanza a propósito. Va ANTES del cambio
    // de estado porque el orden inverso dejaría una factura marcada como anulada sin registro
    // que lo respalde: una huella sin estado se reintenta, un estado sin huella no se deshace.
    let sellada = false;
    if (merchant?.country === 'ES' && merchant?.taxId) {
      try {
        await applyVeriFactuAnulacion(invoice, merchant.taxId, prisma);
        sellada = true;
      } catch (e: any) {
        console.error(`[annul] sellado de anulación falló en ${invoice.number}:`, e?.message || e);
        return res.status(409).json({
          error: 'anulacion_no_sellada',
          message: 'No se pudo registrar la anulación en la cadena VeriFactu, así que no se ha anulado nada. Inténtalo de nuevo.',
        });
      }
    }

    // ── 2) ESTADO + LIBERACIÓN, en UNA transacción ──────────────────────────────────────────
    const liberados = await prisma.$transaction(async (tx) => {
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'annulled' } });
      // P10 (criterio nuevo): los albaranes que consolidó vuelven a estar pendientes.
      const albs = await tx.albaran.updateMany({
        where: { merchantId: req.merchantId, invoiceId: invoice.id },
        data: { invoiceId: null },
      });
      // SCRUM-170: y lo facturado por la vía PARCIAL deja de contar. Borrar sus filas equivale a
      // excluirlas de la suma y no deja dos fuentes de verdad conviviendo.
      const libro = await tx.albaranLineaFacturada.deleteMany({
        where: { merchantId: req.merchantId, invoiceId: invoice.id },
      });
      return { albaranes: albs.count, lineasLibro: libro.count };
    });

    // SCRUM-207 (D-3): antes esto y la rectificativa R1 compartían `anular_factura`, así que
    // por el campo `action` NO se distinguían dos hechos fiscales que no son el mismo (R10,
    // regla 29). Ahora cada uno tiene el suyo. Las filas viejas NO se tocan — reescribir un
    // registro de auditoría para «limpiarlo» es lo que este módulo existe para impedir; la
    // regla de unión para consultarlas vive en `auditoriaFiscal.query.ts`.
    recordAudit({
      merchantId: req.merchantId!, teamMemberId: req.teamMemberId ?? null,
      action: 'factura_anulada', entityType: 'invoice', entityId: invoice.id,
      meta: sobreFiscal({
        actor: actorDeRequest(req),
        flagsFiscales: flagsFiscalesDe(invoice.merchant ?? null),
        payload: { numero: invoice.number, motivo, estabaSellada: sellada, ...liberados },
      }),
      ip: requestIp(req),
    });

    return res.json({
      ok: true,
      status: 'annulled',
      number: invoice.number,
      motivo,
      veriFactu: sellada,
      liberados,
      // El aviso viaja también en la respuesta: quien llame por API tiene que saberlo igual.
      message: `La factura ${invoice.number} queda anulada. Sigue existiendo con su registro, y su número no se reutiliza.`,
    });
  } catch (err: any) {
    console.error('[POST /admin/invoices/:id/annul]', err?.message || err);
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
      const number = await allocateInvoiceNumber(tx, req.merchantId, {
        rectifying: true, camino: 'C5', actor: actorDeRequest(req),
      });
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

    // A11.1 (S2) · SCRUM-207 (D-3): `factura_rectificada`, ya no `anular_factura`.
    // Rectificar NO es anular: la original sigue existiendo con su huella (regla 29).
    recordAudit({
      merchantId: req.merchantId, teamMemberId: req.teamMemberId ?? null,
      action: 'factura_rectificada', entityType: 'invoice', entityId: original.id,
      meta: sobreFiscal({
        actor: actorDeRequest(req),
        flagsFiscales: flagsFiscalesDe(original.merchant ?? null),
        payload: {
          numeroOriginal: original.number,
          numeroRectificativa: rect.number,
          rectificationId: rect.id,
          // `TipoRectificativa` (S sustitución vs I diferencias) NO se registra porque el
          // generador aún NO lo emite y elegirlo es una calificación FISCAL, no de
          // implementación (SEMAFORO_CALIBRACION §8.4, pendiente del asesor). Inventarlo
          // aquí sería poner en un registro de auditoría un dato que nadie ha decidido.
          estabaSellada: !!original.vfHash,
        },
      }),
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
 * SCRUM-55: reescribe el PDF de una factura EMITIDA (regla 29) → admin. Era la única
 * mutación sin gate entre 12 hermanas todas gateadas: se añadió después que ellas.
 */
router.post('/:id/regenerate-pdf', requireRole('admin'), async (req, res) => {
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
      invoiceId: invoice.id,          // SCRUM-72
      merchantId: invoice.merchantId, // SCRUM-72
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
      stageLabel: invoice.stageLabel, // SCRUM-33
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
    // SCRUM-206: no es un fallo de generación, y llamarlo así manda a quien depure al sitio
    // equivocado. La factura existe y NO está registrada: 409 con su código.
    if (esErrorSinSellar(err)) {
      return res.status(409).json({
        error: ERROR_SIN_SELLAR,
        // Microcopy OFICIAL: aprobado por el fundador el 30-jul-2026 (regla 30). Lo ve el
        // PROFESIONAL al pulsar «Abrir PDF» de una factura cuyo sellado falló.
        message: 'Esta factura todavía no está registrada. Se reintenta solo; si sigue así, avísanos.',
      });
    }
    return res.status(500).json({ error: 'pdf_generation_failed' });
  }
});

export default router;
