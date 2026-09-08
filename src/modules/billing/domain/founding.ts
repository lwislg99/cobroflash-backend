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

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🛑 SCRUM-340 · LA REGLA FIRMADA, QUE TODAVÍA NO CUENTA NADA — y no es un olvido
//
// DECISIÓN DEL FUNDADOR (8-sep-2026), literal:
//
//   «la plaza se queda con él; si se retrasa en un pago tiene un tiempo para pagarla, y si no,
//    esa plaza desaparece con el merchant».
//
// O sea: **cancelar NO libera la plaza. `past_due` NO libera la plaza.** Sólo desaparece con el
// merchant. Y eso ninguna columna de hoy lo sabe decir:
//
//   · `plan` vuelve a `'trial'` al cancelar (`stripe.routes.ts:138,151`) → LIBERA la plaza;
//   · `subscriptionStatus` dice SI paga, no QUÉ compró, y el webhook escribe `'active'` para
//     `pro` y para `founding` por igual (`:77`) → contar por él hace que **cada suscriptor PRO
//     activo ocupe una plaza de fundador** (medido el 8-sep-2026).
//
// 🛑 POR QUÉ ESTO NO SE USA TODAVÍA: la señal duradera es una COLUMNA NUEVA
// (`merchants.founding_purchased_at`), y `prisma/schema.prisma` es dominio exclusivo del
// fundador. El ALTER está escrito y sin aplicar en `docs/sql/scrum-340-la-plaza-comprada.sql`,
// con su verificación aparte. Hasta que la columna exista, `getFoundingStatus` (abajo) sigue
// contando con `PLAZA_OCUPADA`, que es lo que hay en `main` y **hoy no publica ninguna mentira**:
// nadie ha comprado plaza de fundador (SCRUM-41 abierto, cero clientes de pago), así que la
// landing dice «20 de 20» y es cierto.
//
// ⚠️ ESTO ES UN MECANISMO SIN CAMINO, y se declara en vez de esconderse. Mismo patrón que
// `Invoice.suplidos` (SCRUM-500) y `Invoice.shippingAddress` (SCRUM-602): la pieza aterriza antes
// que su cableado, con el motivo escrito y con guard propio, para que el día del ALTER no haya que
// reconstruir la decisión. Lo retira: quien cablee `getFoundingStatus` a la columna.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA FECHA DE CADUCIDAD DE `PLAZA_OCUPADA`, ESCRITA AQUÍ Y NO EN UN PARTE
//
//   «Este predicado es correcto SOLO mientras nadie tenga plan 'founding'. El día que el primer
//    merchant compre plaza y luego cancele, PLAZA_OCUPADA la libera y la landing publicará una
//    plaza libre que no lo está. Caduca al aplicar el ALTER de SCRUM-340.»
//
// Hoy es cierto porque está MEDIDO: cero clientes de pago (SCRUM-41 abierto). Un corte
// justificado por una medición lleva la medición dentro, o es una opinión con fecha de caducidad
// invisible — y ésta caduca con la PRIMERA venta, no con el paso del tiempo.
// ═══════════════════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** Lo único que hace falta saber de un merchant para decidir su plaza. */
export interface FilaDePlaza {
  /** Instante del cobro de la plaza de fundador. `null` = no consta que la comprara. */
  foundingPurchasedAt: Date | null;
}

/**
 * ¿Esta cuenta ocupa una plaza de fundador?
 *
 * PURA a propósito: la regla se prueba con casos, sin base de datos y sin red — que es lo que
 * permite tener un rojo de verdad sobre los casos que importan (un PRO activo, un fundador que
 * canceló) sin montar un banco.
 *
 * 🔴 NO MIRA NI `plan` NI `subscriptionStatus`, y ésa es toda la regla: son las dos columnas que
 * mezclarlas rompía. `founding_purchased_at` dice QUÉ compró y no se borra nunca;
 * `subscriptionStatus` dice SI sigue pagando y no entra aquí.
 */
export function plazaOcupada(m: FilaDePlaza): boolean {
  return m.foundingPurchasedAt != null;
}

export async function getFoundingStatus(): Promise<{ price: number; seatsTotal: number; seatsLeft: number; taken: number }> {
  const taken = await prisma.merchant.count({ where: { ...PLAZA_OCUPADA } });
  return {
    price: FOUNDING_PRICE,
    seatsTotal: FOUNDING_SEATS,
    seatsLeft: Math.max(0, FOUNDING_SEATS - taken),
    taken,
  };
}
