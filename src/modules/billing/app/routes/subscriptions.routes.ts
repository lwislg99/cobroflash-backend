import { Router } from 'express';
import { stripe } from '../../../../integrations/stripe';
import { prisma } from '../../../../core/db/prisma';
import { config } from '../../../../core/config/env';

const router = Router();

const PLANS = [
  {
    id: 'pro',
    label: 'Pro',
    price: 19,
    priceAnnual: 179,
    priceId: config.STRIPE_PRICE_ID_PRO,
    priceAnnualId: config.STRIPE_PRICE_ID_PRO_ANNUAL,
  },
] as const;

// GET /admin/billing/plans
router.get('/plans', async (req, res) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: req.merchantId },
    select: { plan: true, planExpiresAt: true, stripeSubscriptionId: true },
  });
  return res.json({
    currentPlan: merchant?.plan ?? 'trial',
    planExpiresAt: merchant?.planExpiresAt ?? null,
    plans: PLANS.map(({ priceId, priceAnnualId, ...rest }) => rest),
  });
});

// POST /admin/billing/checkout  { plan: 'pro', annual?: boolean }
router.post('/checkout', async (req, res) => {
  if (!stripe) return res.status(501).json({ error: 'stripe_not_configured' });

  const planId = String(req.body?.plan || '');
  const annual  = req.body?.annual === true;
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) return res.status(400).json({ error: 'invalid_plan' });

  const priceId = annual ? plan.priceAnnualId : plan.priceId;
  if (!priceId) return res.status(501).json({ error: 'price_not_configured' });

  const merchant = await prisma.merchant.findUnique({
    where: { id: req.merchantId },
    select: { email: true, stripeCustomerId: true, name: true },
  });
  if (!merchant?.email) return res.status(400).json({ error: 'merchant_email_required' });

  try {
    let customerId = merchant.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: merchant.email, name: merchant.name });
      customerId = customer.id;
      await prisma.merchant.update({ where: { id: req.merchantId }, data: { stripeCustomerId: customerId } });
    }

    const subMeta = { merchant_id: String(req.merchantId), plan: plan.id };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${config.PUBLIC_BASE_URL}/dashboard/#plans?success=1`,
      cancel_url:  `${config.PUBLIC_BASE_URL}/dashboard/#plans?cancelled=1`,
      metadata: subMeta,
      subscription_data: { trial_period_days: 0, metadata: subMeta },
    });

    return res.json({ ok: true, checkoutUrl: session.url });
  } catch (err: any) {
    console.error('[POST /admin/billing/checkout]', err);
    return res.status(500).json({ error: 'stripe_error', detail: err.message });
  }
});

// POST /admin/billing/portal — portal de gestión de Stripe
router.post('/portal', async (req, res) => {
  if (!stripe) return res.status(501).json({ error: 'stripe_not_configured' });

  const merchant = await prisma.merchant.findUnique({
    where: { id: req.merchantId },
    select: { stripeCustomerId: true },
  });
  if (!merchant?.stripeCustomerId) return res.status(400).json({ error: 'no_subscription' });

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: merchant.stripeCustomerId,
      return_url: `${config.PUBLIC_BASE_URL}/dashboard/#plans`,
    });
    return res.json({ ok: true, portalUrl: session.url });
  } catch (err: any) {
    console.error('[POST /admin/billing/portal]', err);
    return res.status(500).json({ error: 'stripe_error', detail: err.message });
  }
});

export default router;
