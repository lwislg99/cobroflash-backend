# La factura: el WhatsApp o el correo que no sale

**Aprobado por el orquestador por delegación del fundador** el 7-oct-2026 — SCRUM-1478 comentario 18735.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

Ninguno de los cuatro textos es nuevo. Son, letra a letra, los que el fundador firmó para el
presupuesto en SCRUM-1465 (comentarios 18357 y 18371; sus fichas son las dos de
`2026-10-06-SCRUM-1465-*.md`). Lo que se aprueba aquí es que la factura lea también esos.

## Textos aprobados, literales

El negocio ha llegado a su tope diario de mensajes:

> El WhatsApp no ha salido: has alcanzado el tope diario de mensajes. Vuelve a intentarlo mañana o envía el enlace por email.

El cliente ya ha recibido hoy el máximo de mensajes de ese negocio:

> El WhatsApp no ha salido: YaQu limita los mensajes diarios a un mismo cliente para no saturarlo. Vuelve a intentarlo mañana o envía el enlace por email.

El cliente está dado de baja:

> El WhatsApp no ha salido: este cliente pidió no recibir tus mensajes por WhatsApp. Envíale el enlace por email o SMS.

El correo de la factura no consta enviado:

> No sabemos si el email ha salido. Pregúntale a tu cliente antes de volver a enviarlo.

## Dónde se pintan

`src/modules/invoicing/domain/envioQueNoSale.ts`, `ENVIO_DE_FACTURA_NO_SALIO`. Son el `message` de la
respuesta, con HTTP 200 y `sent:false`, de tres rutas de `invoicesAdmin.routes.ts`:

- `POST /admin/invoices/:id/send-reminder` y `POST /admin/invoices/:id/resend-whatsapp`: las tres
  primeras, con los motivos `daily_cap`, `customer_daily_cap` y `wa_opt_out`.
- `POST /admin/invoices/:id/send-email`: la cuarta, con `email_send_failed`.

Las pinta tal cual el detalle de la factura, la ficha del trabajo y la pantalla de cobros.

## Qué cambió y por qué

Antes las tres rutas leían el diccionario compartido `SEND_FAILURE_MESSAGES`. La frase del tope
acababa en «envíalo por email», con un pronombre que apunta al documento. La del correo decía «No se
pudo enviar el email. Puedes reintentarlo.»: el envío de correo contesta lo mismo si el proveedor
dice que no que si no contesta a tiempo, y en el segundo caso el correo puede haber salido.

El reenvío por WhatsApp, además, no decía el motivo: con el tope alcanzado o con el cliente dado de
baja contestaba siempre «No se pudo enviar por WhatsApp. Copia el enlace y mándaselo por SMS o
llámale.». Ahora dice cuál de los dos es.

## Lo que no cubre

- Los demás motivos (`whatsapp_send_failed`, la cuenta demo, WhatsApp sin configurar): siguen leyendo
  el diccionario.
- `POST /admin/jobs/:id/collect-rest`, que también manda la factura: sigue leyendo el diccionario y
  sigue sin decir el motivo. Es de otro carril.
- El diccionario `SEND_FAILURE_MESSAGES`, que no se ha tocado: lo leen el albarán, el parte, el
  equipo y soporte.
