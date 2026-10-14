# Archivar un presupuesto: el 409 del servidor

**Aprobado por el orquestador por delegación del fundador** el 14-oct-2026 — SCRUM-1273 comentario 19605.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

## Texto aprobado, literal

T10 · el `message` del 409 `no_archivable` de `POST /admin/quotes/:id/archivar`:

> Solo se puede archivar un borrador, uno rechazado o uno caducado.

## Dónde se pinta

- `src/modules/quotes/domain/archivado.ts`, `COPY_NO_ARCHIVABLE`, que devuelve
  `src/modules/system/app/routes/quotesAdmin.routes.ts` (SCRUM-1273, parte de S1).
- La ficha del presupuesto lo enseña al fallar (parte de S2, en su PR). Los textos T1–T9 de la
  pantalla los registra S2 con su construcción.
