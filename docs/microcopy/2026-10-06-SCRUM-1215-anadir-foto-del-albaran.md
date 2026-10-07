# El albarán: el botón de añadir una foto

**Aprobado por el orquestador por delegación del fundador** el 6-oct-2026 — SCRUM-1215 comentario 18283.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`. El literal no cambia: es el que
ya se pintaba. Lo que faltaba era la firma escrita, porque el comentario 17494 del mismo ticket (29-sep-2026) decidió
la conducta del botón y no aprobó su texto.

## Texto aprobado, literal

> 📷 Añadir foto

## Dónde se pinta

`public/dashboard/js/albaranDetailView.js`, `ROTULOS_ALBARAN.btnFoto`: una acción del menú «⋮» de la ficha del
albarán. La tabla que decide cuándo sale es `public/dashboard/js/albaranActionsRegistry.js`.

## En qué casos, que es lo que la firma dice

- En `borrador` y en `emitido`, que es donde el servidor admite una foto nueva.
- En `firmado` no se ofrece: ahí la ruta responde siempre 409 `albaran_locked`. Lo ata
  `tests/scrum1215c-foto-oculta-en-firmado.test.mjs`.
- Con las diez fotos ya puestas tampoco se ofrece (SCRUM-1302, `tests/scrum1302g-foto-con-diez.test.mjs`): es una
  conducta posterior a la firma, y va en su mismo sentido.

## Por qué tardó un día

Se firmó el 6-oct-2026 y se marcó el 7-oct-2026, junto con las tres hojas del parte que el censo de SCRUM-1157 seguía
acusando y que tenían firma del fundador desde el 4-sep-2026.
