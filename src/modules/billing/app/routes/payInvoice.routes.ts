// src/modules/billing/app/routes/payInvoice.routes.ts
// Selector de método de pago (tarjeta vía Stripe + transferencia vía PayByBank).
// Landing del botón de payment_request_es: /pay/invoice/:chargeId
// Diseño "Recibo de confianza" (Impeccable: Stripe/Wise, mobile-first).
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { documentNotFoundHtml } from '../../../../core/http/publicNotFound';
import { esc, parseNumericId } from '../../../../core/utils/utils';

const router = Router();

router.get('/invoice/:chargeId', async (req, res) => {
  res.set('Cache-Control', 'no-store, must-revalidate');

  const id = parseNumericId(req.params.chargeId);
  // N3: estado digno también en el 400 (id no numérico), nunca texto plano.
  if (!Number.isInteger(id)) return res.status(400).send(documentNotFoundHtml());

  const charge = await prisma.charge.findUnique({
    where: { id },
    include: {
      merchant: { select: { name: true, legalName: true, logoUrl: true, iban: true, clabe: true } },
    },
  });
  if (!charge) return res.status(404).send(documentNotFoundHtml());

  // Pagado o vencido → recibo
  if (charge.status === 'paid' || charge.status === 'expired') {
    return res.redirect(303, `/recibo/${id}`);
  }

  // Nº de factura asociada (si existe), para dar contexto
  const invoice = await prisma.invoice
    .findFirst({ where: { chargeId: id }, select: { number: true } })
    .catch(() => null);

  const m = charge.merchant;
  const business = esc(m?.legalName || m?.name || 'Tu proveedor');
  const initial = esc((m?.name || m?.legalName || 'Y').trim().charAt(0).toUpperCase());
  const amount = esc(
    Number(charge.amount).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
      ' ' + charge.currency,
  );
  const concept = esc(charge.concept || '');
  const num = invoice?.number ? esc(invoice.number) : '';
  const invRef = num ? `Factura ${num}` : '';
  // P1-2: el concepto del cobro a veces YA es "Factura CFxxxx"; no duplicar la
  // referencia. Si el concepto ya incluye el nº de factura, mostramos solo invRef.
  const conceptIsInvoiceRef = !!num && concept.includes(num);
  const subline = conceptIsInvoiceRef
    ? invRef
    : [concept, invRef].filter(Boolean).join(' · ');
  const hasTransfer = !!(m?.iban || m?.clabe);

  const logoHtml = m?.logoUrl
    ? `<img class="logo-img" src="${esc(m.logoUrl)}" alt="${business}"/>`
    : `<div class="logo-mark">${initial}</div>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="theme-color" content="#16a34a"/>
  <title>Pagar ${amount} — YaQu</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    :root{--brand:#16a34a;--brand-bright:#22c55e;--brand-tint:#ecfdf5;--ink:#0f1c17;--body:#3f4a45;
      --muted:#6b756f;--bg:#f6f7f5;--surface:#fff;--border:#e7e9e5;--slate-50:#f7f8f6;}
    *{box-sizing:border-box}
    body{font-family:'Inter',system-ui,-apple-system,sans-serif;font-feature-settings:"cv11","ss01";
      margin:0;background:var(--bg);color:var(--body);min-height:100vh;display:flex;
      align-items:center;justify-content:center;padding:1rem;-webkit-font-smoothing:antialiased}
    .card{background:var(--surface);border:1px solid var(--border);border-radius:18px;
      box-shadow:0 1px 2px rgba(16,24,40,.04),0 18px 40px -16px rgba(16,24,40,.16);
      padding:1.75rem 1.5rem;max-width:420px;width:100%}

    /* Identidad del negocio */
    .biz{display:flex;flex-direction:column;align-items:center;text-align:center;gap:.55rem;margin-bottom:1.25rem}
    .logo-mark{width:44px;height:44px;border-radius:50%;
      background:linear-gradient(135deg,var(--brand-bright),#22d3ee);
      display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:#052e16}
    .logo-img{max-height:44px;max-width:130px;object-fit:contain}
    .biz-name{font-size:.9rem;font-weight:600;color:var(--ink)}

    /* Importe */
    .amount-wrap{text-align:center;padding:1.1rem 0 1.25rem;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
    .amount-label{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.45rem}
    .amount{font-size:2.3rem;font-weight:800;color:var(--ink);letter-spacing:-.025em;line-height:1;font-variant-numeric:tabular-nums}
    .subline{font-size:.83rem;color:var(--muted);margin-top:.5rem;line-height:1.4}

    /* Métodos */
    .methods-label{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:1.25rem 0 .7rem}
    .method{display:flex;align-items:center;gap:.85rem;width:100%;padding:.95rem 1rem;border-radius:14px;
      text-decoration:none;margin-bottom:.6rem;min-height:64px;transition:background .15s,border-color .15s,box-shadow .15s}
    .method-primary{background:var(--brand);color:#fff;box-shadow:0 4px 14px -4px rgba(22,163,74,.45)}
    .method-primary:hover{background:#15803d}
    .method-primary:active{transform:translateY(1px)}
    .method-secondary{background:var(--surface);color:var(--ink);border:1px solid var(--border)}
    .method-secondary:hover{background:var(--slate-50);border-color:#cdd2cb}
    .method-ico{font-size:1.45rem;flex-shrink:0;width:30px;text-align:center}
    .method-txt{flex:1;min-width:0}
    .method-title{font-weight:700;font-size:.98rem;line-height:1.2}
    .method-sub{font-size:.76rem;opacity:.82;margin-top:.12rem}
    .chev{font-size:1.25rem;opacity:.55;flex-shrink:0}

    /* Confianza */
    .trust{margin-top:1.4rem;text-align:center}
    .trust-main{display:inline-flex;align-items:center;gap:.4rem;font-size:.8rem;font-weight:600;color:var(--body)}
    .trust-sub{font-size:.72rem;color:var(--muted);margin-top:.3rem}
    .lock{width:13px;height:13px;display:inline-block;vertical-align:-1px}
    /* AB6: anillo de Foco accesible (DESIGN.md) en todo elemento enfocado por teclado */
    :focus-visible{outline:none;box-shadow:0 0 0 3px rgba(34,197,94,.30)}
  </style>
</head>
<body>
  <div class="card">
    <div class="biz">
      ${logoHtml}
      <div class="biz-name">${business}</div>
    </div>

    <div class="amount-wrap">
      <div class="amount-label">Importe a pagar</div>
      <div class="amount">${amount}</div>
      ${subline ? `<div class="subline">${subline}</div>` : ''}
    </div>

    <div class="methods-label">Elige cómo pagar</div>

    <a class="method method-primary" href="/pay/card/${id}">
      <span class="method-ico">💳</span>
      <span class="method-txt">
        <span class="method-title">Pagar con tarjeta</span>
        <span class="method-sub">Visa · Mastercard · al instante</span>
      </span>
      <span class="chev">›</span>
    </a>
    ${hasTransfer ? `
    <a class="method method-secondary" href="/pay/bank/${id}">
      <span class="method-ico">🏦</span>
      <span class="method-txt">
        <span class="method-title">Transferencia bancaria</span>
        <span class="method-sub">Con los datos y el concepto exacto</span>
      </span>
      <span class="chev">›</span>
    </a>` : ''}

    <div class="trust">
      <span class="trust-main">
        <svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Pago seguro y cifrado
      </span>
      <div class="trust-sub">Procesado por Stripe · Nunca vemos los datos de tu tarjeta</div>
    </div>
  </div>
</body>
</html>`);
});

export default router;
