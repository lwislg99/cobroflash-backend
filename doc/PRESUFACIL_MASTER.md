# PRESUFÁCIL — DOCUMENTO ÚNICO DE PRODUCTO
**Versión 2.0 | Mayo 2026 | Documento vivo — actualizar en cada sprint**

---

# PARTE A — NORTE CLARO (nunca cambiar sin debatirlo)

## A1. Qué somos en una frase

PresuFácil permite a cualquier profesional de servicios (fontanero, electricista, reformista, pintor, cerrajero) **crear una cotización profesional en menos de 30 segundos, enviarla por WhatsApp, que el cliente la acepte con un toque, y cobrar sin salir de la conversación.**

## A2. Para quién es (ICP — Ideal Customer Profile)

**Cliente principal:** Profesional independiente o pequeño equipo (1-5 personas) que trabaja por proyecto/presupuesto en servicios a domicilio.

**Geografía:** México y Colombia (lanzamiento). España fase 2. Argentina, Perú, Chile siguientes.

**Perfil:**
- 30-55 años, usa el móvil para todo
- Hace presupuestos en papel o WhatsApp de texto
- Pierde trabajos por tardar en responder o parecer poco profesional
- No quiere software complicado

## A3. Propuesta de valor

**Para el profesional:** "Envías la cotización en 30 segundos. El cliente la acepta desde el móvil. Cobras antes de empezar. Sin Excel, sin papel, sin perseguir al cliente."

## A4. Modelo de negocio

| Plan | Precio | Objetivo |
|---|---|---|
| Trial | Gratis 14 días | Adquisición |
| Básico | $9/mes | Entrada |
| Pro | **$19/mes** ← sweet spot | Monetización |
| Empresa | $39/mes | Retención larga |

**Métrica norte:** Cotizaciones enviadas por WhatsApp por semana activa.

---

# PARTE B — ESTADO ACTUAL Y ROADMAP

## Estado del código (Mayo 2026 — post Sprint 5 + UI Polish)

### ✅ COMPLETADO — Sprint 1 "Que funcione end-to-end"

- **n8n eliminado al 100%** — todo WhatsApp via Meta Cloud API directa
- **Notificación al profesional** cuando cliente acepta/rechaza cotización
- **Home dashboard** con 3 KPIs: pendiente cobrar, cotizaciones sin respuesta, cobrado este mes
- **Actividad reciente** en el feed de la Home
- **Quick Quote modal** — nueva cotización en <30 segundos con autocomplete
- **CSS mobile-first** — bottom navigation en móvil, touch targets 44px
- **Landing de decisión mejorada** — logo, líneas, total, condiciones de pago, responsive
- **PSP routes** — notificación WhatsApp al merchant al cobrar, sin n8n

### ✅ COMPLETADO — Sprint 2 "Que se pueda vender"

- **Auth magic link** — login sin contraseña via email (Resend HTTP API)
- **Registro** — `/register.html` con trial 14 días, sin tarjeta
- **Multi-tenant real** — todos los datos filtrados por merchantId de sesión
- **Cookie httpOnly** `pf_session` (30 días), magic link (15 min, un solo uso)
- **Middleware auth** protege todos los `/admin/*`
- **GET /admin/me** — perfil de sesión con locale
- **Onboarding wizard** 3 pasos al primer login (negocio, WhatsApp, primer servicio)
- **Stripe Billing** — planes, checkout, portal de gestión
- **Webhooks Stripe** — `subscription.updated/deleted` actualizan `merchant.plan`
- **Bloqueo soft trial** — 403 tras 14 días sin plan en operaciones de escritura
- **Variables Railway** configuradas: SESSION_SECRET, RESEND_API_KEY, EMAIL_FROM

### ✅ COMPLETADO — Sprint 3 "Que sea irresistible"

- **3.1 Firma digital** — canvas touch/mouse en landing, base64 PNG en DB, PDF con firma
- **3.3 Recordatorio automático 24h** — cron node-cron cada hora, `reminderSentAt` para idempotencia
- **3.4 Reseña Google al cobrar** — WhatsApp automático al cliente tras pago, configurable en Settings
- **3.5 Portal del cliente** — URL `/cliente/:token` con cotizaciones, facturas y botón "Pagar ahora"
- **3.6 i18n básico** — es-ES/es-MX/es-CO/es-AR/es-PE/es-CL: término (Cotización/Presupuesto), moneda, IVA

### ✅ COMPLETADO — Sprint 4 "Que genere más dinero"

- **Good/Better/Best** — 3 opciones de precio por cotización (+30% ticket medio documentado)
  - Profesional define Básico/Estándar/Premium con distintas líneas y precios
  - Cliente ve 3 cards en la landing, elige con un toque
  - La firma y aceptación registran qué tier eligió
  - Factura se genera por el importe del tier elegido
  - PDF con layout 3 columnas, Estándar destacado en verde
  - BO muestra qué tier eligió el cliente

### ❌ Pendiente — Sprint 3 parcial

- **3.2 Fotos del trabajo** — necesita Cloudflare R2 o S3

---

## ROADMAP PRIORIZADO (post Sprint 4)

### SPRINT 5 — "Que los usuarios vuelvan" ✅ COMPLETADO

| # | Feature | Estado |
|---|---|---|
| 5.1 | PWA instalable (manifest.json + sw.js + meta tags iOS) | ✅ |
| 5.2 | Top 5 clientes (por €facturado) + Top 5 servicios (por frecuencia) en Home | ✅ |
| 5.3 | Notas internas por cotización — autoguardado 1.2s, badge "Solo tú las ves" | ✅ |
| 5.4 | Módulo de gastos — CRUD, categorías, foto del ticket, link a cotización | ✅ |
| 5.5 | Margen real: Ingresos − Gastos en detalle de cotización + beneficio neto en Home | ✅ |
| UI | Design system v2: Inter, SVG icons, data-card pattern, CSS vars, mobile polish | ✅ |

### SPRINT 6 — "Que escale al equipo" 🔜 SIGUIENTE

**Objetivo:** Un merchant puede tener varios usuarios (técnicos) bajo su cuenta.

| # | Feature | Detalle técnico | Esfuerzo |
|---|---|---|---|
| 6.1 | **Múltiples usuarios** — invitar por email, sesión propia | Nuevo modelo `User { merchantId, email, role }`. Auth service adaptado para User además de Merchant. | Alto |
| 6.2 | **Roles: Admin / Técnico** | Admin: todo. Técnico: crear/ver quotes propias, sin facturación ni configuración. Middleware `requireRole`. | Medio |
| 6.3 | **Asignación de trabajo** — quote.assignedTo (User) | Campo en Quote. Vista filtrada por técnico. Notificación WA al técnico asignado. | Medio |
| 6.4 | **Mini-proyectos** — checklist vinculado a quote | Nuevo modelo `Checklist { quoteId, items: Json }`. Vista en detalle de cotización. | Medio |

**Schema changes Sprint 6:**
```sql
model User {
  id         Int      @id @default(autoincrement())
  merchantId Int
  email      String   @unique
  name       String
  role       String   @default("technician")  -- admin | technician
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
}
ALTER TABLE auth_sessions ADD COLUMN user_id INT NULL;  -- nullable, merchant sessions no tienen user
ALTER TABLE quotes ADD COLUMN assigned_to_id INT NULL;  -- FK → users
model Checklist {
  id      Int    @id @default(autoincrement())
  quoteId Int
  items   Json   -- [{ text, done, doneAt }]
}
```

### SPRINT 7 — "España y VeriFactu"

| # | Feature | Impacto | Estado |
|---|---|---|---|
| 7.1 | VeriFactu compliance — QR obligatorio, registro SIF | Crítico ES | ⏳ |
| 7.2 | Modelos 303/130 — preparación trimestre fiscal | Alto ES | ⏳ |
| 7.3 | Open Banking — conciliación automática transferencias | Alto | ⏳ |

### SPRINT 8 — "Toda LATAM"

| # | Feature | Estado |
|---|---|---|
| 8.1 | Mercado Pago (MX, AR, CO, BR) | ⏳ |
| 8.2 | SPEI (México) y PSE (Colombia) | ⏳ |
| 8.3 | CFDI 4.0 (México — solo empresa grande) | ⏳ |
| 8.4 | PWA → App nativa React Native | ⏳ |
| 8.5 | pt-BR (Brasil) | ⏳ |

### SPRINT 9 — "Diferenciación IA"

| # | Feature | Estado |
|---|---|---|
| 9.1 | Sugerencia de precios por zona y servicio | ⏳ |
| 9.2 | Dictado por voz → cotización automática | ⏳ |
| 9.3 | OCR tickets de gastos → extracción automática | ⏳ |
| 9.4 | Plantillas sectoriales (electricista CDMX, plomero Bogotá…) | ⏳ |
| 9.5 | API pública para integraciones | ⏳ |

---

# PARTE C — ARQUITECTURA TÉCNICA ACTUAL

## Stack completo

```
Backend:    Node.js + TypeScript + Express 5 + Prisma 6 + PostgreSQL
Deploy:     Railway (auto-deploy desde GitHub main)
Pagos:      Stripe (tarjeta) + PSP custom (banco)
WhatsApp:   Meta Cloud API directa (NO n8n)
Email:      Resend HTTP API
PDF:        PDFKit
Frontend:   HTML/JS vanilla en /public/dashboard/
```

## Stack completo (actualizado Mayo 2026)

```
Backend:    Node.js + TypeScript + Express 5 + Prisma 6 + PostgreSQL
Deploy:     Railway (auto-deploy desde GitHub main)
URL:        https://cobroflash-backend-production.up.railway.app
Pagos:      Stripe (tarjeta) + PSP custom (banco)
WhatsApp:   Meta Cloud API directa (NUNCA n8n)
Email:      Resend HTTP API (no SMTP)
PDF:        PDFKit
Cron:       node-cron (recordatorio 24h dentro del proceso)
PWA:        manifest.json + sw.js (cache shell)
Frontend:   HTML/JS vanilla, Inter font, CSS vars design system v2
```

## Módulos implementados

```
src/
├── core/
│   ├── config/env.ts          Variables de entorno tipadas
│   ├── db/prisma.ts           Cliente Prisma singleton
│   ├── http/authMiddleware.ts requireAuth, requireActivePlan, setCookie
│   ├── i18n/locales.ts        Diccionario por país (ES/MX/CO/AR/PE/CL)
│   └── cron/cron.ts           Jobs periódicos (recordatorio 24h)
├── modules/
│   ├── auth/                  Magic link, sesiones, registro
│   ├── billing/               Charges, PSP webhook, Stripe webhook, suscripciones
│   ├── invoicing/             Facturas + PDF
│   ├── messaging/             Email
│   ├── metrics/               Home metrics
│   ├── products/              Catálogo, autocomplete, CSV
│   ├── providers/             Proveedores
│   ├── quotes/                Cotizaciones, billingPlan, reminder, Good/Better/Best
│   └── system/                Admin routes, merchant, customers, portal cliente
└── integrations/
    ├── whatsapp.ts            sendWhatsAppTemplate, sendWhatsAppText
    ├── stripe.ts              Cliente Stripe
    ├── mailer.ts              Nodemailer (fallback SMTP)
    └── n8n.ts                 Archivo legacy, NO USAR
```

## Modelos de datos clave

| Modelo | Campos clave añadidos en Sprints 1-4 |
|---|---|
| Merchant | email, plan, planExpiresAt, stripeCustomerId, onboardingCompleted, googleReviewUrl, country |
| AuthSession | token, type (magic_link/session), expiresAt, usedAt |
| Customer | merchantId, portalToken |
| Quote | tiers, selectedTierId, signatureUrl, reminderSentAt, paymentTerms |
| Invoice | status, paidAt, chargeId |

## Flujo completo end-to-end

```
Profesional (dashboard) →
  Crea cotización (Quick Quote o full form)
    ↓ Opción GBB: 3 tiers Básico/Estándar/Premium
  Envía por WhatsApp → plantilla quote_decision_es
    ↓
Cliente (móvil, link WhatsApp) →
  Ve landing: logo merchant, líneas/tiers, total
  Elige tier (si GBB)
  Dibuja firma o acepta sin firma
  Confirma
    ↓ webhook /quote/:id/decision
  PDF regenerado con firma incluida
  Factura creada (importe del tier elegido)
  WhatsApp al profesional: "✅ Cliente aceptó"
    ↓ si FULL_UPFRONT
  Factura enviada al cliente por WhatsApp (payment_request_es)
  Cliente abre /pay/card/:id → paga con tarjeta (Stripe)
    ↓ Stripe webhook → PSP webhook
  Factura marcada como paid
  WhatsApp al profesional: "💰 Pago recibido"
  WhatsApp al cliente: solicitud reseña Google (si configurado)
    ↓ cron cada hora
  Si cotización sin respuesta >24h → recordatorio WhatsApp al cliente
```

## Variables de entorno Railway (configuradas)

```
DATABASE_URL            ✅
SESSION_SECRET          ✅
RESEND_API_KEY          ✅
EMAIL_FROM              ✅
STRIPE_SECRET_KEY       ✅
STRIPE_WEBHOOK_SECRET   ✅
WHATSAPP_PHONE_NUMBER_ID ✅
WHATSAPP_ACCESS_TOKEN   ✅
WHATSAPP_BUSINESS_ACCOUNT_ID ✅
PUBLIC_BASE_URL         ✅
AUTO_INVOICE_ON_PAID    ✅
STRIPE_PRICE_ID_BASIC   ⏳ pendiente crear en Stripe
STRIPE_PRICE_ID_PRO     ⏳ pendiente crear en Stripe
STRIPE_PRICE_ID_EMPRESA ⏳ pendiente crear en Stripe
```

## Rutas públicas (sin auth)

```
GET  /health                   Health check + DB ping
POST /auth/login               Solicitar magic link
GET  /auth/verify?token=xxx    Verificar magic link → cookie sesión
POST /auth/register            Crear cuenta merchant
POST /auth/logout              Borrar sesión
GET  /pay/quote/:id/accept     Landing aceptación con firma + GBB
GET  /pay/quote/:id/reject     Landing rechazo
GET  /pay/card/:id             Checkout Stripe
GET  /pay/bank/:id             Pago por transferencia
GET  /cliente/:token           Portal del cliente
POST /quote/create             Crear cotización (llamada desde dashboard)
POST /quote/:id/decision       Decisión del cliente
POST /webhooks/psp             Webhook pagos bancarios
POST /webhooks/stripe          Webhook Stripe
```

## Rutas admin (requieren cookie pf_session)

```
GET  /admin/me                          Perfil sesión + locale
GET  /admin/customers                   Lista clientes del merchant
GET  /admin/customers/:id/portal-url    URL portal del cliente
GET  /admin/quotes                      Lista cotizaciones
GET  /admin/quotes/:id                  Detalle (incl. tiers, firma)
POST /admin/quotes/:id/send-whatsapp    Enviar cotización WA (marca 'sent')
POST /admin/quotes/:id/accept|reject    Aceptar/rechazar desde BO
POST /admin/invoices/:id/resend-whatsapp Reenviar factura WA
GET  /admin/invoices                    Lista facturas
GET  /admin/metrics/home                KPIs: pendiente, awaiting, cobrado mes
GET  /admin/products/autocomplete       Autocomplete catálogo
POST /admin/billing/checkout            Crear Stripe Checkout
POST /admin/billing/portal              Portal gestión suscripción
GET  /admin/merchant                    Perfil merchant (con googleReviewUrl)
PUT  /admin/merchant                    Actualizar perfil
POST /admin/onboarding/complete         Marcar onboarding como completado
```

---

# PARTE D — CRITERIOS DE ÉXITO

## Ya conseguidos ✅
- Flujo completo cotización → WA → firma → factura → cobro en producción
- Multi-tenant real (datos aislados por merchant)
- Auth sin contraseña (magic link)
- 3 opciones de precio (Good/Better/Best)
- Portal del cliente con historial
- Recordatorio automático 24h
- Reseña Google automática al cobrar
- i18n básico (6 países LATAM + España)

## Para los próximos 30 días (Sprint 5)
- [ ] PWA instalable desde el navegador (manifest + service worker)
- [ ] Top 5 clientes y top 5 servicios en el dashboard
- [ ] Módulo de gastos básico
- [ ] Margen real visible en cada cotización
- [ ] Primer merchant pagante ($19/mes)

## Para escalar (Sprint 6+)
- [ ] Múltiples usuarios por cuenta
- [ ] VeriFactu (España, 2026)
- [ ] Mercado Pago (LATAM)

---

*Versión 2.0 — actualizado Mayo 2026 tras completar Sprints 1-4*
*Reemplaza: PRESUFACIL_MASTER v1.0*
