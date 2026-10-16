# TAREA ACTIVA — SCRUM-32 · Reparto EXACTO de tramos (el último absorbe el resto) — centralizado en `billingPlan.ts`

> Trabaja contra ESTE archivo + `docs/YAQU_MASTER.md` + el ticket Jira **SCRUM-32**. NO dependas del chat.
> Regla base: UNA tarea → UN commit de feature (+ 1 commit APARTE para el máster, pusheado). Verificar en **yaqu.app**, no en localhost.
> 🚨 ZONA DE DINERO — el importe de cada tramo se calcula en **3 call-sites** de cobro. Lee la **sección 5 (STOP)** ANTES de tocar nada. Enfoque elegido por el fundador = **Opción A (centralizar)**.

---

## 0. CONTEXTO REAL DEL REPO (ya verificado en reconocimiento — confírmalo, no lo re-descubras)

**El bug:** al cobrar un 50/50 con total de céntimo impar (p.ej. 151,25 €), cada tramo redondea su mitad por separado → 75,63 + 75,63 = **151,26** (1 cént. de más). Ningún tramo "absorbe el resto".

**El motor (`billingPlan.ts`) solo tiene porcentajes, NO importes:**
- `getBillingPlan` (`billingPlan.ts:50-85`): `FULL_UPFRONT → [{index:0, percentage:1}]`; `FIFTY_FIFTY → [{index:0,percentage:0.5},{index:1,percentage:0.5}]`; `MANUAL`/`SIN_CONDICIONES`/default → `[]`.
- `getNextBillingStage` (`billingPlan.ts:99-110`): devuelve `plan[existingInvoicesCount]` (o `null` si `count >= plan.length`). **Selección por CONTEO, no por importes.**
- `BillingStage` (`billingPlan.ts:22-29`): `{index, percentage, label}` — **sin importe**. El euro se calcula fuera.

**El cálculo del importe está DUPLICADO en 3 call-sites, cada uno independiente y en float:**
- `quotes.routes.ts:506` — `const invoiceAmount = totalNumber * percentage;` (1er tramo al ACEPTAR: `POST /quote/:id/decision`).
- `quotesAdmin.routes.ts:156` — `const invoiceAmount = totalNumber * percentage;` (generar factura BO: `POST /admin/quotes/:id/invoice`).
- `jobs.routes.ts:269` — `const amount = Number(quote.total) * stage.percentage;` (cobrar el resto: `POST /admin/jobs/:id/collect-rest`). Este usa `getBillingPlan` directo + `plan[emitted]` (`jobs.routes.ts:263-268`), NO `getNextBillingStage`.

**Aritmética:** float/`Number`, no el `Decimal` del proyecto: `Number(total) * percentage` y luego `.toFixed(2)` (string). Líneas `quotes.routes.ts:505-506`, `quotesAdmin.routes.ts:155-156`, `jobs.routes.ts:269`.

**Materialización:** `Invoice.total` se fija en cada call-site con `.toFixed(2)` (`quotes.routes.ts:524`, `quotesAdmin.routes.ts:174`, `jobs.routes.ts:284`). El `Charge` nace en `sendInvoicePaymentRequest` (`invoiceWhatsApp.service.ts:51-65`) con `amount: Number(invoice.total)` (`:59`) → `charges.routes.ts:39-44` `prisma.charge.create({... amount: body.amount.toFixed(2)})`. **El Charge COPIA `Invoice.total`.** → el fix va AGUAS ARRIBA, en el importe del tramo (`Invoice.total`), NO en el Charge.

**"Cuánto se ha facturado ya":** solo CONTEO, no suma. `existingInvoices.length` / `emitted = quote.Invoice.length` (`quotes.routes.ts:491/500`, `quotesAdmin.routes.ts:147/149`, `jobs.routes.ts:264`; el `include` en `jobs.routes.ts:259` trae solo `{id:true}`, ni el total). La suma de lo ya facturado **NO se calcula en ningún sitio**.

**Tests:** CERO sobre `billingPlan`/`getNextBillingStage`/reparto (`grep` en `tests/` → 0 archivos). Cobertura cero → **no hay tests que romper**; hay que AÑADIRLOS.

---

## 1. QUÉ HAY QUE HACER (alcance EXACTO — Opción A: centralizar)

1. **Nueva función de reparto en `billingPlan.ts`** (pura, testeable) que, dado el **total** + el **plan** (los porcentajes que ya devuelve `getBillingPlan`), devuelva el **importe EXACTO por tramo**, con esta invariante:
   - Cálculo en **CÉNTIMOS ENTEROS** (no float).
   - Para los tramos 0..n-2: `cents[i] = round(totalCents * percentage[i])`.
   - **El ÚLTIMO tramo = `totalCents − suma(cents[0..n-2])`** (absorbe el redondeo).
   - Resultado: la suma de los tramos == el total, **EXACTA**, siempre (par e impar).
   - Determinista **por índice de tramo** (NO requiere traer de BD la suma de Invoices).
2. **Enrutar los 3 call-sites** (`quotes.routes.ts:506`, `quotesAdmin.routes.ts:156`, `jobs.routes.ts:269`) para que el importe del tramo salga de esa función, indexando por el índice del tramo actual — en vez de `total × pct` a mano. Un solo cálculo, mata el bug en los 3 a la vez y elimina la triplicación.
3. **Tests** del reparto (nuevo archivo o junto a los de utils): casos par e impar, p.ej. `total=100,01` FIFTY_FIFTY → `[50,01 , 50,00]` o `[50,00 , 50,01]` que sumen **EXACTO 100,01**; `total=151,25` FIFTY_FIFTY → suma exacta 151,25; FULL_UPFRONT → un tramo == total; MANUAL/[] → sin tramos.

**NO INCLUYE (no construir):**
- **NO** cambiar la selección por CONTEO de `getNextBillingStage` ni los porcentajes de `getBillingPlan`. Solo se AÑADE la función de reparto y se enruta el cálculo del euro por ella.
- **NO** tocar el `Charge` (sigue copiando `Invoice.total`; el fix es aguas arriba).
- **NO** tocar webhooks, ni la idempotencia, ni la materialización de `totalCobrado` (SCRUM-13/28).
- **NO** planes personalizados (eso es SCRUM-27, va justo después y se apoyará en esta función).
- **NO** cambio de schema (es cálculo, no datos nuevos).

---

## 2. CÓMO (la función de reparto — el núcleo)

- Añadir en `billingPlan.ts` una función pura, p.ej. `distributeStageAmounts(total, plan)` que devuelva los importes por tramo alineados a los índices del plan, o `getStageAmount(total, paymentTerms, stageIndex)` que internamente construya el plan y devuelva el importe de ese índice. **Propón tú la firma**; lo que NO es negociable es la invariante de la sección 1 (céntimos enteros + último = resto + suma exacta + determinista por índice).
- `totalCents = Math.round(Number(total) * 100)` (entero). Reparte en enteros; el último tramo = `totalCents − suma(anteriores)`. Devuelve el importe en euros a 2 decimales (usa el `Decimal`/helper del proyecto para formatear `Invoice.total`, coherente con lo que ya se guarda).
- Casos límite: FULL_UPFRONT `[1.0]` → el único tramo es el último → `totalCents` exacto. MANUAL `[]` → sin tramos (los call-sites lo tratan como hoy).
- **Aritmética entera**, nada de acumular floats.

---

## 3. CÓMO (enrutar los 3 call-sites)

- Los tres ya tienen a mano el `total` del Quote y el plan (vía `getBillingPlan(paymentTerms)`), más el índice del tramo actual (`stage.index` en los que usan `getNextBillingStage`; `emitted`/`plan[emitted].index` en collect-rest). Sustituir el `total × pct` a mano por el importe que devuelva la función de reparto **para ese índice**.
- `quotes.routes.ts:505-506` (aceptar), `quotesAdmin.routes.ts:155-156` (BO), `jobs.routes.ts:269` (collect-rest): mismo cambio en los tres — el importe del tramo sale de la función centralizada.
- **NO cambiar** lo que rodea (cómo se crea el Invoice, el `.toFixed(2)` del guardado, el envío de payment_request, la cadena del Charge). Solo cambia de dónde sale el número del importe.
- Verifica que `Invoice.total` sigue guardándose con el mismo formato/tipo que hoy (Decimal 2dp) para no romper la copia que hace el Charge (`invoiceWhatsApp.service.ts:59` → `charges.routes.ts:39-44`).

---

## 4. CÓMO (tests)

- Añadir tests de la función de reparto (no hay ninguno hoy). Mínimo:
  - `total=100,01` FIFTY_FIFTY → dos tramos que suman EXACTO 100,01 (uno 50,01 y otro 50,00).
  - `total=151,25` FIFTY_FIFTY → suma exacta 151,25 (75,63 + 75,62).
  - `total=100,00` FIFTY_FIFTY → 50,00 + 50,00.
  - FULL_UPFRONT → un tramo == total.
  - MANUAL/[] → sin tramos.
- Aserción clave en todos: **suma de tramos == total, exacta** (comparar en céntimos enteros, no en float).

---

## 5. 🚨 STOP CONDITIONS (máster AA1.4) — OBLIGATORIO PARAR

- **ANTES de tocar `billingPlan.ts` o cualquiera de los 3 call-sites, PARA y enséñame:** (a) la nueva función de reparto (código completo), (b) el diff EXACTO de cada uno de los 3 call-sites, (c) confirmación de que NO cambias la selección por conteo, ni la cadena del Charge, ni webhooks, ni la materialización de `totalCobrado`. **Espera OK explícito del fundador antes de aplicar.**
- Si el reparto te obliga a tocar la idempotencia, la cadena de pago o un webhook → **PARA**.
- Si te obliga a un cambio de schema no aditivo → **PARA**.
- **NO tocar** `charges.routes.ts` ni `invoiceWhatsApp.service.ts` salvo para LEER cómo copian el importe.

---

## 6. DEFINICIÓN DE HECHO (Gate)

- Función de reparto en `billingPlan.ts`, en céntimos enteros, con el ÚLTIMO tramo = total − suma anteriores; suma de tramos == total EXACTA (par e impar).
- Los 3 call-sites (`quotes`/`quotesAdmin`/`jobs`) calculan el importe del tramo con esa función; nada de `total × pct` a mano.
- Tests del reparto en verde (incluido el caso de céntimo impar).
- **Sin regresión:** FULL_UPFRONT y MANUAL se comportan igual que antes; la cadena de cobro (Invoice→Charge→webhook→`totalCobrado` de SCRUM-13/28) intacta; `npm run build` y `npm test` en verde.
- **Verificado E2E en yaqu.app** (no localhost): aceptar un presupuesto **50/50 con total de céntimo impar** (p.ej. 151,25 €) → cobrar tramo 1 → cobrar el resto → la cabecera del detalle del Trabajo muestra **Cobrado 151,25 € de 151,25 €** (100%, Pagado), **sin el céntimo de más**.
- Evidencia: la función, el diff de los 3 call-sites, los tests, y la salida E2E en yaqu.app.

---

## 7. AL TERMINAR — MÁSTER (commit SEPARADO)

- Primero el commit de la **feature**.
- En **commit aparte** (solo AÑADIR, regla 16; no inventar, regla 27): en la Parte de money flows / billingPlan del máster, anotar que el reparto de tramos se centraliza en `billingPlan.ts` con la regla **"el último tramo absorbe el resto (céntimos enteros)"**, usada por los 3 call-sites, y que es la base para planes personalizados (SCRUM-27). Di qué líneas tocas y confirma el **hash** del push.

---

## 8. JIRA (tienes el conector)

- Al terminar, mover **SCRUM-32** a **"En revisión"** con comentario: la función de reparto, el diff de los 3 call-sites, los tests añadidos, y el resultado E2E en yaqu.app (el 151,25 cuadrando exacto). Cambio de máster propuesto (hash).
- **NO la cierres:** el E2E lo verifica el fundador en yaqu.app.

---

## 9. FORMATO DE ENTREGA (repórtame)

- Archivos tocados y por qué.
- La función de reparto (código) + el diff EXACTO de los 3 call-sites — **ANTES de aplicar (STOP)**.
- Los tests añadidos y su salida.
- Confirmación de no-regresión (FULL_UPFRONT/MANUAL igual; cadena de cobro intacta; build + test verdes).
- Salida E2E en yaqu.app (el 50/50 de céntimo impar cuadrando exacto).
- Cambio de máster propuesto (líneas + hash).
- Dudas/decisiones para el fundador.
