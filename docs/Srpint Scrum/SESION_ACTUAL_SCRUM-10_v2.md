# TAREA ACTIVA — SCRUM-10 · Extender el `Job` existente a contenedor "Trabajo"

> Trabaja contra ESTE archivo + `docs/YAQU_MASTER.md`. NO dependas del chat.
> Regla base: UNA tarea → UN commit de feature (+ 1 commit aparte para el máster). Verificar en yaqu.app, no en localhost.
> ⚠️ El modelo `Job` YA EXISTE. Esta tarea lo EXTIENDE. NO lo recrees, NO lo dupliques.

---

## 0. CONTEXTO REAL DEL REPO (ya verificado — no lo re-descubras, confírmalo)
- `Job` existe (schema ~líneas 543-558). Campos actuales: `id, merchantId, customerId, quoteId (@unique), status (FSM pendiente_agendar→agendado→en_curso→terminado→cerrado), scheduledAt?, assignedUserId?, notes?, createdAt, updatedAt`. Índices por `merchantId,status` y `merchantId,scheduledAt`.
- Auto-creación de Job en los **3 accepts**: `quotes.routes.ts`, `quotesAdmin.routes.ts`, `quoteDecisionLanding.routes.ts` (vía `ensureJobForQuote`).
- Lo monetario hoy se deriva del Quote **al leer** en `serializeJob` (no se guarda nada en Job). `remaining` = lo que falta por FACTURAR (no por cobrar).
- Usos de Job a NO romper: `modules/jobs/app/routes/jobs.routes.ts`, `modules/jobs/domain/job.service.ts` (`canTransition`, `ensureJobForQuote`), `metrics.service.ts`, `reports.routes.ts`, y UI `public/dashboard/js/jobsView.js`.

## 1. QUÉ HAY QUE HACER (alcance EXACTO)
Añadir a `Job` los campos que le faltan para ser el contenedor "Trabajo":
- **`titulo`** (String) — hoy se compone al vuelo; darle campo propio. Al crear el Job, rellenar con el mismo criterio actual (nº presupuesto + cliente) como valor inicial.
- **`direccion`** (String?, opcional) — HOY NO EXISTE dónde guardar la dirección de la obra. Añadir el campo. Poblarlo si el Quote/Customer tiene dirección disponible; si no, dejar null.
- **`totalAceptado`** (entero en céntimos, como el resto de importes del sistema) — congelar el total del Quote **en el momento del accept**, para no depender siempre de leer el Quote.
- **`totalCobrado`** (entero en céntimos, default 0) — **crear SOLO la columna, materializada, inicializada a 0. NO calcular nada aún.** La lógica de sumar los `Charge` en estado `paid` y recalcular en el webhook de pago es de **SCRUM-13 (COBROS-1)**, NO de esta tarea.

**Decisión de arquitectura ya tomada por el fundador:** `totalCobrado` se **materializa** (columna que se mantendrá al día en el webhook, en SCRUM-13), no se calcula al vuelo. Aquí solo se crea el campo.

**NO incluye (no lo construyas):** sumar cobros / semáforo Pagado-Parcial-Pendiente (→ SCRUM-13), UI de lista o detalle (→ SCRUM-11/12), `operarioId` (usa el `assignedUserId` que ya existe), albaranes, facturas, SEPA.

## 2. CÓMO (datos)
- **Prisma ADITIVO** (regla 3): edita el modelo `Job`, `db push` con **preview del diff ANTES de aplicar**. Solo AÑADIR columnas. NUNCA `migrate dev`, NUNCA borrar/renombrar columnas existentes.
- Importes en la MISMA unidad que el resto del sistema (mira cómo guarda importes `Charge`/`Quote` — probablemente céntimos enteros — y sé consistente).
- `totalCobrado` default 0 no-null.

## 3. CÓMO (poblar en el accept)
- En los 3 puntos de accept (o mejor, dentro de `ensureJobForQuote` si es el sitio común), al crear el Job:
  - `titulo` = criterio actual de título.
  - `direccion` = dirección del Quote/Customer si existe, si no null.
  - `totalAceptado` = total del Quote en ese momento.
  - `totalCobrado` = 0.
- Idempotencia: respeta la que ya haya (Job es `@unique` por quoteId; no crear duplicados).

## 4. CÓMO (lectura)
- `serializeJob`: que devuelva los 4 campos nuevos.
- **Verifica que NO rompes** `jobsView.js`, `metrics.service.ts` ni `reports.routes.ts`. Si alguno asumía que el título/importe venía derivado, ajústalo para usar el campo nuevo sin cambiar el comportamiento visible.

## 5. STOP CONDITIONS (AA1.4) — PARA Y PREGUNTA
- **NO toques `Charge`, pagos, webhooks de pago ni facturas en esta tarea.** Eso es SCRUM-13. Si te ves arrastrado ahí, PARA y avisa al fundador.
- Si necesitaras un cambio de schema NO aditivo o tocar un flag global → PARA y pide OK.

## 6. DEFINICIÓN DE HECHO (Gate)
- Columnas `titulo, direccion, totalAceptado, totalCobrado` añadidas a `Job` (aditivo; preview del diff mostrado).
- Al **aceptar un presupuesto en yaqu.app** (NO localhost): el Job se crea/actualiza con `titulo`, `direccion` (si hay), `totalAceptado` correcto; `totalCobrado` = 0.
- `serializeJob` devuelve los nuevos campos.
- `jobsView.js`, métricas y reports **siguen funcionando igual** (sin regresiones visibles).
- Test de tenancy sigue verde.
- Evidencia: diff de Prisma, salida del accept en yaqu.app mostrando los campos, y confirmación de que las vistas actuales no se rompen.

## 7. AL TERMINAR — MÁSTER (commit SEPARADO)
- Primero el commit de la feature.
- En un commit aparte, propón la actualización MÍNIMA del máster: en el inventario/Parte donde se describe JOB-1, anotar los campos nuevos del contenedor Trabajo. **Solo AÑADIR, nunca borrar** (regla 16). Di qué líneas cambias. No inventes nada (regla 27); si dudas, déjalo propuesto para el fundador.

## 8. JIRA (tienes el conector)
- Al terminar, mueve el ticket **SCRUM-10** a "En revisión" y añade un comentario con: archivos tocados, diff de Prisma aplicado, resultado del test, y el cambio de máster propuesto.

## 9. FORMATO DE ENTREGA (repórtame)
- Archivos tocados y por qué.
- Diff de Prisma (preview) aplicado.
- Confirmación de no-regresión en jobsView/metrics/reports.
- Cambio de máster propuesto (commit aparte).
- Dudas/decisiones pendientes para el fundador.
