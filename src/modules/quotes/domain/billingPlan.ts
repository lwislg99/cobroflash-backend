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

/**
 * SCRUM-27: plan de facturación EFECTIVO de un Quote.
 * - Si el Quote tiene `customBillingPlan` (array no vacío de `{percentage, label}`),
 *   lo mapea a `BillingStage[]` (index = orden, percentage la fracción guardada, label la etiqueta).
 * - Si no, cae a los presets `getBillingPlan(paymentTerms)` — que NO se tocan.
 * El reparto exacto del importe lo hace `distributeStageAmounts` (SCRUM-32) sobre cualquiera de los dos.
 */
export function resolveBillingPlan(
  quote: { customBillingPlan?: unknown; paymentTerms?: string | null } | null | undefined
): BillingStage[] {
  const custom = quote && (quote as any).customBillingPlan;
  if (Array.isArray(custom) && custom.length > 0) {
    return custom.map((s: any, i: number) => ({
      index: i,
      percentage: Number(s?.percentage) || 0,
      label: typeof s?.label === 'string' ? s.label : '',
    }));
  }
  return getBillingPlan((quote?.paymentTerms ?? null) as PaymentTermsCode);
}

/**
 * SCRUM-27: valida un plan de tramos personalizado (lo que llega del editor).
 * Reglas: array con ≥1 tramo, cada `label` no vacío, cada `percentage > 0`, y la suma
 * de porcentajes == 100% EXACTA (comparada en enteros: `Σ round(percentage*100) === 100`).
 * Devuelve `{ ok: true }` o `{ ok: false, error }` con mensaje es-ES digno (sin stacktrace).
 */
export function validateCustomBillingPlan(
  plan: unknown
): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(plan) || plan.length === 0) {
    return { ok: false, error: 'El plan de cobro debe tener al menos un tramo.' };
  }
  let sumCents = 0;
  for (const s of plan as any[]) {
    const label = typeof s?.label === 'string' ? s.label.trim() : '';
    if (!label) return { ok: false, error: 'Cada tramo necesita una etiqueta (p. ej. "Anticipo").' };
    const pct = Number(s?.percentage);
    if (!Number.isFinite(pct) || pct <= 0) {
      return { ok: false, error: `El tramo "${label}" debe tener un porcentaje mayor que 0.` };
    }
    sumCents += Math.round(pct * 100);
  }
  if (sumCents !== 100) {
    return { ok: false, error: 'Los tramos deben sumar exactamente el 100 %.' };
  }
  return { ok: true };
}

/**
 * SCRUM-151 — POR QUÉ no hay tramo que emitir.
 *
 * Las dos rutas que emiten factura (`POST /admin/quotes/:id/invoice` y el cobro del resto
 * desde el Trabajo) caen en el MISMO 409 por dos motivos que no se parecen en nada:
 *   · el plan se agotó → ya se emitió todo lo pactado;
 *   · el plan está VACÍO → MANUAL / SIN_CONDICIONES nunca generan facturas automáticas
 *     (`getBillingPlan` devuelve [] a propósito), así que no es que "ya no quede": es que
 *     nunca hubo tramos.
 * Decir "no queda ningún tramo por cobrar" en el segundo caso es mentirle al pro sobre un
 * plan que no existió.
 *
 * SCRUM-151 (27-jul-2026) — se separa también el CÓDIGO, no solo el texto. La primera versión
 * conservaba `no_more_invoices_for_payment_terms` para los dos motivos, con el argumento de que
 * "los clientes y los logs los distinguen": no los distinguen, porque el código era el mismo.
 * Un solo código para dos causas obliga a cualquier consumidor —UI, soporte, un log— a leer el
 * texto para saber qué pasó, y el texto es justo lo que no se debe parsear.
 *
 * DECISIÓN DEL FUNDADOR (misma fecha, aprobada como cambio de N5 / regla 30): un Trabajo con
 * condiciones MANUAL/SIN_CONDICIONES **sí debe poder facturarse** desde YaQu — "manual" es
 * "yo pacto CUÁNDO cobro", no "yo facturo fuera de la app". Por eso el mensaje del plan vacío
 * NO dice "no disponible" (que suena a "aquí no se factura"): dice que no hay TRAMOS, que es
 * la verdad de hoy, sin prometer la vía manual que todavía no existe.
 */
export interface MotivoSinTramo {
  error: string;
  message: string;
}

/**
 * El código del caso AGOTADO lo pone cada ruta, porque cada una tiene el suyo desde siempre
 * (`no_more_invoices_for_payment_terms` al emitir desde el presupuesto, `nothing_pending` al
 * cobrar el resto desde el Trabajo) y renombrarlos rompería a cualquiera que ya ramifique por
 * ellos. El caso VACÍO, en cambio, es `no_billing_plan` en las dos: es la MISMA condición
 * —estas condiciones de pago no generan tramos— mirada desde dos pantallas.
 */
export function motivoSinTramo(
  plan: unknown[],
  codigoAgotado = 'no_more_invoices_for_payment_terms',
): MotivoSinTramo {
  return plan.length === 0
    ? {
        error: 'no_billing_plan',
        message: 'Estas condiciones de pago no generan tramos automáticos, así que no hay facturas que emitir desde aquí.',
      }
    : {
        error: codigoAgotado,
        message: 'Ya se han emitido todas las facturas de este presupuesto.',
      };
}
