// public/dashboard/js/rotulosDelDocumento.js — SCRUM-776 · CÓMO SE LLAMA EL DOCUMENTO QUE ESTE
// PROFESIONAL EMITE. Un solo sitio.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA QUE CIERRA ESTE FICHERO
//
// Un merchant español real está HOY en modo justificante — medido en SCRUM-601 ejecutando la
// cadena: `INVOICING_ES_ENABLED` ausente → default `false` → `getEmissionMode` = 'receipt' →
// `modoDocumentoSuelto` = 'justificante'. El botón de la pantalla de Facturas ya lo seguía
// («+ Nuevo justificante»), pero el modal que ese botón ABRE decía «factura» seis veces, y al
// terminar le soltaba «Factura emitida».
//
// Le estábamos afirmando que había emitido una factura que NO ha emitido. Medido en navegador
// antes de tocar nada (`npm run guard:caja-documento-suelto`): en modo justificante la pantalla
// salía IDÉNTICA a la de modo factura, rótulo a rótulo.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 UNA SOLA FUENTE, Y ES EL PUNTO ENTERO DEL FICHERO
//
// El predicado es UNO: `window.appDocumentoSuelto === 'justificante'`. El MISMO que ya usa el
// rótulo del botón en `invoicesView.js`. No se copia el criterio ni se «mejora» aquí: si el
// botón y el modal decidieran por separado, un día dirían cosas distintas en el mismo gesto —
// que es exactamente el defecto que este ticket viene a cerrar, sólo que con un paso más.
//
// ⚠️ POR QUÉ `appDocumentoSuelto` Y NO `appModoEmision`, teniendo los dos a mano: son preguntas
// distintas. `appModoEmision` ('fiscal' | 'demo' | 'receipt') dice CÓMO se emite; el veredicto de
// QUÉ DOCUMENTO se crea suelto ya lo calcula el servidor en `modoDocumentoSuelto` y viaja
// resuelto. Elegir el otro obligaría a reconstruir aquí que 'demo' → factura, que es un `if`
// sobre el estado fiscal de alguien escrito en el navegador. Con éste sale gratis y bien:
// el merchant DEMO llega como 'factura' y sigue leyendo «factura», con su marca de agua intacta.
//
// FALLA COMO EL RESTO DEL FRONT: cualquier valor que no sea exactamente 'justificante' —incluido
// `undefined` por un `/admin/me` viejo en caché— cae al lado «factura», que es lo que la pantalla
// dice hoy. Se elige la continuidad y no la novedad: cambiar el documento que alguien cree estar
// emitiendo por culpa de una respuesta que no llegó sería inventar un estado fiscal.
//
// 🔴 ESTO NO ENCIENDE NI APAGA NADA (regla 24). Sólo LEE un veredicto que el servidor ya mandó.
// `INVOICING_ES_ENABLED` sigue OFF y el camino de emisión no se toca: quien decide qué documento
// sale es `getEmissionMode`, en el servidor, exactamente igual que antes de este fichero.
//
// ⚠️ ÁMBITO GLOBAL COMPARTIDO, SIN IIFE (el dashboard es vanilla y sin bundler): un `const` que
// choque con otra global es SyntaxError EN PARSEO y tumba el fichero entero. Por eso todo cuelga
// de UN objeto, `window.rotulosDelDocumento`.
//
// MICROCOPY FIRMADA POR EL ASESOR el 6-sep-2026 (regla 30). Se firmó DERIVANDO, no inventando:
// «justificante» ya es el término oficial del máster y ya lo dice el botón desde SCRUM-346. Aquí
// no entra palabra nueva; entra que seis sitios digan la que ya estaba decidida.
window.rotulosDelDocumento = (function () {
  /**
   * EL ÚNICO PREDICADO. Copiado de ningún sitio: es la lectura directa del veredicto del
   * servidor, y `invoicesView.js` hace la misma comparación sobre la misma global.
   */
  function esJustificante() {
    return window.appDocumentoSuelto === 'justificante';
  }

  // ⚠️ CADA RÓTULO ES UN TERNARIO EXPLÍCITO, Y NO UN `segunModo(a, b)` — que es como estaba
  // escrito primero. El motivo no es de estilo: con el ayudante, los catorce textos pasaban a ser
  // ARGUMENTOS de una llamada, y el censo de SCRUM-601 —que clasifica un literal por la condición
  // que lo elige— dejaba de ver que dependían del modo. Medido: los siete salían del censo
  // entero (162 → 155 literales visibles) en vez de moverse de «a pelo» a «deriva del flag».
  //
  // Un rótulo que el censo no ve es un rótulo que el trinquete no protege. Escrito así, la
  // condición está PEGADA a sus dos ramas, que es exactamente la forma que ya tiene el botón en
  // `invoicesView.js` y la que el instrumento sabe leer.
  return {
    esJustificante: esJustificante,

    // ── Pantalla de listado ────────────────────────────────────────────────────────────
    tituloListado: function () { return esJustificante() ? 'Justificantes' : 'Facturas'; },
    columnaNumero: function () { return esJustificante() ? 'Nº justificante' : 'Nº factura'; },

    // ── Modal del documento suelto ─────────────────────────────────────────────────────
    tituloModal: function () { return esJustificante() ? 'Nuevo justificante' : 'Nueva factura'; },
    accionPrimaria: function () { return esJustificante() ? 'Emitir justificante' : 'Emitir factura'; },
    ariaDialogo: function () { return esJustificante() ? 'Crear un justificante nuevo' : 'Crear una factura nueva'; },
    avisoEmitido: function () { return esJustificante() ? 'Justificante emitido' : 'Factura emitida'; },
    errorAlEmitir: function () {
      return esJustificante()
        ? 'No hemos podido emitir el justificante. Inténtalo otra vez.'
        : 'No hemos podido emitir la factura. Inténtalo otra vez.';
    },
  };
})();
