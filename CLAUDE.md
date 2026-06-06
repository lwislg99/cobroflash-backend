# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este proyecto

**YaQu** — SaaS WhatsApp-first para profesionales de servicios (fontaneros, electricistas, reformistas) en LATAM. Ciclo completo: cotización → WhatsApp → firma digital del cliente → factura automática → cobro integrado.

- **URL producción:** `https://yaqu.app`
- **Repo:** `https://github.com/lwislg99/cobroflash-backend`
- **Deploy:** Railway, auto-deploy desde `main`

## Comandos

```bash
npm run dev              # hot reload (ts-node-dev) — carga .env.local con prioridad sobre .env
npm run build            # tsc → dist/
npm start                # node dist/index.js
npm test                 # compila + node --test (tests/*.test.mjs contra dist/)

npx prisma db push --accept-data-loss   # aplicar schema (Railway/CI — sin TTY)
npx prisma generate      # regenerar cliente tras schema.prisma
npm run db:seed          # prisma/seed.ts
```

⚠️ Prisma en este entorno NO tiene TTY — usar siempre `db push`, nunca `migrate dev` interactivo.
⚠️ Después de `db push` en Windows el DLL queda bloqueado → matar node y re-ejecutar `prisma generate`.
⚠️ El `.env` apunta a la **BD de PRODUCCIÓN** (Railway). Para desarrollo usar `.env.local` (gitignored, se carga primero vía `src/core/config/loadEnv.ts`) con BD local y `DISABLE_CRONS=true` para no enviar WhatsApp/emails reales. Antes de un `db push` a prod: previsualizar con `prisma migrate diff --from-url <PROD> --to-schema-datamodel prisma/schema.prisma --script` y confirmar que es solo aditivo.

## Reglas críticas — NUNCA romper

1. **NUNCA usar n8n** — todo WhatsApp via `src/integrations/whatsapp.ts` (Meta Cloud API directa)
2. **Multi-tenant real** — todas las queries filtran por `req.merchantId` inyectado por `requireAuth`
3. **Prisma sin TTY** — siempre `db push`, nunca `migrate dev`
4. **Frontend sin frameworks** — HTML/JS vanilla, sin React, sin bundler, sin build step
5. **Emails via Resend** — no SMTP en producción, usar `config.RESEND_API_KEY`
6. **Crons dentro del proceso** — `src/core/cron/cron.ts`, no Railway Cron externo
7. **El merchant demo** tiene `email: demo@yaqu.app`, `id: 1`
8. **Las rutas `/admin/*`** requieren cookie `pf_session` (httpOnly, 30 días)

## Arquitectura completa

```
src/
├── index.ts              # entry: listen + startCronJobs()
├── app.ts                # Express app, route mounting, auth middleware
├── core/
│   ├── config/env.ts     # vars de entorno (source of truth) + flag DISABLE_CRONS
│   ├── config/loadEnv.ts # carga .env.local (prioridad) + .env — importado el 1º en index.ts
│   ├── db/prisma.ts      # Prisma singleton
│   ├── http/
│   │   ├── authMiddleware.ts   # requireAuth, requireActivePlan, requireRole, setCookie, clearCookie
│   │   └── jsonError.ts
│   ├── i18n/locales.ts   # getLocale(country): ES/MX/CO/AR/PE/CL
│   ├── cron/cron.ts      # node-cron: recordatorio cotizaciones (1h), facturas (diario 10h), digest (lunes 9h)
│   ├── storage/dirs.ts   # /invoices, /outbox
│   ├── utils/utils.ts    # normalizePhone, calcTotal, makeReference, esc
│   └── validation/schemas.ts  # Zod schemas centrales
├── integrations/
│   ├── whatsapp.ts       # sendWhatsAppTemplate, sendWhatsAppText
│   ├── whatsappNotifications.ts # sendPaymentConfirmation (payment_confirmation_es)
│   ├── stripe.ts         # Stripe singleton
│   ├── mercadopago.ts    # createMpPreference, getMpPayment
│   ├── mailer.ts         # nodemailer (fallback dev)
│   ├── claude.ts         # Anthropic SDK singleton
│   └── n8n.ts            # LEGACY — NO USAR
├── lib/
│   ├── invoicing.ts      # ensureInvoiceForCharge()
│   ├── pdf.ts            # wrapper → modules/invoicing/infra/pdf/pdf.service.ts
│   └── email.ts          # wrapper → modules/messaging/domain/email.service.ts
└── modules/
    ├── ai/               # Claude: suggest-quote, quote-message
    ├── auth/             # magic link, sesiones, registro, invitaciones
    ├── billing/          # charges, webhooks PSP/Stripe/MP, suscripciones
    ├── expenses/         # CRUD gastos, resumen mensual, margen por cotización
    ├── exports/          # CSV: facturas, gastos, presupuestos
    ├── invoicing/        # facturas + PDF (PDFKit) + VeriFactu
    ├── messaging/        # email facturas, merchant notifications, weekly digest, lifecycle
    ├── metrics/          # Home KPIs, top clientes/servicios, funnel (sprint pendiente)
    ├── products/         # catálogo, autocomplete, CSV import/export
    ├── providers/        # proveedores
    ├── quoteRequests/    # solicitudes desde portal cliente
    ├── quotes/           # cotizaciones, GBB tiers, billing plan, reminder 24h
    ├── reports/          # P&L mensual
    ├── search/           # búsqueda global (clientes, presupuestos, facturas)
    ├── system/           # admin routes: customers, quotes, invoices, merchant, portales
    ├── team/             # equipo, roles, invitaciones
    └── templates/        # plantillas de cotización
```

**Archivos/carpetas clave añadidos (sesión 2026-06-05):**
- `src/modules/billing/domain/invoiceWhatsApp.service.ts` — `sendInvoicePaymentRequest()` (asegura cobro con el cliente real + envía `payment_request_es`); usado por el endpoint admin y por la aceptación pública.
- `src/modules/system/customerEvents.service.ts` — ENT-3 `recordCustomerEvent`/`listCustomerEvents` (fire-and-forget).
- `src/modules/billing/app/routes/payInvoice.routes.ts` — página `/pay/invoice/:chargeId`.
- `tests/*.test.mjs` — suite con `node --test` (`npm test`).
- `scripts/wa-test.mjs` — prueba manual de plantillas WhatsApp.
- `docs/WHATSAPP_TEMPLATES.md` (spec plantillas) · `docs/MIGRATIONS_PENDING.md` (registro db push).

## Modelos de datos (estado actual)

### Merchant
```
email, name, legalName, taxId, address
defaultCurrency, invoiceSeriesPrefix, nextInvoiceNumber, logoUrl, whatsappPhone
googleReviewUrl, country, plan (trial|basic|pro|empresa), planExpiresAt
stripeCustomerId, stripeSubscriptionId, onboardingCompleted
notifyEmailOnPaid, notifyEmailOnQuoteAccepted, notifyEmailWeeklyDigest
iban, clabe, status, trade (oficio)
brandColor, brandAccentColor, approvalThreshold
referralCode (unique), referredBy, freeMonthsEarned, referralRewardedAt
lifecycleEmailsSent (Json)  // idempotencia de emails de ciclo de vida
```

### Quote
```
merchantId, customerId, status (draft|sent|accepted|rejected|pending_approval)
lines (Json), tiers (Json?), selectedTierId (String?)
total, currency, paymentTerms (FULL_UPFRONT|FIFTY_FIFTY|MANUAL|null)
signatureUrl (Text?), pdfUrl (Text?), internalNotes (Text?)
reminderSentAt (DateTime?), acceptedAt, rejectedAt, decisionChannel, decisionComment, rejectionReason
chargeId, evidence, teamMemberId (técnico creador; null = propietario)
// PENDIENTE: photoUrls (String[]) — Sprint PHOTOS, bloqueado por R2
```

### CustomerEvent (ENT-3 · historial de comunicaciones — tabla customer_events, en prod)
```
merchantId, customerId, type, title, detail?, meta (Json?), createdAt
// type: quote_sent | quote_accepted | quote_rejected | invoice_issued | payment_received | quote_requested
// Registro fire-and-forget vía src/modules/system/customerEvents.service.ts (no rompe si falta la tabla)
// Se muestra en la ficha 360 del cliente (sección "Actividad reciente")
```

### Invoice
```
merchantId, customerId, quoteId?, chargeId?
number, total, currency, pdfUrl, qrData, status (pending|paid|expired), paidAt
lines (Json?), vfHash, vfPrevHash (VeriFactu)
reminder7SentAt, reminder14SentAt
```

### Expense
```
merchantId, quoteId?, providerId?
concept, amount, currency, category (materiales|desplazamiento|herramientas|subcontrata|otros)
date, notes?, receiptData (Text?)
```

### TeamMember
```
merchantId, name, email, role (admin|tecnico), status (invited|active|suspended)
```

### QuoteTemplate
```
merchantId, name, currency, lines (Json), tiers (Json?), paymentTerms
```

### QuoteRequest
```
merchantId, customerId, description, status (pending|read|done)
```

## Variables Railway configuradas

```
SESSION_SECRET, RESEND_API_KEY, EMAIL_FROM             ✅
DATABASE_URL, PORT, PUBLIC_BASE_URL (yaqu.app)         ✅
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET               ✅
WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN        ✅
WHATSAPP_BUSINESS_ACCOUNT_ID                           ✅
AUTO_INVOICE_ON_PAID=true, AUTO_EMAIL_INVOICE_ON_PAID=true ✅
ANTHROPIC_API_KEY                                      ✅
STRIPE_PRICE_ID_PRO, STRIPE_PRICE_ID_PRO_ANNUAL        ✅ (configurados por usuario)
MP_ACCESS_TOKEN            ⚠️ Opcional (Mercado Pago)
STORAGE_BUCKET_URL / ACCESS_KEY / SECRET_KEY / PUBLIC_URL  ❌ Pendiente (Cloudflare R2 — Sprint PHOTOS)
WHATSAPP_VERIFY_TOKEN      ❌ Pendiente — TAREA USUARIO en Meta/Railway (webhook entrante)
WHATSAPP_APP_SECRET        ⚠️ Opcional (valida firma X-Hub-Signature-256 del webhook)
DISABLE_CRONS              (solo dev en .env.local; en prod NO se define → crons activos)
```

## Frontend — Design System v2

**Font:** Inter (Google Fonts)
**Clases CSS clave:**
- `.data-card` — card sin padding con `overflow:hidden` para tablas edge-to-edge
- `.data-card-header` — header con padding y flex-wrap
- `.data-card-toolbar` — barra de búsqueda/filtros con fondo slate-50
- `.table-scroll` — wrapper con `overflow-x:auto`
- `.customers-card` — card CON `padding:20px` para bloques de detalle (NO para tablas)
- `.kpi-card` — métrica con hover lift
- `.btn-primary/.btn-secondary/.btn-danger/.btn-ghost` — pill shape
- `.status-pill-accepted/.rejected/.pending/.draft` — pills de estado
- `.empty-state` — estado vacío con icono, título y descripción

**Patrón vistas de lista:**
```javascript
const card = createElement("div", "data-card");
const header = createElement("div", "data-card-header");
const tableScroll = createElement("div", "table-scroll");
const table = createElement("table", "table");
```

**`window.appLocale`** — `{ quote, quotePlural, quoteNew, quoteVerb, currency, defaultVat, vatName }` — disponible tras auth.
**`window.appMerchantId`** — merchantId de la sesión actual.
**`window.appUserRole`** — `'admin'` o `'tecnico'`.

**Superficies públicas (HTML estático en `public/`, servido en raíz por `express.static`):**
- `public/tokens.css` — **fuente de verdad de tokens** (color, radio, sombra, foco) alineada con DESIGN.md. La consumen el landing, las páginas de auth **y el dashboard** (`dashboard/css/styles.css` alia sus `--radius-*`/sombras/marca a `--r-*`/`--shadow-*`/`--brand*`) → marketing y producto NO divergen. Editar aquí, se aplica en todas las superficies. Lo único propio del dashboard es el ramp neutro `--slate-*` y el layout. Los colores decorativos de un solo uso (degradado del hero, banda CTA) siguen inline en su página.
- `public/auth.css` — estilos compartidos de `login.html` + `register.html` (card, inputs, botón píldora, badges, links). **Hereda** de tokens.css → enlazar `tokens.css` ANTES que `auth.css` en cada página de auth.
- `public/index.html` (landing): enlaza `tokens.css` + `<style>` inline propio (clases del landing: `.hero`, `.card`, `.price-card`, `.cta-band`, etc.). Botones `.btn` en píldora vía `var(--r-full)`.
- ⚠️ Las páginas de auth viven en `/login.html` y `/register.html` (NO `/login` ni `/register` → eso da 404).

## Rutas públicas (sin auth)
```
POST /auth/login, GET /auth/verify, POST /auth/register, POST /auth/logout
GET  /pay/quote/:id (landing aceptar/firmar/rechazar), /pay/quote/:id/accept (alias), GET/POST /pay/quote/:id/reject
GET  /pay/invoice/:chargeId (selector método: tarjeta + transferencia)
GET  /pay/card/:id, GET /pay/bank/:id, GET /pay/mp/:id, GET /recibo/:id
GET  /cliente/:token, POST /cliente/:token/quote-request
POST /quote/create (gate requireActivePlan), POST /quote/:id/decision, /quote/:id/accept, /quote/:id/reject
POST /webhooks/psp, POST /webhooks/stripe, POST /webhooks/mp, GET/POST /webhooks/whatsapp
GET  /health
```

## Rutas admin (requieren cookie pf_session)
```
GET  /admin/me
GET/PUT /admin/merchant
POST /admin/onboarding/complete
GET/POST /admin/customers (+ /:id, /import, /:id/portal-url, /:id/detail)
GET/POST /admin/quotes (+ /:id, /:id/send-whatsapp [gate plan], /:id/notes, /:id/accept, /:id/reject, /:id/invoice, /:id/approve [admin, ENT-2])
GET/PUT  /admin/invoices (+ /:id, /:id/status, /:id/resend-whatsapp, /:id/send-reminder, /:id/regenerate-pdf)
POST /admin/invoices/bulk-paid
GET  /admin/products (autocomplete, export, import, + CRUD)
GET  /admin/providers (+ CRUD)
GET  /admin/metrics/home
GET  /admin/expenses (+ summary, margin/:quoteId, CRUD)
POST /admin/billing/checkout, /portal
GET  /admin/billing/plans
GET/PUT /admin/team (+ /:id, /:id/resend)
POST /admin/ai/suggest-quote, /quote-message
GET  /admin/exports/invoices.csv, /expenses.csv, /quotes.csv
GET  /admin/reports/pl
GET/POST/PUT/DELETE /admin/templates
GET/PATCH /admin/quote-requests
GET  /admin/search
GET  /admin/digest/preview
GET  /admin/referral, POST /admin/referral/redeem (admin — canjea 1 mes gratis: planExpiresAt +30d)
```

⚠️ **Billing NO está detrás de `requireActivePlan`** (sería un callejón: un trial caducado no podría pagar). El gate `requireActivePlan` vive en `POST /quote/create` y `POST /admin/quotes/:id/send-whatsapp` (bloquea crear/enviar, deja ver y pagar). El front (`api.js`) ante un 403 `trial_expired` lleva a `#plans`.

## Sprints completados

- ✅ Sprint 1: n8n→Meta API, notificaciones WA, Home KPIs, Quick Quote, CSS mobile-first
- ✅ Sprint 2: Auth magic link, multi-tenant, onboarding, Stripe billing
- ✅ Sprint 3: Firma digital, recordatorio 24h, reseña Google, portal cliente, i18n
- ✅ Sprint 4: Good/Better/Best (3 opciones de precio)
- ✅ Sprint 5: PWA, top clientes/servicios, notas internas, módulo gastos, margen real
- ✅ UI Polish: design system v2 (Inter, SVG icons, data-card, design tokens)
- ✅ Sprint 6: Múltiples usuarios por merchant, roles Admin/Técnico
- ✅ Sprints 7-19 + AHORA-1/2 + UX-1 + LANDING + TUTORIAL + EMAIL + FRONT-1 + ANALYTICS + REFERRAL + ENTERPRISE (ver doc/YAQU_MASTER.md y la memoria del proyecto)

## 📌 ESTADO ACTUAL — leer primero al retomar (última sesión: 2026-06-06)

### ✅ Completado en la sesión 2026-06-06 (cont.) — crítica /impeccable end-to-end del móvil (390px)
Ciclo completo dirigido por `/impeccable critique` sobre **landing + login + register + dashboard** (incluido el dashboard autenticado, renderizado en local con un server efímero que mockea `/admin/*`). **Salud 29 → 32 → 35/40** (3 snapshots en `.impeccable/critique/`, slug `yaqu-app-mobile-landing-auth-dashboard`). 0 P0 / 0 P1 al cerrar. Todo commit→push directo a `main`:
- **3 P1** → `6fbf2f3`: Regla del Importe (KPIs Gastos/Beneficio vuelven a tinta + chip de estado, fin del rojo en el número y del borde verde de 2px); contraste AA (los `--slate-400`/`-300` de texto sobre blanco suben a slate-500/600); **una sola etiqueta de conversión** en la landing (`/register.html` = "Empezar gratis" en nav/hero/precios/CTA final).
- **P2 extract** → `08bba3d`: el **dashboard ya consume `tokens.css`** — sus `--radius-*`/sombras son alias de `--r-*`/`--shadow-*` (cards 14→16px, inputs 10→12px), y `--green-*`/`--red-*` alias de `--brand*`/`--danger*`. Se añadió `--r-2xl:24px` a tokens.css. Queda local solo el ramp neutro `--slate-*` (sin equivalente completo en tokens.css).
- **Onboard** → `c45de69`: el coach-mark (`tutorial.js`) pasa a **spotlight** (ilumina el CTA real con anillo de marca sobre scrim, `pointer-events:none`), flecha al objetivo, no lo tapa, "Entendido" discreto, cierre con Escape/clic-fuera, reposición en scroll/resize.
- **Badges sidebar** → `67dc2c5`: clase `.nav-badge` con **un solo color de conteo** (info `--blue-600`, blanco 5:1 AA); fin del rojo/azul/ámbar ad hoc.
- **Layout auth** → `322c91c`: card centrada con patrón `margin:auto` sobre `.auth-wrap` (fin del hueco muerto en móvil alto) + franja `.auth-trust` de confianza bajo la card.
- **Modal "Nuevo presupuesto rápido"** → `3214c59` (cabeceras de columna Concepto/Cant./Precio compartiendo grid con las filas + proporciones; typo "en cuanto"→"cuando") y `0e04e48` (polish: helper texts a slate-500, tiers de 2px a 1px+tinte).
- **Harden** → `151f28c`: `.skeleton` con neutros cálidos (antes gris azulado prohibido) + `--radius`; helper compartido **`window.uiErrorState(container,msg,onRetry)`** (`.state-error`, usado en el catch del Home con "Reintentar") y **`window.uiMarkFieldError(el)`** (`.input-error`, la validación del modal marca/enfoca el campo que falla). Cierra las heurísticas 1 (carga) y 9 (recuperación).
- **A11y** → `af6bb88`: empty-states "Sin datos aún" y ranking del Home de slate-300 (~1.7:1) a slate-500.

**Pendiente menor de esta crítica (≤P2, no bloquea):** skeletons solo en el Home (las listas siguen con "Cargando…" en texto) · Escape no cierra el modal de presupuesto (sí ×/Cancelar/clic-fuera) · `aria-live` en error/toasts · naming interno `--slate-*`. Helpers `uiErrorState`/`uiMarkFieldError` (en `api.js`) listos para reutilizar en otras vistas.

### ✅ Completado en la sesión 2026-06-06 (diseño público + tooling)
**Diseño superficies públicas (móvil 390px, verificado en navegador y en prod):**
- Crítica `/impeccable` de landing + login + register a 390px (snapshot en `.impeccable/critique/`). Salud 29/40; el problema raíz era *deriva artesanal* entre superficies (botón, radios, bordes, color de badge distintos en marketing vs auth).
- **`public/auth.css` creado** + fixes de coherencia → `96e9d4b` (desplegado y re-verificado en prod):
  - Botones de auth en **píldora** (antes 12px rectángulo); card 16px e inputs 12px (tokens); borde de input visible y consistente entre login/register.
  - Badge de prueba en **verde** (antes azul, competía con el CTA). Cards de auth ancladas arriba en móvil (fin del espacio muerto). `autofocus` en el 1er campo.
  - Landing: nav a ghost → **un solo botón verde en el fold** (regla "Una Sola Voz"). Contraste de la línea de confianza subido. Label a token.
- **`public/tokens.css` extraído** (refactor) → `c46b625`: un único `:root` (color/radio/sombra/foco) que comparten landing y auth; `index.html` y `auth.css` migrados a `var()`. Sin cambio visual.

**Tooling:**
- **Chromium de Playwright instalado** (`chromium` + `chromium-headless-shell` build 1224, en `C:\Users\Admin\AppData\Local\ms-playwright`). El **MCP de Playwright sigue `Failed to connect`** y sus tools no se cargan en sesión → workaround usado: conducir Playwright **directo** vía `createRequire` desde la caché de npx (`...\npm-cache\_npx\9833c18b2d85bc59\node_modules`), con un script efímero que sirve `public/` y hace screenshots a 390px. Funciona sin reiniciar.

### ✅ Sesión anterior (2026-06-05) (feature/bug → commit)
**WhatsApp (código LISTO; plantillas en revisión en Meta):**
- Plantillas alineadas a la spec definitiva + páginas de pago → `7398323`
- Fix: enviar la factura al aceptar (servicio de dominio sin auth; antes 401) → `c1a64c9`
- Páginas cliente al estilo "Recibo de confianza": `/pay/invoice` `e404604`, `/pay/quote/:id` aceptar `c5a3dab`, rechazo `df67c4e`, `/recibo` `0ca1328`
- Script de prueba `scripts/wa-test.mjs` → `6455302`

**Enterprise:**
- ENT-3 historial de comunicaciones (CustomerEvent) → `6688554`; **db push APLICADO a prod** → `4b82e57`
- Aviso por email al técnico al aprobar su presupuesto (ENT-2 cerrado) → `d4d3d3f`

**Otros features:**
- Email "primer pago" conectado al webhook de Stripe → `0a8f79c`
- Canje de referidos = **crédito manual** (`redeemFreeMonth`, +30d planExpiresAt) → `fbfed11`
- SEO landing: robots.txt + sitemap.xml + JSON-LD → `24a79cc`
- Remate del pase premium (dashboard JS sin grises fríos) → `59266be`
- Dev seguro: `.env.local` + flag `DISABLE_CRONS` → `54837be`
- **Tests** (primera red; `node --test` contra dist/, cero deps; utils + i18n; `npm test`) → `1f5efef`, `425b027`

**Bug (QA):**
- No duplicar cliente al crear el cobro de una factura (`CreateChargeSchema.customer_id`) → `b87a1ec`

### ⏳ Pendientes y qué INPUT EXTERNO necesitan
- **WhatsApp — prueba real:** esperando que **Meta** apruebe las 3 plantillas. Al aprobar: `node scripts/wa-test.mjs <quote_decision|payment_request|payment_confirmation> <tel> [--dry]`. Si Meta da #132000 (variables/botones no cuadran) o #132001 (nombre/idioma), ajustar plantilla o código.
- **WhatsApp — webhook entrante:** crear `WHATSAPP_VERIFY_TOKEN` en Railway y registrar el webhook en Meta (TAREA USUARIO).
- **Sprint PHOTOS:** bloqueado por credenciales **Cloudflare R2** (`STORAGE_*`). Falta crear `Quote.photoUrls` (db push) + upload + mostrar en landing/PDF.
- **Sprint LATAM:** credenciales OXXO/PSE + Mercado Pago en producción.
- **Sprint SPAIN:** alcance VeriFactu XML / modelo 303 / factura rectificativa.

### 📄 Spec de plantillas WhatsApp — GUARDADA
`docs/WHATSAPP_TEMPLATES.md` es la **fuente de verdad** de las 3 plantillas (UTILITY/es, variables y botones exactos). El código de envío debe coincidir con ella. `docs/MIGRATIONS_PENDING.md` registra los `db push` (ENT-3 ya aplicado).

### 🎭 Verificación visual — Playwright
**MCP:** registrado (`claude mcp add playwright "npx @playwright/mcp@latest"`, en `.claude.json` local) pero **`✗ Failed to connect`** — sus tools `browser_*` NO se cargan en la sesión. Reiniciar Claude Code *podría* arreglarlo ahora que Chromium está instalado (era la causa probable del fallo de arranque), pero no es necesario:
**Workaround probado (no requiere el MCP ni reiniciar):** script efímero en `scripts/` que hace `createRequire(...\_npx\9833c18b2d85bc59\node_modules)` → `playwright`, levanta un server estático mínimo sobre `public/` (con `/admin/me` → 401 para que el redirect del login sea no-op) y screenshotea a viewport 390×844 (iPhone, DPR 2). Para prod: navegar directo a `https://yaqu.app/...`. Borrar el script y `.shots/` al terminar.

### 🎯 Próximos pasos prioritarios al retomar
1. **Cuando Meta apruebe:** probar las 3 plantillas con `wa-test.mjs` y validar el loop completo (cotización→acepta→factura→pago→confirmación).
2. **Diseño (HECHO 2026-06-06 cont.):** el dashboard ya consume `tokens.css` y la salud de la crítica móvil subió a 35/40. Polish menor que queda: skeletons también en las listas (hoy "Cargando…" en texto; reutilizar `window.uiErrorState`/un helper de skeleton), `aria-live` en error/toasts, Escape en el modal de presupuesto, renombrar `--slate-*`.
3. **Sin bloqueo:** más tests (extraer los *builders* de componentes de plantillas WA a un módulo puro y testearlos); seguir el pase de accesibilidad (lectores de pantalla en estados dinámicos).
4. **Cuando lleguen creds R2:** Sprint PHOTOS.

## Próximos sprints — EJECUTAR EN ESTE ORDEN

> ⚠️ Lista histórica. AHORA-1/2, WA(código), UX-1, FRONT-1, LANDING, TUTORIAL, PHOTOS(bloqueado), EMAIL, REFERRAL, ANALYTICS y ENTERPRISE ya están **hechos** (ver "ESTADO ACTUAL" arriba). Lo realmente pendiente:

```
🔴 WhatsApp:  prueba real (esperando aprobación Meta) + webhook entrante (tarea usuario)
🟢 PHOTOS:    Fotos del trabajo — BLOQUEADO por credenciales Cloudflare R2
⚫ LATAM:     Pagos LATAM (OXXO, PSE, MP producción) — creds
⚫ SPAIN:     VeriFactu XML, modelo 303, factura rectificativa
⚫ PWA:       Push, offline, TWA Google Play
⚫ WA-BOT:    Bot conversacional WA (crear cotizaciones por WhatsApp)
⚫ SEO:       Blog + landing pages por oficio
🛠 Sin bloqueo: más tests (builders de plantillas WA a módulo puro), accesibilidad/hardening
```

## Documento de producto completo

`doc/YAQU_MASTER.md` — roadmap completo, arquitectura, criterios de éxito, estrategia GTM.
