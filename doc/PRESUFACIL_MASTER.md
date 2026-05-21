# PRESUFÁCIL — DOCUMENTO ÚNICO DE PRODUCTO
**Versión 1.0 | Mayo 2026 | Documento vivo — actualizar en cada sprint**

> **Cómo usar este documento:**
> - Parte A (2 páginas): leer antes de cualquier decisión de producto
> - Parte B (el foco ahora): lo que se construye en los próximos 30 días, accionable y concreto
> - Parte C (visión completa): adónde vamos después, sin fechas fijas
> - **En cada nuevo chat con IA:** pegar la Parte A completa + la tarea específica de Parte B

---

# PARTE A — NORTE CLARO (nunca cambiar sin debatirlo)

## A1. Qué somos en una frase

PresuFácil permite a cualquier profesional de servicios (fontanero, electricista, reformista, pintor, cerrajero) **crear una cotización profesional en menos de 30 segundos, enviarla por WhatsApp, que el cliente la acepte con un toque, y cobrar sin salir de la conversación.**

## A2. Para quién es (ICP — Ideal Customer Profile)

**Cliente principal:** Profesional independiente o pequeño equipo (1-5 personas) que trabaja por proyecto/presupuesto en servicios a domicilio.

**Geografía inicial:** México y Colombia (lanzamiento). España fase 2 (2026-2027, impulsado por VeriFactu).

**Perfil psicográfico:**
- Tiene 30-55 años
- Usa el móvil para todo (no tiene ordenador o no lo usa para el negocio)
- Ahora hace sus presupuestos en WhatsApp con texto o foto de papel
- Pierde trabajos porque tarda en responder o el presupuesto no parece profesional
- No quiere software complicado — quiere algo que funcione en 5 minutos

**Lo que NO es nuestro cliente en fase 1:**
- Empresas con más de 10 empleados
- Negocios que ya usan Jobber, ServiceTitan o similar
- Sectores que no trabajan por presupuesto (restaurantes, retail, etc.)

## A3. El problema real (validado)

El 80% de los profesionales de servicios gestionan sus ventas así hoy:
1. Van a la obra, evalúan el trabajo
2. Escriben el presupuesto en papel, WhatsApp o Excel (30-90 minutos)
3. Lo mandan por WhatsApp como texto o foto
4. Esperan. A veces el cliente no responde. No hacen seguimiento.
5. Si el cliente acepta, facturan días después o nunca
6. Cobran en efectivo o por transferencia sin registro

**Resultado:** Tasa de cierre del 35-40%. Con seguimiento profesional y cotización visual: 60-75% (fuente: Housecall Pro, 2024). Diferencia = más trabajos sin conseguir más clientes.

## A4. Nuestra propuesta de valor (por rol)

**Para el profesional:**
> "Envías la cotización en 30 segundos. El cliente la acepta desde el móvil. Cobras antes de empezar el trabajo. Sin Excel, sin papel, sin perseguir al cliente."

**Para el cliente final:**
> "Recibes un WhatsApp con la cotización en PDF, la aceptas con un toque y pagas de forma segura. Todo trazado y sin llamadas."

## A5. El diferenciador que nadie puede copiar rápido

**El ciclo completo WhatsApp-first:** cotización → aceptación con evidencia legal → factura automática → cobro integrado, todo dentro de WhatsApp. Ningún competidor en LATAM tiene esto.

| Competidor | WhatsApp | Cobro integrado | LATAM | Precio |
|---|---|---|---|---|
| Jobber | ❌ email | ⚠️ externo | ❌ | $39-249/mes |
| Housecall Pro | ❌ SMS | ✅ | ❌ | $69+/mes |
| Cotiza Pro (MX) | ⚠️ comparte PDF | ❌ | ✅ | Gratis/IAP |
| PresuNow (ES) | ✅ | ❌ | ❌ España | €12-29/mes |
| **PresuFácil** | **✅ nativo** | **✅ Stripe/MP** | **✅** | **$9-39/mes** |

## A6. Modelo de negocio

**Planes:**

| Plan | Precio | Límites | Objetivo |
|---|---|---|---|
| Gratis | $0 | 5 cotizaciones/mes, sin WhatsApp | Adquisición |
| Básico | $9/mes | Ilimitado, WhatsApp, 1 usuario | Entrada |
| Pro | **$19/mes** ← sweet spot | Todo + firma digital + fotos + recordatorios | Monetización principal |
| Empresa | $39/mes | Todo + 10 usuarios + equipo | Retención larga |

**Métrica norte:** Cotizaciones enviadas por WhatsApp por semana activa.

**ROI para el cliente profesional (argumento de venta):**
- 10 cotizaciones/mes × tasa de cierre que sube 25% = 2-3 trabajos extra
- Trabajo medio: $1.500-3.000 MXN
- Costo PresuFácil Pro: $380 MXN/mes
- **ROI mínimo: 8-10x el primer mes**

## A7. Lo que NO vamos a construir en fase 1 (importante para el foco)

❌ Contabilidad completa (libros, modelos 303/130)
❌ Open Banking / conciliación bancaria automática
❌ OCR con IA para facturas de proveedores
❌ Exportaciones fiscales CFDI/DIAN/AFIP
❌ App nativa iOS/Android
❌ API pública
❌ Gestión de agenda/calendario
❌ CRM avanzado con pipeline de ventas

Estas features son válidas para fase 2-3. Meterlas en fase 1 destruye el foco y retrasa el primer cliente pagante.

---

# PARTE B — LOS PRÓXIMOS 30 DÍAS (accionable)

## Estado actual del código (Mayo 2026)

**✅ Ya funciona:**
- Backend Node.js + TypeScript + Express + Prisma + PostgreSQL en Railway
- Módulo de presupuestos (crear, enviar por WhatsApp vía Meta API directa, aceptar/rechazar)
- Plantilla WhatsApp `quote_decision_es` con botones Aceptar/Rechazar
- Módulo de facturas (generación automática FULL_UPFRONT y FIFTY_FIFTY)
- Cobros via Stripe (tarjeta) y PayByBank
- Dashboard web (HTML/JS vanilla) con: clientes, presupuestos, facturas, productos, proveedores, configuración
- Catálogo de productos con autocomplete en presupuestos
- Importación/exportación CSV de productos
- Proveedores y relación con productos
- PDF de presupuestos y facturas

**❌ Pendiente técnico crítico:**
- `invoicesAdmin.routes.ts`: función `resend-whatsapp` aún usa n8n → migrar a Meta API directa
- `psp.routes.ts`: `emitToN8n('paid')` → notificar al profesional al cobrar
- Sin autenticación (merchantId=1 hardcodeado)
- Sin notificación WhatsApp al profesional cuando cliente acepta/rechaza
- Sin Home con métricas
- CSS no está optimizado para móvil

---

## SPRINT 1 — Semana 1-2: "Que funcione end-to-end y se pueda mostrar"

**Objetivo:** Flujo completo funcionando sin errores + demo en móvil + primeros 5 usuarios piloto.

### Tarea 1.1 — Completar migración n8n → Meta API directa
**Archivos a modificar:** `src/modules/system/app/routes/invoicesAdmin.routes.ts`
**Qué hacer:** Reemplazar `POST /:id/resend-whatsapp` para usar `sendWhatsAppTemplate` con plantilla `payment_request_es`
**Estado:** Código listo en el chat, pendiente de commit

### Tarea 1.2 — Notificación WhatsApp al profesional cuando cliente decide
**Archivo a modificar:** `src/modules/quotes/app/routes/quotes.routes.ts` (función `/quote/:id/decision`)
**Qué hacer:** Después de actualizar el estado del presupuesto, enviar WhatsApp al teléfono del merchant (`quote.merchant.whatsappPhone`) con mensaje:
- Si acepta: `"✅ [NombreCliente] aceptó tu cotización #[ID] por [Total] [Moneda]"`
- Si rechaza: `"❌ [NombreCliente] rechazó la cotización #[ID]. Motivo: [reason]"`
**Función a usar:** `sendWhatsAppText` del archivo `src/integrations/whatsapp.ts`
**Tiempo:** 4 horas

### Tarea 1.3 — Home Dashboard con métricas clave
**Archivo nuevo:** `public/dashboard/js/homeView.js`
**Qué mostrar:**
1. Total pendiente de cobrar (facturas con status=pending)
2. Presupuestos sin respuesta (status=sent, >0)
3. Cobrado este mes (facturas status=paid, createdAt en mes actual)
4. Botón grande "Nueva cotización"
5. Feed de actividad reciente (últimas 5 acciones)
**Endpoint nuevo necesario:** `GET /admin/metrics/home` → devuelve los 3 números
**Tiempo:** 2-3 días

### Tarea 1.4 — Mobile-first CSS
**Archivo:** `public/dashboard/css/styles.css`
**Qué cambiar:**
- Sidebar → bottom navigation en móvil (<768px)
- Tablas → cards apiladas en móvil
- Formulario de presupuesto → campos full-width en móvil
- Botones → tamaño mínimo 44px (Apple HIG)
- Touch targets correctos
**Tiempo:** 3 días

### Tarea 1.5 — Quick Quote (3 campos, 30 segundos)
**Descripción:** Pantalla nueva o modal en la Home que permite:
1. Campo: buscar/crear cliente (nombre + teléfono si nuevo)
2. Campo: concepto rápido (autocomplete del catálogo)
3. Campo: precio (o suma de líneas del catálogo)
4. Toggle: condiciones de pago (100% / 50-50)
5. Botón: "Enviar por WhatsApp"
**Resultado:** Presupuesto creado en draft + PDF generado + enviado por WhatsApp
**Tiempo:** 2-3 días

### Tarea 1.6 — Mejorar landing de decisión del cliente
**Archivo:** `src/modules/system/app/routes/quoteDecisionLanding.routes.ts`
**Qué mejorar en la landing GET `/pay/quote/:id/accept`:**
- Mostrar logo del negocio (si merchant.logoUrl)
- Mostrar nombre del profesional y del negocio
- Mostrar las líneas del presupuesto (sin costes, solo precios finales)
- Mostrar total y condiciones de pago
- Botones más grandes y claros
- Diseño responsive mobile-first
**Tiempo:** 1-2 días

**Criterio de éxito del Sprint 1:**
- El flujo completo funciona en un móvil sin errores
- El profesional recibe WhatsApp cuando el cliente decide
- La Home muestra 3 KPIs reales
- Se puede mostrar a 5 personas y que entiendan el producto sin explicación

---

## SPRINT 2 — Semana 3-4: "Que se pueda vender"

**Objetivo:** Autenticación, multi-tenant real, primer cobro del producto.

### Tarea 2.1 — Autenticación básica (magic link)
**Por qué magic link y no contraseña:** El profesional que se olvida la contraseña no llama a soporte, abandona el producto.
**Flujo:**
1. Pantalla de login: introduce email
2. Sistema manda email con link de 1 uso (válido 15 min)
3. Al clicar el link → sesión activa (JWT en cookie httpOnly)
4. Todas las rutas `/admin/*` protegidas con middleware de auth
**Nuevo modelo en Prisma:** `AuthSession { token, merchantId, expiresAt, usedAt }`
**Tiempo:** 3-4 días

### Tarea 2.2 — Multi-tenant real
**Qué cambiar:**
- Eliminar `DEFAULT_MERCHANT_ID = 1` hardcodeado en `merchantAdmin.ts`
- El middleware de auth extrae el `merchantId` del JWT y lo inyecta en `req.merchantId`
- Todas las consultas a la DB filtran por `merchantId` de la sesión
- El seed sigue funcionando para development
**Tiempo:** 2-3 días (con autenticación ya hecha)

### Tarea 2.3 — Onboarding wizard (3 pasos)
**Trigger:** Primera vez que el merchant entra (campo `onboardingCompleted: false` en Merchant)
**Paso 1:** Nombre de tu negocio + tu nombre
**Paso 2:** Teléfono WhatsApp donde quieres recibir notificaciones
**Paso 3:** "Crea tu primer producto o servicio" (o "Saltar por ahora")
**Al terminar:** `onboardingCompleted = true` → redirige a Home
**Tiempo:** 2 días

### Tarea 2.4 — Registro de nuevos merchants
**Flujo:**
1. Página `/register`: introduce nombre + email
2. Sistema crea Merchant + envía magic link
3. Al clicar → sesión activa + onboarding wizard
**Tiempo:** 1 día (reutiliza lógica de magic link)

### Tarea 2.5 — Stripe Billing (suscripciones)
**Qué construir:**
- Página de planes dentro de la app (`/planes` o modal)
- 3 botones: Básico $9 / Pro $19 / Empresa $39
- Al clicar → Stripe Checkout con precio recurrente mensual
- Webhook `customer.subscription.updated` → actualizar `merchant.plan`
- Free trial de 14 días sin tarjeta
- Bloqueo suave: después de 14 días sin plan → solo puede ver datos, no crear
**Tiempo:** 2-3 días

**Criterio de éxito del Sprint 2:**
- Un profesional puede registrarse, hacer el onboarding, crear su catálogo y enviar su primer presupuesto sin ayuda
- El sistema cobra $19/mes automáticamente
- No hay datos compartidos entre merchants

---

## SPRINT 3 — Semana 5-6: "Que sea irresistible"

**Objetivo:** Features que generan WOW y retención alta.

### Tarea 3.1 — Firma digital del cliente
**Flujo:**
- En la landing de aceptación, antes de confirmar, el cliente puede dibujar su firma en canvas (o checkbox "Acepto")
- La firma se guarda como imagen en el presupuesto (campo `signatureUrl` en Quote)
- El PDF del presupuesto incluye la firma
- El profesional ve en el BO: "Aceptado con firma digital" → protección legal
**Valor:** +25% tasa de cierre (datos industria). Argumento de venta principal.
**Tiempo:** 3 días

### Tarea 3.2 — Fotos del trabajo adjuntas al presupuesto
**Flujo:**
- Al crear el presupuesto, botón "Añadir fotos del trabajo/zona"
- Upload hasta 4 fotos
- Las fotos aparecen en la landing del cliente (genera confianza)
- Las fotos aparecen en el PDF (descripción visual del trabajo)
**Almacenamiento:** Cloudflare R2 o S3 (añadir variable `STORAGE_BUCKET`)
**Tiempo:** 3 días

### Tarea 3.3 — Recordatorio automático (24h sin respuesta)
**Trigger:** Presupuesto con status=sent, >24h sin cambio
**Mecanismo:** Cron job cada hora (`node-cron` o Railway Cron) que:
1. Busca quotes en status=sent con `updatedAt < now - 24h`
2. Envía WhatsApp al cliente con recordatorio (nueva plantilla `quote_reminder_es`)
3. Añade campo `reminderSentAt` al Quote para no re-enviar
**Valor:** +18% en conversión de presupuestos no respondidos
**Tiempo:** 1-2 días

### Tarea 3.4 — Solicitud de reseña Google al cobrar
**Trigger:** Factura marcada como `paid`
**Acción:** WhatsApp al cliente (nueva plantilla `review_request_es`):
> "Hola [Nombre], gracias por confiar en [NegocioProfesional]. Si estás satisfecho, nos ayudaría mucho que dejaras una reseña: [link Google Reviews configurado por el merchant]"
**Configuración:** Campo `googleReviewUrl` en la configuración del merchant
**Valor:** Genera SEO local gratuito para el profesional → fideliza al cliente en el producto
**Tiempo:** 1 día

### Tarea 3.5 — Portal del cliente (historial)
**Concepto:** URL permanente para cada cliente: `/cliente/[token]` donde ve:
- Todas sus cotizaciones (con PDFs descargables)
- Todas sus facturas
- Estado de pagos pendientes
- Botón para pagar facturas pendientes
**Valor:** El profesional tiene algo que "entregar" al cliente. El cliente siente que trabaja con una empresa seria.
**Tiempo:** 3-4 días

### Tarea 3.6 — Internacionalización básica (es-MX / es-CO)
**Cambios clave:**
- "Presupuesto" → "Cotización" en México y Colombia
- IVA 16% en México (configurable por merchant)
- Moneda MXN/COP por defecto según país del merchant
- Textos de WhatsApp adaptados por locale
**Implementación:** Archivo `src/core/i18n/locales.ts` con diccionario por locale. El merchant selecciona su país en onboarding.
**Tiempo:** 2 días

---

## Criterio de éxito global en 30 días

Al final del Sprint 3 debes poder decir SÍ a todo esto:

- [ ] Un fontanero en México puede registrarse, completar el onboarding y enviar su primera cotización en menos de 10 minutos
- [ ] El flujo completo cotización → WhatsApp → aceptación → factura → cobro funciona sin errores en móvil
- [ ] El profesional recibe notificación en tiempo real cuando el cliente decide
- [ ] Hay al menos 5 usuarios piloto reales usando el producto semanalmente
- [ ] El producto cobra $19/mes automáticamente a quien no está en trial
- [ ] La landing del cliente genera confianza (logo, detalle, firma)
- [ ] No hay datos cruzados entre merchants distintos

---

# PARTE C — VISIÓN COMPLETA (después del mes 1)

## C1. Hoja de ruta post-lanzamiento (sin fechas fijas, en orden de prioridad)

### Nivel 1 — Para escalar a 100 clientes
- **Good/Better/Best:** 3 opciones de precio por presupuesto → +30% ticket medio
- **PWA instalable:** Se instala como app desde el navegador, funciona offline
- **Notificaciones push:** Alertas en tiempo real sin necesitar WhatsApp propio del sistema

### Nivel 2 — Para retención alta (churn <3%)
- **Módulo de gastos:** Registrar facturas de proveedores, foto del ticket
- **Margen real por trabajo:** El profesional ve su beneficio neto en cada trabajo (ingresos - gastos asignados)
- **Top clientes / Top servicios:** Los 5 clientes que más facturan, los 5 servicios más demandados
- **Comentarios internos por trabajo:** Notas privadas que no ve el cliente

### Nivel 3 — Para crecer el ticket medio (upgrade a Empresa)
- **Múltiples usuarios:** El profesional añade a su ayudante o socio
- **Mini-proyectos:** Vincular presupuesto → fotos antes/durante/después → checklist → cierre
- **Gestión de agenda básica:** Ver qué trabajos tiene la semana

### Nivel 4 — Para entrar en España en 2026
- **VeriFactu compliance:** QR obligatorio, registro SIF, exportación RRSIF
- **Modelos 303/130:** Preparación del trimestre fiscal
- **Open Banking:** Conciliación automática de transferencias con facturas

### Nivel 5 — Para escalar a toda LATAM
- **App nativa React Native** (iOS + Android)
- **Mercado Pago** (Mexico, Argentina, Colombia, Brasil)
- **SPEI** (México) y **PSE** (Colombia) como métodos de pago
- **CFDI 4.0** (México) — solo si se require para empresas grandes
- **Idioma pt-BR** (Brasil)

### Nivel 6 — Para diferenciación máxima
- **IA por voz:** Dictar la cotización en voz → el sistema crea los ítems automáticamente
- **Sugerencia de precios:** "El precio medio para este servicio en tu zona es X"
- **OCR para gastos:** Foto del ticket → extracción automática de datos
- **API pública:** Para integraciones con CRMs, ERPs propios, etc.
- **Plantillas sectoriales:** Catálogos pre-cargados por oficio (electricista CDMX, plomero Bogotá...)

## C2. Estructura de módulos técnicos (referencia)

```
src/
├── core/
│   ├── config/env.ts
│   ├── db/prisma.ts
│   ├── http/
│   ├── storage/
│   ├── utils/
│   ├── validation/schemas.ts
│   └── i18n/locales.ts              ← NUEVO (Sprint 3)
├── integrations/
│   ├── whatsapp.ts                  ← ya existe
│   ├── stripe.ts                    ← ya existe
│   └── mailer.ts                    ← ya existe
├── modules/
│   ├── auth/                        ← NUEVO (Sprint 2)
│   │   ├── app/routes/auth.routes.ts
│   │   └── domain/auth.service.ts
│   ├── billing/                     ← ya existe
│   ├── invoicing/                   ← ya existe
│   ├── metrics/                     ← NUEVO (Sprint 1)
│   │   ├── app/routes/metrics.routes.ts
│   │   └── domain/metrics.service.ts
│   ├── products/                    ← ya existe
│   ├── providers/                   ← ya existe
│   ├── quotes/                      ← ya existe
│   └── system/                      ← ya existe
public/
└── dashboard/
    ├── js/
    │   ├── homeView.js              ← NUEVO (Sprint 1)
    │   ├── quickQuoteView.js        ← NUEVO (Sprint 1)
    │   └── [vistas existentes]
    └── css/
        └── styles.css               ← REFACTOR mobile-first (Sprint 1)
```

## C3. Modelos de datos futuros (referencia para no romper la DB actual)

```sql
-- Sprint 2
AuthSession { id, merchantId, token, expiresAt, usedAt, createdAt }
ALTER TABLE merchants ADD onboardingCompleted BOOLEAN DEFAULT false;
ALTER TABLE merchants ADD plan TEXT DEFAULT 'trial';  -- trial/basic/pro/empresa
ALTER TABLE merchants ADD planExpiresAt TIMESTAMP;
ALTER TABLE merchants ADD stripeCustomerId TEXT;
ALTER TABLE merchants ADD stripeSubscriptionId TEXT;

-- Sprint 3
ALTER TABLE quotes ADD signatureUrl TEXT;
ALTER TABLE quotes ADD photoUrls TEXT[];  -- array de URLs
ALTER TABLE quotes ADD reminderSentAt TIMESTAMP;
ALTER TABLE merchants ADD googleReviewUrl TEXT;
ALTER TABLE customers ADD portalToken TEXT;  -- token único por cliente
ALTER TABLE merchants ADD locale TEXT DEFAULT 'es-MX';
```

## C4. Variables de entorno necesarias por sprint

**Ya configuradas en Railway:**
- DATABASE_URL, NODE_ENV, PORT, PUBLIC_BASE_URL
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_BUSINESS_ACCOUNT_ID

**Sprint 2 — añadir:**
```
JWT_SECRET=<string-aleatorio-largo>
EMAIL_FROM=noreply@presufacil.online
SMTP_URL=<smtp de Resend o similar>
STRIPE_PRICE_ID_BASIC=price_xxx
STRIPE_PRICE_ID_PRO=price_xxx
STRIPE_PRICE_ID_EMPRESA=price_xxx
```

**Sprint 3 — añadir:**
```
STORAGE_BUCKET_URL=<Cloudflare R2 o S3>
STORAGE_ACCESS_KEY=<key>
STORAGE_SECRET_KEY=<secret>
```

---

# APÉNDICE — Cómo trabajar con este documento

## ¿Dónde vive este documento?

**Sube este archivo al repositorio de GitHub:** `docs/MASTER.md`

Ventajas:
- Siempre actualizado con el código
- Cualquier IA o colaborador puede leerlo directamente
- Fuerza a actualizar cuando el producto cambia

## ¿Cómo usar este documento en nuevos chats de IA?

Al empezar un nuevo chat, pega esto:

```
Soy el fundador de PresuFácil, un SaaS WhatsApp-first para profesionales de servicios (fontaneros, electricistas, reformistas) en LATAM. Stack: Node.js + TypeScript + Express + Prisma + PostgreSQL, desplegado en Railway.

[Pega aquí la Parte A completa]
[Pega aquí la tarea específica de Parte B en la que estás trabajando]

Actúa como mi CTO. Escribe código real, funcional, siguiendo la arquitectura existente. Pregunta solo lo indispensable.
```

## ¿Cuándo actualizar este documento?

- Al completar un sprint: mover tareas de "pendiente" a "completado"
- Al cambiar de opinión sobre una feature: actualizar Parte A si afecta al norte
- Al aprender algo de los usuarios piloto: actualizar el ICP o la propuesta de valor
- **Nunca borrar, siempre tachar o mover a "descartado por [razón]"** — el historial de decisiones es valioso

## Plantilla de commit cuando actualizas el documento

```
docs: actualizar MASTER.md - [qué cambió]

- Sprint 1 completado: Home metrics + Quick Quote + notificaciones WA
- ICP ajustado: añadir "técnicos de climatización" al perfil principal
- Sprint 2 iniciado: auth + multi-tenant
```

---

*Este documento reemplaza a: DOCUMENTO_MAESTRO_V5, DOCUMENTO_FUNCIONAL_V5, ROADMAP_OFICIAL_V2*
*Mantener solo este archivo. Un documento, una verdad.*
