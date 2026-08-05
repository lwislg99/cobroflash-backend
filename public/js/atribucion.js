// public/js/atribucion.js — SCRUM-336
//
// LA ATRIBUCIÓN VIAJA EN LA URL, NO EN EL NAVEGADOR DEL VISITANTE.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ SUSTITUYE Y POR QUÉ
//
// Antes, la landing y la página de precios escribían `localStorage` (`yaqu_ref`, `yaqu_src`) al
// aterrizar, sin ninguna acción del visitante y sin forma de rechazarlo. El art. 5.3 de ePrivacy
// exige consentimiento previo para almacenar información en el equipo del usuario cuando no es
// imprescindible para el servicio pedido, y la atribución de marketing no lo es.
//
// **Un parámetro en la URL no es almacenamiento en el terminal**: el art. 5.3 deja de aplicar, sin
// banner y sin romper la atribución del camino normal (landing → CTA → registro).
//
// ⚠️ LO QUE ESTO NO CONSERVA, Y SE DICE EN VOZ ALTA: el **first-touch multi-visita**. Quien
// aterriza hoy con `?ref=` y vuelve dentro de tres días escribiendo la dirección a mano queda SIN
// atribuir. La atribución pasa de «sobrevive días» a «sobrevive la navegación en curso».
// Recuperarlo es cosa del banner (SCRUM-329): cuando haya consentimiento, `localStorage` vuelve a
// ser legítimo y se repone el first-touch.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ NO HAY UNA LISTA DE ENLACES AQUÍ
//
// Los enlaces se DERIVAN del DOM (`a[href^="/register.html"]`). Una lista escrita a mano envejece
// el día que alguien añade un CTA y **nadie se entera de que ese camino dejó de atribuir**. Hoy son
// ocho en cuatro ficheros; mañana da igual cuántos sean.
//
// QUÉ PARÁMETROS VIAJAN, y no son «los que parezcan»: son EXACTAMENTE los que lee el registro
// (`register.html`) — `ref` (programa de referidos → `Merchant.referredBy`, que paga un mes gratis
// al referidor) y `utm_source|utm_medium|utm_campaign|src` (→ `Merchant.acquisitionSource`, que es
// lo que agrupa el embudo por canal en `getPlatformFunnel`). Añadir uno que nadie lee sería
// ensuciar la URL para nada.
(function () {
  'use strict';

  /** Los que el registro consume. Cambiar esto sin mirar `register.html` rompe la atribución. */
  var PARAMETROS = ['ref', 'utm_source', 'utm_medium', 'utm_campaign', 'src'];

  /** Solo se reescriben enlaces internos al registro. Nunca un enlace externo. */
  var DESTINO = '/register.html';

  /**
   * PURA: dado el `href` de un enlace y el `search` de la página actual, devuelve el href con la
   * atribución que falte. Se exporta para poder probarla sin navegador (`window.yaquAtribucion`).
   *
   * REGLAS, y las tres importan:
   *   · NO pisa lo que el enlace ya trae. Un CTA con `?ref=X` escrito a mano manda sobre la URL.
   *   · NO inventa: si el parámetro no viene en la página, no se añade vacío.
   *   · Conserva el hash (`#seccion`), que va DESPUÉS de la query.
   */
  function destinoConAtribucion(href, search) {
    if (typeof href !== 'string' || href.indexOf(DESTINO) !== 0) return href;

    var entrada = new URLSearchParams(search || '');
    var hash = '';
    var sinHash = href;
    var iHash = href.indexOf('#');
    if (iHash >= 0) { hash = href.slice(iHash); sinHash = href.slice(0, iHash); }

    var iQuery = sinHash.indexOf('?');
    var base = iQuery >= 0 ? sinHash.slice(0, iQuery) : sinHash;
    var salida = new URLSearchParams(iQuery >= 0 ? sinHash.slice(iQuery + 1) : '');

    for (var i = 0; i < PARAMETROS.length; i++) {
      var k = PARAMETROS[i];
      var v = (entrada.get(k) || '').trim();
      if (v && !salida.has(k)) salida.set(k, v);
    }

    var q = salida.toString();
    return base + (q ? '?' + q : '') + hash;
  }

  /**
   * De dónde vino el visitante cuando NO trae UTM: el mismo valor `referrer:<host>` que antes se
   * calculaba en la landing y se guardaba en `localStorage`. Ahora viaja como `utm_source`, que es
   * el parámetro que `register.html` ya sabe leer — así el dato que acaba en
   * `Merchant.acquisitionSource` es EL MISMO de antes, sin tocar el registro y sin almacenar nada.
   *
   * Solo se calcula en la página donde el referrer es EXTERNO (la de aterrizaje). En el registro
   * el referrer ya sería la propia landing, que no dice nada.
   */
  function utmDesdeReferrer(search, referrer, hostActual) {
    if (new URLSearchParams(search || '').get('utm_source')) return null;
    if (!referrer) return null;
    var host;
    try { host = new URL(referrer).hostname.replace(/^www\./, ''); } catch (e) { return null; }
    if (!host || host === hostActual) return null;
    return 'referrer:' + host;
  }

  /** El `search` efectivo de esta página, con el referrer añadido si procede. */
  function searchEfectivo(loc, referrer) {
    var extra = utmDesdeReferrer(loc.search, referrer, loc.hostname);
    if (!extra) return loc.search;
    var q = new URLSearchParams(loc.search || '');
    q.set('utm_source', extra);
    return '?' + q.toString();
  }

  function propagar(doc, search) {
    var enlaces = doc.querySelectorAll('a[href^="' + DESTINO + '"]');
    for (var i = 0; i < enlaces.length; i++) {
      var a = enlaces[i];
      // `getAttribute` y no `a.href`: el segundo devuelve la URL absoluta ya resuelta.
      var actual = a.getAttribute('href');
      var nuevo = destinoConAtribucion(actual, search);
      if (nuevo !== actual) a.setAttribute('href', nuevo);
    }
    return enlaces.length;
  }

  if (typeof window === 'undefined') return;

  // Se expone la parte pura para poder probarla sin navegador (mismo patrón que otros guards).
  window.yaquAtribucion = {
    destinoConAtribucion: destinoConAtribucion,
    utmDesdeReferrer: utmDesdeReferrer,
    propagar: propagar,
  };

  if (typeof document === 'undefined') return;

  try {
    var search = searchEfectivo(window.location, document.referrer);

    var aplicar = function () { propagar(document, search); };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', aplicar);
    } else {
      aplicar();
    }

    // RED DE SEGURIDAD para enlaces inyectados DESPUÉS de cargar: la demo de la landing añade su
    // propio CTA (`js/landing-demo.js`), así que una sola pasada al cargar no basta. Se reescribe
    // también justo antes de navegar, y en captura para llegar antes que cualquier otro manejador.
    // `auxclick` incluido a propósito: el clic con la rueda abre en otra pestaña y no dispara
    // `click`; sin él, esa navegación perdería la atribución sin que nadie lo notara.
    var alPulsar = function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest('a[href^="' + DESTINO + '"]') : null;
      if (!a) return;
      var actual = a.getAttribute('href');
      var nuevo = destinoConAtribucion(actual, search);
      if (nuevo !== actual) a.setAttribute('href', nuevo);
    };
    document.addEventListener('click', alPulsar, true);
    document.addEventListener('auxclick', alPulsar, true);
  } catch (e) { /* la atribución nunca puede romper la página */ }
})();
