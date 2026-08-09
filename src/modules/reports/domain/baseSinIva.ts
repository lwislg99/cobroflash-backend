// src/modules/reports/domain/baseSinIva.ts — SCRUM-403
//
// LA BASE IMPONIBLE DE UNA FACTURA, PARA INFORMES.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE ESTO EMPIEZA A CERRAR
//
// «Beneficio neto» restaba `Invoice.total` menos `Expense.amount`: **totales con IVA en los dos
// lados**. El IVA repercutido NO es ingreso — es dinero de Hacienda que el profesional custodia — y
// el soportado no es gasto suyo si es deducible. Sobre ese número la gente decide si puede
// comprarse la furgoneta.
//
// ⚠️ ESTO ARREGLA **LA MITAD**, y hay que decirlo aquí para que nadie lea el fichero y crea que el
// beneficio ya es correcto. El lado del GASTO no es derivable: `Expense` solo tiene `amount` y **en
// ninguna parte está escrito si lleva IVA**. Hace falta migración (ver
// `docs/master/SCRUM-403-ESPEC-COLUMNAS.md`). Suponerlo sería cometer el mismo defecto.
//
// ⚠️ NO TOCA EL CAMINO DE EMISIÓN (regla 38): **importa** `calcVatBreakdown` y no modifica nada de
// `vat.service.ts`. Aquí solo se LEE lo ya emitido.
import { calcVatBreakdown } from '../../invoicing/domain/vat.service';

/**
 * Resultado de intentar separar base y cuota de una factura.
 *
 * `base: null` NO es cero: es **«no se pudo medir»**. Los dos se pintarían igual en una suma y
 * significan lo contrario — por eso son tipos distintos y quien suma tiene que decidir qué hace,
 * en vez de heredar un 0 silencioso.
 */
export interface BaseDeFactura {
  base: number | null;
  cuota: number | null;
  /** `true` si la base se pudo derivar de las líneas. `false` = hay que declararlo, no rellenarlo. */
  medible: boolean;
}

const NO_MEDIBLE: BaseDeFactura = Object.freeze({ base: null, cuota: null, medible: false });

/**
 * Separa base y cuota de una factura a partir de sus `lines`.
 *
 * ⚠️ **SI NO HAY LÍNEAS UTILIZABLES, NO SE INVENTA LA BASE.** No se devuelve el total como si fuera
 * base, ni se aplica un 21 % supuesto: se devuelve `medible: false` y quien llame lo declara. Una
 * factura sin desglose es un dato que falta, no un cero.
 *
 * Y no se pide coherencia con `invoice.total`: una discrepancia entre el total guardado y la suma
 * del desglose es un HALLAZGO que se reporta, no algo que este módulo deba corregir por su cuenta
 * — corregirlo aquí escondería el defecto en vez de enseñarlo (regla 29: lo emitido no se toca).
 */
export function baseDeFactura(invoice: { lines?: unknown }): BaseDeFactura {
  const lines = Array.isArray(invoice?.lines) ? invoice.lines : null;
  if (!lines || lines.length === 0) return NO_MEDIBLE;

  // `calcVatBreakdown` es el MISMO desglose que usa la emisión. No se replica su aritmética: dos
  // copias del cálculo de IVA envejecen por separado y la que envejece no avisa.
  const { base, cuota } = calcVatBreakdown(lines as any);
  if (!Number.isFinite(base) || !Number.isFinite(cuota)) return NO_MEDIBLE;
  return { base, cuota, medible: true };
}

/**
 * Suma las bases de un conjunto de facturas, **separando lo que no se pudo medir**.
 *
 * Devuelve también `sinDesglose`: cuántas quedaron fuera. Ese número **se enseña**, porque una suma
 * que calla lo que no pudo incluir es exactamente el tipo de cifra que este ticket vino a arreglar.
 */
export function sumaDeBases(invoices: readonly { lines?: unknown }[]): {
  base: number; cuota: number; medidas: number; sinDesglose: number;
} {
  let base = 0;
  let cuota = 0;
  let medidas = 0;
  let sinDesglose = 0;
  for (const inv of invoices ?? []) {
    const r = baseDeFactura(inv);
    if (!r.medible) { sinDesglose += 1; continue; }
    base += r.base as number;
    cuota += r.cuota as number;
    medidas += 1;
  }
  return {
    base: Math.round(base * 100) / 100,
    cuota: Math.round(cuota * 100) / 100,
    medidas,
    sinDesglose,
  };
}
