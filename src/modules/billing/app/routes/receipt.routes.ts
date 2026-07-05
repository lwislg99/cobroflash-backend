// srcNew/modules/billing/app/routes/receipt.routes.ts
import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../../../../core/db/prisma';
import { documentNotFoundHtml } from '../../../../core/http/publicNotFound';
import { esc, parseNumericId, formatMoneyEs } from '../../../../core/utils/utils';
import { isReceiptNumber } from '../../../invoicing/domain/invoiceNumber.service';
import { stripe } from '../../../../integrations/stripe';
import { BASE_URL, config } from '../../../../core/config/env';

const router = Router();

// GET /recibo/:id
router.get('/:id', async (req, res) => {
  res.set('Cache-Control', 'no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  // parseNumericId tolera URLs sucias del botón de plantilla Meta ('{{1}}9' → 9),
  // igual que /pay/quote (P3-1). Sin esto, "Ver documento" caía en not-found.
  const id = parseNumericId(req.params.id);
  // N3: estado digno también en el 400 (id no numérico), nunca texto plano.
  if (!Number.isInteger(id)) return res.status(400).send(documentNotFoundHtml());

  let charge = await prisma.charge.findUnique({
    where: { id },
    include: { customer: true, merchant: true, events: true, reconciliations: true },
  });
  if (!charge) {
    res.status(404).send(documentNotFoundHtml());
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
    res.status(404).send(documentNotFoundHtml());
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

  // V0-0: el documento es FACTURA (post-SIF) o JUSTIFICANTE (pre-SIF). El copy NUNCA dice
  // "factura" para un justificante (regla 7 / Parte M). Tipo: invoice.type==='JUST' o nº J-…
  const isJust = !!invoice && (invoice.type === 'JUST' || isReceiptNumber(invoice.number));
  const docLabel = isJust ? 'justificante' : 'factura';
  const docArticle = isJust ? 'El' : 'La'; // concordancia: El justificante / La factura
  const docPron = isJust ? 'lo' : 'la';    // pronombre: lo (justificante) / la (factura)

  const title = `Recibo #${ch.id} — YaQu`;

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
      ? `<div class="note note-ok">📧 Email enviado correctamente.</div>`
      : mailParam === 'saved'
      ? `<div class="note note-info">📧 Email generado en <a href="${esc(
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
      ? `<form method="post" action="${BASE_URL}/dev/email-invoice/${ch.id}" class="email-form">
           <button class="btn-email">Enviar ${docLabel} por email</button>
         </form>
         <small>Se enviará a: ${esc(ch.customer!.email!)}</small>`
      : '';

  const invBlock =
    ch.status === 'paid'
      ? hasRealPdf
        ? `<p class="doc-link"><a href="${invoice!.pdfUrl}" target="_blank">
             📄 Descargar ${docLabel} (${esc(invoice!.number)})
           </a></p>${emailBlock}`
        : `<small>
             ${docArticle} ${docLabel} se emitirá y se enviará por WhatsApp y email automáticamente.
           </small>`
      : '';

      const statusMessage =
      ch.status === 'pending'
        ? `<div class="note note-warn">
             Estamos esperando tu pago. Puedes completarlo usando los botones de <b>pago por banco</b> o <b>pago con tarjeta</b> que aparecen más arriba.
           </div>`
        : ch.status === 'paid'
        ? hasRealPdf
          ? `<div class="note note-ok">
               ✅ <b>Pago recibido correctamente.</b> Tu ${docLabel} está disponible para descargar y ${docPron} hemos enviado por WhatsApp. Si tenemos tu correo, también ${docPron} recibirás por email.
             </div>`
          : `<div class="note note-ok">
               ✅ <b>Pago recibido correctamente.</b> Estamos generando tu ${docLabel}; ${docPron} recibirás en breve por WhatsApp y, si tenemos tu correo, también por email.
             </div>`
        : ch.status === 'failed'
        ? `<div class="note note-danger">
             ❌ No se ha podido completar el pago. Si lo deseas, ponte en contacto con tu proveedor para intentar de nuevo el cobro.
           </div>`
        : ch.status === 'expired'
        ? `<div class="note note-muted">
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

  // Héroe de estado (estilo "Recibo de confianza")
  const SH: Record<string, { icon: string; title: string; cls: string }> = {
    paid:    { icon: '✓', title: 'Pago confirmado', cls: 'paid' },
    pending: { icon: '⏳', title: 'Pago pendiente',  cls: 'pending' },
    failed:  { icon: '✕', title: 'Pago fallido',    cls: 'failed' },
    expired: { icon: '⏰', title: 'Enlace caducado', cls: 'expired' },
  };
  const sh = SH[ch.status] || SH.pending;
  const business = esc((ch as any).merchant?.legalName || (ch as any).merchant?.name || '');

  // A6.2: llegada RECIÉN pagado (retorno de Stripe `?card=success` o `?celebrate=1`
  // tras Bizum/transferencia) → check celebratorio animado (CSS puro, reduced-motion ok).
  // En visitas posteriores el recibo queda sobrio: la celebración es del momento.
  const celebrate =
    ch.status === 'paid' &&
    ((req.query as any).card === 'success' || (req.query as any).celebrate === '1');

  // R-1 (N3): en el recibo PAGADO mostrar fecha + método del pago.
  const paidEvent = (ch.events || [])
    .filter((e) => e.type === 'paid')
    .sort((a, b) => +new Date(b.ts) - +new Date(a.ts))[0];
  const methodLabel = (m?: string | null): string => {
    const s = String(m || '').toLowerCase();
    if (!s) return '';
    if (s.includes('card') || s.includes('stripe') || s.includes('tarjeta')) return 'Tarjeta';
    if (s.includes('bizum')) return 'Bizum';
    if (s.includes('mp') || s.includes('mercado')) return 'Mercado Pago';
    if (s.includes('transfer') || s.includes('sct') || s.includes('bank')) return 'Transferencia';
    return String(m);
  };
  const paidMeta =
    ch.status === 'paid'
      ? [
          paidEvent
            ? `Pagado el ${new Date(paidEvent.ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`
            : 'Pagado',
          methodLabel(ch.method),
        ]
          .filter(Boolean)
          .join(' · ')
      : '';

  const statusHero = `
    ${business ? `<div class="biz">${business}</div>` : ''}
    <div class="status-hero">
      <div class="status-icon ${sh.cls}${celebrate ? ' celebrate' : ''}">${sh.icon}</div>
      <div class="status-title">${celebrate ? '¡Pago completado!' : sh.title}</div>
      <div class="status-amount">${esc(formatMoneyEs(ch.amount, ch.currency))}</div>
      ${ch.concept ? `<div class="status-sub">${esc(ch.concept)}</div>` : ''}
      ${paidMeta ? `<div class="status-meta">${esc(paidMeta)}</div>` : ''}
    </div>`;

  // ── A2.5: valoración post-pago (versión LEGAL, sin review gating) ─────────
  // El feedback (estrellas + comentario) se guarda SIEMPRE en privado para el
  // merchant (Event del charge + timeline del cliente). El botón de reseña en
  // Google se muestra A TODOS si el merchant tiene URL — PROHIBIDO condicionarlo
  // a X estrellas (viola políticas de Google y normativa UE).
  const existingFb = (ch.events || []).find((e) => e.type === 'customer_feedback');
  const fbThanks = (req.query as any).fb === 'thanks' || !!existingFb;
  const reviewUrl = (ch as any).merchant?.googleReviewUrl || null;
  const googleBtn = reviewUrl
    ? `<a class="pay-btn pay-btn-primary" href="${esc(reviewUrl)}" target="_blank" rel="noopener">⭐ Déjale una reseña en Google</a>`
    : '';
  const feedbackBlock =
    ch.status === 'paid'
      ? `
  <style>
    .fb{border-top:1px solid var(--border);margin-top:1.1rem;padding-top:1rem;text-align:center}
    .fb-title{font-weight:700;color:var(--ink);font-size:.98rem;margin-bottom:.55rem}
    .fb-stars{display:flex;justify-content:center;gap:.35rem;font-size:1.9rem;margin-bottom:.6rem}
    .fb-stars button{background:none;border:none;cursor:pointer;font-size:inherit;line-height:1;filter:grayscale(1);opacity:.45;padding:.1rem .15rem;transition:filter .12s,opacity .12s,transform .12s}
    .fb-stars button.on{filter:none;opacity:1;transform:scale(1.08)}
    .fb textarea{width:100%;max-width:420px;border:1px solid var(--border);border-radius:12px;padding:.6rem .8rem;font:inherit;font-size:.88rem;color:var(--ink);resize:vertical;min-height:56px}
    .fb-send{margin-top:.6rem;background:var(--surface);color:var(--ink);border:1px solid var(--border);border-radius:999px;padding:.55rem 1.2rem;font:inherit;font-weight:600;cursor:pointer}
    .fb-send:hover{background:var(--slate-50)}
    .fb-google{margin-top:.9rem}
    @media (prefers-reduced-motion: reduce){.fb-stars button{transition:none;transform:none}}
  </style>
  <div class="fb">
    ${fbThanks
      ? `<div class="fb-title">🙌 ¡Gracias por tu valoración!</div>
         ${googleBtn ? `<div class="fb-google">${googleBtn}</div>` : ''}`
      : `<div class="fb-title">¿Qué tal fue el trabajo?</div>
         <form method="post" action="${BASE_URL}/recibo/${ch.id}/feedback" id="fb-form">
           <input type="hidden" name="stars" id="fb-stars-input" value=""/>
           <div class="fb-stars" role="radiogroup" aria-label="Valoración de 1 a 5 estrellas">
             ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" aria-label="${n} estrella${n > 1 ? 's' : ''}">⭐</button>`).join('')}
           </div>
           <textarea name="comment" maxlength="500" placeholder="Cuéntale cómo fue (solo lo verá el profesional)"></textarea><br/>
           <button type="submit" class="fb-send">Enviar valoración</button>
         </form>
         ${googleBtn ? `<div class="fb-google">${googleBtn}</div>` : ''}
         <script>
           (function(){
             var btns = document.querySelectorAll('.fb-stars button');
             var input = document.getElementById('fb-stars-input');
             btns.forEach(function(b){
               b.addEventListener('click', function(){
                 var n = Number(b.getAttribute('data-star'));
                 input.value = String(n);
                 btns.forEach(function(x){
                   x.classList.toggle('on', Number(x.getAttribute('data-star')) <= n);
                 });
               });
             });
             document.getElementById('fb-form').addEventListener('submit', function(ev){
               if (!input.value) { ev.preventDefault(); btns[4].focus(); }
             });
           })();
         </script>`}
  </div>`
      : '';

  // Detalles internos solo en desarrollo (no para el cliente)
  const devInternals =
    config.NODE_ENV !== 'production'
      ? `<hr style="margin:1.25rem 0;border:none;border-top:1px solid var(--border)"/>
         <small>Dev · <a href="${BASE_URL}/charges/${ch.id}">Ver JSON</a></small>
         <ul style="margin-top:.4rem">${eventsList || '<li>—</li>'}</ul>`
      : '';

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
  :root{--brand:#16a34a;--brand-tint:#ecfdf5;--ink:#0f1c17;--body:#3f4a45;--muted:#6b756f;--bg:#f6f7f5;--surface:#fff;--border:#e7e9e5;--slate-50:#f7f8f6}
  body{font-family:'Inter',system-ui,-apple-system,sans-serif;font-feature-settings:"cv11","ss01";margin:0;padding:2rem 1rem;background:var(--bg);color:var(--body);-webkit-font-smoothing:antialiased}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.5rem;max-width:720px;margin:0 auto;box-shadow:0 1px 2px rgba(16,24,40,.04),0 12px 32px -12px rgba(16,24,40,.10)}
  h2{color:var(--ink);letter-spacing:-.01em}
  .row{display:flex;gap:1rem;flex-wrap:wrap}
  .row > div{flex:1 1 240px}
  .row b{color:var(--ink);font-variant-numeric:tabular-nums}
  small{color:var(--muted)}
  ul{padding-left:1.1rem;color:var(--body)}
  a{color:var(--brand)}
  .pay-btn{display:inline-block;padding:.7rem 1.1rem;border-radius:12px;text-decoration:none;font-weight:700;font-size:.92rem;text-align:center}
  .pay-btn-primary{background:var(--brand);color:#fff}
  .pay-btn-secondary{background:var(--surface);color:var(--ink);border:1px solid var(--border)}
  /* Banners de estado/aviso — tokens DESIGN.md (semánticos), sin hex inline sueltos */
  .note{padding:.6rem .8rem;border-radius:12px;margin:.75rem 0;font-size:.9rem;line-height:1.45;border:1px solid}
  .note b{font-weight:700}
  .note-ok{background:var(--brand-tint);border-color:#bbf7d0;color:#166534}
  .note-warn{background:#fff7ed;border-color:#fed7aa;color:#b45309}
  .note-danger{background:#fef2f2;border-color:#fecaca;color:#991b1b}
  .note-muted{background:var(--slate-50);border-color:var(--border);color:var(--body)}
  .note-info{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8}
  .doc-link{margin:.5rem 0}
  .email-form{margin-top:.5rem}
  .btn-email{background:var(--brand);color:#fff;padding:.5rem 1rem;border-radius:999px;border:none;cursor:pointer;font-weight:600;font-family:inherit}
  .btn-email:hover{background:#15803d}
  .biz{text-align:center;font-size:.88rem;font-weight:600;color:var(--ink);margin-bottom:.25rem}
  .status-hero{text-align:center;padding:.5rem 0 1.1rem;border-bottom:1px solid var(--border);margin-bottom:1rem}
  .status-icon{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;margin:.4rem auto .6rem}
  .status-icon.paid{background:#ecfdf5;color:#15803d}
  /* A6.2: celebración post-pago — check que "aterriza" + onda expansiva, CSS puro */
  .status-icon.celebrate{position:relative;animation:rcheck .5s cubic-bezier(.34,1.56,.64,1) both}
  .status-icon.celebrate::after{content:"";position:absolute;inset:-4px;border-radius:50%;
    border:2px solid #22c55e;opacity:0;animation:rring .9s ease-out .25s}
  @keyframes rcheck{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}
  @keyframes rring{0%{transform:scale(.8);opacity:.8}100%{transform:scale(1.9);opacity:0}}
  @media (prefers-reduced-motion: reduce){.status-icon.celebrate{animation:none}.status-icon.celebrate::after{display:none}}
  .status-icon.pending{background:#fffbeb;color:#b45309}
  .status-icon.failed{background:#fef2f2;color:#dc2626}
  .status-icon.expired{background:var(--slate-50);color:var(--muted)}
  .status-title{font-size:1.05rem;font-weight:700;color:var(--ink)}
  .status-amount{font-size:2rem;font-weight:800;color:var(--ink);letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin-top:.35rem}
  .status-sub{font-size:.85rem;color:var(--muted);margin-top:.35rem}
  .status-meta{font-size:.82rem;color:var(--muted);font-weight:600;margin-top:.5rem;font-variant-numeric:tabular-nums}
  .pay-stack{display:flex;flex-direction:column;gap:.5rem;margin:1rem 0}
  /* AB6: anillo de Foco accesible (DESIGN.md) en todo elemento enfocado por teclado */
  :focus-visible{outline:none;box-shadow:0 0 0 3px rgba(34,197,94,.30)}
</style>
</head>
<body>
<div class="card">
  ${statusHero}
  ${statusMessage}
  ${ch.status === 'pending' ? `<div class="pay-stack">${payBtns}</div>` : ''}
  ${invBlock}
  ${mailBanner}
  ${feedbackBlock}
  <div style="margin-top:1rem;text-align:center"><small>Cobro #${ch.id} · Cliente: ${esc(ch.customer?.name ?? '—')}</small></div>
  ${simulateBlock}
  ${devInternals}
</div>
</body>
</html>`);
});

// POST /recibo/:id/feedback — A2.5: valoración del cliente tras pagar.
// Se guarda SIEMPRE en privado (Event del charge + timeline del cliente); la
// reseña de Google es independiente (sin gating). Idempotente por cobro.
router.post('/:id/feedback', async (req, res) => {
  const id = parseNumericId(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).send(documentNotFoundHtml());

  const charge = await prisma.charge.findUnique({
    where: { id },
    include: { events: true, customer: { select: { id: true, name: true } } },
  });
  if (!charge) return res.status(404).send(documentNotFoundHtml());
  if (charge.status !== 'paid') return res.redirect(303, `/recibo/${id}`);

  const stars = Math.round(Number(req.body?.stars));
  const comment = String(req.body?.comment || '').slice(0, 500).trim();
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return res.redirect(303, `/recibo/${id}`);
  }

  const existing = (charge.events || []).find((e) => e.type === 'customer_feedback');
  if (!existing) {
    await prisma.event.create({
      data: {
        chargeId: id,
        type: 'customer_feedback',
        payload: { stars, comment: comment || null, ts: new Date().toISOString() } as any,
      },
    });
    if (charge.customerId) {
      const { recordCustomerEvent } = await import('../../../system/customerEvents.service');
      recordCustomerEvent({
        merchantId: charge.merchantId,
        customerId: charge.customerId,
        type: 'feedback',
        title: `⭐ ${stars}/5 — valoración del cliente tras el cobro #${id}`,
        detail: comment || null,
      });
    }
  }

  return res.redirect(303, `/recibo/${id}?fb=thanks`);
});

export default router;
