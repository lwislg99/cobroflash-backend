/**
 * public/dashboard/js/quoteDescuentos.js — SCRUM-594 (DOC-04)
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA ARITMÉTICA DE LOS DESCUENTOS DEL PRESUPUESTO, PURA Y PROBABLE.
 *
 * Mismo reparto que `quoteSuplido.js`: la regla vive en una pieza pura que la suite EJECUTA, y
 * la vista solo la llama. Sin esto, la regla estaría escrita dentro de `recalcTotals()` —que
 * necesita DOM— y no se podría probar sin navegador.
 *
 * ── POR QUÉ EL DE LÍNEA ES % Y EL GLOBAL ES € ──────────────────────────────────────────────
 *
 * 🔴 NO ES UNA INCOHERENCIA, y queda escrito aquí para que nadie lo «armonice» dentro de seis
 * meses (decisión de los dos fundadores):
 *   · por LÍNEA se descuenta sobre un PRECIO UNITARIO, que es naturalmente un porcentaje;
 *   · el GLOBAL se negocia A BULTO: «te dejo 200 € menos». El importe es lo que el cliente VE Y
 *     FIRMA; el porcentaje sería una forma de calcularlo, o sea el derivado en vez del dato.
 * Uniformarlos rompería el que es exacto. Guardar los dos NO es opción.
 *
 * ── EL CÉNTIMO QUE SOBRA ───────────────────────────────────────────────────────────────────
 *
 * Repartir un importe entre varios tipos de IVA casi nunca divide limpio. La regla es
 * conservación aritmética, no una convención fiscal: **la suma de los repartos tiene que ser
 * EXACTAMENTE el descuento que el cliente firmó**. Se reparten todos los tipos menos uno por
 * redondeo normal y el ÚLTIMO absorbe la diferencia. Si el prorrateo perdiera un céntimo, el
 * documento dejaría de decir lo acordado.
 *
 * ⚠️ EL REPARTO ES PROPORCIONAL A LA BASE DE CADA TIPO, y vale para el PRESUPUESTO, que NO es
 * documento fiscal. Antes de que un descuento llegue a una FACTURA esta regla va a la asesoría
 * con SCRUM-619, 623 y 624. Las alternativas —cargarlo al tipo más alto o al más bajo— serían
 * elecciones arbitrarias que favorecen o perjudican a Hacienda sin motivo defendible; el
 * proporcional es el único que no elige.
 *
 * ── AUSENTE ≠ CERO ─────────────────────────────────────────────────────────────────────────
 *
 * Una línea SIN `dto` y una línea con `dto: 0` son lo mismo para el importe, pero no para el
 * dato: la primera es una línea que nadie tocó —incluidas TODAS las anteriores a este ticket— y
 * la segunda una decisión. Por eso `descuentoParaPayload` devuelve `{}` cuando no hay descuento
 * y la clave NO viaja, igual que `costeParaPayload` en SCRUM-661. Es lo que hace cierto POR
 * CONSTRUCCIÓN que un presupuesto viejo pinte exactamente lo mismo que antes.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  /** Un número utilizable, o `null` si no lo es. Un texto ilegible NO es cero. */
  function num(v) {
    if (v === null || v === undefined || String(v).trim() === '') return null;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  /**
   * El porcentaje de descuento de una línea, ya saneado: 0-100, o 0 si no hay.
   * Un valor fuera de rango se recorta en vez de rechazarse — un `dto` de 150 % dejaría el
   * precio NEGATIVO, y un presupuesto no puede pedirle dinero al cliente por una línea.
   */
  function dtoDeLinea(valor) {
    const n = num(valor);
    if (n === null) return 0;
    return Math.min(100, Math.max(0, n));
  }

  /** El precio de una línea DESPUÉS de su descuento. El descuento opera SÓLO sobre el precio. */
  function precioEfectivo(price, dto) {
    const p = num(price);
    if (p === null) return 0;
    return p * (1 - dtoDeLinea(dto) / 100);
  }

  /**
   * Reparte `descuentoCents` entre los tipos, proporcional a su base.
   *
   * @param {Array<{rate:number, baseCents:number}>} porTipo
   * @returns {Array<{rate:number, baseCents:number, descuentoCents:number}>}
   */
  function repartirGlobal(porTipo, descuentoCents) {
    const tipos = Array.isArray(porTipo) ? porTipo.slice() : [];
    const total = tipos.reduce(function (a, t) { return a + t.baseCents; }, 0);
    const d = Math.max(0, Math.round(Number(descuentoCents) || 0));
    if (!tipos.length || total <= 0 || d === 0) {
      return tipos.map(function (t) { return { rate: t.rate, baseCents: t.baseCents, descuentoCents: 0 }; });
    }
    // 🔴 Nunca se descuenta más de lo que hay: un descuento mayor que la suma dejaría bases
    // negativas y un IVA negativo. Se recorta al total y se dice con el dato, no con un error.
    const aRepartir = Math.min(d, total);

    const salida = [];
    let acumulado = 0;
    for (let i = 0; i < tipos.length; i++) {
      const esUltimo = i === tipos.length - 1;
      // El ÚLTIMO absorbe la diferencia: la suma es EXACTAMENTE `aRepartir`, siempre.
      const cents = esUltimo
        ? aRepartir - acumulado
        : Math.round((aRepartir * tipos[i].baseCents) / total);
      acumulado += cents;
      salida.push({ rate: tipos[i].rate, baseCents: tipos[i].baseCents, descuentoCents: cents });
    }
    return salida;
  }

  /**
   * El cálculo COMPLETO del presupuesto con descuentos, en céntimos enteros.
   *
   * Se trabaja en céntimos porque el reparto tiene que conservar el importe exacto; el redondeo
   * del TOTAL no se toca aquí —de eso responde `calcTotal` en el backend, y este ticket tiene
   * prohibido cambiar convenciones de redondeo (SCRUM-624, en la asesoría)—.
   *
   * @param {Array<{qty:*, price:*, dto:*, tax:*}>} lineas  `tax` en FRACCIÓN (0.21), como en `Quote.lines`
   * @param {number|string|null} descuentoGlobal  importe en EUROS
   */
  function totalesConDescuento(lineas, descuentoGlobal) {
    const ls = Array.isArray(lineas) ? lineas : [];

    // 🔴 ESTA FUNCIÓN NO ELIGE CÓMO SE REDONDEA: COPIA LA DE `calcTotal` (`core/utils/utils.ts`).
    //
    // La primera versión acumulaba en céntimos enteros por línea, y el barrido de equivalencia
    // frente al backend lo cazó: `3 × 9,99 −10 %` daba 32,63 aquí y 32,64 allí. Un céntimo, en la
    // pantalla contra lo que se guarda.
    //
    // Cede ÉSTA y no la del backend por dos motivos: `calcTotal` es quien produce el `Quote.total`
    // que se guarda y que el PDF lee, y cambiar su redondeo movería importes de presupuestos ya
    // existentes. Hay CUATRO convenciones conviviendo (medido en SCRUM-624) y cuál debe mandar
    // está en la asesoría con SCRUM-619 y 623: este ticket tiene prohibido decidirlo.
    //
    // Los céntimos enteros se usan SÓLO para repartir el descuento global entre tipos, que es
    // aritmética nueva y donde la conservación exacta del importe firmado sí es la regla.
    let sumaSinDescuento = 0;   // lo que sumarían las líneas a precio de tarifa, sin IVA
    let sumaLineas = 0;         // ya con el Dto. % de cada línea, sin IVA
    let conImpuesto = 0;        // Σ qty × precio efectivo × (1 + tax) — la fórmula de `calcTotal`
    const porTipo = [];
    const indicePorTipo = new Map();

    for (const l of ls) {
      // 🔴 LAS CABECERAS DE APARTADO NO SUMAN, y se saltan POR SU MARCA — no por «no tener
      // precio». Es literalmente lo que hace `lineasQueSuman` (`quotes/domain/apartados.ts:57`),
      // y el motivo está escrito allí: así una cabecera a la que alguien le meta un importe sigue
      // sin mover el total. Filtrar por «no tiene precio» aquí haría que esta pieza y `calcTotal`
      // divergieran justo en ese caso, y el número de la pantalla dejaría de ser el que se guarda.
      if (l && typeof l === 'object' && l.apartado === true) continue;

      const qty = num(l && l.qty);
      const price = num(l && l.price);
      if (qty === null || price === null) continue;
      const tax = num(l && l.tax) || 0;

      const neto = qty * precioEfectivo(price, l && l.dto);
      sumaSinDescuento += qty * price;
      sumaLineas += neto;
      conImpuesto += neto * (1 + tax);

      const rate = Math.round(tax * 100);
      if (!indicePorTipo.has(rate)) {
        indicePorTipo.set(rate, porTipo.length);
        porTipo.push({ rate: rate, baseCents: 0 });
      }
      porTipo[indicePorTipo.get(rate)].baseCents += Math.round(neto * 100);
    }

    const globalEuros = num(descuentoGlobal);
    const globalCents = globalEuros === null ? 0 : Math.max(0, Math.round(globalEuros * 100));
    const reparto = repartirGlobal(porTipo, globalCents);
    const globalAplicadoCents = reparto.reduce(function (a, t) { return a + t.descuentoCents; }, 0);

    // Lo que el descuento global se lleva del total incluye el impuesto que deja de devengarse:
    // misma fórmula que `calcTotal`, término a término.
    let quitado = 0;
    for (const t of reparto) quitado += t.descuentoCents * (1 + t.rate / 100);

    const totalCents = Math.round(conImpuesto * 100 - quitado);
    const baseImponibleCents = Math.round(sumaLineas * 100) - globalAplicadoCents;

    return {
      sumaSinDescuentoCents: Math.round(sumaSinDescuento * 100),
      descuentoLineasCents: Math.round(sumaSinDescuento * 100) - Math.round(sumaLineas * 100),
      descuentoGlobalCents: globalAplicadoCents,
      baseImponibleCents: baseImponibleCents,
      // 🔴 LA CUOTA SE DERIVA DEL TOTAL, no se suma aparte. Así el papel SIEMPRE cuadra:
      // base + IVA = Total, sin excepción. Sumarla por separado abriría la puerta a un
      // documento que no suma, que es peor que un céntimo de diferencia.
      cuotaCents: totalCents - baseImponibleCents,
      totalCents: totalCents,
      porTipo: reparto,
    };
  }

  /** ¿Hay algún descuento en juego? Es lo que decide si el bloque se PINTA (regla 27: sin flag). */
  function hayDescuento(lineas, descuentoGlobal) {
    const t = totalesConDescuento(lineas, descuentoGlobal);
    return t.descuentoLineasCents > 0 || t.descuentoGlobalCents > 0;
  }

  /**
   * El `dto` para el payload — o NADA. Copia literal del criterio de `costeParaPayload`
   * (SCRUM-661): si el campo está vacío la clave no viaja, y «no lo tocó nadie» sigue siendo
   * distinguible de «puso cero» para siempre.
   */
  function descuentoParaPayload(valor) {
    const n = num(valor);
    if (n === null || n <= 0) return {};
    return { dto: Math.min(100, n) };
  }

  root.quoteDescuentos = {
    dtoDeLinea: dtoDeLinea,
    precioEfectivo: precioEfectivo,
    repartirGlobal: repartirGlobal,
    totalesConDescuento: totalesConDescuento,
    hayDescuento: hayDescuento,
    descuentoParaPayload: descuentoParaPayload,
  };
  // Para la suite, que carga este fichero con `require` igual que `quoteSuplido.js`.
  if (typeof module !== 'undefined' && module.exports) module.exports = root.quoteDescuentos;
}(typeof window !== 'undefined' ? window : globalThis));
