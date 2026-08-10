// public/dashboard/js/jobCobroHuecos.js — SCRUM-320 (G5)
//
// «QUÉ FALTA PARA COBRAR» — los cuatro importes y los huecos.
//
// El defecto que cierra: la pantalla decía CUÁNTO se ha cobrado y no decía QUÉ FALTA para cobrar el
// resto. Es un marcador, no una respuesta.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ESTA SECCIÓN NO TIENE CTA PROPIO, Y ESO NO ES UNA CARENCIA
//
// La cabecera contesta «¿cuál es LA siguiente acción de este Trabajo?» — una sola, y la elige la
// escalera de SCRUM-366. Esta sección contesta otra pregunta: «¿qué falta para cobrar?», que puede
// tener VARIAS respuestas a la vez (dos albaranes sin firmar Y 300 € facturados sin cobrar).
//
// Una sección que **enumera huecos** no tiene que elegir uno. Elegir es el trabajo de la cabecera, y
// hay una sola cabecera. Por eso cada hueco lleva **su propio enlace en su propia línea**:
// `jobNextAction` no se toca, no hay una segunda escalera, y no hay forma de que la sección y la
// cabecera se contradigan.
//
// ⚠️ SOLO CUENTA COMO ENTREGADO LO FIRMADO. Un albarán en borrador o enviado-sin-firmar no es
// entrega probada. Contarlo sería decirle al profesional que puede facturar algo que el cliente no
// ha aceptado, y ése es justo el euro que acaba en discusión. **Asimetría de coste:** contar de
// menos cuesta una comprobación; contar de más cuesta la factura y el cliente.

const num = (v) => {
  // Familia SCRUM-271, con el matiz que mordió en SCRUM-367: `Number([])` es **0**, un número
  // perfectamente finito. Se exige el TIPO antes de convertir, para que un objeto vacío no se
  // convierta en un importe de cero euros que parece medido.
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return 0;
};

const albaranesDe = (job) => (Array.isArray(job && job.albaranes) ? job.albaranes : []);
const facturasDe = (job) => (Array.isArray(job && job.invoices) ? job.invoices : []);

/** Importe de un albarán. `totales` solo tiene contenido en modo VALORADO (serializeAlbaran). */
const importeAlbaran = (alb) => num(alb && alb.totales && alb.totales.total);

/**
 * LOS CUATRO IMPORTES, cada uno de su fuente.
 *
 * `entregadoFirmado` se deriva de los albaranes FIRMADOS, no del estado del Trabajo ni de una
 * resta: es lo único que prueba entrega.
 *
 * `facturado` suma TODAS las facturas del Trabajo, justificantes incluidos —un justificante es el
 * mismo acto de facturar con otro papel: se emite EN LUGAR de la factura cuando el merchant ES real
 * no tiene la facturación activa, así que excluirlo daría «Facturado 0 €» para todos los merchants
 * reales de hoy—. Las rectificativas ya vienen con el importe NEGADO (`-Number(original.total)`),
 * así que la resta la hace la propia suma y no hay que recordarla en ningún sitio.
 */
function importesDeCobro(job) {
  const aceptado = num(job && job.totalAceptado);
  const cobrado = num(job && job.totalCobrado);

  let entregadoFirmado = 0;
  let albaranesFirmadosConImporte = 0;
  for (const alb of albaranesDe(job)) {
    if (!alb || alb.estado !== 'firmado') continue;
    const imp = importeAlbaran(alb);
    entregadoFirmado += imp;
    if (alb.totales) albaranesFirmadosConImporte++;
  }

  let facturado = 0;
  for (const inv of facturasDe(job)) facturado += num(inv && inv.total);

  return {
    aceptado,
    entregadoFirmado,
    facturado,
    cobrado,
    // «Te falta por cobrar» se mide contra lo ACEPTADO, que es lo que el cliente se comprometió a
    // pagar. Contra lo facturado diría otra cosa —y más pequeña— justo cuando aún queda por
    // facturar, que es cuando el pro necesita el número entero.
    faltaPorCobrar: Math.max(0, aceptado - cobrado),
    // ⚠️ Los albaranes SIN_VALORAR no llevan importe (`totales` es null y el modo por DEFECTO es
    // SIN_VALORAR). Este contador dice si el importe entregado se pudo medir: sin él, un
    // «Entregado y firmado 0,00 €» con tres albaranes firmados sería una afirmación falsa, no un
    // hueco. Quien pinta lo usa para omitir la línea en vez de escribir un cero.
    albaranesFirmadosConImporte,
  };
}

/**
 * LOS HUECOS, en ORDEN FIJO. Solo se devuelve el que existe.
 *
 * El orden no es estético: primero lo que el pro **puede resolver hoy mismo** (perseguir una firma),
 * luego lo que depende de él (facturar) y al final lo que depende del cliente (que pague).
 *
 * Cada hueco se deriva **por documento**, nunca restando totales: un albarán firmado y sin facturar
 * se sabe por su propio `facturado` (derivado de `invoiceId != null`), y una factura sin cobrar por
 * su propio `status`. Restar «entregado − facturado» daría cero en cuanto los dos números
 * coincidieran por caminos distintos, y el hueco desaparecería estando ahí.
 */
function huecosDeCobro(job) {
  const huecos = [];

  // 1 · SIN FIRMAR — la línea más útil de la sección: es lo único que el pro puede resolver hoy
  //     mismo. No es un dato escondido; es la respuesta a «qué falta».
  const sinFirmar = albaranesDe(job).filter((a) => a && a.estado !== 'firmado');
  if (sinFirmar.length) {
    huecos.push({ id: 'sin-firmar', cantidad: sinFirmar.length, accion: 'ver-albaranes' });
  }

  // 2 · ENTREGADO Y SIN FACTURAR — por albarán, no por resta.
  let entregadoSinFacturar = 0;
  for (const alb of albaranesDe(job)) {
    if (!alb || alb.estado !== 'firmado' || alb.facturado) continue;
    entregadoSinFacturar += importeAlbaran(alb);
  }
  if (entregadoSinFacturar > 0) {
    huecos.push({ id: 'sin-facturar', importe: entregadoSinFacturar, accion: 'facturar-lo-entregado' });
  }

  // 3 · ACEPTADO Y SIN FACTURAR NADA — el caso en que el 100 % del dinero está fuera.
  //
  // Es el hueco que faltaba, y lo destapó el invariante con la cabecera (SCRUM-320): un Trabajo
  // `terminado` con importe aceptado y **sin ningún documento** hacía que la cabecera dijera
  // «Cobrar el resto» y esta sección no listara nada — o sea, que no se pintara. **Callarse justo
  // ahí es fallar cuando más falta hace**: no es que falte una parte, es que no hay nada facturado.
  //
  // Va DESPUÉS del parcial a propósito: leídos de arriba abajo escalan el alcance —«600 € de lo
  // entregado» y luego «853,05 € del trabajo entero»—. Los dos pueden salir a la vez y son dos
  // verdades distintas, que es exactamente lo que esta sección hace: enumerar, no elegir.
  const aceptado = num(job && job.totalAceptado);
  if (aceptado > 0 && facturasDe(job).length === 0) {
    huecos.push({ id: 'sin-facturar-nada', importe: aceptado, accion: 'facturar-el-trabajo' });
  }

  // 3.5 · SIN ENTREGAR — SCRUM-423, el eje de ENTREGA de C6 (SCRUM-305).
  //
  // Va ENTRE facturar y cobrar por el mismo orden que rige la sección: primero lo que el pro puede
  // resolver hoy (firmar), luego lo que depende de él (entregar lo que falta, facturar) y al final
  // lo que depende del cliente (pagar). Entregar es suyo, y es anterior a que le paguen.
  //
  // 🔴 EL NÚMERO NO SE CALCULA AQUÍ. Lo trae el backend en `job.entregaPendiente`, derivado por
  // `resumenEntrega` (C6). Recalcularlo en el navegador sería tener dos fuentes de verdad para la
  // misma pregunta — exactamente lo que C6 se negó a hacer con el eje de facturación.
  //
  // ⚠️ LAS TRES CONDICIONES DE APARICIÓN, y ninguna es cosmética:
  //
  //  ① `calculable` — C6 decide NO contestar en tres casos (adicionales, sin presupuesto, nada
  //     atribuible). Aquí eso significa que no hay línea: «o está el dato, o no está la línea»
  //     (regla de G). No se pinta el motivo, y la copy firmada de esos tres motivos queda sin usar
  //     en esta superficie — declarado en `docs/master/SCRUM-423.md`.
  //
  //  ② `pendienteTotal > 0` — cero no es un hueco: es que no falta nada por entregar.
  //
  //  ③ `sinAtribuir === 0` — **la que de verdad protege.** Si hay líneas entregadas que no salen
  //     del presupuesto, el número NO las cuenta, así que diría «quedan 3» dejando fuera entregas
  //     reales. C6 lo prohíbe por escrito: «un número que resume tiene que declarar lo que no pudo
  //     contar». Declararlo exige microcopy compuesta que HOY NO ESTÁ APROBADA (regla 30), así que
  //     mientras no lo esté no se pinta un número incompleto y mudo.
  //
  //     Y NO se exige lo mismo de `enPartesSinFirmar`: esas líneas no cuentan **por definición** de
  //     C6 («solo cuenta lo firmado»), así que el número es completo respecto de lo que promete. Su
  //     declaración ya está en pantalla, en su propia línea: si hay líneas en albaranes sin firmar,
  //     existe un albarán sin firmar, y entonces el hueco ① de arriba está pintado. Hay un test que
  //     fija esa implicación para que siga siendo verdad.
  //
  // ⚠️ Y se cuenta con `lineasPendientes`, NO con `pendienteTotal`: el segundo es la suma de
  // CANTIDADES (horas, m², ud) y rotularlo «2,5 líneas sin entregar» sería falso y encima con
  // decimal. La copy aprobada habla de líneas, así que el número es de líneas.
  const entrega = job && job.entregaPendiente;
  if (entrega
    && entrega.calculable === true
    && num(entrega.lineasPendientes) > 0
    && num(entrega.sinAtribuir) === 0) {
    huecos.push({ id: 'sin-entregar', cantidad: num(entrega.lineasPendientes), accion: 'ver-albaranes' });
  }

  // 4 · FACTURADO Y SIN COBRAR — por factura, no por resta. Las rectificativas (importe negativo)
  //     no se cuentan como pendiente de cobro: una nota de abono no es dinero que entre.
  let facturadoSinCobrar = 0;
  for (const inv of facturasDe(job)) {
    if (!inv || String(inv.status).toLowerCase() === 'paid') continue;
    const t = num(inv.total);
    if (t > 0) facturadoSinCobrar += t;
  }
  if (facturadoSinCobrar > 0) {
    huecos.push({ id: 'sin-cobrar', importe: facturadoSinCobrar, accion: 'registrar-cobro' });
  }

  return huecos;
}

/**
 * Los ids en su orden canónico. El guard lo usa para comprobar que no se reordenan ni se pierden.
 *
 * SCRUM-423 añade `sin-entregar` en la posición que le toca por el orden de la sección (lo que
 * depende del pro antes que lo que depende del cliente). El guard de SCRUM-320 es de IGUALDAD
 * —cuenta los ids que el motor puede producir y los compara con esta lista—, así que la lista y el
 * motor se mueven juntos o sale rojo: es justo lo que impide que un hueco nuevo se pinte sin
 * declararse, o que uno declarado deje de salir sin que nadie se entere.
 */
const HUECOS_COBRO = ['sin-firmar', 'sin-facturar', 'sin-facturar-nada', 'sin-entregar', 'sin-cobrar'];

/**
 * ¿Se pinta la sección? Solo si hay algún hueco.
 *
 * Sin huecos no falta nada, y una sección que pregunta «qué falta» cuando no falta nada es ruido.
 * Es la misma regla del hueco de G3 y G4: o está el dato, o no está el bloque.
 */
function seccionCobroVisible(job) {
  return huecosDeCobro(job).length > 0;
}

if (typeof window !== 'undefined') {
  window.importesDeCobro = importesDeCobro;
  window.huecosDeCobro = huecosDeCobro;
  window.seccionCobroVisible = seccionCobroVisible;
  window.HUECOS_COBRO = HUECOS_COBRO;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { importesDeCobro, huecosDeCobro, seccionCobroVisible, HUECOS_COBRO };
}
