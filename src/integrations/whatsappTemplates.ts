// src/integrations/whatsappTemplates.ts
// Constructores PUROS de los payloads de plantilla de WhatsApp (Meta Cloud API).
// Fuente de verdad de la estructura: docs/WHATSAPP_TEMPLATES.md.
//
// Centralizar aquí evita que cada call-site (y scripts/wa-test.mjs) construya los
// componentes por su cuenta y se desincronicen → un desajuste de nº de variables
// o de botones hace que Meta rechace el envío (#132000 / #132001).
// tests/whatsappTemplates.test.mjs blinda esta estructura.

export const WA_TEMPLATES = {
  quoteDecision: 'quote_decision_es',
  paymentRequest: 'payment_request_es',
  paymentConfirmation: 'payment_confirmation_es',
} as const;

export interface WaTemplateMessage {
  templateName: string;
  languageCode: 'es';
  components: any[];
}

// Estructura que Meta tiene aprobada para cada plantilla (J7): nº exacto de variables
// del body y si lleva botón de URL dinámica. Desviarse = rechazo #132000/#132001.
export const WA_TEMPLATE_SPECS: Record<string, { expectedVarCount: number; hasUrlButton: boolean }> = {
  [WA_TEMPLATES.quoteDecision]: { expectedVarCount: 4, hasUrlButton: true },
  [WA_TEMPLATES.paymentRequest]: { expectedVarCount: 4, hasUrlButton: true },
  [WA_TEMPLATES.paymentConfirmation]: { expectedVarCount: 4, hasUrlButton: false },
};

// Valida los components contra la spec ANTES de llamar a Meta (J7). Plantilla
// desconocida (p. ej. una nueva aún no registrada aquí) → null (no se valida).
export function validateTemplateComponents(
  templateName: string,
  components: any[] | undefined,
): string | null {
  const spec = WA_TEMPLATE_SPECS[templateName];
  if (!spec) return null;

  const bodyComp = (components ?? []).find((c) => c?.type === 'body');
  const vars: any[] = bodyComp?.parameters ?? [];
  if (vars.length !== spec.expectedVarCount) {
    return `${templateName}: body con ${vars.length} variables, Meta espera ${spec.expectedVarCount}`;
  }
  const emptyIdx = vars.findIndex(
    (p) => p?.type !== 'text' || typeof p.text !== 'string' || p.text.trim() === '' || p.text === 'undefined' || p.text === 'null',
  );
  if (emptyIdx !== -1) {
    return `${templateName}: variable ${emptyIdx + 1} del body vacía o inválida`;
  }

  const btn = (components ?? []).find((c) => c?.type === 'button');
  if (spec.hasUrlButton && !(btn?.parameters?.[0]?.text ?? '').toString().trim()) {
    return `${templateName}: falta el parámetro del botón de URL dinámica`;
  }
  if (!spec.hasUrlButton && btn) {
    return `${templateName}: lleva botón pero la plantilla aprobada no tiene ninguno`;
  }
  return null;
}

// Componente "body" con N variables de texto en orden.
function body(...texts: Array<string | number>): any {
  return {
    type: 'body',
    parameters: texts.map((t) => ({ type: 'text', text: String(t) })),
  };
}

// Botón de URL dinámica (índice 0): se envía SOLO el sufijo (el id), no la URL.
function urlButton(suffix: string | number): any {
  return {
    type: 'button',
    sub_type: 'url',
    index: '0',
    parameters: [{ type: 'text', text: String(suffix) }],
  };
}

// 1. quote_decision_es — cuerpo 4 vars + 1 botón (id presupuesto → /pay/quote/{{1}})
export function buildQuoteDecision(p: {
  customerName: string;
  businessName: string;
  quoteNumber: string | number;
  totalWithCurrency: string;
  quoteId: string | number;
}): WaTemplateMessage {
  return {
    templateName: WA_TEMPLATES.quoteDecision,
    languageCode: 'es',
    components: [
      body(p.customerName, p.businessName, p.quoteNumber, p.totalWithCurrency),
      urlButton(p.quoteId),
    ],
  };
}

// 2. payment_request_es — cuerpo 4 vars + 1 botón (chargeId → /pay/invoice/{{1}})
export function buildPaymentRequest(p: {
  customerName: string;
  businessName: string;
  invoiceNumber: string;
  amountWithCurrency: string;
  chargeId: string | number;
}): WaTemplateMessage {
  return {
    templateName: WA_TEMPLATES.paymentRequest,
    languageCode: 'es',
    components: [
      body(p.customerName, p.businessName, p.invoiceNumber, p.amountWithCurrency),
      urlButton(p.chargeId),
    ],
  };
}

// 3. payment_confirmation_es — cuerpo 4 vars, SIN botones
export function buildPaymentConfirmation(p: {
  customerName: string;
  amountWithCurrency: string;
  invoiceNumber: string;
  businessName: string;
}): WaTemplateMessage {
  return {
    templateName: WA_TEMPLATES.paymentConfirmation,
    languageCode: 'es',
    components: [
      body(p.customerName, p.amountWithCurrency, p.invoiceNumber, p.businessName),
    ],
  };
}
