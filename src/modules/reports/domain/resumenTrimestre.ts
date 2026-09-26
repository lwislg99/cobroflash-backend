// src/modules/reports/domain/resumenTrimestre.ts — SCRUM-1048 (CON-07a)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ CALCULA ESTO, Y QUÉ NO
//
// El resumen del trimestre para el asesor: IVA repercutido (ya lo daba `GET /admin/reports/vat`,
// SCRUM-296/389), IVA soportado (NUEVO aquí) y la diferencia entre los dos. Son números de SU
// base — se marcan «borrador para tu asesor» (regla 7) y NUNCA «lo que debes» ni «Hacienda».
//
// Las RETENCIONES sufridas NO están aquí, y no es un hueco por hacer: `Invoice` no tiene ninguna
// columna para la retención APLICADA a una factura (`retencionIrpf.ts` lo deja escrito — el
// mecanismo existe y está probado, pero espera el ALTER de SCRUM-293/A2, que sigue sin aplicar).
// Sin columna no hay fila que sumar; inventar un 0,00 sería afirmar «no hubo retenciones» cuando
// lo cierto es «no se guardan todavía». Por eso `retenciones.disponible` es `false` con su motivo,
// nunca un número.
//
// SOLO CÁLCULO DE INFORME: no toca facturas, gastos, libros ni el camino de emisión (regla 38,
// que permite leer). No decide qué gasto es deducible — lee `Expense.vatDeducible`, que ya lo
// marcó el profesional; lo que no está marcado se declara `sinClasificar`, nunca se asume.
import { aCentimos } from './desgloseEmpleado';

const aEuros = (c: number): number => c / 100;
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface DesgloseIva {
  tipo: number;
  base: number;
  cuota: number;
}

/**
 * Agrupa entradas `{tipo, base, cuota}` (la forma que ya produce `calcVatBreakdown` y que usa
 * el libro de registro) sumando por tipo, en céntimos enteros para que la suma cuadre.
 *
 * Misma agrupación que hacía en línea `GET /admin/reports/vat` (SCRUM-296/389) — se saca aquí
 * para que el resumen del trimestre la reutilice en vez de reimplementarla una segunda vez
 * (la línea única no se busca, se crea).
 */
function agruparIvaPorTipo(
  entradas: readonly { tipo: number; base: number; cuota: number }[],
): DesgloseIva[] {
  const map = new Map<number, { baseC: number; cuotaC: number }>();
  for (const e of entradas) {
    const acc = map.get(e.tipo) ?? { baseC: 0, cuotaC: 0 };
    acc.baseC += aCentimos(e.base);
    acc.cuotaC += aCentimos(e.cuota);
    map.set(e.tipo, acc);
  }
  return [...map.entries()]
    .map(([tipo, v]) => ({ tipo, base: r2(aEuros(v.baseC)), cuota: r2(aEuros(v.cuotaC)) }))
    .sort((a, b) => b.tipo - a.tipo);
}

export interface GastoParaSoportado {
  /** El total con IVA (SCRUM-324). Solo para poder declarar el importe de lo sin clasificar. */
  amount: unknown;
  /** Tipo en ENTERO de porcentaje (21/10/4/0), la convención de `Expense.vatRate` (SCRUM-403). */
  vatRate: unknown;
  /** La cuota GUARDADA (SCRUM-403): no se recalcula desde `amount`/`baseAmount`. */
  vatAmount: unknown;
  /** La base sin IVA, para el desglose por tipo. */
  baseAmount: unknown;
  /**
   * `true` = el profesional lo marcó deducible · `false` = marcó que NO · `null`/`undefined` =
   * nunca clasificado. Los tres son datos distintos (SCRUM-403): aquí NUNCA se decide cuál es
   * cuál, solo se lee lo que ya está marcado.
   */
  vatDeducible: unknown;
}

export interface ConteoImporte {
  count: number;
  importe: number;
}

export interface IvaSoportadoResumen {
  /** Solo los gastos marcados `vatDeducible: true` — lo único que entra en la diferencia. */
  porTipo: DesgloseIva[];
  totalBaseDeducible: number;
  totalCuotaDeducible: number;
  /** Marcados `vatDeducible: false`: cuota real, pero NO entra en la diferencia con Hacienda. */
  noDeducible: ConteoImporte;
  /**
   * `vatDeducible` sin marcar (`null`/`undefined`), o sin `vatRate`/`vatAmount` con los que
   * clasificar el tipo. Se declara, nunca se reparte a ojo entre deducible y no deducible.
   */
  sinClasificar: ConteoImporte;
}

/**
 * Puro: recibe la lista de gastos del periodo (la MISMA que ya arma el llamador para `/pl` y
 * `beneficioBaseImponible`), para que esta cifra no pueda divergir de esas por venir de una
 * consulta distinta.
 */
function calcularIvaSoportado(
  expenses: readonly GastoParaSoportado[],
): IvaSoportadoResumen {
  const deducibleMap = new Map<number, { baseC: number; cuotaC: number }>();
  let noDeducibleCount = 0;
  let noDeducibleCuotaC = 0;
  let sinClasificarCount = 0;
  let sinClasificarImporteC = 0;

  for (const exp of expenses) {
    // Las CUATRO columnas de SCRUM-403 son independientes: un gasto puede tener `vatDeducible`
    // marcado y aun así faltarle `vatRate`, `vatAmount` o `baseAmount`. Sin las tres no hay tipo
    // que declarar ni base que cuadre contra la cuota — se declara sin clasificar, igual que
    // `beneficioBaseImponible.ts` hace con un `baseAmount` ausente.
    const tieneTipoYCuota =
      typeof exp.vatRate === 'number' &&
      Number.isFinite(exp.vatRate) &&
      exp.vatAmount !== null &&
      exp.vatAmount !== undefined &&
      exp.baseAmount !== null &&
      exp.baseAmount !== undefined;

    if (exp.vatDeducible === true && tieneTipoYCuota) {
      const acc = deducibleMap.get(exp.vatRate as number) ?? { baseC: 0, cuotaC: 0 };
      acc.baseC += aCentimos(exp.baseAmount);
      acc.cuotaC += aCentimos(exp.vatAmount);
      deducibleMap.set(exp.vatRate as number, acc);
      continue;
    }

    if (exp.vatDeducible === false && tieneTipoYCuota) {
      noDeducibleCount += 1;
      noDeducibleCuotaC += aCentimos(exp.vatAmount);
      continue;
    }

    // `vatDeducible` sin marcar, o marcado pero sin tipo/cuota con los que clasificar: se
    // declara sin clasificar y se cuenta por el TOTAL con IVA (`amount`), no por la cuota —
    // no se conoce el tipo, así que no hay cuota que aislar.
    sinClasificarCount += 1;
    sinClasificarImporteC += aCentimos(exp.amount);
  }

  const porTipo = [...deducibleMap.entries()]
    .map(([tipo, v]) => ({ tipo, base: r2(aEuros(v.baseC)), cuota: r2(aEuros(v.cuotaC)) }))
    .sort((a, b) => b.tipo - a.tipo);

  return {
    porTipo,
    totalBaseDeducible: r2(porTipo.reduce((a, e) => a + e.base, 0)),
    totalCuotaDeducible: r2(porTipo.reduce((a, e) => a + e.cuota, 0)),
    noDeducible: { count: noDeducibleCount, importe: r2(aEuros(noDeducibleCuotaC)) },
    sinClasificar: { count: sinClasificarCount, importe: r2(aEuros(sinClasificarImporteC)) },
  };
}

export interface RetencionesNoDisponibles {
  disponible: false;
  motivo: string;
}

/**
 * Fijo, no calculado: `Invoice` no guarda la retención aplicada (SCRUM-293/A2, ALTER pendiente).
 * Ver la cabecera del fichero. Es una función y no una constante para que el día que exista la
 * columna, quien construya esa parte tenga un único sitio que cambiar.
 */
function retencionesNoDisponibles(): RetencionesNoDisponibles {
  return {
    disponible: false,
    motivo:
      'la retención de IRPF aplicada a cada factura no se guarda todavía (falta el ALTER de SCRUM-293/A2 en Invoice); en cuanto exista la columna, este bloque se calcula',
  };
}

export interface ResumenTrimestre {
  año: number;
  trimestre: number;
  ivaRepercutido: { porTipo: DesgloseIva[]; totalBase: number; totalCuota: number };
  ivaSoportado: IvaSoportadoResumen;
  /** `repercutido.totalCuota - soportado.totalCuotaDeducible`. Puede salir negativo: se devuelve
   * tal cual, sin palabras como «devolución» (regla 7, caso límite dictado por el fundador). */
  diferencia: number;
  retenciones: RetencionesNoDisponibles;
  /** Regla 7: nunca «lo que debes» ni «Hacienda» — esto es un borrador de SUS propios números. */
  borradorParaAsesor: true;
}

export function construirResumenTrimestre(params: {
  año: number;
  trimestre: number;
  repercutidoPorTipo: readonly { tipo: number; base: number; cuota: number }[];
  expenses: readonly GastoParaSoportado[];
}): ResumenTrimestre {
  const ivaRepercutido = agruparIvaPorTipo(params.repercutidoPorTipo);
  const totalBaseRepercutido = r2(ivaRepercutido.reduce((a, e) => a + e.base, 0));
  const totalCuotaRepercutido = r2(ivaRepercutido.reduce((a, e) => a + e.cuota, 0));

  const ivaSoportado = calcularIvaSoportado(params.expenses);

  return {
    año: params.año,
    trimestre: params.trimestre,
    ivaRepercutido: {
      porTipo: ivaRepercutido,
      totalBase: totalBaseRepercutido,
      totalCuota: totalCuotaRepercutido,
    },
    ivaSoportado,
    diferencia: r2(totalCuotaRepercutido - ivaSoportado.totalCuotaDeducible),
    retenciones: retencionesNoDisponibles(),
    borradorParaAsesor: true,
  };
}
