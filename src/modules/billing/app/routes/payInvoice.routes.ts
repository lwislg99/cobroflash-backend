// src/modules/billing/app/routes/payInvoice.routes.ts
// Selector de método de pago (tarjeta vía Stripe + transferencia vía PayByBank).
// Es la landing del botón de payment_request_es: /pay/invoice/:chargeId
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { esc } from '../../../../core/utils/utils';

const router = Router();

router.get('/invoice/:chargeId', async (req, res) => {
  res.set('Cache-Control', 'no-store, must-revalidate');

  const id = Number(req.params.chargeId);
  if (!Number.isInteger(id)) return res.status(400).send('ID inválido');

  const charge = await prisma.charge.findUnique({
    where: { id },
    include: { merchant: { select: { name: true, legalName: true } } },
  });
  if (!charge) return res.status(404).send('Cobro no encontrado');

  // Si ya está pagado o vencido, mostramos el recibo en lugar del selector
  if (charge.status === 'paid' || charge.status === 'expired') {
    return res.redirect(303, `/recibo/${id}`);
  }

  const amount = `${Number(charge.amount).toFixed(2)} ${esc(charge.currency)}`;
  const business = esc(charge.merchant?.legalName || charge.merchant?.name || 'Tu proveedor');
  const concept = esc(charge.concept || '');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="theme-color" content="#16a34a"/>
  <title>Pagar — YaQu</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    :root{--brand:#16a34a;--brand-tint:#ecfdf5;--ink:#0f1c17;--body:#3f4a45;--muted:#6b756f;
      --bg:#f6f7f5;--surface:#fff;--border:#e7e9e5;--slate-50:#f7f8f6;}
    *{box-sizing:border-box}
    body{font-family:'Inter',system-ui,-apple-system,sans-serif;font-feature-settings:"cv11","ss01";
      margin:0;background:var(--bg);color:var(--body);min-height:100vh;display:flex;
      align-items:center;justify-content:center;padding:1rem;-webkit-font-smoothing:antialiased}
    .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;
      box-shadow:0 1px 2px rgba(16,24,40,.04),0 12px 32px -12px rgba(16,24,40,.12);
      padding:1.75rem 1.5rem;max-width:440px;width:100%}
    .biz{font-size:.85rem;color:var(--muted);margin-bottom:.25rem}
    h1{margin:0 0 1rem;font-size:1.2rem;font-weight:700;letter-spacing:-.01em;color:var(--ink)}
    .amount-box{background:var(--brand-tint);border:1px solid #bbf7d0;border-radius:12px;
      padding:1.1rem;text-align:center;margin-bottom:1.5rem}
    .amount{font-size:2rem;font-weight:800;color:var(--ink);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
    .concept{color:var(--muted);font-size:.85rem;margin-top:.3rem}
    .label{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
      color:var(--muted);margin-bottom:.6rem}
    .method{display:flex;align-items:center;gap:.85rem;width:100%;padding:1rem;border-radius:12px;
      text-decoration:none;margin-bottom:.6rem;min-height:64px;transition:background .15s,border-color .15s}
    .method-primary{background:var(--brand);color:#fff}
    .method-primary:hover{background:#15803d}
    .method-secondary{background:var(--surface);color:var(--ink);border:1px solid var(--border)}
    .method-secondary:hover{background:var(--slate-50);border-color:#cdd2cb}
    .method-ico{font-size:1.5rem;flex-shrink:0;width:28px;text-align:center}
    .method-txt{flex:1}
    .method-title{font-weight:700;font-size:.95rem;line-height:1.2}
    .method-sub{font-size:.78rem;opacity:.85;margin-top:.1rem}
    .chev{font-size:1.1rem;opacity:.6}
    .footer{margin-top:1.25rem;text-align:center;font-size:.75rem;color:var(--muted)}
  </style>
</head>
<body>
  <div class="card">
    <div class="biz">${business}</div>
    <h1>Elige cómo pagar</h1>

    <div class="amount-box">
      <div class="amount">${amount}</div>
      ${concept ? `<div class="concept">${concept}</div>` : ''}
    </div>

    <div class="label">Métodos disponibles</div>

    <a class="method method-primary" href="/pay/card/${id}">
      <span class="method-ico">💳</span>
      <span class="method-txt">
        <span class="method-title">Pagar con tarjeta</span>
        <span class="method-sub">Pago seguro al instante</span>
      </span>
      <span class="chev">›</span>
    </a>

    <a class="method method-secondary" href="/pay/bank/${id}">
      <span class="method-ico">🏦</span>
      <span class="method-txt">
        <span class="method-title">Transferencia bancaria</span>
        <span class="method-sub">Con los datos y el concepto exacto</span>
      </span>
      <span class="chev">›</span>
    </a>

    <div class="footer">🔒 Pago seguro · YaQu</div>
  </div>
</body>
</html>`);
});

export default router;
