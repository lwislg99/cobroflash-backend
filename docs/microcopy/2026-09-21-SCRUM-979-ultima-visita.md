# SCRUM-979 · «Última visita» en la lista de clientes

**Aprobado por el orquestador por delegación del fundador** el 2026-09-21 — SCRUM-979 comentario 16058.

## Los literales, tal cual se pintan

Todos viven en `public/dashboard/js/filtroClientes.js` (`TEXTOS_VISITA`, `FILTROS_VISITA`) y los pinta
`customersView.js`.

**C1** · cabecera de la columna (elegible en «Columnas», oculta en el móvil por defecto):

> Última visita

**F0** · opción sin filtro del selector nuevo:

> Cualquier fecha de visita

**F6 / F12 / F24** · las tres opciones del filtro:

> Sin visitar desde hace 6 meses

> Sin visitar desde hace 12 meses

> Sin visitar desde hace 24 meses

La celda lleva la fecha con el mismo formato que «Alta», y va vacía si el cliente no tiene ningún
trabajo terminado o cerrado.

## Lo que queda sin firmar en esta pantalla

Ningún texto nuevo. **Hueco que ya existía y no se toca aquí:** cuando un filtro deja la lista vacía,
se pinta el vacío de pestaña («Aquí no hay ningún cliente todavía.» / «Marca cada cliente como empresa
o persona al editarlo.»). Con el filtro de etiqueta ya pasaba; con el de visita, la segunda línea
tampoco describe la causa. Arreglarlo necesita un texto nuevo y queda declarado en el expediente.
