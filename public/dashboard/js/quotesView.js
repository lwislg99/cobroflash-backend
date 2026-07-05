// public/dashboard/js/quotesView.js

function renderQuotesView(container) {
  container.innerHTML = "";

  // ---------- LAYOUT PRINCIPAL (responsive) ----------
  const layout = document.createElement("div");
  layout.className = "quotes-layout";
  container.appendChild(layout);

  const leftCard = document.createElement("div");
  leftCard.className = "card quotes-left-card";
  layout.appendChild(leftCard);

  const rightCard = document.createElement("div");
  rightCard.className = "card quotes-right-card";
  layout.appendChild(rightCard);

  // ---------- CABECERA IZQUIERDA ----------
  const heading = document.createElement("div");
  heading.className = "quotes-header-block";

  const title = document.createElement("h2");
  title.textContent = "Crear presupuesto";
  title.className = "quotes-title";
  heading.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "quotes-desc";
  subtitle.textContent =
    "Genera un presupuesto con varias líneas, calcula los totales y envía el link de pago por WhatsApp.";
  heading.appendChild(subtitle);

  const merchantInfo = document.createElement("p");
  merchantInfo.className = "quotes-merchant-info";
  merchantInfo.textContent = "Cargando datos de empresa…";
  heading.appendChild(merchantInfo);

  leftCard.appendChild(heading);


  // ---------- ALERTAS ----------
  const alertBox = document.createElement("div");
  alertBox.className = "alert";
  alertBox.style.display = "none";
  leftCard.appendChild(alertBox);

  function setAlert(type, msg) {
    alertBox.textContent = msg || "";
    alertBox.className = "alert";
    if (type === "success") alertBox.classList.add("success");
    if (type === "error") alertBox.classList.add("error");
    alertBox.style.display = (type || msg) ? "block" : "none";
  }




    // ---------- MODAL PREVISUALIZACIÓN PRESUPUESTO ----------
function openQuoteModal({ quoteId, quoteNumber, pdfUrl, allowWhatsapp, pendingApproval }) {
  // A1.2: quoteNumber = número visible por merchant; quoteId sigue siendo el
  // id global para las llamadas a la API.
  const displayNum = quoteNumber ?? quoteId;
  // A1.3: pendiente de aprobación → no se ofrece el envío (el backend lo
  // rechazaría con 409); se explica con un mensaje digno.
  if (pendingApproval) allowWhatsapp = false;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.maxWidth = "860px";

  const mHeader = document.createElement("div");
  mHeader.className = "modal-header";
  const mTitle = document.createElement("span");
  mTitle.className = "modal-title";
  mTitle.textContent = `Presupuesto #${displayNum} generado`;
  mHeader.appendChild(mTitle);
  modal.appendChild(mHeader);

  const mBody = document.createElement("div");
  mBody.className = "modal-body";
  mBody.style.cssText = "flex-direction:column;gap:10px";

  const desc = document.createElement("p");
  desc.style.cssText = "margin:0;font-size:13.5px;color:var(--neutral-500)";
  desc.textContent = "Revisa el PDF del presupuesto antes de enviarlo por WhatsApp al cliente.";
  mBody.appendChild(desc);

  if (pdfUrl) {
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Abrir PDF en nueva pestaña →";
    link.style.cssText = "display:inline-block;margin-bottom:8px;font-size:13px";
    mBody.appendChild(link);

    const frameWrapper = document.createElement("div");
    frameWrapper.style.cssText = "border:1px solid var(--neutral-200);border-radius:8px;overflow:hidden";
    const iframe = document.createElement("iframe");
    iframe.src = pdfUrl;
    iframe.title = `PDF Presupuesto #${displayNum}`;
    iframe.loading = "lazy";
    iframe.style.cssText = "width:100%;height:55vh;border:none;display:block";
    frameWrapper.appendChild(iframe);
    mBody.appendChild(frameWrapper);
  } else {
    const warn = document.createElement("p");
    warn.style.color = "#b45309";
    warn.textContent = "No se ha encontrado la URL del PDF todavía. Puede tardar unos segundos en generarse.";
    mBody.appendChild(warn);
  }

  if (pendingApproval) {
    const info = document.createElement("p");
    info.style.cssText = "font-size:13px;color:#b45309;margin:4px 0 0;font-weight:600";
    info.textContent = '📋 Enviado a un administrador para aprobación. Podrás mandarlo al cliente cuando lo apruebe.';
    mBody.appendChild(info);
  } else if (!allowWhatsapp) {
    const info = document.createElement("p");
    info.style.cssText = "font-size:12px;color:#6b756f;margin:4px 0 0";
    info.textContent = 'Has desmarcado "Enviar por WhatsApp automáticamente", por eso no se muestra el botón de WhatsApp.';
    mBody.appendChild(info);
  }

  // UX (feedback fundador): las acciones de envío viven en el CUERPO como
  // grupo propio ("Enviar al cliente"), no amontonadas en el pie. El pie
  // queda solo para cerrar — jerarquía clara: revisar → enviar → hecho.
  const shareWrap = document.createElement("div");
  const shareLabel = document.createElement("div");
  shareLabel.className = "modal-share-label";
  shareLabel.textContent = pendingApproval ? "Documento" : "Enviar al cliente";
  const shareRow = document.createElement("div");
  shareRow.className = "modal-share";
  shareWrap.appendChild(shareLabel);
  shareWrap.appendChild(shareRow);
  mBody.appendChild(shareWrap);

  modal.appendChild(mBody);

  const mFooter = document.createElement("div");
  mFooter.className = "modal-footer";

  // UX (feedback fundador): la modal NO se cierra al actuar — patrón "compartir"
  // (Drive/Stripe): cada acción confirma en su propio botón ("✓ Enviado") y se
  // pueden encadenar (WhatsApp + email + PDF). El cierre pasa a "Hecho ✓".
  let didSomething = false;
  function markDone(btn, label) {
    didSomething = true;
    btn.disabled = true;
    btn.classList.remove("btn-primary", "btn-secondary");
    btn.classList.add("btn-done");
    btn.textContent = label;
    closeBtn.textContent = "Hecho ✓";
    closeBtn.classList.remove("btn-secondary");
    closeBtn.classList.add("btn-primary");
  }

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Seguir editando";
  closeBtn.className = "btn btn-secondary";
  closeBtn.addEventListener("click", function() { overlay.remove(); });
  mFooter.appendChild(closeBtn);

  // A2.3: Descargar PDF (el PDF ya está generado; no cierra la modal)
  if (pdfUrl) {
    const dlBtn = document.createElement("a");
    dlBtn.href = pdfUrl;
    // displayNum es un NÚMERO (quote.number); String() antes de limpiar el '#'
    dlBtn.download = "presupuesto-" + String(displayNum).replace('#', '') + ".pdf";
    dlBtn.textContent = "⬇ Descargar PDF";
    dlBtn.className = "btn btn-secondary";
    dlBtn.addEventListener("click", function() {
      didSomething = true;
      closeBtn.textContent = "Hecho ✓";
      closeBtn.classList.remove("btn-secondary");
      closeBtn.classList.add("btn-primary");
    });
    shareRow.appendChild(dlBtn);
  }

  // A2.3: Enviar por email (plantilla Resend con el link del presupuesto)
  if (!pendingApproval) {
    const emailBtn = document.createElement("button");
    emailBtn.type = "button";
    emailBtn.textContent = "✉ Enviar por email";
    emailBtn.className = "btn btn-secondary";
    emailBtn.addEventListener("click", async function() {
      emailBtn.disabled = true;
      emailBtn.textContent = "Enviando…";
      try {
        const res = await fetch(`/admin/quotes/${quoteId}/send-email`, { method: "POST" });
        const body = await res.json().catch(function() { return {}; });
        if (!res.ok) {
          const known = {
            customer_missing_email: "Este cliente no tiene email; añádelo en su ficha.",
            pending_approval: "Pendiente de aprobación: no se puede enviar todavía.",
          };
          throw new Error(known[body.error] || "No se pudo enviar el email. Inténtalo de nuevo.");
        }
        if (body.ok) {
          setAlert("success", "Presupuesto enviado por email.");
          setResult({ quote_id: quoteId, number: displayNum, status: "SENT", sent: true });
          markDone(emailBtn, "✓ Enviado por email"); // la modal sigue abierta
        } else {
          throw new Error(body.message || "No se pudo enviar el email.");
        }
      } catch (err) {
        setAlert("error", err.message || "Error enviando el email.");
        emailBtn.disabled = false;
        emailBtn.textContent = "✉ Enviar por email";
      }
    });
    shareRow.insertBefore(emailBtn, shareRow.firstChild); // tras WhatsApp, antes de PDF
  }

  if (allowWhatsapp) {
    const sendBtn = document.createElement("button");
    sendBtn.type = "button";
    sendBtn.textContent = "Enviar por WhatsApp";
    sendBtn.className = "btn btn-primary";
    sendBtn.addEventListener("click", async function() {
      sendBtn.disabled = true;
      sendBtn.textContent = "Enviando…";
      try {
        const res = await fetch(`/admin/quotes/${quoteId}/send-whatsapp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          // A1.3: jamás JSON crudo — mapear los errores conocidos a copy humano
          const errData = await res.json().catch(() => null);
          const known = {
            pending_approval: "📋 Enviado a un administrador para aprobación. Podrás mandarlo al cliente cuando lo apruebe.",
            customer_missing_phone: "Este cliente no tiene teléfono; añádelo para enviar por WhatsApp.",
            invalid_phone_format: "El teléfono del cliente no tiene un formato válido.",
          };
          throw new Error(known[errData && errData.error] || ("No se pudo enviar por WhatsApp (" + res.status + "). Inténtalo de nuevo."));
        }
        const body = await res.json();
        // P3-2: si Meta rechazó, el backend devuelve 200 ok:false con un mensaje claro.
        if (body.ok) {
          setAlert("success", "Presupuesto enviado por WhatsApp.");
          setResult({ quote_id: quoteId, number: displayNum, status: "SENT", sent: true });
          markDone(sendBtn, "✓ Enviado por WhatsApp"); // la modal sigue abierta
        } else {
          setAlert("error", body.message || "Presupuesto creado, pero no se pudo enviar por WhatsApp.");
          setResult({ quote_id: quoteId, number: displayNum, status: "DRAFT", sent: false });
          sendBtn.disabled = false;
          sendBtn.textContent = "Enviar por WhatsApp";
        }
      } catch (err) {
        setAlert("error", err.message || "Error enviando por WhatsApp.");
        sendBtn.disabled = false;
        sendBtn.textContent = "Enviar por WhatsApp";
      }
    });
    shareRow.insertBefore(sendBtn, shareRow.firstChild); // WhatsApp primero (primario)
  }

  modal.appendChild(mFooter);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) overlay.remove();
  });
}


  // ---------- HELPERS DE CAMPOS ----------
  function createField(labelText, name, type = "text", required = false) {
    const wrapper = document.createElement("div");
    wrapper.className = "field";
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.name = name;
    input.type = type;
    if (required) input.required = true;
    wrapper.appendChild(label);
    wrapper.appendChild(input);
    return { wrapper, input };
  }

  function createFieldSelect(labelText, name) {
    const wrapper = document.createElement("div");
    wrapper.className = "field";
    const label = document.createElement("label");
    label.textContent = labelText;
    const select = document.createElement("select");
    select.name = name;
    wrapper.appendChild(label);
    wrapper.appendChild(select);
    return { wrapper, select };
  }

  // ---------- BLOQUE A: DATOS DEL CLIENTE ----------
  const blockClient = document.createElement("div");
  blockClient.className = "quote-block";
  leftCard.appendChild(blockClient);

  const blockATitle = document.createElement("h3");
  blockATitle.textContent = "Datos del cliente";
  blockATitle.className = "quote-block-title";
  blockClient.appendChild(blockATitle);

  const clientFormRow = document.createElement("div");
  clientFormRow.className = "quote-form-row";
  blockClient.appendChild(clientFormRow);

  const fieldCustomer = createFieldSelect("Cliente", "customer_id");
  clientFormRow.appendChild(fieldCustomer.wrapper);

  const fieldVatDefault = createField(
    "IVA por defecto (%)",
    "vat_default",
    "number",
    true
  );
  fieldVatDefault.input.value = "21";
  fieldVatDefault.input.min = "0";
  fieldVatDefault.input.step = "1";
  clientFormRow.appendChild(fieldVatDefault.wrapper);

    // Checkbox WhatsApp
    // A2.3: el checkbox "Enviar por WhatsApp automáticamente" desaparece — al
    // crear, el modal de previsualización ofrece SIEMPRE elegir: WhatsApp,
    // email, descargar PDF o seguir editando.

    // Checkbox: incluir descripción en PDF (MVP: solo afecta a la vista previa por ahora)
const descWrapper = document.createElement("div");
descWrapper.className = "field inline-checkbox";

const descLabel = document.createElement("label");
const descCheck = document.createElement("input");
descCheck.type = "checkbox";
descCheck.name = "include_description";
descCheck.checked = false;

descLabel.appendChild(descCheck);
descLabel.appendChild(document.createTextNode(" Incluir descripción en el PDF"));
descWrapper.appendChild(descLabel);

blockClient.appendChild(descWrapper);

  
    // ---------- CONDICIONES DE PAGO (SELECT) ----------
    const fieldPaymentTerms = createFieldSelect(
      "Condiciones de pago",
      "payment_terms"
    );
    const paymentSelect = fieldPaymentTerms.select;
  
    // Opción vacía (sin condiciones)
    const optNone = document.createElement("option");
    optNone.value = "";
    optNone.textContent = "Sin condiciones específicas";
    paymentSelect.appendChild(optNone);
  
    // 100% al aceptar
    const optFull = document.createElement("option");
    optFull.value = "FULL_UPFRONT";
    optFull.textContent = "Pago 100% al aceptar";
    paymentSelect.appendChild(optFull);
  
    // 50/50
    const opt5050 = document.createElement("option");
    opt5050.value = "FIFTY_FIFTY";
    opt5050.textContent = "50% al aceptar, 50% al finalizar";
    paymentSelect.appendChild(opt5050);
  
    // Solo presupuesto, sin facturación automática
    const optManual = document.createElement("option");
    optManual.value = "MANUAL";
    optManual.textContent = "Solo presupuesto (facturación manual)";
    paymentSelect.appendChild(optManual);
  
    // Valor por defecto para el MVP
    paymentSelect.value = "FULL_UPFRONT";
  
    blockClient.appendChild(fieldPaymentTerms.wrapper);

    // ---------- A2.1: MÉTODOS DE PAGO PARA ESTE PRESUPUESTO ----------
    // ☐ Tarjeta ☐ Bizum ☐ Transferencia — todos marcados por defecto (= null
    // en el payload: el cliente ve todos los que el merchant tenga activos).
    const payMethodsWrapper = document.createElement("div");
    payMethodsWrapper.className = "field";
    payMethodsWrapper.innerHTML =
      '<label class="pay-methods-title">Formas de pago que verá el cliente</label>';
    const pmRow = document.createElement("div");
    pmRow.className = "pay-methods-row";
    const pmDefs = [
      { key: "card", label: "💳 Tarjeta" },
      { key: "bizum", label: "📲 Bizum" },
      { key: "transfer", label: "🏦 Transferencia" },
    ];
    const pmChecks = {};
    pmDefs.forEach(function (def) {
      const lbl = document.createElement("label");
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = true;
      pmChecks[def.key] = chk;
      lbl.appendChild(chk);
      lbl.appendChild(document.createTextNode(" " + def.label));
      pmRow.appendChild(lbl);
    });
    payMethodsWrapper.appendChild(pmRow);
    const pmNote = document.createElement("p");
    pmNote.className = "pay-methods-note";
    pmNote.textContent = "Solo se muestran las que tengas configuradas (IBAN, Bizum o tarjeta).";
    payMethodsWrapper.appendChild(pmNote);
    blockClient.appendChild(payMethodsWrapper);

    // Devuelve el array para el payload, o undefined si están todas (= sin límite)
    function selectedPayMethods() {
      const sel = pmDefs.filter(function (d) { return pmChecks[d.key].checked; }).map(function (d) { return d.key; });
      if (sel.length === 0 || sel.length === pmDefs.length) return undefined;
      return sel;
    }

  // ---------- BLOQUE B: LÍNEAS DEL PRESUPUESTO ----------
  const blockLines = document.createElement("div");
  blockLines.className = "quote-block";
  leftCard.appendChild(blockLines);

  const blockBTitle = document.createElement("h3");
  blockBTitle.textContent = "Líneas del presupuesto";
  blockBTitle.className = "quote-block-title";
  blockLines.appendChild(blockBTitle);

  const linesHeader = document.createElement("div");
  linesHeader.className = "quote-lines-header";

  const lhText = document.createElement("span");
  lhText.textContent = "Añade los conceptos que vas a presupuestar.";
  linesHeader.appendChild(lhText);

  const addLineBtn = document.createElement("button");
  addLineBtn.type = "button";
  addLineBtn.className = "btn btn-secondary";
  addLineBtn.textContent = "+ Añadir línea";
  linesHeader.appendChild(addLineBtn);

  const aiBtn = document.createElement("button");
  aiBtn.type = "button";
  aiBtn.className = "btn-ghost btn-sm";
  aiBtn.style.cssText = "font-size:12px;padding:4px 10px;border-radius:6px;border:1px dashed var(--neutral-300);color:var(--neutral-600)";
  aiBtn.innerHTML = "✨ Sugerir con IA";
  aiBtn.title = "Describe el trabajo y Claude sugiere las líneas del presupuesto";
  linesHeader.appendChild(aiBtn);

  const useTemplateBtn = document.createElement("button");
  useTemplateBtn.type = "button";
  useTemplateBtn.className = "btn-ghost btn-sm";
  useTemplateBtn.style.cssText = "font-size:12px;padding:4px 10px;border-radius:6px;border:1px dashed var(--neutral-300);color:var(--neutral-600)";
  useTemplateBtn.innerHTML = "📋 Usar plantilla";
  useTemplateBtn.title = "Cargar líneas desde una plantilla guardada";
  linesHeader.appendChild(useTemplateBtn);

  blockLines.appendChild(linesHeader);

  const table = document.createElement("table");
  table.className = "table quote-lines-table";
  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  ["Concepto", "Cantidad", "Precio", "Markup %", "IVA %", "Total línea", ""].forEach(
    (h) => {
      const th = document.createElement("th");
      th.textContent = h;
      trHead.appendChild(th);
    }
  );
  thead.appendChild(trHead);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  // A6.6 (P1 móvil): la tabla de líneas es más ancha que un móvil de 390px;
  // scrollea DENTRO de su contenedor y no arrastra toda la vista (overflow-x).
  const tableWrap = document.createElement("div");
  tableWrap.className = "quote-lines-scroll";
  tableWrap.appendChild(table);
  blockLines.appendChild(tableWrap);

  // ---------- DRAG & DROP para reordenar líneas (FRONT1-4) ----------
  let draggedTr = null;
  tbody.addEventListener("dragover", function (e) {
    if (!draggedTr) return;
    e.preventDefault();
    const rows = Array.from(tbody.querySelectorAll("tr:not(.dragging)"));
    let after = null;
    let closest = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      const box = row.getBoundingClientRect();
      const offset = e.clientY - box.top - box.height / 2;
      if (offset < 0 && offset > closest) { closest = offset; after = row; }
    }
    if (after == null) tbody.appendChild(draggedTr);
    else tbody.insertBefore(draggedTr, after);
  });
  function syncLinesOrder() {
    const rows = Array.from(tbody.querySelectorAll("tr"));
    lines.sort((a, b) => rows.indexOf(a.row) - rows.indexOf(b.row));
  }

  // ---------- BLOQUE C: TOTALES ----------
  const blockTotals = document.createElement("div");
  blockTotals.className = "quote-block quote-block-totals";
  leftCard.appendChild(blockTotals);

  const blockCTitle = document.createElement("h3");
  blockCTitle.textContent = "Totales";
  blockCTitle.className = "quote-block-title";
  blockTotals.appendChild(blockCTitle);

  const totalsBox = document.createElement("div");
  totalsBox.className = "quote-totals";
  blockTotals.appendChild(totalsBox);

  // ---------- BLOQUE D: ACCIONES ----------
  const blockActions = document.createElement("div");
  blockActions.className = "quote-block quote-block-actions";
  leftCard.appendChild(blockActions);

  const actionsRow = document.createElement("div");
  actionsRow.className = "form-actions";
  blockActions.appendChild(actionsRow);

  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className = "btn btn-primary";
  submitBtn.textContent = "Generar presupuesto";

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "btn btn-secondary";
  resetBtn.textContent = "Limpiar formulario";

  const saveTemplateBtn = document.createElement("button");
  saveTemplateBtn.type = "button";
  saveTemplateBtn.className = "btn-ghost btn-sm";
  saveTemplateBtn.style.cssText = "border:1px dashed var(--neutral-300);color:var(--neutral-500)";
  saveTemplateBtn.innerHTML = "💾 Guardar como plantilla";
  saveTemplateBtn.title = "Guarda las líneas actuales como plantilla reutilizable";

  actionsRow.appendChild(submitBtn);
  actionsRow.appendChild(resetBtn);
  actionsRow.appendChild(saveTemplateBtn);

  // Indicador de autoguardado de borrador (FRONT1-4)
  const draftIndicator = document.createElement("span");
  draftIndicator.style.cssText = "font-size:12px;color:var(--neutral-400);align-self:center;margin-left:auto;transition:opacity .3s;opacity:0";
  draftIndicator.textContent = "✓ Guardado automáticamente";
  actionsRow.appendChild(draftIndicator);

  // ---------- PANEL DERECHO: PREVIEW + ESTADO ----------
  const previewTitle = document.createElement("h3");
  previewTitle.textContent = "Vista previa del documento";
  previewTitle.className = "quote-preview-title";
  rightCard.appendChild(previewTitle);

  const previewBox = document.createElement("div");
  previewBox.className = "quote-preview";
  rightCard.appendChild(previewBox);

  const statusTitle = document.createElement("h3");
  statusTitle.textContent = "Estado del presupuesto";
  statusTitle.style.marginTop = "16px";
  rightCard.appendChild(statusTitle);

  const resultBox = document.createElement("div");
  resultBox.className = "quote-status-box";
  rightCard.appendChild(resultBox);

  // Empty state DENTRO del panel (una sola voz: antes había un párrafo de
  // ayuda encima Y la caja vacía tipo input, que quedaba pobre)
  const STATUS_EMPTY_HTML =
    '<div class="quote-status-empty">📄 Genera el presupuesto y aquí verás su número, el estado y si se ha enviado.</div>';
  resultBox.innerHTML = STATUS_EMPTY_HTML;

  function setResult(data) {
    resultBox.innerHTML = "";
    if (!data) { resultBox.innerHTML = STATUS_EMPTY_HTML; return; }
  
    // Normalizamos campos por si el backend cambia ligeramente
    const quoteId = data.quote_id || data.quoteId || data.id;
    const displayNum = data.number ?? quoteId; // A1.2: número por merchant
    const status = (data.status || "draft").toUpperCase();
    const sent =
      typeof data.sent !== "undefined"
        ? !!data.sent
        : !!data.sentWhatsapp; // por si en el futuro devolvemos otra key
  
    const header = document.createElement("div");
    header.className = "quote-status-header";
  
    const idText = document.createElement("div");
    idText.innerHTML = `<strong>Presupuesto #${displayNum}</strong>`;
    header.appendChild(idText);
  
    const statusPill = document.createElement("span");
    statusPill.className = "status-pill";
    statusPill.textContent = status;
    header.appendChild(statusPill);
  
    resultBox.appendChild(header);
  
    const list = document.createElement("ul");
    list.className = "quote-status-list";
  
    const liSent = document.createElement("li");
    liSent.innerHTML = `<strong>Enviado por WhatsApp:</strong> ${
      sent ? "sí" : "no"
    }`;
    list.appendChild(liSent);
  
    resultBox.appendChild(list);
  }
  

  // ---------- ESTADO INTERNO ----------
  let lines = [];
  let currentMerchant = null;
  let customersList = [];
  let draftSaveTimer = null;

  // ---------- AUTOGUARDADO DE BORRADOR (FRONT1-4) ----------
  function draftKey() {
    const mid = currentMerchant && currentMerchant.id ? String(currentMerchant.id) : "x";
    return `pf_quote_draft_${mid}`;
  }
  function saveDraft() {
    if (!currentMerchant || !currentMerchant.id) return;
    const snapshot = {
      customerId: fieldCustomer.select.value || "",
      paymentTerms: paymentSelect.value || "",
      vatDefault: fieldVatDefault.input.value || "21",
      lines: lines.map((l) => ({
        concept: l.conceptInput.value || "",
        qty: l.qtyInput.value || "",
        price: l.priceInput.value || "",
        markup: l.markupInput ? l.markupInput.value : "0",
        vat: l.vatInput.value || "",
      })),
    };
    // No guardar borradores vacíos
    const hasContent = snapshot.customerId || snapshot.lines.some((l) => l.concept.trim());
    try {
      if (hasContent) localStorage.setItem(draftKey(), JSON.stringify(snapshot));
      else localStorage.removeItem(draftKey());
    } catch (_e) {}
  }
  function scheduleDraftSave() {
    clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(() => {
      saveDraft();
      draftIndicator.style.opacity = "1";
      setTimeout(() => { draftIndicator.style.opacity = "0"; }, 1500);
    }, 700);
  }
  function clearDraft() {
    try { localStorage.removeItem(draftKey()); } catch (_e) {}
  }
  function loadDraft() {
    try {
      const raw = localStorage.getItem(draftKey());
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d || !Array.isArray(d.lines) || !d.lines.length) return false;
      tbody.innerHTML = "";
      lines = [];
      d.lines.forEach((l) => addLine(l));
      if (d.vatDefault) fieldVatDefault.input.value = d.vatDefault;
      if (d.paymentTerms) paymentSelect.value = d.paymentTerms;
      // customerId se aplica tras cargar la lista de clientes (en loadInitialData)
      return d.customerId || true;
    } catch (_e) { return false; }
  }

  // Helper formato dinero — P-A66-3: delega en el formateador es-ES compartido
  function formatMoney(amount, currency) {
    return fmtMoneyEs(amount, currency || "EUR");
  }

  function recalcTotals() {
    let base = 0;
    let vatTotal = 0;
    const cur = (currentMerchant && currentMerchant.defaultCurrency) || 'EUR';

    lines.forEach((line) => {
      const qty = parseFloat(
        String(line.qtyInput.value || "").replace(",", ".")
      );
      const price = parseFloat(
        String(line.priceInput.value || "").replace(",", ".")
      );

      const markupPerc = parseFloat(
        String(line.markupInput?.value || "0").replace(",", ".")
      );
      const safeMarkup = Number.isFinite(markupPerc) ? markupPerc : 0;
      
            // Opción 2 (pro): el markup aplica SIEMPRE sobre el precio base
            const p = Number.isFinite(price) ? price : 0;
            let effectivePrice = p * (1 + safeMarkup / 100);
      
            // hint visual (precio final) — solo cuando el markup CAMBIA el precio;
            // sin markup el hint era ruido ("Final: 45.00" bajo un precio de 45)
            // y además desalineaba la celda respecto al resto de la fila.
            try {
              if (line.priceHint) {
                line.priceHint.textContent = safeMarkup > 0 && Number.isFinite(price)
                  ? `Final: ${fmtMoneyEs(effectivePrice, cur)}`
                  : '';
              }
            } catch (_e) {}
      
      
      const vatPerc = parseFloat(
        String(line.vatInput.value || "").replace(",", ".")
      );

      const safeQty = Number.isFinite(qty) ? qty : 0;
      const safePrice = Number.isFinite(effectivePrice) ? effectivePrice : 0;

      const safeVat = Number.isFinite(vatPerc) ? vatPerc : 0;

      const lineBase = safeQty * safePrice;
      const lineVat = lineBase * (safeVat / 100);

      line.totalCell.textContent = fmtMoneyEs(lineBase + lineVat, cur);

      base += lineBase;
      vatTotal += lineVat;
    });

    const total = base + vatTotal;
    const effVat = base > 0 ? Math.round((vatTotal / base) * 100) : 0;

    // Premium: UNA sola representación de los totales (antes la lista y la tira
    // "€X + IVA = €Y" decían lo mismo dos veces). Base + IVA como desglose y el
    // TOTAL como única cifra grande (Regla del Importe: en Tinta).
    // P-A66-3: formato es-ES compartido (adiós al hack del símbolo por moneda).
    totalsBox.innerHTML = `
      <div><span>Base imponible:</span><strong>${fmtMoneyEs(base, cur)}</strong></div>
      <div><span>IVA (${effVat}%):</span><strong>${fmtMoneyEs(vatTotal, cur)}</strong></div>
      <div class="quote-vat-calc"><span>Total presupuesto</span><strong>${fmtMoneyEs(total, cur)}</strong></div>
    `;

    return { base, vatTotal, total };
  }

  function renderPreview() {
    previewBox.innerHTML = "";

    if (!currentMerchant) {
      const p = document.createElement("p");
      p.textContent = "Cargando datos de empresa…";
      previewBox.appendChild(p);
      return;
    }

    const currency = currentMerchant.defaultCurrency || "EUR";

    const totals = recalcTotals();

    // Filtrar líneas válidas
    const previewLines = lines
      .map((line) => {
        const concept = line.conceptInput.value.trim();
        const qty = parseFloat(
          String(line.qtyInput.value || "").replace(",", ".")
        );
        const price = parseFloat(
          String(line.priceInput.value || "").replace(",", ".")
        );
        const vatPerc = parseFloat(
          String(line.vatInput.value || "").replace(",", ".")
        );

        const safeQty = Number.isFinite(qty) ? qty : 0;
        const safePrice = Number.isFinite(price) ? price : 0;
        const safeVat = Number.isFinite(vatPerc) ? vatPerc : 0;

        if (!concept || safeQty <= 0 || safePrice < 0) return null;

        const markupPerc = parseFloat(
          String(line.markupInput?.value || "0").replace(",", ".")
        );
        const safeMarkup = Number.isFinite(markupPerc) ? markupPerc : 0;

        const finalPrice = safePrice * (1 + safeMarkup / 100);


        const base = safeQty * finalPrice;

        const vat = base * (safeVat / 100);
        const totalLine = base + vat;

        return {
          concept,
          description: line.conceptInput.dataset.pfProductDescription || "",
          qty: safeQty,
          price: finalPrice,
          vatPerc: safeVat,
          totalLine,
        };
        
      })
      .filter(Boolean);

    // Encabezado de empresa
    const header = document.createElement("div");
    header.className = "preview-header";

    if (currentMerchant.logoUrl) {
      const logo = document.createElement("img");
      logo.src = currentMerchant.logoUrl;
      logo.alt = currentMerchant.name || "Logo";
      logo.className = "preview-logo";
      header.appendChild(logo);
    }

    const mBlock = document.createElement("div");
    mBlock.className = "preview-merchant-block";

    const mName = document.createElement("div");
    mName.className = "preview-merchant-name";
    mName.textContent =
      currentMerchant.name || currentMerchant.legalName || "Tu empresa";
    mBlock.appendChild(mName);

    if (currentMerchant.legalName) {
      const legal = document.createElement("div");
      legal.className = "preview-merchant-line";
      legal.textContent = currentMerchant.legalName;
      mBlock.appendChild(legal);
    }

    if (currentMerchant.taxId) {
      const tax = document.createElement("div");
      tax.className = "preview-merchant-line";
      tax.textContent = "NIF " + currentMerchant.taxId;
      mBlock.appendChild(tax);
    }

    if (currentMerchant.address) {
      const addr = document.createElement("div");
      addr.className = "preview-merchant-line";
      addr.textContent = currentMerchant.address;
      mBlock.appendChild(addr);
    }

    if (currentMerchant.whatsappPhone) {
      const wa = document.createElement("div");
      wa.className = "preview-merchant-line";
      wa.textContent = "WhatsApp " + currentMerchant.whatsappPhone;
      mBlock.appendChild(wa);
    }

    header.appendChild(mBlock);
    previewBox.appendChild(header);

    // Separador
    const sep1 = document.createElement("hr");
    sep1.className = "preview-separator";
    previewBox.appendChild(sep1);

    // Datos del cliente
    const customerId = fieldCustomer.select.value;
    const customer =
      customersList.find((c) => String(c.id) === String(customerId)) || null;

    const clientBlock = document.createElement("div");
    clientBlock.className = "preview-client-block";

    const clientTitle = document.createElement("div");
    clientTitle.className = "preview-section-title";
    clientTitle.textContent = "Cliente";
    clientBlock.appendChild(clientTitle);

    if (customer) {
      const cName = document.createElement("div");
      cName.textContent = customer.name || "Cliente sin nombre";
      clientBlock.appendChild(cName);

      if (customer.phone) {
        const cPhone = document.createElement("div");
        cPhone.textContent = "Tel: " + customer.phone;
        clientBlock.appendChild(cPhone);
      }
    } else {
      const cEmpty = document.createElement("div");
      cEmpty.textContent = "Selecciona un cliente para completar estos datos.";
      clientBlock.appendChild(cEmpty);
    }

    previewBox.appendChild(clientBlock);

        // Condiciones de pago (preview)
        const pTermsCode = paymentSelect.value || "";
        if (pTermsCode) {
          const paymentBlock = document.createElement("div");
          paymentBlock.className = "preview-client-block";
    
          const ptTitle = document.createElement("div");
          ptTitle.className = "preview-section-title";
          ptTitle.textContent = "Condiciones de pago";
          paymentBlock.appendChild(ptTitle);
    
          let label;
          switch (pTermsCode) {
            case "FULL_UPFRONT":
              label = "Pago 100% al aceptar el presupuesto.";
              break;
            case "FIFTY_FIFTY":
              label = "50% al aceptar, 50% al finalizar el trabajo.";
              break;
            case "MANUAL":
              label = "Solo presupuesto, facturación manual.";
              break;
            default:
              label = "";
          }
    
          const ptText = document.createElement("div");
          ptText.textContent = label;
          paymentBlock.appendChild(ptText);
    
          previewBox.appendChild(paymentBlock);
        }
    



    const sep2 = document.createElement("hr");
    sep2.className = "preview-separator";
    previewBox.appendChild(sep2);

    // Tabla de líneas
    const linesTable = document.createElement("table");
    linesTable.className = "preview-lines-table";

    const ptHead = document.createElement("thead");
    const ptr = document.createElement("tr");
    ["Concepto", "Cant.", "Precio", "Total"].forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      ptr.appendChild(th);
    });
    ptHead.appendChild(ptr);
    linesTable.appendChild(ptHead);

    const ptBody = document.createElement("tbody");

    if (previewLines.length === 0) {
      const trEmpty = document.createElement("tr");
      const tdEmpty = document.createElement("td");
      tdEmpty.colSpan = 4;
      tdEmpty.textContent =
        "Añade al menos una línea con concepto, cantidad y precio.";
      trEmpty.appendChild(tdEmpty);
      ptBody.appendChild(trEmpty);
    } else {
      previewLines.forEach((l) => {
        const tr = document.createElement("tr");
        const tdConcept = document.createElement("td");
tdConcept.textContent = l.concept;

// Si el toggle está ON y tenemos descripción, la mostramos debajo
if (descCheck && descCheck.checked && l.description) {
  const small = document.createElement("div");
  small.textContent = l.description;
  small.style.fontSize = "12px";
  small.style.color = "#6b756f";
  small.style.marginTop = "2px";
  tdConcept.appendChild(small);
}

tr.appendChild(tdConcept);


        const tdQty = document.createElement("td");
        tdQty.textContent = String(l.qty);
        tr.appendChild(tdQty);

        const tdPrice = document.createElement("td");
        tdPrice.textContent = formatMoney(l.price, currency);
        tr.appendChild(tdPrice);

        const tdTotal = document.createElement("td");
        tdTotal.textContent = formatMoney(l.totalLine, currency);
        tr.appendChild(tdTotal);

        ptBody.appendChild(tr);
      });
    }

    linesTable.appendChild(ptBody);
    previewBox.appendChild(linesTable);

    // Totales en preview
    const totalsBlock = document.createElement("div");
    totalsBlock.className = "preview-totals-block";

    const rowBase = document.createElement("div");
    rowBase.className = "preview-total-row";
    rowBase.innerHTML = `<span>Base imponible</span><strong>${formatMoney(
      totals.base,
      currency
    )}</strong>`;
    totalsBlock.appendChild(rowBase);

    const rowVat = document.createElement("div");
    rowVat.className = "preview-total-row";
    rowVat.innerHTML = `<span>IVA total</span><strong>${formatMoney(
      totals.vatTotal,
      currency
    )}</strong>`;
    totalsBlock.appendChild(rowVat);

    const rowTotal = document.createElement("div");
    rowTotal.className = "preview-total-row preview-total-row-main";
    rowTotal.innerHTML = `<span>Total presupuesto</span><strong>${formatMoney(
      totals.total,
      currency
    )}</strong>`;
    totalsBlock.appendChild(rowTotal);

    previewBox.appendChild(totalsBlock);

    // Pie legal sencillo (podremos hacerlo configurable después)
    const footer = document.createElement("div");
    footer.className = "preview-footer";
    footer.textContent = "Presupuesto válido durante 30 días salvo indicación en contrario.";
    previewBox.appendChild(footer);
  }

  // ---------- GESTIÓN DE LÍNEAS ----------
    // ----------------------------
  // Autocomplete productos (MVP)
  // ----------------------------
  function attachProductAutocomplete({ conceptInput, priceInput, vatInput, markupInput }) {

    let box = null;
    let timer = null;
    let lastQ = "";
    let suppressOpenOnce = false;
    let activeIndex = -1;
    let isOpen = false;
    let isLoading = false;
    const cache = new Map(); // q -> items (máx simple)
    let currentItems = [];



        // ----------------------------
    // Recientes (localStorage)
    // ----------------------------
    function recentKey() {
      const mid = currentMerchant && currentMerchant.id ? String(currentMerchant.id) : "unknown";
      return `pf_recent_products_${mid}`;
    }

    function loadRecents() {
      try {
        const raw = localStorage.getItem(recentKey());
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (_e) {
        return [];
      }
    }

    function saveRecent(item) {
      try {
        const recents = loadRecents();

        const normalized = {
          id: item.id,
          name: item.name,
          description: item.description || null, // ✅ guardar descripción también
          price: item.price,
          vat: item.vat,
        
        
        };

        // quitar duplicado por id
        const next = [normalized].concat(recents.filter((r) => String(r.id) !== String(normalized.id)));

        // max 5
        localStorage.setItem(recentKey(), JSON.stringify(next.slice(0, 5)));
      } catch (_e) {}
    }




    function ensureBox() {
      if (box) return box;

      box = document.createElement("div");
      box.className = "pf-autocomplete";
      box.style.position = "absolute";
      box.style.zIndex = "9999";
      box.style.background = "#fff";
      box.style.border = "1px solid #e7e9e5";
      box.style.borderRadius = "8px";
      box.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)";
      box.style.padding = "6px";
      box.style.display = "none";
      box.style.minWidth = "260px";
      document.body.appendChild(box);

      // ✅ PRO: si el ratón sale del dropdown, quitamos el highlight
      box.addEventListener("mouseleave", () => {
      activeIndex = -1;
        refreshActiveRow();
      });


      return box;
    }

    function placeBox() {
      const b = ensureBox();
      const r = conceptInput.getBoundingClientRect();
      b.style.left = `${r.left + window.scrollX}px`;
      b.style.top = `${r.bottom + window.scrollY + 4}px`;
      b.style.width = `${Math.max(260, r.width)}px`;
    }

    function hide() {
      if (!box) return;
      box.style.display = "none";
      box.innerHTML = "";
      activeIndex = -1;
      isOpen = false;
      isLoading = false;

    }

    function renderLoading() {
      const b = ensureBox();
      b.innerHTML = `<div style="padding:10px;font-size:13px;color:#6b756f;">Buscando…</div>`;
      placeBox();
      b.style.display = "block";
      isOpen = true;
      isLoading = true;
      activeIndex = -1;
    }
    
    function renderEmpty(msg) {
      const b = ensureBox();
      b.innerHTML = `<div style="padding:10px;font-size:13px;color:#6b756f;">${msg || "Sin resultados"}</div>`;
      placeBox();
      b.style.display = "block";
      isOpen = true;
      isLoading = false;
      activeIndex = -1;
    }
    

    function renderItems(items) {
      const b = ensureBox();
      b.innerHTML = "";
      currentItems = Array.isArray(items) ? items : [];


      isOpen = true;
      isLoading = false;
      activeIndex = -1;


      if (!items || items.length === 0) {
        hide();
        return;
      }

      items.forEach((it) => {
        const row = document.createElement("div");

        const idx = b.children.length; // índice actual antes del append
        row.dataset.idx = String(idx);

        row.style.padding = "8px";
        row.style.borderRadius = "6px";
        row.style.cursor = "pointer";
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.gap = "10px";

        row.addEventListener("mouseenter", () => {
          activeIndex = Number(row.dataset.idx);
          refreshActiveRow();
        });
        
      

        const leftWrap = document.createElement("div");
leftWrap.style.display = "flex";
leftWrap.style.flexDirection = "column";
leftWrap.style.gap = "2px";

const title = document.createElement("div");
title.textContent = it.name || "";
title.style.fontWeight = "600";

leftWrap.appendChild(title);

// descripción corta (opcional)
const descRaw = (it.description || "").trim();
if (descRaw) {
  const desc = document.createElement("div");
  desc.textContent = descRaw.length > 60 ? descRaw.slice(0, 60) + "…" : descRaw;
  desc.style.fontSize = "12px";
  desc.style.color = "#6b756f";
  desc.title = descRaw;

  leftWrap.appendChild(desc);
}

const right = document.createElement("div");
right.style.flexShrink = "0";
right.style.fontWeight = "600";
const price = Number(it.price || 0);
right.textContent = Number.isFinite(price)
  ? fmtMoneyEs(price, (currentMerchant && currentMerchant.defaultCurrency) || 'EUR')
  : "";

row.appendChild(leftWrap);
row.appendChild(right);


        row.addEventListener("mousedown", (e) => {
          e.preventDefault();
          selectItem(it);
        });
        
        

        b.appendChild(row);
      });

      placeBox();
      b.style.display = "block";
    }

    function refreshActiveRow() {
      if (!box) return;
      const children = Array.from(box.children);
      children.forEach((el, i) => {
        el.style.background = i === activeIndex ? "#f1f2ee" : "transparent";
      });
    }

  // ✅ PRO: selección centralizada (vale para click y Enter)
function selectItem(it) {
  conceptInput.dataset.pfSelecting = "1";

  if (!it) return;

  suppressOpenOnce = true;
  saveRecent(it);

  conceptInput.value = it.name || "";

  // PRO: guardamos el producto elegido en esta línea
conceptInput.dataset.pfProductId = it.id != null ? String(it.id) : "";
conceptInput.dataset.pfProductDescription = (it.description || "").trim();
conceptInput.dataset.pfProductName = (it.name || "").trim();



if (typeof it.price !== "undefined" && it.price !== null && it.price !== "") {
  const base = Number(it.price);
  if (Number.isFinite(base)) {
    // guardamos base
    priceInput.dataset.pfBasePrice = String(base);

    // dejamos el precio visible como BASE (el cálculo final se ve en el hint "Final")
priceInput.value = String(base.toFixed(2));
  }
}


  if (typeof it.vat !== "undefined" && it.vat !== null && it.vat !== "") {
    const v = Number(it.vat);
    if (Number.isFinite(v)) vatInput.value = String(v * 100);
  }

  hide();

  // recalcular / preview sin reabrir dropdown
  conceptInput.dispatchEvent(new Event("input", { bubbles: true }));
  priceInput.dispatchEvent(new Event("input", { bubbles: true }));
  vatInput.dispatchEvent(new Event("input", { bubbles: true }));

  // PRO: si este input era la última línea, añadimos una línea nueva automática
  try {
    if (typeof conceptInput._pfIsLastLine === "function" && conceptInput._pfIsLastLine()) {
      setTimeout(() => {
        addLine();
      }, 0);
    }
  } catch (_e) {}

  // UX PRO: al seleccionar, saltar al siguiente campo (qty)
  try {
    const row = conceptInput.closest("tr");
    if (row) {
      const qty = row.querySelector('td:nth-child(2) input');
      if (qty) qty.focus();
    }
  } catch (_e) {}

  setTimeout(() => {
    delete conceptInput.dataset.pfSelecting;
  }, 0);
  

  setTimeout(() => {
    suppressOpenOnce = false;
  }, 0);
}


    


    async function fetchItems(q) {
      // Si aún no tenemos merchant, lo pedimos al backend
      if (!currentMerchant || !currentMerchant.id) {
        try {
          const mRes = await fetch('/admin/merchant');
          const m = await mRes.json().catch(() => null);
          if (mRes.ok && m && m.id) currentMerchant = m;
        } catch (_e) {}
      }
    
      if (!currentMerchant || !currentMerchant.id) return [];
    
      const url = `/admin/products/autocomplete?merchantId=${encodeURIComponent(
        currentMerchant.id
      )}&q=${encodeURIComponent(q)}`;
    
      const res = await fetch(url);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) return [];
      return Array.isArray(data.items) ? data.items : [];
    }
    

    async function onInput() {
      console.log('[autocomplete] input:', conceptInput.value, 'merchant:', currentMerchant && currentMerchant.id);
      if (suppressOpenOnce) return;

      const q = (conceptInput.value || "").trim();
      lastQ = q;

      if (!q || q.length < 2) {
        // PRO: si está vacío o <2, mostramos recientes al hacer focus
        const recents = loadRecents();
        if (recents.length > 0 && document.activeElement === conceptInput) {
          renderItems(recents);
        } else {
          hide();
        }
        return;
      }


      placeBox();

      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          // evita pintar resultados viejos
          const qNow = (conceptInput.value || "").trim();
          if (qNow !== lastQ) return;

          // cache hit
          const key = qNow.toLowerCase();
          if (cache.has(key)) {
            renderItems(cache.get(key));
            return;
          }

          renderLoading();
          const items = await fetchItems(qNow);
          cache.set(key, items);
          if (!items || items.length === 0) {
            renderEmpty("Sin resultados");
            return;
          }
          renderItems(items);


          
        } catch (_e) {
          hide();
        }
      }, 150);
    }

    conceptInput.addEventListener("input", onInput);

    // PRO: si el usuario modifica el texto manualmente, ya no podemos asegurar que sea "ese producto"
conceptInput.addEventListener("input", () => {
  if (!suppressOpenOnce) {
    conceptInput.dataset.pfProductId = "";
    conceptInput.dataset.pfProductDescription = "";
    conceptInput.dataset.pfProductName = "";
  }
});

    

    conceptInput.addEventListener("focus", onInput);

    conceptInput.addEventListener("blur", () => {
      // pequeño delay para permitir seleccionar con mouse
      setTimeout(() => hide(), 120);
    });

    conceptInput.addEventListener("keydown", (e) => {
      // ESC: cerrar
      if (e.key === "Escape") {
        suppressOpenOnce = true;
        hide();
        conceptInput.blur();
        setTimeout(() => (suppressOpenOnce = false), 0);
        return;
      }
    
      // Si no está abierto, no hacemos nada
      if (!box || box.style.display !== "block") return;
    
      // Mientras loading, no navegamos
      if (isLoading) return;
    
      const rows = Array.from(box.children);
      if (rows.length === 0) return;
    
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(rows.length - 1, activeIndex + 1);
        refreshActiveRow();
        return;
      }
    
      if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(0, activeIndex - 1);
        refreshActiveRow();
        return;
      }
    
      if (e.key === "Enter") {
        if (activeIndex < 0 || activeIndex >= currentItems.length) return;
        e.preventDefault();
        e.stopPropagation();
        selectItem(currentItems[activeIndex]);  // 👈 selecciona el objeto real
        return;
      }
      
      
    });
    
    
    // Click fuera cierra
    document.addEventListener("mousedown", (e) => {
      if (!box || box.style.display !== "block") return;
      const target = e.target;
      if (target === conceptInput) return;
      if (box.contains(target)) return;
      hide();
    });
    

    window.addEventListener("resize", () => {
      if (box && box.style.display === "block") placeBox();
    });
    window.addEventListener("scroll", () => {
      if (box && box.style.display === "block") placeBox();
    }, true);
  }

  function addLine(initial) {
    const tr = document.createElement("tr");

    const conceptTd = document.createElement("td");
    const conceptInput = document.createElement("input");
    conceptInput.type = "text";
    conceptInput.placeholder = "Concepto / servicio";
    conceptInput.value = initial && initial.concept ? initial.concept : "";
    conceptTd.appendChild(conceptInput);

    // PRO: este campo puede venir de un producto del catálogo
conceptInput.dataset.pfProductId = ""; // vacío = "manual"

   



    const qtyTd = document.createElement("td");
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "0";
    qtyInput.step = "1";
    qtyInput.value = initial && initial.qty != null ? initial.qty : "1";
    qtyTd.appendChild(qtyInput);

    const priceTd = document.createElement("td");
    const priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.min = "0";
    priceInput.step = "0.01";
    priceInput.value = initial && initial.price != null ? initial.price : "";
    priceTd.appendChild(priceInput);
    priceInput.dataset.pfBasePrice = ""; // precio catálogo o base antes de markup

    // Hint: precio final con markup (solo visual; vacío si no hay markup)
const priceHint = document.createElement("div");
priceHint.className = "price-final-hint";
priceHint.textContent = "";
priceTd.appendChild(priceHint);


    const markupTd = document.createElement("td");
const markupInput = document.createElement("input");
markupInput.type = "number";
markupInput.min = "0";
markupInput.step = "1";
markupInput.placeholder = "0";
markupInput.value = initial && initial.markup != null ? initial.markup : "0";
markupTd.appendChild(markupInput);


    const vatTd = document.createElement("td");
    const vatInput = document.createElement("input");
    attachProductAutocomplete({ conceptInput, priceInput, vatInput, markupInput });


    vatInput.type = "number";
    vatInput.min = "0";
    vatInput.step = "1";
    if (initial && initial.vat != null) {
      vatInput.value = initial.vat;
    } else {
      const def = fieldVatDefault.input.value || "21";
      vatInput.value = def;
    }
    vatTd.appendChild(vatInput);

    const totalTd = document.createElement("td");
    totalTd.textContent = "0.00";

    const actionsTd = document.createElement("td");
    actionsTd.style.whiteSpace = "nowrap";

    // Handle de arrastre para reordenar (FRONT1-4)
    const dragHandle = document.createElement("span");
    dragHandle.className = "quote-drag-handle";
    dragHandle.textContent = "⠿";
    dragHandle.title = "Arrastra para reordenar";
    dragHandle.draggable = true;
    dragHandle.addEventListener("dragstart", function (e) {
      draggedTr = tr;
      tr.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    dragHandle.addEventListener("dragend", function () {
      tr.classList.remove("dragging");
      draggedTr = null;
      syncLinesOrder();
      recalcTotals();
      renderPreview();
      scheduleDraftSave();
    });
    actionsTd.appendChild(dragHandle);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-icon";
    removeBtn.title = "Eliminar línea";
    removeBtn.textContent = "🗑️";
    actionsTd.appendChild(removeBtn);

    tr.appendChild(conceptTd);
    tr.appendChild(qtyTd);
    tr.appendChild(priceTd);
    tr.appendChild(markupTd);
    tr.appendChild(vatTd);
    tr.appendChild(totalTd);
    tr.appendChild(actionsTd);
    

    tbody.appendChild(tr);

    const lineObj = {
      row: tr,
      conceptInput,
      qtyInput,
      priceInput,
      markupInput,
      vatInput,
      totalCell: totalTd,
      priceHint,

    };
    
    lines.push(lineObj);

    // Exponer un helper en el input para saber si es la última línea
conceptInput._pfIsLastLine = () => lines[lines.length - 1] === lineObj;


    const onChange = function () {
      recalcTotals();
      renderPreview();
      scheduleDraftSave();
    };

    conceptInput.addEventListener("input", function () {
      // Si cambian el texto manualmente, invalidamos el producto elegido
      try {
        const storedName = (conceptInput.dataset.pfProductName || "").trim();
        const now = (conceptInput.value || "").trim();
        if (storedName && now !== storedName) {
          conceptInput.dataset.pfProductId = "";
          conceptInput.dataset.pfProductDescription = "";
          conceptInput.dataset.pfProductName = "";
        }
      } catch (_e) {}
    
      onChange();
    });
    
    qtyInput.addEventListener("input", onChange);
    priceInput.addEventListener("input", () => {
      // si el usuario toca el precio manualmente, invalidamos base
      // (solo si no viene del autocomplete en ese momento)
      if (!conceptInput.dataset.pfSelecting) {
        const raw = String(priceInput.value || "").replace(",", ".").trim();
const n = Number(raw);

// si el usuario mete un número válido, lo tomamos como nueva base
if (Number.isFinite(n) && n >= 0) {
  priceInput.dataset.pfBasePrice = String(n);
} else {
  // si deja algo inválido, vaciamos base para no arrastrar basura
  priceInput.dataset.pfBasePrice = "";
}
      }
      onChange();
    });
    
    vatInput.addEventListener("input", onChange);
    markupInput.addEventListener("input", onChange);

    


    removeBtn.addEventListener("click", function () {
      if (lines.length === 1) {
        // siempre al menos una línea
        conceptInput.value = "";
        qtyInput.value = "1";
        priceInput.value = "";
        markupInput.value = "0";
        vatInput.value = fieldVatDefault.input.value || "21";

        conceptInput.dataset.pfProductId = "";
        conceptInput.dataset.pfProductDescription = "";
        conceptInput.dataset.pfProductName = "";
        priceInput.dataset.pfBasePrice = "";

        if (priceHint) {
          priceHint.textContent = "";
        }

        recalcTotals();
        renderPreview();
        return;
      }
      tbody.removeChild(tr);
      lines = lines.filter(function (l) {
        return l !== lineObj;
      });
      recalcTotals();
      renderPreview();
    });

    recalcTotals();
    renderPreview();
  }

  addLine();

  addLineBtn.addEventListener("click", function () {
    addLine();
  });

  // Botón IA — añade las líneas sugeridas por Claude
  aiBtn.addEventListener("click", function () {
    if (typeof openAiSuggestModal === 'function') {
      openAiSuggestModal(function (suggestedLines) {
        // Limpiar la fila vacía si es la única y no tiene datos
        const existingRows = tbody.querySelectorAll('tr');
        if (existingRows.length === 1) {
          const firstConcept = existingRows[0].querySelector('input[type=text]');
          if (firstConcept && !firstConcept.value.trim()) {
            tbody.innerHTML = '';
            lines = [];
          }
        }
        suggestedLines.forEach(function (l) { addLine(l); });
      });
    } else {
      setAlert('error', 'El asistente IA no está cargado. Recarga la página.');
    }
  });

  resetBtn.addEventListener("click", function () {
    fieldCustomer.select.value = "";
    fieldVatDefault.input.value = "21";
    paymentSelect.value = "FULL_UPFRONT";

    tbody.innerHTML = "";
    lines = [];
    addLine();
    clearDraft();

    setAlert(null, "");
    setResult(null);
  });

  // ── Botón "📋 Usar plantilla" ────────────────────────────────────────────
  useTemplateBtn.addEventListener("click", async function () {
    let templates;
    try {
      templates = await apiRequest('/admin/templates');
    } catch {
      setAlert('error', 'No se pudieron cargar las plantillas.');
      return;
    }

    if (!templates || templates.length === 0) {
      setAlert('error', 'Aún no tienes plantillas guardadas. Crea una con el botón "💾 Guardar como plantilla".');
      return;
    }

    // Modal de selección
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:480px">
        <div class="modal-header">
          <h3 class="modal-title">📋 Usar plantilla</h3>
          <button class="modal-close" id="tpl-modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p style="font-size:13px;color:var(--neutral-500);margin:0 0 12px">Elige una plantilla para cargar sus líneas en el presupuesto actual.</p>
          <div style="display:flex;flex-direction:column;gap:8px" id="tpl-list"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const closeOverlay = () => overlay.remove();
    overlay.querySelector('#tpl-modal-close').onclick = closeOverlay;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

    const tplList = overlay.querySelector('#tpl-list');
    templates.forEach(function (tpl) {
      const lineCount = Array.isArray(tpl.lines) ? tpl.lines.length : 0;
      const btn = document.createElement('button');
      btn.className = 'btn-secondary';
      btn.style.cssText = 'width:100%;text-align:left;display:flex;justify-content:space-between;align-items:center;padding:12px 14px';
      btn.innerHTML = `
        <span>
          <strong style="color:var(--neutral-900)">${tpl.name}</strong>
          <span style="display:block;font-size:12px;color:var(--neutral-400);margin-top:2px">${lineCount} línea${lineCount !== 1 ? 's' : ''} · ${tpl.currency}</span>
        </span>
        <span style="font-size:12px;color:var(--green-600);font-weight:600">Usar →</span>
      `;
      btn.onclick = function () {
        // Vaciar líneas actuales vacías
        const existingRows = tbody.querySelectorAll('tr');
        if (existingRows.length === 1) {
          const firstConcept = existingRows[0].querySelector('input[type=text]');
          if (firstConcept && !firstConcept.value.trim()) {
            tbody.innerHTML = '';
            lines = [];
          }
        } else {
          tbody.innerHTML = '';
          lines = [];
        }
        // Cargar líneas de la plantilla
        const templateLines = Array.isArray(tpl.lines) ? tpl.lines : [];
        templateLines.forEach(function (l) {
          addLine({ concept: l.concept, qty: l.qty, price: l.price, tax: (l.tax || 0) });
        });
        closeOverlay();
        setAlert('success', `Plantilla "${tpl.name}" cargada — ${templateLines.length} líneas añadidas.`);
      };
      tplList.appendChild(btn);
    });
  });

  // ── Botón "💾 Guardar como plantilla" ────────────────────────────────────
  saveTemplateBtn.addEventListener("click", async function () {
    // Leer líneas válidas del formulario
    const templateLines = lines
      .map(function (line) {
        const concept = line.conceptInput.value.trim();
        const qty     = parseFloat(String(line.qtyInput.value   || '1').replace(',', '.'));
        const price   = parseFloat(String(line.priceInput.value || '0').replace(',', '.'));
        const vatPerc = parseFloat(String(line.vatInput.value   || '0').replace(',', '.'));
        if (!concept || !Number.isFinite(price) || price < 0) return null;
        return {
          concept,
          qty:   Number.isFinite(qty)   ? qty   : 1,
          price: price,
          tax:   Number.isFinite(vatPerc) ? vatPerc / 100 : 0,
        };
      })
      .filter(Boolean);

    if (templateLines.length === 0) {
      setAlert('error', 'Añade al menos una línea con concepto y precio antes de guardar la plantilla.');
      return;
    }

    // Modal para pedir nombre
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <h3 class="modal-title">💾 Guardar plantilla</h3>
          <button class="modal-close" id="save-tpl-close">&times;</button>
        </div>
        <div class="modal-body">
          <p style="font-size:13px;color:var(--neutral-500);margin:0 0 12px">Dale un nombre a esta plantilla para reutilizarla en futuros presupuestos.</p>
          <div class="alert" id="save-tpl-alert"></div>
          <div class="field">
            <label>Nombre de la plantilla</label>
            <input type="text" id="tpl-name-input" placeholder="Ej. Revisión caldera estándar" />
          </div>
          <p style="font-size:12px;color:var(--neutral-400);margin:4px 0 0">${templateLines.length} línea${templateLines.length !== 1 ? 's' : ''} se guardarán.</p>
          <button class="btn-primary" id="save-tpl-btn" style="width:100%;margin-top:4px">Guardar plantilla</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const closeOverlay = () => overlay.remove();
    overlay.querySelector('#save-tpl-close').onclick = closeOverlay;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

    const nameInput = overlay.querySelector('#tpl-name-input');
    const alertEl   = overlay.querySelector('#save-tpl-alert');
    const saveBtn   = overlay.querySelector('#save-tpl-btn');

    setTimeout(() => nameInput.focus(), 80);

    saveBtn.onclick = async function () {
      const name = nameInput.value.trim();
      if (!name) {
        alertEl.textContent = 'Escribe un nombre para la plantilla.';
        alertEl.className = 'alert error';
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando…';

      const currency = currentMerchant?.defaultCurrency || 'EUR';

      try {
        await apiRequest('/admin/templates', {
          method: 'POST',
          body: JSON.stringify({ name, currency, lines: templateLines }),
        });
        closeOverlay();
        setAlert('success', `Plantilla "${name}" guardada. Puedes usarla con el botón "📋 Usar plantilla".`);
      } catch {
        alertEl.textContent = 'Error al guardar la plantilla.';
        alertEl.className = 'alert error';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar plantilla';
      }
    };

    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveBtn.click(); });
  });


  // ---------- CARGA INICIAL: MERCHANT + CLIENTES ----------
  async function loadInitialData() {
    try {
      setAlert(null, "Cargando datos…");

      // Si venimos de la vista de Plantillas, auto-cargar
      const pendingTemplate = sessionStorage.getItem('pf_load_template');
      var templatePending = !!pendingTemplate;
      if (pendingTemplate) {
        sessionStorage.removeItem('pf_load_template');
        try {
          const tpl = JSON.parse(pendingTemplate);
          if (Array.isArray(tpl.lines) && tpl.lines.length > 0) {
            tbody.innerHTML = '';
            lines = [];
            tpl.lines.forEach(function (l) { addLine(l); });
            setAlert('success', `Plantilla "${tpl.name}" cargada — completa los datos del cliente y genera el presupuesto.`);
          }
        } catch (_) {}
      }

      const merchantPromise = getMerchantProfile();
      const customersPromise = getCustomers("");

      const res = await Promise.all([merchantPromise, customersPromise]);

      currentMerchant = res[0];
      customersList = Array.isArray(res[1]) ? res[1] : [];

      // Checkboxes de métodos HONESTOS: sin IBAN no hay transferencia — se
      // desactiva con el motivo, en vez de dejar marcar algo que no saldrá.
      // (El perfil reducido del técnico no trae iban: solo se aplica si el
      // campo viene definido, para no desactivar por falta de dato.)
      try {
        if (pmChecks && pmChecks.transfer && currentMerchant && ('iban' in currentMerchant) && !currentMerchant.iban && !currentMerchant.clabe) {
          pmChecks.transfer.checked = false;
          pmChecks.transfer.disabled = true;
          const lbl = pmChecks.transfer.closest('label');
          if (lbl) {
            lbl.style.opacity = '.55';
            lbl.title = 'Añade tu IBAN en Configuración para ofrecer transferencia';
            lbl.appendChild(Object.assign(document.createElement('span'), {
              className: 'pay-methods-note',
              textContent: '(añade tu IBAN en Configuración)',
            }));
          }
        }
      } catch (_e) {}

      // Info merchant en la cabecera
      var miText =
        (currentMerchant.name || currentMerchant.legalName || "Tu empresa") +
        " · ";
      if (currentMerchant.legalName) {
        miText += currentMerchant.legalName + " · ";
      }
      if (currentMerchant.taxId) {
        miText += "NIF " + currentMerchant.taxId + " · ";
      }
      if (currentMerchant.address) {
        miText += currentMerchant.address + " · ";
      }
      if (currentMerchant.whatsappPhone) {
        miText += "WhatsApp " + currentMerchant.whatsappPhone;
      }
      merchantInfo.textContent = miText.replace(/ · $/, "");

      // Rellenar select de clientes
      const select = fieldCustomer.select;
      select.innerHTML = "";
      const optEmpty = document.createElement("option");
      optEmpty.value = "";
      optEmpty.textContent = "Selecciona un cliente…";
      select.appendChild(optEmpty);

      customersList.forEach(function (c) {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name + (c.phone ? " (" + c.phone + ")" : "");
        select.appendChild(opt);
      });

      // Restaurar borrador autoguardado (si no venimos de una plantilla)
      let draftRestored = false;
      if (!templatePending) {
        const restored = loadDraft();
        if (restored) {
          draftRestored = true;
          if (typeof restored === "string") fieldCustomer.select.value = restored;
          setAlert("info", '📝 Borrador restaurado. Sigue donde lo dejaste o pulsa "Limpiar formulario".');
        }
      }
      if (!draftRestored) setAlert(null, "");
      renderPreview();
    } catch (err) {
      setAlert("error", "Error cargando datos: " + err.message);
      merchantInfo.textContent = "Error cargando datos de empresa.";
    }
  }

  loadInitialData();

  fieldCustomer.select.addEventListener("change", function () {
    renderPreview();
    scheduleDraftSave();
  });
  descCheck.addEventListener("change", renderPreview);
  paymentSelect.addEventListener("change", function () {
    renderPreview();
    scheduleDraftSave();
  });


  fieldVatDefault.input.addEventListener("input", function () {
    // actualizar IVA de nuevas líneas, pero no tocamos las existentes
    renderPreview();
    scheduleDraftSave();
  });


  function pfOneLine(s) {
    return String(s || "").replace(/\s+/g, " ").trim(); // sin saltos/espacios raros
  }
  
  function pfTruncate(s, max) {
    const t = pfOneLine(s);
    if (!t) return "";
    if (t.length <= max) return t;
    return t.slice(0, Math.max(0, max - 1)) + "…";
  }
  

   // ---------- ENVÍO: CREATE (y luego modal para WhatsApp/PDF) ----------
   submitBtn.addEventListener("click", async function () {
    setAlert(null, "");
    setResult(null);

    if (!currentMerchant || !currentMerchant.id) {
      setAlert("error", "No se ha podido obtener el merchant actual.");
      return;
    }

    const customerId = fieldCustomer.select.value;
    if (!customerId) {
      setAlert("error", "Selecciona un cliente.");
      return;
    }

    const payloadLines = [];
    lines.forEach(function (line) {
      let concept = line.conceptInput.value.trim();



      const qty = parseFloat(
        String(line.qtyInput.value || "").replace(",", ".")
      );
      const price = parseFloat(
        String(line.priceInput.value || "").replace(",", ".")
      );
      const vatPerc = parseFloat(
        String(line.vatInput.value || "").replace(",", ".")
      );

      const safeQty = Number.isFinite(qty) ? qty : 0;
      const safePrice = Number.isFinite(price) ? price : 0;
      const safeVat = Number.isFinite(vatPerc) ? vatPerc : 0;

      if (!concept || safeQty <= 0 || safePrice < 0) {
        return;
      }

      let conceptForPdf = concept; // ✅ SIN truncar

try {
  const includeDesc = !!descCheck?.checked;
  const desc = (line.conceptInput.dataset.pfProductDescription || line.conceptInput.dataset.pfProductDesc || "").trim();

  if (includeDesc && desc) {
    conceptForPdf = `${conceptForPdf}\n${desc}`; // ✅ descripción completa, sin "…"
  }
} catch (_e) {}

let finalPrice = safePrice;

try {
  const markupPerc = parseFloat(
    String(line.markupInput?.value || "0").replace(",", ".")
  );
  const safeMarkup = Number.isFinite(markupPerc) ? markupPerc : 0;

  // Si viene de catálogo, la base real está aquí
  const baseRaw = String(line.priceInput.dataset.pfBasePrice || "").trim();
  const base = baseRaw ? Number(baseRaw) : safePrice;

  const safeBase = Number.isFinite(base) ? base : 0;

  finalPrice = safeBase * (1 + safeMarkup / 100);
} catch (_e) {}

      

payloadLines.push({
  concept: conceptForPdf,
  qty: safeQty,
  price: finalPrice,
  tax: safeVat / 100,
});

    });

    if (payloadLines.length === 0) {
      setAlert(
        "error",
        "Añade al menos una línea válida con concepto, cantidad y precio."
      );
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = "Generando…";

      // 1) Crear el presupuesto en DRAFT (esto ya genera el PDF en el back)
      const quotePayload = {
        merchant_id: currentMerchant.id,
        customer_id: Number(customerId),
        currency: currentMerchant.defaultCurrency || "EUR",
        lines: payloadLines,
        paymentTerms: paymentSelect.value || null,
        payMethods: selectedPayMethods(), // A2.1: undefined = todas
      };

      const quote = await createQuote(quotePayload);
      const quoteId = quote.id || quote.quote_id || quote.quoteId;
      const quoteNumber = quote.number ?? quoteId; // A1.2: número por merchant
      if (!quoteId) {
        throw new Error("Respuesta inesperada al crear presupuesto.");
      }

      // 2) Pedimos el detalle al admin para recuperar el pdfUrl del presupuesto
      let pdfUrl = null;
      try {
        const detailRes = await fetch(`/admin/quotes/${quoteId}`);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          pdfUrl = detail.pdfUrl || null;
        }
      } catch (e) {
        console.warn("No se pudo obtener pdfUrl del presupuesto", e);
      }

      // 3) Mostramos modal para ver PDF y (opcional) enviar por WhatsApp.
      // A1.3: si nació pendiente de aprobación (técnico sobre su límite), el
      // modal lo explica y no ofrece el envío. A2.3: sin checkbox — el modal
      // siempre ofrece WhatsApp/email/PDF/seguir editando.
      const pendingApproval = quote.status === 'pending_approval';
      openQuoteModal({ quoteId, quoteNumber, pdfUrl, allowWhatsapp: true, pendingApproval });

      // 4) Actualizamos cajita de estado a la derecha (de momento sin WhatsApp)
      setAlert("success", pendingApproval
        ? "📋 Presupuesto enviado a un administrador para aprobación."
        : "Presupuesto creado en borrador.");
      setResult({
        quote_id: quoteId,
        number: quoteNumber,
        status: pendingApproval ? "Pendiente de aprobación" : "DRAFT",
        sent: false,
      });
      clearDraft(); // el presupuesto ya está creado, descartamos el borrador local
    } catch (err) {
      setAlert("error", "Error generando presupuesto: " + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Generar presupuesto";
    }
  });
}
