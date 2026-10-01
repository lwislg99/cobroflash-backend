// src/modules/jobs/domain/dineroDelTrabajo.ts — SCRUM-1355
//
// QUÉ PRESUPUESTOS DE UN TRABAJO SON DINERO, y qué importes salen de ellos.
//
// EL FALLO QUE CIERRA, medido en producción el 1-oct-2026: un Trabajo abierto sin presupuesto
// (SCRUM-651) al que se le cuelga un presupuesto en BORRADOR (SCRUM-1274) decía que le debían su
// total. `serializeJob` leía los presupuestos del Trabajo sin mirar el estado —su `select` no lo
// traía— y, con `Job.totalAceptado` nulo, caía a `quote.total`.
//
// 🔴 UNA RAÍZ, VARIAS SALIDAS. Del mismo borrador salían el importe aceptado, el chip, el importe
// de referencia, lo que queda por cobrar y el siguiente tramo. Por eso el criterio vive AQUÍ, en
// un solo sitio, y la ruta sólo lo consume: arreglarlo línea a línea deja las demás mintiendo.
//
// Funciones PURAS, como `presupuestosDelTrabajo.ts`: entran presupuestos, sale una decisión.

import { restanteDelTrabajo, type PresupuestoConPlan } from './presupuestosDelTrabajo';

/**
 * El único estado que compromete dinero (Parte L del máster: `draft → sent → accepted | rejected`,
 * más `expired`). Un borrador, uno enviado, uno rechazado y uno caducado no los debe nadie.
 */
const ESTADO_ACEPTADO = 'accepted';

/**
 * `status` es OBLIGATORIO en el tipo a propósito: si alguien lo quita del `select` de la ruta,
 * tiene que fallar el compilador y no salir «nadie ha aceptado nada» en todos los Trabajos.
 */
export type PresupuestoDelTrabajo = PresupuestoConPlan & { status: string | null };

/** ¿Lo ha aceptado el cliente? Ante la duda —sin estado legible— NO: no se afirma una deuda. */
export function presupuestoAceptado(q: { status?: unknown } | null | undefined): boolean {
  return q?.status === ESTADO_ACEPTADO;
}

type ResolverPlan = Parameters<typeof restanteDelTrabajo>[1];

export type DineroDelTrabajo<T> = {
  /**
   * El importe aceptado: el GUARDADO en el Trabajo si lo hay (se congela al aceptar, SCRUM-10) y,
   * si no, el del presupuesto ORIGINAL — sólo si está aceptado. `null` = no hay importe aceptado.
   */
  totalAceptado: number | null;
  /** Lo que queda por cobrar: la suma de los restos de los presupuestos ACEPTADOS. */
  restante: number;
  /** El presupuesto del que sale el plan base (siguiente tramo): el ORIGINAL, si está aceptado. */
  quoteDelPlan: T | null;
  /** Los aceptados, en el orden recibido. */
  aceptados: T[];
};

/**
 * @param quotes  los presupuestos del Trabajo **con el ORIGINAL el primero** (contrato de
 *   `quotesDeJob`). Entran TODOS, del estado que sean: filtrar es trabajo de esta función.
 */
export function dineroDelTrabajo<T extends PresupuestoDelTrabajo>(entrada: {
  totalAceptadoGuardado: unknown;
  quotes: T[];
  resolverPlan: ResolverPlan;
}): DineroDelTrabajo<T> {
  const quotes = Array.isArray(entrada.quotes) ? entrada.quotes : [];
  const aceptados = quotes.filter(presupuestoAceptado);
  const original = quotes[0] ?? null;
  const quoteDelPlan = original && presupuestoAceptado(original) ? original : null;

  const guardado = entrada.totalAceptadoGuardado;
  const totalAceptado = guardado != null
    ? Number(guardado)
    : (quoteDelPlan ? Number(quoteDelPlan.total) : null);

  return {
    totalAceptado,
    restante: restanteDelTrabajo(aceptados, entrada.resolverPlan),
    quoteDelPlan,
    aceptados,
  };
}
