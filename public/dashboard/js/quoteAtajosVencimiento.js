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
// ✅ MICROCOPY: aprobada por el ASESOR el 4-sep-2026, a la espera de la firma del fundador.
// Los seis literales y sus motivos van abajo, junto a las constantes.
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
   * ✅ MICROCOPY APROBADA POR EL ASESOR el 4-sep-2026, A LA ESPERA DE LA FIRMA DEL FUNDADOR.
   *
   * Los seis literales —tres rótulos y tres nombres accesibles— con sus motivos, porque son la
   * clase de texto que alguien «mejora» dentro de un mes:
   *
   *   · «7 / 14 / 30 días» CABE CON HOLGURA: 217 px de los 356 útiles a 390 px, sobran 139. No
   *     se eligió el que iba justo (306) ni el que rompía a dos filas (346).
   *
   *   · 🔴 NO es «1 semana / 2 semanas / 1 mes», que también cabía (254 px): **«1 mes» describe
   *     algo que este mecanismo NO calcula**. El motor hace hoy+30, y 30 días no son un mes en
   *     enero, ni en febrero, ni en ninguno salvo cuatro. Un rótulo que no describe lo que hace
   *     el mecanismo es la avería que este árbol lleva una semana cazando — y en un botón la ve
   *     el profesional.
   *
   *   · NO es «7 d», «+7 días» ni «7 días más»: los puntos suspensivos prometen otro paso —un
   *     diálogo, algo más— y no lo hay: se escribe la fecha y ya. Abreviar «días» a «d» paga
   *     claridad por 51 px que sobran.
   *
   *   · EL NOMBRE ACCESIBLE DICE LA ACCIÓN COMPLETA porque no tiene caja que lo limite. El botón
   *     puede decir «7 días» apoyándose en el campo que tiene al lado; un lector de pantalla
   *     puede no dar ese contexto, y «7 días» a secas no dice qué va a pasar.
   *
   * El NÚMERO se compone: es el dato del atajo, no texto. Añadir un cuarto atajo no pide copy.
   */
  var UNIDAD_ROTULO = 'días';
  var PREFIJO_ACCESIBLE = 'Válido hasta dentro de';

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

  /** El rótulo visible: `7 días`. */
  function rotuloDeAtajo(dias) {
    return String(dias) + ' ' + UNIDAD_ROTULO;
  }

  /**
   * El nombre accesible: el prefijo aprobado + el rótulo, p. ej. para 7 días.
   *
   * ⚠️ El literal COMPLETO no se escribe en este comentario a propósito: el cruce de SCRUM-514
   * —que exige que todo texto aprobado llegue a la pantalla— busca por subcadena, y una cita en
   * un comentario le haría dar por APLICADO algo que no se pinta. Lo cazó él mismo: de los tres
   * nombres accesibles saltaron dos, y el tercero se salvaba por esta línea.
   *
   * ⚠️ CONSTRUIDO Y SIN CABLEAR, y se declara en vez de esconderlo: hoy `quotesView.js` pone el
   * MISMO texto en el rótulo y en el `aria-label` (una sola llamada a `rotuloDeAtajo`), así que
   * para que digan cosas distintas hay que cambiar UNA línea de esa vista — y ese fichero es de
   * otro carril en vuelo (SCRUM-594). Se deja listo para que sea una línea, no un rediseño.
   */
  function nombreAccesibleDeAtajo(dias) {
    return PREFIJO_ACCESIBLE + ' ' + rotuloDeAtajo(dias);
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
    UNIDAD_ROTULO: UNIDAD_ROTULO,
    PREFIJO_ACCESIBLE: PREFIJO_ACCESIBLE,
    fechaDeAtajo: fechaDeAtajo,
    rotuloDeAtajo: rotuloDeAtajo,
    nombreAccesibleDeAtajo: nombreAccesibleDeAtajo,
    atajoPorDebajoDelMinimo: atajoPorDebajoDelMinimo,
  };
})(typeof window !== 'undefined' ? window : globalThis);
