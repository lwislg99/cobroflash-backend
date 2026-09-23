/**
 * Desglose de IVA repercutido desde las líneas de factura (Sprint SPAIN).
 *
 * Las líneas guardan `tax` como FRACCIÓN (0.21 = 21%), igual que calcTotal.
 * Reutilizado por: resumen modelo 303 (reports), export XML RRSIF y la
 * cuota total de la huella VeriFactu.
 */

/**
 * SCRUM-1050/1051 · LISTA CERRADA de causas por las que una línea no repercute IVA por su
 * `tax`. Hoy sólo `S2` (inversión del sujeto pasivo, GO de Javier 23-sep-2026) está ACTIVA — el
 * tipo sólo declara ese literal a propósito: `E1` (exenta) y `N1` (no sujeta) quedan fuera hasta
 * que exista su propio GO (SCRUM-1050 lo denegó por falta de caso de uso citado). Añadir una
 * causa nueva es ensanchar este tipo Y su validador (`core/validation/causaLineaEmitible.ts`) a
 * la vez — uno solo no basta.
 */
export type Causa = 'S2';

export type VatLine = { qty?: number; price?: number; tax?: number; causa?: Causa };
export type VatRateEntry = { rate: number; base: number; cuota: number; causa?: Causa }; // rate en % (21, 10, 4, 0)

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 🔴 SCRUM-504 · LA CANTIDAD DE UNA LÍNEA. Una cantidad AUSENTE no es 1.
 *
 * Aquí ponía `Number(l?.qty) || 1`. `Number('')` es `0`, y `0 || 1` da `1` **en silencio**: una
 * línea sin cantidad legible se cobraba como una unidad. Y no era solo «cobra de más» — era que
 * **el total que el profesional VE y el que el dominio CALCULA no coincidían**: la pantalla ya
 * trataba ese caso como 0 (`quotesView.js:1079`, `Number.isFinite(qty) ? qty : 0`).
 *
 * La semántica no se inventa: **se alinea con lo que el profesional ya ve**.
 *
 * ⚠️ `Number.isFinite` DISTINGUE LO QUE `||` CONFUNDÍA. Con `||`, el `0` de una persona y el `0`
 * de `Number('')` eran el mismo valor falsy y los dos acababan en 1. Aquí:
 *
 *     qty: 1   → 1   (el uno de una persona pasa como uno)
 *     qty: 0   → 0   (un cero escrito a propósito se respeta)
 *     qty: ''  → 0   (ilegible: no aporta importe, y no se inventa una unidad)
 *     qty: 'x' → 0   ·  qty: undefined → 0  ·  qty: null → 0
 *
 * 🔴 Y VIVE EN UN SOLO SITIO A PROPÓSITO. La misma línea estaba copiada en CINCO —el cálculo, la
 * factura final, el reparto por tramos y **dos veces el PDF**—. Cinco copias de `Number.isFinite`
 * volverían a divergir, y la divergencia que importa es la peor de todas: **el papel enseñando una
 * cantidad y la cuenta usando otra**. Con una función, no pueden discrepar.
 */
export function cantidadDeLinea(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/** Agrupa las líneas por tipo de IVA → base imponible y cuota por tipo (+ totales). */
export function calcVatBreakdown(lines: VatLine[] | null | undefined): {
  entries: VatRateEntry[];
  base: number;
  cuota: number;
} {
  // SCRUM-1051: la clave agrupa por (rate, causa). Una línea con causa NUNCA se funde con una
  // sin causa aunque compartan `rate` — son declaraciones fiscales distintas (una S2 a base 100
  // y una S1 al 0% a base 100 no son la misma línea del desglose, aunque las dos "midan" 0%).
  const map = new Map<string, { rate: number; base: number; cuota: number; causa?: Causa }>();
  for (const l of Array.isArray(lines) ? lines : []) {
    const qty = cantidadDeLinea(l?.qty);
    const price = Number(l?.price) || 0;   // el defecto ES 0: sustituye un cero por un cero
    const taxFrac = Number(l?.tax) || 0;
    const base = qty * price;
    const rate = Math.round(taxFrac * 100);
    const causa = l?.causa;
    const key = `${rate}|${causa ?? ''}`;
    const e = map.get(key) ?? { rate, base: 0, cuota: 0, causa };
    e.base += base;
    // Una línea con causa (S2 hoy) no repercute cuota: la autorrepercute el destinatario. Es la
    // CAUSA la que pone la cuota a 0, no el `tax` de la línea — que puede llevar cualquier valor.
    e.cuota += causa ? 0 : base * taxFrac;
    map.set(key, e);
  }
  // `causa` sólo se incluye cuando existe (SCRUM-1051): media docena de llamadores comparan
  // `entries` con `deepStrictEqual` contra fixtures escritos antes de este ticket — una clave
  // `causa: undefined` explícita en CADA entrada rompía esa igualdad sin cambiar ningún importe.
  const entries = [...map.values()]
    .map((v) => (v.causa ? { rate: v.rate, base: round2(v.base), cuota: round2(v.cuota), causa: v.causa }
      : { rate: v.rate, base: round2(v.base), cuota: round2(v.cuota) }))
    .sort((a, b) => b.rate - a.rate);
  return {
    entries,
    base: round2(entries.reduce((a, e) => a + e.base, 0)),
    cuota: round2(entries.reduce((a, e) => a + e.cuota, 0)),
  };
}

/** Cuota total de IVA de una factura (para la huella VeriFactu y el XML). */
export function calcVatCuotaTotal(lines: VatLine[] | null | undefined): number {
  return calcVatBreakdown(lines).cuota;
}
