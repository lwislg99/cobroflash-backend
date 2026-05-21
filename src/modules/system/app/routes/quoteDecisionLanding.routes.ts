import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import { prisma } from '../../../../core/db/prisma';
import { esc } from '../../../../core/utils/utils';

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
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0; padding: 16px;
      background: #f0f4f8; color: #111827; min-height: 100vh;
    }
    .card {
      max-width: 480px; margin: 0 auto;
      background: #fff; border-radius: 16px; padding: 24px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.10);
    }
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
    form { display: flex; flex-direction: column; gap: 10px; }
    label { font-weight: 500; font-size: 14px; display: block; margin-bottom: 4px; }
    select, textarea {
      width: 100%; font-size: 15px; padding: 10px 12px;
      border-radius: 10px; border: 1px solid #d1d5db;
    }
    textarea { min-height: 80px; resize: vertical; }
    .btn-accept {
      width: 100%; padding: 14px; font-size: 16px; font-weight: 700;
      background: #16a34a; color: #fff; border: none; border-radius: 12px; cursor: pointer;
      min-height: 52px; margin-top: 4px;
    }
    .btn-reject {
      width: 100%; padding: 14px; font-size: 16px; font-weight: 700;
      background: #dc2626; color: #fff; border: none; border-radius: 12px; cursor: pointer;
      min-height: 52px; margin-top: 4px;
    }
    .btn-accept:active { background: #15803d; }
    .btn-reject:active { background: #b91c1c; }
    .status-ok { background: #ecfdf5; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .status-ok strong { color: #166534; }
    .status-error { background: #fef2f2; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .status-error strong { color: #991b1b; }
    small { font-size: 12px; color: #9ca3af; display: block; text-align: center; margin-top: 12px; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
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
      merchant: { select: { name: true, legalName: true, logoUrl: true, address: true } },
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
        <thead><tr><th>Concepto</th><th>Cant.</th><th>Precio</th></tr></thead>
        <tbody>
          ${lines.map((l: any) => `
            <tr>
              <td>${esc(l.concept)}</td>
              <td>${esc(l.qty)}</td>
              <td>${Number(l.qty * l.price).toFixed(2)} ${esc(quote.currency)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`
    : '';

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

// GET /pay/quote/:id/accept
quoteDecisionLandingRouter.get('/quote/:id/accept', async (req: Request, res: Response) => {
  const quoteId = req.params.id;
  const id = Number(quoteId);

  let quoteDetail = '';
  if (Number.isInteger(id)) {
    const quote = await loadQuote(id).catch(() => null);
    if (quote && (quote.status === 'draft' || quote.status === 'sent')) {
      quoteDetail = renderQuoteDetail(quote, quoteId);
    } else if (quote && quote.status === 'accepted') {
      const html = renderPage('Cotización ya aceptada', `
        <div class="status-ok"><strong>Este presupuesto ya fue aceptado.</strong><br/>
        Gracias por tu confianza.</div>`);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }
  }

  const html = renderPage('Aceptar cotización', `
    ${quoteDetail}
    <form method="post">
      <button class="btn-accept" type="submit">Sí, acepto la cotización</button>
    </form>
    <small>Si no solicitaste esta cotización, cierra esta página.</small>
  `);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// POST /pay/quote/:id/accept
quoteDecisionLandingRouter.post('/quote/:id/accept', async (req: Request, res: Response) => {
  const quoteId = req.params.id;
  try {
    const apiResponse = await fetch(
      `${BASE_API_URL}/quote/${encodeURIComponent(quoteId)}/decision`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'accept', comment: 'Aceptado desde enlace WhatsApp' }),
      }
    );
    const json = (await apiResponse.json().catch(() => null)) as DecisionApiError | null;

    if (!apiResponse.ok) {
      const msg = json?.message || json?.error || `Error ${apiResponse.status}`;
      const html = renderPage('Error', `<div class="status-error"><strong>No se pudo aceptar.</strong><br/>${msg}</div>`);
      res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    const html = renderPage('Cotización aceptada', `
      <div class="status-ok">
        <strong>¡Gracias!</strong><br/>
        Hemos registrado la aceptación de la cotización <strong>#${esc(quoteId)}</strong>.
        El profesional te informará de los siguientes pasos.
      </div>
    `);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch {
    const html = renderPage('Error', `<div class="status-error"><strong>Error inesperado.</strong> Inténtalo más tarde.</div>`);
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
});

// GET /pay/quote/:id/reject
quoteDecisionLandingRouter.get('/quote/:id/reject', async (req: Request, res: Response) => {
  const quoteId = req.params.id;
  const id = Number(quoteId);

  let quoteDetail = '';
  if (Number.isInteger(id)) {
    const quote = await loadQuote(id).catch(() => null);
    if (quote && (quote.status === 'draft' || quote.status === 'sent')) {
      quoteDetail = renderQuoteDetail(quote, quoteId);
    }
  }

  const html = renderPage('Rechazar cotización', `
    ${quoteDetail}
    <form method="post">
      <div>
        <label for="reason">Motivo</label>
        <select id="reason" name="reason">
          <option value="">Selecciona una opción</option>
          <option value="price">El precio es demasiado alto</option>
          <option value="another_provider">He elegido otro proveedor</option>
          <option value="no_longer_needed">Ya no necesito el servicio</option>
          <option value="other">Otro motivo</option>
        </select>
      </div>
      <div>
        <label for="comment">Comentario (opcional)</label>
        <textarea id="comment" name="comment" placeholder="Cuéntanos algo más si quieres..."></textarea>
      </div>
      <button class="btn-reject" type="submit">Enviar rechazo</button>
    </form>
    <small>Si no solicitaste esta cotización, cierra esta página.</small>
  `);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// POST /pay/quote/:id/reject
quoteDecisionLandingRouter.post('/quote/:id/reject', async (req: Request, res: Response) => {
  const quoteId = req.params.id;
  const { reason, comment } = req.body || {};
  const finalComment = (reason ? `Motivo: ${reason}. ` : '') + (comment ? String(comment) : '').trim();

  try {
    const apiResponse = await fetch(
      `${BASE_API_URL}/quote/${encodeURIComponent(quoteId)}/decision`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'reject', comment: finalComment || 'Rechazado desde enlace WhatsApp' }),
      }
    );
    const json = (await apiResponse.json().catch(() => null)) as DecisionApiError | null;

    if (!apiResponse.ok) {
      const msg = json?.message || json?.error || `Error ${apiResponse.status}`;
      const html = renderPage('Error', `<div class="status-error"><strong>No se pudo registrar el rechazo.</strong><br/>${msg}</div>`);
      res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    const html = renderPage('Rechazo registrado', `
      <div class="status-ok">
        <strong>Gracias por tu respuesta.</strong><br/>
        Hemos registrado el rechazo de la cotización <strong>#${esc(quoteId)}</strong>.
      </div>
    `);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch {
    const html = renderPage('Error', `<div class="status-error"><strong>Error inesperado.</strong> Inténtalo más tarde.</div>`);
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
});

export { quoteDecisionLandingRouter };
