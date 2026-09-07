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

### [x] P0-SEC-7 · `/recibo/:chargeId[/pdf]` enumerable → facturas/recibos ajenos sin login (SCRUM-74, 22-jul, nace de SCRUM-72 D5)
- **Exploit:** `GET /recibo/:chargeId/pdf` (y también `GET /recibo/:chargeId` — la página HTML, que
  es el enlace que REALMENTE se manda por WhatsApp — y `POST /recibo/:chargeId/feedback`) eran
  públicas por diseño (el cliente final no tiene login) pero identificadas por `Charge.id`, **entero
  autoincremental**. Cualquiera, sin login, podía recorrer `/recibo/1`, `/recibo/2`… y ver/descargar
  el NIF del emisor, nombre/email/teléfono del cliente final, importes y el QR VeriFactu de OTROS
  merchants. Misma clase de fuga que SCRUM-72 (PDFs enumerables), otra puerta — SCRUM-72 (decisión
  D5) la dejó explícitamente fuera para abrirla aparte.
- **Causa raíz:** `Charge.id` sin ningún secreto/token asociado; el único gate era `status==='paid'`.
- **Arreglo (decisión del fundador — opción 1, clona el patrón de `Albaran.firmaToken` de
  SCRUM-49):** `Charge.receiptToken` (token opaco, `crypto.randomBytes(16).hex`, `@unique`,
  generado perezosamente por `ensureChargeReceiptToken()`). Los 3 endpoints del router
  (`GET /:token`, `GET /:token/pdf`, `POST /:token/feedback`) pasan a `findUnique({ where:
  { receiptToken } })` — el id numérico ya no resuelve NADA. Alcance ampliado a los 3 endpoints
  (no solo `/pdf` como decía el ticket literal) tras un STOP explícito: la página HTML es el
  enlace real que llega por WhatsApp y necesita conocer el token para enlazar al PDF protegido;
  dejarla en `chargeId` habría dejado la fuga abierta por la puerta principal.
  Generadores de enlace actualizados para usar el token (no el id): `whatsappNotifications.ts`
  (confirmación de pago), Stripe `success_url`/`cancel_url` (`payCard.routes.ts`), redirects
  post-pago (`payInvoice.routes.ts`, `payBizum.routes.ts`), rutas `/dev/*` (no-producción) y el
  `receipt_url` legacy de `charges.routes.ts` (router n8n-era, ya gateado por
  `requireInternalSecret`/P0-SEC-1). El botón dinámico de la plantilla Meta
  `payment_confirmation_invoice_es` **NO requirió re-aprobación**: la URL BASE aprobada
  (`https://yaqu.app/recibo/{{1}}`) no cambia, solo el valor que sustituye `{{1}}` en runtime
  (mismo mecanismo ya probado por el token de `albaran_para_firmar_es`, SCRUM-49) —
  ver `docs/WHATSAPP_TEMPLATES.md` §4.
- **Schema:** `db execute` (no `db push`, falso positivo del `@unique` sobre columna nueva) aplicado
  a STAGING con host-check + GO del fundador — ver `docs/MIGRATIONS_PENDING.md`. PROD pendiente
  del merge.
- **Compatibilidad:** los enlaces `/recibo/:chargeId` ya enviados dejan de funcionar (asumido —
  no hay clientes reales todavía, igual que SCRUM-72).
- **Done cuando:** `GET/POST /recibo/<id numérico>` → 404 sin fuga de datos en el body (probado);
  `/recibo/:token` (los 3 endpoints) sirve solo el cobro dueño de ESE token. Test:
  `tests/scrum74-recibo-token.test.mjs` (gateado).

### [x] P1-SEC-8 · `/pay/card/:id`, `/pay/bizum/:chargeId`, `/pay/invoice/:chargeId` — MISMO patrón enumerable (hallazgo en SCRUM-74, 22-jul; corregido en SCRUM-85)
- **Síntoma:** al arreglar `/recibo/:chargeId` (P0-SEC-7) se confirmó que el selector de pago
  (`payInvoice.routes.ts`, `GET /pay/invoice/:chargeId`) y los métodos concretos
  (`payCard.routes.ts` `GET /pay/card/:id`, `payBizum.routes.ts` `GET /pay/bizum/:chargeId` y
  `POST /pay/bizum/:chargeId/claimed`) seguían usando el `Charge.id` autoincremental como
  identificador de RUTA (no solo como destino de redirect, que ya se había corregido en SCRUM-74).
  Exponían importe, concepto, nombre/logo del merchant y (en Bizum) su móvil — menos sensible que
  NIF/email del cliente (P0-SEC-7) pero mismo patrón IDOR de fondo. Era la TERCERA puerta de la
  misma fuga (SCRUM-72 → SCRUM-74 → esta).
- **Corregido en SCRUM-85:** reutiliza `Charge.receiptToken` (ya existía desde SCRUM-74, SIN
  schema nuevo) en los 3 endpoints. Alcance real MUCHO más amplio que "3 archivos de ruta" — todo
  generador de estos enlaces tuvo que actualizarse para no romper el flujo: `whatsappTemplates.ts`
  (`buildPaymentRequest`), `invoiceWhatsApp.service.ts` (envío inicial), `invoiceReminder.service.ts`
  (recordatorios 7/14d), `botFlow.service.ts` (bot "pagos pendientes"), `invoicesAdmin.routes.ts`
  (resend-whatsapp + send-reminder), `customerPortal.routes.ts` (botón "Pagar ahora" del portal
  `/cliente/:token`), `charges.routes.ts` (legacy n8n, ya gateado), `jobs.routes.ts` (API del
  detalle de Trabajo) — y el **frontend del dashboard** (`invoiceDetailView.js`,
  `jobDetailView.js`): el botón "Enlace de pago" y la barra de fallback de WhatsApp fallido
  construían `/pay/invoice/${chargeId}` client-side; sin arreglarlos habrían quedado rotos
  (404) tras tokenizar la ruta — no una fuga, pero sí una regresión funcional real que se
  detectó y corrigió como parte del mismo cierre. El botón dinámico de `payment_request_es`
  tampoco requirió re-aprobación en Meta (mismo razonamiento que SCRUM-74 §4) —
  `docs/WHATSAPP_TEMPLATES.md` §2 actualizado.
- **NO corregido — ver P1-SEC-9:** `/pay/bank/:id` y `/pay/mp/:id[/result]` comparten el mismo
  patrón y NO se tocaron (fuera del alcance de "card, bizum, invoice" pedido explícitamente).

### [x] P1-SEC-9 · `/pay/bank/:id` y `/pay/mp/:id[/result]` — MISMO patrón enumerable (hallazgo en SCRUM-85, 22-jul; corregido en SCRUM-90)
- **Síntoma:** al cerrar P1-SEC-8 (tokenizar `/pay/card`, `/pay/bizum`, `/pay/invoice`) se
  confirmó que `payBank.routes.ts` (`GET /pay/bank/:id`) y `payMp.routes.ts` (`GET /pay/mp/:id`,
  `GET /pay/mp/:id/result`) compartían EXACTAMENTE el mismo patrón: `Charge.id` autoincremental
  sin token en la ruta. `/pay/bank` era potencialmente el MÁS sensible de los cinco: exponía el
  **IBAN o CLABE bancaria del PROFESIONAL** (no solo importe/concepto/logo) además de la
  referencia de pago exacta — enumerable habilitaba recolectar cuentas bancarias de TODOS los
  merchants de la plataforma, riesgo de fraude por suplantación ("cambio de cuenta" en factura
  falsa).
- **Corregido en SCRUM-90 (la QUINTA y última puerta de la familia 72/74/85/87/90):** mismo
  patrón `Charge.receiptToken` (SIN schema nuevo, ya existía desde SCRUM-74) aplicado a las 2
  rutas. Alcance del todo más pequeño que SCRUM-85 (6 archivos, no 16): `payBank.routes.ts`,
  `payMp.routes.ts` (2 endpoints), `mercadopago.ts` (`createMpPreference`: nuevo param
  `payToken` para los `back_urls`, `chargeId` se conserva SOLO para `external_reference`,
  reconciliación interna del webhook de Mercado Pago — no es superficie pública), y los 3
  generadores ya identificados en SCRUM-85 (`payInvoice.routes.ts`'s `transfer.href`,
  `receipt.routes.ts`'s `payBtns`, `charges.routes.ts`'s `paybank_url`/`paymp_url` legacy).
  Sin frontend afectado esta vez (ni `/pay/bank` ni `/pay/mp` se enlazan desde el dashboard).
  Ningún botón de plantilla Meta apunta a estas rutas → sin re-aprobación que verificar.
- **Con esto quedan cerradas las CINCO puertas de la misma fuga** (SCRUM-72 estático público →
  SCRUM-74 `/recibo` → SCRUM-85 `/pay/card`+`/pay/bizum`+`/pay/invoice` → SCRUM-90
  `/pay/bank`+`/pay/mp`).

### [x] P2-SEC-10 · `/pay/card` miraba Stripe ANTES de resolver el token: el 501 tapaba el 404 y enterraba el assert de tenancy de scrum85 (hallazgo en la suite gateada de SCRUM-113, 23-jul; corregido en SCRUM-119)
- **Encuadre:** NO es «el IDOR está abierto» — no hay fuga probada. Es «el aislamiento NO estaba VERIFICADO»: una comprobación que no se ejercía y otras dos que ni corrían.
- **Raíz (en el HANDLER, no en el test):** `payCard.routes.ts` hacía `if (!stripe) return 501` ANTES del `findUnique` del token. Sin `STRIPE_SECRET_KEY`, un token válido y un id numérico recibían la MISMA respuesta (501) → ningún assert podía distinguir _IDOR cerrado_ de _Stripe ausente_. Era la única de las 4 rutas de pago que miraba su integración antes de resolver el recurso (`/pay/mp`, `/pay/bank`, `/pay/bizum` resuelven primero → su 404 sigue siendo informativo aunque falte la integración). Evidencia directa: el numérico devolvía **501, no 404**.
- **Impacto colateral (peor que el síntoma):** `node:test` aborta el bloque en el primer assert que falla. El de `/pay/card` numérico (`scrum85:71`, `501 !== 404`) tumbaba TODO lo de debajo: `/pay/card` por token, `/pay/bizum`, y **el cruce A/B de tenancy (líneas 90-95)** — el assert de aislamiento entre inquilinos del fichero. Una ruta caída se llevaba por delante la comprobación de fuga.
- **Fix (raíz, no parche):** SCRUM-119 mueve `if (!stripe)` DEBAJO del `findUnique`+404+redirect. Un identificador inexistente da 404 (recurso) esté Stripe configurado o no; el 501 (estado del servidor) deja de adelantarse. Alinea `/pay/card` con sus tres hermanas y el bloque deja de abortar → bizum y el cruce A/B vuelven a ejecutarse. **Bonus correcto:** un cobro ya PAGADO sin Stripe ahora redirige a `/recibo` en vez de 501.
- **Honestidad (criterio SCRUM-121):** el lado del token ya aceptaba `[303, 501]`; se añade un `t.diagnostic` EN VOZ ALTA cuando es 501 — sin `STRIPE_SECRET_KEY` el redirect real a Stripe Checkout NO se ejerce; el cierre del IDOR SÍ (numérico 404 ≠ token 501, testigo de «mecanismo vivo»). Ni verde fingido ni skip mudo.
- **Verificado** en el entorno donde se reprodujo (staging sin Stripe): `scrum85` pasa ENTERO (antes abortaba en :71), el diagnóstico se oye y el cruce A/B corre. `npm test` 242 · 209 pass · 0 fail. Sin schema.
- **Lo que NO tocó:** `/pay/bank` y `/pay/mp` (scrum90, verde, ya con guarda de presencia) y `/recibo` (scrum74, aserciones de contenido) — la falsa garantía vivía en el ORDEN del handler de card, no en la estructura del test copiada.

### [x] P2-SEC-11 · `/pay/card` caía a la cuenta de PLATAFORMA para un merchant real sin Connect (hallazgo en el recon SCRUM-124 → r23; guard en SCRUM-130, 24-jul)
- **Encuadre:** prohibición sin mecanismo. La regla 23 dice «PSP = cuenta conectada del merchant o NADA» y C1-2 la especifica («tarjeta deshabilitada para reales salvo demo»), pero el backend NO lo verificaba: sin Connect, `payCard.routes.ts` creaba la Checkout Session en la cuenta de PLATAFORMA para CUALQUIER merchant. Solo lo tapaba el selector de la UI (no ofrece tarjeta sin Connect) — justo el «seguro por disciplina» que el recon SCRUM-124 vino a cazar.
- **Por qué importa:** dinero de clientes finales en la cuenta Stripe equivocada (la de plataforma) es un problema REGULATORIO (regla 23: el merchant es merchant-of-record), no una fuga de datos.
- **Guard (SCRUM-130):** función PURA `cardChargeDecision({useConnect, isDemo})` → `connect` (Connect activo) · `demo_platform` (sin Connect pero es el demo, regla 18) · `refuse` (real sin Connect → **409**, NO cae a plataforma). Va DEBAJO del `if (!stripe) 501` a propósito → solo muerde donde hay Stripe (producción); staging y scrum85 no cambian de comportamiento hoy. Test PURO propio (`scrum130-card-charge-connect`, `npm test` normal, patrón `demoSendBlocked`); `scrum85` actualizado (el token de su fixture —merchant real sin Connect— ahora acepta `[303,501,409]`, sigue probando el IDOR). Sin schema.
- **INERTE en producción HOY:** ningún merchant real tiene Stripe LIVE todavía (**SCRUM-41 abierta**), así que el camino de plataforma no se ejerce con dinero real. Es defensa PREVENTIVA: el día que se active Stripe, este guard es lo que impide que el **primer** cobro con tarjeta de un merchant sin Connect caiga en la cuenta de plataforma. Del tipo de protección que se agradece tarde.

### [x] P2-N8N-1 · `POST /charges/:id/send` tenía n8n VIVO (viola la regla nº1) + falso éxito — retirado + guard estructural (SCRUM-129, 24-jul)
- **Hallazgo (otra sesión, lineage del recon SCRUM-124):** `charges.routes.ts` tenía `POST /:id/send` con `axios.post` a la URL de webhook de n8n — n8n VIVO en una ruta de COBROS, violando la regla nº1 (WhatsApp = Meta Cloud API DIRECTA, jamás n8n/WATI/Zoko).
- **Y con FALSO ÉXITO:** `if (url) { axios.post... }` — sin la URL configurada (lo esperable, n8n está prohibido) se saltaba el envío pero IGUAL creaba el `Event type:'sent'` y respondía `{ok:true, status:'sent'}`. Mentía sobre un envío que nunca salió. Y esquivaba TODOS los guards de `whatsapp.ts` (topes J6, opt-out J3, dry-run, registro WA-0b) — la misma clase de riesgo que r28.
- **Verificado SIN callers** (grep del repo entero: dashboard, tests, scripts, docs) → el fix es RETIRAR, no migrar. Código muerto que viola la regla 1 y miente no se mantiene.
- **Alcance real (más que el endpoint):** todo el n8n del repo era muerto — `src/integrations/n8n.ts` (`emitToN8n`, nunca llamado) + las 5 env vars de n8n en `env.ts`. Se retiró TODO (endpoint + módulo + env vars); sin ello el guard no podría quedar limpio (o falla, o allowlistea justo lo que vigila).
- **Guard estructural (`tests/scrum129-n8n-guard.test.mjs`, `npm test` normal):** ningún fichero de código del repo declara el prefijo de env var de n8n. Calca el guard de r28 (SCRUM-124): walk de TODO el repo, self-exclusión por ruta (SCRUM-125), sin allowlist (nada legítimo lo usa). Vigila el MECANISMO (la config que enchufa n8n), no la palabra "n8n" en prosa histórica.
- **Nota meta:** el guard de r28 cazó a mi guard de n8n en el primer intento (mi comentario mencionaba el host de Meta como analogía) — la trampa de auto-referencia de SCRUM-125, ahora CRUZADA entre dos guards. Reescrito sin el literal. Sin schema.
### [x] P2-TPL-1 · Seleccionar una plantilla abría OTRA (off-by-one) + una huérfana pre-rellenaba un presupuesto nuevo (SCRUM-134, 24-jul)
- **Síntoma (Javier):** al pulsar «Usar» en una plantilla, el editor abría el borrador pendiente u OTRA plantilla, nunca la seleccionada.
- **Causa RAÍZ — orden invertido en el escritor** (`templatesView.js`): hacía `renderAppView('quotes-new')` y DESPUÉS `sessionStorage.setItem('pf_load_template', …)`. El lector corre SÍNCRONO dentro de esa navegación (`renderQuotesView` NO es async → `loadInitialData()` llega al `getItem` sin ningún `await` por delante), así que leía SIEMPRE el valor de la vez anterior. Off-by-one puro.
- **Control natural que lo probó sin ejecutar:** hay DOS escritores de la misma clave — «Duplicar» (`quotesDetailView.js`) hace `setItem` → navegar (correcto, nunca se reportó roto) y «Usar plantilla» lo hacía al revés. Mismo lector, resultados opuestos: el lector estaba bien, el bug era el ORDEN del escritor.
- **Segundo bug (destapado en el recon, sobrevive al swap):** el valor escrito no se consumía en ese ciclo y solo hay un `removeItem` (en la lectura) → la plantilla quedaba HUÉRFANA en `sessionStorage` y el siguiente **«+ Nuevo presupuesto» normal** aparecía con líneas que nadie pidió, suprimiendo además la restauración del borrador. Líneas = dinero.
- **Fix:** (1) SWAP del orden en `templatesView.js` (queda simétrico con «Duplicar»); (2) sello de frescura `_ts` en ambos escritores + el lector acepta SOLO plantillas selladas y recientes (<15 s) — una clave sin sello o vieja se descarta, lo que además neutraliza las huérfanas que ya viven en la sesión de quien usó el build roto; (3) `templatePending` pasa a ser `true` solo si de verdad se cargaron líneas (antes lo era aunque la plantilla viniera vacía, suprimiendo el borrador para nada).
- **Colateral (precedencia de estado, mismo diagnóstico):** en `loadDraft` el IVA por defecto se restauraba DESPUÉS de crear las líneas, así que las líneas sin IVA propio heredaban el defecto anterior. Ahora `vatDefault` se restaura ANTES del `forEach`.
- **Verificado EN VIVO contra staging** (mismo script, mismas fixtures, solo cambian los 3 JS): antes → paso1 vacío, paso2 mostraba A, paso3 mostraba B huérfana; después → paso1 A, paso2 B, paso3 vacío. Fixtures efímeras `QA-134-*` creadas y borradas (2/2).
- **NO tocado — es SCRUM-132:** el IVA de las líneas de plantilla. Verificado que `addLine` lee `initial.vat` y que al guardar plantilla se escribe `tax: vatPerc/100` → **doble desajuste de clave (`tax` vs `vat`) y de unidad (0,21 vs 21)**: hoy AMBOS caminos de carga descartan el IVA de la plantilla y aplican el defecto. Por eso `tax: (l.tax || 0)` (`:2009`) es código muerto y pasarlo «crudo» no arreglaría nada. Sin schema.

### [x] P0-AUTH-1 · Un operario no puede volver a entrar: `/auth/login` solo buscaba en `Merchant` (hallazgo 22-jul; corregido en SCRUM-92)
- **Síntoma:** `requestMagicLink` (`auth.service.ts`) resolvía la cuenta con
  `prisma.merchant.findUnique({ where: { email } })` y salía por un `return` silencioso si no
  encontraba nada — un Operario es un `TeamMember`, no un `Merchant`, así que nunca se creaba
  token ni se enviaba email. `POST /auth/login` respondía igual el 200 genérico ("recibirás el
  enlace en breve") mintiendo: no había nada que esperar.
- **Alcance:** afectaba a TODOS los operarios a partir del **segundo** acceso. El primer acceso
  funciona (va por `inviteTeamMember`, otro camino) — el fallo aparece al volver: cerrar sesión,
  cambiar de móvil, que caduque la cookie. Sin arreglo, el único camino era que el Admin
  reenviara la invitación desde Configuración → Equipo, y nadie sabía que hacía falta.
  Bloqueaba el plan Equipo (su valor depende de que el operario pueda volver a entrar solo).
- **Corregido en SCRUM-92:** `requestMagicLink` ahora también busca en `TeamMember` si no
  encuentra `Merchant`, y emite el mismo `AuthSession {merchantId, teamMemberId,
  type:'magic_link'}` que ya crea `inviteTeamMember` — `verifyMagicLink`/`getSession`/
  `authMiddleware.ts` quedan **intactos** (ningún archivo de auth aparte de `auth.service.ts`
  se tocó), así que el rol/tenancy de la sesión resultante no es lógica nueva. Verificado
  end-to-end en el test gateado: token real → `GET /auth/verify` real → cookie real →
  `getSession` con `merchantId`/`teamMemberId`/`role` correctos → **403 real** en una ruta
  admin-only con esa sesión (el operario NO puede colarse como admin por este camino nuevo).
  `suspended` recibe el mismo trato que "no existe" (sin token, sin email, pero SÍ logueado en
  servidor); `invited` se deja pasar a propósito (se activa al canjear el link, igual que
  aceptar la invitación — comportamiento ya existente de `verifyMagicLink`, sin cambios). La
  respuesta 200 genérica de `/auth/login` no cambia (regla anti-enumeración intacta).
- **Decisiones de las preguntas abiertas del ticket, resueltas contra el schema real:**
  multi-merchant es estructuralmente imposible (`TeamMember.email` es `@unique` GLOBAL);
  colisión Merchant/TeamMember con el mismo email es posible pero rara (gana el Merchant, se
  comprueba primero); rate-limit (`loginLimiter`) ya cubre la rama nueva sin cambios (envuelve
  toda la ruta `/auth/login`, antes de llamar a `requestMagicLink`).
- **Hallazgo colateral — CORREGIDO en SCRUM-94 (23-jul-2026):** `registerMerchant` (`/auth/register`)
  solo comprobaba `Merchant.email`, nunca `TeamMember.email` — un operario podía "registrarse" con su
  propio email y crear un Merchant nuevo bajo el mismo email (la misma colisión, pero auto-inducida),
  perdiendo su acceso como operario. Fix (opción 1): si el email es un `TeamMember` no suspendido y no
  es Merchant → **409 `email_belongs_to_team`** con mensaje claro pero genérico (sin revelar la
  empresa), sin crear merchant fantasma. Ver la entrada de SCRUM-94 en `YAQU_MASTER.md`.

### [x] P1-ROL-1 · `PATCH /admin/jobs/:id` no gatea por rol: un OPERARIO puede alterar el tratamiento FISCAL (hallazgo SCRUM-89, 24-jul; resuelto en SCRUM-120, 23-jul)
- **Síntoma:** `router.patch('/:id')` en `jobs.routes.ts` NO lleva `requireRole('admin')`. Un Técnico (operario) puede enviar `{ tipoOperacion }` y cambiar la bandera que decide CÓMO SE FACTURA el Trabajo (`OPERACIONES_SUELTAS` = recapitulativa mensual · `TRABAJO_UNICO` = factura al concluir). Un operario cambiándola por error altera el tratamiento fiscal (mes natural de la recapitulativa, SCRUM-17).
- **Descubierto:** durante SCRUM-89 (botones muertos por rol). SCRUM-89 solo cubre el FRONT (deshabilitar los botones de dinero de jobDetailView/jobsView con explicación); este es un gap de BACKEND, fuera de su alcance → de ahí este ticket aparte.
- **No es escalada de privilegios de datos** (el operario solo toca SUS Trabajos, SCRUM-23); es un problema de INTEGRIDAD FISCAL y de coherencia de permisos.
- **Análisis — qué campos del PATCH gatear** (el handler mezcla campos de técnico y de admin, así que un `requireRole` a nivel de RUTA rompería lo legítimo del operario; hace falta gate POR CAMPO en el handler):
  - **Técnico ✅ (trabajo de campo):** `status` (agendar/empezar/terminar — su día a día), `scheduledAt` (agendar), `notes`.
  - **Admin-only ❌ (a gatear):** `tipoOperacion` (bandera FISCAL — el motivo del hallazgo); `assignedUserId` (reasignar el Trabajo a otro operario = supervisión/gestión de equipo, coherente con S1 "equipo = admin").
  - **Decidido (SCRUM-120) → ADMIN:** `status: 'cerrado'` ("Cerrar trabajo") es administrativo, no operativo: es la ÚNICA transición IRREVERSIBLE de la FSM y además MATA la vía de "Cobrar el resto" (cierra el cobro). El operario ya tiene `terminado` (marca que acabó el trabajo de campo); `cerrado` = "este trabajo está liquidado", y esa decisión sobre el dinero del jefe no la toma un operario.
- **Resuelto (SCRUM-120, 23-jul):** gate POR CAMPO en el handler `PATCH /admin/jobs/:id` (no `requireRole` de ruta, que rompería lo legítimo del operario). Si `req.userRole !== 'admin'` y el body trae `tipoOperacion`, `assignedUserId` o `status:'cerrado'` → **403** `{error:'forbidden', required_role:'admin', field}`. **FAIL-CLOSED:** si un campo admin-only viene MEZCLADO con campos legítimos, se rechaza el PATCH ENTERO (nada se aplica) — en zona fiscal no se aplica parcialmente. Front: el selector "Tipo de trabajo · Cambiar" se muestra DESHABILITADO con explicación para el técnico (no dejar botón muerto; misma norma que SCRUM-89 — un gate nuevo que deja UI huérfana se arregla en el MISMO PR). Test gateado propio `tests/scrum120-patch-job-roles.test.mjs` (a nivel de CAMPO; A12.4 es a nivel de ruta): técnico `{tipoOperacion}`/`{assignedUserId}`/`{status:'cerrado'}`/mezcla → 403 y nada aplicado; técnico `{notes}`/`{status:'terminado'}` → 200; admin todo → 200. Sin schema.

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

### [ ] P0-SEC-8 · `/recibo/:token?mail=saved&eml=…` mete un href SIN VALIDAR EL ESQUEMA (SCRUM-807, 7-sep-2026)
- **🔴 MEDIDO, no supuesto.** `receipt.routes.ts:115` pinta `<a href="${esc(emlParam)}">` con `emlParam = req.query.eml` en crudo. `esc()` escapa HTML y hace bien lo suyo; un href no se defiende escapando HTML sino **validando el esquema**, y en `javascript:alert(1)` no hay nada que escapar.
- **Llegan al atributo las SEIS cargas probadas** — `javascript:`, `JaVaScRiPt:` (mayúsculas), `data:text/html,…`, `vbscript:`, con espacio delante y partida por un salto de línea. **CORRIJO MI PROPIA CIFRA:** el primer informe dijo «5 de 6» porque la sexta la mandé mal codificada; con `encodeURIComponent` llega también. Medido las dos veces.
- **Y SE EJECUTA, comprobado en Edge de verdad** (no razonado): con el ancla tal cual se emite —lleva `target="_blank"`— Edge **no** lo ejecutó; **sin** el target y por navegación directa a ese mismo href, **sí**: corrió código en el origen de la aplicación. Otros navegadores NO medidos.
- **Alcance medido:** la página **no tiene CSP** (ni `X-Frame-Options` ni `X-Content-Type-Options`). A favor: la cookie de sesión es `HttpOnly; SameSite=Lax` (+`Secure` en producción), así que no se puede leer desde JS. Hace falta un `receiptToken` válido, o sea que quien **manda** el enlace del recibo controla también la carga.
- **Lo que lo hace evitable del todo:** el ÚNICO productor legítimo de `?mail=saved&eml=` es `dev.routes.ts:99-100`, y `/dev` sólo se monta si `NODE_ENV!=='production'` (`app.ts:354`). En producción **nadie** genera ese banner y la página lo sigue pintando a quien se lo pida. El texto dice «(modo dev)» pero el código no lo comprueba.
- **De regalo, en la misma línea:** es el único `target="_blank"` del fichero **sin** `rel="noopener"` — las otras tres anclas sí lo llevan. Con una URL externa eso da acceso a `window.opener`.
- **NO SE HA ARREGLADO A PROPÓSITO:** el encargo manda parar y avisar antes de construir. Arreglo propuesto y no hecho: **validar el esquema donde se construye el href** (no dentro de `esc()`: darle dos trabajos garantiza que un día haga mal uno de los dos), y/o poner el banner tras el mismo gate de entorno que su único productor.
- **Done cuando:** `?eml=javascript:…` no produce un href con ese esquema, y un `https://` legítimo sigue funcionando. Verificado en yaqu.app.
- **✅ ARREGLADO EN SCRUM-807 (segunda parte), PENDIENTE DE VERIFICAR EN yaqu.app.** Sigue en `[ ]` a propósito: la regla de este fichero exige verificarlo en producción y desde el árbol de trabajo no se puede.
  - **Qué se cambió, tres cosas en la misma línea:** ① el href pasa por `hrefSeguro()` —lista blanca de esquemas, en `core/utils/utils.ts` **al lado de `esc` y no dentro**—; ② el banner queda tras `config.NODE_ENV !== 'production'`, el MISMO gate que su único productor (`/dev`), con lo que el código cumple lo que su rótulo «(modo dev)» ya prometía; ③ `rel="noopener"`, que era el único `target="_blank"` del fichero sin él.
  - **Antes y después, pegados:** llegaban **6 de 6**, ahora llegan **0 de 6** (todas salen `#`), y el `.eml` real del flujo de dev y un `https://` legítimo siguen pasando intactos. Con el gate: en producción simulada el banner NO se pinta; en dev sí.
  - **Guard:** `tests/scrum807-esquemas-del-href.test.mjs` (6 tests). Retirar cualquiera de las cuatro defensas lo pone en rojo — comprobado mutándolas una a una y restaurando byte a byte.

### [ ] P0-SEC-8b · NOTA de lo que se midió y NO era vulnerable (mismo censo)
- `googleReviewUrl` (`receipt.routes.ts:255` y `:261`, más el perfil público) **NO es inyectable por su puerta real**: las 6 cargas dan `PUT /admin/merchant` → **400** y no se guarda nada; un `https://` legítimo → 200 y se pinta. Lo para el `z.preprocess` que antepone `https://` a todo lo que no empiece por http, que rompe cualquier otro esquema antes de `.url()`. Censados TODOS los escritores de la columna: sólo hay uno de usuario, y es ése.
- Queda escrito porque una defensa que funciona **por un efecto lateral** (el prefijo se puso para tolerar `g.page/r/…` sin protocolo, no para bloquear esquemas) es una defensa que alguien puede quitar sin saber lo que sujetaba.

---

## P1 — Bugs visibles al cliente / datos incorrectos

### [x] P1-BIZUM-PAIDVIA · El webhook de Connect grava `method:'card'` a fuego: un Bizum se registraría como tarjeta
- **✅ ARREGLADO 28-jul-2026 (SCRUM-191, con la decisión del fundador):** se añade `bizum_auto` al conjunto cerrado de la regla 22 —`bizum_manual` sería falso (nadie confirmó a mano) y `card` era el bug— y el webhook **lee** el método real (`payment_method_details.type` del cargo, expandiendo `latest_charge`). Si no se puede resolver, se OMITE en vez de inventarlo. **Apareció una hermana** que no estaba en el diagnóstico: el camino de `payment_intent.payment_failed` fijaba el método igual, y la cazó el guard, no la vista.
- **Encontrado:** 28-jul-2026, al ir a hacer visible el Bizum automático en el selector (SCRUM-3 / W4). **Bloquea ese cambio**, no es un hallazgo lateral.
- **Dónde:** `src/modules/payments/connect/connectWebhook.routes.ts:54` — en `checkout.session.completed` se manda `method: 'card'` **literal**, sin mirar con qué pagó el cliente. Hoy no miente porque ese checkout solo acepta tarjeta; en cuanto la capability `bizum_payments` esté activa, el MISMO checkout aceptará Bizum (dynamic payment methods) y todo Bizum entrará al sistema etiquetado como tarjeta.
- **Qué rompe:** la **regla 22** — *«`paid_via` se registra en el 100 % de los cobros»*. No falla por omisión sino por **atribución falsa**, que es peor: el dato existe, parece bueno y es mentira. Arrastra a la columna «Método (paid_via)» del CSV de exportación (el paquete que se entrega al asesor o a una inspección) y al desglose `paidVia` de métricas.
- **El dato SÍ está disponible:** la `Checkout.Session` trae `payment_method_types` y el `PaymentIntent` trae `payment_method_details.type` (`card` | `bizum`). No hay que adivinarlo, hay que leerlo.
- **🚨 POR QUÉ NO SE ARREGLA DE PASO:** el arreglo técnico es de tres líneas, pero **el valor que hay que escribir no lo decido yo**. La regla 22 enumera el conjunto CERRADO `card / bizum_manual / transfer / cash`. Un Bizum automático no es ninguno de los cuatro: `bizum_manual` es falso (no es manual) y `card` es el bug. **Añadir `bizum_auto` es cambio de máster (reglas 5 y 27) → decisión del fundador.**
- **Mientras tanto no hay daño:** `BIZUM_AUTO_ENABLED` está OFF y la capability `bizum_payments` no está activa. **El daño empieza el día que se active la capability**, que es una acción de Dashboard y NO pasa por este repo — o sea que nada del código avisará.

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

### [ ] P1-PORTAL-PDF · El botón «📄 Ver PDF» del portal PÚBLICO apunta a una URL bajo `requireAuth`
- **ARREGLADO EN SCRUM-806, PENDIENTE DE VERIFICAR EN yaqu.app.** Sigue en `[ ]` a propósito: la regla de arriba dice que se verifica en yaqu.app, y desde el árbol de trabajo no se puede. Quien mezcle ese PR y lo abra en producción, que lo tache.
  - **Qué se cambió:** el botón deja de derivar de `q.pdfUrl` y apunta a `/pay/quote/<decisionToken>/pdf`, ruta pública nueva en el router que YA resolvía por ese token. Sin `:id` (SCRUM-95). No se acuña ningún token: se lee el que la fila ya tiene; si no lo tiene, el botón no se pinta.
  - **Medido con servidor y dos merchants:** el cliente sin sesión recibe `200 application/pdf` y es SU documento; el profesional lo sigue viendo y es EL MISMO texto; y contra la ruta nueva, el id de otro merchant → 404, el propio → 404, un token inventado → 404, un byte cambiado → 404, 40 ids enumerados → 0 PDFs.
  - **Lo que NO cierra:** el botón hermano «📄 Descargar factura» (`customerPortal.routes.ts:347-350`) sigue igual — pasa por `ensureInvoicePdf`, camino de emisión, SCRUM-762.
- **Encontrado:** 6-sep-2026, midiendo SCRUM-799 (hallazgo colateral: ese ticket era MEDIR el PDF que cambia). **No se arregla ahí.**
- **Dónde:** `customerPortal.routes.ts:302-305` construye el href como `BASE_URL + quote.pdfUrl`, y el portal es **público** (`app.use('/cliente', …)`, `src/app.ts:139`, montado 220 líneas antes del `requireAuth` de la 359).
- **Por qué el valor es malo:** `quotes.pdf_url` lo escribe la propia ruta del PDF con su valor de retorno (`quotesAdmin.routes.ts:548`), y ese valor es **`/admin/quotes/<id>/pdf`** — MEDIDO, no deducido: el generador devolvió `publicUrlPath = "/admin/quotes/362/pdf"`. El cliente acaba pinchando una ruta de admin.
- **Hoy está LATENTE:** los 15 presupuestos de dev tienen `pdf_url = NULL` y el botón no se pinta (`btnPdf = pdfUrl ? … : ''`). **Se activa en cuanto el profesional abre UNA vez el PDF desde el panel**, porque esa apertura escribe la columna.
- **La casa YA LO SABE, en otro sitio:** `email.service.ts:145` deriva la ruta del adjunto del nombre canónico y NO de `quote.pdfUrl`, y explica el motivo — «que ahora apunta al endpoint auth» (SCRUM-72). El correo se enteró; el portal no.
- **Ya pasó una vez:** es el mismo error que P0-2 (línea 284) cerró para la FACTURA —enlazar el `pdfUrl` crudo en vez de una ruta que sirva el documento—, reaparecido en la cara del cliente.
- **Lo mismo hay que mirar en la factura del portal:** `customerPortal.routes.ts:347-350` («📄 Descargar factura») repite el patrón con `inv.pdfUrl`. En dev las 5 facturas están en `PENDING_PDF`, así que tampoco se pinta: **no medido en producción**.
- **Done cuando:** desde `/cliente` (sin sesión de admin) el botón o lleva a un documento que se ve, o no se pinta. Verificado en yaqu.app, no en localhost.

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

### [x] P3-CENSO-402 · `CENSO` de SCRUM-402 tenia una CLAVE REPETIDA, y JavaScript se comia una
- **Medido el 5-sep-2026** desde la rama de SCRUM-606, sobre `origin/main` = `28b04585` SIN
  ninguna rama encima: `tests/scrum402-marcador-no-se-pinta.test.mjs` salia **ROJO** en R4
  (`invoicesView.js: 1 -> 2`). Causa: la clave `'invoicesView.js'` estaba **dos veces** en el
  objeto —lineas 139 (SCRUM-748) y 578 (SCRUM-648b), a 439 de distancia, asi que git las
  mezclo sin conflicto— y JS se queda con la ultima en silencio: 2 marcadores reales, 1
  declarado. Comprobado con control positivo del instrumento (un marcador en literal cuenta 1;
  el mismo en comentario, 0).
- **CERRADO por SCRUM-751, no por esta entrada.** Se registro aqui como bug ajeno —era de otros
  dos tickets— y `main` lo arreglo el mismo dia, ANTES de que la rama de SCRUM-606 se empujara:
  la entrada duplicada se fundio en una con valor 2 y entro un guard que lo cierra por
  construccion (`tests/_claves-duplicadas.mjs` + `tests/scrum751-clave-duplicada-en-silencio.test.mjs`),
  sobre el FUENTE, porque en ejecucion la clave repetida ya no existe. Registro entero en
  `docs/master/SCRUM-751.md`.
- **Se conserva** porque dos sesiones midieron el mismo defecto por separado y llegaron al
  mismo numero: eso es lo que hace creible el diagnostico, y borrarlo lo perderia.
### [~] P3-9 · Tests que dependen del merchant `id=1` quemado por SCRUM-42 (22-jul, hallazgo en SCRUM-73; 3/5 corregidos en SCRUM-78+SCRUM-80)
- **Síntoma:** varios tests gateados asumen que el merchant `id=1` (demo) tiene
  quotes/invoices/customers reales — SCRUM-42 (12-jul-2026) lo quemó como placeholder INERTE
  `demo-reserved@staging.yaqu`, `status:'suspended'`, **0 filas** en quotes/invoices/customers
  (verificado en staging: `acela.proxy.rlwy.net`). Todos son anteriores a ese cambio y nunca se
  actualizaron a la nueva semántica de `id=1`.
- **Corregidos en SCRUM-78 (22-jul):** los 2 pedidos explícitamente ahora crean su propio
  merchant/customer/quote/invoice/job efímero (mismo patrón que `scrum23`/`scrum73`/`scrum47`
  /`scrum49`/`scrum57`), sin tocar nada de staging compartido:
  - `tests/tenancy-permisos.test.mjs` (`A12.1+A12.4`) — merchant "A" (víctima) + "B" (atacante)
    ambos efímeros ahora. Verificado 100% en solitario y junto a `webhooks-idempotencia.test.mjs`.
  - `tests/webhooks-idempotencia.test.mjs` (`A12.2c`) — merchant+customer efímeros. Al arreglarlo
    apareció un segundo bug latente en el MISMO test, enmascarado hasta ahora por el crash del
    `id=1`: el `fetch(/webhooks/psp)` no llevaba la cabecera `x-internal-secret` que exige
    `requireInternalSecret` (P0-SEC-1) → 404 antes de llegar al handler. Corregido importando
    `internalHeaders()` de `core/http/internalAuth.ts` (mismo patrón que el resto de llamadores
    internos). Limpieza en el `finally` ampliada: la factura auto-generada
    (`ensureInvoiceForCharge`, `AUTO_INVOICE_ON_PAID`) y el `customer_events` que crea
    `recordCustomerEvent` bloqueaban el `customer.deleteMany` por FK RESTRICT.
- **Corregido en SCRUM-80 (22-jul), el más barato de los 3 restantes:**
  - `tests/pdfs.test.mjs` (`A12.5d: regeneración on-demand (R8)`): `quote.findFirst({ where: {
    merchantId: 1 } })` → `null` → `TypeError` en `quote.id`. Mismo patrón que los dos de
    SCRUM-78: merchant+customer+quote efímeros propios. Verificado 4/4 en solitario
    (`node --test tests/pdfs.test.mjs`), reproducido antes y confirmado arreglado después.
- **NO corregidos — `DEMO_SAFE_NUMBERS`/semántica de merchant demo real, más laborioso que un
  simple id ancla; candidatos a tarea propia (ver comentario `⚠️ P3-9` en cada archivo):**
  - `tests/a55-window-quote.test.mjs` (`A5.5`, gateado tras `A55_DB_TEST=1`): `AssertionError:
    cliente seed 34611000001 no encontrado`.
  - `tests/bot-suite.test.mjs` (`A8.4`, gateado tras `BOT_SUITE_TEST=1`): `AssertionError: cliente
    seed no encontrado`.
- **Verificación de la suite COMPLETA (`npm run test:staging`) NO cerrada en SCRUM-80:** al
  correrla tras el fix de `pdfs.test.mjs` salieron 10 fallos nuevos, sin relación con este
  cambio (`The column albaranes.invoice_id does not exist`, entre otros) — confirmado con el
  fundador que staging estaba EN CALIENTE por dos sesiones concurrentes (SCRUM-17 aplicando un
  `db push` que añade `albaranes.invoice_id`, SCRUM-79 limpiando merchants huérfanos). No es una
  regresión de este PR: `pdfs.test.mjs` se verificó siempre EN SOLITARIO, aislado de ese ruido.
  Queda pendiente re-correr `test:staging` completo cuando staging esté quieta para confirmar
  0 fallos con los 3/5 ya corregidos.
- **Alcance:** 3/5 corregidos. Los 2 restantes documentados y anotados en el propio archivo de
  test (comentario `⚠️ P3-9`) para que no se olviden. Arreglo candidato: mismo patrón de datos
  efímeros tras entender qué asumen de `DEMO_SAFE_NUMBERS`, o re-sembrar un merchant "demo con
  datos" en otro id fijo.

### [x] P3-8 · 4 archivos de test gateados NO corren en `npm test` (22-jul, hallazgo en SCRUM-73; corregido en SCRUM-75)
- **Síntoma:** mismo patrón que P3-7 (lista explícita de archivos en `package.json`): existían
  `tests/scrum47-enviar-albaran-wa.test.mjs`, `tests/scrum49-firma-remota.test.mjs`,
  `tests/scrum50-bot-albaranes.test.mjs` y `tests/scrum57-operario-propagacion.test.mjs` en el
  repo (con tests reales, gateados `QA_DB_TEST=1`) pero NINGUNO estaba en la lista del script
  `test` → `npm test` los omitía en silencio. Solo `tests/scrum52-operario.test.mjs` (entre esa
  tanda) sí había quedado registrado. Al investigar en SCRUM-75 apareció un QUINTO huérfano no
  detectado en el hallazgo original: `tests/scrum68-evidencias-firma.test.mjs` (mergeado después
  de que se registrara este bug), mismo patrón exacto.
- **Corregido en SCRUM-75:** los 4 (+1) archivos se ejecutaron primero de forma aislada,
  gateados contra staging — los 4 originales pasan 100% en solitario (scrum47/49/50/57, 1/1 cada
  uno). Root fix aplicado: el script `test` de `package.json` pasó de listar archivos
  explícitamente a `node --test --test-force-exit tests/*.test.mjs` — Node 24 expande el glob
  internamente (confirmado: recoge exactamente los `*.test.mjs` de `tests/`, ignora
  `tests/_staging-db.mjs` por no matchear el sufijo, y NO se sale de `tests/` como sí hace el
  auto-discovery implícito de `node --test` sin argumentos, que además arrastra
  `scripts/wa-test.mjs` por su nombre). Un archivo nuevo en `tests/*.test.mjs` queda cubierto por
  `npm test` sin tocar `package.json` nunca más.
- **Hallazgo colateral (NO corregido, ver P3-10):** correr por primera vez TODA la suite gateada
  junta (antes imposible: cada archivo se ejecutaba suelto en su propia tarea) expuso una
  inestabilidad de concurrencia contra staging, ajena a estos 4 archivos.

### [x] P3-11 · `tests/scrum50-bot-albaranes.test.mjs` roto por el fail-closed de SCRUM-99 (23-jul, hallazgo en SCRUM-69; ticket SCRUM-122; corregido en SCRUM-122)
- **Síntoma:** al correr la suite gateada completa en staging para SCRUM-69 (`QA_DB_TEST=1
  WHATSAPP_DRY_RUN=1 npm run test:staging`), `scrum50-bot-albaranes.test.mjs` falla en el primer
  `assert` («acuse del «Recibido»»). `scrum47-enviar-albaran-wa` y `scrum49-firma-remota` también
  fallaron en el primer intento, pero por un error MÍO de invocación (olvidé `WHATSAPP_DRY_RUN=1`
  en el comando) — al repetir con el flag correcto, esos dos pasan limpio. `scrum50` sigue
  fallando incluso con el flag puesto.
- **Causa raíz:** el test hace `fetch(base + '/webhooks/whatsapp', { method: 'POST', headers: {
  'Content-Type': 'application/json' }, body: ... })` — **sin cabecera `X-Hub-Signature-256`**.
  Nunca la llevó. Hasta SCRUM-99 (esta misma sesión, posterior al 22-jul) el webhook era
  fail-open: sin `WHATSAPP_APP_SECRET` configurado, aceptaba igual. SCRUM-99 invirtió eso a
  fail-closed (`isValidSignature`, `whatsappIncoming.routes.ts`) — correcto y deseado, es el fix
  de seguridad — pero nadie volvió a `scrum50` para firmarle el payload de prueba. El log de la
  ejecución lo confirma explícito: `🚨 [WA webhook] WHATSAPP_APP_SECRET no configurado — payload
  RECHAZADO (fail-closed)`.
- **No es un bug de producción** — el webhook real hace exactamente lo que debe (rechazar sin
  firma válida). Es deuda de test: `scrum50` quedó desincronizado del propio fix de seguridad que
  se supone que debe seguir cubriendo.
- **Arreglo pendiente:** firmar el payload en el test con HMAC-SHA256 (mismo algoritmo que
  `isValidSignature`) usando un `WHATSAPP_APP_SECRET` de prueba fijado en el propio test (o vía
  `_staging-db.mjs`), igual que ya hace SCRUM-99/100 para sus propios tests del webhook.
- **No bloquea SCRUM-69**: ninguno de los archivos que toca (`pendientesFacturar.service.ts`,
  `customerAdmin.ts`, `albaranes.routes.ts`, schema `Customer.tipoDestinatario`, frontend) tiene
  relación con el webhook entrante de WhatsApp.
- **Corregido en SCRUM-122:** `scrum50-bot-albaranes.test.mjs` fija `WHATSAPP_APP_SECRET` de
  prueba y firma cada POST con HMAC-SHA256 (mismo algoritmo que `isValidSignature`) antes de
  enviarlo. Verde en staging.
- **Hallazgo colateral (barrido pedido por el fundador):** `tests/bot-suite.test.mjs` (A8.4,
  gateado por `BOT_SUITE_TEST=1`, distinto de `QA_DB_TEST`) tenía el MISMO patrón — POST sin
  firmar a `/webhooks/whatsapp`. Corregido con el mismo fix. Sigue sin poder pasar en verde de
  punta a punta, pero por una razón DISTINTA y ya registrada: **P3-9** (cliente seed quemado por
  SCRUM-42 en el merchant demo id=1) — confirmado al correrlo: ahora falla en «cliente seed no
  encontrado», no en la firma. `webhooks-idempotencia.test.mjs` (A12.2c) usa `/webhooks/psp` con
  `internalHeaders()` (P0-SEC-1, secreto interno propio) — NO afectado por el fail-closed de
  SCRUM-99, no necesita cambios.

### [x] P2-MET-1 · `reminderEur` (reports x2) contaba como recuperado dinero de recordatorios que FALLARON — histórico sin arreglo limpio (SCRUM-117, 23-jul)
- **Síntoma:** `reports.routes.ts:147` calcula el «€ recuperado por recordatorios» a partir de `reminderXSentAt`, fechas que ANTES de SCRUM-116 se escribían aunque el envío de WhatsApp fallara. La métrica que mide si los recordatorios funcionan contaba los que NO se enviaron — y el sesgo va en la PEOR dirección (los hace parecer más eficaces: un merchant con el WA mal configurado vería dinero «recuperado» que es mentira).
- **Origen ya arreglado:** SCRUM-116 (deploy 2026-07-23 15:22 UTC) — desde ahí `reminderXSentAt` significa «se envió»; un fallo NO lo marca. Los registros nuevos son fiables.
- **Sin arreglo retroactivo limpio:** el dato para distinguir un recordatorio real de uno marcado en falso NUNCA se guardó, y no hay sustituto (los fallos pre-116 no dejaron fila en `WhatsAppMessage` ni `customerEvent`). Nulear las fechas pre-fix está DESCARTADO: `reminderXSentAt` es el candado de idempotencia del cron → nulearlo reenviaría recordatorios de facturas viejas ya pagadas.
- **Medido antes de decidir (COUNT read-only contra prod, 23-jul):** de 3 facturas pagadas con fecha de recordatorio (las 3 pre-fix), **0 contribuyen a `reminderEur`** (ninguna se pagó ≤72h de un aviso) → inflación histórica real = **0 filas / 0,00 €**.
- **Decisión (fundador): opción 1 — documentar, sin cambio funcional.** Montar un suelo de fiabilidad en la lectura para proteger 0 datos infra-reportaría PARA SIEMPRE una era vacía. Queda un comentario en `reports.routes.ts:144` (con la frontera y el resultado del count) para que nadie lea `reminderEur` creyéndolo limpio de un periodo con volumen pre-116. Si algún día lo hay, reabrir con un suelo de LECTURA (`reminderXSentAt >= fecha`), nunca tocando el histórico.
- **Alcance:** solo la lectura de la métrica. Sin schema, sin write, sin cron, sin test (cero cambio de comportamiento).

### [x] P3-13 · Editor de presupuesto ≥768 px: el campo PRECIO se descuadra cuando hay margen (27-jul, hallazgo de la QA visual de SCRUM-139 F2)
- **CERRADO (27-jul, SCRUM-139 F4):** el aviso "Final: X €" deja de colgar bajo el input y pasa
  a vivir DENTRO de la etiqueta de PRECIO (`.quote-line__label`, ahora flex). Así ninguna celda
  es más alta que las demás y el descuadre desaparece **de raíz**, en vez de compensarse con un
  ajuste de alineación. Medido tras el arreglo: **descuadre 0 px** en 768 y 1440 (antes ~15 px).
  Se arregló en F4 y no antes porque F4 rehacía justo esa zona de la línea (margen e IVA a la
  hoja inferior): arreglarlo en F2 habría sido trabajo que F4 tiraba.
- **Síntoma:** en la rejilla de escritorio, una línea con margen > 0 muestra el aviso "Final: X €"
  bajo el precio; ese aviso hace la celda más alta y, con `align-items: end` en `.quote-line`,
  el `input` de PRECIO sube ~15 px respecto a CANTIDAD / MARGEN / IVA. Se ve en la captura de
  escritorio de F2 (línea "Mano de obra", margen 15 %).
- **Alcance:** puramente estético, solo con margen > 0 y solo ≥768 px. No afecta a móvil (la
  tarjeta apila), ni a los importes, ni al payload.
- **Viene de SCRUM-139 F1** (la línea pasó de `<tr>` a tarjeta en rejilla); no es una regresión
  de F2 — F2 es la fase que lo ha DESTAPADO al hacer por fin la QA renderizada.
- **NO se arregla aquí a propósito:** SCRUM-139 **F4** mueve margen % e IVA a una hoja inferior
  y rehace justo esa zona de la línea, incluido dónde vive el aviso "Final:". Arreglar la
  alineación ahora es trabajo que F4 tira. Si F4 se cayera del plan, este bug se arregla solo.

### [ ] P3-12 · `scrum116-recordatorio-candado.test.mjs` requiere `WHATSAPP_DRY_RUN` SIN poner — conflicto con los tests que sí lo necesitan (23-jul, hallazgo colateral en SCRUM-122)
- **NO es un bug — es una nota de higiene de invocación**, registrada para que nadie la lea como
  regresión: al correr `QA_DB_TEST=1 WHATSAPP_DRY_RUN=1 npm run test:staging` (necesario para
  scrum47/49/50/bot-suite), `scrum116-recordatorio-candado.test.mjs` falla con el mismo mensaje
  que describe («FUGA DE DINERO»). Parece grave — no lo es: en solitario, SIN
  `WHATSAPP_DRY_RUN=1` (solo `QA_DB_TEST=1`), pasa limpio.
- **Causa:** `whatsapp.ts:142` — `if ((!phoneNumberId || !token) && !isDryRun())`. El modo
  dry-run se diseñó a propósito para saltarse ESTE guard (comentario en el propio archivo:
  «WHATSAPP_DRY_RUN=1 los senders pasan TODOS los guards»), y `scrum116` depende exactamente de
  ese guard (`not_configured`) para simular un envío fallido sin credenciales reales. Su propio
  comentario lo explica pero no protege el env var: no fija `WHATSAPP_DRY_RUN` a `''`/`'0'` como
  sí hacen scrum50/bot-suite con LOS SUYOS.
- **La lógica de SCRUM-116 está bien** — se verificó leyendo `invoiceReminder.service.ts`
  completo: el candado (`reminderXSentAt`) solo se escribe si `sendReminderWA` devuelve `true`.
  Confirmado además por la propia ejecución aislada en verde.
- **No arreglado aquí** (fuera del alcance pedido — "el mismo problema" era la firma del
  webhook, esto es otra cosa): si se quiere un fix, el candidato obvio es que `scrum116` fije
  `process.env.WHATSAPP_DRY_RUN = ''` al principio del archivo, igual que ya hacen otros tests
  con sus propios flags.

### [x] P3-10 · Suite gateada COMPLETA (`QA_DB_TEST=1 npm test`) era inestable por concurrencia contra staging (22-jul, hallazgo en SCRUM-75; corregido en SCRUM-78)
- **Síntoma:** con los ~19 archivos de test gateados corriendo TODOS a la vez (comportamiento por
  defecto de `node --test` con múltiples archivos: paraleliza por worker), el resultado NO era
  determinista. Tres ejecuciones seguidas de la MISMA suite, mismo código, misma staging:
  - Ejecución 1: 14 fallos (incluye `PrismaClientKnownRequestError: The column tipo_operacion
    does not exist in the current database` en varios `prisma.job.create()` de archivos que
    SIEMPRE pasan en solitario — la columna existe, es un error transitorio).
  - Ejecución 2: 3 fallos, ninguno relacionado con `tipo_operacion`; distinto archivo afectado
    cada vez (`scrum57` falló aquí y no en la 1; otros archivos de la 1 pasaron limpio aquí).
  - Cada uno de los archivos, ejecutado EN SOLITARIO (`node --test --test-force-exit
    tests/<archivo>.test.mjs`), pasaba siempre — incluidos los 4 nuevos de P3-8.
- **Causa raíz:** no confirmada al 100 %, pero el fix de abajo la neutraliza. Candidato más
  probable: contención en el pool de conexiones de Postgres de staging (`acela.proxy.rlwy.net`)
  cuando ~19 `PrismaClient` + servidores HTTP efímeros arrancan a la vez (cada archivo de test es
  un proceso/worker propio de `node --test`); el error `tipo_operacion does not exist` es
  compatible con un problema conocido de Prisma + pooling tipo PgBouncer (prepared statements
  servidos con un plan/caché de esquema obsoleto bajo carga concurrente), no con una migración
  real ausente.
- **Decisión (SCRUM-78, 3 opciones evaluadas, elegida por el fundador):** opción 3 — separar
  `npm test` (rápido, no gateado, sin cambios) de un nuevo `npm run test:staging` (gateado, EN
  SERIE vía `--test-concurrency=1`). Se descartó la opción 2 (aislar datos por test) porque la
  mayoría de archivos YA crean su propio merchant efímero (igual que P3-9) y el síntoma
  (`tipo_operacion` transitorio) no encaja con colisión de datos sino con contención de
  conexiones; y la variante "todo en serie dentro de `npm test`" porque penalizaría siempre el
  ciclo rápido no gateado sin necesidad.
- **Corregido:** `package.json` → `"test:staging": "npm run build && node --test
  --test-force-exit --test-concurrency=1 tests/*.test.mjs"`. Los ~11 archivos gateados que
  documentaban `QA_DB_TEST=1 npm test` en su cabecera se actualizaron a `npm run test:staging`
  (mismo patrón para `A55_DB_TEST=1`/`BOT_SUITE_TEST=1`). Cero cambios en la lógica de los tests.
- **Verificado:** `QA_DB_TEST=1 WHATSAPP_DRY_RUN=1 npm run test:staging` corrido 2 VECES seguidas
  contra staging real → **resultado IDÉNTICO en ambas** (144 tests · 141 pass · 1 fail · 2
  skipped), el único fallo es determinista y de root cause conocido (`A12.5d`, ver P3-9) — cero
  ruido de concurrencia. `npm test` (rápido, no gateado) sigue en 144 · 124 pass · 0 fail · 20
  skipped, sin cambios de comportamiento.

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

### [ ] P3-1 · Plantillas Meta `quote_decision_es` **y `payment_request_es`**: `{{1}}` sin sustituir  🔒 ACCIÓN EN META (usuario) — código ya robusto
- **Síntoma:** el botón genera `/pay/quote/{{1}}23` (el `{{1}}` no se sustituye). Ya hay un workaround en el backend que hace funcionar el flujo.
- **Arreglo de raíz:** en WhatsApp Manager, el botón de URL debe ser **"Tipo de URL: Dinámico"**, base `https://yaqu.app/pay/quote/{{1}}`, muestra `https://yaqu.app/pay/quote/abc123`. Revisar también `payment_request_es` por el mismo problema. (Requiere re-aprobación de Meta.)
- **Done cuando:** la URL del botón llega limpia (`/pay/quote/23`) sin depender del workaround.
- **Estado (10 jun):** lado código YA resuelto (workaround robusto `parseNumericId`, commit `a25a1ce`). **Lo único pendiente es la acción en Meta** (tipo de URL dinámica) + re-aprobación — no se puede hacer desde el código. Una vez hecho, opcionalmente quitar el workaround.
- **⚠️ CONFIRMADO TAMBIÉN EN `payment_request_es` (22-jul-2026):** ya no es una sospecha ("revisar también"), está **verificado en producción**. El fundador llegó a `yaqu.app/pay/invoice/%7B%7B1%7D%7D0` → decodificado `/pay/invoice/{{1}}0`, desde el botón de un justificante reenviado por WhatsApp. **No es una previsualización del dashboard**: el front solo construye enlaces limpios (`/pay/invoice/<chargeId>`) y únicamente en la barra de fallback cuando el envío falla (`invoiceDetailView.js:249,265`) → el `{{1}}` solo puede venir del mensaje real de Meta.
  - **El código de envío es correcto** (auditado 22-jul): `buildPaymentRequest` → `urlButton(chargeId)` manda **solo el sufijo** como parámetro del botón (`whatsappTemplates.ts:113-120`), que es el contrato de Meta para URL dinámica. El `chargeId` que se pasa es el real (`invoiceWhatsApp.service.ts:107`). **El defecto está en la configuración del botón en WhatsApp Manager**, que es una URL estática con el literal `{{1}}` y Meta le concatena detrás el parámetro.
  - **El cliente SÍ puede pagar**: la landing usa el mismo workaround (`payInvoice.routes.ts:18` → `parseNumericId`, que elimina `{{...}}` y se queda con los dígitos).
  - **El log NO sirve para auditar esto:** `WhatsAppMessage` (`schema.prisma:504-528`) guarda `templateName`/`status`/`waMessageId`, **no el cuerpo ni la URL**.
  - **Duda abierta:** en ese caso el sufijo resuelto era `0` (`{{1}}0` → `parseNumericId` → `0`) y **no existe ningún `Charge` con id 0** (autoincrement empieza en 1) → ese enlace concreto no abriría. Falta confirmar si fue **truncamiento al copiar la URL** (lo más probable) o un `chargeId` inválido colándose en algún call-site. Si fuese lo segundo, es bug aparte.
  - **Seguimiento:** **SCRUM-77**.

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
