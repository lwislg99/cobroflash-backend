# PRESUFÁCIL — DOCUMENTO ÚNICO DE PRODUCTO
**Versión 3.0 | Mayo 2026 | Documento vivo — actualizar en cada sprint**

> **IMPORTANTE — Cómo usar este documento:**
> - **Parte A:** Estrategia y norte. Leer antes de CUALQUIER decisión.
> - **Parte B:** Inventario completo de features (lo que existe HOY).
> - **Parte C:** Bugs conocidos y deuda técnica.
> - **Parte D:** Plan de sprints hasta producción vendible.
> - **Parte E:** Estrategia de negocio, precios y GTM.
> - **En cada nuevo chat con IA:** pegar Parte A + la tarea específica de Parte D.

---

# PARTE A — NORTE CLARO (nunca cambiar sin debatirlo)

## A1. Qué somos en una frase

PresuFácil permite a cualquier profesional de servicios (fontanero, electricista, reformista, pintor, cerrajero) **crear una cotización profesional en menos de 30 segundos, enviarla por WhatsApp, que el cliente la acepte con un toque, y cobrar sin salir de la conversación.**

## A2. Para quién es (ICP — Ideal Customer Profile)

**Cliente principal:** Profesional independiente o pequeño equipo (1-5 personas) que trabaja por proyecto/presupuesto en servicios a domicilio.

**Geografía por prioridad:**
1. México (lanzamiento — mayor mercado, menor regulación, WhatsApp dominante)
2. Colombia (lanzamiento simultáneo o mes 2)
3. España (fase 2, 2026-2027, impulsado por VeriFactu obligatorio)
4. Argentina, Perú, Chile (fase 3)

**Perfil psicográfico del cliente:**
- Tiene 30-55 años
- Usa el móvil para TODO (no tiene ordenador o no lo usa para el negocio)
- Hace sus presupuestos en WhatsApp con texto libre o foto de papel
- Pierde trabajos porque tarda en responder o el presupuesto no parece profesional
- Cobra en efectivo y no tiene registro de nada
- Le da vergüenza su "factura" actual (es un PDF feo de Word o directamente no factura)
- No quiere software complicado — quiere algo que funcione en 5 minutos

**NO es nuestro cliente en fase 1:**
- Empresas con más de 10 empleados
- Negocios que ya usan Jobber, ServiceTitan, Holded o similar
- Sectores que no trabajan por presupuesto (restaurantes, retail, etc.)

## A3. El problema real (validado con datos)

El 80% de los profesionales de servicios gestionan sus ventas así hoy:
1. Van a la obra, evalúan el trabajo
2. Escriben el presupuesto en papel, WhatsApp o Excel (30-90 minutos)
3. Lo mandan por WhatsApp como texto o foto
4. Esperan. A veces el cliente no responde. No hacen seguimiento.
5. Si el cliente acepta, facturan días después o nunca
6. Cobran en efectivo o por transferencia sin registro

**Consecuencia medida:** Tasa de cierre del 35-40%.
**Con seguimiento profesional y cotización visual:** 60-75% (fuente: Housecall Pro, 2024).
**Diferencia:** +2-3 trabajos al mes sin conseguir más clientes.

## A4. Propuesta de valor (por rol)

**Para el profesional:**
> "Envías la cotización en 30 segundos. El cliente la acepta desde el móvil y la firma digitalmente. Cobras antes de empezar el trabajo. Sin Excel, sin papel, sin perseguir al cliente."

**Para el cliente final:**
> "Recibes un WhatsApp con la cotización en PDF, la aceptas con un toque, firmas con el dedo y pagas de forma segura. Todo trazado y sin llamadas."

## A5. El diferenciador que nadie puede copiar rápido

**El ciclo completo WhatsApp-first:** cotización → aceptación con firma digital (evidencia legal) → factura automática → cobro integrado, TODO dentro del flujo de WhatsApp. Ningún competidor en LATAM tiene esto funcionando.

| Competidor | WA nativo | Firma digital | Cobro integrado | LATAM | Precio |
|---|---|---|---|---|---|
| Jobber | ❌ email | ❌ | ⚠️ externo | ❌ | $39-249/mes |
| Housecall Pro | ❌ SMS | ❌ | ✅ | ❌ | $69+/mes |
| Cotiza Pro (MX) | ⚠️ PDF | ❌ | ❌ | ✅ | Gratis |
| PresuNow (ES) | ✅ | ❌ | ❌ | ❌ España | €12-29/mes |
| **PresuFácil** | **✅ nativo** | **✅** | **✅ Stripe/MP** | **✅** | **$19/mes** |

## A6. Métricas norte

**Métrica primaria:** Cotizaciones enviadas por WhatsApp por semana activa.
**Objetivo mes 3:** ≥10 cotizaciones/semana por merchant activo.
**Objetivo de negocio mes 6:** 50 merchants pagantes = $950/mes MRR.
**Objetivo de negocio mes 12:** 200 merchants pagantes = $3.800/mes MRR.

## A7. Lo que NO construimos en fase 1

❌ Contabilidad completa (libros, modelos 303/130 más allá de exportación básica)
❌ Open Banking / conciliación bancaria automática
❌ App nativa iOS/Android (la PWA es suficiente para MVP)
❌ API pública para terceros
❌ Gestión de agenda/calendario
❌ CRM avanzado con pipeline de ventas
❌ Chat integrado con clientes

---

# PARTE B — INVENTARIO COMPLETO DE FEATURES (estado actual)

> Esta sección documenta TODO lo que existe en el código hoy. Actualizar tras cada sprint.

## B1. Autenticación y usuarios

| Feature | Estado | Descripción |
|---|---|---|
| Registro de cuenta | ✅ | `/register.html` — nombre, email, país. Trial 14 días sin tarjeta. |
| Login magic link | ✅ | Email con enlace de un solo uso, válido 15 min. Sin contraseña. |
| Sesión persistente | ✅ | Cookie httpOnly `pf_session`, 30 días. |
| Logout | ✅ | Borra sesión y cookie. |
| Multi-tenant real | ✅ | Todos los datos filtrados por merchantId de sesión. Sin datos cruzados. |
| Equipo — invitar miembro | ✅ | Admin invita por email, se envía magic link de 7 días. |
| Equipo — roles Admin/Técnico | ✅ | Admin: acceso total. Técnico: crear/ver cotizaciones, sin billing/config. |
| Equipo — suspender miembro | ✅ | Invalida sesiones activas del técnico. |
| Equipo — reenviar invitación | ✅ | Genera nuevo magic link para el miembro. |
| Bloqueo soft post-trial | ✅ | Después de 14 días sin plan, bloquea escritura (403). Los datos siguen visibles. |

## B2. Onboarding y configuración

| Feature | Estado | Descripción |
|---|---|---|
| Wizard de onboarding | ✅ | 3 pasos: nombre negocio, WhatsApp, primer servicio. Se muestra solo la primera vez. |
| Setup checklist en Home | ✅ | Muestra pasos pendientes (logo, datos fiscales, WA, primer presupuesto). Desaparece al completar. |
| Configuración — datos empresa | ✅ | Nombre comercial, razón social, NIF/CIF, dirección, moneda, prefijo facturas, logo. |
| Configuración — país y locale | ✅ | Selección de ES/MX/CO/AR/PE/CL. Cambia terminología (Presupuesto/Cotización), moneda, IVA. |
| Configuración — WhatsApp | ✅ | Número propio del profesional para recibir notificaciones. |
| Configuración — IBAN/CLABE | ✅ | Se muestra en la página de pago por transferencia. |
| Configuración — reseñas Google | ✅ | URL para solicitud automática de reseña al cobrar. |
| Configuración — emails | ✅ | Toggle: email cuando cliente paga / cuando acepta presupuesto. |
| Configuración — resumen semanal | ⚠️ UI EXISTS, BACKEND MISSING | Checkbox en UI pero no hay cron ni endpoint implementado. **BUG.** |

## B3. Presupuestos / Cotizaciones

| Feature | Estado | Descripción |
|---|---|---|
| Crear cotización (formulario completo) | ✅ | Múltiples líneas, autocomplete del catálogo, markup %, IVA por línea, preview en tiempo real. |
| Quick Quote modal (30 segundos) | ✅ | Cliente + concepto + precio + condiciones. Desde el botón en Home. |
| Good/Better/Best (3 opciones de precio) | ✅ | El profesional define 3 tiers (Básico/Estándar/Premium). El cliente elige. |
| Sugerir líneas con IA (Claude) | ✅ | Describe el trabajo en texto, Claude propone las líneas del presupuesto usando el catálogo. Requiere ANTHROPIC_API_KEY. |
| Generar mensaje WhatsApp con IA | ✅ | Claude redacta un mensaje personalizado para acompañar la cotización. |
| Plantillas de cotización | ✅ | Guardar líneas como plantilla reutilizable. Cargar plantilla en nueva cotización. |
| Duplicar cotización | ✅ | Crea nueva cotización con las mismas líneas. |
| Notas internas | ✅ | Texto privado por cotización, no visible al cliente. Autoguardado 1.2s. |
| PDF de cotización | ✅ | Generación automática con PDFKit. Logo, datos merchant/cliente, líneas, total, footer. |
| PDF con firma digital | ✅ | Se regenera el PDF tras la aceptación incluyendo la imagen de la firma. |
| PDF con Good/Better/Best | ✅ | Layout 3 columnas, Estándar destacado en verde. |
| Enviar por WhatsApp | ✅ | Meta Cloud API directa con plantilla `quote_decision_es`. Marca status='sent'. |
| Recordatorio automático 24h | ✅ | Cron cada hora. Si cotización en 'sent' >24h sin respuesta, reenvía plantilla al cliente. Campo `reminderSentAt` para idempotencia. |
| Historial de cotizaciones | ✅ | Lista con búsqueda, filtros, estado, indicador de notas internas. |
| Detalle de cotización | ✅ | Estado, cliente, líneas, totales, decisión, facturas relacionadas, margen del trabajo, notas. |
| Aceptar/Rechazar desde BO | ✅ | El profesional puede marcar decisión desde el panel (canal: backoffice). |

## B4. Landing del cliente (lo que ve el cliente en su móvil)

| Feature | Estado | Descripción |
|---|---|---|
| Landing de aceptación | ✅ | Responsive, mobile-first. Muestra logo merchant, líneas del presupuesto, total, condiciones de pago. |
| Firma digital con canvas | ✅ | Canvas táctil para dibujar firma. Opción "Acepto sin firma". |
| Selección de tier (GBB) | ✅ | El cliente ve las 3 opciones con sus precios y elige una antes de firmar. |
| Landing de rechazo | ✅ | Formulario con motivo (precio alto, otro proveedor, etc.) y comentario libre. |
| Localización de textos | ✅ | La landing usa el locale del merchant (Presupuesto/Cotización, EUR/MXN, etc.). |
| Portal del cliente | ✅ | URL permanente `/cliente/:token`. Historial de cotizaciones y facturas. Botón "Pagar ahora". |
| Solicitar presupuesto desde portal | ✅ | El cliente puede escribir descripción de nuevo trabajo. Genera QuoteRequest en el BO. |

## B5. Facturas

| Feature | Estado | Descripción |
|---|---|---|
| Factura automática al aceptar | ✅ | Se genera con el importe correcto según paymentTerms (FULL_UPFRONT o FIFTY_FIFTY). |
| Plan 100% al aceptar | ✅ | 1 factura del 100% al confirmar. |
| Plan 50/50 | ✅ | 1ª factura del 50% al aceptar, 2ª del 50% al finalizar (manual desde BO). |
| PDF de factura | ✅ | Número, merchant, cliente, líneas, IVA desglosado, total, QR de verificación. |
| VeriFactu (España) | ✅ | Cadena SHA-256, URL QR AEAT. Solo merchants con country='ES' y NIF configurado. |
| Enviar factura por WhatsApp | ✅ | Plantilla `payment_request_es` con botón de pago. Meta API directa. |
| Reenviar factura por WhatsApp | ✅ | Desde el detalle de factura en el BO. |
| Recordatorio de pago 7 días | ✅ | Cron diario a las 10h. Envía WA si factura pending >7 días sin `reminder7SentAt`. |
| Recordatorio de pago 14 días | ✅ | Mismo mecanismo para 14 días. |
| Recordatorio manual desde BO | ✅ | Botón "Recordar pago" en detalle de factura. |
| Cambiar estado factura | ✅ | Marcar como pagada/pendiente desde detalle. |
| Marcar múltiples como pagadas | ✅ | Checkbox bulk en la lista de facturas. |
| Regenerar PDF con VeriFactu | ✅ | Botón en detalle. Aplica VeriFactu si merchant ES con NIF. |
| Historial de facturas | ✅ | Lista con filtros por estado y búsqueda. |
| Detalle de factura | ✅ | Estado, cliente, total, fecha pago, badges de recordatorios enviados. |

## B6. Cobros y pagos

| Feature | Estado | Descripción |
|---|---|---|
| Cobro con tarjeta (Stripe Checkout) | ✅ | Redirige a Stripe. Webhook confirma pago y marca factura como pagada. |
| Cobro por transferencia bancaria | ✅ | Página con IBAN/CLABE, referencia a copiar, instrucciones paso a paso. |
| Cobro con Mercado Pago | ✅ | Preferencia MP, redirect a checkout. Requiere MP_ACCESS_TOKEN configurado. |
| Webhook Stripe | ✅ | Procesa `checkout.session.completed`, `subscription.updated`, `subscription.deleted`. |
| Webhook PSP (transferencias) | ✅ | Procesa `payment.confirmed`, `payment.failed`, `payment.expired`. |
| Webhook Mercado Pago | ✅ | Procesa notificaciones IPN de MP con verificación de firma. |
| Auto-factura al cobrar | ✅ | Si `AUTO_INVOICE_ON_PAID=true`, genera y envía la factura automáticamente al confirmar pago. |
| Email de factura al cobrar | ✅ | Si `AUTO_EMAIL_INVOICE_ON_PAID=true` y cliente tiene email. |
| Notificación WA al profesional al cobrar | ✅ | Mensaje "💰 Pago recibido de [Cliente]: [importe] [moneda]". |
| Solicitud de reseña Google al cobrar | ✅ | WA al cliente si `googleReviewUrl` configurado en merchant. |
| Email al profesional al cobrar | ✅ | Si `notifyEmailOnPaid=true` y merchant tiene email. |
| Simulador de pago (dev) | ✅ | Solo en entorno de desarrollo. Botón para simular pago confirmado/fallido/expirado. |

## B7. Clientes

| Feature | Estado | Descripción |
|---|---|---|
| Lista de clientes | ✅ | Con búsqueda por nombre, teléfono, email. |
| Crear cliente | ✅ | Nombre (obligatorio), teléfono, email, notas. |
| Editar cliente | ✅ | Modal de edición. |
| Importar clientes CSV | ✅ | Drag & drop o pegar. Columnas: nombre, telefono, email, notas. Dedup automático. |
| Portal del cliente (URL permanente) | ✅ | Genera/obtiene token único. URL copiable desde el BO. |
| Vista 360 del cliente | ✅ | Historial completo: KPIs (facturado, cobrado, beneficio), todas las cotizaciones y facturas del cliente. |
| Solicitudes de presupuesto | ✅ | Los clientes pueden pedir nuevos presupuestos desde su portal. Aparecen en "Solicitudes" con badge de pendientes. |

## B8. Catálogo de productos

| Feature | Estado | Descripción |
|---|---|---|
| Lista de productos | ✅ | Con búsqueda, filtro de activos/inactivos. |
| Crear producto | ✅ | Nombre, descripción, precio, coste, IVA, proveedor, activo/inactivo. |
| Editar producto | ✅ | Modal de edición con todos los campos. |
| Desactivar/activar producto | ✅ | Toggle de estado sin borrar. |
| Borrar producto | ✅ | Elimina definitivamente. |
| Autocomplete en cotizaciones | ✅ | Busca por nombre normalizado (sin tildes, minúsculas). Muestra descripción y precio. Recientes guardados en localStorage. |
| Exportar catálogo CSV | ✅ | Descarga todos los productos del merchant. |
| Importar catálogo CSV | ✅ | Soporta separador coma o punto y coma. Dedup por nombre normalizado. |
| Proveedor asociado a producto | ✅ | Relación producto → proveedor. |

## B9. Proveedores

| Feature | Estado | Descripción |
|---|---|---|
| Lista de proveedores | ✅ | Nombre, teléfono, email, activo. |
| Crear proveedor | ✅ | Con validación de nombre duplicado. |
| Editar proveedor | ✅ | Modal. |
| Desactivar/activar proveedor | ✅ | Toggle. |
| Borrar proveedor | ✅ | Bloquea si tiene productos asociados (`provider_in_use`). |

## B10. Gastos y margen

| Feature | Estado | Descripción |
|---|---|---|
| Lista de gastos | ✅ | Filtros por mes y categoría. Tabla con concepto, categoría, importe, trabajo vinculado. |
| Crear gasto | ✅ | Concepto, importe, fecha, categoría (materiales/desplazamiento/herramientas/subcontrata/otros), notas, foto del ticket (base64), cotización vinculada, proveedor. |
| Editar gasto | ✅ | Modal completo. |
| Borrar gasto | ✅ | Con confirmación. |
| Foto del ticket | ✅ | Upload desde móvil (FileReader → base64). Se guarda en DB como texto. |
| Resumen mensual | ✅ | KPIs: gasto total mes, sin asignar, categoría mayor. |
| Exportar gastos CSV | ✅ | Con filtros de fecha y categoría. |
| Margen por cotización | ✅ | En detalle de cotización: Ingresos − Gastos vinculados = Margen neto + %. |
| Beneficio neto en Home | ✅ | KPI adicional si hay gastos: Cobrado este mes − Gastos este mes. |

## B11. Informes

| Feature | Estado | Descripción |
|---|---|---|
| Informe P&L mensual | ✅ | Tabla con 12 meses: ingresos, gastos, beneficio, margen %. Filtro por año. |
| Gráfico de barras SVG | ✅ | Barras agrupadas por mes: verde (ingresos), rojo (gastos), morado (beneficio). Sin dependencias externas. |
| Comparativa año anterior | ✅ | KPIs anuales con variación % vs año anterior. |
| Exportar facturas CSV | ✅ | Con filtros: estado, rango de fechas. |
| Exportar gastos CSV | ✅ | Con filtros: categoría, rango de fechas. |
| Exportar presupuestos CSV | ✅ | Con filtros: estado, rango de fechas. |

## B12. Dashboard Home

| Feature | Estado | Descripción |
|---|---|---|
| KPI: Pendiente de cobro | ✅ | Suma de facturas status=pending + count. |
| KPI: Cotizaciones sin respuesta | ✅ | Count de quotes en status=sent. |
| KPI: Cobrado este mes | ✅ | Suma de facturas status=paid, paidAt en mes actual. |
| KPI: Gastos este mes | ✅ | Solo aparece si hay gastos registrados. |
| KPI: Beneficio neto | ✅ | Solo aparece si hay gastos. Destaca en rojo si negativo. |
| Actividad reciente | ✅ | Últimas 5 cotizaciones con cliente, importe, estado y fecha. |
| Top 5 clientes | ✅ | Por importe facturado total (facturas pagadas). |
| Top 5 servicios | ✅ | Por frecuencia en cotizaciones aceptadas. Con barra de progreso. |
| Botón "Nueva cotización rápida" | ✅ | Abre el Quick Quote modal. |
| Setup checklist | ✅ | Lista de configuración pendiente. Desaparece al completar todos los pasos. |
| Badge solicitudes pendientes | ✅ | En "Solicitudes" del menú. Se refresca cada 5 min. |

## B13. Planes y billing

| Feature | Estado | Descripción |
|---|---|---|
| Trial 14 días | ✅ | Sin tarjeta. Acceso completo. |
| Vista de planes | ✅ | Muestra plan actual, días restantes de trial, 3 planes con precios. |
| Stripe Checkout | ✅ | Redirige a Stripe para suscripción mensual. |
| Portal de gestión Stripe | ✅ | El usuario puede cambiar/cancelar su suscripción. |
| Webhook suscripción activa | ✅ | `subscription.updated` → actualiza `merchant.plan` y `planExpiresAt`. |
| Webhook suscripción cancelada | ✅ | `subscription.deleted` → downgrade a trial. |
| Bloqueo soft | ✅ | 403 en operaciones de escritura tras expirar trial sin plan. Datos legibles. |
| STRIPE_PRICE_IDs | ⚠️ PENDIENTE | Las variables `STRIPE_PRICE_ID_BASIC/PRO/EMPRESA` NO están creadas en Railway. **Crítico para billing.** |

## B14. PWA y accesibilidad

| Feature | Estado | Descripción |
|---|---|---|
| PWA instalable | ✅ | `manifest.json` con iconos, `sw.js` con cache shell. iOS y Android. |
| Service Worker | ✅ | Cache-first para estáticos. Network-first para API. |
| Mobile-first CSS | ✅ | Sidebar → overlay en móvil. Bottom nav. Touch targets 44px. Tablas con scroll horizontal. |
| Búsqueda global | ✅ | Input en topbar. Busca en clientes, presupuestos y facturas. Navegación con teclado (↑↓ Enter). Atajo `/`. |
| Inter font | ✅ | Google Fonts. Design system v2 con CSS vars. |
| Design tokens | ✅ | Variables CSS para colores, radios, sombras. Consistencia total. |

## B15. Internacionalización

| Feature | Estado | Descripción |
|---|---|---|
| España (ES) | ✅ | Presupuesto · EUR · IVA 21% · `es-ES` |
| México (MX) | ✅ | Cotización · MXN · IVA 16% · `es-MX` |
| Colombia (CO) | ✅ | Cotización · COP · IVA 19% · `es-CO` |
| Argentina (AR) | ✅ | Presupuesto · ARS · IVA 21% · `es-AR` |
| Perú (PE) | ✅ | Cotización · PEN · IGV 18% · `es-PE` |
| Chile (CL) | ✅ | Cotización · CLP · IVA 19% · `es-CL` |
| Locale en landing del cliente | ✅ | La landing del cliente usa el locale del merchant. |

---

# PARTE C — BUGS CONOCIDOS Y DEUDA TÉCNICA

> Lista exhaustiva de lo que está roto o incompleto. Prioridad: CRÍTICO > ALTO > MEDIO > BAJO.

## C1. CRÍTICO — Bloquean la venta o el uso normal

| # | Bug | Archivo afectado | Impacto |
|---|---|---|---|
| C-01 | `STRIPE_PRICE_ID_BASIC/PRO/EMPRESA` no están configurados en Railway | Variables de entorno | Nadie puede suscribirse. El billing no funciona en producción. |
| C-02 | Resumen semanal por email — existe en la UI de Settings pero NO tiene backend | `settingsView.js` (checkbox `notifyWeeklySummary`), campo no existe en Prisma, no hay cron | El usuario activa algo que no hace nada. Expectativa rota. |
| C-03 | Plantillas WhatsApp (`quote_decision_es`, `payment_request_es`, `quote_reminder_es`) deben estar aprobadas por Meta | Externo (Meta Business Manager) | Sin aprobación, no se pueden enviar mensajes outbound. El producto no funciona. |

## C2. ALTO — Confunden al usuario o dan mala imagen

| # | Bug | Archivo afectado | Descripción |
|---|---|---|---|
| C-04 | Campo "Teléfono override (E.164 sin +, opcional)" en el formulario de cotización | `quotesView.js` | Es un campo de developer/debug que no tiene sentido para el usuario final. Debe ocultarse o eliminarse del formulario. |
| C-05 | Upload de fotos del trabajo — la feature está documentada pero no implementada | Sin implementar | Aparece en el roadmap, los usuarios piloto la pedirán. Necesita Cloudflare R2 o S3. |
| C-06 | El PDF de cotización con líneas de descripción muy larga puede desformatearse | `pdf.service.ts` | Textos largos sin espacios rompen el layout en PDFKit. Ya hay un fix parcial con `softBreakLongTokens` pero no cubre todos los casos. |

## C3. MEDIO — Molestan pero no bloquean

| # | Bug | Descripción |
|---|---|---|
| C-07 | El autocomplete de productos en `quotesView.js` usa `localStorage` para recientes | El código tiene `localStorage` en varias líneas para guardar productos recientes. Esto NO funciona en Claude.ai pero sí en producción en el navegador del usuario. Documentado para no confundir. |
| C-08 | En el historial de cotizaciones, el botón "Crear presupuesto" hace `menuBtn.click()` en lugar de llamar directamente a `renderAppView` | `quotesListView.js` | Funciona pero es frágil. |
| C-09 | El campo `internalNotes` en quotesDetailView usa `escHtml` pero luego se renderiza en un `<textarea>` que no necesita escape | `quotesDetailView.js` | No es un bug de seguridad pero es código incorrecto. |

## C4. Variables de entorno — Estado actual

```
DATABASE_URL            ✅ Configurada
SESSION_SECRET          ✅ Configurada
RESEND_API_KEY          ✅ Configurada
EMAIL_FROM              ✅ Configurada
STRIPE_SECRET_KEY       ✅ Configurada
STRIPE_WEBHOOK_SECRET   ✅ Configurada
WHATSAPP_PHONE_NUMBER_ID ✅ Configurada
WHATSAPP_ACCESS_TOKEN   ✅ Configurada
WHATSAPP_BUSINESS_ACCOUNT_ID ✅ Configurada
PUBLIC_BASE_URL         ✅ Configurada
AUTO_INVOICE_ON_PAID    ✅ Configurada
AUTO_EMAIL_INVOICE_ON_PAID ✅ Configurada
ANTHROPIC_API_KEY       ✅ Configurada
STRIPE_PRICE_ID_BASIC   ❌ FALTA — crear en Stripe Dashboard
STRIPE_PRICE_ID_PRO     ❌ FALTA — crear en Stripe Dashboard
STRIPE_PRICE_ID_EMPRESA ❌ FALTA — (ver cambio de pricing en Parte E)
MP_ACCESS_TOKEN         ⚠️ Opcional — solo si activas Mercado Pago
STORAGE_BUCKET_URL      ❌ FALTA — necesario para fotos de trabajo (S3/R2)
STORAGE_ACCESS_KEY      ❌ FALTA
STORAGE_SECRET_KEY      ❌ FALTA
```

---

# PARTE D — PLAN DE SPRINTS HASTA PRODUCCIÓN VENDIBLE

> Objetivo: salir a producción con algo que se pueda vender a los primeros 20 clientes pagantes.
> **Filosofía:** Arreglar > Simplificar > Añadir. En ese orden siempre.

## Sprint AHORA — "Reparar lo roto" (3-5 días)

**Objetivo:** Que todo lo que existe funcione correctamente y sin mentiras al usuario.

### Tarea N-1 — Crear los precios en Stripe (30 minutos, bloqueante)

1. Entrar en Stripe Dashboard → Products → Create product.
2. **Con el nuevo modelo de pricing (ver Parte E):** crear UN solo precio recurrente mensual a $19/mes y uno anual a $179/año.
3. Copiar los `price_id` y añadirlos a Railway como variables de entorno.
4. Actualizar `subscriptions.routes.ts` para reflejar el nuevo plan único.

### Tarea N-2 — Resolver resumen semanal o eliminar de la UI (1 día)

**Opción A (recomendada): eliminar el checkbox de la UI** hasta tener el backend implementado.
- Archivo: `settingsView.js` — eliminar el bloque `createToggle('notifyWeeklySummary', ...)`.
- Archivo: schema Prisma — el campo `notifyWeeklySummary` no existe, no añadir aún.

**Opción B: implementar el cron** (2-3 días adicionales, ver Sprint 7).

### Tarea N-3 — Ocultar campo "Teléfono override" del formulario de cotización (1 hora)

Archivo: `quotesView.js`
Buscar el `fieldTo` (Teléfono override) y simplemente no añadirlo al formulario visible:
```javascript
// En la sección "Datos del cliente", eliminar estas líneas:
const fieldTo = createField("Teléfono override...", "to", "text", false);
clientFormRow.appendChild(fieldTo.wrapper);
```
El campo sigue existiendo en el payload interno pero no confunde al usuario.

### Tarea N-4 — Aprobar plantillas en Meta Business Manager (externo, 1-3 días)

Verificar en Meta Business Manager que las plantillas `quote_decision_es`, `payment_request_es` y `quote_reminder_es` están en estado "Approved". Si están en "Pending" o "Rejected", revisar el contenido y reenviar. Sin esto, el producto no puede enviar WhatsApp.

### Criterio de éxito del Sprint AHORA:
- [ ] Un usuario puede suscribirse y pagar
- [ ] No hay opciones en Settings que no hagan nada
- [ ] El formulario de cotización no tiene campos de developer
- [ ] Las plantillas de WhatsApp están aprobadas

---

## Sprint 7 — "Pulir la primera impresión" (1 semana)

**Objetivo:** Que los primeros 5 usuarios piloto tengan una experiencia WOW sin necesitar explicación.

### Tarea 7.1 — Resumen semanal por email (3 días)

**Campo nuevo en Prisma:**
```prisma
notifyWeeklySummary Boolean @default(false) @map("notify_weekly_summary")
```

**Cron nuevo en `cron.ts`:**
```typescript
// Lunes a las 9:00 AM
cron.schedule('0 9 * * 1', async () => {
  await sendWeeklySummaryEmails();
});
```

**Servicio `weeklyReport.service.ts`:**
- Para cada merchant con `notifyWeeklySummary=true`
- Calcula: cobros semana anterior, cotizaciones enviadas, aceptadas, clientes nuevos
- Envía email via Resend con resumen visual en HTML

**Vista previa desde Settings:**
- Endpoint `GET /admin/me/weekly-preview` devuelve los datos del resumen actual
- El botón "Vista previa" en Settings llama a este endpoint y muestra un modal

### Tarea 7.2 — Fotos del trabajo en cotizaciones (3 días)

**Prerrequisito:** Configurar Cloudflare R2 (gratuito hasta 10GB/mes) o AWS S3.

**Variables de entorno a añadir:**
```
STORAGE_BUCKET_URL=https://[account].r2.cloudflarestorage.com/[bucket]
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
STORAGE_PUBLIC_URL=https://pub-[hash].r2.dev
```

**Implementación:**
- Botón "📷 Añadir fotos" al crear cotización
- Hasta 4 fotos por cotización
- Se suben a R2/S3, se guarda el array de URLs en `quote.photoUrls`
- Las fotos aparecen en la landing del cliente (genera confianza)
- Las fotos aparecen en el PDF de cotización

**Schema:**
```prisma
photoUrls String[] // array de URLs públicas
```

### Tarea 7.3 — Mejorar landing del cliente: más confianza (2 días)

La landing actual funciona pero puede mejorar para generar más confianza:

- Añadir avatar/iniciales del merchant si no hay logo
- Mostrar descripción del trabajo (si existe) en cada línea
- Si hay fotos del trabajo, mostrarlas en un carrusel simple
- Badge "Firmado digitalmente" más visible una vez completada la firma
- Timer de expiración si el presupuesto tiene fecha límite
- Compartir por WhatsApp o copiar link desde la landing

### Tarea 7.4 — Notificaciones push (PWA) (2 días)

El profesional actualmente solo recibe notificaciones por WhatsApp. Añadir push notifications para los que tienen la PWA instalada.

**Implementación:**
- Service Worker ya existe (`sw.js`)
- Añadir `push` event listener en el SW
- Endpoint `POST /admin/me/push-subscription` para guardar el endpoint de push
- Enviar push desde el backend en los eventos clave: cliente aceptó, pago recibido

### Criterio de éxito del Sprint 7:
- [ ] El resumen semanal llega correctamente el lunes a las 9h
- [ ] Se pueden subir fotos al presupuesto y aparecen en la landing del cliente
- [ ] La landing del cliente genera más confianza visual
- [ ] Los primeros 3 usuarios piloto han enviado al menos 1 cotización real

---

## Sprint 8 — "Preparar el lanzamiento en LATAM" (1 semana)

**Objetivo:** Todo listo para lanzar en México y Colombia con los primeros clientes pagantes.

### Tarea 8.1 — Mercado Pago (2 días)

El código de Mercado Pago ya existe en el backend (`payMp.routes.ts`, `mercadopago.ts`, `mpWebhook.routes.ts`). Solo falta:

1. Crear cuenta en Mercado Pago para el negocio
2. Obtener `MP_ACCESS_TOKEN` de producción
3. Configurar la URL del webhook en el panel de MP: `https://cobroflash-backend-production.up.railway.app/webhooks/mp`
4. Añadir `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` en Railway
5. En la landing de pago, añadir botón "Pagar con Mercado Pago" junto a los botones existentes

### Tarea 8.2 — SPEI (México) y PSE (Colombia) (3 días)

Para México, añadir OXXO Pay como opción de pago (Stripe lo soporta nativamente para MX):

```typescript
// En payCard.routes.ts, para merchants con country='MX':
payment_method_types: ['card', 'oxxo'],
```

Esto permite que el cliente pague en efectivo en OXXO con un código. Desbloquea el 40% del mercado mexicano que no tiene tarjeta de crédito.

### Tarea 8.3 — Landing pública de marketing (2 días)

Necesitamos una página de marketing en `presufacil.online` (o subdominio) que explique el producto para la captación orgánica:

- Hero: "La primera cotización que el cliente firma por WhatsApp"
- Demo video o GIF del flujo completo
- Beneficios en 3 puntos
- Testimonios (con los primeros piloto)
- Botón "Prueba gratis 14 días"
- Precios (ver Parte E)
- FAQ

Esta página es esencial para cualquier esfuerzo de marketing.

### Tarea 8.4 — Dominio y branding definitivos (1 día)

- Confirmar que `presufacil.online` (o `.mx` / `.com`) está aprobado
- Configurar el dominio en Railway para que apunte al backend
- Actualizar `PUBLIC_BASE_URL` y todos los emails/mensajes WA con el dominio final
- Favicon y meta tags correctos en el dashboard

### Criterio de éxito del Sprint 8:
- [ ] Se puede pagar con Mercado Pago (MX/CO)
- [ ] Se puede pagar con OXXO Pay (MX — sin tarjeta)
- [ ] Existe landing de marketing funcional con botón de registro
- [ ] El dominio final está activo
- [ ] 5 usuarios piloto reales usando el producto con el dominio final

---

## Sprint 9 — "Los primeros clientes pagantes" (2 semanas)

**Objetivo:** 10 merchants pagantes. MRR real.

### Tarea 9.1 — Onboarding mejorado: "Primera cotización guiada" (2 días)

El onboarding actual tiene 3 pasos (nombre, WA, primer producto). Mejorar con:

1. Paso 1: Nombre del negocio + país + tipo de oficio (electricista, fontanero, etc.)
2. Paso 2: WhatsApp de notificaciones
3. Paso 3: "Crea tu primer servicio" con sugerencias por oficio (plantillas sectoriales)
4. Paso 4 (nuevo): "Añade a tu primer cliente" — nombre + teléfono
5. **Paso 5 (clave): "Envía tu primera cotización AHORA"** — pre-rellena el Quick Quote con el cliente y servicio del onboarding y lo envía directamente. El usuario ve el flujo completo antes de cerrar el onboarding.

Este paso 5 es el "momento WOW" que hace que el usuario entienda el valor del producto en los primeros 5 minutos.

### Tarea 9.2 — Plantillas sectoriales de catálogo (2 días)

Pre-cargar catálogos de servicios típicos por oficio y país, para que el profesional no empiece con el catálogo vacío:

```typescript
const SECTOR_TEMPLATES = {
  electricista_mx: [
    { name: 'Instalación punto de luz', price: 350, vat: 0.16 },
    { name: 'Cambio de interruptor', price: 180, vat: 0.16 },
    { name: 'Instalación enchufe', price: 200, vat: 0.16 },
    // ...
  ],
  fontanero_mx: [...],
  electricista_es: [...],
  // ...
};
```

En el paso 3 del onboarding, el usuario elige su oficio y se pre-cargan ~10 servicios típicos.

### Tarea 9.3 — Sistema de referidos (2 días)

Un fontanero que está contento con el producto es el mejor vendedor. Implementar:

- Cada merchant tiene un código de referido único (ej. `GARCIA2026`)
- URL de registro con código: `presufacil.online/registro?ref=GARCIA2026`
- Si el referido se convierte en pagante: el referidor recibe 1 mes gratis
- Dashboard mínimo: "Has referido X personas, Y son pagantes, tienes Z meses gratis"
- Implementación técnica: campo `referredBy` en Merchant, campo `freeMonths` en Merchant, aplicar descuento en el siguiente cobro de Stripe

### Tarea 9.4 — Emails de lifecycle automatizados (2 días)

Implementar con Resend los emails clave del ciclo de vida del usuario:

| Email | Cuándo | Objetivo |
|---|---|---|
| Bienvenida | Al registrarse | Confirmar que entiende el producto, link a guía |
| Día 3 | 3 días sin enviar cotización | "¿Tienes problemas? Aquí está tu primera cotización de muestra" |
| Día 7 | Si no ha enviado cotización | "Tu trial expira en 7 días. Te mostramos cómo sacarle partido" |
| Día 12 | 2 días antes de que expire trial | "Tu prueba expira pronto — suscríbete y no pierdas nada" |
| Trial expirado | Día 15 sin suscripción | "Tus datos siguen aquí. Activa el plan para seguir" |
| Primer pago cobrado | Cuando paga | "Bienvenido al plan Pro. Aquí tienes todo lo que puedes hacer" |
| Inactivo 14 días | Sin actividad 2 semanas | "Hemos notado que no has enviado cotizaciones. ¿En qué fallamos?" |

### Criterio de éxito del Sprint 9:
- [ ] El onboarding nuevo tiene tasa de "primera cotización enviada" >50%
- [ ] Los emails de lifecycle están activos
- [ ] Sistema de referidos funciona
- [ ] 10 merchants pagantes
- [ ] MRR real > $190/mes

---

## Sprint 10 — "Escalar en España" (3 semanas)

**Objetivo:** Preparar el producto para la regulación española y el mercado de autónomos.

### Tarea 10.1 — VeriFactu completo para España (5 días)

El código actual ya tiene una implementación parcial de VeriFactu (SHA-256, QR AEAT). Completar:

- Registro SIF (Sistema de Información Fiscal) en la AEAT
- Exportación RRSIF (el fichero XML que hay que enviar a Hacienda)
- Campo de huella en el PDF más prominente
- Tests end-to-end con datos reales de un autónomo español

### Tarea 10.2 — Preparación IVA trimestral (modelo 303) (3 días)

Un autónomo español debe presentar el modelo 303 cada trimestre. Ofrecer:

- Resumen de IVA desglosado por trimestre
- Export CSV con los datos necesarios para rellenar el 303
- NO somos una gestoría, no rellenamos el 303 automáticamente
- Simplemente organizamos los datos para que el usuario o su gestor lo hagan fácilmente

### Criterio de éxito del Sprint 10:
- [ ] VeriFactu funciona end-to-end con datos reales
- [ ] El resumen IVA trimestral está disponible
- [ ] Primeros 5 autónomos españoles como beta testers

---

# PARTE E — ESTRATEGIA DE NEGOCIO, PRECIOS Y GTM

## E1. Decisión de pricing — Plan Único

**Recomendación: UN SOLO PLAN a $19/mes.**

### Por qué eliminar los 3 planes (Básico $9 / Pro $19 / Empresa $39):

**Problema con 3 planes:**
1. Un fontanero de 45 años no sabe la diferencia entre "Básico" y "Pro". Se bloquea en la decisión.
2. Tener un plan de $9 hace que algunos usuarios "suficientes" se queden ahí y nunca suban. El ARPU (ingreso medio por usuario) baja.
3. No sabemos qué features limitar. Limitar la firma digital o los recordatorios en el plan Básico destruye la propuesta de valor.
4. Los competidores exitosos en este segmento (Jobber antes de 2020) empezaron con un plan único.

**Propuesta de plan único:**
```
Plan Pro — $19/mes (o $179/año = 2 meses gratis)
- TODO incluido, sin límites
- Cotizaciones ilimitadas
- WhatsApp nativo
- Firma digital
- Facturación automática
- Módulo de gastos y margen
- Hasta 3 usuarios del equipo
- Soporte por WhatsApp

Trial: 14 días gratis, sin tarjeta
```

**¿Qué hacemos con Empresa?**

Para equipos >3 personas, añadir un addon o un segundo plan simple:
```
Plan Equipo — $39/mes
= Plan Pro + hasta 10 usuarios + asignación de trabajos
```

La diferenciación es SOLO el número de usuarios. Fácil de entender.

### Precios por mercado:

| Mercado | Precio mensual | Precio anual | Equivalente local |
|---|---|---|---|
| España | €19/mes | €179/año | — |
| México | $299 MXN/mes | $2.990 MXN/año | ~$15 USD |
| Colombia | $79.000 COP/mes | $750.000 COP/año | ~$19 USD |
| Argentina | $18.900 ARS/mes | $179.000 ARS/año | ~$19 USD |

**Argumento de venta en México:**
- 10 cotizaciones/mes × +25% tasa de cierre = 2-3 trabajos extra
- Trabajo medio: $1.500-3.000 MXN
- Costo PresuFácil: $299 MXN/mes
- **ROI mínimo: 10x el primer mes**

## E2. Go-To-Market (GTM) — México primero

### Canal 1: Contenido en TikTok/Reels (CAC bajo, escalable)

**Formato que funciona:**
```
"Mira cómo hago un presupuesto en 30 segundos"
[pantalla del móvil, voz en off]
→ Abre PresuFácil
→ Escribe el cliente y el concepto
→ Pulsa Enviar por WhatsApp
→ El cliente lo recibe, firma con el dedo
→ "Y ya cobré antes de empezar el trabajo"
```

**Cuentas a crear:**
- @presufacil.mx (TikTok + Instagram)
- Contenido: tutoriales, casos reales, "antes vs después"
- 3 vídeos/semana mínimo durante 3 meses

**Hooks que funcionan para este público:**
- "¿Todavía mandas los presupuestos por texto en WhatsApp?"
- "El fontanero que más trabaja en CDMX usa este truco"
- "Cómo pasé de 40% a 70% de cierre en mis presupuestos"

### Canal 2: Grupos de WhatsApp de gremios (CAC ≈ $0)

Los profesionales de oficios tienen grupos de WhatsApp de su gremio (electricistas CDMX, fontaneros Bogotá, etc.). Un mensaje del tipo:

```
Hola a todos 👋 Soy [nombre], llevo X años de electricista y empecé a usar 
una app que me cambió la vida para los presupuestos. En 30 segundos genero 
el PDF, lo mando por WA y el cliente lo firma desde el móvil. Ya no persigo 
a nadie. Si quieren probarla gratis 14 días: presufacil.mx
```

Enviar por 1 miembro real del grupo, no como spam masivo. Autenticidad > alcance.

### Canal 3: Distribuidores de materiales de construcción (CAC bajo, alto volumen)

Las ferreterías y distribuidores de materiales (Construrama, Sodimac, Home Depot México) ya tienen a los fontaneros y electricistas como clientes. Proponer:

- Acuerdo de distribución: ellos promocionan PresuFácil a sus clientes, nosotros les damos comisión del 20% del primer año
- Material en mostrador: un flyer de 10×15 cm con QR al registro
- Capacitación en tienda: visita trimestral para hacer demo en vivo
- Incentivo para el vendedor de la tienda: $50 MXN por cada registro que convierte

### Canal 4: YouTube SEO (largo plazo, muy rentable)

**Búsquedas con volumen y poca competencia:**
- "cómo hacer presupuestos de fontanería"
- "app presupuestos fontaneros México"
- "cómo cobrar más por mis trabajos de electricista"

**Formato:** Tutoriales de 5-10 minutos usando PresuFácil como herramienta, no como producto a vender. El CTA al final.

### Canal 5: Influencers de oficios (CAC medio)

Existen creadores en TikTok/YouTube de "fontanero" o "electricista" con 50k-500k seguidores que muestran su trabajo. Un acuerdo de afiliado o canje:

- Cuentas objetivo: @fontaneroTV, @electricistaMX, etc.
- Propuesta: video mostrando PresuFácil "sin filtros" a cambio de comisión del 30% los primeros 6 meses de cada suscriptor que venga de su enlace
- Costo: $0 si es comisión o $500-2.000 USD si es pago fijo

## E3. Métricas de negocio — Proyecciones realistas

| Mes | Merchants activos | Pagantes | MRR |
|---|---|---|---|
| 1 | 30 | 5 | $95 |
| 2 | 80 | 15 | $285 |
| 3 | 150 | 30 | $570 |
| 6 | 400 | 80 | $1.520 |
| 12 | 1.000 | 200 | $3.800 |
| 18 | 2.500 | 550 | $10.450 |
| 24 | 6.000 | 1.400 | $26.600 |

**Supuestos:**
- Conversión trial → pagante: 20% (conservador; el mercado típico es 15-25%)
- Churn mensual: 5% (alto al principio, baja con retención)
- CAC promedio: $25 USD en LATAM
- ARPU: $19/mes
- LTV promedio (24 meses con 5% churn): ~$380 USD

**Para hacer $1M ARR necesitas:** ~4.400 merchants pagantes.

**¿Es posible?** Sí. Solo en México hay ~4 millones de profesionales de oficios. Con penetración del 0.1% = 4.000 clientes.

## E4. Estrategia de retención (para reducir churn)

El mayor riesgo es que el profesional se suscriba, use el producto 2-3 veces y lo abandone porque "no ve el valor". La solución es crear hábito en las primeras 2 semanas.

**Acciones:**
1. **Onboarding activo:** El equipo (tú, hasta tener escala) llama/manda WA al nuevo usuario el día 2 y le pregunta cómo va. Lo ayuda a enviar su primera cotización si no lo ha hecho.
2. **Email de día 3:** "Hola [nombre], ¿enviaste tu primera cotización? Si tienes dudas, responde este email".
3. **WhatsApp semanal durante el primer mes:** Un mensaje personalizado de parte del fundador con un tip útil.
4. **NPS en el día 30:** Un WhatsApp simple: "Oye [nombre], ¿del 1 al 10, cuánto nos recomendarías a otros fontaneros?" Quienes ponen 9-10 son candidatos a ser promotores en grupos.

---

# PARTE F — STACK TÉCNICO Y ARQUITECTURA

## F1. Stack actual

```
Backend:     Node.js + TypeScript + Express 5 + Prisma 6 + PostgreSQL
Deploy:      Railway (auto-deploy desde GitHub main)
URL prod:    https://cobroflash-backend-production.up.railway.app
Pagos:       Stripe (tarjeta + suscripciones) + PSP custom (banco) + Mercado Pago
WhatsApp:    Meta Cloud API directa (NUNCA n8n)
Email:       Resend HTTP API (NO SMTP en producción)
PDF:         PDFKit (generación en servidor)
Cron:        node-cron (dentro del proceso, no Railway Cron)
PWA:         manifest.json + sw.js (cache shell)
IA:          Anthropic claude-opus-4-7 (suggest-quote + quote-message)
Frontend:    HTML/JS vanilla, Inter font, CSS vars design system v2
Storage:     ⚠️ Pendiente Cloudflare R2 para fotos
```

## F2. Estructura de módulos

```
src/
├── core/
│   ├── config/env.ts              Variables de entorno tipadas (source of truth)
│   ├── db/prisma.ts               Prisma singleton
│   ├── http/authMiddleware.ts     requireAuth, requireActivePlan, requireRole, setCookie
│   ├── http/jsonError.ts          Middleware de errores JSON
│   ├── i18n/locales.ts            Diccionario por país (ES/MX/CO/AR/PE/CL)
│   ├── cron/cron.ts               Jobs: recordatorio cotizaciones (1h), recordatorio facturas (diario)
│   ├── storage/dirs.ts            Carpetas físicas: /invoices, /outbox
│   ├── utils/utils.ts             normalizePhone, calcTotal, makeReference, esc
│   └── validation/schemas.ts     Zod schemas centrales
├── integrations/
│   ├── whatsapp.ts               sendWhatsAppTemplate, sendWhatsAppText
│   ├── stripe.ts                  Cliente Stripe
│   ├── mercadopago.ts             createMpPreference, getMpPayment, verifyMpWebhookSignature
│   ├── mailer.ts                  Nodemailer (fallback SMTP dev)
│   ├── claude.ts                  Anthropic SDK singleton
│   └── n8n.ts                     LEGACY — NO USAR
├── modules/
│   ├── ai/                        Suggest quote lines + generate WA message
│   ├── auth/                      Magic link, sesiones, registro, invitaciones equipo
│   ├── billing/                   Charges, PSP webhook, Stripe webhook, Stripe Billing, MP webhook
│   ├── expenses/                  CRUD gastos, resumen, margen por cotización
│   ├── exports/                   CSV: facturas, gastos, presupuestos
│   ├── invoicing/                 Facturas + PDF + VeriFactu
│   ├── messaging/                 Email facturas, emails merchant
│   ├── metrics/                   Home KPIs + top clientes/servicios
│   ├── products/                  Catálogo, autocomplete, CSV import/export
│   ├── providers/                 Proveedores
│   ├── quoteRequests/             Solicitudes de presupuesto desde portal cliente
│   ├── quotes/                    Cotizaciones, billingPlan, reminder cron, GBB tiers
│   ├── reports/                   P&L mensual
│   ├── search/                    Búsqueda global
│   ├── system/                    Admin routes: customers, quotes, invoices, merchant, portales
│   ├── team/                      Gestión de equipo (miembros, invitaciones, roles)
│   └── templates/                 Plantillas de cotización
└── lib/
    ├── invoicing.ts               ensureInvoiceForCharge (lógica central de facturas)
    ├── pdf.ts                     Wrapper → pdf.service.ts
    └── email.ts                   Wrapper → email.service.ts
```

## F3. Reglas críticas del código

1. **NUNCA usar n8n.** Todo WhatsApp via `src/integrations/whatsapp.ts` (Meta Cloud API).
2. **Multi-tenant siempre.** Todas las queries filtran por `req.merchantId` (inyectado por `requireAuth`).
3. **Prisma sin TTY.** Usar siempre `db push`, nunca `migrate dev` interactivo.
4. **Frontend sin frameworks.** HTML/JS vanilla. Sin React, sin bundler, sin build step.
5. **Emails via Resend.** No SMTP directo en producción.
6. **Cron dentro del proceso.** No usar Railway Cron. Los crons están en `src/core/cron/cron.ts`.

## F4. Rutas públicas (sin autenticación)

```
GET  /health                        Health check + DB ping
POST /auth/login                    Solicitar magic link
GET  /auth/verify?token=xxx         Verificar → cookie sesión → redirect /dashboard/
POST /auth/register                 Crear cuenta merchant
POST /auth/logout                   Borrar sesión y cookie
GET  /pay/quote/:id/accept          Landing aceptación (firma + GBB)
GET  /pay/quote/:id/reject          Landing rechazo
GET  /pay/card/:id                  Checkout Stripe
GET  /pay/bank/:id                  Pago por transferencia (IBAN/CLABE)
GET  /pay/mp/:id                    Checkout Mercado Pago
GET  /cliente/:token                Portal del cliente
POST /cliente/:token/quote-request  Solicitar presupuesto desde portal
POST /quote/create                  Crear cotización
POST /quote/:id/decision            Decisión del cliente (acepta con firma + tierId)
POST /quote/:id/accept              Aceptar presupuesto (BO o webhook)
POST /quote/:id/reject              Rechazar presupuesto
POST /webhooks/psp                  Webhook pagos bancarios
POST /webhooks/stripe               Webhook Stripe (raw body)
POST /webhooks/mp                   Webhook Mercado Pago
```

---

# PARTE G — CÓMO TRABAJAR CON ESTE DOCUMENTO

## G1. En cada nuevo chat con IA

```
Soy el fundador de PresuFácil, un SaaS WhatsApp-first para profesionales 
de servicios (fontaneros, electricistas, reformistas) en LATAM.

Stack: Node.js + TypeScript + Express + Prisma + PostgreSQL, Railway.
Repo: https://github.com/lwislg99/cobroflash-backend

[Pega aquí PARTE A completa]
[Pega aquí la tarea específica del sprint activo]

Actúa como mi CTO. Escribe código real, funcional, siguiendo la 
arquitectura existente. NO pseudocódigo. Pregunta solo lo indispensable.
Prioriza siempre: ¿esto acerca a tener clientes pagando?
```

## G2. Cuándo actualizar este documento

- **Al completar cada sprint:** mover tareas, actualizar estado de features en Parte B.
- **Al descubrir un bug nuevo:** añadir a Parte C con prioridad.
- **Al cambiar de opinión en negocio:** actualizar Parte A o E con la justificación.
- **Al aprender algo de usuarios piloto:** actualizar ICP en A2 si es necesario.
- **Nunca borrar, siempre tachar o mover a "descartado por [razón]".**

## G3. Template de commit al actualizar el documento

```
docs: MASTER v3.x — [qué cambió]

- Sprint X completado: [features]
- Bug C-XX resuelto: [descripción]
- Precio actualizado: [razón del cambio]
```

---

*Versión 3.0 — actualizado Mayo 2026*
*Sprints 1-6 completados. Sprint AHORA = reparar bugs críticos. Target: primeros 10 clientes pagantes.*
*Reemplaza: MASTER v1.0, MASTER v2.0*
*Un documento, una verdad.*

---

# PARTE H — PLAN DETALLADO TAREA A TAREA (para Claude Code)

> **INSTRUCCIONES PARA CLAUDE CODE:**
> - Ejecuta las tareas EN ORDEN. No saltes ninguna.
> - Cada tarea indica el archivo exacto, qué buscar y qué hacer.
> - Al terminar cada tarea: compila, verifica que arranca, haz commit.
> - Si algo no está claro, pregunta ANTES de escribir código.
> - No toques archivos que no aparezcan en la tarea.

---

## SPRINT AHORA — Arreglar lo roto (ejecutar primero)

### TAREA A-1 — Eliminar campo "Teléfono override" del formulario de cotización

**Archivo:** `public/dashboard/js/quotesView.js`

**Qué buscar:**
```javascript
const fieldTo = createField(
  "Teléfono override (E.164 sin +, opcional)",
  "to",
  "text",
  false
);
clientFormRow.appendChild(fieldTo.wrapper);
```

**Qué hacer:** Eliminar esas dos líneas. El objeto `fieldTo` ya no se usa en ningún otro sitio del formulario visible. Verificar que no hay otras referencias a `fieldTo` que rompan el build — si las hay, también eliminarlas.

**Verificación:** Abrir el formulario de "Nuevo presupuesto". El campo "Teléfono override" no debe aparecer.

**Commit:** `fix(quotes): eliminar campo teléfono override del formulario`

---

### TAREA A-2 — Eliminar checkbox "Resumen semanal" de Settings

**Archivo:** `public/dashboard/js/settingsView.js`

**Qué buscar:** El bloque que crea el toggle de resumen semanal. Aparece justo después de los toggles `tNotifyPaid` y `tNotifyAccepted`:
```javascript
const tWeeklySummary = createToggle(
  "notifyWeeklySummary",
  "Resumen semanal por email (lunes a las 9h)",
  "Un email con lo que ocurrió la semana pasada..."
);
```
Y el botón "Vista previa":
```javascript
// buscar: "Vista previa del resumen semanal"
```
Y en el payload del submit:
```javascript
notifyWeeklySummary: tWeeklySummary.chk.checked,
```
Y en la carga de datos (`loadMerchant`):
```javascript
tWeeklySummary.chk.checked = !!merchant.notifyWeeklySummary;
```

**Qué hacer:** Eliminar todas esas referencias. También eliminar el `form.appendChild(tWeeklySummary.wrapper)`.

**Verificación:** Abrir Configuración. No debe aparecer "Resumen semanal". No debe haber errores en consola.

**Commit:** `fix(settings): eliminar resumen semanal hasta tener backend`

---

### TAREA A-3 — Crear precio único en Stripe y configurar variables

**No es código, es configuración. Pasos:**

1. Ir a https://dashboard.stripe.com → Products → + Add product
2. Crear producto: nombre "PresuFácil Pro", descripción "Plan mensual todo incluido"
3. Añadir precio recurrente: $19.00 USD / mes → copiar el `price_id` (empieza por `price_`)
4. Añadir otro precio del mismo producto: $179.00 USD / año → copiar el `price_id`
5. En Railway → Variables → añadir:
   - `STRIPE_PRICE_ID_PRO=price_XXXXX` (mensual)
   - `STRIPE_PRICE_ID_PRO_ANNUAL=price_XXXXX` (anual)

**Archivo a modificar:** `src/modules/billing/app/routes/subscriptions.routes.ts`

**Qué cambiar:** Actualizar el array `PLANS` para reflejar el plan único:
```typescript
const PLANS = [
  {
    id: 'pro',
    label: 'Pro',
    price: 19,
    priceId: config.STRIPE_PRICE_ID_PRO,
    priceAnnualId: config.STRIPE_PRICE_ID_PRO_ANNUAL,
    priceAnnual: 179,
  },
] as const;
```

**Archivo a modificar:** `src/core/config/env.ts`

**Qué añadir** (junto a las otras variables de Stripe):
```typescript
STRIPE_PRICE_ID_PRO:         process.env.STRIPE_PRICE_ID_PRO         || '',
STRIPE_PRICE_ID_PRO_ANNUAL:  process.env.STRIPE_PRICE_ID_PRO_ANNUAL  || '',
```

**Archivo a modificar:** `public/dashboard/js/plansView.js`

**Qué cambiar:** La función `buildPlansHtml` debe mostrar solo 1 plan con opción mensual/anual en lugar de 3. Rediseñar el bloque HTML para que muestre:
- "Plan Pro — $19/mes"
- Toggle o tabs: "Mensual / Anual ($179/año — 2 meses gratis)"
- Un solo botón de checkout

**Commit:** `feat(billing): plan único Pro $19/mes con opción anual`

---

### TAREA A-4 — Actualizar el webhook de Stripe para plan único

**Archivo:** `src/modules/billing/app/routes/stripe.routes.ts`

**Qué buscar:** El bloque que maneja `checkout.session.completed` con `mode: 'subscription'`:
```typescript
const planId = String(s.metadata?.plan || '');
```

**Qué cambiar:** Cuando llega una suscripción nueva, el `planId` siempre será `'pro'`. Verificar que el metadata se envía correctamente desde `subscriptions.routes.ts` en el momento de crear el checkout.

En `subscriptions.routes.ts`, buscar `stripe.checkout.sessions.create` y verificar que el metadata incluye:
```typescript
metadata: { merchant_id: String(req.merchantId), plan: 'pro' },
```

**Verificación:** Usar el webhook de test de Stripe CLI para simular una suscripción y verificar que `merchant.plan` se actualiza a `'pro'`.

**Commit:** `fix(billing): webhook suscripción compatible con plan único`

---

## SPRINT 7 — Resumen semanal por email

### TAREA 7-1 — Añadir campo al schema de Prisma

**Archivo:** `prisma/schema.prisma`

**Qué buscar:** El modelo `Merchant`, al final de los campos de notificaciones:
```prisma
notifyEmailOnPaid            Boolean @default(true)  @map("notify_email_on_paid")
notifyEmailOnQuoteAccepted   Boolean @default(false) @map("notify_email_on_quote_accepted")
```

**Qué añadir justo después:**
```prisma
notifyWeeklySummary          Boolean @default(false) @map("notify_weekly_summary")
```

**Luego ejecutar:**
```bash
npx prisma db push --accept-data-loss
npx prisma generate
```

**Commit:** `db: añadir campo notifyWeeklySummary al merchant`

---

### TAREA 7-2 — Servicio de resumen semanal

**Archivo nuevo:** `src/modules/messaging/domain/weeklyReport.service.ts`

**Qué debe hacer esta función `sendWeeklySummaryEmails()`:**
1. Buscar todos los merchants con `notifyWeeklySummary = true` y `email != null`
2. Para cada merchant, calcular los datos de la semana anterior (lunes 00:00 → domingo 23:59):
   - Importe cobrado (facturas `status=paid`, `paidAt` en esa semana)
   - Cotizaciones enviadas (`status != 'draft'`, `createdAt` en esa semana)
   - Cotizaciones aceptadas (`status = 'accepted'`, `acceptedAt` en esa semana)
   - Clientes nuevos (`createdAt` en esa semana)
3. Enviar email via Resend con HTML simple mostrando esos 4 datos
4. Si todos son 0, no enviar (evitar emails vacíos)

**Estructura del email HTML:**
```
Asunto: 📊 Tu semana en PresuFácil — [X cobrado]
Cuerpo:
  - KPI grande: "Cobraste X € esta semana"
  - 3 datos más pequeños: cotizaciones enviadas, aceptadas, clientes nuevos
  - CTA: "Ver informe completo" → link al dashboard
  - Footer: "Para desactivar estos emails, ve a Configuración"
```

**Commit:** `feat(messaging): servicio de resumen semanal por email`

---

### TAREA 7-3 — Registrar el cron del resumen semanal

**Archivo:** `src/core/cron/cron.ts`

**Qué añadir** (después del cron de facturas impagadas):
```typescript
import { sendWeeklySummaryEmails } from '../../modules/messaging/domain/weeklyReport.service';

// Lunes a las 9:00 AM
cron.schedule('0 9 * * 1', async () => {
  console.log('[cron] Ejecutando resumen semanal...');
  try {
    await sendWeeklySummaryEmails();
  } catch (err: any) {
    console.error('[cron] Error en sendWeeklySummaryEmails:', err?.message);
  }
});
```

**Commit:** `feat(cron): resumen semanal lunes 9h`

---

### TAREA 7-4 — Endpoint de vista previa del resumen

**Archivo:** `src/modules/metrics/app/routes/metrics.routes.ts`

**Qué añadir** (nuevo endpoint):
```typescript
// GET /admin/metrics/weekly-preview
// Devuelve los datos del resumen de la semana actual (no la pasada)
// para que el usuario pueda ver qué recibirá el lunes
router.get('/weekly-preview', async (req, res) => {
  // Misma lógica que weeklyReport.service pero para semana actual
  // Devolver { collected, quotesSent, quotesAccepted, newCustomers, currency }
});
```

**Commit:** `feat(metrics): endpoint vista previa resumen semanal`

---

### TAREA 7-5 — Restaurar checkbox en Settings con backend real

**Archivo:** `public/dashboard/js/settingsView.js`

Ahora que el backend existe, **volver a añadir** el toggle `notifyWeeklySummary` en el formulario de Settings. Seguir exactamente el mismo patrón que `tNotifyPaid` y `tNotifyAccepted`.

También añadir el botón "Vista previa" que llama a `GET /admin/metrics/weekly-preview` y abre un modal mostrando los datos.

**Archivo:** `src/modules/system/merchantAdmin.ts`

Verificar que `getMerchantProfile` incluye `notifyWeeklySummary` en el `select` y que `updateMerchantProfile` acepta ese campo.

**Archivo:** `src/core/validation/schemas.ts`

Añadir al schema `merchantProfileUpdateSchema`:
```typescript
notifyWeeklySummary: z.boolean().optional(),
```

**Commit:** `feat(settings): resumen semanal con backend + vista previa`

---

## SPRINT 7B — Fotos del trabajo

### TAREA 7B-1 — Configurar Cloudflare R2

**No es código. Pasos:**
1. Ir a https://dash.cloudflare.com → R2 → Create bucket → nombre: `presufacil-photos`
2. Settings del bucket → R2.dev subdomain → activar acceso público
3. Crear API Token con permisos de lectura/escritura en ese bucket
4. Añadir en Railway:
   ```
   STORAGE_BUCKET_URL=https://[account-id].r2.cloudflarestorage.com/presufacil-photos
   STORAGE_ACCESS_KEY=[key-id]
   STORAGE_SECRET_KEY=[secret]
   STORAGE_PUBLIC_URL=https://pub-[hash].r2.dev
   ```

---

### TAREA 7B-2 — Añadir campo photoUrls al schema

**Archivo:** `prisma/schema.prisma`

**En el modelo Quote**, añadir después de `signatureUrl`:
```prisma
photoUrls  String[]  @map("photo_urls")
```

**Ejecutar:**
```bash
npx prisma db push --accept-data-loss
npx prisma generate
```

**Commit:** `db: campo photoUrls en Quote`

---

### TAREA 7B-3 — Servicio de upload a R2

**Archivo nuevo:** `src/core/storage/upload.service.ts`

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config/env';
import crypto from 'crypto';

const s3 = new S3Client({
  region: 'auto',
  endpoint: config.STORAGE_BUCKET_URL,
  credentials: {
    accessKeyId: config.STORAGE_ACCESS_KEY,
    secretAccessKey: config.STORAGE_SECRET_KEY,
  },
});

export async function uploadPhoto(base64Data: string, mimeType: string): Promise<string> {
  const buffer = Buffer.from(base64Data.replace(/^data:.+;base64,/, ''), 'base64');
  const ext = mimeType.split('/')[1] || 'jpg';
  const key = `photos/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: 'presufacil-photos',
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ACL: 'public-read',
  }));

  return `${config.STORAGE_PUBLIC_URL}/${key}`;
}
```

**Instalar dependencia:**
```bash
npm install @aws-sdk/client-s3
```

**Archivo:** `src/core/config/env.ts` — añadir:
```typescript
STORAGE_BUCKET_URL:  process.env.STORAGE_BUCKET_URL  || '',
STORAGE_ACCESS_KEY:  process.env.STORAGE_ACCESS_KEY  || '',
STORAGE_SECRET_KEY:  process.env.STORAGE_SECRET_KEY  || '',
STORAGE_PUBLIC_URL:  process.env.STORAGE_PUBLIC_URL  || '',
```

**Commit:** `feat(storage): servicio upload fotos a Cloudflare R2`

---

### TAREA 7B-4 — Endpoint para subir fotos

**Archivo:** `src/modules/quotes/app/routes/quotes.routes.ts`

**Qué añadir** (nuevo endpoint):
```typescript
// POST /quote/:id/photos
// Body: { photos: [{ data: "base64...", mimeType: "image/jpeg" }] }  (máx 4)
// Sube las fotos a R2 y actualiza quote.photoUrls
```

Verificar multi-tenant: la quote debe pertenecer al merchant de la sesión antes de permitir la subida.

**Commit:** `feat(quotes): endpoint subir fotos del trabajo a R2`

---

### TAREA 7B-5 — UI de subida de fotos en el formulario

**Archivo:** `public/dashboard/js/quotesView.js`

**Dónde:** En el bloque D (acciones), añadir botón "📷 Fotos del trabajo" antes de "Generar presupuesto".

**Flujo:**
1. Click en "📷 Fotos del trabajo" → abre `<input type="file" accept="image/*" multiple>` limitado a 4
2. Al seleccionar, mostrar thumbnails pequeños
3. Al generar el presupuesto, incluir las fotos en el payload y llamar al endpoint de fotos
4. Mostrar indicador de carga mientras sube

**Commit:** `feat(quotesView): subir fotos del trabajo en el formulario`

---

### TAREA 7B-6 — Mostrar fotos en la landing del cliente

**Archivo:** `src/modules/system/app/routes/quoteDecisionLanding.routes.ts`

**En la función `loadQuote`**, añadir `photoUrls` al select.

**En `renderQuoteDetail`**, si `quote.photoUrls` tiene elementos, añadir antes de la tabla de líneas:
```html
<div style="display:flex;gap:8px;overflow-x:auto;margin-bottom:16px">
  [por cada foto: <img src="[url]" style="height:120px;border-radius:8px;object-fit:cover"/>]
</div>
```

**Commit:** `feat(landing): mostrar fotos del trabajo en landing del cliente`

---

## SPRINT 8 — Onboarding que garantiza el "momento WOW"

### TAREA 8-1 — Añadir tipo de oficio al merchant

**Archivo:** `prisma/schema.prisma`

**En el modelo Merchant**, añadir:
```prisma
trade  String?  // electricista | fontanero | reformista | pintor | cerrajero | climatizacion | otro
```

```bash
npx prisma db push --accept-data-loss
npx prisma generate
```

**Commit:** `db: campo trade (oficio) en Merchant`

---

### TAREA 8-2 — Catálogos predefinidos por oficio

**Archivo nuevo:** `src/core/data/tradeCatalogs.ts`

```typescript
export const TRADE_CATALOGS: Record<string, Array<{name: string; price: number; vat: number}>> = {
  electricista_mx: [
    { name: 'Instalación punto de luz', price: 350, vat: 0.16 },
    { name: 'Cambio de interruptor', price: 180, vat: 0.16 },
    { name: 'Instalación enchufe', price: 200, vat: 0.16 },
    { name: 'Revisión tablero eléctrico', price: 450, vat: 0.16 },
    { name: 'Instalación luminaria', price: 280, vat: 0.16 },
    { name: 'Certificado eléctrico', price: 800, vat: 0.16 },
    { name: 'Instalación contacto 220V', price: 380, vat: 0.16 },
    { name: 'Mano de obra por hora', price: 250, vat: 0.16 },
  ],
  fontanero_mx: [
    { name: 'Destape de drenaje', price: 400, vat: 0.16 },
    { name: 'Cambio de llave de paso', price: 320, vat: 0.16 },
    { name: 'Instalación calentador', price: 800, vat: 0.16 },
    { name: 'Reparación fuga de agua', price: 500, vat: 0.16 },
    { name: 'Cambio de inodoro', price: 900, vat: 0.16 },
    { name: 'Instalación regadera', price: 350, vat: 0.16 },
    { name: 'Mano de obra por hora', price: 250, vat: 0.16 },
  ],
  electricista_es: [
    { name: 'Instalación punto de luz', price: 85, vat: 0.21 },
    { name: 'Cambio de interruptor', price: 45, vat: 0.21 },
    { name: 'Instalación enchufe', price: 55, vat: 0.21 },
    { name: 'Revisión cuadro eléctrico', price: 120, vat: 0.21 },
    { name: 'Boletín eléctrico', price: 180, vat: 0.21 },
    { name: 'Mano de obra por hora', price: 45, vat: 0.21 },
  ],
  fontanero_es: [
    { name: 'Desatasco', price: 90, vat: 0.21 },
    { name: 'Cambio grifo monomando', price: 120, vat: 0.21 },
    { name: 'Instalación calentador', price: 350, vat: 0.21 },
    { name: 'Reparación tubería', price: 150, vat: 0.21 },
    { name: 'Cambio inodoro completo', price: 280, vat: 0.21 },
    { name: 'Mano de obra por hora', price: 45, vat: 0.21 },
  ],
  // añadir: reformista_es, pintor_es, electricista_co, fontanero_co, etc.
};

export function getCatalogKey(trade: string, country: string): string {
  return `${trade}_${country.toLowerCase()}`;
}
```

**Commit:** `feat(data): catálogos predefinidos por oficio y país`

---

### TAREA 8-3 — Endpoint para importar catálogo predefinido

**Archivo:** `src/modules/products/app/routes/products.routes.ts`

**Nuevo endpoint:**
```typescript
// POST /admin/products/load-template
// Body: { trade: 'electricista', country: 'MX' }
// Carga el catálogo predefinido para ese oficio/país
// Solo funciona si el merchant no tiene productos aún (evitar duplicados)
```

**Commit:** `feat(products): endpoint para cargar catálogo por oficio`

---

### TAREA 8-4 — Rediseñar el wizard de onboarding

**Archivo:** `public/dashboard/js/onboardingView.js`

**Cambiar los 3 pasos actuales por 5 pasos:**

**Paso 1: "¿A qué te dedicas?"**
- Input: nombre del negocio
- Select: tipo de oficio (Electricista / Fontanero / Reformista / Pintor / Cerrajero / Climatización / Otro)
- Select: país (usando los 6 países de i18n)

**Paso 2: "¿Dónde te avisamos?"**
- Input: número de WhatsApp (igual que antes)

**Paso 3: "Tus servicios (ya los tenemos listos)"**
- Mostrar los primeros 5 servicios del catálogo predefinido para su oficio/país
- Checkbox para seleccionar cuáles quiere cargar (todos por defecto)
- Botón "Cargar servicios seleccionados" → llama al endpoint `POST /admin/products/load-template`
- Si elige "Otro" oficio, mostrar input manual igual que antes

**Paso 4: "Tu primer cliente"**
- Input: nombre del cliente
- Input: teléfono WhatsApp del cliente
- Nota: "Este cliente recibirá tu primera cotización"

**Paso 5: "¡Envía tu primera cotización AHORA!"**
- Input: concepto del servicio (autocomplete del catálogo que acaba de cargar)
- Input: precio
- Botón grande verde: "Enviar cotización por WhatsApp"
- Al pulsar: llama a `POST /quote/create` + `POST /admin/quotes/:id/send-whatsapp`
- Si tiene éxito: confetti animado + mensaje "¡Primera cotización enviada! Tu cliente la acaba de recibir."
- Botón: "Ir al panel"

**En el backend**, al completar el paso 1, guardar `trade` y `country` en el merchant:
```typescript
// En auth.routes.ts o en onboarding.routes.ts
// PUT /admin/onboarding/step1 → guarda name, trade, country
```

**Commit:** `feat(onboarding): wizard 5 pasos con catálogo por oficio y primera cotización guiada`

---

## SPRINT 9 — Sistema de referidos

### TAREA 9-1 — Campo referralCode en Merchant

**Archivo:** `prisma/schema.prisma`

```prisma
referralCode   String?   @unique @map("referral_code")
referredBy     String?   @map("referred_by")   // código del que refirió
freeMonths     Int       @default(0) @map("free_months")  // meses gratis acumulados
```

```bash
npx prisma db push --accept-data-loss
npx prisma generate
```

**Commit:** `db: campos sistema de referidos en Merchant`

---

### TAREA 9-2 — Generar código de referido al registrarse

**Archivo:** `src/modules/auth/domain/auth.service.ts`

**En `registerMerchant`**, después de crear el merchant:
```typescript
const code = name.substring(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '') + Math.floor(1000 + Math.random() * 9000);
await prisma.merchant.update({
  where: { id: newMerchant.id },
  data: { referralCode: code },
});
```

**Leer `ref` del query param** en el endpoint de registro y guardar `referredBy`:
```typescript
// POST /auth/register — body puede incluir: { name, email, country, ref? }
// Si hay ref, guardar en referredBy del nuevo merchant
```

**Commit:** `feat(auth): generar código de referido al registrarse`

---

### TAREA 9-3 — Aplicar mes gratis cuando el referido convierte

**Archivo:** `src/modules/billing/app/routes/stripe.routes.ts`

**En el handler de `checkout.session.completed` con `mode: 'subscription'`:**
```typescript
// Si el merchant tiene referredBy:
//   1. Encontrar el merchant con ese referralCode
//   2. Incrementar su freeMonths += 1
//   3. Si freeMonths >= 1, aplicar un cupón de descuento del 100% para 1 mes en Stripe
//      usando stripe.subscriptions.update con un coupon
```

**Commit:** `feat(billing): mes gratis al referidor cuando su referido convierte`

---

### TAREA 9-4 — Dashboard de referidos en la UI

**Archivo:** `public/dashboard/js/settingsView.js`

**Añadir una sección al final de Configuración: "Invita a otros y gana meses gratis"**

```html
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-top:20px">
  <h3>🎁 Invita y gana</h3>
  <p>Cada profesional que invites y se suscriba, te regalamos 1 mes gratis.</p>
  <div style="display:flex;gap:8px;align-items:center">
    <input readonly value="https://presufacil.mx/registro?ref=[TU_CÓDIGO]" id="ref-link"/>
    <button onclick="copiarEnlace()">Copiar</button>
  </div>
  <p>Has invitado a X personas. Y se han suscrito. Tienes Z meses gratis.</p>
</div>
```

**Endpoint nuevo:** `GET /admin/me/referrals` → devuelve `{ code, referralUrl, totalReferred, paidReferrals, freeMonths }`

**Commit:** `feat(settings): dashboard de referidos`

---

## SPRINT 10 — Emails de lifecycle automatizados

### TAREA 10-1 — Servicio de emails de lifecycle

**Archivo nuevo:** `src/modules/messaging/domain/lifecycle.service.ts`

Implementar la función `sendLifecycleEmails()` que el cron ejecuta diariamente:

```typescript
export async function sendLifecycleEmails(): Promise<void> {
  const now = new Date();

  // Email día 3: sin cotización enviada
  // Buscar merchants con createdAt entre hace 3 y 4 días, sin ningún quote en status != 'draft'
  // Enviar email: "¿Tienes problemas para crear tu primera cotización?"

  // Email día 7: sin cotización enviada
  // Mismo criterio pero 7 días

  // Email día 12: trial expira en 2 días
  // Buscar merchants con planExpiresAt entre mañana y pasado mañana, plan='trial'
  // Enviar email: "Tu prueba expira en 2 días"

  // Email día 15: trial expirado sin suscripción
  // Buscar merchants con planExpiresAt hace 1 día, plan='trial'
  // Enviar email: "Tus datos siguen aquí"

  // Guardar en DB qué emails se han enviado para idempotencia
  // Añadir campo: lifecycleEmailsSent String[] en Merchant
}
```

**Añadir campo al schema:**
```prisma
lifecycleEmailsSent  String[]  @map("lifecycle_emails_sent")
// valores posibles: 'day3', 'day7', 'day12', 'day15_expired', 'first_payment', 'inactive14'
```

**Commit:** `feat(messaging): emails de lifecycle automatizados`

---

### TAREA 10-2 — Registrar el cron de lifecycle

**Archivo:** `src/core/cron/cron.ts`

```typescript
import { sendLifecycleEmails } from '../../modules/messaging/domain/lifecycle.service';

// Cada día a las 10:30 AM
cron.schedule('30 10 * * *', async () => {
  console.log('[cron] Ejecutando lifecycle emails...');
  try {
    await sendLifecycleEmails();
  } catch (err: any) {
    console.error('[cron] Error en sendLifecycleEmails:', err?.message);
  }
});
```

**Commit:** `feat(cron): lifecycle emails diarios 10:30h`

---

## SPRINT 11 — Landing de marketing

### TAREA 11-1 — Página de marketing estática

**Archivo nuevo:** `public/index.html` (o en un dominio separado)

Crear una landing de una sola página con:

1. **Hero section:**
   - Título: "La cotización que el cliente firma por WhatsApp en 30 segundos"
   - Subtítulo: "Para fontaneros, electricistas y reformistas. Sin Excel, sin papel."
   - Botón primario: "Prueba gratis 14 días" → `/register.html`
   - Nota: "Sin tarjeta de crédito"

2. **Demo visual:**
   - GIF o video de 15s mostrando el flujo completo (móvil)
   - Caption: "Del presupuesto al cobro sin salir de WhatsApp"

3. **3 beneficios:**
   - ✅ Cotización profesional en 30 segundos
   - ✅ El cliente firma digitalmente desde su móvil
   - ✅ Cobra antes de empezar el trabajo

4. **Comparativa:**
   - "Antes" (texto en WhatsApp, papel, Excel) vs "Con PresuFácil" (PDF, firma, cobro)

5. **Precios:**
   - Un solo plan, $19/mes (o precio local)
   - Trial 14 días
   - FAQ: "¿Funciona en México?" "¿Necesito instalar algo?" etc.

6. **CTA final:** Otro botón grande de registro

**NO usar frameworks. HTML/CSS/JS vanilla igual que el resto del proyecto.**

**Commit:** `feat(marketing): landing page pública`

---

## CHECKLIST DE PRODUCCIÓN — Antes del primer cliente pagante

Ejecutar en orden. Todos deben ser ✅ antes de cobrar a nadie.

```
[ ] TAREA A-1: Campo teléfono override eliminado del formulario
[ ] TAREA A-2: Checkbox resumen semanal eliminado de Settings (hasta tener backend)
[ ] TAREA A-3: Stripe precios creados y variables en Railway
[ ] TAREA A-4: Webhook Stripe compatible con plan único
[ ] Plantillas WhatsApp aprobadas por Meta (quote_decision_es, payment_request_es, quote_reminder_es)
[ ] Dominio final configurado (presufacil.mx o presufacil.online) apuntando a Railway
[ ] PUBLIC_BASE_URL actualizada con el dominio final en Railway
[ ] EMAIL_FROM actualizado con el dominio final (noreply@presufacil.mx)
[ ] Auto-deploy activo: push a main → Railway despliega automáticamente
[ ] Test end-to-end manual: crear cuenta → onboarding → cotización → WA → firma → factura → cobro
[ ] Stripe webhooks registrados en el dominio final (no en localhost)
[ ] ANTHROPIC_API_KEY presente (para el asistente IA)
[ ] Health check responde 200: GET /health
```

---

*Fin del plan de sprints detallado. Actualizar este bloque al completar cada tarea.*

---

# PARTE I — CONFIGURACIÓN DE PLATAFORMAS EXTERNAS (paso a paso)

> Estas tareas NO son código. Son configuraciones en paneles externos.
> Están ordenadas por dependencia: hay que hacerlas en este orden.
> Tiempo total estimado: 2-3 horas la primera vez.

---

## I-1 — Railway (ya desplegado, verificar configuración)

**URL del panel:** https://railway.app/dashboard

### Variables de entorno — verificar que todas existen

Ir a tu proyecto en Railway → Settings → Variables. Confirmar que están:

```
DATABASE_URL              ✅ (generada automáticamente por Railway Postgres)
PORT                      ✅ (Railway lo inyecta automáticamente)
NODE_ENV                  production
PUBLIC_BASE_URL           https://TU_DOMINIO_FINAL  ← actualizar cuando tengas dominio
SESSION_SECRET            una cadena aleatoria larga (mínimo 64 caracteres)
RESEND_API_KEY            re_xxxxxxxxxxxx
EMAIL_FROM                PresuFácil <noreply@TU_DOMINIO>
STRIPE_SECRET_KEY         sk_live_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET     whsec_xxxxxxxxxxxx  ← se crea en paso I-2
STRIPE_PRICE_ID_PRO       price_xxxxxxxxxxxx  ← se crea en paso I-2
STRIPE_PRICE_ID_PRO_ANNUAL price_xxxxxxxxxxxx ← se crea en paso I-2
WHATSAPP_PHONE_NUMBER_ID  xxxxxxxxxxx  ← se verifica en paso I-4
WHATSAPP_ACCESS_TOKEN     EAAxxxxxxxxxxxx  ← se verifica en paso I-4
WHATSAPP_BUSINESS_ACCOUNT_ID  xxxxxxxxxxx
AUTO_INVOICE_ON_PAID      true
AUTO_EMAIL_INVOICE_ON_PAID true
ANTHROPIC_API_KEY         sk-ant-xxxxxxxxxxxx
```

### Dominio personalizado en Railway

1. Railway → tu proyecto → Settings → Domains → Add Domain
2. Escribe tu dominio (ej. `api.presufacil.mx` o `presufacil.mx`)
3. Railway te da un CNAME → ir a tu registrador de dominio (Namecheap, GoDaddy, etc.)
4. Añadir registro CNAME: `api` → el valor que da Railway
5. Esperar 5-30 minutos. Verificar: `curl https://api.presufacil.mx/health`
6. Actualizar `PUBLIC_BASE_URL` en Railway con el nuevo dominio

---

## I-2 — Stripe (pagos y suscripciones)

**URL del panel:** https://dashboard.stripe.com

### Paso 1: Activar cuenta de Stripe para producción

1. Dashboard → Activate your account (si no está activado)
2. Rellenar datos del negocio: nombre, dirección, tipo de negocio (Software/SaaS)
3. Añadir cuenta bancaria para recibir los cobros
4. Verificar identidad si lo solicita (DNI/pasaporte)
5. **Importante:** cambiar de modo Test a modo Live con el toggle arriba a la izquierda

### Paso 2: Crear el producto y los precios

1. Dashboard → Products → + Add product
2. Nombre: `PresuFácil Pro`
3. Descripción: `Plan todo incluido para profesionales de servicios`
4. En "Pricing", añadir precio recurrente:
   - Precio: `19.00`
   - Moneda: `USD` (o EUR si tu mercado es España)
   - Recurrencia: `Monthly`
   - Copiar el `price_id` generado → guardar en Railway como `STRIPE_PRICE_ID_PRO`
5. Añadir otro precio al mismo producto:
   - Precio: `179.00`
   - Recurrencia: `Yearly`
   - Copiar el `price_id` → guardar en Railway como `STRIPE_PRICE_ID_PRO_ANNUAL`

**Para México (MXN):**
Repetir los pasos anteriores con:
- Precio mensual: `299.00 MXN`
- Precio anual: `2990.00 MXN`

### Paso 3: Configurar el webhook de Stripe

1. Dashboard → Developers → Webhooks → + Add endpoint
2. Endpoint URL: `https://TU_DOMINIO/webhooks/stripe`
3. Seleccionar eventos:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.payment_failed`
4. Click en "Add endpoint"
5. En la pantalla del webhook → "Signing secret" → copiar el valor `whsec_xxx`
6. Guardar en Railway como `STRIPE_WEBHOOK_SECRET`

### Paso 4: Configurar el portal de facturación de Stripe

1. Dashboard → Settings → Billing → Customer portal
2. Activar las opciones:
   - ✅ Allow customers to cancel subscriptions
   - ✅ Allow customers to update subscriptions
   - ✅ Show invoice history
3. Business information: añadir nombre y logo
4. Guardar

### Paso 5: Verificar con modo Test antes de live

1. Cambiar a modo **Test** (toggle arriba a la izquierda)
2. Crear precios de test iguales a los de producción
3. Guardar los `price_id` de test en variables temporales
4. Hacer una suscripción de prueba completa con tarjeta de test `4242 4242 4242 4242`
5. Verificar que `merchant.plan` se actualiza en la DB
6. Una vez verificado, volver a modo Live y usar los price_id de producción

---

## I-3 — Resend (emails transaccionales)

**URL del panel:** https://resend.com/dashboard

### Paso 1: Verificar el dominio de envío

1. Resend → Domains → Add Domain
2. Escribe tu dominio (ej. `presufacil.mx`)
3. Resend te da varios registros DNS (TXT, MX o CNAME)
4. Ir a tu registrador de dominio y añadir esos registros
5. Volver a Resend → clicar "Verify" → esperar a que aparezca ✅ Verified
6. Sin este paso, los emails llegarán a spam o serán rechazados

### Paso 2: Obtener la API Key

1. Resend → API Keys → + Create API Key
2. Nombre: `presufacil-production`
3. Permisos: `Full access`
4. Copiar la key (empieza por `re_`)
5. Guardar en Railway como `RESEND_API_KEY`

### Paso 3: Actualizar EMAIL_FROM

En Railway, actualizar:
```
EMAIL_FROM=PresuFácil <noreply@presufacil.mx>
```
El dominio del FROM debe coincidir con el dominio verificado en Resend.

### Paso 4: Probar enviando un email

Desde el dashboard o llamando al endpoint de magic link con tu propio email.
Verificar que:
- El email llega en menos de 30 segundos
- No va a spam
- El nombre del remitente es "PresuFácil"
- El link de acceso funciona

---

## I-4 — WhatsApp Business (Meta) — Configuración completa

**URL del panel:** https://business.facebook.com → WhatsApp → Getting Started

> Esta es la parte más compleja. Leer todo antes de empezar.

### Paso 1: Verificar que tienes una cuenta de Meta Business

1. Ir a https://business.facebook.com
2. Si no tienes, crear una cuenta de Business Manager con tu email de empresa
3. Verificar la cuenta de negocio (puede pedir documentación)

### Paso 2: Crear o verificar la app de Meta

1. Ir a https://developers.facebook.com → My Apps
2. Si ya tienes la app (la que tiene configurado el `WHATSAPP_PHONE_NUMBER_ID` actual):
   - Verificar que está en modo **Live** (no Development)
   - Si está en Development, ir a App Settings → Basic → cambiar a Live
3. Si necesitas crear una nueva:
   - Create App → Business → Next
   - Nombre: "PresuFácil"
   - Añadir producto: WhatsApp

### Paso 3: Verificar el número de teléfono

1. WhatsApp → Getting Started → Phone Numbers
2. El número debe estar en estado **Connected** (no Pending o Error)
3. Si está en Pending: completar la verificación del número por SMS o llamada
4. Copiar el `Phone Number ID` → guardar en Railway como `WHATSAPP_PHONE_NUMBER_ID`

### Paso 4: Obtener un token de acceso permanente

El token actual puede ser temporal. Para producción necesitas un token que no expire:

1. Meta Business Settings → System Users → + Add
2. Nombre: `presufacil-bot`, Role: `Admin`
3. Genera un token para este System User:
   - Assets → Apps → Añadir tu app → Full Control
   - Generate Token → seleccionar la app → permisos: `whatsapp_business_messaging`, `whatsapp_business_management`
   - Copiar el token → guardar en Railway como `WHATSAPP_ACCESS_TOKEN`

**IMPORTANTE:** Este token no expira (a diferencia del token de usuario personal de 60 días).

### Paso 5: Configurar el webhook de WhatsApp

1. Developers → tu app → WhatsApp → Configuration
2. Webhook URL: `https://TU_DOMINIO/webhooks/whatsapp` (si tienes endpoint de verificación)
   - **Nota:** el backend actual NO tiene un endpoint de webhook de WhatsApp para mensajes entrantes. Solo envía. Si en el futuro quieres recibir respuestas, necesitarás añadirlo.
3. Por ahora, solo verificar que los mensajes SALIENTES funcionan

### Paso 6: Registrar y verificar las plantillas de WhatsApp

Las plantillas permiten enviar mensajes outbound (fuera de la ventana de 24h). Sin plantillas aprobadas, solo puedes enviar si el cliente te escribió primero en las últimas 24h.

**Plantilla 1: `quote_decision_es`**
- Categoría: `UTILITY`
- Idioma: `es` (Español)
- Cuerpo del mensaje:
```
Hola {{1}}, te enviamos la cotización #{{2}} por {{3}} {{4}}.

Puedes revisar el PDF aquí: {{5}}

Por favor, indícanos tu decisión:
```
- Botones: 2 botones de URL:
  - Botón 1: "✅ Aceptar" → URL: `https://TU_DOMINIO/pay/quote/{{1}}/accept`
  - Botón 2: "❌ Rechazar" → URL: `https://TU_DOMINIO/pay/quote/{{1}}/reject`
- Enviar a revisión. Tiempo de aprobación: 24-48h normalmente.

**Plantilla 2: `payment_request_es`**
- Categoría: `UTILITY`
- Idioma: `es`
- Cuerpo:
```
Hola {{1}}, te enviamos la factura {{2}} por importe de {{3}}.

Puedes pagar aquí: {{4}}

Gracias por confiar en nosotros.
```
- Botón URL: "💳 Pagar ahora" → `https://TU_DOMINIO/pay/card/{{1}}`
- Enviar a revisión.

**Plantilla 3: `quote_reminder_es`**
- Categoría: `UTILITY`
- Idioma: `es`
- Cuerpo:
```
Hola {{1}}, te recordamos que tienes pendiente revisar la cotización #{{2}} por {{3}} {{4}}.

Puedes verla aquí: {{5}}
```
- Mismos botones que `quote_decision_es`
- Enviar a revisión.

### Paso 7: Verificar que las plantillas están aprobadas

1. WhatsApp → Message Templates
2. Cada plantilla debe tener estado **Approved** (verde)
3. Si alguna está en **Rejected**: leer el motivo, corregir el contenido y reenviar
4. Causas comunes de rechazo: contenido promocional en plantillas Utility, variables mal formateadas, URLs no válidas

### Paso 8: Probar el envío de WhatsApp

Desde el panel de Railway, buscar los logs del servidor. Crear una cotización de prueba y pulsar "Enviar por WhatsApp". Verificar en los logs:
```
[WhatsApp] → { ok: true, data: { messages: [{ id: "wamid.xxx" }] } }
```
Si aparece `{ ok: false, error: ... }`, leer el error en el log para diagnosticar.

---

## I-5 — Anthropic (asistente IA)

**URL del panel:** https://console.anthropic.com

### Obtener API Key

1. Console → API Keys → Create Key
2. Nombre: `presufacil-production`
3. Copiar la key (empieza por `sk-ant-`)
4. Guardar en Railway como `ANTHROPIC_API_KEY`

### Verificar que funciona

En el dashboard de PresuFácil, ir a "Crear presupuesto" → "✨ Sugerir con IA" → escribir una descripción de trabajo → verificar que devuelve líneas.

Si aparece el error `ai_not_configured`: la variable no está en Railway o el servidor no se ha reiniciado.

---

## I-6 — Cloudflare R2 (fotos del trabajo — Sprint 7B)

**URL del panel:** https://dash.cloudflare.com

> Solo necesario cuando implementes TAREA 7B-1 y siguientes.

### Crear el bucket

1. Dash Cloudflare → R2 Object Storage → Create bucket
2. Nombre: `presufacil-photos`
3. Region: Automatic
4. Create bucket

### Activar acceso público

1. Bucket `presufacil-photos` → Settings → Public Access
2. Enable R2.dev subdomain → Allow
3. Copiar la URL pública (ej. `https://pub-abc123.r2.dev`)
4. Guardar en Railway como `STORAGE_PUBLIC_URL`

### Crear API Token

1. Profile (arriba derecha) → API Tokens → Create Token
2. Template: "R2 Token" o personalizado con:
   - Permisos: Object Read & Write
   - Bucket: `presufacil-photos` (específico, no todos)
3. Crear → copiar `Access Key ID` y `Secret Access Key`
4. Guardar en Railway:
   ```
   STORAGE_BUCKET_URL=https://[account-id].r2.cloudflarestorage.com/presufacil-photos
   STORAGE_ACCESS_KEY=[Access Key ID]
   STORAGE_SECRET_KEY=[Secret Access Key]
   STORAGE_PUBLIC_URL=https://pub-[hash].r2.dev
   ```

El `account-id` lo encuentras en el panel de R2 → Overview → Account ID.

---

## I-7 — Mercado Pago (Sprint 8 — LATAM)

**URL del panel:** https://www.mercadopago.com.mx/developers/

> Solo necesario cuando implementes TAREA 8-1.

### Crear cuenta de Mercado Pago Business

1. Registrar cuenta en Mercado Pago con los datos del negocio
2. Completar verificación KYC (datos personales, documentación)
3. Añadir cuenta bancaria CLABE (México) o CBU (Argentina) para recibir cobros

### Obtener credenciales de producción

1. Panel de desarrolladores → Mis credenciales → Credenciales de producción
2. Copiar `Access Token` (empieza por `APP_USR-`)
3. Guardar en Railway como `MP_ACCESS_TOKEN`

### Configurar webhook de Mercado Pago

1. Panel → Notificaciones → Webhooks
2. URL: `https://TU_DOMINIO/webhooks/mp`
3. Eventos: `payment`
4. Guardar
5. Copiar el "Secret" del webhook → guardar en Railway como `MP_WEBHOOK_SECRET`

### Probar con cuenta sandbox

Antes de ir a producción, usar el entorno sandbox de MP:
1. Crear cuentas de prueba: Panel → Cuentas de prueba → Crear
2. Usar las credenciales de sandbox (no las de producción)
3. Hacer un pago de prueba completo
4. Verificar en logs del servidor que el webhook llega y procesa correctamente

---

## I-8 — Dominio (registro y configuración DNS)

### Opción recomendada: Namecheap o Cloudflare Registrar

**Para México:** registrar `presufacil.mx` (~$15 USD/año en NIC.mx o Namecheap)
**Alternativa global:** `presufacil.app` o `presufacil.online` (más barato, ~$3-5 USD/año)

### Configuración DNS necesaria

Una vez tengas el dominio, añadir estos registros en el panel DNS:

```
Tipo    Nombre    Valor                           TTL
CNAME   @         [valor CNAME de Railway]         300
CNAME   www       [valor CNAME de Railway]         300
TXT     @         [registro de verificación Resend] 300
TXT     resend._domainkey  [DKIM de Resend]        300
MX      @         [registros MX de Resend]         300
```

Los valores exactos los da Railway (para el CNAME) y Resend (para los TXT/MX).

### Verificar que todo funciona

```bash
# El backend responde
curl https://presufacil.mx/health

# El dashboard carga
# Abrir en el navegador: https://presufacil.mx/dashboard/

# El login funciona
# Ir a https://presufacil.mx/login.html y pedir un magic link
```

---

## ORDEN RECOMENDADO DE CONFIGURACIÓN

Para arrancar desde cero, hacer en este orden:

```
Día 1 (2-3h):
  [x] I-1: Verificar Railway, añadir variables base
  [x] I-3: Verificar dominio de envío en Resend y actualizar EMAIL_FROM
  [x] I-8: Registrar dominio y configurar DNS

Día 2 (2-3h):
  [x] I-2: Crear precios en Stripe y configurar webhook
  [x] I-1: Actualizar PUBLIC_BASE_URL con el dominio final

Día 3 (2-3h):
  [x] I-4: Verificar/actualizar token permanente de WhatsApp
  [x] I-4: Registrar y enviar a revisión las 3 plantillas de WhatsApp

Día 4-5 (esperar aprobación de Meta):
  [x] I-4: Confirmar que las 3 plantillas están en estado "Approved"
  [x] Test end-to-end completo del flujo

Cuando esté todo:
  [x] I-5: Configurar Anthropic API Key
  [x] Test del asistente IA

Cuando implementes las fotos (Sprint 7B):
  [x] I-6: Cloudflare R2

Cuando implementes LATAM (Sprint 8):
  [x] I-7: Mercado Pago
```

---

*Fin de la configuración de plataformas externas.*
