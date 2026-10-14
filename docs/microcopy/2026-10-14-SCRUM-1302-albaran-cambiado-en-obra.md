# La firma en obra choca con una edición del albarán

**Aprobado por el orquestador por delegación del fundador** el 13-oct-2026 — SCRUM-1302 comentario 19467.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

## Texto aprobado, literal

El `message` del 409 `albaran_cambiado` de `POST /admin/albaranes/:id/firmar`, cuando alguien edita el
albarán entre que la firma se lee y se escribe:

> El albarán ha cambiado mientras lo firmabas. Vuelve a abrirlo para firmar la versión actual.

## Dónde se pinta

- `src/modules/jobs/app/routes/albaranes.routes.ts`, manejador de `POST /:id/firmar`, en la rama del
  `P2025` cuando el albarán sigue en el mismo estado y con otra versión (SCRUM-1302o).

## Por qué así (del comentario de la firma)

Dice qué ha pasado y qué hacer, y no promete que la firma se haya guardado ni que se vaya a recuperar.
Lo lee el profesional o su técnico, no el cliente. No lleva «Inténtalo de nuevo»: no es un reintento
ciego, es volver a cargar algo que cambió.
