// src/modules/invoicing/domain/portonDocumento.ts — SCRUM-206
//
// SI LA FACTURA DEBE ESTAR EN LA CADENA Y NO LO ESTÁ, NO SALEN BYTES.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE CIERRA ESTO
//
// El sellado VeriFactu vivía dentro de un `try { … } catch { console.error }` en CUATRO sitios
// (no dos, como decía el ticket). Cuando el sellado fallaba, el `catch` registraba el fallo y la
// ejecución SEGUÍA: se generaba el PDF, se persistía `pdfUrl` y se entregaba el documento. Una
// factura sin huella es una factura que a ojos de la AEAT no está encadenada — eso no es un error
// recuperable que se pueda tapar con una línea de log, es un **documento inválido entregado**.
//
// Y lo entregaba con un QR: el fallback casero `INV:<num>|AMOUNT:…|CUR:…` que el código fija
// antes de intentar sellar. Eso es peor que un PDF sin QR, porque el documento APARENTA estar
// completo — lleva algo con forma de código verificable que no lo es.
//
// Uno de los caminos era alcanzable desde `GET /recibo/:token/pdf`, que es público (solo lo
// protege el token opaco de SCRUM-74). O sea que el clic del cliente final disparaba el
// fail-open y se llevaba el documento inválido.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EL NÚMERO NO SE REVIERTE NUNCA
//
// Medido: cuando el `catch` salta, el número YA está consumido — `allocateInvoiceNumber` corre
// dentro de un `$transaction` que commitea ANTES de que se intente sellar. Pero eso **no deja un
// hueco en la serie**: la fila existe con su número. Lo que deja es una factura numerada sin
// eslabón en la cadena, que es reintentable.
//
// El hueco aparecería si este arreglo decidiera revertir o borrar. **Deshacer es justamente lo
// que crearía el hueco que habría que justificar ante Hacienda** (y va contra la regla 29). Así
// que aquí no se deshace nada: se impide que salga el documento, y la factura se queda esperando
// su sellado.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// UN SOLO PORTÓN, NO CUATRO ARREGLOS PARECIDOS
//
// El defecto es el patrón, no la línea. Cuatro correcciones con el mismo espíritu divergen en la
// quinta ocasión; un portón compartido solo puede divergir si alguien lo rodea, y eso se ve.
import { isReceiptNumber } from './invoiceNumber.service';

/** Código único del rechazo. Se ramifica por CÓDIGO, nunca por el texto (SCRUM-151). */
export const ERROR_SIN_SELLAR = 'invoice_sin_sellar';

/**
 * Copy OFICIAL para el cliente final, aprobado por el fundador el 30-jul-2026 (regla 30).
 *
 * No menciona sellado, ni huella, ni VeriFactu, ni el error técnico: el destinatario es el
 * cliente de un fontanero. Y por la regla 26, ni una palabra que explique VeriFactu.
 */
export const COPY_PUBLICO_SIN_SELLAR =
  'Esta factura se está registrando en Hacienda. Vuelve a intentarlo en un minuto.';

/** Lo mínimo que hace falta saber del merchant para decidir. */
export interface MerchantPorton {
  country?: string | null;
  taxId?: string | null;
}

/** Lo mínimo que hace falta saber de la factura. */
export interface FacturaPorton {
  number: string;
  vfHash?: string | null;
}

export class FacturaSinSellarError extends Error {
  readonly code = ERROR_SIN_SELLAR;
  readonly numero: string;
  // La causa original (el fallo de sellado) se CONSERVA en `cause`: el llamador necesita un
  // código único para decidir, y quien diagnostique necesita el error de verdad. Convertir uno
  // en otro perdiendo el original es cómo se pierde la mitad de un diagnóstico.
  constructor(numero: string, opciones?: { cause?: unknown }) {
    super(`${ERROR_SIN_SELLAR}:${numero}`, opciones as ErrorOptions | undefined);
    this.name = 'FacturaSinSellarError';
    this.numero = numero;
  }
}

/** ¿Es de las que tienen que entrar en la cadena? */
export function debeEstarEnLaCadena(numero: string, merchant: MerchantPorton | null | undefined): boolean {
  // MISMA condición que ya usaban los cuatro sitios antes de intentar sellar. Se centraliza
  // sin cambiarla: si aquí dijera algo distinto de lo que decían ellos, el portón cambiaría
  // el alcance del sellado además de cerrar el fail-open, y eso no es este ticket.
  return merchant?.country === 'ES' && !!merchant?.taxId && !isReceiptNumber(numero);
}

/**
 * `vfHash` es el ÚNICO discriminador fiable de «sellada», y conviene saber por qué:
 * `qrData` y `pdfUrl` se rellenaban IGUAL en el camino bueno y en el fallido (con el QR
 * casero), así que ninguno de los dos distingue. `vfHash` solo lo escribe `applyVeriFactu`.
 */
export function estaSellada(inv: FacturaPorton): boolean {
  return !!inv.vfHash;
}

/** ¿Puede salir un documento de esta factura? */
export function puedeSalirDocumento(inv: FacturaPorton, merchant: MerchantPorton | null | undefined): boolean {
  if (!debeEstarEnLaCadena(inv.number, merchant)) return true; // J-… y no-ES: no llevan huella y está bien
  return estaSellada(inv);
}

/**
 * Portón. Lanza `FacturaSinSellarError` si la factura debería estar encadenada y no lo está.
 *
 * Se llama INMEDIATAMENTE antes de producir cualquier byte —renderizar el PDF, persistir
 * `pdfUrl`/`qrData`, adjuntar al email, meter en el ZIP—. No al principio de la función: al
 * borde de la salida, que es donde la garantía es local y se puede leer de un vistazo.
 */
export function exigirDocumentoEmitible(
  inv: FacturaPorton,
  merchant: MerchantPorton | null | undefined,
): void {
  if (!puedeSalirDocumento(inv, merchant)) throw new FacturaSinSellarError(inv.number);
}

/** ¿Este error es el del portón? Para que los llamadores ramifiquen por código. */
export function esErrorSinSellar(e: unknown): boolean {
  return (e as any)?.code === ERROR_SIN_SELLAR || String((e as any)?.message ?? '').startsWith(ERROR_SIN_SELLAR);
}
