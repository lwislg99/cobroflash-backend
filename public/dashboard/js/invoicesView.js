// public/dashboard/js/invoicesView.js

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-375 · EL RESULTADO DEL MARCADO EN BLOQUE, DECIDIDO EN UN SITIO Y SIN DOM
//
// Vive aquí arriba, puro y exportado, porque el fallo que cierra este ticket NO se ve leyendo la
// pantalla: se ve preguntando «¿qué dice la pantalla cuando la escritura fue bien y la recarga
// no?». Dentro del listener eso no se puede provocar sin un navegador; aquí sí, y el test lo
// hace con las tres combinaciones.
//
// Los tres tonos son distintos A PROPÓSITO: `error` es que NO se marcó, `warning` es que SÍ se
// marcó y la lista puede estar vieja, `success` es que todo fue bien. Un `.alert` sin tono está
// OCULTO por CSS (styles.css:1667), así que el tono no es decoración.
const COPY_BULK_PAGADAS = {
  // FIRMADO por el asesor en SCRUM-373. Solo se dice cuando la ESCRITURA falló.
  escrituraFallida: 'No se han podido marcar como pagadas. Vuelve a intentarlo.',
  // SIN APROBAR (regla 30): microcopy nueva de SCRUM-375, va con marcador hasta que se firme.
  recargaFallida: 'Se han marcado como pagadas, pero la lista no se ha podido actualizar. Recárgala para verla al día.',
};

/** El plural de verdad, sin `(s)`: cambia el sustantivo y el participio. */
function textoMarcadas(n) {
  return n === 1 ? '✓ 1 factura marcada como pagada.' : `✓ ${n} facturas marcadas como pagadas.`;
}

/**
 * Qué se le dice al profesional según lo que pasó. PURO: no toca DOM ni red.
 *
 * La regla que codifica, y es la del ticket: **un fallo de lectura no se presenta como un fallo de
 * escritura**. Si `escrituraOk`, el mensaje dice que se marcaron — pase lo que pase con la recarga.
 */
function resultadoMarcadoEnBloque({ escrituraOk, recargaOk, marcadas }) {
  if (!escrituraOk) return { tono: 'error', texto: COPY_BULK_PAGADAS.escrituraFallida, seMarcaron: false };
  if (!recargaOk) return { tono: 'warning', texto: COPY_BULK_PAGADAS.recargaFallida, seMarcaron: true };
  return { tono: 'success', texto: textoMarcadas(marcadas), seMarcaron: true };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { COPY_BULK_PAGADAS, resultadoMarcadoEnBloque, textoMarcadas };
}

async function fetchInvoices(options = {}) {
    const { status = 'all', search = '', dateFrom = '', dateTo = '' } = options;

    const url = new URL('/admin/invoices', window.location.origin);
    if (status && status !== 'all') url.searchParams.set('status', status);
    if (search)   url.searchParams.set('search', search);
    if (dateFrom) url.searchParams.set('dateFrom', dateFrom);
    if (dateTo)   url.searchParams.set('dateTo', dateTo);

    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Error cargando facturas');
    return soloFacturas(await res.json());
  }

  // ── SCRUM-442 (B4 · punto 1) · «Menú Facturas = solo facturas» ─────────────────────────────
    //
    // Hasta hoy esta lista mezclaba facturas con JUSTIFICANTES DE COBRO. Son dos documentos con dos
    // significados legales distintos —uno es el documento fiscal, el otro acredita que se recibió
    // el dinero— y el profesional que abre esta pantalla para contar cuántas ha emitido este mes
    // lee un número que no es el que cree. Es un dato que se mira antes de hablar con la gestoría.
    //
    // 🔴 SE CLASIFICA CON `tipoDeFactura`, NUNCA CON UNA COPIA. Es la MISMA función que reparte la
    // pila del Trabajo (G4), alimenta el bloque DINERO del rail y ordena la pantalla de Cobros. Un
    // `startsWith('J-')` a mano aquí sería la cuarta forma de decidir lo mismo, y el día que una
    // cambie el documento se irá a dos sitios o a ninguno.
    //
    // Y se llama SIN guarda `typeof`: si `tipoDeFactura` no estuviera, esto tiene que reventar
    // ruidosamente. Un filtro que se desactiva solo devolvería la lista mezclada **en silencio**,
    // que es justo el defecto que este cambio cierra.
    //
  // Las RECTIFICATIVAS se quedan: son facturas (`type === 'R1'`). Solo salen los justificantes,
  // y su sitio es la pantalla de Cobros (SCRUM-285), donde se pintan con su número y su tipo.
  //
  // Va como función CON NOMBRE y publicada, no como un `.filter()` incrustado en la carga: la vista
  // de Facturas todavía no se puede pintar en el banco de SCRUM-417, así que sin esto la única
  // forma de «probar» el filtro sería mirar que la lista sale vacía — y una vista que revienta
  // también sale vacía. Ese verde hueco apareció al construir esto y lo cazó el control positivo.
  function soloFacturas(documentos) {
    return (Array.isArray(documentos) ? documentos : [])
      .filter((doc) => tipoDeFactura(doc) !== 'justificante');
  }

  if (typeof window !== 'undefined') window.soloFacturas = soloFacturas;

  // SCRUM-69 (FACT-1): bandeja "pendientes de facturar" — albaranes firmados y valorados sin
  // facturar, agrupados por cliente→mes, con semáforo de plazo legal (art. 13 RD 1619/2012).
  async function fetchPendientesFacturar() {
    const res = await fetch('/admin/albaranes/pendientes-facturar', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Error cargando pendientes de facturar');
    const data = await res.json();
    return data.clientes || [];
  }

  function fmtFechaEs(isoDate) {
    if (!isoDate) return '—';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  }

  const SEMAFORO_META = {
    verde: { pillClass: 'status-pill-accepted', label: 'AL DÍA' },
    ambar: { pillClass: 'status-pill-pending',  label: 'PLAZO PRÓXIMO' },
    rojo:  { pillClass: 'status-pill-rejected', label: 'PLAZO VENCIDO' },
  };

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // SCRUM-748 · UN «NO LO SÉ» NO SE PINTA COMO ÉXITO.
  //
  // Aquí se decidía con `SEMAFORO_META[grupo.semaforo] || SEMAFORO_META.verde`, así que
  // CUALQUIER estado que el servidor no supiera nombrar —uno nuevo, uno vacío, un `null`—
  // salía en pantalla como **«AL DÍA»**. Medido ejecutando esa línea: los cinco casos
  // desconocidos pintaban lo mismo que el bueno.
  //
  // 🔴 HOY NO DISPARA, y por eso es un guard que se abre solo (SCRUM-537). El semáforo tiene
  // tres estados y los tres están en el mapa. Pero el disparador ya está en el plan: el día
  // que exista un CUARTO —cuyo único propósito sería no afirmar lo que no se sabe— el
  // navegador lo convertiría en la mentira que ese estado venía a evitar. Se cierra ahora,
  // que es barato, y no el día que muerda.
  //
  // EL CRITERIO NO SE INVENTA: es el de `invoiceStatusMeta` en `api.js`, que ante un estado
  // sin mapear NO elige uno — construye una insignia neutra con el código a la vista. Lo
  // desconocido SE VE. Ahí está escrito por qué, y es el reverso exacto de SCRUM-641: en un
  // aviso de error enseñar el código ES el defecto; en un rótulo de estado, ESCONDERLO lo es.
  //
  // ⚠️ EL RÓTULO NO ESTÁ ESCRITO. Va con marcador hasta que lo firme quien puede: no es una
  // frase que pueda inventar quien programa (regla 30). Y no se construye el cuarto estado:
  // eso es del fundador (regla 27). Esto sólo deja de mentir sobre él.
  // ═══════════════════════════════════════════════════════════════════════════════════════
  const INV_MARCADOR_MICROCOPY = '[PENDIENTE microcopy oficial]';

  /** Cuántas ranuras estrena esta pantalla SIN la firma del fundador. UNA: el rótulo de abajo. */
  const INV_SIN_APROBAR = 1;

  /**
   * La insignia de un semáforo. Un estado que no está en el mapa NO se disfraza del más
   * inocente: se pinta con marcador y con su código a la vista, y se avisa por consola —donde
   * lo ve quien puede mapearlo, no quien está mirando si le deben dinero.
   */
  function metaDelSemaforo(semaforo) {
    const conocido = SEMAFORO_META[semaforo];
    if (conocido) return conocido;
    // Un código vacío es tan desconocido como uno ausente: los dos salen con el guion, para que
    // el rótulo nunca termine en un espacio colgando que se leería como un fallo de pintado.
    const codigo = String(semaforo == null ? '' : semaforo).trim().toUpperCase() || '—';
    try { console.warn('[invoicesView] semáforo sin mapear:', semaforo); } catch (_) { /* sin consola */ }
    return { pillClass: 'status-pill-draft', label: INV_MARCADOR_MICROCOPY + ' ' + codigo };
  }
  if (typeof window !== 'undefined') {
    window.metaDelSemaforo = metaDelSemaforo;
    window.INV_MARCADOR_MICROCOPY = INV_MARCADOR_MICROCOPY;
    window.INV_SIN_APROBAR = INV_SIN_APROBAR;
  }

  // SCRUM-210: `copyRojo` se MUDÓ a api.js sin tocar una letra de su texto. Motivo: el semáforo
  // fiscal reutiliza este mismo copy aprobado como cuerpo de su aviso ámbar de plazo vencido, y
  // dejar dos copias de un texto aprobado es el fallo de «dos listas a mano que deben cuadrar»
  // (ADMIN_ONLY_ROUTES, MOTIVOS_ANULACION) aplicado a algo peor: microcopy fiscal que el
  // AuditLog tiene que poder reproducir. Una sola fuente, como `cobroPillClass` e
  // `invoiceStatusMeta`. De este fichero solo se quita la función; nada más se toca.
  //
  // 🔴 AQUÍ HABÍA UN `const copyRojo = window.copyRojo;` QUE TUMBABA ESTE FICHERO ENTERO.
  // Estos scripts son CLÁSICOS y comparten ámbito global: `api.js` ya declara
  // `function copyRojo`, que es una global var-scoped, así que un `const` con ese mismo
  // nombre en otro script choca — «Identifier 'copyRojo' has already been declared». Es
  // SyntaxError EN PARSEO: no se ejecuta NI UNA LÍNEA de este fichero, así que Facturas y la
  // bandeja de pendientes desaparecían enteras. La sangría de 2 espacios engaña: este fichero
  // NO tiene IIFE, todo esto es ámbito global.
  // No hace falta puente: `copyRojo` ya está en el global desde api.js. Se llama y ya.

  async function renderInvoicesView(container) {
    container.innerHTML = '';

    // Card principal
    const wrapper = document.createElement('div');
    wrapper.className = 'data-card';
    container.appendChild(wrapper);

    // Cabecera: título + conteo + acciones
    const header = document.createElement('div');
    header.className = 'data-card-header';
    wrapper.appendChild(header);

    const left = document.createElement('div');
    const title = document.createElement('h2');
    // SCRUM-776: el título sigue al documento. Un merchant ES real (flag OFF) emite
    // JUSTIFICANTES, y esta pantalla se los listaba bajo el rótulo «Facturas».
    title.textContent = window.rotulosDelDocumento.tituloListado();
    title.style.cssText = 'margin:0;font-size:18px';
    left.appendChild(title);
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Cargando…';
    subtitle.style.cssText = 'margin:2px 0 0;font-size:13px;color:var(--muted)';
    left.appendChild(subtitle);
    header.appendChild(left);

    const exportBtn = document.createElement('a');
    exportBtn.className = 'btn-secondary btn-sm';
    exportBtn.innerHTML = '⬇ CSV';
    exportBtn.title = 'Exportar facturas filtradas a CSV';
    exportBtn.href = '/admin/exports/invoices.csv';
    header.appendChild(exportBtn);

    // SCRUM-289 (A0.3): «nueva factura» sin presupuesto, trabajo ni albarán. El botón solo
    // existe cuando lo que se va a crear ES una factura — el veredicto lo calcula el servidor
    // con `modoDocumentoSuelto` y viaja en /admin/me: aquí NO se reimplementa la regla.
    // Rótulo con [PENDIENTE microcopy oficial] (regla 30) y su guard en la suite.
    if (window.appDocumentoSuelto !== 'no' && typeof openNuevaFacturaModal === 'function') {
      const nuevaFacturaBtn = document.createElement('button');
      nuevaFacturaBtn.type = 'button';
      nuevaFacturaBtn.className = 'btn-primary';
      // SCRUM-346 · EL RÓTULO SALE DEL VEREDICTO, que es de lo que va este ticket: el botón dice
      // lo que de verdad va a crear. «+ Nuevo justificante» está APROBADO por el fundador
      // (6-ago-2026, SCRUM-346); el de factura sigue sin aprobar desde A0.3 y conserva su
      // marcador — que sean distintos no es una asimetría, es que solo uno está firmado.
      //
      // ⚠️ REGLA 26 · NO se acompaña de ningún texto que explique POR QUÉ sale un justificante y
      // no una factura. Ni aquí, ni en un aviso, ni en un tooltip: esa pregunta se responde SOLO
      // con el guion H2, y un texto que explica mal una obligación fiscal no es feo, es peligroso.
      // SCRUM-599 · el rótulo de FACTURA sale de la pieza (aprobado); el de JUSTIFICANTE se
      // conserva tal cual estaba —no está en la microcopy de este ticket y la regla 26 lo blinda—.
      nuevaFacturaBtn.textContent = window.appDocumentoSuelto === 'justificante'
        ? '+ Nuevo justificante'
        : ((window.atajoNuevo && window.atajoNuevo.textoDe('invoices')) || 'Nueva factura');
      nuevaFacturaBtn.addEventListener('click', () => {
        openNuevaFacturaModal(() => renderInvoicesView(container));
      });
      if (window.atajoNuevo) {
        // La tecla se pinta en los DOS casos: el atajo funciona igual, y un botón con atajo y
        // otro sin él en la misma pantalla enseñaría que a veces no va.
        //
        // 🔴 SCRUM-768 · LA PINTA LA PIEZA, NO UNA COPIA. Aquí vivían las cinco líneas del `<kbd>`
        // calcadas de `etiquetar` —misma clase, mismo `aria-label`, mismo `appendChild`—, así que
        // Facturas era la ÚNICA de las cuatro listas que no compartía el mecanismo que este
        // ticket presume de tener único. El día que la tecla cambie de forma, ésta se queda atrás
        // y nadie se entera: es el mismo motivo por el que los rótulos viven en la pieza.
        //
        // Se le pasa `null` como vista A PROPÓSITO, y no `'invoices'`: `etiquetar` sólo reescribe
        // el texto si su `textoDe` devuelve algo, y con `null` no devuelve nada. Así el rótulo que
        // se acaba de poner arriba se conserva TAL CUAL en los dos modos —el de FACTURA, que ya
        // sale de la pieza, y el de JUSTIFICANTE, que la regla 26 blinda— y lo único que se añade
        // es la «N». Medido: el literal visible no cambia ni un byte en ninguno de los dos.
        window.atajoNuevo.etiquetar(nuevaFacturaBtn, null);
        window.atajoNuevo.registrar('invoices', () => nuevaFacturaBtn.click());
      }
      header.appendChild(nuevaFacturaBtn);
    }

    // SCRUM-69: pestañas "Emitidas" (default, contenido existente intacto) / "Pendientes"
    // (nueva). Componente NUEVO — no hay tabs hoy en el inventario AB3; se propone al máster.
    const tabs = document.createElement('div');
    tabs.className = 'data-card-tabs';
    tabs.innerHTML = `
      <button type="button" class="data-card-tab active" data-tab="emitidas">Emitidas</button>
      <button type="button" class="data-card-tab" data-tab="pendientes">Pendientes<span class="badge badge-amber" id="pend-badge" hidden></span></button>
    `;
    wrapper.appendChild(tabs);
    const tabEmitidas = tabs.querySelector('[data-tab="emitidas"]');
    const tabPendientes = tabs.querySelector('[data-tab="pendientes"]');
    const pendBadge = tabs.querySelector('#pend-badge');

    // Panel "Emitidas": todo el contenido existente, sin cambios de comportamiento.
    const panelEmitidas = document.createElement('div');
    wrapper.appendChild(panelEmitidas);

    // Panel "Pendientes": nuevo, oculto por defecto.
    const panelPendientes = document.createElement('div');
    panelPendientes.style.display = 'none';
    wrapper.appendChild(panelPendientes);

    function activateTab(name) {
      const isEmitidas = name === 'emitidas';
      tabEmitidas.classList.toggle('active', isEmitidas);
      tabPendientes.classList.toggle('active', !isEmitidas);
      panelEmitidas.style.display = isEmitidas ? '' : 'none';
      panelPendientes.style.display = isEmitidas ? 'none' : '';
      exportBtn.style.display = isEmitidas ? '' : 'none'; // CSV solo aplica a Emitidas
      if (!isEmitidas && !pendientesLoaded) reloadPendientes();
    }
    tabEmitidas.addEventListener('click', () => activateTab('emitidas'));
    tabPendientes.addEventListener('click', () => activateTab('pendientes'));

    // Toolbar: filtros
    const toolbar = document.createElement('div');
    toolbar.className = 'data-card-toolbar';
    panelEmitidas.appendChild(toolbar);

    const inputSearch = document.createElement('input');
    inputSearch.className = 'input';
    inputSearch.placeholder = 'Buscar por nº, cliente…';
    inputSearch.style.cssText = 'min-width:160px;flex:1';
    toolbar.appendChild(inputSearch);

    const selectStatus = document.createElement('select');
    selectStatus.className = 'input';
    selectStatus.style.cssText = 'width:auto';
    selectStatus.innerHTML = `
      <option value="all">Todos los estados</option>
      <option value="pending">Pendientes</option>
      <option value="paid">Pagadas</option>
      <option value="expired">Vencidas</option>
    `;
    toolbar.appendChild(selectStatus);

    const inputFrom = document.createElement('input');
    inputFrom.type = 'date';
    inputFrom.className = 'input';
    inputFrom.style.cssText = 'width:140px';
    inputFrom.title = 'Desde';
    toolbar.appendChild(inputFrom);

    const inputTo = document.createElement('input');
    inputTo.type = 'date';
    inputTo.className = 'input';
    inputTo.style.cssText = 'width:140px';
    inputTo.title = 'Hasta';
    toolbar.appendChild(inputTo);

    // Banner solo para errores/éxito de acciones (el conteo vive en la cabecera)
    const statusBox = document.createElement('div');
    statusBox.className = 'alert';
    statusBox.style.cssText = 'margin:12px 16px 0;display:none';
    panelEmitidas.appendChild(statusBox);

    function setCount(text) { subtitle.textContent = text; }

    const tableScroll = document.createElement('div');
    tableScroll.className = 'table-scroll';
    panelEmitidas.appendChild(tableScroll);
    const table = document.createElement('table');
    table.className = 'table table--cards-mobile'; // feedback fundador 6-jul: cards en móvil
    tableScroll.appendChild(table);

    // Checkbox "seleccionar todo" en cabecera
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th style="width:36px" class="col-hide-mobile"><input type="checkbox" id="inv-check-all" title="Seleccionar todas"/></th>
        <th>${window.rotulosDelDocumento.columnaNumero()}</th>
        <th>Cliente</th>
        <th style="text-align:right">Total</th>
        <th>Estado</th>
        <th class="col-hide-mobile">Fecha</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    // Barra de acciones bulk (flotante, aparece cuando hay seleccionadas)
    const bulkBar = document.createElement('div');
    bulkBar.style.cssText = [
      'display:none;position:sticky;bottom:16px;z-index:50;',
      'background:var(--neutral-900);color:#fff;border-radius:var(--radius-md);',
      'padding:10px 16px;display:none;align-items:center;gap:12px;',
      'box-shadow:var(--shadow-lg);margin:8px 16px;',
    ].join('');
    bulkBar.innerHTML = `
      <span id="bulk-count" style="font-size:13.5px;font-weight:600"></span>
      <button id="bulk-paid-btn" class="btn-primary btn-sm">✓ Marcar como pagadas</button>
      <button id="bulk-cancel-btn" class="btn-ghost btn-sm" style="color:rgba(255,255,255,.7)">Cancelar</button>
    `;
    panelEmitidas.appendChild(bulkBar);

    let currentStatus = 'all';
    let currentSearch = '';
    let currentDateFrom = '';
    let currentDateTo   = '';
    let selectedIds = new Set();
    let pendientesLoaded = false;

    // P-A66-3: delega en el formateador es-ES compartido (api.js)
    function fmtInvMoney(amount, currency) {
      return fmtMoneyEs(amount, currency || (window.appLocale && window.appLocale.currency) || 'EUR');
    }

    function updateBulkBar() {
      const n = selectedIds.size;
      if (n > 0) {
        bulkBar.style.display = 'flex';
        bulkBar.querySelector('#bulk-count').textContent = n + ' factura' + (n !== 1 ? 's' : '') + ' seleccionada' + (n !== 1 ? 's' : '');
      } else {
        bulkBar.style.display = 'none';
      }
      // Sync "select all" checkbox
      const checkAll = document.getElementById('inv-check-all');
      const allBoxes = Array.from(document.querySelectorAll('.inv-row-check'));
      if (checkAll) checkAll.indeterminate = n > 0 && n < allBoxes.length;
      if (checkAll) checkAll.checked = allBoxes.length > 0 && n === allBoxes.length;
    }

    bulkBar.querySelector('#bulk-cancel-btn').addEventListener('click', () => {
      selectedIds.clear();
      document.querySelectorAll('.inv-row-check').forEach(cb => { cb.checked = false; });
      updateBulkBar();
    });

    bulkBar.querySelector('#bulk-paid-btn').addEventListener('click', async () => {
      if (selectedIds.size === 0) return;
      const ids = Array.from(selectedIds);
      const btn = bulkBar.querySelector('#bulk-paid-btn');
      btn.disabled = true;
      btn.textContent = 'Procesando…';
      // ⚠️ SCRUM-375 · LA ESCRITURA Y LA RECARGA SON DOS FALLOS DISTINTOS, y hasta aquí un solo
      // `catch` los envolvía a los dos. Si el POST salía bien y fallaba la recarga, la pantalla
      // decía «no se han podido marcar como pagadas» CUANDO SÍ SE MARCARON: el profesional volvía
      // a pulsar sobre facturas que ya estaban pagadas, o se iba creyendo que no había cobrado.
      //
      // Un fallo de LECTURA no se puede presentar como un fallo de ESCRITURA. Por eso la recarga
      // vive fuera del `try` del POST y tiene su propio aviso.
      let data;
      try {
        data = await apiRequest('/admin/invoices/bulk-paid', {
          method: 'POST',
          body: JSON.stringify({ ids }),
        });
        selectedIds.clear();
      } catch {
        btn.disabled = false;
        btn.textContent = '✓ Marcar como pagadas';
        statusBox.textContent = COPY_BULK_PAGADAS.escrituraFallida;
        statusBox.className = 'alert error';
        statusBox.style.display = 'block';
        return;
      }

      // A partir de aquí LA ESCRITURA YA OCURRIÓ. Pase lo que pase con la recarga, el mensaje
      // tiene que decir que se marcaron.
      let recargaOk = true;
      try { await reload(); } catch { recargaOk = false; }

      const r = resultadoMarcadoEnBloque({ escrituraOk: true, recargaOk, marcadas: data.updated });
      statusBox.textContent = r.texto;
      statusBox.className = 'alert ' + r.tono;
      statusBox.style.display = 'block';
    });

    // "Seleccionar todo"
    thead.querySelector('#inv-check-all').addEventListener('change', function() {
      const checked = this.checked;
      document.querySelectorAll('.inv-row-check').forEach(cb => {
        cb.checked = checked;
        const id = Number(cb.dataset.id);
        if (checked) selectedIds.add(id);
        else selectedIds.delete(id);
      });
      updateBulkBar();
    });

    async function reload() {
      setCount('Cargando…');
      statusBox.style.display = 'none';
      uiSkeletonRows(tbody, 6, 6);

      try {
        const invoices = await fetchInvoices({ status: currentStatus, search: currentSearch, dateFrom: currentDateFrom, dateTo: currentDateTo });
        tbody.innerHTML = '';
        selectedIds.clear();
        updateBulkBar();

        if (!invoices || invoices.length === 0) {
          // A6.5: estado vacío digno (mismo patrón que Productos/Clientes)
          const filtering = currentSearch || currentStatus !== 'all' || currentDateFrom || currentDateTo;
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = 6;
          td.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🧾</div>'
            + '<div class="empty-state-title">' + (filtering ? 'Nada con estos filtros' : 'Aquí verás tus cobros') + '</div>'
            + '<div class="empty-state-desc">' + (filtering
              ? 'Prueba con otra búsqueda o limpia los filtros.'
              : 'Cuando un cliente acepte un presupuesto, el documento de cobro se genera solo y aparece aquí.') + '</div>'
            + (filtering ? '' : '<button id="inv-empty-cta" class="btn-primary btn-sm" style="margin-top:14px">Crear un presupuesto</button>')
            + '</div>';
          tr.appendChild(td);
          tbody.appendChild(tr);
          td.querySelector('#inv-empty-cta')?.addEventListener('click', () => {
            if (window.renderAppView) renderAppView('quotes-new');
          });
          setCount('0 facturas');
          return;
        }

        setCount(invoices.length + ' factura' + (invoices.length !== 1 ? 's' : ''));

        // A18.2 (AB4): lo PENDIENTE de cobrar primero — y dentro de pendiente,
        // lo más antiguo arriba (es lo que hay que perseguir hoy).
        const sorted = [...invoices].sort((a, b) => {
          const ap = String(a.status).toLowerCase() === 'pending' ? 0 : 1;
          const bp = String(b.status).toLowerCase() === 'pending' ? 0 : 1;
          if (ap !== bp) return ap - bp;
          const ad = new Date(a.createdAt).getTime(), bd = new Date(b.createdAt).getTime();
          return ap === 0 ? ad - bd : bd - ad;
        });

        sorted.forEach((inv) => {
          const tr = document.createElement('tr');
          const st = String(inv.status || '').toLowerCase();

          // Checkbox
          const tdCheck = document.createElement('td');
          tdCheck.className = 'col-hide-mobile'; // bulk = flujo de escritorio
          tdCheck.style.cssText = 'width:36px;padding:12px 8px';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'inv-row-check';
          cb.dataset.id = inv.id;
          cb.addEventListener('change', function(e) {
            e.stopPropagation();
            if (this.checked) selectedIds.add(inv.id);
            else selectedIds.delete(inv.id);
            updateBulkBar();
          });
          tdCheck.appendChild(cb);
          tr.appendChild(tdCheck);

          const tdNumber = document.createElement('td');
          tdNumber.className = 'cell-id';
          tdNumber.style.fontWeight = '600';
          tdNumber.textContent = inv.number;
          // A18.2: antigüedad VISIBLE en pendientes (también en móvil) —
          // ámbar >7 días, rojo >30 (mismo lenguaje que el aging de Informes)
          if (st === 'pending' && inv.createdAt) {
            const days = Math.floor((Date.now() - new Date(inv.createdAt).getTime()) / 86400000);
            const age = document.createElement('div');
            age.style.cssText = 'font-size:11.5px;font-weight:600;margin-top:2px;color:' +
              (days > 30 ? 'var(--red-600)' : days > 7 ? '#b45309' : 'var(--muted)');
            age.textContent = days <= 0 ? 'hoy' : 'hace ' + days + ' día' + (days === 1 ? '' : 's');
            tdNumber.appendChild(age);
          }
          tr.appendChild(tdNumber);

          const tdCustomer = document.createElement('td');
          tdCustomer.className = 'cell-client';
          tdCustomer.textContent = (inv.customer && inv.customer.name) || '—';
          tr.appendChild(tdCustomer);

          const tdTotal = document.createElement('td');
          tdTotal.className = 'amount cell-amount';
          tdTotal.style.textAlign = 'right';
          tdTotal.textContent = fmtInvMoney(inv.total, inv.currency);
          tr.appendChild(tdTotal);

          const tdStatus = document.createElement('td');
          tdStatus.className = 'cell-status';
          // SCRUM-153: mapeo canónico (api.js). Antes el ternario caía a PENDIENTE por
          // defecto, así que una factura ANULADA se pintaba como pendiente de cobro.
          const metaSt = invoiceStatusMeta(st);
          const span = document.createElement('span');
          span.className = `status-pill ${metaSt.pillClass}`;
          span.textContent = metaSt.label;
          tdStatus.appendChild(span);
          tr.appendChild(tdStatus);

          const tdDate = document.createElement('td');
          tdDate.className = 'col-hide-mobile';
          tdDate.style.color = 'var(--muted)';
          tdDate.textContent = inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('es-ES') : '—';
          tr.appendChild(tdDate);

          tr.style.cursor = 'pointer';
          tr.addEventListener('click', (e) => {
            if (e.target === cb) return; // no navegar si click en checkbox
            if (window.renderAppView) window.renderAppView('invoice-detail', { invoiceId: inv.id });
          });

          tbody.appendChild(tr);
        });

        statusBox.style.display = 'none';
      } catch (err) {
        console.error('[renderInvoicesView] error', err);
        statusBox.textContent = 'No se han podido cargar las facturas. Vuelve a intentarlo.';
        statusBox.className = 'alert error';
        statusBox.style.display = 'block';
      }
    }

    // ── Panel "Pendientes" (SCRUM-69) ──────────────────────────────────────
    const pendStatusBox = document.createElement('div');
    pendStatusBox.className = 'alert';
    pendStatusBox.style.cssText = 'margin:16px 20px 0;display:none';
    panelPendientes.appendChild(pendStatusBox);

    const pendBody = document.createElement('div');
    pendBody.className = 'data-card-body';
    panelPendientes.appendChild(pendBody);

    function renderGrupoCard(customer, grupo) {
      const meta = metaDelSemaforo(grupo.semaforo); // SCRUM-748: lo desconocido NO cae a «AL DÍA»
      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid var(--neutral-200);border-radius:var(--radius-lg);'
        + 'padding:16px;margin-bottom:12px;background:#fff';

      const rowTop = document.createElement('div');
      rowTop.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap';

      const leftCol = document.createElement('div');
      const custName = document.createElement('div');
      custName.style.cssText = 'font-weight:700;font-size:14.5px;color:var(--neutral-900)';
      custName.textContent = customer.customerName;
      leftCol.appendChild(custName);
      const mesLine = document.createElement('div');
      mesLine.style.cssText = 'font-size:13px;color:var(--neutral-500);margin-top:2px;text-transform:capitalize';
      mesLine.textContent = grupo.mesLabel + ' · ' + grupo.albaranes.length + ' parte' + (grupo.albaranes.length !== 1 ? 's' : '');
      leftCol.appendChild(mesLine);
      rowTop.appendChild(leftCol);

      const rightCol = document.createElement('div');
      rightCol.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:4px';
      const pill = document.createElement('span');
      pill.className = 'status-pill ' + meta.pillClass;
      pill.textContent = meta.label;
      rightCol.appendChild(pill);
      const fechaLine = document.createElement('div');
      fechaLine.style.cssText = 'font-size:12px;color:var(--neutral-500)';
      fechaLine.textContent = 'Plazo: ' + fmtFechaEs(grupo.fechaLimite);
      rightCol.appendChild(fechaLine);
      rowTop.appendChild(rightCol);

      card.appendChild(rowTop);

      // ── SCRUM-648 (fase B) · POR QUÉ ESTE ÁMBAR ─────────────────────────────────────────
      //
      // `ambar` significa dos cosas: «se acerca el plazo» y «no he podido comprobarlo». La ACCIÓN
      // correcta es la misma —mirar esto— y por eso comparten color; pero el porqué no se
      // comparte, y sin él el profesional no sabe si tiene que facturar o revisar un dato.
      //
      // 🔴 SÓLO se pinta cuando el motivo es `no_computable`. Con `plazo`, la pastilla y la fecha
      // de arriba ya lo dicen, y repetirlo sería ruido — el mismo criterio que el aviso de
      // periodicidad de aquí debajo.
      //
      // ✅ RÓTULO FIRMADO POR EL FUNDADOR (5-sep-2026): «No hemos podido comprobar el plazo.», 35
      // caracteres. LA FIRMA Y LA RETIRADA DEL MARCADOR VAN EN EL MISMO COMMIT: si el rótulo se
      // aprueba en un chat y el código sigue diciendo `[PENDIENTE`, el repositorio afirma algo que
      // ha dejado de ser verdad. Así se mergeó el PR #1065 en rojo, y el guard del 402 tenía razón.
      // La caja se midió ANTES de pedir el texto (SCRUM-648 fase B, `guard:caja-semaforo`):
      // 559 px de ancho útil a 929 y 292 px a 390, y en una línea caben 50 caracteres a 390.
      if (grupo.motivoSemaforo === 'no_computable') {
        const motivoLine = document.createElement('div');
        motivoLine.style.cssText = 'margin-top:8px;font-size:13px;color:var(--neutral-700)';
        motivoLine.textContent = 'No hemos podido comprobar el plazo.';
        card.appendChild(motivoLine);
      }

      // SCRUM-171b: aviso de que TOCA facturar. Solo se pinta cuando el motivo es la
      // PERIODICIDAD pactada: si el motivo es el plazo legal, el semáforo y la fecha límite de
      // arriba ya lo están diciendo, y repetirlo con otras palabras sería ruido.
      if (grupo.avisar && grupo.motivoAviso === 'periodicidad') {
        const avisoLine = document.createElement('div');
        avisoLine.style.cssText = 'margin-top:8px;font-size:13px;color:var(--neutral-700)';
        avisoLine.textContent = customer.billingPeriodicity === 'QUINCENAL'
          ? '🗓️ Toca facturarle: lo tienes pactado cada quince días.'
          : '🗓️ Toca facturarle: lo tienes pactado mensual.';
        card.appendChild(avisoLine);
      }

      const importeLine = document.createElement('div');
      importeLine.style.cssText = 'margin-top:10px;font-size:13.5px;color:var(--neutral-700)';
      importeLine.innerHTML = '<strong>' + fmtMoneyEs(grupo.importePotencial.total, (window.appLocale && window.appLocale.currency) || 'EUR')
        + '</strong> pendiente de facturar';
      card.appendChild(importeLine);

      // SCRUM-615 (salidas D y C) · si nadie ha declarado el tipo de destinatario, el plazo de
      // arriba está calculado con el implícito `PARTICULAR`. Se avisa y se pregunta AQUÍ, que es
      // el único sitio donde ese dato cambia algo y donde el profesional ya está mirando la fecha.
      // Devuelve `null` cuando el dato YA está: quien contestó no vuelve a ver nada.
      const bloqueTipo = bloqueTipoDestinatario({
        cliente: customer,
        alElegir: async (elegido) => {
          try {
            await apiRequest('/admin/customers/' + customer.customerId, {
              method: 'PUT',
              body: JSON.stringify({ tipoDestinatario: elegido }),
            });
            // Se REPINTA la bandeja entera en vez de tocar esta tarjeta: la respuesta cambia la
            // fecha límite y el semáforo de TODOS los grupos de este cliente, no solo del de aquí.
            // Actualizar solo lo que se ve dejaría el resto mostrando el plazo viejo.
            await reloadPendientes();
          } catch (err) {
            console.error('[renderGrupoCard] guardar tipoDestinatario', err);
            // MICROCOPY: marcador (regla 30). El mensaje de carga que ya existe abajo dice
            // «no se han podido CARGAR», y aquí lo que ha fallado es GUARDAR: reutilizarlo sería
            // enseñar un texto que no describe lo que pasó. Y no se inventa uno — en este ticket
            // el copy no es accesorio. Sube el censo de SCRUM-402; va declarado en el informe.
            pendStatusBox.textContent = tipoDestinatarioPendiente.MARCADOR;
            pendStatusBox.className = 'alert error';
            pendStatusBox.style.display = 'block';
          }
        },
      });
      if (bloqueTipo) card.appendChild(bloqueTipo);

      if (grupo.semaforo === 'rojo') {
        const warnBox = document.createElement('div');
        warnBox.style.cssText = 'margin-top:10px;padding:10px 12px;border-radius:var(--radius-md);'
          + 'background:var(--red-50);color:var(--red-600);font-size:12.5px;line-height:1.5';
        warnBox.textContent = copyRojo(grupo.mesLabel);
        card.appendChild(warnBox);
      }

      const actions = document.createElement('div');
      actions.style.cssText = 'margin-top:12px';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-secondary btn-sm';
      btn.textContent = 'Consolidar en factura →';
      btn.addEventListener('click', () => {
        if (window.renderAppView) window.renderAppView('jobs-detail', { jobId: grupo.jobId });
      });
      actions.appendChild(btn);
      card.appendChild(actions);

      return card;
    }

    async function reloadPendientes() {
      pendBody.innerHTML = '';
      pendStatusBox.style.display = 'none';
      const loading = document.createElement('p');
      loading.style.cssText = 'color:var(--muted);font-size:13.5px';
      loading.textContent = 'Cargando…';
      pendBody.appendChild(loading);

      try {
        const clientes = await fetchPendientesFacturar();
        pendientesLoaded = true;
        pendBody.innerHTML = '';

        let ambarRojoCount = 0;
        clientes.forEach((c) => c.grupos.forEach((g) => { if (g.semaforo !== 'verde') ambarRojoCount++; }));
        if (ambarRojoCount > 0) {
          pendBadge.hidden = false;
          pendBadge.textContent = String(ambarRojoCount);
        } else {
          pendBadge.hidden = true;
        }

        const totalGrupos = clientes.reduce((n, c) => n + c.grupos.length, 0);
        if (totalGrupos === 0) {
          pendBody.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🧾</div>'
            + '<div class="empty-state-title">Nada pendiente de facturar</div>'
            + '<div class="empty-state-desc">Cuando firmes partes de trabajo sin facturar, aparecerán aquí agrupados por cliente y mes.</div>'
            + '</div>';
          return;
        }

        // Rojo primero, luego ámbar, luego verde — lo urgente arriba (mismo criterio A18.2).
        const orden = { rojo: 0, ambar: 1, verde: 2 };
        clientes.forEach((customer) => {
          const gruposOrdenados = [...customer.grupos].sort((a, b) => orden[a.semaforo] - orden[b.semaforo]);
          gruposOrdenados.forEach((grupo) => {
            pendBody.appendChild(renderGrupoCard(customer, grupo));
          });
        });
      } catch (err) {
        console.error('[renderInvoicesView] pendientes error', err);
        pendBody.innerHTML = '';
        pendStatusBox.textContent = 'No se han podido cargar los pendientes de facturar. Vuelve a intentarlo.';
        pendStatusBox.className = 'alert error';
        pendStatusBox.style.display = 'block';
      }
    }

    // Listeners de filtros
    function updateExportHref() {
      const params = new URLSearchParams();
      if (currentStatus !== 'all') params.set('status', currentStatus);
      if (currentDateFrom) params.set('from', currentDateFrom);
      if (currentDateTo)   params.set('to',   currentDateTo);
      exportBtn.href = '/admin/exports/invoices.csv' + (params.toString() ? '?' + params.toString() : '');
    }

    selectStatus.addEventListener('change', () => {
      currentStatus = selectStatus.value;
      updateExportHref();
      reload();
    });

    inputFrom.addEventListener('change', () => { currentDateFrom = inputFrom.value; updateExportHref(); reload(); });
    inputTo.addEventListener('change',   () => { currentDateTo   = inputTo.value;   updateExportHref(); reload(); });

    let searchTimer = null;
    inputSearch.addEventListener('input', () => {
      currentSearch = inputSearch.value.trim();
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(reload, 300);
    });

    // Primera carga
    reload();
    // Badge de "Pendientes" visible desde el primer render, sin esperar a que el usuario
    // pulse la pestaña (decisión fundador: la urgencia se ve sin rehacer la expectativa).
    reloadPendientes();
  }

  // Hacemos la función accesible desde otros scripts
// SCRUM-375: guardado como en `albaranActionsRegistry.js` — sin esto el fichero no se puede
// `require()` desde la suite, y el decisor de arriba solo se podria probar leyendo el texto.
if (typeof window !== 'undefined') window.renderInvoicesView = renderInvoicesView;
