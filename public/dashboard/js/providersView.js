// public/dashboard/js/providersView.js

// ═══════════════════════════════════════════════════════════════════════════════════════
// SCRUM-644 · UN CÓDIGO DEL SERVIDOR NO ES UN MENSAJE PARA UNA PERSONA.
//
// MISMO defecto y MISMO criterio que SCRUM-641 en `productsView.js`; no se inventa uno nuevo.
// Este fichero tenía el camino COMPLETO: las llamadas hacen `throw new Error(data?.error || …)`
// y los avisos pintaban `e.message`. Cuando el servidor contesta `{ok:false,error:"name_duplicate"}`
// el identificador GANA al respaldo en castellano, así que un profesional leía literalmente
// `name_duplicate`. No es un mensaje mal redactado: es una tubería interna asomando a la interfaz.
//
// POR QUÉ VIVE AQUÍ Y NO EN `api.js`: `api.js` es ZONA SIN MARCADOR por decisión —lo fija
// `scrum405-microcopy-descarga.test.mjs`, que falla si vuelve a aparecer uno— y esto necesita
// marcador. Ya se intentó y la tanda lo tumbó (SCRUM-641). Además queda más honesto: el texto sin
// firmar lo pinta ESTA pantalla, así que es ésta la que entra en el censo de marcadores.
//
// ⚠️ LO DESCONOCIDO CAE AL RESPALDO, NO AL CÓDIGO. Es lo contrario que `invoiceStatusMeta`, donde
// un estado sin mapear «se ve» a propósito. En un aviso de error enseñar el código ES el defecto,
// así que el identificador sale por `console.warn` —donde lo ve quien puede mapearlo— y a la
// persona le llega el respaldo en castellano que cada llamada YA traía.
// ═══════════════════════════════════════════════════════════════════════════════════════

const PRV_MARCADOR_MICROCOPY = '[PENDIENTE microcopy oficial]';

// Un identificador interno no lleva espacios ni mayúsculas: `name_duplicate`, `not_found`,
// `provider_in_use`. Una frase escrita para una persona siempre lleva una de las dos cosas.
const PRV_ES_IDENTIFICADOR = /^[a-z][a-z0-9_]*$/;

/**
 * El texto que se le enseña a la persona a partir de lo que dijo el servidor.
 *
 * `respaldo` es el mensaje en castellano que la llamada ya traía: no es microcopy nueva, es la que
 * estaba escrita y que el identificador estaba tapando.
 */
function mensajeDeErrorProveedor(codigoOMensaje, respaldo) {
  const bruto = String(codigoOMensaje == null ? '' : codigoOMensaje).trim();

  // Sólo los que necesitan decir algo DISTINTO del respaldo genérico.
  const M = {
    // Texto NUEVO → marcador. Va con su palabra distintiva, no solo: si todos los errores dijeran
    // lo mismo, la pantalla perdería la distinción que este ticket viene a dar.
    name_duplicate: PRV_MARCADOR_MICROCOPY + ' nombre ya en uso',
    // Texto que YA EXISTÍA en esta pantalla y ya se enseñaba: se mueve, no se inventa. Por eso
    // NO lleva marcador — marcarlo diría que está sin aprobar, y lleva aprobado desde que se
    // escribió.
    provider_in_use: 'No se puede borrar el proveedor porque está asignado a uno o más productos.',
  };
  if (M[bruto]) return M[bruto];

  if (PRV_ES_IDENTIFICADOR.test(bruto)) {
    try { console.warn('[providersView] código sin traducir:', bruto); } catch (_) { /* sin consola */ }
    return respaldo || PRV_MARCADOR_MICROCOPY;
  }
  return bruto || respaldo || PRV_MARCADOR_MICROCOPY;
}
if (typeof window !== 'undefined') {
  window.mensajeDeErrorProveedor = mensajeDeErrorProveedor;
  window.PRV_MARCADOR_MICROCOPY = PRV_MARCADOR_MICROCOPY;
}

function renderProvidersView(container) {
    container.innerHTML = "";
  
    const wrap = document.createElement("div");
    wrap.className = "data-card";
    container.appendChild(wrap);

    const header = document.createElement("div");
    header.className = "data-card-header";
    wrap.appendChild(header);

    const h = document.createElement("div");
    h.innerHTML = `
      <h2 style="margin:0;font-size:16px;font-weight:700;color:var(--neutral-900)">Proveedores</h2>
      <p style="margin:2px 0 0;color:var(--neutral-400);font-size:12.5px">
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
    alert.style.cssText = "margin:0 20px;display:none";
    wrap.appendChild(alert);
  
    function setAlert(type, msg) {
      alert.textContent = msg || "";
      alert.className = "alert";
      if (type === "success") alert.classList.add("success");
      if (type === "error") alert.classList.add("error");
      alert.style.display = type ? "block" : "none";
    }

    let editProviderOverlay = null;
    let _editingProvider = null;

    function buildProviderEditModal() {
      const ov = document.createElement('div');
      ov.className = 'modal-overlay';
      ov.style.display = 'none';
      ov.innerHTML = `
        <div class="modal" style="max-width:520px">
          <div class="modal-body" style="gap:12px">
            <div class="quote-form-row">
              <div class="field"><label>Nombre *</label><input name="name"/></div>
              <div class="field"><label>Teléfono</label><input name="phone"/></div>
              <div class="field"><label>Email</label><input name="email" type="email"/></div>
            </div>
            <div class="field"><label>Notas</label><input name="notes"/></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" type="button" id="pf-prov-edit-cancel">Cancelar</button>
            <button class="btn btn-primary" type="button" id="pf-prov-edit-save">Guardar</button>
          </div>
        </div>
      `;
      // SCRUM-446: la cabecera sale del constructor compartido.
      ov.querySelector('.modal').prepend(cabeceraModal({ titulo: "Editar proveedor", idCierre: "pf-prov-edit-close" }));
      document.body.appendChild(ov);

      ov.querySelector('#pf-prov-edit-close').addEventListener('click', closeProviderEditModal);
      ov.querySelector('#pf-prov-edit-cancel').addEventListener('click', closeProviderEditModal);
      ov.addEventListener('click', (e) => { if (e.target === ov) closeProviderEditModal(); });

      ov.querySelector('#pf-prov-edit-save').addEventListener('click', async () => {
        if (!_editingProvider) return;
        const body = ov.querySelector('.modal-body');
        const name  = body.querySelector('[name="name"]').value.trim();
        const phone = body.querySelector('[name="phone"]').value.trim();
        const email = body.querySelector('[name="email"]').value.trim();
        const notes = body.querySelector('[name="notes"]').value.trim();

        if (!name) return setAlert('error', 'El nombre es obligatorio.');

        const saveBtn = ov.querySelector('#pf-prov-edit-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando…';
        try {
          await updateProvider(_editingProvider.merchantId, _editingProvider.id, {
            name,
            phone: phone || null,
            email: email || null,
            notes: notes || null,
          });
          closeProviderEditModal();
          setAlert('success', 'Proveedor actualizado.');
          await refresh();
        } catch (e) {
          setAlert('error', mensajeDeErrorProveedor(e && e.message, 'Error actualizando.'));
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Guardar';
        }
      });

      return ov;
    }

    function openProviderEditModal(it) {
      if (!editProviderOverlay) editProviderOverlay = buildProviderEditModal();
      // SCRUM-785 · al cerrarse se DESCUELGA del `body` (ver `closeProviderEditModal`), así que al
      // reabrir hay que volver a colgarlo. Se reengancha el MISMO nodo: sus campos y sus oyentes
      // siguen cableados desde `buildProviderEditModal`, que sólo corre una vez.
      else if (!editProviderOverlay.parentNode) document.body.appendChild(editProviderOverlay);
      _editingProvider = { merchantId: _merchantId, id: it.id };

      const body = editProviderOverlay.querySelector('.modal-body');
      body.querySelector('[name="name"]').value  = it.name  || '';
      body.querySelector('[name="phone"]').value = it.phone || '';
      body.querySelector('[name="email"]').value = it.email || '';
      body.querySelector('[name="notes"]').value = it.notes || '';

      editProviderOverlay.style.display = 'flex';
      body.querySelector('[name="name"]').focus();
    }

    function closeProviderEditModal() {
      if (editProviderOverlay) {
        editProviderOverlay.style.display = 'none';
        // 🔴 SCRUM-785 · Y SE DESCUELGA DEL BODY, por lo mismo que en Productos: un overlay
        // escondido pero PRESENTE dispara `body:has(.modal-overlay) #tut-help-btn`, que es una
        // regla ESTRUCTURAL, y apaga el botón flotante de ayuda para el resto de la sesión.
        // Medido en Edge, con su control positivo (al borrarlo, vuelve).
        //
        // ⚠️ SE DESCUELGA, NO SE DESTRUYE: `openProviderEditModal` reutiliza este mismo nodo.
        if (typeof editProviderOverlay.remove === 'function') editProviderOverlay.remove();
      }
      _editingProvider = null;
    }
  
    const form = document.createElement("div");
    form.style.cssText = "padding:0 20px 4px";
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
    table.className = "table table--stack-mobile"; // feedback fundador 6-jul
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
        // A6.5: estado vacío digno (mismo patrón que Productos/Clientes)
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 6;
        td.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🚚</div>'
          + '<div class="empty-state-title">Tus proveedores, a mano</div>'
          + '<div class="empty-state-desc">Guarda a quién le compras material: podrás asociarles gastos y ver cuánto te cuesta cada uno.</div>'
          + '</div>';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }
  
      items.forEach((it) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>#${it.id}</td>
          <td class="cell-title">${it.name || ""}</td>
          <td>${it.phone || "sin teléfono"}</td>
          <td class="col-hide-mobile">${it.email || "—"}</td>
          <td>${it.isActive ? "🟢 Activo" : "⚪ Inactivo"}</td>
          <td class="cell-actions"></td>
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
          openProviderEditModal(it);
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
            setAlert("error", mensajeDeErrorProveedor(e && e.message, "Error actualizando proveedor."));
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
              // SCRUM-644 · el `provider_in_use` que se traducía AQUÍ a mano se ha mudado al
              // mapa de `mensajeDeErrorProveedor`, con su texto INTACTO. Antes ese `if` era la
              // única traducción del fichero: todo lo demás caía al identificador crudo.
              const bruto = e && e.message ? e.message : (typeof e === "string" ? e : "");
              setAlert("error", mensajeDeErrorProveedor(bruto, "Error borrando proveedor."));
            }
          });
  
        tbody.appendChild(tr);
      });
    }
  
    let _merchantId = null;
  
    async function refresh() {
      uiSkeletonRows(tbody, 6, 5);
      const merchantId = _merchantId || (_merchantId = await getMerchantId());
      const items = await listProviders(merchantId);
      renderRows(items);
    }
  
    reloadBtn.addEventListener("click", async () => {
      try {
        setAlert(null, "");
        await refresh();
      } catch (e) {
        setAlert("error", mensajeDeErrorProveedor(e && e.message, "Error recargando."));
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
        setAlert("error", mensajeDeErrorProveedor(e && e.message, "Error creando proveedor."));
      }
    });
  
    refresh().catch((e) => setAlert("error", mensajeDeErrorProveedor(e && e.message, "Error cargando proveedores.")));
  }
  
  window.renderProvidersView = renderProvidersView;