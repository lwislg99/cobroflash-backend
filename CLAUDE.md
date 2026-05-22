# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este proyecto

**PresuFácil** — SaaS WhatsApp-first para profesionales de servicios (fontaneros, electricistas, reformistas) en LATAM. Ciclo completo: cotización → WhatsApp → firma digital del cliente → factura automática → cobro integrado.

- **URL producción:** `https://cobroflash-backend-production.up.railway.app`
- **Repo:** `https://github.com/lwislg99/cobroflash-backend`
- **Deploy:** Railway, auto-deploy desde `main`

## Comandos

```bash
npm run dev              # hot reload (ts-node-dev)
npm run build            # tsc → dist/
npm start                # node dist/index.js

npx prisma db push --accept-data-loss   # aplicar schema sin TTY (Railway/CI)
npx prisma generate      # regenerar cliente tras schema.prisma
npm run db:seed          # prisma/seed.ts
```

⚠️ Prisma en este entorno NO tiene TTY — usar siempre `db push`, nunca `migrate dev` interactivo.
⚠️ Después de `db push` en Windows el DLL queda bloqueado → matar node y re-ejecutar `prisma generate`.

## Reglas críticas

- **NUNCA usar n8n** — todo WhatsApp via `src/integrations/whatsapp.ts` (Meta Cloud API directa)
- **Multi-tenant real** (desde Sprint 2): todas las queries filtran por `req.merchantId` inyectado por `requireAuth` middleware
- El merchant demo tiene `email: luislaragranado@gmail.com`, `id: 1`
- Las rutas `/admin/*` requieren cookie `pf_session` (httpOnly, 30 días)
- El frontend es HTML/JS vanilla — sin frameworks, sin bundler

## Arquitectura completa

```
src/
├── index.ts              # entry: listen + startCronJobs()
├── app.ts                # Express app, route mounting, auth middleware
├── core/
│   ├── config/env.ts     # vars de entorno (source of truth)
│   ├── db/prisma.ts      # Prisma singleton
│   ├── http/
│   │   ├── authMiddleware.ts   # requireAuth, requireActivePlan, setCookie, clearCookie
│   │   └── jsonError.ts
│   ├── i18n/locales.ts   # diccionario por país: quote/currency/VAT/dateLocale
│   ├── cron/cron.ts      # node-cron jobs (recordatorio 24h)
│   ├── storage/dirs.ts
│   ├── utils/utils.ts    # normalizePhone, calcTotal, makeReference, esc
│   └── validation/schemas.ts  # Zod schemas centrales
├── integrations/
│   ├── whatsapp.ts       # sendWhatsAppTemplate, sendWhatsAppText
│   ├── stripe.ts
│   ├── mailer.ts         # nodemailer (fallback SMTP)
│   └── n8n.ts            # LEGACY — NO USAR
├── lib/
│   ├── invoicing.ts      # ensureInvoiceForCharge()
│   ├── pdf.ts            # wrapper → modules/invoicing/infra/pdf/pdf.service.ts
│   └── email.ts          # wrapper → modules/messaging/domain/email.service.ts
└── modules/
    ├── auth/             # magic link, sesiones, registro
    │   ├── domain/auth.service.ts
    │   └── app/routes/auth.routes.ts
    ├── billing/          # charges, PSP webhook, Stripe webhook, suscripciones
    ├── expenses/         # NUEVO: gastos, margen por trabajo
    │   ├── domain/expenses.service.ts
    │   └── app/routes/expenses.routes.ts
    ├── invoicing/        # facturas + PDF
    ├── messaging/        # email service
    ├── metrics/          # Home KPIs + top clientes/servicios
    ├── products/         # catálogo, CSV
    ├── providers/        # proveedores
    ├── quotes/           # cotizaciones, GBB tiers, billingPlan, reminder
    └── system/           # admin routes, merchant, customers, portal cliente
```

## Modelos de datos (estado actual)

### Merchant
```
email, plan (trial|basic|pro|empresa), planExpiresAt, onboardingCompleted
stripeCustomerId, stripeSubscriptionId, googleReviewUrl, country
invoiceSeriesPrefix, nextInvoiceNumber, logoUrl, whatsappPhone
```

### AuthSession
```
merchantId, token (hex 32), type (magic_link|session), expiresAt, usedAt
```

### Customer
```
merchantId, name, phone, email, notes, portalToken (hex 16, único)
```

### Quote
```
merchantId, customerId, status (draft|sent|accepted|rejected)
lines (Json), tiers (Json? — GBB: [{id,label,lines,total,recommended}])
selectedTierId (String? — 'good'|'better'|'best')
signatureUrl (Text? — base64 PNG de la firma del cliente)
internalNotes (Text? — notas privadas del profesional)
reminderSentAt (DateTime? — para idempotencia del cron)
paymentTerms, pdfUrl, signatureUrl, evidence
```

### Invoice
```
merchantId, customerId, quoteId?, chargeId?
number, total, currency, pdfUrl, qrData
status (pending|paid|expired), paidAt
```

### Expense (NUEVO — Sprint 5)
```
merchantId, quoteId?, providerId?
concept, amount, currency, category (materiales|desplazamiento|herramientas|subcontrata|otros)
date, notes?, receiptData (Text? — base64 foto del ticket)
```

## Rutas públicas (sin auth)
```
POST /auth/login           magic link por email
GET  /auth/verify?token=   verifica token → cookie pf_session → redirect /dashboard/
POST /auth/register        crea merchant + magic link
POST /auth/logout          borra sesión y cookie
GET  /pay/quote/:id/accept landing aceptación (canvas firma + GBB cards)
GET  /pay/quote/:id/reject landing rechazo
GET  /pay/card/:id         checkout Stripe
GET  /pay/bank/:id         pago por transferencia
GET  /cliente/:token       portal del cliente (cotizaciones + facturas + pagar)
POST /quote/create         crear cotización (llamado desde dashboard)
POST /quote/:id/decision   decisión del cliente (acepta con tierId + signatureData)
POST /webhooks/psp         webhook pagos bancarios
POST /webhooks/stripe      webhook Stripe (raw body, antes del JSON parser)
```

## Rutas admin (requieren cookie pf_session)
```
GET  /admin/me                          perfil sesión + locale
GET  /admin/customers/:id/portal-url    genera/devuelve URL del portal del cliente

GET  /admin/quotes                      lista (incluye internalNotes, tiers)
PUT  /admin/quotes/:id/notes            guardar notas internas (autoguardado)
POST /admin/quotes/:id/send-whatsapp    envía WA + marca status='sent'
GET  /admin/quotes/:id                  detalle completo

GET  /admin/invoices                    lista con filtros
POST /admin/invoices/:id/resend-whatsapp reenvía factura por WA

GET  /admin/expenses                    lista gastos (filtros: month, category, quoteId)
GET  /admin/expenses/summary            resumen mensual por categoría
GET  /admin/expenses/margin/:quoteId    margen = ingresos - gastos del trabajo
POST /admin/expenses                    crear gasto
PUT  /admin/expenses/:id               editar gasto
DELETE /admin/expenses/:id             borrar gasto

GET  /admin/metrics/home               KPIs: pendiente, awaiting, cobrado, gastos, beneficio neto
                                        + topCustomers + topServices

GET  /admin/billing/plans              planes disponibles
POST /admin/billing/checkout           Stripe Checkout session
POST /admin/billing/portal             Stripe Billing Portal

GET  /admin/merchant                   perfil merchant
PUT  /admin/merchant                   actualizar (incluye googleReviewUrl, country)
POST /admin/onboarding/complete        marcar onboarding completado
```

## Frontend — Design System v2

**Font:** Inter (Google Fonts)
**Clases CSS clave:**
- `.data-card` — card sin padding con `overflow:hidden` para tablas edge-to-edge
- `.data-card-header` — header con padding y flex-wrap
- `.data-card-toolbar` — barra de búsqueda/filtros con fondo slate-50
- `.table-scroll` — wrapper con `overflow-x:auto` para tablas (sin negative margins)
- `.customers-card` — card CON `padding:20px` para bloques de detalle (NO para tablas)
- `.kpi-card` — métrica con hover lift
- `.btn-primary/.btn-secondary/.btn-danger/.btn-ghost` — pill shape, usa `.btn-sm`/`.btn-lg`
- `.status-pill-accepted/.rejected/.pending/.draft` — pills de estado
- `.empty-state` — estado vacío con icono, título y descripción

**Patrón vistas de lista (customersView, invoicesView, quotesListView, productsView, providersView):**
```javascript
// SIEMPRE usar data-card, NO customers-card con tabla dentro
const card = createElement("div", "data-card");
const header = createElement("div", "data-card-header");
const tableScroll = createElement("div", "table-scroll");
const table = createElement("table", "table");
```

**`window.appLocale`** — objeto con `{ quote, quotePlural, quoteNew, quoteVerb, currency, defaultVat, vatName }` disponible tras auth.

**`window.appMerchantId`** — merchantId de la sesión actual.

## i18n

`src/core/i18n/locales.ts` — `getLocale(country)` devuelve config por país:
- ES: Presupuesto / EUR / IVA 21%
- MX: Cotización / MXN / IVA 16%
- CO: Cotización / COP / IVA 19%
- AR: Presupuesto / ARS / IVA 21%
- PE: Cotización / PEN / IGV 18%
- CL: Cotización / CLP / IVA 19%

El PDF usa `params.country` para localizar títulos. La landing también carga el locale del merchant.

## Variables Railway configuradas

```
SESSION_SECRET, RESEND_API_KEY, EMAIL_FROM ✅
DATABASE_URL, PORT, PUBLIC_BASE_URL ✅
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET ✅
WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_BUSINESS_ACCOUNT_ID ✅
AUTO_INVOICE_ON_PAID=true, AUTO_EMAIL_INVOICE_ON_PAID=true ✅
STRIPE_PRICE_ID_BASIC, STRIPE_PRICE_ID_PRO, STRIPE_PRICE_ID_EMPRESA ⏳ (crear en Stripe)
```

## Sprints completados

- ✅ Sprint 1: Migración n8n→Meta API, notificaciones WA, Home KPIs, Quick Quote, CSS mobile-first
- ✅ Sprint 2: Auth magic link, multi-tenant, onboarding, Stripe billing
- ✅ Sprint 3: Firma digital, recordatorio 24h, reseña Google, portal cliente, i18n
- ✅ Sprint 4: Good/Better/Best (3 opciones de precio, landing con tier cards)
- ✅ Sprint 5: PWA, top clientes/servicios, notas internas, módulo gastos, margen real
- ✅ UI Polish: design system v2 (Inter, SVG icons, data-card pattern, design tokens)

## Próximos sprints

- 🔜 Sprint 6: Múltiples usuarios por merchant, roles (admin/técnico)
- Sprint 7: VeriFactu (España), Open Banking
- Sprint 8: Mercado Pago, SPEI/PSE, React Native

## Documento de producto completo

`doc/PRESUFACIL_MASTER.md` — roadmap completo, arquitectura, criterios de éxito.
