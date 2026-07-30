// src/modules/invoicing/domain/lineasFacturables.ts — SCRUM-246
//
// SIN LÍNEAS CON IMPORTE NO SE EMITE, Y SOBRE TODO: NO SE CONSUME NÚMERO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO
//
// `applyVeriFactu` se niega a sellar una factura sin líneas (`invoice_without_lines_not_sellable`),
// y varios caminos de emisión escriben `lines: scaledLines.length > 0 ? scaledLines : undefined`.
// O sea: una factura fiscal sin líneas **nace imposible de sellar**, y desde SCRUM-205 tampoco
// puede producir documento. Antes salía igual por el fail-open, con el QR casero.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ **ANTES** DE `allocateInvoiceNumber` Y NO DESPUÉS
//
// Ésta es toda la decisión. Comprobar después dejaría dos salidas y las dos son malas:
//   · dejar la factura creada y "arreglarla" luego → modificar una factura YA NUMERADA, que es
//     terreno fiscal delicado (regla 29);
//   · deshacerla → el número ya está consumido, y revertir es lo que crea el HUECO en la serie
//     que hay que justificar ante Hacienda.
//
// Comprobando antes no hay nada que deshacer: el número no llega a pedirse. El profesional
// arregla su presupuesto y emite, y la serie ni se entera.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ CUENTA COMO "LÍNEA CON IMPORTE"
//
// **Al menos una** línea con `qty × price` distinto de CERO. En cualquier dirección: una R1
// lleva las líneas de la original con el precio negado, y sigue moviendo dinero.
//
// «Al menos una», no «todas»: una factura puede llevar legítimamente un concepto a 0 € (algo
// incluido, un descuento en línea aparte) mientras el resto tiene importe. Lo que no puede es
// no tener NINGUNO — eso no es una factura, es un documento vacío con un número de serie
// gastado.
//
// El IVA no entra en la cuenta a propósito: una línea de 100 € al 0 % tiene importe. Que un
// tramo al 0 % además bloquee la exportación es otra cosa, y es de SCRUM-209.

/** Código único del rechazo. Se ramifica por CÓDIGO, nunca por el texto (SCRUM-151). */
export const ERROR_SIN_LINEAS = 'factura_sin_lineas';

/**
 * Copy para el PROFESIONAL (rutas de admin).
 * [PENDIENTE microcopy oficial] — lo aprueba el fundador (regla 30).
 *
 * Lo lee un fontanero en el momento de facturar: dice qué pasa y qué hacer, sin jerga. Ni
 * «líneas», ni «importe bruto», ni el nombre del error.
 */
export const COPY_ADMIN_SIN_LINEAS =
  'Este presupuesto no tiene ningún concepto con precio, así que todavía no se puede facturar. Añade lo que vas a cobrar y vuelve a intentarlo.';

/**
 * Copy para el CLIENTE FINAL (C1: acepta el presupuesto desde WhatsApp).
 * [PENDIENTE microcopy oficial] — regla 30, y aquí importa más: **el cliente no puede
 * arreglarlo**. Su aceptación ya ha valido; lo que falta es que el profesional complete el
 * presupuesto. Por eso no dice «inténtalo de nuevo»: le diría que repita algo que ya hizo bien.
 */
export const COPY_PUBLICO_SIN_LINEAS =
  'Hemos recibido tu aceptación. El profesional tiene que completar un detalle del presupuesto antes de emitir la factura; te llegará en cuanto lo haga.';

export interface LineaFacturable {
  qty?: unknown;
  price?: unknown;
}

export class FacturaSinLineasError extends Error {
  readonly code = ERROR_SIN_LINEAS;
  constructor() {
    super(ERROR_SIN_LINEAS);
    this.name = 'FacturaSinLineasError';
  }
}

/** ¿Hay al menos una línea que aporte importe? */
export function hayLineasFacturables(lines: LineaFacturable[] | null | undefined): boolean {
  if (!Array.isArray(lines) || lines.length === 0) return false;
  return lines.some((l) => {
    const qty = Number(l?.qty ?? 0);
    const price = Number(l?.price ?? 0);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return false;
    // DISTINTO DE CERO, no "mayor que": lo destapó el guard al llegar a la R1. Una
    // rectificativa lleva las líneas de la original con el precio NEGADO, así que exigir un
    // importe positivo habría bloqueado TODA rectificativa — y una R1 es justo lo único con lo
    // que se corrige una factura ya emitida (regla 29). Lo que no puede haber es una factura
    // que no mueva dinero en ninguna dirección.
    return qty * price !== 0;
  });
}

/**
 * Portón de emisión. Se llama **antes** de `allocateInvoiceNumber`, nunca después.
 *
 * Lanza `FacturaSinLineasError`, que cada ruta traduce a un 409 con su copy. No devuelve un
 * booleano a propósito: un valor se puede ignorar y un `throw` no, y aquí lo que hay al otro
 * lado de ignorarlo es un número de serie gastado en un documento vacío.
 */
export function exigirLineasFacturables(lines: LineaFacturable[] | null | undefined): void {
  if (!hayLineasFacturables(lines)) throw new FacturaSinLineasError();
}

/** ¿Este error es el del portón de líneas? Para que los llamadores ramifiquen por código. */
export function esErrorSinLineas(e: unknown): boolean {
  return (e as any)?.code === ERROR_SIN_LINEAS || (e as any)?.message === ERROR_SIN_LINEAS;
}
