# TAREA ACTIVA — SCRUM-34 · UX de generación de tramos: cobrar el siguiente hito sin marcar Terminado + plan visible en el detalle del presupuesto

> Trabaja contra ESTE archivo + `docs/YAQU_MASTER.md` + el ticket Jira **SCRUM-34**. NO dependas del chat.
> Flujo de ramas (AA1.2): `git checkout main && git pull` → rama **`scrum-34-tramos-ux`** → UN commit de feature + commit APARTE del máster, AMBOS en la rama → push + **PR a `main`** → el MERGE lo hace el fundador. `main` protegida: NADA de push directo.
> 🚨 ZONA DE DINERO — esta tarea abre puertas de UI a endpoints que crean **Invoice+Charge**. Lee la **sección 5 (STOP)** ANTES de tocar nada. El backend de cobro NO se modifica: solo serializers (aditivo) + frontend.

---

## 0. CONTEXTO REAL DEL REPO (ya verificado en reconocimiento 11-jul, main `236faea` — confírmalo, no lo re-descubras)

**Botón "Generar 2ª factura" (detalle del presupuesto), `quotesDetailView.js:577-603` (visibilidad) y `:605-615` (endpoint):**
- `const pt = quote?.decision?.paymentTerms ?? quote?.paymentTerms ?? null;` (`:578`); ramas hardcodeadas `FULL_UPFRONT` (`:580`) / `FIFTY_FIFTY` (`:581`) + conteo de invoices 0/1 (`:598`).
- Un plan CUSTOM viaja con `paymentTerms=null` → cae al `else` (`:600-602`) → botón **deshabilitado** con "No disponible para estas condiciones de pago".
- Al pulsar: `POST /admin/quotes/:id/invoice` (`:611`, fetch crudo, sin body).

**Serializer del quote-detail, `getQuoteDetailAdmin` (`quoteAdmin.ts:90-172`):**
- Del plan expone SOLO `decision.paymentTerms` (`:168`). NO viaja `customBillingPlan`, ni el plan resuelto, ni `stageLabel`, **ni siquiera `status`** en las invoices (`:153-160`: id, number, total, currency, pdfUrl, createdAt).
- El front pinta "Condiciones de pago" con `getPaymentTermsLabel(d.paymentTerms)` (`quotesDetailView.js:9-25`, uso en `:445`) → con `null` → **"Sin condiciones específicas"**.

**CTA "Cobrar el resto" (detalle del Trabajo), `jobDetailView.js:204-230`:**
- Condición: `job.status === 'terminado' && job.remaining && job.remaining.amount > 0` (`:205`).
- Label con `job.remaining.amount` (`:206`) = en `serializeJob` (`jobs.routes.ts:36-43`) la **suma de TODOS los tramos no emitidos** — pero al pulsar, `POST /admin/jobs/:id/collect-rest` (`:215`) emite SOLO el siguiente tramo → con 3+ tramos el label promete más de lo que hace.

**Endpoints que generan tramos (los 3 pasan por `resolveBillingPlan`, custom OK desde SCRUM-27; tramo por CONTEO de invoices):**
- `POST /quote/:id/decision` (1er tramo al aceptar, público) — `quotes.routes.ts:512` (plan), create `~:530-556`.
- `POST /admin/quotes/:id/invoice` (botón 1ª/2ª factura) — `quotesAdmin.routes.ts:123-209`; plan en `:149`; exige `status === 'accepted'` (`:140-142`); 409 `no_more_invoices_for_payment_terms` (`:153`). **NO mira el Job para nada** → esta es la puerta que SCRUM-34 abre: el backend YA permite emitir el siguiente tramo sin trabajo terminado.
- `POST /admin/jobs/:id/collect-rest` — `jobs.routes.ts:243-320`; exige terminado en backend (`:253-255`, 409 `job_not_finished`); plan en `:264`; `emitted >= plan.length` → 409 `nothing_pending`.
- No hay más generadores. Ambas rutas admin usan el mismo conteo → sin doble emisión entre rutas.

**Hallazgo YA capturado como SCRUM-35 (NO arreglar aquí):** el front usa `inv.status` (`quotesDetailView.js:260-261` CTAs "Ver justificante/cobro pendiente"; `:540` "Marcar como pagada") pero el serializer no expone `status` → esos CTAs hoy nunca se renderizan. Esta tarea EXPONE el dato (lo necesita); la verificación/arreglo de esos CTAs viejos es SCRUM-35.

**Nota (sin acción):** el panel de decisión del BO puede fijar `paymentTerms` al aceptar (`quotesDetailView.js:766-770`); en un quote custom no rompe: `resolveBillingPlan` prioriza `customBillingPlan`.

---

## DECISIONES TOMADAS POR EL FUNDADOR (no reabrir)

- **Puerta de "siguiente tramo sin Terminado": SOLO en el quote-detail** (Opción A). El job-detail se rediseñará en SCRUM-31 con feedback real; aquí solo se corrige su LABEL.
- **CTA de trabajo terminado con tramos pendientes: de UNO en UNO, label honesto.** `collect-rest` no cambia.
- **Presets `FULL_UPFRONT`/`FIFTY_FIFTY` conservan copy y comportamiento actuales** (cero regresión). El copy nuevo aplica SOLO a planes custom (`paymentTerms=null`).

---

## 1. QUÉ HAY QUE HACER (alcance EXACTO — 4 cambios)

1. **Serializer quote-detail (backend, ADITIVO)** — `getQuoteDetailAdmin` (`quoteAdmin.ts:90-172`):
   - Añadir `billingPlan`: el plan RESUELTO vía `resolveBillingPlan` + importes exactos vía `distributeStageAmounts` (ambos ya existen, SCRUM-27/32): array `[{index, label, percent, amount, currency}]`.
   - Añadir `nextStage`: `billingPlan[invoices.length]` o `null` si todos emitidos — **la MISMA regla de conteo** que usa `POST /admin/quotes/:id/invoice`, calculada en backend (una sola semántica).
   - Añadir a cada invoice del array (`:153-160`): `stageLabel` y `status`.
   - NO quitar ni renombrar nada de lo que ya viaja.
2. **Serializer job-detail (backend, ADITIVO)** — `serializeJob` (`jobs.routes.ts:36-43`):
   - Añadir `nextStage` `{label, amount, currency}` (mismo cálculo) y `pendingStagesCount` (tramos del plan resuelto aún no emitidos).
   - `remaining` NO se toca (lo usan otras vistas).
3. **Frontend `quotesDetailView.js`:**
   - **"Condiciones de pago"** (`:9-25` + uso `:445`): custom (`paymentTerms=null`) con `billingPlan` presente → pintar el plan: `"{label1} {pct1}% · {label2} {pct2}% · …"`. Presets → texto actual sin cambios. "Sin condiciones específicas" queda solo para plan realmente ausente.
   - **Botón de facturas** (`:577-615`): sustituir la lógica hardcodeada preset+conteo por guiarse por `nextStage` del serializer. Presets: mismo copy y visibilidad efectiva que hoy ("Generar 1ª/2ª factura (…)"). Custom: si `nextStage != null` y decisión aceptada → habilitado con **"Generar siguiente tramo: {label} ({importe})"**; si `nextStage == null` → como hoy cuando no procede. Endpoint al pulsar: el MISMO `POST /admin/quotes/:id/invoice`, sin cambios. **NO se exige trabajo terminado** (el backend no lo exige en esa ruta — esa es la puerta del ticket).
4. **Frontend `jobDetailView.js` (`:204-230`) — SOLO LABEL:**
   - Condición de visibilidad NO cambia (`terminado && remaining > 0`).
   - `pendingStagesCount >= 2` → **"🪙 Cobrar siguiente tramo: {nextStage.label} ({importe del TRAMO})"**; `pendingStagesCount === 1` → **"🪙 Cobrar el resto ({remaining.amount})"** (como hoy).
   - Endpoint al pulsar: el MISMO `POST /admin/jobs/:id/collect-rest`, sin cambios.

**NO INCLUYE (no construir):**
- **NO** tocar las rutas de creación de Invoice/Charge (`quotes.routes.ts`, `quotesAdmin.routes.ts:123-209` salvo el serializer si vive ahí, `jobs.routes.ts:243-320`), ni `billingPlan.ts`, ni webhooks, ni la cadena del Charge, ni `totalCobrado`.
- **NO** botón nuevo en el job-detail (Opción A; el rediseño es SCRUM-31).
- **NO** arreglar/verificar los CTAs "Ver justificante"/"Marcar como pagada" (SCRUM-35). Si al exponer `status` empiezan a renderizarse, se DEJA y se reporta — no se ajustan aquí.
- **NO** cambiar el copy de los presets ni el flujo de aceptación (`:766-770`).
- **NO** cambio de schema (todo es cálculo ya existente + exposición).

---

## 2. CÓMO (serializers — el único backend)

- Reutilizar EXACTAMENTE `resolveBillingPlan` + `distributeStageAmounts` de `billingPlan.ts` (SCRUM-27/32): nada de recalcular porcentajes o importes a mano en el serializer.
- `nextStage` por CONTEO (`invoices.length` / `emitted`), idéntico al de las rutas de cobro — si el conteo del serializer y el del endpoint divergieran, el label mentiría: usa la misma fuente.
- Importes a 2 decimales con el mismo helper/formato que ya usa el proyecto (coherente con `Invoice.total`).
- Cuidado con el coste: si el serializer del job no trae hoy las invoices con lo necesario para contar emitidos, amplía el `include` de forma mínima (solo lectura, aditivo).

---

## 3. CÓMO (frontend)

- `quotesDetailView.js`: la nueva lógica del botón debe ser una función clara de `nextStage` + `paymentTerms` (preset vs custom), no un tercer bloque de ifs encima de los existentes. Los presets deben pasar por el MISMO camino visible que hoy (mismo texto, misma habilitación) — usa el plan resuelto por debajo si simplifica, pero el resultado visible no cambia.
- Estados vacíos: quote sin decisión aceptada → el botón se comporta como hoy (el backend devuelve 409 si no está `accepted`; la UI no debe invitar a pulsarlo).
- `jobDetailView.js`: solo el ternario del label; ni la condición, ni el handler, ni el endpoint.
- No introducir estados, flags ni textos fuera de los definidos aquí y en el ticket (reglas 27/30). Los textos NUEVOS permitidos son EXACTAMENTE: "Generar siguiente tramo: {label} ({importe})" y "🪙 Cobrar siguiente tramo: {label} ({importe})", y el formato del plan "{label} {pct}% · …".

---

## 4. TESTS

- Serializer quote-detail: con plan custom 30/40/30 y 1 invoice emitida → `billingPlan` de 3 tramos con importes exactos (suman el total), `nextStage` = tramo índice 1, invoices con `stageLabel`/`status`. Con preset FIFTY_FIFTY → `billingPlan` de 2 tramos y `nextStage` coherente con el conteo. Con todos emitidos → `nextStage === null`.
- Serializer job-detail: `pendingStagesCount` y `nextStage` correctos con 0/1/2 invoices emitidas de un plan de 3.
- Si el proyecto no tiene arnés para testear serializers HTTP, tests unitarios de la función auxiliar que los calcule (extraerla pura si hace falta) — la invariante es: `nextStage` del serializer == tramo que emitiría el endpoint.

---

## 5. 🚨 STOP CONDITIONS (máster AA1.4) — OBLIGATORIO PARAR

- **ANTES de tocar nada, PARA y enséñale al fundador:** (a) el plan de archivos, (b) el diff EXACTO de los 2 serializers, (c) el diff EXACTO de `quotesDetailView.js` y `jobDetailView.js`, (d) confirmación explícita de que NO tocas rutas de creación de Invoice/Charge, `billingPlan.ts`, webhooks, cadena del Charge ni `totalCobrado`. **Espera OK explícito antes de aplicar.**
- Si para exponer el plan te ves obligado a tocar una ruta de cobro, la idempotencia o un webhook → **PARA**.
- Si te ves obligado a un cambio de schema → **PARA** (no debería haber NINGUNO).
- Hallazgos nuevos por el camino → repórtalos, NO los arregles (regla 9; irán a ticket aparte).

---

## 6. DEFINICIÓN DE HECHO (Gate — el E2E lo hace el fundador en yaqu.app)

- Con un plan **30/40/30**: los tramos 2 y 3 se generan y cobran desde el detalle del presupuesto **SIN marcar el trabajo Terminado**, con importes exactos (suman el total al céntimo, SCRUM-32) y `stageLabel` congelado.
- El detalle del presupuesto muestra el plan custom en "Condiciones de pago" (labels + %), nunca más "Sin condiciones específicas" habiendo plan.
- Los CTA dicen lo que hacen: quote-detail "Generar siguiente tramo: {label} ({importe})"; job-detail "Cobrar siguiente tramo: …" con 2+ pendientes y "Cobrar el resto (…)" solo con el último.
- **Sin regresión:** presets 50/50 y 100% con copy y comportamiento idénticos a hoy; cadena Invoice→Charge→webhook→`totalCobrado` intacta; `npm run build` y `npm test` en verde.
- PR abierto a `main` con la feature + el máster; merge del fundador; verificación E2E en yaqu.app.

---

## 7. AL TERMINAR — MÁSTER (commit SEPARADO, en la rama)

- Primero el commit de la **feature**.
- En **commit aparte** (solo AÑADIR, regla 16; no inventar, regla 27): anotar en la parte de PAGOS-FLEX/money flows que la generación del siguiente tramo tiene puerta de UI en el quote-detail (sin exigir Terminado, respaldada por `POST /admin/quotes/:id/invoice`), que los serializers de quote/job exponen el plan resuelto + `nextStage`, y los dos textos de CTA canónicos. Di qué líneas tocas.
- El máster "entra" al mergearse el PR (flujo nuevo): NO push directo.

---

## 8. JIRA (tienes el conector)

- Al abrir el PR, mover **SCRUM-34** a **"En revisión"** con comentario: diffs aplicados, tests añadidos y su salida, ENLACE del PR, y cambio de máster propuesto.
- **NO la cierres:** el E2E en yaqu.app lo verifica el fundador; "Finalizada" la mueve el asesor cuando el fundador confirme.

---

## 9. FORMATO DE ENTREGA (repórtale al fundador)

- Plan de archivos + los 4 diffs — **ANTES de aplicar (STOP de la sección 5)**.
- Tras el OK: archivos tocados y por qué, tests añadidos y su salida.
- Confirmación de no-regresión (presets intactos; cadena de cobro intacta; build + test verdes).
- Rama subida + PR abierto (enlace).
- Hallazgos/dudas para el fundador (sin arreglarlos).
