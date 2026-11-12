# El aviso al profesional cuando un banco abre una disputa sobre un cobro SIN factura

**Aprobado por el fundador** el 12-nov-2026, en **SCRUM-1656** (comentario 21724).

La respuesta literal del fundador fue «Ok firmo todo», sobre la tabla de la tanda del comentario 21722
con la recomendación en cada fila. La transcribió el orquestador del equipo de Javier en el comentario
21724; Jira lo publica bajo la cuenta del fundador. Este es el texto 3 de esa tanda, la PROPUESTA
recomendada, y se construye en SCRUM-1727.

## Texto aprobado, literal

Dos líneas. La primera es la misma de los otros avisos de disputa:

> ⚠️ El banco de {cliente} ha abierto una disputa por {importe}.

> Este cobro no tiene factura, así que no hay "Paquete de disputa". Reúne el presupuesto y los mensajes con {cliente} para responder al banco.

## Dónde se pinta

`src/modules/payments/disputes.service.ts`, función `avisoDeDisputa`. Es el texto libre de WhatsApp que
recibe el profesional (`freeText` de `notifyMerchantAlert`). Si el aviso cae a la plantilla
`merchant_alert_es`, este texto no sale: va «ha disputado un cobro» y el importe.

## En qué caso

Sólo cuando el cobro disputado NO tiene factura. Con factura, el aviso es el de siempre (y los dos
firmados en SCRUM-1436, cuya ficha está en este mismo directorio).

## Qué cambió

Antes, sin factura, salía «Entra en la factura y pulsa "Paquete de disputa" — sale todo listo para
responder al banco.», y esa factura no existe: el paquete sólo se genera desde una factura.
