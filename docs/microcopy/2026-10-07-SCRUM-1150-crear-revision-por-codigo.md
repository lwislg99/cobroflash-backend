# «Crear revisión» falla: qué se lee por cada código del servidor

**Aprobado por el orquestador por delegación del fundador** el 7-oct-2026 — SCRUM-1150 comentario 18740.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

## Texto aprobado, literal

Para el código `quote_sin_numero`:

> No se puede crear una revisión: este presupuesto no tiene número.

Para el código `quote_not_found`:

> No se puede crear una revisión: este presupuesto ya no existe.

## Dónde se pinta

`public/dashboard/js/quoteRevisiones.js`, tabla `TEXTO_POR_CODIGO`. En el aviso que cuelga debajo del
botón «Crear revisión» de la ficha de un presupuesto cuando el `POST /admin/quotes/:id/revisiones`
falla: un párrafo con `role="alert"`, uno solo (el del intento anterior se quita al volver a pulsar).

## La conducta que se firmó con el texto

Del comentario 18740: la pantalla decide por el CÓDIGO y no pinta lo que venga en `message`.

1. `quote_sin_numero` y `quote_not_found` leen los dos literales de arriba.
2. `descuento_global_con_varios_iva` lee el `message` del servidor, que es el texto firmado en SCRUM-887
   (su ficha del 17-sep, en este directorio). Es el único que pasa tal cual.
3. Cualquier otro código, un 500 o un fallo de red leen el general firmado en SCRUM-688 (su ficha del
   16-sep, en este directorio).

El segundo literal no reutiliza el «Ese presupuesto ya no existe.» de `app.js`, a propósito (mismo
comentario): aquél sale al abrir una ficha que no está; éste sale junto a un botón recién pulsado y dice
qué acción no se pudo hacer.

## Qué cambió

Antes la pantalla pintaba el `message` de cualquier respuesta. Para `quote_sin_numero` y `quote_not_found`
eran textos del dominio («Un presupuesto sin número no tiene una serie de la que ser revisión.», «El
presupuesto no existe.»), y para los 409 de grupo, el diagnóstico de la excepción. El servidor dejó de
mandar ese diagnóstico en SCRUM-1150 (PR #2330); esta mitad cierra la puerta en la pantalla.

## Lo que queda sin firmar en esa pantalla

El código `revisiones_dos_vigentes`. Su frase está propuesta en SCRUM-1150 comentario 19098 y no tiene
firma al escribir esta ficha, así que NO se pinta: ese código lee el general, y para él «vuelve a
intentarlo» no es cierto (no lo arregla reintentar: son los datos). Declarado en el comentario 19085.
Cuando se firme, lleva ficha propia con su ranura.
