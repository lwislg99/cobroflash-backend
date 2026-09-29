---
paths:
  - "src/modules/system/app/routes/customerPortal.routes.ts"
  - "src/modules/system/app/routes/customersAdmin.routes.ts"
  - "src/modules/system/domain/identificadoresDuplicados.ts"
  - "src/modules/system/domain/importarClientes.service.ts"
  - "src/modules/messaging/domain/whatsappLog.service.ts"
  - "src/modules/billing/app/routes/stripe.routes.ts"
  - "public/dashboard/js/formaDePagoPorDefecto.js"
  - "src/modules/system/customerEvents.service.ts"
  - "public/dashboard/js/selectorMetodoCobro.js"
  - "public/dashboard/js/switchFormaJuridica.js"
  - "public/dashboard/js/buscadorDeClientes.js"
  - "public/dashboard/js/customerDetailView.js"
  - "src/integrations/whatsappNotifications.ts"
  - "public/dashboard/js/paidViaEtiquetas.js"
  - "public/dashboard/js/filtroClientes.js"
  - "src/integrations/whatsappTemplates.ts"
  - "public/dashboard/js/customersView.js"
  - "src/modules/system/tagsDelCliente.ts"
  - "src/modules/system/customerAdmin.ts"
  - "src/integrations/whatsappPolicy.ts"
  - "public/dashboard/js/cobrosView.js"
  - "public/dashboard/js/csvImport.js"
  - "src/integrations/mercadopago.ts"
  - "src/integrations/whatsapp.ts"
  - "src/integrations/stripe.ts"
  - "src/modules/whatsappBot/**"
  - "src/modules/payments/**"
  - "src/modules/billing/**"
---
# Carril J2 — GENERADO por `scripts/carriles.mjs` desde `docs/equipo/dos-equipos.md` §3. No se edita a mano.

Este fichero es del puesto **J2** (Clientes y cobro (el CRM)), salvo que lo cubra una fila más específica de otro puesto (abajo).
Si tu puesto no es J2, **no lo edites**: se pide al dueño por Jira (`docs/equipo/dos-equipos.md` §5). Un cruce legítimo se declara en §3.4 con su motivo y se regenera. Lo hace cumplir `.claude/hooks/carril.mjs`.

Contenedores de J2 (cualquier puesto añade SOLO su bloque, marcado con su puesto; nunca reescribe lo ajeno): `src/modules/billing/app/routes/stripe.routes.ts`.

Tienen otro dueño aunque casen con los patrones de arriba:
- `src/modules/billing/app/routes/subscriptions.routes.ts` → J3 (docs/equipo/dos-equipos.md:111)
- `src/modules/billing/domain/invoiceWhatsApp.service.ts` → J1 (docs/equipo/dos-equipos.md:108)
- `src/modules/billing/domain/correoDeFacturaEnviado.ts` → J1 (docs/equipo/dos-equipos.md:108)
- `src/modules/billing/domain/envioDelDocumento.ts` → J1 (docs/equipo/dos-equipos.md:108)
- `src/modules/billing/domain/stripePrices.ts` → J3 (docs/equipo/dos-equipos.md:111)
- `src/modules/billing/domain/founding.ts` → J3 (docs/equipo/dos-equipos.md:111)
