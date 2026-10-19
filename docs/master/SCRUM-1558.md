# SCRUM-1558 · (a) En producción, sin proveedor de correo, un `.eml` en disco ya no cuenta como envío — mitad de servidor

**Medido contra:** `origin/main` = `665bcd17ff7fe0f63959b300bda92cdc6bf448c7` · 2026-10-16T12:12:22Z (`Date:` de GitHub)

A9: comprobación → `tests/scrum1558-sin-proveedor-no-es-envio.test.mjs`

Sesión S1 · rama `scrum-1558-sin-proveedor-no-es-envio`. Encargo del orquestador: apartado (a) y su gemelo. **El apartado (b) —el rebote que ninguna pantalla enseña— NO se construye aquí:** pide texto nuevo (regla 39). Abajo va el literal propuesto, y ahí se para.

## Lo que hace

- `src/modules/messaging/domain/email.service.ts` · `sendQuoteEmail`: con `NODE_ENV=production` y sin `RESEND_API_KEY` ni `SMTP_URL`, **lanza `sin_transporte`** antes de montar el outbox, y deja UNA fila de fallo en `email_messages` (la misma constancia que `enviarCorreo` usa para «no hay por dónde salir»). Antes escribía `storage/outbox/quote-<id>.eml` y devolvía `ok`, y la ruta contestaba `sent:true`. La ruta ya convierte la excepción en `200 · sent:false · email_send_failed` con la frase firmada `ENVIO_NO_SALIO.emailNoSeSabe` (SCRUM-1465). **Fuera de producción el outbox sigue exactamente igual.**
**Ningún texto nuevo.** La pantalla recibe la frase que ya estaba firmada.

## Verificado, ejecutando

- `tests/scrum1558-sin-proveedor-no-es-envio.test.mjs`: 6 de 6, con los dos controles del ticket:
  - **positivo:** en producción con Resend o con SMTP todo sale igual, y la ruta real dice `sent:true` y marca el borrador como `sent`; fuera de producción el outbox sigue como estaba;
  - **negativo:** en producción sin proveedor, `sendQuoteEmail` lanza, no escribe `.eml` y deja la fila `fallo_envio`. **De punta a punta, el handler REAL de `POST /admin/quotes/:id/send-email` con el `sendQuoteEmail` REAL debajo contesta `sent:false · email_send_failed` y no marca el borrador.** Es lo que `quotesView.js` y `quotesDetailView.js` pintan como fallo (los dos miran `waSendFailed`; leídos, no tocados).
- **Rojo primero, mutando `dist`:** sin la guarda caen exactamente sus dos negativos (función y ruta). Los controles siguen en verde con el mutante, así que el banco llega a los dos caminos.

## El gemelo del enlace de acceso: SACADO de este PR

`auth.service.ts:58-65` (`logMagicLink`) escribe el enlace de acceso en el log con la misma condición (sin Resend ni SMTP). El arreglo está hecho y medido, pero va en su propia rama y **no entra en `main`** hasta que se cumpla una de estas dos: medir el `NODE_ENV` real de staging, o poner `LOG_MAGIC_LINKS=true` allí (variable de Railway, del fundador). Si staging corre con `NODE_ENV=production` y sin Resend, ese log puede ser la única forma de entrar, y el cambio dejaría al equipo fuera. Decidido por el orquestador el 16-oct-2026.
- Vecinos (`scrum1299`, `scrum1465`, `scrum475`, `scrum1515`, `scrum508`, `scrum1235`, `scrum1444`): en verde. El único salto es de `scrum1515` y pide `LIBRO_PG_URL`.
- `tsc`: un error, el de siempre por la causa A (`merchantAdmin.ts:147`, `activityKind` sin cliente regenerado). No viene de esta rama. `dist` se emite igual.

## 🔴 Lo que NO se ha tocado, a propósito

- 🔴 **GEMELO CONOCIDO, STOP DEL FUNDADOR: `sendInvoiceEmail` tiene la MISMA mentira** (mismo fichero, `email.service.ts`: sin proveedor escribe `invoice-<número>.eml` y devuelve `ok`). **No se toca sin GO escrito del fundador.** Saca los bytes de la factura, consume `ensureInvoicePdf` (`scrum206`) y está pegada al camino de emisión: la regla 40 dice que ese camino se LEE, y en el diff modificarlo no se distingue de tocar el sellado (regla 29). **Hoy no muerde:** con `INVOICING_ES_ENABLED` en OFF para merchants ES, YaQu no emite ninguna factura en España. **El día que se encienda, sí:** le diría a un profesional que su factura salió por correo cuando sólo se escribió un fichero. El orquestador lo apunta en la puerta de go-live (SCRUM-1554).
- **Staging:** el código distingue producción sólo por `NODE_ENV`. Si staging corre con `NODE_ENV=production` (Nixpacks lo pone por defecto) y sin Resend (SCRUM-38: «Resend apagado»), allí el correo del presupuesto pasará a decir «no salió», que es la verdad y no cierra ninguna puerta. **No medido:** el `NODE_ENV` real de staging (`/health` no lo dice).

## (b) Literal PROPUESTO — sin construir, espera firma (regla 39; el orquestador lo pasa al fundador en bloque)

Para la ficha del presupuesto, cuando el último correo consta como rebotado (con la misma forma que el aviso de entrega de WhatsApp):

> «El email no llegó: la dirección de tu cliente lo ha rechazado. Revisa su email o envíale el enlace por WhatsApp.»

Y, si se quiere afinar el (a): hoy la pantalla dice «No sabemos si el email ha salido…», que es prudente pero impreciso, porque aquí sí se sabe que no salió. **(a) NO lo necesita: la frase firmada basta.** Literal guardado, **no construido**:

> «El email no ha salido: ahora mismo no podemos enviar correos. Envíale el enlace por WhatsApp.»
