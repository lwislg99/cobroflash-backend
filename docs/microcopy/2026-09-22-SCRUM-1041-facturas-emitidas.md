# SCRUM-1041 · card «Facturas emitidas» (exportView.js): 4 textos, sin marcador

**Aprobado por el orquestador por delegación del fundador** el 2026-09-22 — SCRUM-1041 comentario 16306.

## Los literales, tal cual se pintan

`public/dashboard/js/exportView.js`, card `#libro-emitidas-card`:

> Un CSV con las facturas que has emitido en un trimestre.

Línea descriptiva de la card (`:87`).

> Año

Rótulo del campo `#libro-anio` (`:90`).

> Trimestre

Rótulo del campo `#libro-trimestre` (`:94`).

> Descargar CSV

Botón `#btn-libro-emitidas` (`:100`).

## Qué cambió

Los cuatro llevaban `[PENDIENTE microcopy oficial]` / `[PENDIENTE]` desde SCRUM-138. Se
sustituyen por el texto de arriba; nada más en la card cambia.

## Lo que queda SIN firmar, y por eso NO se toca

Los 5 avisos de la pantalla del Libro de registro (`libroRegistroView.js`: `descuadre`,
`avisoIlegibles`, `avisoAjenas`, `avisoSinNumero`, `trazaNoSellado`). No son microcopy de
producto: `docs/legal/PREGUNTAS_ASESOR.md` §21 los registra como dictamen fiscal, separados por
el fundador el 19-ago-2026 de los 16 que sí aprobó ese día. Siguen con el marcador. Detalle en
`docs/master/SCRUM-1041.md`.
