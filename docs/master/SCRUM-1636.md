# SCRUM-1636 · el tipo de IVA con PUNTO decimal, y Productos partido a 1280 px

**Medido contra:** `origin/main` = `c93f26a765313ce7834ecf276ddc3c09673527cc` · 2026-10-29T18:19:15Z

A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`

## SCRUM-1636 ③ · el tipo de IVA con COMA en el servidor: la página de firma y el pie del presupuesto (29-oct-2026)

Puesto S1. Rama `scrum-1636c-iva-con-coma-en-el-servidor`, worktree `wt-s1-29oct-1636`. Etiquetas leídas en
Jira: `area-s1` · `area-s2` · `equipo-luis`. Si este fichero choca add/add con el de S2 (#2996, #3003), se
conservan los tramos de los dos.

**Criterio:** `rotuloDeTipo` (`src/core/utils/utils.ts:183`, el de la factura desde SCRUM-636). No hay texto
nuevo: cambia el separador, no la palabra. No toca el redondeo de SCRUM-1446/1608 (un 7,5 sigue «7,5»,
no «8»), y un entero sale igual que antes («21», nunca «21,0»).

| sitio | antes | después |
|---|---|---|
| `quoteDecisionLanding.routes.ts:499` — la página donde **el cliente final** acepta y firma, sin descuento | `IVA (7.5%)` | `IVA (7,5%)` |
| `presentacionIva.ts:184` — el pie (`pieDePresupuesto`): el PDF del presupuesto y la misma página con descuento | `IVA 7.5%:` | `IVA 7,5%:` |
| `quoteDecisionLanding.routes.ts:487` — la expresión que traduce la fila del pie al rótulo de la página | `/^IVA (\d+)%:$/` no casaba con «7,5» y salía el rótulo crudo | `/^IVA (\d+(?:,\d+)?)%:$/` |
| `modelo303/casillas.ts:152` | **NO tocado** | — |

**`modelo303/casillas.ts` no se toca, por dos motivos:** (1) vive en `src/modules/fiscal/`, que está en
`RUTAS_FISCALES` (`scripts/puerta-avisador-rojo.mjs:133`): regla 40; (2) no tiene el defecto: el tipo sale de
`TRIPLETAS` (`casillas.ts:41-44`), tres literales enteros (4, 10, 21), así que nunca pinta un punto.

`pdf.service.ts` (camino de facturación) **no se ha modificado**: el PDF del presupuesto (`generateQuotePdf`,
`:849`) pinta las filas que le da `pieDePresupuesto`, y ahora le llegan con coma, igual que ya las pintaba
`generateInvoicePdf` con `rotuloDeTipo`.

**Prueba:** `tests/scrum1636c-iva-con-coma-en-el-servidor.test.mjs`. Sin el arreglo (revertido sólo en
`dist`): 3 de 4 en rojo; el ④, el control de enteros, pasa en las dos versiones, como debe. Con el arreglo: 4/4.
Los 38 ficheros de tests que nombran `presentacionIva`, `quoteDecisionLanding` o `rotuloDeTipo`: 299/299.

**Lo que cambia por consecuencia, declarado:**
- `tests/scrum1446-los-tres-importes-del-pdf.test.mjs:225` fijaba `rotulo: '7.5%'` en el pie del presupuesto,
  con un comentario que lo anotaba como defecto conocido («lo compone `presentacionIva.ts`, que no es de este
  carril»). Pasa a `'7,5%'`. La cifra (750) y el control al 10 % no se mueven.
- `tests/_expresiones-de-texto.json:71` (catálogo de SCRUM-1325): la expresión editada es OTRA y se
  re-declara con la misma clase (`maquina`): la etiqueta la arma nuestro propio pie.

**Hallazgo, NO arreglado:** `src/core/validation/schemas.ts:189` escribe el tipo de un suplido con IVA como
`Math.round(tax * 100)` dentro de un mensaje de error (un 7,5 % sale «8 %»). Está censado en
`tests/scrum627b-censo-declara-reimplementaciones.test.mjs:57`; tocarlo mueve ese censo y no es este ticket.

**Verificación en yaqu.app:** pendiente del merge. La página de firma se ve con un presupuesto de la cuenta QA
con una línea al 7,5 %.
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
