// src/modules/quotes/domain/archivado.ts — SCRUM-1273 · ARCHIVAR UN PRESUPUESTO
//
// Archivar es quitarlo de la lista de Presupuestos, NO un estado: `Quote.archivedAt` (NULL = no
// archivado). No toca `status`, ni el sello, ni el documento; desarchivar es volver a NULL.
// Decisiones en SCRUM-1273: c.17511 (sólo borrador, rechazado o caducado) y c.19605 (contrato,
// texto del 409, y que una decisión del cliente lo desarchiva).

/** Los estados de la fila en los que se puede archivar (c.17511). */
const ESTADOS_ARCHIVABLES = ['draft', 'rejected', 'expired'] as const;

export const ERROR_NO_ARCHIVABLE = 'no_archivable';
/** T10, firmado en SCRUM-1273 c.19605. */
export const COPY_NO_ARCHIVABLE = 'Solo se puede archivar un borrador, uno rechazado o uno caducado.';

/**
 * ¿Se puede archivar? Se mira el estado que VE el profesional, no sólo la columna.
 *
 * ⚠️ Un `draft` con su cobro pagado o pendiente la lista lo pinta «pagado» / «pendiente»
 * (`listQuotesAdmin`, la derivación por `charge.status`). Dejar archivarlo contradiría el propio
 * 409 («sólo un borrador…») y escondería dinero de la lista. Con el cobro caducado la lista dice
 * «caducado», que sí se archiva.
 */
export function puedeArchivarse(status: unknown, estadoDelCobro: unknown): boolean {
  const s = typeof status === 'string' ? status.toLowerCase() : '';
  if (!(ESTADOS_ARCHIVABLES as readonly string[]).includes(s)) return false;
  if (s !== 'draft' || estadoDelCobro == null) return true;
  const c = String(estadoDelCobro).toLowerCase();
  return !(c === 'paid' || c === 'succeeded' || c === 'pending');
}
