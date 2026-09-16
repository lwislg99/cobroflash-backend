# SCRUM-883 · El mismo euro en todas partes — auditoría de importes por superficie (staging)

**Fecha:** 16-sep-2026 · **Carril:** dinero / producto · **Gate:** ninguno para la medición; cualquier arreglo toca el camino de emisión (STOP, regla 38)

**Medido contra:** `origin/main` = `4b0d5739bc19e7bad5109a32822ef7039d9ca860` · 2026-09-16T13:32:36Z (lecturas hasta 2026-09-16T14:04:43Z)

> 🔴 **ESTE TICKET NO ARREGLA NADA.** No se ha modificado código. Staging servía exactamente ese
> SHA (`GET /version`). El encargo citaba `e5e67c01`; entre los dos no hay cambios en `src/` ni `public/`.
> Todos los números de las tablas son **LEÍDOS** en la superficie (texto del DOM, `pdftotext -raw`
> o captura). Donde no se pudo leer pone **no leída**, nunca «coincide».

---

## Resumen

| # | Gravedad | Qué se leyó |
|---|---|---|
| **D1** | 🔴 dinero | **C3: el cliente firma 539,05 € y la página de pago le pide 628,60 €.** Los descuentos (de línea y global) se pierden al emitir el justificante, y de ahí pasan al cobro. |
| **D2** | 🔴 dinero | C3: el trabajo del profesional pinta «Cobrado 628,60 € de 539,05 €» y «Te falta por cobrar 0,00 €», sin ningún aviso. |
| D3 | 🟠 cliente | C3: la página de firma desglosa Base 539,49 + IVA 67,12 + IVA 21,99 (suman 628,60) bajo un TOTAL de 539,05, sin fila de descuento. |
| D4 | 🟠 profesional | C3: el detalle del presupuesto pinta Base 539,49 € · IVA 89,11 € · Total 539,05 €. |
| D5 | 🟠 profesional | C3: en el editor, el KPI pinta 539,05 € y la vista previa de la misma pantalla 568,18 €. |
| D6 | 🟡 profesional | Al «Duplicar» se pierde el descuento global (C3: el editor abre con 568,18 €). |
| D7 | 🟡 céntimo | C1: el editor pinta IVA 42,19 €. Firma, PDF y detalle pintan 42,20 €, así que ahí Base 200,95 + IVA 42,20 = 243,15, pero el total dice 243,14. El PDF del justificante pinta Base 200,94. |
| D8 | 🟡 documento | El PDF del justificante pone «TOTAL COBRADO» con el cobro pendiente (los 4 casos). |
| D9 | 🟡 cliente | Tras «Marcar como PAGADA», `/recibo` sigue diciendo «⏳ Pago pendiente» (C1, C3, C4). |
| D10 | 🟡 cliente | C4 (señal 30 %): la firma pinta las condiciones como el código crudo «MANUAL». El cliente no ve la señal al firmar. |

C2 (IVA mixto, 50/50) y C4 (señal) **cuadran en importe** en todas las superficies leídas.

---

## PASO 0 · Dónde se pinta un importe (censo por AST, antes de crear casos)

Script: `docs/evidencias/scrum883/censo-importes.mjs.txt`. Salida: `censo-salida.txt`. Es un parser de TypeScript, no un grep: los comentarios no cuentan.

- **Qué detecta:** `toFixed(2)`, `toLocaleString` con opciones, `new Intl.NumberFormat`, plantillas con `€`/`EUR`, concatenación con `€`, `${…total|amount|price…}` en crudo, `String(importe)` y `importe.toString()`, y las llamadas a formateadores.
- **Cómo se sacan los formateadores:** del propio árbol, con cierre transitivo. Salen 25. `formatDate` y `fmtQty` son falsos positivos: el censo sobreaproxima, que es la dirección segura.
- **Suelo:** si examina menos de 300 ficheros, aborta. Examinó 386.
- **Control positivo y negativo sintético:** 9 sumideros esperados, y el comentario con `toFixed(2)` y `€` no cuenta. Verde.
- **Control positivo sobre el árbol real:** `quotes.routes.ts` · `totalNum.toFixed(2)`. Verde.
- **Primer control, y fallido:** con formateadores solo por fichero, `receipt.routes.ts` salía con 1 sitio. Se corrigió a formateadores globales más transitivos.

| superficie (clasificación por ruta de fichero) | sitios | ficheros |
|---|---|---|
| 1 · pantalla del profesional (`public/dashboard/**`) | 208 | 28 |
| 2 · WhatsApp / mensajes | 62 | 13 |
| 3 · página de firma (landing, portal, `quotes.routes`) | 26 | 3 |
| 4 · cobro (`pay*`, `psp`, `stripe`, `charges`, `payments/`) | 45 | 14 |
| 5 · justificante / PDF (`receipt`, `pdf.service`, `albaranPdf`, `presupuestoParaPdf`) | 38 | 4 |
| fuera de las 5 (API admin, fiscal, libros, exportes…) | 116 | 31 |

**Cruce con lo leído en staging:** los 16 ficheros donde se leyó un importe están en el censo, con sus sitios. Hubo una alarma, `jobDetailView.js:151`, que resultó ser la llamada: el sumidero es el helper de `:146`, y está censado.

---

## Casos (creados en staging por la API, merchant QA id=2, modo de emisión `receipt`)

| caso | presupuesto | líneas (qty × precio, IVA) | condiciones |
|---|---|---|---|
| C1 cuadro y cableado | #1 (id 1872) | 3×9,99 · 1×42,35 · 37×**0,875** · 2,5×38,50 · todo 21 % | 100 % al aceptar |
| C2 reforma | #2 (1873) | 6×36,35 (10 %) · 14×4,19 (10 %) · 1×187,44 (21 %) | 50/50 |
| C3 descuentos | #3 (1874) | 8×24,95 **dto 15 %** (21 %) · 11×19,99 **dto 10 %** (10 %) · 1×120 (21 %) · **global 25 €** | 100 % al aceptar |
| C4 recarga VE | #6 (1877) | 1×689 · 23×2,37 · 1×58,33 · todo 21 % | plan propio **Señal 30 % / Resto 70 %** |

- **C4 se rehízo con otro cliente.** El #4 (id 1875), con el mismo cliente que C1–C3, lo paró el anti-spam J6 (`customer_daily_cap`) al enviarlo. No se esquivó el tope: un electricista real manda cada presupuesto a un cliente distinto. El #4 queda en borrador.
- **Cómo se leyó:** puppeteer-core con Chromium local y sesión E2E (el secreto se lee en runtime y no se imprime). Las páginas del cliente a 420 px y el panel a 1280 px. Los PDF con `pdftotext -raw`: `-layout` descoloca columnas y lo descarté tras un falso «21 %» en C2.
- **Flujo:** crear → enviar por WhatsApp (dry-run) → aceptar con el mismo cuerpo que manda la página («Acepto sin firmar») → reenviar para cobrar (C2 y C4 no crean cobro al aceptar) → «Marcar como PAGADA» con el importe que propone el prompt (C1, C3, C4; C2 queda pendiente).

---

## Tabla caso × superficie (números LEÍDOS)

### C1 · todo 21 %, céntimos (total guardado 243.14)

| superficie | Base | IVA | Total / importe | nota |
|---|---|---|---|---|
| Editor (vía Duplicar) | 200,95 € | **42,19 €** «IVA (21%)» | 243,14 € | líneas 36,26 · 51,24 · 39,17 · 116,46 |
| Lista de presupuestos | — | — | 243,14 € | |
| Detalle del presupuesto | 200,95 € | 42,20 € | 243,14 € | precio del cable «0,88 €» |
| WhatsApp presupuesto | — | — | **no leída** | plantilla `quote_decision_es`. Proxy (línea de tiempo del cliente): «243.14 EUR» |
| WhatsApp petición de pago | — | — | **no leída** | no salió: `failed` (tope J6) |
| Firma del cliente | 200,95 € | IVA 21 % 42,20 € | 243,14 € | líneas sin IVA 29,97 · 42,35 · 32,38 · 96,25 |
| PDF del presupuesto | 200,95 EUR | IVA 21 % 42,20 EUR | 243,14 EUR | precio del cable «0,88» |
| Panel del justificante J-20260916-4GEN | — | — | 243,14 € | |
| `/pay/invoice` · `/pay/bank` | — | — | 243,14 € · 243,14 € | |
| `/pay/bizum` · `/pay/card` | — | — | **no leída** · **no leída** | Bizum redirige a `/pay/invoice` (flag apagado); tarjeta da 409 (sin Connect) |
| `/recibo` | — | — | 243,14 € | «Pago pendiente», también tras marcarlo pagado |
| `/recibo/:t/pdf` | — | — | **no leída** | 404 |
| PDF del justificante | **200,94 EUR** | IVA 21 % 42,20 EUR | TOTAL COBRADO 243,14 EUR | |
| Trabajo, tras el cobro | — | — | Aceptado 243,14 · Facturado 243,14 · Cobrado 243,14 · Falta 0,00 | |

### C2 · IVA mixto, 50/50 (total guardado 531.24)

| superficie | Base | IVA | Total / importe | nota |
|---|---|---|---|---|
| Editor (vía Duplicar) | 464,20 € | 67,04 € «IVA (14%)» | 531,24 € | la vista previa dice «Pago 100%» |
| Detalle del presupuesto | 464,20 € | 67,04 € | 531,24 € | |
| WhatsApp presupuesto / petición de pago | — | — | **no leída** / **no leída** | proxy «531.24 EUR» / `failed` (tope J6) |
| Firma del cliente | 464,20 € | 21 %: 39,36 € · 10 %: 27,68 € | 531,24 € | «50% al aceptar · 50% al finalizar» |
| PDF del presupuesto | 464,20 EUR | 21 %: 39,36 · 10 %: 27,68 | 531,24 EUR | |
| Justificante del tramo 1 (panel, `/pay/invoice`, `/pay/bank`, `/recibo`) | — | — | 265,62 € en las cuatro | |
| PDF del justificante del tramo 1 | 232,10 EUR | 21 %: 19,68 · 10 %: 13,84 | TOTAL COBRADO 265,62 EUR | cobro pendiente |
| Trabajo | — | — | Aceptado 531,24 · Facturado 265,62 · Cobrado 0,00 · Falta 531,24 | |

### C3 · descuentos (total guardado 539.05)

| superficie | Base | IVA | Total / importe | nota |
|---|---|---|---|---|
| Editor: KPI y bloque de totales (descuento global tecleado) | 462,56 € | 76,49 € «IVA (17%)» | **539,05 €** | Suma 539,49 · Dto −51,93 · Global −25,00 |
| Editor: vista previa, misma pantalla | **487,56 €** | **80,62 €** | **568,18 €** | ni 6,5 s ni Tab la refrescan; líneas sin dto 241,52 · 241,88 · 145,20 |
| Detalle del presupuesto | **539,49 €** | **89,11 €** | 539,05 € | líneas sin dto |
| WhatsApp presupuesto / petición de pago | — | — | **no leída** / **no leída** | proxy «539.05 EUR» / `failed` (tope J6) |
| Firma del cliente | **539,49 €** | 21 %: **67,12 €** · 10 %: **21,99 €** | **539,05 €** | sin fila de descuento; líneas 199,60 · 219,89 · 120,00 |
| PDF del presupuesto | 462,56 EUR | 21 %: 57,71 · 10 %: 18,78 | 539,05 EUR | pie correcto; líneas sin dto |
| Detalle del presupuesto tras aceptar | — | — | «Total 539,05 €» y «J-20260916-LFXN · Total: **628,60 €**» | |
| Panel del justificante · lista de cobros | — | — | **628,60 €** · **628,60 €** | |
| `/pay/invoice` · `/pay/bank` | — | — | **IMPORTE A PAGAR 628,60 €** · **628,60 €** | |
| `/pay/bizum` · `/pay/card` · `/recibo/:t/pdf` | — | — | **no leída** ×3 | redirección / 409 / 404 |
| `/recibo` | — | — | **628,60 €** | «Pago pendiente» |
| PDF del justificante | **539,49 EUR** | 21 %: 67,12 · 10 %: 21,99 | **TOTAL COBRADO 628,60 EUR** | |
| Trabajo, antes del cobro | — | — | Aceptado 539,05 · Facturado **628,60** · Falta 539,05 | «628,60 € facturados sin cobrar» |
| Trabajo, tras el cobro | — | — | **Cobrado 628,60 € de 539,05 €** · Falta **0,00 €** | |

### C4 · señal 30 % (total guardado 970.23)

| superficie | Base | IVA | Total / importe | nota |
|---|---|---|---|---|
| Editor (Duplicar del #4, mismas líneas) | 801,84 € | 168,39 € | 970,23 € | |
| Detalle del presupuesto | 801,84 € | 168,39 € | 970,23 € | tras aceptar: «Generar siguiente tramo: Resto al terminar (679,16 €)» |
| WhatsApp presupuesto | — | — | **no leída** | proxy «970.23 EUR» |
| WhatsApp petición de la señal | — | — | **no leída** | enviada en dry-run con `payment_request_es`; proxy `invoice_issued` «291.07 EUR» |
| Firma del cliente | 801,84 € | 168,39 € | 970,23 € | condiciones «**MANUAL**»; no se ve la señal |
| PDF del presupuesto | 801,84 EUR | 168,39 EUR | 970,23 EUR | |
| Justificante de la señal (panel, `/pay/invoice`, `/pay/bank`, `/recibo`) | — | — | 291,07 € en las cuatro | `/recibo`: «— Señal», pendiente |
| PDF del justificante de la señal | 240,55 EUR | 50,52 EUR | TOTAL COBRADO 291,07 EUR | |
| Trabajo, tras cobrar la señal | — | — | Aceptado 970,23 · Facturado 291,07 · Cobrado 291,07 · Falta 679,16 | |

---

## Discrepancias: captura y camino de código

**D1 · Los descuentos no llegan al justificante ni al cobro.**
- Capturas: `C3-firma.png` (539,05) frente a `C3-pay-invoice.png` (628,60). Texto del PDF: `C3-pdf-justificante.txt`.
- Camino:
  1. `src/modules/quotes/app/routes/quotes.routes.ts:650-654`: `stageLinesReconciled(quoteLines, …)` y luego `grossOfLines`.
  2. `src/modules/invoicing/domain/invoiceLines.service.ts:52-55`: `grossOfLines` usa `calcVatBreakdown`.
  3. `src/modules/invoicing/domain/vat.service.ts:55`: `const base = qty * price`, **sin `dto` ni `discountGlobalAmount`**.
  4. `quotes.routes.ts:732`: `Invoice.total = invoiceAmount.toFixed(2)`. De ahí sale el cobro que leen `/pay/*` y `/recibo`.
- La reconciliación de `invoiceLines.service.ts:105-133` solo mueve ±0,05 € de base, así que no absorbe 89,55 €.
- Antecedentes: `schema.prisma` (Invoice.discountGlobalAmount) deja escrito que el descuento no se propaga a la factura (SCRUM-594/624). Pero nada impide emitir desde un presupuesto con descuento, y el cobro sale por el importe sin descontar.

**D2 · Cobro de más sin aviso.**
- Captura: `C3-p4-dash-trabajo.png`.
- Camino: `public/dashboard/js/jobCobroHuecos.js:76` y `public/dashboard/js/jobRailBlocks.js:119`, los dos con `Math.max(0, aceptado - cobrado)`. El exceso se recorta a 0.

**D3 · Firma: el desglose no suma el total.**
- Captura: `C3-firma.png`.
- Camino: `src/modules/system/app/routes/quoteDecisionLanding.routes.ts:322` pinta las líneas con `l.qty * l.price`, sin dto. En `:336-342`, `calcVatBreakdown(lines)` → `vat.service.ts:55` da base e IVA. El total es el guardado.

**D4 · Detalle del presupuesto.**
- Captura: `C3-dash-detalle-aceptado.png`.
- Camino: `public/dashboard/js/quotesDetailView.js:543-548` (`base = qty * price`, sin dto ni descuento global) y `:581-583` (Base e IVA calculados, Total guardado).

**D5 · Editor: vista previa congelada.**
- Capturas: `C3-editor-recorte-kpi.png` frente a `C3-editor-recorte-preview.png`. Lectura: `C3-editor-lectura.json`.
- Camino: `public/dashboard/js/quotesView.js:1462`. El `input` del descuento global llama a `recalcTotals()` pero no a `renderPreview()`.
- Medido con el mismo instrumento: 6,5 s y un Tab después, la vista previa sigue en 568,18. Está en pantalla (x=995, y=137 a 1440 px).

**D6 · Duplicar pierde el descuento global.**
- Camino: `public/dashboard/js/quotesDetailView.js:1178-1184`. La plantilla lleva `lines` y `paymentTerms`, pero no `discountGlobalAmount`.

**D7 · El céntimo (C1).**
- Lecturas: `C1-editor-lectura.json`, `C1-pdf-presupuesto.txt`, `C1-pdf-justificante.txt`.
- Tres caminos, tres números:
  - **Editor:** IVA = total − base, en `public/dashboard/js/quoteDescuentos.js:181`. Da 42,19.
  - **Firma, PDF del presupuesto y detalle:** IVA redondeado por tipo, en `vat.service.ts:63-68`. Da 42,20. El total viene de `calcTotal` (`src/core/utils/utils.ts:209`), que redondea la suma entera: 243,14.
  - **PDF del justificante:** sumas en coma flotante sin redondear hasta el formateador, en `src/modules/invoicing/infra/pdf/pdf.service.ts:526-538`. Da Base 200,94.
- Es la familia que ya midió SCRUM-624 (cuatro convenciones). Aquí queda leída en cuatro superficies.

**D8 · «TOTAL COBRADO» con el cobro pendiente.**
- Camino: `pdf.service.ts:295` (`isReceipt = type === 'JUST'`) y `:640`. El rótulo depende del tipo de documento, no del estado del cobro.

**D9 · Recibo pendiente tras «Marcar como PAGADA».**
- Captura: `C3-p4-recibo.png`.
- Camino: `PUT /admin/invoices/:id/status` (`invoicesAdmin.routes.ts:492`) → `src/modules/system/invoiceAdmin.ts:206`, que no toca el `Charge`. `/recibo` lee `Charge.status` (`receipt.routes.ts:154-158`).

**D10 · «MANUAL» en la firma.**
- Captura: `C4b-firma.png`.
- Camino: `quoteDecisionLanding.routes.ts:179-183`. `termsLabel` solo conoce FIFTY_FIFTY y FULL_UPFRONT, devuelve el código tal cual e ignora `customBillingPlan`.

**Menores, leídos:**
- Un precio de 0,875 € se pinta «0,88» (detalle, vista previa, PDF del presupuesto y del justificante), junto a un total de línea calculado con 0,875.
- En C1, los totales de línea pintados suman 243,13 frente al total de 243,14.
- El editor rotula el IVA mezclado como un único «IVA (14%)» o «IVA (17%)».

**Laterales, no son importes (van como hallazgo, regla 37):**
- La lista de cobros rotula «tarjeta» en los cuatro, cuando la tarjeta no está disponible.
- `/pay/invoice` solo ofrece tarjeta, y tarjeta da 409 en un merchant sin IBAN ni Bizum.
- Duplicar un 50/50 abre la vista previa con «Pago 100%».

---

## Suelo: qué NO se leyó y por qué

| superficie | motivo |
|---|---|
| **Texto del WhatsApp (los 4 casos)** | En staging, `WHATSAPP_DRY_RUN` no guarda cuerpo ni variables: `WhatsAppMessage` no tiene esas columnas y `__waDryRunOutbox` solo existe dentro de un proceso de test. Solo se leyó la plantilla usada (`waDelivery`) y la línea de tiempo del cliente. Ese evento sale de otra línea de código (`sendQuote.service.ts:118`) que la variable {{4}} de la plantilla (`:89`), aunque las dos usen `quote.total` en formato F1: **es un proxy, no el mensaje**. |
| `/pay/bizum` | redirige a `/pay/invoice`: `bizumManualEnabled=false` en el merchant QA |
| `/pay/card` y Stripe Checkout | 409: `connectStatus=none` |
| `/recibo/:t/pdf` | 404 |
| `/recibo` en estado pagado | Ningún cobro llegó a `paid`. Staging corre en `production` (sin `/dev/sim`), sin Bizum manual y sin Connect. No se cambió la configuración compartida del merchant para forzarlo. |
| Correo | no estaba en el encargo; sin transporte en staging |

**No se tocó** producción, ninguna base de datos (todo por la API de staging, que es la que escribe) ni el cluster de Postgres de otra sesión.

**Datos creados en staging (merchant QA):**
- clientes 3923 y 3925
- presupuestos 1872-1875 y 1877
- justificantes 1967-1970
- cobros 890-893
- trabajos 3100-3103
