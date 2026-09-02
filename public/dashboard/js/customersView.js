// public/dashboard/js/customersView.js

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function createField(labelText, name, type = "text", required = false, isTextarea = false) {
  const wrapper = createElement("div", "field");
  const label = document.createElement("label");
  label.textContent = labelText;

  let input;
  if (isTextarea) {
    input = document.createElement("textarea");
    input.rows = 2;
  } else {
    input = document.createElement("input");
    input.type = type;
  }

  input.name = name;
  if (required) input.required = true;

  wrapper.appendChild(label);
  wrapper.appendChild(input);

  return { wrapper, input };
}

function renderCustomersView(container) {
  container.innerHTML = "";

  let editingCustomer = null;
  let fieldLegalName, fieldTaxId; // A20.4

  // Card principal
  const outerCard = createElement("div", "data-card");
  container.appendChild(outerCard);

  // Cabecera: título + conteo + acciones
  const header = createElement("div", "data-card-header");
  const headLeft = createElement("div");
  const title = createElement("h2", null, "Clientes");
  title.style.cssText = "margin:0;font-size:18px";
  const subtitle = createElement("p", null, "Cargando…");
  subtitle.style.cssText = "margin:2px 0 0;font-size:13px;color:var(--muted)";
  headLeft.appendChild(title);
  headLeft.appendChild(subtitle);
  header.appendChild(headLeft);

  const headActions = createElement("div");
  headActions.style.cssText = "display:flex;align-items:center;gap:8px";
  const importBtn = createElement("button", "btn-secondary btn-sm", "⬆ Importar CSV");
  importBtn.title = "Importar clientes desde un fichero CSV o Excel";
  // SCRUM-312: un alta MASIVA de clientes es «catálogo entero» → admin, con el criterio ya
  // escrito en `adminRouteDeclarations.ts` (línea suelta → técnico, catálogo entero → admin).
  //
  // Y se veta AQUÍ además de en la ruta, que es el punto: cerrar solo el servidor cambia un
  // agujero por un 403 DESPUÉS de que el usuario haya elegido el fichero, confirmado los
  // acentos y revisado el mapeo. El trabajo tirado es el mismo que si no hubiera guard.
  // SCRUM-89: DESHABILITADO con explicación, no escondido — la seguridad real la da el 403.
  const esAdmin = window.appUserRole !== 'tecnico' && window.appUserRole !== 'operario';
  if (!esAdmin) {
    lockActionForRole(importBtn);
  } else {
    importBtn.addEventListener("click", openImportCsvModal);
  }
  const newBtn = createElement("button", "btn-primary btn-sm", "+ Nuevo cliente");
  headActions.appendChild(importBtn);
  headActions.appendChild(newBtn);
  header.appendChild(headActions);
  outerCard.appendChild(header);

  // Toolbar: búsqueda en vivo
  const toolbar = createElement("div", "data-card-toolbar");
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "input";
  searchInput.placeholder = "Buscar por nombre, teléfono o email…";
  searchInput.style.cssText = "min-width:160px;flex:1";
  toolbar.appendChild(searchInput);

  // ── SCRUM-581 (CONT-08) · pestañas y orden. SE SUMAN al buscador, que no se toca ──────────
  // La DECISIÓN vive en `filtroClientes.js` (sin DOM, probada en `npm test`); aquí sólo están
  // los controles. Los rótulos llevan el marcador de microcopy: no hay texto aprobado.
  const FC = window.filtroClientes;
  let pestanaActiva = FC.POR_DEFECTO.pestana;
  let ordenActivo = FC.POR_DEFECTO.orden;

  const pestanas = createElement("div", "customers-tabs");
  const botonesPestana = FC.PESTANAS.map((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "customers-tab";
    b.dataset.pestana = p.id;
    b.textContent = FC.etiqueta(p);
    b.setAttribute("aria-pressed", String(p.id === pestanaActiva));
    b.addEventListener("click", () => {
      pestanaActiva = p.id;
      botonesPestana.forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.pestana === p.id)));
      pintar();
    });
    pestanas.appendChild(b);
    return b;
  });
  toolbar.appendChild(pestanas);

  const ordenSelect = document.createElement("select");
  ordenSelect.className = "input";
  ordenSelect.style.cssText = "max-width:220px";
  FC.ORDENES.forEach((o) => {
    const op = document.createElement("option");
    op.value = o.id;
    op.textContent = FC.etiqueta(o);
    ordenSelect.appendChild(op);
  });
  ordenSelect.value = ordenActivo;
  ordenSelect.addEventListener("change", () => { ordenActivo = ordenSelect.value; pintar(); });
  toolbar.appendChild(ordenSelect);

  outerCard.appendChild(toolbar);

  function setCount(text) { subtitle.textContent = text; }

  // Tabla edge-to-edge dentro del data-card
  const tableScroll = createElement("div", "table-scroll");
  outerCard.appendChild(tableScroll);
  const table = createElement("table", "table table--stack-mobile"); // feedback fundador 6-jul
  tableScroll.appendChild(table);
  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  [
    { t: "ID" },
    { t: "Nombre" },
    { t: "Teléfono" },
    { t: "Email", cls: "col-hide-mobile" },
    { t: "Notas", cls: "col-hide-mobile" },
    { t: "Alta", cls: "col-hide-mobile" },
    { t: "" },
  ].forEach(({ t, cls }) => {
    const th = document.createElement("th");
    th.textContent = t;
    if (cls) th.className = cls;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  outerCard.appendChild(table);

  // Alertas
  const alertBox = createElement("div", "alert");
  alertBox.style.display = "none";
  outerCard.appendChild(alertBox);

  function setAlert(type, msg) {
    alertBox.textContent = msg || "";
    alertBox.className = "alert";
    if (type === "success") alertBox.classList.add("success");
    if (type === "error") alertBox.classList.add("error");
    alertBox.style.display = (type || msg) ? "block" : "none";
  }

  // -------- Modal --------

  let modalBackdrop = null;
  let modalForm = null;
  let fieldName, fieldPhone, fieldEmail, fieldNotes;
  // SCRUM-578: UNA sola constante para los dos rotulos sin aprobar de este ticket.
  // ⚠️ Y una consecuencia medida en SCRUM-615 que hay que decir: el censo cuenta MARCAS, no
  // rotulos. Estas dos superficies comparten constante, asi que aprobar UNO de los dos textos
  // NO apaga el otro: habra que partirla el dia que el fundador escriba el primero.
  const MARCADOR_MICROCOPY = "[PENDIENTE microcopy oficial]";
  let fieldPrefijo = null;   // SCRUM-578 (a): el prefijo de pais, fuera del numero
  let avisoDuplicado = null; // SCRUM-578 (c): el aviso de identificador ya usado
  // SCRUM-575 (CONT-02) · CONSTANTE PROPIA, no la de CONT-05, y a proposito: son tickets
  // distintos. Compartirla ataria la aprobacion de este texto a la de los otros dos — el
  // fundador no podria firmar uno sin firmar los tres. Una constante por ticket es lo que
  // permite que se apaguen por separado.
  // ═════════════════════════════════════════════════════════════════════════════════════
  // SCRUM-575 (CONT-02) · EL AVISO DE NIF/CIF MAL FORMADO. Texto PROVISIONAL del asesor,
  // pendiente de confirmación del fundador (regla 30).
  //
  // 🔴 VA SIN MARCADOR, Y ES UNA DECISIÓN MEDIDA, no un descuido. Hasta hoy este aviso pintaba
  // literalmente «[PENDIENTE microcopy oficial]»: un profesional que tecleara mal su NIF veía en
  // pantalla un marcador de desarrollo. Desde que producción despliega en cuanto se mergea, un
  // marcador ya no es una nota interna — esta semana tres acabaron delante de un profesional.
  //
  // Entre enseñar un marcador y enseñar un texto provisional del asesor, gana el texto: dice la
  // verdad al profesional y se cambia en UNA línea (más su aserto) el día que el fundador lo
  // confirme o lo reescriba. El aserto está en `tests/scrum575b-nif-cableado.test.mjs`, comparado
  // con `===`, para que un retoque «de paso» no lo cambie sin que nadie se entere.
  // ═════════════════════════════════════════════════════════════════════════════════════
  const AVISO_NIF = "Ese NIF/CIF no es válido. Compruébalo.";
  let avisoNif = null;       // SCRUM-575 (CONT-02): el aviso de NIF/CIF mal formado
  let fieldWaOptOut = null; // J3: baja manual de WhatsApp desde la ficha
  let fieldTipoDestinatario = null; // SCRUM-69: plazo legal de la recapitulativa (art. 13 RD 1619/2012)
  let switchForma = null; // SCRUM-574: FORMA JURÍDICA (contactKind). NO es fieldTipoDestinatario.
  // SCRUM-579 (CONT-06): los cinco campos de la direccion de FACTURACION (no la de obra).
  let fieldBillingAddress, fieldBillingCity, fieldBillingPostalCode, fieldBillingProvince;
  let fieldBillingCountry = null;
  let fieldRecargo = null; // SCRUM-294-a: recargo de equivalencia del cliente (tres estados)
  let modalTitleEl = null;
  let modalSaveBtn = null;

  // ── SCRUM-578 (CONT-05) · el teléfono repartido entre prefijo y número ──────────────────
  //
  // Lo GUARDADO es una sola cadena. El formulario lo enseña en dos piezas, así que hay que
  // repartirlo al abrir y volver a juntarlo al guardar. Ni una fila se modifica por esto: (d)
  // dice que los duplicados que ya existen no se tocan, y eso incluye no migrarles el formato.

  /** Junta prefijo + número para el payload. Es lo que se envía; el servidor normaliza. */
  function telefonoCompleto() {
    const numero = fieldPhone.input.value.trim().replace(/\s/g, "");
    if (!numero) return "";
    // El respaldo NO es un literal: sale de la fuente declarada. Un `|| "34"` aquí es un número
    // escrito a mano en la lectura de un control, que es justo lo que caza el guard de SCRUM-311
    // — y tiene razón aunque aquí sea un prefijo y no una cantidad: el patrón es el mismo.
    const prefijo = (fieldPrefijo && fieldPrefijo.value) || prefijosPais.ESPANA.prefijo;
    // Si el profesional ya escribió el prefijo dentro del número, NO se duplica. Pasa al pegar
    // un número copiado de WhatsApp, y `3434…` sería un teléfono inventado.
    const yaLoLleva = numero.startsWith(prefijo) || numero.startsWith("+" + prefijo) || numero.startsWith("00" + prefijo);
    return yaLoLleva ? numero : prefijo + numero;
  }

  /**
   * Reparte un teléfono guardado entre el selector y el campo.
   *
   * Las filas viejas pueden estar guardadas SIN prefijo —es el defecto del ticket— así que si no
   * se reconoce ninguno, el número se deja entero y el selector se queda en España. Nunca se
   * adivina troceando a ciegas: partir mal un teléfono es peor que enseñarlo entero.
   */
  function repartirTelefono(guardado) {
    const limpio = String(guardado || "").replace(/[\s\-()]/g, "").replace(/^\+/, "");
    if (!fieldPrefijo) { fieldPhone.input.value = limpio; return; }
    const prefijos = prefijosPais.listaDePrefijos().map((p) => p.prefijo)
      .sort((a, b) => b.length - a.length); // el más largo primero: `1` no puede ganarle a `1809`
    for (const p of prefijos) {
      if (limpio.length > p.length && limpio.startsWith(p)) {
        fieldPrefijo.value = p;
        fieldPhone.input.value = limpio.slice(p.length);
        return;
      }
    }
    fieldPrefijo.value = prefijosPais.ESPANA.prefijo;
    fieldPhone.input.value = limpio;
  }

  /**
   * SCRUM-578 (c) · pregunta al servidor si alguno de los identificadores ya lo usa otro cliente.
   *
   * 🔴 ES UN AVISO, NO UN BLOQUEO: no deshabilita el botón de guardar y no impide nada. Hay casos
   * legítimos —marido y mujer con el mismo móvil, dos comunidades del mismo administrador con el
   * mismo email— y el que decide es el profesional.
   *
   * El NOMBRE no se envía, y ésa es la precisión 2 del fundador: «María García» saltaría
   * constantemente y el aviso sería ruido que nadie lee.
   */
  async function comprobarDuplicados() {
    if (!avisoDuplicado) return;
    const params = new URLSearchParams();
    const phone = telefonoCompleto();
    const email = fieldEmail.input.value.trim();
    const taxId = fieldTaxId.input.value.trim();
    if (phone) params.set("phone", phone);
    if (email) params.set("email", email);
    if (taxId) params.set("taxId", taxId);
    if (editingCustomer) params.set("excluirId", String(editingCustomer.id));

    // Sin ningún identificador que mirar no se pregunta: el aviso se apaga y ya está.
    if (!params.toString()) { avisoDuplicado.hidden = true; return; }

    try {
      const r = await apiRequest("/admin/customers/duplicados?" + params.toString());
      const hay = Array.isArray(r && r.coincidencias) && r.coincidencias.length > 0;
      avisoDuplicado.hidden = !hay;
    } catch (err) {
      // Si la comprobación falla, el aviso se APAGA en vez de quedarse encendido: enseñar un
      // aviso de duplicado porque se cayó la red sería peor que no enseñarlo.
      console.error("[customersView] comprobarDuplicados", err);
      avisoDuplicado.hidden = true;
    }
  }

  function buildModal() {
    modalBackdrop = createElement("div", "modal-overlay");
    const modal = createElement("div", "modal");

    // SCRUM-446: la cabecera sale del constructor compartido. `modalTitleEl` se sigue guardando
    // porque esta vista cambia el título entre «Nuevo cliente» y «Editar cliente».
    const header = cabeceraModal({ titulo: "Nuevo cliente", alCerrar: closeModal });
    modalTitleEl = header.querySelector(".modal-title");

    modal.appendChild(header);

    modalForm = document.createElement("form");

    const body = createElement("div", "modal-body");
    fieldName = createField("Nombre", "name", "text", true);
    // SCRUM-578 (CONT-05, punto a) · el prefijo sale a un SELECTOR y el número deja de llevarlo.
    //
    // 🔴 EL RÓTULO CAMBIA DE MARCADOR, y no es cosmética: «Teléfono (E.164 sin +)» describía un
    // campo donde el prefijo iba dentro. En cuanto el prefijo vive aparte, ese rótulo dice algo
    // FALSO — y encima era la prueba del ticket de que una regla escrita en una etiqueta no se
    // cumple: pedía «E.164 sin +» y se guardaron `+34 662629419` y `662629419` igual.
    // El texto nuevo es del fundador (regla 30): sale con marcador, sin palabra de trabajo.
    fieldPhone = createField(MARCADOR_MICROCOPY, "phone", "text");
    // El campo NO admite espacios (punto b): se limpian al escribir, además de normalizarse en
    // servidor. Aquí es comodidad; la regla de verdad está en el servidor, que es donde el ticket
    // demostró que tenía que estar.
    fieldPhone.input.addEventListener("input", () => {
      const limpio = fieldPhone.input.value.replace(/\s/g, "");
      if (limpio !== fieldPhone.input.value) fieldPhone.input.value = limpio;
    });
    // El selector se antepone dentro del mismo `.field`, en una fila con el número.
    fieldPrefijo = prefijosPais.selectorDePrefijo({});
    const filaTel = createElement("div", "campo-telefono");
    fieldPhone.wrapper.removeChild(fieldPhone.input);
    filaTel.appendChild(fieldPrefijo);
    filaTel.appendChild(fieldPhone.input);
    fieldPhone.wrapper.appendChild(filaTel);
    fieldEmail = createField("Email", "email", "email");
    // A20.4: cliente empresa (opcional) — el NIF además lo exigirá VeriFactu
    fieldLegalName = createField("Razón social (empresa, opcional)", "legalName", "text");
    fieldTaxId = createField("NIF/CIF (opcional)", "taxId", "text");
    // SCRUM-575 (CONT-02) · el aviso de NIF mal formado. Va PEGADO a su campo —y no arriba, como
    // el de duplicados— porque señala un error EN ESE campo: un mensaje lejos de su causa obliga
    // a buscarla. Nace oculto; sólo aparece con un valor escrito y mal.
    //
    // 🔴 EL RÓTULO «NIF/CIF (opcional)» NO CAMBIA, y es deliberado: sigue describiendo el campo
    // con exactitud. Lo único que este ticket toca es el MENSAJE DE ERROR, que es texto que el
    // profesional no había visto nunca. Tocar de más obliga al fundador a revisar lo que ya
    // estaba bien.
    avisoNif = createElement("div", "aviso-nif");
    avisoNif.textContent = AVISO_NIF;
    avisoNif.hidden = true;
    fieldTaxId.wrapper.appendChild(avisoNif);

    // Se comprueba al SALIR del campo: en cada tecla, un NIF a medio escribir estaría mal casi
    // siempre y el aviso parpadearía acusando mientras se teclea.
    fieldTaxId.input.addEventListener("blur", () => {
      // VACÍO = VÁLIDO. El campo es opcional y esta comprobación no lo convierte en obligatorio:
      // es el control que más fácil se rompe sin querer al añadir una validación.
      avisoNif.hidden = validarNifEspanol(fieldTaxId.input.value).valido;
    });
    fieldNotes = createField("Notas", "notes", null, false, true);

    // ═══════════════════════════════════════════════════════════════════════════════════
    // SCRUM-579 (CONT-06) · LA DIRECCIÓN DE FACTURACIÓN DEL CLIENTE.
    //
    // Hasta hoy este formulario NO tenía dirección NINGUNA: un fontanero no podía guardar dónde
    // le factura a su cliente. Y post-SIF el domicilio del destinatario es dato de factura, así
    // que hoy es una molestia y el día que se encienda `INVOICING_ES_ENABLED` es un problema con
    // documentos emitidos detrás.
    //
    // ⛔ UNA DIRECCIÓN, NO DOS. Ésta es la de FACTURACIÓN. La de la OBRA pertenece al DOCUMENTO
    // —un cliente puede tener tres obras— y es DOC-12: decisión del fundador (P2, 24-ago-2026).
    // Si alguien se ve añadiendo aquí una segunda dirección «de trabajo», está reconstruyendo un
    // modelo que ya se descartó con motivo.
    //
    // 🔴 LOS CINCO RÓTULOS ESTÁN APROBADOS Y VAN LITERALES (regla 30, fundador 2-sep-2026):
    // «Dirección» · «Población» · «Código postal» · «Provincia» · «País», en ese orden. NO se
    // abrevian («CP» no vale), no se reordenan y no llevan paréntesis ni aclaraciones — la
    // propuesta de este carril era «Dirección (calle y número)» y NO es la aprobada. Están
    // anotados en `docs/MICROCOPY_APROBADA_SIN_APLICAR.md`; si hace falta una aclaración, se
    // PIDE. Y hay un test que los compara con `===`.
    // ═══════════════════════════════════════════════════════════════════════════════════
    fieldBillingAddress = createField("Dirección", "billingAddress", "text");
    fieldBillingCity = createField("Población", "billingCity", "text");
    fieldBillingPostalCode = createField("Código postal", "billingPostalCode", "text");
    fieldBillingProvince = createField("Provincia", "billingProvince", "text");

    // EL PAÍS ES UN SELECTOR, Y NO CUESTA NI UN BYTE DE DATOS NUEVOS. Se reusa la lista de
    // `prefijosPais.js` (SCRUM-578), que ya resolvió este problema: el ISO viaja en una cadena,
    // el NOMBRE lo pone el navegador con `Intl.DisplayNames` y la bandera se calcula. Una
    // librería de países serían cientos de KB y además la decide el fundador (regla 36).
    //
    // Aquí sólo se usa `{iso, nombre}`: el prefijo telefónico no pinta nada en una dirección.
    const paisWrapper = createElement("div", "field");
    const paisLabel = document.createElement("label");
    paisLabel.textContent = "País";
    fieldBillingCountry = document.createElement("select");
    fieldBillingCountry.name = "billingCountry";
    fieldBillingCountry.className = "input";
    // La opción vacía es «no consta», y NO es lo mismo que España. Va primera para que un alta
    // sin tocar el selector no DECLARE un país que nadie ha dicho... salvo que `openModal` lo
    // ponga en ES, que es lo aprobado para el alta. Las dos cosas conviven: el vacío existe para
    // poder VOLVER a «no consta» y para los clientes que ya están sin país.
    const optVacia = document.createElement("option");
    optVacia.value = "";
    optVacia.textContent = "—";
    fieldBillingCountry.appendChild(optVacia);
    for (const p of prefijosPais.listaDePrefijos()) {
      const o = document.createElement("option");
      o.value = p.iso;
      o.textContent = p.nombre;
      fieldBillingCountry.appendChild(o);
    }
    paisWrapper.appendChild(paisLabel);
    paisWrapper.appendChild(fieldBillingCountry);

    // SCRUM-69 (FACT-1): sin banner ni prompt forzado (decisión fundador 23-jul) — solo aquí,
    // en la ficha. "Sin clasificar" = null (se trata como Particular al calcular el plazo,
    // el criterio más seguro, pero sin escribirlo en la BD hasta que el usuario lo confirme).
    const tipoWrapper = createElement("div", "field");
    const tipoLabel = document.createElement("label");
    tipoLabel.textContent = "Tipo de cliente";
    fieldTipoDestinatario = document.createElement("select");
    fieldTipoDestinatario.name = "tipoDestinatario";
    fieldTipoDestinatario.className = "input";
    fieldTipoDestinatario.innerHTML = `
      <option value="">Sin clasificar</option>
      <option value="PARTICULAR">Particular</option>
      <option value="EMPRESARIO">Empresa / profesional</option>
    `;
    tipoWrapper.appendChild(tipoLabel);
    tipoWrapper.appendChild(fieldTipoDestinatario);

    // SCRUM-294-a (A3) · EL RECARGO DE EQUIVALENCIA ES UNA PROPIEDAD DEL CLIENTE, no una casilla
    // que alguien marca en cada factura: un cliente en recargo lo esta SIEMPRE, y preguntarlo por
    // factura es pedirle al profesional que recuerde el regimen fiscal de su cliente.
    //
    // 🔴 UN SELECT DE TRES ESTADOS, Y NO UNA CASILLA. Una casilla solo sabe decir si/no, asi que
    // «no consta» se leeria como «declara que no» — y false es un valor LEGITIMO, el peor sitio
    // donde degradar en silencio (SCRUM-271: la casilla que se lee mal no puede caer a false).
    // Con el select, «no consta» es una opcion explicita y NULL viaja como NULL.
    //
    // MICROCOPY: marcador. Decirle en pantalla a que regimen pertenece su cliente es asesorarle, y
    // eso es dictamen del asesor, no producto. El dato se PIDE, no se explica.
    const recargoWrapper = createElement("div", "field");
    const recargoLabel = document.createElement("label");
    recargoLabel.textContent = "Recargo de equivalencia";
    fieldRecargo = document.createElement("select");
    fieldRecargo.name = "recargoEquivalencia";
    fieldRecargo.className = "input";
    fieldRecargo.innerHTML = `
      <option value="">No consta</option>
      <option value="si">Sí, está en recargo</option>
      <option value="no">No está en recargo</option>
    `;
    recargoWrapper.appendChild(recargoLabel);
    recargoWrapper.appendChild(fieldRecargo);

    // SCRUM-574 (CONT-01): el switch va PRIMERO — es la pregunta que decide qué campos tienen
    // sentido debajo, así que preguntarla después sería pedir el dato y luego cambiarle el
    // formulario bajo los pies. En Holded vive arriba a la derecha, fuera de las pestañas; aquí
    // el modal no tiene pestañas, y «arriba del todo» es el sitio equivalente.
    switchForma = switchFormaJuridica({
      alCambiar: (lado) => switchFormaJuridica.aplicarLado(lado, {
        legalName: fieldLegalName.wrapper,
        taxId: fieldTaxId.wrapper,
      }),
    });
    body.appendChild(switchForma.nodo);

    // SCRUM-578 (c) · el aviso de identificador ya usado. Va ARRIBA del todo, antes de los
    // campos: si estuviera al final, en un móvil quedaría por debajo del pliegue justo cuando el
    // profesional ya ha terminado de escribir y va a guardar.
    //
    // Nace oculto (`hidden`) y sólo aparece cuando el servidor dice que hay coincidencia. Texto
    // con marcador, sin palabra de trabajo: es del fundador (regla 30) y es lo que el profesional
    // lee para decidir si está creando un duplicado.
    avisoDuplicado = createElement("div", "alert aviso-duplicado");
    avisoDuplicado.textContent = MARCADOR_MICROCOPY;
    avisoDuplicado.hidden = true;
    body.appendChild(avisoDuplicado);

    body.appendChild(fieldName.wrapper);
    body.appendChild(fieldPhone.wrapper);
    body.appendChild(fieldEmail.wrapper);
    body.appendChild(fieldLegalName.wrapper);
    body.appendChild(fieldTaxId.wrapper);

    // SCRUM-578 (c) · se comprueba al SALIR del campo, no en cada tecla: preguntar por cada
    // pulsación haría una petición por letra y el aviso parpadearía mientras se escribe.
    // El prefijo dispara con `change` porque es un `<select>` y no se «sale» de él igual.
    fieldPhone.input.addEventListener("blur", comprobarDuplicados);
    fieldEmail.input.addEventListener("blur", comprobarDuplicados);
    fieldTaxId.input.addEventListener("blur", comprobarDuplicados);
    if (fieldPrefijo) fieldPrefijo.addEventListener("change", comprobarDuplicados);
    // SCRUM-579: el bloque va tras los datos fiscales y antes del resto. El ORDEN de los cinco
    // entre si esta aprobado: Direccion · Poblacion · Codigo postal · Provincia · Pais.
    body.appendChild(fieldBillingAddress.wrapper);
    body.appendChild(fieldBillingCity.wrapper);
    body.appendChild(fieldBillingPostalCode.wrapper);
    body.appendChild(fieldBillingProvince.wrapper);
    body.appendChild(paisWrapper);
    body.appendChild(tipoWrapper);
    body.appendChild(recargoWrapper);
    body.appendChild(fieldNotes.wrapper);

    // J3: baja manual de WhatsApp (hasta WA-0b el "BAJA" entrante no se procesa solo)
    const waWrapper = document.createElement("label");
    waWrapper.style.cssText = "display:flex;align-items:center;gap:8px;margin-top:4px;cursor:pointer;font-size:13px;color:var(--muted)";
    fieldWaOptOut = document.createElement("input");
    fieldWaOptOut.type = "checkbox";
    fieldWaOptOut.name = "waOptOut";
    waWrapper.appendChild(fieldWaOptOut);
    waWrapper.appendChild(document.createTextNode("Baja de WhatsApp: no enviarle más mensajes (el cliente lo pidió)"));
    body.appendChild(waWrapper);

    modalForm.appendChild(body);

    const footer = createElement("div", "modal-footer");
    const cancelBtn = createElement("button", "btn btn-secondary", "Cancelar");
    cancelBtn.type = "button";
    cancelBtn.addEventListener("click", closeModal);

    modalSaveBtn = createElement("button", "btn btn-primary", "Guardar");
    modalSaveBtn.type = "submit";

    footer.appendChild(cancelBtn);
    footer.appendChild(modalSaveBtn);

    modalForm.appendChild(footer);
    modal.appendChild(modalForm);
    modalBackdrop.appendChild(modal);

    document.body.appendChild(modalBackdrop);

    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) closeModal();
    });

    modalForm.addEventListener("submit", onModalSubmit);
  }

  /**
   * SCRUM-579 (CONT-06) · QUÉ VIAJA DE CADA CAMPO DE LA DIRECCIÓN.
   *
   * 🔴 VACÍO VIAJA COMO `null`, NUNCA COMO `""`. Es la regla entera, y es lo que hace que el
   * dato sirva para algo:
   *
   *   null  → NO CONSTA. Nadie ha dicho dónde factura este cliente.
   *   texto → lo declaró el profesional.
   *   `""`  → un tercer estado que NO significa nada y que nadie ha declarado.
   *
   * Si se guardara `""`, un cliente sin dirección y otro con la dirección en blanco quedarían
   * indistinguibles para cualquier lectura útil —un `IS NOT NULL` diría que el segundo TIENE
   * dirección— y el dato dejaría de valer para lo que existe: saber a quién le falta el
   * domicilio antes de que `INVOICING_ES_ENABLED` se encienda y sea dato de factura.
   *
   * Y recorta: una dirección que son tres espacios es «no consta» con disfraz.
   *
   * PURA y extraíble para que la suite la EJECUTE: la regla no puede vivir sólo dentro del
   * `submit`, porque leer un `submit` no ejecuta nada.
   */
  function direccionParaPayload(valor) {
    const t = String(valor == null ? '' : valor).trim();
    return t === '' ? null : t;
  }

  function openModal(mode, customer) {
    if (!modalBackdrop) {
      buildModal();
    }

    editingCustomer = mode === "edit" ? customer : null;
    modalTitleEl.textContent = mode === "edit" ? "Editar cliente" : "Nuevo cliente";
    modalSaveBtn.textContent = mode === "edit" ? "Guardar cambios" : "Guardar";

    modalForm.reset();

    // SCRUM-578: el aviso se APAGA al abrir. Sin esto arrastraria el del cliente anterior y
    // acusaria de duplicado a uno que no lo es — el peor falso positivo posible.
    if (avisoDuplicado) avisoDuplicado.hidden = true;
    if (avisoNif) avisoNif.hidden = true; // SCRUM-575: no arrastrar el aviso del cliente anterior
    if (fieldPrefijo) fieldPrefijo.value = prefijosPais.ESPANA.prefijo;
    // SCRUM-579: Espana por defecto EN EL FORMULARIO, nunca en la columna. La columna es
    // nullable y sin DEFAULT a proposito: un default habria declarado por el profesional que
    // sus clientes de siempre estan en Espana. Aqui es una comodidad del alta, y en edicion lo
    // sobrescribe lo guardado — incluido el vacio, que es «no consta».
    if (fieldBillingCountry) fieldBillingCountry.value = prefijosPais.ESPANA.iso;

    // SCRUM-574: `reset()` deja los dos radios sin marcar, que es exactamente el estado de un alta
    // nueva — nadie ha declarado nada todavía. En edición lo sobrescribe el bloque de abajo.
    switchForma.escribir(null);

    if (editingCustomer) {
      fieldName.input.value = editingCustomer.name || "";
      // SCRUM-578: lo guardado puede venir CON prefijo o sin el (filas viejas). Se reparte para
      // que el selector no mienta, y sin tocar la fila: (d) dice que no se migra nada.
      repartirTelefono(editingCustomer.phone || "");
      fieldEmail.input.value = editingCustomer.email || "";
      fieldNotes.input.value = editingCustomer.notes || "";
      fieldLegalName.input.value = editingCustomer.legalName || ""; // A20.4
      fieldTaxId.input.value = editingCustomer.taxId || "";
      fieldWaOptOut.checked = !!editingCustomer.waOptOut;
      fieldTipoDestinatario.value = editingCustomer.tipoDestinatario || ""; // SCRUM-69
      // SCRUM-294-a: los tres estados NO colapsan. `|| ""` habria mandado el `false` a «no consta».
      fieldRecargo.value = editingCustomer.recargoEquivalencia === true ? "si"
        : editingCustomer.recargoEquivalencia === false ? "no" : "";
      // SCRUM-574: la FORMA JURÍDICA sale de `contactKind` y de NADA MÁS. Nunca se deduce de
      // `tipoDestinatario` ni de si hay razón social — deducirla es el defecto que este ticket
      // cierra, y está prohibido expresamente (fundador, 24-ago-2026).
      // SCRUM-579: la dirección guardada manda, y el VACÍO se respeta. El `|| ""` es correcto
      // AQUÍ porque `null` y `""` se pintan igual en un input —no hay forma de pintar «no
      // consta» distinto de «vacío»—; lo que NO puede pasar es que el ENVÍO los confunda, y de
      // eso se encarga `direccionParaPayload`, que es donde la distinción sí es observable.
      fieldBillingAddress.input.value = editingCustomer.billingAddress || "";
      fieldBillingCity.input.value = editingCustomer.billingCity || "";
      fieldBillingPostalCode.input.value = editingCustomer.billingPostalCode || "";
      fieldBillingProvince.input.value = editingCustomer.billingProvince || "";
      fieldBillingCountry.value = editingCustomer.billingCountry || "";
      switchForma.escribir(editingCustomer.contactKind);
    }

    // Se aplica DESPUÉS de rellenar los campos, no antes: la regla mira si «razón social» tiene
    // algo escrito para no esconder un dato, y antes de rellenar todavía está vacío.
    switchFormaJuridica.aplicarLado(switchForma.leer(), {
      legalName: fieldLegalName.wrapper,
      taxId: fieldTaxId.wrapper,
    });

    modalBackdrop.style.display = "flex";
    fieldName.input.focus();
  }

  function closeModal() {
    if (modalBackdrop) {
      modalBackdrop.style.display = "none";
    }
    editingCustomer = null;
  }

  async function onModalSubmit(ev) {
    ev.preventDefault();
    setAlert(null, "");

    const payload = {
      name: fieldName.input.value.trim(),
      phone: telefonoCompleto(),
      email: fieldEmail.input.value.trim(),
      notes: fieldNotes.input.value.trim(),
      legalName: fieldLegalName.input.value.trim() || null, // A20.4
      taxId: fieldTaxId.input.value.trim() || null,
      // SCRUM-574: forma jurídica. `null` = nadie la ha declarado, y viaja como null hasta la BD:
      // NO se cae a un lado por defecto, que sería declarar por el profesional.
      contactKind: switchForma.leer(),
      waOptOut: !!(fieldWaOptOut && fieldWaOptOut.checked), // J3
      tipoDestinatario: fieldTipoDestinatario.value || null, // SCRUM-69
      // SCRUM-294-a: «» → null (no consta). NUNCA false por defecto: eso seria DECLARAR por el
      // profesional que su cliente no lleva recargo, y eso no lo ha dicho nadie.
      recargoEquivalencia: fieldRecargo.value === "si" ? true : fieldRecargo.value === "no" ? false : null,
      // SCRUM-579 (CONT-06): la dirección de FACTURACIÓN. La regla vive en
      // `direccionParaPayload`, que la suite ejecuta: vacío → `null`, nunca `""`.
      billingAddress: direccionParaPayload(fieldBillingAddress.input.value),
      billingCity: direccionParaPayload(fieldBillingCity.input.value),
      billingPostalCode: direccionParaPayload(fieldBillingPostalCode.input.value),
      billingProvince: direccionParaPayload(fieldBillingProvince.input.value),
      // El país pasa por la MISMA regla: «—» (la opción vacía) vale `""` y tiene que llegar como
      // `null`, o volver a «no consta» sería imposible una vez elegido un país.
      billingCountry: direccionParaPayload(fieldBillingCountry.value),
    };

    if (!payload.name) {
      setAlert("error", "El nombre es obligatorio.");
      fieldName.input.focus();
      return;
    }

    try {
      modalSaveBtn.disabled = true;
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, payload);
        setAlert("success", "Cliente actualizado correctamente.");
      } else {
        await createCustomer(payload);
        setAlert("success", "Cliente creado correctamente.");
      }
      closeModal();
      await loadCustomers(searchInput.value.trim());
    } catch (err) {
      setAlert("error", "Error guardando cliente: " + err.message);
    } finally {
      modalSaveBtn.disabled = false;
    }
  }

  // -------- Carga de clientes --------

  function openCustomer360(c) {
    if (window.renderAppView) {
      window.appState = window.appState || {};
      window.appState.customerId360 = c.id;
      window.renderAppView('customer-360');
    }
  }

  // SCRUM-581 · el lote que mandó el servidor, TAL CUAL. `pintar()` deriva de él lo que se ve.
  // Se guarda sin tocar para que cambiar de pestaña o de orden no vuelva a pedir a la red — y,
  // sobre todo, para que el orden `RECIENTES` siga siendo EXACTAMENTE el del servidor.
  let ultimoLote = [];
  let ultimaBusqueda = "";

  async function loadCustomers(searchText = "") {
    setAlert(null, "");
    setCount("Cargando…");
    uiSkeletonRows(tbody, 7, 6);
    try {
      ultimoLote = await getCustomers(searchText);
      ultimaBusqueda = searchText;
      pintar();
    } catch (err) {
      setCount("");
      setAlert("error", "Error cargando clientes: " + err.message);
    }
  }

  function pintar() {
    const searchText = ultimaBusqueda;
    const lote = Array.isArray(ultimoLote) ? ultimoLote : [];
    const data = FC.aplicar(lote, pestanaActiva, ordenActivo);
    {
      tbody.innerHTML = "";

      // El vacío de la PESTAÑA no es el vacío de la pantalla: hay clientes, pero ninguno
      // clasificado así. Sin esto saldría «Añade a tu primer cliente», que ahí sería falso.
      if (lote.length > 0 && data.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 7;
        td.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div>'
          + '<div class="empty-state-title"></div></div>';
        td.querySelector('.empty-state-title').textContent = FC.etiqueta(FC.VACIO_PESTANA);
        tr.appendChild(td);
        tbody.appendChild(tr);
        setCount("0 clientes");
        return;
      }

      if (!Array.isArray(data) || data.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 7;
        td.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div>'
          + '<div class="empty-state-title">' + (searchText ? 'Sin resultados para tu búsqueda' : 'Añade a tu primer cliente') + '</div>'
          + '<div class="empty-state-desc">' + (searchText ? 'Prueba con otro nombre, teléfono o email.' : 'Guárdalo una vez y podrás enviarle cotizaciones profesionales por WhatsApp en segundos.') + '</div>'
          + (searchText ? '' : '<button id="customers-empty-cta" class="btn-primary btn-sm" style="margin-top:14px">+ Añadir cliente</button>') + '</div>';
        tr.appendChild(td);
        tbody.appendChild(tr);
        const cta = td.querySelector('#customers-empty-cta');
        if (cta) cta.addEventListener('click', () => newBtn.click());
        setCount(searchText ? "0 resultados" : "0 clientes");
        return;
      }

      setCount(data.length + " cliente" + (data.length !== 1 ? "s" : ""));

      data.forEach((c) => {
        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        tr.addEventListener("click", () => openCustomer360(c));

        addCell(tr, "#" + c.id);
        addCell(tr, c.name || "Cliente sin nombre", "cell-title");
        addCell(tr, c.phone || "sin teléfono", "cell-date");
        addCell(tr, c.email || "", "col-hide-mobile");
        const notesCell = addCell(tr, c.notes || "", "col-hide-mobile");
        notesCell.style.cssText += "max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)";
        if (c.notes) notesCell.title = c.notes;
        const altaCell = addCell(tr, c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "", "col-hide-mobile");
        altaCell.style.color = "var(--muted)";

        const tdActions = document.createElement("td");
        tdActions.className = "cell-actions";
        const actionsDiv = document.createElement("div");
        actionsDiv.style.cssText = "display:flex;gap:6px;align-items:center";

        const editBtn = createElement("button", "btn-secondary btn-sm", "Editar");
        editBtn.type = "button";
        editBtn.addEventListener("click", (e) => { e.stopPropagation(); openModal("edit", c); });
        actionsDiv.appendChild(editBtn);

        const portalBtn = createElement("button", "btn-secondary btn-sm", "Portal");
        portalBtn.type = "button";
        portalBtn.title = "Copiar enlace del portal del cliente";
        portalBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            const res = await apiRequest(`/admin/customers/${c.id}/portal-url`);
            await navigator.clipboard.writeText(res.portalUrl);
            portalBtn.textContent = "¡Copiado!";
            setTimeout(() => { portalBtn.textContent = "Portal"; }, 2000);
          } catch (err) {
            setAlert("error", "Error al obtener el portal: " + err.message);
          }
        });
        actionsDiv.appendChild(portalBtn);

        const detailBtn = createElement("button", "btn-ghost btn-sm", "📊 Historial");
        detailBtn.type = "button";
        detailBtn.title = "Ver historial completo del cliente";
        detailBtn.addEventListener("click", (e) => { e.stopPropagation(); openCustomer360(c); });
        actionsDiv.appendChild(detailBtn);

        tdActions.appendChild(actionsDiv);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
      });
    }
  }

  function addCell(tr, value, cls) {
    const td = document.createElement("td");
    td.textContent = value ?? "";
    if (cls) td.className = cls;
    tr.appendChild(td);
    return td;
  }

  // -------- Eventos --------

  newBtn.addEventListener("click", () => openModal("create", null));

  let searchTimer = null;
  searchInput.addEventListener("input", () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadCustomers(searchInput.value.trim()), 300);
  });

  // Carga inicial
  loadCustomers();
}
