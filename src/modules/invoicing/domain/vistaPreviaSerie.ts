// src/modules/invoicing/domain/vistaPreviaSerie.ts — SCRUM-313 (D2) · la vista previa del número.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO NO CALCULA NADA
//
// La vista previa es el corazón de la pantalla de D2, no un adorno: es lo único que convierte
// «41» en «2026-CF-042» delante de los ojos del profesional **antes** de que sea irreversible. Si
// no está, la puerta de última oportunidad no protege nada — el usuario no sabría qué confirma.
//
// Y precisamente por eso **no puede calcular el número por su cuenta**. Si esto compusiera el
// formato o replicara la regla del año, habría DOS sitios calculando el mismo número, y ésa es
// exactamente la forma en que la vista previa acaba diciendo una cosa y la factura otra: no falla
// el día del cambio, falla meses después, cuando alguien toca uno de los dos.
//
// Así que se le PREGUNTA a quien decide:
//
//   · `resolveSeriesSeq` → qué secuencia toca (y es quien aplica el reinicio anual);
//   · `formatInvoiceNumber` → cómo se escribe.
//
// Las dos ya están exportadas. Este módulo las **importa** y no modifica ni una línea de
// `invoiceNumber.service.ts` (regla 38): leer ese camino no es STOP, modificarlo sí.
import { formatInvoiceNumber, resolveSeriesSeq } from './invoiceNumber.service';

/**
 * El número que saldrá de verdad si se emite ahora mismo con este par.
 *
 * @param prefijo  El prefijo de serie del merchant.
 * @param par      `{ invoiceSeriesYear, nextInvoiceNumber }` — el par entero. Se pide junto a
 *                 propósito: `resolveSeriesSeq` devuelve 1 si el año no coincide, así que pasar
 *                 solo el número daría una vista previa que MIENTE (ver SCRUM-313).
 * @param año      El año en curso. Se recibe, no se calcula aquí: quien pinta la pantalla y quien
 *                 la prueba tienen que poder fijarlo, y una llamada a `new Date()` escondida en
 *                 una función pura hace que el test del cambio de año sea imposible de escribir.
 */
export function vistaPreviaSerie(
  prefijo: string | null | undefined,
  par: { invoiceSeriesYear: number | null; nextInvoiceNumber: number },
  año: number,
  rectificativa = false,
): string {
  return formatInvoiceNumber(prefijo, año, resolveSeriesSeq(par, año), rectificativa);
}
