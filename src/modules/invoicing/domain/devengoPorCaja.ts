// src/modules/invoicing/domain/devengoPorCaja.ts — SCRUM-294 (fase B)
//
// QUÉ FECHA DECIDE EL TRIMESTRE DE UNA FACTURA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL TICKET, EN UNA FRASE
//
// Con criterio de caja (RECC) el IVA se devenga **cuando se cobra**, no cuando se emite. Así que
// una factura emitida en un trimestre y cobrada en otro **declara en el del cobro**.
//
// Sin caja el periodo lo decide `Invoice.createdAt` —`libroRegistro.repo.ts` filtra por ahí— y de ese
// libro sale el 303. Cambiar la fecha que manda es, literalmente, cambiar en qué declaración cae
// el euro.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ ESTO NO ES UNA CASILLA
//
// Un facturador sin pasarela solo puede ofrecer el RECC como una casilla informativa: no sabe
// cuándo cobras, así que su usuario acaba llevando en una libreta qué facturas ha cobrado para
// poder liquidar. **Nosotros tenemos el cobro dentro.** El entregable no es la casilla: es que el
// dato esté bien puesto para que A5 calcule el 303 contra cobros reales.
//
// ⚠️ LO QUE NO SE PUEDE AFIRMAR TODAVÍA, y está medido en `criterioCaja.ts`: `paidAt` es el
// instante en que **alguien marcó** el cobro, no siempre aquel en que entró el dinero. Los tres
// webhooks lo ponen en el momento del aviso —correcto— y el marcado manual guarda desde SCRUM-397
// la fecha que declara la persona. Esa es la mejor fecha que hay, y es la que se usa; lo que no se
// hace es fingir que es otra cosa.
import { leerCriterioCaja } from './criterioCaja';

/** La fecha que decide el periodo cuando NO hay criterio de caja: la de emisión. */
export const CAMPO_EMISION = 'createdAt';
/** La fecha que decide el periodo CON criterio de caja: la del cobro. */
export const CAMPO_COBRO = 'paidAt';

export type CampoDeDevengo = typeof CAMPO_EMISION | typeof CAMPO_COBRO;

/**
 * 🔴 EL SUELO DEL TICKET: una lectura fallida NO se degrada a «sin criterio de caja».
 *
 * «Sin criterio de caja» es un valor legítimo —la mayoría de los merchants— y por eso es **el peor
 * sitio del mundo para degradar**: si un fallo de lectura se convierte en «no tiene RECC», el
 * merchant acogido declara por emisión, liquida IVA que aún no ha cobrado, y **nadie lo nota
 * jamás** porque el resultado se parece al de todos los demás.
 *
 * Por eso esto LANZA. Un 303 que no se puede calcular es un problema visible; uno calculado con el
 * criterio equivocado es un problema que se descubre en una inspección.
 */
export function campoDeDevengo(configCriterioCaja: unknown): CampoDeDevengo {
  const r = leerCriterioCaja(configCriterioCaja);
  if (!r.ok) {
    throw new Error(
      `no se puede decidir el devengo: ${r.motivo}. NO se continúa por emisión — «sin criterio de `
      + 'caja» es un valor legítimo y degradar a él haría que un merchant acogido al RECC declarara '
      + 'como todos los demás sin que nadie lo notara.',
    );
  }
  return r.acogido ? CAMPO_COBRO : CAMPO_EMISION;
}

export interface FacturaParaDevengo {
  /** Cuándo se emitió. Siempre existe. Hace de fecha de la OPERACIÓN (SCRUM-1730 c.21789). */
  createdAt: Date;
  /** Cuándo consta cobrada. `null` = no consta cobrada. */
  paidAt?: Date | null;
  /** Las líneas tal cual se guardan. Sólo se mira si alguna lleva `causa: 'S2'` (SCRUM-1730 · i). */
  lines?: unknown;
}

/**
 * SCRUM-1730 (i) · ¿Alguna línea lleva la causa S2 (inversión del sujeto pasivo)?
 *
 * ⚠️ Es la misma pregunta que `tieneLineasIsp` de `destinatarioIsp.ts`, y está COPIADA a propósito:
 * aquélla no se exporta y vive en el camino de emisión; exportarla sería modificarlo (regla 38).
 */
function tieneLineasS2(lines: unknown): boolean {
  return Array.isArray(lines) && lines.some((l) => (l as { causa?: unknown } | null)?.causa === 'S2');
}

/**
 * SCRUM-1730 (ii) · LIVA 163 terdecies.Uno: sin cobro, el devengo se produce el 31 de diciembre del
 * año inmediato posterior al de la operación. Con su último milisegundo, como `rangoTrimestre`: el
 * tope cae DENTRO del cuarto trimestre de ese año.
 */
export function topeDeDevengo(createdAt: Date): Date {
  return new Date(createdAt.getFullYear() + 1, 11, 31, 23, 59, 59, 999);
}

/**
 * La fecha que decide el trimestre de ESTA factura.
 *
 * Con criterio de caja (SCRUM-1730, GO de c.21789):
 *   · (i)  una factura con ALGUNA línea S2 devenga por EMISIÓN: LIVA 163 duodecies.Dos.d deja la
 *          inversión del sujeto pasivo fuera del régimen. Una mixta (S1+S2) va ENTERA por emisión
 *          hasta que conteste el asesor (pregunta en SCRUM-1264).
 *   · (ii) cobrada hasta el tope → la del cobro. Sin cobro, o cobrada DESPUÉS del tope → el tope: ya
 *          devengó el 31-dic, y el cobro posterior no la vuelve a meter en otro trimestre (el IVA
 *          saldría dos veces).
 *
 * Nunca devuelve `null` con caja: toda factura devenga en algún momento. Antes de 1730 devolvía
 * `null` sin cobro, y la factura no caía en ningún trimestre jamás.
 */
export function fechaDeDevengo(
  factura: FacturaParaDevengo,
  campo: CampoDeDevengo,
): Date | null {
  if (campo === CAMPO_EMISION) return factura.createdAt ?? null;
  if (tieneLineasS2(factura.lines)) return factura.createdAt;
  const tope = topeDeDevengo(factura.createdAt);
  return factura.paidAt && factura.paidAt.getTime() <= tope.getTime() ? factura.paidAt : tope;
}
