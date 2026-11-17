# El parte: los tres avisos de la casilla «Desplazamientos» la llaman como su rótulo

**Aprobado por el orquestador por delegación del fundador** el 17-nov-2026 — SCRUM-1752 comentario 21987.
La delegación general de firma consta en SCRUM-1656, comentario 21978. S4 propuso los tres literales
antes de escribir nada y el orquestador los aprobó tal cual; la variante con «son» quedó descartada.
**Aplicado en el mismo acto** (regla 30).

## Textos aprobados, literales

El aviso de «no es un número entero» (código `desplazamientos_invalido`, y la casilla que no entiende lo
tecleado):

> No se ha guardado. Desplazamientos es un número entero, como 1 o 2 — no el tiempo de viaje

El de un número negativo (código `desplazamientos_negativo`):

> No se ha guardado. Desplazamientos es 0 o más

El de un número que no cabe en la columna (código `desplazamientos_no_cabe`):

> No se ha guardado. Ese número es demasiado grande para Desplazamientos

## A qué sustituyen

Los mismos tres textos con «Desplazamiento» en singular. Cambia una letra en cada uno:

- `TEXTOS.desplazamientoEsEntero` — firma anterior: SCRUM-1491 comentario 18517 (y su uso desde la
  casilla, SCRUM-1492 comentario 18633).
- `TEXTOS.desplazamientoEsCeroOMas` y `TEXTOS.desplazamientoDemasiadoGrande` — firma anterior:
  SCRUM-1492 comentario 18706.

## Dónde se pintan

`public/dashboard/js/parteDetailView.js`, en la hoja del parte en borrador: bajo la casilla
«Desplazamientos (nº de viajes)» cuando lo tecleado no se guarda.

## Por qué

Desde SCRUM-1746 la casilla se rotula «Desplazamientos (nº de viajes)». Sus avisos seguían diciendo
«Desplazamiento»: el profesional leía un nombre encima de la casilla y otro en el aviso de esa misma
casilla. SCRUM-1746 no los tocó porque cada uno tenía su propia firma.

El verbo se queda en «es», igual que en los avisos gemelos de Kilómetros («Kilómetros es 0 o más»):
la palabra nombra la casilla.

## Lo que NO cambia

- El rótulo «Desplazamientos (nº de viajes)» (SCRUM-1746) y los tres avisos de Kilómetros.
- El título del paso, «Horas y desplazamiento», que no nombra la casilla.
- Los `message` con los que la ruta acompaña sus códigos de error («Los desplazamientos son un número
  entero.»): el panel no los pinta, pinta estos.
