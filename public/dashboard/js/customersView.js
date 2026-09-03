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
  // SCRUM-588 (CONT-16) · el placeholder DICE LO QUE EL BUSCADOR HACE. Decía «nombre, teléfono o
  // email» y esta misma rama le añadió la referencia interna al `OR` de `listCustomers`: dejarlo
  // habría sido una frase falsa en pantalla, que es peor que una frase incompleta — el profesional
  // no probaría a buscar por su nº de expediente porque el campo le dice que no se puede.
  // Texto APROBADO por el asesor (2-sep-2026), literal y con «…» de UN carácter.
  searchInput.placeholder = "Buscar por nombre, teléfono, email o referencia…";
  searchInput.style.cssText = "min-width:160px;flex:1";
  toolbar.appendChild(searchInput);

  // ── SCRUM-581 (CONT-08) · pestañas y orden. SE SUMAN al buscador, que no se toca ──────────
  // La DECISIÓN vive en `filtroClientes.js` (sin DOM, probada en `npm test`); aquí sólo están
  // los controles. ✅ Los seis textos los APROBÓ el fundador el 2-sep-2026 y están fijados con
  // `===` en `tests/scrum581-pestanas-y-orden-clientes.test.mjs`: no se cambian sin pasar por él.
  const FC = window.filtroClientes;
  // ═════════════════════════════════════════════════════════════════════════════════════
  // SCRUM-584 (CONT-11) · QUÉ COLUMNAS HA ENCENDIDO EL PROFESIONAL.
  //
  // 🔴 EN EL NAVEGADOR, POR DISPOSITIVO, y es una decisión con su motivo: es preferencia de
  // VISTA, no dato de negocio. No justifica una columna en la base ni una ida al servidor en
  // la pantalla que tiene que ir rápida en móvil. Consecuencia asumida y escrita: NO VIAJA
  // entre dispositivos — quien cambie de teléfono vuelve a elegir, y ese coste se paga solo.
  //
  // ⚠️ `localStorage` puede no existir (navegador con almacenamiento bloqueado) o traer
  // basura. Los dos casos caen al MISMO sitio: la preferencia vacía, que es «lo de hoy». Una
  // pantalla que revienta al leer una preferencia es peor que una sin preferencia.
  const CLAVE_COLUMNAS = "yaqu.clientes.columnas";
  function leerColumnas() {
    try { return FC.normalizarColumnas(JSON.parse(localStorage.getItem(CLAVE_COLUMNAS))); }
    catch (_e) { return []; }
  }
  function guardarColumnas(ids) {
    try { localStorage.setItem(CLAVE_COLUMNAS, JSON.stringify(FC.normalizarColumnas(ids))); }
    catch (_e) { /* sin almacenamiento: la elección vale para esta sesión y ya */ }
  }
  let columnasEncendidas = leerColumnas();

  let pestanaActiva = FC.POR_DEFECTO.pestana;
  let ordenActivo = FC.POR_DEFECTO.orden;
  let etiquetaActiva = FC.POR_DEFECTO.etiqueta; // SCRUM-580 (CONT-07)

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

  // ── SCRUM-580 (CONT-07) · EL FILTRO POR ETIQUETA ────────────────────────────────────────
  // Aquí se cierra el recorte que CONT-08 dejó abierto a propósito: entonces un filtro por
  // etiqueta habría sido un control que no podía filtrar por nada.
  //
  // Las opciones salen de las etiquetas que ESTE merchant ya usa en SUS clientes —del lote que
  // el servidor mandó, nunca de otro merchant— y se recalculan en cada pintado: una etiqueta
  // recién escrita aparece en el selector sin recargar.
  //
  // ✅ MICROCOPY del asesor (provisional). El texto vive en la pieza, no aquí.
  const ETIQUETA_TODAS = FC.TEXTOS_ETIQUETAS.sinFiltro;
  const etiquetaSelect = document.createElement("select");
  etiquetaSelect.className = "input";
  etiquetaSelect.style.cssText = "max-width:220px";
  etiquetaSelect.addEventListener("change", () => {
    etiquetaActiva = etiquetaSelect.value || null;
    pintar();
  });
  toolbar.appendChild(etiquetaSelect);

  /** Repuebla el selector conservando lo elegido, o soltándolo si esa etiqueta ya no existe. */
  function repoblarEtiquetas(lote) {
    const usadas = FC.etiquetasUsadas(lote);
    // Si la etiqueta activa ha dejado de existir —se le quitó al último cliente que la tenía—,
    // se suelta el filtro. Dejarlo puesto enseñaría una lista vacía sin decir por qué.
    if (etiquetaActiva && !usadas.some((t) => t.toLocaleLowerCase("es") === String(etiquetaActiva).toLocaleLowerCase("es"))) {
      etiquetaActiva = null;
    }
    etiquetaSelect.innerHTML = "";
    const todas = document.createElement("option");
    todas.value = "";
    todas.textContent = ETIQUETA_TODAS;
    etiquetaSelect.appendChild(todas);
    usadas.forEach((t) => {
      const op = document.createElement("option");
      op.value = t;
      op.textContent = t;
      etiquetaSelect.appendChild(op);
    });
    etiquetaSelect.value = etiquetaActiva || "";
    // Sin ninguna etiqueta en la cartera, el selector no sirve de nada: se oculta en vez de
    // ofrecer un control con una sola opción que no filtra.
    etiquetaSelect.hidden = usadas.length === 0;
  }
  ordenSelect.addEventListener("change", () => { ordenActivo = ordenSelect.value; pintar(); });
  toolbar.appendChild(ordenSelect);

  // ═════════════════════════════════════════════════════════════════════════════════════
  // SCRUM-584 (CONT-11) · EL SELECTOR DE COLUMNAS. Va el ÚLTIMO de los cinco controles.
  //
  // 🔴 SIRVE PARA AÑADIR, no para quitar, y eso salió de MEDIR: a 360 px no hay scroll
  // horizontal (343 = 343) — la tabla es una pila de tarjetas—, y lo que pasa es que el CSS
  // esconde cuatro columnas y nadie podía encenderlas. El que vive del email o de las notas
  // no los veía en el móvil.
  //
  // Un `<details>` y no un desplegable: es el único control nativo que se abre y se cierra sin
  // JavaScript de posicionamiento, funciona con teclado y no se sale de la pantalla a 360 px.
  // Cero dependencias y cero componente nuevo.
  //
  // Las FIJAS no salen aquí: `Nombre` y las acciones no se pueden apagar, así que ofrecerlas
  // sería ofrecer algo que no se puede hacer. Es lo que hace imposible la salida muerta.
  const columnasBox = document.createElement("details");
  columnasBox.className = "columnas-selector";
  const columnasResumen = document.createElement("summary");
  columnasResumen.className = "input";
  columnasResumen.textContent = FC.TEXTOS_COLUMNAS.control;
  columnasBox.appendChild(columnasResumen);

  const columnasLista = createElement("div", "columnas-lista");
  FC.columnasElegibles().forEach((col) => {
    const fila = document.createElement("label");
    fila.className = "columnas-opcion";
    const casilla = document.createElement("input");
    casilla.type = "checkbox";
    casilla.dataset.columna = col.id;
    // Una columna que HOY se ve en la tarjeta nace marcada: la casilla describe lo que hay,
    // no lo que el profesional ha tocado. Si naciera desmarcada, «Teléfono» aparecería
    // apagado estando encendido — y F1 dice que nace visible SIEMPRE.
    casilla.checked = FC.claseDeColumna(col.id, columnasEncendidas) === "";
    casilla.addEventListener("change", () => {
      const marcadas = Array.from(columnasLista.querySelectorAll("input[type=checkbox]"))
        .filter((x) => x.checked).map((x) => x.dataset.columna);
      columnasEncendidas = FC.normalizarColumnas(marcadas);
      guardarColumnas(columnasEncendidas);
      pintarCabecera();
      pintar();
    });
    const texto = document.createElement("span");
    texto.textContent = col.texto;
    fila.appendChild(casilla);
    fila.appendChild(texto);
    columnasLista.appendChild(fila);
  });
  columnasBox.appendChild(columnasLista);
  toolbar.appendChild(columnasBox);

  /** Repinta SOLO las clases de la cabecera: los `<th>` no se recrean, se les cambia la clase. */
  function pintarCabecera() {
    FC.columnasDeLaTabla().forEach((col) => {
      const th = thPorColumna[col.id];
      if (th) th.className = FC.claseDeColumna(col.id, columnasEncendidas);
    });
  }

  outerCard.appendChild(toolbar);

  function setCount(text) { subtitle.textContent = text; }

  // Tabla edge-to-edge dentro del data-card
  const tableScroll = createElement("div", "table-scroll");
  outerCard.appendChild(tableScroll);
  const table = createElement("table", "table table--stack-mobile"); // feedback fundador 6-jul
  tableScroll.appendChild(table);
  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  // ── SCRUM-584 (CONT-11) · LA CABECERA SALE DE `FC.COLUMNAS`, no de una lista a mano ─────
  // Antes eran ocho objetos escritos aquí, y su número estaba COPIADO en dos `colSpan`. Al
  // entrar «Etiquetas» hubo que recalcular los dos a mano. Ahora cabecera, celdas y `colSpan`
  // salen del MISMO sitio, así que no pueden descuadrarse entre sí — y un vacío descuadrado
  // no lo ve ninguna tanda.
  const thPorColumna = {};
  FC.columnasDeLaTabla().forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col.texto;
    th.dataset.columna = col.id;
    th.className = FC.claseDeColumna(col.id, columnasEncendidas);
    thPorColumna[col.id] = th;
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

  // -------- Modal: EL MISMO FORMULARIO QUE USA EL ALTA DESDE UN DOCUMENTO --------
  //
  // SCRUM-591 (DOC-01) · el formulario ya no vive dentro de esta función: vive en la IIFE del
  // final del fichero, y lo comparten esta pantalla y el selector de cliente de los documentos.
  //
  // 🔴 NO SE MOVIÓ POR GUSTO. Medido: `buildModal()` eran 278 líneas y usaba 33 símbolos de este
  // cierre, así que NO era invocable desde fuera. La alternativa era un SEGUNDO formulario en la
  // vista del documento — dos altas que divergen, y el aviso de duplicado de CONT-05 quedándose
  // en una sola. Lo que estorbaba era el CIERRE, no el fichero: por eso se queda aquí, donde los
  // guards de CONT-01, CONT-02, CONT-05, CONT-06, CONT-07 y SCRUM-692 lo leen.
  //
  // Esta vista le presta sus dos costuras: su caja de avisos y su recarga de tabla. El documento
  // no le presta ninguna, porque no tiene tabla que recargar.
  window.altaClienteModal.configurar({
    avisar: setAlert,
    trasGuardar: function () { return loadCustomers(searchInput.value.trim()); },
  });
  const openModal = window.altaClienteModal.abrir;


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
    // SCRUM-580: los TRES se encadenan — pestaña, etiqueta y orden— sobre el lote que ya viene
    // filtrado por el BUSCADOR desde el servidor. Los cuatro a la vez, y ninguno sustituye a otro.
    repoblarEtiquetas(lote);
    const data = FC.aplicar(lote, pestanaActiva, ordenActivo, etiquetaActiva);
    {
      tbody.innerHTML = "";

      // El vacío de la PESTAÑA no es el vacío de la pantalla: hay clientes, pero ninguno
      // clasificado así. Sin esto saldría «Añade a tu primer cliente», que ahí sería falso.
      if (lote.length > 0 && data.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = FC.colSpanDeLaTabla(); // SCRUM-584: del mismo sitio que la cabecera
        // SCRUM-581 · DOS líneas (microcopy aprobada, 2-sep-2026). Se reutiliza el componente
        // de vacío que ya existe —`.empty-state-title` y `.empty-state-desc`—: cero tokens nuevos.
        // Con `textContent` y no concatenando en el `innerHTML`: el texto es de la pieza, no del
        // markup, y así no hay que acordarse de escaparlo nunca.
        td.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div>'
          + '<div class="empty-state-title"></div><div class="empty-state-desc"></div></div>';
        td.querySelector('.empty-state-title').textContent = FC.etiqueta(FC.VACIO_PESTANA);
        td.querySelector('.empty-state-desc').textContent = FC.subtitulo(FC.VACIO_PESTANA);
        tr.appendChild(td);
        tbody.appendChild(tr);
        setCount("0 clientes");
        return;
      }

      if (!Array.isArray(data) || data.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = FC.colSpanDeLaTabla(); // SCRUM-584: del mismo sitio que la cabecera
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
        addCell(tr, c.email || "", FC.claseDeColumna("email", columnasEncendidas));
        const notesCell = addCell(tr, c.notes || "", FC.claseDeColumna("notas", columnasEncendidas));
        notesCell.style.cssText += "max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)";
        if (c.notes) notesCell.title = c.notes;
        // SCRUM-580 (CONT-07) · las etiquetas, con `.badge .badge-slate` — el componente que YA
        // existe en el inventario. Cero tokens nuevos y cero estilos inventados.
        // Con `textContent` por etiqueta y no concatenando markup: el texto lo escribe el
        // profesional, y meterlo en un `innerHTML` sería una inyección con su nombre.
        const tagsCell = document.createElement("td");
        tagsCell.className = FC.claseDeColumna("etiquetas", columnasEncendidas);
        const susTags = FC.tagsDe(c);
        if (susTags.length === 0) {
          tagsCell.textContent = "";
        } else {
          const caja = document.createElement("div");
          caja.style.cssText = "display:flex;flex-wrap:wrap;gap:4px";
          susTags.forEach((t) => {
            const chip = document.createElement("span");
            chip.className = "badge badge-slate";
            chip.textContent = t;
            caja.appendChild(chip);
          });
          tagsCell.appendChild(caja);
          tagsCell.title = susTags.join(", ");
        }
        tr.appendChild(tagsCell);

        const altaCell = addCell(tr, c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "", FC.claseDeColumna("alta", columnasEncendidas));
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



// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-591 (DOC-01) · EL FORMULARIO DE ALTA DE CLIENTE — UNO SOLO, PARA LOS DOS CAMINOS
//
// LA VÍCTIMA: un fontanero hace un presupuesto con el cliente delante; al llegar al selector de
// Contacto el cliente no está, y hasta hoy tenía que ABANDONAR el documento a medias, irse a
// Clientes, darlo de alta y volver a empezar. Eso rompe «presupuesto en 30 segundos».
//
// 🔴 LO QUE ESTE BLOQUE IMPIDE: que naciera un SEGUNDO formulario en la vista del documento. Dos
// altas divergen, y el aviso de duplicado de CONT-05 se habría quedado en una sola — justo donde
// más duplicados nacen, que es el alta rápida con el cliente delante.
//
// ── POR QUÉ UNA IIFE, Y POR QUÉ EN ESTE MISMO FICHERO ────────────────────────────────────
// El estorbo era el CIERRE de `renderCustomersView`, no el fichero: `buildModal()` usaba 33 de
// sus símbolos y por eso no se podía llamar desde fuera. Sacarlo a un fichero NUEVO se probó y
// se descartó con la medida delante: dejaba en rojo 27 guards de ocho tickets cerrados
// (CONT-01, CONT-02, CONT-05, CONT-06, CONT-07, SCRUM-588, 615, 692) que leen ESTE fichero por
// ruta. Mover el código de sitio no era el trabajo; sacarlo del cierre, sí.
//
// Y no se suben los nombres al ámbito global: `fieldName`, `fieldPhone`… son genéricos, y en
// scripts clásicos eso es sembrar colisiones para la siguiente vista — lo que vigila
// `dashboard-colision-declaraciones`. La IIFE publica UN nombre: `window.altaClienteModal`.
// ═════════════════════════════════════════════════════════════════════════════════════════
(function () {
  const FC = window.filtroClientes;

  // Las dos COSTURAS. Por defecto no hacen nada, y es lo correcto: un documento abre este
  // formulario sin tener caja de avisos ni tabla que recargar.
  let avisar = function () {};
  let trasGuardar = async function () {};

  // De un solo uso: quien abre desde un documento espera el cliente creado.
  let alGuardarUnaVez = null;

  let editingCustomer = null;
  let fieldLegalName, fieldTaxId; // A20.4

  // -------- Modal --------

  let modalBackdrop = null;
  let modalForm = null;
  let fieldName, fieldPhone, fieldEmail, fieldNotes;
  let fieldTags; // SCRUM-580 (CONT-07)
  let fieldInternalRef; // SCRUM-588 (CONT-16)
  // ═════════════════════════════════════════════════════════════════════════════════════
  // SCRUM-575 (2-sep-2026) · LA CONSTANTE COMPARTIDA SE PARTE EN DOS, Y ERA LO QUE FALTABA.
  //
  // SCRUM-578 dejó UNA constante para dos superficies —el rótulo del teléfono y el aviso de
  // duplicado— y SCRUM-615 dejó escrito el problema: «aprobar UNO de los dos textos NO apaga el
  // otro: habrá que partirla el día que el fundador escriba el primero». Ese día es hoy.
  //
  // 🔴 PARTIRLA NO ES ALCANCE EXTRA: sin partirla, poner el rótulo aprobado del teléfono le
  // cambiaría el texto AL AVISO DE DUPLICADO, que dice otra cosa completamente distinta. Una
  // constante por superficie es lo que permite firmar una sin firmar la otra.
  //
  // Los dos textos están APROBADOS (asesor, 2-sep-2026; el del aviso, provisional a la espera de
  // confirmación del fundador). Van SIN marcador y fijados con `===` en
  // `tests/scrum575b-nif-cableado.test.mjs`.
  // ═════════════════════════════════════════════════════════════════════════════════════

  /**
   * El rótulo del teléfono. A SECAS, y el motivo es medible: el rótulo viejo pedía un FORMATO
   * —el de la norma internacional, sin el signo de suma— que YA NO SE PIDE, porque lo impone el
   * control de al lado, que muestra «🇪🇸 España +34». Y CONT-05 demostró EN ESTA MISMA PANTALLA
   * que una regla escrita en una etiqueta no se cumple: se guardaron los dos formatos el mismo día.
   *
   * ⚠️ El texto exacto de aquel rótulo NO se transcribe aquí a propósito: `scrum578` prohíbe esa
   * cadena en la vista y su filtro sólo salta los comentarios de línea, no los de bloque. Un
   * comentario que la citara haría saltar ese guard en falso.
   *
   * Se descartó «Teléfono (opcional)»: Email también es opcional y no lo dice, así que añadirlo
   * aquí no arregla la inconsistencia — la reparte.
   */
  const ROTULO_TELEFONO = "Teléfono";

  /**
   * El aviso de identificador ya usado. PROVISIONAL del asesor, pendiente de confirmación del
   * fundador (regla 30).
   *
   * 🔴 ES UN AVISO, NO UN BLOQUEO, Y EL TEXTO NO PUEDE SONAR A BLOQUEO. Hay casos legítimos
   * —marido y mujer con el mismo móvil, dos comunidades del mismo administrador con el mismo
   * email— y el que decide es el profesional: por eso dice «revísalo» y no «ya existe».
   * Sirve para teléfono, email y NIF sin nombrar ninguno, que es lo que lo hace un solo texto.
   *
   * Caja: 63 caracteres sobre los ~45 por línea medidos a 360 px → dos líneas, en un aviso que
   * vive ARRIBA del modal y donde caben.
   */
  const AVISO_DUPLICADO = "Ese dato ya lo tiene otro cliente. Revísalo por si es un duplicado.";  let fieldPrefijo = null;   // SCRUM-578 (a): el prefijo de pais, fuera del numero
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
    // ── SCRUM-580 (CONT-07) · LAS ETIQUETAS ───────────────────────────────────────────────
    // ✅ MICROCOPY APROBADA por el ASESOR el 2-sep-2026, PROVISIONAL a la espera del fundador.
    // Los cuatro textos viven en `filtroClientes.js` (`TEXTOS_ETIQUETAS`) y están fijados con
    // `===` en `tests/scrum580-tags-por-contacto.test.mjs`: no se cambian sin pasar por ahí.
    // Sin marcador en pantalla — y que no se pinte NO significa que estén firmados por el
    // fundador: eso lo dice `SIN_APROBAR`.
    //
    // Un input de texto separado por comas, y no un componente de chips: es lo que la casa ya
    // sabe pintar (vanilla, sin dependencias) y lo que un profesional teclea más rápido en un
    // móvil. Un editor de chips es un componente nuevo y eso es propuesta de inventario (AB3).
    fieldTags = createField(FC.TEXTOS_ETIQUETAS.rotulo, "tags", "text");
    fieldTags.input.placeholder = FC.TEXTOS_ETIQUETAS.placeholder;
    body.appendChild(fieldTags.wrapper);
    // SCRUM-578 (CONT-05, punto a) · el prefijo sale a un SELECTOR y el número deja de llevarlo.
    //
    // 🔴 EL RÓTULO CAMBIA DE MARCADOR, y no es cosmética: «Teléfono (E.164 sin +)» describía un
    // campo donde el prefijo iba dentro. En cuanto el prefijo vive aparte, ese rótulo dice algo
    // FALSO — y encima era la prueba del ticket de que una regla escrita en una etiqueta no se
    // cumple: pedía «E.164 sin +» y se guardaron `+34 662629419` y `662629419` igual.
    // El texto nuevo es del fundador (regla 30): sale con marcador, sin palabra de trabajo.
    fieldPhone = createField(ROTULO_TELEFONO, "phone", "text");
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
    // ═══════════════════════════════════════════════════════════════════════════════════
    // SCRUM-588 (CONT-16) · LA REFERENCIA INTERNA, y va ANTES de «Notas» a propósito.
    //
    // Es el número con el que el profesional conoce a este cliente: el expediente de la
    // aseguradora, la finca del administrador, el código del sistema viejo. Hasta hoy lo metía
    // justo en «Notas» —el campo de debajo— y luego no lo podía buscar de forma fiable. Ponerlo
    // encima es lo que hace que la próxima vez no acabe ahí.
    //
    // 🔴 LOS DOS TEXTOS ESTÁN APROBADOS Y VAN LITERALES (regla 30, asesor 2-sep-2026). Medidos en
    // navegador a 360 px: el rótulo ocupa 103 px de 336, y el placeholder 219 px de los 308
    // útiles del input. Ninguno parte en dos líneas.
    //
    // ⚠️ LA AYUDA VA COMO `placeholder` Y ES UN HUECO DECLARADO, no una solución: `createField` no
    // admite línea de ayuda y no hay clase de hint en el CSS, así que ponerla debajo sería un
    // componente nuevo del inventario AB3. Se acepta porque **el significado lo lleva el RÓTULO** y
    // el placeholder sólo da ejemplos — un placeholder desaparece en cuanto se teclea, así que el
    // día que la ayuda tenga que llevar una REGLA, esto ya no valdrá.
    fieldInternalRef = createField("Referencia interna", "internalRef", "text");
    fieldInternalRef.input.placeholder = "Nº de expediente, finca, código…";

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
    avisoDuplicado.textContent = AVISO_DUPLICADO;
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
    // SCRUM-588 (CONT-16): la referencia interna va JUSTO ENCIMA de «Notas», que es donde el
    // profesional la metía hasta hoy por no tener sitio propio.
    body.appendChild(fieldInternalRef.wrapper);
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

  /**
   * SCRUM-580 (CONT-07) · el texto del campo → lo que viaja al servidor.
   *
   * 🔴 «AUSENTE ≠ VACÍO»: sin etiquetas viaja `null`, nunca `[]` ni `""`. Si viajara `[]`, la
   * columna diría «este cliente tiene etiquetas» y el filtro se construiría sobre esa mentira.
   *
   * ⚠️ Esto NO es la regla: la regla vive en el SERVIDOR (`normalizarTags`), que es donde no se
   * puede esquivar. Aquí sólo se evita mandar ruido, y hacerlo en los dos lados es lo mismo que
   * ya hace `direccionParaPayload` justo arriba.
   */
  function tagsParaPayload(valor) {
    const partes = String(valor == null ? '' : valor)
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t !== '');
    return partes.length ? partes : null;
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
      // SCRUM-588: si esto no estuviera, editar un cliente BORRARIA su referencia al guardar —
      // el campo saldria vacio y el payload mandaria null encima del dato bueno.
      fieldInternalRef.input.value = editingCustomer.internalRef || "";
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
      // SCRUM-580 (CONT-07) · 🔴 EL QUINTO ESLABÓN, VISTO DESDE AQUÍ. Si el `select` del
      // servidor no trajera `tags`, esta línea pintaría el campo VACÍO sobre un cliente que SÍ
      // las tiene, el profesional las reescribiría y nadie se enteraría. Por eso el test relee
      // con `getCustomer` en vez de conformarse con «se guarda».
      fieldTags.input.value = (Array.isArray(editingCustomer.tags) ? editingCustomer.tags : []).join(", ");
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
    avisar(null, "");

    let creado = null;
    const payload = {
      name: fieldName.input.value.trim(),
      phone: telefonoCompleto(),
      email: fieldEmail.input.value.trim(),
      notes: fieldNotes.input.value.trim(),
      legalName: fieldLegalName.input.value.trim() || null, // A20.4
      taxId: fieldTaxId.input.value.trim() || null,
      // SCRUM-588: «ausente ≠ vacio». Lo vacio viaja como null, NUNCA como cadena vacia: una
      // cadena vacia diria «tiene referencia, y es nada», que no es lo mismo que no tenerla.
      internalRef: fieldInternalRef.input.value.trim() || null,
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
      // SCRUM-580 (CONT-07): «ausente ≠ vacío». Sin etiquetas viaja `null`, nunca `[]` ni `""`.
      // La regla de verdad vive en el SERVIDOR (`normalizarTags`), que es donde no se puede
      // esquivar; esto es la mitad del navegador y hace lo mismo para no mandar ruido.
      tags: tagsParaPayload(fieldTags.input.value),
      billingAddress: direccionParaPayload(fieldBillingAddress.input.value),
      billingCity: direccionParaPayload(fieldBillingCity.input.value),
      billingPostalCode: direccionParaPayload(fieldBillingPostalCode.input.value),
      billingProvince: direccionParaPayload(fieldBillingProvince.input.value),
      // El país pasa por la MISMA regla: «—» (la opción vacía) vale `""` y tiene que llegar como
      // `null`, o volver a «no consta» sería imposible una vez elegido un país.
      billingCountry: direccionParaPayload(fieldBillingCountry.value),
    };

    if (!payload.name) {
      avisar("error", "El nombre es obligatorio.");
      fieldName.input.focus();
      return;
    }

    try {
      modalSaveBtn.disabled = true;
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, payload);
        avisar("success", "Cliente actualizado correctamente.");
      } else {
        // SCRUM-591 · se GUARDA lo que devuelve el servidor: el alta desde un documento
        // necesita el `id` para dejarlo seleccionado, y no se lo puede inventar.
        creado = await createCustomer(payload);
        avisar("success", "Cliente creado correctamente.");
      }
      closeModal();
      await trasGuardar();
      // SCRUM-591 · y si quien abrió esperaba el cliente —el selector de un documento—, se le
      // entrega AQUÍ: después de que el servidor lo haya confirmado, nunca antes. Es de UN
      // SOLO USO: se limpia, para que el siguiente alta normal no dispare al anterior.
      if (creado && alGuardarUnaVez) { const cb = alGuardarUnaVez; alGuardarUnaVez = null; cb(creado); }
    } catch (err) {
      avisar("error", "Error guardando cliente: " + err.message);
    } finally {
      modalSaveBtn.disabled = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // LA SUPERFICIE: un solo nombre en `window`, y las dos entradas al MISMO formulario.
  // ═══════════════════════════════════════════════════════════════════════════════════════
  window.altaClienteModal = {
    /** La vista de Clientes le presta su caja de avisos y su recarga de tabla. */
    configurar: function (opciones) {
      if (opciones && opciones.avisar) avisar = opciones.avisar;
      if (opciones && opciones.trasGuardar) trasGuardar = opciones.trasGuardar;
    },

    /** La entrada de siempre: los dos botones de la tabla de Clientes. */
    abrir: openModal,

    /**
     * SCRUM-591 · la entrada NUEVA: alta desde el selector de un documento.
     *
     * Abre EL MISMO formulario —con su switch Empresa/Persona (CONT-01), su validación de NIF
     * (CONT-02) y su aviso de duplicado (CONT-05)— y entrega el cliente creado a quien lo pidió,
     * para que lo deje seleccionado sin recargar la página.
     *
     * @param {{nombre?: string, alGuardar?: (cliente: any) => void}} opciones
     */
    abrirNuevo: function (opciones) {
      const o = opciones || {};
      alGuardarUnaVez = typeof o.alGuardar === 'function' ? o.alGuardar : null;
      openModal('create', null);
      // El prellenado va DESPUÉS de abrir: `openModal` hace `reset()` y lo borraría.
      if (o.nombre && fieldName && fieldName.input) {
        fieldName.input.value = o.nombre;
        fieldName.input.focus();
      }
    },

    cerrar: function () { alGuardarUnaVez = null; closeModal(); },
  };
})();
