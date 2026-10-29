# SCRUM-1636 · el tipo de IVA con PUNTO decimal, y Productos partido a 1280 px

**Medido contra:** `origin/main` = `eafca9fe154c26d38b05a748ca816ba098943724` · 2026-10-29T12:20:37Z

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
