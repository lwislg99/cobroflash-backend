// public/dashboard/js/customerDetailView.js
// Vista Customer 360: historial completo de un cliente

async function renderCustomer360View(container, customerId) {
  container.innerHTML = '';

  const id = Number(customerId || window.appState?.customerId360);
  if (!id) {
    container.innerHTML = '<p style="color:var(--neutral-400);padding:24px">Sin cliente seleccionado.</p>';
    return;
  }

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:20px;max-width:920px';
  container.appendChild(wrap);

  // Back button
  const backBtn = document.createElement('button');
  backBtn.className = 'btn-ghost btn-sm';
  backBtn.style.cssText = 'align-self:flex-start';
  backBtn.innerHTML = '← Volver a Clientes';
  backBtn.onclick = () => window.renderAppView && renderAppView('customers');
  wrap.appendChild(backBtn);

  const alertEl = document.createElement('div');
  alertEl.className = 'alert';
  alertEl.style.display = 'block';
  wrap.appendChild(alertEl);

  function setAlert(type, msg) {
    alertEl.textContent = msg || '';
    alertEl.className = 'alert';
    if (type === 'success') alertEl.classList.add('success');
    if (type === 'error')   alertEl.classList.add('error');
    alertEl.style.display = (msg || type) ? 'block' : 'none';
  }

  alertEl.textContent = 'Cargando…';

  let data;
  try {
    data = await apiRequest(`/admin/customers/${id}/detail`);
  } catch {
    alertEl.textContent = 'Error al cargar el historial del cliente.';
    alertEl.className = 'alert error';
    return;
  }
  alertEl.textContent = '';

  const { customer, quotes, invoices, stats, events } = data;
  const fmt = (n, cur) => fmtMoneyEs(n, cur || currency); // P-A66-3: es-ES compartido
  const currency = invoices[0]?.currency || quotes[0]?.currency || 'EUR';
  const L = window.appLocale || {};

  // ── Header del cliente ─────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'customers-card';
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap';

  const initials = (customer.name || 'C').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0">
      <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--green-500),#22d3ee);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:var(--green-900);flex-shrink:0">${initials}</div>
      <div>
        <h2 style="margin:0 0 4px;font-size:18px;font-weight:800;color:var(--neutral-900)">${escC(customer.name)}</h2>
        <div style="font-size:13px;color:var(--neutral-500);display:flex;gap:12px;flex-wrap:wrap">
          ${customer.phone ? `<span>📱 ${escC(customer.phone)}</span>` : ''}
          ${customer.email ? `<span>✉️ ${escC(customer.email)}</span>` : ''}
          <span style="color:var(--neutral-400)">Cliente desde ${new Date(customer.createdAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
        </div>
        ${customer.notes ? `<div style="font-size:12.5px;color:var(--neutral-500);margin-top:6px;font-style:italic">${escC(customer.notes)}</div>` : ''}
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0">
      <button class="btn-secondary btn-sm" id="btn-edit-360" title="Editar los datos del cliente">✎ Editar</button>
      <button class="btn-secondary btn-sm" id="btn-copy-portal-360" title="Copiar enlace del portal del cliente">
        🔗 Portal
      </button>
      <button class="btn-primary btn-sm" id="btn-new-quote-360">+ ${L.quoteNew || 'Nuevo presupuesto'}</button>
    </div>
  `;
  wrap.appendChild(header);

  // Editar cliente desde la ficha (antes solo se podía desde la lista)
  header.querySelector('#btn-edit-360').onclick = () => {
    openEdit360Modal(customer, id, container);
  };

  // SCRUM-795 · EL BOTÓN SE PINTA SIEMPRE, Y EL ENLACE SE PIDE AL PULSAR — como en la lista.
  //
  // Antes se pintaba sólo `if (customer.portalUrl)`, y el detalle sirve esa URL EN CRUDO
  // (`customersAdmin.routes.ts`: `customer.portalToken ? url : null`). Sin token el botón NO
  // EXISTÍA: no fallaba el enlace, desaparecía el botón y sin decir nada. Medido en navegador el
  // 6-sep-2026 — y los SIETE clientes del demo estaban en ese caso.
  //
  // 🔴 LA LLAMADA ES DEL CLIC, NO DEL RENDER, y ésa es la decisión entera. `/portal-url` pasa por
  // `ensurePortalToken`, que ESCRIBE. Curar al abrir la ficha convertiría el simple hecho de mirar
  // un cliente en una escritura, disparada sola y sin que nadie pulse nada. La lista ya lo resuelve
  // así desde siempre: esto pone la ficha de acuerdo con ella, no estrena un patrón.
  header.querySelector('#btn-copy-portal-360').onclick = async () => {
    const btn = header.querySelector('#btn-copy-portal-360');
    try {
      const res = await apiRequest(`/admin/customers/${id}/portal-url`);
      await navigator.clipboard.writeText(res.portalUrl).catch(() => {});
      btn.textContent = '¡Copiado!';
      setTimeout(() => { btn.innerHTML = '🔗 Portal'; }, 2000);
    } catch {
      // 🔴 SIN el `.message` del servidor, y no es una omisión: el trinquete de SCRUM-644 lo cazó
      // en mi primera versión. Un identificador como `customer_not_found` en pantalla no es un
      // mensaje mal redactado, es una tubería interna asomando a la interfaz — y el techo de este
      // fichero es CERO. El texto es el que la lista ya usa para esta misma acción
      // (`customersView.js`), sin la parte que filtra el mensaje: no estrena microcopy.
      setAlert('error', 'Error al obtener el portal');
    }
  };
  header.querySelector('#btn-new-quote-360').onclick = () => {
    if (window.renderAppView) renderAppView('quotes-new');
  };

  // ── KPIs ────────────────────────────────────────────────────────────────
  const kpiGrid = document.createElement('div');
  kpiGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px';

  // A18.3 (AB4 "deuda/pagos/presupuestos"): la DEUDA es lo primero que se ve
  const debt = (invoices || [])
    .filter((i) => String(i.status).toLowerCase() === 'pending')
    .reduce((a, i) => a + Number(i.total || 0), 0);

  const kpis = [
    { label: 'Pendiente de cobro', value: fmt(debt),
      sub: debt > 0 ? `${invoices.filter(i=>String(i.status).toLowerCase()==='pending').length} sin cobrar` : 'al día ✓',
      color: debt > 0 ? 'var(--red-600)' : 'var(--green-600)' },
    { label: `${L.quotePlural || 'Presupuestos'}`, value: stats.totalQuotes, sub: `${stats.acceptedQuotes} aceptados` },
    { label: 'Facturas',  value: invoices.length, sub: `${invoices.filter(i=>i.status==='paid').length} pagadas` },
    { label: 'Facturado', value: fmt(stats.totalBilled), sub: '' },
    { label: 'Cobrado',   value: fmt(stats.totalPaid), sub: '', color: 'var(--green-600)' },
    { label: 'Beneficio', value: fmt(stats.profit), sub: '', color: stats.profit >= 0 ? 'var(--green-600)' : 'var(--red-600)' },
  ];

  kpis.forEach(({ label, value, sub, color }) => {
    const k = document.createElement('div');
    k.className = 'kpi-card';
    k.innerHTML = `
      <div class="kpi-label">${label}</div>
      <div class="kpi-value" style="font-size:18px${color ? ';color:' + color : ''}">${value}</div>
      ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
    `;
    kpiGrid.appendChild(k);
  });
  wrap.appendChild(kpiGrid);

  // ── Actividad / historial de comunicaciones (ENT-3) ───────────────────
  if (Array.isArray(events) && events.length) {
    const actCard = document.createElement('div');
    actCard.className = 'customers-card';
    actCard.innerHTML = '<h3 style="margin:0 0 14px;font-size:13px;font-weight:700;color:var(--neutral-600);text-transform:uppercase;letter-spacing:.04em">Actividad reciente</h3>';

    const EV_ICON = {
      quote_sent: '📤', quote_accepted: '✅', quote_rejected: '✖',
      invoice_issued: '🧾', payment_received: '💰', quote_requested: '✏️',
      reminder_sent: '🔔', review_requested: '⭐',
    };
    const EV_COLOR = {
      quote_accepted: 'var(--green-600)', payment_received: 'var(--green-600)',
      quote_rejected: 'var(--red-600)',
    };

    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:0';
    events.forEach((ev, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:12px;align-items:flex-start;padding:10px 0' +
        (i < events.length - 1 ? ';border-bottom:1px solid var(--neutral-100)' : '');
      const when = new Date(ev.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      row.innerHTML = `
        <div style="flex-shrink:0;width:30px;height:30px;border-radius:50%;background:var(--neutral-50);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:14px">${EV_ICON[ev.type] || '•'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:600;color:${EV_COLOR[ev.type] || 'var(--ink)'}">${escC(ev.title)}</div>
          ${ev.detail ? `<div style="font-size:12.5px;color:var(--muted);margin-top:1px">${escC(ev.detail)}</div>` : ''}
        </div>
        <div style="flex-shrink:0;font-size:11.5px;color:var(--muted);white-space:nowrap">${escC(when)}</div>
      `;
      list.appendChild(row);
    });
    actCard.appendChild(list);
    wrap.appendChild(actCard);
  }

  // ── Tabs: Presupuestos / Facturas ─────────────────────────────────────
  const tabsWrap = document.createElement('div');
  tabsWrap.style.cssText = 'display:flex;gap:4px;border-bottom:2px solid var(--neutral-200);margin-bottom:-2px';

  const tabContent = document.createElement('div');

  function makeTab(label, key) {
    const btn = document.createElement('button');
    btn.style.cssText = 'background:none;border:none;padding:10px 16px;font-size:13.5px;font-weight:600;color:var(--neutral-400);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;font-family:inherit';
    btn.textContent = label;
    btn.dataset.key = key;
    btn.addEventListener('click', () => {
      tabsWrap.querySelectorAll('button').forEach(b => {
        b.style.color = 'var(--neutral-400)';
        b.style.borderBottomColor = 'transparent';
      });
      btn.style.color = 'var(--green-600)';
      btn.style.borderBottomColor = 'var(--green-500)';
      renderTab(key);
    });
    return btn;
  }

  const tabQuotes   = makeTab(`${L.quotePlural || 'Presupuestos'} (${quotes.length})`,   'quotes');
  const tabInvoices = makeTab(`Facturas (${invoices.length})`, 'invoices');
  tabsWrap.appendChild(tabQuotes);
  tabsWrap.appendChild(tabInvoices);
  wrap.appendChild(tabsWrap);
  wrap.appendChild(tabContent);

  const STATUS_LABELS = { draft:'Borrador', sent:'Enviado', accepted:'Aceptado', rejected:'Rechazado', pending:'Pendiente', paid:'Pagada', expired:'Caducada', pending_approval:'Pend. aprob.' };
  const STATUS_CLASS  = { accepted:'status-pill-accepted', paid:'status-pill-accepted', sent:'status-pill-pending', pending:'status-pill-pending', rejected:'status-pill-rejected', expired:'status-pill-draft', draft:'status-pill-draft', pending_approval:'status-pill-approval' };

  function renderTab(key) {
    tabContent.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'data-card';
    tabContent.appendChild(card);

    const scroll = document.createElement('div');
    scroll.className = 'table-scroll';
    card.appendChild(scroll);

    const table = document.createElement('table');
    table.className = 'table';
    scroll.appendChild(table);

    if (key === 'quotes') {
      table.innerHTML = `<thead><tr><th>ID</th><th>Fecha</th><th>Total</th><th>Estado</th><th></th></tr></thead>`;
      const tbody = document.createElement('tbody');
      if (quotes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--neutral-400);padding:24px">Sin ${L.quotePlural||'presupuestos'}</td></tr>`;
      }
      quotes.forEach(q => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight:600">#${q.quoteNumber ?? q.id}</td>
          <td style="color:var(--muted)">${new Date(q.createdAt).toLocaleDateString('es-ES')}</td>
          <td class="amount">${fmt(Number(q.total), q.currency)}</td>
          <td><span class="status-pill ${STATUS_CLASS[q.status]||'status-pill-draft'}">${STATUS_LABELS[q.status]||q.status}</span></td>
          <td><button class="btn-ghost btn-sm">Ver →</button></td>
        `;
        tr.querySelector('button').onclick = () => {
          if (window.renderAppView) {
            window.appState.quoteId = q.id;
            renderAppView('quotes-detail');
          }
        };
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
    } else {
      table.innerHTML = `<thead><tr><th>Nº</th><th>Fecha</th><th>Total</th><th>Estado</th><th></th></tr></thead>`;
      const tbody = document.createElement('tbody');
      if (invoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--neutral-400);padding:24px">Sin facturas</td></tr>`;
      }
      invoices.forEach(inv => {
        const tr = document.createElement('tr');
        const pdfCell = inv.pdfUrl && inv.pdfUrl !== 'PENDING_PDF'
          ? `<a href="${inv.pdfUrl}" target="_blank" class="btn-ghost btn-sm" style="text-decoration:none">PDF</a>`
          : '';
        tr.innerHTML = `
          <td style="font-weight:600">${escC(inv.number)}</td>
          <td style="color:var(--muted)">${new Date(inv.createdAt).toLocaleDateString('es-ES')}</td>
          <td class="amount">${fmt(Number(inv.total), inv.currency)}</td>
          <td><span class="status-pill ${STATUS_CLASS[inv.status]||'status-pill-draft'}">${STATUS_LABELS[inv.status]||inv.status}</span></td>
          <td>
            <div style="display:flex;gap:6px;align-items:center">
              ${pdfCell}
              <button class="btn-ghost btn-sm" data-iid="${inv.id}">Ver →</button>
            </div>
          </td>
        `;
        tr.querySelector(`[data-iid="${inv.id}"]`).onclick = () => {
          if (window.renderAppView) {
            window.appState.invoiceId = inv.id;
            renderAppView('invoice-detail');
          }
        };
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
    }
  }

  // Activar primer tab
  tabQuotes.style.color = 'var(--green-600)';
  tabQuotes.style.borderBottomColor = 'var(--green-500)';
  renderTab('quotes');
}

function escC(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Modal de edición desde la ficha 360 ─────────────────────────────────────
// Mismos campos que el modal de la lista (nombre/teléfono/email/notas/baja WA).
function openEdit360Modal(customer, customerId, container) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.maxWidth = '440px';
  modal.innerHTML = `
    <div class="modal-body" style="flex-direction:column;gap:10px">
      <!-- SCRUM-574 (CONT-01): hueco para el switch Empresa/Persona. Va PRIMERO porque decide qué
           campos tienen sentido debajo. El nodo se inserta después: el switch es un componente con
           comportamiento (switchFormaJuridica.js) y una plantilla de texto no puede tenerlo.
           SIN COMILLAS INVERSAS AQUÍ DENTRO: esto vive en un template literal y una comilla
           inversa lo CIERRA — el navegador descarta el fichero entero. Es el defecto histórico de
           exportView que la suite vigila en «② ROJO: backtick dentro del template». -->
      <div id="e360-forma"></div>
      <div class="field"><label>Nombre</label><input type="text" id="e360-name"/></div>
      <div class="field"><label>Teléfono (E.164 sin +)</label><input type="text" id="e360-phone"/></div>
      <div class="field"><label>Email</label><input type="email" id="e360-email"/></div>
      <div class="field"><label>Razón social (empresa, opcional)</label><input type="text" id="e360-legalname"/></div>
      <div class="field"><label>NIF/CIF (opcional)</label><input type="text" id="e360-taxid"/></div>
      <div class="field"><label>Facturación pactada</label>
        <select id="e360-periodicidad" class="input">
          <option value="NINGUNA">Cuando toque (sin periodicidad)</option>
          <option value="QUINCENAL">Cada quince días</option>
          <option value="MENSUAL">Mensual</option>
        </select>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">Solo sirve para avisarte de que toca facturarle. YaQu nunca factura ni envía nada solo — y el plazo legal manda por encima de lo que pactes.</div>
      </div>
      <div class="field"><label>Tipo de cliente</label>
        <select id="e360-tipodestinatario" class="input">
          <option value="">Sin clasificar</option>
          <option value="PARTICULAR">Particular</option>
          <option value="EMPRESARIO">Empresa / profesional</option>
        </select>
      </div>
      <div class="field"><label>Notas</label><textarea id="e360-notes" rows="3" style="resize:vertical"></textarea></div>
      <label class="inline-checkbox" style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--neutral-600)">
        <input type="checkbox" id="e360-waoptout"/> Baja de WhatsApp: no enviarle más mensajes (el cliente lo pidió)
      </label>
      <div class="alert error" id="e360-alert" style="display:none"></div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" id="e360-cancel">Cancelar</button>
      <button type="button" class="btn btn-primary" id="e360-save">Guardar cambios</button>
    </div>
  `;
  // SCRUM-446: la cabecera sale del constructor compartido.
  modal.prepend(cabeceraModal({ titulo: "Editar cliente", sinCierre: true }));
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const $ = (sel) => modal.querySelector(sel);
  $('#e360-name').value = customer.name || '';
  $('#e360-phone').value = customer.phone || '';
  $('#e360-email').value = customer.email || '';
  $('#e360-notes').value = customer.notes || '';
  $('#e360-legalname').value = customer.legalName || ''; // A20.4
  $('#e360-taxid').value = customer.taxId || '';
  $('#e360-tipodestinatario').value = customer.tipoDestinatario || ''; // SCRUM-69
  $('#e360-periodicidad').value = customer.billingPeriodicity || 'NINGUNA'; // SCRUM-171b
  $('#e360-waoptout').checked = !!customer.waOptOut;

  // SCRUM-574 (CONT-01) · el switch, en el SEGUNDO de los dos sitios que lo llevan.
  // La forma jurídica sale de `contactKind` y de NADA MÁS: nunca se deduce de `tipoDestinatario`
  // (que está tres campos más abajo y responde otra pregunta) ni de si hay razón social.
  const wrapperDe = (sel) => $(sel).closest('.field');
  const camposPorLado = { legalName: wrapperDe('#e360-legalname'), taxId: wrapperDe('#e360-taxid') };
  const switchForma = switchFormaJuridica({
    valor: customer.contactKind,
    alCambiar: (lado) => switchFormaJuridica.aplicarLado(lado, camposPorLado),
  });
  $('#e360-forma').appendChild(switchForma.nodo);
  // Después de rellenar los campos: la regla mira si «razón social» tiene algo para no esconderlo.
  switchFormaJuridica.aplicarLado(switchForma.leer(), camposPorLado);

  $('#e360-cancel').onclick = () => overlay.remove();

  function showErr(msg) {
    const a = $('#e360-alert');
    a.textContent = msg;
    a.style.display = 'block';
  }

  $('#e360-save').onclick = async () => {
    const name = $('#e360-name').value.trim();
    if (!name) { showErr('El nombre es obligatorio.'); return; }
    const phone = $('#e360-phone').value.trim();
    const email = $('#e360-email').value.trim();
    // El schema del backend valida formato: omitir vacíos en vez de mandar ""
    const payload = {
      name,
      notes: $('#e360-notes').value.trim() || undefined,
      legalName: $('#e360-legalname').value.trim() || null, // A20.4
      taxId: $('#e360-taxid').value.trim() || null,
      tipoDestinatario: $('#e360-tipodestinatario').value || null, // SCRUM-69
      // SCRUM-574: forma jurídica. `null` = sin declarar, y viaja como null: no se cae a un lado.
      // Va PEGADO a `tipoDestinatario` en el payload y son campos INDEPENDIENTES — el uno no se
      // deriva del otro ni aquí ni en ningún sitio (fundador, 24-ago-2026).
      contactKind: switchForma.leer(),
      billingPeriodicity: $('#e360-periodicidad').value || 'NINGUNA', // SCRUM-171b
      waOptOut: $('#e360-waoptout').checked,
    };
    if (phone) payload.phone = phone;
    if (email) payload.email = email;

    const btn = $('#e360-save');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      await apiRequest(`/admin/customers/${customerId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      overlay.remove();
      // Recargar la ficha con los datos nuevos
      renderCustomer360View(container, customerId);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Guardar cambios';
      showErr('No se pudo guardar: ' + (err && err.message ? err.message : 'inténtalo de nuevo'));
    }
  };
}
