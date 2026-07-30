// public/dashboard/js/quoteMargen.js — SCRUM-229
//
// EL MARGEN AGREGADO DEL PIE DE TOTALES, en dos funciones PURAS.
//
// Por qué viven aquí y no dentro de `recalcTotals()`: el rojo que justifica este ticket es de
// COMPORTAMIENTO —«una línea con markup no numérico produce “· 1 línea sin calcular”»— y
// `quotesView.js` es un módulo de navegador que `node:test` no puede importar (por eso sus
// guards históricos son estructurales sobre la fuente, ver `scrum139-cuadernillo.test.mjs`).
// Un guard de forma puede pasar mientras el comportamiento está mal, que es justo lo que este
// ticket viene a impedir. Extraídas, se prueban de verdad.
//
// Misma disciplina que SCRUM-228 con `desgloseEmpleado.ts`: la pieza que sostiene el invariante
// se saca a función pura para poder exigirla, y quien la usa la LLAMA en vez de reimplementarla.
//
// ⚠️ EL RECORRIDO SIGUE SIENDO UNO. `margenDeLinea` se invoca DENTRO del bucle que ya existe en
// `recalcTotals()`, sobre la línea que se está procesando. No hay segundo recorrido: dos
// recorridos distintos acaban dando dos cifras distintas.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ESTE MÓDULO **NO** CAMBIA
//
// `safeMarkup` en `quotesView.js` sigue tratando un markup ilegible como 0 para el TOTAL, igual
// que hoy. Cambiar eso es otra decisión y otro ticket. Lo único que cambia es que el pie **lo
// dice**: el importe agregado sale solo de las líneas calculables, y las que no lo eran se
// cuentan aparte para poder nombrarlas.
(function (root) {
  'use strict';

  /** ¿Es un número de verdad? Mismo criterio que `Number.isFinite` de `quotesView.js:1003`. */
  function aNumero(valor) {
    return parseFloat(String(valor ?? '').replace(',', '.'));
  }

  /**
   * El margen de UNA línea, y si se pudo calcular.
   *
   * `calculable: false` significa **falta el dato**, no «margen cero». Son cosas distintas y la
   * pantalla no las distinguía: un markup ilegible entraba como 0 y se leía como una decisión
   * del profesional. Por eso se devuelven separados.
   *
   * El campo vacío NO es ilegible: `quotesView.js` lo normaliza a `"0"` antes de leerlo, así que
   * una línea sin margen escrito es margen 0 — deliberado, no perdido. Solo cuenta como no
   * calculable un valor que existe y no es un número (`"abc"`, `"--"`, `"1,2,3"`).
   */
  function margenDeLinea(entrada) {
    const markupCrudo = entrada && entrada.markupRaw;
    // Igual que el origen: ausencia/vacío → "0". Lo que llega aquí como texto no numérico es
    // texto que alguien escribió y no se puede interpretar.
    const markup = aNumero(String(markupCrudo ?? '').trim() === '' ? '0' : markupCrudo);
    if (!Number.isFinite(markup)) return { importe: 0, coste: 0, calculable: false };

    const qty = aNumero(entrada.qtyRaw);
    const price = aNumero(entrada.priceRaw);
    const safeQty = Number.isFinite(qty) ? qty : 0;
    const safePrice = Number.isFinite(price) ? price : 0;

    // El «margen» de YaQu es el markup que ya existe: lo que el markup añade sobre el precio
    // base. NO es beneficio real ni coste por línea — eso está fuera de alcance por decisión
    // explícita del fundador.
    const coste = safeQty * safePrice;
    return { importe: coste * (markup / 100), coste, calculable: true };
  }

  /**
   * El valor de la fila «Margen» del pie. Microcopy APROBADO por el fundador (29-jul-2026),
   * literal y no reformulable (regla 30):
   *
   *   · normal                → `18,00 € (18 %)`   importe primero, % entre paréntesis
   *   · con líneas ilegibles  → `18,00 € · 2 líneas sin calcular`
   *
   * «SIN CALCULAR», no «sin margen»: lo segundo se leería como margen cero, que es exactamente
   * la confusión que el hallazgo del `safeMarkup` demuestra que ya existe.
   *
   * Con líneas sin calcular **se omite el porcentaje** a propósito: un porcentaje agregado
   * calculado sobre una parte de las líneas se leería como si fuera el del presupuesto entero.
   */
  function textoMargen(entrada, fmt) {
    const importe = (entrada && entrada.importe) || 0;
    const coste = (entrada && entrada.coste) || 0;
    const sinCalcular = (entrada && entrada.sinCalcular) || 0;
    const dinero = fmt(importe);

    if (sinCalcular > 0) {
      const plural = sinCalcular === 1 ? '1 línea' : sinCalcular + ' líneas';
      return dinero + ' · ' + plural + ' sin calcular';
    }
    // Mismo redondeo que la fila del IVA de al lado (`effVat`), para que las dos se lean igual.
    const perc = coste > 0 ? Math.round((importe / coste) * 100) : 0;
    return dinero + ' (' + perc + ' %)';
  }

  root.margenDeLinea = margenDeLinea;
  root.textoMargen = textoMargen;
})(typeof window !== 'undefined' ? window : globalThis);
