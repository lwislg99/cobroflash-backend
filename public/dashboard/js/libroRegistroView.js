// public/dashboard/js/libroRegistroView.js — SCRUM-296 (A6)
//
// EL LIBRO DE FACTURAS EMITIDAS. Es lo primero que pide un asesor, y cualquier facturador lo
// tiene. Lo que ninguno puede enseñar es la columna de la derecha: **cada asiento con su
// presupuesto firmado, su albarán y su cobro**. Ningún facturador puede, porque no tiene los tres
// objetos atados; nosotros sí.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 AQUÍ UN FALLO NO PUEDE PARECER UN LIBRO VACÍO
//
// Un libro vacío no se lee como «no encontré nada»: se lee como **«no facturaste nada»**, y ante
// Hacienda eso es una afirmación. Por eso esta pantalla NO pinta tabla cuando la carga falla:
// pinta un aviso. Y cuando el servidor dice que miró facturas y no salió ningún asiento, tampoco
// dice «no tienes» — avisa de que el libro no cuadra y da los dos números (`miradas` frente a
// asientos). «No tienes ninguna» solo se muestra cuando el servidor confirma que miró CERO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LOS IMPORTES ILEGIBLES NO SE PINTAN COMO 0,00 €
//
// El servidor los manda como `null` (familia SCRUM-271: `Number('')` es 0). Un cero pintado sería
// un asiento que AFIRMA que esa factura no cobró nada. Salen como «—» y con su aviso arriba, con
// el número de factura delante.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// MICROCOPY: TODAS LAS RANURAS VAN MARCADAS (regla 30)
//
// Ni un rótulo de esta pantalla está aprobado. Cada uno sale con `[PENDIENTE microcopy oficial]`
// DELANTE del texto, no en vez de él: con el marcador solo, «no tienes facturas» y «el libro no
// cuadra» dirían LO MISMO, y son justo los dos mensajes que esta pantalla existe para no
// confundir. El guard (`tests/scrum296-pantalla-libro.test.mjs`) compara ranura a ranura contra
// estas constantes, así que el día que se aprueben los textos sigue verde sin tocarlo — patrón de
// SCRUM-263/303.
(function () {
  const MARCADOR = '[PENDIENTE microcopy oficial]';

  // SCRUM-406 · el ÚNICO contacto del producto. No es microcopy: es el destino, el mismo que ya
  // usan las páginas legales y la guía de inicio. ⚠️ Está escrito a mano en 6 sitios (privacidad ×3,
  // términos, tutorial.js y aquí): el día que cambie hay que cambiarlo en todos, y el que se olvide
  // deja un canal muerto sin que nadie se entere. Unificarlo es hallazgo aparte, no se hace aquí.
  const CONTACTO = 'hola@yaqu.app';
  /** Marca una ranura de copy sin decidir. El texto va DETRÁS, para que se pueda leer y juzgar. */
  function rotulo(t) { return MARCADOR + ' ' + t; }

  const COPY = {
    titulo: rotulo('Libro de facturas emitidas'),
    menu: rotulo('Libro de registro'),
    cargando: 'Cargando…', // NO es de este ticket: cadena ya usada en invoicesView.js, copiada tal cual
    recuento: (n) => rotulo(n + ' asientos'),
    error: rotulo('No se ha podido cargar el libro. Vuelve a intentarlo.'),
    // Los dos vacíos, que existen para NO decir lo mismo:
    vacioDeVerdad: rotulo('Todavía no has emitido ninguna factura.'),
    descuadre: (miradas) => rotulo(
      'El libro no cuadra: se han revisado ' + miradas + ' facturas y no ha salido ningún asiento. '
      + 'No lo tomes como que no has facturado.'),
    avisoIlegibles: (numeros) => rotulo(
      'Hay importes que no se han podido leer (' + numeros.join(', ') + '). '
      + 'No los tomes por cero: escríbenos y los revisamos.'),
    avisoAjenas: rotulo('Se han descartado facturas que no son de este negocio.'),
    avisoSinNumero: (n) => rotulo(n + (n === 1 ? ' factura sin número no aparece como asiento.' : ' facturas sin número no aparecen como asiento.')),
    colNumero: rotulo('Número'),
    colFecha: rotulo('Fecha'),
    colTipo: rotulo('Tipo'),
    colBase: rotulo('Base'),
    colCuota: rotulo('IVA'),
    colTotal: rotulo('Total'),
    colEstado: rotulo('Estado'),
    colTrazas: rotulo('De dónde viene y dónde acabó'),
    trazaPresupuestoFirmado: rotulo('Presupuesto firmado'),
    trazaPresupuestoSinFirmar: rotulo('Presupuesto sin firmar'),
    trazaAlbaran: rotulo('Albarán'),
    trazaCobro: rotulo('Cobro'),
    trazaNoSellado: rotulo('Albarán posterior al sello'),
    sinTrazas: rotulo('Factura suelta'),
  };

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

  /**
   * Importe. `null` NO es cero: sale «—». Y el formato es el de España con su símbolo, porque un
   * libro de registro se imprime y se entrega — 9.999,99 € tiene que caber y leerse.
   *
   * SCRUM-436 · El «—» se queda: es una decisión deliberada de ESTA pantalla y la única correcta
   * en un libro de registro. Lo que cambia es QUIÉN formatea: `fmtMoneyEsOAusente` (api.js), que
   * delega en el `fmtMoneyEs` de la casa.
   *
   * 🔴 Y no es cosmético. Este `Intl` propio NO llevaba `useGrouping: 'always'`, así que en es-ES
   * imprimía «9999,99 €» — **justo lo que el comentario de arriba exige que NO pase**, y lo que
   * A18.2 (AB6) arregló en el formateador compartido. Cada copia del formato reintroduce el
   * defecto que la original ya había corregido.
   */
  function euros(v, moneda) {
    return fmtMoneyEsOAusente(v, moneda || 'EUR');
  }

  /** Una marca de trazabilidad. Reutiliza el inventario AB3 (`badge`), sin CSS nuevo. */
  function marca(texto, tono) {
    const s = document.createElement('span');
    s.className = 'badge ' + (tono || 'badge-slate');
    s.textContent = texto;
    s.style.cssText = 'margin:0 4px 4px 0;display:inline-block';
    return s;
  }

  function renderLibroRegistroView(container) {
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
    title.style.cssText = 'margin:0;font-size:18px';
    left.appendChild(title);
    const subtitle = document.createElement('p');
    subtitle.id = 'libro-recuento';
    subtitle.textContent = COPY.cargando;
    subtitle.style.cssText = 'margin:2px 0 0;font-size:13px;color:var(--muted)';
    left.appendChild(subtitle);
    header.appendChild(left);

    // El cuerpo no existe hasta que llegan los datos: es lo que impide que un fallo se lea como
    // una tabla vacía.
    const body = document.createElement('div');
    card.appendChild(body);

    cargar();

    async function cargar() {
      try {
        pintar(await apiRequest('/admin/libro-registro'));
      } catch (err) {
        pintarError(err);
      }
    }

    function pintarError(err) {
      subtitle.textContent = '';
      body.innerHTML = '';
      // ⚠️ `.alert` sin modificador de tono está OCULTA por CSS (lección de SCRUM-303/350): un
      // aviso invisible aquí sería exactamente el fallo que se lee como «no facturaste».
      const aviso = document.createElement('div');
      aviso.className = 'alert error';
      aviso.style.cssText = 'margin:16px';
      aviso.textContent = COPY.error;
      body.appendChild(aviso);
      const detalle = document.createElement('p');
      detalle.style.cssText = 'margin:0 16px 16px;font-size:12px;color:var(--muted)';
      detalle.textContent = String((err && err.message) || err || '');
      body.appendChild(detalle);
    }

    // SCRUM-406 · «escríbenos» sin decir dónde no es un canal: es una instrucción sin destino, y
    // encima en la pantalla fiscal. `mailto` es OPCIONAL y se pinta como NODO aparte —no dentro del
    // texto— porque el copy de esta pantalla sigue siendo `[PENDIENTE microcopy oficial]`: el día
    // que se apruebe puede no llevar la palabra «escríbenos», y un enlace cosido a una palabra
    // concreta se rompería en silencio. Aquí no depende de las palabras.
    function avisar(texto, tono, mailto) {
      const a = document.createElement('div');
      // ⚠️ EL TONO SALE DE ESTA LISTA, NO DE LA IMAGINACIÓN. `styles.css` OCULTA
      // (`display:none`) toda `.alert` que no lleve `success|ok|error|info|warning`, así que un
      // tono inventado no se ve raro: NO SE VE. Escribí `'warn'` y el aviso de importes
      // ilegibles desapareció; lo cazó la CAPTURA, no el conteo de nodos — el nodo estaba ahí.
      const TONOS = ['success', 'ok', 'error', 'info', 'warning'];
      a.className = 'alert ' + (TONOS.includes(tono) ? tono : 'warning');
      a.style.cssText = 'margin:16px 16px 0';
      a.textContent = texto;
      if (mailto) {
        const enlace = document.createElement('a');
        enlace.href = 'mailto:' + mailto;
        enlace.textContent = ' ' + mailto;
        enlace.style.cssText = 'color:inherit;font-weight:600';
        a.appendChild(enlace);
      }
      body.appendChild(a);
    }

    function pintar(libro) {
      const asientos = libro && Array.isArray(libro.asientos) ? libro.asientos : null;
      // `miradas` tiene que venir SIEMPRE: es el número que distingue «no había» de «no supe
      // leer». Si no viene, la respuesta está incompleta y se trata como fallo, no como cero.
      if (!asientos || typeof libro.miradas !== 'number') {
        pintarError(new Error('respuesta_incompleta'));
        return;
      }

      body.innerHTML = '';
      subtitle.textContent = COPY.recuento(asientos.length);

      if (Array.isArray(libro.importesIlegibles) && libro.importesIlegibles.length > 0) {
        avisar(COPY.avisoIlegibles(libro.importesIlegibles), 'warning', CONTACTO);
      }
      if (libro.ajenas > 0) avisar(COPY.avisoAjenas, 'warning');
      if (libro.sinNumero > 0) avisar(COPY.avisoSinNumero(libro.sinNumero), 'warning');

      if (asientos.length === 0) {
        // Las dos ramas que NO se pueden confundir.
        if (libro.miradas > 0) avisar(COPY.descuadre(libro.miradas), 'warning');
        else {
          const vacio = document.createElement('p');
          vacio.style.cssText = 'margin:24px 16px;color:var(--muted);font-size:14px';
          vacio.textContent = COPY.vacioDeVerdad;
          body.appendChild(vacio);
        }
        return;
      }

      // Envoltorio con scroll PROPIO: un libro tiene ocho columnas y en un móvil de 360 px no
      // caben. Scrollea la tabla, nunca la página.
      // `.table-scroll` + `.table`: el inventario AB3, no una clase nueva. Escribí `data-table`
      // de mi cosecha y el CSS no la conocía — la tabla salió sin padding, con el importe pegado
      // al estado. Se vio en la CAPTURA, no en el conteo de nodos.
      //
      // NO lleva `table--cards-mobile` (el patrón de Facturas), y es una decisión: esa variante
      // apila la fila en una rejilla de CINCO áreas fijas —id, cliente, fecha, importe, estado— y
      // este libro tiene ocho columnas, con la de trazabilidad sin sitio en esa rejilla. Un libro
      // de registro es un documento ANCHO: scrollea dentro de su envoltorio, y la página no.
      const scroll = document.createElement('div');
      scroll.className = 'table-scroll';
      scroll.style.cssText = 'margin-top:8px';
      body.appendChild(scroll);

      const tabla = document.createElement('table');
      tabla.className = 'table';
      scroll.appendChild(tabla);

      const thead = document.createElement('thead');
      const trh = document.createElement('tr');
      for (const c of [COPY.colNumero, COPY.colFecha, COPY.colTipo, COPY.colBase, COPY.colCuota,
        COPY.colTotal, COPY.colEstado, COPY.colTrazas]) {
        const th = document.createElement('th');
        th.textContent = c;
        // SIN `nowrap`: los rótulos van con el marcador de 29 caracteres delante, y forzarlos a
        // una línea empujaba la tabla a 2.277 px de scroll (medido en el banco AB6). Los
        // encabezados envuelven; los datos —número, fecha, importes— siguen en una sola línea,
        // que es donde importa.
        th.style.cssText = 'text-align:left;vertical-align:bottom';
        trh.appendChild(th);
      }
      thead.appendChild(trh);
      tabla.appendChild(thead);

      const tbody = document.createElement('tbody');
      tabla.appendChild(tbody);

      for (const a of asientos) {
        const tr = document.createElement('tr');
        tr.dataset.numero = a.numero;

        const celda = (texto, extra) => {
          const td = document.createElement('td');
          td.textContent = texto;
          if (extra) td.style.cssText = extra;
          tr.appendChild(td);
          return td;
        };

        celda(a.numero, 'white-space:nowrap;font-variant-numeric:tabular-nums');
        celda(fechaCorta(a.fecha), 'white-space:nowrap');
        celda(a.tipo || '—');
        celda(euros(a.base, a.moneda), 'white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums');
        celda(euros(a.cuota, a.moneda), 'white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums');
        const tdTotal = celda(euros(a.total, a.moneda),
          'white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums;font-weight:600');
        if (a.importeIlegible) {
          tdTotal.dataset.ilegible = '1';
          tdTotal.style.color = 'var(--muted)';
        }
        celda(a.estado || '—');

        // ── La columna que ningún facturador puede pintar ───────────────────────────────────
        // SIN tope de ancho, y es una decisión MEDIDA: le puse un `max-width:280px` creyendo que
        // evitaría que la tabla se estirase, y el banco dijo que no cambiaba el ancho (760 px a
        // 360, 1.246 a 1.280) y ENGORDABA las filas —262 px contra 244 a 360—, porque obliga a
        // envolver más marcas. Lo que estiraba la tabla eran los encabezados con `nowrap`.
        const tdTrazas = document.createElement('td');
        const e = a.enlaces || {};
        let alguna = false;
        if (e.presupuestoId != null) {
          alguna = true;
          tdTrazas.appendChild(e.presupuestoFirmado
            ? marca(COPY.trazaPresupuestoFirmado, 'badge-green')
            : marca(COPY.trazaPresupuestoSinFirmar, 'badge-amber'));
        }
        if (Array.isArray(e.albaranes)) {
          for (const alb of e.albaranes) {
            alguna = true;
            tdTrazas.appendChild(marca(COPY.trazaAlbaran + ' ' + (alb.numero || alb.albaranId), 'badge-slate'));
          }
        }
        if (e.albaranesNoSellados > 0) {
          alguna = true;
          tdTrazas.appendChild(marca(COPY.trazaNoSellado + ' ×' + e.albaranesNoSellados, 'badge-amber'));
        }
        if (e.cobroId != null) {
          alguna = true;
          tdTrazas.appendChild(marca(COPY.trazaCobro, 'badge-green'));
        }
        // La factura suelta (SCRUM-289) es legítima y tiene que VERSE como tal, no salir en blanco
        // — una celda vacía se lee como «falta un dato».
        if (!alguna) tdTrazas.appendChild(marca(COPY.sinTrazas, 'badge-slate'));
        tr.appendChild(tdTrazas);

        tbody.appendChild(tr);
      }
    }
  }

  window.renderLibroRegistroView = renderLibroRegistroView;
  window.LIBRO_COPY = COPY; // el guard de microcopy compara contra las constantes, no contra literales
})();
