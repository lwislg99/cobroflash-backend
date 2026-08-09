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
// `docs/master/SCRUM-403.md`). Suponerlo sería cometer el mismo defecto.
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

// ⚠️ AQUÍ NO HAY SUMA DE PERIODO, Y ES LA DECISIÓN QUE SOSTIENE ESTE FICHERO.
//
// La primera versión traía un `sumaDeBases()`. Lo retiró el guard de SCRUM-389: **un agregador
// nuevo de un periodo que no lea el libro crea una SEGUNDA CIFRA OFICIAL del mismo trimestre**, y
// eso ya pasó — `/admin/reports/vat` decía su propio total hasta que ese ticket lo cerró.
// Censarlo como DOCUMENTO para pasar el guard habría sido mentir.
//
// Su criterio dice que quien agregue un periodo LEA EL LIBRO (`leerLibroRegistro`). MEDIDO: hoy
// no sirve para esta cifra. El libro filtra por `createdAt` (emisión) y su asiento **no expone
// `paidAt`** (0 ocurrencias); Informes agrupa por fecha de COBRO. Una factura emitida en marzo y
// cobrada en junio cae en meses distintos: son dos poblaciones.
//
// Hacer que sirva exige MODIFICAR el libro —añadir `paidAt` al asiento o un filtro al rango—, y
// eso es otro ticket con su GO: el permiso sobre A6 era de LECTURA.
//
// Así que este módulo se queda en lo que sí es correcto: el desglose de UN documento.
