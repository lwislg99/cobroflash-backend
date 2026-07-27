// src/core/http/sendEndpointDeclarations.ts — SCRUM-128 (paso b, nace de SCRUM-126)
//
// SCRUM-126 unificó el VOCABULARIO de "¿salió el envío?" en los 9 endpoints de
// WhatsApp/email del dashboard (src/lib/sendOutcome.ts). Esto convierte esa convención
// en un guard MECÁNICO, mismo nivel de confianza que Guard A (SCRUM-98) / S1 (SCRUM-55):
// cada ruta de envío declara DÓNDE vive `sent` en el cuerpo de su respuesta. El test que
// consume esta lista (tests/scrum128-send-endpoints-fail-closed.test.mjs) enumera las
// rutas /admin REALES vía getAdminMounts() (mismo mecanismo de registro que S1, no
// reflection sobre Express) y falla si aparece una ruta NUEVA que huela a "envío"
// (heurística: enviar/send/resend en el path) sin declarar aquí o en PENDING.
//
// LÍMITE HONESTO (igual que Guard A y S1 — regla de esta casa: escribirlo, no solo
// saberlo):
//   1. Esto NO verifica que el handler use sendFailureBody/sendSuccessBody de verdad,
//      ni que el campo declarado en `shape` sea coherente con lo que el handler
//      REALMENTE devuelve. Solo que alguien lo declaró y un humano lo revisó en el diff
//      — exactamente como PUBLIC_ACCESS_DECLARED no verifica el guard real del handler.
//   2. La heurística (enviar/send/resend en el PATH) tiene un punto ciego CONOCIDO y ya
//      materializado: `POST /admin/jobs/:id/collect-rest` es uno de los 9 y NO contiene
//      ninguna de esas tres palabras — está declarado aquí a mano, pero la heurística
//      por sí sola NUNCA lo habría encontrado. Un futuro endpoint que envíe WhatsApp
//      como efecto secundario con un nombre igual de opaco («finalizar-trabajo», «cerrar»)
//      tampoco lo detectará. Este guard cierra la puerta a un SEGUNDO botón roto con el
//      NOMBRE obvio (el patrón real de SCRUM-115/126); no es un sustituto de revisar en
//      el diff si una ruta nueva envía algo a un cliente.
//   3. Esto NO verifica que el FRONT mire el campo declarado — esa es la capa 2
//      (frontend, propuesta aparte en SCRUM-128, no implementada en este guard).

export type SendBodyShape =
  | { kind: 'top-level' } // { ok, sent, ... } — sent en la raíz del cuerpo
  | { kind: 'nested'; field: string }; // { ok, <field>: { sent, ... } } — sent anidado

export interface SendEndpointDeclaration {
  method: string;
  /** Path COMPLETO tal y como lo registra Express, con sus :params (incluye /admin). */
  path: string;
  shape: SendBodyShape;
  channel: 'whatsapp' | 'email';
  /** Por qué esta declaración es correcta hoy — una línea. */
  reason: string;
}

/**
 * Los 8 endpoints /admin con contrato de cuerpo real (sendOutcome.ts). El 9º del
 * recuento de SCRUM-126 — el auto-envío fire-and-forget dentro de
 * POST /quote/:token/decision (quotes.routes.ts:568) — NO tiene contrato que declarar:
 * el caller HTTP (la decisión del cliente) nunca ve el resultado del envío, solo WA-0b
 * lo registra (confirmado en SCRUM-126). Tampoco activaría la heurística: su path no
 * contiene enviar/send/resend. No es un descuido — es la razón por la que esta lista
 * tiene 8 entradas y no 9.
 */
export const SEND_ENDPOINTS_DECLARED: ReadonlyArray<SendEndpointDeclaration> = [
  {
    method: 'POST',
    path: '/admin/albaranes/:id/enviar-whatsapp',
    shape: { kind: 'top-level' },
    channel: 'whatsapp',
    reason: 'sendResultJson() → sendSuccessBody/sendFailureBody (albaranes.routes.ts, SCRUM-126)',
  },
  {
    method: 'POST',
    path: '/admin/albaranes/:id/enviar-para-firmar',
    shape: { kind: 'top-level' },
    channel: 'whatsapp',
    reason: 'sendResultJson() → sendSuccessBody/sendFailureBody (albaranes.routes.ts, SCRUM-126)',
  },
  {
    method: 'POST',
    path: '/admin/invoices/:id/resend-whatsapp',
    shape: { kind: 'top-level' },
    channel: 'whatsapp',
    reason: 'sendFailureBody/sendSuccessBody directo (invoicesAdmin.routes.ts, SCRUM-126)',
  },
  {
    method: 'POST',
    path: '/admin/invoices/:id/send-reminder',
    shape: { kind: 'top-level' },
    channel: 'whatsapp',
    reason: 'sendFailureBody/sendSuccessBody directo (invoicesAdmin.routes.ts, SCRUM-126)',
  },
  {
    method: 'POST',
    path: '/admin/invoices/:id/send-email',
    shape: { kind: 'top-level' },
    channel: 'email',
    reason: 'sendFailureBody/sendSuccessBody directo (invoicesAdmin.routes.ts, SCRUM-126)',
  },
  {
    method: 'POST',
    path: '/admin/quotes/:id/send-email',
    shape: { kind: 'top-level' },
    channel: 'email',
    reason: 'sendFailureBody/sendSuccessBody directo (quotesAdmin.routes.ts, SCRUM-126)',
  },
  {
    method: 'POST',
    path: '/admin/quotes/:id/send-whatsapp',
    shape: { kind: 'top-level' },
    channel: 'whatsapp',
    reason: 'sendFailureBody/sendSuccessBody directo (quotesAdmin.routes.ts, SCRUM-126)',
  },
  {
    method: 'POST',
    path: '/admin/jobs/:id/collect-rest',
    shape: { kind: 'nested', field: 'whatsapp.sent' },
    channel: 'whatsapp',
    reason:
      'ok:true SIEMPRE (la factura se creó); el envío es un efecto secundario propio, ' +
      'en el subobjeto whatsapp:{sent,error?,message?} — NO detectable por la heurística ' +
      'de nombre (ver el límite honesto arriba). jobs.routes.ts, SCRUM-126.',
  },
];

export interface SendEndpointPending {
  method: string;
  path: string;
  /** Qué falta y por qué no se puede declarar todavía. */
  duda: string;
  /** Ticket que lo rastrea. Obligatorio — nada se aparca sin dueño. */
  ticket: string;
}

/**
 * Rutas /admin que la heurística detecta (huelen a envío) pero que NO participan del
 * contrato de sendOutcome.ts — declararlas en SEND_ENDPOINTS_DECLARED sería mentir
 * (no tienen ningún campo `sent` que declarar). Se aparcan aquí, con ticket, hasta que
 * se arreglen — mismo mecanismo que PUBLIC_ACCESS_PENDING (Guard A, SCRUM-98).
 */
export const SEND_ENDPOINTS_PENDING: ReadonlyArray<SendEndpointPending> = [
  {
    method: 'POST',
    path: '/admin/team/:id/resend',
    duda:
      'Reenvía invitación de equipo por email. inviteTeamMember() (auth.service.ts) traga el ' +
      'error de sendEmail en un catch que solo hace console.error — nunca lo relanza. La ruta ' +
      'responde {ok:true} SIEMPRE, sin campo `sent`. Misma clase de bug que el cluster ' +
      '114-127, en invitaciones en vez de documentos a cliente. No es uno de los 9 de ' +
      'SCRUM-126 (no toca sendOutcome.ts) — encontrado en el recon de este guard.',
    ticket: 'SCRUM-131',
  },
];

/** Tope del ratchet: la lista puede menguar, JAMÁS crecer. Bajarlo al cerrar cada ticket. */
export const SEND_ENDPOINTS_PENDING_MAX = 1;

/**
 * Fecha límite. Pasada esta fecha el test FALLA mientras queden aparcadas. Mover esta
 * fecha requiere OK del fundador y queda en el diff — mismo mecanismo que
 * PUBLIC_ACCESS_REVISAR_ANTES_DE / REVISAR_ANTES_DE.
 */
export const SEND_ENDPOINTS_REVISAR_ANTES_DE = '2026-09-30';

/**
 * Heurística de "esto huele a un envío a un cliente". Deliberadamente amplia (más falsos
 * positivos que falsos negativos, mismo criterio que SCRUM-103 aplica a sus propias
 * heurísticas): mejor que un humano revise una ruta que en realidad no envía nada, que
 * dejar pasar una que sí.
 */
export const SEND_HEURISTIC = /enviar|send|resend/i;
