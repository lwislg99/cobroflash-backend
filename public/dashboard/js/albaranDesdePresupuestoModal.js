// public/dashboard/js/albaranDesdePresupuestoModal.js — SCRUM-606 (ALB-01)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// «NUEVO ALBARÁN» EN LA PESTAÑA ALBARANES: PRIMERO, ¿DE QUÉ PRESUPUESTO?
//
// El ticket lo dice con estas palabras: «En la pestaña Albaranes, "Nuevo albarán" → buscador de
// presupuesto → se parte de ese presupuesto con todo su contenido». Este modal es ese buscador, y
// SOLO eso: elige el origen y se aparta.
//
// ── 🔴 LO QUE ESTE FICHERO NO HACE, Y ES EL CORAZÓN DEL TICKET ──────────────────────────────
//
// **Aquí no se crea ningún albarán.** Ni un `POST`. El alta del albarán tiene UN solo sitio en
// todo el dashboard —`openAlbCrearSheet`, en `jobDetailView.js`— y eso es una decisión con
// nombre: SCRUM-303 la tomó al descubrir que el camino MÁS CORTO era el PEOR (creaba un albarán
// vacío con su número de serie ya quemado), y dejó un guard por AST que exige que el alta esté en
// un único punto.
//
// Ese guard lee `jobDetailView.js`. Una segunda alta escrita AQUÍ no le saldría en el censo: sería
// invisible para el guard que existe justo para impedirla. Así que este modal elige, navega, y el
// alta la sigue haciendo la única puerta que hay — con su prellenado (SCRUM-257), su origen por
// línea (SCRUM-367), su interruptor de precios (ALB-02) y su texto de cabecera y observaciones
// (DOC-03) ya dentro, sin copiar nada.
//
// ── POR QUÉ SE ATERRIZA EN EL TRABAJO Y NO SE ABRE LA HOJA AQUÍ MISMO ───────────────────────
//
// Porque es la verdad del modelo, y es además el argumento con el que el fundador descartó el
// albarán suelto: `Albaran.jobId` es obligatorio, la columna TRABAJO no puede quedar vacía y todo
// albarán cuelga del Trabajo de su presupuesto. Enseñar ese Trabajo en el momento de crear no es
// un peaje: es lo que hace visible el encadenamiento que el ticket quiere «sin la rigidez» de
// Quipu.
//
// ── MICROCOPY · REGLA 30 · NINGUNO DE ESTOS SEIS TEXTOS ESTÁ APROBADO ───────────────────────
//
// Van con el marcador VISIBLE a propósito, como hicieron `albaranesView` y el Libro registro antes
// de que el asesor los firmara: se ve en pantalla para que nadie encienda por descuido texto que
// nadie ha aprobado. El rótulo del BOTÓN no está aquí — vive en `atajoNuevo.js`, que es la fuente
// única de los rótulos de «nuevo» de las listas, y allí tiene su propio contador.
// ═════════════════════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  /** La grafía que CUENTA el censo de SCRUM-402/667. Desde un solo sitio. */
  var MARCA = '[PENDIENTE microcopy oficial]';

  /**
   * Cuántas ranuras de ESTE fichero esperan la firma del fundador. Se declara para que nadie las
   * cuente a mano y para que añadir una sin decirlo salga rojo (patrón de `PV_SIN_APROBAR` y de
   * `ALB_OCULTAR_PRECIOS_SIN_APROBAR`). Cuando el fundador firme, el número BAJA y el trinquete
   * aprieta; no se borra mientras quede una sin firmar.
   */
  var ALB_ORIGEN_SIN_APROBAR = 6;

  var COPY = {
    buscar: MARCA + ' Busca por nº de presupuesto, cliente o teléfono',
    vacio: MARCA + ' Ningún presupuesto coincide con esa búsqueda',
    // Los DOS motivos del conjunto cerrado de `presupuestosParaAlbaran.ts`. Cada uno con su
    // texto: un motivo sin frase deja al profesional mirando un código, que es el defecto que
    // SCRUM-275 cerró en /login.html.
    sin_trabajo: MARCA + ' Todavía no tiene trabajo: acepta el presupuesto y vuelve',
    trabajo_no_visible: MARCA + ' Su trabajo no es tuyo',
    truncado: MARCA + ' Puede haber más: afina la búsqueda',
    error: MARCA + ' No se han podido cargar los presupuestos',
  };

  /**
   * Abre el buscador. `alElegir({jobId, quoteId, numero})` recibe el presupuesto ELEGIDO —nunca
   * uno no elegible: esas filas no son pulsables y no llaman a nadie.
   */
  function abrirModalAlbaranDesdePresupuesto(alElegir) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = '560px';
    overlay.appendChild(modal);

    function cerrar() {
      overlay.remove();
      document.removeEventListener('keydown', alPulsarTecla);
    }
    function alPulsarTecla(e) { if (e.key === 'Escape') cerrar(); }

    // El TÍTULO del modal es el MISMO rótulo del botón, leído de su fuente única. Escribirlo otra
    // vez aquí daría dos textos para la misma acción y el día que el fundador firme uno, el otro
    // se quedaría con el marcador puesto.
    var rotulo = (window.atajoNuevo && window.atajoNuevo.textoDe('albaranes')) || '';
    modal.appendChild(window.cabeceraModal({ titulo: rotulo, alCerrar: cerrar }));

    var body = document.createElement('div');
    body.className = 'modal-body';
    modal.appendChild(body);

    var aviso = document.createElement('div');
    aviso.className = 'alert';
    aviso.style.display = 'none';
    body.appendChild(aviso);

    var campo = document.createElement('div');
    campo.className = 'field';
    var input = document.createElement('input');
    input.type = 'search';
    input.className = 'input';
    input.style.width = '100%';
    input.placeholder = COPY.buscar;
    input.setAttribute('aria-label', COPY.buscar);
    campo.appendChild(input);
    body.appendChild(campo);

    var lista = document.createElement('div');
    // Alto máximo con scroll PROPIO: la lista puede traer hasta el tope del servidor y sin esto
    // el modal crecería hasta sacar su botón de cerrar fuera de la pantalla en un móvil.
    lista.style.cssText = 'max-height:52vh;overflow-y:auto;margin-top:8px';
    body.appendChild(lista);

    document.body.appendChild(overlay);
    document.addEventListener('keydown', alPulsarTecla);
    input.focus();

    // ── LA CARGA ────────────────────────────────────────────────────────────────────────────
    //
    // `peticion` numera cada búsqueda y solo pinta la ÚLTIMA. Sin esto, teclear rápido deja que
    // una respuesta lenta de «P26» aterrice DESPUÉS de la de «P2601» y el profesional ve una lista
    // que no corresponde a lo que tiene escrito.
    var peticion = 0;
    var temporizador = null;

    function pintarAviso(texto, tono) {
      if (!texto) { aviso.style.display = 'none'; aviso.className = 'alert'; return; }
      // El tono es OBLIGATORIO: sin él la hoja de estilos lo esconde y el aviso no existe
      // (lección de SCRUM-303, comprobada contra `styles.css`).
      aviso.className = 'alert ' + tono;
      aviso.textContent = texto;
      aviso.style.display = '';
    }

    function pintarFilas(datos) {
      lista.innerHTML = '';
      var filas = (datos && datos.presupuestos) || [];
      if (!filas.length) {
        var vacio = document.createElement('div');
        vacio.className = 'empty-state';
        vacio.textContent = COPY.vacio;
        lista.appendChild(vacio);
        return;
      }
      for (var i = 0; i < filas.length; i++) lista.appendChild(fila(filas[i]));
    }

    function fila(f) {
      var caja = document.createElement(f.elegible ? 'button' : 'div');
      if (f.elegible) caja.type = 'button';
      caja.style.cssText = 'display:block;width:100%;text-align:left;padding:10px 12px;'
        + 'border:1px solid var(--border);border-radius:8px;margin-bottom:6px;background:var(--surface);'
        + (f.elegible ? 'cursor:pointer' : 'opacity:.65;cursor:default');

      var titulo = document.createElement('div');
      titulo.style.cssText = 'font-weight:600;color:var(--green-700)';
      // `textContent` en las dos líneas: el número y el nombre del cliente son DATOS del
      // profesional y no se interpolan en HTML (regla de la casa en todas las listas).
      titulo.textContent = 'P' + String(f.numero) + ' · ' + (f.cliente || '—');
      caja.appendChild(titulo);

      var pie = document.createElement('div');
      pie.style.cssText = 'font-size:12px;color:var(--muted);margin-top:2px';
      var importe = typeof fmtMoneyEs === 'function'
        ? fmtMoneyEs(Number(f.total || 0), f.currency || 'EUR')
        : String(f.total == null ? '—' : f.total);
      // El ESTADO se imprime tal cual viene del modelo (`accepted`, `draft`…): es dato, no copy —
      // el mismo criterio con el que `albaranesView` pinta `emitido` sin traducirlo.
      pie.textContent = importe + (f.estado ? ' · ' + f.estado : '');
      caja.appendChild(pie);

      if (!f.elegible) {
        var motivo = document.createElement('div');
        motivo.style.cssText = 'font-size:12px;color:var(--muted);margin-top:4px';
        // Un motivo desconocido NO se calla y NO se inventa: se enseña su código. Es la única
        // rama por la que el conjunto cerrado de motivos podría crecer sin que nadie escriba su
        // texto, y así se ve en pantalla en vez de desaparecer.
        motivo.textContent = Object.prototype.hasOwnProperty.call(COPY, f.motivo)
          ? COPY[f.motivo] : String(f.motivo || '');
        caja.appendChild(motivo);
        return caja;
      }

      caja.addEventListener('click', function () {
        cerrar();
        if (typeof alElegir === 'function') {
          alElegir({ jobId: f.jobId, quoteId: f.quoteId, numero: f.numero });
        }
      });
      return caja;
    }

    function cargar() {
      var mio = ++peticion;
      // 'Cargando…' NO es texto de este ticket ni entra en su contador: es la cadena que ya usan
      // `invoicesView.js` y `albaranesView.js`, copiada tal cual. Someterla aquí la convertiría en
      // copy oficial de pantallas que este ticket no toca.
      lista.innerHTML = '';
      var cargando = document.createElement('div');
      cargando.className = 'empty-state';
      cargando.textContent = 'Cargando…';
      lista.appendChild(cargando);

      apiRequest('/admin/albaranes/presupuestos?q=' + encodeURIComponent(input.value.trim()))
        .then(function (datos) {
          if (mio !== peticion) return; // llegó tarde: manda la búsqueda de después
          pintarAviso(datos && datos.truncado ? COPY.truncado : null, 'warning');
          pintarFilas(datos);
        })
        .catch(function () {
          if (mio !== peticion) return;
          // 🔴 UN FALLO NO SE PINTA COMO UN VACÍO. Es la regla que `albaranesView` escribió para
          // esta misma pantalla: un «no hay ninguno» por una lectura rota manda al profesional a
          // buscar por otro sitio creyendo que su presupuesto no existe.
          lista.innerHTML = '';
          pintarAviso(COPY.error, 'error');
        });
    }

    input.addEventListener('input', function () {
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(cargar, 250);
    });
    cargar();

    return { cerrar: cerrar };
  }

  window.abrirModalAlbaranDesdePresupuesto = abrirModalAlbaranDesdePresupuesto;
  window.ALB_ORIGEN_COPY = COPY;
  window.ALB_ORIGEN_SIN_APROBAR = ALB_ORIGEN_SIN_APROBAR;
})();
