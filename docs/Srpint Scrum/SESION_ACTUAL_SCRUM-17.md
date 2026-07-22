# TAREA ACTIVA — SCRUM-17 · FISCAL-2: factura recapitulativa con motor de rotura por mes natural

> Gobierna: `docs/YAQU_MASTER.md` + ticket **SCRUM-17** (y sus DOS comentarios: recon 16-jul y actualización de diseño 17-jul) + `docs/legal/INVESTIGACION_ALBARANES.md` (§4.3 y §4.3.1) + este brief.
> Flujo: `git checkout main && git pull` → rama `scrum-17-recapitulativa` → PR (lo crea Luis, NO uses `gh`) → merge → suite QA.
> 🚨 ZONA SENSIBLE: **fiscal** (emisión de facturas) + **schema** + toca `jobDetailView.js`. Todo LATENTE tras el flag: **nada se activa a merchants reales** (regla 24).

## LA TAREA EN UNA FRASE
El pro selecciona varios partes de trabajo firmados y YaQu genera la factura que los agrupa — **y si la selección cruza meses, genera automáticamente una factura por mes**, porque la ley solo permite agrupar operaciones del mismo mes natural (art. 13 RD 1619/2012). **Ningún competidor hace esto**: todos dejan la responsabilidad legal al usuario.

## DECISIONES DEL FUNDADOR (22-jul, aplicadas — NO reabrir)
1. **IVA: desglose multi-IVA, NO rotura por IVA.** Si un albarán VALORADO ya mezcla tipos por línea, exigir homogeneidad entre albaranes es incoherente. Una factura legal admite desglose por tipo y el builder ya lo calcula desde `lines`. → **`tipoIva` NO entra en la clave de rotura.**
2. **Rotura por mes: automática en V1.** Cruzar meses NO rechaza: genera N facturas (una por mes). Es el diferenciador entero.
3. **`emitInvoice()` compartido: se crea AQUÍ**, con la forma que sirva también a SCRUM-16 (que está bloqueada esperando dictamen fiscal, así que la 17 llega primero). **Unifica la política de VeriFactu/PDF a la variante LAZY** (`PENDING_PDF`/`PENDING_QR` y rellenar después, como hace `collect-rest`). Confirma que no rompe expectativas de los otros call-sites ANTES de migrarlos; si rompe, repórtalo y migra solo lo seguro.
4. **Alcance cliente: 1 Job en V1.** Consolidar entre varios Jobs del mismo cliente → ticket aparte si alguien lo pide.
5. **Mecánica sí, activación no.** Se construye todo detrás del flag. El dictamen fiscal (P6-P10) bloquea el interruptor, no el código.
6. **REGLA NUEVA (descubierta con SCRUM-65): consolidar exige `VALORADO`.** Un albarán `SIN_VALORAR` no tiene importes → se rechaza con mensaje claro: *"Este parte no lleva precios. Edítalo para añadirlos o quítalo de la selección."*

## 0. CONTEXTO REAL (del recon 22-jul — confírmalo, no lo re-descubras)
- `invoicing.service.ts` sigue **VACÍO** → sitio del `emitInvoice()` compartido.
- Patrón transaccional canónico (`jobs.routes.ts:410-428`): `$transaction(allocateInvoiceNumber(tx) → invoice.create{type: isReceiptNumber ? 'JUST':'F1', lines, pdfUrl:'PENDING_PDF', qrData:'PENDING_QR'})`. **Duplicado en 4 call-sites** (jobs.routes, quotesAdmin.routes, quoteAdmin.ts, lib/invoicing.ts).
- `Invoice.lines Json?` acepta la concatenación de líneas de N albaranes. `Invoice` NO tiene `albaranRefs` → añadir.
- `calcAlbaranTotales` (de SCRUM-65) ya suma base/cuota/total en **céntimos enteros** → reutilizar.
- `Albaran.fecha` **YA está congelada de facto** (editable solo en borrador; la consolidación toca firmados) → NO hace falta trabajo extra, solo confirmar que el PATCH lo bloquea (`albaran_locked`).
- `Job.tipoOperacion` (SCRUM-66) ya viaja en `serializeJob`.
- `getEmissionMode(merchant)` (`emission.service.ts:36`) es el resolvedor canónico: `fiscal | demo | receipt`.
- VeriFactu es genérico (F1, sin tipo "recapitulativa"); `applyVeriFactu` salta los J-.

## 1. ALCANCE EXACTO

### 1.1 Schema (aditivo) — 🚨 STOP, enséñame el diff
```
// Albaran
invoiceId  Int?  @map("invoice_id")
@@index([merchantId, invoiceId])

// Invoice
albaranRefs Json?  @map("albaran_refs")   // [{albaranId, numero, fecha}]
```
Nada más (`Invoice.periodo` se descarta: se deriva de `albaranRefs[].fecha`). Preview + host-check, sin `--accept-data-loss`.

### 1.2 Dominio puro (testeable sin BD, patrón `validarLineas`/`billingPlan`)
- **`validarConsolidacion(albaranes, job)`** → `{ok:true}` o `{ok:false, error:'codigo_snake', message:'humano con el albarán exacto'}`. Rechaza:
  - `job.tipoOperacion === 'TRABAJO_UNICO'` → `consolidacion_no_aplica`
  - algún albarán `SIN_VALORAR` → `albaran_sin_precios` (decisión 6)
  - algún albarán no `firmado` → `albaran_no_firmado`
  - algún albarán con `invoiceId != null` → `albaran_ya_facturado`
  - clientes distintos → `cliente_mixto` (hoy trivial: 1 Job = 1 cliente, pero deja el guard)
  - selección vacía → `seleccion_vacia`
  - **NO rechaza por meses distintos** (eso es rotura, no error).
- **`groupByRotura(albaranes)`** → agrupa por clave **`(customerId, YYYY-MM de fecha, serie)`**. **SIN `tipoIva`** (decisión 1). Devuelve los grupos ordenados por mes, cada uno con sus albaranes y su etiqueta legible ("marzo 2026").

### 1.3 `emitInvoice()` compartido (`invoicing.service.ts`)
Firma orientativa: `emitInvoice(tx, {merchantId, customerId, type, lines, albaranRefs?, quoteId?, jobId?})`. Hace: `allocateInvoiceNumber(tx)` + `invoice.create` con política **lazy** de PDF/QR + `applyVeriFactu` (no-op en J-). Diseñado para que SCRUM-16 lo use tal cual (tipo `ANT` + `deductsIds`).
Migrar los 4 call-sites duplicados **solo si es seguro**; si alguno espera VeriFactu inline y romperlo tiene riesgo, **repórtalo y déjalo** (regla 9), no lo fuerces.

### 1.4 Endpoint `POST /admin/jobs/:id/consolidar-albaranes`
- Tenancy. Rol: **admin** (emitir factura es acción de dinero — coherente con SCRUM-54; confírmalo contra S1).
- **Gate por `getEmissionMode(merchant)`**: si `receipt` → **409 `consolidacion_no_disponible`** y la UI ni ofrece el botón (la recapitulativa es documento fiscal puro; **no hay variante justificante J-**). En `demo` → se ofrece con watermark. En `fiscal` → real.
- Valida `tipoOperacion` + `validarConsolidacion` → 400/409 con mensaje claro.
- **UNA transacción** para todos los grupos: por cada grupo de `groupByRotura` → `emitInvoice()` + `updateMany({where:{id:{in:[...]}, invoiceId:null}, data:{invoiceId}})` con **guard de concurrencia**: si `count < seleccionados` → throw → **rollback de TODO** (nadie consolidó a medias).
- Respuesta: lista de facturas creadas con su mes y número, para que la UI lo muestre.

### 1.5 UI (`jobDetailView.js`)
- Botón **"Consolidar en factura"** a nivel de sección Albaranes (junto a "+ Nuevo albarán"), **solo visible** si `job.tipoOperacion === 'OPERACIONES_SUELTAS'` y el modo lo permite.
- **Modo selección**: checkbox en las tarjetas de albaranes elegibles (`firmado` + `VALORADO` + `invoiceId == null`), agrupadas visualmente por mes.
- **Modal de confirmación con el desglose de rotura** — el usuario SIEMPRE ve qué se va a crear antes de emitir (queja documentada de usuarios de Odoo con agrupaciones automáticas):
  > **"Has seleccionado 7 partes de 2 meses distintos."**
  > *"La ley solo permite agrupar partes del mismo mes en una factura, así que se crearán 2 facturas:"*
  > · **Marzo 2026** — 4 partes · 1.240,00 €
  > · **Abril 2026** — 3 partes · 890,00 €
  > [Cancelar] [Crear 2 facturas]
- **Badge "Facturado"** en las tarjetas, **derivado** de `invoiceId != null` (nunca flag manual — queja nº1 documentada de usuarios de DELSOL). Expón `facturado` (y opcionalmente `invoiceNumero`) en `serializeAlbaran`.

## 2. LO QUE NO INCLUYE
- Activación a merchants reales (post-SIF + dictamen P6-P10). El flag manda.
- Facturación parcial por cantidad servida → **SCRUM-70**.
- Bandeja de pendientes + semáforo de plazo → **SCRUM-69**.
- Consolidar entre varios Jobs → fuera de V1.
- Comportamiento ante R1 (¿se liberan los albaranes?) → residual de asesor (P10). En V1 **no se implementa liberación**; si se anula una recapitulativa, los albaranes quedan ligados y se reporta como pendiente.
- Facturas de anticipo → SCRUM-16.

## 3. 🚨 STOP CONDITIONS
- **Diff del schema** antes del db push.
- **Diff del endpoint + `emitInvoice()`** antes de cerrar — es emisión de facturas, zona de dinero.
- Si migrar un call-site a `emitInvoice()` pudiera cambiar comportamiento → PARA y repórtalo.
- Si algo empuja a activar a reales, tocar el flag, o saltarse `getEmissionMode` → PARA.

## 4. TESTS
- **Puros**: `groupByRotura` (2 meses → 2 grupos; 1 mes → 1; orden correcto), `validarConsolidacion` (cada código de error), aritmética de totales en céntimos con IVA mixto.
- **Gateado**: 2 albaranes de meses distintos → **2 facturas** con sus números y `albaranRefs` correctos; IVA mixto → una factura con desglose; doble consolidación concurrente → **una gana, la otra 409, sin estado a medias**; `TRABAJO_UNICO` → 409; `SIN_VALORAR` → 400; modo `receipt` → 409 no disponible; tenancy 404.
- Suite → siguiente versión con el paso de consolidación.

## 5. DEFINICIÓN DE HECHO
- Schema aplicado (staging → mi OK → prod, orden correcto). Dominio puro + `emitInvoice()` + endpoint + UI con modal de rotura + badge derivado.
- build + test verdes; suite verde vía MCP.
- **Actualiza `docs/COMO_FUNCIONA_YAQU.md`**: la sección "En camino" pierde la línea de la recapitulativa y gana su párrafo en el cuerpo — **pero solo describiendo lo que el usuario puede hacer hoy** (con el flag OFF, un merchant real NO ve esto; redáctalo con honestidad).
- PR con descripción; SCRUM-17 a "En revisión". NO transicionar a Finalizada.

## 6. JIRA
Al abrir PR: SCRUM-17 → "En revisión" con diffs, tests, suite, y nota explícita de que **nada está activo a reales** y de lo que queda para el dictamen (P6-P10).

---

## AGENDA FISCAL PENDIENTE (no bloquea construir, bloquea activar)

> Conservada del recon 17-jul (SCRUM-17). Dictamen del asesor P6-P10 (checklist; se suman a P1-P5 de SCRUM-16).

- [ ] **P6 · Plazo y destinatario:** ¿fecha límite de expedición de la recapitulativa (¿antes
      del día 16 del mes siguiente al de las operaciones?) y ¿exige NIF completo del
      destinatario (Destinatarios en el registro VeriFactu)?
- [ ] **P7 · Qué fecha define el mes natural** de cada operación: ¿`Albaran.fecha`
      (visita/entrega)? ¿Congelada en qué momento (al emitir / al firmar)? ¿O `firmadoAt`?
- [ ] **P8 · Valoración de los albaranes:** ¿puede el albarán llevar precios/IVA internos y
      seguir siendo documento no fiscal (sin imprimirlos), o los importes deben nacer SOLO en
      la factura (valorar al consolidar)? *(NOTA: resuelto por SCRUM-65 en la práctica — el
      albarán VALORADO lleva precios y sigue sin validez fiscal; queda confirmar el criterio con el asesor.)*
- [ ] **P9 · VeriFactu:** TipoFactura de la recapitulativa (¿F1 con el periodo y las
      operaciones en `DescripcionOperacion`?) y forma exacta de referenciar las operaciones
      agrupadas en el registro de alta.
- [ ] **P10 · Anulación:** R1 de una recapitulativa → ¿los albaranes quedan LIBERADOS para
      re-consolidar (`invoiceId → null`) o LIGADOS a la anulación?

**Salida esperada:** dictamen escrito archivado en `docs/legal/` ANTES de activar nada a reales
(mismo expediente que P1-P5 de FISCAL-1). Sin dictamen no se codifica la política, solo la
mecánica latente.
