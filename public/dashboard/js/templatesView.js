// public/dashboard/js/templatesView.js
// Vista para gestionar plantillas de presupuesto guardadas.

async function renderTemplatesView(container) {
  container.innerHTML = '';

  // SCRUM-432 (B1 · incremento 3): la MISMA tira que el historial. Sin ella aquí, entrar en
  // Plantillas sería un callejón: la pestaña llevaría a una pantalla sin forma de volver.
  renderPestanasPresupuestos(container, 'templates');

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:20px;max-width:860px';
  container.appendChild(wrap);

  // ── Header ──────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'data-card-header customers-card';
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap';
  header.innerHTML = `
    <div>
      <h2 style="margin:0 0 4px;font-size:17px;font-weight:700;color:var(--neutral-900)">Plantillas de presupuesto</h2>
      <p style="margin:0;font-size:13px;color:var(--neutral-400)">Guarda trabajos frecuentes como plantillas para crear presupuestos más rápido.</p>
    </div>
    <a href="#" onclick="window.renderAppView&&renderAppView('quotes-new');return false" class="btn-primary btn-sm">+ Nuevo presupuesto</a>
  `;
  wrap.appendChild(header);

  const alertEl = document.createElement('div');
  alertEl.className = 'alert';
  alertEl.style.display = 'none';
  wrap.appendChild(alertEl);

  function setAlert(type, msg) {
    alertEl.textContent = msg || '';
    alertEl.className = 'alert';
    if (type === 'success') alertEl.classList.add('success');
    if (type === 'error')   alertEl.classList.add('error');
    alertEl.style.display = (type || msg) ? 'block' : 'none';
  }

  // ── Tabla ────────────────────────────────────────────────────────────────
  const tableCard = document.createElement('div');
  tableCard.className = 'data-card';
  wrap.appendChild(tableCard);

  const tableScroll = document.createElement('div');
  tableScroll.className = 'table-scroll';
  tableCard.appendChild(tableScroll);

  const table = document.createElement('table');
  table.className = 'table table--stack-mobile'; // feedback fundador 6-jul
  tableScroll.appendChild(table);

  async function loadTemplates() {
    table.innerHTML = `<thead><tr>
      <th>Nombre</th>
      <th>Líneas</th>
      <th>Moneda</th>
      <th>Actualizada</th>
      <th style="width:160px"></th>
    </tr></thead>`;

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    let templates;
    try {
      templates = await apiRequest('/admin/templates');
    } catch {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--neutral-400);padding:32px">Error al cargar las plantillas.</td></tr>`;
      return;
    }

    if (!templates || templates.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-state">
              <div class="empty-state-icon">📋</div>
              <div class="empty-state-title">Sin plantillas</div>
              <div class="empty-state-desc">Abre un presupuesto, rellena las líneas y pulsa "💾 Guardar como plantilla".</div>
            </div>
          </td>
        </tr>`;
      return;
    }

    templates.forEach(function (tpl) {
      const lineCount = Array.isArray(tpl.lines) ? tpl.lines.length : 0;
      const updated   = new Date(tpl.updatedAt).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' });

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="cell-title">
          <span>${escTpl(tpl.name)}</span>
          ${lineCount > 0 ? `<div style="font-size:11.5px;color:var(--neutral-400);margin-top:2px;font-weight:400">${(tpl.lines).slice(0,3).map(l=>escTpl(l.concept||'')).join(' · ')}${lineCount>3?'…':''}</div>` : ''}
        </td>
        <td><span class="status-pill status-pill-draft">${lineCount} línea${lineCount!==1?'s':''}</span></td>
        <td class="col-hide-mobile" style="color:var(--neutral-500)">${escTpl(tpl.currency)}</td>
        <td style="color:var(--neutral-400);font-size:12.5px">${updated}</td>
        <td class="cell-actions"></td>
      `;

      const actionsCell = tr.querySelector('td:last-child');
      const actDiv = document.createElement('div');
      actDiv.style.cssText = 'display:flex;gap:6px;justify-content:flex-end';

      // Usar plantilla → ir a nuevo presupuesto
      const btnUse = document.createElement('button');
      btnUse.className = 'btn-primary btn-sm';
      btnUse.textContent = '📋 Usar';
      btnUse.onclick = () => {
        // SCRUM-140: la plantilla va como ARGUMENTO de la navegación. Antes viajaba por
        // `sessionStorage['pf_load_template']` y el ORDEN importaba: SCRUM-134 tuvo que arreglar
        // aquí un off-by-one (se navegaba ANTES de escribir, y como el editor lee SÍNCRONO dentro
        // de esa misma navegación, abría la plantilla de la vez anterior). Con un argumento no
        // hay "antes" ni "después" que respetar — la clase entera desaparece.
        if (window.renderAppView) renderAppView('quotes-new', { template: tpl });
      };
      actDiv.appendChild(btnUse);

      // Renombrar
      const btnRename = document.createElement('button');
      btnRename.className = 'btn-ghost btn-sm';
      btnRename.textContent = 'Renombrar';
      btnRename.onclick = () => showRenameModal(tpl, loadTemplates, setAlert);
      actDiv.appendChild(btnRename);

      // Borrar
      const btnDel = document.createElement('button');
      btnDel.className = 'btn-danger btn-sm';
      btnDel.textContent = 'Borrar';
      btnDel.onclick = async () => {
        if (!confirm(`¿Borrar la plantilla "${tpl.name}"? Esta acción no se puede deshacer.`)) return;
        btnDel.disabled = true;
        try {
          await apiRequest(`/admin/templates/${tpl.id}`, { method: 'DELETE' });
          setAlert('success', `Plantilla "${tpl.name}" eliminada.`);
          await loadTemplates();
        } catch {
          setAlert('error', 'Error al borrar la plantilla.');
          btnDel.disabled = false;
        }
      };
      actDiv.appendChild(btnDel);

      actionsCell.appendChild(actDiv);
      tbody.appendChild(tr);
    });
  }

  await loadTemplates();
}

function showRenameModal(tpl, onSuccess, setAlert) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:380px">
      <div class="modal-body">
        <div class="field">
          <label>Nombre</label>
          <input type="text" id="rename-tpl-input" value="${escTpl(tpl.name)}" />
        </div>
        <button class="btn-primary" id="rename-tpl-btn" style="width:100%;margin-top:4px">Guardar</button>
      </div>
    </div>
  `;
  // SCRUM-446: la cabecera sale del constructor compartido.
  overlay.querySelector('.modal').prepend(cabeceraModal({ titulo: "Renombrar plantilla", idCierre: "rename-tpl-close" }));
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#rename-tpl-close').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const input = overlay.querySelector('#rename-tpl-input');
  const btn   = overlay.querySelector('#rename-tpl-btn');
  setTimeout(() => { input.focus(); input.select(); }, 80);

  const save = async () => {
    const name = input.value.trim();
    if (!name) return;
    btn.disabled = true;
    try {
      await apiRequest(`/admin/templates/${tpl.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      });
      close();
      setAlert('success', 'Plantilla renombrada.');
      await onSuccess();
    } catch {
      setAlert('error', 'Error al renombrar.');
      btn.disabled = false;
    }
  };

  btn.onclick = save;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
}

function escTpl(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
