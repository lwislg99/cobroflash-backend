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
    tituloFirma: M + 'Firma del cliente',
    pistaFirma: M + 'Pide al cliente que firme con el dedo dentro del recuadro.',
    manoObra: M + 'Mano de obra',
    materiales: M + 'Materiales',
    sinLineas: M + 'Todavía no has apuntado nada.',
    unds: M + 'UNDS',
    entrada: M + 'Entrada',
    salida: M + 'Salida',
    desplazamiento: M + 'Desplazamiento',
    kilometros: M + 'Kilómetros',
    referencia: M + 'REF',
    obra: M + 'Dirección de la obra',
    tecnicos: M + 'Técnicos',
    notas: M + 'Notas',
    anadirLinea: M + 'Añadir línea',
    firmar: M + 'Firmar aquí mismo',
    yaFirmado: M + 'Firmado. El contenido ya no se toca.',
    tipoReparacion: M + 'Reparación / asistencia',
    tipoMantenimiento: M + 'Mantenimiento',
    tipoInstalacion: M + 'Instalación',
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
  function filaDeLinea(linea, indice, editable) {
    return (
      '<tr data-parte-linea="' + indice + '">' +
      '<td style="padding:6px 8px 6px 0;border-bottom:1px solid var(--border);text-align:right;' +
      'white-space:nowrap;width:64px">' + esc(linea && linea.unds) + '</td>' +
      '<td style="padding:6px 0;border-bottom:1px solid var(--border)">' +
      esc(linea && linea.descripcion) + '</td>' +
      (editable
        ? '<td style="padding:6px 0 6px 8px;border-bottom:1px solid var(--border);width:32px">' +
          '<button type="button" class="parte-quitar-linea" data-indice="' + indice + '" ' +
          'aria-label="Quitar línea">&times;</button></td>'
        : '') +
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
      '<thead><tr><th style="text-align:right;padding:0 8px 4px 0;font-size:12px;color:var(--muted);' +
      'font-weight:600">' + esc(TEXTOS.unds) + '</th><th></th>' + (editable ? '<th></th>' : '') +
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

  function campo(rotulo, valor) {
    return (
      '<div style="margin-bottom:8px">' +
      '<span style="display:block;font-size:12px;color:var(--muted)">' + esc(rotulo) + '</span>' +
      '<span style="font-size:14px;color:var(--ink)">' + esc(valor || '—') + '</span></div>'
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
      campo(TEXTOS.obra, parte.obra) +
      campo(TEXTOS.referencia, parte.referencia) +
      campo(TEXTOS.entrada, parte.entrada) +
      campo(TEXTOS.salida, parte.salida) +
      campo(TEXTOS.desplazamiento, parte.desplazamientos) +
      campo(TEXTOS.kilometros, parte.kilometros) +
      // El papel admite VARIOS técnicos en la misma línea, así que se pintan juntos y separados
      // por coma, tal como se escriben ahí.
      campo(TEXTOS.tecnicos, (parte.tecnicos || []).join(', ')) +
      pintarTipo(parte.tipo, editable) +
      pintarBloque('mano_obra', lineas, editable) +
      pintarBloque('materiales', lineas, editable) +
      campo(TEXTOS.notas, parte.notas) +
      (editable
        ? '<button type="button" data-parte-firmar="1" style="width:100%;margin-top:10px">' +
          esc(TEXTOS.firmar) + '</button>'
        : '<p data-parte-firmado="1" style="margin-top:10px;font-size:14px;color:var(--muted)">' +
          esc(TEXTOS.yaFirmado) + '</p>');

    return true;
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
  function firmarParte(parte, opciones) {
    var o = opciones || {};
    var abrirPad = o.abrirPad || window.openSignaturePad;
    var firmar = o.firmar || window.firmarConRedDeSeguridad;
    var pedir = o.apiRequest || window.apiRequest;
    if (typeof abrirPad !== 'function' || typeof firmar !== 'function') return false;

    var lineas = lineasOCeguera(parte);
    if (lineas === null) return false;

    abrirPad({
      title: TEXTOS.tituloFirma,
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
        return firmar(parte.id, cuerpo, function () {
          return pedir('/admin/partes/' + parte.id + '/firmar', {
            method: 'POST',
            body: JSON.stringify(cuerpo),
          });
        }, 'parte');
      },
    });
    return true;
  }

  window.renderParte = renderParte;
  window.firmarParte = firmarParte;
  window.PARTE_TEXTOS = TEXTOS;
  window.parteLineasOCeguera = lineasOCeguera;
})();
