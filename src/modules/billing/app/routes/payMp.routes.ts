// src/modules/billing/app/routes/payMp.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { config, BASE_URL } from '../../../../core/config/env';
import { esc } from '../../../../core/utils/utils';
import { createMpPreference } from '../../../../integrations/mercadopago';

const router = Router();

/**
 * GET /pay/mp/:id
 * Crea (o reutiliza) una preferencia de Mercado Pago y redirige al checkout.
 */
router.get('/mp/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).send('ID inválido');

  const charge = await prisma.charge.findUnique({
    where: { id },
    include: { customer: true, merchant: true },
  });

  if (!charge)            return res.status(404).send('Cobro no encontrado');
  if (charge.status === 'paid')    return res.redirect(`${BASE_URL}/pay/mp/${id}/result?status=approved`);
  if (charge.status === 'expired') return res.redirect(`${BASE_URL}/pay/mp/${id}/result?status=expired`);

  const accessToken = (charge.merchant as any)?.mpAccessToken || config.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(503).send('Mercado Pago no está configurado para este merchant.');
  }

  try {
    // Reutilizar preferencia existente si ya la creamos antes (stored in intentId)
    let checkoutUrl: string;

    if (charge.intentId && charge.intentId.startsWith('mp_pref_')) {
      // La preferencia ya existe — reconstruir URL de checkout
      const prefId = charge.intentId.replace('mp_pref_', '');
      const isProd = process.env.NODE_ENV === 'production';
      checkoutUrl = isProd
        ? `https://www.mercadopago.com/checkout/v1/redirect?pref_id=${prefId}`
        : `https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=${prefId}`;
    } else {
      const pref = await createMpPreference({
        chargeId: charge.id,
        title: charge.concept,
        amount: Number(charge.amount),
        currency: charge.currency,
        customerName: charge.customer?.name,
        customerEmail: charge.customer?.email,
        notificationUrl: `${BASE_URL}/webhooks/mp`,
        backBaseUrl: BASE_URL,
        accessToken,
      });

      checkoutUrl = pref.checkoutUrl;

      // Guardar preferenceId para idempotencia
      await prisma.charge.update({
        where: { id: charge.id },
        data: { intentId: `mp_pref_${pref.preferenceId}` },
      });
    }

    return res.redirect(checkoutUrl);
  } catch (err: any) {
    console.error('[payMp] Error creando preferencia MP:', err?.response?.data || err?.message);
    return res.status(502).send('Error al conectar con Mercado Pago. Inténtalo de nuevo.');
  }
});

/**
 * GET /pay/mp/:id/result?status=approved|rejected|pending|expired
 * Página de resultado que Mercado Pago muestra tras el pago.
 */
router.get('/mp/:id/result', async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.query.status || 'pending');

  let concept = '', amount = '', currency = '';
  try {
    const charge = await prisma.charge.findUnique({ where: { id } });
    if (charge) {
      concept  = charge.concept;
      amount   = Number(charge.amount).toFixed(2);
      currency = charge.currency;
    }
  } catch {}

  const statusMap: Record<string, { emoji: string; title: string; msg: string; color: string }> = {
    approved: { emoji: '✅', title: '¡Pago aprobado!',        msg: 'Tu pago ha sido procesado correctamente.',                  color: '#16a34a' },
    rejected: { emoji: '❌', title: 'Pago rechazado',          msg: 'El pago no pudo procesarse. Inténtalo de nuevo.',           color: '#dc2626' },
    pending:  { emoji: '⏳', title: 'Pago en proceso',         msg: 'Tu pago está siendo procesado. Te notificaremos pronto.',   color: '#d97706' },
    expired:  { emoji: '⚠️', title: 'Cobro vencido',           msg: 'Este cobro ha vencido. Contacta con el profesional.',       color: '#6b7280' },
  };

  const s = statusMap[status] || statusMap['pending'];

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(s.title)} — YaQu</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;margin:0;background:#f9fafb;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
    .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:2.5rem 2rem;max-width:420px;width:100%;text-align:center}
    .emoji{font-size:3rem;margin-bottom:1rem}
    h1{margin:0 0 .5rem;font-size:1.4rem;color:${esc(s.color)}}
    p{color:#6b7280;margin:.5rem 0}
    .amount{font-size:1.1rem;font-weight:600;color:#111;margin:1rem 0}
    .badge{display:inline-block;padding:.25rem .75rem;border-radius:99px;font-size:.8rem;font-weight:600;background:${esc(s.color)}22;color:${esc(s.color)};margin-bottom:1rem}
    .footer{margin-top:2rem;font-size:.75rem;color:#9ca3af}
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${s.emoji}</div>
    <span class="badge">${esc(status.toUpperCase())}</span>
    <h1>${esc(s.title)}</h1>
    <p>${esc(s.msg)}</p>
    ${concept ? `<div class="amount">${esc(amount)} ${esc(currency)}<br/><span style="font-size:.85rem;font-weight:400;color:#6b7280">${esc(concept)}</span></div>` : ''}
    <div class="footer">YaQu · Pago gestionado con Mercado Pago</div>
  </div>
</body>
</html>`);
});

export default router;
