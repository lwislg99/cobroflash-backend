// SCRUM-3 (BIZUM AUTOMÁTICO) — decisión de si el Bizum AUTOMÁTICO está disponible para un
// cobro. Función PURA (sin red ni BD) para poder verificarla en `npm test` normal, igual que
// `cardChargeDecision` (SCRUM-130) y `demoSendBlocked` (V0-2).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DOS CORRECCIONES AL ENCUADRE DEL TICKET, las dos verificadas en docs.stripe.com
//
// 1. NO se activa «añadiendo bizum a payment_method_types». Stripe lo desaconseja
//    explícitamente: «Don't pass `payment_method_types` when creating Checkout Sessions.
//    Instead, enable payment methods in the Dashboard and use dynamic payment methods.»
//    Y `payCard.routes.ts` YA hace lo correcto — no pasa `payment_method_types`, así que ya
//    usa dynamic payment methods. **Bizum aparecerá solo en ese checkout en cuanto la
//    capability `bizum_payments` esté `active` en la plataforma Y en la cuenta conectada.**
//    O sea: el trabajo de "encender Bizum" es de Dashboard y onboarding, no de código.
//
// 2. Consecuencia incómoda, y hay que decirla: **un flag nuestro NO puede impedir que Stripe
//    pinte Bizum dentro de su checkout alojado.** Esa decisión es de Stripe, a partir de la
//    capability, el importe, la divisa y la ubicación del cliente. Lo que este flag gobierna
//    es NUESTRA superficie: si ofrecemos la vía automática en el selector y si la anunciamos.
//    Llamarlo "el gate de Bizum automático" a secas sería una prohibición sin mecanismo —
//    justo lo que esta casa persigue. El gate de verdad, del lado de Stripe, es la capability.
//
// LO QUE SÍ SE HEREDA GRATIS, y es lo importante para la regla 23: Bizum viaja DENTRO de la
// misma `checkout.sessions.create` que la tarjeta. Esa llamada ya está gateada por
// `cardChargeDecision`: si el merchant no tiene Connect activo y no es el demo, el modo es
// 'refuse' y **no se crea sesión ninguna** — así que tampoco hay Bizum. El guard de SCRUM-130
// cubre Bizum sin tocarlo, por construcción y no por coincidencia. Hay un test que lo fija.
//
// Y por el mismo motivo el cobro es un DIRECT CHARGE sobre la cuenta conectada, lo que decide
// quién sale como comercio en el extracto del cliente. Confirmado en la tabla de la doc de
// Bizum (misma forma que la de SEPA): tipo de cargo «Directo» → descriptor de la **cuenta
// conectada**. Con destination o separate charges saldría la PLATAFORMA, que sería YaQu
// apareciendo como comercio en el banco del cliente final. No hay que cambiar nada: el
// checkout ya es directo.
// ─────────────────────────────────────────────────────────────────────────────────────────

/** Límites de Bizum en Stripe (doc oficial): mínimo 0,50 € y máximo 5.000 €, solo EUR. */
export const BIZUM_MIN_CENTS = 50;
export const BIZUM_MAX_CENTS = 500_000;

export type BizumAutoMotivo =
  | 'ok'
  | 'flag_off'
  | 'sin_connect'      // la vía automática exige cuenta conectada (regla 23); no cae a plataforma
  | 'divisa'           // Bizum es solo EUR
  | 'importe_bajo'
  | 'importe_alto';

export interface BizumAutoOpts {
  flagOn: boolean;
  /** Mismo criterio que payCard: flag de Connect + connectStatus active + stripeAccountId. */
  useConnect: boolean;
  currency: string;
  amountCents: number;
}

/**
 * ¿Se puede ofrecer Bizum AUTOMÁTICO para este cobro?
 *
 * Devuelve el motivo y no un booleano a propósito: el selector necesita saber POR QUÉ no está
 * disponible para no ofrecer una vía muerta, y un `false` pelado obliga a re-derivar la causa
 * en el sitio equivocado.
 *
 * OJO con el orden: `sin_connect` se comprueba ANTES que el importe. Un merchant sin Connect no
 * puede cobrar Bizum automático **por regulación**, no por importe — y decir "importe alto"
 * cuando el problema es que no hay cuenta conectada mandaría a bajar el importe para arreglar
 * algo que no se arregla así.
 */
export function bizumAutoDisponible(opts: BizumAutoOpts): BizumAutoMotivo {
  if (!opts.flagOn) return 'flag_off';
  if (!opts.useConnect) return 'sin_connect';
  if ((opts.currency || '').toLowerCase() !== 'eur') return 'divisa';
  if (!Number.isFinite(opts.amountCents) || opts.amountCents < BIZUM_MIN_CENTS) return 'importe_bajo';
  if (opts.amountCents > BIZUM_MAX_CENTS) return 'importe_alto';
  return 'ok';
}
