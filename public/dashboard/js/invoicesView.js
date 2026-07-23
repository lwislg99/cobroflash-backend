// public/dashboard/js/invoicesView.js

async function fetchInvoices(options = {}) {
    const { status = 'all', search = '', dateFrom = '', dateTo = '' } = options;

    const url = new URL('/admin/invoices', window.location.origin);
    if (status && status !== 'all') url.searchParams.set('status', status);
    if (search)   url.searchParams.set('search', search);
    if (dateFrom) url.searchParams.set('dateFrom', dateFrom);
    if (dateTo)   url.searchParams.set('dateTo', dateTo);

    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Error cargando facturas');
    return res.json();
  }

  // SCRUM-69 (FACT-1): bandeja "pendientes de facturar" — albaranes firmados y valorados sin
  // facturar, agrupados por cliente→mes, con semáforo de plazo legal (art. 13 RD 1619/2012).
  async function fetchPendientesFacturar() {
    const res = await fetch('/admin/albaranes/pendientes-facturar', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Error cargando pendientes de facturar');
    const data = await res.json();
    return data.clientes || [];
  }

  function fmtFechaEs(isoDate) {
    if (!isoDate) return '—';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  }

  const SEMAFORO_META = {
    verde: { pillClass: 'status-pill-accepted', label: 'AL DÍA' },
    ambar: { pillClass: 'status-pill-pending',  label: 'PLAZO PRÓXIMO' },
    rojo:  { pillClass: 'status-pill-rejected', label: 'PLAZO VENCIDO' },
  };

  // Copy aprobado por el fundador (23-jul, docs/Sprint Scrum/SESION_ACTUAL_SCRUM-69.md) — NO reformular.
  function copyRojo(mesLabel) {
    return `El plazo de este mes venció — ya no se puede agrupar en una recapitulativa de `
      + `${mesLabel}. Puedes facturar estos partes igualmente (factura individual o `
      + `recapitulativa del mes en curso); si tienes dudas, consúltalo con tu asesor.`;
  }

  async function renderInvoicesView(container) {
    container.innerHTML = '';

    // Card principal
    const wrapper = document.createElement('div');
    wrapper.className = 'data-card';
    container.appendChild(wrapper);

    // Cabecera: título + conteo + acciones
    const header = document.createElement('div');
    header.className = 'data-card-header';
    wrapper.appendChild(header);

    const left = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'Facturas';
    title.style.cssText = 'margin:0;font-size:18px';
    left.appendChild(title);
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Cargando…';
    subtitle.style.cssText = 'margin:2px 0 0;font-size:13px;color:var(--muted)';
    left.appendChild(subtitle);
    header.appendChild(left);

    const exportBtn = document.createElement('a');
    exportBtn.className = 'btn-secondary btn-sm';
    exportBtn.innerHTML = '⬇ CSV';
    exportBtn.title = 'Exportar facturas filtradas a CSV';
    exportBtn.href = '/admin/exports/invoices.csv';
    header.appendChild(exportBtn);

    // SCRUM-69: pestañas "Emitidas" (default, contenido existente intacto) / "Pendientes"
    // (nueva). Componente NUEVO — no hay tabs hoy en el inventario AB3; se propone al máster.
    const tabs = document.createElement('div');
    tabs.className = 'data-card-tabs';
    tabs.innerHTML = `
      <button type="button" class="data-card-tab active" data-tab="emitidas">Emitidas</button>
      <button type="button" class="data-card-tab" data-tab="pendientes">Pendientes<span class="badge badge-amber" id="pend-badge" hidden></span></button>
    `;
    wrapper.appendChild(tabs);
    const tabEmitidas = tabs.querySelector('[data-tab="emitidas"]');
    const tabPendientes = tabs.querySelector('[data-tab="pendientes"]');
    const pendBadge = tabs.querySelector('#pend-badge');

    // Panel "Emitidas": todo el contenido existente, sin cambios de comportamiento.
    const panelEmitidas = document.createElement('div');
    wrapper.appendChild(panelEmitidas);

    // Panel "Pendientes": nuevo, oculto por defecto.
    const panelPendientes = document.createElement('div');
    panelPendientes.style.display = 'none';
    wrapper.appendChild(panelPendientes);

    function activateTab(name) {
      const isEmitidas = name === 'emitidas';
      tabEmitidas.classList.toggle('active', isEmitidas);
      tabPendientes.classList.toggle('active', !isEmitidas);
      panelEmitidas.style.display = isEmitidas ? '' : 'none';
      panelPendientes.style.display = isEmitidas ? 'none' : '';
      exportBtn.style.display = isEmitidas ? '' : 'none'; // CSV solo aplica a Emitidas
      if (!isEmitidas && !pendientesLoaded) reloadPendientes();
    }
    tabEmitidas.addEventListener('click', () => activateTab('emitidas'));
    tabPendientes.addEventListener('click', () => activateTab('pendientes'));

    // Toolbar: filtros
    const toolbar = document.createElement('div');
    toolbar.className = 'data-card-toolbar';
    panelEmitidas.appendChild(toolbar);

    const inputSearch = document.createElement('input');
    inputSearch.className = 'input';
    inputSearch.placeholder = 'Buscar por nº, cliente…';
    inputSearch.style.cssText = 'min-width:160px;flex:1';
    toolbar.appendChild(inputSearch);

    const selectStatus = document.createElement('select');
    selectStatus.className = 'input';
    selectStatus.style.cssText = 'width:auto';
    selectStatus.innerHTML = `
      <option value="all">Todos los estados</option>
      <option value="pending">Pendientes</option>
      <option value="paid">Pagadas</option>
      <option value="expired">Vencidas</option>
    `;
    toolbar.appendChild(selectStatus);

    const inputFrom = document.createElement('input');
    inputFrom.type = 'date';
    inputFrom.className = 'input';
    inputFrom.style.cssText = 'width:140px';
    inputFrom.title = 'Desde';
    toolbar.appendChild(inputFrom);

    const inputTo = document.createElement('input');
    inputTo.type = 'date';
    inputTo.className = 'input';
    inputTo.style.cssText = 'width:140px';
    inputTo.title = 'Hasta';
    toolbar.appendChild(inputTo);

    // Banner solo para errores/éxito de acciones (el conteo vive en la cabecera)
    const statusBox = document.createElement('div');
    statusBox.className = 'alert';
    statusBox.style.cssText = 'margin:12px 16px 0;display:none';
    panelEmitidas.appendChild(statusBox);

    function setCount(text) { subtitle.textContent = text; }

    const tableScroll = document.createElement('div');
    tableScroll.className = 'table-scroll';
    panelEmitidas.appendChild(tableScroll);
    const table = document.createElement('table');
    table.className = 'table table--cards-mobile'; // feedback fundador 6-jul: cards en móvil
    tableScroll.appendChild(table);

    // Checkbox "seleccionar todo" en cabecera
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th style="width:36px" class="col-hide-mobile"><input type="checkbox" id="inv-check-all" title="Seleccionar todas"/></th>
        <th>Nº factura</th>
        <th>Cliente</th>
        <th style="text-align:right">Total</th>
        <th>Estado</th>
        <th class="col-hide-mobile">Fecha</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    // Barra de acciones bulk (flotante, aparece cuando hay seleccionadas)
    const bulkBar = document.createElement('div');
    bulkBar.style.cssText = [
      'display:none;position:sticky;bottom:16px;z-index:50;',
      'background:var(--neutral-900);color:#fff;border-radius:var(--radius-md);',
      'padding:10px 16px;display:none;align-items:center;gap:12px;',
      'box-shadow:var(--shadow-lg);margin:8px 16px;',
    ].join('');
    bulkBar.innerHTML = `
      <span id="bulk-count" style="font-size:13.5px;font-weight:600"></span>
      <button id="bulk-paid-btn" class="btn-primary btn-sm">✓ Marcar como pagadas</button>
      <button id="bulk-cancel-btn" class="btn-ghost btn-sm" style="color:rgba(255,255,255,.7)">Cancelar</button>
    `;
    panelEmitidas.appendChild(bulkBar);

    let currentStatus = 'all';
    let currentSearch = '';
    let currentDateFrom = '';
    let currentDateTo   = '';
    let selectedIds = new Set();
    let pendientesLoaded = false;

    // P-A66-3: delega en el formateador es-ES compartido (api.js)
    function fmtInvMoney(amount, currency) {
      return fmtMoneyEs(amount, currency || (window.appLocale && window.appLocale.currency) || 'EUR');
    }

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
        await reload();
        statusBox.textContent = '✓ ' + data.updated + ' factura' + (data.updated !== 1 ? 's' : '') + ' marcada' + (data.updated !== 1 ? 's' : '') + ' como pagadas.';
        statusBox.className = 'alert success';
        statusBox.style.display = 'block';
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
      setCount('Cargando…');
      statusBox.style.display = 'none';
      uiSkeletonRows(tbody, 6, 6);

      try {
        const invoices = await fetchInvoices({ status: currentStatus, search: currentSearch, dateFrom: currentDateFrom, dateTo: currentDateTo });
        tbody.innerHTML = '';
        selectedIds.clear();
        updateBulkBar();

        if (!invoices || invoices.length === 0) {
          // A6.5: estado vacío digno (mismo patrón que Productos/Clientes)
          const filtering = currentSearch || currentStatus !== 'all' || currentDateFrom || currentDateTo;
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = 6;
          td.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🧾</div>'
            + '<div class="empty-state-title">' + (filtering ? 'Nada con estos filtros' : 'Aquí verás tus cobros') + '</div>'
            + '<div class="empty-state-desc">' + (filtering
              ? 'Prueba con otra búsqueda o limpia los filtros.'
              : 'Cuando un cliente acepte un presupuesto, el documento de cobro se genera solo y aparece aquí.') + '</div>'
            + (filtering ? '' : '<button id="inv-empty-cta" class="btn-primary btn-sm" style="margin-top:14px">Crear un presupuesto</button>')
            + '</div>';
          tr.appendChild(td);
          tbody.appendChild(tr);
          td.querySelector('#inv-empty-cta')?.addEventListener('click', () => {
            if (window.renderAppView) renderAppView('quotes-new');
          });
          setCount('0 facturas');
          return;
        }

        setCount(invoices.length + ' factura' + (invoices.length !== 1 ? 's' : ''));

        // A18.2 (AB4): lo PENDIENTE de cobrar primero — y dentro de pendiente,
        // lo más antiguo arriba (es lo que hay que perseguir hoy).
        const sorted = [...invoices].sort((a, b) => {
          const ap = String(a.status).toLowerCase() === 'pending' ? 0 : 1;
          const bp = String(b.status).toLowerCase() === 'pending' ? 0 : 1;
          if (ap !== bp) return ap - bp;
          const ad = new Date(a.createdAt).getTime(), bd = new Date(b.createdAt).getTime();
          return ap === 0 ? ad - bd : bd - ad;
        });

        sorted.forEach((inv) => {
          const tr = document.createElement('tr');
          const st = String(inv.status || '').toLowerCase();

          // Checkbox
          const tdCheck = document.createElement('td');
          tdCheck.className = 'col-hide-mobile'; // bulk = flujo de escritorio
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
          tdNumber.className = 'cell-id';
          tdNumber.style.fontWeight = '600';
          tdNumber.textContent = inv.number;
          // A18.2: antigüedad VISIBLE en pendientes (también en móvil) —
          // ámbar >7 días, rojo >30 (mismo lenguaje que el aging de Informes)
          if (st === 'pending' && inv.createdAt) {
            const days = Math.floor((Date.now() - new Date(inv.createdAt).getTime()) / 86400000);
            const age = document.createElement('div');
            age.style.cssText = 'font-size:11.5px;font-weight:600;margin-top:2px;color:' +
              (days > 30 ? 'var(--red-600)' : days > 7 ? '#b45309' : 'var(--muted)');
            age.textContent = days <= 0 ? 'hoy' : 'hace ' + days + ' día' + (days === 1 ? '' : 's');
            tdNumber.appendChild(age);
          }
          tr.appendChild(tdNumber);

          const tdCustomer = document.createElement('td');
          tdCustomer.className = 'cell-client';
          tdCustomer.textContent = (inv.customer && inv.customer.name) || '—';
          tr.appendChild(tdCustomer);

          const tdTotal = document.createElement('td');
          tdTotal.className = 'amount cell-amount';
          tdTotal.style.textAlign = 'right';
          tdTotal.textContent = fmtInvMoney(inv.total, inv.currency);
          tr.appendChild(tdTotal);

          const tdStatus = document.createElement('td');
          tdStatus.className = 'cell-status';
          const span = document.createElement('span');
          span.className = 'status-pill' +
            (st === 'paid' ? ' status-pill-accepted' : st === 'expired' ? ' status-pill-rejected' : ' status-pill-pending');
          span.textContent = st === 'paid' ? 'PAGADA' : st === 'expired' ? 'VENCIDA' : 'PENDIENTE';
          tdStatus.appendChild(span);
          tr.appendChild(tdStatus);

          const tdDate = document.createElement('td');
          tdDate.className = 'col-hide-mobile';
          tdDate.style.color = 'var(--muted)';
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

    // ── Panel "Pendientes" (SCRUM-69) ──────────────────────────────────────
    const pendStatusBox = document.createElement('div');
    pendStatusBox.className = 'alert';
    pendStatusBox.style.cssText = 'margin:16px 20px 0;display:none';
    panelPendientes.appendChild(pendStatusBox);

    const pendBody = document.createElement('div');
    pendBody.className = 'data-card-body';
    panelPendientes.appendChild(pendBody);

    function renderGrupoCard(customer, grupo) {
      const meta = SEMAFORO_META[grupo.semaforo] || SEMAFORO_META.verde;
      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid var(--neutral-200);border-radius:var(--radius-lg);'
        + 'padding:16px;margin-bottom:12px;background:#fff';

      const rowTop = document.createElement('div');
      rowTop.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap';

      const leftCol = document.createElement('div');
      const custName = document.createElement('div');
      custName.style.cssText = 'font-weight:700;font-size:14.5px;color:var(--neutral-900)';
      custName.textContent = customer.customerName;
      leftCol.appendChild(custName);
      const mesLine = document.createElement('div');
      mesLine.style.cssText = 'font-size:13px;color:var(--neutral-500);margin-top:2px;text-transform:capitalize';
      mesLine.textContent = grupo.mesLabel + ' · ' + grupo.albaranes.length + ' parte' + (grupo.albaranes.length !== 1 ? 's' : '');
      leftCol.appendChild(mesLine);
      rowTop.appendChild(leftCol);

      const rightCol = document.createElement('div');
      rightCol.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:4px';
      const pill = document.createElement('span');
      pill.className = 'status-pill ' + meta.pillClass;
      pill.textContent = meta.label;
      rightCol.appendChild(pill);
      const fechaLine = document.createElement('div');
      fechaLine.style.cssText = 'font-size:12px;color:var(--neutral-500)';
      fechaLine.textContent = 'Plazo: ' + fmtFechaEs(grupo.fechaLimite);
      rightCol.appendChild(fechaLine);
      rowTop.appendChild(rightCol);

      card.appendChild(rowTop);

      const importeLine = document.createElement('div');
      importeLine.style.cssText = 'margin-top:10px;font-size:13.5px;color:var(--neutral-700)';
      importeLine.innerHTML = '<strong>' + fmtMoneyEs(grupo.importePotencial.total, (window.appLocale && window.appLocale.currency) || 'EUR')
        + '</strong> pendiente de facturar';
      card.appendChild(importeLine);

      if (grupo.semaforo === 'rojo') {
        const warnBox = document.createElement('div');
        warnBox.style.cssText = 'margin-top:10px;padding:10px 12px;border-radius:var(--radius-md);'
          + 'background:var(--red-50);color:var(--red-600);font-size:12.5px;line-height:1.5';
        warnBox.textContent = copyRojo(grupo.mesLabel);
        card.appendChild(warnBox);
      }

      const actions = document.createElement('div');
      actions.style.cssText = 'margin-top:12px';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-secondary btn-sm';
      btn.textContent = 'Consolidar en factura →';
      btn.addEventListener('click', () => {
        if (window.renderAppView) window.renderAppView('jobs-detail', { jobId: grupo.jobId });
      });
      actions.appendChild(btn);
      card.appendChild(actions);

      return card;
    }

    async function reloadPendientes() {
      pendBody.innerHTML = '';
      pendStatusBox.style.display = 'none';
      const loading = document.createElement('p');
      loading.style.cssText = 'color:var(--muted);font-size:13.5px';
      loading.textContent = 'Cargando…';
      pendBody.appendChild(loading);

      try {
        const clientes = await fetchPendientesFacturar();
        pendientesLoaded = true;
        pendBody.innerHTML = '';

        let ambarRojoCount = 0;
        clientes.forEach((c) => c.grupos.forEach((g) => { if (g.semaforo !== 'verde') ambarRojoCount++; }));
        if (ambarRojoCount > 0) {
          pendBadge.hidden = false;
          pendBadge.textContent = String(ambarRojoCount);
        } else {
          pendBadge.hidden = true;
        }

        const totalGrupos = clientes.reduce((n, c) => n + c.grupos.length, 0);
        if (totalGrupos === 0) {
          pendBody.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🧾</div>'
            + '<div class="empty-state-title">Nada pendiente de facturar</div>'
            + '<div class="empty-state-desc">Cuando firmes partes de trabajo sin facturar, aparecerán aquí agrupados por cliente y mes.</div>'
            + '</div>';
          return;
        }

        // Rojo primero, luego ámbar, luego verde — lo urgente arriba (mismo criterio A18.2).
        const orden = { rojo: 0, ambar: 1, verde: 2 };
        clientes.forEach((customer) => {
          const gruposOrdenados = [...customer.grupos].sort((a, b) => orden[a.semaforo] - orden[b.semaforo]);
          gruposOrdenados.forEach((grupo) => {
            pendBody.appendChild(renderGrupoCard(customer, grupo));
          });
        });
      } catch (err) {
        console.error('[renderInvoicesView] pendientes error', err);
        pendBody.innerHTML = '';
        pendStatusBox.textContent = 'Error cargando pendientes de facturar.';
        pendStatusBox.className = 'alert error';
        pendStatusBox.style.display = 'block';
      }
    }

    // Listeners de filtros
    function updateExportHref() {
      const params = new URLSearchParams();
      if (currentStatus !== 'all') params.set('status', currentStatus);
      if (currentDateFrom) params.set('from', currentDateFrom);
      if (currentDateTo)   params.set('to',   currentDateTo);
      exportBtn.href = '/admin/exports/invoices.csv' + (params.toString() ? '?' + params.toString() : '');
    }

    selectStatus.addEventListener('change', () => {
      currentStatus = selectStatus.value;
      updateExportHref();
      reload();
    });

    inputFrom.addEventListener('change', () => { currentDateFrom = inputFrom.value; updateExportHref(); reload(); });
    inputTo.addEventListener('change',   () => { currentDateTo   = inputTo.value;   updateExportHref(); reload(); });

    let searchTimer = null;
    inputSearch.addEventListener('input', () => {
      currentSearch = inputSearch.value.trim();
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(reload, 300);
    });

    // Primera carga
    reload();
    // Badge de "Pendientes" visible desde el primer render, sin esperar a que el usuario
    // pulse la pestaña (decisión fundador: la urgencia se ve sin rehacer la expectativa).
    reloadPendientes();
  }

  // Hacemos la función accesible desde otros scripts
window.renderInvoicesView = renderInvoicesView;
