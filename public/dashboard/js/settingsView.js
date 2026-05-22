// public/dashboard/js/settingsView.js

function renderSettingsView(container) {
    container.innerHTML = "";
  
    const card = document.createElement("div");
    card.className = "card";
    container.appendChild(card);
  
    const title = document.createElement("h2");
    title.textContent = "Datos de la empresa";
    title.style.marginTop = "0";
    card.appendChild(title);
  
    const subtitle = document.createElement("p");
    subtitle.textContent =
      "Estos datos se utilizarán en los presupuestos, facturas y comunicaciones con tus clientes.";
    subtitle.style.marginTop = "0";
    subtitle.style.fontSize = "14px";
    subtitle.style.color = "#4b5563";
    card.appendChild(subtitle);
  
    const alertBox = document.createElement("div");
    alertBox.className = "alert";
    card.appendChild(alertBox);
  
    function setAlert(type, msg) {
      alertBox.textContent = msg || "";
      alertBox.className = "alert";
      if (type === "success") alertBox.classList.add("success");
      if (type === "error") alertBox.classList.add("error");
    }
  
    const form = document.createElement("form");
    form.className = "settings-form";
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
    fCountryNote.style.cssText = "font-size:12px;color:#9ca3af;margin:2px 0 0";
    fCountryNote.textContent = 'Cambia el idioma de los documentos ("Presupuesto" vs "Cotización") y la moneda por defecto.';
    fCountryWrapper.appendChild(fCountryLabel);
    fCountryWrapper.appendChild(fCountrySelect);
    fCountryWrapper.appendChild(fCountryNote);
    const fGoogleReviewUrl = createField("URL de reseñas en Google (opcional)", "googleReviewUrl", "text", false);

    form.appendChild(fName.wrapper);
    form.appendChild(fLegalName.wrapper);
    form.appendChild(fTaxId.wrapper);
    form.appendChild(fAddress.wrapper);
    form.appendChild(fWhatsappPhone.wrapper);
    form.appendChild(fCountryWrapper);
    form.appendChild(fDefaultCurrency.wrapper);
    form.appendChild(fInvoiceSeriesPrefix.wrapper);
    form.appendChild(fLogoUrl.wrapper);

    // Separador visual
    const sep = document.createElement("div");
    sep.style.cssText = "border-top:1px solid #e5e7eb;margin:12px 0 4px;padding-top:12px";
    sep.innerHTML = '<p style="font-size:12px;color:#6b7280;margin:0 0 8px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Automatizaciones</p>';
    form.appendChild(sep);

    fGoogleReviewUrl.input.placeholder = "https://g.page/r/tu-negocio/review";
    fGoogleReviewUrl.wrapper.querySelector("label").insertAdjacentHTML(
      "afterend",
      '<p style="font-size:12px;color:#9ca3af;margin:2px 0 4px">Al recibir un pago, se enviará automáticamente un WhatsApp al cliente pidiéndole una reseña.</p>'
    );
    form.appendChild(fGoogleReviewUrl.wrapper);
  
    const actions = document.createElement("div");
    actions.className = "form-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.className = "btn btn-primary";
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
        if (merchant.country) fCountrySelect.value = merchant.country;
  
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
  