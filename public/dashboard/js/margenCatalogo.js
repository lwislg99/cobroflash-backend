// public/dashboard/js/margenCatalogo.js — SCRUM-609 (CAT-01)
//
// EL MARGEN DEL CATÁLOGO. Sólo la aritmética, sin DOM: así se prueba en `npm test` sin navegador,
// que es donde hay red para el dashboard (los nueve guards no lo cubren — SCRUM-628).
//
// ── 🔴 LA FÓRMULA VA SOBRE EL PRECIO DE VENTA, Y NO ES UN DETALLE ────────────────────────────
//
//     margen % = (precio − coste) / precio × 100
//
// Decidida por el fundador el 24-ago-2026. El mismo artículo da números MUY distintos según sobre
// qué se calcule, y por eso se escribe aquí con su caso:
//
//     detector de humos, coste 300 y precio 1000
//       sobre PRECIO  → (1000−300)/1000 = 70 %      ← ésta
//       sobre COSTE   → (1000−300)/300  = 233,3 %   ← NO
//
// Un guard con el caso 300/1000 vigila justo esa confusión: si alguien cambia el divisor, el
// número no se parece al anterior y el test lo nombra.
//
// ── 🔴 NI EL COSTE NI EL MARGEN SON OBLIGATORIOS ─────────────────────────────────────────────
// Medido en SCRUM-609: de los 8 productos que existen en desarrollo, **8 no tienen coste**. Si el
// margen se volviera obligatorio, el catálogo que ya existe dejaría de poder guardarse. «Sólo
// precio» es un caso VÁLIDO y no calcula nada: devuelve `null`, que significa «no se sabe», no 0.
(function () {
  'use strict';

  var round2 = function (n) { return Math.round((n + Number.EPSILON) * 100) / 100; };

  /** ¿Es un número utilizable? `null`, `''`, `undefined` y `NaN` NO lo son. */
  function hayNumero(v) {
    if (v === null || v === undefined || v === '') return false;
    var n = Number(v);
    return Number.isFinite(n);
  }

  /**
   * Margen a partir de coste y precio. `null` cuando no se puede saber — nunca 0.
   *
   * 🔴 Con `coste = 0` y `precio > 0` da **100 %**, y eso NO es un caso especial escrito a mano:
   * sale solo de la fórmula, (P−0)/P = 1. Se prueba justamente porque es el caso que distingue
   * esta convención de la otra: sobre coste, dividir por 0 sería infinito.
   */
  function margenDesde(coste, precio) {
    if (!hayNumero(coste) || !hayNumero(precio)) return null;
    var c = Number(coste);
    var p = Number(precio);
    if (p <= 0) return null; // sin precio de venta no hay margen que calcular, y no se divide por 0
    return round2(((p - c) / p) * 100);
  }

  /**
   * ¿Este margen dice que el artículo se vende POR DEBAJO DEL COSTE? (SCRUM-764)
   *
   * 🔴 LA REGLA VIVE AQUÍ Y NO EN LA VISTA, por lo mismo que la fórmula: si cada pantalla decide
   * por su cuenta qué cuenta como «va mal», acaban decidiendo distinto. Aquí se escribe una vez y
   * se prueba sin navegador.
   *
   * 🔴 `null` NO ES «VA MAL», ES «NO SE SABE», y la diferencia es la que sostiene todo este
   * módulo: sin coste no hay margen que calcular (medido en SCRUM-609: 8 de 8 productos de
   * desarrollo no tienen coste). Un catálogo entero sin costes no puede salir en rojo, porque no
   * está diciendo nada malo — no está diciendo nada. Por eso lo que no es un número utilizable
   * devuelve `false`, no `true`.
   *
   * ⚠️ Y ESTO NO IMPIDE NADA. Vender por debajo del coste es una decisión legítima del
   * profesional —una oferta gancho, un trabajo que se quiere ganar— y el catálogo tiene que poder
   * guardarla. Lo que no puede es guardarla EN SILENCIO. Quien decide qué hacer con este `true`
   * es la pantalla, y lo único que hace es que se vea.
   */
  function bajoCoste(margen) {
    if (!hayNumero(margen)) return false;
    return Number(margen) < 0;
  }

  /**
   * Precio a partir de coste y margen. Inversa exacta de la de arriba:
   *   m = (p−c)/p·100  →  p = c / (1 − m/100)
   *
   * Con margen 100 % el denominador es 0: no hay precio que lo cumpla salvo con coste 0, así que
   * se devuelve `null` en vez de un infinito disfrazado. Y con margen ≥ 100 tampoco.
   */
  function precioDesde(coste, margen) {
    if (!hayNumero(coste) || !hayNumero(margen)) return null;
    var c = Number(coste);
    var m = Number(margen);
    if (m >= 100) return null;
    var denom = 1 - (m / 100);
    if (denom <= 0) return null;
    return round2(c / denom);
  }

  /**
   * QUÉ AUTOCOMPLETA QUÉ, en un solo sitio para que la vista no lo decida.
   * Devuelve `{ precio, margen }` con lo que haya que ESCRIBIR, o `null` en el campo que no toca.
   *
   *   coste + margen  → precio
   *   coste + precio  → margen
   *   sólo precio     → NADA (los dos `null`). Es válido.
   *
   * `cambiado` dice qué campo acaba de tocar el usuario, para no pisarle lo que está escribiendo.
   */
  function autocompletar(v, cambiado) {
    var coste = v && v.coste;
    var precio = v && v.precio;
    var margen = v && v.margen;
    var vacio = { precio: null, margen: null };

    if (!hayNumero(coste)) return vacio; // sin coste no hay nada que derivar. Sólo precio: válido.

    if (cambiado === 'margen' && hayNumero(margen)) return { precio: precioDesde(coste, margen), margen: null };
    if (cambiado === 'precio' && hayNumero(precio)) return { precio: null, margen: margenDesde(coste, precio) };

    // Cambió el coste: se recalcula lo que se pueda, dando preferencia al precio si lo hay —
    // el precio es lo que el cliente paga y lo que el profesional ya escribió.
    if (hayNumero(precio)) return { precio: null, margen: margenDesde(coste, precio) };
    if (hayNumero(margen)) return { precio: precioDesde(coste, margen), margen: null };
    return vacio;
  }

  var api = {
    margenDesde: margenDesde,
    precioDesde: precioDesde,
    autocompletar: autocompletar,
    bajoCoste: bajoCoste,
    hayNumero: hayNumero,
  };

  if (typeof window !== 'undefined') window.margenCatalogo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
