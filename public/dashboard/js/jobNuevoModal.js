// public/dashboard/js/jobNuevoModal.js — SCRUM-651 (T2)
//
// ABRIR UN TRABAJO SIN PRESUPUESTO, DESDE LA PANTALLA.
//
// El caso más frecuente del primer cliente real es una AVERÍA: llaman, va un técnico, la arregla.
// Nadie presupuesta una urgencia. Este modal es la puerta que faltaba, y por eso pide LO MÍNIMO:
// el cliente es lo único obligatorio y todo lo demás se completa después con el detalle, que ya
// sabe editarlo. En una urgencia el pro teclea lo justo y sigue.
//
// ⚠️ MICROCOPY SIN APROBAR (regla 30) SALVO «Tipo de intervención», firmada el 3-sep-2026 y
// por eso ya sin marca. Los DEMÁS textos visibles salen de `MARCA_651`, UNA sola
// constante: así aprobar el copy los apaga a la vez y el censo de SCRUM-402 cuenta 1, no ocho.
// El día que el fundador los firme, se sustituyen y la entrada del censo se borra.
//
// 🔴 LO QUE ESTE MODAL NO PROMETE: un Trabajo abierto así **no tiene presupuesto detrás**, así que
// no tendrá el contraste «presupuestaste 10, llevas 7, quedan 3» ni el aviso de «te has pasado».
// No se puede: no hay contra qué contrastar. La pantalla no lo finge — no pinta un eje a cero— y
// este modal tampoco insinúa lo contrario.

/** El marcador único de este ticket. Aprobar el copy = tocar solo esta constante. */
var MARCA_651 = '[PENDIENTE microcopy oficial]';


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
          '<label for="tn-cliente">' + MARCA_651 + ' Cliente</label>' +
          '<select id="tn-cliente" style="width:100%"></select>' +
        '</div>' +
        '<div class="field">' +
          '<label for="tn-tipo">Tipo de intervención</label>' +
          '<select id="tn-tipo" style="width:100%">' +
            '<option value="">' + MARCA_651 + ' Sin especificar</option>' +
            // 🔴 SIN LISTA AQUI: los tipos llegan del servidor (`/admin/me`). Escribirlos en el
            // navegador seria una SEGUNDA fuente del vocabulario cerrado, y el guard de fuente
            // unica cayo por eso mismo cuando se intento.
            (window.appTiposIntervencion || []).map(function (t) {
              return '<option value="' + t.valor + '">' + escHtml(t.rotulo) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label for="tn-direccion">' + MARCA_651 + ' Dirección de la obra</label>' +
          '<input id="tn-direccion" type="text" style="width:100%" maxlength="500"/>' +
        '</div>' +
        '<div class="field">' +
          '<label for="tn-descripcion">' + MARCA_651 + ' Qué hay que hacer</label>' +
          '<textarea id="tn-descripcion" rows="4" style="width:100%" maxlength="2000"></textarea>' +
        '</div>' +
        '<button class="btn-primary" id="tn-crear" style="width:100%;margin-top:8px">' + MARCA_651 + ' Abrir trabajo</button>' +
      '</div>' +
    '</div>';
  overlay.querySelector('.modal').prepend(
    cabeceraModal({ titulo: MARCA_651 + ' Trabajo nuevo', idCierre: 'tn-cerrar' }),
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

  // El cliente es lo único obligatorio, así que si no hay ninguno el modal lo DICE en vez de
  // dejar un desplegable vacío que no explica por qué no se puede seguir.
  apiRequest('/admin/customers').then(function (cs) {
    var lista = Array.isArray(cs) ? cs : (cs && cs.items) || [];
    if (!lista.length) {
      btn.disabled = true;
      aviso(MARCA_651 + ' Primero necesitas un cliente.');
      return;
    }
    sel.innerHTML = lista.map(function (c) {
      return '<option value="' + c.id + '">' + escHtml(c.name || ('#' + c.id)) + '</option>';
    }).join('');
  }).catch(function () {
    btn.disabled = true;
    aviso(MARCA_651 + ' No hemos podido cargar tus clientes.');
  });

  btn.onclick = function () {
    var customerId = Number(sel.value);
    if (!customerId) { aviso(MARCA_651 + ' Elige un cliente.'); return; }
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
      aviso(MARCA_651 + ' No se ha podido abrir el trabajo.');
    });
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { abrirModalTrabajoNuevo: abrirModalTrabajoNuevo, MARCA_651: MARCA_651 };
}
