// srcNew/modules/billing/app/routes/stripe.routes.ts
import express from 'express';
import axios from 'axios';
import type StripeLib from 'stripe';
import { stripe } from '../../../../integrations/stripe';
import { config, BASE_URL } from '../../../../core/config/env';

export const rawBody = express.raw({ type: 'application/json' });
export const router = express.Router();

router.post('/', async (req, res) => {
  try {
    if (!stripe) return res.status(501).send('Stripe no está configurado');

    const sig = req.headers['stripe-signature'] as string;
    const secret = config.STRIPE_WEBHOOK_SECRET;
    if (!secret) return res.status(500).send('Missing STRIPE_WEBHOOK_SECRET');

    const event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      secret,
    );

    if (event.type === 'checkout.session.completed') {
      const s = event.data.object as StripeLib.Checkout.Session;
      const chargeId = Number(s.metadata?.charge_id);
      if (Number.isInteger(chargeId)) {
        await axios.post(
          `${BASE_URL}/webhooks/psp`,
          {
            event: 'payment.confirmed',
            charge_id: chargeId,
            method: 'card:stripe',
            bank_ref: s.payment_intent || 'pi_unknown',
            amount: (s.amount_total ?? 0) / 100,
            currency: (s.currency || 'eur').toUpperCase(),
            ts: new Date().toISOString(),
          },
          { timeout: 10_000 },
        );
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as StripeLib.PaymentIntent;
      const chargeId = Number(pi.metadata?.charge_id);
      if (Number.isInteger(chargeId)) {
        await axios.post(
          `${BASE_URL}/webhooks/psp`,
          {
            event: 'payment.failed',
            charge_id: chargeId,
            method: 'card:stripe',
            bank_ref: pi.id,
            ts: new Date().toISOString(),
          },
          { timeout: 10_000 },
        );
      }
    } else if (event.type === 'checkout.session.expired') {
      const s = event.data.object as StripeLib.Checkout.Session;
      const chargeId = Number(s.metadata?.charge_id);
      if (Number.isInteger(chargeId)) {
        await axios.post(
          `${BASE_URL}/webhooks/psp`,
          {
            event: 'payment.expired',
            charge_id: chargeId,
            method: 'card:stripe',
            bank_ref: s.id,
            ts: new Date().toISOString(),
          },
          { timeout: 10_000 },
        );
      }
    }

    res.json({ received: true });
  } catch (e: any) {
    console.error('Stripe webhook error:', e?.message || e);
    res.status(400).send(`Webhook Error: ${e?.message || e}`);
  }
});
