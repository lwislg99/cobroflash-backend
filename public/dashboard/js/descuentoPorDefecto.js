/**
 * public/dashboard/js/descuentoPorDefecto.js — SCRUM-587 (CONT-14)
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * EL DESCUENTO PACTADO CON EL CLIENTE, **PROPUESTO** AL CREAR EL PRESUPUESTO.
 *
 * LA VÍCTIMA: el profesional que tiene un 10 % acordado con un administrador de fincas hoy tiene
 * que ACORDARSE y teclearlo en cada presupuesto. El día que se le olvida factura de más y lo
 * descubre cuando el cliente se queja; o factura de menos y no lo descubre nunca.
 *
 * ── 🔴 SE PROPONE. NO SE APLICA SOLO. Y ESTA PIEZA NO PUEDE APLICARLO ────────────────────────
 *
 * Un descuento que se aplica en silencio es dinero que sale del bolsillo del profesional sin que
 * él lo haya decidido ESTA vez — y el día que quiera cobrar el precio entero no va a saber por
 * qué le sale otro número.
 *
 * Por eso aquí hay DOS funciones y no una: `propuestaPara` DEVUELVE UN DATO y no toca nada;
 * `aplicarA` es una función aparte que alguien tiene que llamar. La vista llama a la segunda
 * cuando el profesional acepta, nunca la primera «por su cuenta». Si algún día las dos se
 * fusionan en una sola llamada cómoda, el ticket se ha roto: eso es justamente lo prohibido.
 *
 * ── POR QUÉ VIVE AQUÍ, PURA ─────────────────────────────────────────────────────────────────
 * Mismo reparto que `quoteDescuentos.js` (SCRUM-594) y `quoteSuplido.js`: la regla en una pieza
 * que la suite EJECUTA, y la vista sólo la llama. Dentro de `recalcTotals()` necesitaría DOM y
 * no se podría probar sin navegador.
 *
 * ── 🔴 NO HAY UN SEGUNDO CÁLCULO DE DESCUENTO, Y ES DELIBERADO ──────────────────────────────
 * Este fichero **no sabe** restar un porcentaje de un precio. Toda la aritmética sigue en
 * `quoteDescuentos.js`, y para leer un porcentaje se usa SU `dtoDeLinea`. Aquí sólo se decide
 * QUÉ PORCENTAJE SE PROPONE y A QUÉ LÍNEAS. Si este fichero acabara multiplicando precios,
 * habría dos sitios donde vive el dinero y uno de los dos se quedaría atrás.
 *
 * ── UN PORCENTAJE, Y NO UN IMPORTE ──────────────────────────────────────────────────────────
 * El acuerdo con un administrador de fincas se pacta en % y el único % del documento es el `dto`
 * de la LÍNEA (el global es en €, asimetría escrita a propósito en `quoteDescuentos.js` y que no
 * se armoniza). Así que la propuesta aterriza en las líneas, y en ningún otro sitio.
 */
(function (root) {
  'use strict';

  /** La aritmética NO se reimplementa: se toma la del 594. */
  function lector() {
    var D = root.quoteDescuentos;
    if (!D || typeof D.dtoDeLinea !== 'function') {
      throw new Error('🔴 descuentoPorDefecto: falta `quoteDescuentos`. Esta pieza NO reimplementa '
        + 'la lectura de un porcentaje a propósito; sin el módulo del 594 no hay propuesta que dar.');
    }
    return D.dtoDeLinea;
  }

  /**
   * El porcentaje pactado con este cliente, o `null` si no hay ninguno.
   *
   * 🔴 `null` Y `0` SON COSAS DISTINTAS Y LAS DOS SON LEGÍTIMAS. «Este cliente no tiene descuento
   * pactado» y «con este cliente se pactó expresamente un 0 %» se responden distinto, y la
   * columna es NULLABLE Y SIN DEFAULT precisamente para poder distinguirlas. Un `|| 0` aquí
   * borraría esa diferencia en la primera línea de la pieza que existe para respetarla.
   *
   * @returns {number|null} 0-100, o `null` si no consta
   */
  function propuestaPara(cliente) {
    if (!cliente || typeof cliente !== 'object') return null;
    var crudo = cliente.dtoPorDefecto;
    if (crudo === null || crudo === undefined || crudo === '') return null;
    var pct = lector()(crudo);
    // `dtoDeLinea` acota a 0-100 y devuelve 0 ante lo ilegible. Un valor que no se puede leer no
    // es una propuesta de 0 %: es que no hay propuesta, y proponer un 0 % sería inventarse un
    // acuerdo que nadie pactó.
    if (!isFinite(pct)) return null;
    return pct;
  }

  /** ¿Hay algo que proponer? Un 0 % pactado consta, pero no cambia ni un céntimo. */
  function hayPropuesta(cliente) {
    var pct = propuestaPara(cliente);
    return pct !== null && pct > 0;
  }

  /**
   * Las líneas CON la propuesta puesta. Devuelve un array NUEVO; no muta el que recibe.
   *
   * 🔴 SÓLO RELLENA LAS LÍNEAS QUE NO TRAEN `dto` PROPIO. Si el profesional ya tecleó un 15 % en
   * una línea, ese 15 % es más reciente y más específico que el acuerdo general: pisarlo sería
   * borrarle lo que acaba de escribir.
   *
   * ⚠️ Y NO SE LLAMA SOLA. Es la mitad que APLICA, y sólo se invoca cuando el profesional ha
   * aceptado la propuesta que le enseñó la vista.
   */
  function aplicarA(lineas, pct) {
    var lista = Array.isArray(lineas) ? lineas : [];
    // Un 0 % —o ninguno— no escribe nada. Mismo criterio que `descuentoParaPayload` del 594: si
    // no hay descuento, la clave `dto` NO VIAJA, y una línea sin descuento sigue siendo el mismo
    // objeto que era antes de este ticket.
    if (pct === null || pct === undefined || !(pct > 0)) return lista.slice();
    var leer = lector();
    return lista.map(function (l) {
      if (!l || typeof l !== 'object') return l;
      var suyo = l.dto;
      var yaTiene = suyo !== null && suyo !== undefined && suyo !== '' && leer(suyo) > 0;
      if (yaTiene) return l;
      var copia = {};
      for (var k in l) if (Object.prototype.hasOwnProperty.call(l, k)) copia[k] = l[k];
      copia.dto = pct;
      return copia;
    });
  }

  /** Cuántas líneas RECIBIRÍAN la propuesta. Para que la vista pueda decirlo antes de aplicar. */
  function alcanceDe(lineas, pct) {
    var antes = Array.isArray(lineas) ? lineas : [];
    var despues = aplicarA(antes, pct);
    var n = 0;
    for (var i = 0; i < antes.length; i++) if (antes[i] !== despues[i]) n++;
    return n;
  }

  root.descuentoPorDefecto = {
    propuestaPara: propuestaPara,
    hayPropuesta: hayPropuesta,
    aplicarA: aplicarA,
    alcanceDe: alcanceDe,
  };
  // Para la suite, que carga este fichero con `require` igual que `quoteDescuentos.js`.
  if (typeof module !== 'undefined' && module.exports) module.exports = root.descuentoPorDefecto;
}(typeof window !== 'undefined' ? window : globalThis));
