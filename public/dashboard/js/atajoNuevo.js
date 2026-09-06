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
    // 🔴 SCRUM-606 (ALB-01) · LA CUARTA LISTA, Y NACE SIN FIRMAR — que es exactamente lo que este
    // fichero predijo el 4-sep: «el día que una cuarta lista estrene su atajo, su rótulo nace sin
    // firma, este número sube y esto cae». Sube y cae. El marcador se VE en pantalla a propósito
    // (SCRUM-402/667): así nadie enciende por descuido texto que nadie ha aprobado.
    //
    // El rótulo vive AQUÍ y no en la vista, como los otros tres, y además lo lee el título del
    // modal del buscador (`albaranDesdePresupuestoModal.js`): una acción, un texto. Si cada sitio
    // escribiera el suyo, el día de la firma uno se quedaría con el marcador puesto.
    albaranes: "[PENDIENTE microcopy oficial] Nuevo albarán",
    // ✅ SCRUM-769 · FIRMADOS POR EL FUNDADOR el 6-sep-2026, junto con otros tres que NO se han
    // podido aplicar (ver `docs/microcopy/2026-09-06-SCRUM-769-las-cinco-pantallas.md`). Estos dos
    // sí: su pantalla tiene un botón primario que ABRE una creación, que es lo que el patrón de
    // SCRUM-599 supone.
    //
    // ⚠️ «Nuevo trabajo» sustituye a «Trabajo nuevo», que sigue APROBADO y sigue vivo como TÍTULO
    // del modal (`jobNuevoModal.js:64`). Los dos textos conviven a propósito y quedan declarados:
    // el botón y el título del modal que abre ya no dicen lo mismo. No es de este ticket.
    jobs: "Nuevo trabajo",
    expenses: "Nuevo gasto",
  };

  // Cuántas ranuras esperan la firma del fundador. Se declara para que nadie tenga que contarlas
  // a mano y para que añadir una sin decirlo salga rojo.
  //
  // 🔴 BAJA DE 3 A 0 el 4-sep-2026: el fundador firmó los tres rótulos. **NO se borra la
  // constante**, y ésa es la diferencia con una entrada del censo de SCRUM-402 —que sí se borra—:
  // aquí el cero no es «no hay nada que declarar», es «las tres que hay están firmadas». Si mañana
  // entra una cuarta lista con su atajo, su rótulo nace SIN FIRMAR y este número tiene que subir.
  // Borrarlo dejaría el hueco sin sitio donde declararse.
  // 🔴 SUBE DE 0 A 1 el 5-sep-2026 (SCRUM-606 · ALB-01): entra «Nuevo albarán», el rótulo de la
  // CUARTA lista, y nace sin la firma del fundador. Los otros tres siguen firmados. Cuando éste se
  // firme, el número vuelve a 0 y su marcador se retira del literal de arriba — los dos a la vez,
  // porque un contador a 0 con un marcador vivo es peor que no llevar cuenta.
  var SIN_APROBAR = 1;

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
   * 🔴 SCRUM-777 · ¿ESTE MODAL ESTÁ DELANTE DE VERDAD, O SÓLO ESTÁ EN EL DOM?
   *
   * Hasta hoy la condición miraba la PRESENCIA de un nodo del `SELECTOR_MODAL`. Y eso bastaba
   * mientras todos los modales se BORRARAN al cerrarse — pero tres no lo hacen: `customersView`,
   * `productsView` y `providersView` cierran el suyo con `style.display = "none"` y lo dejan
   * colgado del `body` para reutilizarlo. Consecuencia MEDIDA con teclas reales en Edge: **abrir y
   * cerrar una ficha de cliente mataba la «N» en TODAS las pantallas hasta recargar**, sin error y
   * sin síntoma. Un gesto que el profesional hace veinte veces al día.
   *
   * ── QUÉ CUENTA COMO «DELANTE», Y POR QUÉ CADA RAMA ─────────────────────────────────────────
   * ① `style.display === "none"` en el propio nodo. Es la ÚNICA técnica que la casa usa para
   *    esconder un overlay —censo por AST sobre `public/dashboard/js`: 19 ficheros con overlay,
   *    TRES lo esconden y los tres con `style.display = "none"`; cero `visibility`, cero
   *    `opacity`, cero `hidden`, cero `aria-hidden` sobre un overlay—. Y es la única legible sin
   *    motor de maquetado, así que también se mide en el banco de vistas.
   * ② El estilo COMPUTADO, si hay navegador de verdad detrás: `display:none` y
   *    `visibility:hidden`. Esta rama es la que ve a los ANCESTROS — un overlay visible dentro de
   *    un contenedor apagado no está delante de nadie.
   * ③ Que ocupe sitio. Una caja de 0×0 no tapa nada.
   * ④ Si no se ha podido medir NADA de lo anterior, **cuenta como delante**. Es el mismo
   *    fail-closed que ya tenía la función cuando no le pasaban documento: ante la duda no abrir
   *    es recuperable; abrir encima de un formulario a medio llenar, no.
   *
   * ── LO QUE **NO** ENTRA EN EL CRITERIO, y las dos razones están medidas ────────────────────
   * ⛔ `opacity`. `.modal-overlay` lleva `animation: fade-in .15s`, y `@keyframes fade-in` arranca
   *    en `opacity: 0`. Contar la opacidad haría que la «N» disparara **durante los primeros
   *    fotogramas de un modal que se está abriendo de verdad**. Además, un overlay transparente
   *    sigue comiéndose los clics: está delante aunque no se vea.
   * ⛔ `offsetParent === null`. `.modal-overlay` es `position: fixed`, así que su `offsetParent`
   *    es `null` **también cuando está abierto**: ese criterio daría por ausente a todos.
   */
  function estaDelante(n, d) {
    if (!n) return false;
    if (n.style && n.style.display === "none") return false;          // ①
    // 🔴 ② y ③ VAN JUNTAS, Y NO ES UN DETALLE DE ESTILO: una caja de 0×0 sólo significa «no ocupa
    // sitio» donde HAY un motor de maquetado. En un DOM sin maquetado —el banco de vistas, por
    // ejemplo— todo mide 0×0, así que preguntar por la caja allí habría dado por ESCONDIDO a un
    // modal ABIERTO y la «N» habría disparado encima de él. Me pasó al escribir esto: el control
    // «con la ficha abierta la N NO dispara» se puso rojo, que es exactamente para lo que está.
    // Por eso la caja sólo se mira cuando hay ventana de verdad detrás.
    var v = d && d.defaultView;
    if (v && typeof v.getComputedStyle === "function") {
      var cs = v.getComputedStyle(n);                                  // ②
      if (cs && (cs.display === "none" || cs.visibility === "hidden")) return false;
      if (typeof n.getBoundingClientRect === "function") {             // ③
        var r = n.getBoundingClientRect();
        if (r && r.width === 0 && r.height === 0) return false;
      }
    }
    return true;                                                       // ④
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
    // SCRUM-777 · se miran TODOS los candidatos, no sólo el primero: con uno escondido delante,
    // `querySelector` devolvía justo el que no importaba. Se conserva la puerta de arriba sobre
    // `querySelector` —es la que distingue «no supe mirar» de «no hay modal»— y `querySelectorAll`
    // se usa sólo si el documento lo tiene, para no romperle el contrato a ningún llamante.
    //
    // ⚠️ LÍMITE DECLARADO: con un documento que sólo tenga `querySelector` se mira UN candidato.
    // En un navegador de verdad `querySelectorAll` existe siempre; ese camino degradado sólo lo
    // pisan los dobles de los tests.
    var lista;
    if (typeof d.querySelectorAll === "function") {
      lista = d.querySelectorAll(SELECTOR_MODAL);
    } else {
      var uno = d.querySelector(SELECTOR_MODAL);
      lista = uno ? [uno] : [];
    }
    for (var i = 0; i < lista.length; i++) {
      if (estaDelante(lista[i], d)) return false;
    }
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
