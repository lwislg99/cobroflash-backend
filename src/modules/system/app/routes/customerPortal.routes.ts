// src/modules/system/app/routes/customerPortal.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { formatMoneyEs } from '../../../../core/utils/utils'; // A22.1: dinero es-ES con símbolo
import { getLocale } from '../../../../core/i18n/locales';
import { esc } from '../../../../core/utils/utils';
import { BASE_URL } from '../../../../core/config/env';
import { sendWhatsAppText } from '../../../../integrations/whatsapp';
import { normalizePhone } from '../../../../core/utils/utils';
import { recordCustomerEvent } from '../../customerEvents.service';
import { ensureChargeReceiptToken } from '../../../../lib/invoicing';

const router = Router();

// ── helpers ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviado', accepted: 'Aceptado', rejected: 'Rechazado',
  pending: 'Pendiente', paid: 'Pagada', expired: 'Caducada',
};
const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  accepted: { bg: '#dcfce7', fg: '#166534' },
  paid:     { bg: '#dcfce7', fg: '#166534' },
  sent:     { bg: '#dbeafe', fg: '#1d4ed8' },
  pending:  { bg: '#fef3c7', fg: '#92400e' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
  expired:  { bg: '#f1f2ee', fg: '#4b554f' },
  draft:    { bg: '#f1f2ee', fg: '#4b554f' },
};

function pill(status: string) {
  const label = STATUS_LABELS[status] ?? status;
  const c = STATUS_COLOR[status] ?? { bg: '#f1f2ee', fg: '#4b554f' };
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:${c.bg};color:${c.fg};letter-spacing:.02em;text-transform:uppercase">${esc(label)}</span>`;
}

function fmt(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateShort(d: Date | string) {
  return new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

function css() {
  return `
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  :root{
    --brand:#16a34a;--brand-bright:#22c55e;--brand-tint:#ecfdf5;
    --ink:#0f1c17;--body:#3f4a45;--muted:#6b756f;
    --bg:#f6f7f5;--surface:#fff;--border:#e7e9e5;--slate-50:#f7f8f6;--slate-100:#f1f2ee;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter',system-ui,-apple-system,sans-serif; font-feature-settings:"cv11","ss01";
    background: var(--bg); color: var(--body); min-height: 100vh; -webkit-font-smoothing: antialiased; }

  /* Header */
  .pf-header { background: var(--ink); padding: 14px 20px;
    display: flex; align-items: center; gap: 12px; }
  .pf-logo { max-height: 38px; max-width: 90px; object-fit: contain; border-radius: 6px; }
  .pf-brand { color: #fff; font-weight: 700; font-size: 15px; line-height: 1.3; }
  .pf-brand-sub { color: rgba(255,255,255,.6); font-size: 12px; font-weight: 400; }

  /* Container */
  .pf-main { max-width: 600px; margin: 0 auto; padding: 20px 14px 60px; }

  /* Greeting */
  .pf-greeting { font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: var(--ink); margin: 20px 0 4px; }
  .pf-greeting-sub { font-size: 14px; color: var(--muted); margin-bottom: 28px; }

  /* Section */
  .pf-section { margin-bottom: 28px; }
  .pf-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .08em; color: var(--muted); margin-bottom: 10px; padding-left: 2px; }

  /* Card */
  .pf-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 0;
    box-shadow: 0 1px 2px rgba(16,24,40,.04); margin-bottom: 10px; overflow: hidden; }
  .pf-card-body { padding: 14px 16px; }
  .pf-card-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .pf-card-title { font-weight: 700; font-size: 14.5px; color: var(--ink); margin-bottom: 3px; }
  .pf-card-meta { font-size: 12.5px; color: var(--muted); }
  .pf-card-amount { font-weight: 800; font-size: 17px; color: var(--ink); margin-bottom: 5px; text-align: right; font-variant-numeric: tabular-nums; }

  /* Buttons */
  .pf-btn { display: block; width: 100%; padding: 12px 14px; border-radius: 12px;
    font-size: 14px; font-weight: 700; text-align: center; text-decoration: none;
    border: none; cursor: pointer; transition: opacity .15s, background .15s; }
  .pf-btn:active { opacity: .85; }
  .pf-btn-pay { background: var(--brand); color: #fff; margin-bottom: 6px; }
  .pf-btn-pdf { background: var(--surface); color: var(--ink); border: 1px solid var(--border); margin-bottom: 6px; }
  .pf-btn-mp  { background: #009ee3; color: #fff; margin-bottom: 6px; }
  .pf-btn-ghost { background: transparent; color: var(--muted); border: 1px solid var(--border);
    font-size: 13px; padding: 8px 14px; }

  /* Lines expandibles */
  .pf-lines { border-top: 1px solid var(--slate-100); }
  .pf-lines-toggle { width: 100%; background: none; border: none; padding: 9px 16px;
    font-size: 12.5px; color: var(--muted); cursor: pointer; text-align: left;
    display: flex; align-items: center; gap: 6px; font-family: inherit; }
  .pf-lines-toggle:hover { background: var(--slate-50); }
  .pf-lines-body { display: none; padding: 0 16px 12px; }
  .pf-lines-body.open { display: block; }
  .pf-line-row { display: flex; justify-content: space-between; gap: 8px;
    font-size: 12.5px; padding: 5px 0; border-bottom: 1px solid var(--slate-100); }
  .pf-line-row:last-child { border-bottom: none; }
  .pf-line-concept { color: var(--body); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pf-line-amount { font-weight: 600; color: var(--ink); white-space: nowrap; font-variant-numeric: tabular-nums; }

  /* Request form */
  .pf-request-btn { background: linear-gradient(135deg,var(--brand-bright),var(--brand));
    color: #fff; border: none; width: 100%; padding: 14px;
    border-radius: 14px; font-size: 15px; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 14px rgba(22,163,74,.28); font-family: inherit; }
  .pf-request-form { display: none; background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
  .pf-request-form.open { display: block; }
  .pf-request-label { font-size: 13px; font-weight: 600; color: var(--body); display: block; margin-bottom: 6px; }
  .pf-request-textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--border);
    border-radius: 10px; font-size: 14px; font-family: inherit; resize: vertical;
    min-height: 100px; color: var(--ink); }
  .pf-request-textarea:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px rgba(34,197,94,.22); }
  .pf-request-submit { background: var(--brand); color: #fff; border: none; width: 100%;
    padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 700;
    cursor: pointer; margin-top: 10px; font-family: inherit; }
  .pf-request-cancel { background: none; border: none; color: var(--muted); font-size: 13px;
    cursor: pointer; margin-top: 8px; width: 100%; font-family: inherit; }
  .pf-success { background: var(--brand-tint); border: 1px solid #bbf7d0; border-radius: 12px;
    padding: 14px; color: #15803d; font-size: 14px; text-align: center; font-weight: 600; }

  /* Empty */
  .pf-empty { color: var(--muted); font-size: 14px; text-align: center; padding: 20px 0; }

  /* Footer */
  .pf-footer { text-align: center; font-size: 12px; color: var(--muted); margin-top: 40px; }

  /* Contact */
  .pf-contact-row { display: flex; gap: 10px; }
  .pf-wa-btn { flex: 1; display: flex; align-items: center; justify-content: center;
    gap: 8px; background: #25d366; color: #fff; border-radius: 12px; padding: 12px;
    text-decoration: none; font-weight: 700; font-size: 13.5px; }
</style>`;
}

function page(title: string, body: string) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(title)}</title>
  ${css()}
</head>
<body>
${body}
<p class="pf-footer">Hecho con <a href="https://yaqu.app" style="color:inherit;font-weight:700;text-decoration:none">YaQu</a></p>
<script>
  // Expandir líneas de factura
  document.querySelectorAll('.pf-lines-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const body = btn.nextElementSibling;
      const open = body.classList.toggle('open');
      btn.querySelector('.pf-chevron').textContent = open ? '▲' : '▼';
    });
  });

  // Formulario de solicitud
  const reqBtn  = document.getElementById('pf-req-btn');
  const reqForm = document.getElementById('pf-req-form');
  const reqCancel = document.getElementById('pf-req-cancel');
  const reqSubmit = document.getElementById('pf-req-submit');
  const reqTa    = document.getElementById('pf-req-ta');
  const reqSuccess = document.getElementById('pf-req-success');

  if (reqBtn) {
    reqBtn.addEventListener('click', () => {
      reqBtn.style.display = 'none';
      reqForm.classList.add('open');
      reqTa.focus();
    });
    reqCancel.addEventListener('click', () => {
      reqBtn.style.display = 'block';
      reqForm.classList.remove('open');
    });
    reqSubmit.addEventListener('click', async () => {
      const desc = reqTa.value.trim();
      if (!desc) { reqTa.focus(); return; }
      reqSubmit.disabled = true;
      reqSubmit.textContent = 'Enviando…';
      try {
        const r = await fetch(window.PF_REQUEST_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: desc }),
        });
        if (r.ok) {
          reqForm.classList.remove('open');
          reqSuccess.style.display = 'block';
        } else {
          alert('Error al enviar. Inténtalo de nuevo.');
          reqSubmit.disabled = false;
          reqSubmit.textContent = 'Enviar solicitud';
        }
      } catch {
        alert('Error de conexión.');
        reqSubmit.disabled = false;
        reqSubmit.textContent = 'Enviar solicitud';
      }
    });
  }
</script>
</body>
</html>`;
}

// ── GET /cliente/:token ──────────────────────────────────────────────────
router.get('/:token', async (req, res) => {
  const { token } = req.params;

  const customer = await prisma.customer.findUnique({
    where: { portalToken: token },
    include: {
      merchant: {
        select: { id: true, name: true, legalName: true, logoUrl: true, whatsappPhone: true, country: true },
      },
    },
  });

  if (!customer) {
    return res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(
      page('Portal no encontrado',
        '<div style="padding:60px 20px;text-align:center;color:#6b756f;font-size:15px">Este enlace no es válido o ha expirado.</div>'
      )
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

  // SCRUM-85: token OPACO por cobro pendiente — NUNCA el chargeId en el botón "Pagar ahora".
  const payTokens = new Map<number, string>();
  for (const inv of invoices) {
    if (inv.status === 'pending' && inv.charge?.id && !payTokens.has(inv.charge.id)) {
      payTokens.set(inv.charge.id, await ensureChargeReceiptToken(inv.charge.id, prisma));
    }
  }

  const m          = customer.merchant!;
  const mName      = esc(m.legalName || m.name || 'Tu proveedor');
  const initial    = esc((m.name || m.legalName || 'Y').trim().charAt(0).toUpperCase());
  const logoHtml   = m.logoUrl
    ? `<img class="pf-logo" src="${esc(m.logoUrl)}" alt="logo"/>`
    : `<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#22c55e,#22d3ee);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:#052e16">${initial}</div>`;

  // A22.1: el portal habla el idioma del documento del país (ES → "Presupuesto")
  const locale = getLocale((customer.merchant as any)?.country);

  // ── Cotizaciones ────────────────────────────────────────────────────────
  const quotesHtml = quotes.length
    ? quotes.map((q) => {
        const hasLines = Array.isArray(q.lines) && (q.lines as any[]).length > 0;
        const linesHtml = hasLines
          ? `<div class="pf-lines">
              <button class="pf-lines-toggle">
                <span class="pf-chevron">▼</span> Ver detalles (${(q.lines as any[]).length} línea${(q.lines as any[]).length !== 1 ? 's' : ''})
              </button>
              <div class="pf-lines-body">
                ${(q.lines as any[]).map((l: any) => {
                  const total = Number(l.qty||1) * Number(l.price||0) * (1 + Number(l.tax||0));
                  return `<div class="pf-line-row">
                    <span class="pf-line-concept">${esc(l.concept||'')}</span>
                    <span class="pf-line-amount">${formatMoneyEs(total, q.currency)}</span>
                  </div>`;
                }).join('')}
              </div>
            </div>` : '';
        const pdfUrl = q.pdfUrl && q.pdfUrl !== 'PENDING_PDF'
          ? (q.pdfUrl.startsWith('http') ? q.pdfUrl : BASE_URL + q.pdfUrl)
          : null;
        const btnPdf    = pdfUrl ? `<a class="pf-btn pf-btn-pdf" href="${esc(pdfUrl)}" target="_blank">📄 Ver PDF</a>` : '';
        const btnAccept = q.status === 'sent' ? `<a class="pf-btn pf-btn-pay" href="/pay/quote/${q.id}/accept">✅ Ver y responder</a>` : '';
        const hasActions = btnAccept || btnPdf;
        return `
          <div class="pf-card">
            <div class="pf-card-body">
              <div class="pf-card-row">
                <div>
                  <div class="pf-card-title">${locale.quote} #${q.quoteNumber ?? q.id}</div>
                  <div class="pf-card-meta">${dateShort(q.createdAt)}</div>
                </div>
                <div>
                  <div class="pf-card-amount">${formatMoneyEs(Number(q.total), q.currency)}</div>
                  ${pill(q.status)}
                </div>
              </div>
              ${hasActions ? `<div style="margin-top:12px">${btnAccept}${btnPdf}</div>` : ''}
            </div>
            ${linesHtml}
          </div>`;
      }).join('')
    : `<p class="pf-empty">No hay ${locale.quotePlural.toLowerCase()} aún.</p>`;

  // ── Facturas ─────────────────────────────────────────────────────────────
  const invoicesHtml = invoices.length
    ? invoices.map((inv) => {
        const lines = inv.lines && Array.isArray(inv.lines) ? inv.lines as any[] : [];
        const linesHtml = lines.length > 0
          ? `<div class="pf-lines">
              <button class="pf-lines-toggle">
                <span class="pf-chevron">▼</span> Ver detalles (${lines.length} línea${lines.length !== 1 ? 's' : ''})
              </button>
              <div class="pf-lines-body">
                ${lines.map((l: any) => {
                  const total = Number(l.qty||1) * Number(l.price||0) * (1 + Number(l.tax||0));
                  return `<div class="pf-line-row">
                    <span class="pf-line-concept">${esc(l.concept||'')}</span>
                    <span class="pf-line-amount">${formatMoneyEs(total, inv.currency)}</span>
                  </div>`;
                }).join('')}
              </div>
            </div>` : '';
        const pdfUrl = inv.pdfUrl && inv.pdfUrl !== 'PENDING_PDF'
          ? (inv.pdfUrl.startsWith('http') ? inv.pdfUrl : BASE_URL + inv.pdfUrl)
          : null;
        const btnPdf  = pdfUrl ? `<a class="pf-btn pf-btn-pdf" href="${esc(pdfUrl)}" target="_blank">📄 Descargar factura</a>` : '';
        const payToken = inv.charge?.id ? payTokens.get(inv.charge.id) : undefined;
        const btnPay  = inv.status === 'pending' && payToken
          ? `<a class="pf-btn pf-btn-pay" href="/pay/card/${payToken}">💳 Pagar ahora</a>`
          : '';
        const hasActions = btnPay || btnPdf;
        return `
          <div class="pf-card">
            <div class="pf-card-body">
              <div class="pf-card-row">
                <div>
                  <div class="pf-card-title">Factura ${esc(inv.number)}</div>
                  <div class="pf-card-meta">${dateShort(inv.createdAt)}${inv.paidAt ? ' · Pagada ' + dateShort(inv.paidAt) : ''}</div>
                </div>
                <div>
                  <div class="pf-card-amount">${formatMoneyEs(Number(inv.total), inv.currency)}</div>
                  ${pill(inv.status)}
                </div>
              </div>
              ${hasActions ? `<div style="margin-top:12px">${btnPay}${btnPdf}</div>` : ''}
            </div>
            ${linesHtml}
          </div>`;
      }).join('')
    : '<p class="pf-empty">No hay facturas aún.</p>';

  // ── Botón WhatsApp para contactar ────────────────────────────────────────
  const waPhone    = m.whatsappPhone ? normalizePhone(m.whatsappPhone) : null;
  const contactHtml = waPhone
    ? `<div class="pf-section">
        <div class="pf-section-title">Contacto</div>
        <div class="pf-contact-row">
          <a class="pf-wa-btn" href="https://wa.me/${esc(waPhone.replace('+',''))}" target="_blank">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.34.22-.64.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.52.15-.17.2-.29.3-.49.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.57-.49-.49-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.02 1-1.02 2.43 0 1.43 1.04 2.82 1.19 3.01.15.2 2.05 3.13 4.97 4.39.7.3 1.24.48 1.67.61.7.22 1.34.19 1.84.12.56-.08 1.73-.71 1.97-1.39.24-.68.24-1.26.17-1.39-.07-.12-.27-.19-.57-.34z"/><path d="M12 0C5.37 0 0 5.37 0 12c0 2.1.54 4.07 1.49 5.79L.06 23.3a.75.75 0 0 0 .94.93l5.57-1.45A11.95 11.95 0 0 0 12 24c6.63 0 12-5.37 12-12S18.63 0 12 0zm0 21.75A9.72 9.72 0 0 1 6.7 20.1l-.37-.23-3.85 1 1.01-3.77-.25-.39A9.72 9.72 0 0 1 2.25 12C2.25 6.62 6.62 2.25 12 2.25S21.75 6.62 21.75 12 17.38 21.75 12 21.75z"/></svg>
            WhatsApp
          </a>
        </div>
      </div>`
    : '';

  const requestUrl = `${BASE_URL}/cliente/${token}/quote-request`;

  const html = page(`Portal de ${esc(customer.name)} · ${mName}`, `
    <div class="pf-header">
      ${logoHtml}
      <div>
        <div class="pf-brand">${mName}</div>
        <div class="pf-brand-sub">Tu portal de cliente</div>
      </div>
    </div>
    <div class="pf-main">
      <div class="pf-greeting">Hola, ${esc(customer.name)} 👋</div>
      <div class="pf-greeting-sub">Aquí tienes tus ${locale.quotePlural.toLowerCase()}, facturas y pagos.</div>

      <!-- Solicitar presupuesto -->
      <div class="pf-section">
        <button class="pf-request-btn" id="pf-req-btn">✏️ Solicitar nuevo presupuesto</button>
        <div class="pf-request-form" id="pf-req-form">
          <label class="pf-request-label">Describe brevemente el trabajo que necesitas:</label>
          <textarea class="pf-request-textarea" id="pf-req-ta"
            placeholder="Ej. Quiero reparar una gotera en el baño y revisar las tuberías del suelo..."></textarea>
          <button class="pf-request-submit" id="pf-req-submit">✅ Enviar solicitud</button>
          <button class="pf-request-cancel" id="pf-req-cancel">Cancelar</button>
        </div>
        <div class="pf-success" id="pf-req-success" style="display:none">
          ✅ ¡Solicitud enviada! Te contactaremos pronto.
        </div>
      </div>

      ${contactHtml}

      <div class="pf-section">
        <div class="pf-section-title">${locale.quotePlural}</div>
        ${quotesHtml}
      </div>

      <div class="pf-section">
        <div class="pf-section-title">Facturas</div>
        ${invoicesHtml}
      </div>
    </div>
    <script>window.PF_REQUEST_URL = "${esc(requestUrl)}";</script>
  `);

  res.setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
});

// ── POST /cliente/:token/quote-request ─────────────────────────────────
router.post('/:token/quote-request', async (req, res) => {
  const { token } = req.params;
  const description = String(req.body?.description || '').trim();

  if (!description) return res.status(400).json({ error: 'description_required' });
  if (description.length > 2000) return res.status(400).json({ error: 'too_long' });

  const customer = await prisma.customer.findUnique({
    where: { portalToken: token },
    include: { merchant: { select: { name: true, whatsappPhone: true } } },
  });

  if (!customer) return res.status(404).json({ error: 'not_found' });

  try {
    // Guardar la solicitud
    await prisma.quoteRequest.create({
      data: {
        merchantId:  customer.merchantId,
        customerId:  customer.id,
        description,
        status:      'pending',
      },
    });

    // ENT-3: historial
    recordCustomerEvent({
      merchantId: customer.merchantId,
      customerId: customer.id,
      type: 'quote_requested',
      title: 'El cliente solicitó un presupuesto',
      detail: description.length > 140 ? description.slice(0, 140) + '…' : description,
    });

    // Notificar al profesional por WhatsApp (fire-and-forget)
    const mPhone = normalizePhone(customer.merchant?.whatsappPhone);
    if (mPhone) {
      const trimmed = description.length > 500
        ? description.slice(0, 500) + '…'
        : description;
      sendWhatsAppText({
        to: mPhone,
        merchantId: customer.merchantId, // V0-2: demo solo a DEMO_SAFE_NUMBERS
        text: `📋 *Nueva solicitud de presupuesto*\n\n👤 *Cliente:* ${customer.name}\n\n📝 *Descripción:*\n"${trimmed}"\n\nRevísala en tu panel 👉 ${BASE_URL}/dashboard/#quote-requests`,
      }).catch((e) => console.error('[quoteRequest] WA error:', e?.message));
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[POST /cliente/:token/quote-request]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
