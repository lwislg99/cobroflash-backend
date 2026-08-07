import express from 'express';
import path from 'path';
import fs from 'fs'; // SCRUM-224b: leer UNA vez el HTML del dashboard para sellarle el build

import { outboxDir } from './core/storage/dirs'; // SCRUM-72: invoicesDir ya no se sirve como estático
import { jsonError } from './core/http/jsonError';
import { notFoundPageHtml } from './core/http/publicNotFound';
import { isFlagEnabled } from './core/flags';
import { modoDocumentoSuelto } from './modules/invoicing/domain/facturaSuelta'; // SCRUM-289 (A0.3) · SCRUM-346 (A0.5)
import { modoEmisionVisible } from './modules/invoicing/domain/modoVisible'; // SCRUM-298 (A8)
// SCRUM-300 (C5): microcopy del albarán servida al dashboard vanilla desde su fuente única.
import { ALBARAN_AYUDAS, ALBARAN_ROTULOS, firmanteCalidadOpciones } from './modules/jobs/domain/albaranFirmante';
import { requireAuth, requireActivePlan, requireRole } from './core/http/authMiddleware';
import { mountAdmin } from './core/http/adminMounts'; // SCRUM-55: red fail-closed de /admin
import { requireInternalSecret } from './core/http/internalAuth';
// SCRUM-274: huella de contenido en las referencias del dashboard (sin build ni bundler)
import {
  sellarReferencias, crearHuellas, PARAM_HUELLA, CACHE_CON_HUELLA,
} from './core/http/huellaEstaticos';
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
import libroRegistroRouter from './modules/invoicing/app/routes/libroRegistro.routes'; // SCRUM-296 (A6): libro de registro, SOLO LECTURA
import librosAeatRouter from './modules/fiscal/librosAeat/librosAeat.routes'; // SCRUM-325 (E4): el libro de A6, por periodo y en CSV. SOLO LECTURA
import modelo303Router from './modules/fiscal/modelo303/modelo303.routes'; // SCRUM-295 (A5): modelo 303, SOLO LECTURA
import evidenciasRouter from './modules/fiscal/evidencias/evidencias.routes'; // SCRUM-297 (A7): paquete de evidencias, SOLO LECTURA
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
// SCRUM-314 (D3): el barrido derivado del demo y quién es el demo.
import { barridoDemo } from './modules/system/domain/barridoDemo';
import { isDemoMerchant } from './modules/invoicing/domain/emission.service';
import { getMerchantProfile, updateMerchantProfile, SlugError, SerieError } from './modules/system/merchantAdmin';
// SCRUM-313 (D2): el arranque de serie usa las piezas puras de A4 y la vista previa que
// IMPORTA a quien decide (regla 38: leer ese camino no es STOP, modificarlo si).
import { TIT_SERIE_YA_EMITIDA, MSG_SERIE_YA_EMITIDA } from './modules/system/merchantAdmin';
import { arranqueDeSerie, numerosDeLaSerie, bloqueoCambioDeSerie, invalidPrefijoSerie, debeOfrecerArranqueDeSerie, resumenSerieEmitida } from './core/validation/fiscalInput';
import { vistaPreviaSerie } from './modules/invoicing/domain/vistaPreviaSerie';
import { SERIE_LOCK_NS } from './modules/invoicing/domain/invoiceNumber.service';
import QRCode from 'qrcode'; // A14.2: QR del perfil público (PNG alta res para furgoneta/tarjeta)
import { resolverOpcionesQr, ErrorQr } from './modules/system/domain/qrPagina.service'; // SCRUM-230
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

// ── SCRUM-224b · EL SELLO DE BUILD DEL DASHBOARD ─────────────────────────────────────────
//
// El aviso de «hay versión nueva» fijaba su línea base con la PRIMERA lectura buena de
// `/version`. Si esa lectura fallaba —y lo que más probablemente la hace fallar es un deploy EN
// VUELO, o sea justo cuando sale un hotfix—, la base la fijaba la siguiente lectura, que ya
// traía el BUILD_ID NUEVO. Desde ahí el aviso NO SALÍA NUNCA y el usuario se quedaba con el JS
// viejo sin que nada se lo dijera. SCRUM-224 estrechó la ventana de 90 s a 5 s; esto la ELIMINA:
// la página deja de INFERIR con qué build la sirvieron y pasa a SABERLO.
//
// `no-store` NO es opcional: un HTML cacheado con un sello viejo es PEOR que no sellar — la app
// creería estar en una versión que no es y el aviso volvería a mentir por otro camino. El coste
// aceptado es perder ETag/Last-Modified en ESTE único documento; el resto de estáticos sigue
// con su revalidación normal.
const MARCADOR_BUILD = '__' + 'BUILD_ID' + '__'; // partido a propósito: ver la nota de abajo
// SCRUM-274 · UNA sola instancia, compartida por el sellado del HTML y por `setHeaders`. Si
// fueran dos, cada una tendría su memoria y podrían calcular huellas distintas para el mismo
// fichero — que es justo la clase de defecto (dos cosas que deben coincidir y nada las ata)
// que este proyecto lleva la semana desmontando.
const huellaDeFichero = crearHuellas(fs);
const dashboardHtmlSellado = (() => {
  let cache: string | null = null; // memoizado: se lee del disco UNA vez, no en cada petición
  return (): string => {
    if (cache === null) {
      // `replaceAll`, no `replace`: con `replace` solo cae la PRIMERA aparición, y eso ya mordió
      // aquí — el comentario que explicaba el marcador dentro del HTML contenía el marcador, así
      // que se sustituyó la prosa y el <meta> de verdad se quedó SIN sellar. Es la trampa de
      // autorreferencia de _guard-texto.mjs, esta vez sobre una sustitución en vez de un grep.
      // Por eso el marcador se construye partido: escribirlo entero aquí lo volvería a activar.
      // SCRUM-274 · y AQUÍ se sellan también las REFERENCIAS, en el mismo sitio y de una vez.
      // El sello de build y la huella de los estáticos son la misma operación —transformar el
      // HTML una sola vez al arrancar— y separarlas habría significado leer el fichero dos
      // veces o memoizar dos cosas. El detalle de por qué `?v=` y no un bundler, en
      // `core/http/huellaEstaticos.ts`.
      cache = sellarReferencias(
        fs
          .readFileSync(path.join(publicDir, 'dashboard', 'index.html'), 'utf8')
          .replaceAll(MARCADOR_BUILD, config.BUILD_ID),
        { publicDir, baseUrl: '/dashboard/', huellaDeFichero },
      );
    }
    return cache;
  };
})();

app.get(['/dashboard', '/dashboard/', '/dashboard/index.html'], (req, res) => {
  // ⚠️ EL 301 SE REPRODUCE A MANO, y hace falta: Express con `strict routing` desactivado (el
  // default) casa `/dashboard` y `/dashboard/` con el MISMO patrón, así que registrar la ruta se
  // come la redirección que hoy hace `express.static`. Medido: antes del cambio `/dashboard`
  // devolvía 301 → /dashboard/, y sin esta línea pasó a devolver 200 — la forma de la URL
  // cambiada para todo el mundo sin que nadie lo pidiera.
  if (!req.path.endsWith('/') && !req.path.endsWith('index.html')) {
    return res.redirect(301, '/dashboard/');
  }
  res.set('Cache-Control', 'no-store');
  return res.type('html').send(dashboardHtmlSellado());
});

// SCRUM-274 · `immutable` SOLO si la URL trae una huella que CUADRA con el fichero servido.
//
// No basta con «trae `?v=` algo»: eso marcaría inmutable cualquier URL con una query inventada.
// Se compara contra la huella real del fichero, así que la promesa «esta URL nunca cambia de
// contenido» es cierta por construcción y no por confianza.
//
// Si NO cuadra —una huella vieja, o un fichero editado en dev con el HTML ya memoizado— no se
// pone nada y manda el default de `express.static` (`max-age=0`), que es exactamente el
// comportamiento anterior a este ticket. El modo de fallo de esto es «vuelve a como estaba»,
// nunca «sirve contenido viejo para siempre».
app.use(
  express.static(publicDir, {
    setHeaders: (res, rutaAbs, stat) => {
      const pedida = (res.req as any)?.query?.[PARAM_HUELLA];
      if (typeof pedida !== 'string' || !pedida) return;
      const real = huellaDeFichero(rutaAbs, stat as { mtimeMs: number });
      if (real && real === pedida) res.setHeader('Cache-Control', CACHE_CON_HUELLA);
    },
  }),
);

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
app.get('/version', (_req, res) => {
  res.set('Cache-Control', 'no-store');
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
    // SCRUM-289: `email` y `flags` los necesita `modoDocumentoSuelto` — el modo de emisión
    // (V0-0) se resuelve con merchant demo (por email) + flag por merchant, no solo con el país.
    select: { country: true, logoUrl: true, email: true, flags: true, invoiceSeriesYear: true },
  });

  // SCRUM-298 (A8) · UN SOLO objeto para las dos preguntas de modo. `documentoSuelto` (qué se
  // puede crear suelto) y `modoEmision` (en qué modo se emite) son la MISMA verdad mirada desde
  // dos sitios: construirlo dos veces sería dos lecturas que pueden divergir, y entonces el botón
  // que se pinta y el modo que se enseña dirían cosas distintas.
  const merchantParaModo = {
    id: session.merchantId,
    email: merchantFull?.email ?? null,
    country: merchantFull?.country ?? null,
    flags: merchantFull?.flags,
  };

  // SCRUM-313 (D2) · LA PUERTA DE ULTIMA OPORTUNIDAD. Se lee aqui porque el veredicto tiene que
  // viajar YA RESUELTO: si la pantalla reimplementara la regla habria dos criterios sobre cuando
  // se puede tocar la numeracion, y el del navegador seria el facil de equivocar.
  const anioSerie = new Date().getFullYear();
  const facturasDelAnio = await prisma.invoice.findMany({
    where: { merchantId: session.merchantId, number: { startsWith: `${anioSerie}-` } },
    select: { number: true },
  });
  // Una sola vez: la comparten la puerta y el bloqueo del campo (ver abajo).
  const deLaSerieDelAnio = numerosDeLaSerie(facturasDelAnio.map((f) => f.number), anioSerie);

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
    // SCRUM-402: si Bizum manual está APAGADO, el botón «Confirmar Bizum recibido» no puede
    // pintarse — hoy se pinta como acción PRIMARIA de las facturas `pending` con cobro en vuelo,
    // y al segundo toque —después de enseñar importe y nombre del cliente— recibe un 409
    // `bizum_disabled` (`chargesAdmin.routes.ts:29`). El veredicto lo da el SERVIDOR, que es
    // quien tiene la bandera: el navegador no la reimplementa, la recibe. Mismo criterio que
    // `documentoSuelto` y `modoEmision` — dos sitios decidiendo lo mismo acaban discrepando.
    bizumManualEnabled: isFlagEnabled('BIZUM_MANUAL_ENABLED', {
      merchant: { id: session.merchantId, country: merchantFull?.country },
    }),
    // SCRUM-289 (A0.3): el botón «Nueva factura» solo existe cuando lo que se va a crear ES una
    // factura. El veredicto se calcula AQUÍ, con la MISMA función que gatea `POST /admin/invoices`
    // — el navegador no reimplementa la regla, la recibe. Dos copias del criterio es cómo se llega
    // a que el back acepte lo que el front esconde.
    // SCRUM-346 (A0.5): viaja el VEREDICTO de tres valores, no un booleano. Sustituye a
    // `facturaSueltaDisponible` en vez de convivir con él: dos campos del mismo hecho acaban
    // divergiendo, y entonces el botón que se pinta y el documento que sale dicen cosas distintas.
    documentoSuelto: modoDocumentoSuelto(merchantParaModo),
    // SCRUM-298 (A8): EL MODO DE EMISIÓN, VISIBLE. Hasta hoy `getEmissionMode` no llegaba ni una
    // vez al navegador (medido: cero consumidores en `public/`), así que dos estados que producen
    // documentos DISTINTOS se veían exactamente igual en pantalla.
    //
    // `null` cuando no se sabe, y la pantalla no pinta nada: enseñar el modo equivocado es peor
    // que no enseñar ninguno. NO se cae a un modo por defecto.
    //
    // Los dos campos salen del MISMO objeto y de la MISMA función de modo — `documentoSuelto` es
    // un derivado de éste, no una segunda opinión. Con dos lecturas distintas, el botón que se
    // pinta y el modo que se enseña podrían contradecirse.
    modoEmision: modoEmisionVisible(merchantParaModo),
    // SCRUM-300 (C5): las SEIS ranuras de «en calidad de qué», sus rótulos y sus ayudas se
    // SIRVEN, no se copian. El dashboard es vanilla y no puede importar el módulo de dominio, y
    // una segunda copia de una microcopy que acaba en un juzgado es exactamente cómo divergen
    // dos textos en silencio. Mismo criterio, escrito, que SCRUM-289: el navegador la recibe.
    albaranFirmanteOpciones: firmanteCalidadOpciones(),
    albaranRotulos: ALBARAN_ROTULOS,
    albaranAyudas: ALBARAN_AYUDAS,
    // A10.2 (Parte L): estado de la suscripción para el banner past_due
    subscriptionStatus: owner ? 'active' : ((session.merchant as any).subscriptionStatus ?? null),
    // SCRUM-313 (D2): ¿todavia se le puede preguntar por su numeracion? Mismo patron que la
    // factura suelta -- veredicto del servidor, no regla en el navegador.
    // ⚠️ `deLaSerieDelAnio` se calcula UNA vez arriba y lo comparten los dos campos: si cada uno
    // llamara a `numerosDeLaSerie` por su cuenta, un día divergirían y la puerta y el bloqueo
    // estarían mirando poblaciones distintas.
    puertaSerieDisponible: debeOfrecerArranqueDeSerie({
      invoiceSeriesYear: merchantFull?.invoiceSeriesYear ?? null,
      año: anioSerie,
      numerosDeLaSerie: deLaSerieDelAnio,
    }),
    // SCRUM-D1: por qué NO se puede tocar la serie, cuando no se puede. `puertaSerieDisponible`
    // es `false` por DOS motivos distintos —ya emitió, o ya contestó este año— y solo el primero
    // bloquea el campo. Sin esto la pantalla tendría que adivinar cuál de los dos es, que es
    // recalcular la regla en el navegador por la puerta de atrás.
    serieEmitida: resumenSerieEmitida(deLaSerieDelAnio),
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
// SCRUM-296 (A6): libro de facturas emitidas. ADMIN-ONLY, el default de S1 y aquí además el
// correcto por contenido: es la facturación entera del negocio, no trabajo de campo del Operario.
mountAdmin(app, '/admin/libro-registro', requireRole('admin'), libroRegistroRouter);
// SCRUM-325 (E4): admin-only como el de A6 y como todo `/admin/exports` — un libro lleva el NIF
// del emisor y el de cada cliente, así que no es material de Operario.
mountAdmin(app, '/admin/libros', requireRole('admin'), librosAeatRouter);
// SCRUM-295 (A5): el 303 del trimestre. Admin-only por el mismo motivo que el libro: es la
// declaración fiscal del negocio entero, no trabajo de campo del Operario.
mountAdmin(app, '/admin/modelo-303', requireRole('admin'), modelo303Router);
// SCRUM-297 (A7): el paquete que demuestra lo declarado. Admin-only: son las pruebas fiscales
// del negocio entero, no trabajo de campo del Operario.
mountAdmin(app, '/admin/evidencias.zip', requireRole('admin'), evidenciasRouter);
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
    // SCRUM-291 (A4): cambiar la serie con facturas ya emitidas se NIEGA, y se dice con cuántas
    // y hasta qué número. Quien lo intenta está haciendo algo legítimo de su negocio: merece
    // saber exactamente qué se lo impide, no un error genérico.
    if (err instanceof SerieError) {
      return res.status(409).json({ error: err.code, message: err.message, ...err.detalle });
    }
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

// POST /admin/datos-ejemplo/eliminar — SCRUM-314 (D3): el botón «Eliminar datos de ejemplo».
//
// SOLO PARA LA CUENTA DEMO, y no es una cautela: es lo único que hace verdadero el rótulo.
// Medido al construirlo — `registerMerchant` (auth.service.ts) crea ÚNICAMENTE la fila del
// merchant, y no existe marca por fila que distinga un dato sembrado de uno real (censo de
// SCRUM-262). Así que en una cuenta de verdad no hay «datos de ejemplo» que borrar: un botón con
// ese rótulo borraría datos REALES bajo una etiqueta que dice lo contrario. Por eso el front no
// lo pinta fuera del demo y aquí se rechaza igualmente — la puerta se cierra por los dos lados.
//
// El barrido es el DERIVADO del schema (SCRUM-314, primera mitad): cubre los 21 modelos con
// `merchantId` y hereda el guard de SCRUM-172/192, así que no puede volver a quedarse corto.
app.post('/admin/datos-ejemplo/eliminar', requireRole('admin'), async (req, res, next) => {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { id: true, email: true },
    });
    if (!merchant) return res.status(404).json({ error: 'merchant_not_found' });

    // Sin `message`: esta rama NO es alcanzable desde la interfaz (el botón solo se pinta en el
    // demo), así que no hay copy aprobado que poner y no se inventa uno (regla 30). Queda
    // declarado en `docs/master/SCRUM-314.md`.
    if (!isDemoMerchant(merchant)) return res.status(409).json({ error: 'no_es_cuenta_demo' });

    const { porModelo } = await barridoDemo(prisma, merchant.id);

    // Un modelo que no se pudo barrer queda en `null` — «no se pudo mirar» no es «no había
    // nada». Se devuelve la lista para que la interfaz pueda DECIRLO: una cuenta medio limpia
    // que se anuncia como limpia es el fallo mudo que este ticket existe para evitar.
    const noBarridos = Object.entries(porModelo)
      .filter(([, n]) => n === null)
      .map(([modelo]) => modelo);

    return res.json({
      ok: noBarridos.length === 0,
      clientes: porModelo.customer ?? 0,
      presupuestos: porModelo.quote ?? 0,
      facturas: porModelo.invoice ?? 0,
      noBarridos,
    });
  } catch (err) { return next(err); }
});


// A14.2 (PERFIL-1): QR del perfil público en PNG alta resolución (1024px) para
// imprimir en furgoneta/tarjeta. Apunta a /p/:slug?src=qr → el registro que nazca
// de ese QR queda atribuido (acquisitionSource='qr', loop V0-3).
app.get('/admin/merchant/public-profile-qr', requireRole('admin'), async (req, res, next) => {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { slug: true, brandColor: true }, // SCRUM-230: `marca` reutiliza el color ya configurado
    });
    if (!merchant?.slug) {
      return res.status(400).json({ error: 'no_slug', message: 'Primero elige la dirección de tu página.' });
    }

    // SCRUM-230: color, tamaño, formato y previsualización. SIN parámetros el resultado es
    // EXACTAMENTE el de antes (1024 px, PNG, negro sobre blanco, descarga). La validación vive
    // aparte y es fail-closed porque lo que hay que impedir no es un color feo: es entregar un
    // QR que no se escanea, y de eso el pro se entera en la calle. Ver `qrPagina.service.ts`.
    let opciones;
    try {
      opciones = resolverOpcionesQr(req.query as Record<string, unknown>, { brandColor: merchant.brandColor });
    } catch (e) {
      if (e instanceof ErrorQr) return res.status(400).json({ error: e.codigo, message: e.message });
      throw e;
    }

    const destino = `${BASE_URL}/p/${merchant.slug}?src=qr`;
    const comun = {
      margin: 2,
      errorCorrectionLevel: 'M' as const,
      color: { dark: opciones.dark, light: opciones.light },
    };
    // Solo se fuerza la descarga si NO es previsualización: el hueco de uso que cerraba el
    // ticket era que el pro no podía VER el QR antes de bajárselo.
    if (opciones.descargar) {
      const nombre = `yaqu-qr-${merchant.slug}.${opciones.formato}`;
      res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    }

    if (opciones.formato === 'svg') {
      const svg = await QRCode.toString(destino, { type: 'svg', width: opciones.size, ...comun });
      return res.type('svg').send(svg);
    }
    const png = await QRCode.toBuffer(destino, { type: 'png', width: opciones.size, ...comun });
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

/** SCRUM-313 · alguien emitió mientras se contestaba la pregunta: la serie ya empezó. */
class SerieYaEmpezada extends Error {}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-313 (D2) · «¿POR QUÉ NÚMERO VAS?» — la continuidad de la serie al venir de otro programa
//
// Un autónomo que ya factura no se cambia de programa porque el nuevo sea más bonito: no se cambia
// porque romper la serie le da miedo con Hacienda. Aquí se guarda esa continuidad.
//
// ⚠️ RUTA PROPIA, y no un campo más en `PUT /admin/merchant`. `nextInvoiceNumber` gobierna qué
// número sale en la próxima factura: abrirlo en el formulario general lo dejaría escribible desde
// cualquier guardado de Configuración, para siempre. Aquí tiene su puerta y su momento.
//
// LOS DOS CAMPOS SE ESCRIBEN JUNTOS. `resolveSeriesSeq` hace `invoiceSeriesYear === year ?
// nextInvoiceNumber : 1`, así que guardar el número sin el año NO continúa la serie: la reinicia
// en 1 en silencio, y el profesional emitiría un número que YA usó en su programa anterior.
// SCRUM-313 · LA VISTA PREVIA, en su propia ruta y SIN escribir nada.
//
// Existe porque la vista previa NO se puede calcular en el navegador: hacerlo sería un segundo
// sitio componiendo el mismo número, y ésa es exactamente la forma en que la pantalla acaba
// diciendo una cosa y la factura otra. Aquí se resuelve con `resolveSeriesSeq` y
// `formatInvoiceNumber` — quien de verdad decide al emitir— y se devuelve ya hecha.
//
// Es de SOLO LECTURA a propósito: se llama en cada pulsación del teclado, y una ruta que escribe
// no puede colgar de un `input`.
app.post('/admin/onboarding/serie/previa', requireRole('admin'), async (req, res, next) => {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { invoiceSeriesPrefix: true },
    });
    if (!merchant) return res.status(404).json({ error: 'not_found' });

    const año = new Date().getFullYear();
    const emitidas = await prisma.invoice.findMany({
      where: { merchantId: req.merchantId, number: { startsWith: `${año}-` } },
      select: { number: true },
    });
    const deLaSerie = numerosDeLaSerie(emitidas.map((f) => f.number), año);

    const arranque = arranqueDeSerie({
      vieneDeOtroSitio: req.body?.vieneDeOtroSitio === true,
      ultimoNumero: req.body?.ultimoNumero,
      año,
      numerosDeLaSerie: deLaSerie,
    });
    if (!arranque.ok) {
      const esChoque = arranque.motivo === 'choca_con_emitidas';
      return res.status(esChoque ? 409 : 400).json({
        error: arranque.motivo,
        ...(esChoque ? { titulo: TIT_SERIE_YA_EMITIDA, message: MSG_SERIE_YA_EMITIDA } : {}),
        ...(arranque.detalle ?? {}),
      });
    }

    const prefijoPedido = typeof req.body?.serie === 'string' ? req.body.serie.trim() : '';
    const prefijo = prefijoPedido || merchant.invoiceSeriesPrefix;
    return res.json({
      ok: true,
      proximoNumero: vistaPreviaSerie(
        prefijo,
        { invoiceSeriesYear: arranque.invoiceSeriesYear, nextInvoiceNumber: arranque.nextInvoiceNumber },
        año,
      ),
    });
  } catch (err) {
    return next(err);
  }
});

app.post('/admin/onboarding/serie', requireRole('admin'), async (req, res, next) => {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { invoiceSeriesPrefix: true },
    });
    if (!merchant) return res.status(404).json({ error: 'not_found' });

    // El año sale del RELOJ DEL SERVIDOR, nunca del cuerpo: es el mismo año contra el que
    // `resolveSeriesSeq` decidirá al emitir. Aceptarlo del cliente permitiría declarar una
    // continuidad para un año que no es el que va a salir en la factura.
    const año = new Date().getFullYear();

    // Lo ya emitido manda. Se lee por el NÚMERO, que es la identidad fiscal del documento.
    const emitidas = await prisma.invoice.findMany({
      where: { merchantId: req.merchantId, number: { startsWith: `${año}-` } },
      select: { number: true },
    });
    const deLaSerie = numerosDeLaSerie(emitidas.map((f) => f.number), año);

    const arranque = arranqueDeSerie({
      vieneDeOtroSitio: req.body?.vieneDeOtroSitio === true,
      ultimoNumero: req.body?.ultimoNumero,
      año,
      numerosDeLaSerie: deLaSerie,
    });

    if (!arranque.ok) {
      // `choca_con_emitidas` se responde con el MISMO texto aprobado que el bloqueo de
      // Configuración (SCRUM-291): es el mismo hecho —la serie ya tiene facturas— y contarlo de
      // dos maneras distintas haría parecer que son dos reglas.
      const esChoque = arranque.motivo === 'choca_con_emitidas';
      return res.status(esChoque ? 409 : 400).json({
        error: arranque.motivo,
        ...(esChoque ? { titulo: TIT_SERIE_YA_EMITIDA, message: MSG_SERIE_YA_EMITIDA } : {}),
        ...(arranque.detalle ?? {}),
      });
    }

    // El prefijo solo se toca si cambió Y la serie no ha empezado. Con emitidas ya habríamos salido
    // arriba, pero se pregunta igual en vez de deducirlo del flujo: la puerta de SCRUM-291 vive en
    // `bloqueoCambioDeSerie` y ésta es exactamente la misma pregunta.
    const prefijoPedido = typeof req.body?.serie === 'string' ? req.body.serie.trim() : '';
    if (prefijoPedido) {
      const veredicto = bloqueoCambioDeSerie({
        prefijoActual: merchant.invoiceSeriesPrefix,
        prefijoNuevo: prefijoPedido,
        numerosDeLaSerie: deLaSerie,
      });
      if (veredicto.bloqueado) {
        return res.status(409).json({
          error: 'serie_ya_emitida', titulo: TIT_SERIE_YA_EMITIDA, message: MSG_SERIE_YA_EMITIDA,
          emitidas: veredicto.emitidas, ultimo: veredicto.ejemplo,
        });
      }
      const malPrefijo = invalidPrefijoSerie(prefijoPedido);
      if (malPrefijo) {
        return res.status(400).json({ error: 'prefijo_invalido', message: `El prefijo de serie ${malPrefijo}` });
      }
    }

    // ⚠️ CERROJO, y lo cazó el censo de SCRUM-234 antes de que llegara a main.
    //
    // Esto lee lo emitido y escribe un valor ABSOLUTO en el contador: exactamente la tercera forma
    // que aquel ticket prohíbe. Sin serializar, entre la lectura de `emitidas` y este `update`
    // cabe una emisión — el merchant tendría ya la 001 consumida y aquí se escribiría 42 encima.
    // No es un hueco cualquiera: esa 001 DUPLICA un número que él ya usó en su programa anterior,
    // que es justo el daño que D2 existe para evitar.
    //
    // Mismo cerrojo y mismo namespace que `allocateInvoiceNumber`, así que reservar un número y
    // declarar el arranque no pueden ocurrir a la vez. Se toma como PRIMERA sentencia y la
    // relectura va dentro: comprobar fuera y escribir dentro no serializa nada.
    const actualizado = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SERIE_LOCK_NS}::int, ${req.merchantId!}::int)`;
      const dentro = await tx.invoice.findMany({
        where: { merchantId: req.merchantId, number: { startsWith: `${año}-` } },
        select: { number: true },
      });
      if (numerosDeLaSerie(dentro.map((f) => f.number), año).length > 0) {
        throw new SerieYaEmpezada();
      }
      return tx.merchant.update({
        where: { id: req.merchantId },
        data: {
          nextInvoiceNumber: arranque.nextInvoiceNumber,
          invoiceSeriesYear: arranque.invoiceSeriesYear,
          ...(prefijoPedido ? { invoiceSeriesPrefix: prefijoPedido } : {}),
        },
        select: { invoiceSeriesPrefix: true, nextInvoiceNumber: true, invoiceSeriesYear: true },
      });
    });

    // La vista previa se devuelve YA RESUELTA por quien decide, para que la pantalla enseñe el
    // mismo número que va a salir y no uno calculado aparte.
    return res.json({
      ok: true,
      ...actualizado,
      proximoNumero: vistaPreviaSerie(
        actualizado.invoiceSeriesPrefix,
        {
          invoiceSeriesYear: actualizado.invoiceSeriesYear,
          nextInvoiceNumber: actualizado.nextInvoiceNumber,
        },
        año,
      ),
    });
  } catch (err) {
    // La carrera perdida NO es un 500: alguien emitió mientras el profesional contestaba, así que
    // la serie ya empezó. Se le dice con el MISMO texto aprobado que el bloqueo de Configuración.
    if (err instanceof SerieYaEmpezada) {
      return res.status(409).json({
        error: 'serie_ya_emitida', titulo: TIT_SERIE_YA_EMITIDA, message: MSG_SERIE_YA_EMITIDA,
      });
    }
    return next(err);
  }
});

// A6.5: 404 con marca para navegadores (GET que acepta HTML); JSON para la API.
app.use((req, res) => {
  if (req.method === 'GET' && req.accepts(['json', 'html']) === 'html') {
    return res.status(404).type('html').send(notFoundPageHtml());
  }
  return res.status(404).json({ error: 'not_found' });
});
