// src/modules/quotes/domain/billingPlan.ts

/**
 * Códigos de condiciones de pago que manejamos en el sistema.
 *
 * - FULL_UPFRONT  → 1 factura del 100% al aceptar
 * - FIFTY_FIFTY   → 2 facturas del 50% (señal al aceptar, resto al finalizar)
 * - MANUAL        → sin facturación automática (solo presupuesto/proforma)
 * - SIN_CONDICIONES → sin condiciones explícitas (por ahora sin auto-facturas)
 *
 * En varios puntos del back el campo puede venir null/undefined,
 * en cuyo caso asumimos FULL_UPFRONT como default.
 */
export type PaymentTermsCode =
  | "FULL_UPFRONT"
  | "FIFTY_FIFTY"
  | "MANUAL"
  | "SIN_CONDICIONES"
  | null
  | undefined;

export interface BillingStage {
  /** Índice del tramo dentro del plan (0 = primero) */
  index: number;
  /** Porcentaje del total que representa este tramo (1 = 100%, 0.5 = 50%, etc.) */
  percentage: number;
  /** Etiqueta interna por si queremos loguear / depurar */
  label: string;
}

/**
 * Normaliza el código de paymentTerms.
 * Si viene null/undefined, usamos FULL_UPFRONT como valor por defecto.
 */
function normalizePaymentTerms(code: PaymentTermsCode): Exclude<PaymentTermsCode, null | undefined> {
  if (!code) {
    return "FULL_UPFRONT";
  }
  return code as Exclude<PaymentTermsCode, null | undefined>;
}

/**
 * Devuelve el plan completo de facturación para unas paymentTerms.
 *
 * Ejemplos:
 *  - FULL_UPFRONT → [ 100% ]
 *  - FIFTY_FIFTY  → [ 50%, 50% ]
 *  - MANUAL / SIN_CONDICIONES → []
 */
export function getBillingPlan(
  paymentTerms: PaymentTermsCode
): BillingStage[] {
  const code = normalizePaymentTerms(paymentTerms);

  switch (code) {
    case "FULL_UPFRONT":
      return [
        {
          index: 0,
          percentage: 1,
          label: "full_upfront_100",
        },
      ];

    case "FIFTY_FIFTY":
      return [
        {
          index: 0,
          percentage: 0.5,
          label: "fifty_fifty_first_50",
        },
        {
          index: 1,
          percentage: 0.5,
          label: "fifty_fifty_second_50",
        },
      ];

    case "MANUAL":
    case "SIN_CONDICIONES":
    default:
      // No hay facturación automática para estos casos
      return [];
  }
}

/**
 * Devuelve el siguiente tramo de facturación que toca generar
 * en función de:
 *  - paymentTerms
 *  - número de facturas ya existentes ligadas al presupuesto.
 *
 * Si ya no queda nada por facturar, devuelve null.
 *
 * Esto se usa actualmente en:
 *  - POST /admin/quotes/:id/invoice
 *  - POST /quote/:id/decision
 */
export function getNextBillingStage(
  paymentTerms: PaymentTermsCode,
  existingInvoicesCount: number
): BillingStage | null {
  const plan = getBillingPlan(paymentTerms);

  if (existingInvoicesCount >= plan.length) {
    return null;
  }

  return plan[existingInvoicesCount];
}

/**
 * SCRUM-32: reparto EXACTO de un total entre los tramos de un plan.
 * Invariante (dinero): se trabaja en CÉNTIMOS ENTEROS; los tramos 0..n-2 se redondean
 * por su %, y el ÚLTIMO tramo absorbe el resto (`totalCents − Σ anteriores`). Así la
 * suma de tramos == total, EXACTA, en totales par e impar. Puro y determinista por índice
 * (NO consulta BD). Devuelve euros a 2 decimales (mismo formato que se guarda hoy).
 * Base para planes personalizados de más de 2 tramos (SCRUM-27).
 */
export function distributeStageAmounts(total: number | string | { toString(): string }, plan: BillingStage[]): number[] {
  const n = plan.length;
  if (n === 0) return [];
  const totalCents = Math.round(Number(total) * 100);
  const cents: number[] = [];
  let acc = 0;
  for (let i = 0; i < n - 1; i++) {
    const c = Math.round(totalCents * plan[i].percentage);
    cents.push(c);
    acc += c;
  }
  cents.push(totalCents - acc); // el último tramo = el resto exacto
  return cents.map((c) => c / 100);
}

/**
 * SCRUM-32: importe EXACTO del tramo `stageIndex` para unas paymentTerms + total.
 * Construye el plan (mismos % que `getBillingPlan`) y delega en `distributeStageAmounts`.
 */
export function getStageAmount(
  total: number | string | { toString(): string }, // acepta Prisma.Decimal (se convierte con Number)
  paymentTerms: PaymentTermsCode,
  stageIndex: number
): number {
  const amounts = distributeStageAmounts(total, getBillingPlan(paymentTerms));
  return amounts[stageIndex] ?? 0;
}
