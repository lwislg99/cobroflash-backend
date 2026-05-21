import express from 'express';
import axios from 'axios';
import type StripeLib from 'stripe';
import { stripe } from '../../../../integrations/stripe';
import { config, BASE_URL } from '../../../../core/config/env';
import { prisma } from '../../../../core/db/prisma';

export const rawBody = express.raw({ type: 'application/json' });
export const router = express.Router();

router.post('/', async (req, res) => {
  try {
    if (!stripe) return res.status(501).send('Stripe no está configurado');

    const sig = req.headers['stripe-signature'] as string;
    const secret = config.STRIPE_WEBHOOK_SECRET;
    if (!secret) return res.status(500).send('Missing STRIPE_WEBHOOK_SECRET');

    const event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);

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
          }, { timeout: 10_000 });
        }
      } else if (s.mode === 'subscription') {
        // Suscripción nueva
        const merchantId = Number(s.metadata?.merchant_id);
        const planId = String(s.metadata?.plan || '');
        if (Number.isInteger(merchantId) && planId && s.customer) {
          await prisma.merchant.update({
            where: { id: merchantId },
            data: { stripeCustomerId: String(s.customer), plan: planId },
          });
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
        }, { timeout: 10_000 });
      }

    } else if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.created'
    ) {
      const sub = event.data.object as StripeLib.Subscription;
      const merchantId = Number(sub.metadata?.merchant_id);
      const planId = String(sub.metadata?.plan || '');
      if (Number.isInteger(merchantId) && planId) {
        const isActive = sub.status === 'active' || sub.status === 'trialing';
        await prisma.merchant.update({
          where: { id: merchantId },
          data: {
            plan: isActive ? planId : 'trial',
            stripeSubscriptionId: sub.id,
            planExpiresAt: isActive ? new Date((sub as any).current_period_end * 1000) : null,
          },
        });
      }

    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as StripeLib.Subscription;
      const merchantId = Number(sub.metadata?.merchant_id);
      if (Number.isInteger(merchantId)) {
        await prisma.merchant.update({
          where: { id: merchantId },
          data: { plan: 'trial', stripeSubscriptionId: null, planExpiresAt: null },
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
        }, { timeout: 10_000 });
      }
    }

    res.json({ received: true });
  } catch (e: any) {
    console.error('Stripe webhook error:', e?.message || e);
    res.status(400).send(`Webhook Error: ${e?.message || e}`);
  }
});
