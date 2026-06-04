// public/dashboard/js/quotesDetailView.js

// ===============================
// Vista de detalle de presupuesto
// ===============================

// Mapeo de códigos internos → texto legible
function getPaymentTermsLabel(code) {
  switch (code) {
    case 'FULL_UPFRONT':
      return 'Pago 100% al aceptar';
    case 'FIFTY_FIFTY':
      return '50% al aceptar, 50% al finalizar';
    case 'MANUAL':
      return 'Solo presupuesto, facturación manual';
    case 'NONE':
    case null:
    case undefined:
    case '':
      return 'Sin condiciones específicas';
    default:
      return code; // por si en el futuro llegan otros códigos
  }
}



async function renderQuoteDetailView(container, forcedQuoteId) {
  // El ID puede venir del estado global (app.js) o del dataset del contenedor
  const rawId =
    typeof forcedQuoteId !== "undefined"
      ? String(forcedQuoteId)
      : container.dataset.quoteId;

  const id = Number(rawId);

  function humanPaymentTerms(code) {
    if (!code) return "";
    switch (String(code)) {
      case "FULL_UPFRONT":
        return "Pago 100% al aceptar el presupuesto.";
      case "FIFTY_FIFTY":
        return "50% al aceptar, 50% al finalizar el trabajo.";
      case "MANUAL":
        return "Solo presupuesto, facturación manual.";
      default:
        return String(code); // por si llega texto libre o algo raro
    }
  }


  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "customers-card";
  container.appendChild(wrapper);

  // HEADER
  const header = document.createElement("div");
  header.className = "customers-header";
  wrapper.appendChild(header);

  const left = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = `Presupuesto #${Number.isFinite(id) ? id : "-"}`;
  title.style.margin = "0 0 4px 0";

  const subtitle = document.createElement("p");
  subtitle.textContent =
    "Detalle del presupuesto y decisión del cliente.";
  subtitle.style.margin = "0";
  subtitle.style.fontSize = "13px";
  subtitle.style.color = "#6b7280";

  left.appendChild(title);
  left.appendChild(subtitle);
  header.appendChild(left);

  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.gap = "8px";

  const backBtn = document.createElement("button");
  backBtn.className = "btn btn-secondary";
  backBtn.textContent = "← Volver";
  backBtn.addEventListener("click", () => {
    const viewTitle = document.getElementById("view-title");
    if (viewTitle) viewTitle.textContent = "Presupuestos";

    if (window.renderAppView) {
      window.renderAppView("quotes-list");
    } else {
      renderQuotesListView(container);
    }
  });

  const duplicateBtn = document.createElement("button");
  duplicateBtn.className = "btn-ghost btn-sm";
  duplicateBtn.innerHTML = "⎘ Duplicar";
  duplicateBtn.title = "Crea un nuevo presupuesto con las mismas líneas";
  duplicateBtn.style.cssText = "border:1px solid var(--slate-200)";
  duplicateBtn.addEventListener("click", () => duplicateQuote(id));

  right.appendChild(duplicateBtn);
  right.appendChild(backBtn);
  header.appendChild(right);

  // STATUS
  const statusBox = document.createElement("div");
  statusBox.className = "alert";
  statusBox.style.cssText = "margin-top:8px;display:none";
  wrapper.appendChild(statusBox);

  function setStatus(type, msg) {
    statusBox.textContent = msg || "";
    statusBox.className = "alert";
    if (type === "error") statusBox.classList.add("error");
    if (type === "success") statusBox.classList.add("success");
    statusBox.style.display = (type || msg) ? "block" : "none";
  }

  if (!rawId || !Number.isFinite(id)) {
    setStatus("error", "ID de presupuesto no válido.");
    console.error("[renderQuoteDetailView] quoteId inválido:", rawId);
    return;
  }

  setStatus("", "Cargando presupuesto…");

  let quote;
  try {
    quote = await getQuoteDetail(id);
  } catch (err) {
    console.error("[renderQuoteDetailView] error en getQuoteDetail:", err);
    setStatus("error", "Error cargando presupuesto.");
    return;
  }

  if (!quote) {
    setStatus("error", "Presupuesto no encontrado.");
    return;
  }

  // Si ha llegado hasta aquí, quitamos el mensaje de carga
  setStatus("", "");

  // =====================
  // Bloque CABECERA ESTADO
  // =====================
  const statusCard = document.createElement("div");
  statusCard.className = "customers-card";
  statusCard.style.marginTop = "12px";
  wrapper.appendChild(statusCard);

  const statusTitle = document.createElement("h3");
  statusTitle.textContent = `Presupuesto #${quote.id}`;
  statusTitle.style.margin = "0 0 4px 0";
  statusCard.appendChild(statusTitle);

  const statusP = document.createElement("p");
  statusP.style.margin = "0";
  statusP.style.fontSize = "13px";
  statusP.style.color = "#6b7280";

  const statusSpan = document.createElement("span");
  statusSpan.className = "status-pill";
  const st = String(quote.status || "").toLowerCase();
  statusSpan.textContent = st.toUpperCase();

  if (st === "accepted") statusSpan.classList.add("status-pill-accepted");
  else if (st === "rejected") statusSpan.classList.add("status-pill-rejected");
  else if (st === "draft") statusSpan.classList.add("status-pill-draft");
  else statusSpan.classList.add("status-pill-pending");

  statusP.appendChild(document.createTextNode("Estado: "));
  statusP.appendChild(statusSpan);
  statusCard.appendChild(statusP);

  // Timeline visual del estado (FRONT1-5)
  statusCard.appendChild(buildStatusTimeline(quote));

  // Badge Good/Better/Best — tier seleccionado
  if (quote.tiers && quote.tiers.length > 0) {
    const tierLabels = { good: 'Básico', better: 'Estándar', best: 'Premium' };
    const chosen = quote.selectedTierId ? tierLabels[quote.selectedTierId] || quote.selectedTierId : null;
    const tierBadge = document.createElement("div");
    tierBadge.style.marginTop = "8px";
    tierBadge.innerHTML = `
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px">Cotización con 3 opciones</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${quote.tiers.map((t) => `
          <span style="padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;
            background:${t.id===quote.selectedTierId?'#dcfce7':t.recommended?'#f0fdf4':'#f3f4f6'};
            color:${t.id===quote.selectedTierId?'#166534':t.recommended?'#16a34a':'#374151'};
            border:1px solid ${t.id===quote.selectedTierId?'#22c55e':'#e5e7eb'}">
            ${t.label} — ${Number(t.total).toFixed(2)} ${quote.currency}
            ${t.id===quote.selectedTierId?' ✓':''}
          </span>`).join('')}
      </div>
      ${chosen ? `<div style="margin-top:6px;font-size:13px;color:#16a34a;font-weight:600">Cliente eligió: ${chosen}</div>` : ''}
    `;
    statusCard.appendChild(tierBadge);
  }

  // Badge firma digital
  if (quote.signatureUrl) {
    const sigBadge = document.createElement("div");
    sigBadge.style.cssText = "margin-top:10px;display:flex;flex-direction:column;gap:8px";
    sigBadge.innerHTML = `
      <div style="display:inline-flex;align-items:center;gap:6px;background:#ecfdf5;color:#166534;
        padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;width:fit-content">
        ✅ Firmado digitalmente
      </div>
      <img src="${quote.signatureUrl}" alt="Firma del cliente"
        style="max-width:200px;max-height:80px;border:1px solid #e5e7eb;border-radius:8px;
               background:#f9fafb;padding:4px;object-fit:contain"/>
    `;
    statusCard.appendChild(sigBadge);
  }

  // =====================
  // NOTAS INTERNAS (privadas, solo visible en el BO)
  // =====================
  const notesCard = document.createElement("div");
  notesCard.className = "customers-card";
  notesCard.style.marginTop = "12px";
  wrapper.appendChild(notesCard);

  const notesHeader = document.createElement("div");
  notesHeader.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px";
  notesHeader.innerHTML = `
    <h3 style="margin:0;font-size:14px">📝 Notas internas</h3>
    <span style="font-size:11px;color:#9ca3af;background:#f3f4f6;padding:2px 8px;border-radius:999px">Solo tú las ves</span>
  `;
  notesCard.appendChild(notesHeader);

  const notesTextarea = document.createElement("textarea");
  notesTextarea.value = quote.internalNotes || "";
  notesTextarea.placeholder = "Anota detalles del trabajo, acuerdos verbales, recordatorios…";
  notesTextarea.style.cssText = "width:100%;min-height:90px;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;resize:vertical;font-family:inherit;line-height:1.5;color:#374151";
  notesCard.appendChild(notesTextarea);

  const notesSaveStatus = document.createElement("div");
  notesSaveStatus.style.cssText = "font-size:12px;color:#9ca3af;margin-top:4px;text-align:right;min-height:16px";
  notesCard.appendChild(notesSaveStatus);

  // Auto-guardado con debounce 1.2s
  let notesTimer = null;
  notesTextarea.addEventListener("input", () => {
    notesSaveStatus.textContent = "Escribiendo…";
    clearTimeout(notesTimer);
    notesTimer = setTimeout(async () => {
      try {
        await apiRequest(`/admin/quotes/${quote.id}/notes`, {
          method: "PUT",
          body: JSON.stringify({ notes: notesTextarea.value }),
        });
        notesSaveStatus.textContent = "✓ Guardado automáticamente";
        setTimeout(() => { notesSaveStatus.textContent = ""; }, 2500);
      } catch {
        notesSaveStatus.textContent = "Error al guardar";
        notesSaveStatus.style.color = "#dc2626";
      }
    }, 1200);
  });

  // =====================
  // Bloque CLIENTE
  // =====================
  const customerCard = document.createElement("div");
  customerCard.className = "customers-card";
  customerCard.style.marginTop = "12px";
  wrapper.appendChild(customerCard);

  const custTitle = document.createElement("h3");
  custTitle.textContent = "Cliente";
  custTitle.style.margin = "0 0 8px 0";
  customerCard.appendChild(custTitle);

  const c = quote.customer || {};
  const pName = document.createElement("p");
  pName.textContent = c.name || "—";
  customerCard.appendChild(pName);

  const pPhone = document.createElement("p");
  pPhone.style.margin = "0";
  pPhone.textContent = "Teléfono: " + (c.phone || "—");
  customerCard.appendChild(pPhone);

  const pEmail = document.createElement("p");
  pEmail.style.margin = "0";
  pEmail.textContent = "Email: " + (c.email || "—");
  customerCard.appendChild(pEmail);

  // =====================
  // Tabla CONCEPTOS
  // =====================
  const conceptsCard = document.createElement("div");
  conceptsCard.className = "customers-card";
  conceptsCard.style.marginTop = "12px";
  wrapper.appendChild(conceptsCard);

  const concTitle = document.createElement("h3");
  concTitle.textContent = "Conceptos";
  concTitle.style.margin = "0 0 8px 0";
  conceptsCard.appendChild(concTitle);

  const table = document.createElement("table");
  table.className = "table";
  conceptsCard.appendChild(table);

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Concepto</th>
      <th>Cant.</th>
      <th>Precio</th>
      <th>IVA</th>
      <th>Total</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  table.appendChild(tbody);

  const lines = Array.isArray(quote.lines) ? quote.lines : [];

  let totalBase = 0;
  let totalIva = 0;

  lines.forEach((line) => {
    const l = line || {};
    const qty = Number(l.qty) || 0;
    const price = Number(l.price) || 0;
    const tax = Number(l.tax ?? 0);

    const base = qty * price;
    const ivaAmount = base * tax;
    const total = base + ivaAmount;

    totalBase += base;
    totalIva += ivaAmount;

    const tr = document.createElement("tr");

    const tdConcept = document.createElement("td");
    tdConcept.textContent = l.concept || "—";
    tr.appendChild(tdConcept);

    const tdQty = document.createElement("td");
    tdQty.textContent = qty.toString();
    tr.appendChild(tdQty);

    const tdPrice = document.createElement("td");
    tdPrice.textContent = price.toFixed(2) + " €";
    tr.appendChild(tdPrice);

    const tdTax = document.createElement("td");
    tdTax.textContent = (tax * 100).toFixed(0) + " %";
    tr.appendChild(tdTax);

    const tdTotal = document.createElement("td");
    tdTotal.textContent = total.toFixed(2) + " €";
    tr.appendChild(tdTotal);

    tbody.appendChild(tr);
  });

  // Totales
  const totalsCard = document.createElement("div");
  totalsCard.className = "customers-card";
  totalsCard.style.marginTop = "12px";
  wrapper.appendChild(totalsCard);

  const tTitle = document.createElement("h3");
  tTitle.textContent = "Totales";
  tTitle.style.margin = "0 0 8px 0";
  totalsCard.appendChild(tTitle);

  const pBase = document.createElement("p");
  pBase.style.margin = "0";
  pBase.textContent = "Base imponible: " + totalBase.toFixed(2) + " EUR";
  totalsCard.appendChild(pBase);

  const pIva = document.createElement("p");
  pIva.style.margin = "0";
  pIva.textContent = "IVA total: " + totalIva.toFixed(2) + " EUR";
  totalsCard.appendChild(pIva);

  const pTotal = document.createElement("p");
  pTotal.style.margin = "0";
  pTotal.textContent =
    "Total presupuesto: " + Number(quote.total || 0).toFixed(2) + " EUR";
  totalsCard.appendChild(pTotal);

  // =====================
  // Bloque DECISIÓN
  // =====================
  const decisionCard = document.createElement("div");
  decisionCard.className = "customers-card";
  decisionCard.style.marginTop = "12px";
  wrapper.appendChild(decisionCard);

  const dTitle = document.createElement("h3");
  dTitle.textContent = "Decisión";
  dTitle.style.margin = "0 0 8px 0";
  decisionCard.appendChild(dTitle);

  const d = quote.decision || {};

  const pChannel = document.createElement("p");
  pChannel.style.margin = "0";
  pChannel.textContent = "Canal: " + (d.decisionChannel || "—");
  decisionCard.appendChild(pChannel);

  const pComment = document.createElement("p");
  pComment.style.margin = "0";
  pComment.textContent = "Comentario: " + (d.decisionComment || "—");
  decisionCard.appendChild(pComment);

  const pReason = document.createElement("p");
  pReason.style.margin = "0";
  pReason.textContent =
    "Motivo rechazo: " + (d.rejectionReason || "—");
  decisionCard.appendChild(pReason);

  const pAcceptedAt = document.createElement("p");
  pAcceptedAt.style.margin = "0";
  pAcceptedAt.textContent =
    "Aceptado en: " +
    (d.acceptedAt
      ? new Date(d.acceptedAt).toLocaleString("es-ES")
      : "—");
  decisionCard.appendChild(pAcceptedAt);

  const pRejectedAt = document.createElement("p");
  pRejectedAt.style.margin = "0";
  pRejectedAt.textContent =
    "Rechazado en: " +
    (d.rejectedAt
      ? new Date(d.rejectedAt).toLocaleString("es-ES")
      : "—");
  decisionCard.appendChild(pRejectedAt);

  const pTerms = document.createElement("p");
  pTerms.style.margin = "0";
  
  const paymentLabel = getPaymentTermsLabel(d.paymentTerms);
  pTerms.textContent = "Condiciones de pago: " + paymentLabel;
  
  decisionCard.appendChild(pTerms);
  


  // === BOTONES ADMIN: ACEPTAR / RECHAZAR (solo si sigue en draft/pending) ===
  if (st === "draft" || st === "pending") {
    const actions = document.createElement("div");
    actions.style.marginTop = "12px";
    actions.style.display = "flex";
    actions.style.gap = "8px";

    const btnAccept = document.createElement("button");
    btnAccept.className = "btn btn-primary";
    btnAccept.textContent = "Aceptar presupuesto";

    const btnReject = document.createElement("button");
    btnReject.className = "btn btn-secondary";
    btnReject.textContent = "Rechazar presupuesto";

    actions.appendChild(btnAccept);
    actions.appendChild(btnReject);
    decisionCard.appendChild(actions);

    btnAccept.addEventListener("click", async () => {
      const paymentTerms = prompt(
        "Condiciones de pago (opcional, se guardan en el presupuesto):",
        d.paymentTerms || ""
      );
      const comment = prompt(
        "Comentario interno (opcional):",
        d.decisionComment || ""
      );

      btnAccept.disabled = true;
      btnReject.disabled = true;

      try {
        const res = await fetch(`/admin/quotes/${quote.id}/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: "backoffice",
            paymentTerms: paymentTerms || undefined,
            comment: comment || undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          alert("Error al aceptar presupuesto: " + (data.error || "desconocido"));
          btnAccept.disabled = false;
          btnReject.disabled = false;
          return;
        }

        // Volvemos a cargar el detalle con el nuevo estado
        await renderQuoteDetailView(container, quote.id);
      } catch (err) {
        alert("Error al aceptar presupuesto: " + err.message);
        btnAccept.disabled = false;
        btnReject.disabled = false;
      }
    });

    btnReject.addEventListener("click", async () => {
      const reason = prompt(
        "Motivo de rechazo (obligatorio, visible en el historial):",
        d.rejectionReason || ""
      );
      if (!reason || !reason.trim()) {
        alert("El motivo de rechazo es obligatorio.");
        return;
      }

      const comment = prompt(
        "Comentario interno (opcional):",
        d.decisionComment || ""
      );

      btnAccept.disabled = true;
      btnReject.disabled = true;

      try {
        const res = await fetch(`/admin/quotes/${quote.id}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: "backoffice",
            reason: reason.trim(),
            comment: comment || undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          alert("Error al rechazar presupuesto: " + (data.error || "desconocido"));
          btnAccept.disabled = false;
          btnReject.disabled = false;
          return;
        }

        await renderQuoteDetailView(container, quote.id);
      } catch (err) {
        alert("Error al rechazar presupuesto: " + err.message);
        btnAccept.disabled = false;
        btnReject.disabled = false;
      }
    });
  }

  // =====================
  // FACTURAS RELACIONADAS
  // =====================
  const invoicesCard = document.createElement("div");
  invoicesCard.className = "customers-card";
  invoicesCard.style.marginTop = "12px";
  wrapper.appendChild(invoicesCard);

  const invTitle = document.createElement("h3");
  invTitle.textContent = "Facturas";
  invTitle.style.margin = "0 0 8px 0";
  invoicesCard.appendChild(invTitle);

  const invoices = Array.isArray(quote.invoices) ? quote.invoices : [];

  const invList = document.createElement("div");
  invoicesCard.appendChild(invList);

  function renderInvoices() {
    invList.innerHTML = "";

    if (invoices.length === 0) {
      const p = document.createElement("p");
      p.textContent = "No hay facturas generadas.";
      p.style.margin = "0 0 8px 0";
      invList.appendChild(p);
      return;
    }

    invoices.forEach((inv) => {
      const div = document.createElement("div");
      div.className = "invoice-item";
      div.style.cursor = "pointer";

      div.innerHTML = `
        <p style="margin:0;">
          <strong>${inv.number}</strong><br>
          Total: ${Number(inv.total).toFixed(2)} ${inv.currency}<br>
          Creada: ${
            inv.createdAt
              ? new Date(inv.createdAt).toLocaleString("es-ES")
              : "—"
          }
        </p>
      `;

      // Al hacer click, vamos a la vista de detalle de factura
      div.addEventListener("click", () => {
        if (window.renderAppView) {
          window.renderAppView("invoice-detail", { invoiceId: inv.id });
        }
      });

     
    


      // Botón "Marcar como pagada" solo si la factura está pendiente
      if (inv.status === "pending") {
        const btnPaid = document.createElement("button");
        btnPaid.className = "btn btn-secondary btn-xs";
        btnPaid.style.marginTop = "4px";
        btnPaid.textContent = "Marcar como pagada";

        btnPaid.addEventListener("click", async () => {
          btnPaid.disabled = true;
          const originalText = btnPaid.textContent;
          btnPaid.textContent = "Guardando…";

          try {
            const res = await fetch(`/admin/invoices/${inv.id}/status`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "paid" }),
            });
            

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
              alert(
                "Error marcando como pagada: " +
                  (data.error || "desconocido")
              );
              btnPaid.disabled = false;
              btnPaid.textContent = originalText;
              return;
            }

            // Recargamos el detalle de la misma quote para ver el nuevo estado
            await renderQuoteDetailView(container, quote.id);
          } catch (err) {
            const msg =
              err && err.message
                ? err.message
                : typeof err === "string"
                ? err
                : "error_desconocido";

            alert("Error marcando como pagada: " + msg);
            btnPaid.disabled = false;
            btnPaid.textContent = originalText;
          }
        });

        div.appendChild(btnPaid);
      }

      invList.appendChild(div);
    });
  }

  renderInvoices();

  // --- BOTÓN PARA GENERAR FACTURA SEGÚN CONDICIONES ---
  const btnInvoice = document.createElement("button");
  btnInvoice.className = "btn btn-primary";
  btnInvoice.style.marginTop = "12px";
  invoicesCard.appendChild(btnInvoice);

  const pt = quote?.decision?.paymentTerms ?? quote?.paymentTerms ?? null;

  const stStatus = st; // status ya en minúsculas

  const isAccepted = stStatus === "accepted";
  const isFullUpfront = pt === "FULL_UPFRONT";
  const isFiftyFifty = pt === "FIFTY_FIFTY";

  let canGenerateInvoice = false;

  if (!isAccepted) {
    // Aún no se ha aceptado el presupuesto
    btnInvoice.textContent = "Solo disponible tras aceptar el presupuesto";
    btnInvoice.disabled = true;
  } else if (isFullUpfront) {
    // 100% al aceptar → una única factura
    if (invoices.length === 0) {
      btnInvoice.textContent = "Generar factura (100%)";
      canGenerateInvoice = true;
    } else {
      btnInvoice.textContent = "Factura ya generada";
      btnInvoice.disabled = true;
    }
  } else if (isFiftyFifty) {
    // 50/50 → hasta dos facturas
    if (invoices.length === 0) {
      btnInvoice.textContent = "Generar 1ª factura (50%)";
      canGenerateInvoice = true;
    } else if (invoices.length === 1) {
      btnInvoice.textContent = "Generar 2ª factura (50% restante)";
      canGenerateInvoice = true;
    } else {
      btnInvoice.textContent = "Plan de facturación completado";
      btnInvoice.disabled = true;
    }
  } else {
    // MANUAL, NONE u otros códigos
    btnInvoice.textContent = "No disponible para estas condiciones de pago";
    btnInvoice.disabled = true;
  }

  // Si ahora mismo no es momento de generar factura, no añadimos handler
  if (!canGenerateInvoice) {
    return;
  }

  // Handler de click: delegamos en el backend y recargamos la vista
  btnInvoice.addEventListener("click", async () => {
    btnInvoice.disabled = true;
    const originalText = btnInvoice.textContent;
    btnInvoice.textContent = "Generando…";

    try {
      const res = await fetch(`/admin/quotes/${quote.id}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert("Error generando factura: " + (data.error || "desconocido"));
        btnInvoice.disabled = false;
        btnInvoice.textContent = originalText;
        return;
      }

      // Tras generar la factura (1ª o 2ª), recargamos el detalle
      await renderQuoteDetailView(container, quote.id);
    } catch (err) {
      const msg =
        err && err.message
          ? err.message
          : typeof err === "string"
          ? err
          : "error_desconocido";

      alert("Error generando factura: " + msg);
      btnInvoice.disabled = false;
      btnInvoice.textContent = originalText;
    }
  });

  // --- MARGEN DEL TRABAJO ---
  const marginCard = document.createElement("div");
  marginCard.className = "customers-card";
  marginCard.style.marginTop = "12px";
  wrapper.appendChild(marginCard);

  const mTitle = document.createElement("h3");
  mTitle.textContent = "Gastos y margen";
  mTitle.style.margin = "0 0 8px 0";
  marginCard.appendChild(mTitle);

  const mBody = document.createElement("div");
  mBody.innerHTML = '<p style="color:#9ca3af;font-size:13px">Cargando…</p>';
  marginCard.appendChild(mBody);

  // Cargar margen
  apiRequest(`/admin/expenses/margin/${id}`).then((data) => {
    if (!data) return;
    const marginColor = data.margin >= 0 ? '#16a34a' : '#dc2626';
    mBody.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
        <div style="background:#f9fafb;border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:600">Ingresos</div>
          <div style="font-size:18px;font-weight:700;color:#111827">${fmtAmt(data.revenue, data.currency)}</div>
        </div>
        <div style="background:#fef2f2;border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:600">Gastos</div>
          <div style="font-size:18px;font-weight:700;color:#dc2626">${fmtAmt(data.totalExpenses, data.currency)}</div>
        </div>
        <div style="background:${data.margin>=0?'#ecfdf5':'#fef2f2'};border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:600">Margen</div>
          <div style="font-size:18px;font-weight:700;color:${marginColor}">${fmtAmt(data.margin, data.currency)}</div>
          <div style="font-size:12px;color:${marginColor}">${data.marginPct}%</div>
        </div>
      </div>
      ${data.expenses.length ? `
        <div style="font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:600">GASTOS ASIGNADOS</div>
        ${data.expenses.map(e => `
          <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid #f3f4f6">
            <span>${escHtml(e.concept)}</span>
            <span style="font-weight:600">${fmtAmt(e.amount, data.currency)}</span>
          </div>`).join('')}
      ` : '<p style="font-size:13px;color:#9ca3af">Sin gastos asignados a esta cotización.</p>'}
      <button onclick="renderAppView('expenses')" class="btn btn-secondary" style="margin-top:10px;font-size:13px">
        + Añadir gasto a este trabajo
      </button>
    `;
  }).catch(() => {
    mBody.innerHTML = '<p style="font-size:13px;color:#9ca3af">No hay datos de gastos.</p>';
  });

  function fmtAmt(amount, currency) {
    const sym = (currency==='MXN'||currency==='COP') ? '$' : '€';
    return `${sym}${Number(amount).toLocaleString('es',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  }
}

// ── Duplicar presupuesto ──────────────────────────────────────────────────
async function duplicateQuote(quoteId) {
  var detail;
  try {
    detail = await apiRequest('/admin/quotes/' + quoteId);
  } catch(e) {
    alert('Error al cargar el presupuesto para duplicar.');
    return;
  }
  var tpl = {
    name: 'Copia de #' + quoteId,
    currency: detail.currency,
    lines: detail.lines || [],
    tiers: detail.tiers || null,
    paymentTerms: detail.paymentTerms || null,
  };
  sessionStorage.setItem('pf_load_template', JSON.stringify(tpl));
  if (window.renderAppView) {
    renderAppView('quotes-new');
  }
}

// ── Timeline visual del estado del presupuesto (FRONT1-5) ─────────────────
function buildStatusTimeline(quote) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin-top:16px";

  const st = String(quote.status || "").toLowerCase();
  const d = quote.decision || {};
  const invoices = Array.isArray(quote.invoices) ? quote.invoices : [];
  const paidInv = invoices.find((i) => String(i.status).toLowerCase() === "paid");

  const fmtD = (v) => {
    if (!v) return "";
    try { return new Date(v).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }); }
    catch { return ""; }
  };

  const rejected = st === "rejected";
  const accepted = st === "accepted";
  const sent = accepted || rejected || st === "sent";

  const steps = [
    { label: "Creada", icon: "📝", state: "done", date: fmtD(quote.createdAt) },
    { label: "Enviada", icon: "📤", state: sent ? "done" : (st === "draft" ? "current" : "pending"), date: "" },
    rejected
      ? { label: "Rechazada", icon: "✖", state: "rejected", date: fmtD(d.rejectedAt || quote.rejectedAt) }
      : { label: "Aceptada", icon: "✍️", state: accepted ? "done" : (st === "sent" ? "current" : "pending"), date: fmtD(d.acceptedAt || quote.acceptedAt) },
    { label: "Facturada", icon: "🧾", state: invoices.length ? "done" : "pending", date: invoices.length ? fmtD(invoices[0].createdAt) : "" },
    { label: "Cobrada", icon: "💰", state: paidInv ? "done" : "pending", date: paidInv ? fmtD(paidInv.paidAt || paidInv.createdAt) : "" },
  ];

  const colorFor = (s) => s === "done" ? "#22c55e" : s === "current" ? "#0ea5e9" : s === "rejected" ? "#ef4444" : "#e5e7eb";
  const textFor  = (s) => s === "pending" ? "#9ca3af" : "#374151";

  const row = document.createElement("div");
  row.style.cssText = "display:flex;align-items:flex-start;justify-content:space-between;gap:4px;margin-top:6px";

  steps.forEach((step, i) => {
    const col = document.createElement("div");
    col.style.cssText = "flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;position:relative";

    // Línea conectora hacia el paso anterior
    if (i > 0) {
      const line = document.createElement("div");
      const prevDone = steps[i - 1].state === "done";
      line.style.cssText = `position:absolute;top:15px;left:-50%;width:100%;height:3px;background:${prevDone ? "#22c55e" : "#e5e7eb"};z-index:0`;
      col.appendChild(line);
    }

    const dot = document.createElement("div");
    dot.style.cssText = `width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;z-index:1;background:${colorFor(step.state)};color:${step.state === "pending" ? "#9ca3af" : "#fff"};box-shadow:${step.state === "current" ? "0 0 0 4px rgba(14,165,233,.2)" : "none"}`;
    dot.textContent = step.icon;
    col.appendChild(dot);

    const lbl = document.createElement("div");
    lbl.style.cssText = `margin-top:6px;font-size:12px;font-weight:600;color:${textFor(step.state)}`;
    lbl.textContent = step.label;
    col.appendChild(lbl);

    if (step.date) {
      const dt = document.createElement("div");
      dt.style.cssText = "font-size:11px;color:#9ca3af";
      dt.textContent = step.date;
      col.appendChild(dt);
    }

    row.appendChild(col);
  });

  wrap.appendChild(row);
  return wrap;
}
