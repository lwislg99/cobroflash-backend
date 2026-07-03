// src/modules/payments/connect/connect.routes.ts
// CONNECT-1 (C1-1) — onboarding Stripe Connect EXPRESS del merchant.
// Master D3: direct charges sobre la cuenta conectada; el merchant es
// merchant-of-record. Flag global: PAYMENTS_CONNECT_ENABLED (Parte P).
// Montado en /admin/connect con requireRole('admin').
import { Router } from 'express';
import { prisma } from '../../../core/db/prisma';
import { stripe } from '../../../integrations/stripe';
import { BASE_URL } from '../../../core/config/env';
import { isFlagEnabled } from '../../../core/flags';

const router = Router();

/** Estado para la card "Cobros" de Configuración. */
router.get('/status', async (req, res) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: req.merchantId },
    select: { id: true, country: true, connectStatus: true, stripeAccountId: true, bizumPhone: true, whatsappPhone: true, iban: true },
  });
  if (!merchant) return res.status(404).json({ error: 'merchant_not_found' });
  return res.json({
    enabled: isFlagEnabled('PAYMENTS_CONNECT_ENABLED', { merchant }),
    bizumEnabled: isFlagEnabled('BIZUM_MANUAL_ENABLED', { merchant }),
    connectStatus: merchant.connectStatus,
    hasStripeAccount: !!merchant.stripeAccountId,
    bizumPhone: merchant.bizumPhone || merchant.whatsappPhone || null,
    hasIban: !!merchant.iban,
  });
});

/** Crea (si hace falta) la cuenta Express y devuelve el Account Link de onboarding. */
router.post('/onboard', async (req, res) => {
  try {
    if (!stripe) return res.status(501).json({ error: 'stripe_not_configured' });

    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { id: true, email: true, country: true, stripeAccountId: true, connectStatus: true },
    });
    if (!merchant) return res.status(404).json({ error: 'merchant_not_found' });
    if (!isFlagEnabled('PAYMENTS_CONNECT_ENABLED', { merchant })) {
      return res.status(409).json({ error: 'connect_disabled' });
    }

    let accountId = merchant.stripeAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: (merchant.country || 'ES').toUpperCase(),
        email: merchant.email || undefined,
        metadata: { merchant_id: String(merchant.id) },
      });
      accountId = account.id;
      await prisma.merchant.update({
        where: { id: merchant.id },
        data: { stripeAccountId: accountId, connectStatus: 'pending' },
      });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${BASE_URL}/admin/connect/refresh`,
      return_url: `${BASE_URL}/admin/connect/return`,
      type: 'account_onboarding',
    });

    return res.json({ ok: true, url: link.url });
  } catch (err: any) {
    console.error('[connect/onboard]', err?.message || err);
    return res.status(502).json({ error: 'stripe_error', message: err?.message || 'Error creando el onboarding' });
  }
});

/** Sincroniza el estado desde Stripe (usado por return/refresh y como fallback del webhook). */
async function syncConnectStatus(merchantId: number): Promise<string> {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, stripeAccountId: true, connectStatus: true },
  });
  if (!merchant?.stripeAccountId || !stripe) return merchant?.connectStatus ?? 'none';
  try {
    const account = await stripe.accounts.retrieve(merchant.stripeAccountId);
    const status = account.charges_enabled
      ? 'active'
      : account.details_submitted ? 'restricted' : 'pending';
    if (status !== merchant.connectStatus) {
      await prisma.merchant.update({ where: { id: merchantId }, data: { connectStatus: status } });
    }
    return status;
  } catch (err: any) {
    console.error('[connect/sync]', err?.message || err);
    return merchant.connectStatus;
  }
}

/** Vuelta del onboarding de Stripe → sincroniza estado y devuelve a Configuración. */
router.get('/return', async (req, res) => {
  await syncConnectStatus(req.merchantId);
  return res.redirect(303, '/dashboard/#settings');
});

/** El Account Link caducó → generar otro y reintentar. */
router.get('/refresh', async (req, res) => {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { stripeAccountId: true },
    });
    if (!stripe || !merchant?.stripeAccountId) return res.redirect(303, '/dashboard/#settings');
    const link = await stripe.accountLinks.create({
      account: merchant.stripeAccountId,
      refresh_url: `${BASE_URL}/admin/connect/refresh`,
      return_url: `${BASE_URL}/admin/connect/return`,
      type: 'account_onboarding',
    });
    return res.redirect(303, link.url);
  } catch (err: any) {
    console.error('[connect/refresh]', err?.message || err);
    return res.redirect(303, '/dashboard/#settings');
  }
});

export default router;
