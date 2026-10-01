// src/modules/billing/domain/estadoDelCobro.ts — SCRUM-1292
//
// UN COBRO PAGADO NO RETROCEDE.
//
// 🔴 EL DEFECTO QUE CIERRA, Y NO NECESITABA NINGUNA CARRERA. `/webhooks/psp` escribía el estado sin
// mirar el que ya tenía: `payment.failed` y `payment.expired` hacían `update({ where: { id } })` a
// secas. El atajo de entrada sólo contemplaba `paid` para `payment.confirmed`, y la segunda guarda
// sólo `failed+payment.failed` y `expired+payment.expired`. `paid` no aparecía en ninguna.
//
// El caso es el orden NORMAL de dos avisos de Stripe, no un caso raro de latencia:
//   ① el cliente paga por Bizum y el cobro queda `paid` — el dinero está;
//   ② la sesión de Stripe que se abrió para ese mismo cobro caduca después, porque nadie la usó;
//   ③ llega `payment.expired` → el cobro pagado pasaba a `expired`.
//
// Y con él, todo lo que cuelga de ese estado: lo que el panel dice que le deben al profesional, los
// avisos y la facturación. Reproducido sobre la ruta compilada (SCRUM-1292, comentario 17635):
// `paid`+`expired` quedaba `expired` y `paid`+`failed` quedaba `failed`, con cuatro controles limpios.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ UNA LISTA DE LOS QUE SÍ, Y NO «TODOS MENOS `paid`»
//
// `Charge.status` es un `String` libre en el esquema, no un enum. Con un «todos menos `paid`», el día
// que aparezca un estado nuevo quedaría pisable **sin que nadie lo decida**. Con esta lista, un
// estado nuevo queda protegido hasta que alguien lo añada a propósito. Ante la duda, el dinero no se
// toca.
//
// Los tres de la lista son los que HOY se pisan, y se siguen pisando igual: `pending` → fallido o
// caducado es el camino normal, y entre `failed` y `expired` se cruzan sin consecuencia (el mismo
// aviso sobre el mismo estado ya lo corta la guarda de entrada, que responde `already_*`).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DOS BARRERAS, COMO EN SCRUM-1276
//
// La condición va **dentro del `where` del `update`**, no sólo en un `if` de entrada: entre
// «comprobar» y «escribir» cabe otra petición, y dentro de la misma sentencia no. El `if` de entrada
// se queda porque ahorra la escritura y da la respuesta buena; la del `update` es la que de verdad
// sujeta. Si no casa, Prisma lanza P2025 y la ruta no hace nada más.

/** Los estados sobre los que un `payment.failed` / `payment.expired` SÍ puede escribir. */
export const ESTADOS_QUE_UN_FALLO_PUEDE_PISAR: string[] = ['pending', 'failed', 'expired'];

/** ¿Este aviso de fallo o caducidad puede escribir sobre un cobro en este estado? */
export function elFalloPuedePisar(estadoActual: string): boolean {
  return ESTADOS_QUE_UN_FALLO_PUEDE_PISAR.includes(estadoActual);
}

/**
 * ¿El `update` no encontró la fila en el estado pedido? (Prisma: «Record to update not found».)
 *
 * Aquí eso NO es un error: es la segunda barrera haciendo su trabajo — alguien pagó entre la lectura
 * y la escritura.
 */
export function esFilaQueNoCasa(err: unknown): boolean {
  return (err as any)?.code === 'P2025';
}
