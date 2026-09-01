// public/dashboard/js/quoteAtajosVencimiento.js — SCRUM-605 (DOC-15)
//
// LOS ATAJOS DE «VÁLIDO HASTA», EN FUNCIONES PURAS.
//
// Por qué viven aquí y no dentro de `quotesView.js`: mismo motivo que `quoteMargen.js`
// (SCRUM-229) y `quoteSuplido.js` (SCRUM-500) —`quotesView.js` es un módulo de navegador que
// `node:test` no puede importar, así que lo único que se le puede exigir es la FORMA de su
// fuente—. Y aquí lo que hay que exigir es ARITMÉTICA: que «30 días» dé la fecha que tiene que
// dar el 31 de enero, en un cambio de año y en un febrero bisiesto. Un guard de forma pasaría
// con la fecha mal calculada, que es justo el error que esto viene a impedir.
//
// ⚠️ ÁMBITO GLOBAL COMPARTIDO: estos scripts son clásicos y comparten `window`. Va en IIFE y
// publica lo suyo, como `quoteSuplido.js`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ LA ARITMÉTICA VA POR COMPONENTES LOCALES Y NO EN MILISEGUNDOS
//
// El valor por defecto del campo se calcula hoy así (`quotesView.js`, y NO se toca en este
// ticket porque el control negativo es que quien no toque nada vea exactamente lo de hoy):
//
//     new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
//
// Eso tiene dos costuras conocidas: `86400000` supone que todos los días duran 24 h —falso en
// los dos cambios de hora— y `toISOString()` formatea en UTC, así que en Madrid (UTC+1/+2) una
// hora local temprana cae en el día ANTERIOR en UTC.
//
// Los atajos se calculan con `new Date(y, m, d + N)` y se formatean a mano desde los componentes
// LOCALES. `Date` normaliza sola el desbordamiento de mes y de año, así que fin de mes, cambio
// de año y bisiesto salen bien sin tabla de meses y sin ninguna librería (regla 36).
//
// HALLAZGO DECLARADO, no arreglado (regla 9, y además el encargo prohíbe tocar el defecto): en
// los casos límite de arriba el atajo de 30 días y el valor por defecto pueden dar días
// distintos. No se unifica aquí porque tocar el defecto cambiaría lo que ve quien no pulsa nada.
(function (root) {
  'use strict';

  /**
   * Los tres atajos. Es una lista de DATOS, no de dibujo: añadir uno es añadir un número, y el
   * pintado no cambia. (Los «múltiples vencimientos» de Holded quedan FUERA por decisión del
   * fundador: esto no los prepara ni los insinúa.)
   */
  var DIAS_ATAJO = [7, 14, 30];

  /**
   * 🔴 MICROCOPY PENDIENTE DE APROBACIÓN (regla 30). UNA sola constante para los tres botones y
   * sus nombres accesibles: cuando el fundador firme el texto, se apagan todos de golpe.
   *
   * El NÚMERO no es microcopy —es el dato del atajo— así que se compone delante del marcador y
   * los tres botones siguen siendo distinguibles entre sí mientras el texto no llegue.
   */
  var MARCA_MICROCOPY = '[PENDIENTE microcopy oficial]';

  function dosCifras(n) { return (n < 10 ? '0' : '') + n; }

  /**
   * La fecha de un atajo, en `YYYY-MM-DD` y en día LOCAL.
   *
   * @param {number} dias  días a sumar a HOY. Se exige entero y > 0: un atajo que reste sería
   *                       una fecha en el pasado, y el campo tiene `min` = mañana.
   * @param {Date}   [hoy] inyectable para poder probar los bordes sin esperar a que llegue el
   *                       31 de enero. Sin él, ahora.
   * @returns {string|null} `null` si no se puede calcular — nunca una fecha inventada.
   */
  function fechaDeAtajo(dias, hoy) {
    if (typeof dias !== 'number' || !isFinite(dias) || Math.floor(dias) !== dias || dias <= 0) return null;
    var base = (hoy instanceof Date && !isNaN(hoy.getTime())) ? hoy : new Date();
    // `Date` normaliza sola el desbordamiento: día 32 de enero es 1 de febrero, y el 29 de
    // febrero sólo existe cuando toca. Por eso no hay tabla de meses ni caso especial de bisiesto.
    var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);
    if (isNaN(d.getTime())) return null;
    return d.getFullYear() + '-' + dosCifras(d.getMonth() + 1) + '-' + dosCifras(d.getDate());
  }

  /**
   * El rótulo de un atajo mientras su texto no esté aprobado.
   * El número va DELANTE del marcador: es dato, no texto.
   */
  function rotuloDeAtajo(dias) {
    return String(dias) + ' ' + MARCA_MICROCOPY;
  }

  /**
   * ¿Cae la fecha de un atajo por debajo del `min` del campo?
   *
   * Se pregunta y se responde con una función en vez de razonarlo en un comentario: hoy los tres
   * atajos son +7, +14 y +30 y el `min` es mañana, así que ninguno puede caer por debajo — pero
   * eso es cierto POR LOS NÚMEROS DE HOY, y `DIAS_ATAJO` es una lista que alguien puede tocar.
   * Si algún día se añade un atajo de 0 días, esto lo dice en vez de escribir una fecha que el
   * navegador rechazaría en silencio.
   */
  function atajoPorDebajoDelMinimo(dias, min, hoy) {
    var fecha = fechaDeAtajo(dias, hoy);
    if (fecha === null) return true;              // no calculable = no usable
    if (typeof min !== 'string' || !min) return false;
    return fecha < min;                            // ISO `YYYY-MM-DD` ordena como texto
  }

  root.QUOTE_ATAJOS_VENCIMIENTO = {
    DIAS_ATAJO: DIAS_ATAJO,
    MARCA_MICROCOPY: MARCA_MICROCOPY,
    fechaDeAtajo: fechaDeAtajo,
    rotuloDeAtajo: rotuloDeAtajo,
    atajoPorDebajoDelMinimo: atajoPorDebajoDelMinimo,
  };
})(typeof window !== 'undefined' ? window : globalThis);
