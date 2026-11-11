// public/dashboard/js/jobNuevoModal.js — SCRUM-651 (T2)
//
// ABRIR UN TRABAJO SIN PRESUPUESTO, DESDE LA PANTALLA.
//
// El caso más frecuente del primer cliente real es una AVERÍA: llaman, va un técnico, la arregla.
// Nadie presupuesta una urgencia. Este modal es la puerta que faltaba, y por eso pide LO MÍNIMO:
// el cliente es lo único obligatorio y todo lo demás se completa después con el detalle, que ya
// sabe editarlo. En una urgencia el pro teclea lo justo y sigue.
//
// ✅ MICROCOPY APROBADA AL COMPLETO (regla 30): el fundador firmó los diez textos que quedaban
// el 3-sep-2026, y con ellos `MARCA_651` se retiró ENTERA. Mientras quedó UNO sin firmar la
// constante tenía que seguir viva: retirarla antes habría dado por aprobados los demás sin que
// nadie los firmara. Ése era el motivo, y ya no se cumple.
//
// 🔴 LO QUE ESTE MODAL NO PROMETE: un Trabajo abierto así **no tiene presupuesto detrás**, así que
// no tendrá el contraste «presupuestaste 10, llevas 7, quedan 3» ni el aviso de «te has pasado».
// No se puede: no hay contra qué contrastar. La pantalla no lo finge — no pinta un eje a cero— y
// este modal tampoco insinúa lo contrario.



/**
 * Abre el modal de «trabajo nuevo». `alCrear(job)` recibe el Trabajo ya creado.
 *
 * NO se le pasa `quoteId` ni existe forma de ponerlo: emparejar un Trabajo con un presupuesto es
 * cosa de `ensureJobForQuote`, que mantiene los dos sentidos de la pertenencia (SCRUM-195). Dos
 * escritores para el mismo hecho acaban discrepando.
 */
function abrirModalTrabajoNuevo(alCrear) {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML =
    '<div class="modal" style="max-width:480px">' +
      '<div class="modal-body">' +
        '<div class="alert" id="tn-alert" style="display:none"></div>' +
        '<div class="field">' +
          '<label for="tn-cliente">Cliente</label>' +
          '<select id="tn-cliente" style="width:100%"></select>' +
        '</div>' +
        '<div class="field">' +
          '<label for="tn-tipo">Tipo de intervención</label>' +
          '<select id="tn-tipo" style="width:100%">' +
            '<option value="">Sin especificar</option>' +
            // 🔴 SIN LISTA AQUI: los tipos llegan del servidor (`/admin/me`). Escribirlos en el
            // navegador seria una SEGUNDA fuente del vocabulario cerrado, y el guard de fuente
            // unica cayo por eso mismo cuando se intento.
            (window.appTiposIntervencion || []).map(function (t) {
              return '<option value="' + t.valor + '">' + escHtml(t.rotulo) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label for="tn-direccion">Dirección de la obra</label>' +
          '<input id="tn-direccion" type="text" style="width:100%" maxlength="500"/>' +
        '</div>' +
        '<div class="field">' +
          '<label for="tn-descripcion">Qué hay que hacer</label>' +
          '<textarea id="tn-descripcion" rows="4" style="width:100%" maxlength="2000"></textarea>' +
        '</div>' +
        '<button class="btn-primary" id="tn-crear" style="width:100%;margin-top:8px">Abrir trabajo</button>' +
      '</div>' +
    '</div>';
  overlay.querySelector('.modal').prepend(
    cabeceraModal({ titulo: 'Trabajo nuevo', idCierre: 'tn-cerrar' }),
  );
  document.body.appendChild(overlay);

  var cerrar = function () { overlay.remove(); };
  overlay.querySelector('#tn-cerrar').onclick = cerrar;
  overlay.addEventListener('click', function (e) { if (e.target === overlay) cerrar(); });

  var sel = overlay.querySelector('#tn-cliente');
  var alerta = overlay.querySelector('#tn-alert');
  var btn = overlay.querySelector('#tn-crear');

  var aviso = function (msg) {
    alerta.textContent = msg || '';
    alerta.className = 'alert' + (msg ? ' error' : '');
    alerta.style.display = msg ? 'block' : 'none';
  };

  // SCRUM-1681 ③ · ALTA DE CLIENTE SIN SALIR. Con un cliente nuevo había que cerrar, ir a Clientes y
  // volver (PILOTO-1: una avería es casi siempre de alguien que aún no está dado de alta). Es EL
  // MISMO selector que el del presupuesto (SCRUM-591, `quotesView.js` `pintarOpcionesDeCliente`):
  //   · «Selecciona un cliente…» vacío arriba — ya no se preselecciona el primero de la lista sin
  //     que nadie lo elija (el «Elige un cliente.» de abajo lo para);
  //   · «+ Nuevo cliente» JUSTO DETRÁS, nunca al final: con doscientos clientes el final de un
  //     `<select>` nativo no existe (asesor, 3-sep-2026);
  //   · y abre EL MISMO formulario de Clientes (`altaClienteModal.abrirNuevo`), con su NIF, su
  //     switch Empresa/Persona y su aviso de duplicado; el creado queda elegido.
  // Los tres textos son los que el selector del presupuesto ya pinta, palabra por palabra: aquí no
  // entra ninguno nuevo (regla 39). «+ Nuevo cliente» se firmó precisamente para una `<option>`.
  var VALOR_ALTA = '__alta_cliente__';
  var lista = [];
  var previo = '';
  var pintarClientes = function (elegido) {
    sel.innerHTML =
      '<option value="">' + escHtml('Selecciona un cliente…') + '</option>' +
      '<option value="' + VALOR_ALTA + '">' + escHtml('+ Nuevo cliente') + '</option>' +
      lista.map(function (c) {
        return '<option value="' + c.id + '">' + escHtml(c.name || ('#' + c.id)) + '</option>';
      }).join('');
    sel.value = elegido ? String(elegido) : '';
    previo = sel.value;
  };
  sel.addEventListener('change', function () {
    if (sel.value !== VALOR_ALTA) { previo = sel.value; return; }
    // La entrada de alta es una ACCIÓN, no un cliente: el selector vuelve a lo que tenía, y si el
    // alta se cancela no queda «+ Nuevo cliente» marcado como si fuera alguien.
    sel.value = previo;
    if (!window.altaClienteModal) { aviso('No se ha podido abrir el alta de cliente.'); return; }
    window.altaClienteModal.abrirNuevo({
      alGuardar: function (cliente) {
        if (!cliente || !cliente.id) return;
        lista.unshift(cliente);
        pintarClientes(cliente.id);
        btn.disabled = false;
        aviso('');
      },
    });
  });

  // El cliente es lo único obligatorio, así que si no hay ninguno el modal lo DICE en vez de
  // dejar un desplegable vacío que no explica por qué no se puede seguir. Y desde SCRUM-1681 la
  // salida está en el propio desplegable: «+ Nuevo cliente».
  apiRequest('/admin/customers').then(function (cs) {
    lista = Array.isArray(cs) ? cs : (cs && cs.items) || [];
    pintarClientes(null);
    if (!lista.length) {
      btn.disabled = true;
      aviso('Primero necesitas un cliente.');
    }
  }).catch(function () {
    btn.disabled = true;
    aviso('No se han podido cargar tus clientes.');
  });

  btn.onclick = function () {
    var customerId = Number(sel.value);
    if (!customerId) { aviso('Elige un cliente.'); return; }
    btn.disabled = true;
    aviso('');
    apiRequest('/admin/jobs', {
      method: 'POST',
      body: JSON.stringify({
        customerId: customerId,
        // Vacío = no consta. NO se manda cadena vacía como si fuera un valor.
        tipoIntervencion: overlay.querySelector('#tn-tipo').value || undefined,
        direccion: overlay.querySelector('#tn-direccion').value,
        descripcion: overlay.querySelector('#tn-descripcion').value,
      }),
    }).then(function (job) {
      cerrar();
      if (typeof alCrear === 'function') alCrear(job);
    }).catch(function () {
      btn.disabled = false;
      aviso('No se ha podido abrir el trabajo.');
    });
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { abrirModalTrabajoNuevo: abrirModalTrabajoNuevo };
}
