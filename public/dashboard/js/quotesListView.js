// public/dashboard/js/quotesListView.js

function renderQuotesListView(container) {
  container.innerHTML = "";

  // SCRUM-432 (B1 · incremento 3): `Historial · Plantillas`. La tira va ANTES de la tarjeta, que es
  // donde el diseño la coloca: pertenece a Presupuestos, no al historial.
  renderPestanasPresupuestos(container, "quotes-list");

  const card = document.createElement("div");
  card.className = "data-card";
  container.appendChild(card);

  // ── Cabecera: título + conteo + acciones ────────────────────
  const header = document.createElement("div");
  header.className = "data-card-header";
  card.appendChild(header);

  const left = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = "Historial de presupuestos";
  title.style.cssText = "margin:0;font-size:18px";

  const subtitle = document.createElement("p");
  subtitle.id = "quotes-count";
  subtitle.textContent = "Cargando…";
  subtitle.style.cssText = "margin:2px 0 0;font-size:13px;color:var(--muted)";

  left.appendChild(title);
  left.appendChild(subtitle);
  header.appendChild(left);

  const headerActions = document.createElement("div");
  headerActions.style.cssText = "display:flex;align-items:center;gap:8px";

  const exportQBtn = document.createElement("a");
  exportQBtn.href = "/admin/exports/quotes.csv";
  exportQBtn.className = "btn-secondary btn-sm";
  exportQBtn.innerHTML = "⬇ CSV";
  exportQBtn.title = "Exportar presupuestos a CSV";

  const createBtn = document.createElement("button");
  createBtn.className = "btn-primary";
  // SCRUM-599 · rótulo APROBADO y la tecla al final. El texto sale de la pieza, no se escribe
  // aquí: si se escribiera, cambiar el copy sería tocar tres ficheros y el tercero se quedaría.
  createBtn.textContent = "Nuevo presupuesto";
  if (window.atajoNuevo) {
    window.atajoNuevo.etiquetar(createBtn, "quotes-list");
    // Y el MISMO destino que el botón, para que la «N» no pueda abrir otra cosa que el botón.
    window.atajoNuevo.registrar("quotes-list", () => createBtn.click());
  }

  headerActions.appendChild(exportQBtn);
  headerActions.appendChild(createBtn);
  header.appendChild(headerActions);

  // ── Toolbar: búsqueda + filtros ─────────────────────────────
  const toolbar = document.createElement("div");
  toolbar.className = "data-card-toolbar";
  card.appendChild(toolbar);

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "input";
  searchInput.placeholder = "Buscar por cliente, ID o teléfono…";
  searchInput.style.cssText = "min-width:160px;flex:1";

  const statusSel = document.createElement("select");
  statusSel.className = "input";
  statusSel.style.cssText = "width:auto";
  statusSel.innerHTML = `
    <option value="all">Todos los estados</option>
    <option value="pending_approval">Pendiente de aprobación</option>
    <option value="draft">Borrador</option>
    <option value="sent">Enviado</option>
    <option value="accepted">Aceptado</option>
    <option value="rejected">Rechazado</option>
    <option value="expired">Caducado</option>
  `;

  const qFromInput = document.createElement("input");
  qFromInput.type = "date";
  qFromInput.className = "input";
  qFromInput.style.cssText = "width:140px";
  qFromInput.title = "Desde";

  const qToInput = document.createElement("input");
  qToInput.type = "date";
  qToInput.className = "input";
  qToInput.style.cssText = "width:140px";
  qToInput.title = "Hasta";

  toolbar.appendChild(searchInput);
  toolbar.appendChild(statusSel);
  toolbar.appendChild(qFromInput);
  toolbar.appendChild(qToInput);

  // ── Tabla (edge-to-edge dentro de la misma card) ────────────
  const tableScroll = document.createElement("div");
  tableScroll.className = "table-scroll";
  card.appendChild(tableScroll);

  const table = document.createElement("table");
  table.className = "table table--cards-mobile"; // A18.1: cards en móvil (AB4)
  tableScroll.appendChild(table);

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>ID</th>
      <th>Cliente</th>
      <th>Fecha</th>
      <th style="text-align:right">Importe</th>
      <th>Estado</th>
      <th class="col-hide-mobile">Método</th>
      <th>Acciones</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  table.appendChild(tbody);

  // Banner solo para errores (el conteo vive en la cabecera)
  const statusBox = document.createElement("div");
  statusBox.className = "alert error";
  statusBox.style.cssText = "margin:12px 0 0;display:none";
  container.appendChild(statusBox);

  function setError(msg) {
    if (!msg) { statusBox.style.display = "none"; return; }
    statusBox.textContent = msg;
    statusBox.style.display = "block";
  }

  function setCount(text) {
    subtitle.textContent = text;
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

  // P-A66-3: delega en el formateador es-ES compartido (api.js)
  function formatMoney(amount, currency) {
    return fmtMoneyEs(amount, currency || (window.appLocale && window.appLocale.currency) || "EUR");
  }

  function buildStatusPill(status) {
    const st = String(status || "").toLowerCase();
    const pill = document.createElement("span");
    pill.className = "status-pill";

    if (st === "pending_approval") {
      pill.textContent = "PENDIENTE APROBACIÓN";
      pill.classList.add("status-pill-approval");
      return pill;
    }

    pill.textContent = st === "expired" ? "CADUCADO" : st.toUpperCase(); // A16.2
    if (st === "accepted") pill.classList.add("status-pill-accepted");
    else if (st === "rejected") pill.classList.add("status-pill-rejected");
    else if (st === "draft" || st === "expired") pill.classList.add("status-pill-draft");
    else pill.classList.add("status-pill-pending");

    return pill;
  }

  function renderRows(list) {
    tbody.innerHTML = "";

    if (!list || list.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 7;
      const L = window.appLocale || {};
      td.innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">📋</div>' +
        '<div class="empty-state-title">Envía tu primer ' + (L.quoteVerb || "presupuesto") + ' y consigue más trabajos</div>' +
        '<div class="empty-state-desc">La mayoría de clientes responden en menos de 2 horas cuando lo reciben por WhatsApp. Crea uno en 30 segundos.</div>' +
        '<button id="quotes-empty-cta" class="btn-primary btn-sm" style="margin-top:14px">🚀 Crear mi primer ' + (L.quoteVerb || "presupuesto") + '</button></div>';
      tr.appendChild(td);
      tbody.appendChild(tr);
      const cta = td.querySelector("#quotes-empty-cta");
      if (cta) cta.addEventListener("click", () => {
        if (typeof openQuickQuoteModal === "function") openQuickQuoteModal();
      });
      return;
    }

    list.forEach((q) => {
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";

      // A1.2: número por merchant (q.number); el id global ya no se muestra
      const tdId = document.createElement("td");
      tdId.className = "cell-id";
      tdId.innerHTML = `#${q.number ?? q.id}${q.internalNotes ? ' <span title="Tiene notas internas" style="color:var(--neutral-400);font-size:11px">📝</span>' : ""}`;

      const tdClient = document.createElement("td");
      tdClient.className = "cell-client";
      tdClient.textContent =
        q.customerName || (q.customerPhone ? `(${q.customerPhone})` : "Cliente sin nombre");

      const tdDate = document.createElement("td");
      tdDate.className = "cell-date";
      tdDate.textContent = formatDate(q.createdAt);
      tdDate.style.color = "var(--muted)";

      const tdAmount = document.createElement("td");
      tdAmount.className = "amount cell-amount";
      tdAmount.style.textAlign = "right";
      tdAmount.textContent = formatMoney(q.totalAmount, q.currency);

      const tdStatus = document.createElement("td");
      tdStatus.className = "cell-status";
      tdStatus.appendChild(buildStatusPill(q.status));

      const tdMethod = document.createElement("td");
      tdMethod.className = "col-hide-mobile";
      tdMethod.style.color = "var(--muted)";
      tdMethod.textContent =
        q.method === "bank" ? "Pay-by-bank" : q.method === "card" ? "Tarjeta" : "—";

      const tdActions = document.createElement("td");
      tdActions.className = "cell-actions";
      const tdActionsDiv = document.createElement("div");
      tdActionsDiv.style.cssText = "display:flex;gap:6px;align-items:center";

      const openDetail = () => {
        const titleEl = document.getElementById("view-title");
        if (titleEl) titleEl.textContent = `Presupuesto #${q.number ?? q.id}`;
        const containerEl = document.getElementById("view-container");
        if (typeof renderQuoteDetailView === "function") {
          renderQuoteDetailView(containerEl, q.id);
        }
      };

      const btnView = document.createElement("button");
      btnView.textContent = "Ver detalle";
      btnView.className = "btn-secondary btn-sm";
      btnView.addEventListener("click", (e) => { e.stopPropagation(); openDetail(); });
      tdActionsDiv.appendChild(btnView);

      // ENT-2: aprobar (admins, pendientes)
      if (String(q.status).toLowerCase() === "pending_approval" && (window.appUserRole || "admin") === "admin") {
        const btnApprove = document.createElement("button");
        btnApprove.textContent = "✓ Aprobar";
        btnApprove.className = "btn-primary btn-sm";
        btnApprove.addEventListener("click", async (e) => {
          e.stopPropagation();
          btnApprove.disabled = true;
          btnApprove.textContent = "Aprobando…";
          try {
            await apiRequest(`/admin/quotes/${q.id}/approve`, { method: "POST" });
            loadQuotes();
          } catch (err) {
            btnApprove.disabled = false;
            btnApprove.textContent = "✓ Aprobar";
            setError("No se pudo aprobar la cotización.");
          }
        });
        tdActionsDiv.appendChild(btnApprove);
      }

      tdActions.appendChild(tdActionsDiv);

      // Fila clicable → detalle
      tr.addEventListener("click", openDetail);

      tr.appendChild(tdId);
      tr.appendChild(tdClient);
      tr.appendChild(tdDate);
      tr.appendChild(tdAmount);
      tr.appendChild(tdStatus);
      tr.appendChild(tdMethod);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  }

  let currentSearch = "";
  let currentStatus = "all";
  let currentDateFrom = "";
  let currentDateTo = "";

  function updateQuoteExportHref() {
    const params = new URLSearchParams();
    if (currentStatus !== "all") params.set("status", currentStatus);
    if (currentDateFrom) params.set("from", currentDateFrom);
    if (currentDateTo) params.set("to", currentDateTo);
    exportQBtn.href = "/admin/exports/quotes.csv" + (params.toString() ? "?" + params.toString() : "");
  }

  async function loadQuotes() {
    try {
      setError("");
      setCount("Cargando…");
      uiSkeletonRows(tbody, 7, 6);
      const params = new URLSearchParams();
      if (currentSearch) params.set("search", currentSearch);
      if (currentStatus !== "all") params.set("status", currentStatus);
      if (currentDateFrom) params.set("dateFrom", currentDateFrom);
      if (currentDateTo) params.set("dateTo", currentDateTo);
      const list = await apiRequest("/admin/quotes" + (params.toString() ? "?" + params.toString() : ""));
      renderRows(list);
      setCount(`${list.length} presupuesto${list.length !== 1 ? "s" : ""}`);
    } catch (err) {
      console.error(err);
      renderRows([]);
      setCount("");
      setError("Error cargando presupuestos.");
    }
  }

  loadQuotes();

  let searchTimeout = null;
  searchInput.addEventListener("input", () => {
    currentSearch = searchInput.value;
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadQuotes, 300);
  });
  statusSel.addEventListener("change", () => { currentStatus = statusSel.value; updateQuoteExportHref(); loadQuotes(); });
  qFromInput.addEventListener("change", () => { currentDateFrom = qFromInput.value; updateQuoteExportHref(); loadQuotes(); });
  qToInput.addEventListener("change", () => { currentDateTo = qToInput.value; updateQuoteExportHref(); loadQuotes(); });

  // 🔴 SCRUM-599 · EL CAMINO IBA POR EL SUBMENÚ, Y EL SUBMENÚ SE RETIRA EN ESTE MISMO COMMIT.
  //
  // Esto hacía `querySelector('.nav-item[data-view="quotes-new"]').click()`: el botón primario de
  // la lista no navegaba, PULSABA EL SUBÍTEM DEL MENÚ. Al quitar el submenú, `menuBtn` es `null`,
  // el `if` se lo traga y el botón se queda INERTE — la creación de presupuesto sin ningún camino
  // desde su propia lista, en silencio y sin un error en consola.
  //
  // Lo cazó el censo de caminos que este ticket exige hacer ANTES y DESPUÉS. Ahora navega al
  // destino directamente, que es como lo hacen las otras cinco puertas a `quotes-new`
  // (`customerDetailView`, `invoicesView`, `quoteRequestsView`, `templatesView` y
  // `quotesDetailView`): una sola forma de llegar, y no una que dependa de que exista un botón
  // en otra parte de la pantalla.
  createBtn.addEventListener("click", () => {
    if (window.renderAppView) window.renderAppView("quotes-new");
  });
}
