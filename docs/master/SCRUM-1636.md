# SCRUM-1636 · el tipo de IVA con PUNTO decimal, y Productos partido a 1280 px

**Medido contra:** `origin/main` = `eafca9fe154c26d38b05a748ca816ba098943724` · 2026-10-29T12:20:37Z

A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`

Error propio del puesto: este registro se empujó SIN su línea A9 y el obligatorio de #2996 cayó por eso
(run 40925537638, `scrum1294` y, por arrastre, `scrum976` ④). El guard que la nombra es el que lo cazó.

## SCRUM-1636 ② · Productos ya no parte el ID ni la píldora a 1280 px (29-oct-2026)

**Skill UI:** cargada (yaqu-premium-ui) antes de tocar `public/`. Sólo CSS, sin tokens ni textos nuevos: ningún literal cambia.

Puesto S2. Rama `scrum-1636-iva-con-coma-y-productos-1280`, worktree `s2-29oct-1636`. `styles.css` es S2
(`node scripts/carriles.mjs de public/dashboard/css/styles.css` → `dos-equipos.md:150`, contenedor).

**Causa:** la regla global `.table td { word-break: break-word }` deja el ancho mínimo de una celda en UNA
letra. La misma causa y el mismo arreglo que Albaranes (SCRUM-1559i A): en `.catalogo-productos .table td`,
desde 641 px, `word-break: normal; overflow-wrap: break-word` (se parte por palabras, nunca dentro de una).

**Medido en yaqu.app** (cuenta QA, sólo GET; sonda `docs/master/evidencias/scrum1636/partidos-1636.mjs`,
salidas `partidos-antes.txt` = prod, `partidos-despues.txt` = el `styles.css` de la rama servido). El
instrumento cuenta las líneas de un Range sobre el texto; CONTROL: «ACTIVO» en 12 px con break-all sale en
6 líneas en las seis pasadas.

| ancho | prod (antes) | rama (después) |
|---|---|---|
| 1280 | 5 de 5 filas partidas (ID «238» y «ACTIVO» en 2 líneas), desborde 0, fila máx. 104 | 0 de 5, desborde 0, fila máx. 104 |
| 390 | 0 partidas, desborde 156 (tabla en bloque, ya era así), fila 65 | idéntico |
| 1920 | 0 partidas, desborde 0, fila 69 | idéntico |

Aceptación del ②: visto a 1280 → PENDIENTE de ver en yaqu.app cuando entre en `main` (la sonda sin
argumento lo mide). 390 y 1920: no empeoran (tabla de arriba). Ningún literal cambia.

## SCRUM-1636 ① · SIN CONSTRUIR (pasa al relevo)

Censo del panel (`public/**/*.js`, toda interpolación seguida de «%», 43 líneas, más las etiquetas del
selector de tipos): 5 sitios S2 pintan el tipo con punto — `quotesView.js:2858` (chip de la línea; y su
«Dto.» en :2862), `quotesView.js:5342` («IVA por defecto»), `tiposDeIva.js:79` (etiqueta de las opciones de
los dos selectores), `reportsView.js:473`, `expensesView.js:630`. Ya con coma desde SCRUM-1608:
`quotesDetailView.js:759`, `productsView.js:821`, `aiQuoteAssistant.js:147`. El criterio único ya existe:
`fmtTipoIvaEs` (`api.js`) en el panel y su gemela `rotuloDeTipo` (`core/utils/utils.ts`) en el servidor.
Sitios de S1 (no tocados): `presentacionIva.ts:181`, `quoteDecisionLanding.routes.ts:498`,
`modelo303/casillas.ts:152`; `registro.builder.ts:320` es un mensaje interno.

## SCRUM-1636 ① · el tipo de IVA con COMA decimal en el panel (29-oct-2026, rama `scrum-1636b-iva-con-coma`)

**Medido contra:** `origin/main` = `7acb753a1089dccb71122710d3e2b5ed70e61fac` · 2026-10-29T18:08:59Z

A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`

Error propio del puesto: la tanda de «vecinos» de abajo se eligió por los ficheros del PANEL tocados y dejó
fuera los guards que leen `docs/master/`; por eso no vio que a este tramo (y al de arriba) les faltaba la
línea A9. Lo cazó el guard nombrado, al correrlo el relevo antes de que el obligatorio diera veredicto.

**Skill UI:** cargada (yaqu-premium-ui) antes de tocar `public/`. Sin tokens, sin clases y sin texto nuevo:
sólo cambia el SEPARADOR del número que ya se pintaba. Puesto S2; los cinco ficheros son S2
(`node scripts/carriles.mjs de …` → `dos-equipos.md:152`). Rama aparte de la del ② (#2996) por A17.

**Criterio:** `fmtTipoIvaEs` (`api.js`, SCRUM-1608), que recibe la FRACCIÓN; los cinco sitios tienen el tipo
en porcentaje y le pasan `x / 100`. No toca el redondeo de 1608 (un 7,5 sigue «7,5», no «8»). Un entero
sigue igual: «21», nunca «21,0».

| sitio | antes | después |
|---|---|---|
| chip de la línea (`quoteSuplido.js`, `resumenAjustes`, que compone el chip de `quotesView.js:2858`) | «IVA 7.5 %» | «IVA 7,5 %» |
| «IVA por defecto» del documento suelto (`quotesView.js:5342`) | «IVA por defecto 7.5 %» | «IVA por defecto 7,5 %» |
| opciones de los dos selectores de tipo (`tiposDeIva.js:79`) | «7.5» | «7,5» (el `value` sigue «7.5», que es lo que se guarda) |
| Informes, desglose del IVA por tipo (`reportsView.js:473`) | «7.5%» | «7,5%» |
| ficha del gasto, «Tipo de IVA» (`expensesView.js:630`) | «7.5%» | «7,5%» |

**Decisión declarada (chip):** el formato va DENTRO de `resumenAjustes` y no en la llamada. Ponerlo en la
llamada (`resumenAjustes(…, fmtTipoIvaEs(safeVat / 100), 0)`) tumbaba `scrum598` (la puerta del margen
busca `safeVat, 0`); se arregló el código, no el guard (regla 41). `resumenAjustes` sólo tiene ese
llamador. Fuera del navegador (la suite carga `quoteSuplido.js` suelto) `fmtTipoIvaEs` no existe y el número
sale tal cual; en `index.html`, `api.js` (línea 247) carga antes que `quoteSuplido.js` (280) y `tiposDeIva.js` (295).

**NO HECHO, y por qué — el «Dto.» del chip (`quotesView.js:2862`, apuntado «de paso»):** un descuento de
línea con decimales sigue saliendo «Dto. 12.5 %». `scrum594` fija por FORMA el literal
`` Dto. ${dtoDeEsta} % `` en el código; la única manera de darle coma sin tocar ese guard es disfrazar el código
para que encaje en su patrón, y eso es rodearlo. No es el tipo de IVA. Queda para quien decida si el guard
de 594 se re-ancla.

**Rojo primero y mutaciones:** `tests/scrum1636b-tipo-de-iva-con-coma.test.mjs`, 5 casos por efecto en el
banco, cada uno con su CONTROL de 21. Con el cambio, 5/5. Cada mutación de `MUTACIONES_QUE_ME_TUMBAN` (que
es devolver ese sitio a lo que hay en `origin/main`) tumba SU caso: 5/5 caen.

**Vecinos:** los 291 ficheros de `tests/` que cargan el panel o nombran uno de estos ficheros: 2.441 tests,
2.433 verdes, 7 saltados (gateados), 1 rojo = `scrum1340` (este registro todavía no existía; lo cubre la línea
«Skill UI» de arriba). `censo:mudez --escribir`: sin cambios. `scrum553`: 20 (tope 20).

**Aceptación → dónde se ve**

| aceptación | dónde se ve |
|---|---|
| Los cinco sitios S2 con coma | el test, 5 casos, y la tabla de arriba |
| Un entero no gana coma ni «,0» | el CONTROL de 21 de cada caso |
| No deshace 1608 | `tests/scrum1608-tipo-de-iva-con-decimal.test.mjs` verde entre los vecinos |
| Sin texto nuevo | ningún literal cambia; sólo el separador del número |
| Visto en yaqu.app | pendiente hasta que entre en `main` (Productos ya estaba bien; mirar editor, Informes y gasto) |
| Los tres sitios de S1 | NO tocados: `presentacionIva.ts:181`, `quoteDecisionLanding.routes.ts:498`, `modelo303/casillas.ts:152` |

## SCRUM-1636 ① (b) · el «Dto.» del chip con COMA decimal (29-oct-2026, misma rama `scrum-1636b-iva-con-coma`)

**Medido contra:** `origin/main` = `8dcf269130bab35d42a9fa4ba3d026d0efb98152` · 2026-10-29T18:39:27Z

A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`

Cierra el «NO HECHO» de arriba. Decisión del orquestador (29-oct, encargo a S2): se arregla, porque un chip con
«IVA 7,5 %» bien y «Dto. 12.5 %» mal, el uno al lado del otro, es el defecto del ticket a medias.

| sitio | antes | después |
|---|---|---|
| «Dto.» del chip de la línea (`quotesView.js:2864`) | «Dto. 12.5 %» | «Dto. 12,5 %» |
| un descuento entero | «Dto. 10 %» | «Dto. 10 %» (igual: sin coma ni «,0») |

**Criterio:** `fmtNumeroEs` (`api.js`, SCRUM-743), no `fmtTipoIvaEs`: un descuento no es un tipo de IVA, y
`dtoDeLinea` ya lo da en porcentaje (0–100). Deja un entero sin decimales y no fuerza ninguno. `api.js` carga
antes que `quotesView.js` en `index.html` y en el banco (`tests/_banco-vistas.mjs`).

**Por qué en la llamada y no en `resumenAjustes`:** el «Dto.» nunca ha vivido en `resumenAjustes`; se AÑADE en la
llamada desde SCRUM-594, precisamente para no cambiar la firma de esa pieza del suplido (SCRUM-500). La llamada
sigue siendo `resumenAjustes(esSuplido, safeVat, 0)`, que es lo que mira `scrum598`: no se toca.

🔴 **RE-ANCLAJE DECLARADO de `scrum594` (regla 41: se declara para que no se lea como aflojar un guard):**
- **Ancla que había:** `/Dto\. \$\{dtoDeEsta\} %/` en `tests/scrum594-descuentos-presupuesto.test.mjs:384`.
- **Ancla que pongo:** `/Dto\. \$\{fmtNumeroEs\(dtoDeEsta\)\} %/`.
- **Por qué es intencionado:** el guard exige que el chip COMPONGA el descuento de ESTA línea (CONT-01 ②). Lo sigue
  exigiendo, con la misma variable; sólo cambia la forma del número. No es más laxo: un chip sin el descuento, o
  con el descuento de otra línea, sigue cayendo. Sin el re-anclaje, el guard fijaba el PUNTO decimal, que es justo
  el defecto del ticket.

**Rojo primero:** `tests/scrum1636b-tipo-de-iva-con-coma.test.mjs`, caso del chip, ahora con 12,5 y con el CONTROL
del 10 entero. Sin el cambio de `quotesView.js`: cae con «IVA 7,5 % · Dto. 12.5 %». Con el cambio: verde.

**Vecinos:** 1636b, 594, 598, 139 (×5), 500, 930, 601, 719, 1294, 267, 811c, 976 (+ los que casó el filtro):
260 tests, 254 verdes, 6 saltados, 0 rojos.

**Aceptación → dónde se ve**

| aceptación | dónde se ve |
|---|---|
| «Dto.» con coma | el caso del chip del test (12,5) |
| Un entero no gana coma ni «,0» | el CONTROL del 10 del mismo caso |
| `scrum598` intacto | la llamada a `resumenAjustes` no cambia; 598 verde entre los vecinos |
| Re-anclaje de 594 declarado | este tramo y el mensaje del commit |
| Visto en yaqu.app | pendiente hasta que entre en `main`: editor, una línea con Dto. 12,5 y otra con 10 |
