// srcNew/modules/billing/app/routes/payCard.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { stripe } from '../../../../integrations/stripe';
import { BASE_URL } from '../../../../core/config/env';

const router = Router();

router.get('/card/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).send('ID inválido');

  if (!stripe) {
    return res
      .status(501)
      .send('Stripe no está configurado. Define STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET.');
  }

  const charge = await prisma.charge.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!charge) return res.status(404).send('Cobro no encontrado');
  if (charge.status !== 'pending') {
    return res.redirect(303, `/recibo/${id}`);
  }

  const amountCents = Math.round(Number(charge.amount) * 100);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: charge.customer?.email || undefined,
    line_items: [
      {
        price_data: {
          currency: charge.currency.toLowerCase(),
          product_data: { name: charge.concept || `Cobro #${id}` },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${BASE_URL}/recibo/${id}?card=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE_URL}/recibo/${id}?card=cancel`,
    metadata: { charge_id: String(id) },
  });

  await prisma.event.create({
    data: {
      chargeId: id,
      type: 'card_session_created',
      payload: { session_id: session.id } as any,
    },
  });

  return res.redirect(303, session.url!);
});

export default router;
