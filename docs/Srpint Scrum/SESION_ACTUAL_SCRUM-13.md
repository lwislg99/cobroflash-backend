# TAREA ACTIVA — SCRUM-13 · Materializar `Job.totalCobrado` + semáforo de cobro

> Trabaja contra ESTE archivo + `docs/YAQU_MASTER.md`. NO dependas del chat.
> Regla base: UNA tarea → UN commit de feature (+ 1 commit aparte para el máster). Verificar en yaqu.app, no en localhost.
> 🚨 ZONA DE DINERO Y WEBHOOKS DE PAGO. Es lo más sensible del sistema. Lee la sección 5 (STOP) ANTES de tocar nada.

---

## 0. CONTEXTO REAL DEL REPO (ya verificado — confírmalo, no lo re-descubras)
- **El motor de tramos YA EXISTE** en `billingPlan.ts` (`getBillingPlan`/`getNextBillingStage`): FULL_UPFRONT [100%], FIFTY_FIFTY [50%,50%], MANUAL []. El plan se deriva de `Quote.paymentTerms`. El progreso se infiere del nº de `Invoice` ligadas al Quote. **NO lo toques, NO lo dupliques.**
- **Cada tramo YA se materializa** como 1 `Invoice` + 1 `Charge`. El método lo elige el cliente al pagar (card/bizum/transfer). Eso YA funciona.
- `Charge` (schema ~158-189): `amount Decimal(12,2)`, `status` (pending|paid|failed|expired), `method`, `payMethods`. Relación: `Quote.chargeId → Charge` y `Invoice.chargeId → Charge`.
- **Charge pasa a `paid` en DOS webhooks:**
  - `/webhooks/psp` (`psp.routes.ts`, guardado por `requireInternalSecret`) — Stripe/transfer. Este handler ya hace: `charge.update(paid)` + `reconciliation matched` + `ensureInvoiceForCharge` + marca `Invoice paid/paidAt` + confirmación al cliente por WhatsApp + reseña Google + aviso al merchant. Idempotente: si ya está `paid` → registra `duplicate`, no re-paga.
  - `/webhooks/mp` (`mpWebhook.routes.ts`) — Mercado Pago. Mapea `approved→paid`.
- **HOY NO existe** ninguna suma de "cobrado por Job". Solo `Job.remaining` (= lo que falta por FACTURAR, en `serializeJob`) y el "cobrado este mes" global en `metrics.service.ts` (`invoice.aggregate _sum total where status=paid`). `Job.totalCobrado` (columna creada en SCRUM-10) existe pero **siempre vale 0** — su lógica es ESTA tarea.

## 1. QUÉ HAY QUE HACER (alcance EXACTO — solo 2 cosas)
1. **Materializar `Job.totalCobrado`**: una función que calcula, para un Job, la SUMA de los importes de los `Charge` en estado `paid` asociados a su Quote (vía las Invoices/Charges del Quote del Job). Y llamarla para **recalcular y guardar** `Job.totalCobrado` cada vez que un Charge pasa a `paid`, en **AMBOS webhooks**.
2. **Semáforo de cobro**: en `serializeJob`, derivar un estado `Pagado | Parcial | Pendiente` comparando `totalCobrado` vs `totalAceptado`:
   - `totalCobrado <= 0` → **Pendiente**
   - `0 < totalCobrado < totalAceptado` → **Parcial**
   - `totalCobrado >= totalAceptado` (con `totalAceptado > 0`) → **Pagado**
   - Exponerlo en el JSON de `serializeJob` para que SCRUM-11 (lista) lo pinte. Aquí NO se construye UI.

## 2. CÓMO (la función de cálculo)
- Crear una función tipo `recalcJobCobrado(jobId)` (o `recalcCobradoForQuote(quoteId)`) en el dominio de jobs (`modules/jobs/domain/job.service.ts` o similar).
- **CLAVE — SUMA DESDE CERO, no incremento:** la función debe SUMAR todos los Charges `paid` del Job cada vez (SELECT + sum), y hacer `Job.update({ totalCobrado: suma })`. NUNCA `totalCobrado += amount`. Motivo: así es **naturalmente idempotente** — si el webhook se dispara dos veces por el mismo pago, el resultado es el mismo (no se duplica).
- Encontrar los Charges del Job: Job → `quoteId` → Charges del Quote (directo `Quote.chargeId` + los de las Invoices del Quote `Invoice.chargeId`). Confirma en el código la relación exacta Quote↔Charge↔Invoice antes de sumar, para no dejarte tramos fuera.
- Importe en `Decimal(12,2)` (usa la aritmética Decimal del proyecto, no float).

## 3. CÓMO (enganche en los webhooks) — LA PARTE DELICADA
- En `/webhooks/psp` (`psp.routes.ts`): localiza el punto donde un Charge queda confirmado `paid` (después de toda la cadena existente). **AÑADE al final** una llamada a `recalcJobCobrado` para el Job de ese Charge (si el Charge pertenece a un Quote que tiene Job). 
- En `/webhooks/mp` (`mpWebhook.routes.ts`): lo mismo, en el punto donde mapea `approved→paid`.
- **REGLA DURA: solo AÑADIR un paso al final. NO modificar, reordenar ni tocar** la cadena existente (Invoice paid, conciliación, WhatsApp, reseña, aviso al merchant). Si el recálculo falla, que NO rompa la confirmación del pago (envuélvelo de forma que un error en el recálculo se loguee pero no tire la respuesta del webhook — el pago es lo primero).
- Respeta la idempotencia existente: si el webhook detecta `duplicate` y hace short-circuit ANTES de tu paso, da igual porque el recálculo es suma-desde-cero; pero colócalo de forma coherente con el flujo actual.

## 4. CÓMO (lectura/semáforo)
- `serializeJob`: añade el campo de estado de cobro derivado (Pagado/Parcial/Pendiente) + expón `totalCobrado` y `totalAceptado` ya presentes.
- **Verifica que NO rompes** `jobsView.js`, `metrics.service.ts` ni `reports.routes.ts`. El "cobrado este mes" global de métricas NO se toca (es otra cosa, a nivel merchant/mes).

## 5. 🚨 STOP CONDITIONS (AA1.4) — OBLIGATORIO PARAR
- **ANTES de modificar `psp.routes.ts` o `mpWebhook.routes.ts`, PARA y enséñame:** (a) el punto exacto donde vas a insertar el recálculo, (b) el código que vas a añadir, (c) confirmación de que NO tocas nada de la cadena existente. **Espera OK explícito del fundador antes de aplicar.**
- Si te ves obligado a cambiar la lógica de validación de firma, la idempotencia, o cualquier cosa de la cadena de pago → PARA.
- Si el cálculo del "cobrado" te obliga a un cambio de schema no aditivo → PARA.

## 6. DEFINICIÓN DE HECHO (Gate)
- `recalcJobCobrado` implementada como suma-desde-cero de Charges `paid` del Job.
- Enganchada en `/webhooks/psp` y `/webhooks/mp` como paso AÑADIDO al final, sin tocar la cadena existente.
- `serializeJob` devuelve el semáforo Pagado/Parcial/Pendiente correcto.
- **Idempotencia probada:** simular/forzar el webhook dos veces con el mismo pago → `totalCobrado` NO se duplica.
- **Sin regresión:** la cadena del webhook sigue intacta (Invoice paid, WhatsApp, reseña, aviso). jobsView/metrics/reports OK.
- **Verificado E2E en yaqu.app** (no localhost): aceptar un presupuesto 50/50 → pagar el primer tramo (tarjeta test o método real de prueba) → `Job.totalCobrado` pasa a la mitad y el semáforo a **Parcial**. Pagar el segundo → **Pagado**.
- Evidencia: el diff de los webhooks, la prueba de idempotencia, y la salida E2E en yaqu.app.

## 7. AL TERMINAR — MÁSTER (commit SEPARADO)
- Primero el commit de la feature.
- En un commit aparte, propón la actualización MÍNIMA del máster: en JOB-1 / Parte V (money flows), anotar que `totalCobrado` se materializa en los webhooks y el semáforo derivado. **Solo AÑADIR** (regla 16). Di qué líneas. No inventes (regla 27).
- Verifica también la nota V2 del máster (línea ~555, "[VERIFICAR comportamiento]"): ya confirmamos que el 2º tramo NUNCA se cobra solo. Si procede, márcalo como verificado.

## 8. JIRA (tienes el conector)
- Al terminar, mueve **SCRUM-13** a "En revisión" con comentario: archivos tocados, diff de los webhooks, prueba de idempotencia, resultado E2E, cambio de máster propuesto.

## 9. FORMATO DE ENTREGA (repórtame)
- Archivos tocados y por qué.
- El código exacto añadido a cada webhook (para revisión).
- Cómo garantizaste la idempotencia + la prueba.
- Confirmación de no-regresión (cadena de pago intacta).
- Salida E2E en yaqu.app.
- Cambio de máster propuesto.
- Dudas/decisiones para el fundador.
