// contacto-publico.js — SCRUM-334 (F7) · el canal de contacto de la superficie publica.
//
// POR QUE EXISTE. Medido el 20-ago-2026 sobre `public/`: la landing tiene CUATRO CTA y los
// cuatro llevan al alta o al acceso. Un visitante con una DUDA no tiene a donde ir — el unico
// correo publicado, `hola@yaqu.app`, vive en `/privacidad` y `/terminos`, o sea en las dos
// paginas a las que nadie entra a preguntar. Y `wa.me` no aparece ni una vez en toda la
// superficie publica, siendo WhatsApp el canal del producto.
//
// 🔴 NACE APAGADO, Y ESO NO ES UNA CAUTELA: ES EL DISEÑO.
// Un canal de WhatsApp que no contesta es PEOR que no tenerlo, y quien contesta es decision
// del fundador, no de una sesion. Asi que el numero NO esta escrito aqui ni en el HTML: se
// activa rellenando `data-whatsapp` en el bloque de la pagina. Sin numero valido el enlace NO
// se pinta — no hay forma de que este fichero publique un `wa.me` roto o de mentira.
//
// Regla 28 (anti-spam J6): esto es ENTRANTE — abre el chat del visitante contra nuestro
// numero. No envia nada. Cualquier RESPUESTA AUTOMATICA seria saliente y pasa por su tabla.
//
// Clases: `btn btn-primary` y `btn btn-ghost`, las que la landing YA usa. Cero tokens nuevos
// (regla 4 y DESIGN.md): esto añade un camino, no un estilo.
(function () {
  'use strict';

  var caja = document.getElementById('contacto-publico');
  if (!caja) return;

  /**
   * ¿Es esto un numero al que se puede escribir de verdad?
   *
   * E.164: solo digitos, entre 8 y 15. Se rechaza a proposito cualquier cosa con letras,
   * espacios o signos —incluido el `+`, que `wa.me` NO admite— y cualquier marcador de
   * relleno. El dia que alguien deje aqui un `TU_NUMERO` o un `+34 600 ...`, el boton
   * desaparece en vez de abrir un chat contra un numero que no existe.
   */
  function numeroUtilizable(bruto) {
    var n = String(bruto || '').trim();
    return /^[0-9]{8,15}$/.test(n) ? n : null;
  }

  var lista = document.createElement('div');
  lista.className = 'contacto-acciones';
  var pintados = 0;

  var numero = numeroUtilizable(caja.getAttribute('data-whatsapp'));
  if (numero) {
    var texto = caja.getAttribute('data-wa-texto') || '';
    var wa = document.createElement('a');
    wa.href = 'https://wa.me/' + numero + (texto ? '?text=' + encodeURIComponent(texto) : '');
    wa.className = 'btn btn-primary';
    wa.textContent = caja.getAttribute('data-wa-etiqueta') || 'WhatsApp';
    wa.target = '_blank';
    wa.rel = 'noopener noreferrer';
    lista.appendChild(wa);
    pintados += 1;
  }

  var correo = String(caja.getAttribute('data-email') || '').trim();
  if (correo.indexOf('@') > 0) {
    var mail = document.createElement('a');
    mail.href = 'mailto:' + correo;
    mail.className = 'btn btn-ghost';
    mail.textContent = caja.getAttribute('data-email-etiqueta') || correo;
    lista.appendChild(mail);
    pintados += 1;
  }

  // Sin ningun canal configurado no se pinta NADA — ni un titular huerfano prometiendo una
  // atencion que no existe. El bloque entero se queda oculto, que es como nace.
  if (!pintados) return;

  caja.appendChild(lista);
  caja.hidden = false;
})();
