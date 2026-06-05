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

## Notas
- El envío real requiere que las 3 plantillas estén **Approved** en Meta con esta
  estructura exacta y que los botones URL estén configurados con la base indicada.
- `quote_reminder_es` (si existe en Meta) **no se usa**: el recordatorio de
  presupuesto reutiliza `quote_decision_es`.
