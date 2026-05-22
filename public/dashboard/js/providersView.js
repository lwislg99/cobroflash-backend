function renderProvidersView(container) {
    container.innerHTML = "";
  
    const wrap = document.createElement("div");
    wrap.className = "card";
    container.appendChild(wrap);
  
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.gap = "12px";
    wrap.appendChild(header);
  
    const h = document.createElement("div");
    h.innerHTML = `
      <h2 style="margin:0">Proveedores</h2>
      <p style="margin:4px 0 0; color:#6b7280; font-size:13px">
        Crea y consulta proveedores para asociarlos a productos.
      </p>
    `;
    header.appendChild(h);
  
    const reloadBtn = document.createElement("button");
    reloadBtn.className = "btn btn-secondary";
    reloadBtn.type = "button";
    reloadBtn.textContent = "Recargar";
    header.appendChild(reloadBtn);
  
    const alert = document.createElement("div");
    alert.className = "alert";
    alert.style.marginTop = "12px";
    wrap.appendChild(alert);
  
    function setAlert(type, msg) {
      alert.textContent = msg || "";
      alert.className = "alert";
      if (type === "success") alert.classList.add("success");
      if (type === "error") alert.classList.add("error");
    }

    const editDialog = document.createElement("dialog");
    editDialog.style.maxWidth = "560px";
    editDialog.style.width = "100%";
    editDialog.style.border = "1px solid #e5e7eb";
    editDialog.style.borderRadius = "12px";
    editDialog.style.padding = "16px";
  
    editDialog.innerHTML = `
      <form method="dialog" id="pf-edit-provider-form">
        <h3 style="margin:0 0 10px">Editar proveedor</h3>
  
        <div class="quote-form-row">
          <div class="field">
            <label>Nombre *</label>
            <input name="name" />
          </div>
  
          <div class="field">
            <label>Teléfono</label>
            <input name="phone" />
          </div>
  
          <div class="field">
            <label>Email</label>
            <input name="email" />
          </div>
        </div>
  
        <div class="field">
          <label>Notas</label>
          <input name="notes" />
        </div>
  
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px">
          <button class="btn btn-secondary" value="cancel">Cancelar</button>
          <button class="btn btn-primary" id="pf-edit-provider-save" value="default">Guardar</button>
        </div>
      </form>
    `;
  
    document.body.appendChild(editDialog);
  
    let _editingProvider = null;
  
    const form = document.createElement("div");
    form.style.marginTop = "12px";
    form.innerHTML = `
      <div class="quote-block">
        <h3 class="quote-block-title">Nuevo proveedor</h3>
  
        <div class="quote-form-row">
          <div class="field">
            <label>Nombre *</label>
            <input name="name" placeholder="Ej: Proveedor Alarmas SL" />
          </div>
  
          <div class="field">
            <label>Teléfono</label>
            <input name="phone" placeholder="600111222" />
          </div>
  
          <div class="field">
            <label>Email</label>
            <input name="email" placeholder="proveedor@email.com" />
          </div>
        </div>
  
        <div class="field">
          <label>Notas</label>
          <input name="notes" placeholder="Texto opcional" />
        </div>
  
        <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:10px">
          <button class="btn btn-primary" type="button" id="pf-create-provider">Crear proveedor</button>
        </div>
      </div>
    `;
    wrap.appendChild(form);
  
    const nameI = form.querySelector('input[name="name"]');
    const phoneI = form.querySelector('input[name="phone"]');
    const emailI = form.querySelector('input[name="email"]');
    const notesI = form.querySelector('input[name="notes"]');
    const createBtn = form.querySelector("#pf-create-provider");
  
    const tableWrap = document.createElement("div");
    tableWrap.className = "table-scroll";
    tableWrap.style.marginTop = "14px";
    wrap.appendChild(tableWrap);
  
    const table = document.createElement("table");
    table.className = "table";
    table.innerHTML = `
    <thead>
      <tr>
        <th style="width:60px">ID</th>
        <th>Nombre</th>
        <th style="width:160px">Teléfono</th>
        <th style="width:220px">Email</th>
        <th style="width:110px">Activo</th>
        <th style="width:210px"></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
    tableWrap.appendChild(table);
  
    const tbody = table.querySelector("tbody");
  
    async function getMerchantId() {
      const res = await fetch("/admin/merchant");
      if (!res.ok) throw new Error("No se pudo cargar /admin/merchant");
      const m = await res.json();
      if (!m || !m.id) throw new Error("merchant.id no disponible");
      return m.id;
    }
  
    async function listProviders(merchantId) {
      const res = await fetch(`/admin/providers?merchantId=${encodeURIComponent(merchantId)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error(data?.error || "Error listando proveedores");
      return data.items || [];
    }
  
    async function createProvider(merchantId, payload) {
      const res = await fetch(`/admin/providers?merchantId=${encodeURIComponent(merchantId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error(data?.error || "Error creando proveedor");
      return data.item;
    }

      async function updateProvider(merchantId, id, payload) {
    const res = await fetch(`/admin/providers/${id}?merchantId=${encodeURIComponent(merchantId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.ok) throw new Error(data?.error || "Error actualizando proveedor");
    return data.item;
  }

  async function deleteProvider(merchantId, id) {
    const res = await fetch(`/admin/providers/${id}?merchantId=${encodeURIComponent(merchantId)}`, {
      method: "DELETE",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.ok) throw new Error(data?.error || "Error borrando proveedor");
    return data.deleted;
  }
  
    function renderRows(items) {
      tbody.innerHTML = "";
  
      if (!items || items.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 6;
        td.textContent = "No hay proveedores todavía.";
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }
  
      items.forEach((it) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${it.id}</td>
          <td>${it.name || ""}</td>
          <td>${it.phone || "—"}</td>
          <td>${it.email || "—"}</td>
          <td>${it.isActive ? "Sí" : "No"}</td>
          <td></td>
        `;
  
        const actionsTd = tr.lastElementChild;
  
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "btn btn-secondary";
        editBtn.textContent = "Editar";
  
        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "btn btn-secondary";
        toggleBtn.textContent = it.isActive ? "Desactivar" : "Activar";
  
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "btn btn-secondary";
        delBtn.textContent = "Borrar";
  
        actionsTd.style.display = "flex";
        actionsTd.style.justifyContent = "flex-end";
        actionsTd.style.gap = "8px";
        actionsTd.appendChild(editBtn);
        actionsTd.appendChild(toggleBtn);
        actionsTd.appendChild(delBtn);
  
        editBtn.addEventListener("click", async () => {
          try {
            setAlert(null, "");
            _editingProvider = { merchantId: _merchantId, id: it.id };
  
            const formEl = editDialog.querySelector("#pf-edit-provider-form");
            formEl.name.value = it.name || "";
            formEl.phone.value = it.phone || "";
            formEl.email.value = it.email || "";
            formEl.notes.value = it.notes || "";
  
            editDialog.showModal();
  
            const onSubmit = async (e) => {
              e.preventDefault();
  
              const name = String(formEl.name.value || "").trim();
              const phone = String(formEl.phone.value || "").trim();
              const email = String(formEl.email.value || "").trim();
              const notes = String(formEl.notes.value || "").trim();
  
              if (!name) return setAlert("error", "name_required");
  
              await updateProvider(_editingProvider.merchantId, _editingProvider.id, {
                name,
                phone: phone || null,
                email: email || null,
                notes: notes || null,
              });
  
              editDialog.close();
              setAlert("success", "Proveedor actualizado.");
              await refresh();
            };
  
            formEl.addEventListener("submit", onSubmit, { once: true });
        } catch (e) {
            const msg = e?.message || "";
  
            if (msg === "provider_in_use") {
              setAlert("error", "No se puede borrar el proveedor porque está asignado a uno o más productos.");
              return;
            }
  
            setAlert("error", msg || "Error borrando proveedor.");
          }
        });
  
        toggleBtn.addEventListener("click", async () => {
          try {
            setAlert(null, "");
  
            await updateProvider(_merchantId, it.id, {
              isActive: !it.isActive,
            });
  
            setAlert("success", "Estado del proveedor actualizado.");
            await refresh();
  
          } catch (e) {
            setAlert("error", e.message || "Error actualizando proveedor.");
          }
        });
  
        delBtn.addEventListener("click", async () => {
            if (!confirm(`¿Borrar el proveedor "${it.name}"?`)) return;
    
            try {
              setAlert(null, "");
              await deleteProvider(_merchantId, it.id);
              setAlert("success", "Proveedor borrado.");
              await refresh();
            } catch (e) {
              const msg =
                e && e.message
                  ? e.message
                  : typeof e === "string"
                  ? e
                  : "";
    
              if (msg === "provider_in_use") {
                setAlert("error", "No se puede borrar el proveedor porque está asignado a uno o más productos.");
                return;
              }
    
              setAlert("error", msg || "Error borrando proveedor.");
            }
          });
  
        tbody.appendChild(tr);
      });
    }
  
    let _merchantId = null;
  
    async function refresh() {
      const merchantId = _merchantId || (_merchantId = await getMerchantId());
      const items = await listProviders(merchantId);
      renderRows(items);
    }
  
    reloadBtn.addEventListener("click", async () => {
      try {
        setAlert(null, "");
        await refresh();
      } catch (e) {
        setAlert("error", e.message || "Error recargando.");
      }
    });
  
    createBtn.addEventListener("click", async () => {
      try {
        setAlert(null, "");
  
        const merchantId = _merchantId || (_merchantId = await getMerchantId());
  
        const name = String(nameI.value || "").trim();
        const phone = String(phoneI.value || "").trim();
        const email = String(emailI.value || "").trim();
        const notes = String(notesI.value || "").trim();
  
        if (!name) return setAlert("error", "name_required");
  
        await createProvider(merchantId, {
          name,
          phone: phone || null,
          email: email || null,
          notes: notes || null,
        });
  
        nameI.value = "";
        phoneI.value = "";
        emailI.value = "";
        notesI.value = "";
  
        setAlert("success", "Proveedor creado.");
        await refresh();
      } catch (e) {
        setAlert("error", e.message || "Error creando proveedor.");
      }
    });
  
    refresh().catch((e) => setAlert("error", e.message || "Error cargando proveedores."));
  }
  
  window.renderProvidersView = renderProvidersView;