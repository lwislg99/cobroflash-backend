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
  leftCard.appendChild(alertBox);

  function setAlert(type, msg) {
    alertBox.textContent = msg || "";
    alertBox.className = "alert";
    if (type === "success") alertBox.classList.add("success");
    if (type === "error") alertBox.classList.add("error");
  }




    // ---------- MODAL PREVISUALIZACIÓN PRESUPUESTO ----------
function openQuoteModal({ quoteId, pdfUrl, allowWhatsapp }) {
  // overlay
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.35)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "9999";

  // caja
  const box = document.createElement("div");
  box.style.background = "#fff";
  box.style.borderRadius = "12px";
  box.style.padding = "20px";
  box.style.maxWidth = "900px";
  box.style.width = "90%";
  box.style.maxHeight = "90vh";
  box.style.overflow = "auto";
  box.style.boxShadow = "0 10px 30px rgba(0,0,0,0.15)";

  const title = document.createElement("h3");
  title.textContent = `Presupuesto #${quoteId} generado`;
  title.style.marginTop = "0";
  box.appendChild(title);

  const p = document.createElement("p");
  p.textContent =
    "Revisa el PDF del presupuesto antes de enviarlo por WhatsApp al cliente.";
  box.appendChild(p);

  if (pdfUrl) {
    // Link para abrir en nueva pestaña
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Abrir PDF del presupuesto en una nueva pestaña";
    link.style.display = "inline-block";
    link.style.marginBottom = "12px";
    box.appendChild(link);

    // Wrapper + iframe con el PDF embebido
    const frameWrapper = document.createElement("div");
    frameWrapper.style.marginTop = "8px";
    frameWrapper.style.border = "1px solid #e5e7eb";
    frameWrapper.style.borderRadius = "8px";
    frameWrapper.style.overflow = "hidden";

    const iframe = document.createElement("iframe");
    iframe.src = pdfUrl;
    iframe.title = `PDF Presupuesto #${quoteId}`;
    iframe.loading = "lazy";
    iframe.style.width = "100%";
    iframe.style.height = "55vh"; // ajusta si lo quieres más alto/bajo
    iframe.style.border = "none";

    frameWrapper.appendChild(iframe);
    box.appendChild(frameWrapper);
  } else {
    const warn = document.createElement("p");
    warn.style.color = "#b45309";
    warn.textContent =
      "No se ha encontrado la URL del PDF todavía. Puede tardar unos segundos en generarse.";
    box.appendChild(warn);
  }

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.justifyContent = "flex-end";
  actions.style.gap = "8px";
  actions.style.marginTop = "16px";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Seguir editando";
  closeBtn.className = "btn btn-secondary";

  closeBtn.addEventListener("click", function () {
    document.body.removeChild(overlay);
  });

  actions.appendChild(closeBtn);

  if (allowWhatsapp) {
    const sendBtn = document.createElement("button");
    sendBtn.type = "button";
    sendBtn.textContent = "Enviar por WhatsApp";
    sendBtn.className = "btn btn-primary";

    sendBtn.addEventListener("click", async function () {
      sendBtn.disabled = true;
      sendBtn.textContent = "Enviando…";

      try {
        const res = await fetch(`/admin/quotes/${quoteId}/send-whatsapp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        if (!res.ok) {
          const bodyText = await res.text();
          throw new Error(
            "Error enviando por WhatsApp: " +
              res.status +
              " " +
              bodyText
          );
        }

        const body = await res.json();
        setAlert(
          "success",
          body.ok
            ? "Presupuesto enviado por WhatsApp."
            : "Presupuesto creado, pero no se ha podido confirmar el envío por WhatsApp."
        );

        // Actualizamos cajita de estado a la derecha
        setResult({
          quote_id: quoteId,
          status: "DRAFT",
          sent: !!body.ok,
        });

        document.body.removeChild(overlay);
      } catch (err) {
        setAlert("error", err.message || "Error enviando por WhatsApp.");
        sendBtn.disabled = false;
        sendBtn.textContent = "Enviar por WhatsApp";
      }
    });

    actions.appendChild(sendBtn);
  } else {
    const info = document.createElement("p");
    info.style.fontSize = "12px";
    info.style.color = "#6b7280";
    info.style.marginTop = "8px";
    info.textContent =
      "Has desmarcado “Enviar por WhatsApp automáticamente”, por eso no se muestra el botón de WhatsApp.";
    box.appendChild(info);
  }

  box.appendChild(actions);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Cerrar si clicas fuera de la caja
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
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

  const fieldTo = createField(
    "Teléfono override (E.164 sin +, opcional)",
    "to",
    "text",
    false
  );
  clientFormRow.appendChild(fieldTo.wrapper);

    // Checkbox WhatsApp
    const waWrapper = document.createElement("div");
    waWrapper.className = "field inline-checkbox";
    const waLabel = document.createElement("label");
    const waCheck = document.createElement("input");
    waCheck.type = "checkbox";
    waCheck.name = "send_whatsapp";
    waCheck.checked = true;
    waLabel.appendChild(waCheck);
    waLabel.appendChild(
      document.createTextNode(" Enviar por WhatsApp automáticamente al aceptar")
    );
    waWrapper.appendChild(waLabel);
    blockClient.appendChild(waWrapper);
  
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

  blockLines.appendChild(linesHeader);

  const table = document.createElement("table");
  table.className = "table quote-lines-table";
  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  ["Concepto", "Cantidad", "Precio", "IVA %", "Total línea", ""].forEach(
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
  blockLines.appendChild(table);

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

  actionsRow.appendChild(submitBtn);
  actionsRow.appendChild(resetBtn);

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

  const statusHelper = document.createElement("p");
  statusHelper.textContent =
    "Cuando generes un presupuesto, aquí verás el ID, el estado y si se ha enviado por WhatsApp.";
  rightCard.appendChild(statusHelper);
  

  const resultBox = document.createElement("div");
  resultBox.className = "quote-status-box";
  rightCard.appendChild(resultBox);

  function setResult(data) {
    resultBox.innerHTML = "";
    if (!data) return;
  
    // Normalizamos campos por si el backend cambia ligeramente
    const quoteId = data.quote_id || data.quoteId || data.id;
    const status = (data.status || "draft").toUpperCase();
    const sent =
      typeof data.sent !== "undefined"
        ? !!data.sent
        : !!data.sentWhatsapp; // por si en el futuro devolvemos otra key
  
    const header = document.createElement("div");
    header.className = "quote-status-header";
  
    const idText = document.createElement("div");
    idText.innerHTML = `<strong>Presupuesto #${quoteId}</strong>`;
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

  // Helper formato dinero simple
  function formatMoney(amount, currency) {
    const num = Number(amount) || 0;
    const cur = currency || "EUR";
    // Representación simple sin liarla con Intl en todos los navegadores
    return `${num.toFixed(2)} ${cur}`;
  }

  function recalcTotals() {
    let base = 0;
    let vatTotal = 0;

    lines.forEach((line) => {
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

      const lineBase = safeQty * safePrice;
      const lineVat = lineBase * (safeVat / 100);

      line.totalCell.textContent = (lineBase + lineVat).toFixed(2);

      base += lineBase;
      vatTotal += lineVat;
    });

    const total = base + vatTotal;

    totalsBox.innerHTML = `
      <div><span>Base imponible:</span><strong>${base.toFixed(2)}</strong></div>
      <div><span>IVA total:</span><strong>${vatTotal.toFixed(2)}</strong></div>
      <div class="quote-total-final"><span>Total presupuesto:</span><strong>${total.toFixed(
        2
      )}</strong></div>
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

        const base = safeQty * safePrice;
        const vat = base * (safeVat / 100);
        const totalLine = base + vat;

        return {
          concept,
          qty: safeQty,
          price: safePrice,
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
  function addLine(initial) {
    const tr = document.createElement("tr");

    const conceptTd = document.createElement("td");
    const conceptInput = document.createElement("input");
    conceptInput.type = "text";
    conceptInput.placeholder = "Concepto / servicio";
    conceptInput.value = initial && initial.concept ? initial.concept : "";
    conceptTd.appendChild(conceptInput);

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

    const vatTd = document.createElement("td");
    const vatInput = document.createElement("input");
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
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-icon";
    removeBtn.title = "Eliminar línea";
    removeBtn.textContent = "🗑️";
    actionsTd.appendChild(removeBtn);

    tr.appendChild(conceptTd);
    tr.appendChild(qtyTd);
    tr.appendChild(priceTd);
    tr.appendChild(vatTd);
    tr.appendChild(totalTd);
    tr.appendChild(actionsTd);

    tbody.appendChild(tr);

    const lineObj = {
      row: tr,
      conceptInput,
      qtyInput,
      priceInput,
      vatInput,
      totalCell: totalTd,
    };
    lines.push(lineObj);

    const onChange = function () {
      recalcTotals();
      renderPreview();
    };

    conceptInput.addEventListener("input", onChange);
    qtyInput.addEventListener("input", onChange);
    priceInput.addEventListener("input", onChange);
    vatInput.addEventListener("input", onChange);

    removeBtn.addEventListener("click", function () {
      if (lines.length === 1) {
        // siempre al menos una línea
        conceptInput.value = "";
        qtyInput.value = "1";
        priceInput.value = "";
        vatInput.value = fieldVatDefault.input.value || "21";
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

  resetBtn.addEventListener("click", function () {
    fieldCustomer.select.value = "";
    fieldVatDefault.input.value = "21";
    fieldTo.input.value = "";
    waCheck.checked = true;
    paymentSelect.value = "FULL_UPFRONT";

    tbody.innerHTML = "";
    lines = [];
    addLine();

    setAlert(null, "");
    setResult(null);
  });


  // ---------- CARGA INICIAL: MERCHANT + CLIENTES ----------
  async function loadInitialData() {
    try {
      setAlert(null, "Cargando datos…");
      const merchantPromise = getMerchantProfile();
      const customersPromise = getCustomers("");

      const res = await Promise.all([merchantPromise, customersPromise]);

      currentMerchant = res[0];
      customersList = Array.isArray(res[1]) ? res[1] : [];

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

      setAlert(null, "");
      renderPreview();
    } catch (err) {
      setAlert("error", "Error cargando datos: " + err.message);
      merchantInfo.textContent = "Error cargando datos de empresa.";
    }
  }

  loadInitialData();

  fieldCustomer.select.addEventListener("change", function () {
    renderPreview();
  });

  fieldVatDefault.input.addEventListener("input", function () {
    // actualizar IVA de nuevas líneas, pero no tocamos las existentes
    renderPreview();
  });

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

      if (!concept || safeQty <= 0 || safePrice < 0) {
        return;
      }

      payloadLines.push({
        concept: concept,
        qty: safeQty,
        price: safePrice,
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
      };

      const quote = await createQuote(quotePayload);
      const quoteId = quote.id || quote.quote_id || quote.quoteId;
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

      // 3) Mostramos modal para ver PDF y (opcional) enviar por WhatsApp
      const allowWhatsapp = waCheck.checked;
      openQuoteModal({ quoteId, pdfUrl, allowWhatsapp });

      // 4) Actualizamos cajita de estado a la derecha (de momento sin WhatsApp)
      setAlert("success", "Presupuesto creado en borrador.");
      setResult({
        quote_id: quoteId,
        status: "DRAFT",
        sent: false,
      });
    } catch (err) {
      setAlert("error", "Error generando presupuesto: " + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Generar presupuesto";
    }
  });
}
