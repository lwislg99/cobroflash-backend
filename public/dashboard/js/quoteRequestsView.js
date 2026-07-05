// public/dashboard/js/quoteRequestsView.js

async function renderQuoteRequestsView(container) {
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:20px;max-width:860px';
  container.appendChild(wrap);

  // ── Header ──────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'data-card-header customers-card';
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap';

  const titleBlock = document.createElement('div');
  titleBlock.innerHTML = `
    <h2 style="margin:0 0 4px;font-size:17px;font-weight:700;color:var(--neutral-900)">Solicitudes de presupuesto</h2>
    <p style="margin:0;font-size:13px;color:var(--neutral-400)">Peticiones enviadas por clientes desde su portal.</p>
  `;
  header.appendChild(titleBlock);

  const filterSel = document.createElement('select');
  filterSel.style.cssText = 'padding:6px 10px;border:1.5px solid var(--neutral-200);border-radius:8px;font-size:13px;background:#fff;cursor:pointer';
  filterSel.innerHTML = `
    <option value="pending">Pendientes</option>
    <option value="all">Todas</option>
    <option value="done">Completadas</option>
  `;
  header.appendChild(filterSel);
  wrap.appendChild(header);

  const alertEl = document.createElement('div');
  alertEl.className = 'alert';
  alertEl.style.display = 'none';
  wrap.appendChild(alertEl);

  function setAlert(type, msg) {
    alertEl.textContent = msg || '';
    alertEl.className = 'alert';
    if (type === 'success') alertEl.classList.add('success');
    if (type === 'error')   alertEl.classList.add('error');
    alertEl.style.display = type ? 'block' : 'none';
  }

  // ── Lista ────────────────────────────────────────────────────────────────
  const listWrap = document.createElement('div');
  listWrap.style.cssText = 'display:flex;flex-direction:column;gap:12px';
  wrap.appendChild(listWrap);

  async function loadRequests() {
    const status = filterSel.value;
    uiSkeletonCards(listWrap, 3); // A6.2: esqueleto en vez de "Cargando…"

    let requests;
    try {
      requests = await apiRequest(`/admin/quote-requests?status=${status}`);
    } catch {
      listWrap.innerHTML = '<p style="color:var(--red-600);font-size:13px">Error al cargar las solicitudes.</p>';
      return;
    }

    if (!requests || requests.length === 0) {
      listWrap.innerHTML = `
        <div class="customers-card empty-state" style="padding:40px">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">Sin solicitudes ${status === 'pending' ? 'pendientes' : ''}</div>
          <div class="empty-state-desc">Cuando un cliente pulse "Solicitar presupuesto" en su portal, aparecerá aquí.</div>
        </div>`;
      return;
    }

    listWrap.innerHTML = '';
    requests.forEach(function (req) {
      const date = new Date(req.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const statusLabels = { pending: 'Pendiente', read: 'Vista', done: 'Gestionada' };
      const statusColors = { pending: 'status-pill-pending', read: 'status-pill-draft', done: 'status-pill-accepted' };

      const card = document.createElement('div');
      card.className = 'customers-card';
      card.style.cursor = 'default';

      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:10px">
          <div>
            <div style="font-weight:700;font-size:15px;color:var(--neutral-900)">${escReq(req.customer?.name || 'Cliente')}</div>
            <div style="font-size:12px;color:var(--neutral-400);margin-top:2px">${escReq(req.customer?.email || '')} ${req.customer?.phone ? '· ' + escReq(req.customer.phone) : ''}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="status-pill ${statusColors[req.status] || 'status-pill-draft'}">${statusLabels[req.status] || req.status}</span>
            <span style="font-size:12px;color:var(--neutral-400)">${date}</span>
          </div>
        </div>
        <div style="background:var(--neutral-50);border-radius:8px;padding:12px;font-size:13.5px;color:var(--neutral-700);border:1px solid var(--neutral-100);white-space:pre-wrap;word-break:break-word;margin-bottom:12px">${escReq(req.description)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap" id="req-actions-${req.id}"></div>
      `;

      const actionsDiv = card.querySelector(`#req-actions-${req.id}`);

      // Botón crear presupuesto para este cliente
      const btnQuote = document.createElement('button');
      btnQuote.className = 'btn-primary btn-sm';
      btnQuote.textContent = '+ Crear presupuesto';
      btnQuote.onclick = () => {
        if (window.renderAppView) renderAppView('quotes-new');
        // Pre-seleccionar cliente si se implementa
      };
      actionsDiv.appendChild(btnQuote);

      // Botón marcar como gestionada
      if (req.status !== 'done') {
        const btnDone = document.createElement('button');
        btnDone.className = 'btn-ghost btn-sm';
        btnDone.textContent = '✓ Marcar gestionada';
        btnDone.onclick = async () => {
          btnDone.disabled = true;
          try {
            await apiRequest(`/admin/quote-requests/${req.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ status: 'done' }),
            });
            setAlert('success', 'Solicitud marcada como gestionada.');
            await loadRequests();
          } catch {
            setAlert('error', 'Error al actualizar.');
            btnDone.disabled = false;
          }
        };
        actionsDiv.appendChild(btnDone);
      }

      listWrap.appendChild(card);
    });
  }

  filterSel.addEventListener('change', loadRequests);
  await loadRequests();
}

function escReq(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
