# SCRUM-1478 · La factura que no sale: qué lee el profesional

**Medido contra:** `origin/main` = `e883e586d11298ca09d58cd3fa89937b7b0549bd` · 2026-10-07T15:56:24Z

A9: comprobación → `tests/scrum1478-la-factura-que-no-sale.test.mjs`

Sesión J1 (`jv-j1`, 7-oct) · rama `scrum-1478-la-factura-que-no-sale`. Ticket abierto por S1 del
equipo de Luis; decisiones del orquestador de Javier en el comentario 18735.

## Lo que decía el ticket y lo que salió al ejecutarlo

El ticket estaba leído, no ejecutado. Ejecutadas las tres rutas reales de `dist/` (base doblada,
WhatsApp en dry-run, nada a la red), dos de sus tres filas no salían como decía:

| ruta | caso | lo que leía el profesional |
|---|---|---|
| `/resend-whatsapp` | tope diario | «No se pudo enviar por WhatsApp. Copia el enlace y mándaselo por SMS o llámale.» |
| `/resend-whatsapp` | cliente dado de baja | la misma frase |
| `/send-reminder` (con cobro) | tope diario | «Has alcanzado el tope diario… o envíalo por email.» |
| `/send-reminder` (con cobro) | cliente dado de baja | «Este cliente se dio de baja de WhatsApp — envíale el enlace por email o SMS.» |
| `/send-email` | el envío falla | «No se pudo enviar el email. Puedes reintentarlo.» |

- **El reenvío nunca enseñaba las frases de tope.** `sendInvoicePaymentRequest` contesta
  `whatsapp_send_failed` para cualquier fallo del envío. El defecto ahí era otro: no se decía el
  motivo, y la baja es el único que le dice al profesional que deje de intentarlo.
- **El tope por cliente** no se alcanza por el recordatorio (su rama de plantilla no pasa el cliente
  al envío; leído). Por el reenvío sí se alcanza dentro del servicio (ejecutado), pero llegaba
  aplanado a la ruta.
- **El correo** salía como decía el ticket.

## El arreglo

1. **Las frases**, en un módulo nuevo: `src/modules/invoicing/domain/envioQueNoSale.ts`. Cuatro
   motivos tienen frase propia para la factura; el resto sigue leyendo el diccionario. Las cuatro son,
   letra a letra, las firmadas para el presupuesto en SCRUM-1465. Que valgan para la factura lo
   aprobó el orquestador por delegación (comentario 18735); ficha en
   `docs/microcopy/2026-10-07-SCRUM-1478-factura-que-no-sale.md`. `SEND_FAILURE_MESSAGES` no se toca.
2. **Las tres rutas** de `invoicesAdmin.routes.ts` componen el cuerpo del fallo con ese módulo. El
   código de motivo (`error`), `sent` y los demás campos no cambian.
3. **El motivo real del reenvío, de forma aditiva.** `sendInvoicePaymentRequest` añade
   `motivoDelEnvio` y deja `reason` como estaba. `/resend-whatsapp` lee el campo nuevo.

`invoicesAdmin.routes.ts` no gana ni pierde líneas (7 cambiadas en sitio), y los cambios están en
los handlers de envío: el camino de emisión no se ha tocado. `invoiceWhatsApp.service.ts`, 2 líneas
cambiadas en sitio.

## Mi error, y por qué el arreglo es aditivo

Le dije al orquestador que los otros dos llamadores de `sendInvoicePaymentRequest` «no leen el
motivo», y me autorizó a quitar el aplanado sobre ese dato. Lo había dicho mirando sólo la línea de
la llamada. Al leer lo de debajo: `POST /admin/jobs/:id/collect-rest` (`jobs.routes.ts`) sí lee
`reason` y lo traduce con el diccionario. Desaplanarlo habría cambiado una ruta de otro carril, y con
las frases que este ticket retira. `quotes.routes.ts` descarta el resultado.

Por eso `reason` se queda aplanado y el test lo fija: el caso «`reason` SIGUE aplanado» pasaba antes
del arreglo y tiene que seguir pasando. Quien lo «limpie» cambia `collect-rest` y ve ese rojo.

## El test

`tests/scrum1478-la-factura-que-no-sale.test.mjs`, 13 casos, por las rutas y el servicio reales.

- Antes del arreglo: 13 casos, 4 pasan, 9 caen. Pasaban los tres suelos (lo que hoy sale, sale) y
  el de `reason` aplanado.
- Después: 13 casos, 13 pasan, 0 caen.
- Uno compara cada frase del código con las líneas de cita de las dos fichas de SCRUM-1465: una
  letra distinta, o un motivo más con frase propia, y cae.
- Los dos detectores por expresión (el pronombre al documento, la orden de reintentar) llevan su
  positivo: la frase vieja del diccionario sí casa.

## Lo que NO lleva

- **`collect-rest`** sigue sin decir el motivo y leyendo el diccionario. Otro carril, otro ticket.
- **Los motivos sin frase propia** en el reenvío (`demo_safe_numbers`, `not_configured`) ahora llegan
  con su nombre y su frase del diccionario, en vez de «No se pudo enviar por WhatsApp…». No se han
  ejecutado por esta ruta.
- **`whatsapp_send_failed`** sigue diciendo «No se pudo enviar por WhatsApp. Copia el enlace…», que
  afirma que no salió. Es el mismo problema que el del correo y el ticket no lo pide.
- **Que el correo distinga** «el proveedor dijo que no» de «no contestó» (`enviarPorResend` espera
  10 s). No se ha tocado: la frase aprobada es la de «no se puede distinguir».
- **El tope por cliente en el recordatorio**: sigue sin alcanzarse por esa ruta.
- **No se ha visto en yaqu.app**, ni la tanda completa, ni los tipos (el build local es `--noCheck`).

## Anexo SCRUM-1478b · el export que sólo leía su test

**Medido contra:** `origin/main` = `818cb29be894a7861f11970a59e20eba5ca4e70b` · 2026-10-07T16:34:35Z (hora de GitHub)

A9: comprobación → `tests/scrum411-exports-inalcanzables.test.mjs`

El obligatorio del PR salió rojo por ese censo: «se declaran 236 y el censo mide 237». El export de más
era `ENVIO_DE_FACTURA_NO_SALIO`, la tabla de frases del módulo nuevo. Su único consumidor de producción
está dentro del propio fichero (`falloDeEnvioDeFactura`); de fuera sólo lo importaba el test.

Reproducido en local antes de tocar, sobre la punta `6639b695`: 25 casos, 23 pasan y 2 caen (el del
huérfano sin declarar y el de la suma). El consejo que da el censo para este export es quitarle el
`export`, no declararlo, y eso es lo que se hizo: no se añade ninguna línea al registro de huérfanos.
Después: 236 medidos, 236 declarados, 25 de 25.

El caso «cada frase de la factura está, letra a letra, en las fichas firmadas» ya no lee la tabla:
pregunta a `falloDeEnvioDeFactura` por todos los motivos del diccionario de la casa y se queda con los
que no devuelven la frase del diccionario. Siguen saliendo los cuatro de antes, y el caso cae si sale
uno más o uno menos. Ninguna frase cambia.

No se corrió la tanda completa en local; `scrum411` no se había corrido antes del primer push, y por
eso llegó rojo al CI.
