import express, { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import { prisma } from '../../../../core/db/prisma';
import { esc, parseToken, formatMoneyEs } from '../../../../core/utils/utils';
import { getLocale } from '../../../../core/i18n/locales';
import { documentNotFoundHtml } from '../../../../core/http/publicNotFound';
import { isQuoteExpired } from '../../../quotes/domain/expire.service';
// SCRUM-806 · la MISMA puerta que usa la ruta de admin para armar el PDF: si el documento del
// cliente se armara por otro sitio, serían dos documentos distintos con el mismo nombre.
import { paramsDePresupuestoParaPdf } from '../../../quotes/domain/presupuestoParaPdf';
import { calcVatBreakdown } from '../../../invoicing/domain/vat.service';
// SCRUM-633 · el calendario en el que vive el merchant. Sitio único desde SCRUM-643.
import { zonaDelMerchant } from '../../../../core/zonaDelMerchant';

type DecisionApiError = { message?: string; error?: string };

const quoteDecisionLandingRouter = Router();
const BASE_API_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

function brandOverrideCss(brandColor?: string | null): string {
  if (!brandColor || !/^#[0-9a-fA-F]{6}$/.test(brandColor)) return '';
  // El color de marca del negocio va en ACENTOS (avatar, bordes, badges, enlaces),
  // NUNCA en el botón primario de aceptar/firmar: ese es SIEMPRE el verde de marca
  // (P1-1: un brandColor rojo hacía que "Firmar y aceptar" saliera rojo). El rojo
  // se reserva para rechazar.
  return `<style>
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
  <!-- SCRUM-184: sin esta línea el navegador pide /favicon.ico por su cuenta y se lleva un 404,
       que el cliente ve en su consola nada más abrir el presupuesto. No había favicon en TODO el
       repo. Declarado aquí, el navegador usa este y deja de pedir el .ico. -->
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
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
    /* P2-5: table-layout fixed + anchos para que el Total nunca se recorte en 390px */
    .lines-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 14px; margin-bottom: 12px; }
    .lines-table th { text-align: left; padding: 4px 6px; color: #6b756f; font-size: 12px;
      border-bottom: 1px solid #e7e9e5; }
    .lines-table td { padding: 6px 6px; border-bottom: 1px solid #f1f2ee; }
    .lines-table td:first-child { overflow-wrap: break-word; }
    .lines-table th:nth-child(2), .lines-table td:nth-child(2) { width: 44px; text-align: right; }
    .lines-table th:nth-child(3), .lines-table td:nth-child(3) { width: 100px; text-align: right;
      white-space: nowrap; font-variant-numeric: tabular-nums; }
    @media (max-width: 420px) { .lines-table { font-size: 13px; }
      .lines-table th:nth-child(3), .lines-table td:nth-child(3) { width: 92px; } }
    .total-row { display: flex; justify-content: space-between; font-weight: 800; color: #0f1c17;
      font-size: 20px; margin: 12px 0 20px; padding-top: 10px; border-top: 2px solid #e7e9e5;
      font-variant-numeric: tabular-nums; }
    /* PC-B: desglose de IVA (base + cuota por tipo) coherente con el Total */
    .totals-block { margin: 4px 0 0; }
    .totals-row { display: flex; justify-content: space-between; align-items: baseline;
      font-size: 14px; color: #6b756f; padding: 3px 6px; font-variant-numeric: tabular-nums; }
    .totals-row span:last-child { color: #3f4a45; font-weight: 600; }
    .terms-badge { display: inline-block; font-size: 12px; padding: 3px 10px;
      border-radius: 999px; background: #eff6ff; color: #1d4ed8; margin-bottom: 16px; }
    /* V8/N1: política de señal junto a las condiciones (solo cuando hay señal 50/50) */
    .senal-policy { text-align: center; font-size: 12px; color: #6b756f; margin: 0 0 12px; }
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
    /* PC-A: "Tengo una duda" → WhatsApp del PRO. Secundario (no verde) para respetar la
       Regla de Una Sola Voz: el unico CTA primario es "Firmar y aceptar". */
    .btn-duda { display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; min-height: 48px; padding: 12px; margin-top: 14px; font-size: 14px;
      font-weight: 600; color: #0f1c17; background: #fff; border: 1px solid #e7e9e5;
      border-radius: 12px; text-decoration: none; }
    .btn-duda:hover { background: #f6f7f5; }
    .success-check { width: 72px; height: 72px; border-radius: 50%; background: #16a34a; color: #fff;
      font-size: 40px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
      animation: pop .4s cubic-bezier(.2,1.4,.4,1) both; }
    @keyframes pop { from { transform: scale(0); } to { transform: scale(1); } }
    .confetti-piece { position: fixed; top: -12px; width: 9px; height: 9px; z-index: 9999;
      border-radius: 1px; animation: confetti-fall linear forwards; }
    @keyframes confetti-fall { to { transform: translateY(105vh) rotate(540deg); opacity: 1; } }
    /* AB6: anillo de Foco accesible (DESIGN.md "Foco") en todo elemento enfocado por teclado */
    :focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(34,197,94,.30); }
    /* AB6: respetar prefers-reduced-motion — sin confeti, sin pop, sin transiciones */
    @media (prefers-reduced-motion: reduce) {
      .success-check { animation: none; }
      .confetti-piece { display: none; animation: none; }
      .btn-accept { transition: none; }
    }
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

async function loadQuote(token: string) {
  return prisma.quote.findUnique({
    where: { decisionToken: token },
    include: {
      // SCRUM-633 · `timezone`: la página que ve el CLIENTE imprime la fecha de caducidad DOS
      // veces, y sin este campo las dos saldrían en la zona del contenedor. Mismo `select`
      // explícito, mismo riesgo: lo que no esté aquí no sale.
      merchant: { select: { name: true, legalName: true, logoUrl: true, address: true, country: true, brandColor: true, brandAccentColor: true, whatsappPhone: true, timezone: true } },
      customer: { select: { name: true } },
    },
  });
}

function renderTierCards(tiers: any[], token: string, locale: ReturnType<typeof getLocale>): string {
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
                <span>${formatMoneyEs(l.qty * l.price, tier.currency)}</span>
              </div>`).join('')}
          </div>
          <div class="tier-total">${formatMoneyEs(tier.total, tier.currency)}</div>
          <div class="tier-vat-note">IVA incluido</div>
          <button class="btn-tier" onclick="selectTier('${esc(tier.id)}', '${esc(token)}')">
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
  .tier-total { font-size: 22px; font-weight: 800; color: #0f1c17; margin: 10px 0 0; }
  .tier-vat-note { font-size: 11px; color: #6b756f; margin: 0 0 12px; }
  .btn-tier { width: 100%; padding: 12px; font-size: 15px; font-weight: 700; border: none;
    border-radius: 10px; cursor: pointer; background: #22c55e; color: #052e16; min-height: 48px; }
  .tier-recommended .btn-tier { background: #16a34a; color: #fff; }
  .tier-card.selected { border-color: #16a34a; box-shadow: 0 0 0 3px rgba(22,163,74,0.2); }
`;

const TIER_JS = (token: string) => `
<script>
let selectedTierId = null;
function selectTier(tierId, qId) {
  selectedTierId = tierId;
  document.querySelectorAll('.tier-card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector('[data-tier-id="' + tierId + '"]');
  if (card) card.classList.add('selected');
  const label = card ? card.querySelector('.tier-label').textContent : tierId;
  const totalTxt = card ? card.querySelector('.tier-total').textContent : '';
  document.getElementById('chosen-tier-label').textContent = label + (totalTxt ? ' · ' + totalTxt : '');
  document.getElementById('tier-confirm').style.display = 'block';
  // A20.1 FIX: mostrar el BLOQUE ENTERO de firma (canvas + checkbox + botón).
  // Antes solo se "mostraba" el botón, que vive dentro de un wrapper oculto →
  // no aparecía nada y el GBB parecía roto.
  const wrap = document.getElementById('btn-accept-wrapper');
  if (wrap) wrap.style.display = 'block';
  // A20.1: el total del héroe y el botón REFLEJAN la elección (antes el héroe
  // enseñaba el total del tier recomendado sin explicar de dónde salía)
  const heroVal = document.querySelector('.amount-hero-value');
  if (heroVal && totalTxt) heroVal.textContent = totalTxt;
  const heroLabel = document.querySelector('.amount-hero-label');
  // SCRUM-212: «IVA incluido» iba SIN condición, así que un presupuesto con tramos y cuota 0
  // le afirmaba al cliente que el IVA estaba incluido cuando no había ninguno. El servidor solo
  // pinta \`.totals-block\` cuando hay cuota, así que se reusa ESA condición en vez de repetirla
  // aquí y arriesgarse a que las dos se separen. Sin cuota no se afirma nada sobre el IVA —
  // que es justo lo que ya hacía la ruta sin tramos («Total del presupuesto»).
  var conIva = !!document.querySelector('.totals-block');
  if (heroLabel) heroLabel.textContent = 'Total · ' + label + (conIva ? ' · IVA incluido' : '');
  const btn = document.getElementById('btn-accept');
  if (btn && totalTxt) btn.textContent = 'Firmar y aceptar — ' + label + ' (' + totalTxt + ')';
  // Llevar al cliente a la FIRMA (lo que toca hacer ahora), no a la tarjeta
  document.getElementById('tier-confirm').scrollIntoView({ behavior: 'smooth', block: 'start' });
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

function renderQuoteDetail(
  quote: Awaited<ReturnType<typeof loadQuote>>,
  token: string,
  // A20.1: con tiers, el héroe no puede enseñar el total del "recomendado" sin
  // contexto (números que no cuadran con las tarjetas) → "Desde X €" + guía.
  tiersInfo?: { min: number } | null,
): string {
  if (!quote) return `<h1>Cotización #${esc(token)}</h1>`;

  const merchantName = esc(quote.merchant?.legalName || quote.merchant?.name || '');
  const hero = quote.merchant?.logoUrl
    ? `<img class="merchant-logo" src="${esc(quote.merchant.logoUrl)}" alt="logo"/>`
    : `<div class="merchant-avatar">${esc((merchantName || '?').charAt(0).toUpperCase())}</div>`;
  const customerName = esc(quote.customer?.name || 'Cliente');
  const lines: any[] = Array.isArray(quote.lines) ? quote.lines : [];
  const cur = esc(quote.currency);
  const money = (n: number) => formatMoneyEs(n, quote.currency); // A6.6: 2.383,70 €

  // PC-B: columna "Importe" = NET (qty*price), MISMA fórmula que en los tiers; el IVA va
  // desglosado debajo. Así la suma de las líneas (= Base imponible) + IVA cuadra con el Total.
  const linesHtml = lines.length
    ? `<table class="lines-table">
        <thead><tr><th>Concepto</th><th>Cant.</th><th>Importe</th></tr></thead>
        <tbody>${lines.map((l: any) => `
          <tr>
            <td><span class="line-icon">${lineIcon(l.concept)}</span>${esc(l.concept)}</td>
            <td>${esc(l.qty)}</td>
            <td>${money(l.qty * l.price)}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : '';

  // PC-B: desglose de IVA (España). Si no hay cuota → Total plano sin desglose.
  //
  // ⚠️ SCRUM-212 · UNA CUOTA 0 NO ES UNA EXENCIÓN. Aquí ponía «(LATAM/exento)», y eso es un
  // claim fiscal derivado de un importe: de `cuota === 0` no se deduce nada: puede ser un país
  // donde no se repercute, un tipo 0, o una línea sin tipo informado. «Exento» es una
  // calificación con causa legal propia (arts. 20-25 LIVA, y en el registro VeriFactu se
  // declara en `OperacionExenta` con causa E1..E6, NO con el tipo), y quién lo es sale del
  // dictamen del asesor, no de que un número valga cero. Por eso el copy visible no afirma
  // nada cuando no hay cuota: dice «Total del presupuesto» y punto.
  const vat = calcVatBreakdown(lines);
  const hasVat = vat.cuota > 0;
  const vatHtml = hasVat
    ? `<div class="totals-block">
        <div class="totals-row"><span>Base imponible</span><span>${money(vat.base)}</span></div>
        ${vat.entries.filter((e) => e.rate > 0).map((e) => `
        <div class="totals-row"><span>IVA (${e.rate}%)</span><span>${money(e.cuota)}</span></div>`).join('')}
      </div>`
    : '';

  const terms = (quote as any).paymentTerms ?? null;

  // A16.2: validez REAL de la columna validUntil (fallback legacy: creación+30d)
  let validityHtml = '';
  const untilRaw = (quote as any).validUntil
    ? new Date((quote as any).validUntil)
    : ((quote as any).createdAt ? new Date(new Date((quote as any).createdAt).getTime() + 30 * 86_400_000) : null);
  if (untilRaw) {
    // 🔴 SCRUM-633 · `timeZone` EXPLÍCITO. Sin él, `toLocaleDateString` usa la zona del PROCESO,
    // y nadie la fija en el despliegue: la fecha que lee el cliente salía de con qué zona
    // arrancara el contenedor. Ahora sale de la del NEGOCIO — que es de quien es la validez, no
    // del dispositivo que la mira ni de la máquina que la sirve.
    const untilStr = untilRaw.toLocaleDateString('es-ES', {
      timeZone: zonaDelMerchant((quote as any).merchant),
      day: '2-digit', month: 'long', year: 'numeric',
    });
    validityHtml = `<div class="validity-badge">⏳ Válido hasta el ${untilStr}</div>`;
  }

  return `
    <div class="merchant-hero">
      ${hero}
      <div class="merchant-name">${merchantName}</div>
      ${quote.merchant?.address ? `<div class="merchant-sub">${esc(quote.merchant.address)}</div>` : ''}
    </div>
    <h1>Hola, ${customerName} 👋</h1>
    <div class="quote-meta">Presupuesto #${esc(String(quote.quoteNumber ?? quote.id))}</div>
    ${validityHtml ? `<div style="text-align:center">${validityHtml}</div>` : ''}
    ${linesHtml}
    ${vatHtml}
    <div class="amount-hero">
      <div class="amount-hero-label">${tiersInfo ? 'Elige tu opción abajo 👇' : (hasVat ? 'Total · IVA incluido' : 'Total del presupuesto')}</div>
      <div class="amount-hero-value">${tiersInfo ? `Desde ${money(tiersInfo.min)}` : money(Number(quote.total))}</div>
    </div>
    ${terms ? `<div style="text-align:center;margin-bottom:4px"><span class="terms-badge">${esc(termsLabel(terms))}</span></div>${terms === 'FIFTY_FIFTY' ? `<div class="senal-policy">🔒 La señal no es reembolsable.</div>` : ''}` : ''}
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

// GET /pay/quote/:token  (landing del botón "Ver presupuesto") y alias /quote/:token/accept
// Muestra el detalle + firma/aceptar + enlace para rechazar.
// SCRUM-95: token opaco (Quote.decisionToken) — antes Quote.id crudo, enumerable, la
// sexta puerta de la misma fuga (SCRUM-72/74/85/87/90).
quoteDecisionLandingRouter.get(['/quote/:token', '/quote/:token/accept'], async (req: Request, res: Response) => {
  const token = parseToken(req.params.token); // tolera URLs sucias ('{{1}}abc...' → 'abc...')

  let quoteDetail = '';
  let locale = getLocale('ES');
  let tierCards = '';
  let hasTiers = false;
  let loadedQuote: Awaited<ReturnType<typeof loadQuote>> | null = null;
  let brandColor: string | null = null;

  if (token) {
    const quote = await loadQuote(token).catch(() => null);
    loadedQuote = quote;
    if (quote) {
      locale = getLocale(quote.merchant?.country);
      brandColor = quote.merchant?.brandColor ?? null;
      // A16.2 (N3): caducado — copy OFICIAL + reconversión por WhatsApp. Cubre
      // también sent con validUntil pasado (el cron horario aún no barrió).
      if (isQuoteExpired(quote as any)) {
        const fechaCad = (quote as any).validUntil
          // SCRUM-633 · la MISMA fecha, impresa por segunda vez en esta página. El encargo contaba
          // cuatro sitios y éste es el quinto: sin `timeZone`, el cliente que llega tarde lee un día
          // y el que llega a tiempo lee otro, los dos de la zona del contenedor.
          ? new Date((quote as any).validUntil).toLocaleDateString('es-ES', {
              timeZone: zonaDelMerchant((quote as any).merchant),
              day: '2-digit', month: 'long', year: 'numeric',
            })
          : null;
        const proPhoneExp = (quote.merchant as any)?.whatsappPhone
          ? String((quote.merchant as any).whatsappPhone).replace(/[^\d]/g, '')
          : '';
        const waBtnExp = proPhoneExp
          ? `<a href="https://wa.me/${proPhoneExp}?text=${encodeURIComponent(`Hola, el ${locale.quoteVerb} #${quote.quoteNumber ?? quote.id} caducó, ¿me pasas uno actualizado?`)}"
               style="display:inline-block;margin-top:14px;background:#16a34a;color:#fff;font-weight:700;padding:12px 22px;border-radius:999px;text-decoration:none">Pedir uno actualizado por WhatsApp</a>`
          : '';
        return res.setHeader('Content-Type', 'text/html; charset=utf-8').send(
          renderPage(`${locale.quote} caducada`, `<div class="status-ok" style="text-align:center">
            <strong>Este ${locale.quoteVerb} caducó${fechaCad ? ` el ${fechaCad}` : ''}.</strong><br/>
            Pide uno actualizado 👇<br/>${waBtnExp}
          </div>`, brandColor)
        );
      }
      if (quote.status === 'draft' || quote.status === 'sent') {
        const tiers = (quote as any).tiers as any[] | null;
        if (tiers && tiers.length > 0) {
          hasTiers = true;
          // Añadir currency a cada tier para el render
          const tiersWithCurrency = tiers.map((t: any) => ({ ...t, currency: quote.currency }));
          tierCards = renderTierCards(tiersWithCurrency, token, locale);
          // A20.1: héroe honesto — "Desde {mínimo}" hasta que el cliente elija
          const minTotal = Math.min(...tiers.map((t: any) => Number(t.total) || 0));
          quoteDetail = renderQuoteDetail(quote, token, { min: minTotal });
        } else {
          quoteDetail = renderQuoteDetail(quote, token);
        }
      } else if (quote.status === 'accepted') {
        // PC-C (N3): estado aceptado digno con FECHA + siguiente paso (igual que rejected).
        // SCRUM-633 · MISMA PÁGINA, MISMA ZONA. El censo del encargo contaba dos impresiones y hay
        // CUATRO: ésta y la del rechazo también salían en la zona del contenedor. Se arreglan con
        // las otras dos y no después, porque dejarlas fuera crearía en la MISMA página justo lo que
        // este ticket viene a cerrar: unas fechas en el calendario del negocio y otras en el de la
        // máquina que las sirve.
        const fechaAcept = quote.acceptedAt
          ? new Date(quote.acceptedAt).toLocaleDateString('es-ES', {
            timeZone: zonaDelMerchant((quote as any).merchant),
            day: '2-digit', month: 'long', year: 'numeric',
          })
          : null;
        return res.setHeader('Content-Type', 'text/html; charset=utf-8').send(
          renderPage(`${locale.quote} ya aceptada`, `<div class="status-ok" style="text-align:center">
            <strong>Ya aceptaste este ${locale.quoteVerb}${fechaAcept ? ` el ${fechaAcept}` : ''}.</strong><br/>
            El profesional te informará de los siguientes pasos.
          </div>`, brandColor)
        );
      } else if (quote.status === 'rejected') {
        // N3 (copy oficial decidido por el fundador 12-jun): estado rechazado digno,
        // nunca el formulario de firma.
        // SCRUM-633 · la cuarta, por el mismo motivo que la de arriba.
        const fechaRechazo = quote.rejectedAt
          ? new Date(quote.rejectedAt).toLocaleDateString('es-ES', {
            timeZone: zonaDelMerchant((quote as any).merchant),
            day: '2-digit', month: 'long', year: 'numeric',
          })
          : null;
        const proPhone = (quote.merchant as any)?.whatsappPhone
          ? String((quote.merchant as any).whatsappPhone).replace(/[^\d]/g, '')
          : '';
        const merchName = esc(quote.merchant?.legalName || quote.merchant?.name || 'el profesional');
        const waBtn = proPhone
          ? `<a href="https://wa.me/${proPhone}?text=${encodeURIComponent(`Hola, sobre el ${locale.quoteVerb} #${quote.quoteNumber ?? quote.id}: he cambiado de opinión, ¿me lo reenvías?`)}"
               style="display:inline-block;margin-top:14px;background:#16a34a;color:#fff;font-weight:700;padding:12px 22px;border-radius:999px;text-decoration:none">Pedir uno nuevo por WhatsApp</a>`
          : '';
        return res.setHeader('Content-Type', 'text/html; charset=utf-8').send(
          renderPage(`${locale.quote} rechazada`, `<div class="status-ok" style="text-align:center">
            <strong>Rechazaste este ${locale.quoteVerb}${fechaRechazo ? ` el ${fechaRechazo}` : ''}.</strong><br/>
            ¿Has cambiado de opinión? Pídele uno nuevo a ${merchName} 👇<br/>${waBtn}
          </div>`, brandColor)
        );
      }
    }
  }

  // N3: presupuesto inexistente → página digna, JAMÁS el formulario de firma vacío (bug E2E V0-1)
  if (!loadedQuote) {
    return res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(documentNotFoundHtml());
  }

  const shareName = (loadedQuote?.merchant?.legalName || loadedQuote?.merchant?.name || 'el profesional');
  const shareTextEnc = encodeURIComponent(`✅ He aceptado mi ${locale.quoteVerb} con ${shareName}. ¡Gracias!`);

  // PC-A (N1): botón "💬 Tengo una duda" → WhatsApp del PRO. Mismo patrón que el estado
  // rejected. Si el negocio no tiene whatsappPhone, no se muestra (degradación digna).
  const proPhone = (loadedQuote?.merchant as any)?.whatsappPhone
    ? String((loadedQuote.merchant as any).whatsappPhone).replace(/[^\d]/g, '')
    : '';
  const dudaTextEnc = encodeURIComponent(`Hola, tengo una duda sobre el ${locale.quoteVerb} #${loadedQuote.quoteNumber ?? loadedQuote.id}`);
  const dudaHtml = proPhone
    ? `<a class="btn-duda" href="https://wa.me/${proPhone}?text=${dudaTextEnc}">💬 Tengo una duda</a>`
    : '';

  // Concordancia de género del sustantivo (presupuesto=masc / cotización=fem)
  // para "aceptado/a y firmado/a" sin romper LATAM (P1-4).
  const qg = (locale.quote.endsWith('ón') || locale.quote.endsWith('a')) ? 'a' : 'o';

  const html = renderPage(`Aceptar ${locale.quoteVerb}`, `<style>${TIER_CSS}</style>
    ${quoteDetail}
    ${hasTiers ? tierCards : ''}
    ${TIER_JS(token)}
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
        Acepto sin firmar
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
      Dibuja tu firma o marca "Acepto sin firmar".
    </div>
    <small>Si no solicitaste este ${locale.quoteVerb}, cierra esta página.</small>
    </div>
    ${dudaHtml}
    <a href="/pay/quote/${token}/reject" style="display:block;text-align:center;margin-top:16px;font-size:13.5px;color:#6b756f;text-decoration:underline">No me interesa · Rechazar ${locale.quoteVerb}</a>
    ${SIG_JS}
    <script>
    function fireConfetti() {
      // AB6: respetar prefers-reduced-motion — sin celebración con movimiento.
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
        const res = await fetch('/quote/${token}/decision', {
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
              '<h1 style="font-size:20px;margin:0 0 6px">¡${locale.quote} aceptad${qg}' + (sigData ? ' y firmad${qg}' : '') + '!</h1>' +
              '<p style="color:#6b756f;font-size:14px;margin:0 0 18px">${esc(shareName)} ya tiene tu confirmación.</p>' +
              '<a class="btn-share" target="_blank" rel="noopener" href="https://wa.me/?text=${shareTextEnc}">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M.06 24l1.69-6.16a11.87 11.87 0 01-1.59-5.95C.16 5.34 5.5 0 12.06 0a11.82 11.82 0 018.42 3.49 11.82 11.82 0 013.48 8.41c0 6.56-5.34 11.9-11.9 11.9a11.9 11.9 0 01-5.69-1.45L.06 24z"/></svg>' +
                'Compartir por WhatsApp</a>' +
            '</div>';
        } else {
          btn.disabled = false; btn.textContent = 'Firmar y aceptar ${locale.quoteVerb}';
          // SCRUM-264 · el MENSAJE HUMANO gana al código, igual que en api.js:35-37 (SCRUM-151).
          // Leyendo \`error\` primero, el cliente veía «factura_sin_lineas» en rojo bajo la firma
          // que acababa de dibujar. El código se conserva de reserva: para los endpoints que aún
          // no mandan copy, un identificador es mejor que un mensaje genérico.
          document.getElementById('sig-error').textContent = data.message || data.error || 'Error al procesar.';
          document.getElementById('sig-error').style.display = 'block';
        }
      } catch {
        btn.disabled = false; btn.textContent = 'Firmar y aceptar ${locale.quoteVerb}';
        document.getElementById('sig-error').textContent = 'Error de conexión.';
        document.getElementById('sig-error').style.display = 'block';
      }
    });
    </script>
  `, brandColor);
  res.setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
});

// GET /pay/quote/:token/reject
quoteDecisionLandingRouter.get('/quote/:token/reject', async (req: Request, res: Response) => {
  const token = parseToken(req.params.token); // tolera URLs sucias

  let quoteDetail = '';
  let locale = getLocale('ES');
  let brandColor: string | null = null;
  let rejectQuote: Awaited<ReturnType<typeof loadQuote>> | null = null;

  if (token) {
    const quote = await loadQuote(token).catch(() => null);
    rejectQuote = quote;
    if (quote) {
      locale = getLocale(quote.merchant?.country);
      brandColor = quote.merchant?.brandColor ?? null;
      // A16.2: caducado → la landing principal ya cuenta la verdad
      if (isQuoteExpired(quote as any)) {
        return res.redirect(`/pay/quote/${token}`);
      }
      if (quote.status === 'draft' || quote.status === 'sent') {
        quoteDetail = renderQuoteDetail(quote, token);
      }
    }
  }

  // N3: presupuesto inexistente → página digna (bug E2E V0-1)
  if (!rejectQuote) {
    return res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(documentNotFoundHtml());
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
    <a href="/pay/quote/${esc(token)}" style="display:block;text-align:center;margin-top:16px;font-size:13.5px;color:#15803d;font-weight:600;text-decoration:none">← Volver y aceptar</a>
    <small>Si no solicitaste este ${locale.quoteVerb}, cierra esta página.</small>
  `, brandColor);
  res.setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
});

// POST /pay/quote/:token/reject
// El router /pay se monta ANTES del express.urlencoded global (app.ts), así que
// parseamos el form aquí mismo; sin esto req.body venía vacío y el motivo/comentario
// del cliente se perdían (caía al texto genérico) — P1-3.
quoteDecisionLandingRouter.post('/quote/:token/reject', express.urlencoded({ extended: true }), async (req: Request, res: Response) => {
  const token = parseToken(req.params.token); // tolera URLs sucias ('{{1}}abc...' → 'abc...')
  const { reason, comment } = req.body || {};
  // Mapear el código del dropdown a su etiqueta legible (P1-3).
  const REASON_LABELS: Record<string, string> = {
    price: 'El precio es demasiado alto',
    another_provider: 'He elegido otro proveedor',
    no_longer_needed: 'Ya no necesito el servicio',
    other: 'Otro motivo',
  };
  const reasonLabel = reason ? (REASON_LABELS[String(reason)] || String(reason)) : '';
  const commentText = comment ? String(comment).trim() : '';

  // Locale del merchant para usar su término (presupuesto/cotización) — P1-5. También
  // el número visible por merchant (A1.2) para el mensaje de confirmación — SCRUM-95:
  // el token no es apto para mostrárselo al cliente (no es un "número de presupuesto").
  const q = token
    ? await prisma.quote.findUnique({
        where: { decisionToken: token },
        select: { id: true, quoteNumber: true, merchant: { select: { country: true } } },
      }).catch(() => null)
    : null;
  const locale = getLocale(q?.merchant?.country);
  const delDeLa = (locale.quote.endsWith('ón') || locale.quote.endsWith('a')) ? 'de la' : 'del';
  const displayNum = q ? (q.quoteNumber ?? q.id) : '';

  try {
    const apiResponse = await fetch(
      `${BASE_API_URL}/quote/${encodeURIComponent(token)}/decision`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        // P1-3: reenviar el motivo (etiqueta) y el comentario REALES por separado,
        // sin texto genérico. Si vienen vacíos, se guarda vacío.
        body: JSON.stringify({ decision: 'reject', reason: reasonLabel || undefined, comment: commentText || undefined }) }
    );
    const json = (await apiResponse.json().catch(() => null)) as DecisionApiError | null;
    if (!apiResponse.ok) {
      return res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8').send(
        // SCRUM-264 · mismo criterio que el camino de aceptar: el texto humano primero. El tipo
        // `DecisionApiError` ya declaraba `message?` y nadie lo leía.
        renderPage('Error', `<div class="status-error"><strong>No se pudo registrar el rechazo.</strong><br/>${json?.message || json?.error || ''}</div>`)
      );
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8').send(
      renderPage('Rechazo registrado', `<div class="status-ok"><strong>Gracias por tu respuesta.</strong><br/>Hemos registrado el rechazo ${delDeLa} ${esc(locale.quoteVerb)} <strong>#${esc(displayNum)}</strong>.</div>`)
    );
  } catch {
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8').send(
      renderPage('Error', `<div class="status-error"><strong>Error inesperado.</strong> Inténtalo más tarde.</div>`)
    );
  }
});

/**
 * GET /pay/quote/:token/pdf — SCRUM-806 · el mismo documento, para quien tiene el token.
 *
 * ── EL DEFECTO QUE CIERRA ──────────────────────────────────────────────────────────────────
 * El portal del cliente (`/cliente/:token`, público) enlazaba su botón «Ver PDF» a
 * `BASE_URL + quote.pdfUrl`, y esa columna la escribe la ruta de ADMIN con su propio valor:
 * `/admin/quotes/<id>/pdf`. Medido: el cliente pulsaba y recibía `401 {"error":
 * "not_authenticated"}` — JSON crudo, en la pantalla donde decide si firma.
 *
 * ── POR QUÉ AQUÍ Y POR QUÉ POR TOKEN ───────────────────────────────────────────────────────
 * 🔴 NO lleva `:id`, y es deliberado: SCRUM-95 sacó el `quote.id` de los botones de ese portal
 * por enumerable («la sexta puerta de la misma fuga»). Volver a meterlo para servir un PDF
 * sería deshacer aquello. Se usa el MISMO `decisionToken` (16 bytes aleatorios) que ya resuelve
 * `/quote/:token` justo arriba: quien lo tiene ya podía ver este presupuesto entero en la
 * landing, así que esta ruta NO expone a nadie nuevo — sólo el documento que ya le pertenece.
 *
 * ⚠️ HEREDA SCRUM-799: regenera el PDF con el código de hoy en cada apertura, como la ruta de
 * admin. Eso está MEDIDO y su salida es del fundador; aquí no se toca ese mecanismo.
 */
quoteDecisionLandingRouter.get('/quote/:token/pdf', async (req: Request, res: Response) => {
  const token = parseToken(req.params.token); // tolera URLs sucias
  if (!token) return res.status(404).json({ error: 'not_found' });

  try {
    // `loadQuote` no sirve aquí: su `select` de merchant/customer está recortado para la
    // landing y el PDF necesita la fila entera.
    const quote = await prisma.quote.findUnique({
      where: { decisionToken: token },
      include: { merchant: true, customer: true },
    });
    if (!quote) return res.status(404).json({ error: 'not_found' });

    const { generateQuotePdf } = await import('../../../../lib/pdf');
    const pdf = await generateQuotePdf(paramsDePresupuestoParaPdf({
      quote, merchant: quote.merchant, customer: quote.customer,
    }));

    // 🔴 NO se escribe `quote.pdfUrl`: la ruta de admin lo hace con su propia URL y ésta no
    // tiene por qué pisarla. Ese ida y vuelta es justo lo que creó el defecto.
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="presupuesto-${quote.quoteNumber ?? quote.id}.pdf"`);
    return res.sendFile(pdf.outPath);
  } catch (err) {
    console.error('[GET /pay/quote/:token/pdf]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// `renderQuoteDetail` y `TIER_JS` se exportan SOLO para que el guard de SCRUM-212 pueda mirar
// el HTML que ve el cliente en vez de la fuente que lo genera. Un guard de texto sobre el
// fichero se cazaría a sí mismo: los comentarios de arriba están llenos de la palabra que
// vigila («exento»), escrita precisamente para explicar por qué no debe aparecer.
export { quoteDecisionLandingRouter, renderQuoteDetail, TIER_JS };
