# SCRUM-727 · los rótulos de la columna de técnicos y su filtro

**Aprobados por el FUNDADOR el 4-sep-2026.** No por el asesor: la firma que vale es la suya, que es
justo la distinción que SCRUM-726 está cerrando.

## Los textos, literales

Cabecera de la columna, en la lista de Trabajos:

> Técnicos

Etiqueta del filtro, junto a su desplegable:

> Técnico

Opción por defecto del filtro:

> Todos los técnicos

La celda de un Trabajo que no tiene a nadie asignado, **y** la opción del filtro que agrupa
exactamente a ésos:

> Sin asignar

## Dónde se pintan

`public/dashboard/js/jobsView.js`:

- «Técnicos» — cabecera `<th>` de la tabla (`renderJobRows`) y, además, el rótulo de la entrada
  del menú «⋯» que abre el modal de asignación.
- «Técnico» — `<label>` del filtro (`renderJobsView`, dentro de `paint`).
- «Todos los técnicos» — primera `<option>` del filtro.
- «Sin asignar» — celda vacía de la columna (`celdaTecnicos`) y última `<option>` del filtro.

## Por qué «Sin asignar» se repite, que no es un descuido

Es la **misma palabra en la celda y en el filtro a propósito**: el jefe filtra por lo que ve
escrito. Si la fila dijera «Nadie» y el filtro «Sin asignar», tendría que deducir que son la misma
cosa — y dos nombres para un solo concepto hacen dudar de los dos.

## Qué había antes

Nada: la columna no existía. El nombre del técnico **no llegaba a esta pantalla**. El serializer de
lista devolvía `assignedUserId`, un identificador sin nombre y que además es el espejo del PRIMER
asignado, así que no había con qué pintar ni una celda honesta.

## Qué queda sin firmar en esta pantalla

Nada nuevo. Los otros rótulos de la lista —«Cliente», «Importe», «Estado», «Fecha», «Acciones»—
son los que las cuatro listas hermanas ya usan en producción, y se copian tal cual en vez de
estrenar sinónimos. Las cabeceras de grupo y la salvedad de «Terminados» siguen siendo las de
SCRUM-428 (fundador, 10-ago-2026), sin tocar una coma.
