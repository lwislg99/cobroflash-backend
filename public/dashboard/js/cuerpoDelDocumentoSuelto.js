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
   * EL MENSAJE DEL SERVIDOR, SI ES PRESENTABLE. La segunda pieza que las dos pantallas comparten.
   *
   * Devuelve la frase que manda la ruta del documento suelto —«Falta el cliente de la factura.»,
   * «La factura necesita al menos una línea.»: castellano, escrito para leerse— o CADENA VACÍA
   * cuando no hay nada que enseñar. Una sola decisión para las dos pantallas.
   *
   * 🔴 DEVUELVE '' Y NO EL RESPALDO, Y ESO ES EL PUNTO ENTERO DE SU FORMA. Se escribió primero
   * al revés —recibiendo `rotulosDelDocumento` y devolviendo ya el texto final— y METÍA UN NIVEL
   * entre el rótulo aprobado y el sitio donde se pinta. Medido: el censo de SCRUM-601 sigue UN
   * nivel de indirección, así que los DOS textos de `errorAlEmitir()` desaparecían del censo
   * entero —16 literales que dependen del flag pasaban a 14— y con ellos la vigilancia de que
   * un merchant en modo justificante no lea «factura». Los textos seguían siendo correctos y
   * seguían llegando a la pantalla: lo que se perdía era quien los mira.
   *
   * Así, el respaldo `rotulosDelDocumento.errorAlEmitir()` se queda ESCRITO EN CADA PANTALLA,
   * pegado a su `setAlert`/`textContent`, que es la forma que el censo sabe leer. Un envoltorio
   * no es neutral si esconde el texto de quien lo vigila (la lección literal de SCRUM-776).
   *
   * ⚠️ Y el `.message` del servidor se queda AQUÍ DENTRO, lejos de todo pintor: el trinquete de
   * SCRUM-644 prohíbe pintar un `.message` crudo, y lo que sale de aquí ya no lo es.
   *
   * @param {any} e el error de `apiRequest`.
   * @returns {string} la frase del servidor, o '' si no mandó ninguna.
   */
  function mensajeDelServidor(e) {
    var texto = e && e.data && e.data.message;
    return (typeof texto === 'string' && texto.trim()) ? texto : '';
  }

  var api = {
    cuerpoDelDocumentoSuelto: cuerpoDelDocumentoSuelto,
    mensajeDelServidor: mensajeDelServidor,
  };

  // El `typeof window` es lo que permite que la suite CARGUE este fichero y EJECUTE la
  // composición de verdad, en vez de auditarla leyéndola. Mismo idioma que `tiposDeIva.js`.
  if (typeof window !== 'undefined') window.documentoSuelto = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}());
