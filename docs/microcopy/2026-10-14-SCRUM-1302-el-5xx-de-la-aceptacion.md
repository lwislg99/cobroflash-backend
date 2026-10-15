# SCRUM-1302t · el 5xx al aceptar el presupuesto

Aprobado por el orquestador por delegación del fundador · SCRUM-1302 comentario 19719 (14-oct-2026).

Sobre lo medido en c.19714. NO se firmó el literal B propuesto («…vuelve a intentarlo»): aconseja repetir
algo que puede estar ya hecho.

> No hemos podido confirmar tu respuesta. Vuelve a abrir el enlace para ver si se ha guardado.

## Dónde se ve

`src/modules/system/app/routes/quoteDecisionLanding.routes.ts`, `COPY_RESPUESTA_SIN_CONFIRMAR`: bajo la
firma, en la página `/pay/quote/:token`, cuando `POST /quote/:token/decision` (aceptar) contesta un 5xx,
lleve el cuerpo que lleve.

## Qué cambió

Antes pintaba `data.message || data.error || …`: con el 500 de la ruta, el código crudo `internal_error`. Y
ese 500 también sale DESPUÉS de guardar la aceptación (`congelarCliente` fuera del `try`,
`TipoIvaNoEmitibleError` sin recoger en `quotes.routes.ts`).

Lo demás no cambia: un 4xx sigue con su `message` o su código (SCRUM-264), el 409 «ya decidido» recarga
(SCRUM-1276), y sin respuesta sigue el literal B (SCRUM-1302d).

## La condición de la firma

Volver a abrir el enlace TIENE que enseñar el estado decidido. Hoy lo enseña: un aceptado pinta «Ya
aceptaste este presupuesto…» y no el formulario, también con la validez ya pasada (`isQuoteExpired` sólo
mira `sent`). Si no se guardó, el enlace vuelve a dejar aceptar.

Lo sujeta `tests/scrum1302t-el-5xx-de-la-aceptacion.test.mjs`, con una mutación para cada mitad.
