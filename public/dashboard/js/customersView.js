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

  const outerCard = createElement("div", "card customers-card");
  container.appendChild(outerCard);

  const header = createElement("div", "customers-header");

  // Buscador
  const searchBox = createElement("div", "customers-search");
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Buscar por nombre, teléfono o email…";
  const searchBtn = createElement("button", "btn btn-secondary", "Buscar");
  searchBox.appendChild(searchInput);
  searchBox.appendChild(searchBtn);

  // Botón nuevo cliente
  const newBtn = createElement("button", "btn btn-primary", "Nuevo cliente");

  header.appendChild(searchBox);
  header.appendChild(newBtn);
  outerCard.appendChild(header);

  // Tabla con scroll horizontal en móvil
  const tableScroll = createElement("div", "table-scroll");
  outerCard.appendChild(tableScroll);
  const table = createElement("table", "table");
  tableScroll.appendChild(table);
  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  ["ID", "Nombre", "Teléfono", "Email", "Notas", "Alta", "Acciones"].forEach(
    (h) => {
      const th = document.createElement("th");
      th.textContent = h;
      trHead.appendChild(th);
    }
  );
  thead.appendChild(trHead);
  table.appendChild(thead);
  tableScroll.appendChild(table);
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  outerCard.appendChild(table);

  // Alertas
  const alertBox = createElement("div", "alert");
  outerCard.appendChild(alertBox);

  function setAlert(type, msg) {
    alertBox.textContent = msg || "";
    alertBox.className = "alert";
    if (type === "success") alertBox.classList.add("success");
    if (type === "error") alertBox.classList.add("error");
  }

  // -------- Modal --------

  let modalBackdrop = null;
  let modalForm = null;
  let fieldName, fieldPhone, fieldEmail, fieldNotes;
  let modalTitleEl = null;
  let modalSaveBtn = null;

  function buildModal() {
    modalBackdrop = createElement("div", "modal-backdrop");
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
    fieldNotes = createField("Notas", "notes", null, false, true);

    body.appendChild(fieldName.wrapper);
    body.appendChild(fieldPhone.wrapper);
    body.appendChild(fieldEmail.wrapper);
    body.appendChild(fieldNotes.wrapper);

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

  async function loadCustomers(searchText = "") {
    setAlert(null, "");
    try {
      const data = await getCustomers(searchText);
      tbody.innerHTML = "";

      if (!Array.isArray(data) || data.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 7;
        td.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-title">Sin clientes aún</div><div class="empty-state-desc">Crea el primero con el botón "+ Nuevo cliente".</div></div>';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }

      data.forEach((c) => {
        const tr = document.createElement("tr");
        addCell(tr, c.id);
        addCell(tr, c.name || "");
        addCell(tr, c.phone || "");
        addCell(tr, c.email || "");
        addCell(tr, c.notes || "");
        addCell(
          tr,
          c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""
        );

        const tdActions = document.createElement("td");
        tdActions.style.display = "flex";
        tdActions.style.gap = "6px";

        const editBtn = createElement("button", "btn btn-secondary", "Editar");
        editBtn.type = "button";
        editBtn.addEventListener("click", () => openModal("edit", c));
        tdActions.appendChild(editBtn);

        const portalBtn = createElement("button", "btn btn-secondary", "Portal");
        portalBtn.type = "button";
        portalBtn.title = "Copiar enlace del portal del cliente";
        portalBtn.addEventListener("click", async () => {
          try {
            const data = await apiRequest(`/admin/customers/${c.id}/portal-url`);
            await navigator.clipboard.writeText(data.portalUrl);
            portalBtn.textContent = "¡Copiado!";
            setTimeout(() => { portalBtn.textContent = "Portal"; }, 2000);
          } catch (err) {
            alert("Error al obtener el portal: " + err.message);
          }
        });
        tdActions.appendChild(portalBtn);

        tr.appendChild(tdActions);

        tbody.appendChild(tr);
      });
    } catch (err) {
      setAlert("error", "Error cargando clientes: " + err.message);
    }
  }

  function addCell(tr, value) {
    const td = document.createElement("td");
    td.textContent = value ?? "";
    tr.appendChild(td);
  }

  // -------- Eventos --------

  newBtn.addEventListener("click", () => openModal("create", null));

  searchBtn.addEventListener("click", () => {
    loadCustomers(searchInput.value.trim());
  });

  searchInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      loadCustomers(searchInput.value.trim());
    }
  });

  // Carga inicial
  loadCustomers();
}
