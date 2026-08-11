// public/dashboard/js/modalHeader.js — SCRUM-446 · la cabecera de un modal, en un solo sitio.
//
// ── POR QUÉ DEVUELVE UN NODO Y NO UNA CADENA ────────────────────────────────────────────────
// **Una cadena no puede tener comportamiento.** El objetivo de esta pieza es que el «?» de
// SCRUM-416 y su manejador entren en UN sitio; con una cadena, las siete cabeceras que se
// construyen con `createElement` quedarían fuera y habría **dos caminos para la ayuda** — justo lo
// que se elimina. Cuesta 17 reescrituras en vez de 7, y las cuesta a propósito.
//
// ── LAS TRES DECISIONES QUE TRAÍA ESTE TICKET, Y SU MOTIVO ─────────────────────────────────
//  1. **El título es `<h3>`**, no `<span>` ni `<div>`. Hoy había cuatro etiquetas distintas y
//     **eso no es cosmético**: un lector de pantalla anuncia el `h3` como ENCABEZADO y le da
//     estructura al modal; un `span` no anuncia nada. Se adopta la **mayoría existente** (12 de 24)
//     y no se inventa nivel — nada de `h2`. **Doce cabeceras pasan a anunciarse; ninguna deja de
//     hacerlo.** Va declarado en `docs/master/SCRUM-446.md` como cambio de lo que se OYE.
//  2. **El botón de cierre es OPCIONAL.** `customerDetailView` y una de `quotesView` no lo tienen
//     hoy y **siguen sin tenerlo**: si su ausencia era deliberada se respeta, y si fue descuido es
//     otro ticket con su propia víctima. **Un refactor no decide comportamiento.**
//  3. Y una cuarta diferencia que apareció al construir, resuelta **midiendo**:
//     · `type="button"` lo ponían las 7 imperativas y ninguna de las 17 de plantilla. Sin `type`,
//       dentro de un `<form>` un botón es `submit`. Medido: **ningún `modal-close` está dentro de
//       un `<form>`** (los tres del panel se comprobaron uno a uno), así que unificarlo no cambia
//       nada hoy y protege el día que alguien envuelva un modal en un formulario.
//     · `aria-label="Cerrar"` lo tenían **4 de 24**. No es microcopy nueva y el repo ya lo dice:
//       `api.js:421` — «`aria-label="Cerrar"` NO es microcopy nueva: es el literal que ya usan
//       `invoiceDetailView`…». Sin él, el botón se anuncia como «×».
//
// ⚠️ ESTA PIEZA NO METE LA AYUDA. El «?» es SCRUM-416 y va después: aquí solo se unifica de dónde
// sale el marcado.
(function () {
  'use strict';

  /**
   * @param {{titulo: string, idCierre?: string, alCerrar?: Function, sinCierre?: boolean,
   *           etiquetaCierre?: string}} o
   * @returns {HTMLElement} el `<div class="modal-header">` listo para insertar.
   */
  function cabeceraModal(o) {
    const opciones = o || {};
    const header = document.createElement('div');
    header.className = 'modal-header';

    const titulo = document.createElement('h3');
    titulo.className = 'modal-title';
    // `textContent` y no `innerHTML`: el título es texto. Además quita de en medio el escapado que
    // algunas llamadas hacían a mano para meterlo en una plantilla — escaparlo aquí lo haría
    // visible («&amp;»), que sería la regresión que este refactor no puede permitirse.
    titulo.textContent = opciones.titulo == null ? '' : String(opciones.titulo);
    header.appendChild(titulo);

    // ── SCRUM-416 · LA AYUDA, DENTRO DEL MODAL ────────────────────────────────────────────
    //
    // El «?» ya existía: es el FAB global de `tutorial.js` (`ensureHelpButton`, z-index 350). Y que
    // se esconda con la modal abierta **fue una decisión del fundador**, escrita en el CSS:
    // «Feedback fundador 6-jul: el botón flotante ? no debe pisar las modales». Esa decisión sigue
    // en pie — esto no destapa el FAB, le da a la ayuda un sitio DENTRO.
    //
    // Abre `window.openHelpGuide()`, que es LA MISMA guía del FAB. Dos guías se separarían el día
    // que alguien mejore una, y nadie lo notaría.
    //
    // MICROCOPY (regla 30): `Guía de inicio` **no es texto nuevo** — es el literal que el FAB ya
    // usa en su `title` desde que existe. Se reutiliza, no se inventa. Si el fundador quiere otro,
    // es una línea.
    if (!opciones.sinAyuda) {
      const ayuda = document.createElement('button');
      ayuda.className = 'modal-ayuda';
      ayuda.type = 'button';
      ayuda.textContent = '?';
      ayuda.title = 'Guía de inicio';
      ayuda.setAttribute('aria-label', 'Guía de inicio');
      ayuda.addEventListener('click', function () {
        if (typeof window.openHelpGuide === 'function') window.openHelpGuide();
      });
      header.appendChild(ayuda);
    }

    if (!opciones.sinCierre) {
      const cerrar = document.createElement('button');
      cerrar.className = 'modal-close';
      cerrar.type = 'button';
      // `etiquetaCierre` existe por UN caso, y no se quita: `nuevaFacturaModal` pone ahí su
      // MARCADOR de microcopy sin aprobar. Forzarle «Cerrar» resolvería en silencio una aprobación
      // pendiente — el guard de marcadores existe justo para que eso no pase (regla 30).
      cerrar.setAttribute('aria-label', opciones.etiquetaCierre || 'Cerrar');
      cerrar.textContent = '×';
      if (opciones.idCierre) cerrar.id = opciones.idCierre;
      if (typeof opciones.alCerrar === 'function') cerrar.addEventListener('click', opciones.alCerrar);
      header.appendChild(cerrar);
    }
    return header;
  }

  window.cabeceraModal = cabeceraModal;
  if (typeof module !== 'undefined' && module.exports) module.exports = { cabeceraModal };
})();
