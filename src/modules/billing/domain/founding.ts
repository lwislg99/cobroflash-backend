// V0-4 (master U1.1 / W1) — Oferta founding: 9,90 €/mes DE POR VIDA, 20 plazas.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-340 · EL CONTADOR CUENTA COMPRAS, NO CAMPOS
//
// EL BUG QUE CIERRA: contaba `merchant.count({ where: { plan: 'founding' } })`. `plan` es un CAMPO
// QUE SE ASIGNA, y el texto que ve el visitante promete que alguien **compró**. Dos consecuencias,
// las dos medidas:
//   · Un `plan` puesto a mano inflaba el contador sin que nadie hubiera pagado.
//   · Y al CANCELAR, el webhook devuelve el plan a `trial` (`stripe.routes.ts:128,141`), así que la
//     plaza se LIBERABA sola y el contador SUBÍA. Un número de escasez que va hacia atrás en una
//     landing es exactamente lo que hace pensar que está inventado.
//
// LA REGLA, decidida por el fundador: **una plaza ocupada NO se libera.** La oferta es de 20 plazas
// fundadoras y quien la tomó la gastó, aunque después cancele.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// CÓMO SE DERIVA «COBRO CONFIRMADO» SIN LLAMAR A STRIPE (producción no se toca)
//
// Se mira lo que Stripe ya dejó escrito en la BD, y el orden de preferencia sale de qué lo escribe:
//
//   · `subscriptionStatus` ∈ {active, past_due} → el webhook `customer.subscription.updated` lo
//     escribe con la suscripción YA existente. `past_due` es alguien que pagó y ahora le falla un
//     cobro: compró. OCUPA.
//
//   · `lifecycleEmailsSent.firstPayment` → **el proxy declarado de «llegó a pagar»**. Lo escribe
//     `sendFirstPaymentEmail`, y ese se llama desde UN SOLO SITIO: la rama de
//     `checkout.session.completed` del webhook (`stripe.routes.ts:80`), justo detrás de la
//     recompensa de referido. Nada lo borra nunca (`markSent` solo añade), así que **sobrevive a la
//     cancelación** — que es justo lo que hace falta para no liberar la plaza.
//
// POR QUÉ NO SE USA NINGUNO DE LOS OTROS TRES, y está medido:
//   · `plan`: es el bug.
//   · `stripeCustomerId`: se escribe **ANTES** de pagar, al crear la sesión de checkout
//     (`subscriptions.routes.ts:114-116`). Significa «empezó», no «pagó».
//   · `stripeSubscriptionId`: se pone a `null` al cancelar, así que no puede acreditar un pago
//     pasado.
//   · `subscriptionStatus === 'canceled'` a secas: **NO distingue**. El webhook escribe ese mismo
//     valor para `canceled` Y para `incomplete_expired` (`stripe.routes.ts:125`), o sea que mezcla
//     a quien pagó y canceló con quien nunca llegó a pagar. Por eso hace falta el marcador.
//
// ⚠️ LÍMITE DEL PROXY, declarado: si el webhook de `checkout.session.completed` nunca llegó (caída,
// firma inválida), no hay marcador y esa plaza no se contaría. El error va en la dirección segura
// —contar de menos, nunca de más— y es el mismo dato del que ya dependen la recompensa de referido
// y el correo de bienvenida a Pro.
import { prisma } from '../../../core/db/prisma';

export const FOUNDING_SEATS = 20;
export const FOUNDING_PRICE = 9.9;

/** Estados que el webhook de Stripe escribe cuando la suscripción existe y se pagó. */
export const ESTADOS_QUE_ACREDITAN_COBRO = ['active', 'past_due'] as const;

/** La clave que `sendFirstPaymentEmail` marca tras `checkout.session.completed`. */
export const MARCADOR_PRIMER_PAGO = 'firstPayment';

export interface FilaDePlaza {
  subscriptionStatus: string | null;
  lifecycleEmailsSent: unknown;
}

/**
 * ¿Esta cuenta ha gastado una plaza fundadora? PURA a propósito: es la regla del ticket y se prueba
 * con casos, sin BD y sin red — que es lo que permite tener un rojo de verdad sobre los estados
 * intermedios (`incomplete` no ocupa; `past_due` sí).
 */
export function plazaOcupada(m: FilaDePlaza): boolean {
  const estado = String(m.subscriptionStatus ?? '');
  if ((ESTADOS_QUE_ACREDITAN_COBRO as readonly string[]).includes(estado)) return true;

  const marcas = m.lifecycleEmailsSent;
  if (marcas && typeof marcas === 'object' && !Array.isArray(marcas)) {
    return !!(marcas as Record<string, unknown>)[MARCADOR_PRIMER_PAGO];
  }
  return false;
}

/**
 * DOS DECISIONES, y confundirlas es lo que hacía el código de antes:
 *   · `ofertaVigente` — ¿se sigue pudiendo comprar la plaza? De ahí depende ANUNCIAR la oferta
 *     (el precio de 9,90 €, el precio tachado, el texto del botón). Es cierto o no con
 *     independencia de cuánta gente haya comprado.
 *   · `mostrar` — ¿se pinta el CONTADOR? Solo si además hay al menos una plaza ocupada de verdad.
 */
export type FoundingStatus =
  | { resoluble: true; ofertaVigente: boolean; mostrar: boolean; price: number; seatsTotal: number; seatsLeft: number; taken: number }
  | { resoluble: false; ofertaVigente: false; mostrar: false; price: number; seatsTotal: number; motivo: string };

/**
 * SUELO: si el contador NO se puede resolver, se dice — **nunca un número inventado**.
 *
 * Y `mostrar` es UNA SOLA FUENTE para las tres superficies que lo pintan. Antes cada una repetía
 * la condición a su manera (`seatsLeft > 0` en dos sitios y `founding.seatsLeft > 0` en el panel):
 * tres copias de una regla es tres sitios donde se puede olvidar el cambio siguiente.
 *
 * ⚠️ CON CERO PLAZAS OCUPADAS NO SE PINTA, y no es un descuido: «quedan 20 de 20» no comunica
 * escasez, comunica que **no ha comprado nadie**. La oferta se sigue anunciando por su PRECIO, que
 * es cierto y no depende de esto (decisión del fundador).
 */
export async function getFoundingStatus(): Promise<FoundingStatus> {
  try {
    // Se leen las dos señales y se filtra en memoria a propósito: la regla vive en `plazaOcupada`,
    // que es pura y testeable. Meterla en un `where` la partiría en dos —mitad SQL, mitad JSON— y
    // dejaría de poder probarse sin base de datos. A la escala de la oferta (20 plazas) el coste
    // es irrelevante; si algún día la tabla crece, esto pasa a un `count` con filtro JSON.
    const filas = await prisma.merchant.findMany({
      select: { subscriptionStatus: true, lifecycleEmailsSent: true },
    });

    const taken = filas.filter(plazaOcupada).length;
    const seatsLeft = Math.max(0, FOUNDING_SEATS - taken);

    return {
      resoluble: true,
      ofertaVigente: seatsLeft > 0,
      mostrar: taken > 0 && seatsLeft > 0,
      price: FOUNDING_PRICE,
      seatsTotal: FOUNDING_SEATS,
      seatsLeft,
      taken,
    };
  } catch (err: any) {
    console.error('[founding] no se pudo resolver el contador:', err?.message || err);
    // Suelo: sin dato no se anuncia la oferta NI se pinta el contador. Anunciar «quedan plazas»
    // sin poder decir cuántas es la misma clase de afirmación sin respaldo, más pequeña.
    return {
      resoluble: false,
      ofertaVigente: false,
      mostrar: false,
      price: FOUNDING_PRICE,
      seatsTotal: FOUNDING_SEATS,
      motivo: 'no_resoluble',
    };
  }
}
