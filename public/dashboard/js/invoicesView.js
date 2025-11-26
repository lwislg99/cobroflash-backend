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
  
    const wrapper = document.createElement('div');
    wrapper.className = 'customers-card';
    container.appendChild(wrapper);
  
    const header = document.createElement('div');
    header.className = 'customers-header';
    wrapper.appendChild(header);
  
    const left = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'Facturas';
    title.style.margin = '0 0 4px 0';
    left.appendChild(title);
  
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Listado de facturas emitidas.';
    subtitle.style.margin = '0';
    subtitle.style.fontSize = '13px';
    subtitle.style.color = '#6b7280';
    left.appendChild(subtitle);
  
    header.appendChild(left);
  
    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '8px';
  
    // Filtro de estado
    const selectStatus = document.createElement('select');
    selectStatus.className = 'input';
    selectStatus.innerHTML = `
      <option value="all">Todas</option>
      <option value="pending">Pendientes</option>
      <option value="paid">Pagadas</option>
      <option value="expired">Vencidas</option>
    `;
    right.appendChild(selectStatus);
  
    // Buscador
    const inputSearch = document.createElement('input');
    inputSearch.className = 'input';
    inputSearch.placeholder = 'Buscar por nº, cliente, email...';
    right.appendChild(inputSearch);
  
    header.appendChild(right);
  
    const statusBox = document.createElement('div');
    statusBox.className = 'alert';
    statusBox.style.marginTop = '8px';
    wrapper.appendChild(statusBox);
  
    const table = document.createElement('table');
    table.className = 'table';
    wrapper.appendChild(table);
  
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
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
  
    let currentStatus = 'all';
    let currentSearch = '';
  
    async function reload() {
      statusBox.textContent = 'Cargando facturas…';
      statusBox.className = 'alert';
  
      try {
        const invoices = await fetchInvoices({
          status: currentStatus,
          search: currentSearch,
        });
  
        tbody.innerHTML = '';
  
        if (!invoices || invoices.length === 0) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = 5;
          td.textContent = 'No hay facturas para estos filtros.';
          tr.appendChild(td);
          tbody.appendChild(tr);
  
          statusBox.textContent = '';
          return;
        }
  
        invoices.forEach((inv) => {
          const tr = document.createElement('tr');
  
          const tdNumber = document.createElement('td');
          tdNumber.textContent = inv.number;
          tr.appendChild(tdNumber);
  
          const tdCustomer = document.createElement('td');
          tdCustomer.textContent =
            (inv.customer && inv.customer.name) || '—';
          tr.appendChild(tdCustomer);
  
          const tdTotal = document.createElement('td');
          const total = Number(inv.total || 0);
          tdTotal.textContent = `${total.toFixed(2)} ${inv.currency}`;
          tr.appendChild(tdTotal);
  
          const tdStatus = document.createElement('td');
          const span = document.createElement('span');
          span.className = 'status-pill';
          span.textContent = String(inv.status || '').toUpperCase();
  
          const st = String(inv.status || '').toLowerCase();
          if (st === 'paid') span.classList.add('status-pill-accepted');
          else if (st === 'expired')
            span.classList.add('status-pill-rejected');
          else span.classList.add('status-pill-pending');
  
          tdStatus.appendChild(span);
          tr.appendChild(tdStatus);
  
          const tdDate = document.createElement('td');
          tdDate.textContent = inv.createdAt
            ? new Date(inv.createdAt).toLocaleString('es-ES')
            : '—';
          tr.appendChild(tdDate);
  
        // Hacer click en la fila => abrir detalle de factura
            tr.style.cursor = 'pointer';
            tr.addEventListener('click', () => {
            if (window.renderAppView) {
                window.renderAppView('invoice-detail', { invoiceId: inv.id });
                }
            });
          
            tbody.appendChild(tr);
          
        });
  
        statusBox.textContent = '';
      } catch (err) {
        console.error('[renderInvoicesView] error', err);
        statusBox.textContent = 'Error cargando facturas.';
        statusBox.className = 'alert error';
      }
    }
  
    // Listeners de filtros
    selectStatus.addEventListener('change', () => {
      currentStatus = selectStatus.value;
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
