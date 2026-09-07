// public/dashboard/js/cuerpoDelDocumentoSuelto.js — SCRUM-600 (DOC-10)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CUERPO QUE VIAJA A `POST /admin/invoices`. UN SOLO SITIO, Y ES EL PUNTO DEL FICHERO.
//
// DOC-10 le da a la factura suelta el front del presupuesto. En cuanto hay DOS pantallas que
// emiten el mismo documento, la pregunta que decide el ticket es «¿producen exactamente la
// misma factura?» — mismo cuerpo, mismo total, mismos datos guardados.
//
// 🔴 Esa pregunta NO se responde con un guard que compare dos implementaciones: se responde
// haciendo que no haya dos. Aquí vive la única composición del cuerpo, y la llaman las dos
// pantallas. Divergencia IMPOSIBLE por construcción, que gana a divergencia vigilada.
//
// ── LA REGLA DE LA FILA VACÍA ES LA DEL MODAL, Y SE CONSERVA LITERAL ──────────────────
// `!concept && !precio` (el precio TAL COMO SE ESCRIBIÓ, no su número): una fila sin concepto y
// sin precio se ignora, una fila con sólo precio VIAJA y el servidor la rechaza nombrando lo que
// falta. Es la regla que la factura suelta lleva teniendo desde A0.3, y se conserva porque el
// control que decide DOC-10 es que la pantalla nueva emita lo mismo que la vieja: «mejorarla»
// aquí haría que las dos pantallas produjeran cuerpos distintos con la misma entrada.
//
// ⚠️ HALLAZGO ARRASTRADO, NO INTRODUCIDO NI ARREGLADO (regla 37): `Number('1,5')` es `NaN`, así
// que una coma decimal en cantidad o precio manda `NaN` y el servidor la rechaza. El formulario
// del presupuesto sí acepta la coma (`parseFloat(String(v).replace(',', '.'))`). Se conserva el
// trato del modal a propósito —cambiarlo rompería la equivalencia que este ticket verifica— y
// queda declarado para que se arregle en los DOS sitios a la vez, que es donde se decide.
//
// 🔴 ESTO NO ES CAMINO DE EMISIÓN (regla 38). Compone el cuerpo de una petición en el navegador;
// quién numera la serie, quién sella y qué se guarda sigue siendo del servidor, intacto. La
// forma del cuerpo que aquí se compone es la que `validarFacturaSuelta` ya exigía.
//
// ⚠️ El IVA entra en PORCENTAJE (lo que teclea un profesional) y sale en FRACCIÓN (0.21), que es
// la convención de `Invoice.lines` en todo el árbol. La conversión vive AQUÍ y en ningún otro
// sitio: confundirlas multiplicaría el IVA por cien sin que nada fallara.
(function () {
  /**
   * @param {string|number} cliente  el `value` del selector de cliente, tal cual.
   * @param {Array<{concepto:string, cantidad:string, precio:string, iva:string}>} filas
   *        las filas TAL COMO SE ESCRIBIERON. Cadenas, no números ya convertidos: la regla de la
   *        fila vacía mira el precio ESCRITO, y un `0` y un campo en blanco no son lo mismo.
   * @returns {{customerId:number, lines:Array<{concept:string, qty:number, price:number, tax:number}>}}
   */
  function cuerpoDelDocumentoSuelto(cliente, filas) {
    var lines = [];
    var todas = Array.isArray(filas) ? filas : [];
    for (var i = 0; i < todas.length; i++) {
      var f = todas[i] || {};
      var concept = String(f.concepto == null ? '' : f.concepto).trim();
      var precioEscrito = String(f.precio == null ? '' : f.precio);
      if (!concept && !precioEscrito) continue; // fila vacía se ignora
      lines.push({
        concept: concept,
        qty: Number(f.cantidad),
        price: Number(precioEscrito),
        tax: Number(f.iva) / 100,
      });
    }
    return { customerId: Number(cliente), lines: lines };
  }

  /**
   * EL ERROR DEL ALTA, TRADUCIDO. La segunda pieza que las dos pantallas comparten.
   *
   * 🔴 POR QUÉ EXISTE, y no es ceremonia: el trinquete de SCRUM-644 prohíbe pintar un `.message`
   * del servidor tal cual, porque así es como un identificador interno (`name_duplicate`) acaba
   * en la cara del profesional. La ruta del documento suelto es una EXCEPCIÓN legítima —manda
   * frases en castellano, escritas para leerse: «Falta el cliente de la factura.», «La factura
   * necesita al menos una línea.»— y la forma que la casa tiene de declarar una excepción
   * legítima es un TRADUCTOR con nombre, no un techo más alto. Un techo más alto vale para
   * cualquier `.message`; esto vale para éste.
   *
   * El respaldo NO se escribe aquí: sale de `rotulosDelDocumento`, que ya dice «factura» o
   * «justificante» según el documento que este profesional emite (SCRUM-776). Se recibe por
   * parámetro para que la pieza siga siendo pura y la suite pueda ejercitarla sin navegador.
   *
   * @param {any} e el error de `apiRequest`.
   * @param {{errorAlEmitir: () => string}} rotulos normalmente `window.rotulosDelDocumento`.
   */
  function mensajeDeErrorDocumentoSuelto(e, rotulos) {
    var delServidor = e && e.data && e.data.message;
    if (typeof delServidor === 'string' && delServidor.trim()) return delServidor;
    return rotulos.errorAlEmitir();
  }

  var api = {
    cuerpoDelDocumentoSuelto: cuerpoDelDocumentoSuelto,
    mensajeDeErrorDocumentoSuelto: mensajeDeErrorDocumentoSuelto,
  };

  // El `typeof window` es lo que permite que la suite CARGUE este fichero y EJECUTE la
  // composición de verdad, en vez de auditarla leyéndola. Mismo idioma que `tiposDeIva.js`.
  if (typeof window !== 'undefined') window.documentoSuelto = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}());
