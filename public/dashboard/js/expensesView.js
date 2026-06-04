// public/dashboard/js/expensesView.js

const CATEGORY_LABELS = {
  materiales:     { label: 'Materiales',      color: '#2563eb', bg: '#dbeafe' },
  desplazamiento: { label: 'Desplazamiento',  color: '#d97706', bg: '#fef3c7' },
  herramientas:   { label: 'Herramientas',    color: '#7c3aed', bg: '#ede9fe' },
  subcontrata:    { label: 'Subcontrata',     color: '#dc2626', bg: '#fee2e2' },
  otros:          { label: 'Otros',           color: 'var(--slate-600)', bg: 'var(--slate-100)' },
};

function catPill(category) {
  const c = CATEGORY_LABELS[category] || CATEGORY_LABELS.otros;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:${c.bg};color:${c.color}">${c.label}</span>`;
}

async function renderExpensesView(container) {
  container.innerHTML = `
    <div>
      <!-- Cabecera -->
      <div style="margin-bottom:16px">
        <h2 style="margin:0;font-size:18px">Gastos</h2>
        <p style="margin:2px 0 0;font-size:13px;color:var(--muted)">Controla tus costes y vincúlalos a trabajos para ver el margen real.</p>
      </div>

      <!-- Resumen mensual -->
      <div id="exp-summary" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        <div class="kpi-card"><div class="kpi-label">Cargando…</div></div>
        <div class="kpi-card"><div class="kpi-label"></div></div>
        <div class="kpi-card"><div class="kpi-label"></div></div>
      </div>

      <!-- Filtros y botón nuevo -->
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
        <select id="exp-filter-month" class="input" style="width:auto">
          ${getMonthOptions()}
        </select>
        <select id="exp-filter-cat" class="input" style="width:auto">
          <option value="">Todas las categorías</option>
          ${Object.entries(CATEGORY_LABELS).map(([v,c]) => `<option value="${v}">${c.label}</option>`).join('')}
        </select>
        <button class="btn-primary" id="exp-new-btn" style="margin-left:auto">+ Nuevo gasto</button>
        <a id="exp-export-btn" href="/admin/exports/expenses.csv" class="btn-secondary btn-sm" style="text-decoration:none" title="Exportar gastos filtrados a CSV">⬇ CSV</a>
      </div>

      <!-- Lista -->
      <div id="exp-list"><div style="color:var(--muted);font-size:14px">Cargando gastos…</div></div>
    </div>
  `;

  document.getElementById('exp-new-btn').addEventListener('click', () => openExpenseModal(null));

  function updateExportLink() {
    const monthSel = document.getElementById('exp-filter-month');
    const catSel   = document.getElementById('exp-filter-cat');
    const expBtn   = document.getElementById('exp-export-btn');
    if (!monthSel || !expBtn) return;
    const [y, m] = (monthSel.value || '').split('-');
    const params = new URLSearchParams();
    if (y && m) {
      params.set('from', `${y}-${m}-01`);
      const lastDay = new Date(Number(y), Number(m), 0).getDate();
      params.set('to', `${y}-${m}-${lastDay}`);
    }
    if (catSel && catSel.value) params.set('category', catSel.value);
    expBtn.href = `/admin/exports/expenses.csv?${params.toString()}`;
  }

  document.getElementById('exp-filter-month').addEventListener('change', () => { updateExportLink(); loadExpenses(); });
  document.getElementById('exp-filter-cat').addEventListener('change',   () => { updateExportLink(); loadExpenses(); });
  updateExportLink();

  await Promise.all([loadSummary(), loadExpenses()]);
}

function getMonthOptions() {
  const now = new Date();
  const months = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('es', { month: 'long', year: 'numeric' });
    months.push(`<option value="${val}"${i===0?' selected':''}>${label}</option>`);
  }
  return months.join('');
}

async function loadSummary() {
  const month = document.getElementById('exp-filter-month')?.value || '';
  try {
    const data = await apiRequest(`/admin/expenses/summary?month=${month}`);
    const el = document.getElementById('exp-summary');
    if (!el) return;
    el.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-label">Gasto del mes</div>
        <div class="kpi-value">${fmtEuro(data.totalAmount)}</div>
        <div class="kpi-sub">${data.byCategory?.length || 0} categoría${data.byCategory?.length!==1?'s':''}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Sin asignar a trabajo</div>
        <div class="kpi-value" style="color:${data.unassignedAmount>0?'#d97706':'#22c55e'}">${fmtEuro(data.unassignedAmount)}</div>
        <div class="kpi-sub">no vinculados a cotización</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Mayor categoría</div>
        <div class="kpi-value" style="font-size:16px">${topCat(data.byCategory)}</div>
        <div class="kpi-sub">&nbsp;</div>
      </div>
    `;
  } catch {}
}

function topCat(cats) {
  if (!cats || !cats.length) return '—';
  const top = cats.sort((a,b) => b.amount - a.amount)[0];
  return CATEGORY_LABELS[top.category]?.label || top.category;
}

async function loadExpenses() {
  const month = document.getElementById('exp-filter-month')?.value || '';
  const cat   = document.getElementById('exp-filter-cat')?.value   || '';
  const el = document.getElementById('exp-list');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--muted);font-size:14px">Cargando…</div>';
  try {
    const qs = new URLSearchParams({ month });
    if (cat) qs.set('category', cat);
    const data = await apiRequest(`/admin/expenses?${qs}`);
    const items = data.items || [];

    if (!items.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🧾</div>'
        + '<div class="empty-state-title">Sin gastos este mes</div>'
        + '<div class="empty-state-desc">Registra materiales, desplazamientos y subcontratas para conocer el margen real de cada trabajo.</div>'
        + '<button id="exp-empty-cta" class="btn-primary btn-sm" style="margin-top:14px">+ Añadir mi primer gasto</button></div>';
      const cta = document.getElementById('exp-empty-cta');
      if (cta) cta.addEventListener('click', () => openExpenseModal(null));
      return;
    }

    el.innerHTML = `
      <div class="table-scroll" style="margin-top:4px">
        <table class="table" style="min-width:600px">
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Categoría</th>
              <th>Trabajo</th>
              <th style="text-align:right">Importe</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${items.map((e) => `
              <tr style="cursor:pointer" onclick="openExpenseModal(${JSON.stringify(e).replace(/"/g,'&quot;')})">
                <td>
                  <div style="font-weight:600;color:var(--slate-800)">${escHtml(e.concept)}</div>
                  ${e.notes ? `<div style="font-size:12px;color:var(--slate-400)">${escHtml(e.notes)}</div>` : ''}
                  <div style="font-size:11px;color:var(--slate-400)">${new Date(e.date).toLocaleDateString('es',{day:'2-digit',month:'short'})}</div>
                </td>
                <td>${catPill(e.category)}</td>
                <td style="font-size:13px;color:var(--slate-500)">
                  ${e.quote ? `<a href="#" onclick="event.stopPropagation();renderAppView('quotes-detail',{quoteId:${e.quote.id}})" style="color:var(--blue-600)">Cotización #${e.quote.id}</a>` : '—'}
                  ${e.provider ? `<div style="font-size:12px">${escHtml(e.provider.name)}</div>` : ''}
                </td>
                <td class="amount" style="text-align:right;font-size:15px">${fmtEuro(Number(e.amount))}</td>
                <td style="text-align:center">
                  <button class="btn-icon" onclick="event.stopPropagation();deleteExpenseItem(${e.id})" title="Eliminar">🗑</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div style="color:var(--red-600);font-size:14px">Error: ${err.message}</div>`;
  }
}

async function deleteExpenseItem(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  try {
    await apiRequest(`/admin/expenses/${id}`, { method: 'DELETE' });
    await Promise.all([loadSummary(), loadExpenses()]);
  } catch (err) {
    alert('Error al eliminar: ' + err.message);
  }
}

function openExpenseModal(expense) {
  if (document.getElementById('exp-modal')) return;

  const isEdit = !!expense;
  const today = new Date().toISOString().slice(0, 10);

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-overlay';
  backdrop.id = 'exp-modal';
  backdrop.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <span class="modal-title">${isEdit ? 'Editar gasto' : 'Nuevo gasto'}</span>
        <button class="modal-close" id="exp-close">&times;</button>
      </div>
      <div class="modal-body" style="gap:12px">
        <div class="field">
          <label>Concepto *</label>
          <input id="exp-concept" type="text" placeholder="Ej: Tubería PVC 20mm" value="${escHtml(expense?.concept||'')}"/>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="field">
            <label>Importe *</label>
            <input id="exp-amount" type="number" min="0" step="0.01" placeholder="0.00" value="${expense?.amount||''}"/>
          </div>
          <div class="field">
            <label>Fecha</label>
            <input id="exp-date" type="date" value="${expense ? new Date(expense.date).toISOString().slice(0,10) : today}"/>
          </div>
        </div>
        <div class="field">
          <label>Categoría</label>
          <select id="exp-category">
            ${Object.entries(CATEGORY_LABELS).map(([v,c]) =>
              `<option value="${v}"${expense?.category===v?' selected':''}>${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Cotización vinculada (opcional)</label>
          <input id="exp-quoteid" type="number" placeholder="ID de la cotización" value="${expense?.quote?.id||expense?.quoteId||''}"/>
          <p style="font-size:12px;color:var(--slate-400);margin:2px 0 0">Vincula este gasto a un trabajo para calcular el margen.</p>
        </div>
        <div class="field">
          <label>Proveedor (opcional)</label>
          <input id="exp-providerid" type="number" placeholder="ID del proveedor" value="${expense?.provider?.id||expense?.providerId||''}"/>
        </div>
        <div class="field">
          <label>Notas</label>
          <textarea id="exp-notes" placeholder="Detalles adicionales…" style="height:60px;resize:vertical">${expense?.notes||''}</textarea>
        </div>
        <div class="field" id="exp-receipt-section">
          <label>Foto del ticket (opcional)</label>
          ${expense?.receiptData ? `<img src="${expense.receiptData}" style="max-width:100%;max-height:120px;border-radius:8px;object-fit:contain;border:1px solid var(--slate-200);margin-bottom:6px"/>` : ''}
          <input type="file" id="exp-receipt" accept="image/*" style="font-size:13px"/>
        </div>
        <div id="exp-error" class="alert error" style="display:none"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="exp-cancel">Cancelar</button>
        <button class="btn btn-primary" id="exp-save">${isEdit ? 'Guardar cambios' : 'Añadir gasto'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  document.getElementById('exp-close').addEventListener('click', closeExpModal);
  document.getElementById('exp-cancel').addEventListener('click', closeExpModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeExpModal(); });

  document.getElementById('exp-save').addEventListener('click', async () => {
    const concept    = document.getElementById('exp-concept').value.trim();
    const amount     = Number(document.getElementById('exp-amount').value);
    const date       = document.getElementById('exp-date').value;
    const category   = document.getElementById('exp-category').value;
    const quoteId    = document.getElementById('exp-quoteid').value;
    const providerId = document.getElementById('exp-providerid').value;
    const notes      = document.getElementById('exp-notes').value.trim();
    const fileInput  = document.getElementById('exp-receipt');

    if (!concept) { showExpError('El concepto es obligatorio.'); return; }
    if (!amount || amount <= 0) { showExpError('El importe debe ser mayor que 0.'); return; }

    const btn = document.getElementById('exp-save');
    btn.disabled = true; btn.textContent = 'Guardando…';

    try {
      // Leer foto si se seleccionó
      let receiptData = expense?.receiptData || null;
      if (fileInput.files && fileInput.files[0]) {
        receiptData = await fileToBase64(fileInput.files[0]);
      }

      const payload = {
        concept, amount, date, category, notes: notes || null,
        quoteId: quoteId ? Number(quoteId) : null,
        providerId: providerId ? Number(providerId) : null,
        receiptData,
        currency: window.appLocale?.currency || 'EUR',
      };

      if (isEdit) {
        await apiRequest(`/admin/expenses/${expense.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiRequest('/admin/expenses', { method: 'POST', body: JSON.stringify(payload) });
      }

      closeExpModal();
      await Promise.all([loadSummary(), loadExpenses()]);
    } catch (err) {
      showExpError(err.message || 'Error al guardar.');
      btn.disabled = false; btn.textContent = isEdit ? 'Guardar cambios' : 'Añadir gasto';
    }
  });
}

function closeExpModal() {
  document.getElementById('exp-modal')?.remove();
}

function showExpError(msg) {
  const el = document.getElementById('exp-error');
  if (el) { el.textContent = msg; el.className = 'alert error'; el.style.display = 'block'; }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fmtEuro(amount) {
  const sym = (window.appLocale?.currency === 'MXN' || window.appLocale?.currency === 'COP') ? '$' : '€';
  return `${sym}${Number(amount).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (s) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s]
  );
}
