// public/dashboard/js/invoicesView.js

async function fetchInvoices(options = {}) {
    const { status = 'all', search = '' } = options;
  
    const url = new URL('/admin/invoices', window.location.origin);
    if (status && status !== 'all') {
      url.searchParams.set('status', status);
    }
    if (search) {
      url.searchParams.set('search', search);
    }
  
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
  
    if (!res.ok) {
      throw new Error('Error cargando facturas');
    }
  
    return res.json();
  }
  
  async function renderInvoicesView(container) {
    container.innerHTML = '';
  
    // Card principal
    const wrapper = document.createElement('div');
    wrapper.className = 'data-card';
    container.appendChild(wrapper);

    // Header con título y filtros
    const header = document.createElement('div');
    header.className = 'data-card-header';
    wrapper.appendChild(header);

    const left = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'Facturas';
    title.style.cssText = 'margin:0 0 2px;font-size:16px;font-weight:700;color:var(--slate-900)';
    left.appendChild(title);
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Listado de facturas emitidas.';
    subtitle.style.cssText = 'margin:0;font-size:12.5px;color:var(--slate-400)';
    left.appendChild(subtitle);
    header.appendChild(left);

    const right = document.createElement('div');
    right.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center';

    const selectStatus = document.createElement('select');
    selectStatus.className = 'input';
    selectStatus.innerHTML = `
      <option value="all">Todas</option>
      <option value="pending">Pendientes</option>
      <option value="paid">Pagadas</option>
      <option value="expired">Vencidas</option>
    `;
    right.appendChild(selectStatus);

    const inputSearch = document.createElement('input');
    inputSearch.className = 'input';
    inputSearch.placeholder = 'Buscar por nº, cliente…';
    inputSearch.style.minWidth = '160px';
    right.appendChild(inputSearch);

    const exportBtn = document.createElement('a');
    exportBtn.className = 'btn-secondary btn-sm';
    exportBtn.style.textDecoration = 'none';
    exportBtn.innerHTML = '⬇ CSV';
    exportBtn.title = 'Exportar facturas filtradas a CSV';
    exportBtn.href = '/admin/exports/invoices.csv';
    right.appendChild(exportBtn);

    header.appendChild(right);

    const statusBox = document.createElement('div');
    statusBox.className = 'alert';
    statusBox.style.cssText = 'margin:8px 16px;display:none';
    wrapper.appendChild(statusBox);

    const tableScroll = document.createElement('div');
    tableScroll.className = 'table-scroll';
    wrapper.appendChild(tableScroll);
    const table = document.createElement('table');
    table.className = 'table';
    tableScroll.appendChild(table);
  
    // Checkbox "seleccionar todo" en cabecera
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th style="width:36px"><input type="checkbox" id="inv-check-all" title="Seleccionar todas"/></th>
        <th>Nº factura</th>
        <th>Cliente</th>
        <th>Total</th>
        <th>Estado</th>
        <th>Fecha</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    // Barra de acciones bulk (flotante, aparece cuando hay seleccionadas)
    const bulkBar = document.createElement('div');
    bulkBar.style.cssText = [
      'display:none;position:sticky;bottom:16px;z-index:50;',
      'background:var(--slate-900);color:#fff;border-radius:12px;',
      'padding:10px 16px;display:none;align-items:center;gap:12px;',
      'box-shadow:0 8px 24px rgba(15,23,42,.35);margin:8px 0;',
    ].join('');
    bulkBar.innerHTML = `
      <span id="bulk-count" style="font-size:13.5px;font-weight:600"></span>
      <button id="bulk-paid-btn" class="btn-primary btn-sm">✓ Marcar como pagadas</button>
      <button id="bulk-cancel-btn" class="btn-ghost btn-sm" style="color:#94a3b8">Cancelar</button>
    `;
    wrapper.appendChild(bulkBar);

    let currentStatus = 'all';
    let currentSearch = '';
    let selectedIds = new Set();

    function updateBulkBar() {
      const n = selectedIds.size;
      if (n > 0) {
        bulkBar.style.display = 'flex';
        bulkBar.querySelector('#bulk-count').textContent = n + ' factura' + (n !== 1 ? 's' : '') + ' seleccionada' + (n !== 1 ? 's' : '');
      } else {
        bulkBar.style.display = 'none';
      }
      // Sync "select all" checkbox
      const checkAll = document.getElementById('inv-check-all');
      const allBoxes = Array.from(document.querySelectorAll('.inv-row-check'));
      if (checkAll) checkAll.indeterminate = n > 0 && n < allBoxes.length;
      if (checkAll) checkAll.checked = allBoxes.length > 0 && n === allBoxes.length;
    }

    bulkBar.querySelector('#bulk-cancel-btn').addEventListener('click', () => {
      selectedIds.clear();
      document.querySelectorAll('.inv-row-check').forEach(cb => { cb.checked = false; });
      updateBulkBar();
    });

    bulkBar.querySelector('#bulk-paid-btn').addEventListener('click', async () => {
      if (selectedIds.size === 0) return;
      const ids = Array.from(selectedIds);
      const btn = bulkBar.querySelector('#bulk-paid-btn');
      btn.disabled = true;
      btn.textContent = 'Procesando…';
      try {
        const data = await apiRequest('/admin/invoices/bulk-paid', {
          method: 'POST',
          body: JSON.stringify({ ids }),
        });
        selectedIds.clear();
        statusBox.textContent = '✓ ' + data.updated + ' factura' + (data.updated !== 1 ? 's' : '') + ' marcada' + (data.updated !== 1 ? 's' : '') + ' como pagadas.';
        statusBox.className = 'alert success';
        statusBox.style.display = 'block';
        await reload();
      } catch {
        btn.disabled = false;
        btn.textContent = '✓ Marcar como pagadas';
        statusBox.textContent = 'Error al actualizar las facturas.';
        statusBox.className = 'alert error';
        statusBox.style.display = 'block';
      }
    });

    // "Seleccionar todo"
    thead.querySelector('#inv-check-all').addEventListener('change', function() {
      const checked = this.checked;
      document.querySelectorAll('.inv-row-check').forEach(cb => {
        cb.checked = checked;
        const id = Number(cb.dataset.id);
        if (checked) selectedIds.add(id);
        else selectedIds.delete(id);
      });
      updateBulkBar();
    });

    async function reload() {
      statusBox.textContent = 'Cargando facturas…';
      statusBox.className = 'alert';
      statusBox.style.display = 'block';

      try {
        const invoices = await fetchInvoices({ status: currentStatus, search: currentSearch });
        tbody.innerHTML = '';
        selectedIds.clear();
        updateBulkBar();

        if (!invoices || invoices.length === 0) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = 6;
          td.style.cssText = 'text-align:center;color:var(--slate-400);padding:24px';
          td.textContent = 'No hay facturas para estos filtros.';
          tr.appendChild(td);
          tbody.appendChild(tr);
          statusBox.style.display = 'none';
          return;
        }

        invoices.forEach((inv) => {
          const tr = document.createElement('tr');
          const st = String(inv.status || '').toLowerCase();

          // Checkbox
          const tdCheck = document.createElement('td');
          tdCheck.style.cssText = 'width:36px;padding:12px 8px';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'inv-row-check';
          cb.dataset.id = inv.id;
          cb.addEventListener('change', function(e) {
            e.stopPropagation();
            if (this.checked) selectedIds.add(inv.id);
            else selectedIds.delete(inv.id);
            updateBulkBar();
          });
          tdCheck.appendChild(cb);
          tr.appendChild(tdCheck);

          const tdNumber = document.createElement('td');
          tdNumber.style.fontWeight = '600';
          tdNumber.textContent = inv.number;
          tr.appendChild(tdNumber);

          const tdCustomer = document.createElement('td');
          tdCustomer.textContent = (inv.customer && inv.customer.name) || '—';
          tr.appendChild(tdCustomer);

          const tdTotal = document.createElement('td');
          tdTotal.style.fontWeight = '600';
          tdTotal.textContent = Number(inv.total || 0).toFixed(2) + ' ' + inv.currency;
          tr.appendChild(tdTotal);

          const tdStatus = document.createElement('td');
          const span = document.createElement('span');
          span.className = 'status-pill' +
            (st === 'paid' ? ' status-pill-accepted' : st === 'expired' ? ' status-pill-rejected' : ' status-pill-pending');
          span.textContent = st === 'paid' ? 'PAGADA' : st === 'expired' ? 'VENCIDA' : 'PENDIENTE';
          tdStatus.appendChild(span);
          tr.appendChild(tdStatus);

          const tdDate = document.createElement('td');
          tdDate.style.color = 'var(--slate-500)';
          tdDate.textContent = inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('es-ES') : '—';
          tr.appendChild(tdDate);

          tr.style.cursor = 'pointer';
          tr.addEventListener('click', (e) => {
            if (e.target === cb) return; // no navegar si click en checkbox
            if (window.renderAppView) window.renderAppView('invoice-detail', { invoiceId: inv.id });
          });

          tbody.appendChild(tr);
        });

        statusBox.style.display = 'none';
      } catch (err) {
        console.error('[renderInvoicesView] error', err);
        statusBox.textContent = 'Error cargando facturas.';
        statusBox.className = 'alert error';
        statusBox.style.display = 'block';
      }
    }
  
    // Listeners de filtros
    selectStatus.addEventListener('change', () => {
      currentStatus = selectStatus.value;
      exportBtn.href = currentStatus !== 'all'
        ? `/admin/exports/invoices.csv?status=${currentStatus}`
        : '/admin/exports/invoices.csv';
      reload();
    });
  
    inputSearch.addEventListener('input', () => {
      currentSearch = inputSearch.value.trim();
      // un pequeño debounce no vendría mal, pero para MVP vale así
      reload();
    });
  
    // Primera carga
    reload();
  }
  
  // Hacemos la función accesible desde otros scripts
window.renderInvoicesView = renderInvoicesView;
