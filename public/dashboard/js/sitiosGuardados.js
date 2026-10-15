/**
 * public/dashboard/js/sitiosGuardados.js — SCRUM-1144 (partido de SCRUM-1014)
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * ELEGIR UN SITIO GUARDADO DEL CLIENTE PARA LA DIRECCIÓN DE LA OBRA.
 *
 * Mismo reparto que `quoteDireccionObra.js`: la regla vive en funciones PURAS que la suite
 * ejecuta, y el control (`montarSelector`) lo montan dos pantallas, el editor de presupuestos
 * (`quotesView.js`) y la ficha del Trabajo (`jobDetailView.js`), sin una copia en cada una.
 *
 * 🔴 RELLENA SÓLO POR ACCIÓN DEL PROFESIONAL (P2/DOC-12, `docs/master/SCRUM-602.md`). El campo
 * libre de la obra NUNCA nace con texto: la sugerencia es placeholder. Lo único que esta pieza
 * permite es que el profesional PULSE un sitio de la lista y vea su dirección escrita en el
 * campo, donde la puede corregir antes de enviar. Nada de aquí se dispara al cambiar de cliente.
 *
 * Los sitios los da `GET /admin/customers/:id/sites` (SCRUM-1014, `{ sitios: [...] }`). Darlos de
 * alta, corregirlos o borrarlos es de la ficha del cliente (SCRUM-1146, otro equipo): esta
 * pantalla sólo LEE.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  /**
   * LOS TEXTOS, en un solo sitio.
   * PROCEDENCIA: `docs/microcopy/2026-10-15-SCRUM-1144-selector-sitio-guardado.md`.
   */
  var TEXTOS = {
    boton: 'Elegir un sitio guardado', // APROBADO por el orquestador por delegación del fundador, 26-sep-2026 (SCRUM-1144 comentario 17121)
    sinSitios: 'Este cliente no tiene sitios guardados todavía.', // APROBADO por el orquestador por delegación del fundador, 26-sep-2026 (SCRUM-1144 comentario 17121)
    // Firma del ORQUESTADOR, no del fundador (lo dice el propio comentario). Cabe «Inténtalo de
    // nuevo» porque es un fallo de CARGA: volver a pulsar el botón es lo que puede funcionar.
    errorCarga: 'No se pudieron cargar los sitios guardados. Inténtalo de nuevo.', // APROBADO por el orquestador por delegación del fundador, 15-oct-2026 (SCRUM-1144 comentario 19789)
  };

  var limpio = function (t) { return String(t === null || t === undefined ? '' : t).trim(); };

  /**
   * La dirección del sitio en UNA línea, o `null` si no tiene ninguna.
   *
   * Mismo orden postal que `componerDireccionFacturacion` (calle · CP · población · provincia ·
   * país), y por el mismo motivo los trozos vacíos se filtran ANTES de unir: un sitio con sólo
   * provincia no puede dar «, , , Sevilla» en un papel que ve el cliente.
   */
  function componerDireccionSitio(s) {
    if (!s) return null;
    var trozos = [s.address, s.postalCode, s.city, s.province, s.country]
      .map(limpio)
      .filter(function (t) { return t !== ''; });
    return trozos.length ? trozos.join(', ') : null;
  }

  /**
   * Lo que se escribe en el campo al elegir el sitio.
   *
   * Sin dirección, su NOMBRE («Nave del polígono»): es lo único obligatorio de un sitio y lo que
   * el profesional tecleó para reconocerlo. Queda escrito en el campo, a la vista y editable —
   * no viaja nada que él no vea.
   */
  function textoParaElCampo(s) {
    return componerDireccionSitio(s) || limpio(s && s.name);
  }

  /**
   * Los sitios que se pueden ofrecer, en el orden en que llegan. Fuera lo que no tenga NADA que
   * escribir: un botón que no rellena nada es un control muerto.
   */
  function sitiosElegibles(respuesta) {
    var lista = respuesta && Array.isArray(respuesta.sitios) ? respuesta.sitios : [];
    return lista.filter(function (s) { return s && textoParaElCampo(s) !== ''; });
  }

  /**
   * EL CONTROL: el botón «Elegir un sitio guardado» y su lista, listos para colgar debajo de un
   * campo de dirección de obra. Lo montan el editor de presupuestos y la ficha del Trabajo; vive
   * aquí para que los dos se comporten igual y no haya dos copias que se separen.
   *
   * `o.idLista`   id de la lista (para `aria-controls`); único por pantalla.
   * `o.idCliente` función: el id del cliente AHORA (cadena vacía si no hay).
   * `o.campo`     el `<input>` donde se escribe el sitio elegido.
   * `o.alElegir`  lo que la vista hace después de escribir (la previsualización y el borrador en el
   *               presupuesto; en el Trabajo, nada: se guarda al salir del campo, como al teclear).
   *
   * Devuelve `{ boton, lista, cerrar }`. `cerrar` lo llama la vista cuando cambia el cliente: la
   * lista abierta es de UN cliente, y dejarla abierta ofrecería los sitios del anterior.
   */
  function montarSelector(o) {
    var doc = root.document;
    var boton = doc.createElement('button');
    boton.type = 'button';
    boton.className = 'btn-ghost btn-sm sitios-guardados__boton';
    boton.textContent = TEXTOS.boton;
    boton.setAttribute('aria-expanded', 'false');
    boton.setAttribute('aria-controls', o.idLista);
    var lista = doc.createElement('div');
    lista.className = 'sitios-guardados';
    lista.id = o.idLista;
    lista.hidden = true;

    // Numera cada apertura: si el cliente cambia mientras llega la respuesta, la que llega tarde
    // no pinta nada (sería la lista de otro cliente).
    var peticion = 0;
    function listo() {
      boton.disabled = false;
      boton.removeAttribute('aria-busy');
    }
    function cerrar() {
      peticion++;
      lista.hidden = true;
      lista.replaceChildren();
      boton.setAttribute('aria-expanded', 'false');
      listo();
    }
    function parrafo(clase, texto) {
      var p = doc.createElement('p');
      p.className = clase;
      p.textContent = texto;
      return p;
    }
    function pintar(sitios) {
      lista.replaceChildren();
      if (!sitios.length) lista.appendChild(parrafo('sitios-guardados__vacio', TEXTOS.sinSitios));
      sitios.forEach(function (sitio) {
        var opcion = doc.createElement('button');
        opcion.type = 'button';
        opcion.className = 'sitios-guardados__opcion';
        var nombre = doc.createElement('span');
        nombre.className = 'sitios-guardados__nombre';
        nombre.textContent = limpio(sitio.name);
        opcion.appendChild(nombre);
        var direccion = componerDireccionSitio(sitio);
        if (direccion) {
          var linea = doc.createElement('span');
          linea.className = 'sitios-guardados__direccion';
          linea.textContent = direccion;
          opcion.appendChild(linea);
        }
        opcion.addEventListener('click', function () {
          o.campo.value = textoParaElCampo(sitio);
          cerrar();
          if (typeof o.alElegir === 'function') o.alElegir();
          o.campo.focus();
        });
        lista.appendChild(opcion);
      });
      lista.hidden = false;
      boton.setAttribute('aria-expanded', 'true');
    }
    function abrir() {
      if (!lista.hidden) { cerrar(); return; }
      var idCliente = limpio(o.idCliente());
      if (!idCliente) return;
      cerrar();
      var esta = peticion;
      boton.disabled = true;
      boton.setAttribute('aria-busy', 'true');
      root.apiRequest('/admin/customers/' + encodeURIComponent(idCliente) + '/sites').then(function (respuesta) {
        if (esta !== peticion) return;
        listo();
        pintar(sitiosElegibles(respuesta));
      }, function (err) {
        if (esta !== peticion) return;
        listo();
        // `handled` = la prueba vencida: `_pedir` ya ha llevado al profesional a Planes.
        if (err && err.handled) return;
        // El aviso va AL LADO del botón que falló, no en un toast que se va solo: el botón sigue
        // ahí, y volver a pulsarlo es el «Inténtalo de nuevo».
        var aviso = parrafo('sitios-guardados__error', root.mensajeParaPersona(err, TEXTOS.errorCarga));
        aviso.setAttribute('role', 'alert');
        lista.replaceChildren(aviso);
        lista.hidden = false;
      });
    }
    boton.addEventListener('click', abrir);
    return { boton: boton, lista: lista, cerrar: cerrar };
  }

  var api = {
    TEXTOS: TEXTOS,
    componerDireccionSitio: componerDireccionSitio,
    textoParaElCampo: textoParaElCampo,
    sitiosElegibles: sitiosElegibles,
    montarSelector: montarSelector,
  };

  root.sitiosGuardados = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
