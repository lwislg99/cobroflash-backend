// public/dashboard/js/atajoNuevo.js — SCRUM-599 (DOC-09) · ABSORBE SCRUM-585 (CONT-12)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN SOLO MECANISMO PARA LAS CUATRO LISTAS. El ticket lo dice con esas palabras: «CONT-12 pide
// el mismo atajo en Clientes. MISMO MECANISMO, NO DOS.»
//
// 🔴 Y EL MOTOR YA EXISTÍA: `app.js` tenía desde hace tiempo un `keydown` global que ya escuchaba
// la «n» y ya se protegía de las cuatro situaciones peligrosas. Lo que hacía era abrir SIEMPRE la
// cotización rápida, estuvieras donde estuvieras. Así que aquí no nace un segundo manejador: se
// le da SUPERFICIE al que hay —la condición se extrae a `sePuedeDisparar`, que es PURA y por
// tanto se puede probar sin navegador, y el destino pasa a decidirlo la vista en la que estás.
//
// LO QUE NO PUEDE PASAR, y cada una tiene su test:
//   · con el foco en un `input`, `textarea`, `select` o algo editable. Un fontanero escribiendo
//     «Nueva caldera» en un campo no puede acabar en una pantalla de creación.
//   · con un modal abierto.
//   · con Ctrl/Cmd/Alt pulsados: `Ctrl+N` es del navegador y no se secuestra.
//   · en una vista que no haya registrado destino: entonces no hay nada que abrir.
// ═════════════════════════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  var TECLA = "N";

  // Los modales de la casa. Es la MISMA lista que ya usaba `app.js`: no se inventa una segunda,
  // porque dos listas de modales divergen el día que alguien añade el tercero.
  var SELECTOR_MODAL =
    ".modal-overlay, .modal-backdrop, #qq-modal-backdrop, #onboarding-backdrop";

  // ✅ MICROCOPY FIRMADA POR EL FUNDADOR el 4-sep-2026 (regla 30). El asesor la había aprobado el
  // 3-sep y quedaba a la espera; ya no. El registro de la aprobación vive en
  // `docs/microcopy/2026-09-04-SCRUM-599-atajo-nuevo.md` — una aprobación, un fichero.
  //
  // Van aquí y en un solo sitio: si cada vista escribiera el suyo, cambiar el copy sería tocar
  // cuatro ficheros y el cuarto se quedaría atrás.
  var TEXTOS = {
    "quotes-list": "Nuevo presupuesto",
    invoices: "Nueva factura",
    customers: "Nuevo cliente",
    // ✅ SCRUM-606 (ALB-01) · LA CUARTA LISTA, FIRMADA POR EL ASESOR el 5-sep-2026. Nacio sin
    // firma —que es exactamente lo que este fichero predijo el 4-sep: «el día que una cuarta lista
    // estrene su atajo, su rótulo nace sin firma, este número sube y esto cae»— y se entrego con
    // su caja medida: 128,1 px de texto en 284 utiles a 390, y en 441 a 929.
    //
    // El rótulo vive AQUÍ y no en la vista, como los otros tres, y además lo lee el título del
    // modal del buscador (`albaranDesdePresupuestoModal.js`): una acción, un texto. Si cada sitio
    // escribiera el suyo, el día de la firma uno se quedaría con el marcador puesto.
    albaranes: "Nuevo albarán",
  };

  // Cuántas ranuras esperan la firma del fundador. Se declara para que nadie tenga que contarlas
  // a mano y para que añadir una sin decirlo salga rojo.
  //
  // 🔴 BAJA DE 3 A 0 el 4-sep-2026: el fundador firmó los tres rótulos. **NO se borra la
  // constante**, y ésa es la diferencia con una entrada del censo de SCRUM-402 —que sí se borra—:
  // aquí el cero no es «no hay nada que declarar», es «las tres que hay están firmadas». Si mañana
  // entra una cuarta lista con su atajo, su rótulo nace SIN FIRMAR y este número tiene que subir.
  // Borrarlo dejaría el hueco sin sitio donde declararse.
  // 🔴 SUBIO A 1 y VOLVIO A 0 el mismo dia, 5-sep-2026 (SCRUM-606 · ALB-01): entro «Nuevo albarán»,
  // el rotulo de la CUARTA lista, sin firma, y el asesor lo firmo en la misma sesion. El contador
  // y el marcador se movieron A LA VEZ, en el mismo commit — que es la leccion que costo tener
  // `main` en rojo: el PR #1065 llego con el marcador puesto porque la firma vivia en un chat y el
  // codigo decia otra cosa. Un contador a 0 con un marcador vivo es peor que no llevar cuenta.
  var SIN_APROBAR = 0;

  var registro = Object.create(null);

  /** La vista dice qué abre su «N». Sin esto, el atajo no tendría destino y no haría nada. */
  function registrar(vista, accion) {
    if (!vista || typeof accion !== "function") return false;
    registro[vista] = accion;
    return true;
  }

  function accionDe(vista) {
    return Object.prototype.hasOwnProperty.call(registro, vista) ? registro[vista] : null;
  }

  /** Para el censo: qué vistas tienen hoy destino registrado. */
  function vistasConAtajo() {
    return Object.keys(registro).sort();
  }

  function textoDe(vista) {
    return Object.prototype.hasOwnProperty.call(TEXTOS, vista) ? TEXTOS[vista] : "";
  }

  /**
   * 🔴 LA CONDICIÓN, PURA Y EN UN SOLO SITIO.
   *
   * Devuelve `true` sólo si esta pulsación debe abrir la creación. Es pura —recibe el evento y el
   * documento— para poder ejercitar las cuatro prohibiciones sin levantar un navegador, que es
   * justo el tipo de defecto que no se ve leyendo el código.
   */
  function sePuedeDisparar(e, doc) {
    if (!e) return false;
    // `Ctrl+N` / `Cmd+N` abren ventana en el navegador. Secuestrarlos es peor que no tener atajo.
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    if (e.key !== "n" && e.key !== "N") return false;

    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT"
      || t.isContentEditable)) return false;

    // 🔴 NO hay respaldo al `document` global: quien llama pasa el suyo (`app.js` lo hace).
    // Si no llega ninguno, esto es «no he podido comprobar si hay un modal», y eso NO es «no hay
    // modal». Ante la duda no abrir es recuperable; abrir encima de un formulario a medio
    // llenar, no.
    // Con un modal delante, la «n» es del modal.
    var d = doc;
    if (!d || typeof d.querySelector !== "function") return false;
    if (d.querySelector(SELECTOR_MODAL)) return false;
    return true;
  }

  /**
   * Pone en el botón el rótulo aprobado y la tecla al final, como hace Holded: `Nuevo cliente N`.
   * La tecla va en un `<kbd>` aparte y no dentro del texto: así el rótulo sigue siendo UNA cadena
   * comparable —la que aprueba el asesor— y el adorno no se cuela en el copy.
   */
  function etiquetar(boton, vista) {
    if (!boton) return boton;
    var texto = textoDe(vista);
    if (texto) boton.textContent = texto;
    if (typeof document === "undefined" || !document.createElement) return boton;
    var k = document.createElement("kbd");
    k.className = "btn-atajo";
    k.textContent = TECLA;
    // El lector de pantalla no lee «ene» suelta: se le dice qué es.
    k.setAttribute("aria-label", "atajo de teclado " + TECLA);
    boton.appendChild(k);
    return boton;
  }

  window.atajoNuevo = {
    TECLA: TECLA,
    TEXTOS: TEXTOS,
    SIN_APROBAR: SIN_APROBAR,
    SELECTOR_MODAL: SELECTOR_MODAL,
    registrar: registrar,
    accionDe: accionDe,
    vistasConAtajo: vistasConAtajo,
    textoDe: textoDe,
    sePuedeDisparar: sePuedeDisparar,
    etiquetar: etiquetar,
  };
})();
