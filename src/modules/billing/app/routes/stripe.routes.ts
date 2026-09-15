import express from 'express';
import axios from 'axios';
import type StripeLib from 'stripe';
import { stripe } from '../../../../integrations/stripe';
import { config, BASE_URL } from '../../../../core/config/env';
import { internalHeaders } from '../../../../core/http/internalAuth';
import { prisma } from '../../../../core/db/prisma';
import { handleStripeDispute } from '../../../payments/disputes.service'; // A21.1 (R14)
import { rewardReferralOnFirstPayment } from '../../../auth/domain/referral.service';
import { sendFirstPaymentEmail } from '../../../messaging/domain/lifecycle.service';
// SCRUM-475: un aviso que no sale deja constancia -- y sin poder tumbar la activacion del plan.
import { conConstancia } from '../../../messaging/domain/avisoConstancia';
// SCRUM-815 (③): el registro en DISCO de qué entregas se han atendido ya. Sólo para los CINCO
// tipos seguros de repetir; los dos que no lo son siguen con el LRU de aquí abajo, a propósito.
import {
  llevaRegistro, abrirRegistroDeEvento, marcarEventoProcesado, anotarFalloDeEvento,
} from '../../domain/gatewayEvents.service';

export const rawBody = express.raw({ type: 'application/json' });
export const router = express.Router();

// A10.4: idempotencia — Stripe reintenta y puede entregar el mismo evento dos
// veces; un event.id ya procesado no vuelve a aplicar cambios de plan. LRU en
// memoria (500) suficiente para F1; A12.2 lo cubre con test.
const seenStripeEvents = new Set<string>();
const seenOrder: string[] = [];
export function isDuplicateStripeEvent(id: string): boolean { // A12.2: exportada para la suite
  if (!id) return false;
  if (seenStripeEvents.has(id)) return true;
  seenStripeEvents.add(id);
  seenOrder.push(id);
  if (seenOrder.length > 500) seenStripeEvents.delete(seenOrder.shift() as string);
  return false;
}

router.post('/', async (req, res) => {
  // SCRUM-815 · El id de la entrega que tiene registro ABIERTO (fila escrita, `processed_at`
  // todavía a NULL). Vive fuera del `try` porque quien tiene que cerrarla —bien o mal— es el
  // final de la ruta y el `catch`, y un `const` dentro del `try` no llega ahí.
  let entregaConRegistro: string | null = null;
  try {
    if (!stripe) return res.status(501).send('Stripe no está configurado');

    const sig = req.headers['stripe-signature'] as string;
    const secret = config.STRIPE_WEBHOOK_SECRET;
    if (!secret) return res.status(500).send('Missing STRIPE_WEBHOOK_SECRET');

    const event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);

    // SCRUM-815 · LA PUERTA, y son dos caminos a propósito:
    //
    //   · los CINCO tipos seguros de repetir pasan por `gateway_events`, en disco. Un evento que
    //     llegó y no terminó vuelve a entrar en la siguiente entrega, que es la propiedad entera
    //     de los dos timestamps;
    //   · los DOS que no son idempotentes —la disputa y `checkout.session.completed`— siguen
    //     EXACTAMENTE como estaban, con el LRU en memoria. Su motivo está escrito en
    //     `EVENTOS_CON_REGISTRO`: hoy el defecto es silencioso y encenderlo ahí lo volvería
    //     ruidoso (correo reenviado, WhatsApp repetido, mes gratis duplicado).
    if (llevaRegistro(event.type)) {
      if (await abrirRegistroDeEvento(event.id, event.type) === 'ya_procesado') {
        console.log(`[stripe] evento ya procesado, ACK sin trabajo: ${event.id} (${event.type})`);
        return res.json({ received: true, duplicate: true });
      }
      // Desde aquí hay una fila abierta que hay que cerrar, termine bien o mal.
      entregaConRegistro = event.id;
    } else if (isDuplicateStripeEvent(event.id)) {
      // A10.4: evento duplicado → ACK sin re-aplicar
      console.log(`[stripe] evento duplicado ignorado: ${event.id} (${event.type})`);
      return res.json({ received: true, duplicate: true });
    }

    if (event.type === 'charge.dispute.created') {
      // A21.1 (R14): tarjetas de HOY (cuenta plataforma) — mismo tratamiento
      await handleStripeDispute(event.data.object as any, event.id);
      return res.json({ received: true });
    }

    if (event.type === 'checkout.session.completed') {
      const s = event.data.object as StripeLib.Checkout.Session;

      if (s.mode === 'payment') {
        // Cobro de factura / charge
        const chargeId = Number(s.metadata?.charge_id);
        if (Number.isInteger(chargeId)) {
          await axios.post(`${BASE_URL}/webhooks/psp`, {
            event: 'payment.confirmed', charge_id: chargeId,
            method: 'card:stripe', bank_ref: s.payment_intent || 'pi_unknown',
            amount: (s.amount_total ?? 0) / 100,
            currency: (s.currency || 'eur').toUpperCase(),
            ts: new Date().toISOString(),
          }, { timeout: 10_000, headers: internalHeaders() });
        }
      } else if (s.mode === 'subscription') {
        // Suscripción nueva
        const merchantId = Number(s.metadata?.merchant_id);
        const planId = String(s.metadata?.plan || '');
        if (Number.isInteger(merchantId) && planId && s.customer) {
          // SCRUM-475: el `select` es para saber a QUIÉN no se le avisó si el correo no sale. Un
          // rastro que no identifica el caso no es constancia: es ruido.
          const activado = await prisma.merchant.update({
            where: { id: merchantId },
            data: { stripeCustomerId: String(s.customer), plan: planId, subscriptionStatus: 'active' }, // A10.2 (L)
            select: { email: true },
          });
          // Recompensa de referido (mes gratis al referidor) — idempotente
          await rewardReferralOnFirstPayment(merchantId).catch((e) =>
            console.error('[stripe] referral reward:', e?.message),
          );
          // Email de activación "primer pago / bienvenido a Pro" — idempotente
          //
          // SCRUM-475 · ⚠️ SE QUITA EL `await`, Y ES DELIBERADO: el plan ya está activo en la línea
          // de arriba. Esperar aquí hacía que un correo lento o caído retrasara la respuesta a
          // Stripe —que reintenta el webhook— por un aviso que no puede deshacer nada. El `.catch()`
          // que había no sobraba por ser `catch`: sobraba por no dejar constancia de a qué
          // profesional se le activó el Pro sin decírselo, y por no cubrir el canal del VALOR (el
          // fallo DEVUELTO sin excepción, que no disparaba ese `.catch` nunca).
          conConstancia('primer_pago', activado.email ?? '', sendFirstPaymentEmail(merchantId));
        }
      }

    } else if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as StripeLib.PaymentIntent;
      const chargeId = Number(pi.metadata?.charge_id);
      if (Number.isInteger(chargeId)) {
        await axios.post(`${BASE_URL}/webhooks/psp`, {
          event: 'payment.failed', charge_id: chargeId,
          method: 'card:stripe', bank_ref: pi.id,
          ts: new Date().toISOString(),
        }, { timeout: 10_000, headers: internalHeaders() });
      }

    } else if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.created'
    ) {
      const sub = event.data.object as StripeLib.Subscription;
      const merchantId = Number(sub.metadata?.merchant_id);
      const planId = String(sub.metadata?.plan || '');
      if (Number.isInteger(merchantId) && planId) {
        // A10.2 — FSM de la Parte L (fuente única: ESTE webhook):
        //   active/trialing → active(plan) · past_due/unpaid → past_due (el plan
        //   SE CONSERVA: gracia con banner + portal, no se degrada a trial) ·
        //   canceled/incomplete_expired → canceled → plan trial.
        const st = String(sub.status);
        if (st === 'active' || st === 'trialing') {
          await prisma.merchant.update({
            where: { id: merchantId },
            data: {
              plan: planId,
              subscriptionStatus: 'active',
              stripeSubscriptionId: sub.id,
              planExpiresAt: new Date((sub as any).current_period_end * 1000),
            },
          });
        } else if (st === 'past_due' || st === 'unpaid') {
          await prisma.merchant.update({
            where: { id: merchantId },
            data: { plan: planId, subscriptionStatus: 'past_due', stripeSubscriptionId: sub.id },
          });
        } else if (st === 'canceled' || st === 'incomplete_expired') {
          await prisma.merchant.update({
            where: { id: merchantId },
            data: { plan: 'trial', subscriptionStatus: 'canceled', stripeSubscriptionId: null, planExpiresAt: null },
          });
        } else {
          console.log(`[stripe] estado de suscripción sin mapeo directo: ${st} (merchant ${merchantId})`);
        }
      }

    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as StripeLib.Subscription;
      const merchantId = Number(sub.metadata?.merchant_id);
      if (Number.isInteger(merchantId)) {
        await prisma.merchant.update({
          where: { id: merchantId },
          data: { plan: 'trial', subscriptionStatus: 'canceled', stripeSubscriptionId: null, planExpiresAt: null }, // A10.2 (L)
        });
      }

    } else if (event.type === 'checkout.session.expired') {
      const s = event.data.object as StripeLib.Checkout.Session;
      const chargeId = Number(s.metadata?.charge_id);
      if (Number.isInteger(chargeId)) {
        await axios.post(`${BASE_URL}/webhooks/psp`, {
          event: 'payment.expired', charge_id: chargeId,
          method: 'card:stripe', bank_ref: s.id,
          ts: new Date().toISOString(),
        }, { timeout: 10_000, headers: internalHeaders() });
      }
    }

    // SCRUM-815 · AL TERMINAR CON ÉXITO, Y NUNCA ANTES. Ésta es la línea que separa este
    // arreglo de su defecto: la ruta marcaba al RECIBIR, así que un fallo posterior devolvía
    // 400, Stripe reintentaba, y el reintento se descartaba por «ya visto» sin hacer el trabajo.
    if (entregaConRegistro) await marcarEventoProcesado(entregaConRegistro);
    res.json({ received: true });
  } catch (e: any) {
    console.error('Stripe webhook error:', e?.message || e);
    // SCRUM-815 · Se anota el motivo y `processed_at` SE QUEDA A NULL: eso es lo que deja la
    // puerta abierta a la siguiente entrega. El 400 no se toca — es lo que hace que Stripe
    // vuelva a entregar.
    if (entregaConRegistro) await anotarFalloDeEvento(entregaConRegistro, String(e?.message || e));
    res.status(400).send(`Webhook Error: ${e?.message || e}`);
  }
});
