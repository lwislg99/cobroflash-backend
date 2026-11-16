// src/modules/billing/app/routes/payBizum.routes.ts
// C1-4 — Bizum manual asistido (sin PSP): el cliente ve el móvil del PRO,
// importe y concepto copiables, hace el Bizum desde SU banco y pulsa
// "He pagado por Bizum" (N5). El PRO confirma con doble toque en el panel
// → charge.paid con paid_via='bizum_manual' por la MISMA cadena post-pago.
// Master D3: Stripe Bizum no soporta Connect → manual asistido. Flag:
// BIZUM_MANUAL_ENABLED. Riesgo asumido: confirmación declarativa (como efectivo).
// SCRUM-85: identificado por Charge.receiptToken (patrón SCRUM-74), NO por el
// chargeId autoincremental — mismo token compartido con /recibo, /pay/card y /pay/invoice.
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { documentNotFoundHtml } from '../../../../core/http/publicNotFound';
import { comercioSuprimido } from '../../domain/comercioSuprimido'; // SCRUM-1573b
import { esc, formatImporteEs, formatMoneyEs } from '../../../../core/utils/utils';
import { etiquetaGuionDePago } from './pagoNavegador'; // SCRUM-1647 (CSP paso 2)
import { etiquetaEstiloDePago } from './pagoEstilo'; // SCRUM-1723 (style-src 'self')
import { isFlagEnabled } from '../../../../core/flags';
import { notifyMerchantAlert } from '../../../../integrations/whatsappNotifications';

const router = Router();

function bizumPage(opts: {
  business: string;
  logoHtml: string;
  amount: string;
  concept: string;
  phone: string;
  token: string;
  claimed: boolean;
}): string {
  const { business, logoHtml, amount, concept, phone, token, claimed } = opts;
  return `<!doctype html>
<html lang="es">
<head>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/><!-- SCRUM-184: sin esto el navegador pide /favicon.ico y se lleva un 404 -->
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="theme-color" content="#16a34a"/>
  <title>Pagar ${amount} por Bizum — YaQu</title>
  <link rel="stylesheet" href="/fonts/inter.css"/>
  ${etiquetaGuionDePago('bizum')}
  ${etiquetaEstiloDePago('bizum')}
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
      <div><div class="row-label">Concepto</div><div class="row-value row-value-concepto">${concept}</div></div>
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
    <form method="POST" action="/pay/bizum/${token}/claimed">
      <button class="cta" type="submit">He pagado por Bizum</button>
    </form>
    <div class="note">El profesional confirmará tu pago.</div>`}

    <a class="back" href="/pay/invoice/${token}">← Otras formas de pago</a>
  </div>
</body>
</html>`;
}

async function loadBizumCharge(token: string) {
  return prisma.charge.findUnique({
    where: { receiptToken: token },
    include: {
      customer: { select: { name: true } },
      merchant: true,
    },
  });
}

router.get('/bizum/:token', async (req, res) => {
  res.set('Cache-Control', 'no-store, must-revalidate');
  const token = req.params.token;

  const charge = await loadBizumCharge(token);
  if (!charge) return res.status(404).send(documentNotFoundHtml());
  if (comercioSuprimido(charge.merchant)) return res.status(404).send(documentNotFoundHtml()); // SCRUM-1573b
  const id = charge.id;
  if (charge.status === 'paid' || charge.status === 'expired') {
    return res.redirect(303, `/recibo/${token}`);
  }

  const m = charge.merchant;
  const phone = m?.bizumPhone || m?.whatsappPhone;
  if (!isFlagEnabled('BIZUM_MANUAL_ENABLED', { merchant: m }) || !phone) {
    // Bizum no disponible para este cobro → de vuelta al selector
    return res.redirect(303, `/pay/invoice/${token}`);
  }

  const claimed = await prisma.event
    .findFirst({ where: { chargeId: id, type: 'bizum_claimed' }, select: { id: true } })
    .then(Boolean)
    .catch(() => false);

  const business = esc(m?.legalName || m?.name || 'Tu proveedor');
  const initial = esc((m?.name || m?.legalName || 'Y').trim().charAt(0).toUpperCase());
  // Si el logo no carga (URL rota, file://…), se oculta y no rompe la landing: lo hace el guion de
  // `pagoNavegador.ts` (SCRUM-1647), que escucha el `error` del `.logo-img` sin manejador en línea.
  const logoHtml = m?.logoUrl
    ? `<img class="logo-img" src="${esc(m.logoUrl)}" alt="${business}"/>`
    : `<div class="logo-mark">${initial}</div>`;
  const amount = esc(
    formatImporteEs(Number(charge.amount)) +
      ' ' + charge.currency,
  );

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(bizumPage({
    business,
    logoHtml,
    amount,
    concept: esc(charge.concept || ''),
    phone,
    token,
    claimed,
  }));
});

/** El cliente declara que ya envió el Bizum → evento + aviso al PRO (doble toque queda del lado del PRO). */
router.post('/bizum/:token/claimed', async (req, res) => {
  const token = req.params.token;

  const charge = await loadBizumCharge(token);
  if (!charge) return res.status(404).send(documentNotFoundHtml());
  if (comercioSuprimido(charge.merchant)) return res.status(404).send(documentNotFoundHtml()); // SCRUM-1573b
  const id = charge.id;
  if (charge.status !== 'pending') {
    return res.redirect(303, `/recibo/${token}`);
  }

  const already = await prisma.event
    .findFirst({ where: { chargeId: id, type: 'bizum_claimed' }, select: { id: true } })
    .catch(() => null);

  if (!already) {
    await prisma.event.create({
      data: { chargeId: id, type: 'bizum_claimed', payload: { ts: new Date().toISOString() } as any },
    });
    const customerName = charge.customer?.name || 'El cliente';
    const amount = formatMoneyEs(charge.amount, charge.currency); // SCRUM-1436
    notifyMerchantAlert({
      merchantId: charge.merchantId,
      merchantPhone: charge.merchant?.whatsappPhone,
      customerName,
      action: 'dice que te ha pagado por Bizum',
      detail: `${amount} · Confírmalo en tu panel de YaQu`,
      freeText: `💸 ${customerName} dice que te ha enviado ${amount} por Bizum. Confírmalo en tu panel de YaQu (cobro #${charge.id}).`,
    }).catch((err) => console.error('[bizum/claimed] Error avisando al merchant:', err));
  }

  return res.redirect(303, `/pay/bizum/${token}`);
});

export default router;
