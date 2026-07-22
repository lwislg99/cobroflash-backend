# YAQU — Backlog de bugs y mejoras
**Generado tras la prueba E2E del 8 jun 2026.** Orden de prioridad: P0 (bloquea cobrar) → P4 (no tocar aún).

## Reglas de trabajo (Claude Code, leer antes de empezar)
- Arregla de **uno en uno**. Commit + push entre cada item.
- Verifica cada arreglo en **yaqu.app** (no en localhost).
- No empieces P1 hasta cerrar los dos P0.
- No toques la sección **"NO TOCAR AÚN"**.
- Marca cada item con `[x]` cuando esté hecho y verificado, y deja una línea de "causa raíz / qué se cambió".

---

## P0 — CRÍTICO: bloquea cobrar y entregar factura

> **🔒 Auditoría de seguridad (7-jul-2026, Claude).** Tres routers legacy `srcNew/` estaban
> montados en el BLOQUE PÚBLICO de `app.ts` (antes de `requireAuth`) y se saltaban el modelo
> multi-tenant + de integridad de pagos.
>
> **✅ ARREGLADO 7-jul (OK del fundador).** Nuevo guard `requireInternalSecret`
> (`core/http/internalAuth.ts`, secreto aleatorio por-proceso; override `INTERNAL_API_SECRET`
> si hay >1 réplica) en `/webhooks/psp` y `/charges` → el exterior recibe 404; `/dev` solo se
> monta si `NODE_ENV!=='production'`. Los 6 llamadores internos (webhooks Stripe/MP/Connect,
> confirm-bizum, receipt, dev) añaden `internalHeaders()`. **Re-auditado en runtime:** externo
> → 404 en los 3; con secreto → el pago real sigue atravesando (charge_not_found). Build + 84
> tests verdes.

### [x] P0-SEC-1 · `/webhooks/psp` marca cualquier cobro como PAGADO sin firma ni auth
- **Exploit:** `POST https://yaqu.app/webhooks/psp` con `{"event":"payment.confirmed","charge_id":N}`
  marca el cobro N como **pagado** (emite factura/justificante, notifica al pro "te ha pagado",
  email al cliente) SIN pago real y SIN autenticación. Los `charge_id` son enteros secuenciales
  → enumerables. Atajo aún más fácil: `POST /dev/sim/pay/:id` (también público).
- **Causa raíz:** `psp.routes.ts` (`POST /`) NO valida firma (solo Stripe/Stripe-Connect/WhatsApp
  la validan) y `app.ts:128` lo monta público. Es el MISMO handler del pago real (el webhook de
  Stripe le reenvía por HTTP internamente — ver P0-3).
- **Arreglo:** que `/webhooks/psp` no sea alcanzable desde fuera. Correcto: extraer "confirmar
  pago" a un servicio de dominio y llamarlo DIRECTO desde los webhooks Stripe/MP (sin self-HTTP),
  y quitar el mount público. Mitigación rápida: exigir un secreto compartido que solo conozcan
  los llamadores internos.
- **Done cuando:** un `POST /webhooks/psp` externo sin secreto → 401/404; el pago real (Stripe/MP)
  sigue marcando pagado en yaqu.app.

### [x] P0-SEC-2 · `/dev/*` público en producción (simular pagos, emitir/emailar facturas)
- **Exploit:** `dev.routes.ts` montado público (`app.ts:145`): `POST /dev/sim/pay|fail|expire/:id`
  (fuerza estados de pago), `POST /dev/issue-invoice/:chargeId` (emite factura de cualquier cobro),
  `POST /dev/email-invoice/:chargeId` (emite + EMAILEA la factura al cliente de cualquier cobro).
  Todo sin auth.
- **Causa raíz:** router de simulación `srcNew/` en el bloque público, sin gate de entorno.
- **Arreglo:** quitar `/dev` en producción (gate `NODE_ENV!=='production'` o flag
  `DEV_ROUTES_ENABLED` default OFF). No tiene uso legítimo en prod.
- **Done cuando:** `/dev/*` → 404 en yaqu.app.

### [x] P0-SEC-3 · `/charges` público → fuga cross-tenant + creación/envío de cobros
- **Exploit:** `charges.routes.ts` público (`app.ts:129`): `GET /charges` (últimos 20 cobros de
  TODOS los merchants: importe, referencia, moneda, fecha), `GET /charges/:id` (cualquier cobro:
  importe, merchant_id, customer_id, referencias bancarias de reconciliations), `POST /charges`
  (crear cobro para cualquier merchant_id + crear cliente), `POST /charges/:id/send` (disparar
  envío con teléfono destino a elección). Sin auth ni filtro por merchant.
- **Causa raíz:** router legacy `srcNew/` (usa n8n, prohibido por regla 1) en el bloque público.
  La funcionalidad real multi-tenant vive en `/admin/charges` (chargesAdmin, con `requireAuth`).
- **Arreglo:** refactorizar el ÚNICO llamador legítimo (`invoiceWhatsApp.service.ts:50` hace
  `POST /charges` por HTTP) para crear el cobro con una función de dominio directa, y quitar el
  mount público de `/charges`.
- **Done cuando:** `/charges*` → 404 público; el envío de factura por WhatsApp sigue creando el cobro.

### [x] P0-SEC-4 · `/invoice/:id/paid-webhook` marca cualquier factura como PAGADA sin auth (auditoría 2ª pasada, 7-jul)
- **Exploit:** `POST https://yaqu.app/invoice/<id>/paid-webhook` marca la factura `<id>` como
  **pagada** (`status:'paid'`, `paidAt`) SIN pago real, firma ni auth; devuelve además datos del
  merchant/cliente (nombre, taxId, dirección, teléfono, email) → fuga cross-tenant. Hermano:
  `POST /invoice/issue` emite factura de cualquier `charge_id`. Ids enteros secuenciales → enumerables.
- **Causa raíz:** `invoice.routes.ts` (router legacy de la época **n8n**, comentario "pensada para
  n8n / WhatsApp") montado público en `app.ts` (`/invoice`) fuera de `/admin`, sin ningún guard.
  Se me pasó al cerrar P0-SEC-1/2/3. NINGÚN llamador interno (grep: solo la definición y el mount;
  los `/pay/invoice/` son otro router).
- **Arreglo:** `app.use('/invoice', requireInternalSecret, invoiceRouter)` — mismo candado que
  `/charges` y `/webhooks/psp` (externo sin secreto → 404), sin romper nada (no hay llamadas internas).
- **Done cuando:** `POST /invoice/*` externo → 404 en yaqu.app. ✅ (build limpio; sin regresiones en tests).

### [x] P1-SEC-5 · `/quote/create` sin login + confía en el `merchant_id` del body → creación cross-tenant (auditoría 2ª pasada, 7-jul)
- **Exploit:** `POST /quote/create` estaba montado SOLO con `requireActivePlan`, que **no autentica**
  (sin cookie `pf_session` hace `next()`). El handler tomaba `merchant_id`/`customer_id` del **body**
  sin atarlos a la sesión → cualquiera podía crear presupuestos **sin login** y en la cuenta de **otro
  merchant** (dispara aviso WhatsApp al pro, genera PDF e **incrementa la numeración** del merchant víctima).
- **Causa raíz:** `authMiddleware.ts` `requireActivePlan` solo mira el vencimiento del plan; no fija
  `req.merchantId`. El endpoint (usado por el BO: `homeView.js`/`quotesView.js`, que ya mandan su
  propio `merchant_id`) nunca comprobó pertenencia.
- **Arreglo:** `app.post('/quote/create', requireAuth, requireActivePlan)` + en el handler
  `if (req.merchantId == null || merchant_id !== req.merchantId) → 403` y el cliente se busca
  `findFirst({ id, merchantId: req.merchantId })`. Transparente para el BO (va autenticado).
- **Done cuando:** `POST /quote/create` sin sesión → 401; con sesión y `merchant_id` ajeno → 403;
  el BO sigue creando presupuestos igual. ✅ (build limpio; tests sin regresiones).

### [~] P1-SEC-6 · `/quote/:id/accept` y `/reject` — IDOR: aceptar/rechazar presupuestos ajenos por id (auditoría 3ª pasada, 7-jul)
- **Exploit:** las decisiones públicas del cliente (`POST /quote/<id>/accept` y `/reject`) usan
  SOLO el `id` (autoincrement **global** de toda la plataforma, el de `/pay/quote/:id`) — sin token,
  firma ni auth. Enumerable → un atacante puede `reject` en masa TODOS los presupuestos de todos los
  merchants (sabotaje: ventas perdidas) o `accept` presupuestos ajenos (incluso en `draft` sin enviar
  → dispara creación de Trabajo + email al pro). No había rate limit en estos endpoints.
- **Causa raíz:** el modelo `Quote` no tiene token/slug no adivinable; el enlace es el id secuencial.
  El `rateLimit` existía pero solo en login/registro/verify/IA, no en las decisiones del cliente.
- **Arreglo (2 capas):**
  - **(a) Mitigación DESPLEGADA:** `rateLimit` por IP (20/min) en `/:id/accept` y `/:id/reject`
    (defensa en profundidad contra abuso masivo desde una fuente). Build limpio.
  - **(b) Fix COMPLETO — PENDIENTE de decisión del fundador (STOP):** añadir un token no adivinable
    por presupuesto y exigirlo en accept/reject. Toca la **estructura del enlace embebida en las
    plantillas de Meta aprobadas** (`quote_decision_es` → botón `/pay/quote/{{id}}`) → re-aprobar
    plantillas = STOP condition. Requiere: columna `Quote.accessToken`, generarlo, y cambiar los
    enlaces (plantillas + landing + bot). Alternativa sin token: exigir estado `sent` para decidir
    (reduce, no cierra) — pero eso toca la máquina de estados L (también cerrada).
- **Done cuando:** decisión del fundador sobre la capa (b). La mitigación (a) ya limita el abuso.

### [x] P0-1 · Pago con tarjeta devuelve 401 Unauthorized
- **Síntoma:** al pulsar "Pagar con tarjeta" en `/pay/invoice/:id` navega a `/pay/card/:id` y devuelve 401 (body "Unauthorized"). El cliente no puede pagar.
- **Causa probable:** la ruta `/pay/card/:id` tiene middleware de autenticación (la usa el cliente NO logueado), o `STRIPE_SECRET_KEY` mal configurada / falla la creación de la Checkout Session.
- **Arreglo:** `/pay/card/:id` debe ser **pública** igual que `/pay/invoice/:id` y `/pay/quote/:id`. Si el 401 viene de Stripe, verificar keys de test y la creación de sesión.
- **Done cuando:** un cliente sin sesión llega a Stripe Checkout y paga en modo test sin 401.
- **CAUSA RAÍZ (9 jun):** la ruta YA era pública (verificado en yaqu.app: `/pay/card/abc`→400, `/pay/card/999999999`→404). El 401 nacía en **Stripe al crear la Checkout Session** (clave rechazada) y se filtraba crudo porque el handler no tenía try/catch. Commit `110913b`: try/catch que **loguea el motivo real de Stripe** (visible en Railway) y muestra una página 503 clara en vez de "Unauthorized". **PENDIENTE para cerrar:** poner una `STRIPE_SECRET_KEY` de test VÁLIDA (`sk_test_…`) en Railway y verificar el pago real. No marcado `[x]` hasta verificarlo end-to-end.

### [x] P0-2 · "Abrir PDF" devuelve not_found
- **Síntoma:** en el detalle de factura, "Abrir PDF" va a `/dashboard/PENDING_PDF` y devuelve `{"error":"not_found"}`.
- **Causa:** el campo del PDF de la factura vale literalmente `PENDING_PDF` — el PDF nunca se generó.
- **Arreglo:** investigar por qué la generación se queda en `PENDING_PDF` (¿storage/credenciales? ¿job async que no corre? ¿síncrono que falla?). Que el PDF se genere de verdad. Mientras esté pendiente, el botón debe mostrar "Generando…" o disparar la generación, **nunca** enlazar a un estado.
- **Done cuando:** "Abrir PDF" abre un PDF real de la factura.
- **CAUSA RAÍZ (9 jun):** `generateInvoicePdf` **funciona** (probado en local: PDF válido de 5 KB; el código no está roto). El problema: la factura nace con `pdfUrl='PENDING_PDF'` al aceptar y el PDF solo se generaba en el pago (`ensureInvoiceForCharge`), y el front enlazaba a ese `pdfUrl` crudo. Además el fs de Railway es **efímero** (se pierde al redeploy). Commit `04f4886`: nueva ruta `GET /admin/invoices/:id/pdf` que **genera bajo demanda** si está PENDING o el fichero no existe, y lo sirve; el botón "Abrir PDF" apunta ahí (nunca al `pdfUrl` crudo). Ruta verificada montada+protegida en prod (401 sin sesión). **PENDIENTE:** abrir "Abrir PDF" en una factura real (sesión admin) y comprobar que sale el PDF.

### [x] P0-3 · La factura no se marca como PAGADA tras el pago
- **Síntoma:** el pago con tarjeta se confirma (página "Pago confirmado" + WhatsApp de confirmación enviado), pero la factura CF000007 sigue en PENDIENTE en el dashboard.
- **Pista clave:** el WhatsApp de confirmación SÍ se envía → el handler de "pago confirmado" se ejecuta, pero no actualiza el estado. Buscar ahí.
- **Arreglo:** en el flujo de pago confirmado (Stripe webhook `checkout.session.completed` / `payment_intent.succeeded`, o el handler que dispara la confirmación), marcar la **factura como PAGADA** y el **cobro como pagado**. Verificar que `STRIPE_WEBHOOK_SECRET` está configurado y que el evento se procesa.
- **Done cuando:** tras pagar, la factura pasa a PAGADA automáticamente.
- **CAUSA RAÍZ (9 jun):** el handler de pago confirmado (`POST /webhooks/psp` `payment.confirmed`, al que reenvía el webhook de Stripe) solo marcaba la factura pagada si `ensureInvoiceForCharge()` devolvía `invoiceId`, y esa función **genera el PDF**; al fallar el PDF (P0-2) lanzaba → `invoiceId` null → factura PENDIENTE pese al cobro pagado (y el confirm caía al fallback `#cobro` → P1-6). Commit `c7c3298`: tras confirmar el cobro se localiza la factura ligada (por `invoice.chargeId` o vía `Quote.chargeId`→`invoice.quoteId`) y se marca `paid`+`paidAt` **independiente del PDF**. **PENDIENTE:** verificar con un pago de tarjeta nuevo (depende de la clave Stripe de P0-1). La CF000007 ya pagada no se auto-corrige (su evento ya pasó); marcarla a mano o re-test.

### [x] P0-4 · La factura no llega al cliente (ni WhatsApp ni email)  — email ✅ (WhatsApp link → P3-4)
- **Síntoma:** dice "la factura se enviará por WhatsApp y email automáticamente", pero no llega por ningún canal. El cliente paga y no recibe su factura.
- **Depende de:** P0-2 (primero el PDF tiene que generarse de verdad).
- **Arreglo:** email → enviar la factura en PDF adjunto usando el mailer existente. WhatsApp → opción MVP recomendada: que el mensaje de confirmación de pago lleve un botón/enlace "Ver factura" que abra el PDF/página de la factura (mismo patrón que "Ver presupuesto"/"Pagar ahora"). Opción completa (más adelante): plantilla con cabecera de documento para adjuntar el PDF en el chat.
- **Done cuando:** tras pagar, el cliente recibe la factura por email (si tiene) y por WhatsApp (enlace o PDF).
- **CAUSA RAÍZ (9 jun):** el email no llegaba porque `sendInvoiceEmail` usaba nodemailer/SMTP; sin `SMTP_URL` (prod usa Resend) caía a `streamTransport` → solo escribía un `.eml` a disco, **no enviaba**. Commit `0bf44f7`: ahora envía por **Resend** con el PDF en base64 adjunto; helper `ensureInvoicePdf` genera el PDF si falta; el email post-pago se intenta SIEMPRE (psp/mp). **WhatsApp PENDIENTE:** entregar la factura por WhatsApp necesita un botón "Ver factura" (URL dinámica) en una plantilla de confirmación → **alta/re-aprobación en Meta** (no se puede añadir botón a una plantilla aprobada sin re-aprobarla). El código del builder se añadirá cuando exista la plantilla. **VERIFICAR:** tras un pago, que llegue el email con PDF (requiere `RESEND_API_KEY` ok + cliente con email).

---

## P1 — Bugs visibles al cliente / datos incorrectos

### [x] P1-1 · Botón "Firmar y aceptar presupuesto" sale en ROJO
- **CAUSA RAÍZ (9 jun):** `brandOverrideCss` repintaba `.btn-accept`/`.btn-tier` con el `brandColor` del merchant. Commit `110c73f`: el color de marca va solo en acentos (avatar, bordes, badges, enlaces); el CTA aceptar/firmar es SIEMPRE verde. Verificado en prod: `/pay/quote/24` ya no lleva override en el botón.
- **Síntoma:** en la landing del presupuesto #24 el botón de aceptar y el avatar salen rojos; en #23 era verde. Mismo merchant.
- **Causa probable:** el CTA primario hereda el color de acento del negocio (que puede salir rojo) en vez del verde fijo de marca.
- **Arreglo:** el botón primario (aceptar/firmar) **siempre verde de marca**. El rojo solo para rechazar. El avatar puede tener color propio; el CTA no.
- **Done cuando:** el botón de aceptar es verde en cualquier presupuesto.

### [x] P1-2 · Texto duplicado en la pantalla de pago
- **Síntoma:** `/pay/invoice` muestra "Factura CF000006 · Factura CF000006" (dos veces).
- **Arreglo:** mostrar el nº de factura una sola vez.
- **CAUSA RAÍZ (9 jun):** el `charge.concept` ya era "Factura CFxxxx" y la página añadía otra vez la referencia. Commit `9ef6671`: si el concepto ya incluye el nº de factura, se muestra una sola vez.

### [x] P1-3 · No se guarda el motivo de rechazo real del cliente
- **Síntoma:** el detalle del presupuesto rechazado muestra "Motivo de rechazo: Rechazado desde enlace WhatsApp" (texto genérico hardcodeado), no el motivo (dropdown) ni el comentario que eligió el cliente en el formulario.
- **Arreglo:** persistir el **motivo y el comentario reales** del formulario de rechazo y mostrarlos en el detalle. Si vienen vacíos, dejar vacío, no un texto fijo.
- **Done cuando:** al rechazar eligiendo motivo + comentario, el detalle muestra exactamente eso.
- **CAUSA RAÍZ (9 jun):** (1) el router `/pay` se monta antes del `express.urlencoded` global → el POST del form de rechazo llegaba con `req.body` vacío; ahora la ruta parsea su propio body. (2) la landing reenviaba un comentario combinado con fallback genérico; ahora mapea el código del dropdown a su etiqueta y reenvía `reason`+`comment` por separado, sin texto fijo. Commit `9c28055`.

### [x] P1-4 · Gramática en la confirmación de aceptación
- **Síntoma:** "¡Presupuesto **aceptada y firmada**!" (femenino).
- **Arreglo:** "¡Presupuesto **aceptado y firmado**!".
- **CAUSA RAÍZ (9 jun):** adjetivos hardcodeados en femenino. Commit `d13313a`: concordancia de género según el sustantivo del locale (presupuesto=masc, cotización=fem).

### [x] P1-5 · Terminología "cotización" en el demo de España
- **Síntoma:** la confirmación de rechazo dice "rechazo de la **cotización** #24"; el resto del demo (España) usa "presupuesto".
- **Arreglo:** en el demo ES usar "presupuesto" en todos los textos del cliente. (No tocar i18n LATAM aún — solo unificar el demo ES.)
- **CAUSA RAÍZ (9 jun):** "de la cotización" hardcodeado. Commit `d13313a`: usa el término del locale del merchant (`presupuesto` en ES) con su artículo (del/de la); también el reset del botón de aceptar. No se tocó i18n LATAM.

### [x] P1-6 · WhatsApp de confirmación: "factura ##4" (doble # y nº incorrecto)
- **Síntoma:** dice "tu pago de 109.00 EUR de la factura ##4". Doble "#" y usa el **id del cobro** (4) en vez del **nº de factura** (CF000007).
- **Arreglo:** mostrar el nº de factura real ("CF000007") sin doble #.
- **CAUSA RAÍZ (9 jun):** se pasaba `#${chargeId}` (la plantilla ya antepone "#"). Commit `3d64887`: usa el nº de factura real sin "#" (de la factura emitida o de la ligada al cobro, P0-3). Aplicado en psp y mpWebhook.

### [x] P1-7 · WhatsApp de confirmación usa el nombre de cuenta, no el del negocio
- **Síntoma:** dice "Gracias por confiar en Electricista prueba", pero el resto de mensajes al cliente usan "Demo ES S.L.".
- **Arreglo:** usar el nombre del negocio (el que aparece en presupuesto/factura/landing) de forma consistente en todos los mensajes al cliente.
- **CAUSA RAÍZ (9 jun):** usaba `merchant.name` (nombre de cuenta). Commit `3d64887`: usa `legalName||name`, como presupuesto/factura/landing. Aplicado en psp y mpWebhook.

---

## P2 — Mejoras de producto / UX

### [x] P2-1 · Acciones sobre presupuestos rechazados
- **Mejora:** mostrar el motivo del cliente (depende de P1-3) y hacer visible **"Duplicar"** (o "Duplicar y editar") para revisar y reenviar. NO construir versionado/reapertura todavía — Duplicar es suficiente para el MVP.
- **CERRADO (9 jun):** ya implementado — el detalle muestra "Motivo de rechazo" + "Comentario" (correctos desde P1-3) y el botón "⎘ Duplicar" está siempre visible en la cabecera (carga las líneas/tiers en un presupuesto nuevo, `duplicateQuote`). Sin código nuevo; lo desbloqueaba P1-3.

### [x] P2-2 · Feedback al enviar presupuesto
- **Mejora:** el aviso "Presupuesto enviado por WhatsApp" es muy discreto. Tras enviar, redirigir al detalle del presupuesto (muestra SENT + timeline) o mostrar un toast claro con enlace "Ver presupuesto".
- **CERRADO (9 jun):** commit `11ebdc6` — tras enviar desde la quick-quote, navega al **detalle** del presupuesto (estado SENT + timeline) con toast acorde al locale.

### [x] P1-8 · Facturas desde aceptación pública nacían SIN líneas (sin desglose IVA, cuota VeriFactu 0,00)
- **Síntoma (E2E V0-1, 11 jun):** el PDF de la factura 2026-CF-001 salía sin tabla de líneas ni desglose de IVA (solo el total), y la huella VeriFactu se calculaba con cuota 0,00.
- **Causa raíz:** el `tx.invoice.create` del flujo público (`quotes.routes.ts /:id/decision`) no copiaba `lines` (el flujo admin sí); además usaba `quote.total` pre-actualización (con tiers habría facturado el total antiguo).
- **CERRADO (11 jun):** commit `59ce535` — copia `updatedQuote.lines` escaladas al % facturado y usa `updatedQuote.total`. Verificado con segunda factura E2E.

### [x] P1-9 · Presupuesto inexistente mostraba el formulario de firma VACÍO; 404 de cobro/recibo en texto plano
- **Síntoma (E2E V0-1):** `/pay/quote/999999` → 200 con canvas de firma y botón "Firmar y aceptar" sin negocio/líneas/total; `/pay/invoice/999999` → "Cobro no encontrado" en texto crudo. Viola N3 (diseño digno SIEMPRE).
- **CERRADO (11 jun):** commit `0408155` — `src/core/http/publicNotFound.ts` (página digna con el copy oficial N3) usada por la landing de decisión (aceptar y rechazar) y los 5 routes de cobro/recibo.
- **PENDIENTE relacionado — CERRADO (13 jun, `e57eed4`):** quote en estado `rejected` ya muestra página digna (copy oficial N3 decidido por el fundador: "Rechazaste este presupuesto el [fecha]. ¿Has cambiado de opinión? Pídele uno nuevo a [Negocio] 👇" + botón WhatsApp), nunca el formulario de firma.

### [x] P2-4 · Microcopy fuera de N5: "Acepto sin dibujar firma"
- **CERRADO (11 jun):** commit `e80a825` — alineado al oficial N5/regla 30: "Acepto sin firmar" (checkbox y mensaje de error).

### [x] P2-5 · Landing /pay/quote a 390px: columna Total recortada
- **Síntoma (E2E V0-1, captura `docs/evidencias/v01-pay-quote-28-movil.png`):** en viewport 390px los importes de la tabla de líneas quedan cortados ("250…", "90.00 E…").
- **CERRADO (13 jun, `e57eed4`):** `lines-table` con `table-layout:fixed` + anchos fijos para Cant. (44px) y Total (100px / 92px <420px), `white-space:nowrap` y tabular-nums en el importe, `overflow-wrap:break-word` en concepto. El total ya no se recorta. (Pendiente la verificación en dispositivos reales de V0-5.)

### [x] P2-3 · Iconos PWA rotos: los .png eran SVG renombrados (A2HS no instalable)
- **Síntoma:** `public/icons/icon-192.png` e `icon-512.png` contenían texto SVG con extensión .png (523 bytes); el manifest declara `image/png` → Chrome no cumple criterios de instalación y el icono A2HS sale roto. Detectado en el check Y1 de DOCS-F1.
- **Causa raíz (11 jun):** los .png se crearon copiando los .svg con otra extensión. Además `icon-512.svg` tenía viewBox de 512 pero el dibujo a coordenadas de 192 (icono en la esquina superior izquierda).
- **CERRADO (11 jun):** corregido `icon-512.svg` (dibujo a escala 512) y generados PNG reales (10 KB / 51 KB) renderizando los SVG con Edge headless a tamaño exacto. Verificado visualmente ambos.

---

## P-PERCEPCIÓN — Code-review V0-5 de la landing (15-jun, contra Parte N)
> Hallazgos de la revisión de código de `/pay/quote` y `/pay/invoice` ANTES del bug-bash en
> dispositivos reales (V0-5). Regla 1: bug visible en la landing = P0 de percepción.

### [x] PC-B · `/pay/quote`: IVA incoherente entre líneas y Total
- **Síntoma:** las líneas normales mostraban el importe SIN IVA (`qty*price`) mientras las
  líneas de tier lo mostraban CON IVA (`qty*price*(1+tax)`), y el "Total" (`quote.total`, con
  IVA) no llevaba desglose ni etiqueta. El cliente que suma las líneas no llega al Total.
- **CAUSA RAÍZ (16-jun):** dos fórmulas distintas para el importe de línea (net en la tabla,
  bruto en los tiers) y un Total bruto sin desglose. Arreglado: ambas tablas muestran el
  importe NET (`qty*price`, columna "Importe"); bajo las líneas, desglose Base imponible + IVA
  por tipo vía `calcVatBreakdown` (helper canónico, mismo que factura/VeriFactu); Total con
  etiqueta "Total · IVA incluido". Sin cuota (LATAM/exento) → Total plano. Tiers: línea NET +
  nota "IVA incluido". 76 tests verdes.

### [x] PC-A · `/pay/quote`: falta el botón "💬 Tengo una duda"
- **Síntoma:** N1 exige un botón al WhatsApp del PRO (`wa.me/<tel>?text=…sobre el presupuesto #N…`)
  en la pantalla de aceptar (draft/sent). Solo existía en el estado `rejected`.
- **CAUSA RAÍZ (16-jun):** añadido en draft/sent reusando el patrón del estado rejected:
  `wa.me/<whatsappPhone>?text=Hola, tengo una duda sobre el {presupuesto} #N`. Botón secundario
  `.btn-duda` (no verde, respeta la Regla de Una Sola Voz). Sin whatsappPhone → no se muestra
  (degradación digna). `whatsappPhone` ya venía en `loadQuote`.

### [x] PC-C · `/pay/quote` estado `accepted`: sin fecha ni siguiente paso (N3)
- **Síntoma:** N3 pide "Ya aceptaste este presupuesto el [fecha] + siguiente paso"; mostraba
  solo "ya fue aceptado" (el estado `rejected` sí lleva fecha → inconsistente). Pulido.
- **CAUSA RAÍZ (16-jun):** copy alineado a N3 con `quote.acceptedAt` formateado (es-ES):
  "Ya aceptaste este {presupuesto} el [fecha]. El profesional te informará de los siguientes pasos."

### [x] PC-E · `/pay/quote`: animaciones sin `prefers-reduced-motion` + faltaba anillo de foco (AB6)
- **Síntoma:** la celebración (confeti + pop del check + transición del CTA) se disparaba siempre,
  ignorando `prefers-reduced-motion` (lo exige la skill yaqu-premium-ui / checklist AB6), y los
  elementos enfocados por teclado no mostraban el anillo de Foco de DESIGN.md.
- **CAUSA RAÍZ (16-jun):** añadido `@media (prefers-reduced-motion: reduce)` (sin confeti/pop/
  transición) + guard en `fireConfetti()` (`matchMedia`), y regla `:focus-visible` con el anillo
  Foco (`0 0 0 3px rgba(34,197,94,.30)`) para todo elemento enfocado por teclado.

### [x] PC-F · `/pay/bank`: microcopy de copia fuera de N5
- **Síntoma:** los botones decían "Copiar" genérico; N5 oficial: "Copiar IBAN" / "Copiar referencia".
- **CAUSA RAÍZ (16-jun):** etiquetas alineadas a N5 ("Copiar IBAN" / "Copiar CLABE" en MX /
  "Copiar referencia"); `copyText()` ahora restaura el texto de cada botón vía `data-label`
  tras el "¡Copiado!" (antes reseteaba todos a "Copiar").

### [x] PC-G · `/pay/quote`: faltaba la política de señal (V8/N1)
- **Síntoma:** N1 pide la política de señal junto a las condiciones de pago; no se mostraba.
- **CAUSA RAÍZ (16-jun):** cuando el presupuesto es a señal (`FIFTY_FIFTY`), se muestra el texto
  por defecto "🔒 La señal no es reembolsable." bajo el badge de condiciones. El texto
  configurable por merchant queda para CONNECT-1 (V8).

### [x] PC-H · `/recibo`: el recibo pagado no mostraba fecha ni método (N3)
- **Síntoma:** N3 pide "Pagado → recibo verde, cifra grande, Descargar factura, **fecha/método**".
  El recibo mostraba héroe + importe + descarga, pero NO la fecha del pago ni el método al cliente.
- **CAUSA RAÍZ (16-jun):** añadida línea `.status-meta` en el héroe ("Pagado el [fecha] · [método]")
  cuando `status==='paid'`: fecha del evento `paid` (es-ES) + método legible (Tarjeta/Bizum/
  Mercado Pago/Transferencia) desde `charge.method`.

### [x] PC-I · 400 "ID inválido" en texto plano + código muerto (N3)
- **Síntoma:** `/recibo/abc`, `/pay/invoice/abc` y `/pay/bank/abc` respondían `"ID inválido"`
  en texto crudo (viola N3: diseño digno SIEMPRE; el 404 ya usaba `documentNotFoundHtml`).
  Además `/recibo` calculaba un `statusBadge` que no se renderizaba nunca (código muerto).
- **CAUSA RAÍZ (16-jun):** el 400 (id no numérico) ahora devuelve `documentNotFoundHtml()` en
  las tres rutas; eliminado el `statusBadge` muerto en `receipt.routes.ts`.

### [x] PC-J · Barrido de Foco AB6 en el resto de pantallas del cliente
- **Síntoma:** PC-E añadió el anillo de Foco solo a `/pay/quote`; `/recibo`, `/pay/invoice` y
  `/pay/bank` no mostraban anillo de Foco accesible al navegar por teclado (checklist AB6).
- **CAUSA RAÍZ (16-jun):** regla `:focus-visible` con el anillo Foco de DESIGN.md
  (`0 0 0 3px rgba(34,197,94,.30)`) añadida a las tres pantallas.

### [x] PC-K · `/recibo`: estilos inline con hex sueltos → clases/tokens (skill AB)
- **Síntoma:** los banners de estado, el banner de email y el botón de email usaban `style="…"`
  inline con hex sueltos (#fef9c3, #dcfce7, #fee2e2, #e5e7eb, #e0f2fe…), contra la regla de la
  skill yaqu-premium-ui ("cero estilos inline aleatorios; clases/tokens compartidos").
- **CAUSA RAÍZ (16-jun):** banners movidos a clases semánticas `.note` + `.note-ok/-warn/
  -danger/-muted/-info` (tokens DESIGN.md, alineadas con los patrones de la landing de
  presupuesto) y el botón de email a `.btn-email`. Los bloques **dev-only** (simulación,
  "Ver JSON") se dejan como están (gated `NODE_ENV`, no los ve el cliente). 76 tests verdes.

### [x] PC-D · `/pay/quote` confirmación de aceptación fuera de N5
- **Síntoma:** N5 oficial: "¡Presupuesto aceptado y firmado! [Negocio] ya tiene tu confirmación."
  El subtexto decía "El profesional te informará de los siguientes pasos." (regla 30). Pulido.
- **CAUSA RAÍZ (16-jun):** subtexto de la pantalla de éxito alineado al oficial N5:
  "{Negocio} ya tiene tu confirmación." (nombre escapado, JS-safe).

---

## P3 — Técnico / raíz (registrar, abordar después de P1)

### [ ] P3-9 · `tests/tenancy-permisos.test.mjs` roto en staging desde SCRUM-42 (22-jul, hallazgo en SCRUM-73, NO causado por SCRUM-73)
- **Síntoma:** el test gateado `A12.1+A12.4: tenancy (B vs datos de A)...` falla en staging con
  `AssertionError: faltan datos seed del demo` (línea 59, `assert.ok(quoteA && invoiceA &&
  customerA)`). Espera que el merchant `id=1` tenga quotes/invoices/customers reales ("demo").
- **Causa raíz:** SCRUM-42 (12-jul-2026) cambió la semántica de `id=1` en staging — ahora es un
  placeholder INERTE `demo-reserved@staging.yaqu`, `status:'suspended'`, **0 filas** en
  quotes/invoices/customers (verificado en staging: `acela.proxy.rlwy.net`, 22-jul). Este test es
  ANTERIOR a ese cambio y nunca se actualizó a la nueva semántica de `id=1`.
- **Confirmado NO relacionado con SCRUM-73:** verificado por separado, sin tocar nada de mi PR —
  el fallo es 100% del estado de staging + código de este test, independiente del gate de
  `verifactu.xml`. El resto de `ADMIN_ONLY_ROUTES` (incluida la ruta nueva de SCRUM-73) se
  recorre en la MISMA función tras esa aserción — el `assert.ok` de la línea 59 aborta el test
  ANTES de llegar a esa parte, así que esa cobertura genérica queda sin ejecutar en staging hoy
  (el test específico `scrum73-verifactu-gate.test.mjs`, con su propio merchant efímero, SÍ pasa).
- **Alcance:** NO corregido en este PR (fuera del gate de `verifactu.xml`). Arreglo candidato:
  actualizar el test para usar un merchant efímero propio (patrón ya usado por
  `scrum23`/`scrum73`) en vez de depender del `id=1` compartido, o re-sembrar un merchant "demo
  con datos" en otro id fijo si se necesita mantener ese caso de prueba.

### [ ] P3-8 · 4 archivos de test gateados NO corren en `npm test` (22-jul, hallazgo en SCRUM-73)
- **Síntoma:** mismo patrón que P3-7 (lista explícita de archivos en `package.json`): existen
  `tests/scrum47-enviar-albaran-wa.test.mjs`, `tests/scrum49-firma-remota.test.mjs`,
  `tests/scrum50-bot-albaranes.test.mjs` y `tests/scrum57-operario-propagacion.test.mjs` en el
  repo (con tests reales, gateados `QA_DB_TEST=1`) pero NINGUNO está en la lista del script
  `test` → `npm test` los omite en silencio. Solo `tests/scrum52-operario.test.mjs` (entre esa
  tanda) sí quedó registrado.
- **Alcance:** NO corregido en este PR (SCRUM-73 es solo el gate de `verifactu.xml` — regla de
  "una tarea, un cambio"; tocar 4 archivos ajenos aquí sería arreglo de paso sin revisar cada
  uno). Se registra para una tarea propia (candidata a resolver también la deuda de fondo que
  ya apuntaba P3-7: pasar de lista explícita a `node --test tests/*.test.mjs` con un glob que
  no pueda volver a omitir un archivo nuevo).

### [x] P3-7 · `tests/albaran.test.mjs` (SCRUM-14) no corre en `npm test` (13-jul, hallazgo en rebase de SCRUM-43/44)
- **Síntoma:** el script `test` de `package.json` lista los archivos de test EXPLÍCITAMENTE y el
  PR #8 (SCRUM-14) creó `tests/albaran.test.mjs` (10 tests: numeración ALB-, congelado, tenancy)
  sin añadirlo a la lista → `npm test` daba verde sin ejecutarlos (103 tests antes y después del
  merge de albaranes).
- **Causa raíz / qué se cambió:** lista explícita de archivos en vez de glob (deuda: valorar
  `node --test tests/` en una tarea propia). Fix de una línea: añadido `tests/albaran.test.mjs`
  al script `test` — registrado aquí y aplicado en la rama `scrum-43-ui-numeracion-confirmacion`
  (regla 6: nada de arreglos de paso sin registrar). Con él, `npm test` = 113 tests.

### [ ] P3-6 · wa.me sin prefijo de país en la landing de decisión (hallazgo A14.3, 6-jul)
- **Síntoma:** "💬 Tengo una duda" y el botón de rejected construyen `wa.me/${whatsappPhone}` con el
  dato crudo del merchant. Si el pro guardó su móvil ES sin `34` (p. ej. `629965893`), el enlace no
  resuelve al chat correcto (wa.me exige internacional). El demo lo tenía así; su DATO ya está
  corregido a `34629965893`, así que en demo funciona — pero cualquier merchant nuevo puede repetirlo.
- **Arreglo propuesto:** misma defensa que el perfil público A14.3 (9 dígitos que empiezan por 6/7 +
  country ES → anteponer `34`), idealmente como helper compartido `waMeDigits(phone, country)` en
  core/utils usado por decisionLanding + customerPortal + perfil. Alternativa de raíz: normalizar al
  GUARDAR whatsappPhone en Configuración/onboarding.
- **Done cuando:** un merchant ES con móvil de 9 dígitos genera enlaces wa.me válidos en todas las
  superficies públicas.

### [ ] P3-1 · Plantilla Meta `quote_decision_es`: `{{1}}` sin sustituir  🔒 ACCIÓN EN META (usuario) — código ya robusto
- **Síntoma:** el botón genera `/pay/quote/{{1}}23` (el `{{1}}` no se sustituye). Ya hay un workaround en el backend que hace funcionar el flujo.
- **Arreglo de raíz:** en WhatsApp Manager, el botón de URL debe ser **"Tipo de URL: Dinámico"**, base `https://yaqu.app/pay/quote/{{1}}`, muestra `https://yaqu.app/pay/quote/abc123`. Revisar también `payment_request_es` por el mismo problema. (Requiere re-aprobación de Meta.)
- **Done cuando:** la URL del botón llega limpia (`/pay/quote/23`) sin depender del workaround.
- **Estado (10 jun):** lado código YA resuelto (workaround robusto `parseNumericId`, commit `a25a1ce`). **Lo único pendiente es la acción en Meta** (tipo de URL dinámica) + re-aprobación — no se puede hacer desde el código. Una vez hecho, opcionalmente quitar el workaround.

### [x] P3-2 · Manejo de error en el envío de WhatsApp
- **Mejora:** que `/admin/quotes/:id/send-whatsapp` devuelva un mensaje claro cuando Meta rechaza, nunca un 502. (Verificar si ya está resuelto; el error de Meta ya se loguea.)
- **CERRADO (10 jun):** commit `950d120` — responde 200 `ok:false` con `message` legible (incluye el motivo de Meta), nunca 502; el front (quick-quote y quotesView) lo muestra.

### [ ] P3-4 · Entregar la factura también por WhatsApp (botón "Ver factura")  🔒 ACCIÓN EN META (usuario)
- **Contexto:** P0-4 dejó la entrega de factura por **email** (Resend + PDF). Falta el canal WhatsApp.
- **Arreglo:** crear/re-aprobar en Meta una plantilla de confirmación de pago con un **botón URL dinámica** "Ver factura" → `https://yaqu.app/...` (PDF/página de la factura), mismo patrón que "Ver presupuesto"/"Pagar ahora". Luego añadir el builder en `whatsappTemplates.ts` y enviarla en el flujo de pago confirmado. (Requiere alta/re-aprobación en Meta.)
- **Estado (10 jun):** bloqueado en acción de Meta (usuario). El builder + envío se añaden cuando exista la plantilla aprobada.

### [ ] P3-3 · Plantillas en categoría Marketing → Utility  🔒 ACCIÓN EN META (usuario)
- **Mejora:** recrear `quote_decision_es`, `payment_request_es` y `payment_confirmation_es` como **Utility** (no Marketing) antes de escalar — mejor entregabilidad y coste. No urgente.
- **Estado (10 jun):** acción de Meta (usuario), no hay nada que cambiar en el código (los nombres de plantilla no cambian).

### [x] P3-5 · WhatsApp Business en modo restringido: Meta #131030 "Recipient phone number not in allowed list"
- **Síntoma (E2E V0-1, 11 jun):** TODO envío de plantilla a un número fuera de la lista de destinatarios de prueba fallaba con #131030.
- **CERRADO (11 jun, usuario en Meta):** la app de Meta está en modo **PRODUCCIÓN**; los mensajes llegan a números reales y los webhooks funcionan (verificado por el fundador en el E2E móvil de V0-1).
- **Nota:** el manejo de error del código ya era correcto (200 `ok:false` con motivo legible, P3-2 ✅).

### [x] P3-6 · Merchant demo: email en prod era `luislaragranado@gmail.com`, la regla 8 dice `demo@yaqu.app`
- **Síntoma (E2E V0-1):** `merchant.findUnique({ email: 'demo@yaqu.app' })` no encontraba al demo (id=1); su email era el histórico.
- **CERRADO (12 jun):** el fundador decidió alinear con la regla 8 → email del merchant 1 actualizado en prod a `demo@yaqu.app` (script efímero, verificado antes/después; sin conflicto de unicidad).

---

## P-A66 — Hallazgos del barrido visual final A6.6 (5-jul, capturas 390 REALES)

> Contexto: `msedge --headless --screenshot` clampa la ventana a ~500px; el barrido con
> viewport móvil real (`scripts/capture-demo.mjs`) destapó P1 (arreglados en el sprint:
> dinero es-ES `bd5b0a3`, grid blowout `af957e6`/`9019b24`, tablas móvil `483b160`) y estos P2/P3.

### [x] P-A66-1 · /pay/invoice: título y subtítulo del método fluían juntos a 390px
- **Síntoma:** "Pagar con tarjeta Visa · Mastercard · al instante" envolvía a mitad de frase con el chip RECOMENDADO apretando.
- **Causa:** `.method-title`/`.method-sub` eran spans inline (el `margin-top` del sub estaba muerto).
- **CERRADO (5-jul):** display:block en ambos — título en su línea, subtítulo debajo en muted.

### [x] P-A66-2 · /recibo pagado sin PDF aún: mensaje duplicado
- **Síntoma:** el banner verde decía "Estamos generando tu factura; la recibirás…" y justo debajo un <small> repetía "La factura se emitirá y se enviará por WhatsApp y email automáticamente".
- **CERRADO (5-jul):** eliminado el <small> (el banner ya lo dice todo).

### [x] P-A66-3 · Formato de dinero en el BO interno sin unificar
- **Síntoma:** el BO merchant-facing mezclaba "0.00 EUR", "€0.00", "665,50 EUR" y "1.266,87 €".
- **Arreglo:** helper `fmtMoneyEs` global en `api.js` (espejo del servidor) y pasada pantalla a pantalla (Parte AB).
- **CERRADO (5-jul, `43b52c3`→`9c43b51`), 12 pantallas:** creador (totales/línea/hint/picker/preview) · Home (héroe, KPIs, semana, actividad, tops, dropdown QQ) · presupuestos lista+detalle · facturas lista+detalle (incl. doble toque Bizum) · cliente 360 · búsqueda global · gastos · asistente IA · informes (KPIs con símbolo, cuadro IVA, servicios; la tabla P&L queda en números desnudos a propósito) · catálogo · resumen semanal (Configuración) · planes. Sin dinero: proveedores, equipo, plantillas, solicitudes, onboarding. Los inputs numéricos NO se tocaron (siguen siendo números planos).

---

## P4 — Pre-lanzamiento (registrar, NO ahora)
- [ ] Correr `/security-review` antes de exponer a clientes reales (el producto maneja pagos).
- [ ] Autenticación + multi-tenant real (quitar `merchantId=1` hardcodeado).

---

## NO TOCAR AÚN (fuera de alcance este sprint)
- Fotos del trabajo (bloqueado: faltan credenciales Cloudflare R2).
- i18n LATAM completo (cotización, IVA 16%/19%, OXXO/PSE/Mercado Pago, VeriFactu).
- Métodos de pago extra (transferencia, OXXO…): **solo tarjeta está bien para el MVP**.
- Verificación visual del fix de moneda en los tiers (commit `addfb76`).
