# «Volver a llamar»: los dos avisos de fallo acaban en «Inténtalo de nuevo.»

**Aprobado por el orquestador por delegación del fundador** el 14-oct-2026 — SCRUM-1056 comentario 19649.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

## Texto aprobado, literal

Cuando no se puede guardar la fecha de la llamada (botón «Guardar» del formulario):

> No se ha podido guardar la llamada. Inténtalo de nuevo.

Cuando se pulsa «Hecho» y no se puede marcar:

> No se ha podido marcar como hecha. Inténtalo de nuevo.

## Dónde se pinta

`public/dashboard/js/clienteVolverALlamar.js`, claves `noGuardado` y `noMarcado` de `TEXTOS`. Al
escribir esta ficha la pieza está cargada en el panel y ninguna pantalla la monta todavía.

## La conducta que va con el texto

La misma que firmaron las dos fichas de antes; sólo cambia el final de la frase.

1. El de guardar sale cuando falla «Guardar», en el formulario; el de «Hecho», cuando falla «Hecho»,
   en el bloque en reposo. Nunca los dos a la vez.
2. Cada uno sale una vez, aunque el fallo se repita.
3. Lo que hay en pantalla no cambia: la llamada sigue como estaba.

## Qué cambió

Hasta esta firma los dos acababan en «Inténtalo otra vez.» (B12 en SCRUM-1056 comentario 19401 y
B15 en el comentario 19453; sus fichas, del 13-oct, no se tocan). El orquestador los firmó así el 13-oct
**antes** de fijar la forma de la casa para reintentar, «Inténtalo de nuevo.» (SCRUM-1215 comentario
19460: 24 sitios de 50). **La corrección es del orquestador, no de la sesión que la escribe.**

Se cambia ahora porque nadie puede leerlos todavía: la pieza no está montada en ninguna pantalla, y
así el día que se monte no sale una variante nueva.

## Lo que queda sin firmar en esa pantalla

Nada de esta pieza.
