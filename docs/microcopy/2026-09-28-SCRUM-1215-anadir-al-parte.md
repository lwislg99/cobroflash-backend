# El parte: el botón que añade lo dictado

**Aprobado por el orquestador por delegación del fundador** el 2026-09-28 — SCRUM-1215 comentario 17375.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`. Firmado el 28-sep-2026 y
aplicado el 6-oct-2026: ocho días entre una cosa y la otra (ver «Por qué tardó»).

## Texto aprobado, literal

> Añadir al parte

## Dónde se pinta

`public/dashboard/js/parteDetailView.js`, `TEXTOS.confirmarPropuesta`: el botón que cierra la propuesta del
dictado (`data-propuesta-confirmar`), debajo de las líneas que la máquina ha ordenado.

## Qué cambió

Decía «Añadir estas líneas», que no llegó a aprobarse (comentario 17367 del mismo ticket). Fallaba por una
palabra: «estas» promete que entran las que se ven, y una línea sin cantidad no entra. «Añadir al parte» dice lo
que hace en los tres casos: todas completas, alguna sin colocar (el botón se apaga), alguna sin cantidad (entra
el resto).

## Lo que la firma corrigió de sí misma

El comentario 17377 mantiene el texto y retira uno de sus motivos: no es cierto que cada línea incompleta
llevara siempre su aviso al lado. Los dos casos que destapó (borrar a mano una cantidad; todas sin cantidad) se
arreglaron en SCRUM-1230, sin texto nuevo.

## Condición escrita en la firma

Si algún día la propuesta deja quitar una línea y con eso entran siempre todas, el texto puede volver a «Añadir
estas líneas». Sería otra firma, no ésta reabierta.

## Por qué tardó

Aplicarlo pide mover la entrada del texto en `scripts/_censo-convenio-microcopy-declarados.json`, y esa edición
se denegó el 28-sep-2026. Se hizo el 6-oct-2026 con permiso del fundador, transmitido por el orquestador y
escrito en SCRUM-1215 comentario 18381.

## Lo que no cubre

- El mismo literal en el botón de la hoja del dictado del Trabajo (`jobDetailView.js`): ya lo decía antes y no
  es de esta firma.
- Que la propuesta no deje quitar una línea que no se quiere: es un hueco de producto, no de texto.
