import express from 'express';
import path from 'path';

import { invoicesDir, outboxDir } from './core/storage/dirs';
import { jsonError } from './core/http/jsonError';
import { requireAuth, requireActivePlan } from './core/http/authMiddleware';

// Routers
import healthRouter from './modules/system/app/routes/health.routes';
import devRouter from './modules/system/app/routes/dev.routes';

import {
  rawBody as stripeRawBody,
  router as stripeWebhookRouter,
} from './modules/billing/app/routes/stripe.routes';
import pspWebhookRouter from './modules/billing/app/routes/psp.routes';
import chargesRouter from './modules/billing/app/routes/charges.routes';
import receiptRouter from './modules/billing/app/routes/receipt.routes';
import payBankRouter from './modules/billing/app/routes/payBank.routes';
import payCardRouter from './modules/billing/app/routes/payCard.routes';

import quotesRouter from './modules/quotes/app/routes/quotes.routes';
import invoiceRouter from './modules/invoicing/app/routes/invoice.routes';

import customersAdminRouter from './modules/system/app/routes/customersAdmin.routes';
import quotesAdminRouter from './modules/system/app/routes/quotesAdmin.routes';
import invoicesAdminRouter from './modules/system/app/routes/invoicesAdmin.routes';
import productsAdminRouter from './modules/products/app/routes/products.routes';
import providersAdminRouter from './modules/providers/app/routes/providers.routes';
import metricsRouter from './modules/metrics/app/routes/metrics.routes';

import authRouter from './modules/auth/app/routes/auth.routes';
import subscriptionsRouter from './modules/billing/app/routes/subscriptions.routes';
import expensesRouter from './modules/expenses/app/routes/expenses.routes';

import { merchantProfileUpdateSchema } from './core/validation/schemas';
import { getMerchantProfile, updateMerchantProfile } from './modules/system/merchantAdmin';
import { getSession } from './modules/auth/domain/auth.service';
import { getLocaleJson } from './core/i18n/locales';
import { quoteDecisionLandingRouter } from './modules/system/app/routes/quoteDecisionLanding.routes';
import customerPortalRouter from './modules/system/app/routes/customerPortal.routes';
import { prisma } from './core/db/prisma';

export const app = express();

// Landings públicas (antes del JSON parser)
app.use('/pay', quoteDecisionLandingRouter);
app.use('/cliente', customerPortalRouter);

app.disable('etag');

// Stripe webhook — raw body ANTES del JSON parser
app.use('/webhooks/stripe', stripeRawBody, stripeWebhookRouter);

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(jsonError);

// Static
app.use('/invoices', express.static(invoicesDir));
app.use('/outbox', express.static(outboxDir));

const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// Rutas públicas
app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/webhooks/psp', pspWebhookRouter);
app.use('/charges', chargesRouter);
app.use('/quote', quotesRouter);
app.use('/invoice', invoiceRouter);
app.use('/recibo', receiptRouter);
app.use('/pay', payBankRouter);
app.use('/pay', payCardRouter);
app.use('/dev', devRouter);

// ===========================
// Rutas admin — requieren auth
// ===========================
app.use('/admin', requireAuth);

// GET /admin/me — perfil de sesión actual
app.get('/admin/me', async (req, res) => {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/pf_session=([^;]+)/);
  const token = match ? decodeURIComponent(match[1]) : '';
  const session = await getSession(token).catch(() => null);
  if (!session) return res.status(401).json({ error: 'not_authenticated' });

  const merchantFull = await prisma.merchant.findUnique({
    where: { id: session.merchantId },
    select: { country: true },
  });

  return res.json({
    merchantId: session.merchantId,
    name: session.merchant.name,
    plan: session.merchant.plan,
    planExpiresAt: session.merchant.planExpiresAt,
    onboardingCompleted: session.merchant.onboardingCompleted,
    locale: getLocaleJson(merchantFull?.country),
  });
});

app.use('/admin/customers',  customersAdminRouter);
app.use('/admin/quotes',     quotesAdminRouter);
app.use('/admin/invoices',   invoicesAdminRouter);
app.use('/admin/products',   productsAdminRouter);
app.use('/admin/providers',  providersAdminRouter);
app.use('/admin/metrics',    metricsRouter);
app.use('/admin/billing',    requireActivePlan, subscriptionsRouter);
app.use('/admin/expenses',   expensesRouter);

// Admin – Perfil de merchant
app.get('/admin/merchant', async (req, res, next) => {
  try {
    const merchant = await getMerchantProfile(req.merchantId);
    if (!merchant) return res.status(404).json({ error: 'merchant_not_found' });
    return res.json(merchant);
  } catch (err) { return next(err); }
});

app.put('/admin/merchant', async (req, res, next) => {
  try {
    const parsed = merchantProfileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
    }
    const updated = await updateMerchantProfile(req.merchantId, parsed.data);
    return res.json(updated);
  } catch (err) { return next(err); }
});

// Onboarding completo
app.post('/admin/onboarding/complete', async (req, res) => {
  await prisma.merchant.update({
    where: { id: req.merchantId },
    data: { onboardingCompleted: true },
  });
  return res.json({ ok: true });
});

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
