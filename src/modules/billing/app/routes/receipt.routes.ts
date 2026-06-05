// srcNew/modules/billing/app/routes/receipt.routes.ts
import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../../../../core/db/prisma';
import { esc } from '../../../../core/utils/utils';
import { stripe } from '../../../../integrations/stripe';
import { BASE_URL, config } from '../../../../core/config/env';

const router = Router();

// GET /recibo/:id
router.get('/:id', async (req, res) => {
  res.set('Cache-Control', 'no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).send('ID inválido');

  let charge = await prisma.charge.findUnique({
    where: { id },
    include: { customer: true, merchant: true, events: true, reconciliations: true },
  });
  if (!charge) {
    res.status(404).send('Cobro no encontrado');
    return;
  }

  // Fallback Stripe sin webhooks (si se vuelve de success_url)
  try {
    const cardParam = (req.query as any).card;
    const sessId = (req.query as any).session_id;
    if (
      stripe &&
      charge.status === 'pending' &&
      cardParam === 'success' &&
      typeof sessId === 'string' &&
      sessId
    ) {
      const s = await stripe.checkout.sessions.retrieve(sessId);
      if (s && (s.payment_status === 'paid' || s.status === 'complete')) {
        await axios.post(
          `${BASE_URL}/webhooks/psp`,
          {
            event: 'payment.confirmed',
            charge_id: id,
            method: 'card:stripe',
            bank_ref: s.payment_intent || s.id,
            amount: (s.amount_total ?? 0) / 100,
            currency: (s.currency || 'eur').toUpperCase(),
            ts: new Date().toISOString(),
          },
          { timeout: 10_000 },
        );
        charge = await prisma.charge.findUnique({
          where: { id },
          include: { customer: true, merchant: true, events: true, reconciliations: true },
        });
      }
    }
  } catch (e) {
    console.error('recibo/stripe-fallback error', (e as any)?.message || e);
  }

  if (!charge) {
    res.status(404).send('Cobro no encontrado');
    return;
  }
  const ch = charge;

  // localizar invoice (por quote o último evento 'invoiced')
  const quote = await prisma.quote.findFirst({ where: { chargeId: ch.id } });
  let invoice: any = null;
  if (quote) invoice = await prisma.invoice.findFirst({ where: { quoteId: quote.id } });
  if (!invoice) {
    const invEv = [...(ch.events || [])]
      .reverse()
      .find((e) => e.type === 'invoiced' && (e as any).payload?.invoice_id);
    const invId = (invEv as any)?.payload?.invoice_id as number | undefined;
    if (invId) invoice = await prisma.invoice.findUnique({ where: { id: invId } });
  }

  const title = `Recibo #${ch.id} — YaQu`;

  const statusBadge =
    ch.status === 'paid'
      ? `<span style="background:#16a34a;color:#fff;padding:.15rem .5rem;border-radius:.5rem;">PAGADO</span>`
      : ch.status === 'failed'
      ? `<span style="background:#dc2626;color:#fff;padding:.15rem .5rem;border-radius:.5rem;">FALLIDO</span>`
      : ch.status === 'expired'
      ? `<span style="background:#6b7280;color:#fff;padding:.15rem .5rem;border-radius:.5rem;">EXPIRADO</span>`
      : `<span style="background:#f59e0b;color:#111;padding:.15rem .5rem;border-radius:.5rem;">PENDIENTE</span>`;

  const payBtns =
    ch.status === 'pending'
      ? `<a href="${BASE_URL}/pay/bank/${ch.id}" class="pay-btn pay-btn-primary">Pagar por transferencia</a>
       <a href="${BASE_URL}/pay/card/${ch.id}" class="pay-btn pay-btn-secondary">Pagar con tarjeta</a>`
      : '';

  const mailParam =
    typeof (req.query as any).mail === 'string' ? (req.query as any).mail : undefined;
  const emlParam =
    typeof (req.query as any).eml === 'string' ? (req.query as any).eml : undefined;
  const mailBanner =
    mailParam === 'sent'
      ? `<div style="background:#dcfce7;border:1px solid #16a34a;color:#166534;padding:.5rem .75rem;border-radius:.5rem;margin:.75rem 0">📧 Email enviado correctamente.</div>`
      : mailParam === 'saved'
      ? `<div style="background:#e0f2fe;border:1px solid #0284c7;color:#075985;padding:.5rem .75rem;border-radius:.5rem;margin:.75rem 0">📧 Email generado en <a href="${esc(
          emlParam || '',
        )}" target="_blank">.eml</a> (modo dev).</div>`
      : '';

    // Consideramos que solo hay PDF real si pdfUrl existe y no es un placeholder
    const hasRealPdf =
    !!invoice &&
    !!invoice.pdfUrl &&
    !invoice.pdfUrl.startsWith('PENDING');

  const emailBlock =
    hasRealPdf && ch.customer?.email
      ? `<form method="post" action="${BASE_URL}/dev/email-invoice/${ch.id}" style="margin-top:.5rem">
           <button style="background:#16a34a;color:#fff;padding:.5rem 1rem;border-radius:999px;border:none;cursor:pointer;font-weight:600;font-family:inherit">
             Enviar factura por email
           </button>
         </form>
         <small style="color:#6b756f">Se enviará a: ${esc(ch.customer!.email!)}</small>`
      : '';

  const invBlock =
    ch.status === 'paid'
      ? hasRealPdf
        ? `<p><a href="${invoice!.pdfUrl}" target="_blank">
             📄 Descargar factura (${esc(invoice!.number)})
           </a></p>${emailBlock}`
        : `<small style="color:#6b756f">
             La factura se emitirá y se enviará por WhatsApp y email automáticamente.
           </small>`
      : '';

      const statusMessage =
      ch.status === 'pending'
        ? `<div style="background:#fef9c3;border:1px solid #facc15;color:#854d0e;padding:.6rem .8rem;border-radius:.6rem;margin:.75rem 0">
             Estamos esperando tu pago. Puedes completarlo usando los botones de <b>pago por banco</b> o <b>pago con tarjeta</b> que aparecen más arriba.
           </div>`
        : ch.status === 'paid'
        ? hasRealPdf
          ? `<div style="background:#dcfce7;border:1px solid #16a34a;color:#166534;padding:.6rem .8rem;border-radius:.6rem;margin:.75rem 0">
               ✅ <b>Pago recibido correctamente.</b> Tu factura está disponible para descargar y la hemos enviado por WhatsApp. Si tenemos tu correo, también la recibirás por email.
             </div>`
          : `<div style="background:#dcfce7;border:1px solid #16a34a;color:#166534;padding:.6rem .8rem;border-radius:.6rem;margin:.75rem 0">
               ✅ <b>Pago recibido correctamente.</b> Estamos generando tu factura; la recibirás en breve por WhatsApp y, si tenemos tu correo, también por email.
             </div>`
        : ch.status === 'failed'
        ? `<div style="background:#fee2e2;border:1px solid #ef4444;color:#991b1b;padding:.6rem .8rem;border-radius:.6rem;margin:.75rem 0">
             ❌ No se ha podido completar el pago. Si lo deseas, ponte en contacto con tu proveedor para intentar de nuevo el cobro.
           </div>`
        : ch.status === 'expired'
        ? `<div style="background:#e5e7eb;border:1px solid #9ca3af;color:#374151;padding:.6rem .8rem;border-radius:.6rem;margin:.75rem 0">
             ⏰ Este enlace de pago ha caducado. Pide a tu proveedor que te envíe un nuevo enlace si todavía quieres realizar el pago.
           </div>`
        : '';
  

  const simulateBlock =
    config.NODE_ENV !== 'production'
      ? `<details style="margin-top:1rem"><summary>🔧 Simulación (solo dev)</summary>
         <form method="post" action="${BASE_URL}/dev/sim/pay/${ch.id}" style="margin-top:.5rem">
           <button style="background:#2563eb;color:#fff;padding:.4rem .8rem;border-radius:.4rem;border:none;cursor:pointer">Simular pago SCTinst</button>
         </form>
         <div style="display:flex;gap:.5rem;margin-top:.5rem">
           <form method="post" action="${BASE_URL}/dev/sim/fail/${ch.id}">
             <button style="background:#dc2626;color:#fff;padding:.35rem .7rem;border-radius:.4rem;border:none;cursor:pointer">Simular fallo</button>
           </form>
           <form method="post" action="${BASE_URL}/dev/sim/expire/${ch.id}">
             <button style="background:#6b7280;color:#fff;padding:.35rem .7rem;border-radius:.4rem;border:none;cursor:pointer">Simular expiración</button>
           </form>
         </div>
       </details>`
      : '';

  const eventsList = (ch.events || [])
    .sort((a, b) => +new Date(a.ts) - +new Date(b.ts))
    .map(
      (e) =>
        `<li>${esc(e.type)} · ${esc(new Date(e.ts).toLocaleString())}</li>`,
    )
    .join('');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  :root{--brand:#16a34a;--ink:#0f1c17;--body:#3f4a45;--muted:#6b756f;--bg:#f6f7f5;--surface:#fff;--border:#e7e9e5;--slate-50:#f7f8f6}
  body{font-family:'Inter',system-ui,-apple-system,sans-serif;font-feature-settings:"cv11","ss01";margin:0;padding:2rem 1rem;background:var(--bg);color:var(--body);-webkit-font-smoothing:antialiased}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.5rem;max-width:720px;margin:0 auto;box-shadow:0 1px 2px rgba(16,24,40,.04),0 12px 32px -12px rgba(16,24,40,.10)}
  h2{color:var(--ink);letter-spacing:-.01em}
  .row{display:flex;gap:1rem;flex-wrap:wrap}
  .row > div{flex:1 1 240px}
  .row b{color:var(--ink);font-variant-numeric:tabular-nums}
  small{color:var(--muted)}
  ul{padding-left:1.1rem;color:var(--body)}
  a{color:var(--brand)}
  .pay-btn{display:inline-block;padding:.6rem 1.1rem;border-radius:999px;text-decoration:none;font-weight:600;font-size:.9rem}
  .pay-btn-primary{background:var(--brand);color:#fff}
  .pay-btn-secondary{background:var(--surface);color:var(--ink);border:1px solid var(--border)}
</style>
</head>
<body>
<div class="card">
<h2 style="margin:.2rem 0">Recibo</h2>
<p style="margin:.3rem 0">Cobro <b>#${ch.id}</b> ${statusBadge}</p>
${statusMessage}
<div class="row" style="margin-top:.5rem">

      <div><small>Concepto</small><div>${esc(ch.concept)}</div></div>
      <div><small>Importe</small><div><b>${esc(ch.amount.toString())} ${esc(
        ch.currency,
      )}</b></div></div>
      <div><small>Cliente</small><div>${esc(ch.customer?.name ?? '—')}</div></div>
    </div>

    <div style="margin:1rem 0;display:flex;gap:.75rem;align-items:center">
      ${payBtns}
      <a href="${BASE_URL}/charges/${ch.id}">Ver JSON</a>
    </div>

    ${mailBanner}
    ${invBlock}
    ${simulateBlock}

    <hr style="margin:1rem 0;border:none;border-top:1px solid #e5e7eb"/>
    <small>Eventos</small>
    <ul>${eventsList || '<li>—</li>'}</ul>
  </div>
</body>
</html>`);
});

export default router;
