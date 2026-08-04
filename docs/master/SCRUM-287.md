# SCRUM-287 · A0.1 — ¿puede existir una factura sin trabajo y sin presupuesto? (informe)

**Fecha:** 5-ago-2026 · **Carril:** B (QA/medición) · **Gate:** sin gate

**Medido contra:** `origin/main` = `193f9a4d2f46c0b7c15e55784408f6bf3da28976` · 2026-08-05T00:21:08+01:00

> ⚠️ Informe: **no construye código, no toca `schema.prisma`, no abre tickets** (regla 38). Lo único
> que se commitea es el diseño verbatim. Re-medido contra el árbol de HOY, no repetido por fe.

## PASO PREVIO (hecho): el diseño en el repo
- `docs/diseno/bloque-a.md` ← descripción ÍNTEGRA de la epic **SCRUM-276**, copiada VERBATIM (no la
  resumí, no la reordené; copié la DESCRIPCIÓN, no los comentarios). Con cabecera de origen+fecha.
- `docs/diseno/bloque-b.md` ← descripción ÍNTEGRA de la epic **SCRUM-277**, igual.
- **Nada del texto me pareció mal al copiarlo** — no había que reportar ninguna corrección.

**SUELO:** `quoteId` aparece en **32** ficheros de `src/` → la derivación LEE; el control positivo
(encontré los sitios conocidos que leen el quote: `invoiceWhatsApp`, `invoice.routes`, el detalle de
`invoicesAdmin`) confirma que un cero sería «no hay», no «no supe mirar».

---

## 1 · ¿`Invoice` exige `jobId` o `quoteId`? — NO, ni en el esquema ni de hecho
- **Esquema** (`prisma/schema.prisma:339-362`): **`Invoice` NO tiene `jobId`**. Sus enlaces al ciclo
  son **`quoteId Int?`** (`:343`), **`chargeId Int?`** (`:344`) y **`albaranRefs Json?`** (`:362`),
  **todos opcionales**. Obligatorios: `merchantId` (`:341`), `customerId` (`:342`) y los escalares
  `number/total/currency/pdfUrl/qrData`.
- **De hecho:** el emisor compartido `emitInvoice` (`invoicing.service.ts:49`) crea con
  `quoteId: input.quoteId ?? null` — **acepta null**. No hay ningún punto que reviente por falta de
  `quoteId` (ver Q2). → **Ni el esquema ni el código exigen job/quote.** Una factura con `merchantId`
  + `customerId` (+ líneas) es representable y emitible.

## 2 · Sitios que van de una factura a su trabajo/presupuesto y asumen que existe — derivado, clasificado
**No hay navegación invoice→job:** `Invoice` no tiene `jobId`. La única navegación es
`invoice.quoteId → quote` (y, indirecta, `quote → job`). Derivado del árbol (uso real de
`invoice.quote`/`.quoteId`), clasificado por qué pasa con una factura suelta (`quoteId=null`):

- **El árbol YA tolera `quote` null**, porque `Invoice.quoteId` **siempre** fue nullable — el código
  se escribió guardando ese null. Por eso **NO se ha encontrado ni un (a) que reviente ruidosamente**:
  - Detalle de factura (`invoicesAdmin.routes.ts:143` `const quote = invoice.quote as any`): todos
    los accesos van guardados — `:182` `quote ? money(quote.total, quote.currency) : '—'`, `:186`
    `quote?.signatureUrl ? …`, `:160` `quote?.evidence ?? {}`. Con `quote=null` renderiza «Presupuesto:
    —» y «Firma: —», que es **correcto** para una suelta. **No revienta.** ⚠️ **Latente:** el
    `as any` (`:143`) DESACTIVA la null-safety del compilador — un `quote.X` sin guardia que alguien
    añada mañana reventaría con una suelta y `tsc` **no lo cazaría**. Hoy no lo hay; es riesgo futuro.
  - `invoiceWhatsApp.service.ts:48-50`: `invoice.quoteId ? (payMethods del quote) : (default)` →
    guardado; con suelta usa métodos de cobro por defecto, que es **correcto** (no hay quote de donde
    sacarlos). No revienta.
  - R1 (`invoicesAdmin:741` `quoteId: original.quoteId`), exports (`:703`/`:328` con `?.`/`?? ''`),
    `job.service.ts:108` (`job?.quoteId ? [..] : []`): todos null-safe.
- **El único (b) candidato, y su clasificación NO es evidente — lo declaro en vez de elegir:**
  `invoice.routes.ts:119-137` (respuesta a n8n/WhatsApp tras cobro): `const quote = updated.quote` →
  `merchant = quote?.merchant`, `customer = quote?.customer`, `quote: quote ? {…}`. Con `quote=null`
  **no revienta** (todo `?.`), pero la respuesta sale **sin `merchant` ni `customer`**. Si el
  consumidor n8n/WhatsApp usa esos campos, es un **(b) silencioso** (mensaje incompleto que parece
  bien); si no los usa, es inocuo. **Depende del consumidor de esa respuesta, que no está en este
  árbol** → no lo fuerzo a (a) ni (b): lo dejo señalado como (b)-posible.
- **Resultado:** en el camino de LECTURA, una factura suelta es **bajo riesgo** — el null de quote ya
  está guardado en todas partes; 0 (a) ruidosos; 1 (b)-posible declarado (`invoice.routes:119`); 1
  riesgo latente de tipos (`as any`, `invoicesAdmin:143`).
- **Límite de la derivación (declarado):** deriva del USO real de `invoice.quote`/`.quoteId` en el
  árbol; no es un AST completo que resuelva todos los flujos de datos invoice→quote. Un consumidor
  que reciba el `Invoice` ya serializado sin quote y lo asuma, no lo vería este método.

## 3 · Caminos de creación de facturas HOY (por contenido) — 7, todos nacen de un documento
1. `src/lib/invoicing.ts:322` — `ensureInvoiceForCharge` (C6): desde un **Charge** (webhooks PSP).
2. `src/modules/invoicing/domain/invoicing.service.ts:45` — `emitInvoice` (C7): emisor compartido, **sin job, `quoteId` opcional**.
3. `src/modules/jobs/app/routes/jobs.routes.ts:596` — collect-rest (C2): desde un **Job** (exige `job.quoteId`).
4. `src/modules/quotes/app/routes/quotes.routes.ts:585` — (C1): desde un **Quote** (cliente acepta por WhatsApp).
5. `src/modules/system/app/routes/invoicesAdmin.routes.ts:737` — R1 (C5): desde una **factura existente**.
6. `src/modules/system/app/routes/quotesAdmin.routes.ts:203` — `/:id/invoice` (C3): desde un **Quote**.
7. `src/modules/system/app/routes/quotesAdmin.routes.ts:406` — `/:id/invoice-manual`: desde un **Quote**.
- **Los 7 nacen de un documento existente y resuelven `customerId` DE ese documento** (medido en
  SCRUM-276). **Ninguno crea en frío.** Una factura suelta necesita un entrypoint NUEVO que use
  `emitInvoice` con el customer resuelto SIN documento (un selector de cliente).

## 4 · Coste de la factura suelta — (i) SOLO CÓDIGO
- El esquema **no** lo impide (`Invoice` sin enlace obligatorio) y `emitInvoice` ya acepta
  `merchant+customer+total+currency`, `quoteId=null`. El camino de LECTURA ya tolera el quote null
  (Q2). → **(i) solo código**: una ruta/formulario «Nueva factura» que use `emitInvoice`. **Ni (ii)
  campo nullable, ni (iii) migración.** (Caveat: vigilar el `as any` de `invoicesAdmin:143` para que
  no se cuele un `quote.X` sin guardia — es tipos, no esquema.)

## 5 · ¿Consumidor vs empresa? — YA CONTESTADO en SCRUM-327 (Q19), copiado
- **El CLIENTE FINAL del pro SÍ se clasifica `PARTICULAR | EMPRESARIO`** (`schema.prisma:157-161`,
  `resolveTipoDestinatario`; `null` = «nunca clasificado» → tratado como PARTICULAR).
- **El COMPRADOR de YaQu (el merchant) NO** — no hay campo consumidor/empresa; `plan='empresa'`
  (`schema:67`) es un **tramo de plan**, no un tipo de comprador. YaQu es B2B por naturaleza.
- Relevancia para A0: el régimen legal de las líneas de obra (B2B art. 1593 CC vs B2C consumo, ver
  `bloque-a.md`) es del **cliente final** del pro — que SÍ se clasifica; el comprador de YaQu no.

## La trampa que el ticket marca — medida HOY, no repetida
SCRUM-257 cerró la puerta al trabajo manual: el único creador de `Job` es `ensureJobForQuote`
(`src/modules/jobs/domain/job.service.ts:38`), que **siempre** fija `quoteId: quote.id` (`:63`).
**Confirmado en main de hoy.** → No hay `Job` sin quote; pero como `Invoice` no exige `jobId`, la
factura suelta **no pasa por Job** (usa `emitInvoice` directo). La trampa no la bloquea.

## Síntesis
Una factura sin trabajo y sin presupuesto **sí puede existir**: el esquema no la impide (`Invoice` sin
`jobId`, `quoteId`/`chargeId` opcionales), el emisor ya la soporta, y el camino de lectura ya tolera
el quote null (0 crashes ruidosos). Falta solo el **entrypoint** (regla 30 para su copy) — **(i)
código**. Riesgos declarados: 1 (b)-posible en `invoice.routes:119` (depende del consumidor n8n), y 1
latente de tipos (`as any` en `invoicesAdmin:143`).
