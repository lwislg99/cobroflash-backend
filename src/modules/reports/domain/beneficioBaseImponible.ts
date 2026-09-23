// src/modules/reports/domain/beneficioBaseImponible.ts — SCRUM-1047 (CON-06)
//
// EL BENEFICIO SOBRE LA BASE (sin IVA), separado del «con IVA» que hoy se enseña mezclado.
//
// `reports.routes.ts` suma `invoice.total` (CON IVA) contra `expense.amount` (el TOTAL con IVA,
// decidido en SCRUM-324): el «beneficio» resultante no era ni una cosa ni la otra — una resta de
// dos cifras con IVA por dentro que nadie declaraba. Aquí se separan las dos preguntas —cuánto
// entra/sale en CAJA (con IVA) y cuánto queda de verdad (sobre la BASE, sin IVA)— y el beneficio
// se calcula sobre la segunda.
//
// 🔴 NO SE INVENTA LO QUE NO SE SABE. Dos huecos, con la MISMA decisión que sus precedentes en
// esta misma casa — no una segunda opinión sobre el mismo hecho:
//
//   · Una factura sin líneas desglosables (`calcVatBreakdown` da `entries: []`) no tiene base
//     conocida — el mismo criterio que ya aplica `GET /admin/reports/vat` (`excluded`). Se
//     EXCLUYE de la base y se declara (`revenueSinDesglose`), nunca se sustituye por el total
//     con IVA ni por cero.
//   · Un gasto sin `baseAmount` es un apunte de caja sin clasificar — la MISMA decisión que
//     `libroRecibidas.ts` (SCRUM-426, confirmada en staging por SCRUM-1037 letra d: se excluye
//     del libro y se cuenta en `sinClasificar`). Se EXCLUYE de la base y se declara
//     (`expensesSinClasificar`), nunca se sustituye por `amount` ni por cero.
//
// SOLO CÁLCULO DE INFORMES: no toca facturas, libros ni XML — lee lo que ya existe, con las
// MISMAS primitivas que usan el 303, el XML RRSIF y la huella VeriFactu (`calcVatBreakdown`).
//
// CÉNTIMOS ENTEROS, no euros en coma flotante, por el mismo motivo que `desgloseEmpleado.ts`: la
// resta `revenueBase - expensesBase` tiene que cuadrar por construcción, no «salvo un céntimo».
import { calcVatBreakdown, type VatLine } from '../../invoicing/domain/vat.service';
import { aCentimos } from './desgloseEmpleado';

const aEuros = (c: number): number => c / 100;
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface FacturaParaBeneficio {
  /** El total CON IVA, tal cual se enseñaba hasta hoy. */
  total: unknown;
  /** Líneas de la factura (qty/price/tax), las MISMAS que usa `calcVatBreakdown`. */
  lines: unknown;
}

export interface GastoParaBeneficio {
  /** El TOTAL con IVA (SCRUM-324). Siempre utilizable, clasificado o no. */
  amount: unknown;
  /** La base sin IVA. `null`/`undefined` = gasto sin clasificar (SCRUM-403). */
  baseAmount: unknown;
}

export interface DesgloseExcluido {
  count: number;
  importe: number;
}

export interface BeneficioSobreLaBase {
  revenueBase: number;
  revenueWithVat: number;
  /** Facturas sin líneas desglosables: no entran en `revenueBase`, y se dice cuántas y cuánto. */
  revenueSinDesglose: DesgloseExcluido;
  expensesBase: number;
  expensesWithVat: number;
  /** Gastos sin `baseAmount`: no entran en `expensesBase`, y se dice cuántos y cuánto. */
  expensesSinClasificar: DesgloseExcluido;
  /** `revenueBase - expensesBase`. El rótulo de pantalla dice «sobre la base» (regla 7: sin claims fiscales). */
  profitBase: number;
}

function lineasUtilizables(valor: unknown): VatLine[] {
  return Array.isArray(valor) ? (valor as VatLine[]) : [];
}

/**
 * Puro: recibe las MISMAS listas que ya arma el llamador (facturas pagadas + gastos del periodo),
 * para que la cifra «con IVA» de aquí y la que ya se enseñaba no puedan divergir por venir de
 * consultas distintas.
 */
export function calcularBeneficioSobreLaBase(entrada: {
  invoices: readonly FacturaParaBeneficio[];
  expenses: readonly GastoParaBeneficio[];
}): BeneficioSobreLaBase {
  let revenueBaseC = 0;
  let revenueWithVatC = 0;
  let facturasSinDesglose = 0;
  let importeSinDesgloseC = 0;

  for (const inv of entrada.invoices) {
    const totalC = aCentimos(inv.total);
    revenueWithVatC += totalC;
    const { entries, base } = calcVatBreakdown(lineasUtilizables(inv.lines));
    if (entries.length === 0) {
      // Sin líneas (o sin ninguna con importe): no hay base que declarar. Se excluye y se cuenta,
      // nunca se sustituye por el total con IVA — sería afirmar una base que no consta.
      facturasSinDesglose += 1;
      importeSinDesgloseC += totalC;
      continue;
    }
    revenueBaseC += aCentimos(base);
  }

  let expensesBaseC = 0;
  let expensesWithVatC = 0;
  let gastosSinClasificar = 0;
  let importeSinClasificarC = 0;

  for (const exp of entrada.expenses) {
    const amountC = aCentimos(exp.amount);
    expensesWithVatC += amountC;
    if (exp.baseAmount === null || exp.baseAmount === undefined) {
      gastosSinClasificar += 1;
      importeSinClasificarC += amountC;
      continue;
    }
    expensesBaseC += aCentimos(exp.baseAmount);
  }

  return {
    revenueBase: r2(aEuros(revenueBaseC)),
    revenueWithVat: r2(aEuros(revenueWithVatC)),
    revenueSinDesglose: { count: facturasSinDesglose, importe: r2(aEuros(importeSinDesgloseC)) },
    expensesBase: r2(aEuros(expensesBaseC)),
    expensesWithVat: r2(aEuros(expensesWithVatC)),
    expensesSinClasificar: { count: gastosSinClasificar, importe: r2(aEuros(importeSinClasificarC)) },
    profitBase: r2(aEuros(revenueBaseC - expensesBaseC)),
  };
}
