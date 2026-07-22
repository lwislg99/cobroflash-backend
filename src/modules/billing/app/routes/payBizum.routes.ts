// src/modules/billing/app/routes/payBizum.routes.ts
// C1-4 — Bizum manual asistido (sin PSP): el cliente ve el móvil del PRO,
// importe y concepto copiables, hace el Bizum desde SU banco y pulsa
// "He pagado por Bizum" (N5). El PRO confirma con doble toque en el panel
// → charge.paid con paid_via='bizum_manual' por la MISMA cadena post-pago.
// Master D3: Stripe Bizum no soporta Connect → manual asistido. Flag:
// BIZUM_MANUAL_ENABLED. Riesgo asumido: confirmación declarativa (como efectivo).
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { documentNotFoundHtml } from '../../../../core/http/publicNotFound';
import { esc, parseNumericId } from '../../../../core/utils/utils';
import { isFlagEnabled } from '../../../../core/flags';
import { notifyMerchantAlert } from '../../../../integrations/whatsappNotifications';
import { ensureChargeReceiptToken } from '../../../../lib/invoicing';

const router = Router();

function bizumPage(opts: {
  business: string;
  logoHtml: string;
  amount: string;
  concept: string;
  phone: string;
  chargeId: number;
  claimed: boolean;
}): string {
  const { business, logoHtml, amount, concept, phone, chargeId, claimed } = opts;
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="theme-color" content="#16a34a"/>
  <title>Pagar ${amount} por Bizum — YaQu</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    :root{--brand:#16a34a;--brand-tint:#ecfdf5;--ink:#0f1c17;--body:#3f4a45;--muted:#6b756f;
      --bg:#f6f7f5;--surface:#fff;--border:#e7e9e5;}
    *{box-sizing:border-box}
    body{font-family:'Inter',system-ui,-apple-system,sans-serif;font-feature-settings:"cv11","ss01";
      margin:0;background:var(--bg);color:var(--body);min-height:100vh;display:flex;
      align-items:center;justify-content:center;padding:1rem;-webkit-font-smoothing:antialiased}
    .card{background:var(--surface);border:1px solid var(--border);border-radius:18px;
      box-shadow:0 1px 2px rgba(16,24,40,.04),0 18px 40px -16px rgba(16,24,40,.16);
      padding:1.75rem 1.5rem;max-width:420px;width:100%}
    .biz{display:flex;flex-direction:column;align-items:center;text-align:center;gap:.55rem;margin-bottom:1.1rem}
    .logo-mark{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#22d3ee);
      display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:#052e16}
    .logo-img{max-height:44px;max-width:130px;object-fit:contain}
    .biz-name{font-size:.9rem;font-weight:600;color:var(--ink)}
    h1{font-size:1.05rem;color:var(--ink);text-align:center;margin:0 0 1rem}
    .row{display:flex;align-items:center;justify-content:space-between;gap:.6rem;
      border:1px solid var(--border);border-radius:12px;padding:.8rem .9rem;margin-bottom:.6rem}
    .row-label{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
    .row-value{font-size:1rem;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums;word-break:break-all}
    .copy-btn{flex-shrink:0;border:1px solid var(--border);background:var(--surface);color:var(--ink);
      font:inherit;font-size:.78rem;font-weight:600;border-radius:999px;padding:.45rem .8rem;cursor:pointer;min-height:36px}
    .copy-btn:hover{background:var(--bg)}
    .steps{font-size:.82rem;color:var(--body);line-height:1.6;margin:1rem 0;padding-left:1.2rem}
    .cta{display:block;width:100%;border:0;border-radius:999px;background:var(--brand);color:#fff;
      font:inherit;font-weight:700;font-size:1rem;padding:.95rem 1rem;cursor:pointer;min-height:52px}
    .cta:hover{background:#15803d}
    .cta[disabled]{opacity:.6;cursor:default}
    .note{margin-top:.9rem;text-align:center;font-size:.78rem;color:var(--muted);line-height:1.5}
    .claimed{background:var(--brand-tint);border:1px solid #bbf7d0;border-radius:12px;padding:1rem;
      text-align:center;font-size:.9rem;color:#166534;font-weight:600;line-height:1.5}
    .back{display:block;text-align:center;margin-top:14px;font-size:.82rem;color:var(--muted)}
    :focus-visible{outline:none;box-shadow:0 0 0 3px rgba(34,197,94,.30)}
  </style>
</head>
<body>
  <div class="card">
    <div class="biz">${logoHtml}<div class="biz-name">${business}</div></div>
    <h1>Pagar por Bizum</h1>

    <div class="row">
      <div><div class="row-label">Enviar Bizum al</div><div class="row-value">${esc(phone)}</div></div>
      <button class="copy-btn" type="button" data-copy="${esc(phone)}" data-label="Copiar móvil">Copiar móvil</button>
    </div>
    <div class="row">
      <div><div class="row-label">Importe exacto</div><div class="row-value">${amount}</div></div>
      <button class="copy-btn" type="button" data-copy="${esc(amount.replace(/[^\d,.]/g, ''))}" data-label="Copiar importe">Copiar importe</button>
    </div>
    ${concept ? `
    <div class="row">
      <div><div class="row-label">Concepto</div><div class="row-value" style="font-size:.85rem">${concept}</div></div>
      <button class="copy-btn" type="button" data-copy="${concept}" data-label="Copiar concepto">Copiar concepto</button>
    </div>` : ''}

    ${claimed
      ? `<div class="claimed">✅ Aviso enviado. El profesional confirmará tu pago.</div>`
      : `
    <ol class="steps">
      <li>Abre la app de tu banco y entra en <strong>Bizum</strong>.</li>
      <li>Envía <strong>${amount}</strong> al móvil de arriba.</li>
      <li>Vuelve aquí y pulsa el botón para avisar al profesional.</li>
    </ol>
    <form method="POST" action="/pay/bizum/${chargeId}/claimed">
      <button class="cta" type="submit">He pagado por Bizum</button>
    </form>
    <div class="note">El profesional confirmará tu pago.</div>`}

    <a class="back" href="/pay/invoice/${chargeId}">← Otras formas de pago</a>
  </div>
  <script>
    document.querySelectorAll('.copy-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        navigator.clipboard.writeText(btn.getAttribute('data-copy') || '').then(function(){
          btn.textContent = '¡Copiado!';
          setTimeout(function(){ btn.textContent = btn.getAttribute('data-label'); }, 1600);
        });
      });
    });
  </script>
</body>
</html>`;
}

async function loadBizumCharge(id: number) {
  return prisma.charge.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true } },
      merchant: true,
    },
  });
}

router.get('/bizum/:chargeId', async (req, res) => {
  res.set('Cache-Control', 'no-store, must-revalidate');
  const id = parseNumericId(req.params.chargeId);
  if (!Number.isInteger(id)) return res.status(400).send(documentNotFoundHtml());

  const charge = await loadBizumCharge(id);
  if (!charge) return res.status(404).send(documentNotFoundHtml());
  if (charge.status === 'paid' || charge.status === 'expired') {
    const receiptToken = await ensureChargeReceiptToken(id, prisma);
    return res.redirect(303, `/recibo/${receiptToken}`);
  }

  const m = charge.merchant;
  const phone = m?.bizumPhone || m?.whatsappPhone;
  if (!isFlagEnabled('BIZUM_MANUAL_ENABLED', { merchant: m }) || !phone) {
    // Bizum no disponible para este cobro → de vuelta al selector
    return res.redirect(303, `/pay/invoice/${id}`);
  }

  const claimed = await prisma.event
    .findFirst({ where: { chargeId: id, type: 'bizum_claimed' }, select: { id: true } })
    .then(Boolean)
    .catch(() => false);

  const business = esc(m?.legalName || m?.name || 'Tu proveedor');
  const initial = esc((m?.name || m?.legalName || 'Y').trim().charAt(0).toUpperCase());
  // Si el logo no carga (URL rota, file://…), se oculta y no rompe la landing
  const logoHtml = m?.logoUrl
    ? `<img class="logo-img" src="${esc(m.logoUrl)}" alt="${business}" onerror="this.style.display='none'"/>`
    : `<div class="logo-mark">${initial}</div>`;
  const amount = esc(
    Number(charge.amount).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
      ' ' + charge.currency,
  );

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(bizumPage({
    business,
    logoHtml,
    amount,
    concept: esc(charge.concept || ''),
    phone,
    chargeId: id,
    claimed,
  }));
});

/** El cliente declara que ya envió el Bizum → evento + aviso al PRO (doble toque queda del lado del PRO). */
router.post('/bizum/:chargeId/claimed', async (req, res) => {
  const id = parseNumericId(req.params.chargeId);
  if (!Number.isInteger(id)) return res.status(400).send(documentNotFoundHtml());

  const charge = await loadBizumCharge(id);
  if (!charge) return res.status(404).send(documentNotFoundHtml());
  if (charge.status !== 'pending') {
    const receiptToken = await ensureChargeReceiptToken(id, prisma);
    return res.redirect(303, `/recibo/${receiptToken}`);
  }

  const already = await prisma.event
    .findFirst({ where: { chargeId: id, type: 'bizum_claimed' }, select: { id: true } })
    .catch(() => null);

  if (!already) {
    await prisma.event.create({
      data: { chargeId: id, type: 'bizum_claimed', payload: { ts: new Date().toISOString() } as any },
    });
    const customerName = charge.customer?.name || 'El cliente';
    const amount = `${Number(charge.amount).toFixed(2)} ${charge.currency}`;
    notifyMerchantAlert({
      merchantId: charge.merchantId,
      merchantPhone: charge.merchant?.whatsappPhone,
      customerName,
      action: 'dice que te ha pagado por Bizum',
      detail: `${amount} · Confírmalo en tu panel de YaQu`,
      freeText: `💸 ${customerName} dice que te ha enviado ${amount} por Bizum. Confírmalo en tu panel de YaQu (cobro #${charge.id}).`,
    }).catch((err) => console.error('[bizum/claimed] Error avisando al merchant:', err));
  }

  return res.redirect(303, `/pay/bizum/${id}`);
});

export default router;
