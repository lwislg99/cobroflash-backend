# TAREA ACTIVA — SCRUM-12 · Detalle del "Trabajo" (endpoint + timeline de documentos + bloque de cobros + acciones)

> Trabaja contra ESTE archivo + `docs/YAQU_MASTER.md` + el ticket Jira **SCRUM-12**. NO dependas del chat.
> Regla base: UNA tarea → UN commit de feature (+ 1 commit APARTE para el máster, pusheado). Verificar en **yaqu.app**, no en localhost.
> Pantalla NUEVA + endpoint de lectura nuevo = la tarea MÁS GRANDE del bloque. El endpoint es **solo-lectura** (bajo riesgo); las **ACCIONES DE COBRO** son el punto sensible → lee la **sección 5 (STOP)** antes de cablearlas.

---

## 0. CONTEXTO REAL DEL REPO (ya verificado en 3 rondas de reconocimiento — confírmalo, no lo re-descubras)

**No existe detalle de Job hoy.** `jobsView.js` pinta tarjetas con acciones inline (agendar/terminar/cobrar-resto/notas); sin click-through. El router `app.js:174-224` despacha `quotes-detail`, `invoice-detail`, `customer-360` vía `renderAppView('vista', { xId })` con `state.xId`. Los detalles **NO están en `HASH_VIEWS`** (`app.js:277`) → se abren por programa, no por URL/hash. **NO hay `jobs-detail`.**

**Serializer de la lista (backend):** `serializeJob` en `jobs.routes.ts:45-69` devuelve `quote{id,number,total,currency,paymentTerms}` + `remaining` + (SCRUM-13/28) `estadoCobro`, `totalCobrado`, `totalAceptado`. **NO devuelve `invoices[]` ni `charges`.** Router de jobs: `GET /`, `PATCH /:id`, `GET /:id/ics`, `POST /:id/collect-rest`. **NO hay `GET /admin/jobs/:id`.**

**Serializer del detalle de presupuesto a ESPEJAR:** `getQuoteDetailAdmin(id, merchantId?)` en `quoteAdmin.ts:141-160` (handler `quotesAdmin.routes.ts:459`, tenancy `:466`). Anida `charge{id,status,method,amount,currency,expiresAt,reference}` + `invoices[{id,number,total,currency,pdfUrl,createdAt}]`.

**GAP CONFIRMADO:** ese map de invoices **NO expone `status`, `paidAt` ni `chargeId`**. El bloque de cobros del Job los necesita (semáforo por tramo + link `/pay/invoice/:chargeId`). El **nuevo** serializer del job-detail debe **añadirlos** (aditivo, solo lectura).

**Patrón de detalle canónico (reutilizar la estructura):** `.detail-page` › `.detail-head` (h2 + `.detail-sub` + acciones a la dcha, incl. **Volver**) › banner `.alert` › `.detail-section` con `.detail-summary` (status pill + `.detail-total-amount`, **Regla del Importe**) › `.detail-2col`/`.detail-dl` › tabla de conceptos › lista de facturas (`.invoice-item` clicable) › notas (autosave). Ref: `quotesDetailView.js:44-719`, `invoiceDetailView.js:15-498`.

**"Reenviar por WhatsApp":** helper compartido `waFallbackBar({link,onEmail,onRetry})` (`quotesDetailView.js:331`, `invoiceDetailView.js:234`). Reutilizar tal cual.

**Timeline:** `buildStatusTimeline(quote)` es función LOCAL en `quotesDetailView.js:884-953` = stepper de **5 estados fijos** (Creada→Enviada→Aceptada→Facturada→Cobrada). **NO es lo que queremos.** `customerDetailView.js:134-155` pinta `events` como **LISTA VERTICAL DE ACTIVIDAD cronológica** (ENT-3) = **ESTE es el patrón** para el timeline de documentos. Es local, no está extraído como helper compartido.

**Acciones de cobro reutilizables (ya validadas — NO crear lógica nueva):**
- **"Cobrar el resto":** `POST /admin/jobs/:id/collect-rest` (`jobs.routes.ts:158-175`). Crea el siguiente tramo (Invoice+Charge) vía `getNextBillingStage` + `payment_request`. **SIEMPRE acción del pro** (máster V2, verificado). Hoy se dispara desde la jobCard cuando `status='terminado'` y `remaining>0`.
- **"Marcar como PAGADA":** `PUT /admin/invoices/:id/status` = `updateInvoiceStatusAdmin` (`invoiceAdmin.ts`). SCRUM-28 engancha `recalcJobCobradoForInvoice` en `invoiceAdmin.ts:107` (import `:4`), fire-and-forget → **recalcula `Job.totalCobrado`**.
- **"Confirmar Bizum":** `POST /admin/charges/:chargeId/confirm-bizum` (`chargesAdmin.routes.ts:15-49`). Valida tenant `:21-25`; **NO marca nada él mismo** → rebota a `/webhooks/psp` con `internalHeaders()` (`:34-42`); el webhook marca `charge.paid` + `invoice.paid` (`ensureInvoiceForCharge`) y **recalcula** (`psp.routes.ts:262`, SCRUM-13). → **El Bizum manual SÍ recalcula `totalCobrado` (por el camino del webhook). NO hay gap.** *(Matiz: ese recálculo depende de que `confirm-bizum` siga pasando por `/webhooks/psp`; acoplamiento a vigilar, no un bug.)*
- **"Recordar pago":** endpoints del invoice-detail `/admin/invoices/:id/send-reminder` + `/admin/invoices/:id/resend-whatsapp` (`invoiceDetailView.js:~234`).

**Dinero es-ES:** `fmtMoneyEs(n, currency='EUR')` (`api.js:77-94`, expuesta global `window.fmtMoneyEs` en `api.js:95`). `Intl.NumberFormat('es-ES', currency)` → `"2.383,70 €"`. **Reutilizar** en cabecera y timeline.

**Barra `.progress`:** `styles.css:487-495` (`.progress` track `:492`, `.progress-fill` verde `--green-600` `:493`, `.progress-fill--partial` ámbar `--amber-500` `:494`, `prefers-reduced-motion` `:495`). **HOY el markup está inline** en `jobsView.js:153-162` — **no hay helper JS reutilizable.**

**Mapeo del pill de cobro:** `COBRO_PILL_CLASS = { Pagado:'status-pill-accepted', Parcial:'status-pill-pending', Pendiente:'status-pill-draft' }` inline en `jobsView.js:16` (usado `:140`/`:148`). Mismo patrón duplicado a mano en `invoicesView.js:296-297` y `quotesDetailView.js:185-189`. **No está centralizado.**

**Tenancy:** `requireAuth` setea `req.merchantId = session.merchantId` (`authMiddleware.ts:28`). `app.use('/admin', requireAuth)` (`app.ts:159`); jobs montado en `app.ts:212`. Patrón de handler `:id`: `prisma.job.findFirst({ where: { id, merchantId: req.merchantId } })` — `PATCH jobs.routes.ts:94`, `ics :138`, `collect-rest :179`; el listado usa `where:{ merchantId } :75`.

---

## 1. QUÉ HAY QUE HACER (alcance EXACTO — ni más ni menos)

**BACKEND (solo lectura, aditivo):**
1. **Nuevo `GET /admin/jobs/:id`** que devuelva `serializeJob(job)` + `invoices[]` con `charge` anidado, **espejando `getQuoteDetailAdmin`**. Filtrar por `req.merchantId` (mismo patrón `findFirst` + `404`). **NO reutilizar `getQuoteDetailAdmin` ni el detalle del presupuesto** (no acoplar Job a Quote).
2. **Cerrar el GAP:** el serializer del job-detail expone, por cada invoice: `id`, número visible, `total`, `currency`, `createdAt`, `pdfUrl`, **Y ADEMÁS `status`, `paidAt`, `chargeId`** (semáforo por tramo + link `/pay/invoice/:chargeId`). `charge` anidado `{id,status,method,amount,currency}`. Todo desde datos que **ya existen**; NO tocar webhooks ni lógica de pago.

**FRONTEND (vanilla, DESIGN.md, yaqu-premium-ui):**
3. **`renderJobDetailView` nuevo**, clonando el layout canónico `.detail-page`/`.detail-head`/`.detail-section`/`.detail-summary`/`.detail-dl`. Caso `'jobs-detail'` + `state.jobId` en el router (`app.js`). `jobCard` clicable → `renderAppView('jobs-detail', { jobId: j.id })` **sin romper** las acciones FSM/.ics/notas de la tarjeta.
4. **Cabecera:** cliente, dirección, presupuesto origen (link al quote-detail), **total aceptado / cobrado / pendiente** con `.detail-total-amount` (Regla del Importe), **semáforo de cobro** (`.status-pill`) + **barra `.progress`**. Dinero SIEMPRE con `fmtMoneyEs`. Número de presupuesto **VISIBLE** (`quoteNumber`), nunca el id interno.
5. **Timeline de documentos/cobros** (patrón lista de actividad de `customerDetailView`, **NO** el stepper de 5 pasos): un ítem por documento/hecho en orden cronológico — presupuesto → cobros por tramo → facturas → *[futuro: albaranes]*. Si el componente se comparte, extraerlo y añadirlo al inventario AB3.
6. **Bloque de cobros:** lista los tramos (invoices/charges) con método/importe/fecha/estado y permite las acciones **REUTILIZADAS** del invoice-detail: **Cobrar el resto** (`collect-rest`) como **CTA primario verde** cuando `terminado + remaining>0`; **Marcar como PAGADA** (`PUT /admin/invoices/:id/status`); **Confirmar Bizum** (`POST /admin/charges/:chargeId/confirm-bizum`); **Recordar pago**; **Reenviar por WhatsApp** (`waFallbackBar`). **UN solo CTA primario verde.**
7. **Consolidación mínima aprobada por el fundador:** extraer un **helper compartido `progressBar(pct, estado)`** a partir del markup inline de `jobsView.js:153-162`, usarlo en el detalle **Y** sustituir el inline de `jobsView` por él (una sola fuente). Añadirlo al inventario **AB3 + DESIGN.md §5** (donde ya vive `.progress` de SCRUM-11 — ampliar la entrada, no duplicarla).

**NO INCLUYE (no construir):**
- **NO** extraer/centralizar el **mapeo del pill de cobro** (`COBRO_PILL_CLASS`): en esta tarea se **DUPLICA tal cual** como en `jobsView`/`invoices`/`quotes` (consistente con lo que hay). La centralización va en su ticket aparte **SCRUM-30**. (regla 9)
- **NO** albaranes, **NO** facturas nuevas, **NO** factura de anticipo/recapitulativa, **NO** SEPA, **NO** certificaciones (tickets propios; post-SIF donde aplique).
- **NO** tocar webhooks ni la lógica de pago (solo se **REUTILIZAN** endpoints ya existentes desde la UI).
- **NO** refactor de los pills de **ESTADO FSM** hand-styled (`JOB_STATE_META`) — nota-pendiente de SCRUM-11, otra tarea (misma familia que SCRUM-30).
- **NO** deep-link/URL para el detalle (se abre por programa, como quote/invoice detail).

---

## 2. CÓMO (backend — endpoint nuevo, aditivo, solo lectura)

- Añadir `GET /admin/jobs/:id` en el router de jobs (ya bajo `/admin`, scopeado por `requireAuth`, `app.ts:159`/`212`).
- **Tenancy IDÉNTICA** a los demás handlers de jobs (patrón exacto a clonar):
  ```
  const id = Number(req.params.id);
  const job = await prisma.job.findFirst({
    where: { id, merchantId: req.merchantId },
    include: { /* Quote con invoices[] + charge, como getQuoteDetailAdmin */ },
  });
  if (!job) return res.status(404)…
  ```
- **Espejar el include/serialización de `getQuoteDetailAdmin`** (`quoteAdmin.ts:141-160`): traer el Quote del Job (Job va **1:1** con Quote vía `Job.quoteId`) con sus `invoices[]` y el `charge` anidado.
- Serializar como `serializeJob(job)` + `invoices[]` **enriquecido**: por cada invoice exponer `id`, `number` (visible), `total`, `currency`, `createdAt`, `pdfUrl`, **`status`, `paidAt`, `chargeId`**. `charge`: `{id,status,method,amount,currency}`. Importes `Decimal(12,2)` — usa la aritmética/serialización del proyecto, **no float**.
- **NO modificar** el `serializeJob` de la lista (`jobs.routes.ts:45-69`) si rompe `jobsView`/`metrics`/`reports`. Si conviene reutilizar, extrae una función de serialización compartida **sin cambiar lo que ya devuelve la lista**.

---

## 3. CÓMO (frontend — vista + router + reutilizables)

- **Router (`app.js:174-224`):** añadir caso `'jobs-detail'` con `state.jobId` → `renderJobDetailView(jobId)`. **NO** meterlo en `HASH_VIEWS` (`app.js:277`). En la `jobCard` (`jobsView.js`) → `onClick renderAppView('jobs-detail', { jobId: j.id })`; **cuidar que los botones de acción interna** (agendar/terminar/cobrar-resto/notas/.ics) **NO disparen** la navegación (`stopPropagation` donde toque).
- **Layout:** clonar `.detail-page`/`.detail-head`(`.detail-sub` + **Volver**)/`.detail-section`/`.detail-summary`/`.detail-dl` de `quotesDetailView`/`invoiceDetailView`. **UN CTA primario verde**; secundarias discretas.
- **`progressBar(pct, estado)`:** extraer del inline de `jobsView.js:153-162` a un helper compartido (junto a los helpers de UI), reutilizar en el detalle **y** en `jobsView`. Respeta tokens (`.progress`/`.progress-fill`/`.progress-fill--partial`, `--green-600`/`--amber-500`, `prefers-reduced-motion`, `styles.css:487-495`).
- **Pill de cobro:** **DUPLICAR** el mapeo `Pagado→status-pill-accepted` / `Parcial→status-pill-pending` / `Pendiente→status-pill-draft` como se hace hoy — **NO centralizar** (va en SCRUM-30).
- **Timeline:** adaptar el patrón de lista de actividad de `customerDetailView.js:134-155` (lista vertical cronológica), **NO** `buildStatusTimeline`. Ítems: presupuesto (con `quoteNumber`, link), cada cobro/tramo (método, importe `fmtMoneyEs`, fecha, estado), cada factura (número, importe, estado, `pdfUrl`). Orden cronológico.
- **Dinero SIEMPRE `fmtMoneyEs`** (`api.js:95`). `quoteNumber` visible, nunca id interno (copy oficial v2.1).

---

## 4. CÓMO (bloque de cobros — reutilizar acciones existentes)

- Renderiza los tramos desde `invoices[]`/`charge` del endpoint nuevo (estado por tramo con el semáforo/pill; link de pago `/pay/invoice/:chargeId`).
- **Acciones, TODAS reutilizando lo que ya existe** (no crear lógica nueva):
  - **Cobrar el resto** → `POST /admin/jobs/:id/collect-rest` (`jobs.routes.ts:158-175`). CTA primario verde **SOLO** cuando `job.status='terminado' && remaining>0`. Tras éxito: toast + refrescar.
  - **Marcar como PAGADA** → `PUT /admin/invoices/:id/status`. Recalcula `totalCobrado` (SCRUM-28) → refrescar semáforo/barra tras la acción.
  - **Confirmar Bizum** → `POST /admin/charges/:chargeId/confirm-bizum`. Recalcula vía `/webhooks/psp` (SCRUM-13) → refrescar tras la acción.
  - **Recordar pago** → endpoints existentes del invoice-detail (`/send-reminder` / `/resend-whatsapp`).
  - **Reenviar por WhatsApp** → `waFallbackBar({link,onEmail,onRetry})` (`quotesDetailView.js:331` / `invoiceDetailView.js:234`).
- **Tras CUALQUIER acción de cobro, re-fetch del `GET /admin/jobs/:id`** para que semáforo, barra y timeline queden al día.

---

## 5. 🚨 STOP CONDITIONS (máster AA1.4) — OBLIGATORIO PARAR

- El endpoint `GET /admin/jobs/:id` es **solo LECTURA** → bajo riesgo, no requiere parada por sí mismo. **PERO:** antes de cablear en la UI cualquier botón que **TOQUE DINERO** (Cobrar el resto, Marcar como PAGADA, Confirmar Bizum), **PARA y enséñame:** (a) qué endpoint exacto llamas, (b) con qué payload, (c) confirmación de que **NO tocas la lógica** de esos endpoints (solo los invocas desde la UI). **Espera OK explícito del fundador.**
- Si para leer el Job te vieras obligado a **modificar `serializeJob` de la lista**, un webhook, o la lógica de pago → **PARA**.
- Si el `include` del endpoint te obligara a un **cambio de schema NO aditivo** → **PARA**.
- **NO tocar** la validación de firma/idempotencia de `/webhooks/psp` ni `/webhooks/mp`. **NO tocar** `chargesAdmin`/`invoiceAdmin` salvo para **LEER** cómo se llaman.

---

## 6. DEFINICIÓN DE HECHO (Gate)

- `GET /admin/jobs/:id` devuelve el Job + `invoices[]` (con `status`/`paidAt`/`chargeId`) + `charge` anidado, **filtrado por `merchantId`**. **Test de tenancy:** merchant A no accede a un Job de B (404).
- Clic en una tarjeta de Trabajo abre su detalle; **las acciones inline de la tarjeta siguen funcionando** (no las traga el click-through).
- Cabecera con totales + semáforo + barra correctos (`fmtMoneyEs`, `quoteNumber` visible).
- **Timeline** de documentos/cobros en orden cronológico (presupuesto + cobros + facturas), patrón lista de actividad (no stepper).
- Bloque de cobros lista los tramos y permite Cobrar el resto (CTA verde cuando terminado+remaining) / Marcar pagada / Confirmar Bizum / Recordar / Reenviar WhatsApp, reutilizando lo existente; **tras cada acción el semáforo/barra/timeline se refrescan**.
- `progressBar(pct, estado)` **extraído y usado en el detalle Y en `jobsView`** (una sola fuente); añadido a AB3/DESIGN.md §5. **Sin regresión visual** en la lista.
- **Sin regresión:** `jobsView` (acciones FSM, .ics, notas), `metrics`, `reports`, quote/invoice detail intactos. **Tests verdes.**
- Digno **390px y 1280px**; empty/skeleton/error states.
- **Verificado E2E en yaqu.app** (no localhost): abrir un Trabajo 50/50 con un tramo pagado → cabecera **Parcial** + barra al 50% + timeline con el cobro; confirmar/marcar el segundo tramo → pasa a **Pagado** y el timeline lo refleja.
- **Evidencia:** diff del endpoint + serializer (señalando `status`/`paidAt`/`chargeId`), diff de la vista, prueba de tenancy, capturas 390/1280 antes/después de `jobsView`, salida E2E en yaqu.app.

---

## 7. AL TERMINAR — MÁSTER (commit SEPARADO)

- Primero el commit de la **feature**.
- En **commit aparte**, actualización MÍNIMA del máster (**solo AÑADIR**, regla 16; **no inventar**, regla 27):
  - En **JOB-1 / Parte R**: anotar que existe el **detalle del Trabajo** (`GET /admin/jobs/:id` solo lectura + invoices/charges anidados con `status/paidAt/chargeId`; timeline de documentos; acciones de cobro reutilizadas).
  - En **AB3**: dejar constancia del helper **`progressBar(pct, estado)`** (ya hay entrada de `.progress` de SCRUM-11 → **ampliar**, no duplicar).
- Di **qué líneas** tocas y **confirma el hash** del push.

---

## 8. JIRA (tienes el conector)

- Al terminar, mover **SCRUM-12** a **"En revisión"** con comentario: archivos tocados, diff del endpoint + serializer (con los campos añadidos `status/paidAt/chargeId`), diff de la vista, prueba de tenancy, resultado E2E en yaqu.app, capturas 390/1280, y el cambio de máster propuesto (hash).
- **NO tocar SCRUM-30** (deuda del pill de cobro) — queda para su turno.

---

## 9. FORMATO DE ENTREGA (repórtame)

- Archivos tocados y por qué.
- El **endpoint nuevo + el serializer enriquecido** (para revisión), señalando los campos añadidos.
- **Cómo se enganchan las acciones de cobro** (qué endpoint/payload por botón) — **ANTES de aplicarlas (STOP)**.
- Confirmación de **no-regresión** (`jobsView`/`metrics`/`reports`/quote-invoice detail + tests verdes).
- **Prueba de tenancy** (acceso cruzado 404).
- **Capturas 390/1280** (detalle nuevo + `jobsView` antes/después).
- **Salida E2E en yaqu.app.**
- **Cambio de máster propuesto** (líneas + hash).
- Dudas/decisiones para el fundador.
