# El presupuesto: el tope por cliente y el correo que no sale

**Aprobado por el orquestador por delegación del fundador** el 6-oct-2026 — SCRUM-1465 comentario 18371.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`. Este comentario
vuelve a firmar dos frases del comentario 18357 que no se sostuvieron al medirlas; las otras tres
de aquel comentario están en la otra ficha de este mismo día y ticket.

## Textos aprobados, literales

El cliente ya ha recibido hoy el máximo de mensajes de ese negocio:

> El WhatsApp no ha salido: YaQu limita los mensajes diarios a un mismo cliente para no saturarlo. Vuelve a intentarlo mañana o envía el enlace por email.

El correo del presupuesto no consta enviado:

> No sabemos si el email ha salido. Pregúntale a tu cliente antes de volver a enviarlo.

## Dónde se pintan

`src/modules/system/app/routes/quotesAdmin.routes.ts`, `ENVIO_NO_SALIO.topePorCliente` y
`ENVIO_NO_SALIO.emailNoSeSabe`. La primera es el `message` de `POST /admin/quotes/:id/send-whatsapp`
con el motivo `customer_daily_cap`; la segunda, el de `POST /admin/quotes/:id/send-email` con
`email_send_failed`. Las dos van con HTTP 200 y `sent:false`.

## Qué cambió y por qué

**El tope por cliente.** La primera firma decía «WhatsApp no deja mandarle más». El límite es de YaQu:
`config.WA_CUSTOMER_DAILY_CAP`, aplicado en `whatsapp.ts` (regla J6). La frase dice ahora de quién es
y para qué. La firma dejaba elegir entre esta forma y una con la cifra: va ésta, porque la cifra es
una variable de entorno y la forma con cifra no tiene un literal completo firmado.

**El correo.** La primera firma decía «El email no ha salido. Vuelve a enviarlo.». El envío de correo
contesta lo mismo si el proveedor dice que no que si no contesta en 15 segundos, y en el segundo caso
el correo puede haber salido: mandar reenviar podía hacer que el cliente recibiera dos. La firma trae
dos formas; va la de «si no se puede distinguir», porque desde la ruta no se puede.

Antes, las dos decían otra cosa: el tope, la frase del diccionario compartido («…límite anti-spam…
envíalo por email»); el correo, «No se pudo enviar el email. El presupuesto quedó guardado; puedes
reintentarlo».

## Lo que no cubre

- La otra forma firmada del correo, con dos frases según el proveedor diga que no o no conteste. Pide
  que el envío de correo devuelva el motivo con nombre, y eso no está hecho.
- Las frases del diccionario `SEND_FAILURE_MESSAGES`, que siguen leyendo la factura y el albarán.
