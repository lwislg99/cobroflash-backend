// public/dashboard/js/quotesListView.js

function renderQuotesListView(container) {
  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "data-card";
  container.appendChild(wrapper);

  // Header
  const header = document.createElement("div");
  header.className = "data-card-header";
  wrapper.appendChild(header);

  const left = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = "Historial de presupuestos";
  title.style.margin = "0 0 4px 0";

  const subtitle = document.createElement("p");
  subtitle.textContent =
    "Consulta todos los presupuestos enviados, su estado y gestiona decisiones.";
  subtitle.style.margin = "0";
  subtitle.style.fontSize = "13px";
  subtitle.style.color = "#6b7280";

  left.appendChild(title);
  left.appendChild(subtitle);
  header.appendChild(left);

  const right = document.createElement("div");
  right.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:8px";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Buscar por cliente, ID o teléfono…";
  searchInput.style.cssText = "min-width:140px;flex:1";

  // Filtros de estado
  const statusSel = document.createElement("select");
  statusSel.className = "input";
  statusSel.style.cssText = "min-width:0;width:auto";
  statusSel.innerHTML = `
    <option value="all">Todos</option>
    <option value="draft">Borrador</option>
    <option value="sent">Enviado</option>
    <option value="accepted">Aceptado</option>
    <option value="rejected">Rechazado</option>
  `;

  const qFromInput = document.createElement("input");
  qFromInput.type = "date";
  qFromInput.className = "input";
  qFromInput.style.cssText = "min-width:0;width:130px";
  qFromInput.title = "Desde";

  const qToInput = document.createElement("input");
  qToInput.type = "date";
  qToInput.className = "input";
  qToInput.style.cssText = "min-width:0;width:130px";
  qToInput.title = "Hasta";

  const createBtn = document.createElement("button");
  createBtn.className = "btn btn-primary";
  createBtn.textContent = "+ Crear presupuesto";

  const exportQBtn = document.createElement('a');
  exportQBtn.href = '/admin/exports/quotes.csv';
  exportQBtn.className = 'btn-secondary btn-sm';
  exportQBtn.style.textDecoration = 'none';
  exportQBtn.innerHTML = '⬇ CSV';
  exportQBtn.title = 'Exportar presupuestos a CSV';

  right.appendChild(searchInput);
  right.appendChild(statusSel);
  right.appendChild(qFromInput);
  right.appendChild(qToInput);
  right.appendChild(exportQBtn);
  right.appendChild(createBtn);
  header.appendChild(right);

  // Tabla en card separado, fuera del wrapper de búsqueda
  const tableWrapper = document.createElement("div");
  tableWrapper.className = "data-card";
  tableWrapper.style.marginTop = "12px";
  container.appendChild(tableWrapper);

  const tableScroll = document.createElement("div");
  tableScroll.className = "table-scroll";
  tableWrapper.appendChild(tableScroll);

  const table = document.createElement("table");
  table.className = "table";
  tableScroll.appendChild(table);

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>ID</th>
      <th>Cliente</th>
      <th>Fecha</th>
      <th>Importe</th>
      <th>Estado</th>
      <th>Método</th>
      <th>Cobro</th>
      <th>Acciones</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  table.appendChild(tbody);

  const statusBox = document.createElement("div");
  statusBox.className = "alert";
  statusBox.style.cssText = "margin:8px 0;display:none";
  container.appendChild(statusBox);

  function setStatus(type, msg) {
    statusBox.textContent = msg || "";
    statusBox.className = "alert";
    if (type === "error") statusBox.classList.add("error");
    if (type === "success") statusBox.classList.add("success");
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatMoney(amount, currency) {
    const num = Number(amount) || 0;
    const cur = currency || "EUR";
    return `${num.toFixed(2)} ${cur}`;
  }

  // ========================
  // Estado → pill coloreado
  // ========================
  function buildStatusPill(status) {
    const st = String(status || "").toLowerCase();
    const pill = document.createElement("span");
    pill.className = "status-pill";
    pill.textContent = st.toUpperCase();

    if (st === "accepted") pill.classList.add("status-pill-accepted");
    else if (st === "rejected") pill.classList.add("status-pill-rejected");
    else if (st === "draft") pill.classList.add("status-pill-draft");
    else pill.classList.add("status-pill-pending");

    return pill;
  }

  // ==========================
  // Render filas
  // ==========================
  function renderRows(list) {
    tbody.innerHTML = "";

    if (!list || list.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 8;
      const L = window.appLocale || {};
      td.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Sin ' + (L.quotePlural||'presupuestos') + ' aún</div><div class="empty-state-desc">Crea tu primera cotización desde el botón "Nueva cotización rápida" en Inicio.</div></div>';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    list.forEach((q) => {
      const tr = document.createElement("tr");

      // ID + indicador notas
      const tdId = document.createElement("td");
      tdId.innerHTML = `${q.id}${q.internalNotes ? ' <span title="Tiene notas internas" style="color:#9ca3af;font-size:11px">📝</span>' : ''}`;

      // Nombre cliente
      const tdClient = document.createElement("td");
      tdClient.textContent =
        q.customerName ||
        (q.customerPhone ? `(${q.customerPhone})` : "Cliente sin nombre");

      // Fecha
      const tdDate = document.createElement("td");
      tdDate.textContent = formatDate(q.createdAt);

      // Total (del listado viene como totalAmount)
      const tdAmount = document.createElement("td");
      tdAmount.textContent = formatMoney(q.totalAmount, q.currency);

      // Estado
      const tdStatus = document.createElement("td");
      tdStatus.appendChild(buildStatusPill(q.status));

      // Método de pago
      const tdMethod = document.createElement("td");
      tdMethod.textContent =
        q.method === "bank"
          ? "Pay-by-bank"
          : q.method === "card"
          ? "Tarjeta"
          : "—";

      // Cobro
      const tdCharge = document.createElement("td");
      tdCharge.textContent = q.chargeId ? `#${q.chargeId}` : "—";

      // ACCIONES – Ver detalle
      const tdActions = document.createElement("td");
      tdActions.style.display = "flex";
      tdActions.style.gap = "6px";

      const btnView = document.createElement("button");
      btnView.textContent = "Ver detalle";
      btnView.className = "btn btn-secondary";
      btnView.style.padding = "3px 10px";

      btnView.addEventListener("click", () => {
        const containerEl = document.getElementById("view-container");
        const titleEl = document.getElementById("view-title");
        if (titleEl) {
          titleEl.textContent = `Presupuesto #${q.id}`;
        }

        if (typeof renderQuoteDetailView === "function") {
          renderQuoteDetailView(containerEl, q.id);
        } else {
          alert("Vista de detalle no disponible en este momento.");
        }
      });

      tdActions.appendChild(btnView);

      tr.appendChild(tdId);
      tr.appendChild(tdClient);
      tr.appendChild(tdDate);
      tr.appendChild(tdAmount);
      tr.appendChild(tdStatus);
      tr.appendChild(tdMethod);
      tr.appendChild(tdCharge);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  }

  let currentSearch   = "";
  let currentStatus   = "all";
  let currentDateFrom = "";
  let currentDateTo   = "";

  function updateQuoteExportHref() {
    const params = new URLSearchParams();
    if (currentStatus !== 'all') params.set('status', currentStatus);
    if (currentDateFrom) params.set('from', currentDateFrom);
    if (currentDateTo)   params.set('to',   currentDateTo);
    exportQBtn.href = '/admin/exports/quotes.csv' + (params.toString() ? '?' + params.toString() : '');
  }

  async function loadQuotes() {
    try {
      setStatus("", "Cargando presupuestos…");
      const params = new URLSearchParams();
      if (currentSearch)   params.set('search', currentSearch);
      if (currentStatus !== 'all') params.set('status', currentStatus);
      if (currentDateFrom) params.set('dateFrom', currentDateFrom);
      if (currentDateTo)   params.set('dateTo',   currentDateTo);
      const list = await apiRequest('/admin/quotes' + (params.toString() ? '?' + params.toString() : ''));
      renderRows(list);
      setStatus("success", `${list.length} presupuesto${list.length !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error(err);
      renderRows([]);
      setStatus("error", "Error cargando presupuestos.");
    }
  }

  loadQuotes();

  // Filtros
  let searchTimeout = null;
  searchInput.addEventListener("input", () => {
    currentSearch = searchInput.value;
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadQuotes, 300);
  });
  statusSel.addEventListener("change",   () => { currentStatus   = statusSel.value;   updateQuoteExportHref(); loadQuotes(); });
  qFromInput.addEventListener("change",  () => { currentDateFrom = qFromInput.value;  updateQuoteExportHref(); loadQuotes(); });
  qToInput.addEventListener("change",    () => { currentDateTo   = qToInput.value;    updateQuoteExportHref(); loadQuotes(); });

  // Botón crear presupuesto
  createBtn.addEventListener("click", () => {
    const menuBtn = document.querySelector('.nav-item[data-view="quotes-new"]');
    if (menuBtn) menuBtn.click();
  });
}
