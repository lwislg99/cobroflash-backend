// src/modules/payments/connect/connectWebhook.routes.ts
// CONNECT-1 (C1-2) — webhook SEPARADO para eventos de cuentas conectadas
// (master U1.4: "CRÍTICO: endpoint de webhooks Connect separado, mapear
// metadata.chargeId, NO romper la cadena factura→paid").
//
// En Stripe Dashboard se registra como endpoint de tipo "Connect" apuntando a
// /webhooks/stripe-connect con su propio signing secret (STRIPE_CONNECT_WEBHOOK_SECRET).
// Los pagos confirmados se reenvían a /webhooks/psp igual que el webhook de
// plataforma: la cadena post-pago (charge.paid → invoice.paid → WA/email) es la misma.
import express from 'express';
import axios from 'axios';
import type StripeLib from 'stripe';
import { stripe } from '../../../integrations/stripe';
import { config, BASE_URL } from '../../../core/config/env';
import { internalHeaders } from '../../../core/http/internalAuth';
import { prisma } from '../../../core/db/prisma';
import { handleStripeDispute } from '../disputes.service'; // A21.1 (R14)

export const rawBody = express.raw({ type: 'application/json' });
export const router = express.Router();

router.post('/', async (req, res) => {
  try {
    if (!stripe) return res.status(501).send('Stripe no está configurado');

    const sig = req.headers['stripe-signature'] as string;
    const secret = config.STRIPE_CONNECT_WEBHOOK_SECRET;
    if (!secret) return res.status(500).send('Missing STRIPE_CONNECT_WEBHOOK_SECRET');

    const event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);

    if (event.type === 'account.updated') {
      // KYC del merchant avanza → connectStatus según charges_enabled (C1-1/D3)
      const account = event.data.object as StripeLib.Account;
      const status = account.charges_enabled
        ? 'active'
        : account.details_submitted ? 'restricted' : 'pending';
      const updated = await prisma.merchant.updateMany({
        where: { stripeAccountId: account.id },
        data: { connectStatus: status },
      });
      if (updated.count === 0) {
        console.warn('[stripe-connect] account.updated sin merchant:', account.id);
      }

    } else if (event.type === 'checkout.session.completed') {
      // Direct charge en la cuenta conectada → misma cadena post-pago
      const s = event.data.object as StripeLib.Checkout.Session;
      if (s.mode === 'payment') {
        const chargeId = Number(s.metadata?.charge_id);
        if (Number.isInteger(chargeId)) {
          await axios.post(`${BASE_URL}/webhooks/psp`, {
            event: 'payment.confirmed', charge_id: chargeId,
            method: 'card', bank_ref: s.payment_intent || 'pi_unknown',
            amount: (s.amount_total ?? 0) / 100,
            currency: (s.currency || 'eur').toUpperCase(),
            ts: new Date().toISOString(),
          }, { timeout: 10_000, headers: internalHeaders() });
        }
      }

    } else if (event.type === 'charge.dispute.created') {
      // A21.1 (R14): disputa → aviso WA/BO + paquete de evidencia en la factura
      await handleStripeDispute(event.data.object as StripeLib.Dispute);

    } else if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as StripeLib.PaymentIntent;
      const chargeId = Number(pi.metadata?.charge_id);
      if (Number.isInteger(chargeId)) {
        await axios.post(`${BASE_URL}/webhooks/psp`, {
          event: 'payment.failed', charge_id: chargeId,
          method: 'card', bank_ref: pi.id,
          ts: new Date().toISOString(),
        }, { timeout: 10_000, headers: internalHeaders() });
      }
    }

    res.json({ received: true });
  } catch (e: any) {
    console.error('Stripe Connect webhook error:', e?.message || e);
    res.status(400).send(`Webhook Error: ${e?.message || e}`);
  }
});
