// public/dashboard/js/settingsView.js

function renderSettingsView(container) {
    container.innerHTML = "";

    const card = document.createElement("div");
    card.className = "customers-card";
    container.appendChild(card);

    // Tarjeta de Referidos (se rellena de forma asíncrona)
    renderReferralCard(container);

    const title = document.createElement("h2");
    title.textContent = "Datos de la empresa";
    title.style.cssText = "margin:0 0 4px;font-size:18px;font-weight:700;color:var(--ink)";
    card.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.textContent = "Se usan en presupuestos, facturas y comunicaciones con clientes.";
    subtitle.style.cssText = "margin:0 0 20px;font-size:13px;color:var(--slate-400)";
    card.appendChild(subtitle);
  
    const alertBox = document.createElement("div");
    alertBox.className = "alert";
    alertBox.style.display = "none";
    card.appendChild(alertBox);

    function setAlert(type, msg) {
      alertBox.textContent = msg || "";
      alertBox.className = "alert";
      if (type === "success") alertBox.classList.add("success");
      if (type === "error") alertBox.classList.add("error");
      alertBox.style.display = (type || msg) ? "block" : "none";
    }
  
    const form = document.createElement("form");
    form.style.cssText = "display:flex;flex-direction:column;gap:14px;width:100%;max-width:560px";
    card.appendChild(form);
  
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
  
    // Campos
    const fName = createField("Nombre comercial", "name", "text", true);
    const fLegalName = createField("Razón social", "legalName", "text", true);
    const fTaxId = createField("NIF/CIF", "taxId", "text", true);
    const fAddress = createField("Dirección fiscal", "address", "text", true);
    const fWhatsappPhone = createField(
      "Teléfono WhatsApp (E.164 sin +)",
      "whatsappPhone",
      "text",
      true
    );
    const fDefaultCurrency = createField(
      "Moneda por defecto",
      "defaultCurrency",
      "text",
      true
    );
    const fInvoiceSeriesPrefix = createField(
      "Prefijo de serie de facturas",
      "invoiceSeriesPrefix",
      "text",
      true
    );
    const fLogoUrl = createField("Logo (URL opcional)", "logoUrl", "text", false);

    // País / locale
    const fCountryWrapper = document.createElement("div");
    fCountryWrapper.className = "field";
    const fCountryLabel = document.createElement("label");
    fCountryLabel.textContent = "País";
    const fCountrySelect = document.createElement("select");
    fCountrySelect.name = "country";
    [
      { value: "ES", label: "España" },
      { value: "MX", label: "México" },
      { value: "CO", label: "Colombia" },
      { value: "AR", label: "Argentina" },
      { value: "PE", label: "Perú" },
      { value: "CL", label: "Chile" },
    ].forEach(({ value, label }) => {
      const opt = document.createElement("option");
      opt.value = value; opt.textContent = label;
      fCountrySelect.appendChild(opt);
    });
    const fCountryNote = document.createElement("p");
    fCountryNote.style.cssText = "font-size:12px;color:var(--muted);margin:2px 0 0";
    fCountryNote.textContent = 'Cambia el idioma de los documentos ("Presupuesto" vs "Cotización") y la moneda por defecto.';
    fCountryWrapper.appendChild(fCountryLabel);
    fCountryWrapper.appendChild(fCountrySelect);
    fCountryWrapper.appendChild(fCountryNote);
    const fGoogleReviewUrl = createField("URL de reseñas en Google (opcional)", "googleReviewUrl", "text", false);
    const fIban  = createField("IBAN (para pagos por transferencia — España/Europa)", "iban", "text", false);
    const fClabe = createField("CLABE interbancaria (para pagos por transferencia — México)", "clabe", "text", false);

    form.appendChild(fName.wrapper);
    form.appendChild(fLegalName.wrapper);
    form.appendChild(fTaxId.wrapper);
    form.appendChild(fAddress.wrapper);
    form.appendChild(fWhatsappPhone.wrapper);
    form.appendChild(fCountryWrapper);
    form.appendChild(fDefaultCurrency.wrapper);
    form.appendChild(fInvoiceSeriesPrefix.wrapper);
    form.appendChild(fLogoUrl.wrapper);

    // Separador — Pagos por transferencia
    const sepBank = document.createElement("div");
    sepBank.style.cssText = "border-top:1px solid var(--border);margin:12px 0 4px;padding-top:12px";
    sepBank.innerHTML = '<p style="font-size:12px;color:var(--muted);margin:0 0 8px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Datos bancarios para transferencias</p>';
    form.appendChild(sepBank);

    fIban.input.placeholder = "ES91 2100 0418 4502 0005 1332";
    fIban.wrapper.querySelector("label").insertAdjacentHTML(
      "afterend",
      '<p style="font-size:12px;color:var(--muted);margin:2px 0 4px">Se muestra al cliente en la página de pago por transferencia bancaria.</p>'
    );
    fClabe.input.placeholder = "646180110400000007";
    form.appendChild(fIban.wrapper);
    form.appendChild(fClabe.wrapper);

    // Separador visual — Automatizaciones
    const sep = document.createElement("div");
    sep.style.cssText = "border-top:1px solid var(--border);margin:12px 0 4px;padding-top:12px";
    sep.innerHTML = '<p style="font-size:12px;color:var(--muted);margin:0 0 8px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Automatizaciones</p>';
    form.appendChild(sep);

    fGoogleReviewUrl.input.placeholder = "https://g.page/r/tu-negocio/review";
    fGoogleReviewUrl.wrapper.querySelector("label").insertAdjacentHTML(
      "afterend",
      '<p style="font-size:12px;color:var(--muted);margin:2px 0 4px">Al recibir un pago, se enviará automáticamente un WhatsApp al cliente pidiéndole una reseña.</p>'
    );
    form.appendChild(fGoogleReviewUrl.wrapper);

    // Separador — Notificaciones por email
    const sepNotif = document.createElement("div");
    sepNotif.style.cssText = "border-top:1px solid var(--border);margin:12px 0 4px;padding-top:12px";
    sepNotif.innerHTML = '<p style="font-size:12px;color:var(--muted);margin:0 0 8px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Notificaciones por email</p>';
    form.appendChild(sepNotif);

    function createToggle(id, labelText, hint) {
      const wrapper = document.createElement("div");
      wrapper.className = "field inline-checkbox";
      const label = document.createElement("label");
      label.style.cssText = "display:flex;align-items:flex-start;gap:8px;cursor:pointer";
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.id = id;
      chk.style.marginTop = "2px;flex-shrink:0";
      const textBlock = document.createElement("div");
      textBlock.innerHTML = '<span style="font-weight:600;font-size:13.5px;color:var(--slate-700)">' + labelText + '</span>' +
        (hint ? '<br/><span style="font-size:12px;color:var(--muted)">' + hint + '</span>' : '');
      label.appendChild(chk);
      label.appendChild(textBlock);
      wrapper.appendChild(label);
      return { wrapper, chk };
    }

    const tNotifyPaid = createToggle(
      "notifyEmailOnPaid",
      "Recibir email cuando un cliente paga",
      "Recibirás un email a tu dirección de cuenta cada vez que se confirme un pago."
    );
    const tNotifyAccepted = createToggle(
      "notifyEmailOnQuoteAccepted",
      "Recibir email cuando un cliente acepta un presupuesto",
      "Te notificamos cuando el cliente firma y acepta desde su portal."
    );
    const tNotifyWeekly = createToggle(
      "notifyEmailWeeklyDigest",
      "Recibir resumen semanal por email",
      "Cada lunes a las 9h te enviamos un resumen con cobrado, facturas emitidas, presupuestos aceptados y pendiente de cobro."
    );

    const previewBtn = document.createElement("button");
    previewBtn.type = "button";
    previewBtn.className = "btn-ghost btn-sm";
    previewBtn.textContent = "Vista previa";
    previewBtn.style.cssText = "margin-top:6px;margin-left:24px";

    const previewBox = document.createElement("div");
    previewBox.style.cssText = "display:none;margin:8px 0 0 24px;max-width:420px;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--slate-50);padding:14px 16px";

    previewBtn.addEventListener("click", async () => {
      // Toggle: si ya está visible, lo ocultamos
      if (previewBox.style.display === "block") {
        previewBox.style.display = "none";
        return;
      }
      previewBtn.disabled = true;
      const original = previewBtn.textContent;
      previewBtn.textContent = "Cargando…";
      try {
        const res = await apiRequest("/admin/digest/preview");
        const s = res.stats || {};
        const fmt = (a, c) => Number(a || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + (c || "");
        const rows = [
          ["💰 Cobrado", fmt(s.cobrado?.amount, s.cobrado?.currency) + " · " + (s.cobrado?.count || 0) + " factura/s"],
          ["🧾 Facturas emitidas", String(s.facturasEmitidas || 0)],
          ["✅ Presupuestos aceptados", String(s.presupuestosAceptados || 0)],
          ["📋 Presupuestos enviados", String(s.presupuestosEnviados || 0)],
          ["👤 Clientes nuevos", String(s.clientesNuevos || 0)],
          ["⏳ Pendiente", fmt(s.pendiente?.amount, s.pendiente?.currency) + " · " + (s.pendiente?.count || 0) + " factura/s"],
        ];
        previewBox.innerHTML =
          '<div style="font-weight:700;font-size:13.5px;color:var(--ink);margin-bottom:10px">' +
          escSettings(res.subject || "📊 Tu semana en YaQu") + '</div>' +
          rows.map(([k, v]) =>
            '<div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:4px 0;border-bottom:1px solid var(--border)">' +
            '<span style="color:var(--muted)">' + k + '</span>' +
            '<span style="color:var(--body);font-weight:600">' + escSettings(v) + '</span></div>'
          ).join('');
        previewBox.style.display = "block";
      } catch (err) {
        setAlert("error", "No se pudo cargar la vista previa: " + (err?.message || "error"));
      } finally {
        previewBtn.disabled = false;
        previewBtn.textContent = original;
      }
    });
    tNotifyWeekly.wrapper.appendChild(previewBtn);
    tNotifyWeekly.wrapper.appendChild(previewBox);

    form.appendChild(tNotifyPaid.wrapper);
    form.appendChild(tNotifyAccepted.wrapper);
    form.appendChild(tNotifyWeekly.wrapper);

    // ── Enterprise: branding + aprobación (ENT-1, ENT-2) ──────────────────
    const sepEnt = document.createElement("div");
    sepEnt.style.cssText = "border-top:1px solid var(--border);margin:12px 0 4px;padding-top:12px";
    sepEnt.innerHTML = '<p style="font-size:12px;color:var(--muted);margin:0 0 8px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Empresa (Enterprise)</p>';
    form.appendChild(sepEnt);

    // Color de marca
    const fBrandWrapper = document.createElement("div");
    fBrandWrapper.className = "field";
    fBrandWrapper.innerHTML = `
      <label>Color de marca</label>
      <p style="font-size:12px;color:var(--muted);margin:2px 0 6px">Se usa en el botón de aceptar y los acentos de la página que ve tu cliente.</p>
      <div style="display:flex;align-items:center;gap:10px">
        <input type="color" id="brand-color-input" value="#22c55e" style="width:48px;height:38px;padding:2px;border:1px solid var(--border);border-radius:8px;cursor:pointer"/>
        <span id="brand-color-hex" style="font-size:13px;color:var(--muted)">#22c55e</span>
        <button type="button" id="brand-color-reset" class="btn-secondary btn-sm">Sin color (por defecto)</button>
      </div>`;
    form.appendChild(fBrandWrapper);
    const brandColorInput = fBrandWrapper.querySelector("#brand-color-input");
    const brandColorHex = fBrandWrapper.querySelector("#brand-color-hex");
    let brandColorEnabled = false;
    brandColorInput.addEventListener("input", () => {
      brandColorEnabled = true;
      brandColorHex.textContent = brandColorInput.value;
    });
    fBrandWrapper.querySelector("#brand-color-reset").addEventListener("click", () => {
      brandColorEnabled = false;
      brandColorInput.value = "#22c55e";
      brandColorHex.textContent = "Sin color";
    });

    // Importe máximo sin aprobación
    const fApproval = createField("Importe máximo sin aprobación", "approvalThreshold", "number", false);
    fApproval.input.min = "0";
    fApproval.input.step = "0.01";
    fApproval.input.placeholder = "Ej: 1000 (vacío = sin aprobación)";
    fApproval.wrapper.querySelector("label").insertAdjacentHTML(
      "afterend",
      '<p style="font-size:12px;color:var(--muted);margin:2px 0 4px">Las cotizaciones de un técnico por encima de este importe quedarán "pendientes de aprobación" hasta que un admin las apruebe.</p>'
    );
    form.appendChild(fApproval.wrapper);

    const actions = document.createElement("div");
    actions.className = "form-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.className = "btn btn-primary btn-lg";
    saveBtn.textContent = "Guardar cambios";
  
    actions.appendChild(saveBtn);
    form.appendChild(actions);
  
    // Cargar datos actuales
    async function loadMerchant() {
      try {
        setAlert(null, "Cargando datos de empresa…");
        const merchant = await getMerchantProfile();
  
        fName.input.value = merchant.name || "";
        fLegalName.input.value = merchant.legalName || "";
        fTaxId.input.value = merchant.taxId || "";
        fAddress.input.value = merchant.address || "";
        fWhatsappPhone.input.value = merchant.whatsappPhone || "";
        fDefaultCurrency.input.value = merchant.defaultCurrency || "EUR";
        fInvoiceSeriesPrefix.input.value = merchant.invoiceSeriesPrefix || "";
        fLogoUrl.input.value = merchant.logoUrl || "";
        fGoogleReviewUrl.input.value = merchant.googleReviewUrl || "";
        fIban.input.value  = merchant.iban  || "";
        fClabe.input.value = merchant.clabe || "";
        tNotifyPaid.chk.checked     = merchant.notifyEmailOnPaid     !== false;
        tNotifyAccepted.chk.checked = !!merchant.notifyEmailOnQuoteAccepted;
        tNotifyWeekly.chk.checked   = !!merchant.notifyEmailWeeklyDigest;
        if (merchant.country) fCountrySelect.value = merchant.country;
        if (merchant.brandColor) {
          brandColorEnabled = true;
          brandColorInput.value = merchant.brandColor;
          brandColorHex.textContent = merchant.brandColor;
        }
        fApproval.input.value = merchant.approvalThreshold != null ? merchant.approvalThreshold : "";
  
        setAlert(null, "");
      } catch (err) {
        setAlert("error", "No se han podido cargar los datos: " + err.message);
      }
    }
  
    loadMerchant();
  
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      setAlert(null, "");
  
      const payload = {
        name: fName.input.value.trim(),
        legalName: fLegalName.input.value.trim(),
        taxId: fTaxId.input.value.trim(),
        address: fAddress.input.value.trim(),
        whatsappPhone: fWhatsappPhone.input.value.trim(),
        defaultCurrency: fDefaultCurrency.input.value.trim() || "EUR",
        invoiceSeriesPrefix: fInvoiceSeriesPrefix.input.value.trim(),
        logoUrl: fLogoUrl.input.value.trim() || null,
        googleReviewUrl: fGoogleReviewUrl.input.value.trim() || null,
        country: fCountrySelect.value || undefined,
        iban:  fIban.input.value.trim().replace(/\s/g, '') || null,
        clabe: fClabe.input.value.trim() || null,
        notifyEmailOnPaid:          tNotifyPaid.chk.checked,
        notifyEmailOnQuoteAccepted: tNotifyAccepted.chk.checked,
        notifyEmailWeeklyDigest:    tNotifyWeekly.chk.checked,
        brandColor: brandColorEnabled ? brandColorInput.value : null,
        approvalThreshold: fApproval.input.value.trim() === "" ? null : Number(fApproval.input.value),
      };
  
      if (!payload.name || !payload.legalName || !payload.taxId || !payload.address || !payload.whatsappPhone) {
        setAlert(
          "error",
          "Nombre comercial, razón social, NIF/CIF, dirección y teléfono de WhatsApp son obligatorios."
        );
        return;
      }
  
      try {
        saveBtn.disabled = true;
        saveBtn.textContent = "Guardando…";
        await updateMerchantProfile(payload);
        setAlert("success", "Datos de empresa guardados correctamente.");
      } catch (err) {
        setAlert("error", "Error al guardar: " + err.message);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Guardar cambios";
      }
    });
  }
  
// ── Tarjeta de Referidos (Sprint REFERRAL) ────────────────────────────────
async function renderReferralCard(container) {
  const card = document.createElement("div");
  card.className = "customers-card";
  card.style.marginTop = "16px";
  card.innerHTML = `
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:var(--ink)">Invita y gana meses gratis 🎁</h2>
    <p style="margin:0 0 16px;font-size:13px;color:var(--slate-400)">Por cada profesional que se suscriba con tu enlace, recibes 1 mes gratis.</p>
    <div style="color:var(--slate-400);font-size:13px">Cargando…</div>
  `;
  container.appendChild(card);

  let data;
  try {
    data = await apiRequest('/admin/referral');
  } catch {
    card.querySelector('div').textContent = 'No se pudieron cargar tus referidos.';
    return;
  }

  card.innerHTML = `
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:var(--ink)">Invita y gana meses gratis 🎁</h2>
    <p style="margin:0 0 16px;font-size:13px;color:var(--slate-400)">Por cada profesional que se suscriba con tu enlace, recibes 1 mes gratis.</p>

    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
      <input id="ref-link" type="text" readonly value="${escSettings(data.link)}"
        style="flex:1;min-width:220px;padding:11px 13px;border:1px solid var(--border);border-radius:10px;font-size:13px;background:var(--slate-50);color:var(--body)"/>
      <button id="ref-copy" class="btn btn-primary btn-sm" style="white-space:nowrap">Copiar link</button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
      <div class="kpi-card"><div class="kpi-label">Tu código</div><div class="kpi-value" style="font-size:18px">${escSettings(data.code)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Referidos</div><div class="kpi-value" style="font-size:20px">${data.referredCount} <span style="font-size:12px;color:var(--muted)">(${data.payingCount} pagando)</span></div></div>
      <div class="kpi-card"><div class="kpi-label">Meses gratis ganados</div><div class="kpi-value" style="font-size:20px;color:var(--green-600)">${data.freeMonthsEarned}</div></div>
    </div>

    ${Number(data.freeMonthsEarned) >= 1 ? `
    <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:var(--brand-tint);border:1px solid #bbf7d0;border-radius:12px;padding:12px 14px">
      <div style="font-size:13px;color:var(--ink)">Tienes <strong>${data.freeMonthsEarned}</strong> mes${Number(data.freeMonthsEarned) !== 1 ? 'es' : ''} gratis disponible${Number(data.freeMonthsEarned) !== 1 ? 's' : ''}. Canjéalo para extender tu plan 30 días.</div>
      <button id="ref-redeem" class="btn-primary btn-sm" style="white-space:nowrap">Canjear 1 mes gratis</button>
    </div>
    <div id="ref-redeem-msg" style="font-size:12.5px;color:var(--muted);margin-top:8px;min-height:16px"></div>
    ` : ''}
  `;

  const redeemBtn = card.querySelector('#ref-redeem');
  if (redeemBtn) {
    redeemBtn.addEventListener('click', async () => {
      redeemBtn.disabled = true;
      const original = redeemBtn.textContent;
      redeemBtn.textContent = 'Canjeando…';
      const msg = card.querySelector('#ref-redeem-msg');
      try {
        const r = await apiRequest('/admin/referral/redeem', { method: 'POST' });
        const until = r.planExpiresAt ? new Date(r.planExpiresAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
        if (msg) { msg.style.color = 'var(--green-700)'; msg.textContent = '✓ Mes gratis aplicado.' + (until ? ' Tu plan llega hasta el ' + until + '.' : ''); }
        // Re-render limpio: quitar esta tarjeta y volver a pintarla con el saldo actualizado
        const parent = card.parentNode;
        setTimeout(() => { card.remove(); if (parent) renderReferralCard(parent); }, 900);
      } catch (e) {
        redeemBtn.disabled = false;
        redeemBtn.textContent = original;
        if (msg) { msg.style.color = 'var(--red-600)'; msg.textContent = e?.data?.error === 'no_credit' ? 'No te quedan meses gratis.' : 'No se pudo canjear. Inténtalo de nuevo.'; }
      }
    });
  }

  const copyBtn = card.querySelector('#ref-copy');
  copyBtn.addEventListener('click', async () => {
    const link = card.querySelector('#ref-link').value;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const inp = card.querySelector('#ref-link');
      inp.select(); document.execCommand('copy');
    }
    copyBtn.textContent = '¡Copiado!';
    setTimeout(() => { copyBtn.textContent = 'Copiar link'; }, 1800);
  });
}

function escSettings(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
