# SCRUM-1635 · la ficha del presupuesto no pintaba la fila del DESCUENTO GLOBAL

**Medido contra:** `origin/main` = `eafca9fe154c26d38b05a748ca816ba098943724` · 2026-10-29T12:20:37Z

## SCRUM-1635 · la ficha explica el descuento global con las filas del PDF y de la firma (29-oct-2026)

**Skill UI:** cargada (yaqu-premium-ui) antes de tocar `public/`. Sin tokens nuevos: la clase
`.quote-total-desglose` lleva el mismo tamaño y el mismo `--muted` que «Base imponible» e «IVA» de
ese bloque, que van en línea; aquí como clase, sin `style=` nuevo.

Puesto S2. Rama `scrum-1635-ficha-descuento-global`, worktree `s2-29oct-1635`. Los dos ficheros son
S2 (`node scripts/carriles.mjs de …`: `quotesDetailView.js` → `dos-equipos.md:152`; `styles.css` →
`dos-equipos.md:150`, contenedor). Ni `src/` ni el camino de emisión: aquí sólo se pinta lo guardado.

### El defecto, por ejecución

`tests/scrum1635-ficha-con-descuento-global.test.mjs` ① sobre `origin/main`, con el caso de #212
(10 × 100 € al 7,5 %, global 100 €):

    🔴 la ficha no explica el descuento global: ["Base imponible: 900,00 €","IVA: 67,50 €","Total: 967,50 €"]

Producción sirve ese mismo dato: `GET /admin/quotes/212` con la cuenta QA (29-oct, ~17:50Z, sólo
lectura, `scripts/qa/sesion-panel.mjs get`) da `total: "967.5"`, `discountGlobalAmount: "100"`,
una línea `{qty: 10, price: 100, tax: 0.075}`. La ficha ya calculaba con el global
(`totalesConDescuento`, SCRUM-888c); lo que faltaba era PINTAR las filas.

### Las cuatro superficies

| superficie | ¿pinta el global? | cómo se sabe |
|---|---|---|
| ficha del presupuesto | NO → **SÍ** con este cambio | test ① en rojo y en verde |
| vista previa del editor | SÍ («Suma de líneas», «Descuento», «Descuento global») | `quotesView.js` `renderPreview`, SCRUM-915h; medido por S4 en yaqu.app |
| página de firma | SÍ (las mismas, sin dos puntos) | leído en el código (`quoteDecisionLanding.routes.ts`, `pieDePresupuesto`), no intentado en prod |
| PDF | SÍ («Suma de líneas:», «Descuento:», «Descuento global:») | leído en el código (`presentacionIva.ts:152-156`), no intentado en prod |

### El texto: no hay texto nuevo

«Suma de líneas», «Descuento» y «Descuento global» están firmados: **SCRUM-888 comentario 15788**
(aprobado por el orquestador por delegación del fundador, `docs/microcopy/2026-09-17-SCRUM-888-descuentos-en-la-firma.md`),
que a su vez son los rótulos del pie del PDF aprobados en SCRUM-594. La ficha los pinta con los dos
puntos, como el PDF y como el resto de su bloque («Base imponible:», «IVA:», «Total:»).

### Lo que cambia

- `quotesDetailView.js`: con descuento global (`descuentoGlobalCents > 0`), delante de «Base
  imponible» salen «Suma de líneas», «Descuento» (sólo si además hay descuento de línea) y
  «Descuento global», con las cifras de `totalesConDescuento` — la misma cuenta que ya daba la base y
  el IVA de la ficha y que la vista previa. El bloque de `hayDescuento` que fija SCRUM-888c no se toca.
- `styles.css`: `.quote-total-desglose`.

**Decisión declarada:** con descuento SÓLO de línea la ficha no gana filas (control ③). La columna de
cada línea ya lleva su descuento dentro, así que nada queda sin explicar; y la aceptación pide que
«sin descuento global no gane ninguna fila». El editor y el PDF sí pintan «Suma de líneas /
Descuento» en ese caso: si se quiere la misma forma en la ficha, es otro corte.

### La cifra cuadra (aceptación 3)

En la ficha montada: Suma de líneas 1.000,00 − Descuento global 100,00 = Base imponible 900,00; +
IVA 67,50 = Total 967,50, el guardado. ⚠️ La cuenta de la aceptación («1.075,00 − 100,00 = 975,00 y
el IVA encima») mezcla con-IVA y sin-IVA: el global se quita de la BASE, como en `calcTotal`, el PDF y
el editor (SCRUM-594). Las cifras sí cuadran entre sí; no hay hallazgo mayor.

Observación, sin tocar: la columna de importe de cada línea de la ficha (y de la vista previa) va CON
IVA (1.075,00) y «Suma de líneas» va SIN IVA (1.000,00), igual que en la vista previa del editor.

### Aceptación → dónde se ve

| aceptación | dónde se ve |
|---|---|
| 1. Rojo primero | `tests/scrum1635-ficha-con-descuento-global.test.mjs` ①: rojo en `origin/main` (arriba), verde en la rama |
| 2. Sin global, ninguna fila nueva | mismo test ② (sin descuento y global «0») y ③ (sólo de línea) |
| 3. Las cifras cuadran | mismo test ①: suma − descuento = base, base + IVA = total, total = 967,50 |
| 4. Visto en yaqu.app (#212) | pendiente hasta que entre en `main` |
| 5. Ningún cambio en emisión | el diff sólo toca `public/` y `tests/` |

### Mutaciones (`MUTACIONES_QUE_ME_TUMBAN` del test)

Base sin mutar 3/3 verde. `pintaDesglose = false` → cae ①. `pintaDesglose` también con descuento de
línea → cae ③.

### Para SCRUM-1624 (portal, J2)

Nada de este cambio se reutiliza en el servidor: el panel pinta con `quoteDescuentos.js` (navegador).
Lo reutilizable para el portal es lo que ya usa la firma: `pieDePresupuesto` (`presentacionIva.ts`),
con los mismos rótulos firmados en SCRUM-888 c.15788.
