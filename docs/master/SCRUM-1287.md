# SCRUM-1287 · A 390 px la casilla cortaba la descripción de la línea del parte

**Medido contra:** `origin/main` = `51d81311b01e19d592ad99a1f1f0817e4121cb55` · 2026-09-29T17:16:08Z

Rama `scrum-1287-descripcion-cortada-390`, construida sobre `scrum-1278-banco-pantalla-de-error` (#1971, S3),
que hace que el banco dé a un `textarea` su `.value` desde el contenido. Sin ese arreglo, los bancos del
parte leerían descripciones vacías.

## Medida ANTES de decidir la forma (yaqu.app, cuenta QA, 390 px, sin escribir nada)

La casilla era un `<input>` de **182 px** con fuente de 16 px: caben unos 20 caracteres. Se escribió cada
descripción en la casilla real sin disparar eventos y se miró `scrollWidth > clientWidth`. Control del
instrumento: «Cable» no desborda y una de 80 caracteres sí.

| Corpus | Total | Se cortan |
|---|---|---|
| Catálogo de gremios (`tradeCatalogs.ts`, `_es`) | 39 | **30 (77 %)** |
| Descripciones de partes en los tests | 28 | 6 |

Conclusión: el problema es de la casilla y no solo de la línea marcada. De paso, los tests usan
descripciones más cortas que las reales.

## Arreglo (sin texto nuevo)

- `parteDetailView.js`: la descripción editable, y la de la línea nueva, pasan a `<textarea rows="1">`
  con la misma clase y el mismo atributo. `crecerDescripcion` le da el alto de su contenido y
  `conectarDescripcion` cancela Intro (con el `input` no metía salto) y cambia un salto pegado por un
  espacio. El parte firmado sigue en celdas de texto.
- `styles.css`: `textarea.parte-linea-desc` con 20 px de línea y relleno 11,5/9,5 px. El reparto es
  **medido**: es el que deja la fila de una descripción corta idéntica píxel a píxel a la del `input`.
- Tests: `scrum1266b` y `scrum889` buscaban `input.parte-linea-desc` → `.parte-linea-desc`, con el mismo
  significado. `scrum889:147` leía el ATRIBUTO `value` porque el banco viejo no rellenaba `.value`. Un
  `textarea` no tiene ese atributo; con el banco de SCRUM-1278 se lee `.value`, y la aserción siguiente
  sigue exigiendo que la fila tecleada ya no exista.

## Verificación en la pantalla REAL (Chrome, 390 px, yaqu.app con el código local servido por `page.route`; el parte servido también por route, así que no se escribió nada)

| Qué | Antes (`input`) | Después (`textarea`) |
|---|---|---|
| Fila de descripción CORTA («Cambio de grifo») | — | **0 píxeles distintos** (control positivo) |
| Casillas cortadas, de 5 (4 largas) | 4 | **0** |
| Línea marcada larga, con «Honeywell Galaxy» | cortada, 44 px | **se lee entera**, 123 px |
| Scroll horizontal | no | no |
| «Firmar aquí mismo» recibe el toque | sí | sí |
| «Es correcto» recibe el toque | sí | sí |
| Errores de página | 0 | 0 |

Test: `tests/scrum1287-descripcion-no-se-corta.test.mjs`, 6/6. Contra la vista de `main` caen 5; el que
queda en verde es el control del parte firmado, que no cambia.
