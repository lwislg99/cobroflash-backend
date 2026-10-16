# TAREA ACTIVA — SCRUM-27 · Planes de cobro por tramos PERSONALIZADOS (30/40/30, hitos, mensualidades)

> Trabaja contra ESTE archivo + `docs/YAQU_MASTER.md` + el ticket Jira **SCRUM-27**. NO dependas del chat.
> Regla base: UNA tarea → UN commit de feature (+ 1 commit APARTE para el máster, pusheado). Verificar en **yaqu.app**, no en localhost.
> 🚨 ZONA DE DINERO/FACTURACIÓN + **2 campos de schema (aditivos)** + editor frontend. La tarea más grande del bloque. Lee la **sección 5 (STOP)** ANTES de tocar schema o generación de Invoice/Charge.
> El motor de reparto (`distributeStageAmounts`, SCRUM-32) YA reparte N tramos con el último absorbiendo el resto — **no se toca**. Esta tarea es: de dónde sale el plan + editor + que la etiqueta llegue al detalle.

---

## 0. CONTEXTO REAL DEL REPO (verificado en reconocimiento — confírmalo, no lo re-descubras)

**Motor (`billingPlan.ts`, 147 líneas, tras SCRUM-32):**
- `PaymentTermsCode` (`:14-20`): unión de 4 strings + null/undefined.
- `BillingStage` (`:22-29`): `{index, percentage, label}`.
- `getBillingPlan(paymentTerms)` (`:50-85`): `switch` con % HARDCODEADOS — `FULL_UPFRONT [1]`, `FIFTY_FIFTY [0.5,0.5]`, `MANUAL`/`SIN_CONDICIONES`/default `[]`. Los % salen del literal del switch, **no de datos**.
- `getNextBillingStage(paymentTerms, count)` (`:99-110`): `plan[count]` (selección por conteo).
- `distributeStageAmounts(total, plan)` (`:120-133`): **YA reparte CUALQUIER lista de %**, redondea 0..n-2 y el último absorbe el resto. **NO se toca.**
- `getStageAmount(total, paymentTerms, stageIndex)` (`:139-146`): hace `distributeStageAmounts(total, getBillingPlan(paymentTerms))[stageIndex]`. **Cuello de botella:** reconstruye el plan desde el ENUM.

**Schema (`schema.prisma`, modelo Quote `@@map("quotes")` `:269`):**
- `paymentTerms String?` (`:243`): **String libre, NO enum** (el enum solo vive en TS). `total Decimal @db.Decimal(12,2)` (`:239`). **No hay campo para tramos personalizados.**
- JSON reutilizables como patrón en Quote: `lines Json` (`:241`), `tiers Json?` (`:252`), `payMethods Json?` (`:236`), `evidence Json?` (`:255`).
- (Nota: `:443` era `QuoteTemplate.paymentTerms`, otro modelo — plantillas de plan serían futuro, **NO en SCRUM-27**.)

**Dónde se ESCRIBE `paymentTerms` al crear:** `POST /quote/create` → `tx.quote.create` en `quotes.routes.ts:107-128`, campo `paymentTerms: body.paymentTerms ?? null` (`:119`).

**Frontend — control de condiciones de pago:** un `<select>` (`createFieldSelect("Condiciones de pago","payment_terms")`) en `quotesView.js:357-389`, 4 opciones: `""` (Sin condiciones), `FULL_UPFRONT`, `FIFTY_FIFTY`, `MANUAL`; default `FULL_UPFRONT` (`:389`). Se envía como `paymentTerms: paymentSelect.value` en el payload de creación (`:717`) y en el guardado de borrador (`:2213`); hay un `change` listener (`:2091`).

**Patrón de filas editables a CLONAR (clave para el editor):** `addLine(initial)` en `quotesView.js:1571` crea un `<tr>` con inputs (concepto/qty/precio/markup/IVA), botón "Eliminar línea" (`:1665-1670`), lo mete en `tbody` (`:1683-1695`) y lo empuja a un array `lines[]` de `lineObj`. El botón "+ Añadir línea" (`:515-519`) llama a `addLine()` (`:1783`). **Este es el patrón exacto para el editor de tramos** (filas con `label` + `%`, añadir/quitar, recolectar a un array). **No hay que inventar nada.**

**Consumo del plan (3 call-sites, tras SCRUM-32):** los tres llaman `getStageAmount(total, paymentTerms, stage.index)` — `quotes.routes.ts:506`, `quotesAdmin.routes.ts:156`, `jobs.routes.ts:269`. La SELECCIÓN del tramo (`getNextBillingStage` / `plan[emitted]`, por conteo) también se construye desde el enum.

**Etiqueta del tramo (`BillingStage.label`):** **NO se consume en NINGÚN sitio hoy** (solo se define en `billingPlan.ts`). El concepto de la factura/Charge usa `"Factura {number}"` / `"Justificante {number}"` (`invoiceWhatsApp.service.ts:58`), **no** el label del tramo.

**Validación al crear:** en el handler de `POST /quote/create` (`quotes.routes.ts:65-94`): tenancy (`:65`), `lines || tiers` requeridos (`:69-72`), merchant/customer existen (`:74-79`), total por `calcTotal`/`calcTierTotal` (`:87-93`). **No hay validación de `paymentTerms`.**

**`scaledLines` (PDF):** en los 3 call-sites escala cada línea por el % del tramo (`quotes.routes.ts:513-516`, `quotesAdmin :161-163`, `jobs :271-273`), con `stage.percentage`. El `TODO(SCRUM-16/17)` de SCRUM-32 está en `quotes.routes.ts:511-512`. **NO se toca en SCRUM-27** (es territorio fiscal; el total del tramo ya es exacto).

---

## 1. QUÉ HAY QUE HACER (alcance EXACTO)

**BACKEND:**
1. **Schema aditivo (2 campos):**
   - `Quote.customBillingPlan Json?` — guarda la lista de tramos personalizados `[{ percentage, label }]` (el índice es el orden; `percentage` como fracción 0-1, igual que los presets `[0.5,0.5]`).
   - `Invoice.stageLabel String?` — la etiqueta del tramo, **congelada al crear la factura** (para que el detalle la muestre sin re-derivar).
   - **Aditivo puro, `db push` con PREVIEW del diff. NADA de borrar/renombrar.**
2. **`resolveBillingPlan(quote): BillingStage[]`** nueva en `billingPlan.ts`: devuelve el plan personalizado si `quote.customBillingPlan` existe (mapeado a `BillingStage[]` con índices y labels), y si no `getBillingPlan(quote.paymentTerms)` (los presets, **sin tocar**). `distributeStageAmounts` **no cambia**.
3. **Enrutar los 3 call-sites** para que el importe salga de `distributeStageAmounts(total, resolveBillingPlan(quote))[index]` (plan resuelto desde el Quote, no desde el enum), y que la **selección del tramo** (cuántos tramos hay) también use `resolveBillingPlan(quote)`. Al crear cada tramo, **fijar `Invoice.stageLabel`** con el label del tramo resuelto.
4. **Persistir el plan al crear:** en `quotes.routes.ts:119`, junto a `paymentTerms`, guardar `customBillingPlan: body.customBillingPlan ?? undefined` (y en el guardado de borrador si aplica).
5. **Validación** en `POST /quote/create` (`:65-94`): si viene plan personalizado → **≥1 tramo, cada `label` no vacío, cada `percentage > 0`, y la suma == 100% exacta** (comparar en enteros para evitar bailes de float). Rechazar con mensaje claro si no cuadra.
6. **Exponer `stageLabel` en el detalle (SCRUM-12):** añadir `stageLabel` a la serialización de cada invoice en `serializeJobDetail` (el endpoint `GET /admin/jobs/:id`), aditivo.

**FRONTEND (vanilla, DESIGN.md, yaqu-premium-ui):**
7. **Opción "Personalizado"** en el `<select>` de condiciones de pago (`quotesView.js:357-389`). Al elegirla, **revelar el editor de tramos** (con el `change` listener `:2091`).
8. **Editor de tramos CLONANDO `addLine`** (`quotesView.js:1571` / eliminar `:1665-1670` / añadir `:515-519`/`:1783`): filas con **etiqueta (texto)** + **% (número)**, botones añadir/quitar, recolectar a un array. Mostrar la **suma en vivo** con aviso de validación ("los tramos deben sumar 100%"). Enviar `customBillingPlan` en el payload de creación (`:717`) y borrador (`:2213`).
9. **Mostrar la etiqueta del tramo en el detalle del Trabajo (SCRUM-12):** en el timeline/cobros, pintar `stageLabel` (ya viene del endpoint) — p.ej. "Anticipo · 500,00 €", "Hito 1 · 400,00 €". Reutiliza el render existente; dinero con `fmtMoneyEs`.

**NO INCLUYE (no construir):**
- **NO** llevar la etiqueta a la **factura (concepto)** ni al **WhatsApp** — eso es **SCRUM-33** (toca concepto fiscal + plantilla Meta; va con lo fiscal). En SCRUM-27 la etiqueta va SOLO al detalle.
- **NO** tocar `distributeStageAmounts` (ya reparte N tramos, SCRUM-32).
- **NO** tocar `scaledLines` / el desglose línea-a-línea del PDF (TODO de SCRUM-16/17).
- **NO** plantillas de plan reutilizables (`QuoteTemplate`) — futuro.
- **NO** editar el plan de un presupuesto DESPUÉS de que empiecen a materializarse tramos (se define al crear; mantenerlo simple).
- **NO** romper los presets: `FULL_UPFRONT`/`FIFTY_FIFTY`/`MANUAL` siguen igual.

---

## 2. CÓMO (backend — modelo + resolución)

- **Schema:** añadir `Quote.customBillingPlan Json?` e `Invoice.stageLabel String?`. `db push` con **preview del diff** (regla de hierro: aditivo, nunca `migrate dev`, nunca borrar/renombrar).
- **`resolveBillingPlan(quote)`:** si `quote.customBillingPlan` es un array no vacío → mapear a `BillingStage[]` (`index` por orden, `percentage` la fracción guardada, `label` la etiqueta). Si no → `getBillingPlan(quote.paymentTerms)`. Validar/normalizar defensivamente (percentage numérico, etc.).
- **Call-sites:** sustituir `getStageAmount(total, paymentTerms, index)` por el cálculo con el plan resuelto: `distributeStageAmounts(total, resolveBillingPlan(quote))[stage.index]`. La selección de "cuántos tramos hay" (hoy `getNextBillingStage`/`plan[emitted]`) se construye desde `resolveBillingPlan(quote)`. Fijar `Invoice.stageLabel = plan[stage.index].label` al crear la factura del tramo.
- **Importe en `Decimal(12,2)`**, usa la aritmética del proyecto. El euro exacto lo garantiza `distributeStageAmounts` (SCRUM-32) para cualquier lista de %.

## 3. CÓMO (backend — persistencia + validación)

- **Persistir:** en `quotes.routes.ts:119`, añadir `customBillingPlan: body.customBillingPlan ?? undefined` en el `tx.quote.create` (aditivo; borrador igual si aplica).
- **Validar** en el handler de create (`:65-94`), junto al resto: si hay plan personalizado → ≥1 tramo, labels no vacíos, `percentage > 0` por tramo, y **suma == 100%** (en enteros: `Σ round(p*100) == 100`, o la tolerancia que definas). Mensaje de error claro y en es-ES si no cuadra (copy digno, sin stacktrace).

## 4. CÓMO (frontend — select + editor + detalle)

- **Select:** añadir opción "Personalizado" en `createFieldSelect` (`quotesView.js:357-389`). El `change` listener (`:2091`) muestra/oculta el editor de tramos.
- **Editor (clonar `addLine`):** filas `{etiqueta, %}` con añadir/quitar (patrón `:1571`/`:1665-1670`/`:515-519`), recolectar a un array `stages[]`. **Suma en vivo** + aviso "deben sumar 100%" (deshabilitar guardar / marcar en rojo si no cuadra — reutiliza el estilo de validación existente). Enviar `customBillingPlan: stages` en el payload (`:717`) y borrador (`:2213`).
- **Detalle (SCRUM-12):** pintar `stageLabel` de cada tramo en el timeline/bloque de cobros (ya llega del endpoint). Dinero con `fmtMoneyEs`. Si un tramo no tiene label (presets), comportamiento como hoy.

## 5. 🚨 STOP CONDITIONS (máster AA1.4) — OBLIGATORIO PARAR

- **ANTES de tocar el schema, PARA y enséñame:** el diff EXACTO de Prisma (`Quote.customBillingPlan Json?` + `Invoice.stageLabel String?`) y el **preview de `db push`**. Confirma que es 100% aditivo (no borra/renombra). Espera OK.
- **ANTES de tocar la generación de Invoice/Charge en los 3 call-sites, PARA y enséñame:** `resolveBillingPlan`, el diff de cada call-site, y cómo fijas `Invoice.stageLabel`. Confirma que NO tocas `distributeStageAmounts`, ni la cadena del Charge, ni webhooks, ni la materialización de `totalCobrado` (SCRUM-13/28). Espera OK.
- Si algo obliga a un cambio de schema NO aditivo, o a tocar la cadena de pago/webhooks → **PARA**.
- **NO** tocar plantillas de WhatsApp ni el concepto de la factura (eso es SCRUM-33).

## 6. DEFINICIÓN DE HECHO (Gate)

- El pro puede crear un plan de N tramos con etiqueta + % que **sumen 100%** (validado; rechazo claro si no).
- Presets (100% / 50/50 / manual) **siguen funcionando igual** (sin regresión).
- Cada tramo genera su Invoice+Charge como hoy, **disparado por el pro** (regla V2), con importes que **suman EXACTO** el total (gracias a `distributeStageAmounts`).
- El plan personalizado se refleja en el **detalle del Trabajo (SCRUM-12)** con las **etiquetas** de cada tramo, y cuenta para `totalCobrado` (SCRUM-13).
- Schema **aditivo** aplicado con preview; `npm run build` + `npm test` verdes.
- Digno **390/1280**; validación del editor clara (suma 100%).
- **Verificado E2E en yaqu.app:** crear un presupuesto con plan **30/40/30** (etiquetas "Anticipo/Hito 1/Hito 2") → cobrar los 3 tramos → el detalle muestra las 3 etiquetas, los importes suman EXACTO el total, y el semáforo llega a **Pagado**. Verificar también que un preset 50/50 sigue funcionando.
- Evidencia: diff del schema (preview), `resolveBillingPlan`, diff de los 3 call-sites, el editor (capturas 390/1280), y la salida E2E.

## 7. AL TERMINAR — MÁSTER (commit SEPARADO)

- Primero el commit de la **feature**.
- En **commit aparte** (solo AÑADIR, regla 16; no inventar, regla 27): anotar en la parte de money flows / billingPlan que existen **planes de cobro personalizados** (`Quote.customBillingPlan`, `resolveBillingPlan`, `Invoice.stageLabel`), que el reparto exacto lo da `distributeStageAmounts` (SCRUM-32), y que la etiqueta va al detalle (a la factura/WhatsApp = SCRUM-33). Di qué líneas tocas y confirma el **hash** del push.

## 8. JIRA (tienes el conector)

- Al terminar, mover **SCRUM-27** a **"En revisión"** con la evidencia (diff schema + `resolveBillingPlan` + 3 call-sites + editor + E2E del 30/40/30). Cambio de máster propuesto (hash).
- **NO tocar SCRUM-33** (etiqueta en factura/WhatsApp) — su turno con lo fiscal.
- **NO la cierres:** el E2E lo verifica el fundador en yaqu.app.

## 9. FORMATO DE ENTREGA (repórtame)

- Archivos tocados y por qué.
- El diff de Prisma + preview de `db push` — **ANTES de aplicar (STOP)**.
- `resolveBillingPlan` + el diff de los 3 call-sites + cómo fijas `Invoice.stageLabel` — **ANTES de aplicar (STOP)**.
- La validación "suman 100%" y el editor de tramos (capturas 390/1280).
- Confirmación de no-regresión (presets igual; `distributeStageAmounts`/cadena de cobro intactas; build + test verdes).
- Salida E2E en yaqu.app (el 30/40/30 cuadrando exacto + un preset 50/50 OK).
- Cambio de máster propuesto (líneas + hash).
- Dudas/decisiones para el fundador.
