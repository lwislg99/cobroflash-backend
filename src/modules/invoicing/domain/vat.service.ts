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

/** Agrupa las líneas por tipo de IVA → base imponible y cuota por tipo (+ totales). */
export function calcVatBreakdown(lines: VatLine[] | null | undefined): {
  entries: VatRateEntry[];
  base: number;
  cuota: number;
} {
  const map = new Map<number, { base: number; cuota: number }>();
  for (const l of Array.isArray(lines) ? lines : []) {
    const qty = Number(l?.qty) || 1;
    const price = Number(l?.price) || 0;
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
