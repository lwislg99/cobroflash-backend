# SCRUM-980 · El historial de trabajo en la ficha del cliente

**Aprobado por el orquestador por delegación del fundador** el 2026-09-21 — SCRUM-980 comentario 16061.

## Los literales, tal cual se pintan

Viven en `public/dashboard/js/customerDetailView.js` (`HISTORIAL_CLIENTE.TEXTOS`). El aviso de
`parte-detail` (P8) tiene su propio registro en este directorio, porque lo firmó otro comentario.

**P1** · la pestaña (`n` = trabajos cargados; con más páginas, `n+`):

> Trabajos

**P2** · la línea de la cabecera, solo si hay próxima visita (seguida de la fecha, «5 oct 2026, 10:00»):

> Próxima visita:

**P3** · la pestaña sin trabajos:

> Sin trabajos

**P4** · las columnas:

> Fecha

> Trabajo

> Estado

> Documentos

**P5** · junto al albarán, `📷 n`, con el nombre accesible:

> 1 foto

> 3 fotos

**P6** · el botón de la página siguiente:

> Ver más trabajos

**P7** · el bloque de partes sin trabajo (solo admin y propietario):

> Partes sin trabajo

El estado de cada trabajo sale de `jobStatusMeta` (`api.js`): no es texto nuevo.

## Lo que queda sin firmar en esta pantalla

Nada nuevo.
