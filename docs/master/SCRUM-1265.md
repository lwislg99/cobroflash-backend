# SCRUM-1265 · las casillas de `.pay-methods-row` a 44 px

## 19-oct-2026 · S2 · arreglo (rama `scrum-1265-casillas-de-pago-44px`)

**Medido contra:** `origin/main` = `cd85e34b1e5bfaf561f010f550296bd94b659e75` · 2026-10-19T06:48:13Z

**Skill UI:** cargada · sólo CSS acotado a `.pay-methods-row` (`public/dashboard/css/styles.css`), sin tokens nuevos ni texto nuevo; un componente.

**Decisión (orquestador, 19-oct):** objetivo ≥44 px sin agrandar la casilla a la vista, con un patrón que ya
exista en el panel. El bloqueo del ticket era «decidir el patrón».

**Patrón elegido: el de `.doc-asignados-fila` (SCRUM-1559g),** no el `style.minHeight` puesto por JS: ése se
pierde al serializar (SCRUM-713c lo sacó del JS). En el panel hay dos familias, y ésta es la de la casilla
DENTRO de una etiqueta (`.parte-tipo label`, `.quote-line__suplido label`, `.jobs-asignar-fila`,
`.doc-asignados-fila`): la etiqueta, que es lo que recibe el toque, sube a 44. La otra, `.casilla-tactil-44`
(SCRUM-786), es para la casilla suelta; 1559g las combinó y aquí se hace igual:

- `.pay-methods-row label { min-height: 44px; min-width: 44px }` (el ancho, por «NIF»: 43,5 px).
- La casilla, `position: relative` + `::before` con `inset: -14px`: 16 + 2 × 14 = 44, justo dentro de su
  etiqueta. Así también llega a 44 un censo que mida la casilla y no la etiqueta. A la vista sigue en 16 × 16.
- `.pay-methods-row { row-gap: 0 }`: con el `gap: 14px` de antes, dos líneas de etiquetas de 44 dejaban 14 px
  muertos entre ellas. Pegadas, las áreas se tocan y ninguna entra en la otra.

Afecta a las tres filas del componente (formas de pago, datos del cliente en el documento, cláusulas): es
una sola clase, y AB6 vale para las tres.

**Medido en yaqu.app** (build `cd85e34b1`, cuenta QA, editor de presupuesto nuevo) sirviendo el `styles.css` de
la rama; sonda fuera del repo `sondas-s2/tactil-1265.mjs [css]`, sólo GET. Los pasos y las filas plegadas se
abren poniéndoles a mano las clases del estado abierto (`is-abierto`, `is-desplegado`); el CSS de la fila no
se toca. «Activa» = barrido de `elementFromPoint` desde el centro de la casilla, contando la casilla y SU
etiqueta; se para al entrar en otra.

| ancho | fila | prod: etiqueta · activa (alto) · casilla sola | rama: etiqueta · activa · casilla sola |
|---|---|---|---|
| 390 | formas de pago (2 líneas) | 20,1 · 21,5 · 16,5 (Transferencia 40,3 · 41,5) | 44 · 44-44,5 · 44-44,5 |
| 390 | datos del cliente (4) | 20,1 · 21,5 · 16,5 | 44 · 44,5 · 44,5 |
| 390 | cláusulas (2, QA) | 20,1 · 21,5 · 16,5 | 44 · 44,5 · 44,5 |
| 1280 | formas de pago | 21,8 · 22,5 · 16,5 | 44 · 44,5 · 44,5 |
| 1280 | datos del cliente | 20,1 · 21,5 · 16,5 | 44 · 44,5 · 44,5 |
| 1280 | cláusulas | 20,1 · 21,5 · 16,5 | 44 · 44,5 · 44,5 |

Ningún área entra en la de otra casilla: el ancho «activo» de cada una es su etiqueta más los 14 px de su
`::before` a la izquierda (Tarjeta 88 → 101,5). Página +0 en los dos anchos. Lo que crece es el aire: el
editor con esos pasos abiertos, 3017 → 3078 px a 390 (+61); a 1280 el alto de la vista no cambia (2540). Capturas fuera del repo:
`sondas-s2/cap1265/pagos-{390,1280}-{prod,rama}.png`.

**Test** `tests/scrum1265-casillas-de-pago-44px.test.mjs` (sin gate; el caso de la vista usa el banco, que
pide `dist`): las reglas con sus números (44, `row-gap: 0`, `inset: -14px`, la casilla sin `width`/`height`),
y que el editor pinte cada hijo de `.pay-methods-row` como `<label>` con UNA casilla dentro.
**Rojos sembrados**, deshechos cada vez y comprobado byte a byte: ① min-height 20 · ② sin min-width ·
③ sin `row-gap` · ④ sin `::before` · ⑤ `inset: -16px` · ⑥ casilla con `width/height: 44px` · ⑦ formas de pago
pintadas en `<span>` → cada uno cae en su caso. Los 137 ficheros que leen `styles.css` o `quotesView.js`
(1.351 tests), con la rama y con el `styles.css` de `origin/main`: ningún rojo nuevo; los dos de 1265 sólo en
la base. (`tsc` con el error conocido de `activityKind`, Prisma desfasado; no se ha corrido `prisma generate`.)

A9: comprobación → `tests/scrum1265-casillas-de-pago-44px.test.mjs`
