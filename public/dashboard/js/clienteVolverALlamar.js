/**
 * public/dashboard/js/clienteVolverALlamar.js — SCRUM-1056 (CRM-15)
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * «VOLVER A LLAMAR»: una tarea con fecha dentro del cliente. Esta pieza dibuja el bloque de la
 * ficha y dice qué marca lleva el cliente en la lista.
 *
 * ── 🔴 NO CONOCE NINGUNA RUTA, Y ES A PROPÓSITO ────────────────────────────────────────────
 *
 * Quien la monta le pasa la llamada y dos funciones, `guardar` y `hecho`, que son las que hablan
 * con el servidor. Cuando se escribió, las rutas no existían (son de S1) y la ficha y la lista
 * son de J2: una pieza que llevara dentro una URL habría sido una ruta inventada.
 *
 * ── 🔴 «HOY» NO LO DECIDE ESTA PIEZA ───────────────────────────────────────────────────────
 *
 * Si toca hoy, si está vencida o si es para más adelante lo dice el servidor, con la zona del
 * negocio, en `estado`. Aquí no se compara ninguna fecha con el reloj del navegador: cerca de
 * medianoche, o con el móvil en otra zona, saldrían dos verdades. Por eso tampoco se rechaza una
 * fecha en el pasado al escribirla: se guarda y el servidor la devuelve como vencida.
 *
 * ── LO QUE LLEGA Y NO SE ENTIENDE NO SE PINTA ──────────────────────────────────────────────
 *
 * Una llamada sin forma reconocible (sin objeto, con un día que no es AAAA-MM-DD, con un día y
 * sin estado) NO es «no hay ninguna pendiente». Con ella el bloque se queda vacío y la lista sin
 * marca, en vez de ofrecer «Poner fecha» sobre una llamada que quizá existe.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  /** Los tres estados que manda el servidor cuando hay día. Sin día no hay estado. */
  var ESTADOS = {
    FUTURO: 'futuro',
    HOY: 'hoy',
    VENCIDO: 'vencido',
  };

  /**
   * Los textos fijos, en un solo sitio. La letra entre paréntesis es la fila de la firma.
   * Registro: `docs/microcopy/2026-10-13-SCRUM-1056-volver-a-llamar.md`.
   */
  var TEXTOS = {
    titulo: 'Volver a llamar', // APROBADO por el orquestador por delegación del fundador, 13-oct-2026 (SCRUM-1056 comentario 19401, B1)
    ponerFecha: 'Poner fecha', // APROBADO por el orquestador por delegación del fundador, 13-oct-2026 (SCRUM-1056 comentario 19401, B2)
    hoy: 'Volver a llamar hoy', // APROBADO por el orquestador por delegación del fundador, 13-oct-2026 (SCRUM-1056 comentario 19401, B4)
    dia: 'Día', // APROBADO por el orquestador por delegación del fundador, 13-oct-2026 (SCRUM-1056 comentario 19401, B6)
    nota: 'Nota de la llamada', // APROBADO por el orquestador por delegación del fundador, 13-oct-2026 (SCRUM-1056 comentario 19401, B7)
    hecho: 'Hecho', // APROBADO por el orquestador por delegación del fundador, 13-oct-2026 (SCRUM-1056 comentario 19401, B8)
    cambiar: 'Cambiar', // APROBADO por el orquestador por delegación del fundador, 13-oct-2026 (SCRUM-1056 comentario 19401, B9)
    marcaHoy: 'Llamar hoy', // APROBADO por el orquestador por delegación del fundador, 13-oct-2026 (SCRUM-1056 comentario 19401, B10)
    noGuardado: 'No se ha podido guardar la llamada. Inténtalo otra vez.', // APROBADO por el orquestador por delegación del fundador, 13-oct-2026 (SCRUM-1056 comentario 19401, B12)
    guardar: 'Guardar', // APROBADO por el orquestador por delegación del fundador, 13-oct-2026 (SCRUM-1056 comentario 19401, B13)
    cancelar: 'Cancelar', // APROBADO por el orquestador por delegación del fundador, 13-oct-2026 (SCRUM-1056 comentario 19401, B14)
  };

  /** Los tres textos que llevan la fecha dentro. La fecha entra ya escrita como dd/mm/aaaa. */
  var FRASES = {
    futuro: function (fecha) { return 'Volver a llamar el ' + fecha; }, // APROBADO por el orquestador por delegación del fundador, 13-oct-2026 (SCRUM-1056 comentario 19401, B3)
    vencido: function (fecha) { return 'Había que llamar el ' + fecha; }, // APROBADO por el orquestador por delegación del fundador, 13-oct-2026 (SCRUM-1056 comentario 19401, B5)
    marcaVencida: function (fecha) { return 'Llamar: ' + fecha; }, // APROBADO por el orquestador por delegación del fundador, 13-oct-2026 (SCRUM-1056 comentario 19401, B10)
  };

  /**
   * «2026-10-16» → «16/10/2026», que es como la ficha del cliente escribe un día. Se parte el
   * texto: no pasa por `Date`, que le pondría una hora y una zona a algo que es sólo un día.
   * Devuelve `null` si no tiene esa forma.
   */
  function diaLegible(dia) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof dia === 'string' ? dia : '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : null;
  }

  /**
   * Lo que manda quien monta, en limpio: `{ dia, nota, estado }`.
   *
   *   · sin día (`null`, sin la clave o vacío)  → no hay nada pendiente: `{ dia: null, … }`
   *   · con día y con uno de los tres estados   → la llamada
   *   · cualquier otra cosa                     → `null`: NO SE ENTIENDE, y no se pinta
   */
  function leer(llamada) {
    if (!llamada || typeof llamada !== 'object') return null;
    if (llamada.dia === null || llamada.dia === undefined || llamada.dia === '') {
      return { dia: null, nota: '', estado: null };
    }
    var estado = llamada.estado;
    var conocido = estado === ESTADOS.FUTURO || estado === ESTADOS.HOY || estado === ESTADOS.VENCIDO;
    if (!diaLegible(llamada.dia) || !conocido) return null;
    var nota = llamada.nota === null || llamada.nota === undefined ? '' : String(llamada.nota).trim();
    return { dia: llamada.dia, nota: nota, estado: estado };
  }

  /** La frase del bloque de la ficha. `null` si no hay día o no se entiende. */
  function textoDelEstado(llamada) {
    var l = leer(llamada);
    if (!l || !l.dia) return null;
    if (l.estado === ESTADOS.HOY) return TEXTOS.hoy;
    if (l.estado === ESTADOS.VENCIDO) return FRASES.vencido(diaLegible(l.dia));
    return FRASES.futuro(diaLegible(l.dia));
  }

  /**
   * La marca del cliente en la lista. Sólo cuando toca hoy o está vencida: una llamada para más
   * adelante no lleva marca. Devuelve el texto o `null`; dónde y cómo se pinta lo decide la lista.
   */
  function textoDeLaMarca(llamada) {
    var l = leer(llamada);
    if (!l || !l.dia) return null;
    if (l.estado === ESTADOS.HOY) return TEXTOS.marcaHoy;
    if (l.estado === ESTADOS.VENCIDO) return FRASES.marcaVencida(diaLegible(l.dia));
    return null;
  }

  var cuenta = 0;

  /**
   * Dibuja el bloque dentro de `contenedor` y lo deja vivo.
   *
   *   opciones.llamada  `{ dia: 'AAAA-MM-DD' | null, nota, estado }`, como la manda el servidor.
   *   opciones.guardar  `function ({ dia, nota })` → promesa que resuelve con la llamada tal
   *                     como queda en el servidor (con su `estado`). Si rechaza, no se guardó.
   *   opciones.hecho    `function ()` → promesa. Si resuelve, ya no hay llamada pendiente.
   *
   * Devuelve `true` si ha pintado y `false` si lo que llegó no se entiende.
   */
  function montar(contenedor, opciones) {
    var o = opciones || {};
    var doc = contenedor.ownerDocument || root.document;
    var actual = leer(o.llamada);
    cuenta += 1;
    var sufijo = cuenta;

    function crear(etiqueta, clase, texto) {
      var e = doc.createElement(etiqueta);
      if (clase) e.className = clase;
      if (texto !== undefined) e.textContent = texto;
      return e;
    }
    function boton(texto, clase, alPulsar) {
      var b = crear('button', 'btn ' + clase, texto);
      b.type = 'button';
      b.addEventListener('click', alPulsar);
      return b;
    }
    function vaciar() {
      while (contenedor.firstChild) contenedor.removeChild(contenedor.firstChild);
    }
    function aviso(texto) {
      var a = crear('div', 'alert error', texto);
      a.setAttribute('role', 'alert');
      return a;
    }
    function apagar(botones, apagado) {
      botones.forEach(function (b) { b.disabled = apagado; });
    }

    /** El bloque en reposo. `fallo` es el aviso de un «Hecho» que no se pudo guardar. */
    function pintarEstado(fallo) {
      vaciar();
      if (!actual) return false;
      contenedor.appendChild(crear('div', 'section-title', TEXTOS.titulo));
      var acciones = crear('div', 'form-actions');
      if (!actual.dia) {
        acciones.appendChild(boton(TEXTOS.ponerFecha, 'btn-secondary', pintarFormulario));
      } else {
        contenedor.appendChild(crear('p', '', textoDelEstado(actual)));
        if (actual.nota) contenedor.appendChild(crear('p', '', actual.nota));
        var hecho = boton(TEXTOS.hecho, 'btn-primary', function () {
          apagar([hecho, cambiar], true);
          Promise.resolve().then(function () { return o.hecho(); }).then(function () {
            actual = { dia: null, nota: '', estado: null };
            pintarEstado();
          }, function () {
            // No se ha marcado: la llamada sigue como estaba, y se dice.
            pintarEstado(TEXTOS.noGuardado);
          });
        });
        var cambiar = boton(TEXTOS.cambiar, 'btn-secondary', pintarFormulario);
        acciones.appendChild(hecho);
        acciones.appendChild(cambiar);
      }
      contenedor.appendChild(acciones);
      if (fallo) contenedor.appendChild(aviso(fallo));
      return true;
    }

    /** El formulario: día y nota. Sirve para poner la primera fecha y para cambiarla. */
    function pintarFormulario() {
      vaciar();
      contenedor.appendChild(crear('div', 'section-title', TEXTOS.titulo));

      var campoDia = crear('div', 'field');
      var rotuloDia = crear('label', '', TEXTOS.dia);
      var dia = crear('input', 'input');
      dia.type = 'date';
      dia.required = true;
      dia.id = 'volver-a-llamar-dia-' + sufijo;
      dia.value = actual.dia || '';
      rotuloDia.htmlFor = dia.id;
      campoDia.appendChild(rotuloDia);
      campoDia.appendChild(dia);

      var campoNota = crear('div', 'field');
      var rotuloNota = crear('label', '', TEXTOS.nota);
      var nota = crear('textarea');
      nota.rows = 2;
      nota.id = 'volver-a-llamar-nota-' + sufijo;
      nota.value = actual.nota || '';
      rotuloNota.htmlFor = nota.id;
      campoNota.appendChild(rotuloNota);
      campoNota.appendChild(nota);

      var acciones = crear('div', 'form-actions');
      var avisoPuesto = null;
      var guardar = boton(TEXTOS.guardar, 'btn-primary', function () {
        // Sin día no hay nada que guardar. El aviso lo pone el navegador: es su campo obligatorio.
        if (!diaLegible(dia.value)) {
          if (typeof dia.reportValidity === 'function') dia.reportValidity();
          dia.focus();
          return;
        }
        if (avisoPuesto) { contenedor.removeChild(avisoPuesto); avisoPuesto = null; }
        apagar([guardar, cancelar], true);
        var enviado = { dia: dia.value, nota: nota.value.trim() };
        Promise.resolve().then(function () { return o.guardar(enviado); }).then(function (guardada) {
          // Se pinta lo que DEVUELVE el servidor, no lo tecleado: el estado sólo lo sabe él. Si lo
          // devuelto no se entiende, o viene sin día (acaba de guardarse uno), el bloque se queda
          // vacío: se guardó, pero decir aquí cuándo toca sería adivinarlo, y ofrecer «Poner
          // fecha» sería decir que no hay ninguna.
          var leida = leer(guardada);
          actual = leida && leida.dia ? leida : null;
          pintarEstado();
        }, function () {
          // No se ha guardado: el formulario sigue abierto con lo escrito, y se dice.
          avisoPuesto = aviso(TEXTOS.noGuardado);
          contenedor.appendChild(avisoPuesto);
          apagar([guardar, cancelar], false);
        });
      });
      var cancelar = boton(TEXTOS.cancelar, 'btn-secondary', function () { pintarEstado(); });
      acciones.appendChild(guardar);
      acciones.appendChild(cancelar);

      contenedor.appendChild(campoDia);
      contenedor.appendChild(campoNota);
      contenedor.appendChild(acciones);
      dia.focus();
    }

    return pintarEstado();
  }

  var api = {
    ESTADOS: ESTADOS,
    TEXTOS: TEXTOS,
    FRASES: FRASES,
    diaLegible: diaLegible,
    leer: leer,
    textoDelEstado: textoDelEstado,
    textoDeLaMarca: textoDeLaMarca,
    montar: montar,
  };

  root.clienteVolverALlamar = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
