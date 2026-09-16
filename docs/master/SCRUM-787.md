# SCRUM-787 · El número que falta para poder decidir sobre `.btn-sm`

**Fecha:** 6-sep-2026 · **Carril:** medición (AB6, objetivo táctil) · **Gate:** sin gate — censo, no guard
**Medido contra:** `origin/main` = `5c9c8da0ce66d259364309b441e68cd08c7e6287` · 2026-09-06T12:43:43+01:00
**Tanda:** 5642 tests, 5554 pass, 0 fail, 88 skipped (salida 0)

> **Esta entrada NO arregla ni un botón.** Trae el número; la decisión es del fundador.

---

## El número

Con el **área de toque** como árbitro —`elementsFromPoint`, el mismo medidor compartido que usa
`guard:objetivo-tactil`—, a **929 y 390 px**, sobre **18 superficies del panel**:

| | |
|---|---|
| **elementos DISTINTOS por debajo de 44 px** | **76** |
| mediciones (pantalla × anchura × elemento) | 153 |
| de los distintos, con `.btn-sm` | **57 · 75,0 %** |
| de los distintos, **SIN** `.btn-sm` | **19** |

**El 13 de partida eran 11.** El encargo decía «13 táctiles» en Clientes; el guard imprime hoy
**11 cortos a 929 px** y **2 a 390 px**, y los dos de 390 (`⬆ Importar CSV` y `N`) son **los
mismos** que ya salen a 929. Elementos distintos: **11**. El 13 sale de sumar las dos anchuras.
Mi censo reproduce al guard elemento a elemento (`929 → 20 medidos / 11 cortos / 6 no tocables`;
`390 → 19 / 2 / 6`), y ése es su control positivo.

## 🔴 Lo que cambia la decisión: `.btn-sm` NO lo explica todo

Si el fundador sube `.btn-sm` a 44 px, **quedan 19 cortos**, y **14 de ellos son botones
NORMALES** — sin `.btn-sm`— que miden **36–37 px** porque ése es el alto del botón base:

| clase | distintos | área de toque | pantallas |
|---|---|---|---|
| `BUTTON.btn-primary` | 6 | 36,9–37,0 | 6 |
| `BUTTON.btn.btn-primary` | 3 | 36,7–36,9 | 3 |
| `BUTTON.btn.btn-secondary` | 3 | 36,8–36,9 | 2 |
| `BUTTON.btn-secondary` | 2 | 36,2–36,7 | 1 |
| **`INPUT`** (casillas) | **3** | **14,0–24,2** | 3 |
| `BUTTON.home-action` | 1 | 34,0 | 1 |
| `BUTTON.detail-miga-link` | 1 | **19,6** | 1 |

⇒ **son dos decisiones, no una:** `.btn-sm` (57) y el **botón base a 36–37 px** (14). Y aparte, un
tercer grupo pequeño y mucho peor: **casillas y migas a 14–24 px**, que no son cuestión de una
clase compartida sino de esos sitios concretos.

### Los `.btn-sm`, desglosados

| clase | distintos | área de toque | pantallas |
|---|---|---|---|
| `BUTTON.btn-sm.btn-ghost` | 15 | 30,5–30,9 | 4 |
| `BUTTON.btn-secondary.btn-sm` | 12 | 30,6–31,0 | 6 |
| `BUTTON.btn-ghost.btn-sm` | 8 | 29,7–30,9 | 5 |
| `BUTTON.btn-primary.btn-sm` | 6 | 30,0–31,0 | 6 |
| `BUTTON.btn-sm.btn-secondary` | 4 | 30,5–30,9 | 4 |
| `BUTTON.btn.btn-secondary.btn-sm` | 4 | 30,8–30,9 | 2 |
| `BUTTON.btn.btn-danger.btn-sm` | 2 | 30,8–30,9 | 2 |
| `BUTTON.btn-ghost.btn-sm.quote-header-btn` | 2 | 30,8–36,9 | 1 |
| `BUTTON.overflow-trigger.btn-ghost.btn-sm` · `A.btn-secondary.btn-sm` · `BUTTON.btn.btn-primary.btn-sm` · `A.btn-primary.btn-sm` | 1 c/u | 30,6–30,7 | 1 c/u |

## Por pantalla

| distintos | pantalla | | distintos | pantalla |
|---|---|---|---|---|
| 10 | `renderSettingsView` | | 4 | `renderAlbaranDetailView` |
| 8 | `renderProductsView` | | 4 | `renderQuotesListView` |
| 8 | `renderQuotesView` | | 3 | `renderExpensesView` |
| 6 | `renderCobrosView` | | 3 | `renderExportView` |
| 6 | `renderJobDetailView` | | 3 | `renderTemplatesView` |
| 5 | `renderCustomersView` | | 2 | `renderHomeView` |
| 5 | `renderProvidersView` | | 2 | `renderInvoicesView` |
| 5 | `renderReportsView` | | 2 | `renderJobsView` |

`renderPartesOficinaView` y `renderQuoteRequestsView` se midieron y dieron **0 interactivos**: con
estos datos de muestra no pintan ninguno. No es «cumplen»; es que no había nada que medir.

## Cómo se ha medido, y por qué se puede creer

* **El árbitro es el del guard, no una copia.** Se importa `FUENTE_MEDIDOR` de
  `scripts/_medidor-de-toque.mjs`, que instala `window.__areaDeToque` y expande desde el centro
  con `elementsFromPoint`.
* 🔴 **La caja CSS no decide.** Este mismo censo lo demuestra: `BUTTON.detail-miga-link` da
  **19,6 px de área de toque**. La caja miente siempre hacia el lado cómodo.
* **La población se deriva**: las vistas que el banco publica (`render*View`), como en SCRUM-698.
* ✅ **LA SONDA, superficie a superficie y anchura a anchura**: un botón de 12 px inyectado en cada
  página tiene que salir corto. **36 de 36 cazadas.** La superficie que no la caza no está medida
  aunque devuelva cero. La sonda va en el HTML servido, **en memoria: no se toca ningún fichero**.
* ✅ **Control positivo final**: reproducir lo que el guard imprime para Clientes. Cuadra.

## Las 8 que NO se han medido — y no se cuentan como cero

| vista | motivo |
|---|---|
| `renderAlbaranesView` | 11 nodos: a medias con estos datos |
| `renderCustomer360View` | 2 nodos |
| `renderInvoiceDetailView` | 2 nodos |
| `renderLibroRegistroView` | 9 nodos |
| `renderParteDetailView` | 2 nodos |
| `renderPlansView` | 5 nodos |
| `renderQuoteDetailView` | 11 nodos |
| `renderTeamView` | 14 nodos |

Todas montan sin error; lo que les falta es **fixture**: con los datos de muestra de este censo se
quedan en el estado vacío o a medias, y un árbol de dos nodos no es una pantalla medida. **Su cero
no cuenta como cumplimiento.** Ampliar el fixture las incorporaría — es trabajo, no un imposible.

## Lo que propongo vigilar (la decisión es del asesor)

**No propongo meter las 18.** Medir es barato; vigilar se paga en cada PR. Medido hoy:

* `npm run censo:guards-navegador` → **11 guards de navegador · 343,7 s en serie**, de los cuales
  `guard:objetivo-tactil` cuesta **21,3 s** con sus dos superficies actuales.
* Este censo, con **18 superficies × 2 anchuras + sonda (72 páginas)**, tarda **30 s** de punta a
  punta. O sea: el coste fijo (arrancar navegador y montar las vistas) domina, y **cada superficie
  añadida al guard cuesta poco**. No doy una cifra por superficie porque no la he aislado.

Con eso, mi propuesta —dos superficies, no dieciocho—:

1. **`renderQuotesView`** — 8 distintos, y es la pantalla que más se usa (el editor de presupuesto).
2. **`renderJobDetailView`** — 6 distintos, y tiene **los dos peores del árbol**: una casilla a
   **14,0 px** y una miga a **19,6 px**. Además es la pantalla que se usa **en obra, de pie**.

`renderSettingsView` tiene más (10) pero es configuración, no uso diario; y arrastra 9 nodos «sin
pintar» que habría que entender antes de vigilarla.

## Huecos declarados

1. **Ocho vistas sin medir por falta de fixture** (tabla arriba). Es el hueco más grande: el 76 es
   un **suelo**, no el total del panel.
2. **Dos vistas con cero interactivos** (`partes-oficina`, `quote-requests`) con estos datos: no
   son un cumplimiento, son una ausencia de población.
3. **Sin JS vivo.** `_pagina-panel.mjs` sirve el marcado serializado: se mide **geometría**, no
   comportamiento. Un objetivo que crezca por JS al enfocar no se ve aquí.
4. **Sólo dos anchuras** (929 y 390), las que dejó medidas SCRUM-782.
5. **Los `noTocables` no entran en el número.** En Clientes son 6 casillas tapadas por su `TD`;
   están en la salida del censo pero no en el 76, porque «no se alcanza» y «es pequeño» son
   defectos distintos y mezclarlos daría un total que no significa nada.
6. **No se han medido los modales**: sólo lo que la vista pinta al montarse.

## Ficheros

| fichero | qué |
|---|---|
| `scripts/censo-objetivo-tactil-panel.mjs` | **nuevo** · el censo, con su sonda y sus dos controles positivos |
| `package.json` | **nuevo** · alias `censo:tactil-panel`, con su `//comentario` |
| `docs/master/SCRUM-787.md` | **nuevo** · esta entrada |

**No se ha tocado:** ni un botón · ni `EXCEPCIONES_PANEL` · ni `guard:objetivo-tactil` ·
ni `customersView`, `productsView` o `providersView` · ni un literal.
