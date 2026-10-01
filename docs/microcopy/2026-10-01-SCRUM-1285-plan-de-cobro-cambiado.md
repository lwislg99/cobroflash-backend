# Plan de cobro — el plan ha cambiado desde que lo abriste · SCRUM-1285

**Aprobado por el fundador** el 1-oct-2026, en **SCRUM-1285** (comentario 17877).

La firma no me llegó a mí: el orquestador transcribió en ese comentario la decisión del fundador.
La S2 lo leyó en Jira y copió el literal de allí, no de un mensaje.

## Texto aprobado, literal

> Este plan de cobro ha cambiado desde que lo abriste. Te mostramos cómo está ahora: revísalo y vuelve a hacer tu cambio.

## Dónde se pinta

Constante `TEXTO_PLAN_DE_COBRO_CAMBIADO` en `public/dashboard/js/quotesDetailView.js`. Sale dentro de
la sección «Plan de cobro» de la ficha del presupuesto, encima de los tramos, una sola vez.

## Cuándo se pinta, que es lo que lo hace cierto

Cuando «Guardar plan» se rechaza con 409 `version_superada` **y el plan vigente es distinto del que
la persona tenía delante** (otros tramos, otro reparto, o un tramo más ya facturado). Entonces se
descarta lo tecleado, se repinta el plan vigente y se dice.

**No se pinta a cada 409.** La versión que compara el servidor es la del presupuesto entero, y
guardar una nota interna o una etiqueta en la misma ficha también la mueve (medido en yaqu.app el
1-oct-2026, presupuesto de pruebas #203). En ese caso el plan no ha cambiado y el texto sería
falso: el cambio de la persona se guarda sobre la versión nueva y no se le dice nada.

## Qué cambió y por qué

Texto nuevo. Antes la ruta reemplazaba el plan sin mirar sobre qué versión escribía.

Se propusieron dos redacciones. Se descartó «Alguien ha cambiado este plan mientras lo editabas»:
puede ser la misma persona en otra pestaña.

## Queda sin firmar

Nada nuevo. Si el reintento vuelve a chocar se usa el respaldo que la pantalla ya tenía, «No se
pudo guardar el plan».
