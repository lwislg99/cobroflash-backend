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
- `src/modules/system/app/routes/quotesAdmin.routes.ts` (POST `/:id/send-whatsapp`)
- `src/modules/quotes/domain/reminder.service.ts` (recordatorio 24h, reusa la misma)

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

## 4. `payment_confirmation_invoice_es`  ⏳ PENDIENTE DE ALTA EN META
Igual que `payment_confirmation_es` (confirmación de pago al cliente) **pero CON un botón de
URL dinámica "Ver documento"** que abre la página donde el cliente ve y descarga su documento
de cobro. **Sustituirá** a `payment_confirmation_es` cuando esté aprobada.

> **Copy NEUTRO a propósito** (decisión 12-jun): una sola plantilla sirve para **factura**
> (post-SIF) y para **justificante de cobro** (pre-SIF, merchant ES real con
> `INVOICING_ES_ENABLED=off`). Por eso NO usa la palabra "factura": dice "documento de cobro"
> y el botón es "Ver documento". Post-SIF se puede crear una variante con "factura" si se quiere.

- **Categoría:** UTILITY · **Idioma:** `es`
- **Cuerpo — 4 variables (en orden):**
  1. `{{1}}` = nombre del cliente — ej. `María`
  2. `{{2}}` = importe con moneda — ej. `350,00 EUR`
  3. `{{3}}` = nº del documento (factura `2026-CF-001` o justificante `J-20260611-AB3C`) — ej. `2026-CF-001`
  4. `{{4}}` = nombre del negocio — ej. `Fontanería García S.L.`
- **Título (header):** `Pago confirmado`
- **Texto sugerido (body):**
  > Hola {{1}} 👋
  > Hemos confirmado tu pago de {{2}} (documento de cobro {{3}}).
  > ¡Gracias por confiar en {{4}}!
- **Pie (footer):** `Recibo disponible · YaQu`
- **Botones — 1 (URL dinámica):**
  - Texto: `Ver documento`
  - Tipo: URL **dinámica**
  - URL base: `https://yaqu.app/recibo/{{1}}` → variable = **id del cobro (chargeId)**
  - La página `/recibo/:chargeId` muestra el recibo y el enlace de descarga (factura o justificante).

**Builder:** `buildPaymentConfirmationInvoice()` en `src/integrations/whatsappTemplates.ts`.
**Disparadores (cuando se conecte):** pago confirmado — `psp.routes.ts` y `mpWebhook.routes.ts`,
sustituyendo a `sendPaymentConfirmation()`. **Hasta que Meta la apruebe NO se envía** (el
código sigue usando `payment_confirmation_es`).

---

## 5. `merchant_alert_es`  ⏳ PENDIENTE DE ALTA EN META
Aviso al **PROFESIONAL** (no al cliente). Las notificaciones al PRO viajan como *service
message* gratis si su ventana de 24 h está abierta; **cuando está cerrada** (no respondió en
24 h) Meta no permite texto libre → se usa esta plantilla Utility como fallback.

- **Categoría:** UTILITY · **Idioma:** `es`
- **Disparadores:** los eventos PRO-facing que hoy van como texto libre y se perderían con la
  ventana cerrada:
  - **Decisión de presupuesto** por el cliente (aceptado / rechazado).
  - **Pago recibido** (tarjeta/Bizum/transferencia/Mercado Pago).
- **Cuerpo — 3 variables (en orden):**
  1. `{{1}}` = nombre del cliente — ej. `María García`
  2. `{{2}}` = qué ha pasado — ej. `te ha pagado` · `ha aceptado tu presupuesto` · `ha rechazado tu presupuesto`
  3. `{{3}}` = importe y/o referencia — ej. `450,00 € · Factura F-2026-014` · `· Presupuesto #128`
- **Título (header):** *(ninguno)*
- **Texto sugerido (body):**
  > Hola 👋 *{{1}}* {{2}}: {{3}}.
  > Entra en tu panel de YaQu para gestionarlo.
- **Pie (footer):** `YaQu`
- **Botones:** opcional **1 botón de URL ESTÁTICA** (no dinámica, sin variable):
  - Texto: `Abrir YaQu` · URL fija: `https://yaqu.app/dashboard/`
  - (Al ser estática no lleva parámetro en runtime; el builder no envía componente de botón.)

**Builder:** `buildMerchantAlert()` en `src/integrations/whatsappTemplates.ts`.
**Disparadores (cuando se conecte):** en `psp.routes.ts` / `mpWebhook.routes.ts` (pago) y
`quotes.routes.ts` decisión (aceptado/rechazado), como fallback cuando
`sendWhatsAppText()` al PRO falle por ventana cerrada. **Requiere** registrar `lastInboundAt`
del PRO o intentar el texto y caer a plantilla — se decide al conectar (post-aprobación).

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
- **§4 y §5 están PENDIENTES de alta en Meta** (usuario). Builders, validación J7 y
  `wa-test.mjs` ya las soportan; el envío real **no se conecta hasta que estén Approved**.
- `quote_reminder_es` (si existe en Meta) **no se usa**: el recordatorio de
  presupuesto reutiliza `quote_decision_es`.
