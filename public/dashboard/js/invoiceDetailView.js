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
  
    const wrapper = document.createElement('div');
    wrapper.className = 'customers-card';
    container.appendChild(wrapper);
  
    const header = document.createElement('div');
    header.className = 'customers-header';
    wrapper.appendChild(header);
  
    const left = document.createElement('div');
  
    const h2 = document.createElement('h2');
    h2.textContent = 'Factura';
    h2.style.margin = '0 0 4px 0';
    left.appendChild(h2);
  
    const pSubtitle = document.createElement('p');
    pSubtitle.textContent = 'Detalle de la factura CF…';
    pSubtitle.style.margin = '0';
    pSubtitle.style.fontSize = '13px';
    pSubtitle.style.color = '#6b7280';
    left.appendChild(pSubtitle);
  
    header.appendChild(left);
  
    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '8px';
  
    const btnBack = document.createElement('button');
    btnBack.className = 'btn btn-secondary';
    btnBack.textContent = '← Volver a facturas';
    btnBack.addEventListener('click', () => {
      if (window.renderAppView) {
        window.renderAppView('invoices');
      }
    });
  
    right.appendChild(btnBack);
    header.appendChild(right);
  
    const statusBox = document.createElement('div');
    statusBox.className = 'alert';
    statusBox.style.marginTop = '8px';
    wrapper.appendChild(statusBox);
  
    statusBox.textContent = 'Cargando factura…';
  
    let invoice;
    try {
      invoice = await fetchInvoiceDetail(rawId);
    } catch (err) {
      console.error('[renderInvoiceDetailView] error', err);
      statusBox.textContent = 'Error cargando la factura.';
      statusBox.className = 'alert error';
      return;
    }
  
    statusBox.textContent = '';
  
    // --- Contenido principal ---
    const body = document.createElement('div');
    body.style.marginTop = '12px';
    wrapper.appendChild(body);
  
    const h3 = document.createElement('h3');
    h3.style.cssText = 'margin:0 0 4px 0;display:flex;align-items:center;gap:8px';
    h3.innerHTML = `Factura ${invoice.number}`;
    if (invoice.vfHash) {
      const badge = document.createElement('span');
      badge.style.cssText = 'font-size:10px;font-weight:600;padding:2px 8px;border-radius:99px;background:#dcfce7;color:#166534;border:1px solid #bbf7d0';
      badge.textContent = '✓ VeriFactu';
      h3.appendChild(badge);
    }
    body.appendChild(h3);
  
    const pCustomer = document.createElement('p');
    pCustomer.textContent = `Cliente: ${
      invoice.customer?.name || '—'
    }`;
    body.appendChild(pCustomer);
  
    const totalNumber = Number(invoice.total || 0);
    const pTotal = document.createElement('p');
    pTotal.textContent = `Total: ${totalNumber.toFixed(
      2,
    )} ${invoice.currency}`;
    body.appendChild(pTotal);
  
    const pStatus = document.createElement('p');
    const spanStatus = document.createElement('span');
    spanStatus.className = 'status-pill';
    const st = String(invoice.status || '').toLowerCase();
    spanStatus.textContent = st.toUpperCase();
  
    if (st === 'paid') spanStatus.classList.add('status-pill-accepted');
    else if (st === 'expired')
      spanStatus.classList.add('status-pill-rejected');
    else spanStatus.classList.add('status-pill-pending');
  
    pStatus.textContent = 'Estado: ';
    pStatus.appendChild(spanStatus);
    body.appendChild(pStatus);
  
    const pCreated = document.createElement('p');
    pCreated.textContent = `Creada: ${
      invoice.createdAt
        ? new Date(invoice.createdAt).toLocaleString('es-ES')
        : '—'
    }`;
    body.appendChild(pCreated);
  
    const pPaidAt = document.createElement('p');
    pPaidAt.textContent = `Pagada en: ${
      invoice.paidAt
        ? new Date(invoice.paidAt).toLocaleString('es-ES')
        : '—'
    }`;
    body.appendChild(pPaidAt);

    // Badges de recordatorios enviados
    if (invoice.reminder7SentAt || invoice.reminder14SentAt) {
      const remDiv = document.createElement('div');
      remDiv.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px';
      if (invoice.reminder7SentAt) {
        const b = document.createElement('span');
        b.style.cssText = 'font-size:11px;padding:2px 8px;border-radius:99px;background:#fef3c7;color:#92400e;font-weight:600';
        b.textContent = `💬 Recordatorio 7d: ${new Date(invoice.reminder7SentAt).toLocaleDateString('es-ES')}`;
        remDiv.appendChild(b);
      }
      if (invoice.reminder14SentAt) {
        const b = document.createElement('span');
        b.style.cssText = 'font-size:11px;padding:2px 8px;border-radius:99px;background:#fee2e2;color:#dc2626;font-weight:600';
        b.textContent = `💬 Recordatorio 14d: ${new Date(invoice.reminder14SentAt).toLocaleDateString('es-ES')}`;
        remDiv.appendChild(b);
      }
      body.appendChild(remDiv);
    }
  
    // --- Botones de acción ---
    const actions = document.createElement('div');
    actions.style.marginTop = '12px';
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    body.appendChild(actions);
  
    // Abrir PDF
    const btnPdf = document.createElement('button');
    btnPdf.className = 'btn btn-primary';
    btnPdf.textContent = 'Abrir PDF';
    btnPdf.addEventListener('click', () => {
      if (invoice.pdfUrl) {
        window.open(invoice.pdfUrl, '_blank');
      } else {
        alert('Esta factura no tiene PDF asociado.');
      }
    });
    actions.appendChild(btnPdf);
  
    // Reenviar por WhatsApp
    const btnWhatsApp = document.createElement('button');
    btnWhatsApp.className = 'btn btn-secondary';
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
  
        alert('Factura reenviada por WhatsApp (stub).');
      } catch (err) {
        const msg =
          err && err.message
            ? err.message
            : typeof err === 'string'
            ? err
            : 'error_desconocido';
        alert('Error enviando por WhatsApp: ' + msg);
      } finally {
        btnWhatsApp.disabled = false;
        btnWhatsApp.textContent = originalText;
      }
    });
  
    actions.appendChild(btnWhatsApp);
  
    // Marcar como PAGADA / PENDIENTE
    const btnTogglePaid = document.createElement('button');
    btnTogglePaid.className = 'btn btn-secondary';
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
        const msg =
          err && err.message
            ? err.message
            : typeof err === 'string'
            ? err
            : 'error_desconocido';
        alert('Error actualizando estado: ' + msg);
        btnTogglePaid.disabled = false;
        btnTogglePaid.textContent = originalText;
      }
    });
  
    actions.appendChild(btnTogglePaid);

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
          statusBox.textContent = '✓ Recordatorio enviado por WhatsApp.';
          statusBox.className = 'alert success';
          statusBox.style.display = 'block';
          // Actualizar badges sin recargar
          if (!invoice.reminder7SentAt)  invoice.reminder7SentAt  = new Date().toISOString();
          else                           invoice.reminder14SentAt = new Date().toISOString();
          btnReminder.textContent = '💬 Recordado';
        } catch (e) {
          statusBox.textContent = 'Error al enviar el recordatorio.';
          statusBox.className = 'alert error';
          statusBox.style.display = 'block';
          btnReminder.disabled = false;
          btnReminder.textContent = '💬 Recordar pago';
        }
      });
      actions.appendChild(btnReminder);
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
        statusBox.textContent = d.veriFactu ? '✓ PDF regenerado con VeriFactu.' : '✓ PDF regenerado.';
        statusBox.className = 'alert success';
        if (d.pdfUrl) invoice.pdfUrl = d.pdfUrl;
        if (d.veriFactu) invoice.vfHash = 'updated';
      } catch (e) {
        statusBox.textContent = 'Error al regenerar el PDF.';
        statusBox.className = 'alert error';
      }
      btnRegen.disabled = false;
      btnRegen.textContent = '↻ Regenerar PDF';
    });
    actions.appendChild(btnRegen);
  }

  // Hacemos la función accesible desde otros scripts
  window.renderInvoiceDetailView = renderInvoiceDetailView;
  