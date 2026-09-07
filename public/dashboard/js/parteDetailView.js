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
  // 🔴 MICROCOPY SIN APROBAR (regla 30). Todo lo de aquí SALE MARCADO hasta que el fundador lo
  // firme, y por eso este fichero entra en el censo de SCRUM-402 con su número.
  //
  // Se propone con las palabras del papel —«UNDS», «Mano de obra», «Materiales», «Entrada»,
  // «Salida», «Desplazamiento», «Kilómetros», «REF»— porque son las que el técnico ya lee en el
  // impreso que rellena hoy. Estrenar sinónimos obligaría a traducir mentalmente entre el papel y
  // la pantalla justo cuando está en casa de un cliente.
  // ═══════════════════════════════════════════════════════════════════════════════════════
  var M = '[PENDIENTE microcopy oficial] ';
  var TEXTOS = {
    tituloFirma: 'Firma del cliente',
    pistaFirma: 'Pide al cliente que firme con el dedo dentro del recuadro.',
    manoObra: 'Mano de obra',
    materiales: 'Materiales',
    sinLineas: 'Todavía no has apuntado nada.',
    unds: 'UNDS',
    entrada: 'Entrada',
    salida: 'Salida',
    desplazamiento: 'Desplazamiento',
    kilometros: 'Kilómetros',
    referencia: 'REF',
    obra: 'Dirección de la obra',
    tecnicos: 'Técnicos',
    notas: 'Notas',
    anadirLinea: 'Añadir línea',
    firmar: 'Firmar aquí mismo',
    yaFirmado: 'Firmado. El contenido ya no se puede cambiar.',
    // ✅ APROBADO literal por el fundador el 3-sep-2026, sin cambiar una letra. Consta en
    // `docs/microcopy/2026-09-03-SCRUM-704-guardar-lineas-dictadas.md`.
    noSeGuardo: 'No se han podido guardar las líneas — vuelve a intentarlo',
    noSePudoCargar: 'No se ha podido cargar el parte. Vuelve a intentarlo.',
    // El rótulo del GRUPO de los tres tipos (SCRUM-818). No es texto nuevo: es el literal que el
    // fundador firmó en SCRUM-703 para este mismo vocabulario cerrado en «Trabajo nuevo», así que
    // reutilizarlo no estrena microcopy ni pide firma (regla 30).
    tituloTipo: 'Tipo de intervención',
    tipoReparacion: 'Reparación / asistencia',
    tipoMantenimiento: 'Mantenimiento',
    tipoInstalacion: 'Instalación',
    dictado: 'Dicta lo que has hecho',
    pistaDictado: 'Usa el micrófono de tu teclado. Luego lo ordenamos.',
    ordenarDictado: 'Ordenar en líneas',
    confirmarPropuesta: 'Añadir estas líneas',
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
    faltaLaFirmaDelCliente: 'Falta la firma del cliente para cerrar el parte.',
    faltaLaFirmaDelTecnico: 'Falta la firma del técnico para cerrar el parte.',
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
      '<td><input class="parte-linea-desc" type="text" data-linea-desc="' + indice + '"' +
      ' value="' + esc(desc) + '"></td>' +
      '<td class="parte-col-quitar">' +
      '<button type="button" class="parte-quitar-linea" data-indice="' + indice + '" ' +
      'aria-label="Quitar línea">&times;</button></td>' +
      '</tr>'
    );
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
      : '<tr><td colspan="' + (editable ? 3 : 2) + '" style="padding:6px 0;color:var(--muted)">' +
        esc(TEXTOS.sinLineas) + '</td></tr>';

    return (
      '<section class="parte-bloque" data-parte-bloque="' + esc(bloque) + '" style="margin-bottom:18px">' +
      '<h4 style="margin:0 0 6px;font-size:14px;font-weight:700;color:var(--ink)">' +
      esc(ETIQUETA_BLOQUE[bloque]) + '</h4>' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
      // ⚠️ LA SEGUNDA CABECERA, la de la descripción, NO SE PINTA TODAVÍA: su literal es texto
      // nuevo y lo firma el fundador (regla 30). Va propuesto en el informe de SCRUM-818. Poner
      // aquí un marcador la dejaría a la vista del técnico, que es justo lo que SCRUM-720 cerró.
      '<thead><tr><th class="parte-col-unds">' + esc(TEXTOS.unds) + '</th><th></th>' +
      (editable ? '<th class="parte-col-quitar"></th>' : '') +
      '</tr></thead><tbody>' + filas + '</tbody></table>' +
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
          '<label style="display:inline-flex;align-items:center;gap:6px;margin-right:14px;font-size:14px">' +
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
   */
  function campo(rotulo, valor, nombre, editable, modo) {
    var v = valor === null || valor === undefined ? '' : String(valor);
    if (!editable) {
      return (
        '<div class="parte-campo">' +
        '<span class="parte-campo-rotulo">' + esc(rotulo) + '</span>' +
        '<span class="parte-campo-dato" data-parte-dato="' + esc(nombre || '') + '">' +
        esc(v || '—') + '</span></div>'
      );
    }
    return (
      '<label class="parte-campo">' +
      '<span class="parte-campo-rotulo">' + esc(rotulo) + '</span>' +
      '<input type="' + (modo === 'number' ? 'number' : 'text') + '"' +
      (modo === 'number' ? ' inputmode="decimal"' : '') +
      ' data-parte-campo="' + esc(nombre || '') + '" value="' + esc(v) + '"></label>'
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
      // 🔴 SCRUM-818 · LOS SIETE SON CAMPOS DE VERDAD. Antes eran un rótulo con un guion debajo:
      // parecían campos y no se podían tocar, y fue lo primero que el fundador notó al abrir la
      // pantalla. Los siete existen en la base y los siete se escriben por el `PATCH` — medido
      // campo a campo en el PASO 0, ejecutando `permisoDeCampos`, no leyendo el código.
      '<div class="parte-datos">' +
      campo(TEXTOS.obra, parte.obra, 'obra', editable) +
      campo(TEXTOS.referencia, parte.referencia, 'referencia', editable) +
      campo(TEXTOS.entrada, parte.entrada, 'entrada', editable) +
      campo(TEXTOS.salida, parte.salida, 'salida', editable) +
      campo(TEXTOS.desplazamiento, parte.desplazamientos, 'desplazamientos', editable, 'number') +
      campo(TEXTOS.kilometros, parte.kilometros, 'kilometros', editable, 'number') +
      // El papel admite VARIOS técnicos en la misma línea, así que se pintan juntos y separados
      // por coma, tal como se escriben ahí.
      //
      // 🔴 EDITABLE, aunque venga PRELLENADO de los asignados del Trabajo: el parte es la prueba
      // de lo que PASÓ, no el registro de lo que se planeó, y lo firma un cliente que puede
      // discutirlo. Si el técnico lo cambia respecto a la asignación, eso NO es un error: es el
      // dato, y no se revierte al guardar.
      campo(TEXTOS.tecnicos, (parte.tecnicos || []).join(', '), 'tecnicos', editable) +
      '</div>' +
      pintarTipo(parte.tipo, editable) +
      // El dictado solo tiene sentido mientras el contenido se pueda tocar: ofrecerlo en un parte
      // firmado sería enseñar un camino que el siguiente paso cierra con un 409.
      (editable ? pintarDictado() : '') +
      pintarBloque('mano_obra', lineas, editable) +
      pintarBloque('materiales', lineas, editable) +
      '<div class="parte-datos">' + campo(TEXTOS.notas, parte.notas, 'notas', editable) + '</div>' +
      (editable
        ? pintarLasDosFirmas(parte)
        : pintarLasDosFirmas(parte));

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
      '<div data-dictado-propuesta="1"></div></div>';
  }

  function pintarLineaPropuesta(linea, bloque, indice, avisos, inventado) {
    var sinCantidad = !(typeof linea.unds === 'number' && linea.unds > 0);
    var conInventado = !!(inventado && inventado[linea.descripcion]);
    return '' +
      '<li data-propuesta="1" data-bloque="' + esc(bloque) + '" data-indice="' + indice + '"' +
      ' style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)">' +
      '<input type="number" step="any" min="0" data-propuesta-unds="1" ' +
      'value="' + (sinCantidad ? '' : esc(linea.unds)) + '" ' +
      'aria-label="' + esc(TEXTOS.unds) + '" style="width:72px">' +
      '<span style="flex:1;font-size:14px">' + esc(linea.descripcion) + '</span>' +
      // 🔴 La cantidad retirada NO desaparece: se dice, en la línea a la que le falta. Texto
      // APROBADO (regla 30) y en SINGULAR porque el aviso es de línea, no un resumen — viene del
      // servidor para no reteclearlo aquí.
      (sinCantidad
        ? '<em data-falta-cantidad="1" style="font-size:12px;color:var(--muted);font-style:normal">' +
          esc(avisos.cantidadesRetiradas) + '</em>'
        : '') +
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
      '</li>';
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
        esc(avisos[p.motivo] || avisos.sin_lineas_reconocidas || '') + '</p>';
      return false;
    }

    // Qué líneas llevan un dato que el dictado no respalda. Se arma UNA vez, no por línea.
    var inventado = {};
    (p.datosRetirados || []).forEach(function (d) {
      if (d && d.descripcion) inventado[d.descripcion] = true;
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
      '<button type="button" data-propuesta-confirmar="1" style="width:100%;margin-top:10px">' +
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
      var descripcion = (fila.querySelector('span') || {}).textContent || '';
      var unds = Number(campoUnds && campoUnds.value);
      var bloque = fila.getAttribute('data-bloque');
      if (!isFinite(unds) || unds <= 0) { sinCantidad += 1; return; }
      // `sinBloque` no es un bloque del dominio: sin decidirlo el técnico, esa línea no entra.
      if (BLOQUES.indexOf(bloque) === -1) { sinCantidad += 1; return; }
      lineas.push({ bloque: bloque, unds: unds, descripcion: descripcion });
    });
    return { lineas: lineas, sinCantidad: sinCantidad };
  }

  /**
   * Manda el dictado a `/admin/partes/:id/dictado` y pinta lo que vuelva.
   *
   * 🔴 NO GUARDA NADA. La ruta tampoco: devuelve una propuesta. Lo que escribe en el parte es el
   * `PATCH` de siempre, y solo cuando el técnico le da a confirmar.
   *
   * 🔴 Y SI FALLA, NO BLOQUEA: se pinta el aviso y el técnico sigue escribiendo a mano. El dictado
   * del teclado de su móvil funciona sin nosotros; ordenar es el extra que puede faltar.
   */
  async function ordenarElDictado(parte, contenedor, opciones) {
    var o = opciones || {};
    var pedir = o.apiRequest || window.apiRequest;
    var destino = contenedor && contenedor.querySelector('[data-dictado-propuesta="1"]');
    var campo = contenedor && contenedor.querySelector('[data-dictado-texto="1"]');
    if (typeof pedir !== 'function' || !destino || !campo) return false;

    var dictado = String(campo.value || '').trim();
    try {
      var respuesta = await pedir('/admin/partes/' + parte.id + '/dictado', {
        method: 'POST',
        body: JSON.stringify({ dictado: dictado }),
      });
      return pintarPropuesta(destino, respuesta);
    } catch (e) {
      // Un fallo de red aquí NO es un fallo del parte. Se dice con el texto aprobado del caso
      // «no ha salido nada» y se sigue: el suelo es que la pantalla no se quede muda.
      pintarPropuesta(destino, {
        propuesta: { vacia: true, motivo: 'sin_lineas_reconocidas', mano_obra: [], materiales: [], sinBloque: [] },
        avisos: o.avisos || {},
      });
      return false;
    }
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
        ? '<p data-parte-' + marca + '-hecha="1" style="margin:8px 0 0;font-size:14px;color:var(--muted)">' +
          esc(hecho) + (quien ? ' ' + esc(quien) : '') + '</p>'
        : '<button type="button" data-parte-' + marca + '="1" style="width:100%;margin-top:8px">' +
          esc(rotulo) + '</button>';
    };
    return (
      '<section data-parte-firmas="1" style="margin-top:12px">' +
      recuadro(parte.firmoElCliente, 'firmar', TEXTOS.firmar, TEXTOS.yaFirmoElCliente, parte.firmadoPorNombre) +
      recuadro(parte.firmoElTecnico, 'firmar-tecnico', TEXTOS.firmarTecnico, TEXTOS.yaFirmoElTecnico, parte.firmadoTecnicoNombre) +
      // 🔴 EL AVISO NOMBRA LA QUE FALTA, y si faltan las dos se dicen las dos: fundir ambas en
      // «falta una firma» era exactamente el defecto — el técnico tendría que adivinar cuál.
      (!parte.firmoElCliente
        ? '<p data-parte-falta-firma="cliente" style="margin:8px 0 0;font-size:13px;color:var(--muted)">' +
          esc(TEXTOS.faltaLaFirmaDelCliente) + '</p>'
        : '') +
      (!parte.firmoElTecnico
        ? '<p data-parte-falta-firma="tecnico" style="margin:8px 0 0;font-size:13px;color:var(--muted)">' +
          esc(TEXTOS.faltaLaFirmaDelTecnico) + '</p>'
        : '') +
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

  function firmarParte(parte, opciones, quien) {
    var o = opciones || {};
    var cual = FIRMAS[quien || 'cliente'];
    var abrirPad = o.abrirPad || window.openSignaturePad;
    var firmar = o.firmar || window.firmarConRedDeSeguridad;
    var pedir = o.apiRequest || window.apiRequest;
    if (typeof abrirPad !== 'function' || typeof firmar !== 'function') return false;

    var lineas = lineasOCeguera(parte);
    if (lineas === null) return false;

    abrirPad({
      title: quien === 'tecnico' ? TEXTOS.firmarTecnico : TEXTOS.tituloFirma,
      hint: TEXTOS.pistaFirma,
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
      firmante: { sugerencia: parte.clienteNombre || '' },
      onConfirm: async function (dataUri, declaracion) {
        var cuerpo = Object.assign({ signatureData: dataUri }, declaracion || {});
        // El error SUBE (SCRUM-404): el pad no cierra hasta que esto resuelve, así que un fallo
        // deja el trazo en pantalla y se reintenta sin pedirle al cliente que firme otra vez.
        var r = await firmar(parte.id, cuerpo, function () {
          return pedir(cual.ruta(parte.id), { method: 'POST', body: JSON.stringify(cuerpo) });
        }, cual.tipo);
        // Repinta con lo que dice el SERVIDOR. Se llama también cuando la firma se quedó en la
        // cola: el parte sigue en borrador y la pantalla tiene que seguir diciéndolo.
        if (typeof o.alFirmar === 'function') { try { await o.alFirmar(); } catch (_e) {} }
        return r;
      },
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
   * ⛔ NI UN IMPORTE, en ninguna dirección: lo que viaja es {bloque, unds, descripcion}, que es lo
   * único que esta pantalla tiene. Los precios los pone la oficina, en otra pantalla.
   */
  async function confirmarLoDictado(parte, parteId, contenedor, opciones) {
    var o = opciones || {};
    var pedir = o.apiRequest || window.apiRequest;
    if (typeof pedir !== 'function') return false;

    var caja = contenedor.querySelector && contenedor.querySelector('[data-dictado-propuesta]');
    var confirmadas = lineasConfirmadas(caja);
    if (!confirmadas.lineas.length) return false;   // nada que añadir: no se manda una petición vacía

    var yaHabia = (Array.isArray(parte.lineas) ? parte.lineas : []).map(function (l) {
      return { bloque: l.bloque, unds: l.unds, descripcion: l.descripcion };
    });

    try {
      await pedir('/admin/partes/' + parteId, {
        method: 'PATCH',
        body: JSON.stringify({ lineas: yaHabia.concat(confirmadas.lineas) }),
      });
    } catch (e) {
      // Si no se pudo guardar NO se repinta como si sí: el técnico creería que ya está apuntado.
      var aviso = contenedor.querySelector('[data-dictado-propuesta]');
      if (aviso) aviso.innerHTML = '<p data-dictado-no-guardado="1">' + esc(TEXTOS.noSeGuardo) + '</p>';
      return false;
    }

    // Se vuelve a traer del servidor en vez de retocar la pantalla: lo que se enseña es lo que
    // quedó guardado, no lo que creemos que mandamos. Mismo criterio que tras firmar.
    await renderParteDetailView(contenedor, parteId, o);
    return true;
  }

  async function renderParteDetailView(contenedor, parteId, opciones) {
    var o = opciones || {};
    var pedir = o.apiRequest || window.apiRequest;
    if (!contenedor || typeof pedir !== 'function') return false;

    var parte;
    try {
      parte = await pedir('/admin/partes/' + parteId);
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
    var guardarCampo = async function (nombre, valor) {
      try {
        await pedir('/admin/partes/' + parteId, {
          method: 'PATCH',
          body: JSON.stringify(cuerpoDeCampo(nombre, valor)),
        });
      } catch (e) {
        await renderParteDetailView(contenedor, parteId, o);
      }
    };
    var casillas = contenedor.querySelectorAll ? contenedor.querySelectorAll('[data-parte-campo]') : [];
    for (var c = 0; c < casillas.length; c++) {
      (function (casilla) {
        var original = casilla.value;
        casilla.addEventListener('change', function () {
          if (casilla.value === original) return;   // abrir y cerrar sin tocar no escribe nada
          original = casilla.value;
          guardarCampo(casilla.getAttribute('data-parte-campo'), casilla.value);
        });
      }(casillas[c]));
    }

    // Las líneas: cantidad y descripción. El `PATCH` reemplaza la lista ENTERA, así que se manda
    // la lista completa con la línea tocada cambiada — mandar sólo una borraría las demás.
    var deLinea = contenedor.querySelectorAll
      ? contenedor.querySelectorAll('[data-linea-unds],[data-linea-desc]') : [];
    for (var d = 0; d < deLinea.length; d++) {
      (function (casilla) {
        var original = casilla.value;
        casilla.addEventListener('change', async function () {
          if (casilla.value === original) return;
          original = casilla.value;
          var esUnds = casilla.hasAttribute('data-linea-unds');
          var indice = Number(casilla.getAttribute(esUnds ? 'data-linea-unds' : 'data-linea-desc'));
          var lista = (Array.isArray(parte.lineas) ? parte.lineas : []).map(function (l, i) {
            var base = { bloque: l.bloque, unds: l.unds, descripcion: l.descripcion };
            if (i !== indice) return base;
            if (esUnds) base.unds = casilla.value === '' ? null : Number(casilla.value);
            else base.descripcion = casilla.value;
            return base;
          });
          try {
            await pedir('/admin/partes/' + parteId, {
              method: 'PATCH',
              body: JSON.stringify({ lineas: lista }),
            });
          } catch (e) {
            await renderParteDetailView(contenedor, parteId, o);
          }
        });
      }(deLinea[d]));
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
        try {
          // 🔴 SIN RED NO SE BLOQUEA EL PARTE. `ordenarElDictado` ya pinta el aviso y devuelve
          // `false` cuando no hay propuesta: el técnico sigue escribiendo a mano, que es lo que
          // funciona sin nosotros. Ordenar es el extra que puede faltar.
          await ordenarElDictado(parte, contenedor, o);
        } finally {
          botonDictado.disabled = false;
        }

        // ⚠️ El botón de confirmar NACE con la propuesta, así que se ata DESPUÉS de pintarla. Si se
        // atara antes no existiría todavía, y volveríamos a tener un botón pintado y muerto — el
        // defecto que este ticket viene a cerrar.
        var confirmar = contenedor.querySelector('[data-propuesta-confirmar]');
        if (confirmar && confirmar.addEventListener) {
          confirmar.addEventListener('click', function () {
            confirmarLoDictado(parte, parteId, contenedor, o);
          });
        }
      });
    }


    // Cada recuadro a SU ruta. Se enganchan los dos por separado: con un solo escuchador que
    // mirara un atributo, un fallo de selector mandaría la firma del técnico a la ranura del
    // cliente — y eso, en un documento firmado, no se deshace.
    [['[data-parte-firmar]', 'cliente'], ['[data-parte-firmar-tecnico]', 'tecnico']].forEach(function (par) {
      var boton = contenedor.querySelector && contenedor.querySelector(par[0]);
      if (!boton || !boton.addEventListener) return;
      boton.addEventListener('click', function () {
        firmarParte(parte, Object.assign({}, o, {
          alFirmar: function () { return renderParteDetailView(contenedor, parteId, o); },
        }), par[1]);
      });
    });
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
