# El presupuesto: el WhatsApp que no sale

**Aprobado por el orquestador por delegación del fundador** el 6-oct-2026 — SCRUM-1465 comentario 18357.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

## Textos aprobados, literales

Meta dice que no, Meta no contesta a tiempo, o no llegamos a mandarlo:

> No sabemos si el WhatsApp ha salido. Pregúntale a tu cliente antes de volver a enviarlo.

El negocio ha llegado a su tope diario de mensajes:

> El WhatsApp no ha salido: has alcanzado el tope diario de mensajes. Vuelve a intentarlo mañana o envía el enlace por email.

El cliente está dado de baja:

> El WhatsApp no ha salido: este cliente pidió no recibir tus mensajes por WhatsApp. Envíale el enlace por email o SMS.

## Dónde se pintan

`src/modules/system/app/routes/quotesAdmin.routes.ts`, `ENVIO_NO_SALIO`. Son el `message` de la
respuesta de `POST /admin/quotes/:id/send-whatsapp` cuando el envío se intenta y no sale (HTTP 200,
`sent:false`). Lo pintan tal cual el presupuesto rápido, la ficha del presupuesto y la lista.

## Qué cambió y por qué

Con el rechazo de Meta el profesional leía el texto de Meta en inglés, o el error de red, dentro de
una frase que acababa en «El presupuesto quedó guardado; puedes reintentarlo». Con la baja y el tope
leía las frases del diccionario compartido con la factura y el albarán.

Tres criterios de la firma:

- Ninguna frase nombra el documento. La palabra cambia de género con el país, y que está guardado lo
  dice la pantalla que acaba de guardarlo.
- Donde no se sabe si el mensaje salió, se dice que no se sabe. Afirmar que no salió y mandar
  reintentar puede hacer que el cliente lo reciba dos veces.
- «envía el enlace» y no «envíalo»: ningún pronombre apunta al documento.

La primera frase es la del presupuesto rápido (SCRUM-1443, comentario 18307) sin su arranque.

## Lo que no cubre

- El tope diario por cliente. La firma del comentario 18357 traía su frase, pero afirma que ese
  límite lo pone WhatsApp, y es de YaQu (`WA_CUSTOMER_DAILY_CAP`). No se ha aplicado: ese caso sigue
  con la frase del diccionario hasta que se vuelva a firmar.
- El correo que no sale (`POST /admin/quotes/:id/send-email`). Su frase firmada afirma que no ha
  salido, y con el plazo vencido no se sabe. Sigue como estaba.
- El aviso de la cuenta demo, que sólo se alcanza en esa cuenta.
- Las frases del diccionario `SEND_FAILURE_MESSAGES`, que siguen leyendo la factura y el albarán.
