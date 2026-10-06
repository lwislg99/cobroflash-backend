# SCRUM-1375 · La ficha del albarán dice la facturación con palabras

**Medido contra:** `origin/main` = `eca8566d130fc35e455b27508b1f3c199dc6263b` · 2026-10-02T17:07:37Z
A9: sin fallo que generalice — el defecto era un valor del dato pintado tal cual; lo que impide que vuelva es el propio test (`tests/scrum1375-facturacion-con-palabras.test.mjs`, caso del valor desconocido)

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Cambio de texto en `public/dashboard/js/albaranDetailView.js`: sin marcado nuevo, sin estilos y sin clases nuevas.

2-oct-2026 · **S4** (`s4-2octd`) · rama `scrum-1375-facturacion-con-palabras`.

## Qué pasaba

En el detalle del albarán, la fila «Facturación» escribía el valor del dato: `sin_facturar`, con su guion bajo. La píldora de la cabecera escribía `parcial` y `facturado`, también crudos. Visto en yaqu.app el 1-oct-2026 con el albarán 46 de la cuenta QA.

## Qué cambia

- `TEXTOS_FACTURACION_ALBARAN` y `textoDeFacturacion(valor)`: los tres literales firmados en SCRUM-1375 c.18203 («Sin facturar», «Facturado en parte», «Facturado»). Ficha: `docs/microcopy/2026-10-02-SCRUM-1375-facturacion-del-albaran.md`.
- La fila y la píldora salen de la misma función: dicen lo mismo.
- Un valor que el código no conoce no se pinta: raya «—» en la fila y sin píldora. Se mira con `hasOwnProperty`, así que `constructor` tampoco pasa por conocido.

## Decisión tomada al construir

La firma dice que lo desconocido pinta la raya en la fila. De la píldora no dice nada: he dejado que un valor desconocido **no lleve píldora**, porque una píldora con una raya dentro no dice nada y la fila ya lo cuenta.

## Verificado, ejecutando

`tests/scrum1375-facturacion-con-palabras.test.mjs`, 6 tests, sobre la pantalla de verdad en el banco.

- **Antes del cambio: 5 rojos, 1 verde.** El verde es el control: sin dato, la fila ya pintaba la raya.
- **Después: 6 de 6.**

## Lo que NO está medido, y lo que queda fuera

- **El gemelo, sin tocar:** la lista de albaranes (`albaranesView.js:433`) pinta en cada fila el valor del dato tal cual («sin_facturar» no, porque `etiquetaCobro` cambia el guion por un espacio en las pestañas; «parcial» y «facturado» sí). Tras este cambio la lista dice «parcial» y la ficha «Facturado en parte». La lista estaba fuera del ticket y su texto no está firmado: se dice al orquestador, no se toca aquí.
- La fila del Trabajo (`jobDetailView.js:2015-2017`) ya decía «Facturado»; qué dice para `parcial` no lo he comparado con estos literales.
- Lo visto en yaqu.app va en el comentario de entrega del ticket, con su límite: la cuenta QA no tiene albaranes `parcial` ni `facturado` (SCRUM-1367).
