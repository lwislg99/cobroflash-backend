# Importar clientes — el botón y el título del modal · SCRUM-1022c

**Aprobado por el orquestador por delegación del fundador** el 25-sep-2026 — SCRUM-1022 comentario 17019.

La delegación está en `docs/equipo/limites-del-fundador.md` §«Delegación permanente», línea
«Javier, 25-sep-2026» (SCRUM-1121, PR #1769). Es la segunda firma de SCRUM-1022c; la primera, la del
comentario 17016, cubre el selector, el texto del modal y el tooltip.

## Textos aprobados, literales

| Ranura | Texto aprobado |
|---|---|
| `importarBoton` | ⬆ Importar clientes |
| `importarTituloModal` | ⬆ Importar clientes desde CSV o Excel |

## Dónde se pinta cada uno

- `importarBoton` → el botón de la lista de clientes, `public/dashboard/js/customersView.js`
  (`importBtn`). Antes decía «⬆ Importar CSV».
- `importarTituloModal` → el título del modal de importar, `public/dashboard/js/csvImport.js`
  (`titulo`). Antes decía «⬆ Importar clientes desde CSV».

El «⬆ Importar CSV» de la lista de productos (`productsView.js`) es otro importador, que sólo lee
CSV, y no cambia.

## Por qué el botón pierde el formato y el modal lo gana

Los dos decían sólo «CSV». Hoy no mienten, pero empiezan a mentir en cuanto el selector ofrece el
`.xlsx`: el defecto lo crea ese cambio, y por eso entran en el mismo PR.

- **El botón** es un rótulo corto en una pantalla llena. «⬆ Importar clientes» no promete un
  formato ni excluye otro, y no hay que volver a tocarlo cuando se admita uno nuevo.
- **El título del modal** es donde la persona decide qué fichero busca: ahí sí hace falta el
  formato, y caben los dos.

El criterio que hay que conservar: ninguno de los textos del camino de importar nombra un formato
que el servidor no lea.
