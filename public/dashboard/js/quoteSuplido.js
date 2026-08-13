// public/dashboard/js/quoteSuplido.js — SCRUM-500 (A2-c)
//
// LA CASILLA «SUPLIDO» DE UNA LÍNEA, EN FUNCIONES PURAS.
//
// Por qué vive aquí y no dentro de `quotesView.js`: mismo motivo que `quoteMargen.js` (SCRUM-229)
// —`quotesView.js` es un módulo de navegador que `node:test` no puede importar, así que lo único
// que se le puede exigir es la FORMA de su fuente—. Y aquí lo que hay que exigir es
// COMPORTAMIENTO: que marcar una línea como suplido le quite el IVA. Un guard de forma pasaría
// mientras el IVA sigue puesto, que es justo el error que esto viene a impedir.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LO QUE ESTA CASILLA HACE HOY, Y LO QUE NO
//
//   HACE   ·  quita el IVA de esa línea (la deja al 0 %) y marca la línea en el JSON.
//   NO HACE·  sacarla de la base imponible del documento. Eso cambia la base y el total que se
//             SELLAN, y es camino de emisión (regla 38): necesita GO del fundador.
//
// La mitad que sí está viva es la que cuesta dinero: hoy un suplido puesto como línea normal se
// factura al 21 %, o sea IVA sobre un impuesto. Con la casilla, eso deja de pasar. Lo que queda
// pendiente es clasificación —dónde figura ese importe en el desglose—, no euros cobrados de más.
//
// La aritmética completa (fuera de base, sin IVA, dentro del total) vive en el dominio:
// `src/modules/invoicing/domain/suplidos.ts`.
(function (root) {
  'use strict';

  /**
   * LA CLAVE de la marca dentro de la línea. Tiene que ser LA MISMA que `MARCA_SUPLIDO` de
   * `suplidos.ts`: si se separan, la casilla marca algo que el cálculo no lee y nadie se entera.
   * `tests/scrum500-suplidos.test.mjs` compara las dos y falla si divergen.
   */
  var MARCA_SUPLIDO = 'suplido';

  /**
   * Microcopy PENDIENTE DE APROBACIÓN (regla 30). El marcador va DELANTE del texto, no en vez del
   * texto: un rótulo provisional que se lee bien se queda para siempre, y éste además tiene que
   * poder probarse con el aviso real dentro.
   *
   * 🔴 Y NO ES COSMÉTICO: es el texto que evita un error fiscal en el segundo exacto en que se
   * está cometiendo. La frontera que separa un suplido de un material propio es invisible desde
   * el editor de líneas, y equivocarse no da ningún síntoma — la factura sale igual de bonita.
   */
  var MARCADOR_MICROCOPY = '[PENDIENTE microcopy oficial]';
  var ROTULO_SUPLIDO = MARCADOR_MICROCOPY + ' Suplido (pagado por cuenta del cliente)';
  var AVISO_SUPLIDO =
    MARCADOR_MICROCOPY +
    ' Lo que has pagado POR CUENTA del cliente y le repercutes tal cual: una tasa, un visado, ' +
    'una licencia. No lleva IVA ni margen. El material que compras tú NO es un suplido: ese se ' +
    'vende con su IVA.';

  /**
   * ¿Está marcada como suplido? Solo el booleano `true` cuenta.
   *
   * Un `'sí'`, un `1` o un `'true'` NO se interpretan: la casilla escribe booleanos y nada más, y
   * adivinar aquí sería inventar el criterio en un segundo sitio. El que decide qué hacer con una
   * marca ilegible es el dominio (`leerMarcaSuplido`), que la declara ilegible en vez de darla por
   * falsa.
   */
  function esSuplido(valor) {
    return valor === true;
  }

  /**
   * LA LÍNEA COMO SALE HACIA EL SERVIDOR.
   *
   * 🔴 EL IVA SE FUERZA AQUÍ, NO SE CONFÍA A LA PANTALLA. La casilla también deshabilita el
   * input de IVA, pero eso es la interfaz: un borrador restaurado, una plantilla, el
   * autocompletado de un producto o la IA pueden dejar un `tax` puesto en una línea marcada sin
   * pasar por ese input. Si el IVA se quitara solo al hacer clic, bastaría con no hacer clic.
   *
   * Devuelve una línea NUEVA — no muta la que entra: la que entra la siguen leyendo el borrador y
   * la vista previa.
   */
  function lineaParaPayload(linea) {
    var l = linea || {};
    var marcada = esSuplido(l[MARCA_SUPLIDO]);
    var salida = {};
    for (var k in l) if (Object.prototype.hasOwnProperty.call(l, k)) salida[k] = l[k];
    if (!marcada) {
      // Una línea normal sale EXACTAMENTE como entró: ni la marca en `false` se añade. Menos
      // ruido en el JSON, y `leerMarcaSuplido` ya trata la ausencia como «no es suplido».
      delete salida[MARCA_SUPLIDO];
      return salida;
    }
    salida[MARCA_SUPLIDO] = true;
    salida.tax = 0; // regla ②: un suplido no lleva IVA. Nunca.
    return salida;
  }

  /** Lo que el botón de ajustes dice cuando la línea es un suplido (en vez de «IVA 21 %»). */
  function resumenAjustes(marcada, ivaPerc, margenPerc) {
    if (marcada) return MARCADOR_MICROCOPY + ' Suplido · sin IVA';
    var partes = ['IVA ' + ivaPerc + ' %'];
    if (margenPerc > 0) partes.push('Margen ' + margenPerc + ' %');
    return partes.join(' · ');
  }

  root.MARCA_SUPLIDO = MARCA_SUPLIDO;
  root.ROTULO_SUPLIDO = ROTULO_SUPLIDO;
  root.AVISO_SUPLIDO = AVISO_SUPLIDO;
  root.esSuplido = esSuplido;
  root.lineaParaPayload = lineaParaPayload;
  root.resumenAjustes = resumenAjustes;
})(typeof window !== 'undefined' ? window : globalThis);
