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
import { diaNaturalEn, finDelDiaEn } from '../../../core/zonaDelMerchant';

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
export function topeDeDevengo(createdAt: Date, zona?: string): Date {
  // SCRUM-1445d (fase 1): con `zona`, el año de la operación y el 31-dic son los de ESA zona (una
  // factura del 1-ene a las 00:30 de Madrid es del año nuevo). Sin ella, la zona del proceso.
  if (zona !== undefined) {
    const año = Number(diaNaturalEn(createdAt, zona).slice(0, 4));
    return finDelDiaEn(`${String(año + 1).padStart(4, '0')}-12-31`, zona);
  }
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
  zona?: string,
): Date | null {
  if (campo === CAMPO_EMISION) return factura.createdAt ?? null;
  if (tieneLineasS2(factura.lines)) return factura.createdAt;
  const tope = topeDeDevengo(factura.createdAt, zona);
  return factura.paidAt && factura.paidAt.getTime() <= tope.getTime() ? factura.paidAt : tope;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-1732 PR-2 (U′, c.22012 + ✅ c.22014; Q3–Q6 de c.22007) · EL DEVENGO POR TRAMOS
//
// Con caja el 303 devenga «por los importes efectivamente percibidos» (LIVA 163 terdecies.Uno): cada
// fila viva de `invoice_payments` es un tramo en su `fechaCobro`, y lo no cobrado devenga en el tope
// del 31-dic X+1. Esto es SOLO del 303: el libro de expedidas anota la factura entera en su periodo de
// expedición (RIVA 69.5 y 63.3) y le completa los cobros (61 decies.1).

/** Una fila de `invoice_payments` tal como la lee el libro. */
export interface FilaDeCobro {
  id: number;
  importe: unknown;
  fechaCobro: Date;
  fechaOrigen?: string | null;
  metodo?: string | null;
  tipo: string;
  anulaId?: number | null;
}

/**
 * Q4 · las filas que CUENTAN: ni las de `anulacion` ni las que una anulación anula. Por fecha de
 * cobro y, a igualdad, por id (el orden en que se apuntaron).
 */
export function filasVivas(filas: readonly FilaDeCobro[]): FilaDeCobro[] {
  const anuladas = new Set(filas.filter((f) => f.tipo === 'anulacion' && typeof f.anulaId === 'number').map((f) => f.anulaId));
  return filas.filter((f) => f.tipo !== 'anulacion' && !anuladas.has(f.id))
    .sort((a, b) => a.fechaCobro.getTime() - b.fechaCobro.getTime() || a.id - b.id);
}

/** Céntimos enteros, o `null` si el importe no se puede leer (familia SCRUM-271: nunca 0). */
export function centimosDe(v: unknown): number | null {
  if (v === null || v === undefined || v === '' || Array.isArray(v)) return null;
  const n = Number(typeof v === 'object' ? String(v) : v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export interface TramoDeDevengo { fecha: Date; centimos: number }

export interface DevengoPorTramos {
  /** Suman SIEMPRE `totalCentimos`: el último es el resto, en el tope si no se cobró antes. */
  tramos: TramoDeDevengo[];
  totalCentimos: number;
  /** Q5 · lo cobrado por encima del total. No devenga y no lanza: se cuenta. */
  cobradoDeMasCentimos: number;
}

/**
 * Los tramos de devengo de UNA factura con caja, o `null` = «la regla de una fecha» de siempre
 * (`fechaDeDevengo`, el 100 % en un solo instante): sin filas (c.21926 §①, como hoy), con línea S2
 * (entera por emisión, SCRUM-1730 i) o con un total que no es un importe positivo legible (la R1 no
 * se toca; un total ilegible no se prorratea).
 *
 * Una factura CON filas, aunque todas estén anuladas, se lee por la tabla: es la verdad fiscal
 * (c.21926 V1). Un cobro posterior al tope no vuelve a devengar: el tope ya se llevó el resto.
 * Q6: la garantía retenida sin liberar es ese resto (pregunta 49 del asesor, sin respuesta).
 */
export function tramosDeDevengo(
  factura: FacturaParaDevengo & { total: unknown },
  filas: readonly FilaDeCobro[] | undefined,
  zona?: string,
): DevengoPorTramos | null {
  if (!filas || filas.length === 0) return null;
  if (tieneLineasS2(factura.lines)) return null;
  const totalCentimos = centimosDe(factura.total);
  if (totalCentimos === null || totalCentimos <= 0) return null;
  const tope = topeDeDevengo(factura.createdAt, zona);
  const tramos: TramoDeDevengo[] = [];
  let acumulado = 0;
  let cobrado = 0;
  for (const f of filasVivas(filas)) {
    const c = centimosDe(f.importe);
    if (c === null || c <= 0) throw new Error(`[devengoPorCaja] fila ${f.id} de invoice_payments con un importe que no se puede leer`);
    cobrado += c;
    if (f.fechaCobro.getTime() > tope.getTime()) continue;
    const d = Math.min(c, totalCentimos - acumulado);
    if (d > 0) { tramos.push({ fecha: f.fechaCobro, centimos: d }); acumulado += d; }
  }
  if (totalCentimos - acumulado > 0) tramos.push({ fecha: tope, centimos: totalCentimos - acumulado });
  return { tramos, totalCentimos, cobradoDeMasCentimos: Math.max(0, cobrado - totalCentimos) };
}

/**
 * Reparte `valor` (euros) entre los tramos en proporción a sus céntimos. Cada parte se redondea al
 * céntimo con el signo aparte (A10, SCRUM-624d: `Math.round` sube el medio céntimo negativo) y el
 * ÚLTIMO tramo es el resto (c.21926): las partes suman `valor` al céntimo.
 */
export function prorratear(valor: number, tramos: readonly { centimos: number }[], totalCentimos: number): number[] {
  const signo = valor < 0 ? -1 : 1;
  const abs = Math.round(Math.abs(valor) * 100);
  let hecho = 0;
  const partes: number[] = [];
  for (let i = 0; i < tramos.length; i++) {
    const p = i === tramos.length - 1 ? abs - hecho : Math.round((abs * tramos[i].centimos) / totalCentimos);
    hecho += p;
    partes.push((signo * p) / 100);
  }
  return partes;
}
