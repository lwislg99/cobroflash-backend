// src/modules/billing/domain/retencionGarantia.ts — SCRUM-1107
//
// RETENCIÓN DE GARANTÍA DE OBRA. Puro: sin BD, sin red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL PROBLEMA, PARA QUE NINGÚN CAMBIO FUTURO SE DESPISTE
//
// Un profesional que trabaja para una constructora o la Administración no cobra el 100% de su
// factura: el cliente retiene un porcentaje (5% habitual, por contrato — se ven 3, 5 y 10%)
// hasta que pasa el plazo de garantía de la obra (12 meses habitual). Ese dinero es SUYO, se lo
// deben, y en una obra que ya terminó, con un cliente con el que ya no habla, se olvida.
//
// NO es fiscal (el asesor, 23-sep-2026: "la factura se emite por el 100% y el IVA se devenga
// sobre el 100%; lo retenido es un crédito pendiente de cobro"). NO es un descuento (el cliente
// debe el 100%), ni un pago parcial sin más (hay fecha y motivo contractual), ni un impago (no
// está vencido: está aplazado por contrato). Este módulo NO toca `Invoice` ni el camino de
// emisión — vive enteramente sobre `Charge` (docs/master/SCRUM-1107.md §1-§2).
//
// 🔴 CERO ASESORAMIENTO (regla 7): este módulo recuerda un dato que el profesional metió. No
// dice qué porcentaje le corresponde ni si tiene derecho a reclamar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DINERO REAL, CUANDO SE LIBERA, NO VIVE AQUÍ
//
// Cuando el cliente suelta la garantía (500€, o 480€ si hubo un desperfecto descontado), eso es
// un COBRO NUEVO — un `Charge` normal, con su propio `amount` — no una escritura sobre estas
// columnas. Guardar el importe liberado AQUÍ ADEMÁS de en el `Charge` nuevo crearía dos sitios
// que dicen «cuánto se cobró», que es exactamente el defecto que SCRUM-397 (`instanteDeCobro.ts`)
// existe para impedir. `retencionGarantiaCobrada` es solo la FECHA en que eso ocurrió — el
// marcador que apaga el aviso, nunca el importe.

export interface DatosRetencion {
  retencionGarantiaPorcentaje: unknown;
  retencionGarantiaImporte: unknown;
  retencionGarantiaLiberacion: Date | null;
  retencionGarantiaCobrada: Date | null;
}

export type ErrorSplitRetencion = 'total_invalido' | 'porcentaje_invalido';

export type SplitRetencion =
  | { ok: true; porcentaje: number; importeRetenido: number; importeRecibido: number }
  | { ok: false; error: ErrorSplitRetencion };

/**
 * Reparte `total` entre lo retenido y lo recibido, EXACTO al céntimo — nunca «casi». Trabaja en
 * céntimos enteros y calcula `importeRecibido` por RESTA (`total - retenido`), no con una
 * segunda ronda independiente: dos redondeos por separado son la forma clásica en que
 * `retenido + recibido ≠ total` se cuela por un céntimo. Por construcción, aquí no puede pasar.
 *
 * `porcentaje` estrictamente entre 0 y 100: un 0% o un 100% no es una retención, es que no hay
 * retención (0%) o que no se cobra nada ahora (100%, que no es el caso que este ticket cubre) —
 * ninguno de los dos es un dato que este módulo deba aceptar como «hay garantía retenida».
 */
export function calcularSplitRetencion(total: number, porcentaje: number): SplitRetencion {
  if (!Number.isFinite(total) || total <= 0) return { ok: false, error: 'total_invalido' };
  if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje >= 100) {
    return { ok: false, error: 'porcentaje_invalido' };
  }
  const totalCent = Math.round(total * 100);
  const retenidoCent = Math.round((totalCent * porcentaje) / 100);
  const recibidoCent = totalCent - retenidoCent;
  return {
    ok: true,
    porcentaje,
    importeRetenido: retenidoCent / 100,
    importeRecibido: recibidoCent / 100,
  };
}

/** ¿Este cobro tiene una garantía retenida declarada? `NULL` en el porcentaje = no. */
export function tieneRetencionDeclarada(charge: Pick<DatosRetencion, 'retencionGarantiaPorcentaje'>): boolean {
  return charge.retencionGarantiaPorcentaje !== null && charge.retencionGarantiaPorcentaje !== undefined;
}

/**
 * ¿Sigue pendiente de reclamar? Sólo tiene sentido preguntarlo si hay retención declarada —
 * sin ella, «pendiente» no significa nada y se declara `false`, no `true` por defecto.
 */
export function retencionPendiente(
  charge: Pick<DatosRetencion, 'retencionGarantiaPorcentaje' | 'retencionGarantiaCobrada'>,
): boolean {
  return tieneRetencionDeclarada(charge) && charge.retencionGarantiaCobrada == null;
}

/** El fragmento `data` de Prisma para MARCAR declarada una retención sobre un cobro ya existente. */
export function datosParaDeclararRetencion(split: Extract<SplitRetencion, { ok: true }>, liberacion: Date) {
  return {
    retencionGarantiaPorcentaje: split.porcentaje,
    retencionGarantiaImporte: split.importeRetenido,
    retencionGarantiaLiberacion: liberacion,
    retencionGarantiaCobrada: null,
  };
}

/**
 * El fragmento `data` para marcar COBRADA una retención — se aplica sobre el `Charge` ORIGINAL
 * (el que declaró la retención), en el mismo momento en que se registra el `Charge` NUEVO con el
 * dinero de la liberación. Las dos escrituras van en la misma transacción en el llamador: una
 * retención que se marca cobrada sin que exista el cobro que lo cobró sería un aviso apagado
 * sobre un hecho que no ocurrió.
 */
export function datosParaMarcarCobrada(ahora: Date = new Date()) {
  return { retencionGarantiaCobrada: ahora };
}
