// src/modules/quotes/domain/billingPlanView.ts — SCRUM-34
// Vista del plan de cobro para los serializers de quote-detail y job-detail.
// PURO y testeable: reutiliza resolveBillingPlan + distributeStageAmounts (SCRUM-27/32)
// SIN tocarlos. `nextStage` usa la MISMA regla de CONTEO que las rutas de cobro
// (plan[emittedCount]) → el label de la UI nunca diverge de lo que emitiría el endpoint.
import { resolveBillingPlan, distributeStageAmounts } from './billingPlan';

export interface BillingPlanStageView {
  index: number;
  label: string;      // interno en presets; el del pro en planes custom
  percent: number;    // fracción 0-1 (igual que BillingStage.percentage)
  amount: number;     // importe EXACTO del tramo (SCRUM-32: el último absorbe el resto)
  currency: string;
}

export function buildBillingPlanView(
  quote: {
    customBillingPlan?: unknown;
    paymentTerms?: string | null;
    total: number | string | { toString(): string };
    currency: string;
  },
  emittedCount: number
): {
  billingPlan: BillingPlanStageView[];
  nextStage: BillingPlanStageView | null;
  pendingStagesCount: number;
  hasCustomPlan: boolean;
} {
  const plan = resolveBillingPlan(quote);
  const amounts = distributeStageAmounts(quote.total, plan);
  const billingPlan = plan.map((s, i) => ({
    index: s.index,
    label: s.label,
    percent: s.percentage,
    amount: amounts[i],
    currency: quote.currency,
  }));
  const emitted = Math.max(0, Number(emittedCount) || 0);
  return {
    billingPlan,
    nextStage: billingPlan[emitted] ?? null, // misma semántica que plan[existingInvoices.length]
    pendingStagesCount: Math.max(0, billingPlan.length - emitted),
    hasCustomPlan: Array.isArray((quote as any).customBillingPlan) && (quote as any).customBillingPlan.length > 0,
  };
}
