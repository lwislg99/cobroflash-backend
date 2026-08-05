// public/dashboard/js/albaranesView.js — SCRUM-301 (C1)
//
// EL LISTADO GLOBAL DE ALBARANES. Hasta aquí los albaranes vivían dentro de cada Trabajo, así que
// «¿qué tengo sin firmar?» —la pregunta del lunes de un reformista con seis obras— obligaba a
// entrar obra por obra.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LOS EJES NO SE ENUMERAN AQUÍ. NINGUNO.
//
// Las pestañas se construyen con `ejes.estado` y `ejes.cobro` TAL Y COMO LLEGAN del servidor, que
// los deriva de `ALBARAN_ESTADOS` y `ESTADOS_COBRO`. En este fichero no hay ni un `'borrador'` ni
// un `'firmado'` escritos a mano, y es deliberado: una lista escrita a mano no avisa de lo que le
// falta, y ya llevamos dos listas sin guard que se quedaron cortas en silencio.
//
// Son DOS EJES y no uno: `borrador · emitido · firmado` es el ciclo del DOCUMENTO, y
// `sin_facturar · parcial · facturado` es un DERIVADO del libro de líneas facturadas (SCRUM-170).
// Aplanarlos en una sola fila de pestañas obligaría a inventar un estado que no existe y perdería
// el `parcial` — el caso NORMAL en una obra por fases. Por eso el estado va en pestañas y la
// facturación en su propio filtro, cada uno con sus contadores.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SI LA CONSULTA FALLA, AQUÍ NO SE PINTAN CEROS
//
// Un contador de «sin firmar» a 0 porque la lectura se rompió manda al profesional a casa tranquilo
// con tres albaranes sin firmar. Cuando la petición falla, esta vista pinta un ERROR y NO dibuja ni
// pestañas ni tabla: no hay ningún camino por el que un fallo acabe pareciendo un cero.
//
// «No tienes ninguno» sigue siendo una respuesta legítima y tiene su propio estado vacío.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// MICROCOPY: LAS NUEVE RANURAS, FIRMADAS POR EL ASESOR EL 5-AGO-2026 (regla 30)
//
// Se entregó con `[PENDIENTE microcopy oficial]` en cada rótulo. El asesor firmó primero las cuatro
// de estructura —sección, pestañas, columnas y filtro, ésta con retoque («Facturación: TODOS», no
// «todas», porque concuerda con «albaranes», que es lo que se cuenta; «todas» arrastra a pensar en
// facturas, el objeto que este filtro NO cuenta)— y después las cinco de estado —aviso de error,
// recuento, buscador (sus DOS cadenas) y los dos vacíos—.
//
// El guard cambió de trabajo con la primera firma y ahora cubre las nueve: compara **ranura a
// ranura** contra el texto firmado, atándolo a SU sitio en el código. Retocar copy firmada es
// decisión del asesor, no un detalle de implementación.
//
// Dos de esos textos existen para no confundirse entre sí, y por eso se escribieron a la vez:
//   · el AVISO DE ERROR nombra la CARGA («no se han podido cargar»), no el inventario, para que un
//     fallo no se lea nunca como «no tienes albaranes»;
//   · los dos VACÍOS separan «no tienes» de «no encuentro»: el segundo dice «los filtros» en plural
//     porque su rama se alcanza por TRES vías —la pestaña de estado, el filtro de facturación y el
//     buscador—, así que hablar de «esa búsqueda» mentiría a quien solo tocó un desplegable.
//
// ⚠️ LAS ETIQUETAS DE LAS PESTAÑAS SE DERIVAN DEL VALOR, NO SE ESCRIBEN. Un mapa
// `{ borrador: 'Borradores', … }` sería otra vez la lista a mano que este fichero evita: el día que
// el modelo gane un estado, esa pestaña saldría sin nombre o directamente no saldría. La regla de
// plural del español (vocal → +s, consonante → +es) produce EXACTAMENTE los tres rótulos aprobados,
// y un test los fija uno a uno.
//
// Las etiquetas de estado dentro de cada fila imprimen EL VALOR DEL MODELO tal cual (`emitido`,
// `parcial`): dato, no copy. Es lo que impide repetir el error de B2 — nadie va a escribir
// «Enviado» en una pantalla que pone `emitido`.
(function () {
  const TODOS = '__todos__'; // valor de pestaña, no un estado del modelo

  // Ya NO queda marcador en esta pantalla: las cuatro primeras ranuras se aprobaron el 5-ago-2026 y
  // las cinco restantes —aviso de error, recuento, buscador (sus DOS cadenas) y los dos estados
  // vacíos— quedaron firmadas justo después. El helper `rotulo()` desaparece con ellas: mantenerlo
  // sin usuarios invitaría a marcar texto nuevo en vez de someterlo.
  //
  // ⚠️ `'Cargando…'` (más abajo) NO es de este ticket y NO entra en el guard: es la cadena que ya
  // usa `invoicesView.js` en tres sitios, copiada tal cual. Someterla aquí la convertiría en texto
  // oficial de pantallas que este ticket no toca.

  /** Plural español del valor + mayúscula inicial: `borrador` → `Borradores`, `emitido` → `Emitidos`. */
  function etiquetaEstado(valor) {
    const s = String(valor).replace(/_/g, ' ');
    const plural = /[aeiouáéíóú]$/i.test(s) ? s + 's' : s + 'es';
    return plural.charAt(0).toUpperCase() + plural.slice(1);
  }

  /** El eje de cobro se lee como se escribe: `sin_facturar` → `sin facturar`. Sin plural. */
  function etiquetaCobro(valor) { return String(valor).replace(/_/g, ' '); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function fechaCorta(v) {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d) ? '—' : d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  /** Clase de la píldora por estado del documento. Reutiliza el inventario AB3, sin CSS nuevo. */
  function claseEstado(estado) {
    if (estado === 'firmado') return 'status-pill status-pill-accepted';
    if (estado === 'emitido') return 'status-pill status-pill-pending';
    return 'status-pill status-pill-draft';
  }
  /** Y la del eje de facturación. `sin_facturar` no pinta nada: lo normal no necesita adorno. */
  function claseCobro(cobro) {
    if (cobro === 'facturado') return 'badge badge-green';
    if (cobro === 'parcial') return 'badge badge-amber';
    return null;
  }

  function renderAlbaranesView(container) {
    container.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'data-card';
    container.appendChild(card);

    const header = document.createElement('div');
    header.className = 'data-card-header';
    card.appendChild(header);

    const left = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'Albaranes'; // APROBADO 5-ago-2026 (nombre del documento, precedente C2)
    title.style.cssText = 'margin:0;font-size:18px';
    left.appendChild(title);
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Cargando…';
    subtitle.style.cssText = 'margin:2px 0 0;font-size:13px;color:var(--muted)';
    left.appendChild(subtitle);
    header.appendChild(left);

    // Cuerpo: se rellena cuando llegan los datos. Antes de eso NO existe ninguna pestaña ni
    // ningún contador — es lo que impide que un fallo se lea como un cero.
    const body = document.createElement('div');
    card.appendChild(body);

    cargar();

    async function cargar() {
      try {
        const datos = await apiRequest('/admin/albaranes');
        pintar(datos);
      } catch (err) {
        pintarError(err);
      }
    }

    function pintarError(err) {
      subtitle.textContent = '';
      body.innerHTML = '';
      // ⚠️ `.alert` SIN modificador de tono está oculta por CSS (styles.css): un aviso invisible
      // sería justo el fallo que este bloque existe para evitar. Lección de SCRUM-303/350.
      const aviso = document.createElement('div');
      aviso.className = 'alert error';
      aviso.style.cssText = 'margin:16px';
      aviso.textContent = 'No se han podido cargar los albaranes. Vuelve a intentarlo.';
      body.appendChild(aviso);
      const detalle = document.createElement('p');
      detalle.style.cssText = 'margin:0 16px 16px;font-size:12px;color:var(--muted)';
      detalle.textContent = String((err && err.message) || err || '');
      body.appendChild(detalle);
    }

    function pintar(datos) {
      const filas = Array.isArray(datos && datos.filas) ? datos.filas : null;
      const ejes = datos && datos.ejes;
      const contadores = datos && datos.contadores;
      if (!filas || !ejes || !contadores) {
        // Respuesta con forma inesperada: se trata como fallo, NO como listado vacío.
        pintarError(new Error('respuesta_incompleta'));
        return;
      }

      subtitle.textContent = contadores.total + ' en total';
      body.innerHTML = '';

      let estadoActivo = TODOS;
      let cobroActivo = TODOS;
      let busqueda = '';

      // ── Eje 1: el estado del DOCUMENTO, en pestañas derivadas del servidor ───────────
      const tabs = document.createElement('div');
      tabs.className = 'data-card-tabs';
      body.appendChild(tabs);

      const definicion = [{ valor: TODOS, n: contadores.total }]
        .concat(ejes.estado.map((v) => ({ valor: v, n: contadores.porEstado[v] || 0 })));

      const botones = definicion.map((d) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'data-card-tab' + (d.valor === TODOS ? ' active' : '');
        b.dataset.tab = d.valor;
        b.textContent = d.valor === TODOS ? 'Todos' : etiquetaEstado(d.valor); // APROBADO
        const badge = document.createElement('span');
        badge.className = 'badge badge-slate';
        badge.dataset.contador = d.valor;
        badge.textContent = String(d.n);
        b.appendChild(badge);
        b.addEventListener('click', () => { estadoActivo = d.valor; activar(); });
        tabs.appendChild(b);
        return b;
      });

      // ── Toolbar: buscador + eje 2 (facturación), que NO es una pestaña más ──────────
      const toolbar = document.createElement('div');
      toolbar.className = 'data-card-toolbar';
      body.appendChild(toolbar);

      const buscador = document.createElement('input');
      buscador.className = 'input';
      buscador.type = 'search';
      buscador.placeholder = 'Buscar por nº, cliente o trabajo';
      buscador.setAttribute('aria-label', 'Buscar albaranes');
      buscador.style.cssText = 'min-width:180px;flex:1';
      buscador.addEventListener('input', () => { busqueda = buscador.value; activar(); });
      toolbar.appendChild(buscador);

      const selCobro = document.createElement('select');
      selCobro.className = 'input';
      selCobro.style.cssText = 'width:auto';
      selCobro.setAttribute('aria-label', 'Facturación'); // APROBADO
      // El eje derivado vive en su propio control, con sus contadores: es OTRA pregunta, no una
      // pestaña más. Aplanarlo perdería el `parcial`.
      //
      // APROBADO con retoque (5-ago-2026): «todos», no «todas» — concuerda con «albaranes», que es
      // lo que se cuenta. «Todas» arrastra a pensar en facturas, que es justo el objeto que este
      // filtro NO cuenta.
      const opciones = [{ valor: TODOS, texto: 'Facturación: todos', n: contadores.total }]
        .concat(ejes.cobro.map((v) => ({ valor: v, texto: etiquetaCobro(v), n: contadores.porCobro[v] || 0 })));
      for (const o of opciones) {
        const op = document.createElement('option');
        op.value = o.valor;
        op.textContent = o.texto + ' (' + o.n + ')';
        selCobro.appendChild(op);
      }
      selCobro.addEventListener('change', () => { cobroActivo = selCobro.value; activar(); });
      toolbar.appendChild(selCobro);

      // ── La tabla ────────────────────────────────────────────────────────────────────
      const scroll = document.createElement('div');
      scroll.className = 'table-scroll';
      body.appendChild(scroll);
      const tabla = document.createElement('table');
      tabla.className = 'table table--cards-mobile';
      scroll.appendChild(tabla);
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr>' +
        ['Nº', 'Emisión', 'Entrega', 'Cliente', 'Trabajo', 'Estado']
          .map((c) => '<th>' + esc(c) + '</th>').join('') + // APROBADAS tal cual
        '</tr>';
      tabla.appendChild(thead);
      const tbody = document.createElement('tbody');
      tabla.appendChild(tbody);

      const vacio = document.createElement('div');
      vacio.className = 'empty-state';
      vacio.style.display = 'none';
      body.appendChild(vacio);

      function visibles() {
        const q = busqueda.trim().toLowerCase();
        return filas.filter((f) => {
          if (estadoActivo !== TODOS && f.estado !== estadoActivo) return false;
          if (cobroActivo !== TODOS && f.estadoCobro !== cobroActivo) return false;
          if (!q) return true;
          return [f.numero, f.cliente, f.trabajo]
            .some((v) => String(v || '').toLowerCase().includes(q));
        });
      }

      function activar() {
        for (const b of botones) b.classList.toggle('active', b.dataset.tab === estadoActivo);
        pintarFilas(visibles());
      }

      function pintarFilas(lista) {
        tbody.innerHTML = '';
        const hayAlgo = lista.length > 0;
        scroll.style.display = hayAlgo ? '' : 'none';
        vacio.style.display = hayAlgo ? 'none' : '';
        if (!hayAlgo) {
          // «No hay ninguno» NUNCA se pinta cuando la consulta falla: ese camino termina en
          // `pintarError` y no llega hasta aquí.
          vacio.innerHTML = '<div class="empty-state-icon">📄</div><div class="empty-state-title">' +
            esc(filas.length === 0 ? 'Todavía no hay albaranes' : 'Ningún albarán coincide con los filtros') +
            '</div>';
          return;
        }
        for (const f of lista) tbody.appendChild(fila(f));
      }

      function fila(f) {
        const tr = document.createElement('tr');

      // ── LAS CELDAS VAN A SU ÁREA DE LA TARJETA (≤640 px) ───────────────────────────
      //
      // `.table--cards-mobile` recompone cada fila en una tarjeta con AREAS CON NOMBRE
      // (id/client/date/status/actions). Una celda sin su clase `cell-*` no cae en su area: cae
      // en la rejilla IMPLICITA, en pares y por orden de aparicion. Medido a 390 px: con un
      // cliente largo, la segunda columna (`auto`) se come el ancho, la primera colapsa y el
      // numero del albaran QUEDA PISADO por la fecha. Las dos hermanas del mismo patron
      // (invoicesView, quotesListView) si ponen estas clases.
      //
      // ⚠️ Lo que NO se toca es la clase del <table>: `table--cards-mobile` se queda.
        const tdNum = document.createElement('td');
        tdNum.className = 'cell-id';
        const enlaceNum = document.createElement('a');
        enlaceNum.href = '#';
        enlaceNum.textContent = f.numero;
        enlaceNum.style.cssText = 'font-weight:600;color:var(--green-700)';
        enlaceNum.addEventListener('click', (e) => {
          e.preventDefault();
          // C2 (SCRUM-302) ya está en main: hay página de detalle a la que llevar.
          if (window.renderAppView) window.renderAppView('albaran-detail', { albaranId: f.id });
        });
        tdNum.appendChild(enlaceNum);
        tr.appendChild(tdNum);

        // La tarjeta ensena la fecha de ENTREGA, que es la operativa: la de emision se oculta
        // en movil (el patron de la casa para lo que no cabe) y sigue en la tabla de escritorio.
        const tdEmision = document.createElement('td');
        tdEmision.className = 'col-hide-mobile';
        tdEmision.textContent = fechaCorta(f.emisionAt);
        tr.appendChild(tdEmision);

        const tdEntrega = document.createElement('td');
        tdEntrega.className = 'cell-date';
        tdEntrega.textContent = fechaCorta(f.fecha);
        tr.appendChild(tdEntrega);

        const tdCliente = document.createElement('td');
        tdCliente.className = 'cell-client';
        tdCliente.textContent = f.cliente || '—';
        tr.appendChild(tdCliente);

        // 🏆 LA COLUMNA QUE ELLOS NO PUEDEN TENER: sus albaranes cuelgan de un cliente, no de una
        // obra. Saber que tres albaranes sin firmar son DEL MISMO TRABAJO cambia lo que haces:
        // haces una llamada, no tres. Por eso va ENLAZADA al Trabajo.
        // Va a la franja inferior a ancho completo (`cell-actions`) por dos motivos: un titulo de
        // obra no cabe en media tarjeta, y esa area exige target >=44 px a sus enlaces — que es
        // justo lo que pide AB6.
        //
        // ⚠️ PERO LA RANURA SE LLAMA `actions` POR ALGO: ESTA PRESTADA. El dia que esta fila reciba
        // acciones de verdad, chocan. Entonces las acciones se quedan con `cell-actions` y el
        // Trabajo necesita RANURA PROPIA en la rejilla (area nueva, propuesta a DESIGN.md). No se
        // comparte: dos cosas en la misma area es como estaba esta tabla antes de tener clases.
        const tdTrabajo = document.createElement('td');
        tdTrabajo.className = 'cell-actions';
        if (f.jobId != null) {
          const enlaceJob = document.createElement('a');
          enlaceJob.href = '#';
          enlaceJob.textContent = f.trabajo || ('#' + f.jobId);
          enlaceJob.style.cssText = 'color:var(--green-700)';
          enlaceJob.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.renderAppView) window.renderAppView('jobs-detail', { jobId: f.jobId });
          });
          tdTrabajo.appendChild(enlaceJob);
        } else {
          tdTrabajo.textContent = '—';
        }
        tr.appendChild(tdTrabajo);

        const tdEstado = document.createElement('td');
        tdEstado.className = 'cell-status';
        const pill = document.createElement('span');
        pill.className = claseEstado(f.estado);
        pill.textContent = f.estado; // el VALOR del modelo, no un rótulo inventado
        tdEstado.appendChild(pill);
        const cls = claseCobro(f.estadoCobro);
        if (cls) {
          const chip = document.createElement('span');
          chip.className = cls;
          chip.style.cssText = 'margin-left:6px';
          chip.textContent = f.estadoCobro;
          tdEstado.appendChild(chip);
        }
        tr.appendChild(tdEstado);

        return tr;
      }

      activar();
    }
  }

  if (typeof window !== 'undefined') window.renderAlbaranesView = renderAlbaranesView;
})();
