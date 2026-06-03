# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este proyecto

**YaQu** — SaaS WhatsApp-first para profesionales de servicios (fontaneros, electricistas, reformistas) en LATAM. Ciclo completo: cotización → WhatsApp → firma digital del cliente → factura automática → cobro integrado.

- **URL producción:** `https://yaqu.app`
- **Repo:** `https://github.com/lwislg99/cobroflash-backend`
- **Deploy:** Railway, auto-deploy desde `main`

## Comandos

```bash
npm run dev              # hot reload (ts-node-dev)
npm run build            # tsc → dist/
npm start                # node dist/index.js

npx prisma db push --accept-data-loss   # aplicar schema (Railway/CI — sin TTY)
npx prisma generate      # regenerar cliente tras schema.prisma
npm run db:seed          # prisma/seed.ts
```

⚠️ Prisma en este entorno NO tiene TTY — usar siempre `db push`, nunca `migrate dev` interactivo.
⚠️ Después de `db push` en Windows el DLL queda bloqueado → matar node y re-ejecutar `prisma generate`.

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
│   ├── config/env.ts     # vars de entorno (source of truth)
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

## Modelos de datos (estado actual)

### Merchant
```
email, name, legalName, taxId, address
defaultCurrency, invoiceSeriesPrefix, nextInvoiceNumber, logoUrl, whatsappPhone
googleReviewUrl, country, plan (trial|basic|pro|empresa), planExpiresAt
stripeCustomerId, stripeSubscriptionId, onboardingCompleted
notifyEmailOnPaid, notifyEmailOnQuoteAccepted, notifyEmailWeeklyDigest
iban, clabe, status
// PENDIENTE: trade (oficio), brandColor, approvalThreshold, referralCode, referredBy, freeMonthsEarned
```

### Quote
```
merchantId, customerId, status (draft|sent|accepted|rejected|pending_approval)
lines (Json), tiers (Json?), selectedTierId (String?)
total, currency, paymentTerms (FULL_UPFRONT|FIFTY_FIFTY|MANUAL|null)
signatureUrl (Text?), pdfUrl (Text?), internalNotes (Text?)
reminderSentAt (DateTime?), acceptedAt, rejectedAt, decisionChannel, decisionComment, rejectionReason
chargeId, evidence
// PENDIENTE: photoUrls (String[])
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
STRIPE_PRICE_ID_PRO        ❌ CRÍTICO — crear en Stripe Dashboard
STRIPE_PRICE_ID_PRO_ANNUAL ❌ CRÍTICO — crear en Stripe Dashboard
MP_ACCESS_TOKEN            ⚠️ Opcional (Mercado Pago)
STORAGE_BUCKET_URL         ❌ Pendiente (Cloudflare R2 — Sprint PHOTOS)
STORAGE_ACCESS_KEY         ❌
STORAGE_SECRET_KEY         ❌
STORAGE_PUBLIC_URL         ❌
WHATSAPP_VERIFY_TOKEN      ❌ Pendiente (Sprint WA — webhook entrante)
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

## Rutas públicas (sin auth)
```
POST /auth/login, GET /auth/verify, POST /auth/register, POST /auth/logout
GET  /pay/quote/:id/accept, GET /pay/quote/:id/reject
GET  /pay/card/:id, GET /pay/bank/:id, GET /pay/mp/:id
GET  /cliente/:token, POST /cliente/:token/quote-request
POST /quote/create, POST /quote/:id/decision, POST /quote/:id/accept, POST /quote/:id/reject
POST /webhooks/psp, POST /webhooks/stripe, POST /webhooks/mp
GET  /health
```

## Rutas admin (requieren cookie pf_session)
```
GET  /admin/me
GET/PUT /admin/merchant
POST /admin/onboarding/complete
GET/POST /admin/customers (+ /:id, /import, /:id/portal-url, /:id/detail)
GET/POST /admin/quotes (+ /:id, /:id/send-whatsapp, /:id/notes, /:id/accept, /:id/reject, /:id/invoice)
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
```

## Sprints completados

- ✅ Sprint 1: n8n→Meta API, notificaciones WA, Home KPIs, Quick Quote, CSS mobile-first
- ✅ Sprint 2: Auth magic link, multi-tenant, onboarding, Stripe billing
- ✅ Sprint 3: Firma digital, recordatorio 24h, reseña Google, portal cliente, i18n
- ✅ Sprint 4: Good/Better/Best (3 opciones de precio)
- ✅ Sprint 5: PWA, top clientes/servicios, notas internas, módulo gastos, margen real
- ✅ UI Polish: design system v2 (Inter, SVG icons, data-card, design tokens)
- ✅ Sprint 6: Múltiples usuarios por merchant, roles Admin/Técnico

## Próximos sprints — EJECUTAR EN ESTE ORDEN

```
🔥 Sprint AHORA-1: Rebranding a YaQu (PresuFácil/CobroFlash → YaQu en todos los archivos públicos)
🔥 Sprint AHORA-2: Critical fixes (Stripe price IDs, eliminar fieldTo, restaurar resumen semanal)
🔴 Sprint WA:      Demo WhatsApp 100% funcional (webhook entrante, test flujo completo, copy mejorado)
🟠 Sprint UX-1:    Onboarding WOW (5 pasos, catálogos por oficio, empty states)
🟡 Sprint FRONT-1: Frontend Premium (dashboard rediseñado, micro-animaciones, landing cliente mejorada)
🟡 Sprint LANDING: yaqu.app pública (marketing page, pricing, SEO básico)
🟢 Sprint TUTORIAL: Sistema de ayuda in-app (tooltips, guía inicio, mensajes contextuales)
🟢 Sprint PHOTOS:  Fotos del trabajo (R2, upload, landing cliente, PDF)
🟢 Sprint EMAIL:   Lifecycle emails (bienvenida, día 3/7/12/15, primer pago, inactivo)
🟢 Sprint REFERRAL: Sistema de referidos (códigos, tracking, mes gratis)
🔵 Sprint ANALYTICS: Funnel conversión + rentabilidad servicios + dashboard equipo
🔵 Sprint ENTERPRISE: Custom branding + aprobación cotizaciones + historial comunicaciones
⚫ Sprint LATAM:   Pagos LATAM completos (OXXO, PSE, MP producción)
⚫ Sprint SPAIN:   España completo (VeriFactu XML, modelo 303, factura rectificativa)
⚫ Sprint PWA:     Mobile app quality (push, offline, TWA Google Play)
⚫ Sprint WA-BOT:  Bot conversacional WA (crear cotizaciones por WhatsApp)
⚫ Sprint SEO:     Blog + landing pages por oficio
```

## Documento de producto completo

`doc/YAQU_MASTER.md` — roadmap completo, arquitectura, criterios de éxito, estrategia GTM.
