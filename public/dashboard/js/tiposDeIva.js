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
      // SCRUM-1636 ① · el número que se LEE va con coma («7,5»), con el criterio de SCRUM-1608
      // (`fmtTipoIvaEs`, de api.js, que carga antes); el `value` sigue con punto, que es lo que se guarda.
      op.textContent = fmtTipoIvaEs(Number(t) / 100);
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
    if (n === null) { select.value = ''; refrescarAvisoIvaAlDiez(select); return; }
    pintarOpciones(select, opciones(n));
    select.value = String(n);
    refrescarAvisoIvaAlDiez(select);
  }

  // ── SCRUM-1804 (PARTE S de SCRUM-1316) · EL AVISO AL ELEGIR EL 10 % ──────────────────────
  // RDL 29/2026: desde el 1-dic-2026 el 10 % en obras de vivienda depende de cómo pague el
  // cliente. Al elegirlo, en la línea o en «IVA por defecto», se AVISA debajo. Es un aviso y nada
  // más: no bloquea, no cambia el tipo elegido y no toca ningún cálculo.
  //
  // 🔴 EL TEXTO NO SE ESCRIBE AQUÍ (regla 39). Es `window.COPY_IVA_10.avisoEfectivo`, la constante
  // de `invoicesView.js` (J1) que ya enseñan la ficha de factura y el lote: la redacción de
  // SCRUM-1316 c.22424, la única que hay en main (medido el 24-nov, registro SCRUM-1804). Sin esa
  // constante no hay aviso: la pantalla no inventa uno.
  //
  // Va AQUÍ y no en quotesView.js porque el valor del selector lo escriben muchos sitios por
  // `ponerValor` (borrador, plantilla, IA, autocompletado, suplido) y ninguno dispara `change`:
  // el aviso sigue al VALOR, no al clic.

  /** ¿El valor pide el aviso? Solo el 10 % exacto. PURO. */
  function avisoIvaAlDiezVisible(valor) {
    return normalizar(valor) === 10;
  }

  function textoAvisoIvaAlDiez() {
    var c = typeof window !== 'undefined' ? window.COPY_IVA_10 : null;
    return c && typeof c.avisoEfectivo === 'string' && c.avisoEfectivo ? c.avisoEfectivo : null;
  }

  var avisosConectados = 0;

  /**
   * El aviso NACE la primera vez que hace falta, no al montar: un editor al 21 % pinta los mismos
   * nodos que antes de este ticket (lo vigilan `scrum697`/`scrum698`). Una vez creado se queda y se
   * oculta/enseña. Componente del inventario AB3 (`.alert.warning`), `hidden` y no `style=` (CSP).
   */
  function refrescarAvisoIvaAlDiez(select) {
    var enlace = select && select._avisoIvaAlDiez;
    if (!enlace) return;
    var texto = textoAvisoIvaAlDiez();
    var aviso = enlace.aviso;
    if (!aviso) {
      if (!(texto && avisoIvaAlDiezVisible(select.value))) return;
      aviso = document.createElement('p');
      aviso.className = 'alert warning';
      aviso.setAttribute('role', 'status');
      avisosConectados += 1;
      aviso.id = 'aviso-iva-10-' + avisosConectados;
      enlace.contenedor.appendChild(aviso);
      select.setAttribute('aria-describedby', aviso.id);
      enlace.aviso = aviso;
    }
    if (texto && aviso.textContent !== texto) aviso.textContent = texto;
    aviso.hidden = !(texto && avisoIvaAlDiezVisible(select.value));
  }

  /**
   * Ata el aviso del 10 % a `select`, para colgarlo de `contenedor` cuando haga falta. Devuelve
   * `true`, o `false` si ya estaba atado (conectar dos veces no pinta dos avisos).
   */
  function conectarAvisoIvaAlDiez(select, contenedor) {
    if (!select || !contenedor || select._avisoIvaAlDiez) return false;
    select._avisoIvaAlDiez = { contenedor: contenedor, aviso: null };
    select.addEventListener('change', function () { refrescarAvisoIvaAlDiez(select); });
    refrescarAvisoIvaAlDiez(select);
    return true;
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
    avisoIvaAlDiezVisible: avisoIvaAlDiezVisible, // SCRUM-1804
    conectarAvisoIvaAlDiez: conectarAvisoIvaAlDiez, // SCRUM-1804
  };

  // El `typeof window` es lo que permite que la suite CARGUE este fichero y EJECUTE `opciones` de
  // verdad. Sin él, cargarlo fuera del navegador peta y la regla sólo podría auditarse leyéndola.
  if (typeof window !== 'undefined') window.tiposDeIva = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}());
