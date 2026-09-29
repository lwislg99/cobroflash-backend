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
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-825 D1 · LA RAMA «JUSTIFICANTE» SE RETIRA (firma del fundador, SCRUM-825 comentario 17446)
//
// Todo lo de arriba era verdad cuando se escribió y no se borra. Desde SCRUM-1027 (21-sep-2026)
// `modoDocumentoSuelto` solo devuelve 'factura' o 'no': el predicado `esJustificante()` era
// SIEMPRE false y sus seis rótulos no los veía nadie. Medido en el censo de SCRUM-1257 (grupo A) y
// re-medido ejecutando `modoDocumentoSuelto` en los tres modos (docs/master/SCRUM-1257.md, §1257c).
// Lo que queda es el lado «factura», que es el que ya se pintaba. No entra ni un texto nuevo.
//
// El fichero se queda como FUENTE ÚNICA de estos rótulos: el motivo de SCRUM-776 (que el título, el
// botón, el aviso y el error no digan cosas distintas en el mismo gesto) sigue en pie sin el modo.
// ═════════════════════════════════════════════════════════════════════════════════════════
window.rotulosDelDocumento = (function () {
  return {
    // ── Pantalla de listado ────────────────────────────────────────────────────────────
    tituloListado: function () { return 'Facturas'; },
    columnaNumero: function () { return 'Nº factura'; },

    // ── Página del documento suelto ────────────────────────────────────────────────────
    tituloModal: function () { return 'Nueva factura'; },
    accionPrimaria: function () { return 'Emitir factura'; },
    // SCRUM-875 · aquí estaba `ariaDialogo()`, el `aria-label` del diálogo. Su único consumidor era
    // el modal viejo, retirado en SCRUM-867, y el fundador decidió retirarlo: una página no es un
    // diálogo. Si algún día hay un diálogo, su texto se aprueba entonces (regla 30).
    avisoEmitido: function () { return 'Factura emitida'; },
    errorAlEmitir: function () { return 'No hemos podido emitir la factura. Inténtalo otra vez.'; },

    // ── Hojas de plantillas del documento suelto (SCRUM-600g) ──────────────────────────
    // ⚠️ AQUÍ NO HAY TERNARIO, y no es saltarse la regla de arriba. Ese ternario existe para que un
    // texto que DEPENDE del modo lleve la condición pegada. Éstos no dependen: se firmaron NEUTROS
    // («este documento», «sus líneas») para que valgan igual en factura y en justificante, y la
    // variante justificante se decidió no escribir (SCRUM-825 retira el justificante). Un ternario
    // con las dos ramas iguales sería ruido con forma de decisión.
    // Firma: el orquestador por delegación del fundador, SCRUM-600 comentario 15357.
    hojaUsarPlantilla: function () { return 'Elige una plantilla para cargar sus líneas en este documento.'; },
    hojaGuardarPlantilla: function () { return 'Dale un nombre a esta plantilla para reutilizar sus líneas más adelante.'; },
  };
})();
