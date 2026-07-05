// public/dashboard/js/customersView.js

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function createField(labelText, name, type = "text", required = false, isTextarea = false) {
  const wrapper = createElement("div", "field");
  const label = document.createElement("label");
  label.textContent = labelText;

  let input;
  if (isTextarea) {
    input = document.createElement("textarea");
    input.rows = 2;
  } else {
    input = document.createElement("input");
    input.type = type;
  }

  input.name = name;
  if (required) input.required = true;

  wrapper.appendChild(label);
  wrapper.appendChild(input);

  return { wrapper, input };
}

function renderCustomersView(container) {
  container.innerHTML = "";

  let editingCustomer = null;
  let fieldLegalName, fieldTaxId; // A20.4

  // Card principal
  const outerCard = createElement("div", "data-card");
  container.appendChild(outerCard);

  // Cabecera: título + conteo + acciones
  const header = createElement("div", "data-card-header");
  const headLeft = createElement("div");
  const title = createElement("h2", null, "Clientes");
  title.style.cssText = "margin:0;font-size:18px";
  const subtitle = createElement("p", null, "Cargando…");
  subtitle.style.cssText = "margin:2px 0 0;font-size:13px;color:var(--muted)";
  headLeft.appendChild(title);
  headLeft.appendChild(subtitle);
  header.appendChild(headLeft);

  const headActions = createElement("div");
  headActions.style.cssText = "display:flex;align-items:center;gap:8px";
  const importBtn = createElement("button", "btn-secondary btn-sm", "⬆ Importar CSV");
  importBtn.title = "Importar clientes desde un fichero CSV o Excel";
  importBtn.addEventListener("click", openImportCsvModal);
  const newBtn = createElement("button", "btn-primary btn-sm", "+ Nuevo cliente");
  headActions.appendChild(importBtn);
  headActions.appendChild(newBtn);
  header.appendChild(headActions);
  outerCard.appendChild(header);

  // Toolbar: búsqueda en vivo
  const toolbar = createElement("div", "data-card-toolbar");
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "input";
  searchInput.placeholder = "Buscar por nombre, teléfono o email…";
  searchInput.style.cssText = "min-width:160px;flex:1";
  toolbar.appendChild(searchInput);
  outerCard.appendChild(toolbar);

  function setCount(text) { subtitle.textContent = text; }

  // Tabla edge-to-edge dentro del data-card
  const tableScroll = createElement("div", "table-scroll");
  outerCard.appendChild(tableScroll);
  const table = createElement("table", "table");
  tableScroll.appendChild(table);
  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  [
    { t: "ID" },
    { t: "Nombre" },
    { t: "Teléfono" },
    { t: "Email", cls: "col-hide-mobile" },
    { t: "Notas", cls: "col-hide-mobile" },
    { t: "Alta", cls: "col-hide-mobile" },
    { t: "" },
  ].forEach(({ t, cls }) => {
    const th = document.createElement("th");
    th.textContent = t;
    if (cls) th.className = cls;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  outerCard.appendChild(table);

  // Alertas
  const alertBox = createElement("div", "alert");
  alertBox.style.display = "none";
  outerCard.appendChild(alertBox);

  function setAlert(type, msg) {
    alertBox.textContent = msg || "";
    alertBox.className = "alert";
    if (type === "success") alertBox.classList.add("success");
    if (type === "error") alertBox.classList.add("error");
    alertBox.style.display = (type || msg) ? "block" : "none";
  }

  // -------- Modal --------

  let modalBackdrop = null;
  let modalForm = null;
  let fieldName, fieldPhone, fieldEmail, fieldNotes;
  let fieldWaOptOut = null; // J3: baja manual de WhatsApp desde la ficha
  let modalTitleEl = null;
  let modalSaveBtn = null;

  function buildModal() {
    modalBackdrop = createElement("div", "modal-overlay");
    const modal = createElement("div", "modal");

    const header = createElement("div", "modal-header");
    modalTitleEl = createElement("div", "modal-title", "Nuevo cliente");
    const closeBtn = createElement("button", "modal-close", "×");
    closeBtn.type = "button";
    closeBtn.addEventListener("click", closeModal);
    header.appendChild(modalTitleEl);
    header.appendChild(closeBtn);

    modal.appendChild(header);

    modalForm = document.createElement("form");

    const body = createElement("div", "modal-body");
    fieldName = createField("Nombre", "name", "text", true);
    fieldPhone = createField("Teléfono (E.164 sin +)", "phone", "text");
    fieldEmail = createField("Email", "email", "email");
    // A20.4: cliente empresa (opcional) — el NIF además lo exigirá VeriFactu
    fieldLegalName = createField("Razón social (empresa, opcional)", "legalName", "text");
    fieldTaxId = createField("NIF/CIF (opcional)", "taxId", "text");
    fieldNotes = createField("Notas", "notes", null, false, true);

    body.appendChild(fieldName.wrapper);
    body.appendChild(fieldPhone.wrapper);
    body.appendChild(fieldEmail.wrapper);
    body.appendChild(fieldLegalName.wrapper);
    body.appendChild(fieldTaxId.wrapper);
    body.appendChild(fieldNotes.wrapper);

    // J3: baja manual de WhatsApp (hasta WA-0b el "BAJA" entrante no se procesa solo)
    const waWrapper = document.createElement("label");
    waWrapper.style.cssText = "display:flex;align-items:center;gap:8px;margin-top:4px;cursor:pointer;font-size:13px;color:var(--muted)";
    fieldWaOptOut = document.createElement("input");
    fieldWaOptOut.type = "checkbox";
    fieldWaOptOut.name = "waOptOut";
    waWrapper.appendChild(fieldWaOptOut);
    waWrapper.appendChild(document.createTextNode("Baja de WhatsApp: no enviarle más mensajes (el cliente lo pidió)"));
    body.appendChild(waWrapper);

    modalForm.appendChild(body);

    const footer = createElement("div", "modal-footer");
    const cancelBtn = createElement("button", "btn btn-secondary", "Cancelar");
    cancelBtn.type = "button";
    cancelBtn.addEventListener("click", closeModal);

    modalSaveBtn = createElement("button", "btn btn-primary", "Guardar");
    modalSaveBtn.type = "submit";

    footer.appendChild(cancelBtn);
    footer.appendChild(modalSaveBtn);

    modalForm.appendChild(footer);
    modal.appendChild(modalForm);
    modalBackdrop.appendChild(modal);

    document.body.appendChild(modalBackdrop);

    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) closeModal();
    });

    modalForm.addEventListener("submit", onModalSubmit);
  }

  function openModal(mode, customer) {
    if (!modalBackdrop) {
      buildModal();
    }

    editingCustomer = mode === "edit" ? customer : null;
    modalTitleEl.textContent = mode === "edit" ? "Editar cliente" : "Nuevo cliente";
    modalSaveBtn.textContent = mode === "edit" ? "Guardar cambios" : "Guardar";

    modalForm.reset();

    if (editingCustomer) {
      fieldName.input.value = editingCustomer.name || "";
      fieldPhone.input.value = editingCustomer.phone || "";
      fieldEmail.input.value = editingCustomer.email || "";
      fieldNotes.input.value = editingCustomer.notes || "";
      fieldLegalName.input.value = editingCustomer.legalName || ""; // A20.4
      fieldTaxId.input.value = editingCustomer.taxId || "";
      fieldWaOptOut.checked = !!editingCustomer.waOptOut;
    }

    modalBackdrop.style.display = "flex";
    fieldName.input.focus();
  }

  function closeModal() {
    if (modalBackdrop) {
      modalBackdrop.style.display = "none";
    }
    editingCustomer = null;
  }

  async function onModalSubmit(ev) {
    ev.preventDefault();
    setAlert(null, "");

    const payload = {
      name: fieldName.input.value.trim(),
      phone: fieldPhone.input.value.trim(),
      email: fieldEmail.input.value.trim(),
      notes: fieldNotes.input.value.trim(),
      legalName: fieldLegalName.input.value.trim() || null, // A20.4
      taxId: fieldTaxId.input.value.trim() || null,
      waOptOut: !!(fieldWaOptOut && fieldWaOptOut.checked), // J3
    };

    if (!payload.name) {
      setAlert("error", "El nombre es obligatorio.");
      fieldName.input.focus();
      return;
    }

    try {
      modalSaveBtn.disabled = true;
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, payload);
        setAlert("success", "Cliente actualizado correctamente.");
      } else {
        await createCustomer(payload);
        setAlert("success", "Cliente creado correctamente.");
      }
      closeModal();
      await loadCustomers(searchInput.value.trim());
    } catch (err) {
      setAlert("error", "Error guardando cliente: " + err.message);
    } finally {
      modalSaveBtn.disabled = false;
    }
  }

  // -------- Carga de clientes --------

  function openCustomer360(c) {
    if (window.renderAppView) {
      window.appState = window.appState || {};
      window.appState.customerId360 = c.id;
      window.renderAppView('customer-360');
    }
  }

  async function loadCustomers(searchText = "") {
    setAlert(null, "");
    setCount("Cargando…");
    uiSkeletonRows(tbody, 7, 6);
    try {
      const data = await getCustomers(searchText);
      tbody.innerHTML = "";

      if (!Array.isArray(data) || data.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 7;
        td.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div>'
          + '<div class="empty-state-title">' + (searchText ? 'Sin resultados para tu búsqueda' : 'Añade a tu primer cliente') + '</div>'
          + '<div class="empty-state-desc">' + (searchText ? 'Prueba con otro nombre, teléfono o email.' : 'Guárdalo una vez y podrás enviarle cotizaciones profesionales por WhatsApp en segundos.') + '</div>'
          + (searchText ? '' : '<button id="customers-empty-cta" class="btn-primary btn-sm" style="margin-top:14px">+ Añadir cliente</button>') + '</div>';
        tr.appendChild(td);
        tbody.appendChild(tr);
        const cta = td.querySelector('#customers-empty-cta');
        if (cta) cta.addEventListener('click', () => newBtn.click());
        setCount(searchText ? "0 resultados" : "0 clientes");
        return;
      }

      setCount(data.length + " cliente" + (data.length !== 1 ? "s" : ""));

      data.forEach((c) => {
        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        tr.addEventListener("click", () => openCustomer360(c));

        addCell(tr, c.id);
        addCell(tr, c.name || "");
        addCell(tr, c.phone || "");
        addCell(tr, c.email || "", "col-hide-mobile");
        const notesCell = addCell(tr, c.notes || "", "col-hide-mobile");
        notesCell.style.cssText += "max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)";
        if (c.notes) notesCell.title = c.notes;
        const altaCell = addCell(tr, c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "", "col-hide-mobile");
        altaCell.style.color = "var(--muted)";

        const tdActions = document.createElement("td");
        const actionsDiv = document.createElement("div");
        actionsDiv.style.cssText = "display:flex;gap:6px;align-items:center";

        const editBtn = createElement("button", "btn-secondary btn-sm", "Editar");
        editBtn.type = "button";
        editBtn.addEventListener("click", (e) => { e.stopPropagation(); openModal("edit", c); });
        actionsDiv.appendChild(editBtn);

        const portalBtn = createElement("button", "btn-secondary btn-sm", "Portal");
        portalBtn.type = "button";
        portalBtn.title = "Copiar enlace del portal del cliente";
        portalBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            const res = await apiRequest(`/admin/customers/${c.id}/portal-url`);
            await navigator.clipboard.writeText(res.portalUrl);
            portalBtn.textContent = "¡Copiado!";
            setTimeout(() => { portalBtn.textContent = "Portal"; }, 2000);
          } catch (err) {
            setAlert("error", "Error al obtener el portal: " + err.message);
          }
        });
        actionsDiv.appendChild(portalBtn);

        const detailBtn = createElement("button", "btn-ghost btn-sm", "📊 Historial");
        detailBtn.type = "button";
        detailBtn.title = "Ver historial completo del cliente";
        detailBtn.addEventListener("click", (e) => { e.stopPropagation(); openCustomer360(c); });
        actionsDiv.appendChild(detailBtn);

        tdActions.appendChild(actionsDiv);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
      });
    } catch (err) {
      setCount("");
      setAlert("error", "Error cargando clientes: " + err.message);
    }
  }

  function addCell(tr, value, cls) {
    const td = document.createElement("td");
    td.textContent = value ?? "";
    if (cls) td.className = cls;
    tr.appendChild(td);
    return td;
  }

  // -------- Eventos --------

  newBtn.addEventListener("click", () => openModal("create", null));

  let searchTimer = null;
  searchInput.addEventListener("input", () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadCustomers(searchInput.value.trim()), 300);
  });

  // Carga inicial
  loadCustomers();
}
