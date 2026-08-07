# Capturas AB6 · SCRUM-296 (A6) · Libro de Registro

**Medido contra:** `origin/main` = `dc6349675ebafac45c2be5e126063c064bb188d8` · 6-ago-2026
**Cómo:** banco HTML **fuera del repo** que carga el CSS real (`tokens.css` + `styles.css`) y el
**fichero real** de la vista (`libroRegistroView.js`), suplantando solo `apiRequest`. Nada de
markup copiado a mano: si la vista cambia, el banco cambia con ella. Capturado con
`chrome-headless-shell` (Playwright 1223), y la página **se mide a sí misma** (`--dump-dom`).

| fichero | caso | ancho |
|---|---|---|
| `libro-ok-390.png` | tres asientos, uno con importe ilegible | 390 |
| `libro-ok-1280.png` | los mismos, en escritorio | 1280 |
| `libro-error-390.png` | la carga falla | 390 |
| `libro-descuadre-390.png` | 40 facturas miradas, 0 asientos | 390 |
| `libro-vacio-390.png` | 0 miradas: no has facturado | 390 |
| `libro-largos-1280.png` | número largo, 99.999,99 €, 2 albaranes, ajenas y sin número | 1280 |

## Lo que la captura encontró y el conteo de nodos NO

Dos defectos reales, los dos invisibles para un test de DOM porque **el nodo existía**:

1. **El aviso de importes ilegibles no se veía.** Lo pinté con `alert warn`, y `styles.css` oculta
   con `display:none` toda `.alert` que no lleve `success|ok|error|info|warning`. El aviso que
   desaparecía era justo el que dice «este importe no es cero, es que no se pudo leer».
   → Corregido a `warning`, y ahora hay un guard que **deriva los tonos válidos del propio CSS**
   (una lista a mano se desfasa) y falla si algún aviso sale con un tono desconocido.
2. **La tabla no tenía estilos.** Escribí `class="data-table"`, que no existe: el inventario AB3 es
   `.table-scroll` + `.table`. Salía sin padding, con el importe pegado al estado
   (`121,00 €paid`). → Corregido al inventario.

## Medidas

| ancho | scroll horizontal de la PÁGINA | tabla | alto de fila |
|---|---|---|---|
| 360 | **no** | 520 px en 326 visibles (scrollea su envoltorio) | 49 px |
| 390 | **no** | 520 px en 356 visibles | 49 px |
| 768 | **no** | 734 px, entra entera | 49 px |
| 1280 | **no** | 2.357 px en 1.246 visibles | 108/81/52 px |

**Los 2.357 px de escritorio son el marcador, no la pantalla.** Medido: la misma vista con
`MARCADOR = ''` da **1.246 px a 1.280 — exactamente el ancho visible, cero scroll**. Cada marca de
trazabilidad lleva hoy 29 caracteres de `[PENDIENTE microcopy oficial]` delante; con la copy
aprobada la tabla entra entera en escritorio. Es la misma razón por la que las filas pasan de 108 a
53 px.

## Lo NO medido, declarado

* **Foco con Tab real:** la pantalla no añade ningún control interactivo propio (la entrada del
  menú es el patrón existente), así que no hay foco nuevo que medir aquí. **No se ha comprobado**
  el recorrido de tabulación completo del dashboard con esta vista dentro.
* **Contraste AA:** se reutilizan los tokens y las clases existentes (`badge-*`, `alert`, `table`)
  sin color nuevo, pero **no se ha pasado un medidor de contraste**.
* **Matriz de dispositivos real** (Android gama media / iPhone / tablet): solo anchos simulados.
* **Modo demo con marca de agua** y **merchant sin logo**: no aplican a esta pantalla (no pinta
  logo ni documento), y no se han capturado.
* **En móvil la columna de trazabilidad queda fuera de la vista** hasta que se arrastra la tabla.
  Es lo que hace este libro distinto y en un teléfono no se ve de entrada. No lleva
  `table--cards-mobile` porque esa variante apila la fila en una rejilla de cinco áreas fijas y
  este libro tiene ocho columnas. Queda dicho como limitación, no como decisión cerrada.
