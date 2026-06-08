import express from 'express';
import path from 'path';

import { invoicesDir, outboxDir } from './core/storage/dirs';
import { jsonError } from './core/http/jsonError';
import { requireAuth, requireActivePlan, requireRole } from './core/http/authMiddleware';
import { isOwnerEmail } from './core/config/env';

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
import payMpRouter   from './modules/billing/app/routes/payMp.routes';
import payInvoiceRouter from './modules/billing/app/routes/payInvoice.routes';
import mpWebhookRouter from './modules/billing/app/routes/mpWebhook.routes';
import whatsappIncomingRouter from './modules/whatsappBot/app/routes/whatsappIncoming.routes';

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
import teamRouter from './modules/team/app/routes/team.routes';
import aiRouter      from './modules/ai/app/routes/ai.routes';
import exportsRouter   from './modules/exports/app/routes/exports.routes';
import reportsRouter   from './modules/reports/app/routes/reports.routes';
import templatesRouter     from './modules/templates/app/routes/templates.routes';
import quoteRequestsRouter from './modules/quoteRequests/app/routes/quoteRequests.routes';
import searchRouter        from './modules/search/app/routes/search.routes';

import { merchantProfileUpdateSchema } from './core/validation/schemas';
import { getMerchantProfile, updateMerchantProfile } from './modules/system/merchantAdmin';
import { getDigestPreview } from './modules/messaging/domain/weeklyDigest.service';
import { getReferralStats, redeemFreeMonth } from './modules/auth/domain/referral.service';
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

// Parsers — guardamos el raw body de los webhooks de WhatsApp para validar firma HMAC
app.use(express.json({
  verify: (req, _res, buf) => {
    if ((req.url || '').startsWith('/webhooks/whatsapp')) {
      (req as any).rawBody = buf;
    }
  },
}));
app.use(express.urlencoded({ extended: true }));
app.use(jsonError);

// Static
app.use('/invoices', express.static(invoicesDir));
app.use('/outbox', express.static(outboxDir));

const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// URLs limpias para políticas legales (privacidad requerida por Meta para publicar la app)
app.get('/privacidad', (_req, res) => res.sendFile(path.join(publicDir, 'privacidad.html')));
app.get('/terminos', (_req, res) => res.sendFile(path.join(publicDir, 'terminos.html')));

// Rutas públicas
app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/webhooks/psp', pspWebhookRouter);
app.use('/charges', chargesRouter);
// Crear presupuesto requiere prueba activa (bloqueo suave tras fin de trial).
// El resto de /quote (accept/reject del cliente) sigue abierto.
app.post('/quote/create', requireActivePlan);
app.use('/quote', quotesRouter);
app.use('/invoice', invoiceRouter);
app.use('/recibo', receiptRouter);
app.use('/pay', payInvoiceRouter);
app.use('/pay', payBankRouter);
app.use('/pay', payCardRouter);
app.use('/pay', payMpRouter);
app.use('/webhooks/mp', mpWebhookRouter);
app.use('/webhooks/whatsapp', whatsappIncomingRouter);
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

  const userRole = session.teamMember ? session.teamMember.role : 'admin';
  const userName = session.teamMember ? session.teamMember.name : session.merchant.name;

  // Cuentas owner (OWNER_EMAILS): se presentan como Pro activo y sin caducidad
  // para que el front no muestre el paywall ni redirija a #plans.
  const owner = isOwnerEmail(session.merchant.email);

  return res.json({
    merchantId: session.merchantId,
    name: userName,
    merchantName: session.merchant.name,
    plan: owner ? 'pro' : session.merchant.plan,
    planExpiresAt: owner ? null : session.merchant.planExpiresAt,
    onboardingCompleted: session.merchant.onboardingCompleted,
    locale: getLocaleJson(merchantFull?.country),
    userRole,
    teamMemberId: session.teamMemberId ?? null,
    isOwner: !session.teamMemberId,
  });
});

app.use('/admin/customers',  customersAdminRouter);
// Enviar presupuesto por WhatsApp requiere prueba activa; ver/editar sigue abierto.
app.post('/admin/quotes/:id/send-whatsapp', requireActivePlan);
app.use('/admin/quotes',     quotesAdminRouter);
app.use('/admin/invoices',   invoicesAdminRouter);
app.use('/admin/products',   productsAdminRouter);
app.use('/admin/providers',  providersAdminRouter);
app.use('/admin/metrics',    metricsRouter);
app.use('/admin/expenses',   expensesRouter);

// Rutas solo para admin
// Billing SIEMPRE accesible (es donde se paga): no exigir prueba activa aquí,
// de lo contrario un trial caducado no podría llegar a suscribirse (callejón sin salida).
app.use('/admin/billing',    requireRole('admin'), subscriptionsRouter);
app.use('/admin/team',       requireRole('admin'), teamRouter);
app.use('/admin/ai',         aiRouter);

// Preview del digest semanal
app.get('/admin/digest/preview', async (req, res) => {
  try {
    const preview = await getDigestPreview(req.merchantId);
    return res.json(preview);
  } catch (err) {
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Referidos — código, link y estadísticas
app.get('/admin/referral', async (req, res) => {
  try {
    const stats = await getReferralStats(req.merchantId);
    return res.json(stats);
  } catch (err) {
    console.error('[GET /admin/referral]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Canje manual de un mes gratis ganado por referidos (solo admin)
app.post('/admin/referral/redeem', async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ error: 'forbidden', required_role: 'admin' });
    }
    const result = await redeemFreeMonth(req.merchantId);
    if (!result.ok) {
      return res.status(result.reason === 'no_credit' ? 409 : 400).json({ error: result.reason || 'redeem_failed' });
    }
    return res.json(result);
  } catch (err) {
    console.error('[POST /admin/referral/redeem]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});
app.use('/admin/exports',    exportsRouter);
app.use('/admin/reports',    reportsRouter);
app.use('/admin/templates',     templatesRouter);
app.use('/admin/quote-requests', quoteRequestsRouter);
app.use('/admin/search',         searchRouter);

// Admin – Perfil de merchant (lectura libre, escritura solo admin)
app.get('/admin/merchant', async (req, res, next) => {
  try {
    const merchant = await getMerchantProfile(req.merchantId);
    if (!merchant) return res.status(404).json({ error: 'merchant_not_found' });
    return res.json(merchant);
  } catch (err) { return next(err); }
});

app.put('/admin/merchant', requireRole('admin'), async (req, res, next) => {
  try {
    const parsed = merchantProfileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
    }
    const updated = await updateMerchantProfile(req.merchantId, parsed.data);
    return res.json(updated);
  } catch (err) { return next(err); }
});

// Onboarding completo — solo propietario (admin)
app.post('/admin/onboarding/complete', requireRole('admin'), async (req, res) => {
  await prisma.merchant.update({
    where: { id: req.merchantId },
    data: { onboardingCompleted: true },
  });
  return res.json({ ok: true });
});

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
