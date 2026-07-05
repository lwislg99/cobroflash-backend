// public/dashboard/js/productsView.js
function renderProductsView(container) {
    container.innerHTML = "";
  
    const wrap = document.createElement("div");
    wrap.className = "data-card";
    container.appendChild(wrap);

    const header = document.createElement("div");
    header.className = "data-card-header";
    wrap.appendChild(header);

    const h = document.createElement("div");
    const titleEl = document.createElement("h2");
    titleEl.textContent = "Catálogo de productos";
    titleEl.style.cssText = "margin:0;font-size:18px";
    const countEl = document.createElement("p");
    countEl.textContent = "Cargando…";
    countEl.style.cssText = "margin:2px 0 0;color:var(--muted);font-size:13px";
    h.appendChild(titleEl);
    h.appendChild(countEl);
    header.appendChild(h);

    function setCount(text) { countEl.textContent = text; }

    const headActions = document.createElement("div");
    headActions.style.cssText = "display:flex;align-items:center;gap:8px";
    header.appendChild(headActions);

    const reloadBtn = document.createElement("button");
    reloadBtn.className = "btn-secondary btn-sm";
    reloadBtn.type = "button";
    reloadBtn.textContent = "Recargar";
    headActions.appendChild(reloadBtn);

    const exportBtn = document.createElement("button");
    exportBtn.className = "btn-secondary btn-sm";
    exportBtn.type = "button";
    exportBtn.textContent = "⬇ Exportar CSV";
    headActions.appendChild(exportBtn);

    const importBtn = document.createElement("button");
    importBtn.className = "btn-secondary btn-sm";
    importBtn.type = "button";
    importBtn.textContent = "⬆ Importar CSV";
    headActions.appendChild(importBtn);

    const importFile = document.createElement("input");
    importFile.type = "file";
    importFile.accept = ".csv,text/csv";
    importFile.style.display = "none";
    headActions.appendChild(importFile);

      // --- search + filters (client-side) ---
  const tools = document.createElement("div");
  tools.className = "data-card-toolbar";
  wrap.appendChild(tools); // toolbar al nivel del data-card, no dentro del header

  const searchI = document.createElement("input");
  searchI.placeholder = "Buscar producto…";
  searchI.className = "input";
  searchI.style.maxWidth = "240px";

  const onlyActiveWrap = document.createElement("label");
  onlyActiveWrap.style.display = "flex";
  onlyActiveWrap.style.alignItems = "center";
  onlyActiveWrap.style.gap = "6px";
  onlyActiveWrap.style.fontSize = "13px";
  onlyActiveWrap.style.color = "var(--muted)";

  const onlyActiveI = document.createElement("input");
  onlyActiveI.type = "checkbox";
  onlyActiveI.checked = false;

  const onlyActiveText = document.createElement("span");
  onlyActiveText.textContent = "Solo activos";

  onlyActiveWrap.appendChild(onlyActiveI);
  onlyActiveWrap.appendChild(onlyActiveText);

  tools.appendChild(searchI);
  tools.appendChild(onlyActiveWrap);

  // tools ya appended al wrap directamente como toolbar

  
    const alert = document.createElement("div");
    alert.className = "alert";
    alert.style.cssText = "margin:0 20px 0;display:none";
    wrap.appendChild(alert);
  
    function setAlert(type, msg) {
      alert.textContent = msg || "";
      alert.className = "alert";
      alert.style.cssText = "margin:0 20px 0";
      if (type === "success") { alert.classList.add("success"); alert.style.display = "block"; }
      else if (type === "error") { alert.classList.add("error"); alert.style.display = "block"; }
      else { alert.style.display = "none"; }
    }

        // --- edit modal (custom modal-overlay) ---
        let editOverlay = null;
        let _editing = null; // { merchantId, id }

        function buildEditModal() {
          const ov = document.createElement('div');
          ov.className = 'modal-overlay';
          ov.style.display = 'none';
          ov.innerHTML = `
            <div class="modal" style="max-width:560px">
              <div class="modal-header">
                <span class="modal-title">Editar producto</span>
                <button class="modal-close" type="button" id="pf-edit-close">&times;</button>
              </div>
              <div class="modal-body" style="gap:12px">
                <div class="quote-form-row">
                  <div class="field"><label>Nombre *</label><input name="name"/></div>
                  <div class="field"><label>Precio *</label><input name="price" type="number" step="0.01" min="0"/></div>
                  <div class="field"><label>IVA (0..1)</label><input name="vat" type="number" step="0.01" min="0" max="1"/></div>
                  <div class="field"><label>Coste</label><input name="cost" type="number" step="0.01" min="0"/></div>
                  <div class="field"><label>Proveedor</label><select name="providerId"><option value="">— Sin proveedor —</option></select></div>
                </div>
                <div class="field"><label>Descripción</label><input name="description"/></div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" type="button" id="pf-edit-cancel">Cancelar</button>
                <button class="btn btn-primary" type="button" id="pf-edit-save">Guardar</button>
              </div>
            </div>
          `;
          document.body.appendChild(ov);

          ov.querySelector('#pf-edit-close').addEventListener('click', closeEditModal);
          ov.querySelector('#pf-edit-cancel').addEventListener('click', closeEditModal);
          ov.addEventListener('click', (e) => { if (e.target === ov) closeEditModal(); });

          ov.querySelector('#pf-edit-save').addEventListener('click', async () => {
            if (!_editing) return;
            const body = ov.querySelector('.modal-body');
            const name = body.querySelector('[name="name"]').value.trim();
            const price = Number(body.querySelector('[name="price"]').value);
            const vatRaw = body.querySelector('[name="vat"]').value.trim();
            const costRaw = body.querySelector('[name="cost"]').value.trim();
            const providerRaw = body.querySelector('[name="providerId"]').value.trim();
            const description = body.querySelector('[name="description"]').value.trim();

            if (!name) return setAlert('error', 'El nombre es obligatorio.');
            if (!Number.isFinite(price) || price <= 0) return setAlert('error', 'El precio debe ser mayor que 0.');

            const payload = {
              name,
              description: description || null,
              price,
              vat: vatRaw === '' ? null : Number(vatRaw),
              cost: costRaw === '' ? null : Number(costRaw),
              providerId: providerRaw === '' ? null : Number(providerRaw),
            };

            const saveBtn = ov.querySelector('#pf-edit-save');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Guardando…';
            try {
              await updateProduct(_editing.merchantId, _editing.id, payload);
              closeEditModal();
              setAlert('success', 'Producto actualizado.');
              await refresh();
            } catch (e) {
              setAlert('error', e.message || 'Error actualizando.');
            } finally {
              saveBtn.disabled = false;
              saveBtn.textContent = 'Guardar';
            }
          });

          return ov;
        }

        function openEditModal(it) {
          if (!editOverlay) editOverlay = buildEditModal();
          _editing = { merchantId: _merchantId, id: it.id };

          const body = editOverlay.querySelector('.modal-body');
          body.querySelector('[name="name"]').value = it.name || '';
          body.querySelector('[name="price"]').value = it.price ?? '';
          body.querySelector('[name="vat"]').value = it.vat === null ? '' : String(it.vat);
          body.querySelector('[name="cost"]').value = it.cost === null ? '' : String(it.cost);
          body.querySelector('[name="description"]').value = it.description || '';

          const provSel = body.querySelector('[name="providerId"]');
          provSel.innerHTML = '<option value="">— Sin proveedor —</option>';
          (_providers || []).forEach((p) => {
            const opt = document.createElement('option');
            opt.value = String(p.id);
            opt.textContent = p.name || `Proveedor #${p.id}`;
            provSel.appendChild(opt);
          });
          provSel.value = it.providerId == null ? '' : String(it.providerId);

          editOverlay.style.display = 'flex';
          body.querySelector('[name="name"]').focus();
        }

        function closeEditModal() {
          if (editOverlay) editOverlay.style.display = 'none';
          _editing = null;
        }
    
  
    // --- form create ---
    const form = document.createElement("div");
    form.style.cssText = "padding:0 20px 4px";
    form.innerHTML = `
      <div class="quote-block">
        <h3 class="quote-block-title">Nuevo producto</h3>
  
        <div class="quote-form-row">
        <div class="field">
          <label>Nombre *</label>
          <input name="name" placeholder="Ej: Detector de humos" />
        </div>

        <div class="field">
          <label>Precio *</label>
          <input name="price" type="number" step="0.01" min="0" placeholder="99.99" />
        </div>

        <div class="field">
          <label>IVA (0..1)</label>
          <input name="vat" type="number" step="0.01" min="0" max="1" placeholder="0.21" />
        </div>

        <div class="field">
          <label>Coste</label>
          <input name="cost" type="number" step="0.01" min="0" placeholder="60.00" />
        </div>

        <div class="field">
          <label>Proveedor</label>
          <select name="providerId">
            <option value="">— Sin proveedor —</option>
          </select>
        </div>
      </div>
  
        <div class="field">
          <label>Descripción</label>
          <input name="description" placeholder="Texto opcional" />
        </div>
  
        <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:10px">
          <button class="btn btn-primary" type="button" id="pf-create-product">Crear producto</button>
        </div>
      </div>
    `;
    wrap.appendChild(form);
  
    const nameI = form.querySelector('input[name="name"]');
    const priceI = form.querySelector('input[name="price"]');
    const vatI = form.querySelector('input[name="vat"]');
    const costI = form.querySelector('input[name="cost"]');
    const providerSelect = form.querySelector('select[name="providerId"]');
    const descI = form.querySelector('input[name="description"]');
    const createBtn = form.querySelector("#pf-create-product");
  
    // --- table ---
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
      <th style="width:160px" class="col-hide-mobile">Proveedor</th>
      <th style="width:140px;text-align:right">Precio</th>
      <th style="width:90px" class="col-hide-mobile">IVA</th>
      <th style="width:140px;text-align:right" class="col-hide-mobile">Coste</th>
      <th style="width:110px">Activo</th>
      <th style="width:210px"></th>
    </tr>
  </thead>
      <tbody></tbody>
    `;
    tableWrap.appendChild(table);
  
    const tbody = table.querySelector("tbody");
  
    // --- api helpers ---
    async function getMerchantId() {
      // usa tu endpoint real
      const res = await fetch("/admin/merchant");
      if (!res.ok) throw new Error("No se pudo cargar /admin/merchant");
      const m = await res.json();
      if (!m || !m.id) throw new Error("merchant.id no disponible");
      return m.id;
    }
  
    async function listProducts(merchantId) {
      const res = await fetch(`/admin/products?merchantId=${encodeURIComponent(merchantId)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error(data?.error || "Error listando productos");
      return data.items || [];
    }

    async function listProviders(merchantId) {
      const res = await fetch(`/admin/providers?merchantId=${encodeURIComponent(merchantId)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error(data?.error || "Error listando proveedores");
      return data.items || [];
    }
  
    async function createProduct(merchantId, payload) {
      const res = await fetch(`/admin/products?merchantId=${encodeURIComponent(merchantId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error(data?.error || "Error creando producto");
      return data.item;
    }
  
    async function updateProduct(merchantId, id, payload) {
      const res = await fetch(`/admin/products/${id}?merchantId=${encodeURIComponent(merchantId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error(data?.error || "Error actualizando producto");
      return data.item;
    }
  
    async function deleteProduct(merchantId, id) {
      const res = await fetch(`/admin/products/${id}?merchantId=${encodeURIComponent(merchantId)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error(data?.error || "Error borrando producto");
      return data.deleted;
    }

    async function importProductsCsv(merchantId, csvText) {
      const res = await fetch(`/admin/products/import?merchantId=${encodeURIComponent(merchantId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
    
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error(data?.error || "Error importando CSV");
      return { inserted: Number(data.inserted || 0) };
    }
  
    function money(v) {
      if (v === null || typeof v === "undefined") return "—";
      const n = Number(v);
      if (!Number.isFinite(n)) return String(v);
      // P-A66-3: es-ES compartido — "60,00 €" en vez de "60.00"
      return fmtMoneyEs(n, (window.appLocale && window.appLocale.currency) || "EUR");
    }
  
    function renderRows(items, merchantId) {
      tbody.innerHTML = "";

      if (!items || items.length === 0) {
        const searching = !!String(searchI.value || "").trim() || !!onlyActiveI.checked;
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 8;
        td.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div>'
          + '<div class="empty-state-title">' + (searching ? 'Sin productos para este filtro' : 'Crea tu catálogo de servicios') + '</div>'
          + '<div class="empty-state-desc">' + (searching ? 'Prueba con otra búsqueda o desactiva el filtro.' : 'Con tus servicios y precios guardados, montar una cotización es cuestión de segundos gracias al autocompletado.') + '</div>'
          + (searching ? '' : '<button id="products-empty-cta" class="btn-primary btn-sm" style="margin-top:14px">+ Añadir mi primer servicio</button>') + '</div>';
        tr.appendChild(td);
        tbody.appendChild(tr);
        const cta = td.querySelector('#products-empty-cta');
        if (cta) cta.addEventListener('click', () => {
          const nameInput = document.querySelector('input[name="name"]');
          if (nameInput) { nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); nameInput.focus(); }
        });
        setCount(searching ? "0 resultados" : "0 productos");
        return;
      }

      setCount(items.length + " producto" + (items.length !== 1 ? "s" : ""));

      items.forEach((it) => {
        const tr = document.createElement("tr");
  
        const vatPct = (it.vat === null || typeof it.vat === "undefined")
          ? "—"
          : (Number(it.vat) * 100).toFixed(0) + " %";
        const activePill = it.isActive
          ? '<span class="status-pill status-pill-accepted">ACTIVO</span>'
          : '<span class="status-pill status-pill-draft">INACTIVO</span>';

        tr.innerHTML = `
        <td>${it.id}</td>
        <td>
          <div style="font-weight:600">${it.name || ""}</div>
          <div style="font-size:12px;color:var(--muted)">${it.description || ""}</div>
        </td>
        <td class="col-hide-mobile">${it.provider?.name || "—"}</td>
        <td class="amount" style="text-align:right">${money(it.price)}</td>
        <td class="col-hide-mobile">${vatPct}</td>
        <td class="amount-muted col-hide-mobile" style="text-align:right">${money(it.cost)}</td>
        <td>${activePill}</td>
        <td></td>
      `;
  
        const actionsTd = tr.lastElementChild;
        const actionsDiv = document.createElement("div");
        actionsDiv.style.cssText = "display:flex;justify-content:flex-end;gap:6px;align-items:center";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "btn btn-secondary btn-sm";
        editBtn.textContent = "Editar";

        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "btn btn-secondary btn-sm";
        toggleBtn.textContent = it.isActive ? "Desactivar" : "Activar";

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "btn btn-danger btn-sm";
        delBtn.textContent = "Borrar";

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(toggleBtn);
        actionsDiv.appendChild(delBtn);
        actionsTd.appendChild(actionsDiv);
  
        editBtn.addEventListener("click", () => {
          setAlert(null, "");
          openEditModal(it);
        });
  


  
        toggleBtn.addEventListener("click", async () => {
          try {
            setAlert(null, "");
            await updateProduct(merchantId, it.id, { isActive: !it.isActive });
            setAlert("success", "Estado actualizado.");
            await refresh();
          } catch (e) {
            setAlert("error", e.message || "Error actualizando estado.");
          }
        });
  
        delBtn.addEventListener("click", async () => {
          if (!confirm(`¿Borrar el producto "${it.name}"?`)) return;
          try {
            setAlert(null, "");
            await deleteProduct(merchantId, it.id);
            setAlert("success", "Producto borrado.");
            await refresh();
          } catch (e) {
            setAlert("error", e.message || "Error borrando.");
          }
        });
  
        tbody.appendChild(tr);
      });
    }
  
    let _merchantId = null;
    let _importing = false;
    let _providers = [];
  
    async function refresh() {
      setCount("Cargando…");
      uiSkeletonRows(tbody, 8, 6);
      const merchantId = _merchantId || (_merchantId = await getMerchantId());

      const [items, providers] = await Promise.all([
        listProducts(merchantId),
        listProviders(merchantId),
      ]);

      _providers = Array.isArray(providers) ? providers : [];

      if (providerSelect) {
        const currentValue = providerSelect.value;
        providerSelect.innerHTML = `<option value="">— Sin proveedor —</option>`;

        _providers.forEach((p) => {
          const opt = document.createElement("option");
          opt.value = String(p.id);
          opt.textContent = p.name || `Proveedor #${p.id}`;
          providerSelect.appendChild(opt);
        });

        if (currentValue) {
          providerSelect.value = currentValue;
        }
      }

      const q = String(searchI.value || "").trim().toLowerCase();
      const onlyActive = !!onlyActiveI.checked;

      const filtered = items.filter((p) => {
        if (onlyActive && !p.isActive) return false;
        if (!q) return true;
        const hay = `${p.name || ""} ${p.description || ""}`.toLowerCase();
        return hay.includes(q);
      });

      renderRows(filtered, merchantId);
    }
  
    reloadBtn.addEventListener("click", async () => {
      try {
        setAlert(null, "");
        await refresh();
      } catch (e) {
        setAlert("error", e.message || "Error recargando.");
      }
    });

    exportBtn.addEventListener("click", async () => {
      try {
        setAlert(null, "");
        const merchantId = _merchantId || (_merchantId = await getMerchantId());
        const url = `/admin/products/export?merchantId=${encodeURIComponent(merchantId)}`;
        window.open(url, "_blank");
      } catch (e) {
        setAlert("error", e.message || "Error exportando.");
      }
    });

  

    importBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
    
      if (_importing) return;
    
      setAlert(null, "");
      importFile.value = ""; // permite re-importar el mismo archivo
      importFile.click();
    };
    
    importFile.onchange = async (e) => {
      e.preventDefault();
      e.stopPropagation();
    
      // lock anti-doble disparo
      if (_importing) return;
    
      const file = importFile.files && importFile.files[0];
      if (!file) return;
    
      _importing = true;
      importBtn.disabled = true;
      const prevText = importBtn.textContent;
      importBtn.textContent = "Importando…";
    
      try {
        setAlert(null, "");
    
        const csv = await file.text();
        const merchantId = _merchantId || (_merchantId = await getMerchantId());
    
        const res = await fetch(`/admin/products/import?merchantId=${encodeURIComponent(merchantId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csv }),
        });
    
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.ok) throw new Error(data?.error || "Error importando");
    
        setAlert("success", `CSV importado. Insertados: ${data.inserted ?? 0} · Duplicados omitidos: ${data.skippedDuplicates ?? 0}`);
        await refresh();
      } catch (err) {
        setAlert("error", err.message || "Error importando.");
      } finally {
        // MUY importante: limpiar value para que no se “re-dispare” con el mismo archivo
        importFile.value = "";
        _importing = false;
        importBtn.disabled = false;
        importBtn.textContent = prevText;
      }
    };
    createBtn.addEventListener("click", async () => {
      try {
        setAlert(null, "");
  
        const merchantId = _merchantId || (_merchantId = await getMerchantId());
  
        const name = String(nameI.value || "").trim();
        const price = Number(priceI.value);
        const vatRaw = String(vatI.value || "").trim();
        const costRaw = String(costI.value || "").trim();
        const providerRaw = String(providerSelect?.value || "").trim();
        const description = String(descI.value || "").trim();
  
        if (!name) return setAlert("error", "El nombre es obligatorio.");
        if (!Number.isFinite(price) || price <= 0) return setAlert("error", "El precio debe ser mayor que 0.");
  
        const payload = {
          name,
          description: description || null,
          price,
          vat: vatRaw === "" ? null : Number(vatRaw),
          cost: costRaw === "" ? null : Number(costRaw),
          providerId: providerRaw === "" ? null : Number(providerRaw),
        };
  
        await createProduct(merchantId, payload);
  
        nameI.value = "";
        priceI.value = "";
        vatI.value = "";
        costI.value = "";
        if (providerSelect) providerSelect.value = "";
        descI.value = "";
  
        setAlert("success", "Producto creado.");
        await refresh();
      } catch (e) {
        setAlert("error", e.message || "Error creando producto.");
      }
    });
  



    searchI.addEventListener("input", () => refresh().catch(() => {}));
    onlyActiveI.addEventListener("change", () => refresh().catch(() => {}));


    // init
    refresh().catch((e) => setAlert("error", e.message || "Error cargando productos."));
  }
  