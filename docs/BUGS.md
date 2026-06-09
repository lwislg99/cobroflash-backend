# YAQU — Backlog de bugs y mejoras
**Generado tras la prueba E2E del 8 jun 2026.** Orden de prioridad: P0 (bloquea cobrar) → P4 (no tocar aún).

## Reglas de trabajo (Claude Code, leer antes de empezar)
- Arregla de **uno en uno**. Commit + push entre cada item.
- Verifica cada arreglo en **yaqu.app** (no en localhost).
- No empieces P1 hasta cerrar los dos P0.
- No toques la sección **"NO TOCAR AÚN"**.
- Marca cada item con `[x]` cuando esté hecho y verificado, y deja una línea de "causa raíz / qué se cambió".

---

## P0 — CRÍTICO: bloquea cobrar y entregar factura

### [ ] P0-1 · Pago con tarjeta devuelve 401 Unauthorized  ⏳ código hecho, pendiente clave Stripe (config usuario)
- **Síntoma:** al pulsar "Pagar con tarjeta" en `/pay/invoice/:id` navega a `/pay/card/:id` y devuelve 401 (body "Unauthorized"). El cliente no puede pagar.
- **Causa probable:** la ruta `/pay/card/:id` tiene middleware de autenticación (la usa el cliente NO logueado), o `STRIPE_SECRET_KEY` mal configurada / falla la creación de la Checkout Session.
- **Arreglo:** `/pay/card/:id` debe ser **pública** igual que `/pay/invoice/:id` y `/pay/quote/:id`. Si el 401 viene de Stripe, verificar keys de test y la creación de sesión.
- **Done cuando:** un cliente sin sesión llega a Stripe Checkout y paga en modo test sin 401.
- **CAUSA RAÍZ (9 jun):** la ruta YA era pública (verificado en yaqu.app: `/pay/card/abc`→400, `/pay/card/999999999`→404). El 401 nacía en **Stripe al crear la Checkout Session** (clave rechazada) y se filtraba crudo porque el handler no tenía try/catch. Commit `110913b`: try/catch que **loguea el motivo real de Stripe** (visible en Railway) y muestra una página 503 clara en vez de "Unauthorized". **PENDIENTE para cerrar:** poner una `STRIPE_SECRET_KEY` de test VÁLIDA (`sk_test_…`) en Railway y verificar el pago real. No marcado `[x]` hasta verificarlo end-to-end.

### [ ] P0-2 · "Abrir PDF" devuelve not_found
- **Síntoma:** en el detalle de factura, "Abrir PDF" va a `/dashboard/PENDING_PDF` y devuelve `{"error":"not_found"}`.
- **Causa:** el campo del PDF de la factura vale literalmente `PENDING_PDF` — el PDF nunca se generó.
- **Arreglo:** investigar por qué la generación se queda en `PENDING_PDF` (¿storage/credenciales? ¿job async que no corre? ¿síncrono que falla?). Que el PDF se genere de verdad. Mientras esté pendiente, el botón debe mostrar "Generando…" o disparar la generación, **nunca** enlazar a un estado.
- **Done cuando:** "Abrir PDF" abre un PDF real de la factura.

### [ ] P0-3 · La factura no se marca como PAGADA tras el pago
- **Síntoma:** el pago con tarjeta se confirma (página "Pago confirmado" + WhatsApp de confirmación enviado), pero la factura CF000007 sigue en PENDIENTE en el dashboard.
- **Pista clave:** el WhatsApp de confirmación SÍ se envía → el handler de "pago confirmado" se ejecuta, pero no actualiza el estado. Buscar ahí.
- **Arreglo:** en el flujo de pago confirmado (Stripe webhook `checkout.session.completed` / `payment_intent.succeeded`, o el handler que dispara la confirmación), marcar la **factura como PAGADA** y el **cobro como pagado**. Verificar que `STRIPE_WEBHOOK_SECRET` está configurado y que el evento se procesa.
- **Done cuando:** tras pagar, la factura pasa a PAGADA automáticamente.

### [ ] P0-4 · La factura no llega al cliente (ni WhatsApp ni email)
- **Síntoma:** dice "la factura se enviará por WhatsApp y email automáticamente", pero no llega por ningún canal. El cliente paga y no recibe su factura.
- **Depende de:** P0-2 (primero el PDF tiene que generarse de verdad).
- **Arreglo:** email → enviar la factura en PDF adjunto usando el mailer existente. WhatsApp → opción MVP recomendada: que el mensaje de confirmación de pago lleve un botón/enlace "Ver factura" que abra el PDF/página de la factura (mismo patrón que "Ver presupuesto"/"Pagar ahora"). Opción completa (más adelante): plantilla con cabecera de documento para adjuntar el PDF en el chat.
- **Done cuando:** tras pagar, el cliente recibe la factura por email (si tiene) y por WhatsApp (enlace o PDF).

---

## P1 — Bugs visibles al cliente / datos incorrectos

### [ ] P1-1 · Botón "Firmar y aceptar presupuesto" sale en ROJO
- **Síntoma:** en la landing del presupuesto #24 el botón de aceptar y el avatar salen rojos; en #23 era verde. Mismo merchant.
- **Causa probable:** el CTA primario hereda el color de acento del negocio (que puede salir rojo) en vez del verde fijo de marca.
- **Arreglo:** el botón primario (aceptar/firmar) **siempre verde de marca**. El rojo solo para rechazar. El avatar puede tener color propio; el CTA no.
- **Done cuando:** el botón de aceptar es verde en cualquier presupuesto.

### [ ] P1-2 · Texto duplicado en la pantalla de pago
- **Síntoma:** `/pay/invoice` muestra "Factura CF000006 · Factura CF000006" (dos veces).
- **Arreglo:** mostrar el nº de factura una sola vez.

### [ ] P1-3 · No se guarda el motivo de rechazo real del cliente
- **Síntoma:** el detalle del presupuesto rechazado muestra "Motivo de rechazo: Rechazado desde enlace WhatsApp" (texto genérico hardcodeado), no el motivo (dropdown) ni el comentario que eligió el cliente en el formulario.
- **Arreglo:** persistir el **motivo y el comentario reales** del formulario de rechazo y mostrarlos en el detalle. Si vienen vacíos, dejar vacío, no un texto fijo.
- **Done cuando:** al rechazar eligiendo motivo + comentario, el detalle muestra exactamente eso.

### [ ] P1-4 · Gramática en la confirmación de aceptación
- **Síntoma:** "¡Presupuesto **aceptada y firmada**!" (femenino).
- **Arreglo:** "¡Presupuesto **aceptado y firmado**!".

### [ ] P1-5 · Terminología "cotización" en el demo de España
- **Síntoma:** la confirmación de rechazo dice "rechazo de la **cotización** #24"; el resto del demo (España) usa "presupuesto".
- **Arreglo:** en el demo ES usar "presupuesto" en todos los textos del cliente. (No tocar i18n LATAM aún — solo unificar el demo ES.)

### [ ] P1-6 · WhatsApp de confirmación: "factura ##4" (doble # y nº incorrecto)
- **Síntoma:** dice "tu pago de 109.00 EUR de la factura ##4". Doble "#" y usa el **id del cobro** (4) en vez del **nº de factura** (CF000007).
- **Arreglo:** mostrar el nº de factura real ("CF000007") sin doble #.

### [ ] P1-7 · WhatsApp de confirmación usa el nombre de cuenta, no el del negocio
- **Síntoma:** dice "Gracias por confiar en Electricista prueba", pero el resto de mensajes al cliente usan "Demo ES S.L.".
- **Arreglo:** usar el nombre del negocio (el que aparece en presupuesto/factura/landing) de forma consistente en todos los mensajes al cliente.

---

## P2 — Mejoras de producto / UX

### [ ] P2-1 · Acciones sobre presupuestos rechazados
- **Mejora:** mostrar el motivo del cliente (depende de P1-3) y hacer visible **"Duplicar"** (o "Duplicar y editar") para revisar y reenviar. NO construir versionado/reapertura todavía — Duplicar es suficiente para el MVP.

### [ ] P2-2 · Feedback al enviar presupuesto
- **Mejora:** el aviso "Presupuesto enviado por WhatsApp" es muy discreto. Tras enviar, redirigir al detalle del presupuesto (muestra SENT + timeline) o mostrar un toast claro con enlace "Ver presupuesto".

---

## P3 — Técnico / raíz (registrar, abordar después de P1)

### [ ] P3-1 · Plantilla Meta `quote_decision_es`: `{{1}}` sin sustituir
- **Síntoma:** el botón genera `/pay/quote/{{1}}23` (el `{{1}}` no se sustituye). Ya hay un workaround en el backend que hace funcionar el flujo.
- **Arreglo de raíz:** en WhatsApp Manager, el botón de URL debe ser **"Tipo de URL: Dinámico"**, base `https://yaqu.app/pay/quote/{{1}}`, muestra `https://yaqu.app/pay/quote/abc123`. Revisar también `payment_request_es` por el mismo problema. (Requiere re-aprobación de Meta.)
- **Done cuando:** la URL del botón llega limpia (`/pay/quote/23`) sin depender del workaround.

### [ ] P3-2 · Manejo de error en el envío de WhatsApp
- **Mejora:** que `/admin/quotes/:id/send-whatsapp` devuelva un mensaje claro cuando Meta rechaza, nunca un 502. (Verificar si ya está resuelto; el error de Meta ya se loguea.)

### [ ] P3-3 · Plantillas en categoría Marketing → Utility
- **Mejora:** recrear `quote_decision_es`, `payment_request_es` y `payment_confirmation_es` como **Utility** (no Marketing) antes de escalar — mejor entregabilidad y coste. No urgente.

---

## P4 — Pre-lanzamiento (registrar, NO ahora)
- [ ] Correr `/security-review` antes de exponer a clientes reales (el producto maneja pagos).
- [ ] Autenticación + multi-tenant real (quitar `merchantId=1` hardcodeado).

---

## NO TOCAR AÚN (fuera de alcance este sprint)
- Fotos del trabajo (bloqueado: faltan credenciales Cloudflare R2).
- i18n LATAM completo (cotización, IVA 16%/19%, OXXO/PSE/Mercado Pago, VeriFactu).
- Métodos de pago extra (transferencia, OXXO…): **solo tarjeta está bien para el MVP**.
- Verificación visual del fix de moneda en los tiers (commit `addfb76`).
