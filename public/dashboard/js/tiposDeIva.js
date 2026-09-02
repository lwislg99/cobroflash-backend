// public/dashboard/js/tiposDeIva.js — SCRUM-611 (DOC-16)
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LOS TIPOS DEL SELECTOR DE LA LÍNEA, EN UN SOLO SITIO.
//
// CAT-01 sacó el IVA del producto, así que el tipo se fija en la LÍNEA del documento. Y el 10 %
// es habitual en obras de renovación en vivienda: teclearlo cada vez es fricción en la pantalla
// que el máster quiere resolver en 30 segundos.
//
// ── 🔴 ESTA LISTA ES LA ESPAÑOLA, Y ESO NO ES UN DETALLE ──────────────────────────────────
// 21 · 10 · 4 · 0 son los tipos del IVA peninsular. En Canarias se repercute IGIC, con tipos
// PROPIOS distintos; en Ceuta y Melilla, IPSI. Está en UN SITIO para que el día que entre
// SCRUM-646 no haya que buscarlo en cinco — el mismo criterio que `taxName` en SCRUM-623.
//
// ⛔ Y NO SALE DE `locale.defaultVat`, a propósito. Aquello está indexado por PAÍS y Canarias es
// `ES`: le daría 21 a un canario. Además toma 0,16 · 0,18 · 0,19 (MX, PE/CL, CO), que NO son
// tipos españoles — o sea que ni siquiera sirve como fuente de esta lista.
//
// ── ⚠️ EL SELECTOR NO PUEDE SER CERRADO, Y ESTO SE MIDIÓ ANTES DE ESCRIBIRLO ──────────────
// Hoy el campo es texto libre, y le llegan valores que NO están en la lista española:
//   · `products.routes.ts:47` estampa `locale.defaultVat` en el catálogo por gremio → 16, 18, 19;
//   · el «IVA por defecto» del documento es otro campo LIBRE (`quotesView.js:385`);
//   · las plantillas y la IA traen `tax` en fracción, sin acotar.
//
// 🔴 Un selector que sólo admitiera los cuatro tendría que hacer ALGO con un 16 %, y cualquier
// cosa que no sea ENSEÑARLO cambia el IVA de una línea sin que nadie lo pida. Eso es dinero.
// Por eso: los cuatro SIEMPRE, y el valor de la línea TAMBIÉN si no es ninguno de ellos.
// Nada se ajusta al vecino más cercano, nada se pierde.
//
// ── EL RÓTULO ─────────────────────────────────────────────────────────────────────────────
// NO hay microcopy nueva y por eso no hay marcador: la etiqueta del campo sigue siendo la que ya
// estaba aprobada, y las opciones son NÚMEROS, que son dato. Poner un marcador donde hay copy
// aprobada la SUSTITUIRÍA por un provisional, que es peor. Si el fundador quiere otra palabra,
// entonces sí entra con marcador y el censo sube.
// ═══════════════════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  /** Los tipos del IVA ESPAÑOL. Un solo sitio. */
  var TIPOS_ES = [21, 10, 4, 0];

  /**
   * El número que representa un valor, o `null` si no representa ninguno.
   * Acepta la coma decimal porque el campo que esto sustituye la aceptaba.
   */
  function normalizar(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    var n = Number(String(valor).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Las opciones que debe tener el selector para PODER enseñar `valorActual` sin ajustarlo.
   *
   * 🔴 Devuelve SIEMPRE los cuatro españoles, y añade el valor de la línea si no es uno de ellos.
   * Ordena descendente para que el 21 quede arriba, que es el que más se usa.
   */
  function opciones(valorActual) {
    var n = normalizar(valorActual);
    var out = TIPOS_ES.slice();
    if (n !== null && out.indexOf(n) === -1) out.push(n);
    return out.sort(function (a, b) { return b - a; });
  }

  /** ¿Este valor es uno de los tipos españoles? Para poder decirlo sin repetir la lista. */
  function esEspanol(valor) {
    var n = normalizar(valor);
    return n !== null && TIPOS_ES.indexOf(n) !== -1;
  }

  // ── Lo que sigue toca DOM y por eso va aparte: lo de arriba se puede ejecutar en la suite ──

  /** Pinta las opciones de un `<select>` a partir de la lista. No decide el valor. */
  function pintarOpciones(select, lista) {
    select.innerHTML = '';
    lista.forEach(function (t) {
      var op = document.createElement('option');
      op.value = String(t);
      op.textContent = String(t); // número pelado: es exactamente lo que enseñaba el input
      select.appendChild(op);
    });
  }

  /**
   * Escribe un valor en el selector AÑADIENDO su opción si no la tiene.
   *
   * Es la pieza que hace que sustituir el `<input>` no cambie ningún comportamiento: los seis
   * sitios que escribían `vatInput.value` siguen pudiendo escribir CUALQUIER número, y el que no
   * esté en la lista aparece en vez de perderse. Sin esto, un 16 % dejaría el selector en blanco.
   */
  function ponerValor(select, valor) {
    var n = normalizar(valor);
    if (n === null) { select.value = ''; return; }
    pintarOpciones(select, opciones(n));
    select.value = String(n);
  }

  function montar(valorInicial) {
    var select = document.createElement('select');
    pintarOpciones(select, opciones(valorInicial));
    ponerValor(select, valorInicial);
    return select;
  }

  var api = {
    TIPOS_ES: TIPOS_ES.slice(),
    normalizar: normalizar,
    opciones: opciones,
    esEspanol: esEspanol,
    pintarOpciones: pintarOpciones,
    ponerValor: ponerValor,
    montar: montar,
  };

  // El `typeof window` es lo que permite que la suite CARGUE este fichero y EJECUTE `opciones` de
  // verdad. Sin él, cargarlo fuera del navegador peta y la regla sólo podría auditarse leyéndola.
  if (typeof window !== 'undefined') window.tiposDeIva = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}());
