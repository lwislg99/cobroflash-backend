// public/dashboard/js/jobsCierreTrabajo.js — SCRUM-344
//
// LA REGLA del aviso al CERRAR un Trabajo, en UN solo sitio: la vista la PINTA desde aquí y el
// guard la VERIFICA contra aquí. Nadie escribe la condición dos veces (patrón de
// invoiceActionsRegistry.js, SCRUM-283). Es además la única forma de que la regla se pueda probar
// en `npm test`: función pura, sin DOM, sin red, sin BD.
//
// ── QUÉ MATA CERRAR, medido (no deducido del nombre) ────────────────────────────────────────
// `cerrado` es el único estado terminal de la FSM (`job.service.ts:27`: `cerrado: []`). Derivado
// sobre `src/`, los ÚNICOS sitios que cambian de conducta según `job.status` son:
//   · `jobs.routes.ts:552` — `POST /:id/collect-rest` exige `status === 'terminado'` → cerrar
//     devuelve 409 `job_not_finished`. **ESTA es la vía de cobro que muere.**
//   · la propia FSM — desde `cerrado` no se sale.
// Y en el front, `expensesView.js:39` deja de ofrecer el Trabajo para vincular gastos.
// NO se ven afectadas las facturas YA EMITIDAS: su cobro (marcar pagada, recordar, enlace de pago)
// no mira el estado del Trabajo en ningún sitio. Cerrar NO las mata.
//
// ── LOS DOS «PENDIENTES» QUE PARECEN EL MISMO Y NO LO SON ───────────────────────────────────
// En la tarjeta conviven dos números distintos, y el aviso solo puede usar uno:
//   ① `totalAceptado − totalCobrado` — LO QUE TE DEBEN. Es lo que pinta la barra de progreso
//      («Cobrado X de Y», api.js:246). Incluye facturas ya emitidas y sin pagar.
//   ② `remaining.amount` — LO QUE FALTA POR FACTURAR: exactamente lo que emitiría «Cobrar el
//      resto» (`jobs.routes.ts:129-130`), y exactamente lo que el botón de al lado ya enseña
//      (`jobsView.js:211`, mismo campo y mismo `fmtMoneyEs`).
// **El aviso usa ②.** Cerrar solo mata ②; el trozo de ① que ya está facturado se sigue pudiendo
// cobrar después de cerrar. Avisar con ① diría «vas a perder 1.000 €» cuando 600 de esos 1.000
// siguen cobrables — avisar de más también es avisar mal.
//
// ── EL CASO DEGENERADO, que es por lo que el disparador NO puede ser `estadoCobro` ───────────
// `estadoCobroFor` (`job.service.ts:212-218`) exige `aceptado > 0` para poder decir 'Pagado'. Con
// `totalAceptado` nulo o 0 NUNCA lo dice: se queda en 'Pendiente' si no hay nada cobrado, y en
// 'Parcial' en cuanto se cobra algo. En ambos casos para siempre. O sea que 'Pendiente' significa a
// la vez «te deben todo» y «aquí no hay importe contra el que cobrar», y son cosas opuestas.
// Usar `remaining` esquiva la trampa por construcción: sin presupuesto es `null`, y con total 0 su
// importe es 0 — en los dos casos NO se avisa, que es lo correcto (no hay cobro que perder).

// ── LAS CINCO RANURAS DE TEXTO · MICROCOPY APROBADA POR EL FUNDADOR (regla 30, 5-ago-2026) ──
//
// **Es la ÚNICA fuente de texto visible de la sección**: la vista no escribe ni una palabra suelta,
// y de eso hay guard. Y el texto de aquí está fijado CARÁCTER A CARÁCTER en
// `tests/scrum344-cierre-con-saldo.test.mjs`: cambiarlo sin pasar por el fundador sale rojo. La
// regla 30 no dice solo «no inventes», dice «esto lo aprueba él» — también al cambiarlo.
//
//   `titulo`      — encabezado de la sección (versalitas, arriba del bloque)
//   `boton`       — rótulo del botón. Es el que YA existía; no es microcopy nueva
//   `explicacion` — qué es cerrar. Se lee SIEMPRE que se puede cerrar
//   `avisoSaldo`  — la consecuencia real. Solo si queda algo que «Cobrar el resto» podría cobrar
//   `confirmar`   — cuerpo del confirm(). Solo en ese mismo caso
//
// `titulo` y `boton` están SEPARADOS aunque hoy digan casi lo mismo: con una sola ranura el
// encabezado y el botón se leían idénticos y la sección parecía repetirse (se vio en la captura AB6,
// no en la especificación).
//
// Las dos que llevan dinero son FUNCIONES del importe ya formateado, porque **el importe va DENTRO
// de la frase**: un número flotando al lado de un aviso obliga al usuario a relacionarlos él.
//
// NI «FACTURA» NI «JUSTIFICANTE» NI «RECIBO», a propósito y comprobado con `promesasDeFactura`, no
// a ojo. Un merchant ES sin `INVOICING_ES_ENABLED` recibe un JUSTIFICANTE, no una factura (Parte M),
// y este texto lo lee él. Ojo al medirlo: el trinquete de SCRUM-299 **excluye `public/dashboard/`**
// (`scrum299-copy-factura-publico.test.mjs:128`), así que un verde de `npm test` NO prueba nada aquí
// — hay que pasarle las frases al detector directamente.
var CIERRE_TEXTOS = {
  titulo: 'Cerrar el trabajo',
  boton: 'Cerrar trabajo',
  explicacion: 'Cerrar da el trabajo por acabado. No se puede reabrir.',
  // La 2ª frase nombra el botón ENTERO (no «ese botón») para que se entienda sola aunque se salte la
  // 1ª. Y la 3ª existe para que esto informe en vez de regañar: cerrar con saldo es legítimo, y se
  // dicen los dos motivos por los que lo es.
  avisoSaldo: function (importeFmt) {
    return 'Quedan ' + importeFmt + ' que todavía no has cobrado. Si cierras el trabajo, el botón '
      + '«Cobrar el resto» desaparece y ya no podrás cobrarlos desde YaQu. Puedes cerrarlo igualmente: '
      + 'por ejemplo, si ya lo cobraste por otra vía o lo das por perdido.';
  },
  confirmar: function (importeFmt) {
    return 'Quedan ' + importeFmt + ' sin cobrar. Al cerrar el trabajo ya no podrás cobrarlos desde '
      + 'YaQu. ¿Cerrar de todas formas?';
  },
};

// Las ranuras que la vista pinta. El guard recorre ESTA lista, no una escrita a mano en el test:
// si mañana se añade una sexta ranura, el guard la mira sin que nadie se acuerde de añadirla.
var CIERRE_RANURAS = ['titulo', 'boton', 'explicacion', 'avisoSaldo', 'confirmar'];

/** Resuelve una ranura sea cadena o función del importe. Lo usan la vista y el guard. */
function textoCierre(ranura, importeFmt) {
  var v = CIERRE_TEXTOS[ranura];
  return typeof v === 'function' ? v(importeFmt) : v;
}

/**
 * ¿La acción de cerrar está disponible? Es la MISMA condición de la FSM (`terminado → cerrado`,
 * job.service.ts:26); vive aquí para que la vista no la escriba suelta y el guard pueda leerla.
 */
function puedeCerrarTrabajo(job) {
  return !!job && job.status === 'terminado';
}

/**
 * Decisión del aviso, derivada del Trabajo tal y como lo serializa el backend.
 *
 * Devuelve SIEMPRE la misma forma —nunca `null`— para que la vista no tenga que decidir nada:
 *   { haySaldoPendiente, importe, currency }
 *
 * `haySaldoPendiente` es el ÚNICO disparador de fricción. Con `false` cerrar sigue siendo un clic.
 */
function avisoCierreTrabajo(job) {
  var r = job && job.remaining;
  // `Number(...)` explícito: `amount` llega del JSON y un string '0' sería veraz como truthy.
  var importe = r && Number(r.amount) > 0 ? Number(r.amount) : 0;
  return {
    haySaldoPendiente: importe > 0,
    importe: importe,
    // La divisa la manda `remaining` (es el importe que se enseña). El resto son respaldos para
    // que nunca se pinte un número desnudo: la tarjeta ya usa `j.quote?.currency || 'EUR'`.
    currency: (r && r.currency) || (job && job.quote && job.quote.currency) || 'EUR',
  };
}

// Doble vida: global para el <script> clásico del dashboard, y module.exports para que el guard
// IMPORTE esta misma fuente en Node (una sola copia de la regla). `typeof` es seguro en ambos.
if (typeof window !== 'undefined') {
  window.CIERRE_TEXTOS = CIERRE_TEXTOS;
  window.CIERRE_RANURAS = CIERRE_RANURAS;
  window.textoCierre = textoCierre;
  window.puedeCerrarTrabajo = puedeCerrarTrabajo;
  window.avisoCierreTrabajo = avisoCierreTrabajo;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CIERRE_TEXTOS: CIERRE_TEXTOS,
    CIERRE_RANURAS: CIERRE_RANURAS,
    textoCierre: textoCierre,
    puedeCerrarTrabajo: puedeCerrarTrabajo,
    avisoCierreTrabajo: avisoCierreTrabajo,
  };
}
