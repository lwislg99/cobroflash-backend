# Pantalla «Facturas recibidas»: título, error de carga, vacío y descuadre · SCRUM-1388

**Aprobado por el fundador** el 1-oct-2026, en **SCRUM-1388**.

La firma está transcrita en la descripción del ticket por el orquestador del equipo de Javier
(`cobroflash-backend-5b`): el fundador leyó la tabla de los cuatro borradores con los dos cambios
propuestos y respondió «1-Firmo». Esta ficha la escribe la sesión J4a al aplicar los textos, el
2-oct-2026; no hay comentario de Jira del propio fundador, y se dice.

## Texto aprobado, literal

| Ranura | Texto aprobado |
|---|---|
| `titulo` | Facturas recibidas |
| `error` | No hemos podido cargar tus facturas recibidas. Vuelve a intentarlo. |
| `vacioDeVerdad` | Todavía no tienes facturas recibidas en este periodo. |
| `descuadre` | Hemos revisado {N} gastos y no ha salido ninguna factura. No lo tomes como que no compraste: puede que no hayamos sabido leer alguno. |

`{N}` es el recuento `miradas` que manda el servidor. Con `miradas === 1` la pantalla pinta
«1 gasto», en singular: lo dice el propio ticket («el singular del `descuadre` se conserva») y el
código ya lo hacía antes de la firma.

## Dónde y cuándo se pinta

`public/dashboard/js/facturasRecibidasView.js`, `FACTURAS_RECIBIDAS_COPY`:

- `titulo`: la cabecera de la tarjeta, siempre.
- `error`: el cartel rojo (`.alert.error`) cuando la carga falla, sea cual sea el motivo: el
  servidor rechaza, no hay red, o la respuesta llega sin `miradas`. No se pinta tabla.
- `vacioDeVerdad`: el servidor miró cero gastos en el periodo (`miradas === 0`).
- `descuadre`: el servidor miró N gastos y no salió ninguna fila (`miradas > 0`, `filas` vacío).

## Qué cambió respecto a lo que había, y por qué

Los cuatro iban con la marca de microcopy pendiente desde SCRUM-1040. Dos cambian de redacción:

- `error`: «No se ha podido cargar el libro. Vuelve a intentarlo.» pasa a «No hemos podido cargar
  tus facturas recibidas. Vuelve a intentarlo.». «El libro» es palabra de gestoría.
- `descuadre`: «El libro no cuadra: se han revisado {N} gastos y no ha salido ningún asiento. No lo
  tomes como que no compraste.» pasa al texto de la tabla. El fundador preguntó qué significaba «no
  ha salido ningún asiento»: si no se entiende ahí, no se entiende en el móvil de quien lo usa.

`titulo` y `vacioDeVerdad` conservan su redacción y pierden la marca.

## Lo que este texto NO puede perder

`descuadre` y `vacioDeVerdad` dicen cosas contrarias sobre una pantalla que se ve igual de vacía:
«no supimos leer» y «no compraste». Si se funden o se acorta el primero, quien le mande la pantalla
a su asesor le dice que no compró nada. Lo vigila
`tests/scrum1388-facturas-recibidas-literales-firmados.test.mjs`.

## Lo que acompaña a la firma en el mismo ticket

Debajo del cartel de error había un segundo párrafo que pintaba el texto del error tal cual. Medido
en navegador el 2-oct-2026 sobre `origin/main` `d2ed6c8a`: «API 403: forbidden», «Failed to fetch»,
«API 500: internal_error» y «respuesta_incompleta». Se retira: el cartel dice sólo `error`.

## Lo que queda sin firmar en esa misma pantalla

Ninguna ranura lleva ya la marca. Sin marca y sin ficha propia siguen `recuento` («1 factura
recibida» / «{N} facturas recibidas»), `menu`, «Cargando…», las cabeceras de columna, «Total»,
«Año», «Trimestre» y «Consultar»: no las firma este ticket y no se tocan.

Los tres fallos de carga (rechazo del servidor, sin red, respuesta que no se entiende) dicen la
misma frase. Si alguno merece una propia, es texto nuevo y vuelve a firma.
