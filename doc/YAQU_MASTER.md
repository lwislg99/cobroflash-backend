# YAQU — DOCUMENTO MAESTRO DE PRODUCTO
**Versión 4.0 | Mayo 2026 | Documento vivo — actualizar en cada sprint**

> **IMPORTANTE — Cómo usar este documento:**
> - **Parte A:** Estrategia y norte. Leer antes de CUALQUIER decisión.
> - **Parte B:** Inventario completo de features (lo que existe HOY).
> - **Parte C:** Bugs conocidos y deuda técnica.
> - **Parte D:** Plan de sprints completo hasta producto de $1M ARR.
> - **Parte E:** Estrategia de negocio, precios y GTM.
> - **Parte F:** Stack técnico y arquitectura.
> - **Parte G:** Configuración de plataformas externas.
> - **Parte H:** Tareas detalladas para Claude Code (ejecutar en orden).
> - **En cada nuevo chat con IA:** pegar Parte A + la tarea específica del sprint activo.

---

# PARTE A — NORTE CLARO (nunca cambiar sin debatirlo)

## A1. Qué es YaQu en una frase

**YaQu** ("Ya te mando el quote") permite a cualquier profesional de servicios (fontanero, electricista, reformista, pintor, cerrajero) **crear una cotización profesional en menos de 30 segundos, enviarla por WhatsApp, que el cliente la acepte con un toque y firme con el dedo, y cobrar antes de empezar el trabajo — sin salir de la conversación.**

**Dominio:** yaqu.app (comprado, DNS activo)
**URL producción:** https://yaqu.app
**Repo:** https://github.com/lwislg99/cobroflash-backend

## A2. Para quién es (ICP — Ideal Customer Profile)

**Cliente principal:** Profesional independiente o pequeño equipo (1-10 personas) que trabaja por proyecto/presupuesto en servicios a domicilio.

**Geografía por prioridad:**
1. México (lanzamiento — mayor mercado, menor regulación, WhatsApp dominante)
2. Colombia (lanzamiento simultáneo o mes 2)
3. España (fase 2, 2026-2027, impulsado por VeriFactu obligatorio)
4. Argentina, Perú, Chile (fase 3)

**Perfil psicográfico del cliente:**
- Tiene 30-55 años. Usa el móvil para TODO.
- Hace sus presupuestos en WhatsApp con texto libre o foto de papel.
- Pierde trabajos porque tarda en responder o el presupuesto no parece profesional.
- No quiere software complicado — quiere algo que funcione en 5 minutos.
- Su principal dolor: perseguir al cliente para que acepte y pague.

**Para directores de empresa (venta B2B):**
- Equipos de 5-20 técnicos (instaladoras, reformistas, empresas de mantenimiento)
- Necesitan control: ver qué cotiza cada técnico, aprobar antes de enviar
- Necesitan reporting: qué técnico tiene más cierre, qué servicio da más margen
- Necesitan marca: que el cliente vea LA EMPRESA, no el técnico individual
- Esto justifica un precio de $39-99/mes y es la palanca de escala

## A3. El problema real (validado con datos)

El 80% de los profesionales de servicios gestionan sus ventas así hoy:
1. Van a la obra, evalúan el trabajo
2. Escriben el presupuesto en papel, WhatsApp o Excel (30-90 minutos)
3. Lo mandan por WhatsApp como texto o foto
4. Esperan. A veces el cliente no responde. No hacen seguimiento.
5. Si el cliente acepta, facturan días después o nunca
6. Cobran en efectivo sin registro

**Consecuencia medida:** Tasa de cierre del 35-40%.
**Con seguimiento profesional y cotización visual:** 60-75% (Housecall Pro, 2024).
**Diferencia:** +2-3 trabajos al mes sin conseguir más clientes.

## A4. El diferenciador que nadie puede copiar rápido

**El ciclo completo WhatsApp-first:** cotización → firma digital con evidencia legal → factura automática → cobro integrado, TODO dentro del flujo de WhatsApp.

Ningún competidor en LATAM tiene esto funcionando.

| Competidor | WA nativo | Firma digital | Cobro integrado | LATAM | Precio |
|---|---|---|---|---|---|
| Jobber | ❌ email | ❌ | ⚠️ externo | ❌ | $39-249/mes |
| Housecall Pro | ❌ SMS | ❌ | ✅ | ❌ | $69+/mes |
| Cotiza Pro (MX) | ⚠️ PDF | ❌ | ❌ | ✅ | Gratis |
| PresuNow (ES) | ✅ | ❌ | ❌ | ❌ ES only | €12-29/mes |
| **YaQu** | **✅ nativo** | **✅ legal** | **✅ Stripe/MP** | **✅** | **$19/mes** |

## A5. Métricas norte

- **Métrica primaria:** Cotizaciones enviadas por WhatsApp por semana activa.
- **Objetivo mes 3:** ≥10 cotizaciones/semana por merchant activo.
- **MRR objetivo mes 6:** $1.520 (80 pagantes)
- **MRR objetivo mes 12:** $3.800 (200 pagantes)
- **MRR objetivo mes 24:** $26.600 (1.400 pagantes)
- **$1M ARR:** ~4.400 pagantes (0.1% de los 4M de profesionales de oficios en México)

## A6. Lo que NO construimos en fase 1

❌ Contabilidad completa (libros, modelos 303/130 más allá de exportación)
❌ Open Banking / conciliación bancaria automática
❌ App nativa iOS/Android (la PWA es suficiente)
❌ API pública para terceros
❌ Chat integrado entre profesional y cliente
❌ CRM con pipeline de ventas complejo

---

# PARTE B — INVENTARIO COMPLETO DE FEATURES (estado actual)

> Actualizar tras cada sprint. ✅ = funciona | ⚠️ = parcial/bug | ❌ = no existe.

## B1. Autenticación y usuarios

| Feature | Estado | Descripción |
|---|---|---|
| Registro de cuenta | ✅ | `/register.html` — nombre, email, país. Trial 14 días sin tarjeta. |
| Login magic link | ✅ | Email con enlace de un solo uso (15 min), sin contraseña. |
| Sesión persistente | ✅ | Cookie httpOnly `pf_session`, 30 días. |
| Multi-tenant real | ✅ | Todas las queries filtran por `merchantId` de sesión. |
| Equipo — invitar miembro | ✅ | Admin invita por email, magic link de 7 días. |
| Equipo — roles Admin/Técnico | ✅ | Admin: acceso total. Técnico: crear/ver cotizaciones, sin billing ni config. |
| Equipo — suspender/reactivar | ✅ | Invalida sesiones activas del técnico. |
| Bloqueo soft post-trial | ✅ | 403 en escritura tras 14 días. Datos legibles. |

## B2. Onboarding y configuración

| Feature | Estado | Descripción |
|---|---|---|
| Wizard de onboarding (3 pasos) | ✅ | Nombre negocio, WhatsApp, primer servicio. Solo primera vez. |
| Setup checklist en Home | ✅ | Pasos pendientes: logo, datos fiscales, WA, primer presupuesto. |
| Configuración — datos empresa | ✅ | Nombre, razón social, NIF/CIF, dirección, moneda, prefijo facturas, logo. |
| Configuración — país y locale | ✅ | ES/MX/CO/AR/PE/CL. Cambia terminología, moneda, IVA. |
| Configuración — IBAN/CLABE | ✅ | Se muestra en la página de pago por transferencia. |
| Configuración — reseñas Google | ✅ | URL para solicitud automática de reseña al cobrar. |
| Configuración — emails notificación | ✅ | Toggle: email cuando paga / cuando acepta. |
| Resumen semanal por email | ⚠️ | Backend implementado en `weeklyDigest.service.ts`, checkbox en UI falta restaurar. |

## B3. Presupuestos / Cotizaciones

| Feature | Estado | Descripción |
|---|---|---|
| Formulario completo de cotización | ✅ | Múltiples líneas, autocomplete catálogo, markup %, IVA, preview tiempo real. |
| Quick Quote modal (30 segundos) | ✅ | Cliente + concepto + precio + condiciones. Desde Home. |
| Good/Better/Best (3 opciones) | ✅ | 3 tiers Básico/Estándar/Premium. El cliente elige. |
| Sugerir líneas con IA (Claude) | ✅ | Describe el trabajo, Claude propone líneas usando catálogo. |
| Generar mensaje WhatsApp con IA | ✅ | Claude redacta mensaje personalizado para acompañar cotización. |
| Plantillas de cotización | ✅ | Guardar y cargar plantillas reutilizables. |
| Duplicar cotización | ✅ | Nueva cotización con mismas líneas. |
| Notas internas | ✅ | Texto privado por cotización, autoguardado 1.2s. |
| PDF de cotización | ✅ | Logo, datos merchant/cliente, líneas, total, footer. |
| PDF con firma digital | ✅ | Se regenera el PDF incluyendo imagen de firma. |
| Enviar por WhatsApp | ✅ | Meta Cloud API directa, plantilla `quote_decision_es`. Marca status='sent'. |
| Recordatorio automático 24h | ✅ | Cron cada hora. >24h sin respuesta → reenvía plantilla al cliente. |
| Historial con filtros | ✅ | Búsqueda, estado, fechas, exportar CSV. |
| Detalle de cotización | ✅ | Estado, cliente, líneas, totales, decisión, facturas, margen, notas. |

## B4. Landing del cliente

| Feature | Estado | Descripción |
|---|---|---|
| Landing de aceptación | ✅ | Responsive mobile-first. Logo merchant, líneas, total, condiciones. |
| Firma digital con canvas táctil | ✅ | Dibuja con dedo. Opción "Acepto sin firma". |
| Selección de tier (GBB) | ✅ | 3 opciones con precios. El cliente elige antes de firmar. |
| Landing de rechazo con motivo | ✅ | Formulario con motivo y comentario libre. |
| Portal del cliente permanente | ✅ | `/cliente/:token`. Historial cotizaciones y facturas. Botón pagar. |
| Solicitar presupuesto desde portal | ✅ | El cliente describe nuevo trabajo → QuoteRequest en el BO. |

## B5. Facturas

| Feature | Estado | Descripción |
|---|---|---|
| Factura automática al aceptar | ✅ | Importes según paymentTerms (FULL_UPFRONT o FIFTY_FIFTY). |
| PDF de factura con desglose IVA | ✅ | Líneas, tipos IVA, total, QR de verificación. |
| VeriFactu (España) | ✅ | Cadena SHA-256, QR AEAT. Merchants country='ES' con NIF. |
| Enviar factura por WhatsApp | ✅ | Plantilla `payment_request_es` con botón de pago. |
| Recordatorio 7 y 14 días | ✅ | Cron diario 10h. WA automático si pending >7d / >14d. |
| Recordatorio manual desde BO | ✅ | Botón "Recordar pago" en detalle de factura. |
| Cambiar estado (paid/pending) | ✅ | Desde detalle. |
| Marcar múltiples como pagadas | ✅ | Checkbox bulk en lista. |
| Historial con filtros | ✅ | Estado, búsqueda, fechas, exportar CSV. |

## B6. Cobros y pagos

| Feature | Estado | Descripción |
|---|---|---|
| Tarjeta (Stripe Checkout) | ✅ | Webhook confirma pago, marca factura pagada. |
| Transferencia bancaria | ✅ | Página con IBAN/CLABE, referencia a copiar. |
| Mercado Pago | ✅ | Checkout MP, redirect, webhook IPN. |
| Auto-factura al cobrar | ✅ | `AUTO_INVOICE_ON_PAID=true` → genera y envía factura. |
| Email de factura al cobrar | ✅ | `AUTO_EMAIL_INVOICE_ON_PAID=true` si cliente tiene email. |
| Notificación WA al profesional | ✅ | "💰 Pago recibido de [Cliente]". |
| Solicitud de reseña Google | ✅ | WA al cliente si `googleReviewUrl` configurado. |

## B7. Clientes

| Feature | Estado | Descripción |
|---|---|---|
| Lista con búsqueda | ✅ | Por nombre, teléfono, email. |
| CRUD clientes | ✅ | Crear, editar. Modal. |
| Importar CSV | ✅ | Drag & drop. Dedup automático. |
| Portal del cliente (URL permanente) | ✅ | Token único. URL copiable desde BO. |
| Vista 360 del cliente | ✅ | KPIs + todas cotizaciones y facturas. |

## B8. Catálogo de productos

| Feature | Estado | Descripción |
|---|---|---|
| CRUD completo | ✅ | Nombre, descripción, precio, coste, IVA, proveedor. |
| Autocomplete en cotizaciones | ✅ | Busca por nombre normalizado. Muestra descripción y precio. Recientes. |
| Import/export CSV | ✅ | Separador coma o punto y coma. Dedup por nombre. |

## B9. Gastos y margen

| Feature | Estado | Descripción |
|---|---|---|
| CRUD gastos | ✅ | Concepto, importe, categoría, proveedor, cotización vinculada, foto ticket. |
| Resumen mensual | ✅ | Gasto total, sin asignar, categoría mayor. |
| Margen por cotización | ✅ | Ingresos − Gastos vinculados = Margen neto + %. |
| Beneficio neto en Home | ✅ | KPI adicional: Cobrado − Gastos. |

## B10. Informes y exportaciones

| Feature | Estado | Descripción |
|---|---|---|
| P&L mensual con gráfico | ✅ | 12 meses: ingresos, gastos, beneficio. SVG sin dependencias. Comparativa año anterior. |
| Exportar facturas/gastos/cotizaciones CSV | ✅ | Con filtros de fecha y estado. |

## B11. PWA, diseño y UX

| Feature | Estado | Descripción |
|---|---|---|
| PWA instalable | ✅ | manifest.json + sw.js. iOS y Android. |
| Mobile-first CSS | ✅ | Sidebar → overlay móvil. Touch targets 44px. Tablas con scroll horizontal. |
| Búsqueda global | ✅ | Clientes, presupuestos, facturas. Atajo `/`. Navegación teclado. |
| Design system v2 | ✅ | Inter font, CSS vars, SVG icons, data-card pattern, design tokens. |
| i18n ES/MX/CO/AR/PE/CL | ✅ | Terminología, moneda, IVA, locale por país. |

## B12. Equipo (Sprint 6)

| Feature | Estado | Descripción |
|---|---|---|
| Múltiples usuarios por merchant | ✅ | Admin invita por email, magic link. |
| Roles Admin/Técnico | ✅ | Técnico: solo cotizaciones. Admin: todo. |
| Suspender/reactivar miembros | ✅ | Invalida sesiones. |

## B13. Variables de entorno — Estado actual

```
DATABASE_URL                  ✅
SESSION_SECRET                ✅
RESEND_API_KEY                ✅
EMAIL_FROM                    ✅ (actualizar a yaqu.app cuando se configure dominio email)
STRIPE_SECRET_KEY             ✅
STRIPE_WEBHOOK_SECRET         ✅ (actualizado para yaqu.app)
STRIPE_PRICE_ID_PRO           ❌ CRÍTICO — crear en Stripe
STRIPE_PRICE_ID_PRO_ANNUAL    ❌ CRÍTICO — crear en Stripe
WHATSAPP_PHONE_NUMBER_ID      ✅
WHATSAPP_ACCESS_TOKEN         ✅
WHATSAPP_BUSINESS_ACCOUNT_ID  ✅
PUBLIC_BASE_URL               ✅ https://yaqu.app
AUTO_INVOICE_ON_PAID          ✅ true
AUTO_EMAIL_INVOICE_ON_PAID    ✅ true
ANTHROPIC_API_KEY             ✅
MP_ACCESS_TOKEN               ⚠️ Opcional (solo si activas Mercado Pago)
STORAGE_BUCKET_URL            ❌ Pendiente Cloudflare R2 (fotos)
STORAGE_ACCESS_KEY            ❌
STORAGE_SECRET_KEY            ❌
STORAGE_PUBLIC_URL            ❌
```

---

# PARTE C — BUGS CONOCIDOS Y DEUDA TÉCNICA

## C1. CRÍTICO — Bloquean la venta o el uso normal

| # | Bug | Impacto |
|---|---|---|
| C-01 | `STRIPE_PRICE_ID_PRO/ANNUAL` no creados en Stripe ni en Railway | Nadie puede suscribirse. Billing roto en producción. |
| C-02 | Branding PresuFácil/CobroFlash en HTML/CSS/manifest/sw.js — debe ser YaQu | Mala imagen. Confusión de marca. |
| C-03 | Plantillas WhatsApp (`quote_decision_es`, `payment_request_es`, `quote_reminder_es`) deben estar Approved en Meta | Sin esto, no se pueden enviar mensajes outbound. El producto no funciona. |

## C2. ALTO — Confunden al usuario o dan mala imagen

| # | Bug | Descripción |
|---|---|---|
| C-04 | Campo "Teléfono override (E.164 sin +)" en formulario cotización | Campo de dev que no tiene sentido para usuario final. Ocultar/eliminar. |
| C-05 | Checkbox "Resumen semanal" en Settings existe en UI pero no envía emails | Backend YA existe en `weeklyDigest.service.ts`. Falta restaurar el checkbox en settingsView.js y añadir field al schema. |
| C-06 | El seed.ts y los datos demo usan "demo@presufacil.online" y "CobroFlash" | Actualizar a yaqu.app y YaQu. |
| C-07 | El PDF de cotización con líneas de descripción muy larga puede desformatearse | `softBreakLongTokens` no cubre todos los casos. Fix pendiente. |

## C3. MEDIO

| # | Bug | Descripción |
|---|---|---|
| C-08 | `localStorage` en autocomplete de productos | Funciona en prod pero NO en Claude.ai. Documentado. |
| C-09 | Botón "Crear presupuesto" en quotesListView usa `menuBtn.click()` frágil | Funciona pero frágil. Cambiar a `renderAppView('quotes-new')`. |

---

# PARTE D — PLAN DE SPRINTS COMPLETO HASTA $1M ARR

> **Filosofía:** Arreglar → Simplificar → Añadir → Pulir → Escalar.
> Cada sprint tiene un criterio de éxito binario (sí/no). Si no se cumple, el sprint no termina.
> **Prioridad absoluta:** que el flujo WhatsApp completo funcione con un teléfono real.

---

## SPRINT AHORA-1 — Rebranding a YaQu (2 días)

**Objetivo:** Que ningún archivo del proyecto diga "PresuFácil" ni "CobroFlash" de cara al usuario.

### Archivos a cambiar:

**`public/dashboard/index.html`:**
- `<title>PresuFácil · Panel</title>` → `<title>YaQu · Panel</title>`
- `<meta name="apple-mobile-web-app-title" content="PresuFácil"/>` → `"YaQu"`
- Sidebar logo: `<div class="sidebar-logo-mark">PF</div>` → `YQ` (o SVG icon)
- `<div class="sidebar-logo-text">PresuFácil</div>` → `YaQu`
- `<meta name="theme-color" content="#22c55e"/>` — mantener color, cambiar nombre

**`public/login.html`:**
- `<title>PresuFácil — Acceder</title>` → `YaQu — Acceder`
- `.logo-text`: `PresuFácil` → `YaQu`
- `.logo-mark`: `PF` → `YQ`
- `<link rel="manifest" href="/manifest.json" />` — dejar, el manifest se actualiza

**`public/register.html`:**
- Todos los textos `PresuFácil` → `YaQu`
- `.logo-mark`: `PF` → `YQ`

**`public/manifest.json`:**
```json
{
  "name": "YaQu",
  "short_name": "YaQu",
  "description": "Cotizaciones profesionales en 30 segundos, cobro integrado"
}
```

**`public/sw.js`:**
- `const CACHE_NAME = 'presufacil-v1';` → `'yaqu-v1'`
- Comentarios: `PresuFácil PWA` → `YaQu PWA`

**`public/icons/icon-192.svg` y `icon-512.svg`:**
- Cambiar texto `PF` por `YQ` en el SVG

**`src/modules/auth/domain/auth.service.ts`:**
- Email del magic link: `"Tu enlace de acceso a PresuFácil"` → `"Tu enlace de acceso a YaQu"`
- Contenido HTML del email: `PresuFácil` → `YaQu`
- Email de invitación de equipo: `PresuFácil` → `YaQu`

**`src/modules/messaging/domain/merchantNotifications.ts`:**
- Todos los textos `PresuFácil` → `YaQu`

**`src/modules/messaging/domain/weeklyDigest.service.ts`:**
- `PresuFácil` → `YaQu` en asunto y cuerpo del email

**`src/modules/invoicing/infra/pdf/pdf.service.ts`:**
- Footer: `"Factura generada automáticamente por PresuFácil"` → `"...por YaQu"`
- Footer: `"Presupuesto generado automáticamente por PresuFácil"` → `"...por YaQu"`

**`prisma/seed.ts`:**
- `email: 'demo@presufacil.online'` → `'demo@yaqu.app'`
- `notes: 'Cliente demo para probar CobroFlash'` → `'Cliente demo para probar YaQu'`

**`src/index.ts`:**
- `console.log('CobroFlash API listening...')` → `'YaQu API listening...'`

**`src/modules/system/app/routes/customerPortal.routes.ts`:**
- Footer: `"Powered by PresuFácil"` → `"Powered by YaQu"`

**`public/admin.html`:**
- Todos los textos `CobroFlash` → `YaQu`

**`public/dashboard/js/onboardingView.js`:**
- `"Bienvenido a PresuFácil"` → `"Bienvenido a YaQu"`
- Logo mark `PF` → `YQ`

**`public/dashboard/js/app.js`:**
- `planLabels: trial: 'Trial gratuito', pro: 'Plan Pro'` — mantener lógica, revisar textos

### Criterio de éxito:
- [ ] Ningún texto visible al usuario dice "PresuFácil" ni "CobroFlash"
- [ ] El logo en sidebar, login y register muestra "YQ"
- [ ] El manifest y sw.js dicen "YaQu"
- [ ] Los emails del magic link dicen "YaQu"

**Commit:** `rebrand: PresuFácil/CobroFlash → YaQu en todos los archivos públicos`

---

## SPRINT AHORA-2 — Arreglar lo crítico (3 días)

**Objetivo:** Que todo lo existente funcione sin mentiras al usuario.

### Tarea A2-1 — Crear precio único en Stripe

1. Stripe Dashboard → Products → Create product: "YaQu Pro"
2. Precio mensual: $19.00 USD / mes → copiar `price_id`
3. Precio anual: $179.00 USD / año → copiar `price_id`
4. Railway → Variables: `STRIPE_PRICE_ID_PRO=price_xxx` y `STRIPE_PRICE_ID_PRO_ANNUAL=price_xxx`

**`src/modules/billing/app/routes/subscriptions.routes.ts`:** Actualizar array `PLANS` a plan único Pro.

**`public/dashboard/js/plansView.js`:** Mostrar solo 1 plan con toggle mensual/anual.

**Commit:** `feat(billing): plan único YaQu Pro $19/mes con opción anual`

### Tarea A2-2 — Eliminar campo "Teléfono override" del formulario

**`public/dashboard/js/quotesView.js`:** Buscar y eliminar el `fieldTo` (teléfono override) del formulario de cotización.

**Commit:** `fix(quotes): eliminar campo teléfono override del formulario`

### Tarea A2-3 — Restaurar resumen semanal con backend real

El backend ya existe en `weeklyDigest.service.ts`. Solo falta:

1. **`prisma/schema.prisma`:** El campo `notifyEmailWeeklyDigest` ya existe. Verificar.
2. **`public/dashboard/js/settingsView.js`:** Restaurar el toggle `notifyWeeklySummary` con el campo correcto `notifyEmailWeeklyDigest`. Añadir botón "Vista previa" que llame a `GET /admin/digest/preview`.

**Commit:** `feat(settings): resumen semanal restaurado con backend real`

### Tarea A2-4 — Verificar plantillas WhatsApp

Revisar en Meta Business Manager:
- `quote_decision_es` → debe estar Approved
- `payment_request_es` → debe estar Approved
- `quote_reminder_es` → debe estar Approved

Si alguna está Pending o Rejected: corregir y reenviar. Sin esto, el producto no envía WhatsApp outbound.

### Criterio de éxito:
- [ ] Un usuario puede suscribirse y pagar ($19/mes)
- [ ] No hay campos de developer en el formulario de cotización
- [ ] Settings no tiene opciones que no hagan nada
- [ ] Las 3 plantillas WhatsApp están Approved en Meta

---

## SPRINT WA — Demo WhatsApp 100% Funcional (5 días)

**Objetivo:** Demostrar el flujo completo con un teléfono real. Esto es el producto.

### Tarea WA-1 — Test del flujo completo end-to-end

Ejecutar manualmente con teléfonos reales:
1. Crear cotización → Enviar por WhatsApp → verificar que llega con plantilla correcta
2. El cliente abre el link → ve la cotización → firma con el dedo → acepta
3. El profesional recibe WA: "✅ [Cliente] aceptó tu cotización"
4. La factura se genera automáticamente
5. Se envía WA con link de pago al cliente
6. El cliente paga → profesional recibe WA "💰 Pago recibido"

Documentar cualquier fallo en Parte C.

### Tarea WA-2 — WhatsApp webhook de mensajes entrantes

El backend actual solo envía WA. Si un cliente responde texto libre ("acepto", "ok", "sí"), no pasa nada. Implementar un webhook básico para recibir mensajes:

**`src/app.ts`:** Añadir ruta pública `POST /webhooks/whatsapp` y `GET /webhooks/whatsapp` (verificación Meta).

**`src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts`** (archivo nuevo):
```typescript
// GET /webhooks/whatsapp — verificación Meta
// POST /webhooks/whatsapp — mensajes entrantes
// Si el mensaje contiene "acepto" / "ok" / "sí" → buscar cotización en status=sent del cliente → llamar a /quote/:id/decision con decision=accept
// Si contiene "no" / "rechazo" / "rechaz" → decision=reject
// Si no se entiende → responder con texto libre: "Para responder a tu cotización, usa el enlace que te enviamos."
```

**Variables nuevas en Railway:**
```
WHATSAPP_VERIFY_TOKEN=un_token_secreto_cualquiera
```

**Configurar en Meta Business Manager:**
- App → WhatsApp → Configuration → Webhook
- URL: `https://yaqu.app/webhooks/whatsapp`
- Verify Token: el valor de `WHATSAPP_VERIFY_TOKEN`
- Suscribirse a eventos: `messages`

**Commit:** `feat(whatsapp): webhook entrante — acepta/rechaza por texto libre`

### Tarea WA-3 — Mejorar formato de los mensajes WhatsApp

Los mensajes actuales funcionan pero el formato puede ser más impactante. Revisar las plantillas en Meta Business Manager y si es necesario actualizar a versiones con mejor copy:

**Plantilla `quote_decision_es` (cuerpo sugerido):**
```
Hola {{1}} 👋

Te adjunto la *cotización #{{2}}* de {{3}}.

💰 *Total: {{4}} {{5}}*

📄 Descarga el PDF y revísala aquí:
{{6}}

Si estás de acuerdo, pulsa *Aceptar* y fírmala digitalmente. En menos de 1 minuto queda todo confirmado 🤝
```

**Plantilla `payment_request_es`:**
```
Hola {{1}} 👋

Tu *factura {{2}}* está lista.

💰 *Importe: {{3}}*

Para pagar con tarjeta en segundos:
{{4}}

¡Gracias por confiar en nosotros! 🙏
```

**Commit:** `fix(whatsapp): actualizar copy de plantillas WA para mayor conversión`

### Tarea WA-4 — Notificación WhatsApp al crear solicitud del portal cliente

Cuando un cliente crea una solicitud de presupuesto desde su portal (`/cliente/:token`), ya se envía WA al profesional. Mejorar el mensaje con más contexto y formato.

**`src/modules/system/app/routes/customerPortal.routes.ts`:**
```typescript
text: `📋 *Nueva solicitud de presupuesto*\n\n👤 *Cliente:* ${customer.name}\n\n📝 *Descripción:*\n"${description.slice(0, 500)}"\n\nRevísala en tu panel de YaQu 👉 https://yaqu.app/dashboard/#quote-requests`
```

**Commit:** `fix(portal): mejorar mensaje WA de solicitud de presupuesto`

### Criterio de éxito del Sprint WA:
- [ ] Flujo completo testado con teléfono real: cotización → WA → firma → factura → pago → WA de confirmación
- [ ] El cliente puede responder "acepto" por WA y se procesa la decisión
- [ ] El webhook de mensajes entrantes está activo y verificado en Meta
- [ ] Los mensajes WA tienen el mejor copy posible para conversión

---

## SPRINT UX-1 — Onboarding WOW (5 días)

**Objetivo:** Que el 60%+ de los usuarios que se registran envíen su primera cotización en los primeros 10 minutos.

### Tarea UX1-1 — Añadir campo `trade` (oficio) al merchant

**`prisma/schema.prisma`** — añadir en modelo Merchant:
```prisma
trade  String?  // electricista|fontanero|reformista|pintor|cerrajero|climatizacion|otro
```
```bash
npx prisma db push --accept-data-loss && npx prisma generate
```
**`src/core/validation/schemas.ts`:** Añadir `trade` al `merchantProfileUpdateSchema`.
**`src/modules/system/merchantAdmin.ts`:** Incluir `trade` en select y update.

**Commit:** `db: campo trade (oficio) en Merchant`

### Tarea UX1-2 — Catálogos predefinidos por oficio

**Archivo nuevo:** `src/core/data/tradeCatalogs.ts`

Crear objeto `TRADE_CATALOGS` con al menos:
- `electricista_es`, `fontanero_es`, `reformista_es`, `pintor_es`
- `electricista_mx`, `fontanero_mx`, `electricista_co`, `fontanero_co`

Cada uno con 6-10 servicios típicos con precios de mercado y VAT correcto.

**`src/modules/products/app/routes/products.routes.ts`:** Nuevo endpoint `POST /admin/products/load-catalog`:
- Body: `{ trade: string }` — usa el `country` del merchant del token
- Solo carga si el merchant tiene <2 productos (evitar duplicados)
- Idempotente: si ya tiene catálogo, no sobreescribir

**Commit:** `feat(products): catálogos predefinidos por oficio y país`

### Tarea UX1-3 — Rediseñar wizard de onboarding (5 pasos)

**`public/dashboard/js/onboardingView.js`** — reemplazar el wizard actual de 3 pasos por uno de 5:

**Paso 1: "¿A qué te dedicas?"**
- Input nombre negocio
- Select: tipo de oficio (Electricista, Fontanero/Plomero, Reformista, Pintor, Cerrajero, Climatización, Otro)
- Select: país (pre-cargado con el país del registro)

**Paso 2: "¿Dónde te avisamos al cobrar?"**
- Input WhatsApp con validación E.164
- Preview visual del mensaje que recibirá

**Paso 3: "Tu catálogo en 1 clic"**
- Si oficio reconocido → mostrar "Hemos pre-cargado 8 servicios típicos de electricista en México. ¿Los usamos de base?"
- Botón "Sí, cargar catálogo" → llama a `/admin/products/load-catalog`
- Botón "Prefiero añadir los míos" → saltar

**Paso 4: "Tu primer cliente"**
- Input nombre + teléfono
- Label: "¿A quién le envías cotizaciones habitualmente?"
- Si ya existe en DB → seleccionarlo

**Paso 5 (EL MOMENTO WOW): "Envía tu primera cotización ahora"**
- Pre-rellena el Quick Quote modal con:
  - El cliente del paso 4
  - El primer servicio del catálogo cargado
  - Precio sugerido del catálogo
- Botón grande: "🚀 Enviar cotización ahora por WhatsApp"
- Al enviar → animación de éxito + confetti
- Texto: "¡Tu primera cotización enviada! [Cliente] la recibirá en segundos."

**Commit:** `feat(onboarding): wizard 5 pasos con momento WOW de primera cotización`

### Tarea UX1-4 — Empty states accionables

Revisar todos los empty states del dashboard. Cada uno debe tener:
- Icono grande relevante
- Título claro
- Descripción con beneficio concreto
- Botón de CTA que lleva directamente a la acción

**`public/dashboard/js/quotesListView.js`:** Empty state → "Envía tu primera cotización y consigue más trabajos. La mayoría de clientes responden en menos de 2 horas cuando la reciben por WhatsApp."

**`public/dashboard/js/customersView.js`:** Empty state → "Añade a tu primer cliente para empezar a enviarle cotizaciones profesionales."

**`public/dashboard/js/invoicesView.js`:** Empty state → "Aquí aparecerán las facturas cuando tus clientes acepten cotizaciones."

**Commit:** `ux: empty states accionables con CTAs directos`

### Criterio de éxito del Sprint UX-1:
- [ ] Nuevo usuario completa onboarding y envía primera cotización en <10 minutos
- [ ] El catálogo de servicios se pre-carga según oficio
- [ ] Todos los empty states tienen CTA claro
- [ ] Paso 5 del onboarding es visualmente satisfactorio

---

## SPRINT FRONT-1 — Frontend Premium (7 días)

**Objetivo:** Que cualquier persona que vea el dashboard diga "esto parece un producto de $50/mes" y no "esto parece un hackathon".

### Tarea FRONT1-1 — Dashboard Home rediseñado

**`public/dashboard/js/homeView.js`:**

- KPIs con tendencia vs semana anterior (flecha ↑↓ con porcentaje)
- Actividad reciente con avatar de cliente y estado visual (no texto plano)
- "Acción rápida" section: 3 botones grandes con iconos: "Nueva cotización", "Añadir cliente", "Ver pendientes de cobro"
- Tiempo de respuesta promedio del cliente (badge informativo)
- "Esta semana": mini-chart de cotizaciones enviadas (sparkline SVG simple)

### Tarea FRONT1-2 — Sidebar mejorada con accesos directos

**`public/dashboard/index.html`:**

- Añadir badge de count en items del menú: "Solicitudes (3)", "Cotizaciones pendientes (5)"
- Separar "Cotizaciones" de "Historial" más claramente
- Quick actions en el sidebar bottom: "+" para nueva cotización directamente

### Tarea FRONT1-3 — Mejoras visuales generales

**`public/dashboard/css/styles.css`:**

- Añadir micro-animaciones: transición suave en hover de botones (ya hay algo, mejorar)
- Loading skeleton para KPIs mientras cargan (en lugar de "Cargando…" texto)
- Toast notifications mejoradas (no solo el toast verde básico)
- Colores de estado más expresivos en pills
- Sombras más pronunciadas en tarjetas del dashboard para efecto 3D sutil

### Tarea FRONT1-4 — Formulario de cotización mejorado

**`public/dashboard/js/quotesView.js`:**

- Drag & drop para reordenar líneas
- Autoguardado del borrador en localStorage con indicador "Guardado automáticamente"
- Preview del PDF en panel derecho que se actualiza en tiempo real (ya existe, mejorar fidelidad)
- Calculadora de IVA inline: "Base: 850 + IVA 21% = **1.028,50 €**" en tipografía grande

### Tarea FRONT1-5 — Detalle de cotización mejorado

**`public/dashboard/js/quotesDetailView.js`:**

- Timeline visual del estado: Creada → Enviada → [Aceptada/Rechazada] → Facturada → Cobrada
- Cada paso del timeline con fecha e icono
- Si está en "Enviada", mostrar "Enviada hace X horas" y botón "Recordar al cliente" prominente
- Firma digital mostrada con marco más elegante y badge "✅ Firmado legalmente"

### Tarea FRONT1-6 — Landing del cliente rediseñada

**`src/modules/system/app/routes/quoteDecisionLanding.routes.ts`:**

- Header más impactante con el nombre del merchant grande
- Cada línea de la cotización con icono de categoría (herramienta, mano de obra, material)
- Timer visual si el presupuesto tiene fecha de expiración
- Botón "Aceptar" → animación de carga → pantalla de éxito con confetti
- Si hay logo del merchant → mostrarlo prominentemente
- Sección "Sobre nosotros" breve si el merchant tiene descripción
- Compartir por WhatsApp desde la landing (el cliente puede forwarded a otro)

### Criterio de éxito del Sprint FRONT-1:
- [ ] 5 personas ajenas ven el dashboard y dicen "parece profesional"
- [ ] La landing del cliente tiene una tasa de firma >40% (trackear con evento)
- [ ] No hay ningún estado "Cargando…" sin skeleton o spinner
- [ ] El formulario de cotización tiene autoguardado de borrador

---

## SPRINT LANDING — yaqu.app Landing de Marketing (5 días)

**Objetivo:** Una landing page pública que convierte visitas en registros.

### Tarea LANDING-1 — Crear la página de marketing

**Archivo nuevo:** `public/index.html` (la landing pública de yaqu.app)

**Estructura (single page, sin framework):**

```
SECCIÓN 1 — HERO
- Logo YaQu
- H1: "La cotización que el cliente firma por WhatsApp en 30 segundos"
- Subtítulo: "Para fontaneros, electricistas y reformistas que quieren cobrar más y perseguir menos."
- CTA principal: "Prueba gratis 14 días" → /register.html
- CTA secundario: "Ver demo de 60 segundos" → abre video modal
- Captura de pantalla del dashboard o GIF del flujo

SECCIÓN 2 — PROBLEMA
- Título: "¿Todavía mandas presupuestos por texto en WhatsApp?"
- 3 pain points visuales con icono + texto corto
- "El 63% de los presupuestos enviados por texto nunca se aceptan."

SECCIÓN 3 — SOLUCIÓN (CÓMO FUNCIONA)
- 5 pasos con screenshot: Crea → Envía → Cliente firma → Factura automática → Cobras
- Cada paso con número grande, título y subtítulo
- Animación o GIF en cada paso

SECCIÓN 4 — FEATURES CLAVE (3 columnas)
- 💬 "WhatsApp nativo" — tus clientes reciben en la app que ya usan
- ✍️ "Firma digital legal" — evidencia jurídica si hay disputa
- 🤖 "IA que sugiere líneas" — describe el trabajo, YaQu lo cotiza
- 📊 "Margen real por trabajo" — ve exactamente cuánto ganas en cada proyecto
- 💰 "Cobro integrado" — Stripe, transferencia o Mercado Pago
- 👥 "Para tu equipo" — tus técnicos cotizando con tu marca

SECCIÓN 5 — PRUEBA SOCIAL
- 3-5 testimonios de usuarios piloto (con foto, nombre y oficio)
- Estadísticas: "Más de X cotizaciones enviadas / X€ cobrados"

SECCIÓN 6 — PRECIOS
- Un solo plan: $19/mes o $179/año
- Toggle mensual/anual
- Lista de features incluidas
- CTA: "Empezar ahora"
- "Sin permanencia. Cancela cuando quieras."

SECCIÓN 7 — FAQ
- 5-7 preguntas frecuentes en acordeón
- "¿Funciona en México?" "¿Necesito instalar algo?" etc.

SECCIÓN 8 — CTA FINAL
- "¿Listo para enviar tu primera cotización en 30 segundos?"
- Botón grande: "Crear cuenta gratis"

FOOTER
- Links: Inicio, Precios, Privacidad, Términos, Contacto
- "© 2026 YaQu. Todos los derechos reservados."
```

**`public/pricing.html`:** Página de precios standalone (para SEO).

**`public/privacy.html`** y **`public/terms.html`:** Páginas legales básicas.

### Tarea LANDING-2 — SEO básico

En `public/index.html` añadir:
```html
<meta name="description" content="YaQu: crea cotizaciones en 30 segundos, envíalas por WhatsApp, el cliente firma digitalmente y pagas antes de empezar. Para fontaneros, electricistas y reformistas.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://yaqu.app">
<script type="application/ld+json">{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "YaQu",
  "applicationCategory": "BusinessApplication",
  "offers": { "@type": "Offer", "price": "19", "priceCurrency": "USD" }
}</script>
```

**Sitemap:** `public/sitemap.xml` con las páginas públicas.

**`public/robots.txt`:** Permitir indexación.

### Criterio de éxito del Sprint LANDING:
- [ ] La landing carga en <2 segundos en móvil
- [ ] El flujo "ver landing → registrarse" funciona sin fricción
- [ ] Google PageSpeed Score >80 en móvil
- [ ] La página está indexada en Google (verificar con Search Console)

---

## SPRINT TUTORIAL — Sistema de ayuda in-app (4 días)

**Objetivo:** Que ningún usuario se pierda o abandone por no entender qué hacer.

### Tarea TUT-1 — Tooltips contextuales en primer uso

**`public/dashboard/js/app.js`:**

Sistema de tooltips que aparecen la primera vez que el usuario abre cada sección:

```javascript
const TIPS = {
  'home': {
    selector: '.home-cta',
    text: '← Empieza aquí. Crea una cotización en 30 segundos.',
    position: 'bottom'
  },
  'quotes-new': {
    selector: '.quote-lines-header',
    text: '← Añade los servicios que vas a presupuestar. Puedes buscar en tu catálogo.',
    position: 'top'
  },
  // ...más tips por sección
};

// Guardar en localStorage qué tips ya se mostraron
// Mostrar max 1 tip por sección, solo una vez
```

### Tarea TUT-2 — Guía de inicio rápido en Home

**`public/dashboard/js/homeView.js`:**

En lugar del setup checklist actual (que desaparece al completar), añadir una sección "Guía de inicio" que siempre esté disponible en un botón discreto:

- "¿Cómo enviar mi primera cotización?" (3 pasos con screenshots)
- "¿Cómo añado mis servicios al catálogo?" (2 pasos)
- "¿Cómo funciona el cobro?" (3 pasos)

Implementar como un panel lateral colapsable (no un modal) para no bloquear la pantalla.

### Tarea TUT-3 — Mensajes de ayuda contextual

En las secciones más complejas, añadir pequeños textos de ayuda en gris debajo de los campos:

- En "Nueva cotización" → "💡 Puedes describir el trabajo en texto y la IA sugerirá las líneas automáticamente"
- En "Condiciones de pago" → "💡 '100% al aceptar' genera la factura inmediatamente al firmar"
- En "Good/Better/Best" → "💡 Los clientes eligen un 40% más a menudo cuando ven 3 opciones"

### Criterio de éxito del Sprint TUTORIAL:
- [ ] Un usuario nuevo puede completar el flujo sin necesitar soporte
- [ ] Los tooltips aparecen en las secciones clave la primera vez
- [ ] El tiempo hasta la primera cotización enviada baja a <8 minutos

---

## SPRINT PHOTOS — Fotos del trabajo (4 días)

**Objetivo:** Que el profesional pueda añadir fotos de la obra para que el cliente vea exactamente qué va a recibir. Aumenta la tasa de aceptación significativamente.

### Tareas:
1. Configurar Cloudflare R2 (gratuito hasta 10GB/mes)
2. `STORAGE_BUCKET_URL`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_PUBLIC_URL` en Railway
3. **`prisma/schema.prisma`:** Añadir `photoUrls String[]` en Quote
4. **`src/core/storage/upload.service.ts`:** Servicio de upload usando `@aws-sdk/client-s3`
5. **`src/modules/quotes/app/routes/quotes.routes.ts`:** `POST /quote/:id/photos`
6. **`public/dashboard/js/quotesView.js`:** Botón "📷 Fotos del trabajo", thumbnails preview, upload
7. **`src/modules/system/app/routes/quoteDecisionLanding.routes.ts`:** Mostrar fotos en carrusel en la landing del cliente
8. **`src/modules/invoicing/infra/pdf/pdf.service.ts`:** Incluir fotos en el PDF de cotización

**Commit:** `feat(photos): fotos del trabajo en cotizaciones, landing cliente y PDF`

### Criterio de éxito:
- [ ] Se pueden subir hasta 4 fotos por cotización
- [ ] Las fotos aparecen en la landing del cliente antes de que firme
- [ ] Las fotos aparecen en el PDF de cotización

---

## SPRINT EMAIL — Lifecycle emails (4 días)

**Objetivo:** Sistema de emails automatizados que convierte trials en pagantes y retiene usuarios.

### Emails a implementar:

| Email | Trigger | Objetivo | Canal |
|---|---|---|---|
| Bienvenida | Al registrarse | Explicar el producto, link a onboarding | Resend |
| Día 3 — sin cotización | 3 días sin enviar ninguna | "¿Tienes problemas? Aquí 3 tips para empezar" | Resend |
| Día 7 — trial expira en 7 días | 7 días sin suscripción | "Tu trial expira en 7 días. ¿Qué tal va?" | Resend |
| Día 12 — 2 días antes | 12 días sin suscripción | "Solo 2 días de prueba. Aquí lo que perderías al cancelar" | Resend |
| Trial expirado | Día 15 sin suscripción | "Tus datos están aquí. Activa el plan para continuar." | Resend |
| Primer pago | Al confirmar suscripción | "Bienvenido al plan Pro. Aquí 5 cosas que probablemente no sabías" | Resend |
| 14 días inactivo | Sin actividad 2 semanas | "¿Qué ha pasado? ¿En qué fallamos?" + opción de respuesta | Resend |
| Resumen semanal | Lunes 9h | Métricas de la semana | Resend |

**`src/modules/messaging/domain/lifecycle.service.ts`** (archivo nuevo):
- `sendWelcomeEmail(merchantId)`
- `sendDay3Email(merchantId)` — verificar que no ha enviado ninguna cotización
- `sendDay7Email(merchantId)`
- `sendDay12Email(merchantId)`
- `sendTrialExpiredEmail(merchantId)`
- `sendFirstPaymentEmail(merchantId)`
- `sendInactiveEmail(merchantId)`

**`src/core/cron/cron.ts`:** Añadir cron diario a las 8h que evalúa qué usuarios necesitan qué email. Evitar duplicados con un campo `lastLifecycleEmailAt` en Merchant o una tabla `lifecycle_emails`.

**Commit:** `feat(lifecycle): sistema de emails del ciclo de vida del usuario`

### Criterio de éxito:
- [ ] El email de bienvenida llega inmediatamente al registrarse
- [ ] Los emails de días 3, 7, 12 y expirado se envían correctamente
- [ ] Ningún usuario recibe el mismo email dos veces

---

## SPRINT REFERRAL — Sistema de referidos (3 días)

**Objetivo:** Convertir a los usuarios satisfechos en el canal de adquisición más barato.

### Implementación:

**`prisma/schema.prisma`:** En modelo Merchant:
```prisma
referralCode    String?   @unique @map("referral_code")
referredBy      Int?      @map("referred_by")
freeMonthsEarned Int      @default(0) @map("free_months_earned")
```

**`src/modules/auth/domain/auth.service.ts`:** Al crear un merchant, generar `referralCode` único (ej. `GARCIA26` = apellido + año).

**`public/register.html`:** Leer `?ref=CODIGO` de la URL → guardar en formulario → enviar en el body del registro.

**`src/modules/auth/app/routes/auth.routes.ts`:** Al registrar, si viene `ref`, buscar el merchant con ese código y guardar `referredBy`.

**`src/modules/billing/app/routes/stripe.routes.ts`:** Cuando un referido paga por primera vez (subscription.created), incrementar `freeMonthsEarned` del referidor y aplicar un cupón de 1 mes gratis en Stripe.

**`public/dashboard/js/settingsView.js`:** Añadir sección "Referidos" que muestra:
- Tu código único con botón "Copiar link"
- "Has referido X personas, Y son pagantes, tienes Z meses gratis"
- Texto: "Por cada amigo que se suscriba, recibes 1 mes gratis"

**Commit:** `feat(referral): sistema de referidos con mes gratis`

---

## SPRINT ANALYTICS — Métricas avanzadas (5 días)

**Objetivo:** Que el profesional tenga datos accionables para ganar más dinero. Que el director de empresa quiera comprar el plan Equipo.

### Tarea ANA-1 — Funnel de conversión de cotizaciones

**`src/modules/metrics/app/routes/metrics.routes.ts`:** Nuevo endpoint `GET /admin/metrics/funnel`:
- Total cotizaciones enviadas (mes actual y último mes)
- % aceptadas
- % rechazadas
- % sin respuesta
- Tiempo promedio de respuesta (en horas)
- Motivos de rechazo más frecuentes (del campo `rejectionReason`)

**`public/dashboard/js/reportsView.js`:** Nueva sección "Funnel de conversión" con:
- Barra horizontal mostrando el embudo: Enviadas → Aceptadas → Facturadas → Cobradas
- Tiempo promedio en cada etapa
- Comparativa con mes anterior

### Tarea ANA-2 — Rentabilidad por servicio

**`src/modules/metrics/app/routes/metrics.routes.ts`:** Nuevo endpoint `GET /admin/metrics/services`:
- Para cada servicio del catálogo: cotizaciones donde aparece, tasa de aceptación, margen promedio (ingresos − gastos vinculados)
- Los 3 servicios más rentables y los 3 menos rentables

**`public/dashboard/js/reportsView.js`:** Tabla de rentabilidad por servicio con columnas: Nombre, Veces cotizado, Tasa aceptación %, Margen promedio.

### Tarea ANA-3 — Dashboard de equipo (para directores)

Solo visible para admin con >1 miembro del equipo.

**`public/dashboard/js/homeView.js`:** Si hay técnicos, mostrar sección "Rendimiento del equipo":
- Por técnico: cotizaciones enviadas este mes, tasa de aceptación, importe cobrado
- Técnico con mejor rendimiento: badge "⭐ Mejor este mes"
- Alerta: "3 técnicos sin actividad esta semana"

**Commit:** `feat(analytics): funnel de conversión + rentabilidad por servicio + dashboard equipo`

### Criterio de éxito:
- [ ] El informe muestra el funnel de conversión con %, tiempo y motivos de rechazo
- [ ] La tabla de rentabilidad por servicio está disponible
- [ ] El dashboard de equipo se muestra cuando hay técnicos activos

---

## SPRINT ENTERPRISE — Features para directores de empresa (7 días)

**Objetivo:** Que cuando un director de empresa vea una demo, inmediatamente quiera el plan Equipo.

### Tarea ENT-1 — Custom branding en páginas del cliente

El director quiere que sus clientes vean LA EMPRESA, no "YaQu".

**`prisma/schema.prisma`:** En modelo Merchant:
```prisma
brandColor       String?  @map("brand_color")       // hex color, ej: "#1a56db"
brandAccentColor String?  @map("brand_accent_color")
customDomain     String?  @unique @map("custom_domain")  // para futura fase
```

**`src/modules/system/app/routes/quoteDecisionLanding.routes.ts`:** Si el merchant tiene `brandColor`, usar ese color para el botón de aceptar, el header y los acentos. Si tiene `logoUrl`, mostrar el logo en posición prominente. Resultado: la landing del cliente parece 100% de la empresa del profesional.

**`public/dashboard/js/settingsView.js`:** Añadir campo "Color de marca" (input type="color") en Configuración.

**Commit:** `feat(branding): custom color de marca en la landing del cliente`

### Tarea ENT-2 — Aprobación de cotizaciones (workflow de autorización)

El director quiere aprobar cotizaciones >X€ antes de que se envíen.

**`prisma/schema.prisma`:** En modelo Merchant:
```prisma
approvalThreshold Decimal? @map("approval_threshold")  // null = sin aprobación requerida
```

**`src/modules/quotes/app/routes/quotes.routes.ts`:** En `POST /quote/create`:
- Si `quote.total > merchant.approvalThreshold` → crear cotización con `status='pending_approval'` en lugar de `draft`
- Enviar WA al admin: "📋 [Técnico] creó cotización #X por [importe]. Apruébala antes de enviar al cliente."

**`src/modules/system/app/routes/quotesAdmin.routes.ts`:** Nuevo endpoint `POST /admin/quotes/:id/approve`:
- Solo accesible para rol admin
- Cambia `status='pending_approval'` → `status='draft'`
- Notifica al técnico: "Tu cotización #X fue aprobada. Ya puedes enviarla."

**`public/dashboard/js/quotesListView.js`:** Nuevo estado visible "Pendiente de aprobación" con badge naranja y botón "Aprobar" para admins.

**`public/dashboard/js/settingsView.js`:** Campo "Importe máximo sin aprobación" en la sección de equipo.

**Commit:** `feat(enterprise): flujo de aprobación de cotizaciones para directores`

### Tarea ENT-3 — Historial de comunicaciones del cliente

El director quiere ver toda la historia de cada cliente: qué se le envió, cuándo, si lo abrió.

**`prisma/schema.prisma`:** Nuevo modelo:
```prisma
model CustomerEvent {
  id          Int      @id @default(autoincrement())
  merchantId  Int      @map("merchant_id")
  customerId  Int      @map("customer_id")
  type        String   // quote_sent | quote_accepted | quote_rejected | invoice_sent | payment_received | wa_sent | email_sent | review_requested
  metadata    Json?    // { quoteId, invoiceId, amount, channel, etc. }
  createdAt   DateTime @default(now()) @map("created_at")
  ...
}
```

En todos los puntos donde se envíe WA, email o se registre un evento de cliente → crear un `CustomerEvent`.

**`src/modules/system/app/routes/customersAdmin.routes.ts`:** Incluir `CustomerEvent[]` en el endpoint `GET /admin/customers/:id/detail`.

**`public/dashboard/js/customerDetailView.js`:** Nuevo tab "Historial de comunicaciones" en la vista 360 del cliente, con timeline cronológica de todos los eventos.

**Commit:** `feat(enterprise): historial completo de comunicaciones por cliente`

### Tarea ENT-4 — Exportaciones avanzadas para contabilidad

El director necesita datos para su gestoría.

**`src/modules/exports/app/routes/exports.routes.ts`:** Nuevos endpoints:
- `GET /admin/exports/summary-vat.csv` — Resumen de IVA por trimestre (base imponible + cuota IVA + total)
- `GET /admin/exports/client-statements/:id` — Estado de cuenta de un cliente (todas las facturas, pagadas y pendientes)
- `GET /admin/exports/team-performance.csv` — Rendimiento del equipo (cotizaciones por técnico, tasa cierre, importe cobrado)

**Commit:** `feat(exports): exportaciones avanzadas para contabilidad y rendimiento equipo`

### Criterio de éxito del Sprint ENTERPRISE:
- [ ] La landing del cliente muestra el color de marca del profesional
- [ ] Las cotizaciones >X€ requieren aprobación del admin antes de enviarse
- [ ] La vista 360 del cliente muestra toda la historia de comunicaciones
- [ ] Se puede exportar el resumen de IVA trimestral

---

## SPRINT LATAM — LATAM payments completo (4 días)

**Objetivo:** Que cualquier cliente en México o Colombia pueda pagar sin necesitar tarjeta de crédito.

### Tareas:
1. Configurar Mercado Pago en producción (cuenta, webhook, `MP_ACCESS_TOKEN`)
2. **OXXO Pay (México):** En `payCard.routes.ts`, para merchants con `country='MX'`, añadir `payment_method_types: ['card', 'oxxo']` en Stripe Checkout
3. **PSE (Colombia):** Para merchants con `country='CO'`, añadir `payment_method_types: ['card']` (Stripe ya soporta PSE en CO)
4. **`public/pay/bank/:id`:** Mejorar la página de transferencia con instrucciones específicas por país (SPEI para MX, transferencia estándar para CO/ES)
5. **`public/pay/card/:id`:** Mostrar los métodos disponibles según país del merchant

**Commit:** `feat(latam): OXXO Pay MX + PSE CO + Mercado Pago producción`

---

## SPRINT SPAIN — España completo (5 días)

**Objetivo:** Producto listo para el mercado español y la regulación VeriFactu obligatoria.

### Tareas:
1. VeriFactu: completar el envío al SIF de la AEAT (actualmente solo genera el QR)
2. Exportar RRSIF (formato XML para Hacienda)
3. Resumen IVA trimestral: modelo 303 (desglose IVA repercutido)
4. Factura rectificativa (tipo `R1`) para devoluciones
5. Series de facturación por año (2026-CF-001, 2027-CF-001)

**Commit:** `feat(spain): VeriFactu completo + exportación XML + resumen IVA 303`

---

## SPRINT PWA — Mobile app quality (4 días)

**Objetivo:** Que la experiencia móvil sea indistinguible de una app nativa.

### Tareas:
1. **Push notifications:** Añadir `push` event listener en `sw.js`, endpoint para guardar suscripción, enviar push desde backend en eventos clave
2. **Offline mode:** Cache más agresiva en service worker para que el dashboard funcione sin conexión (con indicador "Sin conexión" cuando hay datos cacheados)
3. **App shortcuts:** Mejorar `shortcuts` en manifest.json con más acciones rápidas
4. **Splash screen:** Imagen de splash correcta para iOS (meta tags apple-mobile-web-app)
5. **Share API:** En el detalle de cotización, botón "Compartir" que usa la Web Share API del móvil (compatibilidad iOS/Android)
6. **TWA (Trusted Web Activity):** Preparar la app para publicarla en Google Play Store via TWA. Requiere añadir `/.well-known/assetlinks.json`.

**Commit:** `feat(pwa): push notifications + offline mode + app store ready`

---

## SPRINT WHATSAPP-BOT — Bot conversacional avanzado (7 días)

**Objetivo:** El profesional pueda crear cotizaciones enviando un mensaje de voz o texto por WhatsApp, sin abrir el dashboard.

Este es un diferenciador enorme que ningún competidor tiene.

### Concepto:
El profesional envía al número de YaQu Business:
> "Oye, necesito cotizarle a Juan García una instalación eléctrica con 4 puntos de luz y cambio de cuadro"

El bot responde:
> "Perfecto. Aquí está la cotización para Juan García:
> - Instalación punto de luz (×4): 340 €
> - Cambio cuadro eléctrico: 280 €
> **Total: 620 €**
> ¿La envío al cliente o quieres ajustar algo?"

### Implementación:
1. **Ampliar el webhook entrante** de WA-2 para manejar mensajes de texto libre
2. **Integrar Claude AI** para parsear la intención: "cotizar a [cliente] [servicios]"
3. **Flujo conversacional básico** (estado en cache Redis o en DB):
   - Estado 1: Parsear cliente + servicios del mensaje
   - Estado 2: Mostrar preview de cotización, pedir confirmación
   - Estado 3: Crear cotización en DB + enviar al cliente si confirma
4. **Mensajes de voz:** Transcribir audio via Whisper API (Anthropic no tiene Whisper, usar OpenAI o AssemblyAI) → procesar como texto

**Commit:** `feat(whatsapp-bot): crear cotizaciones por WhatsApp conversacional`

---

## SPRINT SEO — Orgánico y visibilidad (4 días)

**Objetivo:** Aparecer en las primeras posiciones cuando alguien busca "app presupuestos electricista México".

### Tareas:
1. **Blog:** Sección `/blog` con artículos SEO. Primeros artículos: "Cómo hacer un presupuesto de fontanería profesional", "App para fontaneros: las 5 mejores en 2026"
2. **Landing pages por oficio:** `/electricistas`, `/fontaneros`, `/reformistas` — cada una optimizada para búsquedas del sector
3. **Google Search Console:** Verificar dominio, enviar sitemap
4. **Open Graph tags:** Para que al compartir yaqu.app en WhatsApp o redes salga imagen y descripción
5. **Schema.org:** Mejorar el markup de la landing principal

**Commit:** `feat(seo): blog + landing pages por oficio + open graph`

---

# PARTE E — ESTRATEGIA DE NEGOCIO, PRECIOS Y GTM

## E1. Pricing

**Plan Pro — $19/mes (o $179/año)**
- Todo incluido sin límites
- Cotizaciones ilimitadas, WhatsApp nativo, firma digital, facturación automática
- Módulo gastos y margen, hasta 3 usuarios del equipo
- Soporte por WhatsApp

**Plan Equipo — $39/mes**
- Todo el Plan Pro
- Hasta 10 usuarios
- Dashboard de rendimiento del equipo
- Flujo de aprobación de cotizaciones
- Historial de comunicaciones del cliente
- Exportaciones avanzadas (IVA, rendimiento equipo)

**Argumento de venta ROI para México:**
- 10 cotizaciones/mes × +25% tasa de cierre = 2-3 trabajos extra
- Trabajo medio: $1.500-3.000 MXN
- Costo YaQu: $299 MXN/mes
- **ROI mínimo: 10x el primer mes**

## E2. GTM (Go-To-Market)

1. **TikTok/Reels:** "Mira cómo hago un presupuesto en 30 segundos" — el formato que funciona
2. **Grupos WhatsApp de gremios:** Mensaje auténtico de un usuario real (CAC ≈ $0)
3. **Distribuidores materiales:** Construrama, Sodimac, Home Depot MX — flyers en tienda, comisión 20%
4. **YouTube SEO:** Tutoriales para profesionales usando YaQu como herramienta
5. **Afiliados:** Creadores de TikTok de oficios con 50k+ seguidores — comisión 30% 6 meses

## E3. Proyecciones

| Mes | Activos | Pagantes | MRR |
|---|---|---|---|
| 3 | 150 | 30 | $570 |
| 6 | 400 | 80 | $1.520 |
| 12 | 1.000 | 200 | $3.800 |
| 18 | 2.500 | 550 | $10.450 |
| 24 | 6.000 | 1.400 | $26.600 |

**Para $1M ARR:** 4.400 pagantes = 0.1% de los 4M de profesionales de oficios en México.

---

# PARTE F — STACK TÉCNICO Y ARQUITECTURA

## F1. Stack actual

```
Backend:   Node.js + TypeScript + Express 5 + Prisma 6 + PostgreSQL
Deploy:    Railway (auto-deploy desde GitHub main)
URL:       https://yaqu.app
Pagos:     Stripe + Mercado Pago + PSP custom
WhatsApp:  Meta Cloud API directa (NUNCA n8n)
Email:     Resend HTTP API
PDF:       PDFKit
Cron:      node-cron (dentro del proceso)
PWA:       manifest.json + sw.js
IA:        Anthropic claude-opus-4-7
Frontend:  HTML/JS vanilla + Inter font + CSS vars design system v2
Storage:   Pendiente Cloudflare R2 para fotos
```

## F2. Reglas críticas del código

1. **NUNCA usar n8n.** Todo WhatsApp via `src/integrations/whatsapp.ts`
2. **Multi-tenant siempre.** Todas las queries filtran por `req.merchantId`
3. **Prisma sin TTY.** Usar `npx prisma db push`, nunca `migrate dev`
4. **Frontend sin frameworks.** HTML/JS vanilla, sin React, sin bundler
5. **Emails via Resend.** No SMTP en producción
6. **Crons dentro del proceso.** No Railway Cron externo

## F3. Módulos backend

```
src/modules/
├── ai/            Claude: suggest-quote + generate-message
├── auth/          Magic link, sesiones, invitaciones equipo
├── billing/       Stripe, PSP, MP webhooks, suscripciones
├── expenses/      Gastos, margen por cotización
├── exports/       CSV: facturas, gastos, presupuestos
├── invoicing/     Facturas + PDF + VeriFactu
├── messaging/     Emails: factura, lifecycle, weekly digest
├── metrics/       Home KPIs, top clientes/servicios
├── products/      Catálogo, autocomplete, CSV
├── providers/     Proveedores
├── quoteRequests/ Solicitudes desde portal cliente
├── quotes/        Cotizaciones, billing plan, reminder, GBB
├── reports/       P&L mensual
├── search/        Búsqueda global
├── system/        Admin routes: customers, quotes, invoices, portal
├── team/          Equipo, roles, invitaciones
└── templates/     Plantillas de cotización
```

---

# PARTE G — CONFIGURACIÓN PLATAFORMAS EXTERNAS

## G1. Railway

- **Plan:** Free tier (21 días) → upgradar antes de que expire
- **Variables críticas pendientes:** `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_PRO_ANNUAL`
- **Dominio:** yaqu.app configurado y activo

## G2. Stripe

1. Dashboard → Products → "YaQu Pro" → Crear precio mensual $19 + anual $179
2. Copiar price_ids → Railway
3. Webhook: `https://yaqu.app/webhooks/stripe` con 6 eventos activos

## G3. Meta / WhatsApp Business

1. App en modo **Live** (no Development)
2. Token permanente de System User (no expira)
3. Las 3 plantillas deben estar en estado **Approved**:
   - `quote_decision_es` (UTILITY)
   - `payment_request_es` (UTILITY)
   - `quote_reminder_es` (UTILITY)
4. Webhook URL: `https://yaqu.app/webhooks/whatsapp` (para mensajes entrantes - Sprint WA)

## G4. Resend

1. Dominio yaqu.app verificado con registros DNS
2. `EMAIL_FROM=YaQu <noreply@yaqu.app>`

## G5. Cloudflare R2 (cuando llegue Sprint PHOTOS)

1. Bucket: `yaqu-photos`
2. Acceso público activado
3. Variables en Railway: `STORAGE_*`

---

# PARTE H — TAREAS DETALLADAS PARA CLAUDE CODE

> **Instrucciones para Claude Code:**
> - Ejecuta las tareas EN ORDEN dentro de cada sprint.
> - Cada tarea indica el archivo exacto y qué cambiar.
> - Al terminar cada tarea: verifica que compila y arranca, luego haz commit.
> - Si el proyecto no compila, NO hagas commit.
> - Prioridad: AHORA-1 → AHORA-2 → WA → UX-1 → FRONT-1 → LANDING.

## Orden de ejecución recomendado:

```
Semana 1:
  SPRINT AHORA-1: Rebranding YaQu (2 días)
  SPRINT AHORA-2: Critical fixes (3 días)

Semana 2:
  SPRINT WA: Demo WhatsApp 100% (5 días)

Semana 3:
  SPRINT UX-1: Onboarding WOW (5 días)

Semana 4-5:
  SPRINT FRONT-1: Frontend Premium (7 días)

Semana 6:
  SPRINT LANDING: yaqu.app (5 días)
  SPRINT TUTORIAL: Sistema de ayuda (4 días)

Semana 7-8:
  SPRINT PHOTOS: Fotos del trabajo (4 días)
  SPRINT EMAIL: Lifecycle emails (4 días)
  SPRINT REFERRAL: Sistema referidos (3 días)

Semana 9-10:
  SPRINT ANALYTICS: Métricas avanzadas (5 días)
  SPRINT ENTERPRISE: Features directores (7 días)

Semana 11-12:
  SPRINT LATAM: Pagos LATAM (4 días)
  SPRINT SPAIN: España completo (5 días)
  SPRINT PWA: Mobile quality (4 días)

Semana 13-16:
  SPRINT WHATSAPP-BOT: Bot conversacional (7 días)
  SPRINT SEO: Orgánico (4 días)
```

---

*Versión 4.0 — actualizado Mayo 2026*
*Sprints 1-6 completados. Sprint AHORA = rebranding + critical fixes. Target: demo WA funcional en 2 semanas.*
*Reemplaza: PRESUFACIL_MASTER_V4.md*
*Un documento, una verdad.*
