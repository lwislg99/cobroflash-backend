// src/modules/quotes/domain/billingPlan.ts

export type PaymentTermsCode =
  | 'FULL_UPFRONT'
  | 'FIFTY_FIFTY'
  | 'MANUAL'
  | 'NONE'
  | null
  | undefined;

export type BillingStage = {
  index: number;      // 0 = primer tramo, 1 = segundo tramo, etc.
  percentage: number; // 1 = 100%, 0.5 = 50%, ...
};

/**
 * Devuelve el plan de facturación completo para unas condiciones de pago.
 * - FULL_UPFRONT -> 1 tramo del 100%
 * - FIFTY_FIFTY  -> 2 tramos del 50%
 * - Otros (MANUAL, NONE, etc.) -> sin plan (array vacío)
 */
export function getBillingPlan(code: PaymentTermsCode): BillingStage[] {
  switch (code) {
    case 'FULL_UPFRONT':
      return [{ index: 0, percentage: 1 }];

    case 'FIFTY_FIFTY':
      return [
        { index: 0, percentage: 0.5 },
        { index: 1, percentage: 0.5 },
      ];

    default:
      // MANUAL, NONE u otros códigos que no automatizamos
      return [];
  }
}

/**
 * Devuelve el siguiente tramo a facturar según las condiciones de pago
 * y cuántas facturas existen ya para ese presupuesto.
 *
 * - Si ya no queda ningún tramo por facturar -> null
 */
export function getNextBillingStage(
  code: PaymentTermsCode,
  existingInvoicesCount: number,
): BillingStage | null {
  const plan = getBillingPlan(code);
  if (existingInvoicesCount >= plan.length) return null;
  return plan[existingInvoicesCount];
}
