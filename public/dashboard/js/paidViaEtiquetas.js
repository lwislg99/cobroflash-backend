// public/dashboard/js/paidViaEtiquetas.js — SCRUM-398
//
// CÓMO SE LE ENSEÑA AL PROFESIONAL LA FORMA DE COBRO. Una sola fuente, y un desconocido que se
// declara en vez de colarse.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE CIERRA
//
// `reportsView.js` resolvía la etiqueta con `METHOD_LABELS[m.method] || m.method`. Un método fuera
// del mapa **se le enseñaba al profesional sin traducir**: le aparecía `mp` en su informe de
// cobros. Es la degradación silenciosa de siempre — «no sé traducir esto» convertido en «esto se
// llama así».
//
// Y no es cosmético. `paidVia.ts:17` lo explica: «uno lo confirma una PERSONA, el otro un WEBHOOK.
// Son dos cadenas de evidencia distintas ante una inspección». `paid_via` **es** `charge.method`
// (`exportData.ts:229`: «es lo que el asesor cruza con el banco»), así que el vocabulario que se
// dispersa aquí se dispersa donde tiene valor probatorio.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS TRES POBLACIONES, Y POR QUÉ NO SON LA MISMA
//
// Medido el 7-ago-2026. Lo que llega a esta función NO es solo el conjunto cerrado:
//
//   1. EL CONJUNTO CERRADO (`PAID_VIA` de `paidVia.ts`, regla 22). Es la INTENCIÓN: lo que el
//      producto declara que puede ser una forma de cobro. Crecer ahí es cambio de máster.
//   2. LOS HEREDADOS. Valores que la base YA TIENE escritos y que no están en el conjunto:
//      `card:stripe` (4 escrituras vivas) y el `manual` que `reports.routes.ts:164` fabrica al
//      leer cuando una factura no tiene `Charge`. No traducirlos sería una REGRESIÓN: hoy se ven,
//      y son cobros reales.
//   3. LO DESCONOCIDO. Todo lo demás. No se pinta crudo: se pinta DICIENDO que no se reconoce.
//
// ⚠️ El guard `scrum398-vocabulario-de-cobro.test.mjs` deriva (1) del AST de `paidVia.ts` y exige
// que estén TODOS aquí. Añadir un valor al conjunto sin etiqueta pone la suite en rojo — que es lo
// que hoy no pasaba.

/** (1) El conjunto CERRADO. Las claves tienen que ser exactamente las de `PAID_VIA`. */
var ETIQUETAS_PAID_VIA = {
  card: '💳 Tarjeta',
  bizum_auto: '📲 Bizum',
  bizum_manual: '📲 Bizum (confirmado a mano)',
  transfer: '🏦 Transferencia',
  cash: '💶 Efectivo',
};

/**
 * (2) HEREDADOS: lo que la base ya tiene y el conjunto no nombra. Cada uno con su procedencia,
 * porque un alias sin motivo es indistinguible de un valor inventado.
 */
var ETIQUETAS_HEREDADAS = {
  // Lo escriben `stripe.routes.ts` (×3) y `receipt.routes.ts` (×1). Es un cobro con tarjeta de
  // verdad: dejarlo sin traducir sería perder información que hoy sí se ve.
  'card:stripe': '💳 Tarjeta',
  // NO es un valor de la base: lo fabrica `reports.routes.ts:164` al leer (`inv.charge?.method ||
  // 'manual'`) cuando la factura se marcó pagada sin crear `Charge`. Es la AUSENCIA de método, y
  // por eso se nombra como lo que es.
  //
  // ⚠️ SCRUM-491 le quitó su productor: el informe ya no lo fabrica. Se queda porque una base
  // puede traerlo escrito y porque el guard de SCRUM-398 lo exige — retirarlo es cambio de master.
  manual: '✍️ Marcado a mano',
  // ─────────────────────────────────────────────────────────────────────────────────────────
  // 🔴 SCRUM-503 · EL DESCONOCIDO **DECLARADO** — la única entrada nueva de este ticket
  //
  // `desconocido` (`METODO_DESCONOCIDO`, `metodoDeCobro.ts`) NO es un valor roto ni un método que
  // nadie reconozca: es una AFIRMACIÓN, y dice que se preguntó y no consta. Sin esta línea caía en
  // «⚠️ Método no reconocido (desconocido)», que le contesta al profesional que su propia
  // respuesta no la entendemos — y de paso le enseña el valor crudo de la base.
  //
  // Son TRES estados y no pueden compartir salida:
  //     ausencia (`null`, `''`) → nadie registró nada      → «⚠️ Sin método»
  //     `desconocido`           → SE PREGUNTÓ y no consta  → esta línea
  //     valor fuera de PAID_VIA → alguien escribió algo que no existe → «no reconocido (x)»
  //
  // QUIÉN LO ESCRIBE HOY, medido sobre `main` el 12-ago-2026 (los dos con llamante vivo):
  //   · `charges.routes.ts:44` → `metodoDesdePreferencia('mp')`: MercadoPago es una PASARELA, no un
  //     método, y al CREAR el cobro nadie sabe todavía con qué pagará el cliente (SCRUM-486).
  //   · `integrations/mercadopago.ts:89` → `metodoDesdeMercadoPago(...)` cuando MP no manda
  //     `payment_type_id` (SCRUM-489).
  //
  // Va en los HEREDADOS y no en el conjunto cerrado a propósito: `desconocido` **no está en
  // `PAID_VIA`** —`esMetodoValido` lo devuelve `false` adrede— y ampliarlo sería cambio de la regla
  // 22. Meterlo arriba tumbaría el guard de SCRUM-398, que exige que las claves de (1) sean
  // exactamente las del conjunto.
  //
  // Microcopy APROBADA por el asesor (regla 30). No se adorna ni se acorta.
  desconocido: '⚠️ Método sin especificar',
};

/**
 * La etiqueta de una forma de cobro. **Nunca devuelve el valor crudo.**
 *
 * Lo desconocido se dice, y se dice CON el valor entre paréntesis: quien lo vea tiene que poder
 * investigarlo, pero no puede confundirlo con un nombre de producto. Pintar `mp` a secas hacía las
 * dos cosas mal a la vez.
 */
function etiquetaMetodoCobro(metodo) {
  var clave = typeof metodo === 'string' ? metodo.trim() : '';
  if (!clave) return '⚠️ Sin método';
  if (ETIQUETAS_PAID_VIA[clave]) return ETIQUETAS_PAID_VIA[clave];
  if (ETIQUETAS_HEREDADAS[clave]) return ETIQUETAS_HEREDADAS[clave];
  return '⚠️ Método no reconocido (' + clave + ')';
}

if (typeof window !== 'undefined') {
  window.ETIQUETAS_PAID_VIA = ETIQUETAS_PAID_VIA;
  window.ETIQUETAS_HEREDADAS = ETIQUETAS_HEREDADAS;
  window.etiquetaMetodoCobro = etiquetaMetodoCobro;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ETIQUETAS_PAID_VIA, ETIQUETAS_HEREDADAS, etiquetaMetodoCobro };
}
