# CLAUDE.md

# PresuFácil / CobroFlash — Contexto del proyecto

## Qué es este proyecto
SaaS WhatsApp-first para profesionales de servicios (fontaneros, electricistas, reformistas) en LATAM.
El ciclo completo es: cotización → WhatsApp → aceptación del cliente → factura automática → cobro integrado.

## Stack
- Backend: Node.js + TypeScript + Express + Prisma + PostgreSQL
- Deploy: Railway (auto-deploy desde GitHub)
- Pagos: Stripe
- WhatsApp: Meta Cloud API directa (NO n8n, ya migrado en quotesAdmin)
- Frontend: HTML/JS vanilla en /public/dashboard/

## Reglas importantes
- merchantId=1 hardcodeado en merchantAdmin.ts (se cambiará en Sprint 2 con auth)
- NUNCA usar n8n — todo WhatsApp va por src/integrations/whatsapp.ts
- El PDF de presupuestos se genera con generateQuotePdf() de src/lib/pdf.ts
- Todas las rutas admin van bajo /admin/*
- El frontend usa vanilla JS sin frameworks

## Comandos
- Instalar: npm install
- Dev: npm run dev
- Build: npm run build
- Seed DB: npx prisma db seed

## Documento de producto
Ver docs/MASTER.md para el roadmap completo, sprints y decisiones de producto.






This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CobroFlash is a payment collection backend for Spanish and Mexican merchants, supporting bank transfers and card payments via WhatsApp. Core features: charges, invoicing, quotes with flexible billing plans, and PDF generation.

**Tech Stack:** Node.js + TypeScript, Express.js 5.x, PostgreSQL via Prisma 6.x, Zod validation, Stripe SDK, PDFKit, n8n webhooks, WhatsApp Business API.

## Commands

```bash
npm run dev              # Development with hot reload (ts-node-dev)
npm run build            # Compile TypeScript to dist/
npm start                # Run compiled app

npm run prisma:generate  # Regenerate Prisma client after schema changes
npm run prisma:migrate   # Run pending migrations
npm run prisma:studio    # Open Prisma Studio (web UI)
npm run db:seed          # Run prisma/seed.ts
```

Always run `npm run prisma:generate` after any `schema.prisma` change.

No test framework is configured.

## Architecture

Modular, domain-driven layout under `src/`:

```
src/
├── index.ts / app.ts         # Entry + Express app, route mounting
├── core/
│   ├── config/env.ts         # All env vars parsed here (source of truth)
│   ├── db/prisma.ts          # Prisma client singleton
│   ├── http/                 # asyncHandler, jsonError, notFound middleware
│   ├── storage/dirs.ts       # Paths for invoice/outbox files
│   ├── utils/utils.ts        # normalizePhone(), makeReference(), etc.
│   └── validation/schemas.ts # Central Zod schemas used across modules
├── lib/
│   ├── invoicing.ts          # ensureInvoiceForCharge(), invoice lifecycle
│   ├── pdf.ts                # PDFKit helpers
│   └── email.ts              # Email composition
├── integrations/             # stripe.ts, mailer.ts, n8n.ts, whatsapp.ts
└── modules/                  # Feature modules (see pattern below)
    ├── billing/              # Charges, payments, Stripe/PSP webhooks
    ├── invoicing/            # Invoice generation & management
    ├── messaging/            # Email/notification services
    ├── products/             # Product catalog (CSV import/export)
    ├── providers/            # Supplier management
    ├── quotes/               # Proposals, acceptance flow, billing plans
    └── system/               # Admin: merchants, customers, admin invoices
```

### Module Pattern

Every module follows a 3-layer convention:

1. **`app/routes/`** — Express routers. Parse/validate input with Zod, delegate to domain, return JSON.
2. **`domain/`** — Business logic services. Direct Prisma calls; no HTTP concerns.
3. **`infra/`** (optional) — External service wrappers (PDF generation, etc.).

There is no separate repository layer — domain services call `prisma` directly.

### Route Mounting (`src/app.ts`)

| Path | Module |
|---|---|
| `/charges` | billing |
| `/quote` | quotes |
| `/invoice` | invoicing |
| `/pay/bank/:id`, `/pay/card/:id` | payment landing pages |
| `/webhooks/stripe` | billing (raw body — mounted **before** JSON parser) |
| `/webhooks/psp` | billing |
| `/admin/*` | system module |

**Important:** Stripe webhook route must come before Express JSON middleware to receive the raw body.

## Database Schema Highlights

Multi-tenant design — most tables include `merchantId`.

- **Merchant** — Business account with fiscal config (legal name, tax ID, invoice series prefix, logo)
- **Customer** — Contacts (name, phone, email) per merchant
- **Charge** — Payment request; statuses: `pending`, `paid`, `expired`, `failed`
- **Event** — Audit log for charge lifecycle (`created`, `sent`, `paid`, `invoiced`, etc.)
- **Quote** — Proposal with payment terms; acceptance tracked with channel/comment/evidence
- **Invoice** — Billing document auto-generated from a paid Charge or accepted Quote
- **Product** — Catalog item; `nameSearch` field stores NFD-normalized lowercase for accent-insensitive search
- **Provider** — Supplier records

### Payment Plans (`modules/quotes/domain/billingPlan.ts`)

Quotes support `FULL_UPFRONT`, `FIFTY_FIFTY`, and `MANUAL` billing plan types that auto-generate invoice batches on acceptance.

## Key Patterns

### Validation

All Zod schemas live in `src/core/validation/schemas.ts`. Routes import and call `.parse()` (throws on failure) or `.safeParse()` (returns result). Errors return JSON with `error` string and optional `details`.

### Prisma Usage

```typescript
import { prisma } from '../../../core/db/prisma';

// Standard queries
await prisma.product.findMany({ where: { merchantId }, orderBy: { id: 'desc' } });

// Transactions for multi-step writes
await prisma.$transaction([
  prisma.quote.update(...),
  prisma.invoice.create(...)
]);
```

### Environment Variables

Parsed and exported from `src/core/config/env.ts`. Key vars:

```
DATABASE_URL, PORT, NODE_ENV, PUBLIC_BASE_URL
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
SMTP_URL, EMAIL_FROM
AUTO_INVOICE_ON_PAID, AUTO_EMAIL_INVOICE_ON_PAID
N8N_ONPAID_URL, N8N_ONFAILED_URL, N8N_ONSEND_URL, N8N_ONEXPIRED_URL, N8N_TOKEN
WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID, WHATSAPP_ACCESS_TOKEN
```

### Invoice Generation

`ensureInvoiceForCharge()` in `src/lib/invoicing.ts` is the canonical entry point. It requires the charge to be `paid`, creates an `Invoice` record with the next sequential number, generates a PDF, and records an `invoiced` event. Called from `/invoice/issue` and auto-triggered by webhooks when `AUTO_INVOICE_ON_PAID=true`.

### Product Search

`nameSearch` column stores NFD-normalized, lowercased, diacritics-stripped product names, enforced as unique per merchant. Used for accent-insensitive duplicate detection and search queries.

### Phone Normalization

`normalizePhone()` in `src/core/utils/utils.ts` standardizes phone numbers for WhatsApp/SMS delivery.
