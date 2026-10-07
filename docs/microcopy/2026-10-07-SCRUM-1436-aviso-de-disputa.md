# El aviso al profesional cuando un banco abre una disputa: sin firma del cliente

**Aprobado por el fundador** el 7-oct-2026, en **SCRUM-1436** (comentario 18747).

La firma de esa línea es la de Javier, directa, sobre los dos textos completos: «Firmamos».

De dónde salieron los textos: los propuso S1 en el enunciado del ticket y los firmó antes el comentario
18287 de SCRUM-1436 (6-oct-2026, publicado desde la cuenta de Luis; si lo escribió Luis o su
orquestador por delegación, no se sabe). El comentario 18734 recoge la decisión de que esa firma vale
para el carril de Javier. La línea de arriba no se apoya en el 18287: se apoya en el 18747.

## Texto aprobado, literal

Con presupuesto aceptado pero sin firma:

> ⚠️ El banco de {cliente} ha abierto una disputa por {importe}. Tienes el presupuesto aceptado, pero sin firma. Entra en la factura {n} y pulsa "Paquete de disputa": reúne lo que hay para responder al banco.

Sin presupuesto (el mismo, sin la segunda oración):

> ⚠️ El banco de {cliente} ha abierto una disputa por {importe}. Entra en la factura {n} y pulsa "Paquete de disputa": reúne lo que hay para responder al banco.

## Dónde se pinta

`src/modules/payments/disputes.service.ts`, función `avisoDeDisputa`. Es el texto libre de WhatsApp que
recibe el profesional (`freeText` de `notifyMerchantAlert`). Si el aviso cae a la plantilla
`merchant_alert_es`, estos textos no salen: van «ha disputado un cobro» y el importe con el número.

## En qué caso

Los dos piden que el cobro tenga factura, porque llevan su número.

- El primero: la factura apunta a un presupuesto de ese negocio con `acceptedAt` puesto y sin firma con
  trazo.
- El segundo: todos los demás casos sin firma. La factura no viene de un presupuesto, el presupuesto no
  está aceptado, es de otro negocio, ya no existe o no se ha podido leer. No dice nada del presupuesto,
  así que es cierto en todos.

## Qué cambió

Con presupuesto firmado el aviso es el que había, sin tocar: «Tranquilo: tienes el presupuesto
FIRMADO…». Antes ese texto salía siempre, hubiera firma o no.

## Lo que queda sin firmar

- **El cobro SIN factura.** Los dos textos llevan el número de la factura y ahí no hay ninguno.
  Encajarlos sería cambiarlos. Hoy sale el aviso que había menos la oración de la firma, que sigue
  mandando a «la factura» sin que exista. Hace falta un texto propio.
- Entre la primera frase y la siguiente, el texto que había lleva un salto de línea y los dos firmados
  un espacio. Se han copiado como están firmados.
