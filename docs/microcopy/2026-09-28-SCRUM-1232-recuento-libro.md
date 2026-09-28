# SCRUM-1232 · el recuento del Libro de registro concuerda en singular

**Aprobado por el orquestador por delegación del fundador** el 2026-09-28 — SCRUM-1232 comentario 17435.

## El literal, tal cual está en el código

`public/dashboard/js/libroRegistroView.js`, ranura `COPY.recuento` (el subtítulo `#libro-recuento`):

> (n) => n === 1 ? '1 factura' : n + ' facturas'

Lo que se pinta: «1 factura» con un asiento; «N facturas» con cualquier otro número (también «0 facturas»).

## Qué cambió, y la condición de la firma

Antes era `n + ' facturas'`, que con un solo asiento pintaba «1 facturas».

La firma vale **sólo junto al filtro de justificantes del mismo PR** (SCRUM-1232): con el filtro, el
recuento cuenta facturas de verdad y la frase es cierta. Sin él, «1 factura» contando un justificante
sería una frase correcta diciendo algo falso. Por eso el literal y el filtro entran en el mismo commit.

## Lo que queda SIN firmar en esta pantalla

Los 5 avisos con marcador (`descuadre`, `avisoIlegibles`, `avisoAjenas`, `avisoSinNumero`,
`trazaNoSellado`): dependen del asesor (`PREGUNTAS_ASESOR.md` §21). No se tocan.
