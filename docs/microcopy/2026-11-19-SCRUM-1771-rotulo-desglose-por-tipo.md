# «Base imponible por tipo», el rótulo de la columna de bases del desglose del PDF

**Aprobado por el fundador** el 19-nov-2026, en **SCRUM-1771**.
Respuesta literal de Javier, «A», a la pregunta del orquestador J; la publicó el orquestador
(`cobroflash-backend-c7`) en el comentario 22164, no el fundador. Literal propuesto por J1 en el
comentario 22159 (opción A).
**Aplicado en el mismo acto** (regla 30), en el tramo SCRUM-1771c.

## Texto aprobado, literal

| dónde | antes | ahora |
|---|---|---|
| PDF de F1, R1 y justificante con MÁS DE UN tipo de IVA: rótulo encima de las filas por tipo | `[PENDIENTE microcopy oficial]` | `Base imponible por tipo` |

## Dónde se pinta

`src/modules/invoicing/infra/pdf/pdf.service.ts`: la constante `MARCADOR_MICROCOPY_DESGLOSE`
lleva el literal, y `generateInvoicePdf` la pinta en la rama de `tiposDeIva.length > 1`. El nombre
de la constante no se ha cambiado: el encargo limitaba el cambio en `src/` a esa única línea.

## Qué cambió

El marcador salió también de `scripts/_marcadores-pendientes-declarados.json` (`papel.constantes`
queda vacía, con `_vacia_desde: "SCRUM-1771 c.22164"`, y la entrada de `pdf.service.ts` en
`servidor.ficheros` se borra).

## Lo vigila

`tests/scrum1771c-pdf-sin-marcador.test.mjs` (nueve papeles; los de dos tipos llevan el literal una
vez y ninguno lleva `[PENDIENTE`, con positivo sembrado) y `tests/scrum903-marcador-no-se-imprime.test.mjs`.

## Lo que queda sin firmar en ese papel

Nada en `papel.constantes`: era el último marcador declarado.
