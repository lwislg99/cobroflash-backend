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
  
    // P-A66-3: delega en el formateador es-ES compartido (api.js)
    const fmtInvMoney = (amount, currency) =>
      fmtMoneyEs(amount, currency || (window.appLocale && window.appLocale.currency) || 'EUR');

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
    const headTitle = left.querySelector('h2');
    const headSub = left.querySelector('.detail-sub');

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

    // V0-0: justificante de cobro (merchant ES real sin facturación activa) — el copy no dice "factura"
    const isReceipt = invoice.type === 'JUST' || String(invoice.number || '').startsWith('J-');
    if (isReceipt) {
      if (headTitle) headTitle.textContent = 'Justificante de cobro';
      if (headSub) headSub.textContent = 'Detalle y acciones del justificante.';
    }

    // V0-0: marca de agua DEMO en pantalla (merchant demo)
    if (invoice.demo) {
      const wm = document.createElement('div');
      wm.textContent = 'DEMO — no válida fiscalmente';
      wm.style.cssText =
        'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
        'transform:rotate(-18deg);font-size:34px;font-weight:800;color:rgba(220,38,38,.12);' +
        'pointer-events:none;user-select:none;z-index:5;text-align:center';
      page.style.position = 'relative';
      page.appendChild(wm);
    }

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
    if (isReceipt) {
      const badge = document.createElement('span');
      badge.style.cssText = 'font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--neutral-100);color:var(--muted);border:1px solid var(--border)';
      badge.textContent = 'JUSTIFICANTE';
      numLine.appendChild(badge);
    }
    stateBlock.appendChild(numLine);

    // SCRUM-153: mapeo canónico (api.js), el mismo que el listado. Antes eran dos ternarios
    // separados que había que acordarse de tocar a la vez, y los dos caían a PENDIENTE.
    const metaFactura = invoiceStatusMeta(st);
    const spanStatus = document.createElement('span');
    spanStatus.className = `status-pill ${metaFactura.pillClass}`;
    spanStatus.textContent = metaFactura.label;
    stateBlock.appendChild(spanStatus);

    // WA-0b: chip de entrega del WhatsApp de la factura (J4)
    const waChipHtml = window.waDeliveryChip && window.waDeliveryChip(invoice.waDelivery);
    if (waChipHtml) {
      const wrap = document.createElement('span');
      wrap.style.cssText = 'margin-left:8px';
      wrap.innerHTML = waChipHtml;
      stateBlock.appendChild(wrap);
    }
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

    // --- Sección: acciones (SCRUM-283 · la LEY del patrón: 1 primaria + ≤2 secundarias + ⋮) ---
    // Se PINTA desde el registro declarativo (invoiceActionsRegistry.js), la MISMA fuente que el
    // guard verifica: nadie escribe la tabla dos veces. El estado decide el destino de cada acción;
    // el rótulo es microcopy sin aprobar y sale con el marcador (regla 30). ANULAR no pasa por aquí:
    // se queda en su propia sección, con su código y su rótulo intactos (excepción de la regla 5).
    const actionsSec = document.createElement('div');
    actionsSec.className = 'detail-section';
    actionsSec.innerHTML = '<h3 class="detail-section-title">Acciones</h3>';
    page.appendChild(actionsSec);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center';
    actionsSec.appendChild(actions);

    // pending · paid · annulled · R1 (Parte L). `expired` es un pending vencido → se trata como pending.
    const estadoFactura = invoice.type === 'R1' ? 'R1'
      : (st === 'annulled' ? 'annulled' : (st === 'paid' ? 'paid' : 'pending'));
    const ctxAcciones = { hayCharge: !!invoice.chargeId };
    const REGISTRO_ACC = (typeof window !== 'undefined' && window.INVOICE_ACTION_REGISTRY) || [];
    const MARCA_MICRO = (typeof window !== 'undefined' && window.MICROCOPY_PENDIENTE) || '[PENDIENTE microcopy oficial]';
    const cubosAcc = { primaria: [], secundaria: [], overflow: [] };

    // Coloca un botón YA CREADO (con su handler intacto) según su destino en este estado. `oculta` no
    // se pinta; `seccion-propia` (Anular) lo pinta su propio código. El rótulo lo pone cada botón al
    // crearse, con el marcador (regla 30); el censo lo capta y el guard de microcopy lo verifica.
    function ubicarAccion(btn, id) {
      const a = REGISTRO_ACC.find((x) => x.id === id);
      const destino = a && typeof window.destinoEfectivo === 'function'
        ? window.destinoEfectivo(a, estadoFactura, ctxAcciones)
        : 'oculta';
      if (destino === 'oculta' || destino === 'seccion-propia') return;
      btn.className = destino === 'primaria' ? 'btn-primary btn-sm'
        : (destino === 'secundaria' ? 'btn-secondary btn-sm' : 'btn-ghost btn-sm');
      cubosAcc[destino].push(btn);
    }

    // Abrir PDF — siempre vía el endpoint que genera bajo demanda si falta
    // (nunca enlazar a invoice.pdfUrl directo, que puede valer 'PENDING_PDF').
    const btnPdf = document.createElement('button');
    btnPdf.className = 'btn-primary btn-sm';
    btnPdf.textContent = '[PENDIENTE microcopy oficial]';
    btnPdf.addEventListener('click', () => {
      window.open(`/admin/invoices/${invoice.id}/pdf`, '_blank');
    });
    ubicarAccion(btnPdf, 'btnPdf');
  
    // Reenviar por WhatsApp
    const btnWhatsApp = document.createElement('button');
    btnWhatsApp.className = 'btn-secondary btn-sm';
    btnWhatsApp.textContent = '[PENDIENTE microcopy oficial]';
  
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

        // SCRUM-126: !res.ok cubre las precondiciones reales (400/404). waSendFailed cubre
        // el motivo blando (opt-out/tope/etc.), siempre 200 + sent:false.
        if (!res.ok || waSendFailed(data)) {
          // A20.5 (J5): mensaje humano del server + SIEMPRE las 3 salidas
          setStatus('error', data.message || ('No se pudo enviar por WhatsApp: ' + (data.error || 'desconocido')));
          // SCRUM-85: payToken (Charge.receiptToken), NUNCA el chargeId — /pay/invoice ya no acepta el id.
          const payToken = data.pay_token || invoice.payToken;
          statusBox.querySelectorAll('.wa-fallback-bar').forEach((b) => b.remove());
          statusBox.appendChild(waFallbackBar({
            link: payToken ? location.origin + '/pay/invoice/' + payToken : location.origin,
            onEmail: invoice.customer && invoice.customer.email
              ? () => apiRequest('/admin/invoices/' + invoice.id + '/send-email', { method: 'POST' })
              : null,
            emailDisabledReason: invoice.customer && invoice.customer.email ? null : 'Este cliente no tiene email guardado',
            onRetry: () => btnWhatsApp.click(),
          }));
          return;
        }

        setStatus('success', '✓ Factura reenviada por WhatsApp.');
      } catch (err) {
        const msg = err && err.message ? err.message : 'inténtalo de nuevo';
        setStatus('error', 'Error enviando por WhatsApp: ' + msg);
        statusBox.querySelectorAll('.wa-fallback-bar').forEach((b) => b.remove());
        statusBox.appendChild(waFallbackBar({ // A20.5: también en fallo de red
          link: invoice.payToken ? location.origin + '/pay/invoice/' + invoice.payToken : location.origin,
          onEmail: invoice.customer && invoice.customer.email
            ? () => apiRequest('/admin/invoices/' + invoice.id + '/send-email', { method: 'POST' })
            : null,
          emailDisabledReason: invoice.customer && invoice.customer.email ? null : 'Este cliente no tiene email guardado',
          onRetry: () => btnWhatsApp.click(),
        }));
      } finally {
        btnWhatsApp.disabled = false;
        btnWhatsApp.textContent = originalText;
      }
    });
  
    // La visibilidad por estado la decide el registro (secundaria en pending/paid; oculta en annulled/R1).
    ubicarAccion(btnWhatsApp, 'btnWhatsApp');

    // Marcar como PAGADA / PENDIENTE
    // SCRUM-153: sobre una factura ANULADA este botón no se pinta. Antes salía «Marcar como
    // PAGADA» —porque el ternario solo miraba si era `paid`—, ofreciendo resucitar un
    // documento fiscal dado de baja. El backend ya lo rechaza (409), pero un botón que
    // siempre falla es peor que no tenerlo: enseña que la pantalla miente.
    const btnTogglePaid = document.createElement('button');
    btnTogglePaid.className = 'btn-secondary btn-sm';
    btnTogglePaid.textContent = '[PENDIENTE microcopy oficial]';

    btnTogglePaid.addEventListener('click', async () => {
      const targetStatus = st === 'paid' ? 'pending' : 'paid';

      // A21.2 (V4/V5): al marcar PAGADA se pregunta el importe REAL recibido.
      // Si no coincide, NADA automático: la factura sigue pendiente y queda
      // anotado en la ficha 360 para la decisión manual (runbook O).
      if (targetStatus === 'paid') {
        const totalNum = Number(invoice.total);
        const raw = window.prompt(
          '¿Qué importe has recibido? (€)\nSi coincide con el total, confirma tal cual.',
          totalNum.toFixed(2)
        );
        if (raw === null) return; // cancelado
        const received = Number(String(raw).replace(',', '.'));
        if (!Number.isFinite(received) || received < 0) {
          setStatus('error', 'Importe no válido.');
          return;
        }
        if (Math.abs(received - totalNum) > 0.009) {
          btnTogglePaid.disabled = true;
          try {
            const r = await apiRequest(`/admin/invoices/${invoice.id}/payment-anomaly`, {
              method: 'POST',
              body: JSON.stringify({ amount: received }),
            });
            setStatus('error', '⚠️ ' + (r.message || 'Importe distinto anotado. La factura sigue pendiente.'));
          } catch (e) {
            setStatus('error', 'No se pudo anotar el importe. Inténtalo de nuevo.');
          } finally {
            btnTogglePaid.disabled = false;
          }
          return; // JAMÁS se marca pagada con un importe distinto
        }
      }

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
          const msg = data.message || data.error || 'desconocido';
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
  
    // La visibilidad por estado la decide el registro: primaria de pending (sin chargeId), «⋮» en
    // paid (Marcar como PENDIENTE), oculta en annulled/R1 —SCRUM-153: una anulada no cambia de
    // estado (Parte L no declara transición que salga de `annulled`)—.
    ubicarAccion(btnTogglePaid, 'btnTogglePaid');

    // A21.1 (R14): paquete de evidencia de disputa en 1 clic — con cobro de
    // tarjeta (charge) siempre disponible; la firma digital gana disputas.
    if (invoice.chargeId) {
      const btnDispute = document.createElement('button');
      btnDispute.className = 'btn-secondary btn-sm';
      btnDispute.textContent = '[PENDIENTE microcopy oficial]';
      btnDispute.title = 'Presupuesto firmado + evidencia de aceptación + justificante + registro de mensajes, listo para responder al banco';
      btnDispute.addEventListener('click', () => {
        window.open(`/admin/invoices/${invoice.id}/dispute-package`, '_blank');
      });
      ubicarAccion(btnDispute, 'btnDispute');
    }

    // C1-4: "Confirmar Bizum recibido" (N5) con DOBLE toque — el 1er clic pide
    // confirmación explícita con el importe, el 2º ejecuta. Dispara la misma
    // cadena post-pago que un PSP (paid_via='bizum_manual').
    if (invoice.chargeId) { // dato: hay cobro en vuelo. El estado (primaria de pending) lo decide el registro.
      const amountTxt = fmtMoneyEs(invoice.total, invoice.currency || 'EUR');
      const custName = (invoice.customer && invoice.customer.name) || 'el cliente';
      const btnBizum = document.createElement('button');
      btnBizum.className = 'btn-secondary btn-sm';
      btnBizum.textContent = '[PENDIENTE microcopy oficial]';
      let armed = false;
      btnBizum.addEventListener('click', async () => {
        if (!armed) {
          armed = true;
          btnBizum.className = 'btn-primary btn-sm';
          btnBizum.textContent = `¿Has recibido ${amountTxt} de ${custName} en tu Bizum? Sí, confirmar`;
          setTimeout(() => { // desarmar a los 6s si no confirma
            if (armed) { armed = false; btnBizum.className = 'btn-secondary btn-sm'; btnBizum.textContent = '📲 Confirmar Bizum recibido'; }
          }, 6000);
          return;
        }
        btnBizum.disabled = true;
        btnBizum.textContent = 'Confirmando…';
        try {
          const r = await fetch(`/admin/charges/${invoice.chargeId}/confirm-bizum`, { method: 'POST' });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) {
            const msgs = {
              bizum_disabled: 'Los cobros por Bizum no están activados todavía.',
              charge_not_pending: 'Este cobro ya no está pendiente.',
            };
            throw new Error(msgs[d.error] || 'No se pudo confirmar. Inténtalo de nuevo.');
          }
          setStatus('success', '✓ Bizum confirmado: factura cobrada.');
          if (window.renderAppView) window.renderAppView('invoice-detail', { invoiceId: invoice.id });
        } catch (e) {
          setStatus('error', e.message || 'No se pudo confirmar el Bizum.');
          btnBizum.disabled = false;
          armed = false;
          btnBizum.className = 'btn-secondary btn-sm';
          btnBizum.textContent = '📲 Confirmar Bizum recibido';
        }
      });
      ubicarAccion(btnBizum, 'btnBizum');
    }

    // Recordar pago: el estado (solo pending) lo decide el registro; aquí queda el dato (teléfono).
    if (invoice.customer?.phone) {
      const btnReminder = document.createElement('button');
      btnReminder.className = 'btn-secondary btn-sm';
      btnReminder.textContent = '[PENDIENTE microcopy oficial]';
      btnReminder.title = 'Envía un WhatsApp recordatorio al cliente';
      btnReminder.addEventListener('click', async () => {
        btnReminder.disabled = true;
        btnReminder.textContent = 'Enviando…';
        try {
          const r = await fetch(`/admin/invoices/${invoice.id}/send-reminder`, { method: 'POST' });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || 'error');
          // SCRUM-115: 200+ok:true no significa enviado — el resultado real es `sent`.
          // Antes esto miraba r.ok (siempre true aquí) y marcaba el badge pasara lo que pasara.
          if (d.sent === false) {
            setStatus('error', 'El WhatsApp del recordatorio falló. Puedes reintentarlo.');
            btnReminder.disabled = false;
            btnReminder.textContent = '💬 Recordar pago';
            return;
          }
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
      ubicarAccion(btnReminder, 'btnReminder');
    }

    // Rectificar: el estado (pending/paid; NO en annulled por SCRUM-308, NO en R1) lo decide el
    // registro; aquí queda el dato (que no tenga ya una rectificativa).
    const alreadyRectified = invoice.rectifiedBy && invoice.rectifiedBy.length > 0;
    if (!alreadyRectified) {
      const btnRectify = document.createElement('button');
      btnRectify.className = 'btn-danger btn-sm';
      btnRectify.textContent = '[PENDIENTE microcopy oficial]';
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
      ubicarAccion(btnRectify, 'btnRectify');
    }

    // ── SCRUM-153 (c) · ANULAR — EN BLOQUE APARTE, NO JUNTO A RECTIFICAR ──────────────
    //
    // La separación visual es el requisito, no la decoración. «Anular» y «Rectificar» suenan
    // a lo mismo para quien no es fiscalista, y si salen como botones hermanos el pro elegirá
    // ANULAR por ser la palabra que suena a lo que quiere. Son cosas distintas:
    //   · Anular   → la factura NUNCA DEBIÓ EXISTIR (duplicada, prueba, subida por error).
    //   · R1       → la operación SÍ existió y hay que corregirla.
    // Por eso esto no se añade a `actions` (donde vive Rectificar) sino a su propia sección,
    // debajo, con su explicación delante. Que cueste un poco más llegar es parte del diseño.
    //
    // Condiciones: solo F1 (nunca un justificante J-), solo `pending` —una pagada no se anula:
    // el dinero entró, la operación existió— y no si ya está anulada.
    const puedeAnular = invoice.type !== 'R1'
      && st === 'pending'
      && !/^J-/i.test(invoice.number || '');

    if (puedeAnular) {
      // SECCIÓN PROPIA, hermana de «Acciones» y no un botón dentro de ella. Es la separación
      // que pide el ticket, hecha con el componente que ya existe (`detail-section`, AB3) en
      // vez de inventar uno.
      const zona = document.createElement('div');
      zona.className = 'detail-section zona-anular';

      const titulo = document.createElement('h3');
      titulo.className = 'detail-section-title';
      titulo.textContent = 'Anular esta factura';

      const explica = document.createElement('p');
      explica.className = 'zona-anular-texto';
      explica.textContent =
        'Solo si esta factura nunca debió existir: duplicada, de prueba, o emitida por error '
        + 'sin que hubiera trabajo. Si el trabajo sí se hizo y hay algo que corregir, usa '
        + 'Rectificar en vez de anular.';

      const btnAnular = document.createElement('button');
      btnAnular.className = 'btn-secondary btn-sm';
      btnAnular.textContent = 'Anular factura…';
      btnAnular.title = 'Deja la factura sin efecto. No la borra.';

      // SCRUM-89: si no es admin, se ve DESHABILITADO con la explicación, no escondido —
      // que el técnico aprenda que esto lo hace quien gestiona la cuenta. La seguridad real
      // la da el 403 del backend, no esto.
      const esAdmin = window.appUserRole !== 'tecnico' && window.appUserRole !== 'operario';
      if (!esAdmin) {
        lockActionForRole(btnAnular);
      } else {
        btnAnular.addEventListener('click', () => abrirModalAnular(invoice, setStatus));
      }

      zona.appendChild(titulo);
      zona.appendChild(explica);
      zona.appendChild(btnAnular);
      if (!esAdmin) zona.appendChild(roleLockedNote());
      // A `page` y NO a `actions` a propósito: ver el comentario de arriba.
      page.appendChild(zona);
    }

    // Botón Regenerar PDF (con VeriFactu si aplica)
    const btnRegen = document.createElement('button');
    btnRegen.className = 'btn-ghost btn-sm';
    btnRegen.textContent = '[PENDIENTE microcopy oficial]';
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
    ubicarAccion(btnRegen, 'btnRegen');

    // Ensamblar la barra en orden: primaria (regla 1) · secundarias (regla 2) · «⋮» (regla 3). El
    // «⋮» reutiliza overflowMenu de AB3 (a11y, teclado, hoja inferior ≤640px). Si no está cargado,
    // las acciones del overflow se pintan sueltas: perder el menú no puede costar una acción (SCRUM-31).
    cubosAcc.primaria.forEach((b) => actions.appendChild(b));
    cubosAcc.secundaria.forEach((b) => actions.appendChild(b));
    if (cubosAcc.overflow.length) {
      if (typeof window.overflowMenu === 'function') actions.appendChild(window.overflowMenu(cubosAcc.overflow));
      else cubosAcc.overflow.forEach((b) => actions.appendChild(b));
    }
  }

  // ── SCRUM-153 (c) · MODAL DE ANULACIÓN ───────────────────────────────────────────────
  //
  // NO es un `confirm()` de una línea, a diferencia de Rectificar. Anular es irreversible sobre
  // un documento fiscal, y el pro tiene que hacer DOS cosas antes: elegir por qué, y leer qué
  // pasa. El motivo no es burocracia — es lo que hace CUMPLIBLE la regla «anular ≠ R1»: los
  // cuatro valores describen situaciones en las que la operación NO existió. Si ninguno encaja,
  // la respuesta correcta es rectificar, y el propio menú lo enseña sin decirlo.
  //
  // Lista CERRADA y no texto libre (decisión del fundador): (a) RGPD — un campo libre en zona
  // fiscal invita a escribir datos personales que no hay obligación de recoger; (b) se puede
  // contar («60 % duplicadas» es un bug de producto); (c) el registro oficial de la AEAT NO
  // lleva motivo —comprobado contra el XSD—, así que esto es interno y nada obliga a su forma.
  const MOTIVOS_ANULACION = [
    { valor: 'duplicada',            texto: 'Factura duplicada' },
    { valor: 'error_sin_operacion',  texto: 'Emitida por error (no hubo trabajo)' },
    { valor: 'datos_cliente',        texto: 'Datos del cliente equivocados' },
    { valor: 'prueba',               texto: 'Era una prueba' },
  ];

  // Escape local: `escHtml` vive en aiQuoteAssistant.js, que carga DESPUÉS de este fichero.
  // Al hacer clic ya está definido, pero es una dependencia invisible que se rompería el día
  // que alguien reordene los <script> — y el fallo sería inyección de HTML, no un error visible.
  const escAnul = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function abrirModalAnular(invoice, setStatus) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:460px" role="dialog" aria-modal="true" aria-labelledby="anul-t">
        <div class="modal-header">
          <h3 class="modal-title" id="anul-t">Anular la factura ${escAnul(invoice.number)}</h3>
          <button class="modal-close" id="anul-x" aria-label="Cerrar">&times;</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label for="anul-motivo">¿Por qué se anula?</label>
            <select id="anul-motivo" style="width:100%">
              <option value="">Elige un motivo…</option>
              ${MOTIVOS_ANULACION.map((m) => `<option value="${m.valor}">${m.texto}</option>`).join('')}
            </select>
          </div>

          <div class="alert warning" style="margin-top:12px">
            <strong>Qué pasa al anular</strong>
            <ul style="margin:6px 0 0;padding-left:18px">
              <li><strong>No se borra nada.</strong> La factura sigue existiendo, marcada como
                  ANULADA, y conserva su registro y su huella.</li>
              <li>El número <strong>${escAnul(invoice.number)}</strong> queda usado:
                  <strong>no se reutiliza</strong> ni se renumera lo demás.</li>
              <li>No se puede deshacer. Si luego hay que cobrar ese trabajo, se emite una
                  factura nueva.</li>
            </ul>
          </div>

          <div class="alert" id="anul-err" style="display:none;margin-top:12px"></div>

          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
            <button class="btn-ghost btn-sm" id="anul-no">Cancelar</button>
            <button class="btn-danger btn-sm" id="anul-si" disabled>Anular factura</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const cerrar = () => overlay.remove();
    const motivo = overlay.querySelector('#anul-motivo');
    const btnSi = overlay.querySelector('#anul-si');
    const err = overlay.querySelector('#anul-err');

    overlay.querySelector('#anul-x').onclick = cerrar;
    overlay.querySelector('#anul-no').onclick = cerrar;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', esc); }
    });

    // El botón nace DESHABILITADO: sin motivo no se puede anular. Es la mitad de la
    // «confirmación explícita» — la otra mitad es que el motivo obliga a mirar la lista y
    // darse cuenta de si lo que se quiere es rectificar.
    motivo.addEventListener('change', () => { btnSi.disabled = !motivo.value; });
    motivo.focus();

    btnSi.addEventListener('click', async () => {
      btnSi.disabled = true;
      btnSi.textContent = 'Anulando…';
      err.style.display = 'none';
      try {
        const r = await fetch(`/admin/invoices/${invoice.id}/annul`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ motivo: motivo.value }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.message || d.error || 'No se pudo anular la factura.');
        cerrar();
        setStatus('success', `✓ Factura ${invoice.number} anulada. Su número no se reutiliza.`);
        if (window.renderAppView) window.renderAppView('invoice-detail', { invoiceId: invoice.id });
      } catch (e) {
        err.textContent = e && e.message ? e.message : 'No se pudo anular la factura.';
        err.style.display = '';
        btnSi.disabled = false;
        btnSi.textContent = 'Anular factura';
      }
    });
  }

  // Hacemos la función accesible desde otros scripts
  window.renderInvoiceDetailView = renderInvoiceDetailView;
  