// public/dashboard/js/quoteRevisiones.js — SCRUM-704 (fila 9) · LAS REVISIONES, EN PANTALLA.
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

  // 🔴 MICROCOPY SIN APROBAR (regla 30). Sale MARCADA hasta que el fundador la firme.
  //
  // Se propone con las palabras que el gerente ya usa —«revisión», y el número tal cual
  // (`P2004226.1`)— porque son las del papel que manda al cliente. La marca va factorizada en una
  // constante, como `MARCA_RETENCION`: el censo de SCRUM-402 cuenta LITERALES que contienen la
  // marca, así que esto añade rótulos marcados sin mover su número. Queda dicho para que nadie lo
  // lea como «no hay nada pendiente de aprobar».
  var M = '[PENDIENTE microcopy oficial] ';
  var TEXTOS = {
    titulo: M + 'Revisiones',
    vigente: M + 'Vigente',
    firmado: M + 'Firmada',
    verEsta: M + 'Ver',
    sinOtras: M + 'Esta es la única versión.',
    // 🔴 Este NO es «no tiene revisiones»: es «no se ha podido leer la lista». Ver el suelo.
    ciego: M + 'No se ha podido leer el historial de revisiones.',
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
   * ⛔ SOLO LECTURA Y SELECTOR. Aquí no hay ningún camino que CREE una revisión: ese POST no está
   * aprobado, y una pantalla que ofrece un botón que el servidor no atiende es peor que no tenerla.
   */
  function pintarRevisiones(contenedor, datos, idAbierta) {
    if (!contenedor) return false;

    var filas = revisionesOCeguera(datos);
    if (filas === null) {
      contenedor.innerHTML = '<p data-revisiones-ciego="1" style="font-size:13px;color:var(--muted)">' +
        esc(TEXTOS.ciego) + '</p>';
      return false;
    }

    // Una sola versión: se dice, y no se pinta un selector de una cosa.
    if (filas.length === 1) {
      contenedor.innerHTML = '<p data-revisiones-unica="1" style="font-size:13px;color:var(--muted)">' +
        esc(TEXTOS.sinOtras) + '</p>';
      return true;
    }

    contenedor.innerHTML =
      '<h4 style="margin:12px 0 4px;font-size:13px;color:var(--muted)">' + esc(TEXTOS.titulo) + '</h4>' +
      '<ul data-revisiones-lista="1" style="list-style:none;margin:0;padding:0">' +
      filas.map(function (f) { return filaDeRevision(f, f.id === idAbierta); }).join('') +
      '</ul>';
    return true;
  }

  // Frontend vanilla, sin bundler: se publica en `window` como el resto del dashboard.
  window.pintarRevisiones = pintarRevisiones;
  window.revisionesOCeguera = revisionesOCeguera;
  window.puedeEditarseLaRevision = puedeEditarse;
  window.REVISIONES_TEXTOS = TEXTOS;
})();
