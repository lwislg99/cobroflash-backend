/**
 * public/dashboard/js/formaDePagoPorDefecto.js — SCRUM-586 (CONT-13)
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LAS FORMAS DE PAGO PACTADAS CON EL CLIENTE, **PROPUESTAS** AL CREAR EL DOCUMENTO.
 *
 * LA VÍCTIMA: el administrador de fincas que no paga con tarjeta nunca, y el profesional que
 * tiene que ACORDARSE de desmarcarla en cada presupuesto. El día que se le olvida, el cliente ve
 * un botón de tarjeta que su gestoría no va a pulsar, y el documento se queda esperando.
 *
 * ── 🔴 SE PROPONE. NO SE APLICA SOLO. Y AQUÍ LA RAZÓN ES MÁS FUERTE QUE EN EL 587 ────────────
 *
 * El precedente `descuentoPorDefecto.js` (SCRUM-587) ya proponía en vez de aplicar, pero **el
 * caso no es el mismo y conviene que quede escrito**, porque quien venga a «unificar» los dos va
 * a encontrar la misma forma y dos motivos distintos:
 *
 *   · Allí el estado por defecto del documento era **vacío**: aplicar AÑADÍA.
 *   · Aquí el estado por defecto del documento son **LAS TRES MARCADAS**. Aplicar RESTA opciones
 *     de cobro. Si el cliente sólo tiene «transferencia» y el profesional no se fija, **el cobro
 *     se retrasa entero** — y a un autónomo cobrar tarde le duele más que cobrar un poco menos.
 *   · Y al revés también cuesta: marcar tarjeta mete la comisión del **0,9 %**.
 *
 * > 🔴 **CUANDO APLICAR CUESTA EN AMBOS SENTIDOS, SE PROPONE.** Decisión del fundador
 * > (5-sep-2026). Es la regla que sale de este ticket, y es la que hace que el caso no dependa de
 * > que alguien recuerde el precedente del descuento.
 *
 * Por eso aquí hay DOS funciones y no una, igual que en el 587: `propuestaPara` DEVUELVE UN DATO
 * y no toca nada; `aplicarA` es una función aparte que alguien tiene que llamar. La vista llama a
 * la segunda cuando el profesional acepta, nunca la primera «por su cuenta». Si algún día las dos
 * se fusionan en una llamada cómoda, el ticket se ha roto: eso es justamente lo prohibido, y
 * `tests/scrum586-forma-de-pago-por-cliente.test.mjs` cae si ocurre.
 *
 * ── EN QUÉ SE DESVÍA DEL 587, A PROPÓSITO ───────────────────────────────────────────────────
 *
 * `aplicarA` aquí **SUSTITUYE** la selección entera; allí sólo rellenaba las líneas que no traían
 * `dto` propio. No es descuido: una casilla no tiene estado «vacío». «Las tres marcadas» es a la
 * vez el valor de fábrica y una elección deliberada del profesional, y desde el dato **no se
 * pueden distinguir**. Así que lo que da el consentimiento no puede ser una heurística: es EL
 * CLIC. Por eso la pieza que sustituye vive detrás de un botón y de nada más.
 *
 * ── EL CATÁLOGO SE DUPLICA, Y ESO SE PAGA CON UN GUARD ──────────────────────────────────────
 *
 * `['card','bizum','transfer']` ya existe DOS veces en `src/core/validation/schemas.ts` (el
 * `z.enum` del presupuesto y el del cobro) y una tercera en el `pmDefs` del editor. Aquí hace
 * falta una cuarta porque **este fichero es JS de navegador y no puede importar el TypeScript del
 * servidor**: es el escalón 3 del reparto de la casa (imposible → derivar → duplicar CON GUARD →
 * duplicar con comentario), y se paga con el guard que compara las tres grafías por AST. Sin él,
 * el día que el catálogo crezca, esta lista se quedaría corta y el efecto sería mudo: una forma
 * de pago pactada que este fichero considera ilegible y descarta en silencio.
 */
(function (root) {
  'use strict';

  /**
   * El catálogo. MISMO ORDEN que el `pmDefs` del editor y que el `z.enum` del servidor —
   * comparado por el guard, no por confianza.
   */
  var METODOS = ['card', 'bizum', 'transfer'];

  /**
   * Las formas de pago pactadas con este cliente, o `null` si no hay ninguna que proponer.
   *
   * 🔴 `null` (no consta) es lo ÚNICO que devuelve esta función cuando no hay acuerdo legible, y
   * la lista vacía NO es un caso aparte que haya que respetar. Es la diferencia con el `0 %` del
   * 587, y no es una simplificación: allí «se pactó un 0 %» era legítimo y no movía dinero; aquí
   * «se pactó que no hay NINGUNA forma de pago» sería un documento que el cliente no puede pagar.
   * El servidor ya lo dice con su `.min(1)`, y el editor ya trata `sel.length === 0` como «todas».
   * Un `[]` guardado en la columna es un dato roto, no un acuerdo: se lee como «no consta».
   *
   * 🔴 Y SI HAY UN VALOR QUE NO SE SABE LEER, NO HAY PROPUESTA — no se propone lo que sobrevive.
   * Un cliente con `['bizum','paypal']` no se convierte en «sólo bizum»: eso sería RESTAR una
   * opción de cobro por un valor que no entendemos, que es exactamente el daño que el fundador
   * nombró al decidir que esto se propone. Mismo criterio que el 587 con un porcentaje ilegible:
   * lo que no se puede leer no es una propuesta más pequeña, es que no hay propuesta.
   *
   * @returns {string[]|null} subconjunto de `METODOS`, en ORDEN DE CATÁLOGO, o `null`
   */
  function propuestaPara(cliente) {
    if (!cliente || typeof cliente !== 'object') return null;
    var crudo = cliente.payMethodsPorDefecto;
    if (crudo === null || crudo === undefined || crudo === '') return null;
    if (!Array.isArray(crudo) || crudo.length === 0) return null;
    var vistos = {};
    for (var i = 0; i < crudo.length; i++) {
      var v = crudo[i];
      if (typeof v !== 'string') return null;      // un valor que no es texto: ilegible
      if (METODOS.indexOf(v) < 0) return null;     // fuera de catálogo: ilegible
      vistos[v] = true;
    }
    // Se reconstruye desde el CATÁLOGO y no desde el dato: así el orden es estable y los
    // duplicados de la columna (`['bizum','bizum']`) no llegan a la pantalla.
    var salida = METODOS.filter(function (m) { return vistos[m] === true; });
    return salida.length ? salida : null;
  }

  /**
   * ¿Hay algo que proponer? Un pacto que dice «las tres» CONSTA, y aun así no propone nada.
   *
   * Es el `pct > 0` del 587 con otra cara: el documento ya nace con las tres marcadas, así que un
   * cliente que las tiene las tres pactadas no cambia ni una casilla. Y esto NO es cosmética —
   * decide que la tira no reaparezca para ofrecerle «vuelve a marcar la tarjeta» al profesional
   * que acaba de desmarcarla a mano.
   */
  function hayPropuesta(cliente) {
    var p = propuestaPara(cliente);
    return p !== null && p.length < METODOS.length;
  }

  /**
   * La selección CON la propuesta puesta. Devuelve un array NUEVO; no muta el que recibe.
   *
   * ⚠️ NO SE LLAMA SOLA. Es la mitad que APLICA, y sólo se invoca cuando el profesional ha
   * aceptado la propuesta que le enseñó la vista. La vista tiene un guard que cae si alguien la
   * alcanza desde cualquier sitio que no sea un manejador de clic.
   */
  function aplicarA(seleccion, propuesta) {
    var actual = Array.isArray(seleccion) ? seleccion : [];
    // Sin propuesta no se escribe nada: la selección sigue siendo la misma lista que era antes de
    // este ticket. Mismo criterio que `aplicarA` del 594/587 cuando no hay descuento.
    if (!Array.isArray(propuesta) || propuesta.length === 0) return actual.slice();
    return propuesta.slice();
  }

  /** Cuántas casillas CAMBIARÍAN. Para que la vista pueda decirlo antes de aplicar. */
  function alcanceDe(seleccion, propuesta) {
    var antes = Array.isArray(seleccion) ? seleccion : [];
    // La regla de qué pasaría NO se reimplementa aquí: se le pregunta a `aplicarA`, igual que
    // hace `alcanceDe` en el 587. Con dos cálculos, uno se quedaría atrás.
    var despues = aplicarA(antes, propuesta);
    var n = 0;
    for (var i = 0; i < METODOS.length; i++) {
      var m = METODOS[i];
      if ((antes.indexOf(m) >= 0) !== (despues.indexOf(m) >= 0)) n++;
    }
    return n;
  }

  root.formaDePagoPorDefecto = {
    METODOS: METODOS,
    propuestaPara: propuestaPara,
    hayPropuesta: hayPropuesta,
    aplicarA: aplicarA,
    alcanceDe: alcanceDe,
  };
  // Para la suite, que carga este fichero con `require` igual que `descuentoPorDefecto.js`.
  if (typeof module !== 'undefined' && module.exports) module.exports = root.formaDePagoPorDefecto;
}(typeof window !== 'undefined' ? window : globalThis));
