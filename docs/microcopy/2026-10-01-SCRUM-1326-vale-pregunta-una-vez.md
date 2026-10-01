# Bot de WhatsApp — la pregunta cuando el cliente contesta «vale» a un presupuesto · SCRUM-1326

**Aprobado por el fundador** el 1-oct-2026, en **SCRUM-1326** (comentario 17692: «1-Firmo»).

La firma no me llegó a mí: el orquestador del equipo de Javier redactó la frase, se la propuso al
fundador y transcribió su respuesta en ese comentario. J1g lo abrió en Jira y copió el literal de
allí, no del mensaje del encargo.

## Texto aprobado, literal

> Entendido 🙌 Para que no haya dudas sobre el presupuesto #{número}: escribe *Acepto* y avisamos a tu profesional, o *No* si prefieres rechazarlo.

`{número}` es el hueco: el mismo `quoteNumber ?? id` que ya usa el mensaje de «no te entiendo» del
mismo fichero. Los asteriscos son negrita de WhatsApp y forman parte del texto.

### Cómo está escrito en Jira, y qué he tenido que leer entre líneas

Dos cosas del comentario no se pueden copiar byte a byte, y se dicen para que quien lo abra no
crea que el texto se cambió:

- El hueco está escrito allí como `<número>`. Aquí va entre llaves porque es la forma que los
  guards de este directorio reconocen como hueco (`tests/scrum514-aprobado-y-aplicado.test.mjs`).
- **Jira se comió los asteriscos**: guarda «Acepto» y «No» en cursiva, sin ellos. Es una
  reconstrucción, no una copia (aprobada como tal en el comentario 17801). Que van lo dice
  el propio comentario, una línea más abajo («Los asteriscos son negrita de WhatsApp y van en el
  literal»). Y hay un control: el mismo comentario cita el mensaje de «no te entiendo», que en el
  código lleva `*Acepto*` y `*No*`, y a ése le pasó exactamente lo mismo.

## Dónde se pinta

`src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts`, en `handleIncomingText`: es la
respuesta al cliente que tiene UN presupuesto enviado y contesta sólo con `vale`, `ok`, `okay`,
`okey`, `perfecto`, `listo`, `claro` o `va` (con o sin «gracias», «hola», «por favor»). Qué
palabras son lo decide la lista `PREGUNTA` de `src/modules/whatsappBot/domain/decisionPorTexto.ts`.
El reparto de palabras está firmado aparte, en el comentario 17802 del mismo ticket; el texto no
cambió con él.

Es una respuesta a un mensaje del cliente, dentro de la ventana que él abrió. No es un envío nuevo.

## Qué cambió y por qué

Texto nuevo. Antes esas ocho palabras aceptaban el presupuesto: estado `accepted`, se creaba el
Trabajo y se avisaba al profesional. «Vale» puede ser sólo «recibido», y el profesional se
presentaba en casa de alguien que no había dicho que sí.

Lo que el comentario firmado dice que no se toca sin volver a firmar:

- **«Entendido 🙌» al principio.** Es lo que separa esta frase de la de «no te entiendo»: sin ese
  arranque, quien escribió «vale» lee que contestó mal.
- **«y avisamos a tu profesional».** Dice qué pasa al aceptar.
- **No lleva el enlace**, a diferencia del «no te entiendo»: aquí el cliente ya ha contestado.

`Acepto`, `sí`, `confirmo`, `dale`, `adelante`, `de acuerdo`, `me interesa`, `quiero` y `sale`
siguen aceptando sin esta pregunta.

## Queda sin firmar

Nada de este texto. Si el cliente no contesta a la pregunta, el presupuesto sigue en `sent` y no
hay más mensajes: no existe un recordatorio ni un segundo texto.
