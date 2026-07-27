// src/modules/quotes/domain/billingPlanView.ts — SCRUM-34
// Vista del plan de cobro para los serializers de quote-detail y job-detail.
// PURO y testeable: reutiliza resolveBillingPlan (SCRUM-27) SIN tocarlo. `nextStage` usa la
// MISMA regla de CONTEO que las rutas de cobro (plan[emittedCount]) → el label de la UI nunca
// diverge de lo que emitiría el endpoint.
//
// SCRUM-141: el IMPORTE de cada tramo también deja de divergir. Desde que el total de una
// factura se DERIVA de sus líneas (ver invoiceLines.service.ts), calcularlo aquí con
// `distributeStageAmounts` prometería al usuario hasta 2 céntimos de diferencia con lo que
// acabará en su factura. Con las líneas del presupuesto disponibles se usa la MISMA función que
// la emisión (`stageAmountsFromLines`); sin ellas se mantiene el reparto aritmético de SCRUM-32
// como respaldo (presupuestos sin líneas guardadas).
import { resolveBillingPlan, distributeStageAmounts } from './billingPlan';
import { stageAmountsFromLines } from '../../invoicing/domain/invoiceLines.service';

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
    /** SCRUM-141: si vienen, el importe de cada tramo se deriva de ellas (lo que se emitirá). */
    lines?: unknown;
  },
  emittedCount: number
): {
  billingPlan: BillingPlanStageView[];
  nextStage: BillingPlanStageView | null;
  pendingStagesCount: number;
  hasCustomPlan: boolean;
} {
  const plan = resolveBillingPlan(quote);
  const quoteLines = Array.isArray(quote.lines) ? (quote.lines as any[]) : null;
  const aritmeticos = distributeStageAmounts(quote.total, plan);
  // SCRUM-141: EXACTAMENTE el mismo cálculo que la emisión (mismas líneas, mismos objetivos),
  // para que la UI no pueda prometer un importe distinto del que acabará en la factura.
  const amounts = quoteLines && quoteLines.length > 0
    ? stageAmountsFromLines(quoteLines, plan, aritmeticos)
    : aritmeticos;
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
