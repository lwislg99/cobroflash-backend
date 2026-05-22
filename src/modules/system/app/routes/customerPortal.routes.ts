import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { esc } from '../../../../core/utils/utils';
import { BASE_URL } from '../../../../core/config/env';

const router = Router();

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviado', accepted: 'Aceptado', rejected: 'Rechazado',
  pending: 'Pendiente', paid: 'Pagada', expired: 'Caducada',
};
const STATUS_COLORS: Record<string, string> = {
  accepted: '#166534', paid: '#166534',
  sent: '#1d4ed8', pending: '#92400e',
  rejected: '#991b1b', expired: '#6b7280', draft: '#6b7280',
};
const STATUS_BG: Record<string, string> = {
  accepted: '#dcfce7', paid: '#dcfce7',
  sent: '#dbeafe', pending: '#fef3c7',
  rejected: '#fee2e2', expired: '#f3f4f6', draft: '#f3f4f6',
};

function pill(status: string) {
  const label = STATUS_LABELS[status] ?? status;
  const color = STATUS_COLORS[status] ?? '#374151';
  const bg    = STATUS_BG[status]    ?? '#f3f4f6';
  return `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;background:${bg};color:${color}">${esc(label)}</span>`;
}

function page(title: string, body: string) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>${esc(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif;
      background: #f0f4f8; color: #111827; padding: 0 0 40px; }
    .header { background: #0f172a; padding: 16px 20px; display: flex;
      align-items: center; gap: 12px; }
    .header-logo { max-height: 40px; max-width: 100px; object-fit: contain; border-radius: 6px; }
    .header-name { color: #fff; font-weight: 700; font-size: 16px; }
    .header-sub { color: #94a3b8; font-size: 13px; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px 16px; }
    .greeting { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .greeting-sub { font-size: 14px; color: #6b7280; margin-bottom: 24px; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .05em; color: #6b7280; margin: 24px 0 10px; }
    .card { background: #fff; border-radius: 12px; padding: 14px 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,.06); margin-bottom: 10px; }
    .card-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .card-left { flex: 1; min-width: 0; }
    .card-title { font-weight: 600; font-size: 15px; margin-bottom: 4px; }
    .card-meta { font-size: 13px; color: #6b7280; }
    .card-right { text-align: right; flex-shrink: 0; }
    .card-amount { font-weight: 700; font-size: 16px; margin-bottom: 6px; }
    .card-actions { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
    .btn { display: inline-block; padding: 9px 16px; border-radius: 8px; font-size: 14px;
      font-weight: 600; text-decoration: none; text-align: center; border: none; cursor: pointer; }
    .btn-pay { background: #16a34a; color: #fff; width: 100%; }
    .btn-pdf { background: #f1f5f9; color: #1e40af; width: 100%; }
    .empty { color: #9ca3af; font-size: 14px; padding: 12px 0; text-align: center; }
    .powered { text-align: center; font-size: 12px; color: #d1d5db; margin-top: 32px; }
  </style>
</head>
<body>
${body}
<p class="powered">Powered by PresuFácil</p>
</body>
</html>`;
}

router.get('/:token', async (req, res) => {
  const { token } = req.params;

  const customer = await prisma.customer.findUnique({
    where: { portalToken: token },
    include: {
      merchant: { select: { name: true, legalName: true, logoUrl: true } },
    },
  });

  if (!customer) {
    return res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(
      page('Portal no encontrado', '<div style="padding:40px;text-align:center;color:#6b7280">Este enlace no es válido o ha expirado.</div>')
    );
  }

  const [quotes, invoices] = await Promise.all([
    prisma.quote.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.invoice.findMany({
      where: { customerId: customer.id },
      include: { charge: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const merchantName = esc(customer.merchant?.legalName || customer.merchant?.name || 'Tu proveedor');
  const logoHtml = customer.merchant?.logoUrl
    ? `<img class="header-logo" src="${esc(customer.merchant.logoUrl)}" alt="logo"/>`
    : '';

  // --- Cotizaciones ---
  const quotesHtml = quotes.length
    ? quotes.map((q) => {
        const date = new Date(q.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
        const pdfLink = q.pdfUrl
          ? `<a class="btn btn-pdf" href="${esc(q.pdfUrl.startsWith('http') ? q.pdfUrl : BASE_URL + q.pdfUrl)}" target="_blank">Descargar PDF</a>`
          : '';
        const acceptLink = (q.status === 'sent')
          ? `<a class="btn btn-pay" href="/pay/quote/${q.id}/accept">Ver y responder</a>`
          : '';
        return `
          <div class="card">
            <div class="card-row">
              <div class="card-left">
                <div class="card-title">Cotización #${q.id}</div>
                <div class="card-meta">${date}</div>
              </div>
              <div class="card-right">
                <div class="card-amount">${Number(q.total).toFixed(2)} ${esc(q.currency)}</div>
                ${pill(q.status)}
              </div>
            </div>
            ${pdfLink || acceptLink ? `<div class="card-actions">${acceptLink}${pdfLink}</div>` : ''}
          </div>`;
      }).join('')
    : '<p class="empty">No hay cotizaciones aún.</p>';

  // --- Facturas ---
  const invoicesHtml = invoices.length
    ? invoices.map((inv) => {
        const date = new Date(inv.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
        const pdfUrl = inv.pdfUrl && inv.pdfUrl !== 'PENDING_PDF' && inv.pdfUrl !== 'PENDING'
          ? (inv.pdfUrl.startsWith('http') ? inv.pdfUrl : BASE_URL + inv.pdfUrl)
          : null;
        const pdfLink = pdfUrl
          ? `<a class="btn btn-pdf" href="${esc(pdfUrl)}" target="_blank">Descargar PDF</a>`
          : '';
        const payLink = (inv.status === 'pending' && inv.charge?.id)
          ? `<a class="btn btn-pay" href="/pay/card/${inv.charge.id}">Pagar ahora</a>`
          : '';
        return `
          <div class="card">
            <div class="card-row">
              <div class="card-left">
                <div class="card-title">Factura ${esc(inv.number)}</div>
                <div class="card-meta">${date}</div>
              </div>
              <div class="card-right">
                <div class="card-amount">${Number(inv.total).toFixed(2)} ${esc(inv.currency)}</div>
                ${pill(inv.status)}
              </div>
            </div>
            ${payLink || pdfLink ? `<div class="card-actions">${payLink}${pdfLink}</div>` : ''}
          </div>`;
      }).join('')
    : '<p class="empty">No hay facturas aún.</p>';

  const html = page(`Portal de ${esc(customer.name)} · ${merchantName}`, `
    <div class="header">
      ${logoHtml}
      <div>
        <div class="header-name">${merchantName}</div>
        <div class="header-sub">Tu portal de cliente</div>
      </div>
    </div>
    <div class="container">
      <div class="greeting">Hola, ${esc(customer.name)} 👋</div>
      <div class="greeting-sub">Aquí puedes ver tus cotizaciones, facturas y pagos pendientes.</div>

      <div class="section-title">Cotizaciones</div>
      ${quotesHtml}

      <div class="section-title">Facturas</div>
      ${invoicesHtml}
    </div>
  `);

  res.setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
});

export default router;
