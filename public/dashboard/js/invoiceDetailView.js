// public/dashboard/js/invoiceDetailView.js

async function fetchInvoiceDetail(id) {
    const res = await fetch(`/admin/invoices/${id}`, {
      headers: { Accept: 'application/json' },
    });
  
    if (!res.ok) {
      throw new Error('Error cargando detalle de factura');
    }
  
    return res.json();
  }
  
  async function renderInvoiceDetailView(container, invoiceId) {
    container.innerHTML = '';
  
    const rawId = Number(invoiceId);
    if (!Number.isFinite(rawId)) {
      container.innerHTML = '<p>ID de factura no válido.</p>';
      return;
    }
  
    const fmtInvMoney = (amount, currency) => {
      const cur = currency || (window.appLocale && window.appLocale.currency) || 'EUR';
      return Number(amount || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cur;
    };

    const page = document.createElement('div');
    page.className = 'detail-page';
    container.appendChild(page);

    // Cabecera
    const header = document.createElement('div');
    header.className = 'detail-head';
    page.appendChild(header);

    const left = document.createElement('div');
    left.innerHTML = '<h2>Factura</h2><p class="detail-sub">Detalle y acciones de la factura.</p>';
    header.appendChild(left);

    const btnBack = document.createElement('button');
    btnBack.className = 'btn-secondary btn-sm';
    btnBack.textContent = '← Volver a facturas';
    btnBack.addEventListener('click', () => {
      if (window.renderAppView) window.renderAppView('invoices');
    });
    header.appendChild(btnBack);

    const statusBox = document.createElement('div');
    statusBox.className = 'alert';
    statusBox.style.cssText = 'margin:14px 22px 0;display:none';
    page.appendChild(statusBox);

    function setStatus(type, msg) {
      statusBox.textContent = msg || '';
      statusBox.className = 'alert';
      if (type === 'error') statusBox.classList.add('error');
      if (type === 'success') statusBox.classList.add('success');
      statusBox.style.display = type || msg ? 'block' : 'none';
    }

    setStatus('', 'Cargando factura…');

    let invoice;
    try {
      invoice = await fetchInvoiceDetail(rawId);
    } catch (err) {
      console.error('[renderInvoiceDetailView] error', err);
      setStatus('error', 'Error cargando la factura.');
      return;
    }

    setStatus('', '');
    const st = String(invoice.status || '').toLowerCase();

    // --- Sección: estado + total destacado ---
    const summarySec = document.createElement('div');
    summarySec.className = 'detail-section';
    page.appendChild(summarySec);

    const summaryRow = document.createElement('div');
    summaryRow.className = 'detail-summary';
    summarySec.appendChild(summaryRow);

    // Izq: nº + estado (+ VeriFactu)
    const stateBlock = document.createElement('div');
    const numLine = document.createElement('div');
    numLine.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px';
    numLine.innerHTML = `<span style="font-size:16px;font-weight:700;color:var(--ink)">${invoice.number || ''}</span>`;
    if (invoice.vfHash) {
      const badge = document.createElement('span');
      badge.style.cssText = 'font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--brand-tint);color:var(--green-700);border:1px solid var(--green-100)';
      badge.textContent = '✓ VeriFactu';
      numLine.appendChild(badge);
    }
    if (invoice.type === 'R1') {
      const badge = document.createElement('span');
      badge.style.cssText = 'font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--red-50);color:var(--red-600);border:1px solid var(--red-600)';
      badge.textContent = 'RECTIFICATIVA';
      numLine.appendChild(badge);
    }
    stateBlock.appendChild(numLine);

    const spanStatus = document.createElement('span');
    spanStatus.className = 'status-pill';
    spanStatus.textContent = st === 'paid' ? 'PAGADA' : st === 'expired' ? 'VENCIDA' : 'PENDIENTE';
    if (st === 'paid') spanStatus.classList.add('status-pill-accepted');
    else if (st === 'expired') spanStatus.classList.add('status-pill-rejected');
    else spanStatus.classList.add('status-pill-pending');
    stateBlock.appendChild(spanStatus);
    summaryRow.appendChild(stateBlock);

    // Der: total destacado
    const totalBlock = document.createElement('div');
    totalBlock.style.textAlign = 'right';
    totalBlock.innerHTML =
      '<div class="detail-total-label">Total</div>' +
      `<div class="detail-total-amount">${fmtInvMoney(invoice.total, invoice.currency)}</div>`;
    summaryRow.appendChild(totalBlock);

    // Badges de recordatorios
    if (invoice.reminder7SentAt || invoice.reminder14SentAt) {
      const remDiv = document.createElement('div');
      remDiv.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:14px';
      if (invoice.reminder7SentAt) {
        const b = document.createElement('span');
        b.style.cssText = 'font-size:11px;padding:3px 9px;border-radius:999px;background:var(--amber-50);color:#92400e;font-weight:600';
        b.textContent = `💬 Recordatorio 7d: ${new Date(invoice.reminder7SentAt).toLocaleDateString('es-ES')}`;
        remDiv.appendChild(b);
      }
      if (invoice.reminder14SentAt) {
        const b = document.createElement('span');
        b.style.cssText = 'font-size:11px;padding:3px 9px;border-radius:999px;background:var(--red-50);color:var(--red-600);font-weight:600';
        b.textContent = `💬 Recordatorio 14d: ${new Date(invoice.reminder14SentAt).toLocaleDateString('es-ES')}`;
        remDiv.appendChild(b);
      }
      summarySec.appendChild(remDiv);
    }

    // --- Sección: datos ---
    const dataSec = document.createElement('div');
    dataSec.className = 'detail-section';
    dataSec.innerHTML = '<h3 class="detail-section-title">Datos</h3>';
    const dl = document.createElement('dl');
    dl.className = 'detail-dl';
    addDefRow(dl, 'Cliente', invoice.customer?.name);
    addDefRow(dl, 'Creada', invoice.createdAt ? new Date(invoice.createdAt).toLocaleString('es-ES') : null);
    addDefRow(dl, 'Pagada', invoice.paidAt ? new Date(invoice.paidAt).toLocaleString('es-ES') : null);
    addDefRow(dl, 'Rectifica a', invoice.rectifies ? invoice.rectifies.number : null);
    addDefRow(dl, 'Rectificada por', (invoice.rectifiedBy && invoice.rectifiedBy.length) ? invoice.rectifiedBy.map((r) => r.number).join(', ') : null);
    if (!dl.children.length) dl.innerHTML = '<dd style="color:var(--muted)">Sin datos.</dd>';
    dataSec.appendChild(dl);
    page.appendChild(dataSec);

    // --- Sección: acciones ---
    const actionsSec = document.createElement('div');
    actionsSec.className = 'detail-section';
    actionsSec.innerHTML = '<h3 class="detail-section-title">Acciones</h3>';
    page.appendChild(actionsSec);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
    actionsSec.appendChild(actions);

    // Abrir PDF — siempre vía el endpoint que genera bajo demanda si falta
    // (nunca enlazar a invoice.pdfUrl directo, que puede valer 'PENDING_PDF').
    const btnPdf = document.createElement('button');
    btnPdf.className = 'btn-primary btn-sm';
    btnPdf.textContent = 'Abrir PDF';
    btnPdf.addEventListener('click', () => {
      window.open(`/admin/invoices/${invoice.id}/pdf`, '_blank');
    });
    actions.appendChild(btnPdf);
  
    // Reenviar por WhatsApp
    const btnWhatsApp = document.createElement('button');
    btnWhatsApp.className = 'btn-secondary btn-sm';
    btnWhatsApp.textContent = 'Reenviar por WhatsApp';
  
    const canSendWhatsApp =
      invoice.customer && invoice.customer.phone;
  
    if (!canSendWhatsApp) {
      btnWhatsApp.disabled = true;
      btnWhatsApp.title =
        'El cliente no tiene teléfono de WhatsApp configurado.';
    }
  
    btnWhatsApp.addEventListener('click', async () => {
      if (!canSendWhatsApp) return;
  
      btnWhatsApp.disabled = true;
      const originalText = btnWhatsApp.textContent;
      btnWhatsApp.textContent = 'Enviando…';
  
      try {
        const res = await fetch(
          `/admin/invoices/${invoice.id}/resend-whatsapp`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          },
        );
  
        const data = await res.json().catch(() => ({}));
  
        if (!res.ok) {
          const msg = data.error || 'desconocido';
          throw new Error(msg);
        }

        setStatus('success', '✓ Factura reenviada por WhatsApp.');
      } catch (err) {
        const msg = err && err.message ? err.message : 'inténtalo de nuevo';
        setStatus('error', 'Error enviando por WhatsApp: ' + msg);
      } finally {
        btnWhatsApp.disabled = false;
        btnWhatsApp.textContent = originalText;
      }
    });
  
    // Una rectificativa no es cobrable: sin reenvío de cobro por WhatsApp
    if (invoice.type !== 'R1') actions.appendChild(btnWhatsApp);

    // Marcar como PAGADA / PENDIENTE
    const btnTogglePaid = document.createElement('button');
    btnTogglePaid.className = 'btn-secondary btn-sm';
    btnTogglePaid.textContent =
      st === 'paid' ? 'Marcar como PENDIENTE' : 'Marcar como PAGADA';
  
    btnTogglePaid.addEventListener('click', async () => {
      const targetStatus = st === 'paid' ? 'pending' : 'paid';
  
      btnTogglePaid.disabled = true;
      const originalText = btnTogglePaid.textContent;
      btnTogglePaid.textContent = 'Actualizando…';
  
      try {
        const res = await fetch(`/admin/invoices/${invoice.id}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: targetStatus }),
        });
  
        const data = await res.json();
  
        if (!res.ok) {
          const msg = data.error || 'desconocido';
          throw new Error(msg);
        }
  
        // Recargamos la vista con el nuevo estado
        if (window.renderAppView) {
          window.renderAppView('invoice-detail', {
            invoiceId: invoice.id,
          });
        }
      } catch (err) {
        const msg = err && err.message ? err.message : 'inténtalo de nuevo';
        setStatus('error', 'Error actualizando estado: ' + msg);
        btnTogglePaid.disabled = false;
        btnTogglePaid.textContent = originalText;
      }
    });
  
    if (invoice.type !== 'R1') actions.appendChild(btnTogglePaid);

    // Botón Recordar pago (solo visible si la factura está pendiente y el cliente tiene teléfono)
    if (st === 'pending' && invoice.customer?.phone) {
      const btnReminder = document.createElement('button');
      btnReminder.className = 'btn-secondary btn-sm';
      btnReminder.innerHTML = '💬 Recordar pago';
      btnReminder.title = 'Envía un WhatsApp recordatorio al cliente';
      btnReminder.addEventListener('click', async () => {
        btnReminder.disabled = true;
        btnReminder.textContent = 'Enviando…';
        try {
          const r = await fetch(`/admin/invoices/${invoice.id}/send-reminder`, { method: 'POST' });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || 'error');
          setStatus('success', '✓ Recordatorio enviado por WhatsApp.');
          // Actualizar badges sin recargar
          if (!invoice.reminder7SentAt)  invoice.reminder7SentAt  = new Date().toISOString();
          else                           invoice.reminder14SentAt = new Date().toISOString();
          btnReminder.textContent = '💬 Recordado';
        } catch (e) {
          setStatus('error', 'Error al enviar el recordatorio.');
          btnReminder.disabled = false;
          btnReminder.textContent = '💬 Recordar pago';
        }
      });
      actions.appendChild(btnReminder);
    }

    // Botón Rectificar (solo facturas F1 sin rectificativa previa)
    const alreadyRectified = invoice.rectifiedBy && invoice.rectifiedBy.length > 0;
    if (invoice.type !== 'R1' && !alreadyRectified) {
      const btnRectify = document.createElement('button');
      btnRectify.className = 'btn-danger btn-sm';
      btnRectify.textContent = '⎌ Rectificar factura';
      btnRectify.title = 'Emite una factura rectificativa (R1) con los importes en negativo';
      btnRectify.addEventListener('click', async () => {
        const ok = window.confirm(
          `Se emitirá una factura rectificativa de ${invoice.number} con los importes en negativo (anula su efecto fiscal). Esta acción no se puede deshacer. ¿Continuar?`
        );
        if (!ok) return;
        btnRectify.disabled = true;
        btnRectify.textContent = 'Emitiendo…';
        try {
          const r = await fetch(`/admin/invoices/${invoice.id}/rectify`, { method: 'POST' });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) {
            const msg = d.error === 'already_rectified'
              ? `Esta factura ya tiene rectificativa (${d.rectification?.number || ''}).`
              : 'Error emitiendo la rectificativa.';
            throw new Error(msg);
          }
          setStatus('success', `✓ Rectificativa ${d.number} emitida.`);
          // Abrir el detalle de la nueva rectificativa
          if (window.renderAppView) window.renderAppView('invoice-detail', { invoiceId: d.id });
        } catch (e) {
          setStatus('error', e && e.message ? e.message : 'Error emitiendo la rectificativa.');
          btnRectify.disabled = false;
          btnRectify.textContent = '⎌ Rectificar factura';
        }
      });
      actions.appendChild(btnRectify);
    }

    // Botón Regenerar PDF (con VeriFactu si aplica)
    const btnRegen = document.createElement('button');
    btnRegen.className = 'btn-ghost btn-sm';
    btnRegen.textContent = invoice.vfHash ? '↻ Regenerar PDF' : '↻ Regenerar PDF (VeriFactu)';
    btnRegen.title = 'Regenera el PDF aplicando VeriFactu si el merchant tiene NIF configurado';
    btnRegen.addEventListener('click', async () => {
      btnRegen.disabled = true;
      btnRegen.textContent = 'Regenerando…';
      try {
        const r = await fetch(`/admin/invoices/${invoice.id}/regenerate-pdf`, { method: 'POST' });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'error');
        setStatus('success', d.veriFactu ? '✓ PDF regenerado con VeriFactu.' : '✓ PDF regenerado.');
        if (d.pdfUrl) invoice.pdfUrl = d.pdfUrl;
        if (d.veriFactu) invoice.vfHash = 'updated';
      } catch (e) {
        setStatus('error', 'Error al regenerar el PDF.');
      }
      btnRegen.disabled = false;
      btnRegen.textContent = '↻ Regenerar PDF';
    });
    actions.appendChild(btnRegen);
  }

  // Hacemos la función accesible desde otros scripts
  window.renderInvoiceDetailView = renderInvoiceDetailView;
  