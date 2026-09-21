// src/modules/billing/domain/transferenciaDisponible.ts — SCRUM-910.
//
// UN SOLO SITIO QUE CONTESTA «¿PUEDE ESTE PROFESIONAL COBRAR POR TRANSFERENCIA?».
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE CIERRA, medido el 17-sep-2026 corriendo las rutas reales
//
// Había CUATRO criterios distintos para la misma pregunta — uno más que los tres de la tarjeta
// que cerró SCRUM-893:
//
//   `payInvoice.routes.ts:57`  el selector ....... `!!(iban || clabe)`      ← no mira el país
//   `receipt.routes.ts:110`    el recibo ......... NINGUNO (`status === 'pending'` y ya)
//   `payBank.routes.ts:41`     la página destino . `country === 'MX' && clabe` · `else if (iban)`
//   `viasDeCobro.ts:79`        el dashboard ...... sólo `iban` — ignora CLABE
//
// Y el que tiene razón es el TERCERO, porque es el único que decide de verdad: es quien pinta —o
// no pinta— el número de cuenta al que transferir. Los otros tres opinan; ése resuelve.
//
// Dos víctimas medidas, las dos corriendo la ruta:
//
//   · **ES con SOLO CLABE** (hallazgo de la Sesión 3, comentario 15679 de SCRUM-893): el selector
//     ofrece «Transferencia bancaria» porque ve `clabe`, y `/pay/bank` cae al `else` —el bloque de
//     CLABE exige `country === 'MX'`— y le dice a la clienta que el profesional no ha configurado
//     su cuenta. Se le ofreció una vía que esa página no puede completar.
//   · **sin Connect y SIN IBAN**: con SCRUM-893 la tarjeta ya no se ofrece, así que en `/recibo`
//     «Pagar por transferencia» se quedaba como ÚNICO botón — y también lleva a esa misma página
//     sin cuenta. Cerrar la puerta de la tarjeta y dejar ésta abierta no reduce el defecto:
//     reduce su visibilidad.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ LA VERDAD SE COPIA DE `payBank` Y NO AL REVÉS
//
// Lo natural sería que `payBank` preguntara aquí. No se hace, y no por pereza: `payBank` es la
// página del camino de cobro y en este ticket está acotada. Así que esta función REPLICA su regla
// y el banco la ata contra la ruta **EJECUTADA** — se le pide `/pay/bank/:token` a cada
// combinación y se mira si pinta número de cuenta. No se compara contra su fuente: contra lo que
// hace. Mismo trato que `cardChargeMode` recibió en SCRUM-893.
//
//     🔒 Lo que no se puede unir, que al menos no pueda separarse sin avisar.
//
// ⚠️ Y esto NO toca `viasDeCobro.transferencia`, que es el cuarto criterio y sigue ignorando la
// CLABE. Cambiarlo altera lo que el PROFESIONAL ve sobre su propia cuenta, y eso lo decide el
// fundador (misma razón por la que `viasDeCobro.tarjeta` quedó fuera de SCRUM-893).

/** Lo que hace falta saber. Laxo a propósito: lo llaman rutas con `select` distintos. */
export type MerchantParaTransferencia = {
  country?: unknown;
  iban?: unknown;
  clabe?: unknown;
} | null | undefined;

const noVacio = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;

/**
 * ¿Podría `/pay/bank` enseñarle a la clienta un número de cuenta al que transferir?
 *
 * Réplica exacta de `payBank.routes.ts`: CLABE **sólo** para México, IBAN en cualquier otro caso.
 * El país se resuelve igual que allí (`merchant?.country || 'ES'`), y no es un detalle: un negocio
 * español con sólo CLABE es justamente el caso que se escapaba.
 *
 * FAIL-CLOSED: merchant ausente o sin datos → `false`. Ante la duda no se ofrece una vía que
 * quizá no se pueda completar — es la misma regla que el resto de la página.
 */
export function transferenciaDisponible(merchant: MerchantParaTransferencia): boolean {
  const pais = (typeof merchant?.country === 'string' && merchant.country.trim()) || 'ES';
  if (pais === 'MX' && noVacio(merchant?.clabe)) return true;
  return noVacio(merchant?.iban);
}
