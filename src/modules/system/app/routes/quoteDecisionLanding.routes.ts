import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import { prisma } from '../../../../core/db/prisma';
import { esc } from '../../../../core/utils/utils';
import { getLocale } from '../../../../core/i18n/locales';

type DecisionApiError = { message?: string; error?: string };

const quoteDecisionLandingRouter = Router();
const BASE_API_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

function renderPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0; padding: 16px; background: #f0f4f8; color: #111827; min-height: 100vh; }
    .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px;
      padding: 24px; box-shadow: 0 8px 24px rgba(0,0,0,.10); }
    .merchant-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .merchant-logo { max-height: 48px; max-width: 120px; object-fit: contain; border-radius: 8px; }
    .merchant-name { font-weight: 700; font-size: 16px; }
    .merchant-sub { font-size: 13px; color: #6b7280; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .quote-meta { font-size: 13px; color: #6b7280; margin-bottom: 16px; }
    .lines-table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 12px; }
    .lines-table th { text-align: left; padding: 4px 6px; color: #6b7280; font-size: 12px;
      border-bottom: 1px solid #e5e7eb; }
    .lines-table td { padding: 6px 6px; border-bottom: 1px solid #f3f4f6; }
    .lines-table td:last-child { text-align: right; }
    .total-row { display: flex; justify-content: space-between; font-weight: 700;
      font-size: 18px; margin: 12px 0 20px; padding-top: 8px; border-top: 2px solid #e5e7eb; }
    .terms-badge { display: inline-block; font-size: 12px; padding: 3px 10px;
      border-radius: 999px; background: #eff6ff; color: #1d4ed8; margin-bottom: 16px; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
    /* Firma */
    .sig-label { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; display: block; }
    .sig-sub { font-size: 12px; color: #9ca3af; margin-bottom: 8px; }
    .sig-wrapper { border: 2px solid #d1d5db; border-radius: 10px; background: #f9fafb;
      position: relative; overflow: hidden; margin-bottom: 8px; }
    .sig-wrapper.has-sig { border-color: #22c55e; background: #fff; }
    #sig-canvas { display: block; width: 100%; height: 150px; cursor: crosshair; touch-action: none; }
    .sig-actions { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
    .btn-clear { font-size: 13px; padding: 6px 12px; border-radius: 8px;
      border: 1px solid #e5e7eb; background: #fff; cursor: pointer; color: #6b7280; }
    .btn-clear:hover { background: #f3f4f6; }
    .sig-placeholder { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
      color: #d1d5db; font-size: 14px; pointer-events: none; user-select: none; white-space: nowrap; }
    .checkbox-fallback { display: flex; align-items: center; gap: 8px; font-size: 13px;
      color: #6b7280; margin-bottom: 16px; }
    /* Botones */
    .btn-accept { width: 100%; padding: 14px; font-size: 16px; font-weight: 700;
      background: #16a34a; color: #fff; border: none; border-radius: 12px; cursor: pointer;
      min-height: 52px; margin-top: 4px; }
    .btn-accept:active { background: #15803d; }
    .btn-accept:disabled { opacity: .5; cursor: default; }
    .btn-reject { width: 100%; padding: 14px; font-size: 16px; font-weight: 700;
      background: #dc2626; color: #fff; border: none; border-radius: 12px; cursor: pointer;
      min-height: 52px; margin-top: 4px; }
    .btn-reject:active { background: #b91c1c; }
    .status-ok { background: #ecfdf5; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .status-ok strong { color: #166534; }
    .status-error { background: #fef2f2; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .status-error strong { color: #991b1b; }
    small { font-size: 12px; color: #9ca3af; display: block; text-align: center; margin-top: 12px; }
    select, textarea { width: 100%; font-size: 15px; padding: 10px 12px;
      border-radius: 10px; border: 1px solid #d1d5db; margin-bottom: 12px; }
    textarea { min-height: 80px; resize: vertical; }
  </style>
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
      merchant: { select: { name: true, legalName: true, logoUrl: true, address: true, country: true } },
      customer: { select: { name: true } },
    },
  });
}

function renderQuoteDetail(quote: Awaited<ReturnType<typeof loadQuote>>, quoteId: string): string {
  if (!quote) return `<h1>Cotización #${esc(quoteId)}</h1>`;

  const logo = quote.merchant?.logoUrl
    ? `<img class="merchant-logo" src="${esc(quote.merchant.logoUrl)}" alt="logo"/>`
    : '';
  const merchantName = esc(quote.merchant?.legalName || quote.merchant?.name || '');
  const customerName = esc(quote.customer?.name || 'Cliente');
  const lines: any[] = Array.isArray(quote.lines) ? quote.lines : [];

  const linesHtml = lines.length
    ? `<table class="lines-table">
        <thead><tr><th>Concepto</th><th>Cant.</th><th>Total</th></tr></thead>
        <tbody>${lines.map((l: any) => `
          <tr>
            <td>${esc(l.concept)}</td>
            <td>${esc(l.qty)}</td>
            <td>${Number(l.qty * l.price).toFixed(2)} ${esc(quote.currency)}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : '';

  const terms = (quote as any).paymentTerms ?? null;

  return `
    <div class="merchant-header">
      ${logo}
      <div>
        <div class="merchant-name">${merchantName}</div>
        ${quote.merchant?.address ? `<div class="merchant-sub">${esc(quote.merchant.address)}</div>` : ''}
      </div>
    </div>
    <h1>Hola, ${customerName}</h1>
    <div class="quote-meta">Cotización #${esc(quoteId)}</div>
    ${linesHtml}
    <div class="total-row">
      <span>Total</span>
      <span>${Number(quote.total).toFixed(2)} ${esc(quote.currency)}</span>
    </div>
    ${terms ? `<div class="terms-badge">${esc(termsLabel(terms))}</div>` : ''}
    <hr class="divider"/>
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
    ctx.strokeStyle = '#111827';
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

// GET /pay/quote/:id/accept
quoteDecisionLandingRouter.get('/quote/:id/accept', async (req: Request, res: Response) => {
  const quoteId = req.params.id;
  const id = Number(quoteId);

  let quoteDetail = '';
  let locale = getLocale('ES');

  if (Number.isInteger(id)) {
    const quote = await loadQuote(id).catch(() => null);
    if (quote) {
      locale = getLocale(quote.merchant?.country);
      if (quote.status === 'draft' || quote.status === 'sent') {
        quoteDetail = renderQuoteDetail(quote, quoteId);
      } else if (quote.status === 'accepted') {
        return res.setHeader('Content-Type', 'text/html; charset=utf-8').send(
          renderPage(`${locale.quote} ya aceptada`, `<div class="status-ok"><strong>Este ${locale.quoteVerb} ya fue aceptado.</strong><br/>Gracias por tu confianza.</div>`)
        );
      }
    }
  }

  const html = renderPage(`Aceptar ${locale.quoteVerb}`, `
    ${quoteDetail}
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
    <div id="sig-error" style="color:#dc2626;font-size:13px;margin-top:8px;display:none">
      Dibuja tu firma o marca "Acepto sin dibujar firma".
    </div>
    <small>Si no solicitaste este ${locale.quoteVerb}, cierra esta página.</small>
    ${SIG_JS}
    <script>
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
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          document.querySelector('.card').innerHTML =
            '<div class="status-ok"><strong>¡Gracias! ${locale.quote} aceptada' +
            (sigData ? ' con firma digital ✅' : '') +
            '.</strong><br/>El profesional te informará de los siguientes pasos.</div>';
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
  `);
  res.setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
});

// GET /pay/quote/:id/reject
quoteDecisionLandingRouter.get('/quote/:id/reject', async (req: Request, res: Response) => {
  const quoteId = req.params.id;
  const id = Number(quoteId);

  let quoteDetail = '';
  let locale = getLocale('ES');

  if (Number.isInteger(id)) {
    const quote = await loadQuote(id).catch(() => null);
    if (quote) {
      locale = getLocale(quote.merchant?.country);
      if (quote.status === 'draft' || quote.status === 'sent') {
        quoteDetail = renderQuoteDetail(quote, quoteId);
      }
    }
  }

  const html = renderPage(`Rechazar ${locale.quoteVerb}`, `
    ${quoteDetail}
    <form method="post">
      <div><label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:5px">Motivo</label>
        <select name="reason">
          <option value="">Selecciona una opción</option>
          <option value="price">El precio es demasiado alto</option>
          <option value="another_provider">He elegido otro proveedor</option>
          <option value="no_longer_needed">Ya no necesito el servicio</option>
          <option value="other">Otro motivo</option>
        </select>
      </div>
      <div><label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:5px">Comentario (opcional)</label>
        <textarea name="comment" placeholder="Cuéntanos algo más si quieres..."></textarea>
      </div>
      <button class="btn-reject" type="submit">Enviar rechazo</button>
    </form>
    <small>Si no solicitaste este ${locale.quoteVerb}, cierra esta página.</small>
  `);
  res.setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
});

// POST /pay/quote/:id/reject
quoteDecisionLandingRouter.post('/quote/:id/reject', async (req: Request, res: Response) => {
  const quoteId = req.params.id;
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
