import { Router } from 'express';
import { stripe } from '../../../../integrations/stripe';
import { prisma } from '../../../../core/db/prisma';
import { config } from '../../../../core/config/env';
import { resolvePriceId, type PriceKey } from '../../domain/stripePrices';
import { FOUNDING_SEATS, getFoundingStatus } from '../../domain/founding';
import { readLegalDoc } from '../../../system/app/routes/legalPages.routes';

const router = Router();

// W1: UN plan público — YaQu Pro 29 €/mes (o 290 €/año). Founding = banner sobre Pro
// (14,50 €/mes de por vida, 20 plazas con contador real). EQUIPO existe en Stripe
// pero NO se lista (oferta manual W1).
const PLANS = [
  {
    id: 'pro',
    label: 'Pro',
    price: 29,
    priceAnnual: 290,
    currency: 'EUR',
    priceKey: 'pro_monthly' as PriceKey,
    priceAnnualKey: 'pro_annual' as PriceKey,
  },
] as const;

// GET /admin/billing/plans
router.get('/plans', async (req, res) => {
  const [merchant, founding] = await Promise.all([
    prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { plan: true, planExpiresAt: true, stripeSubscriptionId: true },
    }),
    getFoundingStatus(),
  ]);
  return res.json({
    currentPlan: merchant?.plan ?? 'trial',
    planExpiresAt: merchant?.planExpiresAt ?? null,
    plans: PLANS.map(({ priceKey, priceAnnualKey, ...rest }) => rest),
    founding, // { price, seatsTotal, seatsLeft }
  });
});

// A10.1 (regla 25): aceptación del ALCANCE BETA antes del checkout founding.
// La versión es el hash del texto servido en /legal/alcance-beta: si el asesor
// cambia el texto, hay que re-aceptar. Evidencia: userId (teamMember si aplica),
// ts, IP, user-agent y versión, en legal_acceptances.
router.post('/accept-alcance', async (req, res) => {
  const doc = readLegalDoc('ALCANCE_BETA.md');
  if (!doc) return res.status(500).json({ error: 'legal_doc_missing' });
  try {
    await prisma.legalAcceptance.create({
      data: {
        merchantId: req.merchantId,
        teamMemberId: (req as any).teamMemberId ?? null,
        docKey: 'alcance-beta',
        version: doc.version,
        ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || null,
        userAgent: String(req.headers['user-agent'] || '').slice(0, 300) || null,
      },
    });
    return res.json({ ok: true, version: doc.version });
  } catch (err: any) {
    console.error('[POST /admin/billing/accept-alcance]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /admin/billing/checkout  { plan: 'pro' | 'founding', annual?: boolean }
router.post('/checkout', async (req, res) => {
  if (!stripe) return res.status(501).json({ error: 'stripe_not_configured' });

  const planId = String(req.body?.plan || '');
  const annual  = req.body?.annual === true;

  let priceId: string | null = null;
  if (planId === 'founding') {
    // V0-4: contador real — sin plazas no hay checkout
    const founding = await getFoundingStatus();
    if (founding.seatsLeft <= 0) return res.status(409).json({ error: 'founding_sold_out' });

    // A10.1 (regla 25): sin aceptación VIGENTE del alcance beta no hay checkout
    const doc = readLegalDoc('ALCANCE_BETA.md');
    if (!doc) return res.status(500).json({ error: 'legal_doc_missing' });
    const accepted = await prisma.legalAcceptance.findFirst({
      where: { merchantId: req.merchantId, docKey: 'alcance-beta', version: doc.version },
      select: { id: true },
    });
    if (!accepted) {
      return res.status(412).json({
        error: 'alcance_not_accepted',
        message: 'Lee y acepta el alcance de la beta para continuar.',
        url: '/legal/alcance-beta',
        version: doc.version,
      });
    }

    priceId = await resolvePriceId('founding_monthly');
  } else {
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) return res.status(400).json({ error: 'invalid_plan' });
    priceId = await resolvePriceId(annual ? plan.priceAnnualKey : plan.priceKey);
  }
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

    const subMeta = { merchant_id: String(req.merchantId), plan: planId };

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
