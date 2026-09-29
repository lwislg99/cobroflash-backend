---
paths:
  - "src/modules/system/app/routes/quoteDecisionLanding.routes.ts"
  - "src/modules/exports/app/routes/exports.routes.ts"
  - "src/modules/quotes/domain/billingPlan.ts"
  - "src/api/routes.ts"
  - "src/core/flags.ts"
  - "src/app.ts"
  - "src/core/documentos/**"
  - "src/modules/reports/**"
  - "src/core/**"
  - "src/**"
---
# Carril S1 — GENERADO por `scripts/carriles.mjs` desde `docs/equipo/dos-equipos.md` §3. No se edita a mano.

Este fichero es del puesto **S1** (servidor), salvo que lo cubra una fila más específica de otro puesto (abajo).
Si tu puesto no es S1, **no lo edites**: se pide al dueño por Jira (`docs/equipo/dos-equipos.md` §5). Un cruce legítimo se declara en §3.4 con su motivo y se regenera. Lo hace cumplir `.claude/hooks/carril.mjs`.

Contenedores de S1 (cualquier puesto añade SOLO su bloque, marcado con su puesto; nunca reescribe lo ajeno): `src/modules/exports/app/routes/exports.routes.ts`, `src/api/routes.ts`, `src/app.ts`.

Tienen otro dueño aunque casen con los patrones de arriba:
- `src/modules/billing/app/routes/subscriptions.routes.ts` → J3 (docs/equipo/dos-equipos.md:111)
- `src/modules/system/app/routes/customerPortal.routes.ts` → J2 (docs/equipo/dos-equipos.md:114)
- `src/modules/system/app/routes/customersAdmin.routes.ts` → J2 (docs/equipo/dos-equipos.md:114)
- `src/modules/system/domain/identificadoresDuplicados.ts` → J2 (docs/equipo/dos-equipos.md:114)
- `src/modules/system/domain/supresionMerchant.service.ts` → J3 (docs/equipo/dos-equipos.md:117)
- `src/modules/billing/domain/invoiceWhatsApp.service.ts` → J1 (docs/equipo/dos-equipos.md:108)
- `src/modules/system/app/routes/invoicesAdmin.routes.ts` → J1 (docs/equipo/dos-equipos.md:107)
- `src/modules/system/domain/importarClientes.service.ts` → J2 (docs/equipo/dos-equipos.md:114)
- `src/modules/billing/domain/correoDeFacturaEnviado.ts` → J1 (docs/equipo/dos-equipos.md:108)
- `src/modules/messaging/domain/weeklyDigest.service.ts` → J3 (docs/equipo/dos-equipos.md:115)
- `src/modules/messaging/domain/whatsappLog.service.ts` → J2 (docs/equipo/dos-equipos.md:113)
- `src/modules/exports/domain/portabilidadCompleta.ts` → J3 (docs/equipo/dos-equipos.md:117)
- `src/modules/exports/domain/portabilidadRegistro.ts` → J3 (docs/equipo/dos-equipos.md:117)
- `src/modules/system/app/routes/legalPages.routes.ts` → J3 (docs/equipo/dos-equipos.md:118)
- `src/modules/messaging/domain/lifecycle.service.ts` → J3 (docs/equipo/dos-equipos.md:115)
- `src/modules/system/app/routes/supresion.routes.ts` → J3 (docs/equipo/dos-equipos.md:117)
- `src/modules/billing/app/routes/stripe.routes.ts` → J2 (docs/equipo/dos-equipos.md:110)
- `src/modules/billing/domain/envioDelDocumento.ts` → J1 (docs/equipo/dos-equipos.md:108)
- `src/modules/system/domain/anonimizarMerchant.ts` → J3 (docs/equipo/dos-equipos.md:117)
- `src/modules/system/domain/flagFiscal.service.ts` → J1 (docs/equipo/dos-equipos.md:107)
- `src/modules/system/customerEvents.service.ts` → J2 (docs/equipo/dos-equipos.md:114)
- `src/modules/system/domain/borradoMerchant.ts` → J3 (docs/equipo/dos-equipos.md:117)
- `src/modules/billing/domain/stripePrices.ts` → J3 (docs/equipo/dos-equipos.md:111)
- `src/integrations/whatsappNotifications.ts` → J2 (docs/equipo/dos-equipos.md:113)
- `src/modules/billing/domain/founding.ts` → J3 (docs/equipo/dos-equipos.md:111)
- `src/integrations/whatsappTemplates.ts` → J2 (docs/equipo/dos-equipos.md:113)
- `src/modules/system/domain/soporte.ts` → J3 (docs/equipo/dos-equipos.md:115)
- `src/modules/system/tagsDelCliente.ts` → J2 (docs/equipo/dos-equipos.md:114)
- `src/modules/system/customerAdmin.ts` → J2 (docs/equipo/dos-equipos.md:114)
- `src/modules/system/merchantAdmin.ts` → J3 (docs/equipo/dos-equipos.md:116)
- `src/integrations/whatsappPolicy.ts` → J2 (docs/equipo/dos-equipos.md:113)
- `src/modules/system/invoiceAdmin.ts` → J1 (docs/equipo/dos-equipos.md:107)
- `src/integrations/mercadopago.ts` → J2 (docs/equipo/dos-equipos.md:112)
- `src/integrations/whatsapp.ts` → J2 (docs/equipo/dos-equipos.md:113)
- `src/integrations/stripe.ts` → J2 (docs/equipo/dos-equipos.md:112)
- `src/prisma/schema.prisma` → sin cerradura (docs/equipo/dos-equipos.md:126)
- `src/lib/invoicing.ts` → J1 (docs/equipo/dos-equipos.md:106)
- `src/modules/whatsappBot/**` → J2 (docs/equipo/dos-equipos.md:113)
- `src/modules/invoicing/**` → J1 (docs/equipo/dos-equipos.md:106)
- `src/modules/payments/**` → J2 (docs/equipo/dos-equipos.md:112)
- `src/modules/billing/**` → J2 (docs/equipo/dos-equipos.md:109)
- `src/modules/fiscal/**` → J1 (docs/equipo/dos-equipos.md:106)
- `src/modules/auth/**` → J3 (docs/equipo/dos-equipos.md:115)
