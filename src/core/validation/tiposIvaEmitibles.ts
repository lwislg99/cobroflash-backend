// src/core/validation/tiposIvaEmitibles.ts — SCRUM-771
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL PORTÓN DE TIPOS DE IVA, AGUAS ABAJO — EN EL LLAMADOR, NUNCA DENTRO DEL EMISOR.
//
// SCRUM-760 cerró UNA puerta: la de la voz. Quedó medido y escrito allí que **el emisor acepta
// el tipo que le den**: `invalidTipoIva` y `TIPOS_IVA_ES_BP` no aparecían ni en `invoicing/` ni
// en `fiscal/`. O sea que cualquier otra boca —la mano, una importación, un endpoint futuro—
// llegaba a la fila de la factura sin que nadie mirase el número.
//
// MEDIDO ANTES DE ESCRIBIR ESTO (6-sep-2026), por el camino REAL de «la mano»: la puerta de la
// factura suelta (`validarFacturaSuelta`) acepta `tax: 1`, `0.15` y `0.5`, y `emitInvoice`
// —el emisor de verdad— los escribe en la fila con número de serie asignado. Un 100 % de IVA
// emitido, con número gastado, y ni un `catch` por el camino.
//
// ── POR QUÉ AQUÍ Y NO DENTRO DEL EMISOR ──────────────────────────────────────────────────
// Meter esto en `invoicing/` o en `fiscal/` sería MODIFICAR el camino de emisión (regla 38 y
// regla 29). Este fichero vive en `core/validation/`, la capa de ANTES —la misma que declara su
// vecino `fiscalInput.ts`: «esto es la capa de antes, para que un dato inválido no llegue nunca
// a construir un registro»—, y lo llama cada boca justo antes de pedir número.
//
// Es el MISMO patrón que `exigirLineasFacturables` (SCRUM-246), y por la misma razón: se llama
// **antes** de `allocateInvoiceNumber`, nunca después. Descubrirlo con el número ya gastado deja
// dos salidas y las dos son malas — modificar una factura numerada, o deshacerla y dejar un
// hueco en la serie que hay que justificar ante Hacienda.
//
// ── SE DERIVA DE `invalidTipoIva`, NO SE COPIA LA LISTA ──────────────────────────────────
// Dos formas de saber qué IVA es válido es la misma regla dos veces, y aquí morder significa una
// factura mal emitida. Aquí no hay lista: hay una llamada. Los SIETE tipos españoles —incluidos
// el 2 %, el 5 % y el 7,5 % de las ventanas temporales que una rectificativa necesita— siguen
// pasando porque los decide `invalidTipoIva` y nadie más.
//
// ⛔ NO se toca `invalidTipoIva`. ⛔ No se toca la doble unidad de `tipoIva` (porcentaje en el
//    albarán, fracción en la factura): aquí SIEMPRE llega fracción, porque es lo que
//    `Invoice.lines[].tax` guarda y lo que cada boca construye. Es ticket aparte.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import { invalidTipoIva } from './fiscalInput';

/** Código del rechazo. Estable, para que un llamador pueda ramificar por él sin leer el texto. */
export const ERROR_TIPO_IVA_NO_EMITIBLE = 'tipo_iva_no_emitible';

/** Lo único que este portón mira de una línea. Deliberadamente mínimo. */
export interface LineaConTipoDeIva {
  tax?: unknown;
}

export class TipoIvaNoEmitibleError extends Error {
  readonly code = ERROR_TIPO_IVA_NO_EMITIBLE;
  /** El motivo, que NOMBRA el valor recibido. Viaja al log del servidor, no a la pantalla. */
  readonly detalle: string;
  constructor(detalle: string) {
    super(`${ERROR_TIPO_IVA_NO_EMITIBLE}: ${detalle}`);
    this.name = 'TipoIvaNoEmitibleError';
    this.detalle = detalle;
  }
}

/**
 * El motivo del rechazo, o `null` si todas las líneas llevan un tipo que existe. PURO.
 *
 * 🔴 JUZGA EL VALOR QUE EL EMISOR VA A USAR, NO EL QUE VENGA ESCRITO. La coerción es
 * **exactamente** la de `calcVatBreakdown` (`vat.service.ts:54`), que es quien produce la base,
 * la cuota y el `CuotaTotal` que se sella en la huella VeriFactu:
 *
 *     const taxFrac = Number(l?.tax) || 0;
 *
 * Copiarla es deliberado y es lo contrario de duplicar una regla: si este portón juzgara un valor
 * distinto del que se va a cobrar, rechazaría líneas que el sistema calcula perfectamente (una
 * línea exenta sin campo `tax` es 0 % para el calculador) o dejaría pasar lo que el calculador
 * usa de verdad. Lo que NO se duplica es qué tipos existen: eso lo decide `invalidTipoIva`.
 *
 * El motivo NOMBRA el valor porque `invalidTipoIva` ya lo nombra — no se escribe un texto nuevo.
 */
export function tipoIvaNoEmitible(lines: readonly LineaConTipoDeIva[] | null | undefined): string | null {
  if (!Array.isArray(lines)) return null; // sin líneas no hay tipo que juzgar
  for (let i = 0; i < lines.length; i++) {
    const taxFrac = Number(lines[i]?.tax) || 0; // MISMA coerción que `calcVatBreakdown`
    const motivo = invalidTipoIva(taxFrac);
    if (motivo) return `línea ${i + 1}: el IVA ${motivo}`;
  }
  return null;
}

/**
 * Portón. Se llama **antes** de `allocateInvoiceNumber`, nunca después.
 *
 * Lanza en vez de devolver un booleano, por el mismo motivo que `exigirLineasFacturables`: un
 * valor se puede ignorar y un `throw` no, y al otro lado de ignorarlo hay un documento fiscal con
 * un tipo de IVA que no existe.
 *
 * ⚠️ NINGUNA ruta traduce esto a copy de pantalla, y es deliberado: el texto que lee el
 * profesional es microcopy y la firma el fundador (regla 30). Hasta que exista esa firma, el
 * rechazo es FALLO CERRADO —no se emite— y el motivo queda en el log del servidor.
 */
export function exigirTiposDeIvaEmitibles(lines: readonly LineaConTipoDeIva[] | null | undefined): void {
  const motivo = tipoIvaNoEmitible(lines);
  if (motivo) throw new TipoIvaNoEmitibleError(motivo);
}

/** ¿Este error es el del portón de tipos? Para que un llamador ramifique por CÓDIGO, no por texto. */
export function esErrorTipoIvaNoEmitible(e: unknown): boolean {
  return (e as any)?.code === ERROR_TIPO_IVA_NO_EMITIBLE;
}
