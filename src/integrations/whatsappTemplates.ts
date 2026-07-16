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
  // Pendientes de alta en Meta (Parte J1). Builders y validación listos; el envío NO se
  // conecta hasta que estén Approved (docs/WHATSAPP_TEMPLATES.md §4 y §5).
  paymentConfirmationInvoice: 'payment_confirmation_invoice_es',
  merchantAlert: 'merchant_alert_es',
  // SCRUM-47: copia FIRMADA del albarán al cliente (cabecera de documento = PDF).
  albaranFirmado: 'albaran_firmado_es',
  // SCRUM-49: link "para firmar" a distancia (botón URL → /albaran/{{token}}).
  albaranParaFirmar: 'albaran_para_firmar_es',
} as const;

export interface WaTemplateMessage {
  templateName: string;
  languageCode: 'es';
  components: any[];
}

// Estructura que Meta tiene aprobada para cada plantilla (J7): nº exacto de variables
// del body y si lleva botón de URL dinámica. Desviarse = rechazo #132000/#132001.
// SCRUM-59 (J7): `hasDocumentHeader` marca las plantillas con cabecera de documento (PDF)
// para que el validador exija su media_id ANTES de llamar a Meta (si no, un media_id vacío
// solo fallaría en Meta con #132012).
export const WA_TEMPLATE_SPECS: Record<
  string,
  { expectedVarCount: number; hasUrlButton: boolean; hasDocumentHeader?: boolean }
> = {
  [WA_TEMPLATES.quoteDecision]: { expectedVarCount: 4, hasUrlButton: true },
  [WA_TEMPLATES.paymentRequest]: { expectedVarCount: 4, hasUrlButton: true },
  [WA_TEMPLATES.paymentConfirmation]: { expectedVarCount: 4, hasUrlButton: false },
  // Nuevas (Parte J1): confirmación con botón "Ver documento" (URL dinámica → /recibo/{{1}})
  [WA_TEMPLATES.paymentConfirmationInvoice]: { expectedVarCount: 4, hasUrlButton: true },
  // Aviso al PRO (ventana 24h cerrada): 3 vars, sin botón dinámico (botón estático opcional)
  [WA_TEMPLATES.merchantAlert]: { expectedVarCount: 3, hasUrlButton: false },
  // SCRUM-47: albarán firmado — 3 vars, cabecera de DOCUMENTO (PDF), sin botón dinámico
  // (el quick-reply «👍 Recibido» es estático, no viaja como componente en el envío).
  [WA_TEMPLATES.albaranFirmado]: { expectedVarCount: 3, hasUrlButton: false, hasDocumentHeader: true },
  // SCRUM-49: "para firmar" — 3 vars + botón URL (token → /albaran/{{token}}). Sin cabecera.
  [WA_TEMPLATES.albaranParaFirmar]: { expectedVarCount: 3, hasUrlButton: true },
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

  // SCRUM-59 (J7): plantillas con cabecera de documento exigen su media_id (o link).
  if (spec.hasDocumentHeader) {
    const header = (components ?? []).find((c) => c?.type === 'header');
    const p0 = header?.parameters?.[0];
    const doc = p0?.type === 'document' ? p0.document : null;
    const hasMedia = !!(doc && (String(doc.id ?? '').trim() || String(doc.link ?? '').trim()));
    if (!hasMedia) {
      return `${templateName}: falta la cabecera de documento (media_id) requerida`;
    }
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

// SCRUM-47: cabecera de DOCUMENTO (PDF). El PDF viaja por media_id (subido antes con
// uploadWhatsAppMedia); `filename` es lo que el cliente ve al recibirlo.
function documentHeader(mediaId: string, filename: string): any {
  return {
    type: 'header',
    parameters: [{ type: 'document', document: { id: String(mediaId), filename } }],
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

// 4. payment_confirmation_invoice_es — como payment_confirmation_es pero CON botón de URL
// dinámica "Ver documento" → /recibo/{{1}} (chargeId). Copy NEUTRO: vale para factura y
// para justificante de cobro (decisión 12-jun: no decir "factura" en modo justificante).
// `documentNumber` es el nº del documento (factura 2026-CF-001 o justificante J-...).
// Body EXACTO aprobado en Meta (el texto fijo vive en Meta; aquí solo van las 4 vars + botón):
//   "Hola {{1}} 👋\nHemos confirmado tu pago de {{2}} (documento de cobro {{3}}).\n
//    ¡Gracias por confiar en {{4}}!\nPuedes ver tu recibo en el botón de abajo."
export function buildPaymentConfirmationInvoice(p: {
  customerName: string;
  amountWithCurrency: string;
  documentNumber: string;
  businessName: string;
  chargeId: string | number;
}): WaTemplateMessage {
  return {
    templateName: WA_TEMPLATES.paymentConfirmationInvoice,
    languageCode: 'es',
    components: [
      body(p.customerName, p.amountWithCurrency, p.documentNumber, p.businessName),
      urlButton(p.chargeId),
    ],
  };
}

// 5. merchant_alert_es — aviso al PROFESIONAL cuando su ventana de servicio 24h está
// cerrada (no se le puede mandar texto libre). Genérico para los eventos PRO-facing:
// decisión de presupuesto y pago recibido. SIN botón dinámico (botón estático "Abrir
// YaQu" → https://yaqu.app/dashboard/ en Meta, sin parámetro en runtime).
// Body EXACTO aprobado en Meta (Meta rechaza variable al inicio/fin; aquí solo van las 3 vars):
//   "Hola 👋 Tienes novedades de {{1}}: {{2}} {{3}}.\nEntra en tu panel de YaQu para gestionarlo."
//   {{1}} cliente · {{2}} qué ha pasado · {{3}} importe/referencia
export function buildMerchantAlert(p: {
  customerName: string;
  action: string;   // "ha aceptado tu presupuesto" | "ha rechazado tu presupuesto" | "te ha pagado"
  detail: string;   // "450,00 € · Presupuesto #128" | "450,00 € · Factura F-2026-014"
}): WaTemplateMessage {
  return {
    templateName: WA_TEMPLATES.merchantAlert,
    languageCode: 'es',
    components: [
      body(p.customerName, p.action, p.detail),
    ],
  };
}

// 6. albaran_firmado_es (SCRUM-47) — copia FIRMADA del albarán. Cabecera de DOCUMENTO
// (PDF del albarán firmado, vía media_id) + cuerpo de 3 vars. SIN botón dinámico: el
// quick-reply «👍 Recibido» es estático (no viaja como componente en el envío).
// Body EXACTO aprobado en Meta (14-jul; el texto fijo vive en Meta, aquí solo las 3 vars):
//   "Hola {{1}} 👋 Aquí tienes tu parte de trabajo {{2}} ya firmado, correspondiente a {{3}}.
//    Guárdalo para tu archivo. ¡Gracias por confiar en nosotros!"
//   {{1}} nombre del cliente · {{2}} nº de albarán (ALB-…) · {{3}} obra (Job.titulo)
export function buildAlbaranFirmado(p: {
  customerName: string;
  albaranNumber: string;
  obra: string;
  mediaId: string;
  filename: string;
}): WaTemplateMessage {
  return {
    templateName: WA_TEMPLATES.albaranFirmado,
    languageCode: 'es',
    components: [
      documentHeader(p.mediaId, p.filename),
      body(p.customerName, p.albaranNumber, p.obra),
    ],
  };
}

// 7. albaran_para_firmar_es (SCRUM-49) — link para FIRMAR a distancia. 3 vars + botón URL
// (token OPACO → https://yaqu.app/albaran/{{token}}). SIN cabecera de documento (el albarán se
// ve en la página del botón). El texto fijo vive en Meta; aquí solo van las 3 vars + el token.
// Copy EXACTO aprobado en Meta (confirmado por el fundador 16-jul; las 3 vars en orden):
//   "Hola {{1}} 👋 {{2}} te envía el parte de trabajo {{3}} para que lo revises y lo firmes.
//    Puedes hacerlo desde el botón de aquí abajo, te llevará un momento. ¡Gracias!"
//   {{1}} nombre del cliente · {{2}} nombre del negocio (merchant) · {{3}} nº de albarán (ALB-…)
export function buildAlbaranParaFirmar(p: {
  customerName: string;
  businessName: string;
  albaranNumber: string;
  token: string;
}): WaTemplateMessage {
  return {
    templateName: WA_TEMPLATES.albaranParaFirmar,
    languageCode: 'es',
    components: [
      body(p.customerName, p.businessName, p.albaranNumber),
      urlButton(p.token),
    ],
  };
}
