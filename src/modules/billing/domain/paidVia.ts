// SCRUM-191 — `paid_via`: de qué pagó el cliente DE VERDAD a lo que se guarda en el cobro.
// Función PURA (sin red ni BD) para poder verificarla en `npm test` normal.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL BUG QUE CIERRA: `connectWebhook.routes.ts` mandaba `method: 'card'` **a fuego** en
// `checkout.session.completed`, sin mirar con qué pagó el cliente. No fallaba todavía porque
// ese Checkout solo aceptaba tarjeta — pero el Bizum automático entra por el MISMO checkout
// (dynamic payment methods, SCRUM-3). En cuanto la capability `bizum_payments` se active,
// todo Bizum habría quedado registrado como TARJETA.
//
// No es un fallo por omisión: es **atribución falsa**, que es peor. El dato existe, parece
// bueno y es mentira — y viaja a la columna «Método (paid_via)» del CSV que se le entrega al
// asesor fiscal o a una inspección, y al desglose de métricas.
//
// POR QUÉ `bizum_auto` Y NO REUTILIZAR UNO DE LOS QUE HABÍA (decisión del fundador, 28-jul):
// `bizum_manual` sería falso —nadie confirmó a mano— y `card` es el bug. **Y la distinción
// importa fiscalmente: uno lo confirma una PERSONA, el otro un WEBHOOK.** Son dos cadenas de
// evidencia distintas ante una inspección, y colapsarlas en un solo valor destruye justo el
// dato que las separa. Añadirlo es cambio de la regla 22 (conjunto cerrado), aprobado.
// ─────────────────────────────────────────────────────────────────────────────────────────

/** Conjunto CERRADO de la regla 22. Crecer aquí es cambio de máster, no una decisión de código. */
export const PAID_VIA = ['card', 'bizum_auto', 'bizum_manual', 'transfer', 'cash'] as const;
export type PaidVia = (typeof PAID_VIA)[number];

/**
 * Traduce el `payment_method_details.type` de Stripe a nuestro vocabulario.
 *
 * Devuelve `null` cuando no lo reconoce, **y eso es deliberado**: el llamante NO debe inventar
 * un valor de repuesto. Escribir un `paid_via` equivocado es el bug que este módulo cierra, así
 * que cambiar «asumo tarjeta» por «asumo otra cosa» sería repetirlo con distinto disfraz. Ante
 * lo desconocido, no se toca el método del cobro y se grita en el log.
 *
 * Los tipos vienen de la doc de Stripe (`payment_method_details.type`), donde `bizum` está
 * documentado como valor propio con su hash `payment_method_details.bizum`.
 */
export function paidViaDesdeStripe(tipoStripe: string | null | undefined): PaidVia | null {
  switch ((tipoStripe || '').toLowerCase().trim()) {
    case 'card':
      return 'card';
    case 'bizum':
      return 'bizum_auto'; // por el checkout = lo confirma un webhook, no una persona
    default:
      return null;
  }
}

/** ¿Es un valor del conjunto cerrado? Para que nadie escriba `paid_via` a mano y se lo invente. */
export function esPaidViaValido(valor: unknown): valor is PaidVia {
  return typeof valor === 'string' && (PAID_VIA as readonly string[]).includes(valor);
}
