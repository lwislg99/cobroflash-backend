// V0-4 (master U1.1 / W1) — Oferta founding: 9,90 €/mes DE POR VIDA, 20 plazas.
//
// EL CONTADOR CUENTA PLAZAS VENDIDAS (SCRUM-330). Antes contaba `plan: 'founding'` a secas —el
// CAMPO—, y eso no es una venta. Medido en SCRUM-327 sobre el webhook de Stripe
// (`stripe.routes.ts:110-124`), ese campo queda puesto en tres situaciones:
//
//   · `active`              → pagó                                             ✔ cuenta
//   · `trialing`            → NO se ha cobrado nada todavía                    ✗
//   · `past_due` / `unpaid` → el cobro FALLÓ (el plan se CONSERVA a propósito:  ✗
//                             gracia con banner + portal, no se degrada a trial)
//
// …más cualquier fila puesta a mano o por un seed, que ni siquiera tiene `subscriptionStatus`.
// Con eso, «quedan 18 de 20» le decía al visitante que **dos profesionales ya compraron** cuando
// podía no haber comprado nadie: una prueba social falsa, y en material publicado.
//
// La pieza que faltaba estaba al lado sin usar: `subscriptionStatus` distingue los tres estados.
// Ahora se exigen **plan Y estado**, que responden a dos preguntas distintas — `plan` dice QUÉ
// compró y `subscriptionStatus` dice SI sigue pagando; ninguna sustituye a la otra.
//
// ⚠️ `trialing` mapea a nuestro `subscriptionStatus: 'active'`, así que entraría en la cuenta. Hoy
// no es alcanzable: el checkout founding **omite `trial_period_days`** a propósito
// (`subscriptions.routes.ts:128-130`), luego no creamos suscripciones en prueba. Si algún día se
// configura un trial en el precio de Stripe, esta cuenta volvería a incluir a quien no ha pagado
// — y el sitio de distinguirlo es AQUÍ, no la landing.
import { prisma } from '../../../core/db/prisma';

export const FOUNDING_SEATS = 20;
export const FOUNDING_PRICE = 9.9;

/**
 * Qué es una plaza OCUPADA. Vive en una constante para que se pueda leer de un vistazo qué se
 * está afirmando exactamente cuando la landing dice «quedan N plazas».
 */
export const PLAZA_OCUPADA = { plan: 'founding', subscriptionStatus: 'active' } as const;

export async function getFoundingStatus(): Promise<{ price: number; seatsTotal: number; seatsLeft: number; taken: number }> {
  const taken = await prisma.merchant.count({ where: { ...PLAZA_OCUPADA } });
  return {
    price: FOUNDING_PRICE,
    seatsTotal: FOUNDING_SEATS,
    seatsLeft: Math.max(0, FOUNDING_SEATS - taken),
    taken,
  };
}
