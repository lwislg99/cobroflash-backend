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

  // 3 · FACTURADO Y SIN COBRAR — por factura, no por resta. Las rectificativas (importe negativo)
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

/** Los ids en su orden canónico. El guard lo usa para comprobar que no se reordenan ni se pierden. */
const HUECOS_COBRO = ['sin-firmar', 'sin-facturar', 'sin-cobrar'];

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
