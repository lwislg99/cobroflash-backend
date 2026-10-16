# SCRUM-1558 · (a) En producción, sin proveedor de correo, un `.eml` en disco ya no cuenta como envío — mitad de servidor

**Medido contra:** `origin/main` = `665bcd17ff7fe0f63959b300bda92cdc6bf448c7` · 2026-10-16T12:12:22Z (`Date:` de GitHub)

A9: comprobación → `tests/scrum1558-sin-proveedor-no-es-envio.test.mjs`

Sesión S1 · rama `scrum-1558-sin-proveedor-no-es-envio`. Encargo del orquestador: apartado (a) y su gemelo. **El apartado (b) —el rebote que ninguna pantalla enseña— NO se construye aquí:** pide texto nuevo (regla 39). Abajo va el literal propuesto, y ahí se para.

## Lo que hace

- `src/modules/messaging/domain/email.service.ts` · `sendQuoteEmail`: con `NODE_ENV=production` y sin `RESEND_API_KEY` ni `SMTP_URL`, **lanza `sin_transporte`** antes de montar el outbox, y deja UNA fila de fallo en `email_messages` (la misma constancia que `enviarCorreo` usa para «no hay por dónde salir»). Antes escribía `storage/outbox/quote-<id>.eml` y devolvía `ok`, y la ruta contestaba `sent:true`. La ruta ya convierte la excepción en `200 · sent:false · email_send_failed` con la frase firmada `ENVIO_NO_SALIO.emailNoSeSabe` (SCRUM-1465). **Fuera de producción el outbox sigue exactamente igual.**
- `src/modules/auth/domain/auth.service.ts` · `logMagicLink` (el gemelo, con la misma condición): en producción, la falta de correo ya no abre el log. Antes el enlace de acceso (token de 15 min) acababa en el log de Railway justo cuando no había forma de mandarlo. Se conserva el interruptor explícito `LOG_MAGIC_LINKS=true`, que alguien tiene que poner a propósito (lo usa `scrum1515`).

**Ningún texto nuevo.** La pantalla recibe la frase que ya estaba firmada.

## Verificado, ejecutando

- `tests/scrum1558-sin-proveedor-no-es-envio.test.mjs`: 9 de 9, con los dos controles del ticket:
  - **positivo:** en producción con Resend o con SMTP todo sale igual, y la ruta real dice `sent:true` y marca el borrador como `sent`; fuera de producción el outbox y el log del enlace siguen como estaban; `LOG_MAGIC_LINKS=true` sigue mandando;
  - **negativo:** en producción sin proveedor, `sendQuoteEmail` lanza, no escribe `.eml` y deja la fila `fallo_envio`. **De punta a punta, el handler REAL de `POST /admin/quotes/:id/send-email` con el `sendQuoteEmail` REAL debajo contesta `sent:false · email_send_failed` y no marca el borrador.** Es lo que `quotesView.js` y `quotesDetailView.js` pintan como fallo (los dos miran `waSendFailed`; leídos, no tocados). El enlace de acceso no toca el log.
- **Rojo primero, mutando `dist`:** sin la guarda del correo caen sus dos negativos (función y ruta); sin la del enlace cae el suyo. Los controles siguen en verde con los mutantes, así que el banco llega a los dos caminos.
- Vecinos (`scrum1299`, `scrum1465`, `scrum475`, `scrum1515`, `scrum508`, `scrum1235`, `scrum1444`): en verde. El único salto es de `scrum1515` y pide `LIBRO_PG_URL`.
- `tsc`: un error, el de siempre por la causa A (`merchantAdmin.ts:147`, `activityKind` sin cliente regenerado). No viene de esta rama. `dist` se emite igual.

## 🔴 Lo que NO se ha tocado, a propósito

- **`sendInvoiceEmail` tiene la MISMA mentira** (mismo fichero, `.eml` + `ok` sin proveedor). No se toca porque es quien saca los bytes de la factura: consume `ensureInvoicePdf` (`scrum206`) y está pegado al camino de emisión (regla 38/40). Lo decide el orquestador.
- **Staging:** el código distingue producción sólo por `NODE_ENV`. Si staging corre con `NODE_ENV=production` (Nixpacks lo pone por defecto) y sin Resend (SCRUM-38: «Resend apagado»), allí el correo del presupuesto pasará a decir «no salió», que es la verdad, y el enlace de acceso dejará de salir en el log salvo que se ponga `LOG_MAGIC_LINKS=true`. El acceso de QA a staging es el login de test (SCRUM-38), no el enlace. **No medido:** el `NODE_ENV` real de staging (`/health` no lo dice).

## (b) Literal PROPUESTO — sin construir, espera firma

Para la ficha del presupuesto, cuando el último correo consta como rebotado (con la misma forma que el aviso de entrega de WhatsApp):

> «El email no llegó: la dirección de tu cliente lo ha rechazado. Revisa su email o envíale el enlace por WhatsApp.»

Y, si se quiere afinar el (a): hoy la pantalla dice «No sabemos si el email ha salido…», que es prudente pero impreciso, porque aquí sí se sabe que no salió. Literal propuesto, **tampoco construido**:

> «El email no ha salido: ahora mismo no podemos enviar correos. Envíale el enlace por WhatsApp.»
