// public/dashboard/js/quotesDetailView.js

// ===============================
// Vista de detalle de presupuesto
// Superficie única con secciones planas (sin cards anidadas).
// ===============================

// Mapeo de códigos internos → texto legible
function getPaymentTermsLabel(code) {
  switch (code) {
    case 'FULL_UPFRONT':
      return 'Pago 100% al aceptar';
    case 'FIFTY_FIFTY':
      return '50% al aceptar, 50% al finalizar';
    case 'MANUAL':
      return 'Solo presupuesto, facturación manual';
    case 'NONE':
    case null:
    case undefined:
    case '':
      return 'Sin condiciones específicas';
    default:
      return code;
  }
}

// Formato de dinero coherente con la moneda de la cotización (LATAM/ES)
function fmtQuoteMoney(amount, currency) {
  const cur = currency || (window.appLocale && window.appLocale.currency) || 'EUR';
  return (
    Number(amount || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' ' + cur
  );
}

// Helper: añade una fila a una <dl> solo si hay valor
function addDefRow(dl, term, value) {
  if (value === undefined || value === null || value === '' || value === '—') return;
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  dd.textContent = value;
  dl.appendChild(dt);
  dl.appendChild(dd);
}

async function renderQuoteDetailView(container, forcedQuoteId) {
  const rawId =
    typeof forcedQuoteId !== 'undefined'
      ? String(forcedQuoteId)
      : container.dataset.quoteId;

  const id = Number(rawId);

  container.innerHTML = '';

  const page = document.createElement('div');
  page.className = 'detail-page';
  container.appendChild(page);

  // ── Cabecera ────────────────────────────────────────────────
  const head = document.createElement('div');
  head.className = 'detail-head';
  page.appendChild(head);

  const headLeft = document.createElement('div');
  headLeft.innerHTML =
    `<h2>Presupuesto #${Number.isFinite(id) ? id : '-'}</h2>` +
    `<p class="detail-sub">Detalle del presupuesto y decisión del cliente.</p>`;
  head.appendChild(headLeft);

  const headRight = document.createElement('div');
  headRight.style.cssText = 'display:flex;gap:8px';

  const duplicateBtn = document.createElement('button');
  duplicateBtn.className = 'btn-secondary btn-sm';
  duplicateBtn.innerHTML = '⎘ Duplicar';
  duplicateBtn.title = 'Crea un nuevo presupuesto con las mismas líneas';
  duplicateBtn.addEventListener('click', () => duplicateQuote(id));

  const backBtn = document.createElement('button');
  backBtn.className = 'btn-secondary btn-sm';
  backBtn.textContent = '← Volver';
  backBtn.addEventListener('click', () => {
    const viewTitle = document.getElementById('view-title');
    if (viewTitle) viewTitle.textContent = 'Presupuestos';
    if (window.renderAppView) window.renderAppView('quotes-list');
    else renderQuotesListView(container);
  });

  headRight.appendChild(duplicateBtn);
  headRight.appendChild(backBtn);
  head.appendChild(headRight);

  // ── Banner de estado (carga / error / éxito) ────────────────
  const statusBox = document.createElement('div');
  statusBox.className = 'alert';
  statusBox.style.cssText = 'margin:14px 22px 0;display:none';
  page.appendChild(statusBox);

  function setStatus(type, msg) {
    statusBox.textContent = msg || '';
    statusBox.className = 'alert';
    if (type === 'error') statusBox.classList.add('error');
    if (type === 'success') statusBox.classList.add('success');
    statusBox.style.display = type || msg ? 'block' : 'none';
  }

  if (!rawId || !Number.isFinite(id)) {
    setStatus('error', 'ID de presupuesto no válido.');
    console.error('[renderQuoteDetailView] quoteId inválido:', rawId);
    return;
  }

  setStatus('', 'Cargando presupuesto…');

  let quote;
  try {
    quote = await getQuoteDetail(id);
  } catch (err) {
    console.error('[renderQuoteDetailView] error en getQuoteDetail:', err);
    setStatus('error', 'Error cargando presupuesto.');
    return;
  }

  if (!quote) {
    setStatus('error', 'Presupuesto no encontrado.');
    return;
  }

  setStatus('', '');

  const st = String(quote.status || '').toLowerCase();
  const cur = quote.currency;

  // ── Sección: ESTADO + TOTAL destacado + timeline ────────────
  const summarySec = document.createElement('div');
  summarySec.className = 'detail-section';
  page.appendChild(summarySec);

  const summaryRow = document.createElement('div');
  summaryRow.className = 'detail-summary';
  summarySec.appendChild(summaryRow);

  // Izq: estado
  const stateBlock = document.createElement('div');
  const stateLabel = document.createElement('div');
  stateLabel.className = 'detail-total-label';
  stateLabel.textContent = 'Estado';
  stateBlock.appendChild(stateLabel);

  const statusSpan = document.createElement('span');
  statusSpan.className = 'status-pill';
  statusSpan.textContent = st === 'pending_approval' ? 'PENDIENTE APROBACIÓN' : st.toUpperCase();
  if (st === 'accepted') statusSpan.classList.add('status-pill-accepted');
  else if (st === 'rejected') statusSpan.classList.add('status-pill-rejected');
  else if (st === 'draft') statusSpan.classList.add('status-pill-draft');
  else if (st === 'pending_approval') statusSpan.classList.add('status-pill-approval');
  else statusSpan.classList.add('status-pill-pending');
  stateBlock.appendChild(statusSpan);
  summaryRow.appendChild(stateBlock);

  // Der: total destacado (Regla del Importe)
  const totalBlock = document.createElement('div');
  totalBlock.style.textAlign = 'right';
  totalBlock.innerHTML =
    `<div class="detail-total-label">Total</div>` +
    `<div class="detail-total-amount">${fmtQuoteMoney(quote.total, cur)}</div>`;
  summaryRow.appendChild(totalBlock);

  // Timeline visual del estado
  summarySec.appendChild(buildStatusTimeline(quote));

  // Badge Good/Better/Best
  if (quote.tiers && quote.tiers.length > 0) {
    const tierLabels = { good: 'Básico', better: 'Estándar', best: 'Premium' };
    const chosen = quote.selectedTierId ? tierLabels[quote.selectedTierId] || quote.selectedTierId : null;
    const tierBadge = document.createElement('div');
    tierBadge.style.marginTop = '14px';
    tierBadge.innerHTML = `
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Cotización con 3 opciones</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${quote.tiers.map((t) => `
          <span style="padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;
            background:${t.id === quote.selectedTierId ? 'var(--green-100)' : t.recommended ? 'var(--green-50)' : 'var(--slate-100)'};
            color:${t.id === quote.selectedTierId ? 'var(--green-700)' : t.recommended ? 'var(--brand)' : 'var(--slate-600)'};
            border:1px solid ${t.id === quote.selectedTierId ? 'var(--green-500)' : 'var(--border)'}">
            ${t.label} — ${fmtQuoteMoney(t.total, cur)}${t.id === quote.selectedTierId ? ' ✓' : ''}
          </span>`).join('')}
      </div>
      ${chosen ? `<div style="margin-top:6px;font-size:13px;color:var(--brand);font-weight:600">Cliente eligió: ${chosen}</div>` : ''}
    `;
    summarySec.appendChild(tierBadge);
  }

  // Firma digital
  if (quote.signatureUrl) {
    const sigBadge = document.createElement('div');
    sigBadge.style.cssText = 'margin-top:14px;display:flex;flex-direction:column;gap:8px';
    sigBadge.innerHTML = `
      <div style="display:inline-flex;align-items:center;gap:6px;background:var(--brand-tint);color:var(--green-700);
        padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;width:fit-content">
        ✅ Firmado digitalmente
      </div>
      <img src="${quote.signatureUrl}" alt="Firma del cliente"
        style="max-width:200px;max-height:80px;border:1px solid var(--border);border-radius:8px;
               background:var(--slate-50);padding:4px;object-fit:contain"/>
    `;
    summarySec.appendChild(sigBadge);
  }

  // ── Sección: CLIENTE ────────────────────────────────────────
  const c = quote.customer || {};
  const custSec = document.createElement('div');
  custSec.className = 'detail-section';
  custSec.innerHTML = '<h3 class="detail-section-title">Cliente</h3>';
  const custDl = document.createElement('dl');
  custDl.className = 'detail-dl';
  addDefRow(custDl, 'Nombre', c.name);
  addDefRow(custDl, 'Teléfono', c.phone);
  addDefRow(custDl, 'Email', c.email);
  if (!custDl.children.length) custDl.innerHTML = '<dd style="color:var(--muted)">Sin datos de cliente.</dd>';
  custSec.appendChild(custDl);
  page.appendChild(custSec);

  // ── Sección: CONCEPTOS + TOTALES ────────────────────────────
  const concSec = document.createElement('div');
  concSec.className = 'detail-section';
  concSec.innerHTML = '<h3 class="detail-section-title">Conceptos</h3>';
  page.appendChild(concSec);

  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = `
    <thead><tr>
      <th>Concepto</th><th>Cant.</th><th>Precio</th><th>IVA</th><th style="text-align:right">Total</th>
    </tr></thead>`;
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  concSec.appendChild(table);

  const lines = Array.isArray(quote.lines) ? quote.lines : [];
  let totalBase = 0;
  let totalIva = 0;

  lines.forEach((line) => {
    const l = line || {};
    const qty = Number(l.qty) || 0;
    const price = Number(l.price) || 0;
    const tax = Number(l.tax ?? 0);
    const base = qty * price;
    const ivaAmount = base * tax;
    const total = base + ivaAmount;
    totalBase += base;
    totalIva += ivaAmount;

    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${escHtml(l.concept || '—')}</td>` +
      `<td>${qty}</td>` +
      `<td>${fmtQuoteMoney(price, cur)}</td>` +
      `<td>${(tax * 100).toFixed(0)} %</td>` +
      `<td style="text-align:right" class="amount">${fmtQuoteMoney(total, cur)}</td>`;
    tbody.appendChild(tr);
  });

  // Totales (base/IVA secundarios, total destacado)
  const totalsWrap = document.createElement('div');
  totalsWrap.style.cssText =
    'margin-top:14px;display:flex;flex-direction:column;gap:4px;align-items:flex-end';
  totalsWrap.innerHTML = `
    <div style="font-size:13px;color:var(--muted)">Base imponible: <span class="amount-muted">${fmtQuoteMoney(totalBase, cur)}</span></div>
    <div style="font-size:13px;color:var(--muted)">IVA: <span class="amount-muted">${fmtQuoteMoney(totalIva, cur)}</span></div>
    <div style="font-size:16px;color:var(--ink);font-weight:700;margin-top:2px">Total: <span class="amount" style="font-size:18px">${fmtQuoteMoney(quote.total, cur)}</span></div>
  `;
  concSec.appendChild(totalsWrap);

  // ── Sección: DECISIÓN ───────────────────────────────────────
  const decSec = document.createElement('div');
  decSec.className = 'detail-section';
  decSec.innerHTML = '<h3 class="detail-section-title">Decisión</h3>';
  page.appendChild(decSec);

  const d = quote.decision || {};
  const decDl = document.createElement('dl');
  decDl.className = 'detail-dl';
  addDefRow(decDl, 'Canal', d.decisionChannel);
  addDefRow(decDl, 'Comentario', d.decisionComment);
  addDefRow(decDl, 'Motivo de rechazo', d.rejectionReason);
  addDefRow(decDl, 'Aceptado', d.acceptedAt ? new Date(d.acceptedAt).toLocaleString('es-ES') : null);
  addDefRow(decDl, 'Rechazado', d.rejectedAt ? new Date(d.rejectedAt).toLocaleString('es-ES') : null);
  addDefRow(decDl, 'Condiciones de pago', getPaymentTermsLabel(d.paymentTerms));
  if (!decDl.children.length) {
    decDl.innerHTML = '<dd style="color:var(--muted)">Aún sin decisión registrada.</dd>';
  }
  decSec.appendChild(decDl);

  // Acciones de back-office (flujo residual: panel inline, sin prompt/alert)
  if (st === 'draft' || st === 'pending') {
    decSec.appendChild(buildDecisionPanel(quote, d, container, setStatus));
  }

  // ── Sección: FACTURAS ───────────────────────────────────────
  const invSec = document.createElement('div');
  invSec.className = 'detail-section';
  invSec.innerHTML = '<h3 class="detail-section-title">Facturas</h3>';
  page.appendChild(invSec);

  const invoices = Array.isArray(quote.invoices) ? quote.invoices : [];
  const invList = document.createElement('div');
  invSec.appendChild(invList);

  function renderInvoices() {
    invList.innerHTML = '';
    if (invoices.length === 0) {
      invList.innerHTML = '<p style="margin:0;color:var(--muted);font-size:13px">No hay facturas generadas.</p>';
      return;
    }
    invoices.forEach((inv) => {
      const div = document.createElement('div');
      div.className = 'invoice-item';
      div.style.cursor = 'pointer';
      div.innerHTML =
        `<p style="margin:0"><strong>${escHtml(inv.number)}</strong><br>` +
        `Total: <span class="amount-muted">${fmtQuoteMoney(inv.total, inv.currency || cur)}</span><br>` +
        `Creada: ${inv.createdAt ? new Date(inv.createdAt).toLocaleString('es-ES') : '—'}</p>`;
      div.addEventListener('click', () => {
        if (window.renderAppView) window.renderAppView('invoice-detail', { invoiceId: inv.id });
      });

      if (inv.status === 'pending') {
        const btnPaid = document.createElement('button');
        btnPaid.className = 'btn-secondary btn-sm';
        btnPaid.style.marginTop = '6px';
        btnPaid.textContent = 'Marcar como pagada';
        btnPaid.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          btnPaid.disabled = true;
          const original = btnPaid.textContent;
          btnPaid.textContent = 'Guardando…';
          try {
            const res = await fetch(`/admin/invoices/${inv.id}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'paid' }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              setStatus('error', 'Error marcando como pagada: ' + (data.error || 'desconocido'));
              btnPaid.disabled = false;
              btnPaid.textContent = original;
              return;
            }
            await renderQuoteDetailView(container, quote.id);
          } catch (err) {
            setStatus('error', 'Error marcando como pagada: ' + (err && err.message ? err.message : 'inténtalo de nuevo'));
            btnPaid.disabled = false;
            btnPaid.textContent = original;
          }
        });
        div.appendChild(btnPaid);
      }
      invList.appendChild(div);
    });
  }
  renderInvoices();

  // Botón generar factura según condiciones
  const pt = quote?.decision?.paymentTerms ?? quote?.paymentTerms ?? null;
  const isAccepted = st === 'accepted';
  const isFullUpfront = pt === 'FULL_UPFRONT';
  const isFiftyFifty = pt === 'FIFTY_FIFTY';

  const btnInvoice = document.createElement('button');
  btnInvoice.className = 'btn-primary';
  btnInvoice.style.marginTop = '12px';
  invSec.appendChild(btnInvoice);

  let canGenerateInvoice = false;
  if (!isAccepted) {
    btnInvoice.textContent = 'Solo disponible tras aceptar el presupuesto';
    btnInvoice.disabled = true;
  } else if (isFullUpfront) {
    if (invoices.length === 0) { btnInvoice.textContent = 'Generar factura (100%)'; canGenerateInvoice = true; }
    else { btnInvoice.textContent = 'Factura ya generada'; btnInvoice.disabled = true; }
  } else if (isFiftyFifty) {
    if (invoices.length === 0) { btnInvoice.textContent = 'Generar 1ª factura (50%)'; canGenerateInvoice = true; }
    else if (invoices.length === 1) { btnInvoice.textContent = 'Generar 2ª factura (50% restante)'; canGenerateInvoice = true; }
    else { btnInvoice.textContent = 'Plan de facturación completado'; btnInvoice.disabled = true; }
  } else {
    btnInvoice.textContent = 'No disponible para estas condiciones de pago';
    btnInvoice.disabled = true;
  }

  if (canGenerateInvoice) {
    btnInvoice.addEventListener('click', async () => {
      btnInvoice.disabled = true;
      const original = btnInvoice.textContent;
      btnInvoice.textContent = 'Generando…';
      try {
        const res = await fetch(`/admin/quotes/${quote.id}/invoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus('error', 'Error generando factura: ' + (data.error || 'desconocido'));
          btnInvoice.disabled = false;
          btnInvoice.textContent = original;
          return;
        }
        await renderQuoteDetailView(container, quote.id);
      } catch (err) {
        setStatus('error', 'Error generando factura: ' + (err && err.message ? err.message : 'inténtalo de nuevo'));
        btnInvoice.disabled = false;
        btnInvoice.textContent = original;
      }
    });
  }

  // ── Sección: NOTAS INTERNAS ─────────────────────────────────
  const notesSec = document.createElement('div');
  notesSec.className = 'detail-section';
  page.appendChild(notesSec);

  const notesHeader = document.createElement('div');
  notesHeader.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px';
  notesHeader.innerHTML =
    '<h3 class="detail-section-title" style="margin:0">📝 Notas internas</h3>' +
    '<span style="font-size:11px;color:var(--muted);background:var(--slate-100);padding:2px 8px;border-radius:999px">Solo tú las ves</span>';
  notesSec.appendChild(notesHeader);

  const notesTextarea = document.createElement('textarea');
  notesTextarea.value = quote.internalNotes || '';
  notesTextarea.placeholder = 'Anota detalles del trabajo, acuerdos verbales, recordatorios…';
  notesTextarea.style.cssText =
    'width:100%;min-height:90px;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;resize:vertical;font-family:inherit;line-height:1.5;color:var(--body)';
  notesSec.appendChild(notesTextarea);

  const notesSaveStatus = document.createElement('div');
  notesSaveStatus.style.cssText = 'font-size:12px;color:var(--muted);margin-top:4px;text-align:right;min-height:16px';
  notesSec.appendChild(notesSaveStatus);

  let notesTimer = null;
  notesTextarea.addEventListener('input', () => {
    notesSaveStatus.style.color = 'var(--muted)';
    notesSaveStatus.textContent = 'Escribiendo…';
    clearTimeout(notesTimer);
    notesTimer = setTimeout(async () => {
      try {
        await apiRequest(`/admin/quotes/${quote.id}/notes`, {
          method: 'PUT',
          body: JSON.stringify({ notes: notesTextarea.value }),
        });
        notesSaveStatus.textContent = '✓ Guardado automáticamente';
        setTimeout(() => { notesSaveStatus.textContent = ''; }, 2500);
      } catch {
        notesSaveStatus.style.color = 'var(--red-600)';
        notesSaveStatus.textContent = 'Error al guardar';
      }
    }, 1200);
  });

  // ── Sección: GASTOS Y MARGEN ────────────────────────────────
  const marginSec = document.createElement('div');
  marginSec.className = 'detail-section';
  marginSec.innerHTML = '<h3 class="detail-section-title">Gastos y margen</h3>';
  page.appendChild(marginSec);

  const mBody = document.createElement('div');
  mBody.innerHTML = '<p style="color:var(--muted);font-size:13px;margin:0">Cargando…</p>';
  marginSec.appendChild(mBody);

  apiRequest(`/admin/expenses/margin/${id}`).then((data) => {
    if (!data) return;
    const positive = data.margin >= 0;
    const marginColor = positive ? 'var(--brand)' : 'var(--red-600)';
    mBody.innerHTML = `
      <div class="margin-grid">
        <div class="margin-tile">
          <div class="margin-tile-label">Ingresos</div>
          <div class="margin-tile-value" style="color:var(--ink)">${fmtQuoteMoney(data.revenue, data.currency || cur)}</div>
        </div>
        <div class="margin-tile">
          <div class="margin-tile-label">Gastos</div>
          <div class="margin-tile-value" style="color:var(--red-600)">${fmtQuoteMoney(data.totalExpenses, data.currency || cur)}</div>
        </div>
        <div class="margin-tile" style="background:${positive ? 'var(--brand-tint)' : 'var(--red-50)'};border-color:${positive ? 'var(--green-100)' : 'var(--red-50)'}">
          <div class="margin-tile-label">Margen</div>
          <div class="margin-tile-value" style="color:${marginColor}">${fmtQuoteMoney(data.margin, data.currency || cur)}</div>
          <div style="font-size:12px;color:${marginColor}">${data.marginPct}%</div>
        </div>
      </div>
      ${data.expenses && data.expenses.length ? `
        <div style="font-size:11.5px;color:var(--muted);margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.04em">Gastos asignados</div>
        ${data.expenses.map((e) => `
          <div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid var(--slate-100)">
            <span>${escHtml(e.concept)}</span>
            <span class="amount-muted">${fmtQuoteMoney(e.amount, data.currency || cur)}</span>
          </div>`).join('')}
      ` : '<p style="font-size:13px;color:var(--muted)">Sin gastos asignados a esta cotización.</p>'}
      <button onclick="renderAppView('expenses')" class="btn-secondary btn-sm" style="margin-top:12px">
        + Añadir gasto a este trabajo
      </button>
    `;
  }).catch(() => {
    mBody.innerHTML = '<p style="font-size:13px;color:var(--muted);margin:0">No hay datos de gastos.</p>';
  });
}

// ── Panel inline de decisión back-office (sustituye prompt/alert) ──────────
function buildDecisionPanel(quote, d, container, setStatus) {
  const panel = document.createElement('div');
  panel.style.cssText =
    'margin-top:14px;padding-top:14px;border-top:1px dashed var(--border)';

  const hint = document.createElement('p');
  hint.style.cssText = 'font-size:12.5px;color:var(--muted);margin:0 0 10px';
  hint.textContent = 'Registrar la decisión manualmente (lo habitual es que el cliente decida por WhatsApp).';
  panel.appendChild(hint);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  const btnAccept = document.createElement('button');
  btnAccept.className = 'btn-primary btn-sm';
  btnAccept.textContent = 'Aceptar presupuesto';
  const btnReject = document.createElement('button');
  btnReject.className = 'btn-secondary btn-sm';
  btnReject.textContent = 'Rechazar presupuesto';
  btnRow.appendChild(btnAccept);
  btnRow.appendChild(btnReject);
  panel.appendChild(btnRow);

  // Formulario inline que se despliega según la acción
  const form = document.createElement('div');
  form.style.cssText = 'display:none;margin-top:12px;flex-direction:column;gap:8px;max-width:420px';
  panel.appendChild(form);

  const fieldStyle =
    'width:100%;padding:9px 11px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;color:var(--body)';

  let mode = null; // 'accept' | 'reject'

  function openForm(which) {
    mode = which;
    form.style.display = 'flex';
    form.innerHTML = '';

    if (which === 'accept') {
      const sel = document.createElement('select');
      sel.style.cssText = fieldStyle;
      sel.innerHTML = `
        <option value="">Condiciones de pago (opcional)…</option>
        <option value="FULL_UPFRONT">Pago 100% al aceptar</option>
        <option value="FIFTY_FIFTY">50% al aceptar, 50% al finalizar</option>
        <option value="MANUAL">Solo presupuesto, facturación manual</option>`;
      if (d.paymentTerms) sel.value = d.paymentTerms;
      const comment = document.createElement('input');
      comment.type = 'text';
      comment.placeholder = 'Comentario interno (opcional)';
      comment.style.cssText = fieldStyle;
      form._sel = sel;
      form._comment = comment;
      form.appendChild(sel);
      form.appendChild(comment);
    } else {
      const reason = document.createElement('textarea');
      reason.placeholder = 'Motivo de rechazo (obligatorio, queda en el historial)';
      reason.rows = 2;
      reason.style.cssText = fieldStyle + ';resize:vertical';
      reason.value = d.rejectionReason || '';
      const comment = document.createElement('input');
      comment.type = 'text';
      comment.placeholder = 'Comentario interno (opcional)';
      comment.style.cssText = fieldStyle;
      form._reason = reason;
      form._comment = comment;
      form.appendChild(reason);
      form.appendChild(comment);
    }

    const confirmRow = document.createElement('div');
    confirmRow.style.cssText = 'display:flex;gap:8px';
    const confirm = document.createElement('button');
    confirm.className = which === 'accept' ? 'btn-primary btn-sm' : 'btn-danger btn-sm';
    confirm.textContent = which === 'accept' ? 'Confirmar aceptación' : 'Confirmar rechazo';
    const cancel = document.createElement('button');
    cancel.className = 'btn-ghost btn-sm';
    cancel.textContent = 'Cancelar';
    cancel.addEventListener('click', () => { form.style.display = 'none'; mode = null; });
    confirmRow.appendChild(confirm);
    confirmRow.appendChild(cancel);
    form.appendChild(confirmRow);

    confirm.addEventListener('click', () => submitDecision(confirm));
  }

  async function submitDecision(confirmBtn) {
    const endpoint = mode === 'accept' ? 'accept' : 'reject';
    let body;
    if (mode === 'accept') {
      body = {
        channel: 'backoffice',
        paymentTerms: form._sel.value || undefined,
        comment: form._comment.value || undefined,
      };
    } else {
      const reason = (form._reason.value || '').trim();
      if (!reason) {
        setStatus('error', 'El motivo de rechazo es obligatorio.');
        form._reason.focus();
        return;
      }
      body = {
        channel: 'backoffice',
        reason,
        comment: form._comment.value || undefined,
      };
    }

    confirmBtn.disabled = true;
    const original = confirmBtn.textContent;
    confirmBtn.textContent = 'Guardando…';
    try {
      const res = await fetch(`/admin/quotes/${quote.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error', `No se pudo ${mode === 'accept' ? 'aceptar' : 'rechazar'}: ` + (data.error || 'desconocido'));
        confirmBtn.disabled = false;
        confirmBtn.textContent = original;
        return;
      }
      await renderQuoteDetailView(container, quote.id);
    } catch (err) {
      setStatus('error', 'Error al guardar la decisión: ' + (err && err.message ? err.message : 'inténtalo de nuevo'));
      confirmBtn.disabled = false;
      confirmBtn.textContent = original;
    }
  }

  btnAccept.addEventListener('click', () => openForm('accept'));
  btnReject.addEventListener('click', () => openForm('reject'));

  return panel;
}

// ── Duplicar presupuesto ──────────────────────────────────────────────────
async function duplicateQuote(quoteId) {
  var detail;
  try {
    detail = await apiRequest('/admin/quotes/' + quoteId);
  } catch (e) {
    alert('Error al cargar el presupuesto para duplicar.');
    return;
  }
  var tpl = {
    name: 'Copia de #' + quoteId,
    currency: detail.currency,
    lines: detail.lines || [],
    tiers: detail.tiers || null,
    paymentTerms: detail.paymentTerms || null,
  };
  sessionStorage.setItem('pf_load_template', JSON.stringify(tpl));
  if (window.renderAppView) renderAppView('quotes-new');
}

// ── Timeline visual del estado del presupuesto (tokens) ───────────────────
function buildStatusTimeline(quote) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:16px';

  const st = String(quote.status || '').toLowerCase();
  const d = quote.decision || {};
  const invoices = Array.isArray(quote.invoices) ? quote.invoices : [];
  const paidInv = invoices.find((i) => String(i.status).toLowerCase() === 'paid');

  const fmtD = (v) => {
    if (!v) return '';
    try { return new Date(v).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }); }
    catch { return ''; }
  };

  const rejected = st === 'rejected';
  const accepted = st === 'accepted';
  const sent = accepted || rejected || st === 'sent';

  const steps = [
    { label: 'Creada', icon: '📝', state: 'done', date: fmtD(quote.createdAt) },
    { label: 'Enviada', icon: '📤', state: sent ? 'done' : (st === 'draft' ? 'current' : 'pending'), date: '' },
    rejected
      ? { label: 'Rechazada', icon: '✖', state: 'rejected', date: fmtD(d.rejectedAt || quote.rejectedAt) }
      : { label: 'Aceptada', icon: '✍️', state: accepted ? 'done' : (st === 'sent' ? 'current' : 'pending'), date: fmtD(d.acceptedAt || quote.acceptedAt) },
    { label: 'Facturada', icon: '🧾', state: invoices.length ? 'done' : 'pending', date: invoices.length ? fmtD(invoices[0].createdAt) : '' },
    { label: 'Cobrada', icon: '💰', state: paidInv ? 'done' : 'pending', date: paidInv ? fmtD(paidInv.paidAt || paidInv.createdAt) : '' },
  ];

  const colorFor = (s) => s === 'done' ? 'var(--brand-bright)' : s === 'current' ? 'var(--blue-600)' : s === 'rejected' ? 'var(--red-500)' : 'var(--slate-200)';
  const textFor = (s) => s === 'pending' ? 'var(--muted)' : 'var(--slate-700)';

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:4px;margin-top:6px';

  steps.forEach((step, i) => {
    const col = document.createElement('div');
    col.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;position:relative';

    if (i > 0) {
      const line = document.createElement('div');
      const prevDone = steps[i - 1].state === 'done';
      line.style.cssText = `position:absolute;top:15px;left:-50%;width:100%;height:3px;background:${prevDone ? 'var(--brand-bright)' : 'var(--slate-200)'};z-index:0`;
      col.appendChild(line);
    }

    const dot = document.createElement('div');
    dot.style.cssText = `width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;z-index:1;background:${colorFor(step.state)};color:${step.state === 'pending' ? 'var(--slate-400)' : '#fff'};box-shadow:${step.state === 'current' ? '0 0 0 4px rgba(37,99,235,.18)' : 'none'}`;
    dot.textContent = step.icon;
    col.appendChild(dot);

    const lbl = document.createElement('div');
    lbl.style.cssText = `margin-top:6px;font-size:12px;font-weight:600;color:${textFor(step.state)}`;
    lbl.textContent = step.label;
    col.appendChild(lbl);

    if (step.date) {
      const dt = document.createElement('div');
      dt.style.cssText = 'font-size:11px;color:var(--muted)';
      dt.textContent = step.date;
      col.appendChild(dt);
    }

    row.appendChild(col);
  });

  wrap.appendChild(row);
  return wrap;
}
