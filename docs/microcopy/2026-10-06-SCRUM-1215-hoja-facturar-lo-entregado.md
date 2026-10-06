# La hoja que abre «Facturar lo entregado»

**Aprobado por el orquestador por delegación del fundador** el 6-oct-2026 — SCRUM-1215 comentario 18283.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`. El comentario aplica a la hoja el
mismo literal que ya estaba firmado para el botón que la abre (SCRUM-1215 comentario 17496, 29-sep-2026).

## Texto aprobado, literal

Título visible de la hoja, seguido del número del albarán:

> Facturar lo entregado · {número}

Nombre accesible (`aria-label`) de la hoja:

> Facturar lo entregado del albarán {número}

## Dónde se pinta

- `public/dashboard/js/jobDetailView.js`, `openFacturarParcialSheet`: la cabecera de la hoja y el `aria-label` de su
  diálogo. La hoja se abre únicamente desde la ficha del Trabajo, con el botón «Facturar lo entregado» de la fila del
  albarán.

## Qué decía antes

«Facturar parte de ‹número›» y «Facturar parte del albarán ‹número›».

## Por qué

«Parte» quería decir «una porción», y en esa misma ficha está la entrada al «Parte de trabajo», que es un documento.
Además el botón decía una cosa y la hoja que abría, otra.
