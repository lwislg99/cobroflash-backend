// src/modules/billing/app/routes/payMp.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { documentNotFoundHtml } from '../../../../core/http/publicNotFound';
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

  if (!charge)            return res.status(404).send(documentNotFoundHtml());
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
    expired:  { emoji: '⚠️', title: 'Cobro vencido',           msg: 'Este cobro ha vencido. Contacta con el profesional.',       color: '#6b756f' },
  };

  const s = statusMap[status] || statusMap['pending'];

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(s.title)} — YaQu</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    :root{--ink:#0f1c17;--muted:#6b756f;--bg:#f6f7f5;--surface:#fff;--border:#e7e9e5}
    *{box-sizing:border-box}
    body{font-family:'Inter',system-ui,-apple-system,sans-serif;font-feature-settings:"cv11","ss01";margin:0;background:var(--bg);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem;-webkit-font-smoothing:antialiased}
    .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:0 1px 2px rgba(16,24,40,.04),0 12px 32px -12px rgba(16,24,40,.12);padding:2.5rem 2rem;max-width:420px;width:100%;text-align:center}
    .emoji{font-size:3rem;margin-bottom:1rem}
    h1{margin:0 0 .5rem;font-size:1.4rem;font-weight:700;letter-spacing:-.01em;color:${esc(s.color)};text-wrap:balance}
    p{color:var(--muted);margin:.5rem 0;line-height:1.5}
    .amount{font-size:1.3rem;font-weight:800;color:var(--ink);letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin:1rem 0}
    .badge{display:inline-block;padding:.25rem .75rem;border-radius:999px;font-size:.75rem;font-weight:700;letter-spacing:.04em;background:${esc(s.color)}1a;color:${esc(s.color)};margin-bottom:1rem}
    .footer{margin-top:2rem;font-size:.75rem;color:var(--muted)}
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${s.emoji}</div>
    <span class="badge">${esc(status.toUpperCase())}</span>
    <h1>${esc(s.title)}</h1>
    <p>${esc(s.msg)}</p>
    ${concept ? `<div class="amount">${esc(amount)} ${esc(currency)}<br/><span style="font-size:.85rem;font-weight:400;color:#6b756f">${esc(concept)}</span></div>` : ''}
    <div class="footer">YaQu · Pago gestionado con Mercado Pago</div>
  </div>
</body>
</html>`);
});

export default router;
