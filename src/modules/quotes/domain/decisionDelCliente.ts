// src/modules/quotes/domain/decisionDelCliente.ts — SCRUM-1276
//
// SOBRE QUÉ ESTADOS CABE LA DECISIÓN DEL CLIENTE (aceptar o rechazar por su enlace).
//
// Parte L:398 del máster: «Terminales: accepted/rejected (acción permitida: Duplicar → nuevo draft;
// jamás reabrir)». Antes, `POST /quote/:token/decision` solo cerraba el MISMO sentido (idempotencia)
// y el contrario pasaba: un presupuesto ACEPTADO y facturado se rechazaba con el mismo enlace, y uno
// rechazado se aceptaba.
//
// ⚠️ `draft` SIGUE SIENDO DECIDIBLE, y es a propósito (decisión del orquestador en SCRUM-1276):
// cuando el envío por WhatsApp falla, el presupuesto se queda en `draft`
// (`sendQuote.service.ts`, solo pasa a `sent` si el envío fue bien) y el panel ofrece copiar el
// enlace (A20.5/J5 del máster: en fallo de WhatsApp, siempre las tres salidas). Cerrar la decisión
// a `sent` dejaría sin salida justo ese caso. `draft → accepted` no reabre nada: es la primera
// decisión de ese presupuesto. Si un draft con el enlace en la calle debe seguir siendo draft es
// otra pregunta, con su propio ticket.
//
// Es la lista de la ENTRADA y la CONDICIÓN del `update`: dos barreras, porque con solo la primera
// dos peticiones simultáneas se cuelan entre la lectura y la escritura.

export const ESTADOS_DECIDIBLES_POR_EL_CLIENTE: string[] = ['draft', 'sent'];

/**
 * El código de «ya decidido». La landing pública no pinta el mensaje: recarga y enseña el estado con
 * su página N3.
 */
export const ERROR_PRESUPUESTO_YA_DECIDIDO = 'quote_already_decided';

/**
 * El `message` de ese 409, para quien no sea la landing (SCRUM-275: ninguna respuesta pública nueva
 * sin texto). ⛔ NO ES TEXTO NUEVO: es el N3 que la landing ya pinta para esos dos estados
 * (`quoteDecisionLanding.routes.ts`, «Ya aceptaste…» / «Rechazaste…», firmado por el fundador el
 * 12-jun), en su variante SIN fecha —la misma que la landing usa cuando no la hay— y sin el botón.
 */
export function mensajeYaDecidido(
  status: string,
  { quoteVerb, nombreDelNegocio }: { quoteVerb: string; nombreDelNegocio: string },
): string | undefined {
  if (status === 'accepted') return `Ya aceptaste este ${quoteVerb}. El profesional te informará de los siguientes pasos.`;
  if (status === 'rejected') return `Rechazaste este ${quoteVerb}. ¿Has cambiado de opinión? Pídele uno nuevo a ${nombreDelNegocio}`;
  return undefined;
}
