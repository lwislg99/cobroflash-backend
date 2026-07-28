// src/modules/billing/app/routes/payInvoice.routes.ts
// Selector de método de pago (tarjeta vía Stripe + transferencia vía PayByBank).
// Landing del botón de payment_request_es: /pay/invoice/:token
// Diseño "Recibo de confianza" (Impeccable: Stripe/Wise, mobile-first).
// SCRUM-85: identificado por Charge.receiptToken (patrón SCRUM-74), NO por el
// chargeId autoincremental — mismo token compartido con /recibo, /pay/card y /pay/bizum.
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { documentNotFoundHtml } from '../../../../core/http/publicNotFound';
import { esc, formatMoneyEs } from '../../../../core/utils/utils';
import { isFlagEnabled } from '../../../../core/flags';
import { isDemoMerchant } from '../../../invoicing/domain/emission.service';
import { isReceiptNumber } from '../../../invoicing/domain/invoiceNumber.service';

const router = Router();

router.get('/invoice/:token', async (req, res) => {
  res.set('Cache-Control', 'no-store, must-revalidate');

  const token = req.params.token;

  const charge = await prisma.charge.findUnique({
    where: { receiptToken: token },
    include: { merchant: true },
  });
  if (!charge) return res.status(404).send(documentNotFoundHtml());
  const id = charge.id;

  // Pagado o vencido → recibo
  if (charge.status === 'paid' || charge.status === 'expired') {
    return res.redirect(303, `/recibo/${token}`);
  }

  // Nº de factura asociada (si existe), para dar contexto
  const invoice = await prisma.invoice
    .findFirst({ where: { chargeId: id }, select: { number: true } })
    .catch(() => null);

  const m = charge.merchant;
  const business = esc(m?.legalName || m?.name || 'Tu proveedor');
  const initial = esc((m?.name || m?.legalName || 'Y').trim().charAt(0).toUpperCase());
  const amount = esc(formatMoneyEs(charge.amount, charge.currency)); // A6.6: 2.383,70 €
  const concept = esc(charge.concept || '');
  const num = invoice?.number ? esc(invoice.number) : '';
  // Regla 24/26: J-… = justificante, jamás "factura"
  const invRef = num ? `${isReceiptNumber(invoice!.number) ? 'Justificante' : 'Factura'} ${num}` : '';
  // P1-2: el concepto del cobro a veces YA es "Factura CFxxxx"; no duplicar la
  // referencia. Si el concepto ya incluye el nº de factura, mostramos solo invRef.
  const conceptIsInvoiceRef = !!num && concept.includes(num);
  const subline = conceptIsInvoiceRef
    ? invRef
    : [concept, invRef].filter(Boolean).join(' · ');

  // ── A2.1: métodos disponibles + orden por la matriz W4 (por importe) ──
  const amountNum = Number(charge.amount);
  const hasTransfer = !!(m?.iban || m?.clabe);

  // Tarjeta: con PAYMENTS_CONNECT_ENABLED, solo merchants con Connect activo
  // (o el demo, regla 8/18). Con el flag OFF, comportamiento actual (plataforma
  // = demo/test) sin cambios.
  const connectFlag = isFlagEnabled('PAYMENTS_CONNECT_ENABLED', { merchant: m });
  const hasCard = !connectFlag
    ? true
    : (m?.connectStatus === 'active' || (m ? isDemoMerchant(m) : false));

  // Bizum manual: flag + móvil del PRO + límites bancarios del pagador (W4:
  // >1.000 € se oculta).
  const bizumPhone = m?.bizumPhone || m?.whatsappPhone || null;
  const hasBizum =
    isFlagEnabled('BIZUM_MANUAL_ENABLED', { merchant: m }) && !!bizumPhone && amountNum <= 1000;

  // Selector al crear (quote/charge.payMethods): si el PRO limitó los métodos
  // para ESTE cobro, se respeta (null = todos los disponibles).
  const allowed = Array.isArray(charge.payMethods) ? (charge.payMethods as string[]) : null;
  const permits = (key: string) => !allowed || allowed.includes(key);

  type Method = { key: string; href: string; ico: string; title: string; sub: string };
  const card: Method = { key: 'card', href: `/pay/card/${token}`, ico: '💳', title: 'Pagar con tarjeta', sub: 'Visa · Mastercard · al instante' };
  const bizum: Method = { key: 'bizum', href: `/pay/bizum/${token}`, ico: '📲', title: 'Pagar por Bizum', sub: 'Desde la app de tu banco' };
  // SCRUM-90: /pay/bank tokenizado (mismo Charge.receiptToken).
  const transfer: Method = { key: 'transfer', href: `/pay/bank/${token}`, ico: '🏦', title: 'Transferencia bancaria', sub: 'Con los datos y el concepto exacto' };

  // Orden W4: ≤500 → Bizum + Tarjeta (transferencia detrás) · 500-1.000 →
  // Tarjeta principal, Bizum secundario · >1.000 → Tarjeta + transferencia.
  const ordered = (amountNum <= 500 ? [bizum, card, transfer] : [card, bizum, transfer])
    .filter((mm) =>
      (mm.key === 'card' && hasCard && permits('card')) ||
      (mm.key === 'bizum' && hasBizum && permits('bizum')) ||
      (mm.key === 'transfer' && hasTransfer && permits('transfer')));

  const methodsHtml = ordered.map((mm, i) => `
    <a class="method" href="${mm.href}">
      <span class="method-ico">${mm.ico}</span>
      <span class="method-txt">
        <span class="method-title">${mm.title}</span>
        <span class="method-sub">${mm.sub}</span>
        ${i === 0 && ordered.length > 1 ? '<span class="method-chip">Recomendado</span>' : ''}
      </span>
      <span class="chev">›</span>
    </a>`).join('');

  // Si el logo no carga (URL rota, file://…), se oculta y no rompe la landing
  const logoHtml = m?.logoUrl
    ? `<img class="logo-img" src="${esc(m.logoUrl)}" alt="${business}" onerror="this.style.display='none'"/>`
    : `<div class="logo-mark">${initial}</div>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="es">
<head>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/><!-- SCRUM-184: sin esto el navegador pide /favicon.ico y se lleva un 404 -->
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

    /* Métodos — tarjetas IGUALES (patrón Stripe Checkout): el énfasis lo da
       el orden + chip "Recomendado", no un botón macizo. Hover con borde de
       marca y elevación suave; active hunde 1px. */
    .methods-label{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:1.25rem 0 .7rem}
    .method{display:flex;align-items:center;gap:.85rem;width:100%;padding:.95rem 1rem;border-radius:14px;
      text-decoration:none;margin-bottom:.6rem;min-height:64px;background:var(--surface);color:var(--ink);
      border:1px solid var(--border);transition:border-color .15s,box-shadow .15s,transform .1s}
    .method:hover{border-color:var(--brand);box-shadow:0 4px 12px -2px rgba(16,24,40,.08),0 2px 6px -2px rgba(16,24,40,.05)}
    .method:active{transform:translateY(1px)}
    .method-ico{font-size:1.45rem;flex-shrink:0;width:30px;text-align:center}
    .method-txt{flex:1;min-width:0}
    /* A6.6 P2: block — como spans inline el título y el subtítulo fluían juntos
       y a 390px envolvían a mitad de frase ("Pagar con tarjeta Visa · …") */
    .method-title{display:block;font-weight:700;font-size:.98rem;line-height:1.2}
    .method-sub{display:block;font-size:.76rem;color:var(--muted);margin-top:.12rem}
    /* El chip va DEBAJO del texto (dentro de .method-txt): así el título nunca
       se estruja en móviles estrechos (a 360px "Pagar con tarjeta" salía en 3
       líneas cuando el chip competía por el ancho a la derecha). */
    .method-chip{display:inline-block;margin-top:.35rem;font-size:.66rem;font-weight:700;letter-spacing:.03em;color:#166534;
      background:var(--brand-tint);border:1px solid #bbf7d0;border-radius:999px;padding:.18rem .55rem;text-transform:uppercase}
    .chev{font-size:1.25rem;opacity:.55;flex-shrink:0}
    @media (prefers-reduced-motion: reduce){.method{transition:none}.method:active{transform:none}}

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
    ${methodsHtml || `
    <div style="text-align:center;font-size:.85rem;color:var(--muted);padding:.8rem 0;line-height:1.5">
      El profesional te indicará cómo pagar.<br/>Contacta con él si tienes dudas.
    </div>`}

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
