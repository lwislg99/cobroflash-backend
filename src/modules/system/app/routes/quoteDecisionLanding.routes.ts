import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import { prisma } from '../../../../core/db/prisma';
import { esc, parseNumericId } from '../../../../core/utils/utils';
import { getLocale } from '../../../../core/i18n/locales';

type DecisionApiError = { message?: string; error?: string };

const quoteDecisionLandingRouter = Router();
const BASE_API_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

function brandOverrideCss(brandColor?: string | null): string {
  if (!brandColor || !/^#[0-9a-fA-F]{6}$/.test(brandColor)) return '';
  // Si el merchant tiene color de marca, lo usamos en botones y acentos
  return `<style>
    .btn-accept, .btn-tier, .tier-recommended .btn-tier { background: ${brandColor} !important; }
    .merchant-avatar { background: ${brandColor} !important; color: #fff !important; }
    .tier-recommended, .tier-card.selected { border-color: ${brandColor} !important; }
    .tier-badge { background: ${brandColor} !important; color: #fff !important; }
    .success-check { background: ${brandColor} !important; }
    .total-row { border-top-color: ${brandColor} !important; }
    a { color: ${brandColor}; }
  </style>`;
}

function renderPage(title: string, body: string, brandColor?: string | null): string {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="theme-color" content="#16a34a"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased; font-feature-settings: "cv11","ss01";
      margin: 0; padding: 16px; background: #f6f7f5; color: #3f4a45; min-height: 100vh; }
    .card { max-width: 460px; margin: 24px auto; background: #fff; border: 1px solid #e7e9e5; border-radius: 18px;
      padding: 26px 24px; box-shadow: 0 1px 2px rgba(16,24,40,.04), 0 18px 40px -16px rgba(16,24,40,.16); }
    .merchant-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .merchant-logo { max-height: 48px; max-width: 120px; object-fit: contain; border-radius: 8px; }
    .merchant-name { font-weight: 700; font-size: 16px; color: #0f1c17; }
    .merchant-sub { font-size: 13px; color: #6b756f; }
    h1 { font-size: 19px; margin: 0 0 4px; color: #0f1c17; letter-spacing: -.01em; text-align: center; }
    h1 + .quote-meta { text-align: center; }
    .quote-meta { font-size: 13px; color: #6b756f; margin-bottom: 16px; }
    /* Total como héroe (estilo Recibo de confianza) */
    .amount-hero { text-align: center; padding: 16px 0 18px; margin: 16px 0;
      border-top: 1px solid #e7e9e5; border-bottom: 1px solid #e7e9e5; }
    .amount-hero-label { font-size: .72rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: .07em; color: #6b756f; margin-bottom: .5rem; }
    .amount-hero-value { font-size: 2.4rem; font-weight: 800; color: #0f1c17; line-height: 1;
      letter-spacing: -.025em; font-variant-numeric: tabular-nums; }
    /* Bloque de confianza */
    .trust { margin-top: 14px; text-align: center; }
    .trust-main { display: inline-flex; align-items: center; gap: .4rem; font-size: .8rem; font-weight: 600; color: #3f4a45; }
    .trust .lock { width: 13px; height: 13px; vertical-align: -1px; }
    .lines-table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 12px; }
    .lines-table th { text-align: left; padding: 4px 6px; color: #6b756f; font-size: 12px;
      border-bottom: 1px solid #e7e9e5; }
    .lines-table td { padding: 6px 6px; border-bottom: 1px solid #f1f2ee; }
    .lines-table td:last-child { text-align: right; }
    .total-row { display: flex; justify-content: space-between; font-weight: 800; color: #0f1c17;
      font-size: 20px; margin: 12px 0 20px; padding-top: 10px; border-top: 2px solid #e7e9e5;
      font-variant-numeric: tabular-nums; }
    .terms-badge { display: inline-block; font-size: 12px; padding: 3px 10px;
      border-radius: 999px; background: #eff6ff; color: #1d4ed8; margin-bottom: 16px; }
    .divider { border: none; border-top: 1px solid #e7e9e5; margin: 16px 0; }
    /* Firma */
    .sig-label { font-size: 13px; font-weight: 600; color: #333c37; margin-bottom: 6px; display: block; }
    .sig-sub { font-size: 12px; color: #6b756f; margin-bottom: 8px; }
    .sig-wrapper { border: 2px solid #cdd2cb; border-radius: 10px; background: #f7f8f6;
      position: relative; overflow: hidden; margin-bottom: 8px; }
    .sig-wrapper.has-sig { border-color: #22c55e; background: #fff; }
    #sig-canvas { display: block; width: 100%; height: 150px; cursor: crosshair; touch-action: none; }
    .sig-actions { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
    .btn-clear { font-size: 13px; padding: 6px 12px; border-radius: 8px;
      border: 1px solid #e7e9e5; background: #fff; cursor: pointer; color: #6b756f; }
    .btn-clear:hover { background: #f1f2ee; }
    .sig-placeholder { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
      color: #cdd2cb; font-size: 14px; pointer-events: none; user-select: none; white-space: nowrap; }
    .checkbox-fallback { display: flex; align-items: center; gap: 8px; font-size: 13px;
      color: #6b756f; margin-bottom: 16px; }
    /* Botones */
    .btn-accept { width: 100%; padding: 15px; font-size: 16px; font-weight: 700;
      background: #16a34a; color: #fff; border: none; border-radius: 14px; cursor: pointer;
      min-height: 52px; margin-top: 4px; box-shadow: 0 4px 14px -2px rgba(22,163,74,.35);
      transition: background .15s, transform .08s, box-shadow .15s; }
    .btn-accept:hover { background: #15803d; }
    .btn-accept:active { background: #15803d; transform: translateY(1px); }
    .btn-accept:disabled { opacity: .5; cursor: default; }
    .btn-reject { width: 100%; padding: 14px; font-size: 16px; font-weight: 700;
      background: #dc2626; color: #fff; border: none; border-radius: 12px; cursor: pointer;
      min-height: 52px; margin-top: 4px; }
    .btn-reject:active { background: #b91c1c; }
    .status-ok { background: #ecfdf5; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .status-ok strong { color: #166534; }
    .status-error { background: #fef2f2; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .status-error strong { color: #991b1b; }
    small { font-size: 12px; color: #6b756f; display: block; text-align: center; margin-top: 12px; }
    select, textarea { width: 100%; font-size: 15px; padding: 10px 12px;
      border-radius: 10px; border: 1px solid #cdd2cb; margin-bottom: 12px; }
    textarea { min-height: 80px; resize: vertical; }
    /* FRONT1-6 — landing cliente premium */
    .merchant-hero { text-align: center; padding: 8px 0 18px; }
    .merchant-hero .merchant-logo { max-height: 64px; max-width: 180px; margin-bottom: 10px; }
    .merchant-hero .merchant-name { font-size: 22px; font-weight: 800; color: #0f1c17; }
    .merchant-hero .merchant-sub { font-size: 13px; color: #6b756f; margin-top: 2px; }
    .merchant-avatar { width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 10px;
      background: linear-gradient(135deg,#22c55e,#22d3ee); color: #052e16; font-weight: 800;
      font-size: 26px; display: flex; align-items: center; justify-content: center; }
    .line-icon { display: inline-block; width: 22px; text-align: center; margin-right: 4px; }
    .validity-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px;
      background: #fffbeb; color: #b45309; padding: 4px 12px; border-radius: 999px; margin-bottom: 12px; }
    .btn-share { display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; padding: 12px; font-size: 15px; font-weight: 700; background: #25D366; color: #fff;
      border: none; border-radius: 12px; cursor: pointer; text-decoration: none; margin-top: 10px; }
    .success-check { width: 72px; height: 72px; border-radius: 50%; background: #16a34a; color: #fff;
      font-size: 40px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
      animation: pop .4s cubic-bezier(.2,1.4,.4,1) both; }
    @keyframes pop { from { transform: scale(0); } to { transform: scale(1); } }
    .confetti-piece { position: fixed; top: -12px; width: 9px; height: 9px; z-index: 9999;
      border-radius: 1px; animation: confetti-fall linear forwards; }
    @keyframes confetti-fall { to { transform: translateY(105vh) rotate(540deg); opacity: 1; } }
  </style>
  ${brandOverrideCss(brandColor)}
</head>
<body><div class="card">${body}</div></body>
</html>`;
}

function termsLabel(terms: string | null): string {
  if (terms === 'FIFTY_FIFTY') return '50% al aceptar · 50% al finalizar';
  if (terms === 'FULL_UPFRONT') return 'Pago completo al aceptar';
  return terms ?? 'Pago completo';
}

async function loadQuote(id: number) {
  return prisma.quote.findUnique({
    where: { id },
    include: {
      merchant: { select: { name: true, legalName: true, logoUrl: true, address: true, country: true, brandColor: true, brandAccentColor: true } },
      customer: { select: { name: true } },
    },
  });
}

function renderTierCards(tiers: any[], quoteId: string, locale: ReturnType<typeof getLocale>): string {
  return `
    <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px" id="tier-cards">
      ${tiers.map((tier) => `
        <div class="tier-card ${tier.recommended ? 'tier-recommended' : ''}" data-tier-id="${esc(tier.id)}">
          ${tier.recommended ? `<div class="tier-badge">⭐ Más popular</div>` : ''}
          <div class="tier-header">
            <span class="tier-label">${esc(tier.label)}</span>
            ${tier.description ? `<span class="tier-desc">${esc(tier.description)}</span>` : ''}
          </div>
          <div class="tier-lines">
            ${(tier.lines || []).map((l: any) => `
              <div class="tier-line">
                <span>${esc(l.concept)}</span>
                <span>${(l.qty * l.price * (1 + (l.tax || 0))).toFixed(2)} ${esc(tier.currency || '')}</span>
              </div>`).join('')}
          </div>
          <div class="tier-total">${Number(tier.total).toFixed(2)} ${esc(tier.currency || '')}</div>
          <button class="btn-tier" onclick="selectTier('${esc(tier.id)}', '${esc(quoteId)}')">
            Elegir este plan
          </button>
        </div>
      `).join('')}
    </div>
    <div id="tier-confirm" style="display:none">
      <hr class="divider"/>
      <p style="font-size:14px;color:#333c37;margin-bottom:12px">
        Has elegido: <strong id="chosen-tier-label"></strong>
      </p>
    </div>
  `;
}

const TIER_CSS = `
  .tier-card { border: 2px solid #e7e9e5; border-radius: 14px; padding: 16px; position: relative; background: #fff; }
  .tier-recommended { border-color: #22c55e; background: #f0fdf4; }
  .tier-badge { position: absolute; top: -10px; left: 16px; background: #22c55e; color: #052e16;
    font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 999px; }
  .tier-header { margin-bottom: 10px; }
  .tier-label { font-weight: 700; font-size: 16px; display: block; }
  .tier-desc { font-size: 13px; color: #6b756f; }
  .tier-lines { font-size: 13px; color: #333c37; margin-bottom: 10px; }
  .tier-line { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f1f2ee; }
  .tier-total { font-size: 22px; font-weight: 800; color: #0f1c17; margin: 10px 0 12px; }
  .btn-tier { width: 100%; padding: 12px; font-size: 15px; font-weight: 700; border: none;
    border-radius: 10px; cursor: pointer; background: #22c55e; color: #052e16; min-height: 48px; }
  .tier-recommended .btn-tier { background: #16a34a; color: #fff; }
  .tier-card.selected { border-color: #16a34a; box-shadow: 0 0 0 3px rgba(22,163,74,0.2); }
`;

const TIER_JS = (quoteId: string) => `
<script>
let selectedTierId = null;
function selectTier(tierId, qId) {
  selectedTierId = tierId;
  document.querySelectorAll('.tier-card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector('[data-tier-id="' + tierId + '"]');
  if (card) card.classList.add('selected');
  const label = card ? card.querySelector('.tier-label').textContent : tierId;
  document.getElementById('chosen-tier-label').textContent = label;
  document.getElementById('tier-confirm').style.display = 'block';
  document.getElementById('btn-accept').style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
</script>`;

function lineIcon(concept: string): string {
  const c = String(concept || '').toLowerCase();
  if (/(mano de obra|hora|jornal|instalaci|montaj|reparaci)/.test(c)) return '🔧';
  if (/(material|tuber|cable|pintura|placa|cemento|pieza|grifo|caldera)/.test(c)) return '📦';
  if (/(desplaz|viaje|\bkm\b|transporte|dieta)/.test(c)) return '🚚';
  if (/(revisi|diagn|inspec|presupuesto|estudio)/.test(c)) return '🔍';
  return '•';
}

function renderQuoteDetail(quote: Awaited<ReturnType<typeof loadQuote>>, quoteId: string): string {
  if (!quote) return `<h1>Cotización #${esc(quoteId)}</h1>`;

  const merchantName = esc(quote.merchant?.legalName || quote.merchant?.name || '');
  const hero = quote.merchant?.logoUrl
    ? `<img class="merchant-logo" src="${esc(quote.merchant.logoUrl)}" alt="logo"/>`
    : `<div class="merchant-avatar">${esc((merchantName || '?').charAt(0).toUpperCase())}</div>`;
  const customerName = esc(quote.customer?.name || 'Cliente');
  const lines: any[] = Array.isArray(quote.lines) ? quote.lines : [];

  const linesHtml = lines.length
    ? `<table class="lines-table">
        <thead><tr><th>Concepto</th><th>Cant.</th><th>Total</th></tr></thead>
        <tbody>${lines.map((l: any) => `
          <tr>
            <td><span class="line-icon">${lineIcon(l.concept)}</span>${esc(l.concept)}</td>
            <td>${esc(l.qty)}</td>
            <td>${Number(l.qty * l.price).toFixed(2)} ${esc(quote.currency)}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : '';

  const terms = (quote as any).paymentTerms ?? null;

  // Validez: 30 días desde la creación
  let validityHtml = '';
  if ((quote as any).createdAt) {
    const until = new Date(new Date((quote as any).createdAt).getTime() + 30 * 86_400_000);
    const untilStr = until.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    validityHtml = `<div class="validity-badge">⏳ Válido hasta el ${untilStr}</div>`;
  }

  return `
    <div class="merchant-hero">
      ${hero}
      <div class="merchant-name">${merchantName}</div>
      ${quote.merchant?.address ? `<div class="merchant-sub">${esc(quote.merchant.address)}</div>` : ''}
    </div>
    <h1>Hola, ${customerName} 👋</h1>
    <div class="quote-meta">Presupuesto #${esc(quoteId)}</div>
    ${validityHtml ? `<div style="text-align:center">${validityHtml}</div>` : ''}
    ${linesHtml}
    <div class="amount-hero">
      <div class="amount-hero-label">Total del presupuesto</div>
      <div class="amount-hero-value">${Number(quote.total).toFixed(2)} ${esc(quote.currency)}</div>
    </div>
    ${terms ? `<div style="text-align:center;margin-bottom:4px"><span class="terms-badge">${esc(termsLabel(terms))}</span></div>` : ''}
  `;
}

const SIG_JS = `
<script>
(function() {
  const canvas = document.getElementById('sig-canvas');
  const wrapper = canvas ? canvas.parentElement : null;
  const placeholder = document.getElementById('sig-placeholder');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let drawing = false;
  let hasSig = false;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const prev = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.putImageData(prev, 0, 0);
    ctx.strokeStyle = '#0f1c17';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  resize();
  window.addEventListener('resize', resize);

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  function start(e) {
    e.preventDefault();
    drawing = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!hasSig) {
      hasSig = true;
      if (placeholder) placeholder.style.display = 'none';
      if (wrapper) wrapper.classList.add('has-sig');
    }
  }
  function end(e) { drawing = false; }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  document.getElementById('sig-clear')?.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width / (window.devicePixelRatio||1), canvas.height / (window.devicePixelRatio||1));
    hasSig = false;
    if (placeholder) placeholder.style.display = '';
    if (wrapper) wrapper.classList.remove('has-sig');
  });

  // Exponer para el submit
  window.getSignatureData = function() {
    if (!hasSig) return null;
    return canvas.toDataURL('image/png');
  };
  window.sigIsEmpty = function() { return !hasSig; };
})();
</script>`;

// GET /pay/quote/:id  (landing del botón "Ver presupuesto") y alias /quote/:id/accept
// Muestra el detalle + firma/aceptar + enlace para rechazar.
quoteDecisionLandingRouter.get(['/quote/:id', '/quote/:id/accept'], async (req: Request, res: Response) => {
  const id = parseNumericId(req.params.id);            // tolera URLs sucias ('{{1}}23' → 23)
  const quoteId = Number.isInteger(id) ? String(id) : '';  // id limpio para enlaces/forms del HTML

  let quoteDetail = '';
  let locale = getLocale('ES');
  let tierCards = '';
  let hasTiers = false;
  let loadedQuote: Awaited<ReturnType<typeof loadQuote>> | null = null;
  let brandColor: string | null = null;

  if (Number.isInteger(id)) {
    const quote = await loadQuote(id).catch(() => null);
    loadedQuote = quote;
    if (quote) {
      locale = getLocale(quote.merchant?.country);
      brandColor = quote.merchant?.brandColor ?? null;
      if (quote.status === 'draft' || quote.status === 'sent') {
        quoteDetail = renderQuoteDetail(quote, quoteId);
        const tiers = (quote as any).tiers as any[] | null;
        if (tiers && tiers.length > 0) {
          hasTiers = true;
          // Añadir currency a cada tier para el render
          const tiersWithCurrency = tiers.map((t: any) => ({ ...t, currency: quote.currency }));
          tierCards = renderTierCards(tiersWithCurrency, quoteId, locale);
        }
      } else if (quote.status === 'accepted') {
        return res.setHeader('Content-Type', 'text/html; charset=utf-8').send(
          renderPage(`${locale.quote} ya aceptada`, `<div class="status-ok"><strong>Este ${locale.quoteVerb} ya fue aceptado.</strong><br/>Gracias por tu confianza.</div>`, brandColor)
        );
      }
    }
  }

  const shareName = (loadedQuote?.merchant?.legalName || loadedQuote?.merchant?.name || 'el profesional');
  const shareTextEnc = encodeURIComponent(`✅ He aceptado mi ${locale.quoteVerb} con ${shareName}. ¡Gracias!`);

  const html = renderPage(`Aceptar ${locale.quoteVerb}`, `<style>${TIER_CSS}</style>
    ${quoteDetail}
    ${hasTiers ? tierCards : ''}
    ${TIER_JS(quoteId)}
    <div id="btn-accept-wrapper" style="${hasTiers ? 'display:none' : ''}">
    <label class="sig-label">Tu firma</label>
    <p class="sig-sub">Dibuja tu firma con el dedo o el ratón</p>
    <div class="sig-wrapper" id="sig-wrapper">
      <canvas id="sig-canvas"></canvas>
      <span class="sig-placeholder" id="sig-placeholder">✍️ Firma aquí</span>
    </div>
    <div class="sig-actions">
      <button type="button" class="btn-clear" id="sig-clear">Borrar</button>
      <label class="checkbox-fallback">
        <input type="checkbox" id="no-sig-check"/>
        Acepto sin dibujar firma
      </label>
    </div>
    <button class="btn-accept" id="btn-accept">Firmar y aceptar ${locale.quoteVerb}</button>
    <div class="trust">
      <span class="trust-main">
        <svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Tu aceptación queda registrada de forma segura
      </span>
    </div>
    <div id="sig-error" style="color:#dc2626;font-size:13px;margin-top:8px;display:none">
      Dibuja tu firma o marca "Acepto sin dibujar firma".
    </div>
    <small>Si no solicitaste este ${locale.quoteVerb}, cierra esta página.</small>
    </div>
    <a href="/pay/quote/${quoteId}/reject" style="display:block;text-align:center;margin-top:16px;font-size:13.5px;color:#6b756f;text-decoration:underline">No me interesa · Rechazar ${locale.quoteVerb}</a>
    ${SIG_JS}
    <script>
    function fireConfetti() {
      const colors = ['#22c55e','#16a34a','#22d3ee','#fbbf24','#f87171','#a78bfa'];
      for (let i = 0; i < 80; i++) {
        const p = document.createElement('div');
        p.className = 'confetti-piece';
        p.style.left = Math.random() * 100 + 'vw';
        p.style.background = colors[i % colors.length];
        p.style.animationDuration = (2 + Math.random() * 1.5) + 's';
        p.style.animationDelay = (Math.random() * 0.4) + 's';
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 4200);
      }
    }
    document.getElementById('btn-accept').addEventListener('click', async () => {
      const noSig = document.getElementById('no-sig-check').checked;
      const sigData = window.getSignatureData ? window.getSignatureData() : null;
      if (!sigData && !noSig) {
        document.getElementById('sig-error').style.display = 'block';
        return;
      }
      document.getElementById('sig-error').style.display = 'none';
      const btn = document.getElementById('btn-accept');
      btn.disabled = true; btn.textContent = 'Enviando…';
      try {
        const res = await fetch('/quote/${quoteId}/decision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision: 'accept',
            comment: sigData ? 'Aceptado con firma digital' : 'Aceptado desde enlace WhatsApp',
            signatureData: sigData,
            tierId: (typeof selectedTierId !== 'undefined' ? selectedTierId : null),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          fireConfetti();
          document.querySelector('.card').innerHTML =
            '<div style="text-align:center;padding:12px 0">' +
              '<div class="success-check">✓</div>' +
              '<h1 style="font-size:20px;margin:0 0 6px">¡${locale.quote} aceptada' + (sigData ? ' y firmada' : '') + '!</h1>' +
              '<p style="color:#6b756f;font-size:14px;margin:0 0 18px">Gracias por tu confianza. El profesional te informará de los siguientes pasos.</p>' +
              '<a class="btn-share" target="_blank" rel="noopener" href="https://wa.me/?text=${shareTextEnc}">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M.06 24l1.69-6.16a11.87 11.87 0 01-1.59-5.95C.16 5.34 5.5 0 12.06 0a11.82 11.82 0 018.42 3.49 11.82 11.82 0 013.48 8.41c0 6.56-5.34 11.9-11.9 11.9a11.9 11.9 0 01-5.69-1.45L.06 24z"/></svg>' +
                'Compartir por WhatsApp</a>' +
            '</div>';
        } else {
          btn.disabled = false; btn.textContent = 'Firmar y aceptar ${locale.quoteVerb}';
          document.getElementById('sig-error').textContent = data.error || 'Error al procesar.';
          document.getElementById('sig-error').style.display = 'block';
        }
      } catch {
        btn.disabled = false; btn.textContent = 'Firmar y aceptar cotización';
        document.getElementById('sig-error').textContent = 'Error de conexión.';
        document.getElementById('sig-error').style.display = 'block';
      }
    });
    </script>
  `, brandColor);
  res.setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
});

// GET /pay/quote/:id/reject
quoteDecisionLandingRouter.get('/quote/:id/reject', async (req: Request, res: Response) => {
  const id = parseNumericId(req.params.id);                 // tolera URLs sucias
  const quoteId = Number.isInteger(id) ? String(id) : '';   // id limpio para el HTML

  let quoteDetail = '';
  let locale = getLocale('ES');
  let brandColor: string | null = null;

  if (Number.isInteger(id)) {
    const quote = await loadQuote(id).catch(() => null);
    if (quote) {
      locale = getLocale(quote.merchant?.country);
      brandColor = quote.merchant?.brandColor ?? null;
      if (quote.status === 'draft' || quote.status === 'sent') {
        quoteDetail = renderQuoteDetail(quote, quoteId);
      }
    }
  }

  const html = renderPage(`Rechazar ${locale.quoteVerb}`, `
    ${quoteDetail}
    <h2 style="font-size:16px;font-weight:700;color:#0f1c17;margin:0 0 4px;text-align:center">¿Por qué lo rechazas?</h2>
    <p style="font-size:13px;color:#6b756f;margin:0 0 16px;text-align:center">Tu respuesta ayuda al profesional a mejorar (opcional).</p>
    <form method="post">
      <div><label style="font-size:13px;font-weight:600;color:#333c37;display:block;margin-bottom:5px">Motivo</label>
        <select name="reason">
          <option value="">Selecciona una opción</option>
          <option value="price">El precio es demasiado alto</option>
          <option value="another_provider">He elegido otro proveedor</option>
          <option value="no_longer_needed">Ya no necesito el servicio</option>
          <option value="other">Otro motivo</option>
        </select>
      </div>
      <div><label style="font-size:13px;font-weight:600;color:#333c37;display:block;margin-bottom:5px">Comentario (opcional)</label>
        <textarea name="comment" placeholder="Cuéntanos algo más si quieres..."></textarea>
      </div>
      <button class="btn-reject" type="submit">Enviar rechazo</button>
    </form>
    <a href="/pay/quote/${esc(quoteId)}" style="display:block;text-align:center;margin-top:16px;font-size:13.5px;color:#15803d;font-weight:600;text-decoration:none">← Volver y aceptar</a>
    <small>Si no solicitaste este ${locale.quoteVerb}, cierra esta página.</small>
  `, brandColor);
  res.setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
});

// POST /pay/quote/:id/reject
quoteDecisionLandingRouter.post('/quote/:id/reject', async (req: Request, res: Response) => {
  const quoteId = parseNumericId(req.params.id);   // tolera URLs sucias ('{{1}}23' → 23)
  const { reason, comment } = req.body || {};
  const finalComment = (reason ? `Motivo: ${reason}. ` : '') + (comment ? String(comment) : '').trim();
  try {
    const apiResponse = await fetch(
      `${BASE_API_URL}/quote/${encodeURIComponent(quoteId)}/decision`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'reject', comment: finalComment || 'Rechazado desde enlace WhatsApp' }) }
    );
    const json = (await apiResponse.json().catch(() => null)) as DecisionApiError | null;
    if (!apiResponse.ok) {
      return res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8').send(
        renderPage('Error', `<div class="status-error"><strong>No se pudo registrar el rechazo.</strong><br/>${json?.error || ''}</div>`)
      );
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8').send(
      renderPage('Rechazo registrado', `<div class="status-ok"><strong>Gracias por tu respuesta.</strong><br/>Hemos registrado el rechazo de la cotización <strong>#${esc(quoteId)}</strong>.</div>`)
    );
  } catch {
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8').send(
      renderPage('Error', `<div class="status-error"><strong>Error inesperado.</strong> Inténtalo más tarde.</div>`)
    );
  }
});

export { quoteDecisionLandingRouter };
