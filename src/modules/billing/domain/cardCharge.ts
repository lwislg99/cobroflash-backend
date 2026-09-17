// SCRUM-130 (r23 · reglas 23 + 18) — decisión de CÓMO se cobra una tarjeta, extraída como función PURA
// (sin red ni BD) para poder verificarla en `npm test` normal, igual que `demoSendBlocked` (V0-2).
//
// Regla 23: «PSP = cuenta conectada del merchant o NADA». Prohibido procesar pagos de clientes
// finales en la cuenta Stripe de PLATAFORMA. Regla 18: la cuenta de plataforma solo es legítima
// para el merchant DEMO (test, con marca de agua). Por tanto:
//   - Connect activo            → 'connect'        (direct charge en la cuenta del merchant)
//   - sin Connect pero es DEMO  → 'demo_platform'  (cuenta de plataforma, test/watermark)
//   - sin Connect y NO es demo  → 'refuse'         (NADA: no cae a plataforma — dinero de clientes
//                                                   finales en la cuenta equivocada es regulatorio)
//
// FAIL-CLOSED: ante un merchant desconocido/sin id, 'refuse'. Antes de r23 el handler caía SIEMPRE
// a la cuenta de plataforma cuando faltaba Connect; solo lo tapaba el selector de la UI (no ofrecía
// tarjeta). Esto lo cierra en el backend (defensa en profundidad).

export type CardChargeMode = 'connect' | 'demo_platform' | 'refuse';

export function cardChargeDecision(opts: { useConnect: boolean; isDemo: boolean }): CardChargeMode {
  if (opts.useConnect) return 'connect';
  if (opts.isDemo) return 'demo_platform';
  return 'refuse';
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-893 · LA MISMA PREGUNTA PARA OFRECER QUE PARA COBRAR
//
// El comentario de arriba decía, desde SCRUM-130, que sin Connect «solo lo tapaba el selector de
// la UI (no ofrecía tarjeta)». **Medido el 17-sep-2026: no lo tapaba.** El selector calculaba
//
//     hasCard = !connectFlag ? true : (connectStatus === 'active' || isDemoMerchant(m))
//
// y `PAYMENTS_CONNECT_ENABLED` está OFF por defecto (tabla P), así que la primera rama ganaba
// SIEMPRE y la tarjeta se ofrecía a todo el mundo. El PASO 0 del ticket lo dejó a la vista: los
// cinco casos —incluido el de Connect activo, que era el control positivo— daban `tarjeta=true`.
// Cuando todas las ramas responden igual, el que no está midiendo es el producto.
//
// Consecuencia para la clienta, medida en staging (SCRUM-882b b2): única opción ofrecida
// «Pagar con tarjeta», marcada RECOMENDADO → 409 «no está disponible» → «Ver otras formas de
// pago» → la misma página. Bucle cerrado, y sin salida.
//
// 🔴 EL BUCLE NO LO CAUSÓ UN CRITERIO MAL ESCRITO: LO CAUSÓ QUE HUBIERA DOS.
// Ofrecer y cobrar contestaban por su cuenta a la misma pregunta. Por eso esto NO es un booleano
// `puedeCobrarConTarjeta`: devuelve el MODO COMPLETO, el mismo vocabulario que usa la puerta de
// cobro. Un booleano sería un tercer criterio derivado, y un tercer criterio es cómo vuelve el
// defecto dentro de seis meses. Quien ofrece pregunta `!== 'refuse'`.
//
// ⚠️ LO QUE ESTO **NO** CONSIGUE, Y VA DECLARADO: `payCard.routes.ts` sigue calculando su
// `useConnect` con esta misma expresión escrita a mano. Unificarlo era tocar el camino del cobro,
// que en este ticket está acotado (decisión del fundador, 17-sep-2026), así que esa ruta conserva
// CERO líneas de diff. La duplicación queda, pero deja de poder crecer en silencio: la tabla de
// verdad de `scrum893-solo-lo-que-puede-cobrar` compara las 32 combinaciones contra la puerta
// EJECUTADA, y cae el día que diverjan, nombrando cuál.
//
//     🔒 Lo que no se puede unir, que al menos no pueda separarse sin avisar.
// ─────────────────────────────────────────────────────────────────────────────────────────────
import { isFlagEnabled } from '../../../core/flags';
import { DEMO_MERCHANT_ID } from '../../invoicing/domain/emission.service';

/** Lo que hace falta saber del merchant. Laxo a propósito: lo llaman rutas con `select` distintos. */
export type MerchantParaTarjeta = {
  id?: number | null;
  country?: string | null;
  flags?: unknown;
  connectStatus?: unknown;
  stripeAccountId?: unknown;
} | null | undefined;

/**
 * ¿En qué modo cobraría la tarjeta ESTE merchant, hoy? Es la pregunta que responde la puerta de
 * cobro, disponible también para quien decide qué ENSEÑAR.
 *
 * FAIL-CLOSED heredado de `cardChargeDecision`: merchant ausente o sin id → `'refuse'`. Es lo
 * correcto aquí y no sólo una precaución: ante la duda, no se ofrece una vía que quizá no cobre.
 */
export function cardChargeMode(merchant: MerchantParaTarjeta): CardChargeMode {
  const useConnect =
    // El merchant va TAL CUAL, sin traducir a un objeto intermedio: `isFlagEnabled` lee `id`,
    // `country` y `flags`, y cada traducción por el camino es una ocasión de divergir de lo que
    // hace la puerta, que le pasa su merchant crudo de Prisma.
    isFlagEnabled('PAYMENTS_CONNECT_ENABLED', { merchant: merchant as never }) &&
    merchant?.connectStatus === 'active' &&
    !!merchant?.stripeAccountId;

  return cardChargeDecision({ useConnect, isDemo: merchant?.id === DEMO_MERCHANT_ID });
}
