// public/dashboard/js/quoteAtajosVencimiento.js — SCRUM-605 (DOC-15) · SCRUM-750
//
// LOS ATAJOS DE «VÁLIDO HASTA». LA FECHA NO SE CALCULA AQUÍ: SE PIDE.
//
// Por qué viven aquí y no dentro de `quotesView.js`: mismo motivo que `quoteMargen.js`
// (SCRUM-229) y `quoteSuplido.js` (SCRUM-500) —`quotesView.js` es un módulo de navegador que
// `node:test` no puede importar, así que lo único que se le puede exigir es la FORMA de su
// fuente—. Aquí viven la lista de atajos, sus textos y qué NO es un atajo; la aritmética, no.
//
// ✅ MICROCOPY: aprobada por el ASESOR el 4-sep-2026, a la espera de la firma del fundador.
// Los seis literales y sus motivos van abajo, junto a las constantes.
//
// ⚠️ ÁMBITO GLOBAL COMPARTIDO: estos scripts son clásicos y comparten `window`. Va en IIFE y
// publica lo suyo, como `quoteSuplido.js`.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-750 · POR QUÉ AQUÍ YA NO HAY ARITMÉTICA DE FECHAS
//
// Hasta el 5-sep-2026 este módulo calculaba la fecha por su cuenta, con `new Date(y, m, d + N)`
// y componentes LOCALES, mientras el valor por defecto y el `min` del MISMO campo los calculaba
// `quoteCaducidad.diaPorDefecto` (SCRUM-633) en la zona del MERCHANT. Dos implementaciones de la
// misma regla escribiendo en el mismo sitio, y una se quedó atrás.
//
// NO ERA TEÓRICO. Medido sobre 17.520 instantes de 2026 (uno cada 30 min), merchant en
// `Europe/Madrid`, comparando el atajo de +30 contra el valor por defecto de +30:
//
//     navegador en Europe/Madrid       120 de 17.520 divergen   ( 0,7 %)
//     navegador en Europe/London       730                      ( 4,2 %)
//     navegador en UTC               1.150                      ( 6,6 %)
//     navegador en America/New_York  4.324                      (24,7 %)
//     navegador en Pacific/Auckland  7.990                      (45,6 %)
//
// El profesional pulsaba «30 días» y el campo se quedaba con un día distinto del que ese mismo
// campo había propuesto al abrirse, en un documento que el cliente recibe.
//
// ── EL ESCALÓN, Y POR QUÉ AQUÍ SÍ SE PODÍA SUBIR ─────────────────────────────────────────
//
// El escalón de la casa es **hacerlo imposible → derivar → duplicar con guard → duplicar con
// comentario**. `quoteCaducidad.js` está en el 3 y lo explica: su sitio único
// (`core/zonaDelMerchant.ts`) es TypeScript compilado para Node y esta pantalla es JavaScript de
// navegador servido tal cual, sin bundler, así que derivar era IMPOSIBLE.
//
// 🔴 AQUÍ NO LO ERA. `quoteCaducidad` y este módulo corren en el MISMO sitio —dos scripts
// clásicos sobre el mismo `window`, y el índice carga aquél ANTES que éste—, así que el escalón 2
// estaba disponible desde el principio y no se subió. Ahora sí: **`fechaDeAtajo` llama a
// `diaPorDefecto`**. No queda una segunda aritmética a la que se le pueda olvidar algo, porque no
// queda una segunda aritmética.
//
// ⚠️ ESTO CAMBIA LO QUE ESCRIBE EL ATAJO, y se declara en vez de venderlo como refactor:
// `diaPorDefecto` suma `N * 86400000` milisegundos —24 h fijas— y formatea en la zona del
// merchant; la forma anterior sumaba días de CALENDARIO. En la ventana de los dos cambios de hora
// las dos no coinciden, y el atajo pasa a decir lo que dice el campo. Es el objetivo del ticket:
// que el botón y el valor por defecto no PUEDAN discrepar. Cuánto duran «30 días» es otra
// pregunta, tiene un solo sitio donde responderse (`diaPorDefecto`) y no se responde aquí.
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

  /**
   * La pieza que sabe de calendarios, resuelta EN CADA LLAMADA y no al cargar el módulo.
   *
   * El orden de los `<script>` del índice es hoy la garantía de que ya exista, y ese orden lo
   * cambia cualquiera moviendo una línea. Resuelta en la llamada, el peor caso es que UN atajo no
   * escriba nada; resuelta al cargar, el peor caso es que el módulo nazca mudo para siempre.
   */
  function calendario() {
    var c = root && root.quoteCaducidad;
    return (c && typeof c.diaPorDefecto === 'function') ? c : null;
  }

  /**
   * La fecha de un atajo, en `YYYY-MM-DD`, en el día natural del calendario del MERCHANT.
   *
   * 🔴 NO CALCULA: DELEGA (SCRUM-750; el motivo entero, en la cabecera). Lo único que se decide
   * aquí es qué NO es un atajo, y eso sí es de este módulo: `diaPorDefecto` acepta 0 y negativos
   * —legítimos para el valor por defecto de otro campo— y aquí serían una fecha por debajo del
   * `min`, que el navegador rechaza EN SILENCIO.
   *
   * @param {number} dias       días a sumar a HOY. Entero y > 0.
   * @param {object} [merchant] el merchant, por su `timezone`. Sin él → UTC, la misma regla que
   *                            aplican las dos mitades de `zonaDelMerchant` (decisión A del
   *                            fundador, 2-sep-2026): quien no ha declarado zona no ve un cambio
   *                            que no ha pedido.
   * @param {Date}   [hoy]      inyectable para poder probar los bordes sin esperar al 31 de
   *                            enero. Sin él, ahora.
   * @returns {string|null} `null` si no se puede calcular — nunca una fecha inventada.
   */
  function fechaDeAtajo(dias, merchant, hoy) {
    if (typeof dias !== 'number' || !isFinite(dias) || Math.floor(dias) !== dias || dias <= 0) return null;
    // 🔴 LA FIRMA ANTERIOR ERA `(dias, hoy)`. Una llamada sin actualizar pasaría el `Date` en el
    // hueco del merchant, `zonaDelMerchant` le buscaría `.timezone`, no lo encontraría y caería a
    // UTC: una fecha PLAUSIBLE calculada en la zona equivocada, sin ruido. Se prefiere no escribir
    // nada — quien llama ya sabe qué hacer con `null`, y hay un test que lo fija.
    if (merchant instanceof Date) return null;
    if (hoy !== undefined && hoy !== null && !(hoy instanceof Date && !isNaN(hoy.getTime()))) return null;
    var cal = calendario();
    if (!cal) return null;                        // sin la pieza del calendario no se inventa nada
    return cal.diaPorDefecto(merchant, dias, hoy instanceof Date ? hoy : undefined);
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
  function atajoPorDebajoDelMinimo(dias, min, merchant, hoy) {
    var fecha = fechaDeAtajo(dias, merchant, hoy);
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
