// srcNew/integrations/stripe.ts
import Stripe from 'stripe';
import { config } from '../core/config/env';

export const stripe = config.STRIPE_SECRET_KEY
  ? new Stripe(config.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20' as any,
    })
  : null;

export const stripeEnabled = !!stripe;
