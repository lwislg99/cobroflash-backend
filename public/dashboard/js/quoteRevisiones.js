// public/dashboard/js/quoteRevisiones.js — SCRUM-655c (fila 9) · LAS REVISIONES, EN PANTALLA.
//
// Los presupuestos de Tecnosel se numeran `P2004226.1`: ese «.1» es una REVISIÓN. El cliente pide
// un cambio, se rehace, y **el número base no cambia**. Aquí se ve cuáles hay y cuál está vigente.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL INVARIANTE DE ESTE FICHERO, Y ES EL ÚNICO QUE IMPORTA:
//
//     ESTA PANTALLA NO DECIDE CUÁL ES LA VIGENTE. LA PINTA.
//
// El servidor ya contesta esa pregunta (`vistaDeRevisiones` → `revisiones[].vigente` y
// `vigenteId`), y contestarla otra vez aquí sería tener DOS criterios para un mismo hecho. Cuando
// dos sitios deciden lo mismo acaban discrepando, y el que se equivoca es el de la pantalla.
//
// ⚠️ Y NO ES UNA PREFERENCIA DE ESTILO: está MEDIDO. `esVigente(q, grupo)` compara
// `{numero, revisión}`, así que **ante un empate las DOS filas contestan `true`** — ejecutado el
// 3-sep-2026:
//
//     esVigente(A) → true          esVigente(B) → true        ← las dos «soy la vigente»
//     vigenteUnicaDe(empate) → LANZA RevisionesAmbiguas
//     vigenteUnicaDe([])     → LANZA CensoDeRevisionesCiego
//
// El empate ya está resuelto **un nivel más arriba**: `vistaDeRevisiones` llama a `vigenteUnicaDe`
// ANTES de mapear, así que un grupo ambiguo no llega nunca a pintarse — falla en el servidor, con
// las dos nombradas. Si esta pantalla derivara la vigente por su cuenta, se saltaría esa puerta y
// **pintaría dos vigentes sin que nada fallara**.
//
// Por eso aquí no hay ni una comparación de `revision`: ni `Math.max`, ni `>`, ni un `sort` por
// revisión. Lo que llega, se pinta. Es más barato que un mecanismo que hay que comprobar.
// ═══════════════════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ✅ MICROCOPY APROBADA por el fundador el 3-sep-2026 (regla 30), LAS SEIS SIN UN CAMBIO.
  // Consta en `docs/MICROCOPY_APROBADA_SIN_APLICAR.md`, addendum «Revisiones del presupuesto
  // (3-sep-2026)», con su ancla contra `origin/main` y comparadas byte a byte con estas.
  //
  // Se propusieron con las palabras que el gerente ya usa —«revisión», y el número tal cual,
  // `P2004226.1`— porque son las del papel que le manda al cliente.
  //
  // 🔴 `ciego` NO ES «no tiene revisiones»: es «no se ha podido leer la lista». Son la misma caja
  // vacía en pantalla y significan lo contrario, y por eso son dos textos y no uno. Es el suelo de
  // ceguera aplicado a un rótulo: decir mal esa frase manda al cliente una versión creyendo que no
  // hay otra. Va en voz pasiva, como los avisos del dictado y los de las cláusulas.
  var TEXTOS = {
    titulo: 'Revisiones',
    vigente: 'Vigente',
    firmado: 'Firmada',
    verEsta: 'Ver',
    sinOtras: 'Esta es la única versión.',
    ciego: 'No se ha podido leer el historial de revisiones.',
  };

  // ⛔⛔ PENDIENTE DE MICROCOPY DEL FUNDADOR · SCRUM-688 · regla 30 ⛔⛔
  //
  // El botón de crear revisión necesita SU TEXTO, y el microcopy es del fundador: esta sesión NO
  // lo escribe. Va aparte de `TEXTOS` a propósito —ese bloque son las SEIS aprobadas el
  // 3-sep-2026 y no se mezcla lo aprobado con lo que no lo está— y lleva un centinela que se ve
  // en pantalla: si esto llega a producción sin sustituir, se lee solo.
  //
  // Lo mismo para `errorCrear`: el aviso de que no se ha podido crear también es microcopy.
  //
  // 🔴 `tests/scrum688-crear-revision.test.mjs` exige que el centinela siga aquí mientras el texto
  // no esté aprobado, y que NO se cuele en `TEXTOS`. Cuando el fundador los escriba, se mueven a
  // `TEXTOS` con su ancla en `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` como las otras seis.
  var TEXTOS_SIN_APROBAR = {
    crearRevision: '⛔ PENDIENTE DE MICROCOPY (SCRUM-688)',
    errorCrear: '⛔ PENDIENTE DE MICROCOPY (SCRUM-688)',
  };

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * 🔴 EL SUELO: cero revisiones es CEGUERA, no «este presupuesto no tiene otras versiones».
   *
   * Todo presupuesto es al menos la suya. Un cero aquí significa que el grupo se armó mal —agrupar
   * por un `quoteNumber` nulo mete a todos los sin numerar en el mismo saco, o en ninguno—, y con
   * él la pantalla diría «esta es la única versión» de un documento que sí tiene más. Que es
   * exactamente la frase que no se puede decir mal: el profesional mandaría al cliente una versión
   * creyendo que no hay otra.
   *
   * Devuelve `null` cuando no se puede afirmar nada, y el llamador pinta el aviso de ciego.
   */
  function revisionesOCeguera(datos) {
    if (!datos || !Array.isArray(datos.revisiones) || datos.revisiones.length === 0) return null;
    return datos.revisiones;
  }

  /** ¿Se puede editar ESTA versión? Una firmada, NO: pedir cambios sobre ella crea una nueva. */
  function puedeEditarse(fila) {
    return !(fila && fila.firmado);
  }

  function filaDeRevision(fila, esLaAbierta) {
    // `fila.vigente` viene DEL SERVIDOR. No se recalcula aquí: ver la cabecera.
    return '' +
      '<li data-revision-fila="' + esc(fila.id) + '"' +
      (fila.vigente ? ' data-revision-vigente="1"' : '') +
      ' style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)">' +
      '<span style="flex:1;font-weight:' + (esLaAbierta ? '700' : '400') + '">' +
      esc(fila.numero) + '</span>' +
      (fila.vigente
        ? '<span data-revision-etiqueta="vigente" style="font-size:12px;color:var(--ok)">' +
          esc(TEXTOS.vigente) + '</span>'
        : '') +
      (fila.firmado
        ? '<span data-revision-etiqueta="firmada" style="font-size:12px;color:var(--muted)">' +
          esc(TEXTOS.firmado) + '</span>'
        : '') +
      (esLaAbierta
        ? ''
        : '<a data-revision-ver="' + esc(fila.id) + '" href="#/presupuestos/' + esc(fila.id) + '"' +
          ' style="font-size:13px">' + esc(TEXTOS.verEsta) + '</a>') +
      '</li>';
  }

  /**
   * Pinta el bloque de revisiones. Devuelve `true` si pintó la lista, `false` si tuvo que declarar
   * que no puede leerla — para que el llamador sepa cuál de las dos cosas pasó.
   *
   * ⛔ ESTA PANTALLA NO DECIDE, PINTA — y desde SCRUM-688 ofrece UNA acción: crear una revisión.
   * El POST está aprobado por el fundador (15-sep-2026) y lo atiende
   * `POST /admin/quotes/:id/revisiones`. Sigue sin haber aquí ningún camino que EDITE una versión:
   * la revisión no es un rodeo a `puedeEditarse`, es la salida que faltaba cuando la anterior ya
   * está firmada y no se puede tocar.
   */
  function pintarRevisiones(contenedor, datos, idAbierta) {
    if (!contenedor) return false;

    var filas = revisionesOCeguera(datos);
    if (filas === null) {
      contenedor.innerHTML = '<p data-revisiones-ciego="1" style="font-size:13px;color:var(--muted)">' +
        esc(TEXTOS.ciego) + '</p>';
      return false;
    }

    // 🔴 SOBRE LA VIGENTE, NO SOBRE LA ABIERTA. Revisar una versión vieja heredaría SU contenido y
    // perdería lo que se cambió después sin decir nada. La vigente la decide el SERVIDOR
    // (`vigenteId`), igual que el resto de este fichero: aquí no se recalcula.
    var vigente = null;
    for (var k = 0; k < filas.length; k += 1) if (filas[k].vigente) vigente = filas[k];

    // Una sola versión: se dice, y no se pinta un selector de una cosa. Pero SÍ se puede revisar:
    // es el caso más común —un presupuesto con una única versión a la que el cliente pide cambios.
    if (filas.length === 1) {
      contenedor.innerHTML = '<p data-revisiones-unica="1" style="font-size:13px;color:var(--muted)">' +
        esc(TEXTOS.sinOtras) + '</p>' + botonCrearRevision(vigente || filas[0]);
      return true;
    }

    contenedor.innerHTML =
      '<h4 style="margin:12px 0 4px;font-size:13px;color:var(--muted)">' + esc(TEXTOS.titulo) + '</h4>' +
      '<ul data-revisiones-lista="1" style="list-style:none;margin:0;padding:0">' +
      filas.map(function (f) { return filaDeRevision(f, f.id === idAbierta); }).join('') +
      '</ul>' + botonCrearRevision(vigente);
    return true;
  }

  /**
   * El botón que crea una revisión de la VIGENTE. Sin vigente no se pinta: un botón que no sabe
   * sobre qué versión actúa es peor que no tenerlo.
   */
  function botonCrearRevision(vigente) {
    if (!vigente || vigente.id == null) return '';
    return '<button type="button" class="btn btn-ghost" data-revision-crear="' + esc(vigente.id) + '"' +
      ' style="margin-top:8px;font-size:13px">' + esc(TEXTOS_SIN_APROBAR.crearRevision) + '</button>';
  }

  /**
   * Cablea el botón: POST a la ruta y, si sale bien, se avisa al llamador con la revisión creada.
   *
   * `pedir` se inyecta para poder ejercitarlo sin red; en la pantalla real es `window.apiRequest`.
   * Devuelve `false` si no había botón que cablear, para que quien lo llame sepa cuál de las dos
   * cosas pasó en vez de suponerlo.
   */
  function cablearCrearRevision(contenedor, alCrear, pedir) {
    if (!contenedor) return false;
    var btn = contenedor.querySelector('[data-revision-crear]');
    if (!btn) return false;
    var api = pedir || (typeof window !== 'undefined' ? window.apiRequest : null);
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-revision-crear');
      btn.disabled = true; // que dos clics no creen dos revisiones
      Promise.resolve()
        .then(function () { return api('/admin/quotes/' + id + '/revisiones', { method: 'POST' }); })
        .then(function (r) { if (typeof alCrear === 'function') alCrear(r); })
        .catch(function (e) {
          btn.disabled = false;
          // El motivo NO se inventa: si el servidor manda uno, se enseña el suyo.
          var msg = (e && e.message) ? e.message : TEXTOS_SIN_APROBAR.errorCrear;
          var aviso = document.createElement('p');
          aviso.setAttribute('data-revision-error', '1');
          aviso.style.cssText = 'font-size:13px;color:var(--danger,#b3261e)';
          aviso.textContent = msg;
          contenedor.appendChild(aviso);
        });
    });
    return true;
  }

  // Frontend vanilla, sin bundler: se publica en `window` como el resto del dashboard.
  window.pintarRevisiones = pintarRevisiones;
  window.revisionesOCeguera = revisionesOCeguera;
  window.puedeEditarseLaRevision = puedeEditarse;
  window.REVISIONES_TEXTOS = TEXTOS;
  // SCRUM-688 · el cableado de crear, y el bloque de textos que AÚN NO están aprobados —se
  // publica para que el guard pueda comprobar que el centinela sigue puesto.
  window.cablearCrearRevision = cablearCrearRevision;
  window.REVISIONES_TEXTOS_SIN_APROBAR = TEXTOS_SIN_APROBAR;
})();
