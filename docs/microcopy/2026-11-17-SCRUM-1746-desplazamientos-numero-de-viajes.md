# El parte: el campo de los desplazamientos dice su unidad

**Aprobado por el fundador** el 17-nov-2026, en **SCRUM-1746**.
La firma consta en la descripción del ticket: el orquestador le propuso este rótulo en el punto 2 de un
lote numerado y el fundador contestó a ese mensaje, literal, «2 lo que digas». El alcance del sí es ese
punto: este rótulo y nada más.
**Aplicado en el mismo acto** (regla 30).

## Texto aprobado, literal

> Desplazamientos (nº de viajes)

Sustituye a «Desplazamiento» (SCRUM-1215 comentario 17367), que no decía la unidad.

## Dónde se pinta

`public/dashboard/js/parteDetailView.js`, `TEXTOS.desplazamiento`: el rótulo del campo
`desplazamientos` en el paso de las horas de la hoja del parte, junto a «Kilómetros». En borrador rotula
la casilla; firmado, el dato.

## Por qué

El campo guarda el **número de viajes** (`ParteTrabajo.desplazamientos`, un entero). Medido en yaqu.app
el 16-nov-2026, en el recorrido H6 de SCRUM-1686 (fila 18): quien rellenó el parte escribió «20»
creyendo que eran kilómetros, con «Kilómetros» justo al lado.

## Lo que NO cambia

Los tres avisos de esa misma casilla siguen diciendo «Desplazamiento», en singular, porque cada uno
tiene su propia firma y esta no los alcanza:

- `TEXTOS.desplazamientoEsEntero` — SCRUM-1491 comentario 18517.
- `TEXTOS.desplazamientoEsCeroOMas` y `TEXTOS.desplazamientoDemasiadoGrande` — SCRUM-1492 comentario 18706.

Ni el dato ni el esquema cambian.
