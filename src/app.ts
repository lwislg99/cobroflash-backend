import express from 'express';
import path from 'path';

import { outboxDir } from './core/storage/dirs'; // SCRUM-72: invoicesDir ya no se sirve como estático
import { jsonError } from './core/http/jsonError';
import { notFoundPageHtml } from './core/http/publicNotFound';
import { isFlagEnabled } from './core/flags';
import { requireAuth, requireActivePlan, requireRole } from './core/http/authMiddleware';
import { mountAdmin } from './core/http/adminMounts'; // SCRUM-55: red fail-closed de /admin
import { requireInternalSecret } from './core/http/internalAuth';
import { isVerifiedPlatformOwner, config } from './core/config/env';

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
import payBizumRouter from './modules/billing/app/routes/payBizum.routes'; // C1-4
import chargesAdminRouter from './modules/billing/app/routes/chargesAdmin.routes'; // C1-4
import connectRouter from './modules/payments/connect/connect.routes'; // C1-1
import {
  rawBody as stripeConnectRawBody,
  router as stripeConnectWebhookRouter,
} from './modules/payments/connect/connectWebhook.routes'; // C1-2
import mpWebhookRouter from './modules/billing/app/routes/mpWebhook.routes';
import whatsappIncomingRouter from './modules/whatsappBot/app/routes/whatsappIncoming.routes';
import botAdminRouter from './modules/whatsappBot/app/routes/botAdmin.routes';
import legalPagesRouter from './modules/system/app/routes/legalPages.routes';
import publicProfileRouter from './modules/system/app/routes/publicProfile.routes';
import jobsRouter from './modules/jobs/app/routes/jobs.routes';
import albaranesRouter from './modules/jobs/app/routes/albaranes.routes'; // SCRUM-14 (ALBARAN-1)
import maintenanceRouter from './modules/maintenance/app/routes/maintenance.routes';

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
import attachmentsRouter   from './modules/quoteRequests/app/routes/attachments.routes';
import searchRouter        from './modules/search/app/routes/search.routes';

import { merchantProfileUpdateSchema } from './core/validation/schemas';
import { getMerchantProfile, updateMerchantProfile, SlugError } from './modules/system/merchantAdmin';
import QRCode from 'qrcode'; // A14.2: QR del perfil público (PNG alta res para furgoneta/tarjeta)
import { BASE_URL } from './core/config/env';
import { getDigestPreview } from './modules/messaging/domain/weeklyDigest.service';
import { getReferralStats, redeemFreeMonth } from './modules/auth/domain/referral.service';
import { getSession } from './modules/auth/domain/auth.service';
import { getLocaleJson } from './core/i18n/locales';
import { quoteDecisionLandingRouter } from './modules/system/app/routes/quoteDecisionLanding.routes';
import customerPortalRouter from './modules/system/app/routes/customerPortal.routes';
import albaranPublicRouter from './modules/jobs/app/routes/albaranPublic.routes'; // SCRUM-49: firma remota
import { prisma } from './core/db/prisma';

export const app = express();

// SCRUM-105: defensa en profundidad barata — las páginas públicas con token en el path
// (/recibo, /cliente, /albaran, /p/:slug) cargan Google Fonts como único recurso externo;
// el default de navegadores modernos ya no debería filtrar el path completo en ese caso,
// pero la app no lo garantizaba por sí misma. Global, antes de cualquier ruta.
app.use((_req, res, next) => {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Landings públicas (antes del JSON parser)
app.use('/pay', quoteDecisionLandingRouter);
app.use('/cliente', customerPortalRouter);
// SCRUM-49: firma remota del albarán. Parser propio (la firma es un data-URI ~KB) ANTES del
// global. Autorizado por el token opaco (no auth). Superficie pública, rate-limit en el POST.
app.use('/albaran', express.json({ limit: '2mb' }), albaranPublicRouter);

app.disable('etag');

// Stripe webhook — raw body ANTES del JSON parser
app.use('/webhooks/stripe', stripeRawBody, stripeWebhookRouter);
// CONNECT-1 (C1-2): webhook SEPARADO para cuentas conectadas (account.updated
// + direct charges), con su propio signing secret. También raw body.
app.use('/webhooks/stripe-connect', stripeConnectRawBody, stripeConnectWebhookRouter);

// SCRUM-14: las fotos de albarán viajan en base64 (~5 MB → ~6,8 MB de JSON) y el
// límite global de 2 MB las cortaría. Parser propio SOLO para /admin/albaranes,
// registrado ANTES del global (body-parser marca req._body y el global lo salta).
// La auth sigue siendo la de /admin (requireAuth se monta después, antes de las rutas).
app.use('/admin/albaranes', express.json({ limit: '8mb' }));

// Parsers — guardamos el raw body de los webhooks de WhatsApp para validar firma HMAC.
// limit 2mb: el logo del merchant viaja como data-URI (~150 KB tras el resize
// client-side a 512px) en el PUT /admin/merchant; el default de 100 KB lo cortaba.
app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buf) => {
    if ((req.url || '').startsWith('/webhooks/whatsapp')) {
      (req as any).rawBody = buf;
    }
  },
}));
app.use(express.urlencoded({ extended: true }));
app.use(jsonError);

// Static
// SCRUM-72: el estático de /invoices se ELIMINA (exponía facturas y presupuestos sin auth,
// con nombres enumerables). Los PDFs viven ahora en storage/invoices, fuera de `public/`,
// y solo salen por GET /admin/invoices/:id/pdf y GET /admin/quotes/:id/pdf.
// SCRUM-96: outboxDir ya vive fuera de `public/` (storage/outbox), pero el propio MOUNT debe
// dejar de ser público en despliegues reales — igual que /dev, solo sirve para inspeccionar el
// .eml de fallback en desarrollo (el enlace "Ver .eml" de /dev/email-invoice sigue funcionando
// en local, donde NODE_ENV no es 'production'; en producción/staging desplegadas, 404 digno).
if (config.NODE_ENV !== 'production') app.use('/outbox', express.static(outboxDir));
// SCRUM-48: los PDFs de albarán NO se sirven como estático público (llevan nombre del
// cliente, dirección de la obra y firma manuscrita = datos personales, y ALB-YYYY-NNN es
// enumerable). Se sirven SIEMPRE por GET /admin/albaranes/:id/pdf (auth + tenancy).

const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// URLs limpias para políticas legales (privacidad requerida por Meta para publicar la app)
app.get('/privacidad', (_req, res) => res.sendFile(path.join(publicDir, 'privacidad.html')));
app.get('/terminos', (_req, res) => res.sendFile(path.join(publicDir, 'terminos.html')));

// V0-4: página de precios + contador REAL de plazas founding (público, sin auth)
app.get('/precios', (_req, res) => res.sendFile(path.join(publicDir, 'precios.html')));
app.get('/public/founding-status', async (_req, res) => {
  try {
    const { getFoundingStatus } = await import('./modules/billing/domain/founding');
    return res.json(await getFoundingStatus());
  } catch (err) {
    console.error('[GET /public/founding-status]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Rutas públicas
// SCRUM-45 (C): versión del build corriendo — la sondea el dashboard para avisar
// "hay versión nueva" en pestañas abiertas durante un deploy. Sin caché: la gracia
// es detectar el cambio (el SW también la deja pasar sin cachear).
// SCRUM-224: dedup en memoria del proceso — un cliente rancio sondea cada 90 s; sin esto son ~40
// líneas/hora por cliente y el log se vuelve ruido justo cuando lo miras. Clave = (build, estado SW).
// Si el proceso reinicia y repite una línea, da igual. NOTA: /version es PÚBLICO (requireAuth entra en
// :196), así que aquí NO hay req.merchantId — se identifica por el BUILD rancio, que es lo que
// correlaciona con el deploy; el merchant no se puede afirmar sin auth y no se inventa.
const swStaleVistos = new Set<string>();
app.get('/version', (req, res) => {
  res.set('Cache-Control', 'no-store');
  // SCRUM-224: instrumentación de SW rancio (la mitad que faltó SCRUM-45/46/hoy: la evidencia se
  // destruía al desregistrar el SW). El cliente adjunta su build en curso (?b) y el CACHE_NAME de su
  // SW (?sw; 'sin-sw' si no hay SW controlando). Si su build != el desplegado, corre código viejo: se
  // registra UNA vez por (build, sw). Sin IP: es dato personal y el build basta para el diagnóstico.
  const clientBuild = typeof req.query.b === 'string' ? req.query.b : null;
  const swCache = typeof req.query.sw === 'string' ? req.query.sw : 'sin-sw';
  if (clientBuild && clientBuild !== config.BUILD_ID) {
    const clave = `${clientBuild}|${swCache}`;
    if (!swStaleVistos.has(clave)) {
      swStaleVistos.add(clave);
      console.warn('[SW-STALE]', JSON.stringify({ clientBuild, swCache, serverBuild: config.BUILD_ID }));
    }
  }
  res.json({ version: config.BUILD_ID });
});
app.use('/health', healthRouter);
app.use('/auth', authRouter);
// P0-SEC-1/3: estos dos son endpoints INTERNOS (self-call desde los webhooks de pago y
// desde invoiceWhatsApp). El guard exige el secreto interno → el exterior recibe 404.
// Antes eran públicos: permitían marcar cobros como pagados y leer cobros de otros merchants.
app.use('/webhooks/psp', requireInternalSecret, pspWebhookRouter);
app.use('/charges', requireInternalSecret, chargesRouter);
// Crear presupuesto requiere prueba activa (bloqueo suave tras fin de trial).
// El resto de /quote (accept/reject del cliente) sigue abierto.
app.post('/quote/create', requireAuth, requireActivePlan); // P1-SEC-5: exige login + tenancy
app.use('/quote', quotesRouter);
// P0-SEC-4: el router /invoice (legacy n8n: /issue + /:id/paid-webhook) MUTABA
// facturas (marcar PAGADA) sin auth, firma ni tenancy. Sin llamadas internas →
// se cierra tras el secreto interno (externo → 404), igual que /charges y /webhooks/psp.
app.use('/invoice', requireInternalSecret, invoiceRouter);
app.use('/recibo', receiptRouter);
app.use('/pay', payInvoiceRouter);
app.use('/pay', payBankRouter);
app.use('/pay', payCardRouter);
app.use('/pay', payBizumRouter); // C1-4: Bizum manual asistido
app.use('/pay', payMpRouter);
app.use('/webhooks/mp', mpWebhookRouter);
app.use('/webhooks/whatsapp', whatsappIncomingRouter);
app.use('/legal', legalPagesRouter); // A10.1: páginas legales públicas (alcance beta)
app.use('/p', publicProfileRouter);  // A14.1 (PERFIL-1): perfil público /p/:slug — flag OFF → 404 digno
// P0-SEC-2: el router /dev SOLO simula pagos/facturas — jamás en producción.
if (config.NODE_ENV !== 'production') app.use('/dev', devRouter);

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
    select: { country: true, logoUrl: true },
  });

  const userRole = session.teamMember ? session.teamMember.role : 'admin';
  const userName = session.teamMember ? session.teamMember.name : session.merchant.name;

  // Cuentas owner: se presentan como Pro activo y sin caducidad para que el front
  // no muestre el paywall ni redirija a #plans. SCRUM-102: dos factores (email en
  // OWNER_EMAILS + Merchant.isPlatformOwner en BD), no solo la env var.
  const owner = isVerifiedPlatformOwner(session.merchant);

  return res.json({
    merchantId: session.merchantId,
    name: userName,
    merchantName: session.merchant.name,
    logoUrl: merchantFull?.logoUrl ?? null, // para pintar el logo del negocio en el topbar
    plan: owner ? 'pro' : session.merchant.plan,
    planExpiresAt: owner ? null : session.merchant.planExpiresAt,
    onboardingCompleted: session.merchant.onboardingCompleted,
    locale: getLocaleJson(merchantFull?.country),
    userRole,
    teamMemberId: session.teamMemberId ?? null,
    isOwner: !session.teamMemberId,
    // VZ-1 (VOZ-1): el micro de dictado solo se pinta con el flag activo
    voiceEnabled: isFlagEnabled('VOICE_QUOTE_ENABLED', {
      merchant: { id: session.merchantId, country: merchantFull?.country },
    }),
    // SCRUM-71 (VOZ-ALB): flag PROPIO, no el del presupuesto. El dictado en albarán tiene otro
    // riesgo —el documento lo firma el cliente y desde `emitido` se congela— y se apaga aparte.
    voiceAlbaranEnabled: isFlagEnabled('VOICE_ALBARAN_ENABLED', {
      merchant: { id: session.merchantId, country: merchantFull?.country },
    }),
    // A10.2 (Parte L): estado de la suscripción para el banner past_due
    subscriptionStatus: owner ? 'active' : ((session.merchant as any).subscriptionStatus ?? null),
  });
});

// SCRUM-55: TODO router bajo /admin se monta con mountAdmin (no con app.use). El
// helper monta y registra a la vez para que la red fail-closed pueda enumerar las
// rutas — Express 5 no conserva el prefijo del montaje. Ver core/http/adminMounts.ts.
mountAdmin(app, '/admin/customers',  customersAdminRouter);
// Enviar presupuesto por WhatsApp requiere prueba activa; ver/editar sigue abierto.
app.post('/admin/quotes/:id/send-whatsapp', requireActivePlan);
mountAdmin(app, '/admin/quotes',     quotesAdminRouter);
mountAdmin(app, '/admin/invoices',   invoicesAdminRouter);
mountAdmin(app, '/admin/products',   productsAdminRouter);
mountAdmin(app, '/admin/providers',  providersAdminRouter);
mountAdmin(app, '/admin/metrics',    metricsRouter);
mountAdmin(app, '/admin/expenses',   expensesRouter);
mountAdmin(app, '/admin/bot',        botAdminRouter); // A8.3: handoffs pendientes del bot
mountAdmin(app, '/admin/jobs',       jobsRouter);    // A13 (JOB-1): trabajos
mountAdmin(app, '/admin/albaranes',  albaranesRouter); // SCRUM-14 (ALBARAN-1): partes de trabajo NO fiscales
mountAdmin(app, '/admin/maintenance', maintenanceRouter); // A15 (MANT-1): tras flag, 404 sin él

// Rutas solo para admin
// Billing SIEMPRE accesible (es donde se paga): no exigir prueba activa aquí,
// de lo contrario un trial caducado no podría llegar a suscribirse (callejón sin salida).
mountAdmin(app, '/admin/billing',    requireRole('admin'), subscriptionsRouter);
mountAdmin(app, '/admin/team',       requireRole('admin'), teamRouter);
mountAdmin(app, '/admin/connect',    requireRole('admin'), connectRouter); // C1-1: onboarding Express
// SCRUM-55: el gate de rol va AQUÍ, en el montaje. Antes el comentario decía
// "multi-tenant en la ruta" — eso es TENANCY, no ROL: confirmar un Bizum marca un
// cobro como pagado y dispara la cadena post-pago, y S1 dice "marcar pagado ❌ Técnico".
mountAdmin(app, '/admin/charges',    requireRole('admin'), chargesAdminRouter); // C1-4
mountAdmin(app, '/admin/ai',         aiRouter);

// Preview del digest semanal (A1.3: solo lo usa Configuración → solo admin)
app.get('/admin/digest/preview', requireRole('admin'), async (req, res) => {
  try {
    const preview = await getDigestPreview(req.merchantId);
    return res.json(preview);
  } catch (err) {
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Referidos — código, link y estadísticas (A1.3: vive en Configuración → solo admin)
app.get('/admin/referral', requireRole('admin'), async (req, res) => {
  try {
    const stats = await getReferralStats(req.merchantId);
    return res.json(stats);
  } catch (err) {
    console.error('[GET /admin/referral]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Canje manual de un mes gratis ganado por referidos (solo admin)
// SCRUM-55: el gate era `if (req.userRole !== 'admin')` inline. Protegía igual, pero
// era INVISIBLE para cualquier enumeración: la red no puede ver un if dentro de un
// handler. Mismo comportamiento, ahora declarado.
app.post('/admin/referral/redeem', requireRole('admin'), async (req, res) => {
  try {
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
// SCRUM-25 (S1): exportar es acción de ADMIN — el Técnico no se lleva la base de datos
// del negocio. El gate va aquí, en el router entero (antes cada ruta iba suelta y los
// CSVs de clientes/facturas/presupuestos/gastos quedaban abiertos al Operario).
mountAdmin(app, '/admin/exports',    requireRole('admin'), exportsRouter);
// SCRUM-55: /admin/reports entero es Admin — los tres informes son economía del
// negocio, no trabajo de campo: /pl (ingresos·gastos·beneficio), /x2 (cobros por
// método y pendiente por antigüedad) y /vat (IVA trimestral = "datos fiscales",
// ❌ explícito en S1). Gate en el MONTAJE, no ruta a ruta: el dato del recon es que
// los 4 routers gateados en el montaje tenían 0 agujeros, y los que gatean ruta a
// ruta los tenían justo en las rutas añadidas después.
mountAdmin(app, '/admin/reports',    requireRole('admin'), reportsRouter);
mountAdmin(app, '/admin/templates',     templatesRouter);
mountAdmin(app, '/admin/quote-requests', quoteRequestsRouter);
mountAdmin(app, '/admin/attachments',    attachmentsRouter); // MEDIA-1 (FASE 3): servir fotos adjuntas
mountAdmin(app, '/admin/search',         searchRouter);

// Admin – Perfil de merchant (lectura libre, escritura solo admin)
app.get('/admin/merchant', async (req, res, next) => {
  try {
    const merchant = await getMerchantProfile(req.merchantId);
    if (!merchant) return res.status(404).json({ error: 'merchant_not_found' });
    // A1.3: rol técnico → perfil REDUCIDO. Las vistas comunes solo necesitan
    // id/nombre/moneda/logo; lo fiscal y bancario (NIF, IBAN, CLABE, serie,
    // umbral de aprobación, prefs de email, reseñas) es solo del admin.
    if (req.userRole !== 'admin') {
      const { id, name, legalName, trade, defaultCurrency, logoUrl, whatsappPhone, country, brandColor, brandAccentColor } = merchant;
      return res.json({ id, name, legalName, trade, defaultCurrency, logoUrl, whatsappPhone, country, brandColor, brandAccentColor });
    }
    // A14.1: estado EFECTIVO del flag del perfil público (merchant > env > default)
    // para que Configuración pinte "activa/aún no activa" sin duplicar la lógica.
    const publicProfileEnabled = isFlagEnabled('PUBLIC_PROFILE_ENABLED', {
      merchant: {
        id: merchant.id,
        country: merchant.country,
        flags: (merchant.flags as Record<string, unknown> | null) ?? null,
      },
    });
    return res.json({ ...merchant, publicProfileEnabled });
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
  } catch (err) {
    // A14.1: reglas del slug del perfil público → error humano, no 500
    if (err instanceof SlugError) {
      const status = err.code === 'slug_taken' ? 409 : err.code === 'slug_cooldown' ? 429 : 400;
      return res.status(status).json({
        error: err.code,
        message: err.message,
        ...(err.nextChangeAt ? { next_change_at: err.nextChangeAt.toISOString() } : {}),
      });
    }
    return next(err);
  }
});

// A14.2 (PERFIL-1): QR del perfil público en PNG alta resolución (1024px) para
// imprimir en furgoneta/tarjeta. Apunta a /p/:slug?src=qr → el registro que nazca
// de ese QR queda atribuido (acquisitionSource='qr', loop V0-3).
app.get('/admin/merchant/public-profile-qr', requireRole('admin'), async (req, res, next) => {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { slug: true },
    });
    if (!merchant?.slug) {
      return res.status(400).json({ error: 'no_slug', message: 'Primero elige la dirección de tu página.' });
    }
    const png = await QRCode.toBuffer(`${BASE_URL}/p/${merchant.slug}?src=qr`, {
      type: 'png', width: 1024, margin: 2, errorCorrectionLevel: 'M',
    });
    res.setHeader('Content-Disposition', `attachment; filename="yaqu-qr-${merchant.slug}.png"`);
    return res.type('png').send(png);
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

// A6.5: 404 con marca para navegadores (GET que acepta HTML); JSON para la API.
app.use((req, res) => {
  if (req.method === 'GET' && req.accepts(['json', 'html']) === 'html') {
    return res.status(404).type('html').send(notFoundPageHtml());
  }
  return res.status(404).json({ error: 'not_found' });
});
