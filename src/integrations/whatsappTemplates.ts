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
