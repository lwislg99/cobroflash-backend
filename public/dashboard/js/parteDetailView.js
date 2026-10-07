// public/dashboard/js/parteDetailView.js — SCRUM-652 (T3 fase C) · EL PARTE EN EL MÓVIL.
//
// La pantalla que el técnico rellena en la obra y donde el cliente firma. Cableada al dominio que
// ya existía (`parteTrabajo.ts`, fase B) a través de `/admin/partes`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 AQUÍ NO SE PINTA NI UN IMPORTE, Y NO ES QUE SE OCULTEN: NO LLEGAN.
//
// En el parte real firmado que rellenan hoy, la columna IMPORTE está EN BLANCO. El técnico cierra
// en la obra sin precios y el jefe los pone en la oficina después. Así que el mecanismo no es «no
// los pintes»: es que `/admin/partes` los deja en la fila y **no cruzan el cable**
// (`lineasParaElTecnico` devuelve bloque, unds y descripción, y nada más).
//
// Una pantalla que los recibe y decide no enseñarlos está a un `console.log` de enseñarlos. Ésta
// no puede enseñarlos ni queriendo, porque no los tiene. Es el mismo mecanismo de
// `albaranDetailView.js:490` para la firma en el aparato.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE EL PAPEL TIENE Y ESTA PANTALLA **NO** CABLEA HOY, dicho para que no se suponga
//
// El papel lleva Cliente / Calle / Población / Teléfono / CIF. De esos, aquí sólo salen el
// NOMBRE del cliente y la dirección de la OBRA, que son los que la tabla `partes_trabajo` tiene.
// Calle, población, teléfono y CIF viven en la ficha del cliente, y traerlos a una pantalla nueva
// es meter más datos personales en un sitio nuevo: eso se decide, no se arrastra de paso.
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // SCRUM-1124 · Los textos de abajo YA están aprobados (varios con cita a
  // `docs/microcopy/` y su ticket: SCRUM-818, SCRUM-704, SCRUM-703). La constante `M` que los
  // sujetaba dejó de usarse, pero NO se retira: SCRUM-720 fijó que el mecanismo se VACÍA, no se
  // quita, para que el rótulo que alguien añada mañana sin firmar siga naciendo marcado
  // (`tests/scrum720-marcadores-en-lo-pintado.test.mjs`).
  // ═══════════════════════════════════════════════════════════════════════════════════════
  var M = '[PENDIENTE microcopy oficial]';

  var TEXTOS = {
    // APROBADO · SCRUM-1215 comentario 17367
    tituloFirma: 'Firma del cliente',
    pistaFirma: 'Pide al cliente que firme con el dedo dentro del recuadro.',
    // APROBADO · SCRUM-1215 comentario 18205. La pista cuando quien firma es el TÉCNICO: la de
    // arriba habla del cliente, y desde SCRUM-1229 el técnico firmaba sin ninguna.
    pistaFirmaTecnico: 'Firma con el dedo dentro del recuadro.',
    // SCRUM-1426 · la pregunta antes de firmar ENCIMA de una firma guardada en este móvil. Dos, y
    // no una: la cola guarda la del cliente y la del técnico por separado, y hay que decir cuál se
    // sustituye. Ficha: `docs/microcopy/2026-10-02-SCRUM-1426-parte-firma-guardada.md`.
    yaHayFirmaGuardadaCliente: 'Ya hay una firma del cliente de este parte guardada en este móvil. Si firmas otra vez, la nueva sustituye a la anterior.', // APROBADO · SCRUM-1426 comentario 18232
    yaHayFirmaGuardadaTecnico: 'Ya hay una firma del técnico de este parte guardada en este móvil. Si firmas otra vez, la nueva sustituye a la anterior.', // APROBADO · SCRUM-1426 comentario 18232
    // APROBADO · SCRUM-1215 comentario 17367
    manoObra: 'Mano de obra',
    // APROBADO · SCRUM-1215 comentario 17367
    materiales: 'Materiales',
    sinLineas: 'Todavía no has apuntado nada.',
    // APROBADO · SCRUM-1215 comentario 17367. Sólo en un bloque vacío que ya NO es editable (el
    // parte está firmado): ahí «todavía» prometía algo que ya no se puede hacer, y «has» lo lee
    // también la oficina. Editable, se queda `sinLineas`.
    sinLineasCerrado: 'No se apuntó nada en este apartado.',
    // APROBADO · SCRUM-1215 comentario 17367
    unds: 'UNDS',
    // La segunda cabecera de las líneas. FIRMADA por el fundador el 7-sep-2026 (SCRUM-818): es la
    // palabra del impreso y no estrena vocabulario. Consta en
    // `docs/microcopy/2026-09-07-SCRUM-818-cabecera-de-la-descripcion.md`.
    descripcion: 'Descripción',
    // APROBADO · SCRUM-1215 comentario 17367
    entrada: 'Entrada',
    // APROBADO · SCRUM-1215 comentario 17367
    salida: 'Salida',
    // APROBADO · SCRUM-1215 comentario 17367
    desplazamiento: 'Desplazamiento',
    // APROBADO · SCRUM-1215 comentario 17367
    kilometros: 'Kilómetros',
    // APROBADO · SCRUM-1215 comentario 17367
    referencia: 'REF',
    // APROBADO · SCRUM-1215 comentario 17367
    obra: 'Dirección de la obra',
    // APROBADO · SCRUM-1215 comentario 17367
    tecnicos: 'Técnicos',
    // APROBADO · SCRUM-1215 comentario 17367
    notas: 'Notas',
    // APROBADO · SCRUM-1215 comentario 17367
    anadirLinea: 'Añadir línea',
    // APROBADO · SCRUM-1215 comentario 17367
    firmar: 'Firmar aquí mismo',
    // SCRUM-1215 (lote 1) · `yaFirmado` RETIRADA: cero consumidores, no se pintaba nunca. Decidido
    // por el orquestador el 28-sep-2026; motivo en `scripts/_censo-convenio-microcopy-declarados.json`.
    // ✅ APROBADO literal por el fundador el 3-sep-2026, sin cambiar una letra. Consta en
    // `docs/microcopy/2026-09-03-SCRUM-704-guardar-lineas-dictadas.md`.
    noSeGuardo: 'No se han podido guardar las líneas — vuelve a intentarlo',
    // Un campo de la cabecera que no se guarda. Calcado de `noSeGuardo`: el mismo fallo, con las
    // mismas palabras. «las líneas» ahí sería falso: lo que no se guardó es una casilla.
    // APROBADO · SCRUM-1302 comentario 18288
    noSeGuardoElCambio: 'No se ha podido guardar el cambio — vuelve a intentarlo',
    // SCRUM-1491 · Desplazamiento rechazado por la ruta con `desplazamientos_invalido`. «Vuelve a
    // intentarlo» ahí manda a repetir algo que no va a entrar nunca. Dice lo que VALE y no lo que
    // falló, porque el código tiene dos causas (no es entero, o no cabe en la columna) y la vista
    // no puede saber cuál sin copiar una regla de la ruta: para el número enorme es impreciso, no
    // falso. Un texto por causa pide un código por causa (SCRUM-1488).
    // APROBADO · SCRUM-1491 comentario 18517
    desplazamientoEsEntero: 'No se ha guardado. Desplazamiento es un número entero, como 1 o 2 — no el tiempo de viaje',
    // SCRUM-1492 · lo tecleado en Kilómetros que la casilla no entiende como número («1e», «-»,
    // «,»). No se manda nada y se dice lo que VALE. «No se ha podido guardar el cambio» sería
    // falso: nada ha fallado, no se ha intentado.
    // PROPUESTO · SCRUM-1492 · SIN FIRMA: no se empuja así
    kilometrosEsUnNumero: 'No se ha guardado. Kilómetros es un número, como 12 o 12,5',
    // APROBADO · SCRUM-1215 comentario 17367
    noSePudoCargar: 'No se ha podido cargar el parte. Vuelve a intentarlo.',
    // El rótulo del GRUPO de los tres tipos (SCRUM-818). No es texto nuevo: es el literal que el
    // fundador firmó en SCRUM-703 para este mismo vocabulario cerrado en «Trabajo nuevo», así que
    // reutilizarlo no estrena microcopy ni pide firma (regla 30).
    // APROBADO · SCRUM-1215 comentario 17367
    tituloTipo: 'Tipo de intervención',
    // APROBADO · SCRUM-1215 comentario 17367
    tipoReparacion: 'Reparación / asistencia',
    // APROBADO · SCRUM-1215 comentario 17367
    tipoMantenimiento: 'Mantenimiento',
    // APROBADO · SCRUM-1215 comentario 17367
    tipoInstalacion: 'Instalación',
    // APROBADO · SCRUM-1215 comentario 17367
    dictado: 'Dicta lo que has hecho',
    // APROBADO · SCRUM-1215 comentario 17367
    pistaDictado: 'Usa el micrófono de tu teclado. Luego lo ordenamos.',
    // APROBADO · SCRUM-1215 comentario 17367
    ordenarDictado: 'Ordenar en líneas',
    // «Ordenar en líneas» cuando la ruta NO contesta (sin red, 5xx, 502). Vive aquí y no en los
    // `avisos` del servidor: es justo el caso en que el servidor no ha dicho nada. No es el de
    // «ninguna línea», que dice que el servicio contestó y por eso no invita a repetir.
    // APROBADO · SCRUM-1302 comentario 18491
    noSePudoOrdenar: 'No se ha podido ordenar el dictado — vuelve a intentarlo o escribe las líneas tú',
    // SCRUM-1266 · el dato que la máquina escribió y el dictado no decía, dicho en SU línea de la tabla.
    // Van seguidos de los datos, separados por coma y espacio. Sólo con el parte editable; nunca en
    // el sello (la marca no entra en `lineasCanonicasParte`).
    // APROBADO · SCRUM-1266 comentario 17498
    noSalioEnLoDictado: 'No salía en lo dictado: ',
    // APROBADO · SCRUM-1266 comentario 17498. Limpia la marca de esa línea y NO toca la descripción.
    esCorrecto: 'Es correcto',
    // APROBADO · SCRUM-1215 comentario 17375. Sustituye a «Añadir estas líneas», que no se aprobó
    // (c.17367): una línea sin cantidad no entra, y «estas» prometía que entraban las que se ven.
    confirmarPropuesta: 'Añadir al parte',
    sinBloque: 'Sin colocar — elige mano de obra o materiales',

    // ── SCRUM-653 · LAS DOS FIRMAS ──────────────────────────────────────────────────────
    // Los cinco textos de las dos firmas, FIRMADOS por el fundador el 4-sep-2026. Constan en
    // `docs/microcopy/2026-09-04-SCRUM-653-las-dos-firmas.md`.
    //
    // Etiquetas de estado SIN punto final; frases CON punto. Es deliberado, no un descuido.
    firmarTecnico: 'Firma del técnico',
    yaFirmoElCliente: 'Firmado por el cliente',
    yaFirmoElTecnico: 'Firmado por el técnico',
    // 🔴 DOS CLAVES Y NO UNA. «Falta una firma para cerrar el parte» **no decía cuál**, y el
    // técnico está de pie en un cuarto técnico con el móvil en la mano: un aviso que no nombra lo
    // que falta le obliga a adivinar. El control negativo de SCRUM-653 exige que se diga cuál.
    //
    // SCRUM-653 (28-sep) · SIN «para cerrar el parte». FIRMADO por delegación del fundador,
    // SCRUM-653 comentario 17354 (opción B). La coletilla era FALSA: la PRIMERA firma, sea cual
    // sea, pone el parte en `firmado` (`partes.routes.ts`, rutas `/firmar` y `/firmar-tecnico`),
    // así que con una basta y la segunda ya no cierra nada.
    faltaLaFirmaDelCliente: 'Falta la firma del cliente.',
    faltaLaFirmaDelTecnico: 'Falta la firma del técnico.',
    // Misma firma (c.17354). Solo mientras no ha firmado NADIE: después ya no avisa, es un hecho.
    // Cierto porque `puedeEditarContenido` solo abre en `borrador` (`parteTrabajo.ts`), y el PATCH
    // y el dictado lo aplican. No habla de precios a propósito: siguen abiertos hasta facturar.
    conLaPrimeraFirmaQuedaFijo: 'Con la primera firma, lo apuntado queda fijo.',

    // SCRUM-890 · por qué no se firma un parte vacío y qué hacer. FIRMADO el 16-sep-2026 por
    // delegación del fundador (SCRUM-890, comentario 15623). Consta en
    // `docs/microcopy/2026-09-16-SCRUM-890-parte-vacio-no-se-firma.md`.
    parteVacioNoSeFirma: 'Este parte está vacío y no se puede firmar. Apunta lo que has hecho y vuelve a intentarlo.',
    // SCRUM-890 (PR 2) · una firma que se quedó en la cola y el servidor rechazó al vaciarla, con un
    // código distinto de `parte_vacio`. APROBADO por el orquestador por delegación del fundador,
    // SCRUM-890 comentario 15665 (17-sep-2026). Consta en
    // `docs/microcopy/2026-09-17-SCRUM-890-firma-rechazada.md`. (Hasta SCRUM-1215 este comentario
    // decía «PROPUESTA, PENDIENTE DE FIRMA», y el censo 1157 lo contaba como sin firmar.)
    firmaRechazada: 'La firma que quedó pendiente no se ha podido registrar. Vuelve a firmar el parte.',

    // ── SCRUM-1175 (916a, PR-A) · HORAS Y DESPLAZAMIENTO ────────────────────────────────
    // FIRMADOS por delegación del fundador el 27-sep-2026, SCRUM-916 comentario 17251.
    // «La hora se elige, no se escribe.» va firmada CON CONDICIÓN: sólo se pinta cuando los dos
    // campos son de verdad un selector (ver `pintarHoras`). Con un valor viejo de texto libre la
    // hora SÍ se escribe, y la frase sería falsa justo donde aparece.
    // ⛔ «horas» al lado de Desplazamiento NO se pinta aunque esté firmado: `desplazamientos` es un
    // ENTERO (`schema.prisma`, y el PATCH responde «Los desplazamientos son un número entero»), o
    // sea un recuento y no una duración. Llamarlo horas afirmaría algo que el dato no es.
    horasTitulo: 'Horas y desplazamiento',
    horasGuia: 'La hora se elige, no se escribe.',
    ahora: 'Ahora',
    tiempoEnLaObra: 'Tiempo en la obra',
    revisaLasHoras: 'Revisa las horas',
    salidaAntesQueEntrada: 'La salida es antes que la entrada',
    km: 'km',

    // SCRUM-1175 (916a, PR-B) · el título del paso de las firmas. FIRMADO por delegación del
    // fundador el 27-sep-2026, SCRUM-916 comentario 17251.
    // ⛔ Su guía propuesta, «Sin las dos firmas el parte no se cierra.», NO se pinta: con UNA firma
    // el parte ya pasa a `firmado` (`partes.routes.ts`, rutas `firmar` y `firmar-tecnico`). Espera
    // decisión del fundador (SCRUM-1175, comentario 17253).
    firmasTitulo: 'Firmas',

    // ── SCRUM-1175 (916a, PR-C) · LOS DATOS DEL PARTE, PLEGADOS ─────────────────────────
    // FIRMADOS por delegación del fundador el 27-sep-2026, SCRUM-916 comentario 17251, y cada
    // uno COMPROBADO contra el código antes de pintarlo. Cuatro de los firmados ahí NO se pintan
    // porque no se cumplen, y los sustituyen cuatro que el orquestador firmó después en SCRUM-916,
    // comentario 17273 (27-sep-2026), que registra también su retirada:
    //   ⛔ «La del trabajo, si no pones otra» y «Los del trabajo»: con la obra vacía NADA usa la
    //      dirección del trabajo — ni al crear el parte ni en lo que se sella y firma el cliente
    //      (`partes.routes.ts`, `obra: parte.obra ?? null`).
    //   ⛔ «Solo tú» y «Quién más ha estado en la obra»: Técnicos se prellena con TODOS los
    //      asignados del trabajo, quien lo rellena incluido (SCRUM-818); vacío es «sin trabajo o
    //      sin asignados», y «tú» sería el jefe si lo mira desde la oficina.
    datosTitulo: 'Datos del parte',
    obraYReferencia: 'Obra y referencia',
    pistaObra: 'Dónde se ha hecho el trabajo',
    pistaReferencia: 'Tu referencia interna, si usas alguna',
    sinObraNiReferencia: 'Sin dirección ni referencia',
    sinElegir: 'Sin elegir',
    sinTecnicos: 'Sin técnicos',
    pistaTecnicos: 'Quién ha estado en la obra',
    sinNotas: 'Sin notas',
    pistaNotas: 'Lo que haya que dejar dicho.',
  };

  // El vocabulario CERRADO del dominio (`parteTrabajo.ts`). No se inventa aquí ni se amplía:
  // si algún día nace un tercer bloque o un cuarto tipo, nace allí y esto lo lee.
  var BLOQUES = ['mano_obra', 'materiales'];
  var TIPOS = ['reparacion_asistencia', 'mantenimiento', 'instalacion'];
  var ETIQUETA_BLOQUE = { mano_obra: TEXTOS.manoObra, materiales: TEXTOS.materiales };
  var ETIQUETA_TIPO = {
    reparacion_asistencia: TEXTOS.tipoReparacion,
    mantenimiento: TEXTOS.tipoMantenimiento,
    instalacion: TEXTOS.tipoInstalacion,
  };

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * 🔴 EL SUELO DE ESTA PANTALLA: si el parte no trae `lineas`, NO se pinta «sin líneas».
   *
   * «No hay líneas» y «no supe leerlas» son la misma pantalla y significan lo contrario. La
   * segunda le diría al técnico que su parte está vacío cuando lo que pasa es que la respuesta
   * vino rota, y firmaría un documento que no dice lo que él hizo.
   */
  function lineasOCeguera(parte) {
    if (!parte || !Array.isArray(parte.lineas)) return null;
    return parte.lineas;
  }

  /** Una fila del bloque. DOS columnas: unidades y descripción. No hay una tercera. */
  /**
   * SCRUM-889 · Una línea guardada, tal y como se devuelve al servidor: con su `id`. El `PATCH`
   * reemplaza la lista entera y casa los precios de la oficina POR ESE ID; sin él casaría por
   * posición, y quitar una línea le movería el precio a la de detrás. Ni un importe: no los hay.
   */
  function lineaQueSeGuarda(l) {
    var linea = { id: l.id, bloque: l.bloque, unds: l.unds, descripcion: l.descripcion };
    // SCRUM-1266 · la marca del dato inventado vuelve con su línea; el servidor deja de ella sólo lo
    // que siga escrito en la descripción.
    if (Array.isArray(l.datosNoRespaldados) && l.datosNoRespaldados.length) {
      linea.datosNoRespaldados = l.datosNoRespaldados;
    }
    return linea;
  }

  /**
   * 🔴 SCRUM-1266 · LOS GUARDADOS DE LAS LÍNEAS DE UN PARTE, UNO DETRÁS DE OTRO.
   *
   * Cada `PATCH` de líneas manda la lista ENTERA. El `blur` de una casilla y el clic que lo provoca
   * («×», «Añadir línea», «Añadir al parte», «Es correcto») salen a la vez: si el segundo arma su
   * lista antes de que vuelva el primero, lleva la descripción VIEJA y deshace lo que el técnico
   * acababa de corregir. Aquí cada uno espera al anterior y arma su lista cuando le toca.
   */
  var COLAS_DEL_PARTE = typeof WeakMap === 'function' ? new WeakMap() : null;
  function enOrdenDelParte(parte, fn) {
    var previa = (COLAS_DEL_PARTE && parte && COLAS_DEL_PARTE.get(parte)) || Promise.resolve();
    var turno = previa.then(fn);
    if (COLAS_DEL_PARTE && parte) COLAS_DEL_PARTE.set(parte, turno.then(null, function () {}));
    return turno;
  }

  /** SCRUM-1266 · los datos marcados que siguen en la línea; lo que no sea texto no cuenta. */
  function marcaDeLinea(linea) {
    var marca = linea && Array.isArray(linea.datosNoRespaldados) ? linea.datosNoRespaldados : [];
    return marca.filter(function (t) { return typeof t === 'string' && t !== ''; });
  }

  /**
   * 🔴 SCRUM-1266 · EL DATO QUE LA MÁQUINA ESCRIBIÓ Y EL DICTADO NO DECÍA, EN LA TABLA DEL PARTE.
   *
   * Hasta hoy la marca llegaba con la línea y no se pintaba: el técnico no sabía qué palabra mirar.
   * Se pinta sólo desde `filaDeLinea` editable — con el parte firmado no queda nada que corregir y
   * avisar sería angustiar sin salida (c.17498, condición 1). Nombra los datos, que es lo que lo hace
   * accionable, y lleva «Es correcto» al lado: sin él, un dato CIERTO sólo se quitaba borrándolo.
   *
   * Una lista larga NO deforma la línea: el texto parte por cualquier sitio (`overflow-wrap:anywhere`,
   * también un token sin espacios) y el botón baja de renglón (`flex-wrap`) en vez de ensanchar la
   * columna. El servidor corta la marca en 20 datos (`MAX_DATOS_MARCADOS`).
   */
  function avisoNoDictado(linea, indice) {
    var marca = marcaDeLinea(linea);
    if (!marca.length) return '';
    return (
      '<div data-no-dictado="' + indice + '" style="display:flex;flex-wrap:wrap;align-items:center;' +
      'gap:4px 8px;margin-top:4px;min-width:0;max-width:100%">' +
      '<span data-no-dictado-texto="1" style="flex:1 1 12em;min-width:0;font-size:12px;' +
      'color:var(--ink);overflow-wrap:anywhere;word-break:break-word">' +
      esc(TEXTOS.noSalioEnLoDictado + marca.join(', ')) + '</span>' +
      '<button type="button" data-es-correcto="' + indice + '">' + esc(TEXTOS.esCorrecto) + '</button>' +
      '</div>'
    );
  }

  /**
   * Una línea del parte.
   *
   * 🔴 SCRUM-818 · DOS CAMPOS CON BORDE, no `2  Tiempo de espera` a pelo. Con las manos sucias y
   * el móvil en una mano, el técnico no sabía dónde tocar para cambiar el número y dónde para
   * cambiar el texto. La cantidad abre teclado numérico; la descripción se queda con el ancho.
   *
   * Un parte firmado no se edita: entonces son celdas de texto y no hay ningún hueco.
   */
  function filaDeLinea(linea, indice, editable) {
    var unds = linea && linea.unds !== undefined && linea.unds !== null ? String(linea.unds) : '';
    var desc = linea && linea.descripcion ? String(linea.descripcion) : '';
    if (!editable) {
      return (
        '<tr data-parte-linea="' + indice + '">' +
        '<td class="parte-col-unds">' + esc(unds) + '</td>' +
        '<td>' + esc(desc) + '</td></tr>'
      );
    }
    return (
      '<tr data-parte-linea="' + indice + '">' +
      '<td class="parte-col-unds">' +
      '<input class="parte-linea-unds" type="number" inputmode="decimal" step="any"' +
      ' data-linea-unds="' + indice + '" value="' + esc(unds) + '"' +
      ' aria-label="' + esc(TEXTOS.unds) + '"></td>' +
      // SCRUM-1287 · `textarea` de UNA fila que crece hacia abajo (`crecerDescripcion`): en un móvil de
      // 390 px el `input` medía 182 px y cortaba el 77 % de las descripciones del catálogo de gremios,
      // así que las palabras que nombra el aviso del dato inventado no se podían leer en su sitio.
      '<td><textarea class="parte-linea-desc" rows="1" data-linea-desc="' + indice + '">' +
      esc(desc) + '</textarea>' + avisoNoDictado(linea, indice) + '</td>' +
      '<td class="parte-col-quitar">' +
      '<button type="button" class="parte-quitar-linea" data-indice="' + indice + '" ' +
      'aria-label="Quitar línea">&times;</button></td>' +
      '</tr>'
    );
  }

  /**
   * SCRUM-889 · La línea que el técnico acaba de añadir y TODAVÍA NO SE HA GUARDADO.
   *
   * Los mismos dos campos y la misma «×» que una línea guardada (misma clase, mismo aspecto), pero
   * con sus propias marcas: no lleva índice porque aún no está en la lista del servidor, y así los
   * escuchadores de las líneas guardadas no la confunden con ninguna.
   */
  function filaNueva(bloque) {
    return (
      '<tr data-parte-linea-nueva="' + esc(bloque) + '">' +
      '<td class="parte-col-unds">' +
      '<input class="parte-linea-unds" type="number" inputmode="decimal" step="any" min="0"' +
      ' data-nueva-unds="1" value="" aria-label="' + esc(TEXTOS.unds) + '"></td>' +
      '<td><textarea class="parte-linea-desc" rows="1" data-nueva-desc="1"' +
      ' aria-label="' + esc(TEXTOS.descripcion) + '"></textarea></td>' +
      '<td class="parte-col-quitar">' +
      '<button type="button" class="parte-quitar-linea" data-quitar-nueva="1" ' +
      'aria-label="Quitar línea">&times;</button></td>' +
      '</tr>'
    );
  }

  /**
   * SCRUM-1287 · La descripción crece hacia abajo en vez de cortarse, y sigue siendo UNA línea de texto.
   *
   * · El alto sale de su contenido: `auto` y después su `scrollHeight`. Con una sola fila mide lo mismo
   *   que el `input` de antes (44 px, ver `.parte-linea-desc` en styles.css), así que una descripción
   *   corta se ve igual que hoy.
   * · Intro NO mete un salto: con el `input` no lo metía, y una descripción es una línea del papel.
   *   Un salto pegado se cambia por un espacio por el mismo motivo.
   */
  function crecerDescripcion(casilla) {
    if (!casilla || !casilla.style || typeof casilla.scrollHeight !== 'number') return;
    casilla.style.height = 'auto';
    casilla.style.height = casilla.scrollHeight + (casilla.offsetHeight - casilla.clientHeight) + 'px';
  }
  function conectarDescripcion(casilla) {
    if (!casilla || !casilla.addEventListener) return;
    casilla.addEventListener('keydown', function (e) {
      if (e && e.key === 'Enter') e.preventDefault();
    });
    casilla.addEventListener('input', function () {
      if (typeof casilla.value === 'string' && /[\r\n]/.test(casilla.value)) {
        casilla.value = casilla.value.replace(/[\r\n]+/g, ' ');
      }
      crecerDescripcion(casilla);
    });
    crecerDescripcion(casilla);
  }

  /**
   * Un bloque del papel. Los DOS se pintan SIEMPRE, aunque estén vacíos.
   *
   * El impreso tiene los dos recuadros impresos aunque el técnico solo use uno, y esconder el
   * vacío haría que «no hay materiales» se viera igual que «esta pantalla no tiene materiales».
   */
  function pintarBloque(bloque, lineas, editable) {
    var suyas = [];
    for (var i = 0; i < lineas.length; i++) {
      if (lineas[i] && lineas[i].bloque === bloque) suyas.push({ linea: lineas[i], indice: i });
    }
    var filas = suyas.length
      ? suyas.map(function (x) { return filaDeLinea(x.linea, x.indice, editable); }).join('')
      : '<tr data-parte-sin-lineas="' + esc(bloque) + '"><td colspan="' + (editable ? 3 : 2) + '" style="padding:6px 0;color:var(--muted)">' +
        esc(editable ? TEXTOS.sinLineas : TEXTOS.sinLineasCerrado) + '</td></tr>';

    return (
      '<section class="parte-bloque" data-parte-bloque="' + esc(bloque) + '" style="margin-bottom:18px">' +
      '<h4 style="margin:0 0 6px;font-size:14px;font-weight:700;color:var(--ink)">' +
      esc(ETIQUETA_BLOQUE[bloque]) + '</h4>' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
      // 🔴 DOS CABECERAS, no una. Con «UNDS» sola, la columna del texto no tenía nombre y el
      // técnico no sabía qué se esperaba ahí. «Descripción» la firmó el fundador el 7-sep-2026: es
      // la palabra del impreso, así que no estrena vocabulario.
      '<thead><tr><th class="parte-col-unds">' + esc(TEXTOS.unds) + '</th>' +
      '<th>' + esc(TEXTOS.descripcion) + '</th>' +
      (editable ? '<th class="parte-col-quitar"></th>' : '') +
      '</tr></thead><tbody data-parte-filas="' + esc(bloque) + '">' + filas + '</tbody></table>' +
      (editable
        ? '<button type="button" class="parte-anadir" data-bloque="' + esc(bloque) + '" ' +
          'style="margin-top:6px;font-size:13px">' + esc(TEXTOS.anadirLinea) + '</button>'
        : '') +
      '</section>'
    );
  }

  /** Las TRES casillas de tipo, EXCLUYENTES. Radios, no checkboxes: el papel deja marcar una. */
  function pintarTipo(tipoActual, editable) {
    return (
      '<fieldset class="parte-tipo" style="border:0;padding:0;margin:0 0 14px" data-parte-tipo="1">' +
      // 🔴 SCRUM-818 · EL GRUPO DICE DE QUÉ ES. Los tres flotaban sueltos entre la cabecera y el
      // dictado, sin decir de qué eran opciones, y es un campo obligatorio del parte (SCRUM-703).
      // El rótulo NO estrena texto: «Tipo de intervención» ya lo firmó el fundador en SCRUM-703
      // para este MISMO vocabulario cerrado en el modal de Trabajo nuevo.
      '<legend>' + esc(TEXTOS.tituloTipo) + '</legend>' +
      TIPOS.map(function (t) {
        return (
          // SCRUM-1175 (PR-C) · fichas de 48 px: la etiqueta entera es el objetivo del dedo.
          '<label class="parte-tipo-ficha">' +
          '<input type="radio" name="parte-tipo" value="' + esc(t) + '"' +
          (tipoActual === t ? ' checked' : '') + (editable ? '' : ' disabled') + '>' +
          esc(ETIQUETA_TIPO[t]) + '</label>'
        );
      }).join('') +
      '</fieldset>'
    );
  }

  /**
   * Lo tecleado en un campo → el cuerpo del `PATCH`, con SU tipo (SCRUM-818).
   *
   * 🔴 CADA COLUMNA TIENE UN TIPO Y LA RUTA LO VALIDA: `desplazamientos` es entero,
   * `kilometros` número y `tecnicos` una lista. Mandar la cadena tal cual haría que la ruta
   * devolviera 400 y el técnico viera que «no se guarda» sin saber por qué.
   *
   * ⚠️ VACÍO ES `null`, NO CERO NI CADENA VACÍA. Un campo que el técnico borra es un dato AUSENTE,
   * y ausente no es cero: 0 kilómetros es haber ido y no recorrer nada; sin kilómetros es no
   * haberlo apuntado. En un papel que se factura, esos dos no son lo mismo.
   */
  function cuerpoDeCampo(nombre, valor) {
    var v = valor === null || valor === undefined ? '' : String(valor).trim();
    var cuerpo = {};
    if (nombre === 'tecnicos') {
      // El papel los escribe en una línea separados por coma: se parte por ahí y se limpian los
      // huecos, para que «Israel, , Miguel» no guarde un técnico vacío.
      cuerpo.tecnicos = v === '' ? [] : v.split(',').map(function (x) { return x.trim(); })
        .filter(function (x) { return x !== ''; });
      return cuerpo;
    }
    if (nombre === 'desplazamientos' || nombre === 'kilometros') {
      cuerpo[nombre] = v === '' ? null : Number(v);
      return cuerpo;
    }
    cuerpo[nombre] = v === '' ? null : v;
    return cuerpo;
  }

  /**
   * Uno de los datos del parte. **Campo de verdad cuando se puede editar** (SCRUM-818).
   *
   * Un parte FIRMADO no se edita (T3, SCRUM-652): entonces se enseña el DATO, sin hueco de
   * escritura, para que tampoco parezca un campo por el otro lado.
   *
   * @param {string}  rotulo    ya firmado; aquí no se estrena texto (regla 30).
   * @param {*}       valor
   * @param {string}  nombre    la clave del `PATCH`: es lo que ata la casilla a su columna.
   * @param {boolean} editable
   * @param {'number'} [modo]   abre el teclado numérico del móvil.
   * @param {string}  [unidad]  se pinta al lado del número (SCRUM-1175: «km»).
   * @param {string}  [pista]   el marcador del campo vacío (SCRUM-1175, PR-C). Sólo al editar.
   */
  function campo(rotulo, valor, nombre, editable, modo, unidad, pista) {
    var v = valor === null || valor === undefined ? '' : String(valor);
    if (!editable) {
      return (
        '<div class="parte-campo">' +
        '<span class="parte-campo-rotulo">' + esc(rotulo) + '</span>' +
        '<span class="parte-campo-dato" data-parte-dato="' + esc(nombre || '') + '">' +
        esc(v ? v + (unidad ? ' ' + unidad : '') : '—') + '</span></div>'
      );
    }
    // SCRUM-1491 · Desplazamiento es un ENTERO: `numeric` pide el teclado sin coma. Con `decimal`
    // la casilla ofrecía la coma para un dato que no la admite. Kilómetros sí admite «12,5».
    // ⚠️ Qué teclado saca cada móvil con cada valor no está medido en un aparato de verdad.
    var casilla =
      '<input type="' + (modo === 'number' ? 'number' : 'text') + '"' +
      (modo === 'number' ? ' inputmode="' + (nombre === 'desplazamientos' ? 'numeric' : 'decimal') + '"' : '') +
      (pista ? ' placeholder="' + esc(pista) + '"' : '') +
      ' data-parte-campo="' + esc(nombre || '') + '" value="' + esc(v) + '">';
    return (
      '<label class="parte-campo">' +
      '<span class="parte-campo-rotulo">' + esc(rotulo) + '</span>' +
      (unidad
        ? '<span class="parte-campo-con-unidad">' + casilla +
          '<span class="parte-campo-unidad">' + esc(unidad) + '</span></span>'
        : casilla) +
      '</label>'
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // SCRUM-1175 (916a, PR-A) · LAS HORAS CON SELECTOR, SIN PERDER NI UN VALOR VIEJO.
  //
  // 🔴 `entrada` y `salida` son `String?` de TEXTO LIBRE (`schema.prisma`, modelo ParteTrabajo) y
  // hay partes guardados con «8h» o «8.30». Un `<input type="time">` con un `value` que no es
  // HH:MM lo DESCARTA en silencio: el campo sale vacío, y el siguiente `change` guardaría el vacío
  // encima del dato del profesional. Por eso el selector sólo se pinta cuando el valor guardado
  // es HH:MM (o no hay valor); si no, el campo se queda de TEXTO con su valor, como hasta hoy.
  // Lo exige `tests/scrum1175-horas-del-parte.test.mjs`. Sin tocar el esquema.
  // ═══════════════════════════════════════════════════════════════════════════════════════
  var HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

  /** ¿Cabe este valor en un selector de hora SIN perderse? Vacío sí: no hay nada que perder. */
  function cabeEnSelector(valor) {
    if (valor === null || valor === undefined || String(valor) === '') return true;
    return HH_MM.test(String(valor));
  }

  function minutosDelDia(valor) {
    var v = valor === null || valor === undefined ? '' : String(valor);
    if (!HH_MM.test(v)) return null;
    return Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
  }

  /** «3 h 30 min», «45 min», «2 h». */
  function enHorasYMinutos(minutos) {
    var h = Math.floor(minutos / 60);
    var m = minutos % 60;
    if (h && m) return h + ' h ' + m + ' min';
    if (h) return h + ' h';
    return m + ' min';
  }

  /**
   * La duración, o el aviso. Sólo con las DOS horas en HH:MM: de «8h» no se resta nada, y
   * adivinar qué quiso decir sería inventarse el dato. Salida igual a entrada no pinta nada: no
   * es «antes», y «0 min» en la obra no dice nada útil.
   *
   * El aviso sólo sale mientras se puede corregir: en un parte firmado no hay nada que revisar.
   */
  function pintarDuracion(entrada, salida, editable) {
    var a = minutosDelDia(entrada);
    var b = minutosDelDia(salida);
    if (a === null || b === null || a === b) return '';
    if (b > a) {
      return '<div class="parte-duracion">' +
        '<span class="parte-duracion-rotulo">' + esc(TEXTOS.tiempoEnLaObra) + '</span>' +
        '<b>' + esc(enHorasYMinutos(b - a)) + '</b></div>';
    }
    if (!editable) return '';
    return '<div class="parte-duracion parte-duracion-mal" role="status">' +
      '<span class="parte-duracion-rotulo">' + esc(TEXTOS.revisaLasHoras) + '</span>' +
      '<b>' + esc(TEXTOS.salidaAntesQueEntrada) + '</b></div>';
  }

  /** Entrada o salida: selector con «Ahora» si el valor cabe; si no, el campo de siempre. */
  function campoHora(rotulo, valor, nombre, editable) {
    if (!editable || !cabeEnSelector(valor)) return campo(rotulo, valor, nombre, editable);
    var v = valor === null || valor === undefined ? '' : String(valor);
    return (
      '<div class="parte-campo">' +
      '<label>' +
      '<span class="parte-campo-rotulo">' + esc(rotulo) + '</span>' +
      '<input type="time" data-parte-campo="' + esc(nombre) + '" value="' + esc(v) + '"></label>' +
      '<button type="button" class="parte-ahora" data-parte-ahora="' + esc(nombre) + '">' +
      esc(TEXTOS.ahora) + '</button></div>'
    );
  }

  function pintarHoras(parte, editable) {
    // La guía, SOLO si las dos son selector de verdad (condición de la firma, com. 17251).
    var sonSelector = editable && cabeEnSelector(parte.entrada) && cabeEnSelector(parte.salida);
    return (
      '<section class="parte-horas">' +
      '<h4 class="parte-horas-titulo">' + esc(TEXTOS.horasTitulo) + '</h4>' +
      (sonSelector ? '<p class="parte-horas-guia" data-parte-guia-horas="1">' + esc(TEXTOS.horasGuia) + '</p>' : '') +
      '<div class="parte-horas-par">' +
      campoHora(TEXTOS.entrada, parte.entrada, 'entrada', editable) +
      campoHora(TEXTOS.salida, parte.salida, 'salida', editable) +
      '</div>' +
      '<div data-parte-duracion="1" aria-live="polite">' +
      pintarDuracion(parte.entrada, parte.salida, editable) + '</div>' +
      '<div class="parte-horas-par">' +
      campo(TEXTOS.desplazamiento, parte.desplazamientos, 'desplazamientos', editable, 'number') +
      campo(TEXTOS.kilometros, parte.kilometros, 'kilometros', editable, 'number', TEXTOS.km) +
      '</div>' +
      '</section>'
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // SCRUM-1175 (916a, PR-C) · LOS DATOS DEL PARTE, RECOGIDOS AL FINAL.
  //
  // Obra, REF, técnicos, tipo y notas ocupaban la primera pantalla entera, todos antes que el
  // trabajo. Ahora van al final, cada uno en una línea que se abre (`<details>` nativo: teclado y
  // lector de pantalla gratis, sin JS para abrir). 🔴 SIN RETIRAR NI UN CAMPO: plegado no es
  // quitado. Cada campo sigue en el DOM con su `data-parte-campo` y su cable (lo exige el
  // inventario de `tests/scrum1175c-datos-del-parte-plegados.test.mjs`).
  //
  // El RESUMEN de cada línea se calcula aquí y se recalcula al escribir (`refrescarResumen`), con
  // la MISMA función: dos cálculos para el mismo dato acabarían diciendo cosas distintas.
  // ═══════════════════════════════════════════════════════════════════════════════════════
  var NOTAS_RESUMEN_MAX = 28;

  function resumenDe(clave, v) {
    if (clave === 'obra') {
      var partes = [v.obra, v.referencia].map(function (x) { return String(x == null ? '' : x).trim(); })
        .filter(Boolean);
      return partes.length ? partes.join(' · ') : TEXTOS.sinObraNiReferencia;
    }
    if (clave === 'tipo') return v.tipo && ETIQUETA_TIPO[v.tipo] ? ETIQUETA_TIPO[v.tipo] : TEXTOS.sinElegir;
    if (clave === 'tecnicos') {
      var t = String(v.tecnicos == null ? '' : v.tecnicos).trim();
      return t || TEXTOS.sinTecnicos;
    }
    if (clave === 'notas') {
      var n = String(v.notas == null ? '' : v.notas).trim();
      if (!n) return TEXTOS.sinNotas;
      return n.length > NOTAS_RESUMEN_MAX ? n.slice(0, NOTAS_RESUMEN_MAX) + '…' : n;
    }
    return '';
  }

  function plegable(clave, titulo, resumen, cuerpo) {
    return (
      '<details class="parte-plegable" data-parte-plegable="' + esc(clave) + '">' +
      '<summary class="parte-plegable-cabeza">' +
      '<span class="parte-plegable-titulo">' + esc(titulo) + '</span>' +
      '<span class="parte-plegable-resumen" data-parte-resumen="' + esc(clave) + '">' + esc(resumen) + '</span>' +
      '</summary>' +
      '<div class="parte-plegable-cuerpo">' + cuerpo + '</div>' +
      '</details>'
    );
  }

  function pintarDatosDelParte(parte, editable) {
    var tecnicos = (parte.tecnicos || []).join(', ');
    var valores = { obra: parte.obra, referencia: parte.referencia, tipo: parte.tipo, tecnicos: tecnicos, notas: parte.notas };
    return (
      '<section class="parte-datos-del-parte" data-parte-datos-del-parte="1">' +
      '<h4 class="parte-datos-del-parte-titulo">' + esc(TEXTOS.datosTitulo) + '</h4>' +
      plegable('obra', TEXTOS.obraYReferencia, resumenDe('obra', valores),
        '<div class="parte-datos">' +
        campo(TEXTOS.obra, parte.obra, 'obra', editable, null, null, TEXTOS.pistaObra) +
        campo(TEXTOS.referencia, parte.referencia, 'referencia', editable, null, null, TEXTOS.pistaReferencia) +
        '</div>') +
      plegable('tipo', TEXTOS.tituloTipo, resumenDe('tipo', valores), pintarTipo(parte.tipo, editable)) +
      // 🔴 EDITABLE, aunque venga PRELLENADO de los asignados del Trabajo (SCRUM-818): el parte es
      // la prueba de lo que PASÓ, y si el técnico lo cambia, eso es el dato.
      plegable('tecnicos', TEXTOS.tecnicos, resumenDe('tecnicos', valores),
        '<div class="parte-datos">' +
        campo(TEXTOS.tecnicos, tecnicos, 'tecnicos', editable, null, null, TEXTOS.pistaTecnicos) +
        '</div>') +
      plegable('notas', TEXTOS.notas, resumenDe('notas', valores),
        '<div class="parte-datos">' +
        campo(TEXTOS.notas, parte.notas, 'notas', editable, null, null, TEXTOS.pistaNotas) +
        '</div>') +
      '</section>'
    );
  }

  /**
   * Pinta el parte entero dentro de `contenedor`.
   *
   * Devuelve `false` y NO pinta si el parte viene sin líneas legibles: ver `lineasOCeguera`.
   */
  function renderParte(contenedor, parte) {
    var lineas = lineasOCeguera(parte);
    if (!contenedor || !parte || lineas === null) return false;

    var editable = !!(parte.puedeEditarContenido && parte.puedeEditarContenido.ok);

    contenedor.innerHTML =
      '<header style="margin-bottom:14px">' +
      '<h3 style="margin:0;font-size:1.05rem;font-weight:700;color:var(--ink)">' +
      esc(parte.numero) + '</h3>' +
      '<p style="margin:2px 0 0;font-size:13px;color:var(--muted)">' +
      esc(parte.clienteNombre || '') + '</p></header>' +
      // 🔴 SCRUM-818 · LOS SIETE SON CAMPOS DE VERDAD, medidos campo a campo en el PASO 0
      // ejecutando `permisoDeCampos`. Entrada, salida, desplazamiento y kilómetros viven en su
      // paso (SCRUM-1175 PR-A); obra, REF, técnicos, tipo y notas, plegados al final (PR-C).
      pintarHoras(parte, editable) +
      // El dictado solo tiene sentido mientras el contenido se pueda tocar: ofrecerlo en un parte
      // firmado sería enseñar un camino que el siguiente paso cierra con un 409.
      (editable ? pintarDictado() : '') +
      pintarBloque('mano_obra', lineas, editable) +
      pintarBloque('materiales', lineas, editable) +
      pintarLasDosFirmas(parte) +
      pintarDatosDelParte(parte, editable);

    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // SCRUM-683 · EL DICTADO. Un TEXTAREA, y nada más.
  //
  // 🔴 AQUÍ NO HAY API DE VOZ DEL NAVEGADOR, Y ES LA DECISIÓN ENTERA. El técnico dicta con el
  // MICRÓFONO DEL TECLADO DE SU MÓVIL: funciona en iPhone y Android, en todos los navegadores, es
  // gratis y **el audio no sale del teléfono**. `SpeechRecognition` haría lo contrario —mandar voz
  // de la obra, con el nombre del cliente y los detalles de su sistema de seguridad, a un
  // proveedor— y encima no funciona igual en todos los navegadores.
  //
  // Para este campo, «no hacer nada» ES la funcionalidad: un `<textarea>` normal ya tiene el micro
  // del teclado. A YaQu solo viaja TEXTO, y eso es lo que sostiene el argumento de protección de
  // datos con un cliente que instala sistemas de seguridad.
  //
  // 🔴 Y LO PROPUESTO SE PROPONE: nada de esto escribe en el parte. El técnico corrige, confirma,
  // y entonces se guarda por el camino de siempre.
  // ═══════════════════════════════════════════════════════════════════════════════════════

  /**
   * El campo del dictado: un TEXTAREA NORMAL. Ver el bloque de arriba — el micrófono lo pone el
   * teclado del móvil, no nosotros, y por eso aquí no hay nada que arrancar ni permiso que pedir.
   */
  function pintarDictado() {
    return '' +
      '<div data-parte-dictado="1" style="margin:12px 0">' +
      '<label for="parte-dictado" style="display:block;font-size:13px;color:var(--muted)">' +
      esc(TEXTOS.dictado) + '</label>' +
      '<textarea id="parte-dictado" data-dictado-texto="1" rows="3" style="width:100%"></textarea>' +
      '<p style="margin:4px 0 6px;font-size:12px;color:var(--muted)">' +
      esc(TEXTOS.pistaDictado) + '</p>' +
      '<button type="button" data-dictado-ordenar="1" style="width:100%">' +
      esc(TEXTOS.ordenarDictado) + '</button>' +
      // SCRUM-1302 (C) · el sitio del aviso de «no se ha podido ordenar»: bajo el botón y FUERA del
      // hueco de la propuesta, para poder decirlo sin pintar encima de lo que el técnico corrigió.
      '<div data-dictado-aviso="1"></div>' +
      '<div data-dictado-propuesta="1"></div></div>';
  }

  function avisoFaltaCantidad(texto) {
    return '<em data-falta-cantidad="1" style="font-size:12px;color:var(--muted);font-style:normal">' +
      esc(texto) + '</em>';
  }

  /**
   * SCRUM-1230 · el aviso «falta la cantidad» sigue a la línea COMO ESTÁ AHORA, no como nació.
   *
   * Antes sólo se pintaba si la propuesta llegaba sin cantidad. Si el técnico BORRABA a mano una
   * cantidad que sí venía, esa línea no entraba al confirmar (`lineasConfirmadas`) y no lo decía en
   * ningún sitio. Mismo texto del servidor, en la misma línea: se pone al quedarse sin cantidad y se
   * quita al ponérsela.
   */
  function sincronizarAvisosDeCantidad(caja, texto) {
    if (!caja || !caja.querySelectorAll || !texto) return;
    var filas = caja.querySelectorAll('[data-propuesta="1"]');
    Array.prototype.forEach.call(filas, function (fila) {
      var campo = fila.querySelector('[data-propuesta-unds="1"]');
      var unds = Number(campo && campo.value);
      var falta = !isFinite(unds) || unds <= 0;
      var aviso = fila.querySelector('[data-falta-cantidad]');
      if (falta && !aviso) {
        var descripcion = fila.querySelector('[data-propuesta-desc="1"]');
        if (descripcion && descripcion.insertAdjacentHTML) descripcion.insertAdjacentHTML('afterend', avisoFaltaCantidad(texto));
      } else if (!falta && aviso) {
        aviso.remove();
      }
    });
  }

  function pintarLineaPropuesta(linea, bloque, indice, avisos, inventado) {
    var sinCantidad = !(typeof linea.unds === 'number' && linea.unds > 0);
    // El aviso sale si el servidor señaló la línea, traiga o no la lista de tokens (SCRUM-725).
    var conInventado = !!(inventado && Object.prototype.hasOwnProperty.call(inventado, linea.descripcion));
    var marca = conInventado ? inventado[linea.descripcion] : [];
    return '' +
      '<li data-propuesta="1" data-bloque="' + esc(bloque) + '" data-indice="' + indice + '"' +
      // SCRUM-1266 · la marca VIAJA en la fila para que `lineasConfirmadas` la mande con la línea.
      // Separados por espacios: un token nace de partir la descripción por espacios, así que no lleva.
      (marca.length ? ' data-datos-no-respaldados="' + esc(marca.join(' ')) + '"' : '') +
      ' style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)">' +
      '<input type="number" step="any" min="0" data-propuesta-unds="1" ' +
      'value="' + (sinCantidad ? '' : esc(linea.unds)) + '" ' +
      'aria-label="' + esc(TEXTOS.unds) + '" style="width:72px">' +
      // SCRUM-1266 · la descripción se corrige AQUÍ, antes de que entre en el parte: era un texto de
      // sólo lectura y un dato inventado sólo se podía arreglar ya dentro, a un paso del congelado.
      // Mismo rótulo accesible que el campo de descripción de la tabla del parte.
      '<input type="text" data-propuesta-desc="1" value="' + esc(linea.descripcion) + '" ' +
      'aria-label="' + esc(TEXTOS.descripcion) + '" style="flex:1;min-width:160px;font-size:14px">' +
      // 🔴 La cantidad retirada NO desaparece: se dice, en la línea a la que le falta. Texto
      // APROBADO (regla 30) y en SINGULAR porque el aviso es de línea, no un resumen — viene del
      // servidor para no reteclearlo aquí.
      (sinCantidad ? avisoFaltaCantidad(avisos.cantidadesRetiradas) : '') +
      // 🔴 SCRUM-725 · EL DATO QUE EL DICTADO NO DICE, DICHO EN SU LÍNEA.
      //
      // El servidor ya sabe cuál sobra (`datosRetirados`) y hasta hoy la pantalla se lo callaba:
      // un mecanismo que detecta y no avisa es medio mecanismo. Va en la línea que lo lleva, no
      // como resumen, por lo mismo que su hermana de arriba — un aviso de cabecera no dice CUÁL.
      //
      // El texto viene del SERVIDOR (`avisos.datosRetirados`), no reteclado aquí: un texto
      // aprobado que se reescribe en cada pantalla deja de ser el aprobado sin que nadie lo decida.
      (conInventado
        ? '<em data-dato-inventado="1">' + esc(avisos.datosRetirados) + '</em>'
        : '') +
      (bloque === 'sinBloque' ? pintarColocar(indice) : '') +
      '</li>';
  }

  /**
   * 🔴 SCRUM-1230 · LO QUE LA MÁQUINA NO SUPO COLOCAR, LO COLOCA EL TÉCNICO — AQUÍ, EN SU LÍNEA.
   *
   * El grupo se rotula «Sin colocar — elige mano de obra o materiales», y hasta hoy la línea no
   * tenía con qué elegir: `lineasConfirmadas` la descartaba al confirmar y lo dictado se perdía sin
   * aviso. Son las mismas fichas del tipo de intervención (`.parte-tipo-ficha`, 48 px, ya con su CSS)
   * y los mismos dos rótulos de los bloques: ni un texto ni una clase nuevos.
   */
  function pintarColocar(indice) {
    return (
      '<div class="parte-tipo" role="radiogroup" data-colocar-linea="' + indice + '" style="flex-basis:100%;margin:0">' +
      BLOQUES.map(function (b) {
        return (
          '<label class="parte-tipo-ficha">' +
          '<input type="radio" name="parte-colocar-' + indice + '" value="' + esc(b) + '" data-colocar="1">' +
          esc(ETIQUETA_BLOQUE[b]) + '</label>'
        );
      }).join('') +
      '</div>'
    );
  }

  /** El bloque que el técnico eligió para una línea «Sin colocar», o null si aún no eligió. */
  function bloqueElegido(fila) {
    var opciones = fila.querySelectorAll ? fila.querySelectorAll('[data-colocar]') : [];
    for (var i = 0; i < opciones.length; i++) {
      if (opciones[i].checked && BLOQUES.indexOf(opciones[i].value) !== -1) return opciones[i].value;
    }
    return null;
  }

  /** Cuántas líneas «Sin colocar» siguen sin bloque elegido. Con alguna, no se confirma. */
  function lineasSinColocar(caja) {
    if (!caja || !caja.querySelectorAll) return 0;
    var filas = caja.querySelectorAll('[data-propuesta="1"][data-bloque="sinBloque"]');
    var n = 0;
    Array.prototype.forEach.call(filas, function (fila) { if (!bloqueElegido(fila)) n += 1; });
    return n;
  }

  /** Lo que el servidor dice de una propuesta vacía, por SU motivo. La vista no elige el texto. */
  function textoDePropuestaVacia(respuesta) {
    var avisos = (respuesta && respuesta.avisos) || {};
    var motivo = respuesta && respuesta.propuesta && respuesta.propuesta.motivo;
    return avisos[motivo] || avisos.sin_lineas_reconocidas || '';
  }

  /**
   * Pinta la propuesta del dictado. Devuelve `false` si no hay nada que pintar, y entonces el
   * llamador enseña el motivo — que llega resuelto del servidor, no se decide aquí.
   */
  function pintarPropuesta(contenedor, respuesta) {
    if (!contenedor || !respuesta || !respuesta.propuesta) return false;
    var p = respuesta.propuesta;
    var avisos = respuesta.avisos || {};

    // 🔴 SUELO: propuesta vacía → el parte se queda EN BLANCO Y SE DICE. No se rellena con nada.
    if (p.vacia) {
      contenedor.innerHTML = '<p data-propuesta-vacia="1" style="font-size:14px;color:var(--muted)">' +
        esc(textoDePropuestaVacia(respuesta)) + '</p>';
      return false;
    }

    // Qué líneas llevan un dato que el dictado no respalda, y CUÁLES. Se arma UNA vez, no por línea.
    var inventado = {};
    (p.datosRetirados || []).forEach(function (d) {
      if (d && d.descripcion) inventado[d.descripcion] = Array.isArray(d.tokens) ? d.tokens : [];
    });

    var bloques = BLOQUES.map(function (b) {
      var suyas = (p[b] || []).map(function (l, i) { return pintarLineaPropuesta(l, b, i, avisos, inventado); });
      if (!suyas.length) return '';
      return '<h4 style="margin:12px 0 4px;font-size:13px;color:var(--muted)">' +
        esc(ETIQUETA_BLOQUE[b]) + '</h4><ul style="list-style:none;margin:0;padding:0">' +
        suyas.join('') + '</ul>';
    }).join('');

    // Lo que el modelo no supo colocar tampoco se tira: se propone aparte para que él lo coloque.
    var sueltas = (p.sinBloque || []).map(function (l, i) {
      return pintarLineaPropuesta(l, 'sinBloque', i, avisos, inventado);
    });
    var resto = sueltas.length
      ? '<h4 style="margin:12px 0 4px;font-size:13px;color:var(--muted)">' +
        esc(TEXTOS.sinBloque) + '</h4><ul style="list-style:none;margin:0;padding:0">' +
        sueltas.join('') + '</ul>'
      : '';

    contenedor.innerHTML = bloques + resto +
      // El texto del aviso de cantidad viaja en el botón para que `sincronizarAvisosDeCantidad`
      // pinte EL DEL SERVIDOR cuando el técnico vacía una cantidad, sin reteclearlo aquí.
      '<button type="button" data-propuesta-confirmar="1" data-aviso-cantidad="' +
      esc(avisos.cantidadesRetiradas || '') + '" style="width:100%;margin-top:10px">' +
      esc(TEXTOS.confirmarPropuesta) + '</button>';
    return true;
  }

  /**
   * Lo que el técnico ha confirmado, leído de la pantalla.
   *
   * 🔴 Se lee de los CAMPOS, no de la propuesta que vino del servidor: si se leyera de la
   * propuesta, corregir una cantidad en pantalla no cambiaría nada y se guardaría lo que dijo la
   * máquina. Y una línea a la que el técnico no le haya puesto cantidad NO SALE: `aLineaDelParte`
   * la rechazaría igual en el servidor, pero decírselo aquí le ahorra el viaje.
   */
  function lineasConfirmadas(contenedor) {
    if (!contenedor) return { lineas: [], sinCantidad: 0 };
    var filas = contenedor.querySelectorAll('[data-propuesta="1"]');
    var lineas = [];
    var sinCantidad = 0;
    Array.prototype.forEach.call(filas, function (fila) {
      var campoUnds = fila.querySelector('[data-propuesta-unds="1"]');
      // SCRUM-1266 · la descripción es un CAMPO: se guarda lo que el técnico dejó escrito, no lo
      // que dijo la máquina. Vacía no se descarta aquí: el servidor la rechaza con su motivo, que es
      // mejor que perder la línea en silencio.
      var descripcion = String((fila.querySelector('[data-propuesta-desc="1"]') || {}).value || '').trim();
      var unds = Number(campoUnds && campoUnds.value);
      var bloque = fila.getAttribute('data-bloque');
      // SCRUM-1230 · la línea «Sin colocar» entra en el bloque que el técnico eligió en ella.
      if (bloque === 'sinBloque') bloque = bloqueElegido(fila) || bloque;
      if (!isFinite(unds) || unds <= 0) { sinCantidad += 1; return; }
      // `sinBloque` no es un bloque del dominio: sin decidirlo el técnico, esa línea no entra. Y no
      // se llega aquí en silencio: con una sin colocar, confirmar está bloqueado (`lineasSinColocar`).
      if (BLOQUES.indexOf(bloque) === -1) { sinCantidad += 1; return; }
      var linea = { bloque: bloque, unds: unds, descripcion: descripcion };
      // SCRUM-1266 · la marca del dato inventado ENTRA con la línea, y sólo lo que siga escrito.
      var marca = marcaQueSigue(descripcion, marcaDeLaFila(fila));
      if (marca.length) linea.datosNoRespaldados = marca;
      lineas.push(linea);
    });
    return { lineas: lineas, sinCantidad: sinCantidad };
  }

  /** Los tokens que el servidor marcó en esta fila de la propuesta (SCRUM-725), o []. */
  function marcaDeLaFila(fila) {
    var crudo = fila && fila.getAttribute ? fila.getAttribute('data-datos-no-respaldados') : null;
    return crudo ? String(crudo).split(/\s+/).filter(Boolean) : [];
  }

  /**
   * SCRUM-1266 · de los tokens marcados, los que SIGUEN en la descripción. Mismo corte que el
   * servidor (`marcaQueSigue` en `parteTrabajo.ts`) y que el saneador del dictado: palabras separadas
   * por espacios, sin la puntuación de los extremos. Corregir el dato quita la marca; dejarlo, no.
   */
  function marcaQueSigue(descripcion, tokens) {
    if (!Array.isArray(tokens)) return [];
    var limpiar = function (s) { return String(s).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''); };
    var palabras = String(descripcion || '').split(/\s+/).map(limpiar).filter(Boolean);
    var quedan = [];
    tokens.forEach(function (t) {
      if (typeof t !== 'string') return;
      var limpio = limpiar(t.trim());
      if (limpio && palabras.indexOf(limpio) !== -1 && quedan.indexOf(limpio) === -1) quedan.push(limpio);
    });
    return quedan;
  }

  /**
   * SCRUM-1266 · el aviso del dato inventado sigue al estado ACTUAL de la descripción, como el de la
   * cantidad (SCRUM-1230): si el técnico quita el dato, el aviso se oculta; si lo vuelve a escribir,
   * vuelve. Es el mismo texto aprobado de SCRUM-725, que ya estaba pintado: ni un texto nuevo.
   */
  function sincronizarAvisosDeDatos(caja) {
    if (!caja || !caja.querySelectorAll) return;
    var filas = caja.querySelectorAll('[data-propuesta="1"][data-datos-no-respaldados]');
    Array.prototype.forEach.call(filas, function (fila) {
      var aviso = fila.querySelector('[data-dato-inventado]');
      if (!aviso) return;
      var desc = (fila.querySelector('[data-propuesta-desc="1"]') || {}).value || '';
      aviso.hidden = marcaQueSigue(desc, marcaDeLaFila(fila)).length === 0;
    });
  }

  /**
   * Manda el dictado a `/admin/partes/:id/dictado` y pinta lo que vuelva.
   *
   * 🔴 NO GUARDA NADA. La ruta tampoco: devuelve una propuesta. Lo que escribe en el parte es el
   * `PATCH` de siempre, y solo cuando el técnico le da a confirmar.
   *
   * 🔴 Y SI FALLA, NO BLOQUEA: se pinta el aviso y el técnico sigue escribiendo a mano. El dictado
   * del teclado de su móvil funciona sin nosotros; ordenar es el extra que puede faltar.
   *
   * 🔴 SCRUM-1302 (C) · Y SI FALLA, NO BORRA. Un intento que no sale pintaba una propuesta vacía
   * encima de la que hubiera: tres líneas, una corregida a mano, y un 500 se las llevaba sin una
   * palabra (medido en yaqu.app, c.18486). Aquí no se toca el hueco de la propuesta: lo que el
   * técnico tenía sigue ahí. Tres salidas, firmadas en c.18491:
   *   · no llega o 5xx → el aviso, en su sitio bajo el botón. Repetir puede funcionar: el dictado
   *     sigue escrito en su casilla;
   *   · 409 y 404 → se relee el parte, como hace un campo que no se guarda. Ahí repetir no va a
   *     funcionar nunca: la ficha sale firmada, o dice que no se ha podido cargar;
   *   · cualquier otro rechazo → nada. No hay texto firmado para él y el de arriba no se estira.
   *
   * 🔴 SCRUM-1493 · Y SI CONTESTA SIN LÍNEAS, TAMPOCO: un 200 con la propuesta vacía (la IA caída)
   * no es un fallo de la petición, y con una propuesta en pantalla se dice arriba sin tocarla.
   */
  async function ordenarElDictado(parte, contenedor, opciones) {
    var o = opciones || {};
    var pedir = o.apiRequest || window.apiRequest;
    var destino = contenedor && contenedor.querySelector('[data-dictado-propuesta="1"]');
    var campo = contenedor && contenedor.querySelector('[data-dictado-texto="1"]');
    if (typeof pedir !== 'function' || !destino || !campo) return false;

    var dictado = String(campo.value || '').trim();
    var respuesta;
    try {
      respuesta = await pedir('/admin/partes/' + parte.id + '/dictado', {
        method: 'POST',
        body: JSON.stringify({ dictado: dictado }),
      });
    } catch (e) {
      var codigo = e && e.status;
      if (codigo === 409 || codigo === 404) {
        await renderParteDetailView(contenedor, parte.id, o);
        return false;
      }
      if (!codigo || codigo >= 500) avisarEnElDictado(contenedor, 'data-dictado-no-ordenado', TEXTOS.noSePudoOrdenar);
      return false;
    }
    // 🔴 SCRUM-1493 · Y SI CONTESTA «NINGUNA LÍNEA», TAMPOCO BORRA. Con la IA caída la ruta contesta
    // 200 con la propuesta vacía (a propósito), y eso NO es un fallo de la petición: no pasaba por el
    // `catch` de arriba y se pintaba vacía encima de la que el técnico estaba corrigiendo. Con una
    // propuesta en pantalla el hueco no se toca, y lo que manda el servidor se dice en el sitio del
    // aviso. Sin propuesta que proteger, todo sigue como siempre (`pintarPropuesta`).
    var vacia = !!(respuesta && respuesta.propuesta && respuesta.propuesta.vacia);
    if (vacia && destino.querySelector('[data-propuesta-confirmar]')) {
      avisarEnElDictado(contenedor, 'data-dictado-sin-lineas', textoDePropuestaVacia(respuesta));
      return false;
    }
    // Contestó: lo que hubiera que decir del intento anterior ya no es verdad.
    quitarAvisoDelDictado(contenedor);
    return pintarPropuesta(destino, respuesta);
  }

  /** SCRUM-1493 · en el sitio del aviso del dictado hay UNO, el del último intento: se vacía entero. */
  function quitarAvisoDelDictado(contenedor) {
    var sitio = contenedor.querySelector && contenedor.querySelector('[data-dictado-aviso]');
    var previos = sitio && sitio.children ? Array.prototype.slice.call(sitio.children) : [];
    previos.forEach(function (previo) { if (previo.remove) previo.remove(); });
  }

  /**
   * Un aviso del dictado, en su sitio (bajo el botón de ordenar, FUERA del hueco de la propuesta) y
   * traído a la vista (como SCRUM-1475). `marca` dice cuál es: `data-dictado-no-ordenado` (SCRUM-1302
   * C), `data-dictado-no-guardado` o `data-dictado-sin-lineas` (SCRUM-1493). Sustituye al que hubiera.
   */
  function avisarEnElDictado(contenedor, marca, texto) {
    var sitio = contenedor.querySelector && contenedor.querySelector('[data-dictado-aviso]');
    // Sin sitio donde colgarlo no se cuelga, y no se lanza: ordenar es un extra y su aviso también.
    if (!sitio || !sitio.appendChild) return;
    quitarAvisoDelDictado(contenedor);
    // Sin texto que decir no se cuelga una caja vacía: un `role="alert"` en blanco no dice nada.
    if (!texto) return;
    var aviso = document.createElement('div');
    aviso.className = 'alert error';
    aviso.setAttribute('role', 'alert');
    aviso.setAttribute(marca, '1');
    aviso.style.marginTop = '8px';
    aviso.textContent = texto;
    sitio.appendChild(aviso);
    if (aviso.scrollIntoView) aviso.scrollIntoView({ block: 'nearest' });
  }

  /**
   * 🔴 LOS DOS RECUADROS DEL PAPEL: «FIRMA CLIENTE» y «FIRMA TÉCNICO».
   *
   * Se pintan **los dos SIEMPRE**, igual que los dos bloques de líneas y por el mismo motivo: el
   * impreso los lleva impresos aunque falte uno, y esconder el que falta haría que «no ha firmado
   * todavía» se viera igual que «esta pantalla no tiene esa firma».
   *
   * Cada uno es un botón si su ranura está libre, y un texto si ya se firmó. **El orden no se
   * exige** (`ordenDeFirmaExigido()` en el dominio): en la obra firma quien esté libre primero.
   */
  function pintarLasDosFirmas(parte) {
    var recuadro = function (firmado, marca, rotulo, hecho, quien) {
      return firmado
        ? '<p data-parte-' + marca + '-hecha="1" style="margin:0;font-size:14px;color:var(--muted)">' +
          esc(hecho) + (quien ? ' ' + esc(quien) : '') + '</p>'
        : '<button type="button" data-parte-' + marca + '="1" style="width:100%">' +
          esc(rotulo) + '</button>';
    };
    // SCRUM-1175 (PR-B) · UN PASO PROPIO Y UNA CAJA POR FIRMA. Cada aviso «falta» vive DENTRO de la
    // caja de su firma, así el botón «Firmar aquí mismo» —que no dice de quién es— queda al lado del
    // texto que sí lo dice. Mismos botones, mismos atributos y mismo camino de firma: la cola sin
    // conexión (SCRUM-890/919) no se toca.
    return (
      '<section data-parte-firmas="1" class="parte-firmas">' +
      '<h4 class="parte-firmas-titulo">' + esc(TEXTOS.firmasTitulo) + '</h4>' +
      // SCRUM-653 c.17354 · el paso irreversible se enseña ANTES de darlo, y solo entonces.
      (!parte.firmoElCliente && !parte.firmoElTecnico
        ? '<p data-parte-primera-firma-fija="1" style="margin:0 0 8px;font-size:13px;color:var(--muted)">' +
          esc(TEXTOS.conLaPrimeraFirmaQuedaFijo) + '</p>'
        : '') +
      '<div class="parte-firma-caja" data-parte-caja-firma="cliente">' +
      recuadro(parte.firmoElCliente, 'firmar', TEXTOS.firmar, TEXTOS.yaFirmoElCliente, parte.firmadoPorNombre) +
      // 🔴 EL AVISO NOMBRA LA QUE FALTA, y si faltan las dos se dicen las dos: fundir ambas en
      // «falta una firma» era exactamente el defecto — el técnico tendría que adivinar cuál.
      (!parte.firmoElCliente
        ? '<p data-parte-falta-firma="cliente" style="margin:8px 0 0;font-size:13px;color:var(--muted)">' +
          esc(TEXTOS.faltaLaFirmaDelCliente) + '</p>'
        : '') +
      '</div>' +
      '<div class="parte-firma-caja" data-parte-caja-firma="tecnico">' +
      recuadro(parte.firmoElTecnico, 'firmar-tecnico', TEXTOS.firmarTecnico, TEXTOS.yaFirmoElTecnico, parte.firmadoTecnicoNombre) +
      (!parte.firmoElTecnico
        ? '<p data-parte-falta-firma="tecnico" style="margin:8px 0 0;font-size:13px;color:var(--muted)">' +
          esc(TEXTOS.faltaLaFirmaDelTecnico) + '</p>'
        : '') +
      '</div>' +
      '</section>'
    );
  }

  /**
   * Abre el pad de firma y firma CON LA RED DE SEGURIDAD QUE YA EXISTE.
   *
   * 🔴 No se construye una segunda cola: es `firmarConRedDeSeguridad` (`colaDeFirmas.js`), la
   * misma del albarán, con un cuarto argumento que dice de qué documento es la firma. Sin ese
   * argumento la cola seguiría subiendo todo a `/admin/albaranes/:id/firmar`, que es donde este
   * parte no está.
   *
   * Lo que ve el firmante se arma AQUÍ y sin importes: descripción y unidades, que es lo que la
   * pantalla tiene. El pad no se toca — recibe la forma que ya sabía pintar.
   */
  /**
   * `quien` es 'cliente' o 'tecnico'. Una sola función y no dos: lo único que cambia es la ruta, el
   * tipo con el que se encola y qué campo lleva el nombre. Duplicarla habría duplicado también el
   * cuidado de SCRUM-404 (que el error SUBA para que el trazo siga en pantalla), y esa clase de
   * copia se separa en cuanto una de las dos se toca.
   */
  var FIRMAS = {
    cliente: { tipo: 'parte', ruta: function (id) { return '/admin/partes/' + id + '/firmar'; } },
    tecnico: { tipo: 'parte-tecnico', ruta: function (id) { return '/admin/partes/' + id + '/firmar-tecnico'; } },
  };

  /**
   * El mensaje de fallo al firmar es EL DEL ALBARÁN (`mensajeDeFalloAlFirmar`, en
   * `albaranDetailView.js`, que `index.html` carga antes que este fichero). No se copia: dos copias
   * de un literal se separan en cuanto se toca una. Si no estuviera cargado, el pad pone su aviso por
   * defecto — que tampoco cierra.
   */
  function mensajeDelAlbaran(e, estado) {
    return typeof window.mensajeDeFalloAlFirmar === 'function' ? window.mensajeDeFalloAlFirmar(e, estado) : '';
  }

  function firmarParte(parte, opciones, quien) {
    var o = opciones || {};
    var cual = FIRMAS[quien || 'cliente'];
    var abrirPad = o.abrirPad || window.openSignaturePad;
    var firmar = o.firmar || window.firmarConRedDeSeguridad;
    var pedir = o.apiRequest || window.apiRequest;
    if (typeof abrirPad !== 'function' || typeof firmar !== 'function') return false;

    var lineas = lineasOCeguera(parte);
    if (lineas === null) return false;

    // 🔴 SCRUM-890 · UN PARTE VACÍO NO ABRE EL PAD. El servidor lo rechaza seguro (409
    // `parte_vacio`), así que abrirlo era pedirle al cliente que firmara delante del profesional
    // para nada. Se dice por qué y qué hacer, junto al botón.
    if (lineas.length === 0) {
      if (typeof o.avisar === 'function') o.avisar(TEXTOS.parteVacioNoSeFirma);
      return false;
    }

    // 🔴 SCRUM-1229 · CUANDO FIRMA EL TÉCNICO, EL PAD NO ES EL DEL CLIENTE. Medido ejecutando la
    // vista: le decía «Pide al cliente que firme…», le ofrecía el «en calidad de qué» (que SCRUM-653
    // c.14494 le quitó a propósito) y mandaba su nombre en el campo del CLIENTE → 400 siempre.
    var esTecnico = quien === 'tecnico';
    abrirPad({
      title: esTecnico ? TEXTOS.firmarTecnico : TEXTOS.tituloFirma,
      // Cada uno lee la suya: la del cliente habla del cliente, y la del técnico (SCRUM-1215
      // c.18205) no nombra a nadie.
      hint: esTecnico ? TEXTOS.pistaFirmaTecnico : TEXTOS.pistaFirma,
      // SCRUM-919 · la ayuda bajo el nombre del firmante es la DEL PARTE (servida por /admin/me), no la del albarán.
      ayudas: window.appParteAyudas || null,
      // Mismo contrato que el albarán: {cliente, fecha, lugar, lineas:[{concepto,cantidad,unidad}]}.
      // `unidad` lleva la ETIQUETA DEL BLOQUE, que es lo que distingue una hora de un material en
      // el papel. Y no hay ni un campo de dinero que mapear, porque no hay ninguno que traer.
      albaran: {
        cliente: parte.clienteNombre || '',
        fecha: parte.fecha ? new Date(parte.fecha).toLocaleDateString('es-ES') : '',
        lugar: parte.obra || '',
        lineas: lineas.map(function (l) {
          return { concepto: l && l.descripcion, cantidad: l && l.unds, unidad: ETIQUETA_BLOQUE[l && l.bloque] };
        }),
      },
      firmante: esTecnico
        ? { sugerencia: '', sinCalidad: true }
        : { sugerencia: parte.clienteNombre || '' },
      onConfirm: async function (dataUri, declaracion) {
        // El pad declara siempre `firmadoPorNombre`; cada ruta lee SU campo (`partes.routes.ts`:
        // `/firmar` → `firmadoPorNombre`, `/firmar-tecnico` → `firmadoTecnicoNombre`). Se traduce
        // AQUÍ, en quien llama: el servidor no aprende a aceptar dos nombres para lo mismo.
        var cuerpo = esTecnico
          ? { signatureData: dataUri, firmadoTecnicoNombre: (declaracion && declaracion.firmadoPorNombre) || '' }
          : Object.assign({ signatureData: dataUri }, declaracion || {});
        // El error SUBE (SCRUM-404): el pad no cierra hasta que esto resuelve, así que un fallo
        // deja el trazo en pantalla y se reintenta sin pedirle al cliente que firme otra vez.
        var r;
        try {
          r = await firmar(parte.id, cuerpo, function () {
            return pedir(cual.ruta(parte.id), { method: 'POST', body: JSON.stringify(cuerpo) });
          }, cual.tipo);
        } catch (e) {
          throw new Error(mensajeDelAlbaran(e));
        }
        // 🔴 SCRUM-890 · UN RECHAZO SUBE. `firmar` lo devuelve DENTRO del resultado y el pad sólo
        // avisa si esto lanza: sin el `throw` se cerraba como si el cliente hubiera firmado. La
        // pantalla traía líneas y el servidor ya no (las quitó la oficina): el 409 llega aquí, y
        // se repinta porque el servidor SÍ ha dicho algo nuevo del parte.
        if (r && r.rechazada) {
          if (typeof o.alFirmar === 'function') { try { await o.alFirmar(); } catch (_e) {} }
          var codigo = r.error && r.error.code;
          throw new Error(codigo === 'parte_vacio' ? TEXTOS.parteVacioNoSeFirma : ((r.error && r.error.message) || ''));
        }
        // 🔴 SCRUM-890 (PR 2) · SIN ③ EL PAD NO SE CIERRA, igual que el albarán (SCRUM-358). Sin red
        // la firma está en la cola, pero cerrar en silencio deja al profesional creyendo que subió.
        // Se relanza el MISMO mensaje y NO se repinta: sin red, pedir el parte fallaría y taparía la
        // pantalla con «no se pudo cargar» detrás del pad.
        if (!r || r.estado !== window.FIRMA_A_SALVO) {
          throw new Error(mensajeDelAlbaran(r && r.error, { encolada: !!(r && r.encolada) }));
        }
        // Confirmada: se repinta con lo que dice el SERVIDOR.
        if (typeof o.alFirmar === 'function') { try { await o.alFirmar(); } catch (_e) {} }
        return r;
      },
      // SCRUM-1422 · el pad avisa al cerrarse, por el camino que sea (contrato en
      // `docs/master/SCRUM-1420.md`). Viaja en el mismo objeto, así que le llega igual al pad
      // inyectado. Si no es una función, el pad lo ignora.
      onClose: o.alCerrarElPad,
    });
    return true;
  }

  /**
   * 🔴 LA PIEZA QUE FALTABA, Y NO ERA SÓLO LA PUERTA.
   *
   * `renderParte` pinta un parte que alguien ya trajo, y `firmarParte` firma uno que alguien ya
   * tiene. **Entre el botón que se pintaba y la función que firma no había NADA**: `renderParte`
   * escribía `data-parte-firmar` en el marcado y este fichero no tenía ni un `addEventListener`.
   * O sea que el botón estaba pintado y MUERTO, y eso no se ve en un test que mire el marcado.
   *
   * Esto es lo que `app.js` llama: trae el parte de `/admin/partes/:id`, lo pinta, y engancha el
   * botón a `firmarParte`. Tras firmar, **vuelve a traerlo del servidor** en vez de retocar el
   * objeto en memoria: el estado, el sello y los dos candados los decide el servidor, y una
   * pantalla que se los inventa acaba enseñando algo que la base no dice.
   *
   * `opciones` existe para el banco de pruebas (`apiRequest`, `firmar`, `abrirPad`); en producción
   * no se le pasa nada.
   */
  /**
   * 🔴 LO QUE EL TÉCNICO CONFIRMA ENTRA EN EL PARTE. Y NADA MÁS.
   *
   * Las líneas se leen de los CAMPOS de la pantalla (`lineasConfirmadas`), no de la propuesta que
   * vino del servidor: si se leyeran de la propuesta, corregir una cantidad no cambiaría nada y se
   * guardaría lo que dijo la máquina. Y una línea a la que él no le haya puesto cantidad NO SALE.
   *
   * ⚠️ Se MANDAN LAS QUE YA HABÍA MÁS LAS NUEVAS: el `PATCH` reemplaza la lista entera, así que
   * enviar sólo las nuevas borraría en silencio lo que el técnico ya tenía apuntado.
   *
   * ⛔ NI UN IMPORTE, en ninguna dirección: lo que viaja es {id, bloque, unds, descripcion}, que es lo
   * único que esta pantalla tiene. Los precios los pone la oficina, en otra pantalla.
   */
  async function confirmarLoDictado(parte, parteId, contenedor, opciones) {
    var o = opciones || {};
    var pedir = o.apiRequest || window.apiRequest;
    if (typeof pedir !== 'function') return false;

    var caja = contenedor.querySelector && contenedor.querySelector('[data-dictado-propuesta]');
    // SCRUM-1230 · con una línea «Sin colocar» sin decidir NO se guarda: el `PATCH` la dejaría
    // fuera y lo dictado se perdería. El botón ya está bloqueado; esto es el respaldo.
    if (lineasSinColocar(caja) > 0) return false;
    var confirmadas = lineasConfirmadas(caja);
    if (!confirmadas.lineas.length) return false;   // nada que añadir: no se manda una petición vacía

    try {
      // SCRUM-1266 · en su turno: lo que ya había se lee DESPUÉS de que vuelva el guardado anterior.
      await enOrdenDelParte(parte, function () {
        var yaHabia = (Array.isArray(parte.lineas) ? parte.lineas : []).map(lineaQueSeGuarda);
        return pedir('/admin/partes/' + parteId, {
          method: 'PATCH',
          body: JSON.stringify({ lineas: yaHabia.concat(confirmadas.lineas) }),
        });
      });
    } catch (e) {
      // Si no se pudo guardar NO se repinta como si sí: el técnico creería que ya está apuntado.
      // 🔴 SCRUM-1493 · Y TAMPOCO SE PINTA ENCIMA DE LA PROPUESTA. El aviso se escribía DENTRO del
      // hueco: se llevaba las líneas, lo corregido a mano y el botón, y decía «vuelve a intentarlo»
      // sin dejar con qué (medido en yaqu.app el 6-oct). Va al sitio del aviso, y la propuesta se
      // queda: el segundo toque es el mismo botón, que ya tiene su escucha.
      avisarEnElDictado(contenedor, 'data-dictado-no-guardado', TEXTOS.noSeGuardo);
      return false;
    }

    // Se vuelve a traer del servidor en vez de retocar la pantalla: lo que se enseña es lo que
    // quedó guardado, no lo que creemos que mandamos. Mismo criterio que tras firmar.
    await renderParteDetailView(contenedor, parteId, o);
    return true;
  }

  /**
   * 🔴 SCRUM-890 (PR 2) · UNA FIRMA ENCOLADA QUE EL SERVIDOR RECHAZÓ AL VACIAR LA COLA, DICHO AQUÍ.
   *
   * El vaciado corre al abrir la app y nadie mira su resultado; la firma ya no está en la cola. Lo
   * que queda es la constancia por documento que deja `colaDeFirmas.js` en localStorage, y que se borra
   * cuando ese recuadro se vuelve a firmar con éxito.
   *
   * Sólo cuenta un recuadro SIN firmar: si el servidor dice que ya está firmado, el rechazo es viejo
   * y no pide nada. Si no se puede leer el almacén no se pinta nada — no hay qué afirmar. Un solo
   * aviso: el del cliente va primero y el del técnico sale cuando ése se resuelva.
   */
  async function avisarDeUnRechazo(parte, avisar) {
    if (typeof window.leerRechazosDeFirma !== 'function') return;
    var r;
    try { r = await window.leerRechazosDeFirma(); } catch (_e) { return; }
    if (!r || r.estado !== window.GUARDADO || !Array.isArray(r.rechazos)) return;
    var sinFirmar = [];
    if (!parte.firmoElCliente) sinFirmar.push(FIRMAS.cliente.tipo);
    if (!parte.firmoElTecnico) sinFirmar.push(FIRMAS.tecnico.tipo);
    for (var i = 0; i < sinFirmar.length; i++) {
      var clave = 'firma:' + sinFirmar[i] + ':' + String(parte.id);
      for (var j = 0; j < r.rechazos.length; j++) {
        if (r.rechazos[j] && r.rechazos[j].clave === clave) {
          avisar(r.rechazos[j].codigo === 'parte_vacio' ? TEXTOS.parteVacioNoSeFirma : TEXTOS.firmaRechazada);
          return;
        }
      }
    }
  }

  function quitarAvisoDeCampoNoGuardado(contenedor, nombre) {
    var previo = contenedor.querySelector &&
      contenedor.querySelector('[data-parte-campo-no-guardado="' + nombre + '"]');
    if (previo && previo.remove) previo.remove();
  }

  /**
   * SCRUM-1302 (B) · el aviso de UN campo de la cabecera que no se guardó, sobre la ficha ya
   * repintada desde el servidor. Va en el paso de ese campo —las horas, o su línea plegada, que
   * se abre— y no arriba: el dato que ha vuelto atrás está ahí. Si la relectura también falló ya
   * no hay casilla, y la ficha dice entera que no se ha podido cargar: no se añade nada.
   *
   * 🔴 SCRUM-1475 · Y SE TRAE A LA VISTA. Colgarlo no basta: con el campo al borde inferior de la
   * ventana el aviso caía casi fuera (medido en yaqu.app: asomaban 13 px en móvil y 5 en
   * escritorio). `nearest` y no `start`: si ya se ve entero la página no se mueve, y si no, se mueve
   * lo justo. Va DESPUÉS de colgarlo y de abrir su línea, que antes no hay nada que traer. Que no
   * acabe bajo el botón de ayuda ni bajo la cabecera fija lo pone la reserva de la página
   * (`scroll-padding` de `html`, SCRUM-1464): las dos mitades van juntas.
   *
   * SCRUM-1491 · `fallo` es el error del `PATCH`. El texto sólo cambia si la ruta dijo
   * `desplazamientos_invalido`: se decide por el CÓDIGO (`err.code`, lo pone `apiRequest`), nunca
   * por el mensaje. Cualquier otro fallo —500, sin red— sigue con el general.
   */
  function avisarCampoNoGuardado(contenedor, nombre, fallo) {
    if (!contenedor || !contenedor.querySelector) return;
    var casilla = contenedor.querySelector(nombre === 'tipo'
      ? 'input[name="parte-tipo"]' : '[data-parte-campo="' + nombre + '"]');
    if (!casilla || !casilla.closest) return;
    var linea = casilla.closest('[data-parte-plegable]');
    if (linea) linea.setAttribute('open', '');
    var paso = linea ? linea.querySelector('.parte-plegable-cuerpo') : casilla.closest('.parte-horas');
    if (!paso) return;
    quitarAvisoDeCampoNoGuardado(contenedor, nombre);
    var texto = textoDeCampoNoGuardado(nombre, fallo);
    if (!texto) return;   // sin texto que decir no se cuelga una caja en blanco
    var aviso = document.createElement('div');
    aviso.className = 'alert error';
    aviso.setAttribute('role', 'alert');
    aviso.setAttribute('data-parte-campo-no-guardado', nombre);
    aviso.style.marginTop = '8px';
    aviso.textContent = texto;
    paso.appendChild(aviso);
    if (aviso.scrollIntoView) aviso.scrollIntoView({ block: 'nearest' });
  }

  /**
   * SCRUM-1492 · qué se dice cuando lo tecleado en una casilla numérica NO ES UN NÚMERO. Una
   * entrada por casilla numérica de la cabecera: una casilla numérica sin la suya no tendría qué
   * decir, y el general («No se ha podido guardar el cambio») ahí sería falso.
   */
  var TEXTO_SI_NO_ES_UN_NUMERO = {
    desplazamientos: TEXTOS.desplazamientoEsEntero,
    kilometros: TEXTOS.kilometrosEsUnNumero,
  };

  function textoDeCampoNoGuardado(nombre, fallo) {
    if (fallo && fallo.noEsUnNumero) return TEXTO_SI_NO_ES_UN_NUMERO[nombre];
    return fallo && fallo.code === 'desplazamientos_invalido'
      ? TEXTOS.desplazamientoEsEntero : TEXTOS.noSeGuardoElCambio;
  }

  // SCRUM-1422 · una sola escucha de la cola viva para esta vista: cada pintado suelta la anterior.
  var dejarDeEscucharLaColaDelParte = null;

  /** ¿Hay un pad de firma en pantalla? Se mira el DOM, igual que en el albarán (SCRUM-1374). */
  function hayPadDeFirmaAbierto() {
    return !!(document.querySelector && document.querySelector('[data-sp-aviso]'));
  }

  /**
   * `parteYaTraido` es para quien YA lo ha leído del servidor y sólo quiere pintarlo (SCRUM-1422):
   * así una lectura que falla no tapa la ficha. No viaja en `opciones` a propósito — las opciones
   * se heredan en cada repintado, y un parte heredado sería un parte viejo.
   */
  async function renderParteDetailView(contenedor, parteId, opciones, parteYaTraido) {
    var o = opciones || {};
    var pedir = o.apiRequest || window.apiRequest;
    if (!contenedor || typeof pedir !== 'function') return false;
    if (dejarDeEscucharLaColaDelParte) { dejarDeEscucharLaColaDelParte(); dejarDeEscucharLaColaDelParte = null; }

    var parte;
    try {
      parte = parteYaTraido || await pedir('/admin/partes/' + parteId);
    } catch (e) {
      // 🔴 SUELO: si el parte no se pudo traer NO se pinta un parte vacío. Un técnico que ve
      // un parte en blanco cree que no apuntó nada, y lo que pasa es que la respuesta no llegó.
      contenedor.innerHTML = '<div data-parte-error="1">' + esc(TEXTOS.noSePudoCargar) + '</div>';
      return false;
    }

    if (!renderParte(contenedor, parte)) {
      contenedor.innerHTML = '<div data-parte-error="1">' + esc(TEXTOS.noSePudoCargar) + '</div>';
      return false;
    }

    // ═══════════════════════════════════════════════════════════════════════════════════
    // SCRUM-818 · EL CABLE DE LOS SIETE CAMPOS Y DE LAS LÍNEAS.
    //
    // 🔴 Un campo pintado y sin `addEventListener` es exactamente lo que este árbol lleva tres
    // tickets cerrando: parece que se puede escribir, se escribe, y no se guarda nada. Se ata
    // aquí, en la misma función y con la misma forma que la firma y el dictado.
    //
    // Se guarda en `change` y no en cada tecla: `change` salta al salir del campo, así que es UNA
    // petición por campo tocado y no una por letra. Y sólo se manda SI CAMBIÓ, para que abrir y
    // cerrar un campo sin tocarlo no escriba nada.
    //
    // ⚠️ Si el `PATCH` falla NO se deja el valor nuevo en pantalla como si se hubiera guardado: se
    // repinta desde el servidor, que es lo que quedó. Es el mismo criterio que tras firmar.
    //
    // 🔴 SCRUM-1302 (B) · Y SE DICE. Repintar a secas devolvía el valor viejo y cerraba la línea
    // plegada sin una palabra: el profesional veía desaparecer lo que acababa de escribir y no
    // sabía si lo había tecleado mal. El aviso va junto a la casilla, con su línea abierta. Si ese
    // mismo campo se guarda después, el aviso se quita: seguir diciéndolo sería ya mentira.
    var guardarCampo = async function (nombre, valor) {
      try {
        await pedir('/admin/partes/' + parteId, {
          method: 'PATCH',
          body: JSON.stringify(cuerpoDeCampo(nombre, valor)),
        });
        quitarAvisoDeCampoNoGuardado(contenedor, nombre);
      } catch (e) {
        await renderParteDetailView(contenedor, parteId, o);
        avisarCampoNoGuardado(contenedor, nombre, e);
      }
    };
    var casillas = contenedor.querySelectorAll ? contenedor.querySelectorAll('[data-parte-campo]') : [];
    var guardarLaCasilla = {};
    for (var c = 0; c < casillas.length; c++) {
      (function (casilla) {
        var original = casilla.value;
        var alCambiar = function () {
          // 🔴 SCRUM-1492 · LO QUE NO ES UN NÚMERO NO ES UN BORRADO. Una casilla `type="number"`
          // con «1e», «-» o «,» entrega `value === ''`, igual que una casilla vacía, y se mandaba
          // `null`: el dato guardado se borraba con un 200 y la casilla seguía enseñando lo
          // tecleado (medido en yaqu.app el 6-oct). Lo que distingue los dos vacíos es
          // `validity.badInput`. No se manda nada, la casilla vuelve a lo guardado y se dice.
          if (casilla.validity && casilla.validity.badInput) {
            casilla.value = original;
            avisarCampoNoGuardado(contenedor, casilla.getAttribute('data-parte-campo'), { noEsUnNumero: true });
            return;
          }
          if (casilla.value === original) return;   // abrir y cerrar sin tocar no escribe nada
          original = casilla.value;
          guardarCampo(casilla.getAttribute('data-parte-campo'), casilla.value);
        };
        casilla.addEventListener('change', alCambiar);
        guardarLaCasilla[casilla.getAttribute('data-parte-campo')] = alCambiar;
      }(casillas[c]));
    }

    var casillaDe = function (nombre) {
      return contenedor.querySelector ? contenedor.querySelector('[data-parte-campo="' + nombre + '"]') : null;
    };

    // 🔴 SCRUM-1189 · EL TIPO DE INTERVENCIÓN SE GUARDA. Los radios se pintaban editables y nadie
    // los escuchaba: el profesional lo marcaba, se veía marcado, y al recargar volvía vacío. El
    // servidor ya lo acepta (`PATCH /admin/partes/:id`, `tipo`); se manda por el MISMO
    // `guardarCampo` que los demás campos, y si falla se repinta desde el servidor.
    var radiosTipo = contenedor.querySelectorAll ? contenedor.querySelectorAll('input[name="parte-tipo"]') : [];
    for (var r = 0; r < radiosTipo.length; r++) {
      (function (radio) {
        radio.addEventListener('change', function () {
          if (!radio.checked) return;
          guardarCampo('tipo', radio.value);
          refrescarResumen('tipo');
        });
      }(radiosTipo[r]));
    }

    // SCRUM-1175 (PR-C) · el resumen de cada línea plegada, al día mientras se escribe. Se lee de
    // las casillas y se calcula con `resumenDe`, la misma función que lo pinta.
    var refrescarResumen = function (clave) {
      var hueco = contenedor.querySelector ? contenedor.querySelector('[data-parte-resumen="' + clave + '"]') : null;
      if (!hueco) return;
      var valorDe = function (nombre) { var c = casillaDe(nombre); return c ? c.value : ''; };
      var marcado = '';
      for (var i = 0; i < radiosTipo.length; i++) if (radiosTipo[i].checked) marcado = radiosTipo[i].value;
      hueco.textContent = resumenDe(clave, {
        obra: valorDe('obra'), referencia: valorDe('referencia'), tecnicos: valorDe('tecnicos'),
        notas: valorDe('notas'), tipo: marcado,
      });
    };
    [['obra', 'obra'], ['referencia', 'obra'], ['tecnicos', 'tecnicos'], ['notas', 'notas']].forEach(function (par) {
      var casilla = casillaDe(par[0]);
      if (casilla) casilla.addEventListener('input', function () { refrescarResumen(par[1]); });
    });

    // SCRUM-1175 · la duración se recalcula mientras se elige la hora, no al guardar.
    var refrescarDuracion = function () {
      var hueco = contenedor.querySelector ? contenedor.querySelector('[data-parte-duracion]') : null;
      var e = casillaDe('entrada');
      var s = casillaDe('salida');
      if (!hueco || !e || !s) return;
      hueco.innerHTML = pintarDuracion(e.value, s.value, true);
    };
    ['entrada', 'salida'].forEach(function (nombre) {
      var casilla = casillaDe(nombre);
      if (casilla) casilla.addEventListener('input', refrescarDuracion);
    });
    // «Ahora»: pone la hora del móvil y la guarda por el MISMO camino que un cambio a mano.
    var botonesAhora = contenedor.querySelectorAll ? contenedor.querySelectorAll('[data-parte-ahora]') : [];
    for (var a = 0; a < botonesAhora.length; a++) {
      (function (boton) {
        boton.addEventListener('click', function () {
          var nombre = boton.getAttribute('data-parte-ahora');
          var casilla = casillaDe(nombre);
          if (!casilla || typeof guardarLaCasilla[nombre] !== 'function') return;
          var n = new Date();
          casilla.value = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
          guardarLaCasilla[nombre]();
          refrescarDuracion();
        });
      }(botonesAhora[a]));
    }

    // Las líneas: cantidad y descripción. El `PATCH` reemplaza la lista ENTERA, así que se manda
    // la lista completa con la línea tocada cambiada — mandar sólo una borraría las demás.
    //
    // 🔴 SCRUM-1266 · LA LISTA SALE DE LO QUE HAY EN PANTALLA, y lo guardado se apunta. Antes se
    // armaba desde `parte.lineas` tal y como vino al abrir, cambiando sólo la casilla tocada: tras
    // corregir una descripción, el siguiente guardado —otra cantidad, o «Es correcto»— mandaba la
    // descripción VIEJA y deshacía la corrección sin que la pantalla lo enseñara. Y los guardados van
    // EN ORDEN: el `blur` de una casilla y el clic de «Es correcto» salen a la vez, y el que llegara
    // segundo pisaría al primero con su lista.
    var casillaDeLinea = function (atributo, i) {
      return contenedor.querySelector ? contenedor.querySelector('[' + atributo + '="' + i + '"]') : null;
    };
    var listaDePantalla = function () {
      return (Array.isArray(parte.lineas) ? parte.lineas : []).map(function (l, i) {
        var base = lineaQueSeGuarda(l);
        var unds = casillaDeLinea('data-linea-unds', i);
        var desc = casillaDeLinea('data-linea-desc', i);
        if (unds && typeof unds.value === 'string') base.unds = unds.value === '' ? null : Number(unds.value);
        if (desc && typeof desc.value === 'string') base.descripcion = desc.value;
        return base;
      });
    };
    /** Guarda la lista de pantalla (tocada por `ajustar`) y apunta lo guardado. Nunca lanza. */
    var guardarLineasEnOrden = function (ajustar) {
      return enOrdenDelParte(parte, async function () {
        var lista = listaDePantalla();
        if (ajustar) ajustar(lista);
        try {
          var r = await pedir('/admin/partes/' + parteId, {
            method: 'PATCH',
            body: JSON.stringify({ lineas: lista }),
          });
          parte.lineas = r && Array.isArray(r.lineas) ? r.lineas : lista;
          return true;
        } catch (e) {
          return false;
        }
      });
    };

    /** SCRUM-1266 · el aviso de UNA línea, repintado con la marca que quedó tras guardar. */
    var repintarAvisoNoDictado = function (indice) {
      var viejo = casillaDeLinea('data-no-dictado', indice);
      if (viejo && viejo.remove) viejo.remove();
      var desc = casillaDeLinea('data-linea-desc', indice);
      var html = avisoNoDictado((parte.lineas || [])[indice], indice);
      if (!desc || !html || !desc.insertAdjacentHTML) return;
      desc.insertAdjacentHTML('afterend', html);
      conectarEsCorrecto(casillaDeLinea('data-es-correcto', indice));
    };

    var deLinea = contenedor.querySelectorAll
      ? contenedor.querySelectorAll('[data-linea-unds],[data-linea-desc]') : [];
    for (var d = 0; d < deLinea.length; d++) {
      (function (casilla) {
        if (casilla.hasAttribute('data-linea-desc')) conectarDescripcion(casilla);
        var original = casilla.value;
        casilla.addEventListener('change', async function () {
          if (casilla.value === original) return;
          original = casilla.value;
          var esUnds = casilla.hasAttribute('data-linea-unds');
          var indice = Number(casilla.getAttribute(esUnds ? 'data-linea-unds' : 'data-linea-desc'));
          if (!(await guardarLineasEnOrden(null))) {
            await renderParteDetailView(contenedor, parteId, o);
            return;
          }
          // La marca se acorta sola al corregir la descripción: el servidor sólo deja lo que sigue escrito.
          if (!esUnds) repintarAvisoNoDictado(indice);
        });
      }(deLinea[d]));
    }

    // SCRUM-1266 · «Es correcto»: la lista entera, con ESA línea mandando la marca vacía —que el
    // servidor lee como «ya no hay nada marcado» (`casarLineasPorIdentidad`)— y su descripción tal
    // cual está. Si falla, el aviso se queda y se dice con el literal ya aprobado `noSeGuardo`.
    function conectarEsCorrecto(boton) {
      if (!boton || !boton.addEventListener) return;
      boton.addEventListener('click', async function () {
        var indice = Number(boton.getAttribute('data-es-correcto'));
        if (!(parte.lineas || [])[indice]) return;
        boton.disabled = true;
        quitarAvisoNoGuardada();
        var ok = await guardarLineasEnOrden(function (lista) {
          if (lista[indice]) lista[indice].datosNoRespaldados = [];
        });
        if (ok) {
          repintarAvisoNoDictado(indice);
          return;
        }
        boton.disabled = false;
        var filas = contenedor.querySelector('[data-parte-filas="' + parte.lineas[indice].bloque + '"]');
        if (filas) {
          filas.insertAdjacentHTML('beforeend',
            '<tr><td colspan="3" data-linea-no-guardada="1">' + esc(TEXTOS.noSeGuardo) + '</td></tr>');
        }
      });
    }
    var botonesEsCorrecto = contenedor.querySelectorAll ? contenedor.querySelectorAll('[data-es-correcto]') : [];
    for (var ec = 0; ec < botonesEsCorrecto.length; ec++) conectarEsCorrecto(botonesEsCorrecto[ec]);

    // ═══════════════════════════════════════════════════════════════════════════════════
    // SCRUM-889 · EL CABLE DE «AÑADIR LÍNEA». Se pintaba y nada lo escuchaba: el técnico no podía
    // apuntar ni una línea a mano, y sin el dictado no le quedaba otra.
    //
    // El patrón es el de «Añadir al parte» del dictado (`confirmarLoDictado`), no uno nuevo:
    //   · pulsar AÑADE UNA FILA en su bloque y no escribe nada — vacía no hay nada que guardar;
    //   · se guarda cuando tiene cantidad (> 0) Y descripción, igual que `lineasConfirmadas`: una
    //     línea sin cantidad no sale, y así no se viaja para volver con un 400;
    //   · se manda la lista ENTERA —las que había más la nueva—, porque el `PATCH` la reemplaza;
    //   · y se RELEE del servidor. Si el guardado falla NO se relee: se perdería lo tecleado. Se
    //     dice con el texto aprobado y la fila se queda como estaba.
    //
    // La «×» de la fila NUEVA sólo la quita de la pantalla, porque nunca llegó al servidor. La de una
    // línea YA GUARDADA va más abajo (segundo PR de SCRUM-889).
    // ═══════════════════════════════════════════════════════════════════════════════════
    var laNueva = function () {
      return {
        fila: contenedor.querySelector('[data-parte-linea-nueva]'),
        unds: contenedor.querySelector('[data-nueva-unds]'),
        desc: contenedor.querySelector('[data-nueva-desc]'),
      };
    };
    var quitarAvisoNoGuardada = function () {
      var avisos = contenedor.querySelectorAll('[data-linea-no-guardada]');
      for (var a = 0; a < avisos.length; a++) avisos[a].remove();
    };
    var quitarLaNueva = function () {
      var n = laNueva();
      quitarAvisoNoGuardada();
      if (n.fila) n.fila.remove();
    };
    var guardandoLaNueva = false;
    var guardarLaNueva = async function () {
      var n = laNueva();
      if (!n.fila || !n.unds || !n.desc || guardandoLaNueva) return;
      var bloque = n.fila.getAttribute('data-parte-linea-nueva');
      var unds = Number(n.unds.value);
      var descripcion = String(n.desc.value || '').trim();
      if (BLOQUES.indexOf(bloque) === -1) return;
      if (n.unds.value === '' || !isFinite(unds) || unds <= 0 || descripcion === '') return;

      guardandoLaNueva = true;
      quitarAvisoNoGuardada();
      try {
        // SCRUM-1266 · en su turno, con las guardadas tal y como están en pantalla.
        await enOrdenDelParte(parte, function () {
          return pedir('/admin/partes/' + parteId, {
            method: 'PATCH',
            body: JSON.stringify({ lineas: listaDePantalla().concat([{ bloque: bloque, unds: unds, descripcion: descripcion }]) }),
          });
        });
      } catch (e) {
        guardandoLaNueva = false;
        var filas = contenedor.querySelector('[data-parte-filas="' + bloque + '"]');
        if (filas) {
          filas.insertAdjacentHTML('beforeend',
            '<tr><td colspan="3" data-linea-no-guardada="1">' + esc(TEXTOS.noSeGuardo) + '</td></tr>');
        }
        return;
      }
      await renderParteDetailView(contenedor, parteId, o);
    };
    var anadirLinea = function (bloque) {
      var n = laNueva();
      if (n.fila) {
        var vacia = (!n.unds || n.unds.value === '') && (!n.desc || String(n.desc.value || '').trim() === '');
        // Una sola fila nueva a la vez: con algo escrito, pulsar otra vez la guarda si ya está
        // completa (es la forma de reintentar tras un fallo) y si no, devuelve el foco a ella.
        if (!vacia || n.fila.getAttribute('data-parte-linea-nueva') === bloque) {
          guardarLaNueva();
          if (n.unds && n.unds.focus) n.unds.focus();
          return;
        }
        quitarLaNueva();   // vacía y en el otro bloque: se muda al bloque que ha pulsado
      }
      var filas = contenedor.querySelector('[data-parte-filas="' + bloque + '"]');
      if (!filas) return;
      var huecos = contenedor.querySelectorAll('[data-parte-sin-lineas]');
      for (var h = 0; h < huecos.length; h++) {
        if (huecos[h].getAttribute('data-parte-sin-lineas') === bloque) huecos[h].remove();
      }
      filas.insertAdjacentHTML('beforeend', filaNueva(bloque));
      var nueva = laNueva();
      if (nueva.unds) nueva.unds.addEventListener('change', guardarLaNueva);
      if (nueva.desc) {
        conectarDescripcion(nueva.desc);
        nueva.desc.addEventListener('change', guardarLaNueva);
      }
      var equis = contenedor.querySelector('[data-quitar-nueva]');
      if (equis) equis.addEventListener('click', quitarLaNueva);
      // Al campo de la cantidad: es la primera columna del papel y abre el teclado numérico.
      if (nueva.unds && nueva.unds.focus) nueva.unds.focus();
    };
    var botonesAnadir = contenedor.querySelectorAll ? contenedor.querySelectorAll('.parte-anadir') : [];
    for (var b = 0; b < botonesAnadir.length; b++) {
      (function (boton) {
        boton.addEventListener('click', function () { anadirLinea(boton.getAttribute('data-bloque')); });
      }(botonesAnadir[b]));
    }

    // SCRUM-889 (segundo PR) · LA «×» DE UNA LÍNEA GUARDADA. Lista entera SIN ella —con los ids de las
    // demás, que es lo que deja cada precio de la oficina en SU línea— y se relee del servidor. Si
    // falla no se relee: la línea sigue ahí y se dice con el literal ya aprobado `noSeGuardo`.
    var quitando = false;
    var equisGuardadas = contenedor.querySelectorAll ? contenedor.querySelectorAll('.parte-quitar-linea[data-indice]') : [];
    for (var q = 0; q < equisGuardadas.length; q++) {
      (function (equis) {
        equis.addEventListener('click', async function () {
          if (quitando) return;
          var indice = Number(equis.getAttribute('data-indice'));
          var todas = Array.isArray(parte.lineas) ? parte.lineas : [];
          if (!todas[indice]) return;
          quitando = true;
          quitarAvisoNoGuardada();
          try {
            // SCRUM-1266 · en su turno, con las demás tal y como están en pantalla.
            await enOrdenDelParte(parte, function () {
              return pedir('/admin/partes/' + parteId, {
                method: 'PATCH',
                body: JSON.stringify({
                  lineas: listaDePantalla().filter(function (_, i) { return i !== indice; }),
                }),
              });
            });
          } catch (e) {
            quitando = false;
            var filas = contenedor.querySelector('[data-parte-filas="' + todas[indice].bloque + '"]');
            if (filas) {
              filas.insertAdjacentHTML('beforeend',
                '<tr><td colspan="3" data-linea-no-guardada="1">' + esc(TEXTOS.noSeGuardo) + '</td></tr>');
            }
            return;
          }
          await renderParteDetailView(contenedor, parteId, o);
        });
      }(equisGuardadas[q]));
    }

    // ═══════════════════════════════════════════════════════════════════════════════════
    // SCRUM-706 · EL CABLE DEL DICTADO. Es el salto 4 de la cadena, y era el único roto.
    //
    // 🔴 Lo que faltaba no era la función: era el `addEventListener`. `ordenarElDictado` estaba
    // escrita, probada y colgada de `window` — que es como la alcanzaban los tests—, y **entre el
    // botón que se pinta y ella no había NADA**. La suite entera en verde, y el técnico dictaba,
    // pulsaba y no pasaba nada. Es el mismo hueco que SCRUM-652 fase D cerró para firmar, y por eso
    // esto se ata aquí, en la misma función y con la misma forma.
    // ═══════════════════════════════════════════════════════════════════════════════════
    var botonDictado = contenedor.querySelector && contenedor.querySelector('[data-dictado-ordenar]');
    if (botonDictado && botonDictado.addEventListener) {
      botonDictado.addEventListener('click', async function () {
        // Se desactiva mientras viaja: dos pulsaciones seguidas son dos llamadas al modelo, y la
        // segunda pisaría la propuesta que el técnico ya está corrigiendo.
        botonDictado.disabled = true;
        var hayPropuestaNueva = false;
        try {
          // 🔴 SIN RED NO SE BLOQUEA EL PARTE. `ordenarElDictado` ya pinta el aviso y devuelve
          // `false` cuando no hay propuesta: el técnico sigue escribiendo a mano, que es lo que
          // funciona sin nosotros. Ordenar es el extra que puede faltar.
          hayPropuestaNueva = await ordenarElDictado(parte, contenedor, o);
        } finally {
          botonDictado.disabled = false;
        }
        // 🔴 SCRUM-1302 (C) · SÓLO SE ATA LO QUE ACABA DE NACER. Desde que un intento fallido deja
        // en pantalla la propuesta de antes, su botón de añadir YA tiene escucha: atarle otra aquí
        // guardaría las líneas dos veces con un solo toque, en un documento que se firma.
        if (!hayPropuestaNueva) return;

        // ⚠️ El botón de confirmar NACE con la propuesta, así que se ata DESPUÉS de pintarla. Si se
        // atara antes no existiría todavía, y volveríamos a tener un botón pintado y muerto — el
        // defecto que este ticket viene a cerrar.
        var confirmar = contenedor.querySelector('[data-propuesta-confirmar]');
        if (confirmar && confirmar.addEventListener) {
          confirmar.addEventListener('click', function () {
            confirmarLoDictado(parte, parteId, contenedor, o);
          });
          // SCRUM-1230 · «Añadir al parte» espera a que cada línea «Sin colocar» tenga bloque.
          // Sin texto nuevo: lo que falta lo dice el rótulo del grupo, que ahora sí se puede cumplir.
          // Y con NINGUNA línea lista (todas sin cantidad) también se apaga: antes se pulsaba y no
          // pasaba nada ni se decía nada (`confirmarLoDictado` no manda una petición vacía), y el
          // técnico no sabía si había fallado él, la aplicación o la red. Lo que falta lo dice el
          // aviso de cada línea, que ahora sigue a la cantidad que hay en pantalla.
          var caja = contenedor.querySelector('[data-dictado-propuesta]');
          var textoCantidad = confirmar.getAttribute ? confirmar.getAttribute('data-aviso-cantidad') : '';
          var sincronizar = function () {
            sincronizarAvisosDeCantidad(caja, textoCantidad);
            sincronizarAvisosDeDatos(caja);
            confirmar.disabled = lineasSinColocar(caja) > 0 || lineasConfirmadas(caja).lineas.length === 0;
          };
          // SCRUM-1266 · la descripción ahora se corrige aquí: el aviso del dato inventado la sigue.
          var descripciones = caja && caja.querySelectorAll ? caja.querySelectorAll('[data-propuesta-desc="1"]') : [];
          Array.prototype.forEach.call(descripciones, function (d) {
            if (d.addEventListener) d.addEventListener('input', sincronizar);
          });
          var fichas = caja && caja.querySelectorAll ? caja.querySelectorAll('[data-colocar]') : [];
          Array.prototype.forEach.call(fichas, function (f) {
            if (f.addEventListener) f.addEventListener('change', sincronizar);
          });
          var cantidades = caja && caja.querySelectorAll ? caja.querySelectorAll('[data-propuesta-unds="1"]') : [];
          Array.prototype.forEach.call(cantidades, function (c) {
            if (c.addEventListener) c.addEventListener('input', sincronizar);
          });
          sincronizar();
        }
      });
    }


    // Cada recuadro a SU ruta. Se enganchan los dos por separado: con un solo escuchador que
    // mirara un atributo, un fallo de selector mandaría la firma del técnico a la ranura del
    // cliente — y eso, en un documento firmado, no se deshace.
    // SCRUM-890 · el aviso va DENTRO de la sección de firmas, junto al botón que se pulsó.
    // `.alert warning` y no `error`: no se ha roto nada, al parte le falta contenido.
    var avisar = function (texto) {
      var seccion = contenedor.querySelector && contenedor.querySelector('[data-parte-firmas]');
      if (!seccion) return;
      var previo = seccion.querySelector('[data-parte-firma-rechazada]');
      if (previo && previo.remove) previo.remove();
      var aviso = document.createElement('div');
      aviso.className = 'alert warning';
      aviso.setAttribute('role', 'alert');
      aviso.setAttribute('data-parte-firma-rechazada', '1');
      aviso.style.marginTop = '8px';
      aviso.textContent = texto;
      seccion.appendChild(aviso);
    };
    // ═══════════════════════════════════════════════════════════════════════════════════
    // SCRUM-1422 · LA FICHA ABIERTA SE ENTERA DE QUE SU FIRMA HA SUBIDO.
    //
    // Se firmaba sin red, volvía la señal, la cola subía la firma y avisaba (`alConfirmarseFirmas`,
    // SCRUM-1373), y esta ficha no escuchaba: seguía ofreciendo firmar lo que el servidor ya tenía.
    //
    // Sólo escucha por los recuadros que aún no están firmados. Con el pad abierto NO se repinta
    // —alguien está firmando, o leyendo su aviso—: se apunta, y se pone al día cuando el pad se
    // cierra. Y se LEE antes de pintar: si la lectura falla, la ficha se queda como estaba en vez
    // de taparse con un error que el técnico no ha provocado.
    // ═══════════════════════════════════════════════════════════════════════════════════
    var seccionDeFirmas = contenedor.querySelector && contenedor.querySelector('[data-parte-firmas]');
    var sigueEnPantalla = function () {
      return !!seccionDeFirmas && contenedor.querySelector('[data-parte-firmas]') === seccionDeFirmas;
    };
    var subioConElPadAbierto = false;
    var ponerseAlDia = async function () {
      try {
        var fresco = await pedir('/admin/partes/' + parteId);
        if (sigueEnPantalla()) await renderParteDetailView(contenedor, parteId, o, fresco);
      } catch (_e) { /* la firma ya subió; lo que ha fallado es leer. La ficha sigue como estaba. */ }
    };
    var tiposQueEspera = [];
    if (!parte.firmoElCliente) tiposQueEspera.push(FIRMAS.cliente.tipo);
    if (!parte.firmoElTecnico) tiposQueEspera.push(FIRMAS.tecnico.tipo);
    if (seccionDeFirmas && tiposQueEspera.length && typeof window.alConfirmarseFirmas === 'function') {
      var dejar = window.alConfirmarseFirmas(async function (confirmadas) {
        // Esta ficha ya no es la que está en pantalla (se navegó, o se repintó): se suelta sola.
        if (!sigueEnPantalla()) { dejar(); return; }
        var esDeEsteParte = (Array.isArray(confirmadas) ? confirmadas : []).some(function (c) {
          return c && tiposQueEspera.indexOf(c.tipo) !== -1 && String(c.documentoId) === String(parte.id);
        });
        if (!esDeEsteParte) return;
        if (hayPadDeFirmaAbierto()) { subioConElPadAbierto = true; return; }
        await ponerseAlDia();
      });
      dejarDeEscucharLaColaDelParte = dejar;
    }
    // ═══════════════════════════════════════════════════════════════════════════════════
    // SCRUM-1426 · LO QUE ESTE MÓVIL SABE Y EL SERVIDOR TODAVÍA NO.
    //
    // Con una firma de este parte en la cola, la ficha se veía igual que si nadie hubiera
    // firmado: decía «falta» y dejaba firmar encima sin avisar. Es lo que SCRUM-1353 arregló en
    // el albarán; aquí hay DOS firmas, y la cola guarda cada una con su clave.
    //
    // 🔴 Tres respuestas y no dos: `null` = no se pudo leer el almacén, y entonces NO se afirma
    // nada — ni caja, ni pregunta, y «falta» se sigue diciendo.
    // ═══════════════════════════════════════════════════════════════════════════════════
    var firmasGuardadasAqui = async function () {
      try {
        if (typeof window.leerFirmasPendientes !== 'function') return null;
        var cola = await window.leerFirmasPendientes();
        if (!cola || cola.estado !== window.GUARDADO) return null;
        var enCola = function (tipo) {
          var clave = 'firma:' + tipo + ':' + String(parte.id);
          return (cola.firmas || []).some(function (f) { return f && f.claveIdempotencia === clave; });
        };
        return { cliente: enCola(FIRMAS.cliente.tipo), tecnico: enCola(FIRMAS.tecnico.tipo) };
      } catch (_e) {
        return null;
      }
    };
    // La caja es la del albarán, tal cual (`estadoFirma.js`), y va DENTRO de la caja de su firma:
    // el literal no dice de quién es, lo dice el sitio (c.18232). Donde hay firma guardada no se
    // dice «falta». Se puede llamar más de una vez: no repite la caja.
    var pintarLoGuardadoAqui = async function () {
      var guardadas = await firmasGuardadasAqui();
      if (!guardadas || !sigueEnPantalla() || typeof window.pintarEstadoDeFirma !== 'function') return;
      [['cliente', parte.firmoElCliente], ['tecnico', parte.firmoElTecnico]].forEach(function (par) {
        if (par[1] || !guardadas[par[0]]) return;
        var caja = seccionDeFirmas.querySelector('[data-parte-caja-firma="' + par[0] + '"]');
        if (!caja || caja.querySelector('[data-parte-firma-guardada]')) return;
        var falta = caja.querySelector('[data-parte-falta-firma]');
        if (falta && falta.remove) falta.remove();
        var guardada = document.createElement('div');
        guardada.setAttribute('data-parte-firma-guardada', par[0]);
        guardada.style.marginTop = '8px';
        guardada.innerHTML = window.pintarEstadoDeFirma(window.FIRMA_SOLO_EN_ESTE_MOVIL);
        caja.appendChild(guardada);
      });
    };
    await pintarLoGuardadoAqui();

    var alCerrarElPad = async function () {
      if (subioConElPadAbierto) {
        subioConElPadAbierto = false;
        if (sigueEnPantalla()) await ponerseAlDia();
        return;
      }
      // SCRUM-1426 · se firmó sin red y se cierra el pad: la firma está en la cola y esta ficha
      // se pintó cuando aún no había nada. No se pide nada al servidor: sólo se mira el móvil.
      await pintarLoGuardadoAqui();
    };

    var PREGUNTA_ANTES_DE_REEMPLAZAR = { cliente: TEXTOS.yaHayFirmaGuardadaCliente, tecnico: TEXTOS.yaHayFirmaGuardadaTecnico };

    [['[data-parte-firmar]', 'cliente'], ['[data-parte-firmar-tecnico]', 'tecnico']].forEach(function (par) {
      var boton = contenedor.querySelector && contenedor.querySelector(par[0]);
      if (!boton || !boton.addEventListener) return;
      boton.addEventListener('click', function () {
        var firmar = function () {
          firmarParte(parte, Object.assign({}, o, {
            alFirmar: function () { return renderParteDetailView(contenedor, parteId, o); },
            avisar: avisar,
            alCerrarElPad: alCerrarElPad,
          }), par[1]);
        };
        // Un parte que no va a abrir el pad (vacío, o sin líneas legibles) no tiene nada que
        // reemplazar: va por el camino de siempre, EN EL MISMO CLIC. Su aviso sale junto al botón
        // sin esperar a la cola (SCRUM-890).
        var lineas = lineasOCeguera(parte);
        if (!lineas || lineas.length === 0) { firmar(); return; }
        // Firmar encima de una firma guardada la REEMPLAZA (la clave de la cola es por parte y
        // tipo). Se puede, pero no en silencio. Se pregunta EN EL CLIC y no al pintar: quien firma
        // sin red y cierra el pad sigue en esta pantalla, pintada cuando no había nada.
        firmasGuardadasAqui().then(function (guardadas) {
          if (guardadas && guardadas[par[1]] && !window.confirm(PREGUNTA_ANTES_DE_REEMPLAZAR[par[1]])) return;
          firmar();
        });
      });
    });

    await avisarDeUnRechazo(parte, avisar);
    return true;
  }

  window.renderParte = renderParte;
  window.renderParteDetailView = renderParteDetailView;
  window.partePintarPropuesta = pintarPropuesta;
  window.parteOrdenarDictado = ordenarElDictado;
  window.parteLineasConfirmadas = lineasConfirmadas;
  window.firmarParte = firmarParte;
  window.PARTE_TEXTOS = TEXTOS;
  window.parteLineasOCeguera = lineasOCeguera;
  window.parteCuerpoDeCampo = cuerpoDeCampo;
})();
