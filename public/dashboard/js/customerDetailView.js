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
      // 🔴 EL LITERAL ES EL DE LA LISTA, BYTE A BYTE — no un recorte. `customersView.js:660` pinta
      // esta misma acción y su literal son 28 bytes que terminan en `: `; aquí van los 28, medidos
      // (mismo sha256). Un recorte —quitarle los dos caracteres finales para que la frase quedara
      // redonda— sería microcopy NUEVO, y la regla 30 no distingue entre inventar una frase y
      // recortar la oficial.
      //
      // ⚠️ LO QUE NO VA, Y CUESTA: la lista sigue con `+ err.message`. Este fichero NO puede
      // (SCRUM-644: techo CERO, y su segundo trinquete impide volver a la tabla del censo
      // heredado). Así que el usuario ve un `: ` sin nada detrás. Es feo y está DECLARADO:
      // se prefiere a estrenar texto por mi cuenta o a asomar `customer_not_found` a la interfaz.
      setAlert('error', 'Error al obtener el portal: ');
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

  // 🔴 SCRUM-820b · AQUÍ HABÍA UN SOLO MAPA PARA DOS DOCUMENTOS DISTINTOS, y por eso no se podía
  // arreglar el género sin romper el otro: esta ficha pinta la tabla de PRESUPUESTOS y la de
  // FACTURAS con las mismas ocho claves. Un presupuesto es «Caducado» y una factura «Caducada»;
  // con un diccionario compartido, una de las dos estaba mal por construcción.
  //
  // Y traía la forma que este ticket viene a retirar: «Pend. aprob.», la tercera redacción del
  // mismo estado. El fundador firmó que las tres se alinean con la del filtro — «si no cabe en la
  // columna, se adapta la columna, no la palabra».
  //
  // Ya no hay mapa: cada tabla lee de SU pieza (`quoteStatusMeta` / `invoiceStatusMeta`, api.js).
  // Eso quita la copia Y arregla el género de las dos a la vez, que es lo que un mapa compartido
  // impedía.

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
          <td><span class="status-pill ${window.quoteStatusMeta(q.status).pillClass}">${escC(window.quoteStatusMeta(q.status).label)}</span></td>
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
          <td><span class="status-pill ${window.invoiceStatusMeta(inv.status).pillClass}">${escC(window.invoiceStatusMeta(inv.status).label)}</span></td>
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
      <div class="field"><label>Móvil (WhatsApp)</label><input type="text" id="e360-mobile"/></div>
      <div class="field"><label>Email</label><input type="email" id="e360-email"/></div>
      <div class="field"><label>Razón social (empresa, opcional)</label><input type="text" id="e360-legalname"/></div>
      <div class="field"><label>NIF/CIF (opcional)</label><input type="text" id="e360-taxid"/></div>
      <!-- SCRUM-576 (CONT-03): hueco para el selector de empresa. El nodo se inserta después, como
           el switch: es un componente con comportamiento (switchFormaJuridica.js) y una plantilla
           de texto no puede tenerlo. SIN COMILLAS INVERSAS AQUÍ DENTRO. -->
      <div id="e360-empresa"></div>
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
  // SCRUM-590 (CONT-19): sin esta línea, editar un cliente que TIENE móvil lo enseñaría vacío.
  // Y como el vacío no viaja (ver el guardado), el profesional creería haberlo borrado sin
  // haberlo borrado — que es peor que perderlo: es mentir sobre él.
  $('#e360-mobile').value = customer.mobile || '';
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

  // SCRUM-576 (CONT-03) · el selector de empresa, en el SEGUNDO de los dos formularios.
  //
  // 🔴 SALE DE LA MISMA PIEZA que el de la lista (`switchFormaJuridica.selectorDeEmpresa`) y no de
  // una copia. Es la lección medida de `docs/CONTACTOS_CAMPOS_POR_LADO.md` §2: estos dos modales
  // YA divergieron una vez —uno tiene recargo de equivalencia y le falta facturación pactada, el
  // otro al revés— porque cada uno se editó por su lado. Un campo construido dos veces diverge.
  //
  // Aquí NO hay lista de clientes cargada: la ficha 360 sólo conoce a SU cliente. Se pide, y se
  // refresca cuando llegue — sin esperar, porque el modal ya está en pantalla. `refrescar`
  // conserva lo elegido, así que llegar tarde no desvincula a nadie.
  const selectorEmpresa = switchFormaJuridica.selectorDeEmpresa({ valor: customer.companyId ?? null });
  $('#e360-empresa').appendChild(selectorEmpresa.nodo);
  // ═══ SCRUM-590 (CONT-19) · POR QUÉ EL MÓVIL DE ESTA PANTALLA NO LLEVA SELECTOR DE PREFIJO
  //
  // El modal de la lista sí lo lleva (SCRUM-578). Aquí NO, y es una decisión con su motivo:
  //
  //  · La regla que junta y reparte prefijo + número vive DENTRO de `customersView.js`, y los
  //    guards de SCRUM-578 leen esa región del fichero para comprobarla. Sacarla a un módulo
  //    compartido los dejaría vigilando un delegador vacío —verdes sin medir— y arreglar un
  //    guard bajando lo que exige está prohibido. Copiarla aquí serían DOS sitios donde
  //    divergir, que es justo lo que este ticket ha evitado en el backend.
  //  · Y el fijo de AL LADO tampoco lo lleva: darle selector sólo al móvil dejaría dos campos
  //    del mismo tipo con dos controles distintos en el mismo formulario.
  //
  // ⚠️ LO QUE ESTO CUESTA, dicho y no escondido: aquí se puede guardar «600111222» sin prefijo, y
  // ése es un número que WhatsApp no sabe encaminar. **No es un riesgo nuevo**: es exactamente el
  // que este formulario ya tiene con `phone`, que HOY es el canal de todos los documentos. Es la
  // divergencia entre los dos formularios ya medida en `docs/CONTACTOS_CAMPOS_POR_LADO.md` §2 —
  // reportada, y de otro carril (regla 37).
  //
  // 🔴 EL CAMPO SE VE EN LOS DOS LADOS (Empresa/Persona), y por eso NO entra en este mapa:
  // `SOLO_EMPRESA` es `['legalName']` y §3.1 pone `phone` entre los comunes. Un móvil es canal
  // de contacto, no forma jurídica.
  //
  // 🔴 Y SCRUM-576 (CONT-03) AÑADE LA TERCERA ENTRADA: `companyId`, que SÍ es de un solo lado —el
  // de PERSONA—. Conviven en el mismo mapa sin contradecirse porque responden a la misma
  // pregunta desde los dos extremos: `legalName` sólo se ve en Empresa, `companyId` sólo en
  // Persona, y el móvil de arriba en los dos. La regla de quién esconde a quién no vive aquí:
  // vive en `switchFormaJuridica`, y este mapa sólo dice DÓNDE está cada campo.
  const camposPorLado = {
    legalName: wrapperDe('#e360-legalname'),
    taxId: wrapperDe('#e360-taxid'),
    companyId: selectorEmpresa.nodo, // SCRUM-576: el campo del lado PERSONA
  };
  const switchForma = switchFormaJuridica({
    valor: customer.contactKind,
    alCambiar: (lado) => switchFormaJuridica.aplicarLado(lado, camposPorLado),
  });
  $('#e360-forma').appendChild(switchForma.nodo);
  // Después de rellenar los campos: la regla mira si «razón social» tiene algo para no esconderlo.
  switchFormaJuridica.aplicarLado(switchForma.leer(), camposPorLado);

  // SCRUM-576 · la lista de empresas llega DESPUÉS, y va aquí abajo a propósito: usa
  // `switchForma` y `camposPorLado`, que se declaran justo encima. Ponerlo antes funcionaría
  // —el `.then` no corre hasta que el turno síncrono acaba— pero obligaría a razonar sobre
  // microtareas para leer cuatro líneas.
  getCustomers("")
    .then((lista) => {
      selectorEmpresa.refrescar(lista, customer.id);
      // Repasa la regla: el campo pudo pasar de vacío a con valor, y un valor escrito no se
      // esconde nunca (invariante ② de `switchFormaJuridica`).
      switchFormaJuridica.aplicarLado(switchForma.leer(), camposPorLado);
    })
    .catch(() => { /* el campo es opcional: sin lista se queda con lo que ya tenía */ });

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
    const mobile = $('#e360-mobile').value.trim(); // SCRUM-590 (CONT-19)
    const email = $('#e360-email').value.trim();
    // El schema del backend valida formato: omitir vacíos en vez de mandar ""
    const payload = {
      name,
      notes: $('#e360-notes').value.trim() || undefined,
      legalName: $('#e360-legalname').value.trim() || null, // A20.4
      taxId: $('#e360-taxid').value.trim() || null,
      // SCRUM-576 (CONT-03): «sin empresa» viaja como `null`, nunca `""` ni `0`.
      companyId: selectorEmpresa.leer(),
      tipoDestinatario: $('#e360-tipodestinatario').value || null, // SCRUM-69
      // SCRUM-574: forma jurídica. `null` = sin declarar, y viaja como null: no se cae a un lado.
      // Va PEGADO a `tipoDestinatario` en el payload y son campos INDEPENDIENTES — el uno no se
      // deriva del otro ni aquí ni en ningún sitio (fundador, 24-ago-2026).
      contactKind: switchForma.leer(),
      billingPeriodicity: $('#e360-periodicidad').value || 'NINGUNA', // SCRUM-171b
      waOptOut: $('#e360-waoptout').checked,
    };
    if (phone) payload.phone = phone;
    // ═══ 🔴 SCRUM-590 (CONT-19) · EL MÓVIL SÓLO VIAJA SI HAY MÓVIL ══════════════════════════
    //
    // Misma regla que sus vecinos, y aquí NO es estilo. Medido ejecutando `customerCreateSchema`:
    // `mobile: ""` RECHAZA («>=5 characters») y `mobile: null` RECHAZA («expected string»); sólo
    // ausente pasa. Mandar el vacío haría que guardar un cliente SIN móvil devolviera un 400: un
    // campo opcional que rompe el guardado del cliente entero se ha vuelto obligatorio de rebote.
    //
    // Consecuencia, dicha en vez de descubierta: vaciar el móvil de un cliente que lo tiene NO lo
    // borra. Es la limitación que ya tienen `phone` y `email` en esta misma pantalla — se hereda,
    // no se estrena — y se cierra el día que el esquema acepte `null` en los tres a la vez.
    if (mobile) payload.mobile = mobile;
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
