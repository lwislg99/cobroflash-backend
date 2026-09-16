/**
 * Desglose de IVA repercutido desde las líneas de factura (Sprint SPAIN).
 *
 * Las líneas guardan `tax` como FRACCIÓN (0.21 = 21%), igual que calcTotal.
 * Reutilizado por: resumen modelo 303 (reports), export XML RRSIF y la
 * cuota total de la huella VeriFactu.
 */

export type VatLine = { qty?: number; price?: number; tax?: number };
export type VatRateEntry = { rate: number; base: number; cuota: number }; // rate en % (21, 10, 4, 0)

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
  const map = new Map<number, { base: number; cuota: number }>();
  for (const l of Array.isArray(lines) ? lines : []) {
    const qty = cantidadDeLinea(l?.qty);
    const price = Number(l?.price) || 0;   // el defecto ES 0: sustituye un cero por un cero
    const taxFrac = Number(l?.tax) || 0;
    const base = qty * price;
    const rate = Math.round(taxFrac * 100);
    const e = map.get(rate) ?? { base: 0, cuota: 0 };
    e.base += base;
    e.cuota += base * taxFrac;
    map.set(rate, e);
  }
  const entries = [...map.entries()]
    .map(([rate, v]) => ({ rate, base: round2(v.base), cuota: round2(v.cuota) }))
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
