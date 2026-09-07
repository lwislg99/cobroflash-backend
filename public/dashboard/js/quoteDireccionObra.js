/**
 * public/dashboard/js/quoteDireccionObra.js — SCRUM-602 (DOC-12)
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA DIRECCIÓN DE LA OBRA, EN LA PANTALLA: los tres modos, sus rótulos y lo que viaja.
 *
 * Mismo reparto que `quoteDescuentos.js` y `quoteSuplido.js`: la regla vive en una pieza PURA
 * que la suite ejecuta, y la vista sólo la llama. Sin esto estaría dentro de una función que
 * necesita DOM y no se podría probar sin navegador.
 *
 * ── 🔴 ESTA PIEZA ES UNA COPIA DECLARADA, Y ESO SE VIGILA ──────────────────────────────────
 *
 * La regla de verdad vive en `src/core/documentos/direccionObra.ts`, que es quien decide lo que
 * se IMPRIME. El front es vanilla y no puede importar TypeScript, así que la composición de la
 * dirección de facturación existe DOS veces. No se puede hacer imposible sin un bundler, así
 * que se hace vigilado: `tests/scrum602-direccion-obra.test.mjs` corre las DOS sobre los MISMOS
 * casos y exige la misma salida, letra por letra. Si divergen, cae — y cae nombrando el caso,
 * no diciendo «los ficheros son distintos».
 *
 * Se vigila por COMPORTAMIENTO y no comparando el texto de las dos funciones: dos redacciones
 * distintas de la misma regla son correctas, y dos idénticas pueden estar las dos mal.
 *
 * ── EL SUELO, ADOPTADO LITERAL DEL ALBARÁN (asesor, 4-sep-2026) ────────────────────────────
 *
 *     «si no hay dirección de obra se deja VACÍO; la sugerencia entra sólo como PLACEHOLDER,
 *      porque una dirección equivocada en un documento de entrega es peor que ninguna.»
 *
 * De ahí sale `sugerenciaParaPlaceholder`, que es toda la diferencia entre sugerir y rellenar:
 * el campo libre NUNCA nace con texto dentro. Un valor prerrellenado se firma sin leerlo.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  /**
   * Los tres modos. Son los VALORES que viajan, no los rótulos, y son los mismos literales que
   * `MODOS_DIRECCION_OBRA` en el dominio: el `z.enum` del servidor sale de allí, así que un
   * valor distinto aquí produciría un 400 en vez de un campo ignorado.
   */
  var MODOS = {
    NO_MOSTRAR: 'no_mostrar',
    FACTURACION: 'facturacion',
    PERSONALIZADA: 'personalizada',
  };

  /**
   * LOS CUATRO TEXTOS, en un solo sitio.
   *
   * ✅ APROBADOS por el ASESOR el 4-sep-2026, **provisionales a la espera del fundador**.
   * PROCEDENCIA: `docs/master/SCRUM-602.md`, sección de microcopy. Sin decir DÓNDE consta,
   * «aprobado» es una afirmación que nadie puede comprobar (SCRUM-387).
   *
   * 🔴 `rotulo` NO ES «Dirección de envío», y el motivo se midió antes de escribirlo: el editor
   * YA tiene un bloque «4. Envío» que significa el envío del DOCUMENTO por WhatsApp o correo.
   * Dos cosas distintas con el mismo nombre en la misma pantalla es cómo se aprende mal un
   * producto. «Obra» es además la palabra del oficio y la que ya usa el albarán.
   *
   * ⚠️ SIN MARCADOR en pantalla (mismo criterio que `filtroClientes.js` y que los tres rótulos
   * de SCRUM-599). Que no se pinte el corchete NO significa que estén firmados por el fundador:
   * eso lo dice `SIN_APROBAR`, abajo.
   */
  var TEXTOS = {
    rotulo: 'Dirección de la obra',
    noMostrar: 'No mostrar',
    facturacion: 'Utilizar dirección de facturación',
    personalizada: 'Personalizada',
  };

  /**
   * Cuántas ranuras estrena esta pieza SIN la firma del fundador. Cuatro: el rótulo —que se
   * pinta también en el PDF, o sea que lo lee el CLIENTE FINAL— y las tres opciones.
   *
   * Se queda aunque llegue a 0, por el motivo de `filtroClientes.js`: el día que alguien añada
   * un cuarto modo, su rótulo nace sin firma y este número tiene que subir. Borrarlo dejaría el
   * hueco sin sitio donde declararse y el texto entraría en pantalla en silencio.
   */
  var SIN_APROBAR = 4;

  /** El orden EXACTO de las opciones, firmado por el asesor. No es alfabético ni casual. */
  var OPCIONES = [
    { valor: MODOS.NO_MOSTRAR, palabra: TEXTOS.noMostrar },
    { valor: MODOS.FACTURACION, palabra: TEXTOS.facturacion },
    { valor: MODOS.PERSONALIZADA, palabra: TEXTOS.personalizada },
  ];

  /**
   * La dirección de facturación del cliente en UNA línea, o `null` si no tiene ninguna.
   *
   * ⚠️ `null` y no cadena vacía: un cliente sin dirección fiscal no produce una dirección de obra
   * vacía, produce un documento SIN bloque. Los trozos vacíos se filtran ANTES de unir — sin eso,
   * un cliente con sólo provincia daría «, , , Sevilla, » impreso en un papel que ve un cliente.
   *
   * 🔴 GEMELA de `componerDireccionFacturacion` en `src/core/documentos/direccionObra.ts`. El
   * orden es el postal español: calle · CP · población · provincia · país.
   */
  function componerDireccionFacturacion(c) {
    if (!c) return null;
    var trozos = [c.billingAddress, c.billingPostalCode, c.billingCity, c.billingProvince, c.billingCountry]
      .map(function (t) { return String(t === null || t === undefined ? '' : t).trim(); })
      .filter(function (t) { return t !== ''; });
    return trozos.length ? trozos.join(', ') : null;
  }

  /**
   * Lo que se le enseña al profesional como PISTA cuando elige «Personalizada»: la dirección de
   * facturación del cliente, si la tiene.
   *
   * 🔴 ES UN PLACEHOLDER Y NO UN VALOR, y ahí está el ticket entero. Rellenar el campo pondría
   * en el documento una dirección que nadie tecleó ni revisó, y en un papel que va a un cliente
   * final eso es peor que dejarlo en blanco (SCRUM-300). Sin dirección de facturación devuelve
   * cadena vacía, que en un `placeholder` es «no hay pista», no «pista vacía».
   */
  function sugerenciaParaPlaceholder(cliente) {
    return componerDireccionFacturacion(cliente) || '';
  }

  /**
   * Lo que se imprimiría HOY con lo que hay en la pantalla. Sirve para previsualizar sin
   * preguntarle al servidor, y es la misma receta que `resolverDireccionObra` en el dominio.
   */
  function resolver(modo, personalizada, cliente) {
    if (modo === MODOS.PERSONALIZADA) {
      var s = String(personalizada === null || personalizada === undefined ? '' : personalizada).trim();
      return s || null;
    }
    if (modo === MODOS.FACTURACION) return componerDireccionFacturacion(cliente);
    return null;
  }

  /**
   * Lo que viaja al servidor.
   *
   * `shippingAddressMode` viaja SIEMPRE: la columna guarda lo que el formulario dijo, y `null`
   * queda reservado para los presupuestos anteriores a este ticket —los que se crearon cuando el
   * control no existía—. Que los dos impriman igual hoy no los hace el mismo dato.
   *
   * `shippingAddress` viaja SÓLO con «Personalizada». Guardar el texto bajo cualquier otro modo
   * dejaría un fantasma: una dirección en la columna que el documento no imprime, esperando a
   * que alguien la lea sin mirar el modo.
   */
  function direccionParaPayload(modo, personalizada) {
    var m = (modo === MODOS.NO_MOSTRAR || modo === MODOS.FACTURACION || modo === MODOS.PERSONALIZADA)
      ? modo
      : MODOS.NO_MOSTRAR;
    var texto = null;
    if (m === MODOS.PERSONALIZADA) {
      var s = String(personalizada === null || personalizada === undefined ? '' : personalizada).trim();
      texto = s || null;
    }
    return { shippingAddressMode: m, shippingAddress: texto };
  }

  var api = {
    MODOS: MODOS,
    TEXTOS: TEXTOS,
    OPCIONES: OPCIONES,
    SIN_APROBAR: SIN_APROBAR,
    componerDireccionFacturacion: componerDireccionFacturacion,
    sugerenciaParaPlaceholder: sugerenciaParaPlaceholder,
    resolver: resolver,
    direccionParaPayload: direccionParaPayload,
  };

  root.quoteDireccionObra = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
