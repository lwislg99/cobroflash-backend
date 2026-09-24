// public/dashboard/js/facturasRecibidasView.js — SCRUM-1040 (CON-04).
//
// LAS FACTURAS QUE EL PROFESIONAL RECIBE DE SUS PROVEEDORES — no las que emite. Hasta hoy el
// libro de A6/SCRUM-426 solo salía como descarga CSV (`librosAeat.routes.ts:89`); esta pantalla
// LEE el mismo motor y lo pinta, junto a «Libro de registro» (las emitidas).
//
// SOLO LECTURA y sin sello: no hay aquí ni un `create` ni un `update`, y no se toca el camino de
// emisión (regla 38 del máster). Con `INVOICING_ES_ENABLED` en OFF esto sigue viéndose: es el
// propio profesional mirando SUS gastos como borrador para su asesor, no un documento que sale de
// casa (aclaración del orquestador en SCRUM-1012, 21-sep-2026).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LAS TRES SITUACIONES QUE NO SE PUEDEN CONFUNDIR (mismo criterio que `libroRegistroView.js`)
//
// Un periodo sin gastos y un lector que no supo mirar producen el MISMO libro vacío, y significan
// lo contrario: el primero es correcto, el segundo le diría a un despacho «este trimestre no
// compraste nada». Por eso la carga rota NO pinta tabla, y el servidor manda `miradas` para que
// «no había» y «no supe leer» salgan con avisos distintos.
//
// MICROCOPY: todas las ranuras van marcadas (regla 30), salvo las que reutilizan texto ya
// existente en otra pantalla («Cargando…») o los avisos que YA aprobó el fundador el 10-ago-2026
// (`avisosLibroRecibidas`, `librosAeat.ts`) y que aquí solo se pintan tal cual llegan del
// servidor. Las cabeceras de columna (fecha, proveedor, NIF, base, IVA, total) son los términos
// que impone la propia aceptación del ticket, igual que «Fecha»/«Base»/«IVA»/«Total» en el libro
// de emitidas no llevan marcador.
(function () {
  const MARCADOR = '[PENDIENTE microcopy oficial]';
  function rotulo(t) { return MARCADOR + ' ' + t; }

  const COPY = {
    titulo: rotulo('Facturas recibidas'),
    // SIN marcador (SCRUM-420 §④): el rótulo de la barra nunca lo lleva, esté o no aprobado el
    // texto. `app.js` no lo lee para la barra —la barra es HTML estático—; esta ranura existe
    // para que el HTML y aquí no puedan divergir en silencio (ver el test de cableado).
    menu: 'Facturas recibidas',
    cargando: 'Cargando…', // NO es de este ticket: cadena ya usada en libroRegistroView.js/invoicesView.js
    recuento: (n) => (n === 1 ? '1 factura recibida' : n + ' facturas recibidas'),
    error: rotulo('No se ha podido cargar el libro. Vuelve a intentarlo.'),
    vacioDeVerdad: rotulo('Todavía no tienes facturas recibidas en este periodo.'),
    descuadre: (miradas) => rotulo(
      'El libro no cuadra: se han revisado ' + miradas + (miradas === 1 ? ' gasto' : ' gastos')
      + ' y no ha salido ningún asiento. No lo tomes como que no compraste.'),
    colFecha: 'Fecha',
    colProveedor: 'Proveedor',
    colNif: 'NIF',
    colBase: 'Base',
    colIva: 'IVA',
    colTotal: 'Total',
    filaTotal: 'Total',
    etiquetaAnio: 'Año',
    etiquetaTrimestre: 'Trimestre',
    consultar: 'Consultar',
  };

  function fechaCorta(v) {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d) ? '—' : d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  /** `null` sale «—», nunca 0,00 €: un hueco no es un cero (A5/A6). */
  function euros(v, moneda) {
    return fmtMoneyEsOAusente(v, moneda || 'EUR');
  }

  /** El trimestre EN CURSO, para prerrellenar el selector — mismo cálculo que `exportView.js`. */
  function trimestreActual() {
    const hoy = new Date();
    return { anio: hoy.getFullYear(), trimestre: Math.floor(hoy.getMonth() / 3) + 1 };
  }

  /**
   * Suma una columna ignorando los `null`. Un hueco no es un cero (A5/A6): si NINGUNA fila trae
   * la cifra, el total sale `null` — nunca «0,00 €», que afirmaría que el periodo movió cero.
   */
  function sumaODescarta(filas, clave) {
    let suma = 0;
    let alguna = false;
    for (const f of filas) {
      const v = f[clave];
      if (v == null) continue;
      alguna = true;
      suma += Number(v);
    }
    return alguna ? suma : null;
  }

  function renderFacturasRecibidasView(container) {
    container.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'data-card';
    container.appendChild(card);

    const header = document.createElement('div');
    header.className = 'data-card-header';
    card.appendChild(header);

    const left = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = COPY.titulo;
    title.className = 'fr-title';
    left.appendChild(title);
    const subtitle = document.createElement('p');
    subtitle.textContent = COPY.cargando;
    subtitle.className = 'fr-subtitle';
    left.appendChild(subtitle);
    header.appendChild(left);

    // El selector de periodo: mismo par año/trimestre que la descarga CSV de emitidas
    // (`exportView.js`), y el mismo componente que el resto del panel usa para una barra de
    // filtros (`.data-card-toolbar`, AB3) — sin estilo en línea (regla 4).
    const periodo = document.createElement('div');
    periodo.className = 'data-card-toolbar';
    periodo.innerHTML = `
      <div>
        <label for="facturas-recibidas-anio" style="display:block;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:4px">${COPY.etiquetaAnio}</label>
        <input type="number" id="facturas-recibidas-anio" class="input" style="width:auto" step="1">
      </div>
      <div>
        <label for="facturas-recibidas-trimestre" style="display:block;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:4px">${COPY.etiquetaTrimestre}</label>
        <select id="facturas-recibidas-trimestre" class="input" style="width:auto">
          <option value="1">T1</option><option value="2">T2</option>
          <option value="3">T3</option><option value="4">T4</option>
        </select>
      </div>
      <button class="btn-secondary" id="facturas-recibidas-consultar">${COPY.consultar}</button>
    `;
    card.appendChild(periodo);

    // El cuerpo no existe hasta que llegan los datos: es lo que impide que un fallo se lea como
    // una tabla vacía (mismo criterio que `libroRegistroView.js`).
    const body = document.createElement('div');
    card.appendChild(body);

    const inpAnio = periodo.querySelector('#facturas-recibidas-anio');
    const selTri = periodo.querySelector('#facturas-recibidas-trimestre');
    const btnConsultar = periodo.querySelector('#facturas-recibidas-consultar');

    const actual = trimestreActual();
    inpAnio.value = String(actual.anio);
    selTri.value = String(actual.trimestre);

    cargar(actual.anio, actual.trimestre);
    btnConsultar.addEventListener('click', () => {
      const anio = Number(inpAnio.value);
      const tri = Number(selTri.value);
      if (Number.isInteger(anio) && tri >= 1 && tri <= 4) cargar(anio, tri);
    });

    async function cargar(anio, tri) {
      subtitle.textContent = COPY.cargando;
      try {
        const qs = new URLSearchParams({ 'año': String(anio), trimestre: String(tri) });
        pintar(await apiRequest('/admin/libros/recibidas.json?' + qs));
      } catch (err) {
        pintarError(err);
      }
    }

    function pintarError(err) {
      subtitle.textContent = '';
      body.innerHTML = '';
      // ⚠️ `.alert` sin modificador de tono está OCULTA por CSS: un aviso invisible aquí sería
      // exactamente el fallo que se lee como «no compraste nada» (lección de SCRUM-303/350).
      const aviso = document.createElement('div');
      aviso.className = 'alert error fr-alert';
      aviso.textContent = COPY.error;
      body.appendChild(aviso);
      const detalle = document.createElement('p');
      detalle.className = 'fr-alert-detail';
      detalle.textContent = String((err && err.message) || err || '');
      body.appendChild(detalle);
    }

    function avisar(texto, tono) {
      const TONOS = ['success', 'ok', 'error', 'info', 'warning'];
      const a = document.createElement('div');
      a.className = 'alert fr-alert-top ' + (TONOS.includes(tono) ? tono : 'warning');
      a.textContent = texto;
      body.appendChild(a);
    }

    function pintar(libro) {
      const filas = libro && Array.isArray(libro.filas) ? libro.filas : null;
      // `miradas` tiene que venir SIEMPRE: es lo que distingue «no había» de «no supe leer».
      if (!filas || typeof libro.miradas !== 'number') {
        pintarError(new Error('respuesta_incompleta'));
        return;
      }

      body.innerHTML = '';
      subtitle.textContent = COPY.recuento(filas.length);

      // Los avisos del servidor van TAL CUAL: son la microcopy YA aprobada el 10-ago-2026
      // (`avisosLibroRecibidas`) — el «formato provisional» siempre, y el de gastos sin
      // clasificar solo si algo quedó fuera (caso d de SCRUM-1037: se señalan, no se ocultan).
      if (Array.isArray(libro.avisos)) {
        libro.avisos.forEach((texto, i) => avisar(texto, i === 0 ? 'info' : 'warning'));
      }

      if (filas.length === 0) {
        // Las dos ramas que NO se pueden confundir.
        if (libro.miradas > 0) avisar(COPY.descuadre(libro.miradas), 'warning');
        else {
          const vacio = document.createElement('p');
          vacio.className = 'fr-empty';
          vacio.textContent = COPY.vacioDeVerdad;
          body.appendChild(vacio);
        }
        return;
      }

      const scroll = document.createElement('div');
      scroll.className = 'table-scroll fr-table-scroll';
      body.appendChild(scroll);

      const tabla = document.createElement('table');
      tabla.className = 'table';
      scroll.appendChild(tabla);

      const thead = document.createElement('thead');
      const trh = document.createElement('tr');
      for (const c of [COPY.colFecha, COPY.colProveedor, COPY.colNif, COPY.colBase, COPY.colIva, COPY.colTotal]) {
        const th = document.createElement('th');
        th.textContent = c;
        th.className = 'fr-th';
        trh.appendChild(th);
      }
      thead.appendChild(trh);
      tabla.appendChild(thead);

      const tbody = document.createElement('tbody');
      tabla.appendChild(tbody);

      for (const f of filas) {
        const tr = document.createElement('tr');
        tr.dataset.fila = '1';

        const celda = (texto, clase) => {
          const td = document.createElement('td');
          td.textContent = texto;
          if (clase) td.className = clase;
          tr.appendChild(td);
          return td;
        };

        // La fecha del APUNTE, no la de expedición del proveedor: es la que existe siempre (la de
        // expedición nació a NULL el 10-ago-2026 y es justo lo que este periodo puede tener sin
        // clasificar del todo) y la que decide en qué trimestre cae la fila.
        celda(fechaCorta(f.fechaApunte), 'fr-td-nowrap');
        celda(f.nombreProveedor || '—');
        celda(f.nifProveedor || '—', 'fr-td-nowrap');
        celda(euros(f.base, f.moneda), 'fr-td-money');
        celda(euros(f.cuota, f.moneda), 'fr-td-money');
        celda(euros(f.total, f.moneda), 'fr-td-money-strong');

        tbody.appendChild(tr);
      }

      // Totales al pie del periodo mostrado (aceptación 3). Suman lo que HAY: si ninguna fila
      // trae una cifra, esa celda sale «—» — un hueco no es un cero (A5/A6).
      const tfoot = document.createElement('tfoot');
      const trf = document.createElement('tr');
      const celdaFoot = (texto, claseExtra) => {
        const td = document.createElement('td');
        td.textContent = texto;
        td.className = 'fr-tfoot-cell' + (claseExtra ? ' ' + claseExtra : '');
        trf.appendChild(td);
        return td;
      };
      celdaFoot(COPY.filaTotal);
      celdaFoot('');
      celdaFoot('');
      const monedaComun = filas.find((f) => f.moneda)?.moneda || 'EUR';
      celdaFoot(euros(sumaODescarta(filas, 'base'), monedaComun), 'fr-td-money');
      celdaFoot(euros(sumaODescarta(filas, 'cuota'), monedaComun), 'fr-td-money');
      celdaFoot(euros(sumaODescarta(filas, 'total'), monedaComun), 'fr-td-money');
      tfoot.appendChild(trf);
      tabla.appendChild(tfoot);
    }
  }

  window.renderFacturasRecibidasView = renderFacturasRecibidasView;
  window.FACTURAS_RECIBIDAS_COPY = COPY; // el guard de microcopy compara contra las constantes
})();
