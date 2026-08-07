// public/dashboard/js/settingsView.js

// SCRUM-298 (A8) · LOS TRES RÓTULOS DEL MODO DE EMISIÓN — DOS APROBADOS, UNO DEVUELTO.
//
// **Aprobados por el fundador el 7-ago-2026**, con la condición de verificar cada afirmación
// contra el mecanismo antes de escribirla. Se verificaron, y por eso `receipt` sigue con marcador:
// su texto afirmaba algo que el código NO hace (abajo, en su propia nota).
//
// PROCEDENCIA: `docs/master/SCRUM-298.md`, sección «Microcopy». Ahí está el detalle de qué se midió
// para cada uno y con qué ficheros — no se repite aquí para no tener dos sitios que puedan divergir.
//
// ⚠️ REGLA 26 · Ninguno nombra VeriFactu, la AEAT, Hacienda ni el calendario, y no es casualidad:
// eso se responde SOLO con el guion H2. Hay guard que lo exige, con hermano positivo.
const PENDIENTE_MODO_EMISION = '[PENDIENTE microcopy oficial]';

/**
 * Título y detalle de cada modo. Los dos textos van juntos: el título solo no distingue «factura»
 * de «justificante» para quien no sepa la diferencia, que es justo el profesional al que esta fila
 * le importa.
 *
 * ⚠️ CADA AFIRMACIÓN ESTÁ MEDIDA CONTRA EL CÓDIGO, no redactada de memoria:
 *
 *   · `fiscal`  — numera con la serie fiscal (`formatInvoiceNumber`, con su advisory lock
 *     `SERIE_LOCK_NS`) y no se edita ni se borra: `invoicesAdmin.routes.ts:68` es SOLO ALTA
 *     («esta ruta no edita ni borra»), regla 29.
 *   · `demo`    — `DEMO_WATERMARK = 'DEMO — no válida fiscalmente'` (`emission.service.ts:12`),
 *     aplicada en `lib/invoicing.ts:122` y `:257`. Factura completa, con marca de agua.
 *   · `receipt` — DEVUELTO. Ver la nota de abajo.
 */
// ⚠️ DOS OBJETOS PLANOS, y no es estilo: es que el guard tiene que poder VERLOS. Al escribirlos
// primero como un objeto anidado (`{ fiscal: { titulo, detalle } }`) el extractor de microcopy se
// quedó a CERO textos y su suelo saltó — «solo ve 0 textos del modo». La forma nueva la introduje
// yo, así que se cambia el código y no el analizador: enseñarle a ver una forma que acabo de
// inventar es exactamente cómo un guard se vuelve ciego sin que nadie lo note.
const TITULO_MODO_EMISION = {
  fiscal: 'Se emiten facturas',
  demo: 'Cuenta de demostración',
  // 🔴 DEVUELTO AL FUNDADOR, no olvidado. Ver la nota de abajo.
  receipt: PENDIENTE_MODO_EMISION,
};
const DETALLE_MODO_EMISION = {
  fiscal: 'Cada cobro genera una factura con su numeración. Una vez emitida no se puede editar ni borrar.',
  demo: 'Se generan facturas completas con una marca de agua DEMO. No tienen validez: esta cuenta es para probar.',
  receipt: PENDIENTE_MODO_EMISION,
};

// 🔴 POR QUÉ `receipt` SIGUE CON MARCADOR. El texto propuesto decía «con su propia numeración», y
// el código dice lo contrario en su propio comentario (`invoiceNumber.service.ts:32-35`):
//
//     los merchants ES reales con `INVOICING_ES_ENABLED` off NO consumen la serie fiscal —
//     reciben una REFERENCIA `J-YYYYMMDD-XXXX` FUERA DE TODA SERIE DE FACTURACIÓN
//     («sin numeración de factura», Parte M).
//
// Y `makeReceiptNumber` cierra la referencia con `Math.random()`, no con un contador: dos
// justificantes del mismo día no guardan ningún orden entre sí. Prometer «numeración» a un
// profesional que responde ante Hacienda es prometer una correlatividad que no existe — y éste es
// precisamente el modo en el que están HOY todos los merchants ES reales.
//
// Lo que sí está medido y es cierto: el prefijo `J-`, el `type: 'JUST'` y que nunca entra en la
// cadena de huellas (`verifactu.service.ts:333`). O sea, «no es una factura» sí se sostiene.


function renderSettingsView(container) {
    container.innerHTML = "";

    const card = document.createElement("div");
    card.className = "customers-card";
    container.appendChild(card);

    // ── SCRUM-284 (B1) · CONFIGURACIÓN TROCEADA EN DIEZ SUBMENÚS ────────────────────────────
    //
    // El scroll único con doce asuntos distintos se parte en diez paneles. **Cada campo se coloca
    // LEYENDO EL MAPA** (`settingsSubmenus.js`), nunca por una posición escrita a mano aquí: el
    // fallo mudo de este ticket es que un ajuste desaparezca en la reorganización, y la única forma
    // de que el guard signifique algo sobre esta pantalla es que la pantalla y el guard lean LO
    // MISMO. Si aparece un campo que el mapa no conoce, `submenuDeCampo` LANZA — ruidoso a
    // propósito: caer en el sitio equivocado sería mudo.
    //
    // NO se ha movido ni reescrito la construcción de un solo campo: siguen creándose exactamente
    // igual y en el mismo orden. Lo único que cambia es DÓNDE se hace `appendChild`. Eso es lo que
    // mantiene el cambio revisable (regla 4) y lo que permite que el censo siga viendo los 25.
    const nav = document.createElement("div");
    nav.className = "settings-nav";
    nav.setAttribute("role", "tablist");
    nav.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px";
    card.appendChild(nav);

    const paneles = {};
    let submenuActivo = SUBMENUS[0];

    SUBMENUS.forEach((clave) => {
      const panel = document.createElement("div");
      panel.className = "settings-panel";
      panel.dataset.submenu = clave;
      panel.style.cssText = "display:none;flex-direction:column;gap:14px;width:100%;max-width:560px";
      paneles[clave] = panel;
    });

    /** Coloca el bloque de un campo en SU panel. El sitio lo dice el mapa, no esta función. */
    function colocar(clave, bloque) {
      paneles[submenuDeCampo(clave)].appendChild(bloque);
    }

    /**
     * El panel de una SUPERFICIE (la segunda población). Existe para que las dos poblaciones no
     * puedan descuadrarse: los `pp-*`/`qr-*` están asignados a `publica` como CAMPOS, pero quien
     * los pinta es `renderPublicProfileCard`. Si la tarjeta acabara en otro panel, esos seis campos
     * dirían una cosa en el mapa y aparecerían en otra en pantalla — y el guard de campos, que solo
     * mira el mapa, seguiría verde.
     */
    function panelDeSuperficie(nombre) {
      return paneles[submenuDeSuperficie(nombre)];
    }

    function pintarNav() {
      nav.innerHTML = "";
      SUBMENUS.forEach((clave) => {
        // Inventario AB3: mismo control segmentado que el filtro de Trabajos (SCRUM-11). Cero
        // componentes nuevos. Rótulo = marcador: los diez nombres son microcopy sin aprobar.
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn-sm " + (submenuActivo === clave ? "btn-secondary" : "btn-ghost");
        b.textContent = rotuloDeSubmenu(clave);
        b.dataset.submenu = clave;
        b.style.minHeight = "44px"; // AB6: objetivo al pulgar (btn-sm se queda en 30)
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", submenuActivo === clave ? "true" : "false");
        b.addEventListener("click", () => { submenuActivo = clave; pintarNav(); });
        nav.appendChild(b);
      });
      SUBMENUS.forEach((clave) => {
        paneles[clave].style.display = submenuActivo === clave ? "flex" : "none";
      });
    }

    // A18.5 (AB4 · Parte M): checklist de readiness ARRIBA — qué te falta para cobrar.
    // SCRUM-284: se queda en la CABECERA, fuera de los diez. No es una superficie de Configuración:
    // es un ÍNDICE DE ESTADO, y sus tres elementos (whatsappPhone, iban, taxId) no son campos
    // propios sino REFERENCIAS a campos que ya viven en Empresa y en Cobro. Por eso no entran en el
    // mapa — y por eso el «tres destinos» deja de existir como problema que resolver eligiendo uno.
    renderReadinessCard(container, card);

    // SCRUM-284 · «Invita y gana»: COLOCACIÓN PROVISIONAL, declarada en `SUPERFICIES_PROVISIONALES`.
    //
    // Su destino es la barra lateral —no es un ajuste, no persiste nada— pero esa entrada es el
    // incremento 2. Dejarla sin llamar entre un incremento y el otro la haría INALCANZABLE, y el
    // programa de referidos paga un mes gratis al referidor: eso es una regresión de dinero, no un
    // detalle de orden. Se sigue pintando donde está hoy —tarjeta suelta al final, fuera de los diez
    // paneles— hasta que exista su destino. Quien haga el incremento 2 borra esta llamada y su
    // entrada en el mapa.
    renderReferralCard(container);
    renderPublicProfileCard(panelDeSuperficie("renderPublicProfileCard")); // A14.1 (PERFIL-1): página pública + QR
    // SCRUM-138: "Descargar mis datos" se muda a Finanzas › Descargar datos
    // (public/dashboard/js/exportView.js). Es el entregable para el asesor y para una
    // inspección — dinero, no una preferencia de la cuenta — y aquí no lo encontraba nadie.

    const title = document.createElement("h2");
    title.textContent = "Datos de la empresa";
    title.style.cssText = "margin:0 0 4px;font-size:18px;font-weight:700;color:var(--ink)";
    card.insertBefore(title, nav);

    const subtitle = document.createElement("p");
    subtitle.textContent = "Se usan en presupuestos, facturas y comunicaciones con clientes.";
    subtitle.style.cssText = "margin:0 0 20px;font-size:13px;color:var(--neutral-400)";
    card.insertBefore(subtitle, nav);

    // ── SCRUM-298 (A8) · EL MODO DE EMISIÓN, VISIBLE ─────────────────────────────────────
    //
    // Hasta hoy `getEmissionMode` no llegaba ni una vez al navegador, así que dos estados que
    // producen documentos DISTINTOS —factura, factura con marca de agua, justificante— se veían
    // exactamente igual en pantalla. El profesional no tenía forma de saber en cuál estaba.
    //
    // ⚠️ SIN DATO NO SE PINTA NADA. `null` significa «no se sabe», y una fila que dijera un modo
    // equivocado es peor que no tener fila: quien la lee toma decisiones fiscales sobre una
    // pantalla que le miente y no tiene forma de sospecharlo.
    //
    // ⚠️ REGLA 26 · AQUÍ NO SE EXPLICA NADA. Ni qué es cada modo, ni por qué, ni desde cuándo, ni
    // una palabra sobre VeriFactu, la AEAT o el calendario. Esa pregunta se responde SOLO con el
    // guion H2. Los tres rótulos van con el marcador y su procedencia está en la entrada del
    // ticket: un texto que explica mal una obligación fiscal no es feo, es peligroso.
    //
    // ⚠️ Y NO ES UN INTERRUPTOR. Esto solo LEE. El modal de dos caminos quedó bloqueado porque
    // «se envía» no existe (sin cliente SOAP/mTLS, sin cola de remisión): una salida inerte le
    // diría al profesional que puede elegir remitir a la AEAT, y no puede.
    //
    // ⚠️ VIVE EN `Configuración › Cumplimiento`, y el panel se pide POR EL MAPA
    // (`panelDeSuperficie`), nunca por una posición escrita a mano: el fallo mudo de B1 es que una
    // superficie acabe en un panel distinto del que declara el mapa, y el guard de campos —que
    // solo mira el mapa— seguiría verde. Antes se insertaba en la cabecera de la tarjeta, fuera
    // de los diez paneles, y por eso el submenú figuraba como hueco declarado.
    //
    // La derivación NO se toca al mudarla: sigue siendo `window.appModoEmision`, que viene de
    // `getEmissionMode` por `/admin/me`. Recalcular aquí el criterio al moverlo habría sido
    // exactamente la fuente doble que este ticket existe para impedir.
    if (window.appModoEmision) {
      const fila = document.createElement("div");
      fila.className = "settings-modo-emision";
      fila.style.cssText = "display:flex;flex-direction:column;gap:6px";
      fila.dataset.modo = window.appModoEmision;
      // Regla 30: los rótulos los aprueba el fundador. `receipt` sigue con marcador porque su
      // texto afirmaba una numeración que el código no da — el guard recorre las TRES ramas, que
      // es la lección del ternario ciego de SCRUM-346.
      const pill = document.createElement("span");
      pill.className = "status-pill";
      pill.dataset.modo = window.appModoEmision;
      pill.style.cssText = "align-self:flex-start";
      pill.textContent = TITULO_MODO_EMISION[window.appModoEmision] || PENDIENTE_MODO_EMISION;
      fila.appendChild(pill);

      const detalle = document.createElement("p");
      // Mismos tokens que el subtítulo de la cabecera: ni un color ni un tamaño nuevos (DESIGN.md).
      detalle.style.cssText = "margin:0;font-size:13px;color:var(--neutral-400);line-height:1.5";
      detalle.textContent = DETALLE_MODO_EMISION[window.appModoEmision] || PENDIENTE_MODO_EMISION;
      fila.appendChild(detalle);

      panelDeSuperficie("modoEmision").appendChild(fila);
    }

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
    // Los diez paneles cuelgan del MISMO form: un solo «Guardar cambios» sigue guardando todo,
    // se vea el panel que se vea. Trocear la pantalla no trocea el guardado.
    SUBMENUS.forEach((clave) => form.appendChild(paneles[clave]));

    // ── LOS TRES VACÍOS DECLARADOS ──────────────────────────────────────────────────────────
    // «Un menú que lleva a una página vacía es peor que no tener el menú.» El submenú existe porque
    // el hueco está DECLARADO y con motivo en el mapa (`VACIOS_DECLARADOS`), y se dice en pantalla
    // que todavía no hay nada, en vez de dejar un panel en blanco que parezca roto.
    //
    // El motivo NO se pinta: es texto interno del mapa, no microcopy aprobada. Lo que se ve es el
    // marcador (regla 30) sobre el componente de vacío que ya existe en el inventario AB3.
    Object.keys(VACIOS_DECLARADOS).forEach((clave) => {
      const vacio = document.createElement("div");
      vacio.className = "empty-state";
      vacio.innerHTML =
        '<div class="empty-state-title">' + MARCA_MICROCOPY_SUBMENU + '</div>' +
        '<div class="empty-state-desc">' + MARCA_MICROCOPY_SUBMENU + '</div>';
      paneles[clave].appendChild(vacio);
    });

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

    colocar("name", fName.wrapper);
    colocar("legalName", fLegalName.wrapper);
    colocar("taxId", fTaxId.wrapper);
    colocar("address", fAddress.wrapper);
    colocar("whatsappPhone", fWhatsappPhone.wrapper);
    colocar("country", fCountryWrapper);
    colocar("defaultCurrency", fDefaultCurrency.wrapper);
    colocar("invoiceSeriesPrefix", fInvoiceSeriesPrefix.wrapper);
    colocar("logoUrl", fLogoUrl.wrapper);

    // ── SCRUM-D1 · LA PUERTA DE ÚLTIMA OPORTUNIDAD ───────────────────────────
    //
    // Va en el panel de NUMERACIÓN, encima del campo de la serie, porque es la pregunta que hay
    // que contestar ANTES de tocarla. Quien pasó el onboarding sin contestarla no tenía dónde.
    //
    // 🔴 El veredicto lo da el servidor (`window.appPuertaSerieDisponible`). Aquí NO se comprueba
    // `invoiceSeriesYear !== año`: esa regla vive en un sitio y solo en uno.
    const panelNumeracion = paneles[submenuDeCampo("invoiceSeriesPrefix")];
    if (window.renderPuertaSerie) {
      window.renderPuertaSerie(panelNumeracion, {
        prefijoActual: null, // se rellena al cargar el perfil, más abajo
        onGuardado: () => window.location.reload(),
      });
    }

    // Y si YA hay facturas emitidas, el campo de la serie sale BLOQUEADO CON SU MOTIVO. Un campo
    // editable que el servidor va a rechazar es peor que uno bloqueado: le deja escribir, le deja
    // guardar y le contesta que no. El motivo también lo deriva el servidor (`serieEmitida`).
    const motivoBloqueo = window.motivoSerieBloqueada && window.motivoSerieBloqueada();
    if (motivoBloqueo) {
      fInvoiceSeriesPrefix.input.disabled = true;
      fInvoiceSeriesPrefix.input.setAttribute("aria-describedby", "serie-bloqueada-motivo");
      const nota = document.createElement("p");
      nota.id = "serie-bloqueada-motivo";
      nota.style.cssText = "font-size:12px;color:var(--muted);margin:4px 0 0";
      nota.textContent = motivoBloqueo;
      fInvoiceSeriesPrefix.wrapper.appendChild(nota);
    }

    // ── Logo: SUBIR imagen en vez de pegar una URL (feedback fundador) ──
    // El input de texto pasa a ser el contenedor oculto del valor (URL antigua
    // o data-URI nuevo); el usuario ve preview + "Subir logo" + "Quitar".
    // La imagen se redimensiona en cliente a ≤512px (canvas) → data-URI ligero
    // que viaja por el PUT normal y funciona en PDFs y landings sin storage.
    fLogoUrl.input.type = "hidden";
    fLogoUrl.wrapper.querySelector("label").textContent = "Logo de tu negocio";
    const logoRow = document.createElement("div");
    logoRow.style.cssText = "display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:4px";
    const logoPreview = document.createElement("img");
    logoPreview.alt = "Logo";
    logoPreview.style.cssText = "max-height:44px;max-width:130px;object-fit:contain;border:1px solid var(--border);border-radius:8px;padding:4px;background:#fff;display:none";
    const logoFile = document.createElement("input");
    logoFile.type = "file";
    logoFile.accept = "image/png,image/jpeg,image/webp";
    logoFile.style.display = "none";
    const logoBtn = document.createElement("button");
    logoBtn.type = "button";
    logoBtn.className = "btn btn-secondary btn-sm";
    logoBtn.textContent = "⬆ Subir logo";
    const logoClear = document.createElement("button");
    logoClear.type = "button";
    logoClear.className = "btn-ghost btn-sm";
    logoClear.textContent = "Quitar";
    logoClear.style.display = "none";
    const logoHint = document.createElement("p");
    logoHint.style.cssText = "font-size:12px;color:var(--muted);margin:4px 0 0;width:100%";
    logoHint.textContent = "PNG, JPG o WebP. Se ajusta solo (máx. 512px). Saldrá en tus PDFs y en la página que ve tu cliente.";
    logoRow.appendChild(logoPreview);
    logoRow.appendChild(logoBtn);
    logoRow.appendChild(logoClear);
    logoRow.appendChild(logoFile);
    logoRow.appendChild(logoHint);
    fLogoUrl.wrapper.appendChild(logoRow);

    function refreshLogoUI() {
      const v = fLogoUrl.input.value;
      if (v) {
        logoPreview.src = v;
        logoPreview.style.display = "block";
        logoClear.style.display = "inline-block";
        logoBtn.textContent = "⬆ Cambiar logo";
      } else {
        logoPreview.style.display = "none";
        logoClear.style.display = "none";
        logoBtn.textContent = "⬆ Subir logo";
      }
    }
    logoPreview.onerror = () => { logoPreview.style.display = "none"; };
    logoBtn.addEventListener("click", () => logoFile.click());
    logoClear.addEventListener("click", () => { fLogoUrl.input.value = ""; refreshLogoUI(); });
    logoFile.addEventListener("change", () => {
      const file = logoFile.files && logoFile.files[0];
      if (!file) return;
      if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { setAlert("error", "El logo debe ser PNG, JPG o WebP."); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const MAX = 512;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          // PNG conserva transparencia; JPEG/WebP → JPEG comprimido
          const dataUrl = file.type === "image/png"
            ? canvas.toDataURL("image/png")
            : canvas.toDataURL("image/jpeg", 0.85);
          fLogoUrl.input.value = dataUrl;
          refreshLogoUI();
          setAlert(null, "");
        };
        img.onerror = () => setAlert("error", "No se pudo leer la imagen.");
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });

    // Separador — Pagos por transferencia
    fIban.input.placeholder = "ES91 2100 0418 4502 0005 1332";
    fIban.wrapper.querySelector("label").insertAdjacentHTML(
      "afterend",
      '<p style="font-size:12px;color:var(--muted);margin:2px 0 4px">Se muestra al cliente en la página de pago por transferencia bancaria.</p>'
    );
    fClabe.input.placeholder = "646180110400000007";
    colocar("iban", fIban.wrapper);
    colocar("clabe", fClabe.wrapper);

    // C1-4: móvil de Bizum (default: el de WhatsApp, editable)
    const fBizumPhone = createField("Móvil de Bizum (para cobros por Bizum)", "bizumPhone", "text", false);
    fBizumPhone.input.placeholder = "+34 600 000 000";
    fBizumPhone.wrapper.querySelector("label").insertAdjacentHTML(
      "afterend",
      '<p style="font-size:12px;color:var(--muted);margin:2px 0 4px">El cliente verá este móvil en la página "Pagar por Bizum". Si lo dejas vacío se usa tu número de WhatsApp.</p>'
    );
    colocar("bizumPhone", fBizumPhone.wrapper);

    // C1-1: card "Cobros con tarjeta" (Stripe Connect Express) — solo si el
    // flag PAYMENTS_CONNECT_ENABLED está activo (lo dice /admin/connect/status)
    const connectBlock = document.createElement("div");
    connectBlock.style.cssText = "border-top:1px solid var(--border);margin:12px 0 4px;padding-top:12px;display:none";
    connectBlock.innerHTML =
      '<p style="font-size:12px;color:var(--muted);margin:0 0 8px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Cobros con tarjeta</p>' +
      '<div id="connect-status-body" style="font-size:13px;color:var(--body)">Cargando…</div>';
    panelDeSuperficie("connectStatus").appendChild(connectBlock);

    (async function renderConnectCard() {
      let st;
      try { st = await apiRequest('/admin/connect/status'); } catch { return; }
      if (!st || !st.enabled) return; // flag OFF → no se muestra nada
      connectBlock.style.display = 'block';
      const body = connectBlock.querySelector('#connect-status-body');
      if (st.connectStatus === 'active') {
        body.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;background:var(--brand-tint,#ecfdf5);color:#166534;padding:6px 12px;border-radius:999px;font-weight:600;font-size:12.5px">✓ Cobros con tarjeta activos</span>' +
          '<p style="font-size:12px;color:var(--muted);margin:8px 0 0">Tus clientes pagan con tarjeta y el dinero llega a tu cuenta de Stripe. Comisión YaQu: 0,9&nbsp;% por cobro.</p>';
        return;
      }
      const label = st.connectStatus === 'none'
        ? 'Activar cobros con tarjeta'
        : 'Continuar activación';
      body.innerHTML =
        '<p style="font-size:12.5px;color:var(--body);margin:0 0 10px">Actívalo en 2 minutos con tu DNI y tu IBAN. Tus clientes podrán pagar con tarjeta y el dinero va directo a tu cuenta (0,9&nbsp;% por cobro).</p>' +
        (st.connectStatus === 'restricted'
          ? '<p style="font-size:12px;color:#b45309;margin:0 0 10px">⚠ Stripe necesita algún dato más para activarte del todo.</p>' : '');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-primary';
      btn.textContent = label + ' · 2 min';
      btn.addEventListener('click', async () => {
        btn.disabled = true; btn.textContent = 'Abriendo Stripe…';
        try {
          const r = await apiRequest('/admin/connect/onboard', { method: 'POST' });
          if (r && r.url) { window.location.href = r.url; return; }
          throw new Error('Sin URL de onboarding');
        } catch (e) {
          btn.disabled = false; btn.textContent = label + ' · 2 min';
          showToast('No se pudo abrir la activación de Stripe. Inténtalo de nuevo.', 'error');
        }
      });
      body.appendChild(btn);
    })();

    // Separador visual — Automatizaciones
    fGoogleReviewUrl.input.placeholder = "https://g.page/r/tu-negocio/review";
    fGoogleReviewUrl.wrapper.querySelector("label").insertAdjacentHTML(
      "afterend",
      '<p style="font-size:12px;color:var(--muted);margin:2px 0 4px">Al recibir un pago, se enviará automáticamente un WhatsApp al cliente pidiéndole una reseña.</p>'
    );
    colocar("googleReviewUrl", fGoogleReviewUrl.wrapper);

    // Separador — Notificaciones por email
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
      textBlock.innerHTML = '<span style="font-weight:600;font-size:13.5px;color:var(--neutral-700)">' + labelText + '</span>' +
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
    previewBox.style.cssText = "display:none;margin:8px 0 0 24px;max-width:420px;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--neutral-50);padding:14px 16px";

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
        const fmt = (a, c) => fmtMoneyEs(a, c || (window.appLocale && window.appLocale.currency) || "EUR"); // P-A66-3
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

    colocar("notifyEmailOnPaid", tNotifyPaid.wrapper);
    colocar("notifyEmailOnQuoteAccepted", tNotifyAccepted.wrapper);
    colocar("notifyEmailWeeklyDigest", tNotifyWeekly.wrapper);

    // ── Enterprise: branding + aprobación (ENT-1, ENT-2) ──────────────────
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
    colocar("brand-color-input", fBrandWrapper);
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
      '<p style="font-size:12px;color:var(--muted);margin:2px 0 4px">Las cotizaciones de un operario por encima de este importe quedarán "pendientes de aprobación" hasta que un admin las apruebe.</p>'
    );
    colocar("approvalThreshold", fApproval.wrapper);

    const actions = document.createElement("div");
    actions.className = "form-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.className = "btn btn-primary btn-lg";
    saveBtn.textContent = "Guardar cambios";
  
    actions.appendChild(saveBtn);
    form.appendChild(actions);

    // SCRUM-284 · «WhatsApp este mes» dentro de AVISOS, pero FUERA del mapa y fuera del guard.
    // No es un ajuste ni un control: es un contador de consumo y no persiste nada. Por la regla del
    // fundador («un ajuste se guarda y persiste») no pertenece al mapa de campos — pero tiene que
    // vivir en algún sitio, y Avisos es donde encaja: habla de lo que se envía.
    renderWaFairUseCard(panelDeSuperficie("renderWaFairUseCard")); // A9.3: fair use W2 visible

    // SCRUM-314 (D3): hueco para «Eliminar datos de ejemplo». Nace VACÍO y solo se rellena en la
    // cuenta demo (lo decide el backend con `esCuentaDemo`), así que fuera del demo no ocupa nada
    // ni se ve — no hay botón deshabilitado que invite a preguntar por él.
    //
    // SCRUM-284 · POR QUÉ CUELGA DEL `form` Y NO DE UN PANEL. Su destino natural sería «Tus datos»
    // —es un acto sobre los datos de la cuenta—, pero el botón SOLO se pinta en la cuenta demo. Meterlo
    // ahí dejaría ese submenú vacío para todo el mundo menos el demo, y un submenú que aparece vacío
    // para el 99 % de los usuarios es peor que el hueco declarado que ya tiene. Cuando «Tus datos»
    // tenga contenido propio, se muda ahí. Queda en `SUPERFICIES_PROVISIONALES` con ese motivo.
    const huecoEjemplo = document.createElement("div");
    huecoEjemplo.id = "datos-ejemplo";
    huecoEjemplo.style.marginTop = "18px";
    form.appendChild(huecoEjemplo);

    // Y con todo colocado —incluido el hueco de arriba—, se enciende la navegación: pinta las diez
    // pestañas y deja visible la primera. Va EL ÚLTIMO a propósito: pintarla antes dejaría paneles a
    // medio llenar visibles durante el render.
    pintarNav();

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
        refreshLogoUI(); // preview del logo actual (URL antigua o data-URI)
        montarDatosDeEjemplo(merchant); // SCRUM-314 (D3)
        fGoogleReviewUrl.input.value = merchant.googleReviewUrl || "";
        fIban.input.value  = merchant.iban  || "";
        fClabe.input.value = merchant.clabe || "";
        fBizumPhone.input.value = merchant.bizumPhone || ""; // C1-4 (vacío = usa whatsappPhone)
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
        // A2.5: normalizar — si pegan "g.page/r/…" sin protocolo, anteponer https://
        googleReviewUrl: (function () {
          var v = fGoogleReviewUrl.input.value.trim();
          if (!v) return null;
          if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
          return v;
        })(),
        country: fCountrySelect.value || undefined,
        iban:  fIban.input.value.trim().replace(/\s/g, '') || null,
        clabe: fClabe.input.value.trim() || null,
        bizumPhone: fBizumPhone.input.value.trim() || null, // C1-4

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
  
// ── A9.3 · Fair use de WhatsApp visible (política W2 del master) ───────────
// "300 plantillas/mes de uso razonable — aviso, NUNCA corte". El contador sale
// del log J8 (solo cuentan las PLANTILLAS; lo que viaja por ventana es gratis
// y no computa). Transparencia: en demo responde a "¿y si mando muchos?".
async function renderWaFairUseCard(container) {
  const FAIR_USE = 300; // W2: soft, aviso, nunca corte
  let data;
  try { data = await apiRequest('/admin/metrics/whatsapp'); } catch { return; }
  const used = data?.month?.total ?? 0;
  const windowFree = data?.channel?.windowMonth ?? 0;
  const pct = Math.min(100, Math.round((used / FAIR_USE) * 100));
  const nearLimit = used >= FAIR_USE * 0.8;

  const card = document.createElement('div');
  card.className = 'customers-card';
  card.style.marginTop = '16px';
  card.innerHTML = `
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:var(--ink)">WhatsApp este mes</h2>
    <p style="margin:0 0 14px;font-size:13px;color:var(--neutral-400)">
      Tu plan incluye <strong>${FAIR_USE} plantillas/mes</strong> de uso razonable — si te acercas te avisamos, <strong>nunca cortamos</strong>.
    </p>
    <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">
      <span style="color:var(--neutral-600);font-weight:600">${used} de ${FAIR_USE} plantillas</span>
      <span style="color:var(--muted)">${pct}%</span>
    </div>
    <div style="background:var(--neutral-100);border-radius:6px;height:12px;overflow:hidden;margin-bottom:10px">
      <div style="width:${pct}%;height:100%;border-radius:6px;background:${nearLimit ? '#f59e0b' : 'var(--green-600)'}"></div>
    </div>
    ${nearLimit ? `<div class="alert warning" style="display:block;margin:0 0 10px;font-size:13px">Estás cerca del uso razonable de tu plan. No se corta nada — si tu volumen crece, hablamos.</div>` : ''}
    <p style="margin:0;font-size:12.5px;color:var(--muted)">
      Además, <strong>${windowFree}</strong> mensaje${windowFree === 1 ? '' : 's'} de este mes ${windowFree === 1 ? 'ha viajado' : 'han viajado'} por la ventana de 24 h — gratis y sin computar aquí.
    </p>
  `;
  container.appendChild(card);
}

// ── A18.5 · Checklist de readiness (Parte M, AB4 Configuración) ─────────────
// Estados CLAROS de lo que desbloquea cada cosa: WhatsApp, cobro (IBAN/Bizum),
// tarjeta (Connect) y datos fiscales. Copys del master M — jamás "factura" sin
// datos fiscales: el documento es un justificante de cobro.
async function renderReadinessCard(container, mainFormCard) {
  let m;
  try { m = await apiRequest('/admin/merchant'); } catch { return; }
  if (m.slug === undefined) return; // perfil reducido (Operario) → sin checklist

  const card = document.createElement('div');
  card.className = 'customers-card';
  card.style.marginTop = '0';
  container.insertBefore(card, container.firstChild);

  const chargeReady = !!(m.iban || m.bizumPhone);
  const fiscalReady = !!(m.legalName && m.taxId && m.address);
  const connect = String(m.connectStatus || 'none');

  const rows = [
    {
      ok: !!m.whatsappPhone,
      label: 'Presupuestos por WhatsApp',
      okText: 'Listo — tus presupuestos salen por WhatsApp',
      koText: 'Añade tu teléfono de WhatsApp para enviar presupuestos',
      focus: 'whatsappPhone',
    },
    {
      ok: chargeReady,
      label: 'Cobro por transferencia o Bizum',
      okText: m.iban && m.bizumPhone ? 'IBAN y Bizum configurados' : (m.iban ? 'IBAN configurado' : 'Bizum configurado'),
      koText: 'Añade tu IBAN o tu Bizum para que te puedan pagar',
      focus: 'iban',
    },
    {
      ok: connect === 'active',
      warn: connect === 'pending' || connect === 'restricted',
      label: 'Cobros con tarjeta',
      okText: 'Stripe activo — tus clientes pueden pagar con tarjeta',
      warnText: connect === 'pending' ? 'Verificación en curso en Stripe' : 'Cuenta restringida — revisa Stripe',
      koText: 'Activar cobros con tarjeta · 2 min, DNI e IBAN',
      scrollConnect: true,
    },
    {
      ok: fiscalReady,
      label: 'Datos fiscales',
      okText: 'Completos — listos para facturar cuando toque',
      koText: 'Sin ellos, el documento tras el pago es un justificante de cobro',
      focus: 'taxId',
    },
  ];

  const done = rows.filter((r) => r.ok).length;
  card.innerHTML = `
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:var(--ink)">Tu cuenta, lista para cobrar</h2>
    <p style="margin:0 0 14px;font-size:13px;color:var(--neutral-400)">${done} de ${rows.length} en verde. Cada punto te dice qué desbloquea.</p>
    <div id="readiness-rows" style="display:flex;flex-direction:column;gap:8px"></div>
  `;
  const box = card.querySelector('#readiness-rows');
  rows.forEach((r) => {
    const state = r.ok ? 'ok' : r.warn ? 'warn' : 'ko';
    const row = document.createElement('button');
    row.type = 'button';
    row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:11px 14px;min-height:44px;'
      + 'border:1px solid var(--border);border-radius:10px;background:'
      + (state === 'ok' ? 'var(--brand-tint,#ecfdf5)' : '#fff')
      + ';cursor:pointer;text-align:left;font:inherit;width:100%';
    row.innerHTML = `
      <span style="flex:none;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:800;color:#fff;background:${state === 'ok' ? 'var(--green-600,#16a34a)' : state === 'warn' ? '#f59e0b' : 'var(--neutral-300,#cdd2cb)'}">${state === 'ok' ? '✓' : state === 'warn' ? '…' : '·'}</span>
      <span style="min-width:0">
        <span style="display:block;font-size:13.5px;font-weight:600;color:var(--ink)">${r.label}</span>
        <span style="display:block;font-size:12.5px;color:${state === 'ko' ? 'var(--neutral-600)' : 'var(--muted)'}">${r.ok ? r.okText : r.warn ? r.warnText : r.koText}</span>
      </span>
      ${r.ok ? '' : '<span style="margin-left:auto;flex:none;font-size:12.5px;font-weight:600;color:var(--green-700,#15803d)">Completar →</span>'}
    `;
    row.addEventListener('click', () => {
      if (r.scrollConnect) {
        const h2s = [...document.querySelectorAll('h2')];
        const c = h2s.find((h) => /tarjeta|Stripe|Connect/i.test(h.textContent));
        (c ? c.closest('.customers-card') || c : mainFormCard).scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const input = mainFormCard.querySelector(`[name="${r.focus}"]`);
      if (input) { input.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => input.focus(), 350); }
      else mainFormCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    box.appendChild(row);
  });
}

// ── A14.1 · PERFIL-1: tu página pública /p/:slug (master Parte R) ──────────
// Solo muestra lo PÚBLICO (nombre, gremio, zonas, años, botón de WhatsApp);
// jamás precios/clientes/email/NIF. El flag lo activa YaQu (merchant opt-in F2).
async function renderPublicProfileCard(container) {
  let m;
  try { m = await apiRequest('/admin/merchant'); } catch { return; }
  if (m.slug === undefined) return; // rol sin acceso (el perfil reducido no trae slug)

  const card = document.createElement('div');
  card.className = 'customers-card';
  card.style.marginTop = '16px';
  container.appendChild(card);

  const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
  const enabled = !!m.publicProfileEnabled;

  function nextChangeDate(slugChangedAt) {
    if (!slugChangedAt) return null;
    const next = new Date(new Date(slugChangedAt).getTime() + COOLDOWN_MS);
    return next.getTime() > Date.now() ? next : null;
  }

  function paint() {
    const locked = nextChangeDate(m.slugChangedAt);
    const zonesText = Array.isArray(m.profileZones) ? m.profileZones.join(', ') : '';
    card.innerHTML = `
      <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:var(--ink)">Tu página pública</h2>
      <p style="margin:0 0 14px;font-size:13px;color:var(--neutral-400)">
        La página que ve quien escanea tu QR o abre tu enlace: tu nombre, tu gremio, tus zonas
        y un botón para pedirte presupuesto por WhatsApp. Nada de precios ni datos de clientes.
      </p>
      ${enabled
        ? (m.slug
          ? `<div class="alert success" style="display:block;margin:0 0 14px;font-size:13px">Tu página está <strong>activa</strong>: <a href="/p/${escSettings(m.slug)}" target="_blank" rel="noopener">yaqu.app/p/${escSettings(m.slug)} ↗</a></div>`
          : `<div class="alert warning" style="display:block;margin:0 0 14px;font-size:13px">Elige una dirección para estrenar tu página.</div>`)
        : `<div class="alert" style="display:block;margin:0 0 14px;font-size:13px;background:var(--neutral-50);border:1px solid var(--border);color:var(--neutral-600)">Aún no está activada — déjala lista y la encendemos contigo.</div>`}
      <div class="field" style="margin-bottom:12px">
        <label>Dirección de tu página</label>
        <div style="display:flex;align-items:center;gap:0">
          <span style="padding:11px 10px;border:1px solid var(--border);border-right:none;border-radius:10px 0 0 10px;background:var(--neutral-50);font-size:13px;color:var(--muted);white-space:nowrap">yaqu.app/p/</span>
          <input id="pp-slug" type="text" value="${escSettings(m.slug || '')}" ${locked ? 'disabled' : ''}
            placeholder="fontaneria-garcia" autocapitalize="none" autocorrect="off" spellcheck="false"
            style="flex:1;min-width:0;border-radius:0 10px 10px 0;border:1px solid var(--border);padding:11px 13px;font-size:14px"/>
        </div>
        <p style="font-size:12px;color:var(--muted);margin:4px 0 0">
          ${locked
            ? 'Podrás cambiarla de nuevo el ' + locked.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) + '.'
            : 'Solo minúsculas, números y guiones (3-40). Se puede cambiar una vez cada 30 días.'}
        </p>
      </div>
      <div class="field" style="margin-bottom:12px">
        <label>Zonas donde trabajas</label>
        <input id="pp-zones" type="text" value="${escSettings(zonesText)}" placeholder="Chamberí, Tetuán, Centro"/>
        <p style="font-size:12px;color:var(--muted);margin:4px 0 0">Separa las zonas con comas (máx. 12).</p>
      </div>
      <div class="field" style="margin-bottom:14px;max-width:220px">
        <label>Años de experiencia (opcional)</label>
        <input id="pp-years" type="number" min="0" max="80" value="${m.profileYears != null ? m.profileYears : ''}"/>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button id="pp-save" class="btn btn-primary btn-sm">Guardar página</button>
        <span id="pp-qr-slot"></span>
        <span id="pp-msg" style="font-size:12.5px;color:var(--muted)"></span>
      </div>
    `;

    const msg = card.querySelector('#pp-msg');
    card.querySelector('#pp-save').addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      const slugVal = card.querySelector('#pp-slug').value.trim().toLowerCase();
      const zones = card.querySelector('#pp-zones').value.split(',').map((z) => z.trim()).filter(Boolean).slice(0, 12);
      const yearsRaw = card.querySelector('#pp-years').value.trim();
      if (slugVal && !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slugVal)) {
        msg.style.color = 'var(--red-600)';
        msg.textContent = 'La dirección solo puede llevar minúsculas, números y guiones (3-40).';
        return;
      }
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        const updated = await updateMerchantProfile({
          slug: slugVal || null,
          profileZones: zones,
          profileYears: yearsRaw === '' ? null : Number(yearsRaw),
        });
        m = Object.assign({}, m, {
          slug: updated.slug, slugChangedAt: updated.slugChangedAt,
          profileZones: updated.profileZones, profileYears: updated.profileYears,
        });
        paint();
        const okMsg = card.querySelector('#pp-msg');
        okMsg.style.color = 'var(--green-700)';
        okMsg.textContent = '✓ Guardado.';
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Guardar página';
        msg.style.color = 'var(--red-600)';
        msg.textContent = (e && e.data && e.data.message) || 'No se pudo guardar. Inténtalo de nuevo.';
      }
    });

    renderProfileQrButton(card, m); // A14.2: QR furgoneta/tarjeta
  }

  paint();
}

// ── A14.2 · QR de la página pública (PNG 1024px → /p/:slug?src=qr) ─────────
// Para imprimir en la furgoneta o la tarjeta: quien lo escanea ve la página y,
// si acaba registrándose en YaQu, queda atribuido (acquisitionSource='qr').
// SCRUM-230 · TODO EL TEXTO NUEVO DE ESTA TARJETA EN UN SOLO SITIO, para que sustituirlo sea
// cambiar este bloque y nada más.
//
// `ayudaSvg` y `errorGenerico` los APROBÓ el fundador el 29-jul-2026 (regla 30): NO se
// reformulan. Las demás claves siguen marcadas abajo como pendientes.
const QR_COPY = {
  // [PENDIENTE microcopy oficial] — etiquetas de los tres selectores, aún sin aprobar.
  formato: 'Formato',
  tamano: 'Tamaño',
  color: 'Color',
  colorNegro: 'Negro',
  colorMarca: 'Color de marca',
  descargar: '⬇ Descargar QR',
  // APROBADOS (fundador, 29-jul-2026) — literales, no se tocan:
  ayudaSvg: 'Elige SVG si vas a imprimirlo grande (furgoneta, cartel): no se pixela.',
  errorGenerico: 'No hemos podido generar el QR con esas opciones. Prueba a cambiar el color o el tamaño.',
};

function renderProfileQrButton(card, m) {
  const slot = card.querySelector('#pp-qr-slot');
  if (!slot) return;
  if (!m.slug) { slot.innerHTML = ''; return; }

  // SCRUM-230: antes esto era un enlace de descarga a secas — el pro pedía y le caía un PNG,
  // sin verlo. No podía juzgar si le servía para la furgoneta, la tarjeta o el escaparate.
  slot.innerHTML = `
    <div class="qr-personalizar">
      <div class="qr-preview"><img id="qr-img" alt="" width="180" height="180"></div>
      <div class="qr-controles">
        <label class="qr-campo"><span>${QR_COPY.formato}</span>
          <select id="qr-formato" class="input">
            <option value="png">PNG</option>
            <option value="svg">SVG</option>
          </select>
        </label>
        <label class="qr-campo"><span>${QR_COPY.tamano}</span>
          <select id="qr-size" class="input">
            <option value="512">512 px</option>
            <option value="1024" selected>1024 px</option>
            <option value="2048">2048 px</option>
          </select>
        </label>
        <label class="qr-campo"><span>${QR_COPY.color}</span>
          <select id="qr-dark" class="input">
            <option value="">${QR_COPY.colorNegro}</option>
            <option value="marca">${QR_COPY.colorMarca}</option>
          </select>
        </label>
        <p class="qr-ayuda">${QR_COPY.ayudaSvg}</p>
        <p class="qr-error" id="qr-error" hidden></p>
        <a class="btn btn-secondary btn-sm qr-descargar" id="qr-descargar">${QR_COPY.descargar}</a>
      </div>
    </div>`;

  const img = slot.querySelector('#qr-img');
  const err = slot.querySelector('#qr-error');
  const enlace = slot.querySelector('#qr-descargar');
  const campos = ['qr-formato', 'qr-size', 'qr-dark'].map((id) => slot.querySelector('#' + id));

  function query(extra) {
    const p = new URLSearchParams();
    const [formato, size, dark] = campos.map((c) => c.value);
    if (formato) p.set('formato', formato);
    if (size) p.set('size', size);
    if (dark) p.set('dark', dark);
    Object.entries(extra || {}).forEach(([k, v]) => p.set(k, v));
    return p.toString();
  }

  async function refrescar() {
    // La previsualización siempre en PNG: un <img> con SVG del servidor no aporta nada aquí y
    // el formato solo cambia lo que se DESCARGA.
    const url = '/admin/merchant/public-profile-qr?' + query({ preview: '1', formato: 'png' });
    err.hidden = true;
    try {
      const r = await fetch(url);
      if (!r.ok) {
        // El backend devuelve el motivo (contraste_insuficiente, qr_invertido…) con su mensaje:
        // se muestra ESE, no uno inventado aquí. [PENDIENTE microcopy oficial] solo el fallback.
        const cuerpo = await r.json().catch(() => null);
        err.textContent = (cuerpo && cuerpo.message) || QR_COPY.errorGenerico;
        err.hidden = false;
        img.removeAttribute('src');
        return;
      }
      const blob = await r.blob();
      img.src = URL.createObjectURL(blob);
    } catch {
      err.textContent = QR_COPY.errorGenerico;
      err.hidden = false;
    }
    enlace.href = '/admin/merchant/public-profile-qr?' + query();
    enlace.setAttribute('download', `yaqu-qr-${escSettings(m.slug)}.${campos[0].value || 'png'}`);
  }

  campos.forEach((c) => c.addEventListener('change', refrescar));
  refrescar();
}

// ── Tarjeta de Referidos (Sprint REFERRAL) ────────────────────────────────
async function renderReferralCard(container) {
  const card = document.createElement("div");
  card.className = "customers-card";
  card.style.marginTop = "16px";
  card.innerHTML = `
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:var(--ink)">Invita y gana meses gratis 🎁</h2>
    <p style="margin:0 0 16px;font-size:13px;color:var(--neutral-400)">Por cada profesional que se suscriba con tu enlace, recibes 1 mes gratis.</p>
    <div style="color:var(--neutral-400);font-size:13px">Cargando…</div>
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
    <p style="margin:0 0 16px;font-size:13px;color:var(--neutral-400)">Por cada profesional que se suscriba con tu enlace, recibes 1 mes gratis.</p>

    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
      <input id="ref-link" type="text" readonly value="${escSettings(data.link)}"
        style="flex:1;min-width:220px;padding:11px 13px;border:1px solid var(--border);border-radius:10px;font-size:13px;background:var(--neutral-50);color:var(--body)"/>
      <button id="ref-copy" class="btn btn-primary btn-sm" style="white-space:nowrap">Copiar link</button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px">
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


// ── SCRUM-314 (D3) · «Eliminar datos de ejemplo» ────────────────────────────────────────────
//
// SOLO se pinta en la cuenta demo, y el veredicto lo da el backend (`esCuentaDemo`, derivado de
// `isDemoMerchant`): la interfaz no reimplementa el criterio con un `id === 1`.
//
// Y no es cosmético: medido al construirlo, el registro NO siembra datos de ejemplo y no hay
// marca por fila que distinga sembrado de real. En una cuenta de verdad este botón borraría
// datos REALES bajo un rótulo que dice «de ejemplo». Por eso no se pinta, y la ruta lo rechaza
// además por su cuenta.
//
// Los cuatro textos son los APROBADOS por el fundador (regla 30) y van literales.
function montarDatosDeEjemplo(merchant) {
  const hueco = document.getElementById('datos-ejemplo');
  if (!hueco) return;
  hueco.innerHTML = '';
  if (!merchant || !merchant.esCuentaDemo) return; // fuera del demo, ni existe

  const btn = document.createElement('button');
  btn.className = 'btn-secondary';
  btn.type = 'button';
  btn.textContent = 'Eliminar datos de ejemplo';
  const salida = document.createElement('div');
  salida.style.cssText = 'margin-top:10px;font-size:13px';
  hueco.append(btn, salida);

  btn.addEventListener('click', () => {
    // CONFIRMACIÓN EXPLÍCITA. Es irreversible, y un aviso que no detiene nada solo cambia dónde
    // aparece el destrozo (SCRUM-260): por eso el borrado cuelga del botón de confirmar, no de éste.
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    // Plantilla en un template literal, que es UNA de las tres formas que el censo de SCRUM-350
    // sabe leer. Con concatenación el pie existía pero sus botones eran invisibles para ese guard
    // — y un pie que el censo ve a medias es un modal que su arreglo de CSS no cubre.
    overlay.innerHTML = `
      <div class="modal" style="max-width:460px" role="dialog" aria-modal="true" aria-labelledby="de-t">
        <div class="modal-header">
          <h3 class="modal-title" id="de-t">Eliminar datos de ejemplo</h3>
          <button class="modal-close" id="de-x" aria-label="Cerrar">&times;</button>
        </div>
        <div class="modal-body">
          <p>Vamos a borrar los clientes, presupuestos y facturas de ejemplo. Esto no se puede deshacer.</p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="de-no" type="button">Cancelar</button>
          <button class="btn-primary" id="de-si" type="button">Sí, eliminar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const cerrar = () => overlay.remove();
    overlay.querySelector('#de-x').addEventListener('click', cerrar);
    overlay.querySelector('#de-no').addEventListener('click', cerrar);
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) cerrar(); });

    overlay.querySelector('#de-si').addEventListener('click', async () => {
      const si = overlay.querySelector('#de-si');
      si.disabled = true; si.textContent = 'Eliminando…';
      try {
        const r = await apiRequest('/admin/datos-ejemplo/eliminar', { method: 'POST' });
        cerrar();
        // DICE QUÉ BORRÓ: el usuario tiene que poder COMPROBAR que su cuenta está limpia, no
        // creérselo. Un «listo» a secas es indistinguible de un borrado a medias.
        salida.textContent =
          'Listo. Hemos eliminado ' + (r.clientes || 0) + ' clientes, ' + (r.presupuestos || 0) +
          ' presupuestos y ' + (r.facturas || 0) + ' facturas de ejemplo.';
        // Y SI FALLÓ A MEDIAS, LO DICE. Una cuenta medio limpia que se anuncia limpia es el fallo
        // mudo que este ticket existe para evitar.
        if (r.ok === false) {
          const aviso = document.createElement('div');
          aviso.className = 'alert warning';
          aviso.style.marginTop = '8px';
          aviso.textContent =
            'No se pudo terminar: quedan datos sin borrar (' + (r.noBarridos || []).join(', ') + ').';
          salida.appendChild(aviso);
        }
      } catch (e) {
        cerrar();
        salida.textContent = 'No se pudo eliminar: ' + (e?.data?.message || e.message);
      }
    });
  });
}

function escSettings(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
