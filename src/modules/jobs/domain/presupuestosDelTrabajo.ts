// src/modules/jobs/domain/presupuestosDelTrabajo.ts — SCRUM-195 (rebanada 2)
//
// EL CRITERIO de qué presupuestos entran en un Trabajo, en qué ORDEN, cuál se cobra y cuánto
// queda pendiente. Vive aquí y no dentro de `jobs.routes.ts` por un motivo concreto:
//
//   Escrito en la ruta, la única forma de probarlo sin levantar la app era **copiarlo** en el
//   test. Y una copia no prueba el criterio: prueba la copia. El día que la ruta se desviara,
//   los tests seguirían verdes — que es el defecto que SCRUM-198 y SCRUM-216 desmontaron
//   (dos arneses del mismo hecho, mantenidos aparte).
//
// Son funciones PURAS: entran presupuestos, sale una decisión. Sin Prisma, sin red, sin reloj.

export type PresupuestoConPlan = {
  id: number;
  total: unknown;               // Decimal(12,2) de Prisma, o string
  Invoice?: Array<unknown> | null;
  paymentTerms?: string | null;
  customBillingPlan?: unknown;
};

type Tramo = { index: number; percentage: number; label?: string };
type ResolverPlan = (q: PresupuestoConPlan) => Tramo[];

/**
 * ORIGINAL primero, adicionales después por id ascendente.
 *
 * EL ORDEN ES CONTRATO, no estética: de él dependen qué presupuesto define el alcance base y a
 * cuál va el siguiente tramo. Sin un orden fijo, pulsar «cobrar el resto» dos veces podría
 * emitir tramos de presupuestos distintos según cómo devolviera las filas la base.
 */
export function ordenarPresupuestos<T extends { id: number }>(
  quotes: T[],
  quoteIdDelJob: number | null | undefined,
): T[] {
  return [
    ...quotes.filter((q) => q.id === quoteIdDelJob),
    ...quotes.filter((q) => q.id !== quoteIdDelJob).sort((a, b) => a.id - b.id),
  ];
}

/** ¿A este presupuesto le queda algún tramo por emitir? */
export function tieneTramoPendiente(q: PresupuestoConPlan, resolverPlan: ResolverPlan): boolean {
  return (q.Invoice || []).length < resolverPlan(q).length;
}

/**
 * El presupuesto que toca cobrar, o `null` si no queda ninguno.
 *
 * EL FALLO QUE CIERRA: antes esto no existía y la ruta miraba SOLO el que `Job.quoteId`
 * apuntaba. Con el original ya cobrado entero y un adicional pendiente, respondía
 * «nothing_pending» — el pro no podía cobrar lo que le deben, y el mensaje decía que no
 * quedaba nada.
 *
 * Cada presupuesto lleva su PROPIO plan (decisión 5 del ticket: el plan del extra es
 * independiente), así que no se mezclan planes: se cobra el siguiente tramo del primero que
 * tenga alguno.
 */
export function primeroConTramoPendiente<T extends PresupuestoConPlan>(
  quotes: T[],
  quoteIdDelJob: number | null | undefined,
  resolverPlan: ResolverPlan,
): T | null {
  return ordenarPresupuestos(quotes, quoteIdDelJob).find((q) => tieneTramoPendiente(q, resolverPlan)) ?? null;
}

/**
 * Lo que queda por cobrar del TRABAJO = suma de los restos de todos sus presupuestos.
 *
 * EL FALLO QUE CIERRA: antes salía solo del original, así que un adicional aceptado y no
 * cobrado no contaba como pendiente. **El pro veía menos deuda de la que tiene**, sin ningún
 * error de por medio.
 */
export function restanteDelTrabajo(quotes: PresupuestoConPlan[], resolverPlan: ResolverPlan): number {
  let total = 0;
  for (const q of quotes) {
    const plan = resolverPlan(q);
    const emitidas = (q.Invoice || []).length;
    if (emitidas < plan.length) {
      const pct = plan.slice(emitidas).reduce((a, s) => a + s.percentage, 0);
      total += Math.round(Number(q.total) * pct * 100) / 100;
    }
  }
  return Math.round(total * 100) / 100;
}
