// public/dashboard/js/expensesView.js

const CATEGORY_LABELS = {
  materiales:     { label: 'Materiales',      color: '#2563eb', bg: '#dbeafe' },
  desplazamiento: { label: 'Desplazamiento',  color: '#d97706', bg: '#fef3c7' },
  herramientas:   { label: 'Herramientas',    color: '#7c3aed', bg: '#ede9fe' },
  subcontrata:    { label: 'Subcontrata',     color: '#dc2626', bg: '#fee2e2' },
  otros:          { label: 'Otros',           color: 'var(--neutral-600)', bg: 'var(--neutral-100)' },
};

function catPill(category) {
  const c = CATEGORY_LABELS[category] || CATEGORY_LABELS.otros;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:${c.bg};color:${c.color}">${c.label}</span>`;
}

// ── SCRUM-135: selector de Trabajos ───────────────────────────────────────────
// OJO AL MODELO (hallazgo del recon): el gasto se vincula por `Expense.quoteId` → COTIZACIÓN,
// mientras que lo que el pro ve en pantalla es el TRABAJO (`Job`), que tiene su PROPIO id.
// Job#57 y Cotización#57 son registros distintos. Antes había un input numérico rotulado "ID
// de la cotización" con un texto de ayuda que decía "vincula este gasto a un trabajo": quien
// leía "Trabajo #57" y tecleaba 57 vinculaba el gasto a otra cosa, en silencio.
// El selector resuelve el quoteId DESDE el Job, así que el valor guardado no cambia (aditivo,
// cero migración) pero el pro ya solo elige Trabajos por su nombre.
const JOB_CERRADO = 'cerrado'; // "abiertos" = todos menos este (decisión del fundador)

// El trabajo se nombra EXACTAMENTE como en la pantalla de Trabajos: su `titulo` y nada más.
// Sin prefijo con el id: jobsView.js no enseña el id del Job en ningún sitio, así que
// anteponerlo metería un número que el pro no ha visto nunca — y encima pegado al
// "Presupuesto #N" que ya lleva el título por defecto. Tres números distintos para una cosa
// es justo el lío que este ticket viene a quitar, no a mover de sitio.
function jobLabel(job) {
  return job.titulo || 'Trabajo';
}

// Un Job sin cotización (Job.quoteId es nullable) NO se puede vincular: no hay quoteId que
// guardar. Se muestra DESHABILITADO con el motivo, no se esconde — criterio de SCRUM-89:
// que el pro sepa por qué no puede, en vez de buscar un trabajo que no aparece.
function jobOptionsHtml(jobs, currentQuoteId) {
  const abiertos = (jobs || []).filter((j) => j.status !== JOB_CERRADO);
  const cur = currentQuoteId != null ? Number(currentQuoteId) : null;
  let hayActualEnLista = false;

  const opts = abiertos.map((j) => {
    const qId = j.quote?.id ?? null;
    const label = jobLabel(j);
    if (qId == null) {
      return `<option value="" disabled>${escHtml(label)} — sin presupuesto, no se puede vincular</option>`;
    }
    if (cur != null && Number(qId) === cur) hayActualEnLista = true;
    return `<option value="${qId}"${cur != null && Number(qId) === cur ? ' selected' : ''}>${escHtml(label)}</option>`;
  });

  // El gasto que estás editando puede apuntar a un trabajo CERRADO (o a una cotización que
  // nunca llegó a ser trabajo). Si no ofreciéramos esa opción, abrir el modal y guardar
  // movería la vinculación sin que nadie lo pidiera. Se conserva, marcada.
  if (cur != null && !hayActualEnLista) {
    opts.unshift(`<option value="${cur}" selected>Vinculación actual (trabajo cerrado o sin trabajo abierto)</option>`);
  }

  return `<option value="">— Sin trabajo —</option>` + opts.join('');
}

// Celda "Trabajo" de la lista de gastos. Con Job → su nombre y enlace a SU ficha. Sin Job
// (gasto vinculado a un presupuesto que nunca se aceptó) → se dice tal cual y se enlaza al
// presupuesto: mejor nombrar lo que hay que fingir un trabajo que no existe.
function expenseJobCell(expense) {
  if (expense.job) {
    return `<a href="#" onclick="event.stopPropagation();renderAppView('jobs-detail',{jobId:${expense.job.id}})" style="color:var(--blue-600)">${escHtml(jobLabel(expense.job))}</a>`;
  }
  const qId = Number(expense.quote.id);
  return `<a href="#" onclick="event.stopPropagation();renderAppView('quotes-detail',{quoteId:${qId}})" style="color:var(--blue-600)">Presupuesto sin trabajo</a>`;
}

async function renderExpensesView(container) {
  container.innerHTML = `
    <div>
      <!-- Cabecera -->
      <div style="margin-bottom:16px">
        <h2 style="margin:0;font-size:18px">Gastos</h2>
        <p style="margin:2px 0 0;font-size:13px;color:var(--muted)">Controla tus costes y vincúlalos a trabajos para ver el margen real.</p>
      </div>

      <!-- Resumen mensual -->
      <div id="exp-summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
        <div class="kpi-card"><div class="kpi-label">Cargando…</div></div>
        <div class="kpi-card"><div class="kpi-label"></div></div>
        <div class="kpi-card"><div class="kpi-label"></div></div>
      </div>

      <!-- Filtros y botón nuevo -->
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
        <select id="exp-filter-month" class="input" style="width:auto">
          ${getMonthOptions()}
        </select>
        <select id="exp-filter-cat" class="input" style="width:auto">
          <option value="">Todas las categorías</option>
          ${Object.entries(CATEGORY_LABELS).map(([v,c]) => `<option value="${v}">${c.label}</option>`).join('')}
        </select>
        <button class="btn-primary" id="exp-new-btn" style="margin-left:auto">+ Nuevo gasto</button>
        <a id="exp-export-btn" href="/admin/exports/expenses.csv" class="btn-secondary btn-sm" style="text-decoration:none" title="Exportar gastos filtrados a CSV">⬇ CSV</a>
      </div>

      <!-- Lista -->
      <div id="exp-list"><div style="color:var(--muted);font-size:14px">Cargando gastos…</div></div>
    </div>
  `;

  document.getElementById('exp-new-btn').addEventListener('click', () => openExpenseModal(null));

  /**
   * SCRUM-324 (E3) · MICROCOPY OFICIAL, aprobada por el fundador el 10-ago-2026.
   *
   * No se toca ni se parafrasea (regla 30). Se eligió sobre otras tres, y el motivo importa para
   * quien venga a cambiarla:
   *
   *   · «no puedes deducir este gasto» sería FALSO POR EXCESO — un ticket sí puede ser gasto
   *     deducible en IRPF en estimación directa, que es otra cosa y otro importe;
   *   · «para que tu asesor pueda usar este gasto» esconde lo que está en juego. El profesional
   *     merece saber que lo que pierde es EL IVA, que es dinero suyo y es cuantificable.
   *
   * Por eso dice exactamente qué se pierde («el IVA»), no afirma nada falso, y la acción está en su
   * vocabulario: el almacén, a tu nombre, desglosado.
   */
  const AVISO_SIMPLIFICADO = 'Con un ticket no puedes deducir el IVA. Pide en el almacén una '
    + 'factura a tu nombre, con tu NIF y el IVA desglosado.';

  function updateExportLink() {
    const monthSel = document.getElementById('exp-filter-month');
    const catSel   = document.getElementById('exp-filter-cat');
    const expBtn   = document.getElementById('exp-export-btn');
    if (!monthSel || !expBtn) return;
    const [y, m] = (monthSel.value || '').split('-');
    const params = new URLSearchParams();
    if (y && m) {
      params.set('from', `${y}-${m}-01`);
      const lastDay = new Date(Number(y), Number(m), 0).getDate();
      params.set('to', `${y}-${m}-${lastDay}`);
    }
    if (catSel && catSel.value) params.set('category', catSel.value);
    expBtn.href = `/admin/exports/expenses.csv?${params.toString()}`;
  }

  document.getElementById('exp-filter-month').addEventListener('change', () => { updateExportLink(); loadExpenses(); });
  document.getElementById('exp-filter-cat').addEventListener('change',   () => { updateExportLink(); loadExpenses(); });
  updateExportLink();

  await Promise.all([loadSummary(), loadExpenses()]);
}

function getMonthOptions() {
  const now = new Date();
  const months = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('es', { month: 'long', year: 'numeric' });
    months.push(`<option value="${val}"${i===0?' selected':''}>${label}</option>`);
  }
  return months.join('');
}

async function loadSummary() {
  const month = document.getElementById('exp-filter-month')?.value || '';
  try {
    const data = await apiRequest(`/admin/expenses/summary?month=${month}`);
    const el = document.getElementById('exp-summary');
    if (!el) return;
    el.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-label">Gasto del mes</div>
        <div class="kpi-value">${fmtEuro(data.totalAmount)}</div>
        <div class="kpi-sub">${data.byCategory?.length || 0} categoría${data.byCategory?.length!==1?'s':''}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Sin asignar a trabajo</div>
        <div class="kpi-value" style="color:${data.unassignedAmount>0?'#d97706':'#22c55e'}">${fmtEuro(data.unassignedAmount)}</div>
        <div class="kpi-sub">no vinculados a un trabajo</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Mayor categoría</div>
        <div class="kpi-value" style="font-size:16px">${topCat(data.byCategory)}</div>
        <div class="kpi-sub">&nbsp;</div>
      </div>
    `;
  } catch {}
}

function topCat(cats) {
  if (!cats || !cats.length) return '—';
  const top = cats.sort((a,b) => b.amount - a.amount)[0];
  return CATEGORY_LABELS[top.category]?.label || top.category;
}

async function loadExpenses() {
  const month = document.getElementById('exp-filter-month')?.value || '';
  const cat   = document.getElementById('exp-filter-cat')?.value   || '';
  const el = document.getElementById('exp-list');
  if (!el) return;
  uiSkeletonCards(el, 4); // A6.2: esqueleto en vez de "Cargando…"
  try {
    const qs = new URLSearchParams({ month });
    if (cat) qs.set('category', cat);
    // SCRUM-135: el trabajo de cada gasto viene YA resuelto en `item.job` (una sola query en
    // listExpenses). Nada de pedir /admin/jobs aquí: eso dejaba la lista esperando por el
    // endpoint más lento solo para poder nombrar la columna.
    const data = await apiRequest(`/admin/expenses?${qs}`);
    const items = data.items || [];

    if (!items.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🧾</div>'
        + '<div class="empty-state-title">Sin gastos este mes</div>'
        + '<div class="empty-state-desc">Registra materiales, desplazamientos y subcontratas para conocer el margen real de cada trabajo.</div>'
        + '<button id="exp-empty-cta" class="btn-primary btn-sm" style="margin-top:14px">+ Añadir mi primer gasto</button></div>';
      const cta = document.getElementById('exp-empty-cta');
      if (cta) cta.addEventListener('click', () => openExpenseModal(null));
      return;
    }

    el.innerHTML = `
      <div class="table-scroll" style="margin-top:4px">
        <table class="table" style="min-width:600px">
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Categoría</th>
              <th>Trabajo</th>
              <th style="text-align:right">Importe</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${items.map((e) => `
              <tr style="cursor:pointer" onclick="openExpenseModal(${JSON.stringify(e).replace(/"/g,'&quot;')})">
                <td>
                  <div style="font-weight:600;color:var(--neutral-800)">${escHtml(e.concept)}</div>
                  ${e.notes ? `<div style="font-size:12px;color:var(--neutral-400)">${escHtml(e.notes)}</div>` : ''}
                  <div style="font-size:11px;color:var(--neutral-400)">${new Date(e.date).toLocaleDateString('es',{day:'2-digit',month:'short'})}</div>
                </td>
                <td>${catPill(e.category)}</td>
                <td style="font-size:13px;color:var(--neutral-500)">
                  ${e.quote ? expenseJobCell(e) : '—'}
                  ${e.provider ? `<div style="font-size:12px">${escHtml(e.provider.name)}</div>` : ''}
                </td>
                <td class="amount" style="text-align:right;font-size:15px">${fmtEuro(Number(e.amount))}</td>
                <td style="text-align:center">
                  <button class="btn-icon" onclick="event.stopPropagation();deleteExpenseItem(${e.id})" title="Eliminar">🗑</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div style="color:var(--red-600);font-size:14px">Error: ${err.message}</div>`;
  }
}

async function deleteExpenseItem(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  try {
    await apiRequest(`/admin/expenses/${id}`, { method: 'DELETE' });
    await Promise.all([loadSummary(), loadExpenses()]);
  } catch (err) {
    showToast('No se pudo eliminar: ' + err.message, 'error');
  }
}

// opts (SCRUM-135, ambos opcionales — sin ellos el modal se comporta igual que antes):
//   opts.job     → { id, quoteId, titulo } : abre el gasto YA vinculado a ESE trabajo y sin
//                  selector (es el alta desde la ficha del Trabajo: no se pregunta lo que ya
//                  se sabe). Es el camino del técnico en obra.
//   opts.onSaved → qué recargar al guardar. Por defecto recarga la vista de Gastos, que es
//                  lo que hacía antes; desde el detalle del Trabajo no existe esa vista.
function openExpenseModal(expense, opts) {
  if (document.getElementById('exp-modal')) return;

  const o = opts || {};
  const fixedJob = o.job || null;
  const isEdit = !!expense;
  const today = new Date().toISOString().slice(0, 10);

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-overlay';
  backdrop.id = 'exp-modal';
  backdrop.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <span class="modal-title">${isEdit ? 'Editar gasto' : 'Nuevo gasto'}</span>
        <button class="modal-close" id="exp-close">&times;</button>
      </div>
      <div class="modal-body" style="gap:12px">
        <div class="field">
          <label>Concepto *</label>
          <input id="exp-concept" type="text" placeholder="Ej: Tubería PVC 20mm" value="${escHtml(expense?.concept||'')}"/>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="field">
            <label>Importe *</label>
            <input id="exp-amount" type="number" min="0" step="0.01" placeholder="0.00" value="${expense?.amount||''}"/>
          </div>
          <div class="field">
            <label>Fecha</label>
            <input id="exp-date" type="date" value="${expense ? new Date(expense.date).toISOString().slice(0,10) : today}"/>
          </div>
        </div>
        <div class="field">
          <label>Categoría</label>
          <select id="exp-category">
            ${Object.entries(CATEGORY_LABELS).map(([v,c]) =>
              `<option value="${v}"${expense?.category===v?' selected':''}>${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Trabajo (opcional)</label>
          ${fixedJob
            ? `<div id="exp-job-fixed" data-quote-id="${fixedJob.quoteId}" style="padding:11px 13px;border:1px solid var(--neutral-200);border-radius:var(--r-md);background:var(--neutral-50);font-size:14px;color:var(--ink)">${escHtml(jobLabel(fixedJob))}</div>`
            : `<select id="exp-quoteid"><option value="">Cargando trabajos…</option></select>`}
          <p style="font-size:12px;color:var(--neutral-400);margin:2px 0 0">Vincula este gasto a un trabajo para calcular el margen.</p>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="field">
            <label>Proveedor (opcional)</label>
            <select id="exp-providerid"><option value="">Cargando proveedores…</option></select>
          </div>
          <div class="field">
            <!-- SCRUM-324 (E3) · el tercero de los tres campos del momento. Se teclea aquí y se
                 guarda en la ficha del proveedor, que es donde vive: en el almacén no se entra a
                 una ficha. Si el proveedor ya tenía NIF, este campo lo muestra y no lo pisa. -->
            <label>NIF del proveedor</label>
            <input id="exp-provider-nif" type="text" inputmode="text" autocapitalize="characters"
                   placeholder="B12345678" value="${escHtml(expense?.provider?.taxId||'')}"/>
          </div>
        </div>
        <div class="field">
          <label>Notas</label>
          <textarea id="exp-notes" placeholder="Detalles adicionales…" style="height:60px;resize:vertical">${expense?.notes||''}</textarea>
        </div>
        <div class="field" id="exp-receipt-section">
          <label>Foto del ticket (opcional)</label>
          ${expense?.receiptData ? `<img src="${expense.receiptData}" style="max-width:100%;max-height:120px;border-radius:8px;object-fit:contain;border:1px solid var(--neutral-200);margin-bottom:6px"/>` : ''}
          <input type="file" id="exp-receipt" accept="image/*" style="font-size:13px"/>
        </div>
        <div id="exp-error" class="alert error" style="display:none"></div>
        <!-- SCRUM-324 (E3) · el aviso del simplificado. Vacío hasta que el servidor clasifique:
             el veredicto "falta confirmar" NO pinta nada, porque acusar sin saber es tan inútil
             como callar. (Sin acentos graves aquí dentro: esto vive en un template literal.) -->
        <div id="exp-aviso-iva" class="alert warning" style="display:none"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="exp-cancel">Cancelar</button>
        <button class="btn btn-primary" id="exp-save">${isEdit ? 'Guardar cambios' : 'Añadir gasto'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  document.getElementById('exp-close').addEventListener('click', closeExpModal);
  document.getElementById('exp-cancel').addEventListener('click', closeExpModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeExpModal(); });

  // SCRUM-324 (E3): los proveedores, por su nombre y no por un id numérico. Antes había que
  // teclear «ID del proveedor» — de pie en un almacén, nadie se sabe el 47. Mismo patrón que el
  // selector de trabajos, incluido el fallo: si la lista no carga NO se deja un desplegable vacío
  // que borre la vinculación al guardar.
  const provSel = document.getElementById('exp-providerid');
  const nifInput = document.getElementById('exp-provider-nif');
  if (provSel) {
    const actualProv = expense?.provider?.id ?? expense?.providerId ?? null;
    apiRequest('/admin/providers')
      .then((r) => {
        if (!document.getElementById('exp-modal')) return;
        const lista = Array.isArray(r) ? r : (r?.items || []);
        provSel.innerHTML = '<option value="">— Sin proveedor —</option>'
          + lista.map((pr) => `<option value="${pr.id}" data-nif="${escHtml(pr.taxId || '')}"`
            + `${pr.id === actualProv ? ' selected' : ''}>${escHtml(pr.name)}</option>`).join('');
        // Al elegir proveedor, su NIF se rellena solo: el que ya está guardado manda sobre lo que
        // se teclee con prisa, y así el usuario ve que ese proveedor ya está resuelto.
        provSel.addEventListener('change', () => {
          const op = provSel.selectedOptions[0];
          const nif = op ? (op.dataset.nif || '') : '';
          if (nif) { nifInput.value = nif; nifInput.readOnly = true; }
          else if (nifInput.readOnly) { nifInput.value = ''; nifInput.readOnly = false; }
        });
        provSel.dispatchEvent(new Event('change'));
      })
      .catch(() => {
        if (!document.getElementById('exp-modal')) return;
        provSel.innerHTML = actualProv != null
          ? `<option value="${actualProv}" selected>Proveedor actual (no se pudo cargar la lista)</option>`
          : '<option value="">No se pudo cargar la lista de proveedores</option>';
      });
  }

  // SCRUM-135: los Trabajos se piden a /admin/jobs (endpoint YA existente; para un técnico
  // viene filtrado a los suyos por SCRUM-23, así que el selector nunca enseña trabajo ajeno).
  // Se rellena DESPUÉS de pintar el modal: el formulario se puede empezar a rellenar mientras.
  const jobSel = document.getElementById('exp-quoteid');
  if (jobSel) {
    const actual = expense?.quote?.id ?? expense?.quoteId ?? null;
    apiRequest('/admin/jobs')
      .then((jobs) => {
        if (!document.getElementById('exp-modal')) return; // lo cerró antes de que llegara
        jobSel.innerHTML = jobOptionsHtml(Array.isArray(jobs) ? jobs : [], actual);
      })
      .catch(() => {
        if (!document.getElementById('exp-modal')) return;
        // Fallo al cargar la lista: NO se deja un desplegable vacío que borre la vinculación
        // al guardar. Se conserva la actual y se dice qué ha pasado.
        jobSel.innerHTML = actual != null
          ? `<option value="${actual}" selected>Vinculación actual (no se pudo cargar la lista)</option>`
          : `<option value="">— Sin trabajo — (no se pudo cargar la lista)</option>`;
      });
  }

  document.getElementById('exp-save').addEventListener('click', async () => {
    const concept    = document.getElementById('exp-concept').value.trim();
    const amount     = Number(document.getElementById('exp-amount').value);
    const date       = document.getElementById('exp-date').value;
    const category   = document.getElementById('exp-category').value;
    // SCRUM-135: o el selector, o el trabajo fijo cuando se abre desde su ficha.
    const quoteId    = fixedJob
      ? String(fixedJob.quoteId ?? '')
      : document.getElementById('exp-quoteid').value;
    const providerId = document.getElementById('exp-providerid').value;
    const notes      = document.getElementById('exp-notes').value.trim();
    const fileInput  = document.getElementById('exp-receipt');

    if (!concept) { showExpError('El concepto es obligatorio.'); return; }
    if (!amount || amount <= 0) { showExpError('El importe debe ser mayor que 0.'); return; }

    const btn = document.getElementById('exp-save');
    btn.disabled = true; btn.textContent = 'Guardando…';

    try {
      // Leer foto si se seleccionó
      let receiptData = expense?.receiptData || null;
      if (fileInput.files && fileInput.files[0]) {
        receiptData = await fileToBase64(fileInput.files[0]);
      }

      const payload = {
        concept, amount, date, category, notes: notes || null,
        quoteId: quoteId ? Number(quoteId) : null,
        providerId: providerId ? Number(providerId) : null,
        nifProveedor: document.getElementById('exp-provider-nif').value.trim() || null,
        receiptData,
        currency: window.appLocale?.currency || 'EUR',
      };

      let creado = null;
      if (isEdit) {
        await apiRequest(`/admin/expenses/${expense.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        creado = await apiRequest('/admin/expenses', { method: 'POST', body: JSON.stringify(payload) });
      }

      // SCRUM-324 (E3) · EL AVISO ES EL PRODUCTO, no un adorno del guardado.
      //
      // El ahorro no está en guardar la foto: está en que la PRÓXIMA vez pida la factura bien. Por
      // eso el modal NO se cierra solo cuando el justificante no deduce — si se cerrara, el aviso
      // sería un toast que se va antes de que nadie lo lea, y habríamos guardado un ticket inútil
      // con la sensación de haber hecho el trabajo.
      //
      // ⚠️ SOLO con `no_deducible`. Con `falta_confirmar` NO se pinta nada: es el caso en que todo
      // lo comprobable está y solo queda mirar el papel, y avisar ahí sería acusar sin saber. Un
      // aviso que salta siempre se aprende a ignorar igual que uno que no salta nunca.
      if (creado?.justificante?.veredicto === 'no_deducible') {
        const aviso = document.getElementById('exp-aviso-iva');
        if (aviso) {
          aviso.textContent = AVISO_SIMPLIFICADO;
          aviso.style.display = '';
          btn.disabled = false;
          btn.textContent = 'Entendido';
          btn.onclick = async () => {
            closeExpModal();
            if (o.onSaved) await o.onSaved();
            else await Promise.all([loadSummary(), loadExpenses()]);
          };
          return;
        }
      }

      closeExpModal();
      // SCRUM-135: desde el detalle del Trabajo no existe la vista de Gastos que recargar
      // (y para un técnico esas dos llamadas son 403). El llamador dice qué refrescar.
      if (o.onSaved) await o.onSaved();
      else await Promise.all([loadSummary(), loadExpenses()]);
    } catch (err) {
      showExpError(err.message || 'Error al guardar.');
      btn.disabled = false; btn.textContent = isEdit ? 'Guardar cambios' : 'Añadir gasto';
    }
  });
}

function closeExpModal() {
  document.getElementById('exp-modal')?.remove();
}

function showExpError(msg) {
  const el = document.getElementById('exp-error');
  if (el) { el.textContent = msg; el.className = 'alert error'; el.style.display = 'block'; }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// P-A66-3: delega en el formateador es-ES compartido (api.js)
function fmtEuro(amount) {
  return fmtMoneyEs(amount, (window.appLocale && window.appLocale.currency) || 'EUR');
}

function escHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (s) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s]
  );
}
