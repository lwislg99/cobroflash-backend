// public/dashboard/js/quotesView.js

// VZ-3: si la descripción del presupuesto entró por VOZ (modal Sugerir con IA),
// el create lleva created_via='voice' (telemetría V0-3). Se resetea por render.
let quoteFormCreatedVia = 'text';

/**
 * SCRUM-140: `template` llega como ARGUMENTO EXPLÍCITO (antes por
 * `sessionStorage['pf_load_template']`, un canal global e implícito).
 *
 * Lo que desaparece al hacerlo así, y no por defenderse mejor:
 *   · el ORDEN deja de ser una variable — no hay "escribe antes de navegar" que respetar
 *     (el off-by-one de SCRUM-134 era exactamente eso);
 *   · no hay estado residual que consumir → no existe la plantilla HUÉRFANA;
 *   · sobra el sello de frescura `_ts` y su umbral de 15 s, que era una heurística temporal
 *     (una navegación lenta podía descartar una plantilla legítima);
 *   · el acoplamiento queda VISIBLE en la firma: antes nada decía que el contenido de esta
 *     vista podía venir de otra.
 *
 * `null`/omitido = presupuesto en blanco. Es de un solo uso: no se guarda en `window.appState`.
 */
function renderQuotesView(container, template) {
  container.innerHTML = "";
  quoteFormCreatedVia = 'text';

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

  // SCRUM-446: cabecera del constructor compartido. SIN botón de cierre: hoy no lo tiene, y este
  // refactor no decide comportamiento — si su ausencia era deliberada se respeta, y si fue descuido
  // es otro ticket con su propia víctima.
  const mHeader = cabeceraModal({ titulo: `Presupuesto #${displayNum} generado`, sinCierre: true });
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
        // SCRUM-126: hallado en el barrido — este botón (distinto del de la línea ~280)
        // miraba body.ok, que ya no es la señal del envío. waSendFailed mira sent.
        if (!waSendFailed(body)) {
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
        // P3-2: si Meta rechazó, el backend devuelve 200 + sent:false con un mensaje claro.
        if (!waSendFailed(body)) {
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

  // ---------- SCRUM-286 (B3): LOS CUATRO BLOQUES, EN ORDEN DE DECISIÓN ----------
  // Antes había UN bloque —«Datos del cliente»— con SIETE controles de CUATRO asuntos distintos:
  // el cliente, el IVA por defecto, las condiciones de pago (con sus tramos y la caducidad) y el
  // envío (formas de pago y datos del documento). El título mentía sobre su contenido, y seis de
  // esos controles se pintaban ENTRE el cliente y las líneas. El orden es ahora el de la decisión
  // humana: a quién · qué · cómo se paga · cómo se envía.
  //
  // 🔴 LOS CONTENEDORES SE CREAN AQUÍ, TODOS, Y EN ORDEN. El orden del DOM lo fija el orden en
  // que los bloques se cuelgan de `leftCard`, NO el orden en que se rellenan. Por eso el código
  // que construye cada campo se queda EXACTAMENTE donde estaba y sólo cambia su destino: mover
  // código es donde se pierde un campo en silencio, y ese es el fallo mudo de este ticket.
  //
  // 🔴 MICROCOPY SIN APROBAR (regla 30): los títulos los aprueba el fundador. Hasta entonces
  // salen con el marcador, igual que SCRUM-284 (B1). Un rótulo «que suena bien» sin marcador es
  // microcopy colada por la puerta de atrás.
  // ⚠️ Los cuatro se escriben ENTEROS, sin una factoría `crearBloque()`, y es a propósito: el
  // censo de orden (`tests/_orden-pintado-presupuesto.mjs`) deriva el esqueleto estático como
  // «los `appendChild` que NO están dentro de una función anidada». Una factoría metería el
  // `leftCard.appendChild` dentro de una función y el censo dejaría de ver el formulario —
  // habría que retocar el censo para que aceptase justo esta forma, que es medir contra lo que
  // uno acaba de escribir. Se paga la repetición y el censo sigue siendo independiente.
  // `TITULO_PENDIENTE` se BORRA el 17-ago-2026: el fundador aprobó los cuatro títulos de bloque y
  // la fábrica se quedó sin consumidores. Un marcador sin usar es el que alguien vuelve a enchufar.

  const blockClient = document.createElement("div");
  blockClient.className = "quote-block";
  leftCard.appendChild(blockClient);
  const blockClientTitle = document.createElement("h3");
  blockClientTitle.className = "quote-block-title";
  blockClientTitle.textContent = "1. Cliente";
  blockClient.appendChild(blockClientTitle);

  const blockLines = document.createElement("div");
  blockLines.className = "quote-block";
  leftCard.appendChild(blockLines);
  const blockLinesTitle = document.createElement("h3");
  blockLinesTitle.className = "quote-block-title";
  blockLinesTitle.textContent = "2. Líneas";
  blockLines.appendChild(blockLinesTitle);

  const blockConditions = document.createElement("div");
  blockConditions.className = "quote-block";
  leftCard.appendChild(blockConditions);
  const blockConditionsTitle = document.createElement("h3");
  blockConditionsTitle.className = "quote-block-title";
  blockConditionsTitle.textContent = "3. Condiciones";
  blockConditions.appendChild(blockConditionsTitle);

  const blockDelivery = document.createElement("div");
  blockDelivery.className = "quote-block";
  leftCard.appendChild(blockDelivery);
  const blockDeliveryTitle = document.createElement("h3");
  blockDeliveryTitle.className = "quote-block-title";
  blockDeliveryTitle.textContent = "4. Envío";
  blockDelivery.appendChild(blockDeliveryTitle);

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
  // SCRUM-286: el IVA por defecto NO es un dato del cliente — es el que se aplica a cada línea
  // nueva (`addLine` lo lee como reserva, L~2068/2261). Su sitio es el bloque de Líneas, delante
  // de ellas. Va en su propia `quote-form-row` para conservar el ancho de un tercio que ya tenía:
  // no es un cambio de tamaño disfrazado de reordenado.
  const linesVatRow = document.createElement("div");
  linesVatRow.className = "quote-form-row";
  blockLines.appendChild(linesVatRow);
  linesVatRow.appendChild(fieldVatDefault.wrapper);

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

// SCRUM-286: «Incluir descripción en el PDF» decide QUÉ VE EL CLIENTE en el documento — misma
// familia que `docFields`. Va al bloque de Envío, no al del cliente.
blockDelivery.appendChild(descWrapper);

  
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

    // SCRUM-27: plan de cobro personalizado por tramos. Valor "CUSTOM" es marcador de front:
    // el payload manda paymentTerms:null + customBillingPlan con los tramos.
    const optCustom = document.createElement("option");
    optCustom.value = "CUSTOM";
    optCustom.textContent = "Plan personalizado (por tramos)";
    paymentSelect.appendChild(optCustom);
  
    // Valor por defecto para el MVP
    paymentSelect.value = "FULL_UPFRONT";

    blockConditions.appendChild(fieldPaymentTerms.wrapper);

    // ---------- SCRUM-27: EDITOR DE TRAMOS PERSONALIZADOS (oculto salvo "Personalizado") ----------
    // Clona el patrón addLine/lines[]: filas {etiqueta, %}, añadir/quitar, recolectar a un array,
    // suma en vivo con aviso "deben sumar 100 %". Reutiliza .input/.btn/.btn-icon (sin CSS nueva).
    const stagesWrapper = document.createElement("div");
    stagesWrapper.style.cssText = "display:none;margin-top:10px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)";
    const stagesHeader = document.createElement("div");
    stagesHeader.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px";
    stagesHeader.innerHTML = '<span style="font-size:13px;font-weight:700;color:var(--ink)">Tramos de cobro</span>';
    const addStageBtn = document.createElement("button");
    addStageBtn.type = "button";
    addStageBtn.className = "btn btn-secondary btn-sm";
    addStageBtn.textContent = "+ Añadir tramo";
    stagesHeader.appendChild(addStageBtn);
    stagesWrapper.appendChild(stagesHeader);
    const stagesRows = document.createElement("div");
    stagesRows.style.cssText = "display:flex;flex-direction:column;gap:8px";
    stagesWrapper.appendChild(stagesRows);
    const stagesSum = document.createElement("div");
    stagesSum.style.cssText = "margin-top:8px;font-size:12.5px;font-weight:600";
    stagesWrapper.appendChild(stagesSum);

    const stages = []; // { row, labelInput, pctInput }

    function recalcStagesSum() {
      const total = stages.reduce((s, st) => s + (parseFloat(String(st.pctInput.value).replace(",", ".")) || 0), 0);
      const ok = Math.round(total * 100) === 10000; // 100,00 exacto en enteros
      stagesSum.textContent = ok
        ? `Suman ${Math.round(total * 100) / 100} % ✓`
        : `Suman ${Math.round(total * 100) / 100} % — deben sumar 100 %`;
      stagesSum.style.color = ok ? "var(--green-600)" : "var(--danger)";
    }

    function addStage(initial) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;align-items:center";
      const labelInput = document.createElement("input");
      labelInput.type = "text";
      labelInput.className = "input";
      labelInput.placeholder = "Etiqueta (p. ej. Anticipo)";
      labelInput.style.cssText = "flex:1;min-width:0";
      labelInput.value = (initial && initial.label) || "";
      const pctInput = document.createElement("input");
      pctInput.type = "number";
      pctInput.min = "0";
      pctInput.step = "1";
      pctInput.className = "input";
      pctInput.placeholder = "%";
      pctInput.style.cssText = "width:84px";
      pctInput.value = (initial && initial.pct != null) ? initial.pct : "";
      const rmBtn = document.createElement("button");
      rmBtn.type = "button";
      rmBtn.className = "btn-icon";
      rmBtn.title = "Eliminar tramo";
      rmBtn.textContent = "🗑️";
      row.appendChild(labelInput);
      row.appendChild(pctInput);
      row.appendChild(rmBtn);
      stagesRows.appendChild(row);
      const stageObj = { row, labelInput, pctInput };
      stages.push(stageObj);
      const onInput = () => { recalcStagesSum(); scheduleDraftSave(); };
      labelInput.addEventListener("input", onInput);
      pctInput.addEventListener("input", onInput);
      rmBtn.addEventListener("click", () => {
        const i = stages.indexOf(stageObj);
        if (i >= 0) stages.splice(i, 1);
        row.remove();
        recalcStagesSum();
        scheduleDraftSave();
      });
      recalcStagesSum();
    }

    // Recolecta los tramos como el backend los espera: percentage en FRACCIÓN 0-1 (como los
    // presets [0.5,0.5]) + etiqueta trim. La suma-100% / etiqueta / %>0 se revalida en el server.
    function collectCustomStages() {
      return stages.map((s) => ({
        percentage: (parseFloat(String(s.pctInput.value).replace(",", ".")) || 0) / 100,
        label: (s.labelInput.value || "").trim(),
      }));
    }
    // SCRUM-37: delega en `planTramosEstado` (api.js) en vez de llevar su propia aritmética.
    // Antes esta función era una SEGUNDA copia de la regla del servidor, y el editor de
    // SCRUM-37 iba a ser la tercera. Cada copia es una que puede separarse del backend sin que
    // nadie lo note — el patrón de `vat_default` y de SCRUM-141. Ahora hay UNA, y un test
    // diferencial la compara contra el dominio (`scrum37-plan-front-vs-back`).
    function customStagesValid() {
      return planTramosEstado(collectCustomStages(), 0).ok;
    }

    addStageBtn.addEventListener("click", () => addStage());
    blockConditions.appendChild(stagesWrapper);

    // ---------- A16.2: CADUCIDAD (validUntil, default 30 días) ----------
    const validWrapper = document.createElement("div");
    validWrapper.className = "field";
    const validLabel = document.createElement("label");
    validLabel.textContent = "Válido hasta";
    const validInput = document.createElement("input");
    validInput.type = "date";
    validInput.id = "quote-valid-until";
    // ── SCRUM-630: el valor por defecto, en DÍAS DE CALENDARIO ──────────────────────────
    // Hasta hoy era `new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10)`, y eso
    // tiene dos costuras: `86400000` supone que TODOS los días duran 24 h —falso en los dos
    // cambios de hora— y `toISOString()` formatea en UTC, así que en Madrid una hora local
    // temprana cae en el día anterior. MEDIDO al romper SCRUM-605 a propósito: el 31 de marzo
    // + 30 días daba el 29 de abril en vez del 30.
    //
    // 🔴 SE REUTILIZA la primitiva de los atajos (`quoteAtajosVencimiento.js`), NO se escribe
    // una segunda: el defecto de familia de 617/620/625/627/629 es exactamente ese —existe una
    // primitiva y alguien no la usa—. Así el valor por defecto y el atajo de «30» no pueden
    // volver a dar días distintos: salen de la misma función.
    //
    // Si la primitiva no estuviera, el campo se queda SIN valor por defecto en vez de escribir
    // una fecha calculada de otra manera. Es deliberado: un campo vacío es un fallo VISIBLE y
    // una fecha mal calculada es uno SILENCIOSO, y este campo acaba impreso en un documento.
    // El orden de carga que lo garantiza está fijado por `scrum630-default-en-dias.test.mjs`.
    const atajosVencDefecto = (typeof window !== 'undefined' && window.QUOTE_ATAJOS_VENCIMIENTO) || null;
    validInput.value = atajosVencDefecto ? atajosVencDefecto.fechaDeAtajo(30) : '';
    validInput.min = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const validNote = document.createElement("p");
    validNote.style.cssText = "font-size:12px;color:var(--muted);margin:4px 0 0";
    validNote.textContent = "Pasada esta fecha el presupuesto caduca solo y el cliente verá \"pide uno actualizado\".";
    validWrapper.appendChild(validLabel);
    validWrapper.appendChild(validInput);

    // ---------- SCRUM-605 (DOC-15): ATAJOS DE VENCIMIENTO ----------
    // Hasta hoy la única forma de poner la fecha era el calendario nativo. Los atajos escriben
    // el valor y ya está: NO se toca el `value` por defecto (+30 d) ni el `min` (+1 d), porque
    // quien no pulse nada tiene que ver exactamente lo de antes.
    //
    // La aritmética NO vive aquí: está en `quoteAtajosVencimiento.js`, en funciones puras, para
    // poder exigirle los bordes que muerden en fechas —fin de mes, cambio de año, bisiesto— que
    // desde este fichero no se pueden probar (`node:test` no puede importar una vista).
    //
    // 🔴 AB3: se REUTILIZA la fila de fichas de F6 (`quote-plantillas` + `quote-plantilla-chip`),
    // que ya trae los 44 px de objetivo táctil y el anillo de foco de AB6. Cero CSS nuevo y cero
    // estilos en línea.
    //
    // Si el script no hubiera cargado, no se pinta nada y el campo queda como estaba: un atajo
    // que falta es peor que ninguno sólo si además rompe el campo.
    const atajosVenc = (typeof window !== 'undefined' && window.QUOTE_ATAJOS_VENCIMIENTO) || null;
    if (atajosVenc) {
      const atajosFila = document.createElement("div");
      atajosFila.className = "quote-plantillas";
      atajosVenc.DIAS_ATAJO.forEach(function (dias) {
        const chip = document.createElement("button");
        // `type=button` es obligatorio: sin él, dentro del <form>, el clic ENVIARÍA el
        // presupuesto. Mismo motivo que el segundo «+ Añadir línea» (SCRUM-133).
        chip.type = "button";
        chip.className = "quote-plantilla-chip";
        const rotulo = atajosVenc.rotuloDeAtajo(dias);
        const nombre = document.createElement("span");
        nombre.className = "quote-plantilla-chip__nombre";
        nombre.textContent = rotulo;
        chip.appendChild(nombre);
        chip.setAttribute("aria-label", rotulo);
        chip.addEventListener("click", function () {
          const fecha = atajosVenc.fechaDeAtajo(dias);
          // Si no se puede calcular no se escribe NADA: mejor que el campo se quede como está
          // que meterle una fecha inventada en un documento que el cliente va a recibir.
          if (fecha) validInput.value = fecha;
        });
        atajosFila.appendChild(chip);
      });
      validWrapper.appendChild(atajosFila);
    }

    validWrapper.appendChild(validNote);
    blockConditions.appendChild(validWrapper);

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
    // Bug fundador (8-jul): mostrar la comisión de tarjeta (0,9 %, APPLICATION_FEE_BPS).
    // Mismo copy que Planes/Configuración: Bizum y transferencia son gratis.
    const pmFee = document.createElement("p");
    pmFee.className = "pay-methods-note";
    pmFee.innerHTML = "💳 La tarjeta lleva una comisión del <strong>0,9 %</strong> por cobro. Bizum y transferencia, gratis.";
    payMethodsWrapper.appendChild(pmFee);
    blockDelivery.appendChild(payMethodsWrapper);

    // Devuelve el array para el payload, o undefined si están todas (= sin límite)
    function selectedPayMethods() {
      const sel = pmDefs.filter(function (d) { return pmChecks[d.key].checked; }).map(function (d) { return d.key; });
      if (sel.length === 0 || sel.length === pmDefs.length) return undefined;
      return sel;
    }

    // A20.4 (PV-FIX-CAMPOS): qué datos del cliente se MUESTRAN en el documento.
    // Default: todos marcados (comportamiento de siempre; solo salen si existen).
    const docFieldsWrapper = document.createElement("div");
    docFieldsWrapper.className = "field";
    docFieldsWrapper.innerHTML =
      '<label class="pay-methods-title">Datos del cliente en el documento</label>';
    const dfRow = document.createElement("div");
    dfRow.className = "pay-methods-row";
    const dfDefs = [
      { key: "name", label: "Nombre" },
      { key: "phone", label: "Teléfono" },
      { key: "taxId", label: "NIF" },
      { key: "email", label: "Email" },
    ];
    const dfChecks = {};
    dfDefs.forEach(function (def) {
      const lbl = document.createElement("label");
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = true;
      dfChecks[def.key] = chk;
      lbl.appendChild(chk);
      lbl.appendChild(document.createTextNode(" " + def.label));
      dfRow.appendChild(lbl);
    });
    docFieldsWrapper.appendChild(dfRow);
    const dfNote = document.createElement("p");
    dfNote.className = "pay-methods-note";
    dfNote.textContent = "Solo aparecen los que el cliente tenga rellenos (la razón social sustituye al nombre si existe).";
    docFieldsWrapper.appendChild(dfNote);
    blockDelivery.appendChild(docFieldsWrapper);

    // null = todos (default); objeto solo si el pro desmarca algo
    function selectedDocFields() {
      const all = dfDefs.every(function (d) { return dfChecks[d.key].checked; });
      if (all) return undefined;
      const out = {};
      dfDefs.forEach(function (d) { out[d.key] = dfChecks[d.key].checked; });
      return out;
    }

  // ---------- BLOQUE 2: LÍNEAS ----------
  // SCRUM-286: `blockLines` y su título se crean ARRIBA, con los otros tres, porque ahí es donde
  // se decide el orden del DOM. Aquí sólo se sigue rellenando, igual que antes.
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
  // SCRUM-139 F6: sin estilos en línea (AB3: "cero estilos inline aleatorios") y sin borde
  // discontinuo, que desde F2 está RESERVADO a "+ Añadir línea" (crear).
  useTemplateBtn.className = "btn-ghost btn-sm quote-header-btn";
  useTemplateBtn.innerHTML = "📋 Usar plantilla";
  useTemplateBtn.title = "Cargar líneas desde una plantilla guardada";
  linesHeader.appendChild(useTemplateBtn);

  blockLines.appendChild(linesHeader);

  // SCRUM-139 F1: la línea deja de ser una FILA DE TABLA. Antes era `<table class="quote-lines-table">`
  // con `min-width:560px` dentro de un `overflow-x:auto`: en un móvil de 390 px se rellenaba
  // scrolleando de lado por 7 columnas. Eso es lo que hacía que "pareciera meter precios" y no
  // hacer un presupuesto — y con el pulgar en la furgoneta era inservible (AB1: móvil REAL).
  // Ahora cada línea es una TARJETA (`.quote-line`) en una sola columna; en ≥768 px la misma
  // tarjeta se dispone en rejilla horizontal, así que el escritorio no pierde densidad y NO hay
  // dos DOM que mantener. La cabecera de columnas desaparece: cada campo lleva su propia etiqueta.
  /**
   * SCRUM-139 F6 · PLANTILLAS A UN TOQUE, SIN SALIR DE LA PANTALLA.
   *
   * Hasta ahora usar una plantilla eran tres pasos: abrir el modal, leer la lista, elegir. Para
   * el oficio que repite el mismo trabajo diez veces al mes, eso es un trámite delante de lo
   * único que quiere hacer. Aquí las plantillas se pintan como fichas de un toque dentro del
   * propio cuadernillo.
   *
   * SOBRE "CONCEPTOS FRECUENTES", la otra mitad que pedía el plan de fases: aquí se dejó fuera
   * a propósito —no por falta de tiempo— porque no había ninguna señal de frecuencia y "los más
   * usados" solo podía salir de inventarse un criterio y presentárselo al pro como si fuera su
   * historial. Eso es mentirle sobre sus propios datos.
   *
   * SCRUM-162 la construye, y el motivo de arriba sigue mandando: la señal NO se inventó ni se
   * añadió al esquema, se DERIVÓ de los presupuestos reales del merchant (`Quote.lines`), y solo
   * se enseña cuando existe de verdad — el backend devuelve lista VACÍA si no hay al menos 3
   * conceptos repetidos en 3 presupuestos o más. Medido en producción antes de construirlo: tres
   * merchants la superan y cinco no; esos cinco no ven nada, que es exactamente lo que había que
   * proteger. El autocompletado del catálogo sigue igual para lo demás.
   */
  const plantillasRapidas = document.createElement("div");
  plantillasRapidas.className = "quote-plantillas";
  plantillasRapidas.hidden = true;
  blockLines.appendChild(plantillasRapidas);

  // ⚠️ ESTA DECLARACIÓN VIVE AQUÍ, JUNTO A SU CONTENEDOR, Y NO MÁS ABAJO (SCRUM-162).
  // Estaba declarada al lado de `pintarPlantillasRapidas`, ~1.700 líneas más adelante, y
  // `recalcTotals()` la lee a través de `refrescarRotuloPlantillas()` mucho antes: en el
  // primer `addLine()` del render, cuando ese `let` todavía está en su zona muerta (TDZ).
  // El `ReferenceError` resultante ABORTABA el resto del render — así que la fila de
  // plantillas de F6 no llegaba a pintarse NUNCA y el listener de «📋 Usar plantilla» no
  // llegaba a engancharse. Lo destapó el E2E de SCRUM-162 al ver que sus propias fichas
  // tampoco aparecían. Si vuelve a bajar, vuelve el fallo.
  let plantillasRotulo = null;

  // SCRUM-162: los conceptos que este pro repite de verdad. Misma fila de fichas que las
  // plantillas (AB3, patrón de F6) y debajo de ellas: la plantilla trae varias líneas de
  // golpe, el concepto trae una — de más a menos, como la escalera del héroe (SCRUM-31 F4).
  // Nace OCULTO y solo se muestra si el backend devuelve conceptos: sin señal, no hay fila.
  const conceptosFrecuentes = document.createElement("div");
  conceptosFrecuentes.className = "quote-conceptos";
  conceptosFrecuentes.hidden = true;
  blockLines.appendChild(conceptosFrecuentes);

  const linesBody = document.createElement("div");
  linesBody.className = "quote-lines";
  blockLines.appendChild(linesBody);

  // SCRUM-133: segundo "+ Añadir línea", AQUÍ ABAJO — pegado a la última fila, que es
  // donde está la mano tras teclear. El de la cabecera SE QUEDA (no lo sustituye): con
  // una lista larga las dos puntas son útiles —arriba al volver de una plantilla, abajo
  // al encadenar líneas— y es el control de la acción más repetida del editor. Mismo
  // patrón que el editor de albarán (jobDetailView, SCRUM-31 F2): ghost + "+ Añadir línea".
  // `type=button` es obligatorio: sin él, dentro del <form>, el clic ENVIARÍA el presupuesto.
  const addLineBtnBottom = document.createElement("button");
  addLineBtnBottom.type = "button";
  addLineBtnBottom.className = "btn-ghost quote-add-line";
  addLineBtnBottom.textContent = "+ Añadir línea";
  addLineBtnBottom.title = "Añade una línea al final de la lista";
  blockLines.appendChild(addLineBtnBottom);

  // ---------- DRAG & DROP para reordenar líneas (FRONT1-4) ----------
  let draggedTr = null;
  linesBody.addEventListener("dragover", function (e) {
    if (!draggedTr) return;
    e.preventDefault();
    const rows = Array.from(linesBody.querySelectorAll(".quote-line:not(.dragging)"));
    let after = null;
    let closest = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      const box = row.getBoundingClientRect();
      const offset = e.clientY - box.top - box.height / 2;
      if (offset < 0 && offset > closest) { closest = offset; after = row; }
    }
    if (after == null) linesBody.appendChild(draggedTr);
    else linesBody.insertBefore(draggedTr, after);
  });
  /**
   * SCRUM-139 F5 · MOVER UNA LÍNEA (arriba / abajo).
   *
   * Reordenar existía SOLO por arrastre, y el arrastre HTML5 se apoya en eventos de ratón: en
   * Android Chrome el toque no dispara `dragstart`. O sea, en la pantalla que declaramos
   * MÓVIL PRIMERO (F1) reordenar líneas sencillamente no se podía. Estos dos botones lo
   * arreglan sin tocar el arrastre, que se conserva donde sí funciona.
   *
   * Mueve el NODO y deja que `syncLinesOrder` derive el orden del DOM, que ya es la única
   * fuente de verdad del orden desde el arrastre: así no hay dos maneras de ordenar lo mismo.
   */
  function moverLinea(line, delta) {
    const filas = Array.from(linesBody.querySelectorAll(".quote-line"));
    const i = filas.indexOf(line.row);
    const j = i + delta;
    if (i === -1 || j < 0 || j >= filas.length) return;
    if (delta < 0) linesBody.insertBefore(line.row, filas[j]);
    else linesBody.insertBefore(filas[j], line.row);
    syncLinesOrder();
    recalcTotals();
    renderPreview();
    scheduleDraftSave();
    try { line.menuBtn.focus({ preventScroll: true }); } catch (_e) {}
  }

  function syncLinesOrder() {
    const rows = Array.from(linesBody.querySelectorAll(".quote-line"));
    lines.sort((a, b) => rows.indexOf(a.row) - rows.indexOf(b.row));
  }

  // ---------- BLOQUE C: TOTALES ----------
  const blockTotals = document.createElement("div");
  blockTotals.className = "quote-block quote-block-totals";
  leftCard.appendChild(blockTotals);

  // SCRUM-139 F3: este bloque ya NO lleva título "Totales". La cifra ES el título.
  // Un h3 "Totales" a 30 px por encima de una etiqueta "TOTAL PRESUPUESTO" dice la misma
  // palabra dos veces (AB1, Una Sola Voz), y de paso empujaba hacia abajo lo único que el
  // usuario está buscando en esta pantalla: cuánto suma lo que acaba de escribir.

  const totalsBox = document.createElement("div");
  totalsBox.className = "quote-totals";
  blockTotals.appendChild(totalsBox);

  /**
   * SCRUM-139 F3 · EL TOTAL, ANCLADO EN MÓVIL.
   *
   * MEDIDO: con un presupuesto realista de 3 líneas, la cifra caía en **y = 1.470 px** dentro
   * de una pantalla de 844 px. Es decir: mientras escribes NUNCA ves cuánto llevas. Un total
   * "protagonista" que hay que ir a buscar no es protagonista, y esta pantalla es la que más
   * ingresos genera de la aplicación (AB1: todo gira alrededor del dinero en juego).
   *
   * Por eso el KPI es su PROPIO bloque y cuelga directamente de `leftCard`: `position:sticky`
   * se limita a la caja del padre, así que dentro de `.quote-totals` (~145 px de alto) el
   * anclaje no habría servido de nada. Aquí el padre abarca todo el editor, así que la cifra
   * queda fija abajo mientras editas y se posa en su sitio —justo encima de las acciones— al
   * llegar al final. UNA sola representación del total: no hay barra flotante *además* del
   * bloque, es el mismo bloque.
   *
   * Solo se ancla por debajo de 768 px: en escritorio la cifra ya se ve sin scroll (medido:
   * y = 666 px), y anclarla allí sería una barra fija que no resuelve nada.
   */
  const kpiBox = document.createElement("div");
  kpiBox.className = "quote-block quote-total-kpi";
  leftCard.appendChild(kpiBox);

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
  saveTemplateBtn.className = "btn-ghost btn-sm quote-header-btn";   // SCRUM-139 F6: ver arriba
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
      // SCRUM-27: tramos personalizados (valores crudos del editor) para restaurar el borrador
      customStages: paymentSelect.value === "CUSTOM"
        ? stages.map((s) => ({ label: s.labelInput.value || "", pct: s.pctInput.value || "" }))
        : undefined,
      vatDefault: fieldVatDefault.input.value || "21",
      lines: lines.map((l) => ({
        concept: l.conceptInput.value || "",
        qty: l.qtyInput.value || "",
        price: l.priceInput.value || "",
        markup: l.markupInput ? l.markupInput.value : "0",
        vat: l.vatInput.value || "",
        // SCRUM-500: sin esto, recuperar el borrador devolvía la línea con su IVA y sin la marca
        // — o sea, un suplido convertido en línea normal por el simple hecho de recargar.
        suplido: !!(l.suplidoCheck && l.suplidoCheck.checked),
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
      linesBody.innerHTML = "";
      lines = [];
      // SCRUM-134 (precedencia de estado): el IVA por defecto se restaura ANTES de crear las
      // líneas. `addLine` usa `fieldVatDefault.input.value` como fallback cuando una línea no
      // trae IVA propio, así que con el orden inverso las líneas del borrador heredaban el
      // defecto ANTERIOR (el de la pantalla recién montada), no el que el usuario tenía guardado.
      if (d.vatDefault) fieldVatDefault.input.value = d.vatDefault;
      d.lines.forEach((l) => addLine(l));
      if (d.paymentTerms) paymentSelect.value = d.paymentTerms;
      // SCRUM-27: restaurar el editor de tramos si el borrador era "Personalizado".
      if (d.paymentTerms === "CUSTOM" && Array.isArray(d.customStages)) {
        stages.length = 0;
        stagesRows.innerHTML = "";
        d.customStages.forEach((s) => addStage({ label: s.label, pct: s.pct }));
        stagesWrapper.style.display = "block";
        recalcStagesSum();
      }
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
    // SCRUM-229: el margen agregado del pie se acumula EN ESTE MISMO recorrido, no en otro —
    // dos recorridos distintos sobre las mismas líneas acaban dando dos cifras distintas (misma
    // disciplina que SCRUM-228). `margenSinCalcular` va aparte del importe a propósito: un
    // markup ilegible NO es «margen cero», es un dato que falta, y el pie tiene que decirlo.
    let margenImporte = 0;
    let margenCoste = 0;
    let margenSinCalcular = 0;
    const cur = (currentMerchant && currentMerchant.defaultCurrency) || 'EUR';

    lines.forEach((line, idx) => {
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

      // SCRUM-139 F2: una línea EN BLANCO del cuadernillo se ve en blanco.
      // Sin esto, las 3 líneas de salida muestran "0,00 €" cada una y el editor parece tener
      // tres artículos a cero, no tres renglones libres. En blanco = sin concepto y sin precio;
      // un concepto escrito a 0 € SÍ enseña su 0,00 € porque es un importe deliberado
      // (una línea regalada, por ejemplo).
      const enBlanco =
        !line.conceptInput.value.trim() && !String(line.priceInput.value || "").trim();
      line.totalCell.textContent = enBlanco ? "—" : fmtMoneyEs(lineBase + lineVat, cur);
      line.row.classList.toggle("quote-line--vacia", enBlanco);

      // SCRUM-139 F4: el botón de ajustes DICE lo que esconde. Un disparador mudo ("Ajustes")
      // obligaría a abrir la hoja para comprobar el IVA de cada línea; así se lee de un vistazo
      // y solo se abre para CAMBIARLO. El margen solo aparece cuando existe: "Margen 0 %" en
      // todas las líneas sería ruido en la inmensa mayoría de los presupuestos.
      // SCRUM-139 F5: "Subir" en la primera línea y "Bajar" en la última se DESHABILITAN, no
      // se esconden — un menú que cambia de ítems según la fila obliga a leerlo entero cada vez
      // (mismo criterio que SCRUM-89 con las acciones vetadas por rol).
      if (line.subirBtn) line.subirBtn.disabled = idx === 0;
      if (line.bajarBtn) line.bajarBtn.disabled = idx === lines.length - 1;

      // SCRUM-500: el rótulo lo compone `resumenAjustes` (quoteSuplido.js) para que una línea de
      // suplido lo DIGA desde fuera. Con «IVA 0 %» a secas, un suplido y una línea exenta se leen
      // igual en la lista, y no son lo mismo.
      if (line.ajustesBtn) {
        line.ajustesBtn.textContent = resumenAjustes(
          !!(line.suplidoCheck && line.suplidoCheck.checked),
          safeVat,
          safeMarkup,
        );
      }

      base += lineBase;
      vatTotal += lineVat;

      // SCRUM-229 · el margen de ESTA línea, en el mismo paso. `margenDeLinea` (quoteMargen.js)
      // es la pieza pura, extraída para poder exigir por test que un markup ilegible NO se cuele
      // como 0. Aquí solo se acumula: la aritmética de `safeMarkup` para el TOTAL sigue intacta
      // — este ticket no la cambia, solo hace que el pie diga lo que se perdió.
      const m = margenDeLinea({
        qtyRaw: line.qtyInput.value,
        priceRaw: line.priceInput.value,
        markupRaw: line.markupInput ? line.markupInput.value : '0',
      });
      if (m.calculable) {
        margenImporte += m.importe;
        margenCoste += m.coste;
      } else {
        margenSinCalcular += 1;
      }
    });

    refrescarRotuloPlantillas();

    const total = base + vatTotal;
    const effVat = base > 0 ? Math.round((vatTotal / base) * 100) : 0;

    // Premium: UNA sola representación de los totales (antes la lista y la tira
    // "€X + IVA = €Y" decían lo mismo dos veces). Base + IVA como desglose y el
    // TOTAL como única cifra grande (Regla del Importe: en Tinta).
    // P-A66-3: formato es-ES compartido (adiós al hack del símbolo por moneda).
    // SCRUM-139 F3: el TOTAL como Signature KPI (DESIGN.md §5) — Label en MAYÚSCULAS
    // ARRIBA y la cifra Display debajo, no una fila más de una lista. Antes el total era
    // `.quote-vat-calc`: una fila `space-between` con "Total presupuesto" a 20 px peleando
    // por el ancho con su propia cifra. Base e IVA quedan como APOYO (pequeños, apagados):
    // se consultan, no se buscan. La cifra sigue la Regla del Importe (Tinta, ≥700, tabular).
    // SCRUM-229: tercera fila de APOYO, del mismo tipo que las dos de arriba — sin componente
    // nuevo y sin tocar `.quote-line`. Coste medido: +24 px FIJOS, no por fila. El alcance que se
    // descartó (margen e IVA en columnas por línea) costaba +77 px POR FILA a 390 px, o +770 px
    // en un presupuesto de 10 líneas: dos pantallas más de scroll en obra.
    //
    // Microcopy APROBADO por el fundador (29-jul-2026), literal (regla 30): la etiqueta es
    // «Margen» y el valor lo compone `textoMargen` — «18,00 € (18 %)», o
    // «18,00 € · 2 líneas sin calcular» cuando alguna línea no se pudo leer.
    const margenTexto = textoMargen(
      { importe: margenImporte, coste: margenCoste, sinCalcular: margenSinCalcular },
      (n) => fmtMoneyEs(n, cur),
    );
    totalsBox.innerHTML = `
      <div class="quote-totals__apoyo"><span>Base imponible</span><strong>${fmtMoneyEs(base, cur)}</strong></div>
      <div class="quote-totals__apoyo"><span>IVA (${effVat}%)</span><strong>${fmtMoneyEs(vatTotal, cur)}</strong></div>
      <div class="quote-totals__apoyo"><span>Margen</span><strong>${margenTexto}</strong></div>
    `;
    kpiBox.innerHTML = `
      <span class="quote-total-kpi__label">Total presupuesto</span>
      <strong class="quote-total-kpi__cifra">${fmtMoneyEs(total, cur)}</strong>
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
            case "CUSTOM": // SCRUM-27: muestra los tramos del editor en la vista previa
              label = stages.length
                ? stages.map((s) => `${(s.labelInput.value || "").trim() || "Tramo"} ${s.pctInput.value || 0}%`).join(" · ")
                : "Plan personalizado por tramos.";
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

    const ptBody = document.createElement("linesBody");

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
    // SCRUM-132: el producto guarda el IVA en FRACCIÓN; el input lo quiere en porcentaje.
    // Vía `fractionToPercent` para no volver a escribir "21.000000000000004" en el campo.
    if (Number.isFinite(v)) vatInput.value = String(fractionToPercent(v));
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

  // UX PRO: al seleccionar, saltar al siguiente campo (cantidad).
  // SCRUM-139 F4: esto llevaba MUERTO desde F1 sin que nadie lo notara — buscaba
  // `closest("tr")` y `td:nth-child(2)`, y desde F1 la línea no es una fila de tabla sino una
  // tarjeta de `div`s. `closest` devolvía null, el `try` se lo tragaba y el foco simplemente no
  // saltaba. Ahora se ancla en las clases del componente, que son el contrato real de la tarjeta.
  try {
    const row = conceptInput.closest(".quote-line");
    if (row) {
      const qty = row.querySelector(".quote-line__qty input");
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

  // SCRUM-132: fracción (0.21) → porcentaje para el input (21). Redondea a 2 decimales de
  // PORCENTAJE porque `0.21 * 100` da 21.000000000000004 en coma flotante — sin esto el campo
  // muestra esa ristra de decimales. 2 decimales admiten tipos no enteros (p. ej. 4,5 %) sin
  // inventar precisión.
  function fractionToPercent(tax) {
    const n = Number(tax);
    return Number.isFinite(n) ? Math.round(n * 10000) / 100 : 0;
  }

  /**
   * SCRUM-139 F1: envoltorio de un campo de la línea con su ETIQUETA propia.
   *
   * Al desaparecer la cabecera de tabla, cada campo tiene que decir qué es por sí mismo — si no,
   * en móvil quedan cuatro cajitas numéricas sin significado. La etiqueta usa el estilo Label de
   * DESIGN.md (12px, 600, MAYÚSCULAS, Apagado) y va asociada al input con `<label>`, que además
   * amplía el área pulsable: el propio texto enfoca el campo (target ≥44px de AB6).
   */
  /**
   * SCRUM-139 F4 · HOJA DE AJUSTES DE LA LÍNEA (margen % e IVA %).
   *
   * Reutiliza `.modal-overlay` + `.modal` del inventario AB3 tal cual: la casa ya los convierte
   * en HOJA INFERIOR por debajo de 640 px y en modal centrado por encima. Un solo DOM y cero
   * componentes nuevos — decide el CSS, no el JavaScript.
   *
   * Mueve los inputs REALES de la línea (no copias): al cerrar vuelven a su contenedor. Por eso
   * no hay nada que sincronizar ni ningún estado que pueda quedar desparejado.
   */
  let hojaAbierta = null;

  function abrirHojaAjustes(line) {
    if (hojaAbierta) hojaAbierta();   // una sola hoja a la vez (como el overflowMenu de AB3)

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const modal = document.createElement("div");
    modal.className = "modal quote-ajustes-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Ajustes de la línea");

    // SCRUM-446: cabecera del constructor compartido.
    const header = cabeceraModal({ titulo: "Ajustes de la línea" });
    const cerrar = header.querySelector(".modal-close");

    const body = document.createElement("div");
    body.className = "modal-body";

    // Qué línea se está tocando. Sin esto, en una hoja a pantalla completa se pierde el hilo
    // de a cuál de las líneas pertenecen estos dos números.
    const cual = document.createElement("p");
    cual.className = "quote-ajustes-cual";
    const concepto = (line.conceptInput.value || "").trim();
    cual.textContent = concepto || "Línea sin concepto todavía";
    body.appendChild(cual);
    body.appendChild(line.ajustesCampos);

    const pie = document.createElement("div");
    pie.className = "modal-footer";
    const listo = document.createElement("button");
    listo.type = "button";
    listo.className = "btn-primary";
    listo.textContent = "Listo";
    pie.appendChild(listo);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(pie);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function cerrarHoja() {
      // Los campos son los de la línea: se RECUPERAN antes de tirar la hoja, o se irían con ella.
      line.ajustesCampos.remove();
      overlay.remove();
      document.removeEventListener("keydown", onEsc);
      hojaAbierta = null;
      try { line.ajustesBtn.focus({ preventScroll: true }); } catch (_e) { line.ajustesBtn.focus(); }
    }
    function onEsc(e) {
      if (e.key === "Escape") { e.stopPropagation(); cerrarHoja(); }
    }

    hojaAbierta = cerrarHoja;
    cerrar.addEventListener("click", cerrarHoja);
    listo.addEventListener("click", cerrarHoja);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) cerrarHoja(); });
    document.addEventListener("keydown", onEsc);

    try { line.markupInput.focus({ preventScroll: true }); } catch (_e) {}
  }

  function campoLinea(etiqueta, clase) {
    const wrap = document.createElement("label");
    wrap.className = "quote-line__field " + clase;
    const lab = document.createElement("span");
    lab.className = "quote-line__label";
    lab.textContent = etiqueta;
    wrap.appendChild(lab);
    return wrap;
  }

  function addLine(initial) {
    // SCRUM-139 F1: tarjeta, no `<tr>`. Se conservan EXACTAMENTE las mismas claves en `lineObj`
    // (conceptInput, qtyInput, priceInput, markupInput, vatInput, totalCell, priceHint) para que
    // todo lo que ya las consume —payload, borrador, recalcTotals, plantillas, IA, autocompletado—
    // siga funcionando sin tocarse. Lo que cambia es el DOM, no el contrato.
    const tr = document.createElement("div");
    tr.className = "quote-line";
    tr.setAttribute("role", "listitem");

    const conceptTd = campoLinea("Concepto", "quote-line__concept");
    const conceptInput = document.createElement("input");
    conceptInput.type = "text";
    conceptInput.placeholder = "Concepto / servicio";
    conceptInput.value = initial && initial.concept ? initial.concept : "";
    conceptTd.appendChild(conceptInput);

    // PRO: este campo puede venir de un producto del catálogo
conceptInput.dataset.pfProductId = ""; // vacío = "manual"

   



    const qtyTd = campoLinea("Cantidad", "quote-line__qty");
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "0";
    qtyInput.step = "1";
    qtyInput.value = initial && initial.qty != null ? initial.qty : "1";
    qtyTd.appendChild(qtyInput);

    const priceTd = campoLinea("Precio", "quote-line__price");
    const priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.min = "0";
    priceInput.step = "0.01";
    priceInput.value = initial && initial.price != null ? initial.price : "";
    priceTd.appendChild(priceInput);
    priceInput.dataset.pfBasePrice = ""; // precio catálogo o base antes de markup

    // Hint: precio final con markup (solo visual; vacío si no hay markup).
    // SCRUM-139 F4 (cierra BUGS.md P3-13): vive JUNTO A LA ETIQUETA, no debajo del input.
    // Colgando debajo hacía la celda de PRECIO más alta que las demás y, con `align-items:end`,
    // su input subía ~15 px respecto a Cantidad y Total. Al lado de la etiqueta todas las cajas
    // miden lo mismo y el descuadre desaparece de raíz, en vez de compensarse con un ajuste.
    // Y ahora es MÁS necesario que antes: con el margen dentro de la hoja, este aviso es la
    // única señal visible de que el precio que verá el cliente no es el que hay escrito.
const priceHint = document.createElement("span");
priceHint.className = "price-final-hint";
priceHint.textContent = "";
priceTd.querySelector(".quote-line__label").appendChild(priceHint);


    const markupTd = campoLinea("Margen %", "quote-line__markup");
const markupInput = document.createElement("input");
markupInput.type = "number";
markupInput.min = "0";
markupInput.step = "1";
markupInput.placeholder = "0";
markupInput.value = initial && initial.markup != null ? initial.markup : "0";
markupTd.appendChild(markupInput);


    const vatTd = campoLinea("IVA %", "quote-line__vat");
    const vatInput = document.createElement("input");
    attachProductAutocomplete({ conceptInput, priceInput, vatInput, markupInput });


    vatInput.type = "number";
    vatInput.min = "0";
    vatInput.step = "1";
    // SCRUM-132: el IVA llega en DOS unidades según de dónde venga la línea, y antes solo se
    // leía una — por eso el "IVA por defecto" PISABA el IVA real de plantillas y de la IA:
    //   · `vat`  = PORCENTAJE (21)   → borrador de localStorage, autocompletado de producto
    //   · `tax`  = FRACCIÓN (0.21)   → plantillas y líneas sugeridas por la IA (contrato del back)
    // Convierte el RECEPTOR, no cada llamador: así las tres rutas de carga quedan bien sin
    // tocar sus call-sites (que además son zona de SCRUM-134).
    // El general SIEMBRA, nunca PISA: solo se aplica si la línea no trae IVA propio.
    if (initial && initial.vat != null) {
      vatInput.value = initial.vat;
    } else if (initial && initial.tax != null) {
      // `tax: 0` es un tipo LEGÍTIMO (0 %, SCRUM-65), no "sin especificar" → no cae al default.
      vatInput.value = String(fractionToPercent(initial.tax));
    } else {
      const def = fieldVatDefault.input.value || "21";
      vatInput.value = def;
    }
    vatTd.appendChild(vatInput);

    /**
     * SCRUM-500 · LA CASILLA «SUPLIDO», con su aviso.
     *
     * Va en la hoja de ajustes, pegada al IVA, porque lo que hace es JUSTO ESO: quitarle el IVA a
     * la línea. Arriba, en la fila, quedaría separada del número que cambia.
     *
     * 🔴 EL AVISO NO ES DECORACIÓN. La frontera entre un suplido y un material propio es invisible
     * desde aquí y equivocarse no da ningún síntoma: la factura sale igual de bonita. El texto
     * tiene que estar en el momento exacto de marcar, no en una ayuda que nadie abre. Microcopy
     * PENDIENTE de aprobación (regla 30): el marcador viaja DELANTE del texto.
     */
    const suplidoTd = document.createElement("div");
    suplidoTd.className = "field inline-checkbox quote-line__suplido";
    const suplidoLabel = document.createElement("label");
    const suplidoCheck = document.createElement("input");
    suplidoCheck.type = "checkbox";
    suplidoCheck.checked = !!(initial && initial.suplido === true);
    suplidoLabel.appendChild(suplidoCheck);
    suplidoLabel.appendChild(document.createTextNode(" " + ROTULO_SUPLIDO));
    suplidoTd.appendChild(suplidoLabel);
    const suplidoAviso = document.createElement("p");
    suplidoAviso.className = "quote-line__suplido-aviso";
    suplidoAviso.textContent = AVISO_SUPLIDO;
    suplidoTd.appendChild(suplidoAviso);

    /**
     * Marcada = 0 % y el input de IVA bloqueado. Al desmarcar se DEVUELVE el IVA que había, no se
     * inventa uno: quien marcó por error recupera su línea tal cual estaba, y el general del
     * merchant no tiene por qué ser el de esa línea (podía venir de una plantilla o de la IA).
     *
     * ⚠️ Esto es la INTERFAZ. Que el IVA acabe en 0 lo garantiza `lineaParaPayload`, que se aplica
     * a toda línea marcada venga de donde venga — de un borrador restaurado, de una plantilla o de
     * la IA, que no pasan por este `change`.
     */
    function aplicarSuplido() {
      if (suplidoCheck.checked) {
        if (!vatInput.disabled) vatInput.dataset.pfVatAntes = vatInput.value;
        vatInput.value = "0";
        vatInput.disabled = true;
      } else if (vatInput.disabled) {
        vatInput.disabled = false;
        if (vatInput.dataset.pfVatAntes != null) vatInput.value = vatInput.dataset.pfVatAntes;
      }
    }
    if (suplidoCheck.checked) aplicarSuplido();

    // Total de la línea: Regla del Importe (DESIGN.md) — Tinta, ≥700, tabular. Con su etiqueta,
    // porque sin cabecera de tabla una cifra suelta no dice qué es.
    const totalTd = document.createElement("div");
    totalTd.className = "quote-line__total";
    totalTd.textContent = "0.00";
    const totalWrap = campoLinea("Total", "quote-line__totalwrap");
    totalWrap.appendChild(totalTd);

    const actionsTd = document.createElement("div");
    actionsTd.className = "quote-line__actions";

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

    /**
     * SCRUM-139 F5 · LAS ACCIONES DE LA LÍNEA, AL MENÚ DE AB3.
     *
     * La premisa original de la fase era "la línea tiene demasiados botones", y no era cierta:
     * tenía DOS (arrastrar y borrar). Lo que sí era cierto es que uno de los dos NO FUNCIONA
     * en móvil —el arrastre HTML5 no se dispara con el dedo— y que la tira de acciones costaba
     * ~45 px por línea a lo ancho para un único botón útil.
     *
     * Con Subir / Bajar / Eliminar son TRES acciones secundarias, que es justo el caso que AB3
     * describe para `overflowMenu` (1 primaria visible + el resto agrupadas). Y de paso el
     * móvil gana un reordenado que hoy no tiene.
     */
    const subirBtn = document.createElement("button");
    subirBtn.type = "button";
    subirBtn.textContent = "↑  Subir";
    subirBtn.addEventListener("click", function () { moverLinea(lineObj, -1); });

    const bajarBtn = document.createElement("button");
    bajarBtn.type = "button";
    bajarBtn.textContent = "↓  Bajar";
    bajarBtn.addEventListener("click", function () { moverLinea(lineObj, +1); });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.title = "Eliminar línea";
    removeBtn.textContent = "🗑️  Eliminar línea";

    // El menú es el helper compartido de AB3 (teclado, foco, cierre, hoja inferior en ≤640 px).
    // Si no estuviera cargado, las acciones se quedan visibles sueltas: perder el menú no puede
    // costar la posibilidad de borrar una línea.
    const menuBtn =
      typeof overflowMenu === "function"
        ? overflowMenu([subirBtn, bajarBtn, removeBtn], { label: "Acciones de la línea" })
        : null;
    if (menuBtn) actionsTd.appendChild(menuBtn);
    else { actionsTd.appendChild(subirBtn); actionsTd.appendChild(bajarBtn); actionsTd.appendChild(removeBtn); }

    /**
     * SCRUM-139 F4 · MARGEN E IVA A LA HOJA INFERIOR.
     *
     * De los cinco campos de una línea, dos NO se tocan casi nunca: el margen (casi siempre 0)
     * y el IVA (casi siempre el general del merchant, que ya se elige una vez arriba). Estaban
     * ocupando el mismo peso visual que el concepto y el precio, que son los que sí se
     * escriben en cada línea.
     *
     * Los inputs son LOS MISMOS de siempre —no hay copias ni espejos que sincronizar—: viven
     * en este contenedor y se MUEVEN a la hoja al abrirla y vuelven al cerrarla. Así
     * `lineObj.markupInput` / `lineObj.vatInput` siguen siendo exactamente los que ya
     * consumen el payload, el borrador, las plantillas, la IA y el autocompletado: cambia
     * dónde se ven, no qué son.
     */
    const ajustesCampos = document.createElement("div");
    ajustesCampos.className = "quote-ajustes-campos";
    // SCRUM-500: el suplido va PRIMERO. Es la decisión que manda sobre las otras dos —marcarlo
    // deja el IVA a 0 y bloqueado—, así que leerlo después de haber tocado el IVA sería leer el
    // orden al revés.
    ajustesCampos.appendChild(suplidoTd);
    ajustesCampos.appendChild(markupTd);
    ajustesCampos.appendChild(vatTd);

    const ajustesBtn = document.createElement("button");
    ajustesBtn.type = "button";
    ajustesBtn.className = "btn-ghost quote-line__ajustes";
    ajustesBtn.title = "Ajustes de la línea (margen e IVA)";
    ajustesBtn.setAttribute("aria-haspopup", "dialog");
    ajustesBtn.textContent = "IVA 21 %";   // lo mantiene al día recalcTotals

    tr.appendChild(conceptTd);
    tr.appendChild(qtyTd);
    tr.appendChild(priceTd);
    tr.appendChild(ajustesBtn);
    tr.appendChild(totalWrap);
    tr.appendChild(actionsTd);

    linesBody.appendChild(tr);

    const lineObj = {
      row: tr,
      conceptInput,
      qtyInput,
      priceInput,
      markupInput,
      vatInput,
      totalCell: totalTd,
      priceHint,
      // SCRUM-139 F4 — dónde viven margen e IVA y quién abre su hoja. Las claves de arriba
      // NO cambian: `markupInput` y `vatInput` siguen siendo los mismos elementos.
      ajustesCampos,
      ajustesBtn,
      // SCRUM-500 — la casilla de suplido de esta línea. La leen el payload y el borrador.
      suplidoCheck,
      // SCRUM-139 F5 — el menú de acciones y sus dos ítems de orden (se habilitan/deshabilitan
      // según la posición de la línea, no se ocultan: criterio de SCRUM-89).
      menuBtn: menuBtn || removeBtn,
      subirBtn,
      bajarBtn,

    };

    ajustesBtn.addEventListener("click", function () {
      abrirHojaAjustes(lineObj);
    });
    
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
    // SCRUM-500: marcar suplido cambia el IVA de la línea, así que recalcula como cualquier otro
    // campo. Sin esto, el total del pie se quedaría con el IVA de antes hasta el siguiente toque.
    suplidoCheck.addEventListener("change", function () {
      aplicarSuplido();
      onChange();
    });

    


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
      linesBody.removeChild(tr);
      lines = lines.filter(function (l) {
        return l !== lineObj;
      });
      recalcTotals();
      renderPreview();
    });

    recalcTotals();
    renderPreview();
  }

  /**
   * SCRUM-139 F2 · EL CUADERNILLO.
   *
   * Antes se dibujaba UNA línea y un botón "+ Añadir". El problema no es de pulsaciones, es
   * psicológico (observación del fundador): un cuadernillo con líneas visibles TE DICE CUÁNTO
   * ESPACIO TIENES; una hoja en blanco con "+ Añadir" te obliga a decidir cuántas líneas
   * necesitas ANTES de saberlo. Varias líneas esperando son una invitación; un botón es un trámite.
   *
   * Este número es DELIBERADO y fácil de cambiar: son las líneas que se ven sin hacer scroll y
   * que sugieren "aquí caben varias cosas" sin parecer un formulario largo. El fundador acotó
   * 2-3; se elige 3 y se mide al cerrar la fase (si empuja el total demasiado abajo en móvil,
   * baja a 2 — es una línea de código).
   *
   * NO se dibuja al restaurar un BORRADOR: ahí el editor no está en blanco, y añadir vacías
   * encima de lo que el usuario ya escribió sería ruido, no invitación.
   */
  const LINEAS_CUADERNILLO = 3;

  function dibujarCuadernillo() {
    for (let i = 0; i < LINEAS_CUADERNILLO; i++) addLine();
  }

  /**
   * ¿El editor sigue en blanco? (ninguna línea tiene concepto). Sustituye al viejo
   * "si hay UNA fila y está vacía": con el cuadernillo hay varias, y aquella comprobación
   * habría dejado las 3 vacías POR DELANTE de las líneas de la plantilla o de la IA.
   */
  function editorEnBlanco() {
    return lines.every((l) => !l.conceptInput.value.trim());
  }

  dibujarCuadernillo();

  // SCRUM-133: añadir + dejar el cursor DENTRO del concepto de la línea nueva, para poder
  // seguir tecleando sin tocar el ratón. `preventScroll` + `scrollIntoView({block:'nearest'})`:
  // el foco no da el salto brusco del scroll automático y, si la fila ya se ve, no se mueve
  // nada (sin animación → nada que gatear con prefers-reduced-motion).
  function addLineAndFocus() {
    addLine();
    const nueva = linesBody.lastElementChild;
    if (!nueva) return;
    const concepto = nueva.querySelector("input");
    if (!concepto) return;
    concepto.focus({ preventScroll: true });
    nueva.scrollIntoView({ block: "nearest" });
  }

  addLineBtn.addEventListener("click", addLineAndFocus);
  addLineBtnBottom.addEventListener("click", addLineAndFocus);

  // Botón IA — añade las líneas sugeridas por Claude
  aiBtn.addEventListener("click", function () {
    if (typeof openAiSuggestModal === 'function') {
      openAiSuggestModal(function (suggestedLines, meta) {
        if (meta && meta.voiceUsed) quoteFormCreatedVia = 'voice'; // VZ-3
        // SCRUM-139 F2: se vacía si el editor está EN BLANCO (antes: "si hay una sola fila
        // vacía"). Con el cuadernillo hay 3 vacías, así que la comprobación vieja las habría
        // dejado por delante de las líneas que sugiere la IA.
        if (editorEnBlanco()) {
          linesBody.innerHTML = '';
          lines = [];
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

    linesBody.innerHTML = "";
    lines = [];
    dibujarCuadernillo();   // SCRUM-139 F2: "empezar de cero" devuelve el cuadernillo, no una línea
    clearDraft();

    setAlert(null, "");
    setResult(null);
  });

  /**
   * SCRUM-139 F6 · el ÚNICO camino de carga de una plantilla, compartido por las fichas rápidas
   * y por el modal de la lista completa. Antes vivía suelto dentro del `onclick` del modal; con
   * dos disparadores, duplicarlo era garantizar que uno de los dos se quedara atrás — y lo que
   * hay dentro no es cosmético: es la lectura CRUDA de `l.tax` de SCRUM-132 y el "vaciar solo
   * si está en blanco" de F2, dos correcciones que costaron su propio ticket.
   */
  function cargarPlantilla(tpl) {
    if (editorEnBlanco()) {
      linesBody.innerHTML = '';
      lines = [];
    }
    const templateLines = Array.isArray(tpl.lines) ? tpl.lines : [];
    templateLines.forEach(function (l) {
      // SCRUM-132: `l.tax` CRUDO, sin `|| 0`. El `|| 0` convertía "esta línea no trae IVA" en
      // "IVA 0 %", y desde SCRUM-65 el 0 % es un tipo legítimo (21/10/4/0).
      addLine({ concept: l.concept, qty: l.qty, price: l.price, tax: l.tax });
    });
    setAlert('success', `Plantilla "${tpl.name}" cargada — ${templateLines.length} líneas añadidas.`);
    return templateLines.length;
  }

  /**
   * SCRUM-139 F6 · pinta las fichas rápidas. Se llama UNA vez al abrir el editor.
   *
   * Reglas de cuántas y cuándo (para que las fichas y el botón de la cabecera no digan lo mismo):
   *   · sin plantillas  → sin fichas; el botón se queda, que es quien explica cómo crear una.
   *   · hasta 3         → fichas y NADA MÁS: el botón abriría un modal con esas mismas tres.
   *   · más de 3        → 3 fichas + el botón, ya como "ver las N".
   * Si la petición falla no se avisa de nada: es un atajo, no una función que el usuario haya
   * pedido; el camino del modal sigue entero y molestar con un error sería ruido.
   */
  function refrescarRotuloPlantillas() {
    if (!plantillasRotulo) return;
    plantillasRotulo.textContent = editorEnBlanco()
      ? 'Empieza con una plantilla'
      : 'Añadir una plantilla';
  }

  async function pintarPlantillasRapidas() {
    let templates;
    try {
      templates = await apiRequest('/admin/templates');
    } catch (_e) {
      return;
    }
    if (!Array.isArray(templates) || templates.length === 0) return;

    const visibles = templates.slice(0, 3);
    plantillasRapidas.innerHTML = '';

    // El rótulo dice la VERDAD en los dos estados. "Empieza con una plantilla" sobre un
    // presupuesto a medio escribir sería falso, y además esconde lo que de verdad pasa al
    // tocar la ficha con contenido delante: que las líneas se AÑADEN (semántica de F2).
    plantillasRotulo = document.createElement('span');
    plantillasRotulo.className = 'quote-plantillas__label';
    plantillasRapidas.appendChild(plantillasRotulo);
    refrescarRotuloPlantillas();

    visibles.forEach(function (tpl) {
      const n = Array.isArray(tpl.lines) ? tpl.lines.length : 0;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'quote-plantilla-chip';
      chip.title = `Añadir las ${n} líneas de "${tpl.name}"`;
      const nombre = document.createElement('span');
      nombre.className = 'quote-plantilla-chip__nombre';
      nombre.textContent = tpl.name;
      const meta = document.createElement('span');
      meta.className = 'quote-plantilla-chip__meta';
      meta.textContent = n + (n === 1 ? ' línea' : ' líneas');
      chip.appendChild(nombre);
      chip.appendChild(meta);
      chip.addEventListener('click', function () { cargarPlantilla(tpl); });
      plantillasRapidas.appendChild(chip);
    });

    plantillasRapidas.hidden = false;
    if (templates.length > 3) useTemplateBtn.innerHTML = `📋 Ver las ${templates.length}`;
    else useTemplateBtn.hidden = true;
  }

  /**
   * SCRUM-162 · TUS CONCEPTOS MÁS USADOS — un toque, una línea con el concepto puesto.
   *
   * La lista la decide el BACKEND, y su contrato es lo importante: si no hay señal suficiente
   * devuelve `items: []`, y vacío aquí significa NO ENSEÑAR NADA. Este front no rellena el
   * hueco con "lo que haya" (los últimos, los primeros, el catálogo entero) — hacerlo sería
   * volver a lo que F6 se negó a construir: una lista arbitraria disfrazada de historial.
   *
   * El fallo de red también deja la fila oculta: es una ayuda, no un requisito del editor.
   */
  async function pintarConceptosFrecuentes() {
    let respuesta;
    try {
      respuesta = await apiRequest('/admin/products/frequent-concepts');
    } catch (_e) {
      return;
    }
    const items = respuesta && Array.isArray(respuesta.items) ? respuesta.items : [];
    if (items.length === 0) return;

    conceptosFrecuentes.innerHTML = '';
    const rotulo = document.createElement('span');
    rotulo.className = 'quote-plantillas__label';
    rotulo.textContent = 'Tus conceptos más usados';
    conceptosFrecuentes.appendChild(rotulo);

    items.forEach(function (item) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'quote-plantilla-chip quote-concepto-chip';
      // El "por qué está aquí" viaja con la ficha: el pro puede comprobar la afirmación en
      // vez de tener que creérsela. Es la diferencia entre un dato suyo y una sugerencia.
      chip.title = `Añadir una línea con "${item.concepto}" (en ${item.usos} presupuestos)`;
      const nombre = document.createElement('span');
      nombre.className = 'quote-plantilla-chip__nombre';
      nombre.textContent = item.concepto;
      const meta = document.createElement('span');
      meta.className = 'quote-plantilla-chip__meta';
      meta.textContent = `en ${item.usos} presupuestos`;
      chip.appendChild(nombre);
      chip.appendChild(meta);
      chip.addEventListener('click', function () { anadirLineaDesdeConcepto(item.concepto); });
      conceptosFrecuentes.appendChild(chip);
    });

    conceptosFrecuentes.hidden = false;
  }

  /**
   * Añade la línea con el concepto ya escrito y deja el foco en el PRECIO — que es lo único
   * que falta. Mandar el foco al concepto (como hace "+ Añadir línea") obligaría a saltar un
   * campo ya relleno con el pulgar, justo el trámite que la ficha viene a quitar.
   */
  function anadirLineaDesdeConcepto(concepto) {
    addLine({ concept: concepto });
    const nueva = linesBody.lastElementChild;
    if (!nueva) return;
    const precio = nueva.querySelector('.quote-line__price input');
    if (precio) precio.focus({ preventScroll: true });
    nueva.scrollIntoView({ block: 'nearest' });
  }

  pintarPlantillasRapidas();
  pintarConceptosFrecuentes();

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
        <div class="modal-body">
          <p style="font-size:13px;color:var(--neutral-500);margin:0 0 12px">Elige una plantilla para cargar sus líneas en el presupuesto actual.</p>
          <div style="display:flex;flex-direction:column;gap:8px" id="tpl-list"></div>
        </div>
      </div>
    `;
    // SCRUM-446: la cabecera sale del constructor compartido.
    overlay.querySelector('.modal').prepend(cabeceraModal({ titulo: "📋 Usar plantilla", idCierre: "tpl-modal-close" }));
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
        // SCRUM-139 F6: un ÚNICO camino de carga, el mismo que usan las fichas rápidas. Antes
        // esta lógica vivía suelta aquí dentro; con dos disparadores, duplicarla era garantizar
        // que uno de los dos se quedara sin la lectura cruda de `l.tax` (SCRUM-132) o sin el
        // "vaciar solo si está en blanco" (F2).
        cargarPlantilla(tpl);
        closeOverlay();
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
    // SCRUM-446: la cabecera sale del constructor compartido.
    overlay.querySelector('.modal').prepend(cabeceraModal({ titulo: "💾 Guardar plantilla", idCierre: "save-tpl-close" }));
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

      // SCRUM-140: la plantilla es el ARGUMENTO de esta vista (ver la cabecera de
      // renderQuotesView). Sin sessionStorage no hay huérfana que descartar ni sello de
      // frescura que comprobar: si no llega plantilla, no hay plantilla. Se mantiene la
      // comprobación de que trae líneas — líneas = dinero, y una plantilla vacía no debe
      // vaciar el editor ni suprimir la restauración del borrador.
      var templatePending = false;
      if (template && Array.isArray(template.lines) && template.lines.length > 0) {
        templatePending = true;
        linesBody.innerHTML = '';
        lines = [];
        template.lines.forEach(function (l) { addLine(l); });
        setAlert('success', `Plantilla "${template.name}" cargada — completa los datos del cliente y genera el presupuesto.`);
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
    // SCRUM-27: el editor de tramos solo se ve en "Personalizado"; arranca con 1 fila.
    const custom = paymentSelect.value === "CUSTOM";
    stagesWrapper.style.display = custom ? "block" : "none";
    if (custom && stages.length === 0) addStage();
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

      

// SCRUM-500: la línea pasa por `lineaParaPayload` (quoteSuplido.js) — es quien FUERZA el
// `tax: 0` de un suplido. No se confía a que el input esté deshabilitado: un borrador
// restaurado, una plantilla o la IA pueden dejar un IVA puesto sin tocar la casilla.
payloadLines.push(lineaParaPayload({
  concept: conceptForPdf,
  qty: safeQty,
  price: finalPrice,
  tax: safeVat / 100,
  suplido: !!(line.suplidoCheck && line.suplidoCheck.checked),
}));

    });

    if (payloadLines.length === 0) {
      setAlert(
        "error",
        "Añade al menos una línea válida con concepto, cantidad y precio."
      );
      return;
    }

    // SCRUM-27: plan personalizado → bloquear guardar si no cuadra (≥1 tramo, etiqueta, %>0, suman 100%).
    if (paymentSelect.value === "CUSTOM" && !customStagesValid()) {
      setAlert("error", "Revisa los tramos: cada uno necesita etiqueta y porcentaje, y deben sumar 100 %.");
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
        paymentTerms: paymentSelect.value === "CUSTOM" ? null : (paymentSelect.value || null),
        customBillingPlan: paymentSelect.value === "CUSTOM" ? collectCustomStages() : undefined, // SCRUM-27
        payMethods: selectedPayMethods(), // A2.1: undefined = todas
        docFields: selectedDocFields(),   // A20.4: undefined = todos
        created_via: quoteFormCreatedVia, // VZ-3: 'voice' si hubo dictado
        // A16.2: caducidad elegida (fin del día local); omitida = 30d en server
        validUntil: validInput.value ? new Date(validInput.value + "T23:59:59").toISOString() : undefined,
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
