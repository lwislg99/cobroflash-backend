# «Guardar plantilla» con el nombre de una que ya existe: la pregunta y lo que se lee después

**Aprobado por el orquestador por delegación del fundador** el 13-oct-2026 — SCRUM-1188 comentario 19400.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

## Texto aprobado, literal

La pregunta, al pulsar «Guardar plantilla» con el nombre de una plantilla que ya existe:

> Ya tienes una plantilla llamada "{nombre}". ¿Quieres sustituirla? Esta acción no se puede deshacer.

Después de sustituirla, cuando el cobro del presupuesto no es «Plan personalizado»:

> Plantilla "{nombre}" actualizada.

Después de sustituirla o de crearla, cuando el cobro del presupuesto es «Plan personalizado»:

> Plantilla "{nombre}" guardada sin el plan de cobro. Los tramos de un plan personalizado no se guardan en las plantillas: al usarla, elige el cobro en el presupuesto.

`{nombre}` es el nombre GUARDADO de la plantilla, no el tecleado.

## Dónde se pinta

`public/dashboard/js/quotesView.js`, en la hoja «Guardar plantilla» del editor de presupuestos. La
pregunta es un `confirm` nativo: los botones los pone el navegador. Los otros dos son el aviso de la
vista, que se lee al cerrarse la hoja.

## La conducta que se firmó con el texto

Del comentario 19400, sobre lo medido en navegador en el comentario 19101:

1. La pregunta sale sólo si la lista de plantillas, pedida en ese momento, trae una con ese nombre sin
   contar mayúsculas ni espacios de los bordes. Si dice que no, no se escribe nada y la hoja sigue
   abierta. Si dice que sí, la plantilla recibe las líneas, la moneda y el cobro nuevos, y las líneas
   que tenía se pierden: por eso la pregunta dice que no se puede deshacer.
2. «Actualizada» se lee cuando queda UNA plantilla con ese nombre y los datos nuevos.
3. El tercer texto se firmó el 28-sep para CREAR (comentario 17332 del mismo ticket). El comentario
   19400 lo extiende a SUSTITUIR porque el hecho que describe ocurre igual: al sustituir desde «Plan
   personalizado» el cobro guardado se vacía.

## Qué cambió

Antes, guardar con el nombre de una plantilla que ya existía creaba otra con el mismo nombre, sin
preguntar. La primera propuesta de la pregunta no llevaba la última frase; la firma eligió la versión
que la lleva.

El tercer texto estaba en pantalla desde el 28-sep, firmado en el ticket, y no tenía ficha en este
directorio: entra con ésta.

## Lo que queda sin firmar en esa pantalla

Este cambio no toca los demás textos de la hoja, y esta ficha no dice nada de su firma.
