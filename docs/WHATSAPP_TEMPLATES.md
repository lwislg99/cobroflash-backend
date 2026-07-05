# Plantillas de WhatsApp (Meta Cloud API) — Fuente de verdad

Este documento es la **spec canónica** de las plantillas de WhatsApp de YaQu.
El código de envío (`src/integrations/whatsapp.ts` + los sitios que lo llaman)
debe coincidir **exactamente** con esto, y las plantillas creadas en
**Meta → WhatsApp Manager** deben crearse igual. Si algo cambia aquí, cambia en
los dos sitios.

## Reglas comunes
- **Categoría:** UTILITY
- **Idioma:** `es`
- **Variables:** numeradas (`{{1}}`, `{{2}}`…), en el orden indicado.
- **Botones URL dinámica:** la URL base termina en `/{{1}}`; el código envía como
  parámetro del botón **solo el sufijo** (el id), no la URL completa.
- El número de variables del cuerpo y de botones debe cuadrar **exacto** o Meta
  rechaza el envío (error #132000 / #132001).

---

## A5.1 — Auditoría de coste por ciclo (estrategia de ventana, Ola 5)

**La regla del dinero:** una plantilla se paga SIEMPRE; un mensaje dentro de la
**ventana de servicio de 24 h** (abierta por CUALQUIER mensaje entrante del cliente,
incluido el tap a un botón *quick reply*) cuesta **0 €**. Un botón de **URL no abre
ventana** (el cliente no envía nada); un **quick reply sí**.

Costes usados (España, constante J1 del código `WA_UTILITY_COST_ES`): plantilla
**Utility ~0,023 €** · plantilla **Marketing ~0,06 €** (donde §4/§5 siguen atascadas
hasta P3-3) · mensaje en ventana **0 €**. Verificar el rate card vigente en Meta al
recategorizar.

### El ciclo completo, mensaje a mensaje

| # | Momento | Mensaje | HOY (canal → coste) | CON VENTANA-FIRST (A5.2/A5.3) |
|---|---------|---------|---------------------|-------------------------------|
| 1 | Envío del presupuesto | `quote_decision_es` (§1) | Plantilla Utility → **0,023 €** | Igual: **la ÚNICA plantilla del ciclo** (es la que abre la conversación) → 0,023 € |
| 2 | Recordatorio 24 h sin respuesta | `quote_decision_es` (§1, reuso) | Plantilla Utility → 0,023 € | Ventana si el cliente escribió/tocó botón (<24 h) → **0 €**; si no, plantilla |
| 3 | Aviso al PRO (aceptado/rechazado) | `merchant_alert_es` (§5) | Texto si ventana PRO abierta, si no plantilla Marketing → 0–0,06 € | Igual (ya es ventana-first desde J1); el PRO que usa el bot casi siempre tiene ventana → **~0 €** |
| 4 | Cobro (enlace de pago) | `payment_request_es` (§2) | Plantilla Utility → 0,023 € | **Ventana-first**: texto con enlace si ventana abierta → **0 €**; plantilla solo si expiró |
| 5 | Recordatorios de cobro 7/14 d | `payment_request_es` (§2, reuso) | Plantilla Utility → 0,023 €/ud | Ventana-first (rara vez abierta a 7 días) → normalmente plantilla |
| 6 | Pago confirmado + recibo/reseña | `payment_confirmation_invoice_es` (§4) | Plantilla **Marketing** → **0,06 €** | **Ventana-first SIEMPRE** (A5.3): el pago llega minutos después de una interacción → texto con enlace `/recibo/:id` → **0 €** |
| 7 | Aviso al PRO (te ha pagado) | `merchant_alert_es` (§5) | Texto o plantilla Marketing → 0–0,06 € | Igual que #3 → **~0 €** |
| — | Bot entrante (menú, pagar pendiente, solicitud) | listas/textos interactivos | Ventana SIEMPRE (responde a un entrante) → **0 €** | Igual → 0 € |

### Total por ciclo feliz (sin recordatorios)

| Escenario | Plantillas pagadas | Coste |
|-----------|--------------------|-------|
| **HOY** (§4/§5 aún Marketing) | #1 + #4 + #6 (+ #3/#7 si ventana PRO cerrada) | **~0,11–0,23 €** |
| **HOY con P3-3 hecho** (todo Utility) | #1 + #4 + #6 | ~0,07 € |
| **VENTANA-FIRST (gate Ola 5)** | Solo #1 | **~0,023 €** |

### Qué hace falta para cerrarlo

1. **Código (Claude, A5.2/A5.3/A5.4):** registrar entrantes (`type:'inbound'` en el log
   WA-0b) → helper "¿ventana abierta?" → envíos #4/#5/#6 prueban ventana antes de gastar
   plantilla, registrando `type:'service'` (0 €) para medir el ahorro.
2. **Meta (fundador, con la WABA de producción — FASE B):** al recrear las plantillas,
   añadir **botones quick reply** a `quote_decision_es` (p. ej. «👍 Lo miro ahora») y a
   `payment_request_es` (p. ej. «✅ Voy a pagarlo»): cada tap abre ventana y convierte el
   resto del ciclo en gratis. ⚠️ Cambio de plantillas = acción del fundador (regla AA1).
3. **Meta (fundador, P3-3):** recategorizar §4/§5 de Marketing → Utility.

---

## 1. `quote_decision_es`
Envío de un presupuesto al cliente para que lo vea, acepte o rechace.

- **Cuerpo — 4 variables (en orden):**
  1. `{{1}}` = nombre del cliente
  2. `{{2}}` = nombre del negocio (merchant)
  3. `{{3}}` = nº de presupuesto
  4. `{{4}}` = total con moneda (p. ej. `350.00 EUR`)
- **Texto sugerido:**
  > Hola {{1}} 👋
  > {{2}} te ha preparado un presupuesto:
  > Presupuesto #{{3}}
  > Total: {{4}}
  > Tócalo para verlo y responder 👇
- **Pie:** `Enviado con Yaqu`
- **Botones — 1 (URL dinámica):**
  - Texto: `Ver presupuesto`
  - URL base: `https://yaqu.app/pay/quote/{{1}}`  → variable = **id del presupuesto**
  - La página `/pay/quote/:id` muestra el detalle y permite Aceptar/Rechazar.

**Código que lo envía:**
- `src/modules/system/app/routes/quotesAdmin.routes.ts` (POST `/:id/send-whatsapp`) — **A5.5:
  ventana-first**: si la ventana de 24 h está abierta (p. ej. presupuesto nacido de una solicitud
  del bot), sale como TEXTO de sesión (0 €, texto oficial en master K1) con esta plantilla de
  fallback; se registra `type:'service'` + `templateName:'quote_decision_es'` (métrica A5.4).
- `src/modules/quotes/domain/reminder.service.ts` (recordatorio 24h, reusa la misma — plantilla
  directa a propósito: a las 24 h la ventana está al filo)

---

## 2. `payment_request_es`
Envío de la factura con enlace de pago.

- **Cuerpo — 4 variables (en orden):**
  1. `{{1}}` = nombre del cliente
  2. `{{2}}` = nombre del negocio
  3. `{{3}}` = nº de factura
  4. `{{4}}` = importe con moneda
- **Título:** `Tu factura está lista`
- **Texto sugerido:**
  > Hola {{1}} 👋
  > ¡Gracias por aceptar! {{2}} te ha emitido la factura:
  > Factura #{{3}}
  > A pagar: {{4}}
  > Paga de forma segura desde el botón de abajo.
- **Pie:** `Pago seguro · Yaqu`
- **Botones — 1 (URL dinámica):**
  - Texto: `Pagar ahora`
  - URL base: `https://yaqu.app/pay/invoice/{{1}}`  → variable = **id del cobro (chargeId)**
  - La página `/pay/invoice/:chargeId` muestra los métodos (tarjeta + transferencia).

**Código que lo envía:**
- `src/modules/system/app/routes/invoicesAdmin.routes.ts` (resend-whatsapp y send-reminder)
- `src/modules/billing/domain/invoiceReminder.service.ts` (recordatorios 7/14 días)

---

## 3. `payment_confirmation_es`
Confirmación al cliente cuando se recibe el pago. **Sin botones.**

- **Cuerpo — 4 variables (en orden):**
  1. `{{1}}` = nombre del cliente
  2. `{{2}}` = importe con moneda
  3. `{{3}}` = nº de factura
  4. `{{4}}` = nombre del negocio
- **Título:** `Pago confirmado`
- **Texto sugerido:**
  > Hola {{1}} 👋
  > Hemos confirmado tu pago de {{2}} de la factura #{{3}}.
  > ¡Gracias por confiar en {{4}}!
  > Un saludo.
- **Pie:** `Recibo disponible · Yaqu`
- **Botones:** ninguno.

**Código que lo envía:**
- `src/modules/billing/app/routes/psp.routes.ts` (rama `payment.confirmed`)
- `src/modules/billing/app/routes/mpWebhook.routes.ts` (pago aprobado en Mercado Pago)
- Helper compartido: `src/integrations/whatsappNotifications.ts` → `sendPaymentConfirmation()`

---

## 4. `payment_confirmation_invoice_es`  ✅ Approved en Meta (15-jun) · CONECTADA · ESTRUCTURA EXACTA
> **Conectada el 15-jun (J1):** sustituye a `payment_confirmation_es` en los webhooks de pago
> (`psp.routes.ts` y `mpWebhook.routes.ts`) vía `sendPaymentConfirmationInvoice()`. ⚠️ Quedó en
> categoría **Marketing** en Meta; pendiente recategorizar a **Utility** (P3-3) por coste/entrega.

Igual que `payment_confirmation_es` (confirmación de pago al cliente) **pero CON un botón de
URL dinámica "Ver documento"** que abre la página donde el cliente ve y descarga su documento
de cobro. **Sustituirá** a `payment_confirmation_es` cuando esté aprobada.

> **Copy NEUTRO a propósito** (decisión 12-jun): una sola plantilla sirve para **factura**
> (post-SIF) y para **justificante de cobro** (pre-SIF, merchant ES real con
> `INVOICING_ES_ENABLED=off`). Por eso NO usa la palabra "factura": dice "documento de cobro"
> y el botón es "Ver documento". Post-SIF se puede crear una variante con "factura" si se quiere.
>
> **Nota Meta (14-jun):** Meta rechaza variables al **principio o final** del cuerpo. El body
> termina con texto fijo ("Puedes ver tu recibo en el botón de abajo.") tras `{{4}}`. La
> estructura de abajo es la EXACTA dada de alta en Meta.

- **Categoría:** UTILITY · **Idioma:** `es`
- **Cuerpo — 4 variables (en orden):**
  1. `{{1}}` = nombre del cliente — ej. `María`
  2. `{{2}}` = importe con moneda — ej. `350,00 EUR`
  3. `{{3}}` = nº del documento (factura `2026-CF-001` o justificante `J-20260611-AB3C`) — ej. `2026-CF-001`
  4. `{{4}}` = nombre del negocio — ej. `Fontanería García S.L.`
- **Título (header):** `Pago confirmado`
- **Cuerpo (body) — EXACTO en Meta:**
  > Hola {{1}} 👋
  > Hemos confirmado tu pago de {{2}} (documento de cobro {{3}}).
  > ¡Gracias por confiar en {{4}}!
  > Puedes ver tu recibo en el botón de abajo.
- **Pie (footer):** `Recibo disponible · YaQu`
- **Botones — 1 (URL dinámica):**
  - Texto: `Ver documento`
  - Tipo: URL **dinámica**
  - URL base: `https://yaqu.app/recibo/{{1}}` → variable = **id del cobro (chargeId)** (ej. `42`)
  - La página `/recibo/:chargeId` (✅ existe, pública) muestra el recibo y el enlace de descarga.

**Builder:** `buildPaymentConfirmationInvoice()` en `src/integrations/whatsappTemplates.ts`
(4 vars de cuerpo + sufijo del botón = chargeId; el texto fijo vive en Meta, no en el builder).
**Disparadores (CONECTADO 15-jun):** pago confirmado — `psp.routes.ts` y `mpWebhook.routes.ts`
vía `sendPaymentConfirmationInvoice()`. `payment_confirmation_es` (§3) queda como builder de
reserva (ya no se dispara desde los webhooks).

---

## 5. `merchant_alert_es`  ✅ Approved en Meta (15-jun) · CONECTADA · ESTRUCTURA EXACTA
> **Conectada (J1):** fallback del aviso al PRO en `psp.routes.ts` / `mpWebhook.routes.ts`
> (pago, 15-jun) y en `quotes.routes.ts` (decisión aceptado/rechazado, 16-jun), vía el helper
> genérico `notifyMerchantAlert()` (opción 1: se intenta texto libre; si `sendWhatsAppText`
> devuelve `{ok:false}` por ventana 24 h cerrada, se envía esta plantilla). `notifyMerchantPaid()`
> queda como atajo (action "te ha pagado").
> ⚠️ Quedó en categoría **Marketing** en Meta; recategorizar a **Utility** (P3-3).

Aviso al **PROFESIONAL** (no al cliente). Las notificaciones al PRO viajan como *service
message* gratis si su ventana de 24 h está abierta; **cuando está cerrada** (no respondió en
24 h) Meta no permite texto libre → se usa esta plantilla Utility como fallback.

> **Nota Meta (14-jun):** el body NO puede empezar ni terminar en variable. Empieza con
> "Hola 👋 Tienes novedades de " y termina con texto fijo. Estructura EXACTA dada de alta abajo.

- **Categoría:** UTILITY · **Idioma:** `es`
- **Disparadores:** los eventos PRO-facing que hoy van como texto libre y se perderían con la
  ventana cerrada:
  - **Decisión de presupuesto** por el cliente (aceptado / rechazado).
  - **Pago recibido** (tarjeta/Bizum/transferencia/Mercado Pago).
- **Cuerpo — 3 variables (en orden):**
  1. `{{1}}` = nombre del cliente — ej. `María García`
  2. `{{2}}` = qué ha pasado — ej. `te ha pagado` · `ha aceptado tu presupuesto` · `ha rechazado tu presupuesto`
  3. `{{3}}` = importe y/o referencia — ej. `450,00 € · Factura F-2026-014` · `Presupuesto #128`
- **Título (header):** *(ninguno)*
- **Cuerpo (body) — EXACTO en Meta:**
  > Hola 👋 Tienes novedades de {{1}}: {{2}} {{3}}.
  > Entra en tu panel de YaQu para gestionarlo.
  >
  > (ej.: "Hola 👋 Tienes novedades de María García: te ha pagado 450,00 € · Factura F-2026-014. Entra en tu panel de YaQu para gestionarlo.")
- **Pie (footer):** `YaQu`
- **Botones:** **1 botón de URL ESTÁTICA** (no dinámica, sin variable):
  - Texto: `Abrir YaQu` · URL fija: `https://yaqu.app/dashboard/`
  - (Al ser estática no lleva parámetro en runtime; el builder NO envía componente de botón.)

**Builder:** `buildMerchantAlert()` en `src/integrations/whatsappTemplates.ts` (3 vars de
cuerpo; el texto fijo y el botón estático viven en Meta, no en el builder).
**Disparadores:** pago — `psp.routes.ts` / `mpWebhook.routes.ts` ✅ CONECTADO (15-jun).
Decisión de presupuesto (aceptado/rechazado) — `quotes.routes.ts` ✅ CONECTADO (16-jun) vía
`notifyMerchantAlert()`. **Mecanismo (opción 1, sin schema):** se intenta el texto libre y se
cae a plantilla si falla; NO se registra `lastInboundAt` (no justificaba un cambio de schema).

---

## Cómo probar (cuando Meta las apruebe)

Script de prueba manual: `scripts/wa-test.mjs`. Envía UNA plantilla a UN número de
test con la misma estructura que la app. No toca la base de datos.

```bash
# Ver el payload sin enviar:
node scripts/wa-test.mjs quote_decision 34600111222 --dry

# Enviar de verdad (necesita credenciales WA en .env o inline):
WHATSAPP_PHONE_NUMBER_ID=yyy WHATSAPP_ACCESS_TOKEN=xxx \
  node scripts/wa-test.mjs quote_decision 34600111222
node scripts/wa-test.mjs payment_request 34600111222 --num=F-2025-014 --id=42
node scripts/wa-test.mjs payment_confirmation 34600111222
```

```bash
# Las nuevas (pendientes de alta en Meta):
node scripts/wa-test.mjs payment_confirmation_invoice 34600111222 --num=2026-CF-001 --id=42 --dry
node scripts/wa-test.mjs merchant_alert 34600111222 --name="María García" --action="te ha pagado" --detail="450,00 € · Factura F-2026-014" --dry
```

Plantillas válidas: `quote_decision`, `payment_request`, `payment_confirmation`,
`payment_confirmation_invoice`, `merchant_alert`.
Opciones: `--name --biz --num --amount --id --action --detail --lang=es --dry`.
Si Meta responde **#132000** = el nº de variables/botones no coincide con la plantilla
aprobada; **#132001** = nombre/idioma de plantilla no encontrado.

## Notas
- El envío real requiere que las plantillas estén **Approved** en Meta con esta
  estructura exacta y que los botones URL estén configurados con la base indicada.
- **§4 y §5 ✅ Approved y CONECTADAS** (pago 15-jun; decisión de presupuesto 16-jun).
  Quedaron en categoría **Marketing**; recategorizar a **Utility** (P3-3).
- `quote_reminder_es` (si existe en Meta) **no se usa**: el recordatorio de
  presupuesto reutiliza `quote_decision_es`.

## §6 · maintenance_proposal_es (OPCIONAL — MANT-1, Ola 15 EXT3) 🔒 alta en Meta pendiente
La propuesta de mantenimiento AL PRO sale hoy como **mensaje interactivo de sesión**
(3 botones de respuesta: Aprobar y enviar · Posponer 30d · Cancelar plan). Los mensajes
de sesión solo entregan con la ventana 24h del PRO abierta; si el pro no ha escrito al
número en 24h, el envío falla CON DIGNIDAD (el borrador queda en Presupuestos y la
ficha 360 registra el evento). Para cubrir también fuera de ventana:

- **Nombre:** `maintenance_proposal_es` · **Idioma:** es · **Categoría:** Utility
- **Body:** `🔧 Toca {{1}} de {{2}}. ¿Enviar presupuesto de {{3}}? Entra en tu panel para aprobarlo o posponerlo.`
  ({{1}} título p. ej. "revisión de caldera" · {{2}} nombre del cliente · {{3}} importe "120,00 €")
- **Botones:** Quick Reply ×3 — "Aprobar y enviar" · "Posponer 30d" · "Cancelar plan"
  (los quick replies devuelven payload; el webhook ya enruta `mant_ok|later|cancel_{plan}_{draft}`)
- Al aprobarla en Meta: añadir el builder en `whatsappTemplates.ts` y usarla como
  fallback en `runMaintenanceProposals` (patrón ventana-first A5.2). Hasta entonces
  NO hay envío de plantilla: cero riesgo de spam (regla 28 — J6 intacto).
