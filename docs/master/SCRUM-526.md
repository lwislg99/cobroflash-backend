# SCRUM-526 · ¿Se entera alguien de que un WhatsApp se fue al número equivocado?

**Fecha:** 19-ago-2026 · **Carril:** WhatsApp / señal de envío · **Gate:** diagnóstico, sin código nuevo

**Medido contra:** `origin/main` = `2501bfac7cb007a78674f2406cd175eae858091a` · 2026-08-19T15:15:51Z

**Diagnóstico, no construcción.** No se ha escrito funcionalidad. El único fichero que este ticket
añade es éste.

## 0 · Suelo de ceguera — superado antes de afirmar nada

Antes de decir «no hay X» hay que demostrar que se sabe mirar. **El punto de envío a Meta existe y
está localizado**, con los dos instrumentos coincidiendo:

| instrumento | resultado |
| --- | --- |
| búsqueda de texto — `git grep "graph.facebook.com"` | `src/integrations/whatsapp.ts:17` (`BASE_URL`) |
| búsqueda de texto — `POST …/messages` | **8** llamadas en `whatsapp.ts` (`:329, :543, :635, :730, :838, :918, :990, :1018`) |
| lectura del árbol — `ls src/integrations/` | `whatsapp.ts`, `whatsappNotifications.ts`, `whatsappPolicy.ts`, `whatsappTemplates.ts` |

Si esto hubiera salido vacío, todo lo de abajo sería «no supe mirar» y no «no existe». No es el caso.

---

## 1 · ¿Recibimos los webhooks de estado? — **SÍ**

| qué | dónde |
| --- | --- |
| el endpoint se monta | `src/app.ts:311` — `app.use('/webhooks/whatsapp', whatsappIncomingRouter)` |
| el POST que recibe | `src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts:86` |
| la firma de Meta se valida, fail-closed | `whatsappIncoming.routes.ts:98-102` (401 si no casa) |
| ACK inmediato antes de procesar | `whatsappIncoming.routes.ts:104` |
| **se leen los `statuses`** | `whatsappIncoming.routes.ts:111-122` |
| se extrae el error de Meta si viene | `whatsappIncoming.routes.ts:116-118` (`st.errors[0].code` + título) |

El código del webhook está completo: recorre `entry[].changes[].value.statuses[]`, saca `id` y
`status`, y llama a `updateWaMessageStatus`.

**⚠️ NO MEDIDO:** si la **suscripción al campo `messages` está dada de alta en el panel de Meta**
para la WABA de producción. Eso vive en la configuración de Meta, no en el repositorio, y este
ticket no toca producción ni en lectura. El código está preparado para recibirlos; que estén
llegando de verdad **NO MEDIDO**.

## 2 · ¿Se persiste el estado, o se descarta tras el 200? — **SE PERSISTE**

| qué | dónde |
| --- | --- |
| el escritor del estado | `src/modules/messaging/domain/whatsappLog.service.ts:127-148` (`updateWaMessageStatus`) |
| la tabla | `prisma/schema.prisma`, modelo `WhatsAppMessage` → `whatsapp_messages` |
| los campos | `status` (`queued → sent → delivered → read \| failed`) y `error` |
| no retrocede el estado | `whatsappLog.service.ts:116-121` (`shouldApplyStatus`; `failed` siempre se aplica) |
| el registro del envío | `whatsappLog.service.ts:31-52` (`recordWaMessage`) |
| cobertura del registro | **16** llamadas a `recordWaMessage` en `whatsapp.ts` para **8** puntos de envío — éxito y fallo |
| un fallo que ni llega a Meta también deja fila | `tests/scrum115-wa-fallo-registrado.test.mjs` (fija `status:'failed'` con `waMessageId: null`) |

No se descarta nada. El estado por mensaje vive en BD y sobrevive al 200.

## 3 · ¿Se puede preguntar «¿este presupuesto se entregó?» sin entrar a WhatsApp Manager? — **SÍ, Y ADEMÁS YA SE VE EN PANTALLA**

| qué | dónde |
| --- | --- |
| la consulta por documento | `whatsappLog.service.ts:152-166` (`getDeliveryStatus(merchantId, relatedType, relatedId)`) |
| la sirve el detalle del presupuesto | `src/modules/system/app/routes/quotesAdmin.routes.ts:690` |
| la sirve el detalle de la factura | `src/modules/system/app/routes/invoicesAdmin.routes.ts:207` |
| el chip que ve el profesional | `public/dashboard/js/api.js:1082-1100` (`waDeliveryChip`) |
| pintado en presupuesto / factura | `public/dashboard/js/quotesDetailView.js:194` · `invoiceDetailView.js:139` |
| métrica agregada + alerta por tasa | `whatsappLog.service.ts:208-273`; la alerta en `:264-269` |

El chip dice literalmente **En cola / Enviado / Entregado / Leído / No entregado**, con fecha.

---

## 🔴 LA RESPUESTA AL TICKET: el mecanismo está ENTERO, y el fundador SIGUE TENIENDO RAZÓN

Las tres respuestas son «sí». Y aun así el hecho de partida se sostiene, porque **los webhooks
contestan una pregunta distinta de la que preocupa**:

> los `statuses` de Meta contestan **«¿se entregó?»**.
> Nadie contesta **«¿se entregó A QUIEN DEBÍA?»**.

Un número **bien formado, existente y de otra persona** produce exactamente la misma traza que el
número correcto: `sent → delivered → read`. Es indistinguible por construcción — Meta confirma la
entrega al número que le pedimos, y le pedimos el que estaba en la ficha.

### Y hay un segundo hueco que hace el daño irreparable a posteriori

**No se guarda a qué número se envió.** Medido:

- `whatsappLog.service.ts:17-28` — `RecordWaMessageInput` tiene `merchantId`, `customerId`, `type`,
  `templateName`, `waMessageId`, `status`, `error`, `relatedType`, `relatedId`, `costEstimate`.
  **No tiene el destino.**
- `prisma/schema.prisma`, modelo `WhatsAppMessage` — mismos campos. **No hay columna de teléfono.**
  Con los **dos instrumentos**, porque una ausencia es justo lo que más fácil se afirma en falso:
  la lectura del modelo entero no encuentra ninguna, y el recuento lo confirma — `phone` aparece
  **7 veces en todo el esquema y 0 dentro de este modelo**.
- `src/integrations/whatsapp.ts:332` envía `to: params.to` … y `:313-322` registra la fila **sin
  ese `to`**.
- El destino sale de `src/modules/quotes/domain/sendQuote.service.ts:49` —
  `const to = normalizePhone(quote.customer.phone)` — y **`customer.phone` es mutable**.

Consecuencia: si el teléfono se corrige después, **no queda constancia de a dónde fue el mensaje**.
Ni para el profesional, ni para una reclamación, ni para un registro de brecha. El presupuesto
lleva nombre del cliente, dirección de la obra e importe.

**Auditoría alternativa: no la hay.** `auditLog` sólo se escribe desde `audit.service.ts:323` y sus
llamadores son fiscales (`invoiceNumber.service.ts:346,364`) y de supresión de merchant
(`supresionMerchant.service.ts:61`). **Ningún cambio de teléfono de cliente se audita.**

### Lo que SÍ se detecta hoy, para no pedir lo que ya está

| caso | ¿hay señal hoy? |
| --- | --- |
| Meta rechaza el envío (guard, credencial, plantilla inválida) | **SÍ** — fila `failed`, `tests/scrum115-wa-fallo-registrado.test.mjs` |
| el webhook trae `failed` con error de Meta | **SÍ** — `whatsappIncoming.routes.ts:116-118`, se guarda en `error` |
| número **inexistente** en WhatsApp | **probablemente sí**, vía `failed`; el código concreto de Meta es **NO MEDIDO** (exigiría enviar a Meta) |
| número **existente pero de otra persona** | **NO. Y no lo puede detectar ningún webhook.** |

---

## Lo que costaría cerrarlo — y por qué PARO aquí

Registrar el destino real del envío **pide un campo nuevo en `prisma/schema.prisma`**, y eso es de
los fundadores. **Diff preparado y NO aplicado:**

```prisma
model WhatsAppMessage {
  ...
  // SCRUM-526 (PROPUESTO, sin aplicar): a qué número se envió DE VERDAD, congelado en el
  // momento del envío. Hoy sólo existe `customerId` → `Customer.phone`, que es mutable: si el
  // teléfono se corrige después, se pierde el rastro de a dónde fue el mensaje.
  toPhone String? @map("to_phone")
}
```

Aditivo y anulable, así que no rompe filas existentes. **No se ha ejecutado ningún `db push` ni se
ha tocado el esquema.** Con ese campo, «¿a qué número se fue este presupuesto?» pasa a ser
contestable; sin él, no lo es por ninguna vía.

**Lo que este ticket NO propone, a propósito:** validar el formato del teléfono (un número bien
formado puede ser el de otra persona — un regex no arregla esto), ninguna herramienta de terceros
(WhatsApp es Meta Cloud API directa), y ningún aviso concreto al profesional (primero el dato,
después la decisión, y la decisión no es de esta sesión).

## Fuera de carril · se reporta, no se arregla (regla 37)

1. **La alerta de tasa de entrega exige ≥10 envíos en 7 días** (`whatsappLog.service.ts:264-269`, `active` en `:266`); un fontanero de The Pioneer no llega a ese volumen, así que para el perfil de septiembre esa alerta no se activa nunca.
2. **Ningún cambio de teléfono de cliente se audita** — `auditLog` sólo cubre numeración fiscal y supresión de merchant, así que tampoco por ahí se puede reconstruir a qué número se envió.
3. **Los códigos de error de Meta se guardan como texto libre** (`whatsappIncoming.routes.ts:116-118`, `` `${code}: ${title}` ``), sin vocabulario cerrado: no se puede consultar «cuántos fallos por número inexistente» sin parsear cadenas.

## Última línea — qué NO pude medir

**NO MEDIDO:** (a) si la suscripción al campo `messages` está dada de alta en el panel de Meta para
la WABA de producción — vive fuera del repositorio; (b) qué código de error devuelve Meta ante un
número inexistente, y por tanto si ese caso concreto acaba en `failed` — exigiría enviar un mensaje
real; (c) cuántos mensajes reales están hoy en cada estado — **ninguna sesión recibe la credencial
de producción**, y este ticket no toca producción ni en lectura.
