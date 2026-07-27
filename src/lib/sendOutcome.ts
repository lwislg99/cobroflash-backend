// src/lib/sendOutcome.ts — SCRUM-126
//
// Vocabulario ÚNICO para "¿salió el envío?" en los 9 endpoints de WhatsApp/email del
// dashboard. Antes: 3 diccionarios parcialmente distintos con la MISMA idea (LEGIBLE en
// albaranWhatsApp.service.ts, J5_MESSAGES en invoicesAdmin.routes.ts, un switch inline en
// quotesAdmin.routes.ts), con matices de redacción que no había motivo para que difirieran.
//
// CONTRATO (los 4 niveles — recon de SCRUM-126, aprobado por el fundador):
//   Precondición inválida     → status 4xx real, {ok:false, error, message?} — SIN `sent`,
//                                no se llegó a intentar el envío.
//   Envío intentado, no salió → SIEMPRE 200,     {ok:true, sent:false, error, message}
//   Envío intentado, salió    → 200,             {ok:true, sent:true, ...datos propios}
//   Error interno no previsto → 500,             {ok:false, error:'internal_error'}
//
// `sent` es la ÚNICA verdad sobre si la notificación salió — `ok` NO la sustituye nunca
// (ver el propio ticket: eso es justo lo que causaba el punto ciego).

export type SendFailureReason =
  | 'not_configured'
  | 'demo_safe_numbers'
  | 'wa_opt_out'
  | 'daily_cap'
  | 'customer_daily_cap'
  | 'whatsapp_send_failed'
  | 'email_send_failed'
  | 'media_upload_failed';

// Mensaje humano ÚNICO por motivo. Antes vivía triplicado con redacciones parecidas pero
// no idénticas — un merchant podía leer un texto distinto para el MISMO motivo según qué
// endpoint hubiera llamado.
export const SEND_FAILURE_MESSAGES: Record<SendFailureReason, string> = {
  not_configured: 'WhatsApp no está configurado.',
  demo_safe_numbers: 'Modo demo seguro: este número no está en la lista de pruebas.',
  wa_opt_out: 'Este cliente se dio de baja de WhatsApp — envíale el enlace por email o SMS.',
  daily_cap: 'Has alcanzado el tope diario de mensajes de WhatsApp. Vuelve a intentarlo mañana o envíalo por email.',
  customer_daily_cap: 'Este cliente ya recibió varios mensajes hoy (límite anti-spam). Vuelve a intentarlo mañana o envíalo por email.',
  whatsapp_send_failed: 'No se pudo enviar por WhatsApp. Copia el enlace y mándaselo por SMS o llámale.',
  email_send_failed: 'No se pudo enviar el email. Puedes reintentarlo.',
  media_upload_failed: 'No se pudo preparar el PDF para WhatsApp. Inténtalo de nuevo.',
};

/**
 * Cuerpo JSON para un envío que se INTENTÓ pero no salió — siempre va con status 200.
 * `message` es opcional: por defecto el texto canónico del motivo; algunos llamadores
 * (p. ej. cuando Meta devuelve su propio texto de rechazo) quieren interpolar más detalle
 * sin perder el motivo machine-readable.
 */
export function sendFailureBody(
  reason: SendFailureReason,
  opts: { message?: string; [key: string]: unknown } = {},
) {
  const { message, ...extra } = opts;
  return { ok: true, sent: false, error: reason, message: message ?? SEND_FAILURE_MESSAGES[reason], ...extra };
}

/** Cuerpo JSON para un envío que se intentó y SALIÓ — siempre 200. */
export function sendSuccessBody(extra: Record<string, unknown> = {}) {
  return { ok: true, sent: true, ...extra };
}
