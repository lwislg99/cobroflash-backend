# TAREA ACTIVA — SCRUM-28 · Recalcular `totalCobrado` también en cobros manuales (Bizum/transferencia)

> Trabaja contra ESTE archivo + `docs/YAQU_MASTER.md`. NO dependas del chat.
> Regla base: UNA tarea → UN commit de feature (+ 1 commit aparte para el máster, PUSHEADO al cerrar).
> 🚨 ZONA DE DINERO (aunque es marcar-pagado manual). Lee la sección STOP antes de tocar.
> Es CORTA: reutiliza la función que ya creaste en SCRUM-13. NO crees lógica nueva de cálculo.

---

## 0. CONTEXTO (ya verificado en SCRUM-13)
- En SCRUM-13 creaste `recalcJobCobradoForCharge(chargeId)` en `job.service.ts` (suma desde cero, idempotente, fire-and-forget) y la enganchaste en `/webhooks/psp` y `/webhooks/mp`.
- **HUECO detectado:** el cobro manual (Bizum manual / transferencia confirmada por el pro) NO pasa por esos webhooks. Se marca vía `updateInvoiceStatusAdmin` (en `invoiceAdmin.ts`) que hace `invoice.update(status:'paid')` pero **NO toca el Charge NI pasa por /webhooks/psp**. Resultado: en cobros manuales, `Job.totalCobrado` NO se recalcula → el semáforo miente justo en el canal más común del ICP (Bizum/transferencia).

## 1. QUÉ HAY QUE HACER (alcance EXACTO — una sola cosa)
Enganchar el recálculo de `totalCobrado` en el punto donde un cobro se marca pagado **manualmente**, reutilizando la función de SCRUM-13.

## 2. CÓMO
- Localiza `updateInvoiceStatusAdmin` (en `invoiceAdmin.ts` o donde viva) — el punto donde una Invoice pasa a `paid` por acción manual del pro (Bizum/transferencia).
- **Reutiliza `recalcJobCobradoForCharge`** (la de SCRUM-13). Si el punto manual tiene el `chargeId` (o la Invoice tiene `chargeId`), llama al recálculo con ese charge. Si solo tienes la Invoice, obtén su `chargeId` y pásalo.
- **Mismo patrón que en los webhooks:** llamada AÑADIDA al final, **fire-and-forget con `.catch()`** (si el recálculo falla, se loguea pero NO rompe el marcar-pagado).
- **NO dupliques** la lógica de cálculo. Si necesitas una variante que reciba `invoiceId` en vez de `chargeId`, que internamente resuelva el `chargeId` y llame a la misma función — no reescribas la suma.
- Suma desde cero se mantiene → idempotente (marcar pagado dos veces no duplica).

## 3. 🚨 STOP CONDITIONS (AA1.4)
- **ANTES de modificar `invoiceAdmin.ts`, PARA y enséñame** el punto exacto de inserción y la línea que añades. Espera OK del fundador.
- NO toques la lógica de `updateInvoiceStatusAdmin` (cómo marca paid, permisos, audit). Solo AÑADES el recálculo al final.
- Si te obliga a un cambio de schema o a tocar la validación → PARA.

## 4. DEFINICIÓN DE HECHO (Gate)
- Marcar un cobro como pagado manualmente (Bizum/transferencia) recalcula `Job.totalCobrado`.
- Reutiliza la función de SCRUM-13 (sin duplicar cálculo).
- Idempotente (marcar pagado 2× no duplica).
- Sin regresión: `updateInvoiceStatusAdmin` sigue haciendo lo mismo (marcar paid, permisos, audit intactos).
- **Verificado en yaqu.app:** en un Job con plan 50/50, marcar el primer tramo como pagado por Bizum manual → `totalCobrado` sube a la mitad y el semáforo pasa a **Parcial**.
- Evidencia: diff, prueba de idempotencia, salida en yaqu.app.

## 5. AL TERMINAR — MÁSTER (commit SEPARADO, PUSHEADO)
- Commit de feature primero.
- Commit del máster aparte: anotar en JOB-1/Parte V que el recálculo de `totalCobrado` cubre también los cobros manuales (Bizum/transferencia). **Solo AÑADIR** (regla 16). **PUSHEAR** y confirmar "máster pusheado ✅" con el hash. NO dejarlo local.

## 6. JIRA
- Mueve **SCRUM-28** a "En revisión" con comentario (diff, idempotencia, verificación en yaqu.app, máster pusheado).

## 7. FORMATO DE ENTREGA (repórtame)
- Archivo tocado y la línea añadida.
- Cómo reutilizaste la función de SCRUM-13.
- Prueba de idempotencia + verificación en yaqu.app.
- Máster pusheado (hash).
- Dudas para el fundador.
